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

import * as globals from "../globals";
import * as vscode from "vscode";
import * as nls from "vscode-nls";
import { Gui } from "@zowe/zowe-explorer-api";
import { ZoweLogger } from "./LoggerUtils";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

export class SettingsConfig {
    /**
     * Retrieves a generic setting either in user or workspace.
     * <pre>{@code
     *  SettingsConfig.getDirectValue<boolean>("zowe.commands.alwaysEdit");
     * }</pre>
     * @param {string} key - The config property that needs retrieving
     */
    public static getDirectValue<T>(key: string): T {
        ZoweLogger.trace("SettingsConfig.getDirectValue called.");
        const [first, ...rest] = key.split(".");
        return vscode.workspace.getConfiguration(first).get(rest.join("."));
    }

    /**
     * Updates a generic setting either in user or workspace.
     * <pre>{@code
     *  SettingsConfig.setDirectValue("zowe.commands.alwaysEdit", true);
     * }</pre>
     * @param {string} key - The config property that needs updating
     * @param {any} value - The value to assign for the config property
     * @param target - VS Code configuration target (global or workspace)
     */
    public static setDirectValue(key: string, value: any, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global): Thenable<void> {
        ZoweLogger.trace("SettingsConfig.setDirectValue called.");
        const [first, ...rest] = key.split(".");
        return vscode.workspace.getConfiguration(first).update(rest.join("."), value, target);
    }

    public static isConfigSettingSetByUser(key: string): boolean {
        const [first, ...rest] = key.split(".");
        const inspect = vscode.workspace.getConfiguration(first).inspect(rest.join("."));
        if (inspect === undefined) {
            return false;
        }

        return (
            inspect.globalValue !== undefined ||
            inspect.workspaceValue !== undefined ||
            inspect.workspaceFolderValue !== undefined ||
            inspect.globalLanguageValue !== undefined ||
            inspect.workspaceLanguageValue !== undefined ||
            inspect.workspaceFolderLanguageValue !== undefined
        );
    }

    /**
     * Checks if the Zowe Explorer major version matches the version
     * defined in the user's `settings.json` file.
     *
     * @param userVersion The user's version defined in settings.json
     * @param versionString The current version string for Zowe Explorer
     * @returns true if the version *roughly* matches, false otherwise - e.g.:
     *
     * `versionMatches("2.6.1", "2")` will return `true`
     *
     * `versionMatches("3", "2")` will return `false`
     */
    public static matchesMajorVersion(userVersion: string, versionString: string): boolean {
        if (userVersion == null) {
            return true;
        }

        if (userVersion.startsWith(versionString)) {
            return false;
        }

        return userVersion !== versionString;
    }

    public static async standardizeSettings(): Promise<void> {
        ZoweLogger.trace("SettingsConfig.standardizeSettings called.");
        // Need to coerce all possible version values to a string to correct previous values
        const globalVersion = String(SettingsConfig.configurations.inspect(globals.SETTINGS_VERSION).globalValue);
        const workspaceVersion = String(SettingsConfig.configurations.inspect(globals.SETTINGS_VERSION).workspaceValue);
        const currentVersion = String(SettingsConfig.currentVersionNumber);

        const globalIsNotMigrated = SettingsConfig.matchesMajorVersion(globalVersion, currentVersion);
        const workspaceIsNotMigrated = SettingsConfig.matchesMajorVersion(workspaceVersion, currentVersion);
        const workspaceIsOpen = vscode.workspace.workspaceFolders !== undefined;
        const zoweSettingsExist = SettingsConfig.zoweOldConfigurations.length > 0;

        // Update version value if there is a mismatch (coerces previous values into numeric ["2.6.1" -> 2])
        if (globalVersion == null || globalVersion !== currentVersion) {
            SettingsConfig.setDirectValue(globals.SETTINGS_VERSION, SettingsConfig.currentVersionNumber);
        }

        if (workspaceVersion != null && workspaceVersion !== currentVersion) {
            SettingsConfig.setDirectValue(globals.SETTINGS_VERSION, SettingsConfig.currentVersionNumber, vscode.ConfigurationTarget.Workspace);
        }

        // Do not migrate unless there are old configurations
        if (!zoweSettingsExist) {
            return;
        }

        if (workspaceIsNotMigrated && workspaceIsOpen) {
            await SettingsConfig.standardizeWorkspaceSettings();
        }

        if (globalIsNotMigrated) {
            await SettingsConfig.standardizeGlobalSettings();
        }
    }

    private static get configurations(): vscode.WorkspaceConfiguration {
        ZoweLogger.trace("SettingsConfig.configurations called.");
        return vscode.workspace.getConfiguration();
    }

    private static get zoweOldConfigurations(): string[] {
        ZoweLogger.trace("SettingsConfig.zoweOldConfiguration called.");
        return Object.keys(SettingsConfig.configurations).filter((key) => key.match(new RegExp("Zowe-*|Zowe\\s*", "g")));
    }

    private static get currentVersionNumber(): number {
        ZoweLogger.trace("SettingsConfig.currentVersionNumber called.");
        const version = vscode.extensions.getExtension("zowe.vscode-extension-for-zowe").packageJSON.version as string;
        // Strip off minor and patch version from number if defined w/ old method
        if (version.includes(".")) {
            return parseInt(version.substring(0, version.indexOf(".")));
        }

        return parseInt(version);
    }

    private static async promptReload(): Promise<void> {
        ZoweLogger.trace("SettingsConfig.promptReload called.");
        // Prompt user to reload VS Code window
        const reloadButton = localize("standardization.reload.button", "Reload Window");
        const infoMsg = localize(
            "standardization.reload.infoMessage",
            // eslint-disable-next-line max-len
            "Settings have been successfully migrated for Zowe Explorer version 2 and above. To apply these settings, please reload your VS Code window."
        );
        await Gui.showMessage(infoMsg, { items: [reloadButton] })?.then(async (selection) => {
            if (selection === reloadButton) {
                await vscode.commands.executeCommand("workbench.action.reloadWindow");
            }
        });
    }

    private static async standardizeGlobalSettings(): Promise<void> {
        ZoweLogger.trace("SettingsConfig.standardizeGlobalSettings called.");
        let globalIsMigrated = SettingsConfig.configurations.inspect(globals.SETTINGS_VERSION).globalValue !== SettingsConfig.currentVersionNumber;

        // Standardize global settings when old Zowe settings were found
        if (SettingsConfig.zoweOldConfigurations.length > 0) {
            for (const configuration of SettingsConfig.zoweOldConfigurations) {
                let globalValue: any = SettingsConfig.configurations.inspect(configuration).globalValue;

                // Adjust fetching of value due to schema change
                if (configuration === "Zowe-Temp-Folder-Location") {
                    globalValue = globalValue ? globalValue.folderPath : globalValue;
                }

                const newSetting = globals.configurationDictionary[configuration];

                if (globalValue !== undefined && newSetting !== undefined) {
                    await SettingsConfig.setDirectValue(newSetting, globalValue);
                    globalIsMigrated = true;
                }
            }
        }

        if (globalIsMigrated) {
            await SettingsConfig.setDirectValue(globals.SETTINGS_VERSION, SettingsConfig.currentVersionNumber);
            await SettingsConfig.promptReload();
        }
    }

    private static async standardizeWorkspaceSettings(): Promise<void> {
        ZoweLogger.trace("SettingsConfig.standardizeWorkspaceSettings called.");
        let workspaceIsMigrated = false;
        // Standardize workspace settings when old Zowe settings were found
        if (SettingsConfig.zoweOldConfigurations.length > 0) {
            // filter to only supported workspace configurations in scope
            const filteredConfigurations = SettingsConfig.zoweOldConfigurations.filter(
                (c) => !c.match(new RegExp("Zowe-[A-Za-z]+-Persistent|Zowe Commands: History", "g"))
            );

            for (const configuration of filteredConfigurations) {
                let workspaceValue: any = SettingsConfig.configurations.inspect(configuration).workspaceValue;

                if (configuration === "Zowe-Temp-Folder-Location") {
                    workspaceValue = workspaceValue ? workspaceValue.folderPath : workspaceValue;
                }

                const newSetting = globals.configurationDictionary[configuration];

                if (workspaceValue !== undefined && newSetting !== undefined) {
                    await SettingsConfig.setDirectValue(newSetting, workspaceValue, vscode.ConfigurationTarget.Workspace);
                    workspaceIsMigrated = true;
                }
            }
        }

        if (workspaceIsMigrated) {
            await SettingsConfig.setDirectValue(globals.SETTINGS_VERSION, SettingsConfig.currentVersionNumber, vscode.ConfigurationTarget.Workspace);
        }
    }
}
