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
import * as path from "path";
import {
    Gui,
    imperative,
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
import { SettingsConfig } from "./SettingsConfig";
import { Constants } from "./Constants";
import { ProfileConstants } from "@zowe/core-for-zowe-sdk";
import { ZoweExplorerApiRegister } from "../extending/ZoweExplorerApiRegister";
import { ZoweLogger } from "../tools/ZoweLogger";
import { SharedTreeProviders } from "../trees/shared/SharedTreeProviders";
import { ZoweExplorerExtender } from "../extending/ZoweExplorerExtender";
import { FilterDescriptor, FilterItem } from "../management/FilterManagement";
import { AuthUtils } from "../utils/AuthUtils";

export class Profiles extends ProfilesCache {
    // Processing stops if there are no profiles detected
    public static async createInstance(log: imperative.Logger): Promise<Profiles> {
        Profiles.loader = new Profiles(log, ZoweVsCodeExtension.workspaceRoot?.uri.fsPath);
        Constants.PROFILES_CACHE = Profiles.loader;
        try {
            await Profiles.loader.refresh(ZoweExplorerApiRegister.getInstance());
        } catch (err) {
            ZoweLogger.error(err);
            ZoweExplorerExtender.showZoweConfigError(err.message);
        }
        await Profiles.getInstance().getProfileInfo();
        return Profiles.loader;
    }

    public static getInstance(): Profiles {
        ZoweLogger.trace("Profiles.getInstance called.");
        return Profiles.loader;
    }

    protected static loader: Profiles;

    public loadedProfile: imperative.IProfileLoaded;
    public validProfile: Validation.ValidationType = Validation.ValidationType.INVALID;
    private mProfileInfo: imperative.ProfileInfo;
    private profilesOpCancelled = vscode.l10n.t(`Operation Cancelled`);
    private manualEditMsg = vscode.l10n.t(
        `The Team configuration file has been opened in the editor. Editing or removal of profiles will need to be done manually.`
    );
    private InputBoxOptions: vscode.InputBoxOptions;
    public constructor(log: imperative.Logger, cwd?: string) {
        super(log, cwd);
    }

    /**
     * Initializes the Imperative ProfileInfo API and reads profiles from disk.
     * During extension activation the ProfileInfo object is cached, so this
     * method can be called multiple times without impacting performance. After
     * the extension has activated, the cache expires so that the latest profile
     * contents will be loaded.
     */
    public async getProfileInfo(): Promise<imperative.ProfileInfo> {
        ZoweLogger.trace("Profiles.getProfileInfo called.");
        if (this.mProfileInfo == null) {
            this.mProfileInfo = await super.getProfileInfo();
            // Cache profile info object until current thread is done executing
            setImmediate(() => (this.mProfileInfo = null));
        }
        return this.mProfileInfo;
    }

    public async checkCurrentProfile(theProfile: imperative.IProfileLoaded): Promise<Validation.IValidationProfile> {
        ZoweLogger.trace("Profiles.checkCurrentProfile called.");
        let profileStatus: Validation.IValidationProfile = { name: theProfile.name, status: "unverified" };
        let usingTokenAuth: boolean;
        try {
            usingTokenAuth = await AuthUtils.isUsingTokenAuth(theProfile.name);
        } catch (err) {
            ZoweLogger.error(err);
            ZoweExplorerExtender.showZoweConfigError(err.message);
            return profileStatus;
        }

        if (usingTokenAuth && !theProfile.profile.tokenType) {
            // The profile will need to be reactivated, so remove it from profilesForValidation
            this.profilesForValidation = this.profilesForValidation.filter(
                (profile) => profile.status === "unverified" && profile.name !== theProfile.name
            );
            try {
                await Profiles.getInstance().ssoLogin(null, theProfile.name);
                theProfile = Profiles.getInstance().loadNamedProfile(theProfile.name);
                // Validate profile
                profileStatus = await this.getProfileSetting(theProfile);
            } catch (error) {
                await AuthUtils.errorHandling(error, theProfile.name, error.message);
                return profileStatus;
            }
        } else if (!usingTokenAuth && (!theProfile.profile.user || !theProfile.profile.password)) {
            // The profile will need to be reactivated, so remove it from profilesForValidation
            this.profilesForValidation = this.profilesForValidation.filter(
                (profile) => profile.status === "unverified" && profile.name !== theProfile.name
            );
            let values: string[];
            try {
                values = await Profiles.getInstance().promptCredentials(theProfile);
            } catch (error) {
                await AuthUtils.errorHandling(error, theProfile.name, error.message);
                return profileStatus;
            }
            if (values) {
                theProfile.profile.user = values[0];
                theProfile.profile.password = values[1];

                // Validate profile
                profileStatus = await this.getProfileSetting(theProfile);
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

    public async getProfileSetting(theProfile: imperative.IProfileLoaded): Promise<Validation.IValidationProfile> {
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
        const treeNodes = SharedTreeProviders.getSessionForAllTrees(node.getLabel().toString());
        treeNodes.forEach((treeNode) => {
            if (treeNode) {
                this.disableValidationContext(treeNode);
            }
        });
        return node;
    }

    public disableValidationContext(node: Types.IZoweNodeType): Types.IZoweNodeType {
        ZoweLogger.trace("Profiles.disableValidationContext called.");
        const theProfile: imperative.IProfileLoaded = node.getProfile();
        this.validationArraySetup(theProfile, false);
        if (node.contextValue.includes(Constants.VALIDATE_SUFFIX)) {
            node.contextValue = node.contextValue.replace(Constants.VALIDATE_SUFFIX, Constants.NO_VALIDATE_SUFFIX);
        } else if (node.contextValue.includes(Constants.NO_VALIDATE_SUFFIX)) {
            return node;
        } else {
            node.contextValue += Constants.VALIDATE_SUFFIX;
        }
        return node;
    }

    public enableValidation(node: Types.IZoweNodeType): Types.IZoweNodeType {
        ZoweLogger.trace("Profiles.enableValidation called.");
        const treeNodes = SharedTreeProviders.getSessionForAllTrees(node.getLabel().toString());
        treeNodes.forEach((treeNode) => {
            if (treeNode) {
                this.enableValidationContext(treeNode);
            }
        });
        return node;
    }

    public enableValidationContext(node: Types.IZoweNodeType): Types.IZoweNodeType {
        ZoweLogger.trace("Profiles.enableValidationContext called.");
        const theProfile: imperative.IProfileLoaded = node.getProfile();
        this.validationArraySetup(theProfile, true);
        if (node.contextValue.includes(Constants.NO_VALIDATE_SUFFIX)) {
            node.contextValue = node.contextValue.replace(Constants.NO_VALIDATE_SUFFIX, Constants.VALIDATE_SUFFIX);
        } else if (node.contextValue.includes(Constants.VALIDATE_SUFFIX)) {
            return node;
        } else {
            node.contextValue += Constants.VALIDATE_SUFFIX;
        }

        return node;
    }

    public validationArraySetup(theProfile: imperative.IProfileLoaded, validationSetting: boolean): Validation.IValidationSetting {
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
        let allProfiles: imperative.IProfileLoaded[];
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
        let mProfileInfo: imperative.ProfileInfo;
        try {
            mProfileInfo = await this.getProfileInfo();
        } catch (err) {
            ZoweLogger.error(err);
            ZoweExplorerExtender.showZoweConfigError(err.message);
            return;
        }
        const profAllAttrs = mProfileInfo.getAllProfiles();
        for (const pName of profileNamesList) {
            const osLocInfo = mProfileInfo.getOsLocInfo(profAllAttrs.find((p) => p.profName === pName));
            items.push(new FilterItem({ text: pName, icon: this.getProfileIcon(osLocInfo)[0] }));
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
            let config: imperative.ProfileInfo;
            try {
                config = await this.getProfileInfo();
            } catch (error) {
                ZoweLogger.error(error);
                ZoweExplorerExtender.showZoweConfigError(error.message);
                return;
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
            await zoweFileProvider.addSession({
                sessionName: chosenProfile,
                addToAllTrees: await Profiles.handleChangeForAllTrees(chosenProfile, true),
            });
        } else {
            ZoweLogger.debug(debugMsg);
        }
    }

    public async editSession(profileLoaded: imperative.IProfileLoaded): Promise<void> {
        let currentProfile: imperative.IProfAttrs;
        try {
            currentProfile = await this.getProfileFromConfig(profileLoaded.name);
        } catch (err) {
            ZoweLogger.error(err);
            ZoweExplorerExtender.showZoweConfigError(err.message);
            return;
        }
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

    public async createZoweSchema(_zoweFileProvider: IZoweTree<IZoweTreeNode>): Promise<void> {
        ZoweLogger.trace("Profiles.createZoweSchema called.");
        try {
            let user = false;
            let global = true;
            let rootPath = FileManagement.getZoweDir();
            const workspaceDir = ZoweVsCodeExtension.workspaceRoot;
            if (workspaceDir != null) {
                const choice = await this.getConfigLocationPrompt("create");
                if (choice === undefined) {
                    Gui.showMessage(this.profilesOpCancelled);
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

            const knownCliConfig: imperative.ICommandProfileTypeConfiguration[] = this.getCoreProfileTypes();
            knownCliConfig.push(...this.getConfigArray());
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
                profiles: [...this.getCoreProfileTypes(), ProfileConstants.BaseProfile],
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

    public async promptCredentials(profile: string | imperative.IProfileLoaded, rePrompt?: boolean): Promise<string[]> {
        ZoweLogger.trace("Profiles.promptCredentials called.");
        const profilename = typeof profile === "string" ? profile : profile.name;
        const userInputBoxOptions: vscode.InputBoxOptions = {
            placeHolder: vscode.l10n.t(`User Name`),
            prompt: vscode.l10n.t({
                message: "Enter the user name for the {0} connection. Leave blank to not store.",
                args: [profilename],
                comment: ["Profile name"],
            }),
        };
        const passwordInputBoxOptions: vscode.InputBoxOptions = {
            placeHolder: vscode.l10n.t(`Password`),
            prompt: vscode.l10n.t({
                message: "Enter the password for the {0} connection. Leave blank to not store.",
                args: [profilename],
                comment: ["Profile name"],
            }),
        };

        let mProfileInfo: imperative.ProfileInfo;
        try {
            mProfileInfo = await this.getProfileInfo();
        } catch (err) {
            ZoweLogger.error(err);
            ZoweExplorerExtender.showZoweConfigError(err.message);
            return;
        }
        const promptInfo = await ZoweVsCodeExtension.updateCredentials(
            {
                profile: typeof profile === "string" ? undefined : profile,
                sessionName: typeof profile === "string" ? profile : undefined,
                rePrompt,
                secure: mProfileInfo.isSecured(),
                userInputBoxOptions,
                passwordInputBoxOptions,
            },
            ZoweExplorerApiRegister.getInstance()
        );
        if (!promptInfo) {
            Gui.showMessage(this.profilesOpCancelled);
            return; // See https://github.com/zowe/zowe-explorer-vscode/issues/1827
        }

        const returnValue: string[] = [promptInfo.profile.user, promptInfo.profile.password];

        // If secure credentials are enabled, the config file won't change after updating existing credentials
        // (as the "secure" fields are already set). Fire the event emitter to notify extenders of the change.
        if (SettingsConfig.getDirectValue<boolean>(Constants.SETTINGS_SECURE_CREDENTIALS_ENABLED)) {
            ZoweExplorerApiRegister.getInstance().onProfilesUpdateEmitter.fire(Validation.EventType.UPDATE);
        }
        return returnValue;
    }

    public async getDeleteProfile(): Promise<imperative.IProfileLoaded> {
        ZoweLogger.trace("Profiles.getDeleteProfile called.");
        const allProfiles: imperative.IProfileLoaded[] = this.allProfiles;
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

    public async deleteProfile(node?: Types.IZoweNodeType): Promise<void> {
        ZoweLogger.trace("Profiles.deleteProfile called.");
        let deletedProfile: imperative.IProfileLoaded;
        if (!node) {
            deletedProfile = await this.getDeleteProfile();
        } else {
            deletedProfile = node.getProfile();
        }
        if (!deletedProfile) {
            return;
        }

        const deleteLabel = deletedProfile.name;

        let currentProfile: imperative.IProfAttrs;
        try {
            currentProfile = await this.getProfileFromConfig(deleteLabel);
        } catch (err) {
            ZoweLogger.error(err);
            ZoweExplorerExtender.showZoweConfigError(err.message);
            return;
        }
        const filePath = currentProfile.profLoc.osLoc[0];
        await this.openConfigFile(filePath);
    }

    public async validateProfiles(theProfile: imperative.IProfileLoaded): Promise<Validation.IValidationProfile> {
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
                await AuthUtils.errorHandling(error, theProfile.name);
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
        let serviceProfile: imperative.IProfileLoaded;
        if (node) {
            serviceProfile = node.getProfile();
        } else {
            serviceProfile = this.loadNamedProfile(label.trim());
        }
        // This check will handle service profiles that have username and password
        if (AuthUtils.isProfileUsingBasicAuth(serviceProfile)) {
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
            if (loginTokenType && !loginTokenType.startsWith(imperative.SessConstants.TOKEN_TYPE_APIML)) {
                loginOk = await this.loginWithRegularProfile(serviceProfile, node);
            } else {
                loginOk = await ZoweVsCodeExtension.ssoLogin({
                    serviceProfile,
                    defaultTokenType: loginTokenType,
                    profileNode: node,
                    zeRegister: zeInstance,
                    zeProfiles: this,
                    preferBaseToken: true,
                });
            }
            if (loginOk) {
                Gui.showMessage(
                    vscode.l10n.t({
                        message: "Login to authentication service was successful for {0}.",
                        args: [serviceProfile.name],
                        comment: ["Service profile name"],
                    })
                );
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

    public async basicAuthClearSecureArray(profileName?: string, loginTokenType?: string): Promise<void> {
        const profInfo = await this.getProfileInfo();
        const configApi = profInfo.getTeamConfig();
        const profAttrs = await this.getProfileFromConfig(profileName);
        if (loginTokenType && loginTokenType.startsWith("apimlAuthenticationToken")) {
            configApi.set(`${profAttrs.profLoc.jsonLoc}.secure`, []);
        } else {
            configApi.set(`${profAttrs.profLoc.jsonLoc}.secure`, ["tokenValue"]);
        }
        configApi.delete(profInfo.mergeArgsForProfile(profAttrs).knownArgs.find((arg) => arg.argName === "user")?.argLoc.jsonLoc);
        configApi.delete(profInfo.mergeArgsForProfile(profAttrs).knownArgs.find((arg) => arg.argName === "password")?.argLoc.jsonLoc);
        await configApi.save();
    }

    public async tokenAuthClearSecureArray(profileName?: string, loginTokenType?: string): Promise<void> {
        const profInfo = await this.getProfileInfo();
        const configApi = profInfo.getTeamConfig();
        if (loginTokenType && loginTokenType.startsWith("apimlAuthenticationToken")) {
            const profAttrs = await this.getProfileFromConfig("base");
            configApi.set(`${profAttrs.profLoc.jsonLoc}.secure`, []);
            configApi.delete(profInfo.mergeArgsForProfile(profAttrs).knownArgs.find((arg) => arg.argName === "tokenType")?.argLoc.jsonLoc);
            configApi.delete(profInfo.mergeArgsForProfile(profAttrs).knownArgs.find((arg) => arg.argName === "tokenValue")?.argLoc.jsonLoc);
            configApi.delete(profInfo.mergeArgsForProfile(profAttrs).knownArgs.find((arg) => arg.argName === "tokenExpiration")?.argLoc.jsonLoc);
        } else {
            const profAttrs = await this.getProfileFromConfig(profileName);
            configApi.set(`${profAttrs.profLoc.jsonLoc}.secure`, ["user", "password"]);
            configApi.delete(profInfo.mergeArgsForProfile(profAttrs).knownArgs.find((arg) => arg.argName === "tokenType")?.argLoc.jsonLoc);
            configApi.delete(profInfo.mergeArgsForProfile(profAttrs).knownArgs.find((arg) => arg.argName === "tokenValue")?.argLoc.jsonLoc);
            configApi.delete(profInfo.mergeArgsForProfile(profAttrs).knownArgs.find((arg) => arg.argName === "tokenExpiration")?.argLoc.jsonLoc);
        }
        await configApi.save();
    }

    public async handleSwitchAuthentication(node: Types.IZoweNodeType): Promise<void> {
        const qp = Gui.createQuickPick();
        const qpItemYes: vscode.QuickPickItem = {
            label: vscode.l10n.t("Yes"),
            description: vscode.l10n.t("To change the authentication"),
        };
        const qpItemNo: vscode.QuickPickItem = {
            label: vscode.l10n.t("No"),
            description: vscode.l10n.t("To continue in current authentication"),
        };
        qp.items = [qpItemYes, qpItemNo];
        qp.placeholder = vscode.l10n.t("Do you wish to change the Authentication");
        qp.activeItems = [qpItemYes];
        qp.show();
        const qpSelection = await Gui.resolveQuickPick(qp);
        qp.hide();

        if (qpSelection === undefined) {
            Gui.infoMessage(vscode.l10n.t("Operation Cancelled"));
            return;
        }
        if (qpSelection.label === vscode.l10n.t("No")) {
            return;
        }

        let loginTokenType: string;
        const serviceProfile = node.getProfile() ?? this.loadNamedProfile(node.label.toString().trim());
        const zeInstance = ZoweExplorerApiRegister.getInstance();
        try {
            loginTokenType = await zeInstance.getCommonApi(serviceProfile).getTokenTypeName();
        } catch (error) {
            ZoweLogger.warn(error);
            Gui.errorMessage(vscode.l10n.t("Cannot switch to Token-based Authentication for profile {0}.", serviceProfile.name));
            return;
        }
        switch (true) {
            case AuthUtils.isProfileUsingBasicAuth(serviceProfile): {
                let loginOk = false;
                if (loginTokenType && loginTokenType.startsWith("apimlAuthenticationToken")) {
                    loginOk = await ZoweVsCodeExtension.ssoLogin({
                        serviceProfile,
                        defaultTokenType: loginTokenType,
                        profileNode: node,
                        zeRegister: zeInstance,
                        zeProfiles: this,
                        preferBaseToken: true,
                    });
                } else {
                    loginOk = await this.loginWithRegularProfile(serviceProfile, node);
                }

                if (loginOk) {
                    Gui.showMessage(
                        vscode.l10n.t("Login using token-based authentication service was successful for profile {0}.", serviceProfile.name)
                    );
                    await this.basicAuthClearSecureArray(serviceProfile.name, loginTokenType);
                    const updBaseProfile: imperative.IProfile = {
                        user: undefined,
                        password: undefined,
                    };
                    node.setProfileToChoice({
                        ...node.getProfile(),
                        profile: { ...node.getProfile().profile, ...updBaseProfile },
                    });
                } else {
                    Gui.errorMessage(vscode.l10n.t("Unable to switch to Token-based authentication for profile {0}.", serviceProfile.name));
                    return;
                }
                break;
            }
            case await AuthUtils.isUsingTokenAuth(serviceProfile.name): {
                const profile: string | imperative.IProfileLoaded = node.getProfile();
                const creds = await Profiles.getInstance().promptCredentials(profile, true);

                if (creds !== undefined) {
                    const successMsg = vscode.l10n.t(
                        "Login using basic authentication was successful for profile {0}.",
                        typeof profile === "string" ? profile : profile.name
                    );
                    ZoweLogger.info(successMsg);
                    Gui.showMessage(successMsg);
                    await this.tokenAuthClearSecureArray(serviceProfile.name, loginTokenType);
                    ZoweExplorerApiRegister.getInstance().onProfilesUpdateEmitter.fire(Validation.EventType.UPDATE);
                } else {
                    Gui.errorMessage(vscode.l10n.t("Unable to switch to Basic authentication for profile {0}.", serviceProfile.name));
                    return;
                }
                break;
            }
            default: {
                Gui.errorMessage(vscode.l10n.t("Unable to Switch Authentication for profile {0}.", serviceProfile.name));
            }
        }
    }

    public clearDSFilterFromTree(node: Types.IZoweNodeType): void {
        if (!SharedTreeProviders.ds?.mSessionNodes || !SharedTreeProviders.ds?.mSessionNodes.length) {
            return;
        }
        const dsNode = SharedTreeProviders.ds.mSessionNodes.find(
            (sessionNode: IZoweDatasetTreeNode) => sessionNode.getProfile()?.name === node.getProfile()?.name
        ) as IZoweDatasetTreeNode;
        if (!dsNode) {
            return;
        }
        dsNode.tooltip &&= node.getProfile()?.name;
        dsNode.description &&= "";
        dsNode.pattern &&= "";
        SharedTreeProviders.ds.flipState(dsNode, false);
        SharedTreeProviders.ds.refreshElement(dsNode);
    }

    public clearUSSFilterFromTree(node: Types.IZoweNodeType): void {
        if (!SharedTreeProviders.uss?.mSessionNodes || !SharedTreeProviders.uss?.mSessionNodes.length) {
            return;
        }
        const ussNode = SharedTreeProviders.uss.mSessionNodes.find(
            (sessionNode: IZoweUSSTreeNode) => sessionNode.getProfile()?.name === node.getProfile()?.name
        );
        if (!ussNode) {
            return;
        }
        ussNode.tooltip &&= node.getProfile()?.name;
        ussNode.description &&= "";
        ussNode.fullPath &&= "";
        SharedTreeProviders.uss.flipState(ussNode, false);
        SharedTreeProviders.uss.refreshElement(ussNode);
    }

    public clearJobFilterFromTree(node: Types.IZoweNodeType): void {
        if (!SharedTreeProviders.job?.mSessionNodes || !SharedTreeProviders.job?.mSessionNodes.length) {
            return;
        }
        const jobNode: IZoweJobTreeNode = SharedTreeProviders.job.mSessionNodes.find(
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
        SharedTreeProviders.job.flipState(jobNode, false);
        SharedTreeProviders.job.refreshElement(jobNode);
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
        if (AuthUtils.isProfileUsingBasicAuth(serviceProfile)) {
            Gui.showMessage(vscode.l10n.t(`This profile is using basic authentication and does not support token authentication.`));
            return;
        }

        try {
            this.clearFilterFromAllTrees(node);
            let logoutOk = true;

            // this will handle extenders
            if (
                serviceProfile.type !== "zosmf" &&
                serviceProfile.profile != null &&
                !serviceProfile.profile.tokenType?.startsWith(imperative.SessConstants.TOKEN_TYPE_APIML)
            ) {
                await ZoweExplorerApiRegister.getInstance().getCommonApi(serviceProfile).logout(node.getSession());
                await Profiles.getInstance().updateCachedProfile(serviceProfile, node);
            } else {
                const zeRegister = ZoweExplorerApiRegister.getInstance();
                logoutOk = await ZoweVsCodeExtension.ssoLogout({
                    serviceProfile,
                    defaultTokenType: zeRegister?.getCommonApi(serviceProfile).getTokenTypeName(),
                    profileNode: node,
                    zeRegister,
                    zeProfiles: this,
                    preferBaseToken: true,
                });
            }
            if (logoutOk) {
                Gui.showMessage(
                    vscode.l10n.t({
                        message: "Logout from authentication service was successful for {0}.",
                        args: [serviceProfile.name],
                        comment: ["Service profile name"],
                    })
                );
            }
        } catch (error) {
            const message = vscode.l10n.t({
                message: "Unable to log out with {0}. {1}",
                args: [serviceProfile.name, error?.message],
                comment: ["Service profile name", "Error message"],
            });
            ZoweLogger.error(message);
            Gui.errorMessage(message);
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
        const usingSecureCreds = SettingsConfig.getDirectValue(Constants.SETTINGS_SECURE_CREDENTIALS_ENABLED);
        const profInfo = await this.getProfileInfo();
        if (usingSecureCreds && profInfo.getTeamConfig().exists) {
            return profInfo.getTeamConfig().api.secure.securePropsForProfile(profileName);
        }
        const profAttrs = await this.getProfileFromConfig(profileName);
        const mergedArgs = profInfo.mergeArgsForProfile(profAttrs);
        return mergedArgs.knownArgs
            .filter((arg) => arg.secure || arg.argName === "tokenType" || arg.argName === "tokenValue")
            .map((arg) => arg.argName);
    }

    private async loginWithRegularProfile(serviceProfile: imperative.IProfileLoaded, node?: Types.IZoweNodeType): Promise<boolean> {
        let session: imperative.Session;
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
        await Profiles.getInstance().updateCachedProfile(serviceProfile, node);
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

    private async getConfigLayers(): Promise<imperative.IConfigLayer[]> {
        ZoweLogger.trace("Profiles.getConfigLayers called.");
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

    private getProfileIcon(osLocInfo: imperative.IProfLocOsLoc[]): string[] {
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
        this.InputBoxOptions = {
            placeHolder: vscode.l10n.t("User Name"),
            prompt: vscode.l10n.t("Enter the user name for the connection. Leave blank to not store."),
            ignoreFocusOut: true,
            value: userName,
        };
        userName = await Gui.showInputBox(this.InputBoxOptions);

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

        this.InputBoxOptions = {
            placeHolder: vscode.l10n.t("Password"),
            prompt: vscode.l10n.t("Enter the password for the connection. Leave blank to not store."),
            password: true,
            ignoreFocusOut: true,
            value: passWord,
        };
        passWord = await Gui.showInputBox(this.InputBoxOptions);

        if (passWord === undefined) {
            Gui.showMessage(this.profilesOpCancelled);
            return undefined;
        }

        return passWord.trim();
    }

    // Temporary solution for handling unsecure profiles until CLI team's work is made
    // Remove secure properties and set autoStore to false when vscode setting is true
    private createNonSecureProfile(newConfig: imperative.IConfig): void {
        ZoweLogger.trace("Profiles.createNonSecureProfile called.");
        const isSecureCredsEnabled: boolean = SettingsConfig.getDirectValue(Constants.SETTINGS_SECURE_CREDENTIALS_ENABLED);
        if (!isSecureCredsEnabled) {
            for (const profile of Object.entries(newConfig.profiles)) {
                delete newConfig.profiles[profile[0]].secure;
            }
            newConfig.autoStore = false;
        }
    }

    public async refresh(apiRegister?: IRegisterClient): Promise<void> {
        return super.refresh(apiRegister ?? ZoweExplorerApiRegister.getInstance());
    }

    public static async handleChangeForAllTrees(nodeName: string, checkPresence: boolean): Promise<boolean> {
        const selection = await this.promptChangeForAllTrees(nodeName, checkPresence);
        if (!selection) {
            return;
        }
        const [all] = this.getPromptChangeForAllTreesOptions();
        return selection.label === all.label;
    }
    private static async promptChangeForAllTrees(nodeName: string, checkPresence: boolean): Promise<vscode.QuickPickItem> {
        const [qpItemAll, qpItemCurrent] = this.getPromptChangeForAllTreesOptions();
        if (SharedTreeProviders.sessionIsPresentInOtherTrees(nodeName) === checkPresence) {
            return qpItemCurrent;
        }
        const qp = Gui.createQuickPick();
        qp.placeholder = vscode.l10n.t("Do you wish to apply this for all trees?");
        qp.items = [qpItemAll, qpItemCurrent];
        qp.activeItems = [qp.items[0]];
        qp.show();
        const selection = await Gui.resolveQuickPick(qp);
        qp.hide();
        return selection;
    }
    private static getPromptChangeForAllTreesOptions(): vscode.QuickPickItem[] {
        const qpItemAll: vscode.QuickPickItem = {
            label: vscode.l10n.t("Yes"),
            description: vscode.l10n.t("Apply to all trees"),
        };
        const qpItemCurrent: vscode.QuickPickItem = {
            label: vscode.l10n.t("No"),
            description: vscode.l10n.t("Apply to current tree selected"),
        };
        return [qpItemAll, qpItemCurrent];
    }
}
