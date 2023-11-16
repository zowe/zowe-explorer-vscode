/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 */

import * as PromiseQueue from "promise-queue";
import * as zowe from "@zowe/cli";
import * as path from "path";
import * as fs from "fs";
import * as globals from "./globals";
import * as vscode from "vscode";
import {
    Gui,
    ZoweExplorerApi,
    ZoweExplorerTreeApi,
    IZoweTree,
    IZoweTreeNode,
    IZoweDatasetTreeNode,
    IZoweUSSTreeNode,
    IZoweJobTreeNode,
    ProfilesCache,
    getZoweDir,
    getFullPath,
} from "@zowe/zowe-explorer-api";
import { Profiles } from "./Profiles";
import { ZoweExplorerApiRegister } from "./ZoweExplorerApiRegister";
import { getProfile, ProfilesUtils } from "./utils/ProfilesUtils";
import { ZoweLogger } from "./utils/LoggerUtils";

// Set up localization
import * as nls from "vscode-nls";
nls.config({ messageFormat: nls.MessageFormat.bundle, bundleFormat: nls.BundleFormat.standalone })();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

/**
 * The Zowe Explorer API Register singleton that gets exposed to other VS Code
 * extensions to contribute their implementations.
 * @export
 */
export class ZoweExplorerExtender implements ZoweExplorerApi.IApiExplorerExtender, ZoweExplorerTreeApi {
    public static ZoweExplorerExtenderInst: ZoweExplorerExtender;

    /**
     * Shows an error when the Zowe configs are improperly configured, as well as
     * an option to show the config.
     *
     * @param errorDetails Details of the error (to be parsed for config name and path)
     */
    public static showZoweConfigError(errorDetails: string): void {
        Gui.errorMessage(
            localize("initialize.profiles.error", 'Error encountered when loading your Zowe config. Click "Show Config" for more details.'),
            { items: ["Show Config"] }
        ).then((selection) => {
            if (selection !== "Show Config") {
                return;
            }

            // Parse the v2 config path, or a v1 config path depending on the error message
            const configMatch = errorDetails.includes("Error parsing JSON in the file")
                ? errorDetails.match(/Error parsing JSON in the file '(.+?)'/)
                : errorDetails.match(/Error reading profile file \("(.+?)"\)/);

            let configPath = configMatch != null ? configMatch[1] : null;
            // If configPath is null, build a v2 config location based on the error details
            if (configPath == null) {
                const isRootConfigError = errorDetails.match(/(?:[\\]{1,2}|\/)(\.zowe)(?:[\\]{1,2}|\/)/) != null;
                // If the v2 config error does not apply to the global Zowe config, check for a project-level config.
                if (vscode.workspace.workspaceFolders != null && !isRootConfigError) {
                    configPath = this.getConfigLocation(vscode.workspace.workspaceFolders[0].uri.fsPath);
                } else {
                    configPath = this.getConfigLocation(getZoweDir());
                }

                // If the config w/ culprits cannot be found, all v2 config locations have been exhausted - exit.
                if (configPath == null) {
                    return;
                }
            }
            Gui.showTextDocument(vscode.Uri.file(configPath));
        });
    }

    /**
     * Returns the location of a Zowe config (if it exists) relative to rootPath.
     * @param rootPath The root path to check for Zowe configs
     */
    public static getConfigLocation(rootPath: string): string | null {
        // First check for a user-specific v2 config
        let location = path.join(rootPath, "zowe.config.user.json");
        if (fs.existsSync(location)) {
            return location;
        }

        // Fallback to regular v2 config if user-specific config doesn't exist
        location = path.join(rootPath, "zowe.config.json");

        if (fs.existsSync(location)) {
            return location;
        }

        return null;
    }

    /**
     * Access the singleton instance.
     * @static
     * @returns {ZoweExplorerExtender} the ZoweExplorerExtender singleton instance
     */
    public static createInstance(
        datasetProvider?: IZoweTree<IZoweDatasetTreeNode>,
        ussFileProvider?: IZoweTree<IZoweUSSTreeNode>,
        jobsProvider?: IZoweTree<IZoweJobTreeNode>
    ): ZoweExplorerExtender {
        ZoweExplorerExtender.instance.datasetProvider = datasetProvider;
        ZoweExplorerExtender.instance.ussFileProvider = ussFileProvider;
        ZoweExplorerExtender.instance.jobsProvider = jobsProvider;
        return ZoweExplorerExtender.instance;
    }

    public static getInstance(): ZoweExplorerExtender {
        return ZoweExplorerExtender.instance;
    }

    // Queue of promises to process sequentially when multiple extension register in parallel
    private static refreshProfilesQueue = new PromiseQueue(1, Infinity);
    /**
     * This object represents a collection of the APIs that get exposed to other VS Code
     * extensions that want to contribute alternative implementations such as alternative ways
     * of retrieving files and data from z/OS.
     */
    private static instance = new ZoweExplorerExtender();

    // Instances will be created via createInstance()
    private constructor(
        // Not all extenders will need to refresh trees
        public datasetProvider?: IZoweTree<IZoweDatasetTreeNode>,
        public ussFileProvider?: IZoweTree<IZoweUSSTreeNode>,
        public jobsProvider?: IZoweTree<IZoweJobTreeNode>
    ) {}

    /**
     *
     * @implements ZoweExplorerApi.IApiExplorerExtender.initForZowe()
     * @param {string} profileType
     * @param {imperative.ICommandProfileTypeConfiguration[]} profileTypeConfigurations
     */
    public async initForZowe(profileType: string, profileTypeConfigurations?: zowe.imperative.ICommandProfileTypeConfiguration[]): Promise<void> {
        // Ensure that when a user has not installed the profile type's CLI plugin
        // and/or created a profile that the profile directory in ~/.zowe/profiles
        // will be created with the appropriate meta data. If not called the user will
        // see errors when creating a profile of any type.
        const zoweDir = getZoweDir();
        const workspaceOpen = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
        const projectDir = workspaceOpen ? getFullPath(vscode.workspace.workspaceFolders[0].uri.fsPath) : undefined;

        /**
         * This should create initialize the loadedConfig if it is not already
         * Check Zowe Explorer's cached instance first
         * If it doesn't exist create instance and read from disk to see if using v1 or v2
         * profile management.
         */
        let usingTeamConfig: boolean;
        try {
            const mProfileInfo = await ProfilesUtils.getProfileInfo(globals.ISTHEIA);
            await mProfileInfo.readProfilesFromDisk({ homeDir: zoweDir, projectDir });
            usingTeamConfig = mProfileInfo.usingTeamConfig;
        } catch (error) {
            ZoweLogger.warn(error);
            if (error.toString().includes("Error parsing JSON")) {
                usingTeamConfig = true;
            }
            ZoweExplorerExtender.showZoweConfigError(error.message);
        }

        const hasProfileTypes = profileTypeConfigurations != null && profileTypeConfigurations.length > 0;

        if (!usingTeamConfig && hasProfileTypes) {
            const configOptions = Array.from(profileTypeConfigurations);
            const exists = fs.existsSync(path.join(zoweDir, "profiles", profileType));
            if (configOptions && !exists) {
                await zowe.imperative.CliProfileManager.initialize({
                    configuration: configOptions,
                    profileRootDirectory: path.join(zoweDir, "profiles"),
                });
            }
        }

        if (hasProfileTypes) {
            Profiles.getInstance().addToConfigArray(profileTypeConfigurations);
        }

        // Check if schema needs updated when the end user is using a team config
        if (usingTeamConfig) {
            this.updateSchema(projectDir);
        }

        // sequentially reload the internal profiles cache to satisfy all the newly added profile types
        await ZoweExplorerExtender.refreshProfilesQueue.add(async (): Promise<void> => {
            await Profiles.getInstance().refresh(ZoweExplorerApiRegister.getInstance());
        });
    }

    /**
     * Checks to see if any profile types should be added and adds the new types to the schema, if found.
     * @param projectDir (optional) The workspace directory (if the user has a workspace open)
     */
    private updateSchema(projectDir?: string): void {
        // check for the existence of a project-level schema; if it doesn't exist, fall back to global
        const projSchemaLoc = projectDir ? path.join(projectDir, "zowe.schema.json") : null;
        const projSchemaExists = projSchemaLoc != null && fs.existsSync(projSchemaLoc);
        const schemaPath = projSchemaExists ? projSchemaLoc : path.join(getZoweDir(), "zowe.schema.json");

        // try parsing the existing schema to gather the list of types to merge
        try {
            const schemaContents = fs.readFileSync(schemaPath).toString();
            const parsedSchema = JSON.parse(schemaContents);

            // determine new types that are not present in the on-disk schema
            const schemaTypes = zowe.imperative.ConfigSchema.loadSchema(parsedSchema);
            const newSchemaTypes = Profiles.getInstance()
                .getConfigArray()
                .filter((o) => typeof o === "object");

            // If there are any new types to add, merge the list of profile types and rebuild the schema
            const typesToAdd = newSchemaTypes.filter((s) => schemaTypes.find((newS) => s.type === newS.type) == null);
            if (typesToAdd.length > 0) {
                // Get profile types from config on-disk and merge with new profile types
                const mergedProfTypes = [...schemaTypes, ...typesToAdd];

                // rebuild schema to contain all profile types (including merged) and write to disk
                const newSchema = JSON.stringify(zowe.imperative.ConfigSchema.buildSchema(mergedProfTypes));
                fs.writeFileSync(schemaPath, newSchema);
            }
        } catch (err) {
            // Only show an error if we failed to update the on-disk schema.
            if (err.code === "EACCES" || err.code === "EPERM") {
                Gui.errorMessage(
                    localize(
                        "zowe.schema.cannotAccess",
                        "Failed to update Zowe schema at {0}: insufficient permissions or read-only file",
                        schemaPath
                    )
                );
            }
        }
    }

    /**
     * This method can be used by other VS Code Extensions to access the primary profile.
     *
     * @param primaryNode represents the Tree item that is being used
     * @return The requested profile
     *
     */
    public getProfile(primaryNode: IZoweTreeNode): zowe.imperative.IProfileLoaded {
        return getProfile(primaryNode);
    }

    /**
     * Gives extenders access to the profiles loaded into memory by Zowe Explorer.
     *
     * @implements ZoweExplorerApi.IApiExplorerExtender.getProfilesCache()
     * @returns {ProfilesCache}
     */
    public getProfilesCache(): ProfilesCache {
        return Profiles.getInstance();
    }

    /**
     * After an extenders registered all its API extensions it
     * might want to request that profiles should get reloaded
     * to make them automatically appears in the Explorer drop-
     * down dialogs.
     *
     * @implements ZoweExplorerApi.IApiExplorerExtender.reloadProfiles()
     * @param profileType optional profile type that the extender can specify
     */
    public async reloadProfiles(profileType?: string): Promise<void> {
        // sequentially reload the internal profiles cache to satisfy all the newly added profile types
        await ZoweExplorerExtender.refreshProfilesQueue.add(async (): Promise<void> => {
            await Profiles.getInstance().refresh(ZoweExplorerApiRegister.getInstance());
        });
        // profileType is used to load a default extender profile if no other profiles are populating the trees
        await this.datasetProvider?.addSession(undefined, profileType);
        await this.ussFileProvider?.addSession(undefined, profileType);
        await this.jobsProvider?.addSession(undefined, profileType);
    }
}
