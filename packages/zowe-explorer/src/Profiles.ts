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

import * as vscode from "vscode";
import * as zowe from "@zowe/cli";
import * as path from "path";
import {
    Gui,
    IZoweTree,
    IZoweUSSTreeNode,
    IZoweDatasetTreeNode,
    IZoweJobTreeNode,
    IZoweTreeNode,
    PersistenceSchemaEnum,
    Validation,
    ProfilesCache,
    ZoweVsCodeExtension,
    FileManagement,
    IRegisterClient,
    Types,
} from "@zowe/zowe-explorer-api";
import { errorHandling, FilterDescriptor, FilterItem, ProfilesUtils } from "./utils/ProfilesUtils";
import { ZoweExplorerApiRegister } from "./ZoweExplorerApiRegister";
import { ZoweExplorerExtender } from "./ZoweExplorerExtender";
import * as globals from "./globals";
import { SettingsConfig } from "./utils/SettingsConfig";
import { ZoweLogger } from "./utils/ZoweLogger";
import { TreeProviders } from "./shared/TreeProviders";
import { ProfileManagement } from "./utils/ProfileManagement";

let InputBoxOptions: vscode.InputBoxOptions;

export class Profiles extends ProfilesCache {
    // Processing stops if there are no profiles detected
    public static async createInstance(log: zowe.imperative.Logger): Promise<Profiles> {
        Profiles.loader = new Profiles(log, vscode.workspace.workspaceFolders?.[0]?.uri.fsPath);
        await Profiles.loader.refresh(ZoweExplorerApiRegister.getInstance());
        return Profiles.loader;
    }

    public static getInstance(): Profiles {
        ZoweLogger.trace("Profiles.getInstance called.");
        return Profiles.loader;
    }

    protected static loader: Profiles;

    public loadedProfile: zowe.imperative.IProfileLoaded;
    public validProfile: Validation.ValidationType = Validation.ValidationType.INVALID;
    private dsSchema: string = globals.SETTINGS_DS_HISTORY;
    private ussSchema: string = globals.SETTINGS_USS_HISTORY;
    private jobsSchema: string = globals.SETTINGS_JOBS_HISTORY;
    private mProfileInfo: zowe.imperative.ProfileInfo;
    private profilesOpCancelled = vscode.l10n.t(`Operation Cancelled`);
    private manualEditMsg = vscode.l10n.t(
        `The Team configuration file has been opened in the editor. Editing or removal of profiles will need to be done manually.`
    );
    public constructor(log: zowe.imperative.Logger, cwd?: string) {
        super(log, cwd);
    }

    /**
     * Initializes the Imperative ProfileInfo API and reads profiles from disk.
     * During extension activation the ProfileInfo object is cached, so this
     * method can be called multiple times without impacting performance. After
     * the extension has activated, the cache expires so that the latest profile
     * contents will be loaded.
     */
    public async getProfileInfo(): Promise<zowe.imperative.ProfileInfo> {
        ZoweLogger.trace("Profiles.getProfileInfo called.");
        this.mProfileInfo = await super.getProfileInfo();
        return this.mProfileInfo;
    }

    public async checkCurrentProfile(theProfile: zowe.imperative.IProfileLoaded): Promise<Validation.IValidationProfile> {
        ZoweLogger.trace("Profiles.checkCurrentProfile called.");
        let profileStatus: Validation.IValidationProfile;
        const usingTokenAuth = await ProfilesUtils.isUsingTokenAuth(theProfile.name);

        if (usingTokenAuth && !theProfile.profile.tokenType) {
            const error = new zowe.imperative.ImperativeError({
                msg: vscode.l10n.t(`Token auth error`),
                additionalDetails: vscode.l10n.t(`Profile was found using token auth, please log in to continue.`),
                errorCode: `${zowe.imperative.RestConstants.HTTP_STATUS_401}`,
            });
            await errorHandling(error, theProfile.name, error.message);
            profileStatus = { name: theProfile.name, status: "unverified" };
            return profileStatus;
        }

        if (!usingTokenAuth && (!theProfile.profile.user || !theProfile.profile.password)) {
            // The profile will need to be reactivated, so remove it from profilesForValidation
            this.profilesForValidation = this.profilesForValidation.filter(
                (profile) => profile.status === "unverified" && profile.name !== theProfile.name
            );
            let values: string[];
            try {
                values = await Profiles.getInstance().promptCredentials(theProfile);
            } catch (error) {
                await errorHandling(error, theProfile.name, error.message);
                return profileStatus;
            }
            if (values) {
                theProfile.profile.user = values[0];
                theProfile.profile.password = values[1];
                theProfile.profile.base64EncodedAuth = values[2];

                // Validate profile
                profileStatus = await this.getProfileSetting(theProfile);
            } else {
                profileStatus = { name: theProfile.name, status: "unverified" };
            }
        } else {
            // Profile should have enough information to allow validation
            profileStatus = await this.getProfileSetting(theProfile);
        }
        switch (profileStatus.status) {
            case "unverified":
                this.validProfile = Validation.ValidationType.UNVERIFIED;
                break;
            case "inactive":
                this.validProfile = Validation.ValidationType.INVALID;
                break;
            case "active":
                this.validProfile = Validation.ValidationType.VALID;
                break;
        }
        return profileStatus;
    }

    public async getProfileSetting(theProfile: zowe.imperative.IProfileLoaded): Promise<Validation.IValidationProfile> {
        ZoweLogger.trace("Profiles.getProfileSetting called.");
        let profileStatus: Validation.IValidationProfile;
        let found: boolean = false;
        this.profilesValidationSetting.forEach((instance) => {
            if (instance.name === theProfile.name && instance.setting === false) {
                profileStatus = {
                    status: "unverified",
                    name: instance.name,
                };
                if (this.profilesForValidation.length > 0) {
                    this.profilesForValidation.forEach((profile) => {
                        if (profile.name === theProfile.name && profile.status === "unverified") {
                            found = true;
                        }
                        if (profile.name === theProfile.name && profile.status !== "unverified") {
                            found = true;
                            const index = this.profilesForValidation.lastIndexOf(profile);
                            this.profilesForValidation.splice(index, 1, profileStatus);
                        }
                    });
                }
                if (!found) {
                    this.profilesForValidation.push(profileStatus);
                }
            }
        });
        if (profileStatus === undefined) {
            profileStatus = await this.validateProfiles(theProfile);
        }
        return profileStatus;
    }

    public disableValidation(node: Types.IZoweNodeType): Types.IZoweNodeType {
        ZoweLogger.trace("Profiles.disableValidation called.");
        const treeNodes = TreeProviders.getSessionForAllTrees(node.getLabel().toString());
        treeNodes.forEach((treeNode) => {
            if (treeNode) {
                this.disableValidationContext(treeNode);
            }
        });
        return node;
    }

    public disableValidationContext(node: Types.IZoweNodeType): Types.IZoweNodeType {
        ZoweLogger.trace("Profiles.disableValidationContext called.");
        const theProfile: zowe.imperative.IProfileLoaded = node.getProfile();
        this.validationArraySetup(theProfile, false);
        if (node.contextValue.includes(globals.VALIDATE_SUFFIX)) {
            node.contextValue = node.contextValue.replace(globals.VALIDATE_SUFFIX, globals.NO_VALIDATE_SUFFIX);
        } else if (node.contextValue.includes(globals.NO_VALIDATE_SUFFIX)) {
            return node;
        } else {
            node.contextValue += globals.VALIDATE_SUFFIX;
        }
        return node;
    }

    public enableValidation(node: Types.IZoweNodeType): Types.IZoweNodeType {
        ZoweLogger.trace("Profiles.enableValidation called.");
        const treeNodes = TreeProviders.getSessionForAllTrees(node.getLabel().toString());
        treeNodes.forEach((treeNode) => {
            if (treeNode) {
                this.enableValidationContext(treeNode);
            }
        });
        return node;
    }

    public enableValidationContext(node: Types.IZoweNodeType): Types.IZoweNodeType {
        ZoweLogger.trace("Profiles.enableValidationContext called.");
        const theProfile: zowe.imperative.IProfileLoaded = node.getProfile();
        this.validationArraySetup(theProfile, true);
        if (node.contextValue.includes(globals.NO_VALIDATE_SUFFIX)) {
            node.contextValue = node.contextValue.replace(globals.NO_VALIDATE_SUFFIX, globals.VALIDATE_SUFFIX);
        } else if (node.contextValue.includes(globals.VALIDATE_SUFFIX)) {
            return node;
        } else {
            node.contextValue += globals.VALIDATE_SUFFIX;
        }

        return node;
    }

    public validationArraySetup(theProfile: zowe.imperative.IProfileLoaded, validationSetting: boolean): Validation.IValidationSetting {
        ZoweLogger.trace("Profiles.validationArraySetup called.");
        let found: boolean = false;
        let profileSetting: Validation.IValidationSetting;
        if (this.profilesValidationSetting.length > 0) {
            this.profilesValidationSetting.forEach((instance) => {
                if (instance.name === theProfile.name && instance.setting === validationSetting) {
                    found = true;
                    profileSetting = {
                        name: instance.name,
                        setting: instance.setting,
                    };
                }
                if (instance.name === theProfile.name && instance.setting !== validationSetting) {
                    found = true;
                    profileSetting = {
                        name: instance.name,
                        setting: validationSetting,
                    };
                    const index = this.profilesValidationSetting.lastIndexOf(instance);
                    this.profilesValidationSetting.splice(index, 1, profileSetting);
                }
            });
            if (!found) {
                profileSetting = {
                    name: theProfile.name,
                    setting: validationSetting,
                };
                this.profilesValidationSetting.push(profileSetting);
            }
        } else {
            profileSetting = {
                name: theProfile.name,
                setting: validationSetting,
            };
            this.profilesValidationSetting.push(profileSetting);
        }
        return profileSetting;
    }

    /**
     * Adds a new Profile to the provided treeview by clicking the 'Plus' button and
     * selecting which profile you would like to add from the drop-down that appears.
     * The profiles that are in the tree view already will not appear in the
     * drop-down.
     *
     * @export
     * @param {USSTree} zoweFileProvider - either the USS, MVS, JES tree
     */
    public async createZoweSession(zoweFileProvider: IZoweTree<IZoweTreeNode>): Promise<void> {
        ZoweLogger.trace("Profiles.createZoweSession called.");
        let profileNamesList: string[] = [];
        const treeType = zoweFileProvider.getTreeType();
        let allProfiles: zowe.imperative.IProfileLoaded[];
        try {
            allProfiles = Profiles.getInstance().allProfiles;
            if (allProfiles) {
                // Get all profiles and filter to list of the APIs available for current tree explorer
                profileNamesList = allProfiles
                    .map((profile) => profile.name)
                    .filter((profileName) => {
                        const profile = Profiles.getInstance().loadNamedProfile(profileName);
                        const notInSessionNodes = !zoweFileProvider.mSessionNodes?.find(
                            (sessionNode) => sessionNode.getProfileName() === profileName
                        );
                        if (profile) {
                            if (zoweFileProvider.getTreeType() === PersistenceSchemaEnum.USS) {
                                const ussProfileTypes = ZoweExplorerApiRegister.getInstance().registeredUssApiTypes();
                                return ussProfileTypes.includes(profile.type) && notInSessionNodes;
                            }
                            if (zoweFileProvider.getTreeType() === PersistenceSchemaEnum.Dataset) {
                                const mvsProfileTypes = ZoweExplorerApiRegister.getInstance().registeredMvsApiTypes();
                                return mvsProfileTypes.includes(profile.type) && notInSessionNodes;
                            }
                            if (zoweFileProvider.getTreeType() === PersistenceSchemaEnum.Job) {
                                const jesProfileTypes = ZoweExplorerApiRegister.getInstance().registeredJesApiTypes();
                                return jesProfileTypes.includes(profile.type) && notInSessionNodes;
                            }
                        }

                        return false;
                    });
            }
        } catch (err) {
            ZoweLogger.warn(err);
        }
        // Set Options according to profile management in use

        const createNewConfig = "Create a New Team Configuration File";
        const editConfig = "Edit Team Configuration File";

        const configPick = new FilterDescriptor("\uFF0B " + createNewConfig);
        const configEdit = new FilterDescriptor("\u270F " + editConfig);
        const items: vscode.QuickPickItem[] = [];
        let mProfileInfo: zowe.imperative.ProfileInfo;
        try {
            mProfileInfo = await this.getProfileInfo();
            const profAllAttrs = mProfileInfo.getAllProfiles();
            for (const pName of profileNamesList) {
                const osLocInfo = mProfileInfo.getOsLocInfo(profAllAttrs.find((p) => p.profName === pName));
                items.push(new FilterItem({ text: pName, icon: this.getProfileIcon(osLocInfo)[0] }));
            }
        } catch (err) {
            ZoweLogger.warn(err);
        }

        const quickpick = Gui.createQuickPick();
        let addProfilePlaceholder = "";
        switch (zoweFileProvider.getTreeType()) {
            case PersistenceSchemaEnum.Dataset:
                addProfilePlaceholder = vscode.l10n.t(`Choose "Create new..." to define or select a profile to add to the DATA SETS Explorer`);
                break;
            case PersistenceSchemaEnum.Job:
                addProfilePlaceholder = vscode.l10n.t(`Choose "Create new..." to define or select a profile to add to the JOBS Explorer`);
                break;
            default:
                // Use USS View as default for placeholder text
                addProfilePlaceholder = vscode.l10n.t(`Choose "Create new..." to define or select a profile to add to the USS Explorer`);
        }
        if (allProfiles.length > 0) {
            quickpick.items = [configPick, configEdit, ...items];
        } else {
            quickpick.items = [configPick, ...items];
        }
        quickpick.placeholder = addProfilePlaceholder;
        quickpick.ignoreFocusOut = true;
        quickpick.show();
        const choice = await Gui.resolveQuickPick(quickpick);
        quickpick.hide();
        const debugMsg = vscode.l10n.t(`Profile selection has been cancelled.`);
        if (!choice) {
            ZoweLogger.debug(debugMsg);
            Gui.showMessage(debugMsg);
            return;
        }
        if (choice === configPick) {
            await this.createZoweSchema(zoweFileProvider);
            return;
        }
        if (choice === configEdit) {
            await this.editZoweConfigFile();
            return;
        }
        let chosenProfile: string = "";
        if (choice instanceof FilterDescriptor) {
            chosenProfile = "";
        } else {
            // remove any icons from the label
            chosenProfile = choice.label.replace(/\$\(.*\)\s/g, "");
        }
        if (chosenProfile === "") {
            let config: zowe.imperative.ProfileInfo;
            try {
                config = await this.getProfileInfo();
            } catch (error) {
                ZoweLogger.error(error);
                ZoweExplorerExtender.showZoweConfigError(error.message);
            }
            const profiles = config.getAllProfiles();
            const currentProfile = await this.getProfileFromConfig(profiles[0].profName);
            const filePath = currentProfile.profLoc.osLoc[0];
            await this.openConfigFile(filePath);
        } else if (chosenProfile) {
            ZoweLogger.info(
                vscode.l10n.t({
                    message: `The profile {0} has been added to the {1} tree.`,
                    args: [chosenProfile, treeType],
                    comment: ["chosen profile", "tree type"],
                })
            );
            if (await ProfileManagement.handleChangeForAllTrees(chosenProfile, true)) {
                await zoweFileProvider.addSession(chosenProfile);
            } else {
                await zoweFileProvider.addSession(chosenProfile, undefined, zoweFileProvider);
            }
        } else {
            ZoweLogger.debug(debugMsg);
        }
    }

    public async editSession(profileLoaded: zowe.imperative.IProfileLoaded, profileName: string): Promise<any | undefined> {
        const currentProfile = await this.getProfileFromConfig(profileLoaded.name);
        const filePath = currentProfile.profLoc.osLoc[0];
        await this.openConfigFile(filePath);
    }

    public async getProfileType(): Promise<string> {
        ZoweLogger.trace("Profiles.getProfileType called.");
        let profileType: string;
        const profTypes = ZoweExplorerApiRegister.getInstance().registeredApiTypes();
        const typeOptions = Array.from(profTypes);
        if (typeOptions.length === 1 && typeOptions[0] === "zosmf") {
            profileType = typeOptions[0];
        } else {
            const quickPickTypeOptions: vscode.QuickPickOptions = {
                placeHolder: vscode.l10n.t(`Profile Type`),
                ignoreFocusOut: true,
                canPickMany: false,
            };
            profileType = await Gui.showQuickPick(typeOptions, quickPickTypeOptions);
        }
        return profileType;
    }

    public async createZoweSchema(_zoweFileProvider: IZoweTree<IZoweTreeNode>): Promise<string> {
        ZoweLogger.trace("Profiles.createZoweSchema called.");
        try {
            let user = false;
            let global = true;
            let rootPath = FileManagement.getZoweDir();
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]) {
                const choice = await this.getConfigLocationPrompt("create");
                if (choice === undefined) {
                    Gui.showMessage(this.profilesOpCancelled);
                    return;
                }
                if (choice === "project") {
                    rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
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
            const config = await zowe.imperative.Config.load("zowe", {
                homeDir: FileManagement.getZoweDir(),
                projectDir: FileManagement.getFullPath(rootPath),
            });
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]) {
                config.api.layers.activate(user, global, rootPath);
            }

            const impConfig: zowe.imperative.IImperativeConfig = zowe.getImperativeConfig();
            const knownCliConfig: zowe.imperative.ICommandProfileTypeConfiguration[] = impConfig.profiles;

            const extenderinfo = this.getConfigArray();
            extenderinfo.forEach((item) => {
                knownCliConfig.push(item);
            });

            knownCliConfig.push(impConfig.baseProfile);
            config.setSchema(zowe.imperative.ConfigSchema.buildSchema(knownCliConfig));

            // Note: IConfigBuilderOpts not exported
            // const opts: IConfigBuilderOpts = {
            const opts: any = {
                // getSecureValue: this.promptForProp.bind(this),
                populateProperties: true,
            };

            // Build new config and merge with existing layer
            const newConfig: zowe.imperative.IConfig = await zowe.imperative.ConfigBuilder.build(impConfig, opts);

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
            return path.join(rootPath, configName);
        } catch (err) {
            ZoweLogger.error(err);
            ZoweExplorerExtender.showZoweConfigError(err.message);
        }
    }

    public async editZoweConfigFile(): Promise<void> {
        ZoweLogger.trace("Profiles.editZoweConfigFile called.");
        const existingLayers = await this.getConfigLayers();
        if (existingLayers.length === 1) {
            await this.openConfigFile(existingLayers[0].path);
            Gui.showMessage(this.manualEditMsg);
        }
        if (existingLayers && existingLayers.length > 1) {
            const choice = await this.getConfigLocationPrompt("edit");
            switch (choice) {
                case "project":
                    for (const file of existingLayers) {
                        if (file.user) {
                            await this.openConfigFile(file.path);
                        }
                    }
                    Gui.showMessage(this.manualEditMsg);
                    break;
                case "global":
                    for (const file of existingLayers) {
                        if (file.global) {
                            await this.openConfigFile(file.path);
                        }
                    }
                    Gui.showMessage(this.manualEditMsg);
                    break;
                default:
                    Gui.showMessage(this.profilesOpCancelled);
                    break;
            }
        }
    }

    public async promptCredentials(profile: string | zowe.imperative.IProfileLoaded, rePrompt?: boolean): Promise<string[]> {
        ZoweLogger.trace("Profiles.promptCredentials called.");
        let profType = "";
        if (typeof profile !== "string") {
            profType = profile.type;
        }
        const userInputBoxOptions: vscode.InputBoxOptions = {
            placeHolder: vscode.l10n.t(`User Name`),
            prompt: vscode.l10n.t(`Enter the user name for the connection. Leave blank to not store.`),
        };
        const passwordInputBoxOptions: vscode.InputBoxOptions = {
            placeHolder: vscode.l10n.t(`Password`),
            prompt: vscode.l10n.t(`Enter the password for the connection. Leave blank to not store.`),
        };

        const promptInfo = await ZoweVsCodeExtension.updateCredentials(
            {
                profile: typeof profile === "string" ? undefined : profile,
                sessionName: typeof profile === "string" ? profile : undefined,
                rePrompt,
                secure: (await this.getProfileInfo()).isSecured(),
                userInputBoxOptions,
                passwordInputBoxOptions,
            },
            ZoweExplorerApiRegister.getInstance()
        );
        if (!promptInfo) {
            Gui.showMessage(this.profilesOpCancelled);
            return; // See https://github.com/zowe/vscode-extension-for-zowe/issues/1827
        }

        const returnValue: string[] = [promptInfo.profile.user, promptInfo.profile.password, promptInfo.profile.base64EncodedAuth];
        this.updateProfilesArrays(promptInfo);
        return returnValue;
    }

    public async getDeleteProfile(): Promise<zowe.imperative.IProfileLoaded> {
        ZoweLogger.trace("Profiles.getDeleteProfile called.");
        const allProfiles: zowe.imperative.IProfileLoaded[] = this.allProfiles;
        const profileNamesList = allProfiles.map((temprofile) => {
            return temprofile.name;
        });

        if (!profileNamesList.length) {
            Gui.showMessage(vscode.l10n.t(`No profiles available`));
            return;
        }

        const quickPickList: vscode.QuickPickOptions = {
            placeHolder: vscode.l10n.t(`Select the profile you want to delete`),
            ignoreFocusOut: true,
            canPickMany: false,
        };
        const sesName = await Gui.showQuickPick(profileNamesList, quickPickList);

        if (sesName === undefined) {
            Gui.showMessage(this.profilesOpCancelled);
            return;
        }

        return allProfiles.find((temprofile) => temprofile.name === sesName);
    }

    public async deleteProfile(
        datasetTree: Types.IZoweDatasetTreeType,
        ussTree: Types.IZoweUSSTreeType,
        jobsProvider: Types.IZoweJobTreeType,
        node?: Types.IZoweNodeType
    ): Promise<void> {
        ZoweLogger.trace("Profiles.deleteProfile called.");
        let deletedProfile: zowe.imperative.IProfileLoaded;
        if (!node) {
            deletedProfile = await this.getDeleteProfile();
        } else {
            deletedProfile = node.getProfile();
        }
        if (!deletedProfile) {
            return;
        }

        const deleteLabel = deletedProfile.name;

        const currentProfile = await this.getProfileFromConfig(deleteLabel);
        const filePath = currentProfile.profLoc.osLoc[0];
        await this.openConfigFile(filePath);
    }

    public async validateProfiles(theProfile: zowe.imperative.IProfileLoaded): Promise<Validation.IValidationProfile> {
        ZoweLogger.trace("Profiles.validateProfiles called.");
        let filteredProfile: Validation.IValidationProfile;
        let profileStatus;
        const getSessStatus = await ZoweExplorerApiRegister.getInstance().getCommonApi(theProfile);

        // Check if the profile is already validated as active
        const desiredProfile = this.profilesForValidation.find((profile) => profile.name === theProfile.name && profile.status === "active");
        if (desiredProfile) {
            filteredProfile = {
                status: desiredProfile.status,
                name: desiredProfile.name,
            };
        }

        // If not yet validated or inactive, call getStatus and validate the profile
        // status will be stored in profilesForValidation
        if (filteredProfile === undefined) {
            try {
                if (getSessStatus.getStatus) {
                    profileStatus = await Gui.withProgress(
                        {
                            location: vscode.ProgressLocation.Notification,
                            title: vscode.l10n.t({
                                message: `Validating {0} Profile.`,
                                args: [theProfile.name],
                                comment: [`The profile name`],
                            }),
                            cancellable: true,
                        },
                        async (progress, token) => {
                            token.onCancellationRequested(() => {
                                // will be returned as undefined
                                Gui.showMessage(
                                    vscode.l10n.t({
                                        message: `Validating {0} was cancelled.`,
                                        args: [theProfile.name],
                                        comment: [`The profile name`],
                                    })
                                );
                            });
                            return getSessStatus.getStatus(theProfile, theProfile.type);
                        }
                    );
                } else {
                    profileStatus = "unverified";
                }

                switch (profileStatus) {
                    case "active":
                        filteredProfile = {
                            status: "active",
                            name: theProfile.name,
                        };
                        this.profilesForValidation.push(filteredProfile);
                        break;
                    case "inactive":
                        filteredProfile = {
                            status: "inactive",
                            name: theProfile.name,
                        };
                        this.profilesForValidation.push(filteredProfile);
                        break;
                    // default will cover "unverified" and undefined
                    default:
                        filteredProfile = {
                            status: "unverified",
                            name: theProfile.name,
                        };
                        this.profilesForValidation.push(filteredProfile);
                        break;
                }
            } catch (error) {
                ZoweLogger.info(
                    vscode.l10n.t({
                        message: `Profile validation failed for {0}.`,
                        args: [theProfile.name],
                        comment: [`The profile name`],
                    })
                );
                await errorHandling(error, theProfile.name);
                filteredProfile = {
                    status: "inactive",
                    name: theProfile.name,
                };
                this.profilesForValidation.push(filteredProfile);
            }
        }

        return filteredProfile;
    }

    public async ssoLogin(node?: Types.IZoweNodeType, label?: string): Promise<void> {
        ZoweLogger.trace("Profiles.ssoLogin called.");
        let loginTokenType: string;
        let serviceProfile: zowe.imperative.IProfileLoaded;
        if (node) {
            serviceProfile = node.getProfile();
        } else {
            serviceProfile = this.loadNamedProfile(label.trim());
        }
        // This check will handle service profiles that have username and password
        if (ProfilesUtils.isProfileUsingBasicAuth(serviceProfile)) {
            Gui.showMessage(vscode.l10n.t(`This profile is using basic authentication and does not support token authentication.`));
            return;
        }

        const zeInstance = ZoweExplorerApiRegister.getInstance();
        try {
            loginTokenType = await zeInstance.getCommonApi(serviceProfile).getTokenTypeName();
        } catch (error) {
            ZoweLogger.warn(error);
            Gui.showMessage(
                vscode.l10n.t({
                    message: `Error getting supported tokenType value for profile {0}`,
                    args: [serviceProfile.name],
                    comment: [`Service profile name`],
                })
            );
            return;
        }
        try {
            let loginOk = false;
            if (loginTokenType && !loginTokenType.startsWith(zowe.imperative.SessConstants.TOKEN_TYPE_APIML)) {
                loginOk = await this.loginWithRegularProfile(serviceProfile, node);
            } else {
                loginOk = await ZoweVsCodeExtension.loginWithBaseProfile(serviceProfile, loginTokenType, node, zeInstance, this);
            }
            if (loginOk) {
                Gui.showMessage(vscode.l10n.t("Login to authentication service was successful."));
                await Profiles.getInstance().refresh(zeInstance);
            } else {
                Gui.showMessage(this.profilesOpCancelled);
            }
        } catch (err) {
            const message = vscode.l10n.t({
                message: `Unable to log in with {0}. {1}`,
                args: [serviceProfile.name, err?.message],
                comment: [`Service profile name`, `Error message`],
            });
            ZoweLogger.error(message);
            Gui.errorMessage(message);
            return;
        }
    }

    public clearDSFilterFromTree(node: Types.IZoweNodeType): void {
        if (!TreeProviders.ds?.mSessionNodes || !TreeProviders.ds?.mSessionNodes.length) {
            return;
        }
        const dsNode: IZoweDatasetTreeNode = TreeProviders.ds.mSessionNodes.find(
            (sessionNode: IZoweDatasetTreeNode) => sessionNode.getProfile()?.name === node.getProfile()?.name
        );
        if (!dsNode) {
            return;
        }
        dsNode.tooltip &&= node.getProfile()?.name;
        dsNode.description &&= "";
        dsNode.pattern &&= "";
        TreeProviders.ds.flipState(dsNode, false);
        TreeProviders.ds.refreshElement(dsNode);
    }

    public clearUSSFilterFromTree(node: Types.IZoweNodeType): void {
        if (!TreeProviders.uss?.mSessionNodes || !TreeProviders.uss?.mSessionNodes.length) {
            return;
        }
        const ussNode: IZoweUSSTreeNode = TreeProviders.uss.mSessionNodes.find(
            (sessionNode: IZoweUSSTreeNode) => sessionNode.getProfile()?.name === node.getProfile()?.name
        );
        if (!ussNode) {
            return;
        }
        ussNode.tooltip &&= node.getProfile()?.name;
        ussNode.description &&= "";
        ussNode.fullPath &&= "";
        TreeProviders.uss.flipState(ussNode, false);
        TreeProviders.uss.refreshElement(ussNode);
    }

    public clearJobFilterFromTree(node: Types.IZoweNodeType): void {
        if (!TreeProviders.job?.mSessionNodes || !TreeProviders.job?.mSessionNodes.length) {
            return;
        }
        const jobNode: IZoweJobTreeNode = TreeProviders.job.mSessionNodes.find(
            (sessionNode: IZoweJobTreeNode) => sessionNode.getProfile()?.name === node.getProfile()?.name
        );
        if (!jobNode) {
            return;
        }
        jobNode.tooltip &&= node.getProfile()?.name;
        jobNode.description &&= "";
        jobNode.owner &&= "";
        jobNode.prefix &&= "";
        jobNode.status &&= "";
        jobNode.filtered &&= false;
        jobNode.children &&= [];
        TreeProviders.job.flipState(jobNode, false);
        TreeProviders.job.refreshElement(jobNode);
    }

    public clearFilterFromAllTrees(node: Types.IZoweNodeType): void {
        this.clearDSFilterFromTree(node);
        this.clearUSSFilterFromTree(node);
        this.clearJobFilterFromTree(node);
    }

    public async ssoLogout(node: Types.IZoweNodeType): Promise<void> {
        ZoweLogger.trace("Profiles.ssoLogout called.");
        const serviceProfile = node.getProfile();
        // This check will handle service profiles that have username and password
        if (ProfilesUtils.isProfileUsingBasicAuth(serviceProfile)) {
            Gui.showMessage(vscode.l10n.t(`This profile is using basic authentication and does not support token authentication.`));
            return;
        }

        try {
            this.clearFilterFromAllTrees(node);

            // this will handle extenders
            if (
                serviceProfile.type !== "zosmf" &&
                serviceProfile.profile != null &&
                !serviceProfile.profile.tokenType?.startsWith(zowe.imperative.SessConstants.TOKEN_TYPE_APIML)
            ) {
                await ZoweExplorerApiRegister.getInstance()
                    .getCommonApi(serviceProfile)
                    .logout(await node.getSession());
            } else {
                await ZoweVsCodeExtension.logoutWithBaseProfile(serviceProfile, ZoweExplorerApiRegister.getInstance(), this);
            }
            Gui.showMessage(
                vscode.l10n.t({
                    message: "Logout from authentication service was successful for {0}.",
                    args: [serviceProfile.name],
                    comment: ["Service profile name"],
                })
            );
            await Profiles.getInstance().refresh(ZoweExplorerApiRegister.getInstance());
        } catch (error) {
            const message = vscode.l10n.t({
                message: "Unable to log out with {0}. {1}",
                args: [serviceProfile.name, error?.message],
                comment: ["Service profile name", "Error message"],
            });
            ZoweLogger.error(message);
            Gui.errorMessage(message);
            return;
        }
    }

    public async openConfigFile(filePath: string): Promise<void> {
        ZoweLogger.trace("Profiles.openConfigFile called.");
        const document = await vscode.workspace.openTextDocument(filePath);
        await Gui.showTextDocument(document);
    }

    /**
     * gets secure properties for a profile
     * @param profileName the name of the profile
     * @returns {string[]} an array with the secure properties
     */
    public async getSecurePropsForProfile(profileName: string): Promise<string[]> {
        if (!profileName) {
            return [];
        }
        const usingSecureCreds = SettingsConfig.getDirectValue(globals.SETTINGS_SECURE_CREDENTIALS_ENABLED);
        const profInfo = await this.getProfileInfo();
        if (profInfo.usingTeamConfig && usingSecureCreds) {
            return profInfo.getTeamConfig().api.secure.securePropsForProfile(profileName);
        }
        const profAttrs = await this.getProfileFromConfig(profileName);
        const mergedArgs = profInfo.mergeArgsForProfile(profAttrs);
        return mergedArgs.knownArgs
            .filter((arg) => arg.secure || arg.argName === "tokenType" || arg.argName === "tokenValue")
            .map((arg) => arg.argName);
    }

    private async loginWithBaseProfile(
        serviceProfile: zowe.imperative.IProfileLoaded,
        loginTokenType: string,
        node?: Types.IZoweNodeType
    ): Promise<void> {
        const baseProfile = await this.fetchBaseProfile();
        if (baseProfile) {
            const creds = await this.loginCredentialPrompt();
            if (!creds) {
                return;
            }
            const updSession = new zowe.imperative.Session({
                hostname: serviceProfile.profile.host,
                port: serviceProfile.profile.port,
                user: creds[0],
                password: creds[1],
                rejectUnauthorized: serviceProfile.profile.rejectUnauthorized,
                tokenType: loginTokenType,
                type: zowe.imperative.SessConstants.AUTH_TYPE_TOKEN,
            });
            const loginToken = await ZoweExplorerApiRegister.getInstance().getCommonApi(serviceProfile).login(updSession);
            const updBaseProfile: zowe.imperative.IProfile = {
                tokenType: loginTokenType,
                tokenValue: loginToken,
            };
            await this.updateBaseProfileFileLogin(baseProfile, updBaseProfile);
            const baseIndex = this.allProfiles.findIndex((profile) => profile.name === baseProfile.name);
            this.allProfiles[baseIndex] = { ...baseProfile, profile: { ...baseProfile.profile, ...updBaseProfile } };
            if (node) {
                node.setProfileToChoice({
                    ...node.getProfile(),
                    profile: { ...node.getProfile().profile, ...updBaseProfile },
                });
            }
            Gui.showMessage(vscode.l10n.t("Login to authentication service was successful."));
        }
    }

    private async loginWithRegularProfile(serviceProfile: zowe.imperative.IProfileLoaded, node?: Types.IZoweNodeType): Promise<boolean> {
        let session: zowe.imperative.Session;
        if (node) {
            session = node.getSession();
        }
        if (session == null) {
            session = await ZoweExplorerApiRegister.getInstance().getCommonApi(serviceProfile).getSession();
        }
        const creds = await this.loginCredentialPrompt();
        if (!creds) {
            return false;
        }
        session.ISession.user = creds[0];
        session.ISession.password = creds[1];
        await ZoweExplorerApiRegister.getInstance().getCommonApi(serviceProfile).login(session);
        const profIndex = this.allProfiles.findIndex((profile) => profile.name === serviceProfile.name);
        this.allProfiles[profIndex] = { ...serviceProfile, profile: { ...serviceProfile, ...session } };
        if (node) {
            node.setProfileToChoice({
                ...node.getProfile(),
                profile: { ...node.getProfile().profile, ...session },
            });
        }
        Gui.showMessage(vscode.l10n.t("Login to authentication service was successful."));
        return true;
    }

    private async getConfigLocationPrompt(action: string): Promise<string> {
        ZoweLogger.trace("Profiles.getConfigLocationPrompt called.");
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
        return;
    }

    private async checkExistingConfig(filePath: string): Promise<string | false> {
        ZoweLogger.trace("Profiles.checkExistingConfig called.");
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

    private async getConfigLayers(): Promise<zowe.imperative.IConfigLayer[]> {
        ZoweLogger.trace("Profiles.getConfigLayers called.");
        const existingLayers: zowe.imperative.IConfigLayer[] = [];
        const config = await zowe.imperative.Config.load("zowe", {
            homeDir: FileManagement.getZoweDir(),
            projectDir: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
        });
        const layers = config.layers;
        layers.forEach((layer) => {
            if (layer.exists) {
                existingLayers.push(layer);
            }
        });
        return existingLayers;
    }

    private getProfileIcon(osLocInfo: zowe.imperative.IProfLocOsLoc[]): string[] {
        ZoweLogger.trace("Profiles.getProfileIcon called.");
        const ret: string[] = [];
        for (const loc of osLocInfo ?? []) {
            if (loc.global) {
                ret.push("$(home)");
            } else {
                ret.push("$(folder)");
            }
        }
        return ret;
    }

    private async loginCredentialPrompt(): Promise<string[]> {
        ZoweLogger.trace("Profiles.loginCredentialPrompt called.");
        let newPass: string;
        const newUser = await this.userInfo();
        if (!newUser) {
            Gui.showMessage(this.profilesOpCancelled);
            return;
        } else {
            newPass = await this.passwordInfo();
            if (!newPass) {
                Gui.showMessage(this.profilesOpCancelled);
                return;
            }
        }
        return [newUser, newPass];
    }

    private async userInfo(input?: string): Promise<string> {
        ZoweLogger.trace("Profiles.userInfo called.");
        let userName: string;

        if (input) {
            userName = input;
        }
        InputBoxOptions = {
            placeHolder: vscode.l10n.t("User Name"),
            prompt: vscode.l10n.t("Enter the user name for the connection. Leave blank to not store."),
            ignoreFocusOut: true,
            value: userName,
        };
        userName = await Gui.showInputBox(InputBoxOptions);

        if (userName === undefined) {
            Gui.showMessage(this.profilesOpCancelled);
            return undefined;
        }

        return userName.trim();
    }

    private async passwordInfo(input?: string): Promise<string> {
        ZoweLogger.trace("Profiles.passwordInfo called.");
        let passWord: string;

        if (input) {
            passWord = input;
        }

        InputBoxOptions = {
            placeHolder: vscode.l10n.t("Password"),
            prompt: vscode.l10n.t("Enter the password for the connection. Leave blank to not store."),
            password: true,
            ignoreFocusOut: true,
            value: passWord,
        };
        passWord = await Gui.showInputBox(InputBoxOptions);

        if (passWord === undefined) {
            Gui.showMessage(this.profilesOpCancelled);
            return undefined;
        }

        return passWord.trim();
    }

    // Temporary solution for handling unsecure profiles until CLI team's work is made
    // Remove secure properties and set autoStore to false when vscode setting is true
    private createNonSecureProfile(newConfig: zowe.imperative.IConfig): void {
        ZoweLogger.trace("Profiles.createNonSecureProfile called.");
        const isSecureCredsEnabled: boolean = SettingsConfig.getDirectValue(globals.SETTINGS_SECURE_CREDENTIALS_ENABLED);
        if (!isSecureCredsEnabled) {
            for (const profile of Object.entries(newConfig?.profiles)) {
                delete newConfig.profiles[profile[0]].secure;
            }
            newConfig.autoStore = false;
        }
    }

    public async refresh(apiRegister?: IRegisterClient): Promise<void> {
        return super.refresh(apiRegister ?? ZoweExplorerApiRegister.getInstance());
    }
}
