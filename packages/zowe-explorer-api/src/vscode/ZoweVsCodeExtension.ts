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

import * as semver from "semver";
import * as vscode from "vscode";
import * as path from "path";
import { ProfilesCache } from "../profiles/ProfilesCache";
import { Login, Logout, ProfileConstants } from "@zowe/core-for-zowe-sdk";
import * as imperative from "@zowe/imperative";
import { Gui } from "../globals/Gui";
import type { PromptCredentialsOptions } from "./doc/PromptCredentials";
import { Types } from "../Types";
import type { BaseProfileAuthOptions } from "./doc/BaseProfileAuth";
import { FileManagement } from "../utils";
import { VscSettings } from "./doc/VscSettings";

/**
 * Collection of utility functions for writing Zowe Explorer VS Code extensions.
 */
export class ZoweVsCodeExtension {
    public static get workspaceRoot(): vscode.WorkspaceFolder | undefined {
        return vscode.workspace.workspaceFolders?.find((f) => f.uri.scheme === "file");
    }

    public static onProfileUpdatedEmitter: vscode.EventEmitter<imperative.IProfileLoaded> = new vscode.EventEmitter();
    public static readonly onProfileUpdated = ZoweVsCodeExtension.onProfileUpdatedEmitter.event;

    /**
     * @internal
     */
    public static get profilesCache(): ProfilesCache {
        const workspacePath = this.workspaceRoot?.uri.fsPath;
        return new ProfilesCache(imperative.Logger.getAppLogger(), workspacePath);
    }

    /**
     * Get custom logging path if one is defined in VS Code settings.
     */
    public static get customLoggingPath(): string | undefined {
        return vscode.workspace.getConfiguration("zowe").get("files.logsFolder.path") || undefined;
    }

    /**
     * @param {string} [requiredVersion] Optional semver string specifying the minimal required version
     *           of Zowe Explorer that needs to be installed for the API to be usable to the client.
     * @returns an initialized instance `IApiRegisterClient` that extenders can use
     *          to access the Zowe Explorer APIs or `undefined`. Also `undefined` if requiredVersion
     *          is larger than the version of Zowe Explorer found.
     */
    public static getZoweExplorerApi(requiredVersion?: string): Types.IApiRegisterClient {
        const zoweExplorerApi = vscode.extensions.getExtension("Zowe.vscode-extension-for-zowe");
        if (zoweExplorerApi?.exports) {
            const zoweExplorerVersion = (zoweExplorerApi.packageJSON as Record<string, unknown>).version as string;
            if (requiredVersion && semver.valid(requiredVersion) && zoweExplorerVersion && !semver.gte(zoweExplorerVersion, requiredVersion)) {
                return undefined;
            }
            return zoweExplorerApi.exports as Types.IApiRegisterClient;
        }
        return undefined;
    }

    /**
     * Helper function to standardize the way we ask the user for credentials that updates ProfilesCache
     * @param options Set of options to use when prompting for credentials
     * @returns Instance of imperative.IProfileLoaded containing information about the updated profile
     */
    public static async updateCredentials(
        options: PromptCredentialsOptions.ComplexOptions,
        apiRegister: Types.IApiRegisterClient
    ): Promise<imperative.IProfileLoaded> {
        const cache = options.zeProfiles ?? ZoweVsCodeExtension.profilesCache;
        const profInfo = await cache.getProfileInfo();
        const setSecure = options.secure ?? profInfo.isSecured();

        if (options.profile == null && options.sessionName == null) {
            return undefined;
        }

        const loadProfile = options.sessionName ? await cache.getLoadedProfConfig(options.sessionName) : options.profile;
        const loadSession = loadProfile?.profile as imperative.ISession;

        if (loadProfile == null || loadSession == null) {
            return undefined;
        }
        const creds = await ZoweVsCodeExtension.promptUserPass({ session: loadSession, ...options });

        if (creds && creds.length > 0) {
            loadProfile.profile.user = loadSession.user = creds[0];
            loadProfile.profile.password = loadSession.password = creds[1];

            let shouldSave = true;
            if (!setSecure) {
                shouldSave = await ZoweVsCodeExtension.saveCredentials(loadProfile);
            }

            if (shouldSave) {
                // write changes to the file, autoStore value determines if written to file
                const upd = { profileName: loadProfile.name, profileType: loadProfile.type };
                await profInfo.updateProperty({ ...upd, property: "user", value: creds[0], setSecure });
                await profInfo.updateProperty({ ...upd, property: "password", value: creds[1], setSecure });
            }
            await cache.updateCachedProfile(loadProfile, undefined, apiRegister);
            ZoweVsCodeExtension.onProfileUpdatedEmitter.fire(loadProfile);

            return loadProfile;
        }
        return undefined;
    }

    /**
     * Trigger a login operation with the merged contents between the service profile and the base profile.
     *  If the connection details (host:port) do not match (service vs base), the token will be stored in the service profile.
     *  If there is no API registered for the profile type, this method defaults the login behavior to that of the APIML.
     * @deprecated Use `ZoweVsCodeExtension.ssoLogin` instead
     * @param serviceProfile Profile to be used for login purposes (either the name of the IProfileLoaded instance)
     * @param loginTokenType The tokenType value for compatibility purposes
     * @param node The node for compatibility purposes
     * @param zeRegister The ZoweExplorerApiRegister instance for compatibility purposes
     * @param zeProfiles The Zowe Explorer "Profiles.ts" instance for compatibility purposes
     */
    public static async loginWithBaseProfile(
        serviceProfile: string | imperative.IProfileLoaded,
        loginTokenType?: string,
        node?: Types.IZoweNodeType,
        zeRegister?: Types.IApiRegisterClient, // ZoweExplorerApiRegister
        zeProfiles?: ProfilesCache // Profiles extends ProfilesCache
    ): Promise<boolean> {
        return this.ssoLogin({ serviceProfile, defaultTokenType: loginTokenType, profileNode: node, zeRegister, zeProfiles });
    }

    /**
     * Trigger a login operation with the merged contents between the service profile and the base profile.
     *  If the connection details (host:port) do not match (service vs base), the token will be stored in the service profile.
     *  If there is no API registered for the profile type, this method defaults the login behavior to that of the APIML.
     * @param {BaseProfileAuthOptions} opts Object defining options for base profile authentication
     */
    public static async ssoLogin(opts: BaseProfileAuthOptions): Promise<boolean> {
        const cache: ProfilesCache = opts.zeProfiles ?? ZoweVsCodeExtension.profilesCache;
        const serviceProfile = await this.getServiceProfile(opts);
        const baseProfile = await cache.fetchBaseProfile(serviceProfile.name);
        if (baseProfile == null) {
            Gui.errorMessage(`Login failed: No base profile found to store SSO token for profile "${serviceProfile.name}"`);
            return false;
        }
        const primaryProfile = opts.preferBaseToken ? baseProfile : serviceProfile;
        const secondaryProfile = opts.preferBaseToken ? serviceProfile : baseProfile;
        const tokenType =
            primaryProfile.profile.tokenType ??
            secondaryProfile.profile.tokenType ??
            opts.defaultTokenType ??
            imperative.SessConstants.TOKEN_TYPE_APIML;
        const updSession = new imperative.Session({
            hostname: serviceProfile.profile.host,
            port: serviceProfile.profile.port,
            user: "Username",
            password: "Password",
            rejectUnauthorized: serviceProfile.profile.rejectUnauthorized,
            tokenType,
            type: imperative.SessConstants.AUTH_TYPE_TOKEN,
        });
        delete updSession.ISession.user;
        delete updSession.ISession.password;
        const qpItems: vscode.QuickPickItem[] = [
            { label: "$(account) User and Password", description: "Log in with basic authentication" },
            { label: "$(note) Certificate", description: "Log in with PEM format certificate file" },
        ];
        const response = await Gui.showQuickPick(qpItems, {
            placeHolder: "Select an authentication method for obtaining token",
            title: `[${baseProfile.name}] Log in to Authentication Service`,
        });
        if (response === qpItems[0]) {
            const creds = await ZoweVsCodeExtension.promptUserPass({ session: updSession.ISession, rePrompt: true });
            if (!creds) {
                return false;
            }
            updSession.ISession.base64EncodedAuth = imperative.AbstractSession.getBase64Auth(creds[0], creds[1]);
        } else if (response === qpItems[1]) {
            try {
                await ZoweVsCodeExtension.promptCertificate({ profile: serviceProfile, session: updSession.ISession, rePrompt: true });
            } catch (err) {
                return false;
            }
            delete updSession.ISession.base64EncodedAuth;
            updSession.ISession.storeCookie = true;
            updSession.ISession.type = imperative.SessConstants.AUTH_TYPE_CERT_PEM;
        } else {
            return false;
        }

        const loginToken = await (opts.zeRegister?.getCommonApi(serviceProfile).login ?? Login.apimlLogin)(updSession);
        const updBaseProfile: imperative.IProfile = {
            tokenType: updSession.ISession.tokenType ?? tokenType,
            tokenValue: loginToken,
        };
        updSession.ISession.storeCookie = false;

        // A simplified version of the ProfilesCache.shouldRemoveTokenFromProfile `private` method
        const connOk =
            // First check whether or not the base profile already does not have a token
            baseProfile.profile.tokenType == null || // If base profile does not have a token, we assume it's OK to store the token value there
            // The above will ensure that Zowe Explorer behaves the same way as the Zowe CLI in regards to using the base profile for token auth.

            // If base profile already has a token type stored, then we check whether or not the connection details are the same
            (serviceProfile.profile.host === baseProfile.profile.host && serviceProfile.profile.port === baseProfile.profile.port);
        // If the connection details do not match, then we MUST forcefully store the token in the service profile
        let profileToUpdate = serviceProfile;
        if (connOk) {
            // If active profile is nested (e.g. lpar.zosmf), then set type to null so token can be stored in parent typeless profile
            profileToUpdate = serviceProfile.name.startsWith(baseProfile.name + ".") ? { ...baseProfile, type: null } : baseProfile;
        }

        await cache.updateBaseProfileFileLogin(profileToUpdate, updBaseProfile, !connOk);
        serviceProfile.profile = { ...serviceProfile.profile, ...updBaseProfile };
        await cache.updateCachedProfile(serviceProfile, opts.profileNode);
        return true;
    }

    /**
     * Trigger a direct connection login process, not via API ML
     *
     * @param {imperative.IProfileLoaded} [serviceProfile] Instance of profile to be used for obtaining token
     * @param {Types.IApiRegisterClient} [zeRegister] Instance of `IApiRegisterClient`
     * @param {Types.IZoweNodeType} [node] Optional instance of `IZoweNodeType`
     * @returns boolean value of successful login
     */
    public static async directConnectLogin(
        serviceProfile: imperative.IProfileLoaded,
        zeRegister: Types.IApiRegisterClient,
        node?: Types.IZoweNodeType
    ): Promise<boolean> {
        const zeCommon = zeRegister.getCommonApi(serviceProfile);
        let session: imperative.Session;
        if (node) {
            session = node.getSession();
        } else {
            session = zeCommon?.getSession();
        }
        const creds = await this.promptUserPass({ session: session.ISession, rePrompt: true });
        if (!creds) {
            return false;
        }
        session.ISession.user = creds[0];
        session.ISession.password = creds[1];
        await zeCommon?.login(session);
        await this.profilesCache.updateCachedProfile(serviceProfile, node);
        return true;
    }

    /**
     * Trigger a logout operation with the merged contents between the service profile and the base profile.
     *  If the connection details (host:port) do not match (service vs base), the token will be removed from the service profile.
     *  If there is no API registered for the profile type, this method defaults the logout behavior to that of the APIML.
     * @deprecated Use `ZoweVsCodeExtension.ssoLogout` instead
     * @param serviceProfile Profile to be used for logout purposes (either the name of the IProfileLoaded instance)
     * @param zeRegister The ZoweExplorerApiRegister instance for compatibility purposes
     * @param zeProfiles The Zowe Explorer "Profiles.ts" instance for compatibility purposes
     */
    public static async logoutWithBaseProfile(
        serviceProfile: string | imperative.IProfileLoaded,
        zeRegister?: Types.IApiRegisterClient, // ZoweExplorerApiRegister
        zeProfiles?: ProfilesCache // Profiles extends ProfilesCache
    ): Promise<boolean> {
        return this.ssoLogout({ serviceProfile, zeRegister, zeProfiles });
    }

    /**
     * Trigger a logout operation with the merged contents between the service profile and the base profile.
     *  If the connection details (host:port) do not match (service vs base), the token will be removed from the service profile.
     *  If there is no API registered for the profile type, this method defaults the logout behavior to that of the APIML.
     * @param {BaseProfileAuthOptions} opts Object defining options for base profile authentication
     */
    public static async ssoLogout(opts: BaseProfileAuthOptions): Promise<boolean> {
        const cache: ProfilesCache = opts.zeProfiles ?? ZoweVsCodeExtension.profilesCache;
        const serviceProfile = await this.getServiceProfile(opts);
        const baseProfile = await cache.fetchBaseProfile(serviceProfile.name);
        if (!baseProfile) {
            Gui.errorMessage(`Logout failed: No base profile found to remove SSO token for profile "${serviceProfile.name}"`);
            return false;
        }
        const primaryProfile = opts.preferBaseToken ? baseProfile : serviceProfile;
        const secondaryProfile = opts.preferBaseToken ? serviceProfile : baseProfile;
        const tokenType =
            primaryProfile.profile.tokenType ??
            secondaryProfile.profile.tokenType ??
            opts.defaultTokenType ??
            imperative.SessConstants.TOKEN_TYPE_APIML;
        const updSession = new imperative.Session({
            hostname: serviceProfile.profile.host,
            port: serviceProfile.profile.port,
            rejectUnauthorized: serviceProfile.profile.rejectUnauthorized,
            tokenType: tokenType,
            tokenValue: primaryProfile.profile.tokenValue ?? secondaryProfile.profile.tokenValue,
            type: imperative.SessConstants.AUTH_TYPE_TOKEN,
        });
        await (opts.zeRegister?.getCommonApi(serviceProfile).logout ?? Logout.apimlLogout)(updSession);

        // If active profile is nested (e.g. lpar.zosmf), then update service profile since base profile may be typeless
        const connOk =
            serviceProfile.profile.host === baseProfile.profile.host &&
            serviceProfile.profile.port === baseProfile.profile.port &&
            !serviceProfile.name.startsWith(baseProfile.name + ".");
        await cache.updateBaseProfileFileLogout(connOk ? baseProfile : serviceProfile);
        serviceProfile.profile = { ...serviceProfile.profile, tokenType: undefined, tokenValue: undefined };
        await cache.updateCachedProfile(serviceProfile, opts.profileNode);
        return true;
    }

    /**
     * Trigger a direct connection logout process, not via API ML
     *
     * @param {imperative.IProfileLoaded} [serviceProfile] Instance of profile to be used for retiring token
     * @param {Types.IApiRegisterClient} [zeRegister] Instance of `IApiRegisterClient`
     * @param {Types.IZoweNodeType} [node] Optional instance of `IZoweNodeType`
     * @returns boolean value of successful logout
     */
    public static async directConnectLogout(
        serviceProfile: imperative.IProfileLoaded,
        zeRegister: Types.IApiRegisterClient,
        node?: Types.IZoweNodeType
    ): Promise<boolean> {
        const zeCommon = zeRegister.getCommonApi(serviceProfile);
        let session: imperative.Session;
        if (node) {
            session = node.getSession();
        } else {
            session = zeCommon?.getSession();
        }
        await zeCommon?.logout(session);
        await this.profilesCache.updateCachedProfile(serviceProfile, node);
        return true;
    }

    /**
     * Prompt users through process of creating a Zowe team configuration file including Zowe Explorer registered types
     * Upon successful completion, editor will open team configuration file.
     *
     * @returns void
     */
    public static async createTeamConfiguration(): Promise<void> {
        let user = false;
        let global = true;
        let rootPath = FileManagement.getZoweDir();
        const workspaceDir = ZoweVsCodeExtension.workspaceRoot;
        if (workspaceDir != null) {
            const choice = await this.getConfigLocationPrompt("create");
            if (choice === undefined) {
                Gui.infoMessage(`Operation cancelled`);
                return;
            }
            if (choice === "project") {
                rootPath = workspaceDir.uri.fsPath;
                global = false;
            }
        }
        // call check for existing and prompt here
        const existingFile = await this.checkExistingConfig(rootPath);
        if (existingFile === false) {
            // handle prompt cancellation
            return;
        }
        if (existingFile != null) {
            user = existingFile.includes("user");
        }
        const config = await imperative.Config.load("zowe", {
            homeDir: FileManagement.getZoweDir(),
            projectDir: FileManagement.getFullPath(rootPath),
        });
        if (workspaceDir != null) {
            config.api.layers.activate(user, global, rootPath);
        }

        const knownCliConfig: imperative.ICommandProfileTypeConfiguration[] = ZoweVsCodeExtension.profilesCache.getCoreProfileTypes();
        knownCliConfig.push(...ZoweVsCodeExtension.profilesCache.getConfigArray());
        knownCliConfig.push(ProfileConstants.BaseProfile);
        config.setSchema(imperative.ConfigSchema.buildSchema(knownCliConfig));

        // Note: IConfigBuilderOpts not exported
        // const opts: IConfigBuilderOpts = {
        const opts: any = {
            // getSecureValue: this.promptForProp.bind(this),
            populateProperties: true,
        };

        // Build new config and merge with existing layer
        const impConfig: Partial<imperative.IImperativeConfig> = {
            profiles: [...knownCliConfig],
            baseProfile: ProfileConstants.BaseProfile,
        };
        const newConfig: imperative.IConfig = await imperative.ConfigBuilder.build(impConfig, global, opts);

        // Create non secure profile if VS Code setting is false
        this.createNonSecureProfile(newConfig);

        config.api.layers.merge(newConfig);
        await config.save(false);
        let configName;
        if (user) {
            configName = config.userConfigName;
        } else {
            configName = config.configName;
        }
        await this.openConfigFile(path.join(rootPath, configName));
    }

    public static async openConfigFile(filePath: string): Promise<void> {
        const document = await vscode.workspace.openTextDocument(filePath);
        await Gui.showTextDocument(document, { preview: false });
    }

    public static async getConfigLayers(): Promise<imperative.IConfigLayer[]> {
        const existingLayers: imperative.IConfigLayer[] = [];
        const config = await imperative.Config.load("zowe", {
            homeDir: FileManagement.getZoweDir(),
            projectDir: ZoweVsCodeExtension.workspaceRoot?.uri.fsPath,
        });
        const layers = config.layers;
        layers.forEach((layer) => {
            if (layer.exists) {
                existingLayers.push(layer);
            }
        });
        return existingLayers;
    }

    /**
     * This method is intended to be used for authentication (login, logout) purposes
     *
     * Note: this method calls the `getServiceProfileForAuthPurposes()` which creates a new instance of the ProfileInfo APIs
     *          Be aware that any non-saved updates will not be considered here.
     * @param {BaseProfileAuthOptions} opts Object defining options for base profile authentication
     * @returns The IProfileLoaded with tokenType and tokenValue
     */
    private static async getServiceProfile(opts: BaseProfileAuthOptions): Promise<imperative.IProfileLoaded> {
        const cache: ProfilesCache = opts.zeProfiles ?? ZoweVsCodeExtension.profilesCache;
        return typeof opts.serviceProfile === "string"
            ? await ZoweVsCodeExtension.getServiceProfileForAuthPurposes(cache, opts.serviceProfile)
            : opts.serviceProfile;
    }

    /**
     * This method is intended to be used for authentication (login, logout) purposes
     *
     * Note: this method calls the `getProfileInfo()` which creates a new instance of the ProfileInfo APIs
     *          Be aware that any non-saved updates will not be considered here.
     * @param cache Instance of ProfilesCache already initialized
     * @param profile Name of the profile to load the IProfileLoaded
     * @returns The IProfileLoaded with tokenType and tokenValue
     */
    private static async getServiceProfileForAuthPurposes(cache: ProfilesCache, profile: string): Promise<imperative.IProfileLoaded> {
        const profInfo = await cache.getProfileInfo();
        const profAttrs = profInfo.getAllProfiles().find((prof) => prof.profName === profile);
        if (profAttrs?.profType != null) {
            cache.registerCustomProfilesType(profAttrs.profType);
        }
        await cache.refresh(ZoweVsCodeExtension.getZoweExplorerApi());
        const retP = cache.loadNamedProfile(profile);
        const _props = profInfo.mergeArgsForProfile(profAttrs, { getSecureVals: true }).knownArgs;
        retP.profile.tokenType = retP.profile.tokenType ?? _props.find((p) => p.argName === "tokenType")?.argValue;
        retP.profile.tokenValue = retP.profile.tokenValue ?? _props.find((p) => p.argName === "tokenValue")?.argValue;
        return retP;
    }

    private static async saveCredentials(profile: imperative.IProfileLoaded): Promise<boolean> {
        let save = false;
        const saveButton = "Save Credentials";
        const message = [
            `Save entered credentials in plain text for future use with profile ${profile.name}?`,
            "Saving credentials will update the local configuration file.",
        ].join("\n");
        await Gui.showMessage(message, { items: [saveButton], vsCodeOpts: { modal: true } }).then((selection) => {
            if (selection) {
                save = true;
            }
        });
        return save;
    }

    private static async promptUserPass(options: PromptCredentialsOptions.UserPassOptions): Promise<string[] | undefined> {
        let newUser = options.session.user;
        if (!newUser || options.rePrompt) {
            newUser = await Gui.showInputBox({
                placeHolder: "User Name",
                prompt: "Enter the user name for the connection." + (options.rePrompt ? "" : " Leave blank to not store."),
                ignoreFocusOut: true,
                value: newUser,
                ...(options.userInputBoxOptions ?? {}),
            });
        }
        if (!newUser || (options.rePrompt && newUser === "")) {
            return undefined;
        }

        let newPass = options.session.password;
        if (!newPass || options.rePrompt) {
            newPass = await Gui.showInputBox({
                placeHolder: "Password",
                prompt: "Enter the password for the connection." + (options.rePrompt ? "" : " Leave blank to not store."),
                password: true,
                ignoreFocusOut: true,
                value: newPass,
                ...(options.passwordInputBoxOptions ?? {}),
            });
        }
        if (!newPass || (options.rePrompt && newPass === "")) {
            return undefined;
        }

        options.session.user = newUser.trim();
        options.session.password = newPass.trim();
        return [options.session.user, options.session.password];
    }

    private static async promptCertificate(options: PromptCredentialsOptions.CertificateOptions): Promise<void> {
        const response: { cert: string; certKey: string } = await vscode.commands.executeCommand("zowe.certificateWizard", {
            cert: options.profile.profile.certFile,
            certKey: options.profile.profile.certKeyFile,
            dialogOpts: { ...(options.openDialogOptions ?? {}), canSelectFiles: true, canSelectFolders: false, canSelectMany: false },
        });
        options.session.cert = response.cert;
        options.session.certKey = response.certKey;
    }

    private static async checkExistingConfig(filePath: string): Promise<string | false> {
        const existingLayers = await this.getConfigLayers();
        const foundLayer = existingLayers.find((layer) => layer.path.includes(filePath));
        if (foundLayer == null) {
            return null;
        }
        const createButton = vscode.l10n.t("Create New");
        const message = vscode.l10n.t({
            message:
                `A Team Configuration File already exists in this location\n{0}\n` +
                `Continuing may alter the existing file, would you like to proceed?`,
            args: [foundLayer.path],
            comment: ["File path"],
        });
        const response = await Gui.infoMessage(message, { items: [createButton], vsCodeOpts: { modal: true } });
        if (response) {
            return path.basename(foundLayer.path);
        } else {
            await this.openConfigFile(foundLayer.path);
        }
        return false;
    }

    private static async getConfigLocationPrompt(action: string): Promise<string> {
        let placeHolderText: string;
        if (action === "create") {
            placeHolderText = vscode.l10n.t("Select the location where the config file will be initialized");
        } else {
            placeHolderText = vscode.l10n.t("Select the location of the config file to edit");
        }
        const quickPickOptions: vscode.QuickPickOptions = {
            placeHolder: placeHolderText,
            ignoreFocusOut: true,
            canPickMany: false,
        };
        const globalText = vscode.l10n.t("Global: in the Zowe home directory");
        const projectText = vscode.l10n.t("Project: in the current working directory");
        const location = await Gui.showQuickPick([globalText, projectText], quickPickOptions);
        // call check for existing and prompt here
        switch (location) {
            case globalText:
                return "global";
            case projectText:
                return "project";
        }
    }

    // Temporary solution for handling unsecure profiles until CLI team's work is made
    // Remove secure properties and set autoStore to false when vscode setting is true
    private static createNonSecureProfile(newConfig: imperative.IConfig): void {
        const isSecureCredsEnabled: boolean = VscSettings.getDirectValue("zowe.security.secureCredentialsEnabled");
        if (!isSecureCredsEnabled) {
            for (const profile of Object.entries(newConfig.profiles)) {
                delete newConfig.profiles[profile[0]].secure;
            }
            newConfig.autoStore = false;
        }
    }
}
