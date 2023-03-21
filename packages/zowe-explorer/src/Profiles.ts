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
    IZoweNodeType,
    IZoweUSSTreeNode,
    IZoweDatasetTreeNode,
    IZoweJobTreeNode,
    IZoweTreeNode,
    PersistenceSchemaEnum,
    IProfileValidation,
    IValidationSetting,
    ValidProfileEnum,
    ProfilesCache,
    IUrlValidator,
    ZoweVsCodeExtension,
    getFullPath,
    getZoweDir,
} from "@zowe/zowe-explorer-api";
import { errorHandling, FilterDescriptor, FilterItem, readConfigFromDisk } from "./utils/ProfilesUtils";
import { ZoweExplorerApiRegister } from "./ZoweExplorerApiRegister";
import { ZoweExplorerExtender } from "./ZoweExplorerExtender";
import * as globals from "./globals";
import * as nls from "vscode-nls";
import { SettingsConfig } from "./utils/SettingsConfig";

// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();
let InputBoxOptions: vscode.InputBoxOptions;

export class Profiles extends ProfilesCache {
    // Processing stops if there are no profiles detected
    public static async createInstance(log: zowe.imperative.Logger): Promise<Profiles> {
        Profiles.loader = new Profiles(log, vscode.workspace.workspaceFolders?.[0]?.uri.fsPath);
        await Profiles.loader.refresh(ZoweExplorerApiRegister.getInstance());
        return Profiles.loader;
    }

    public static getInstance(): Profiles {
        return Profiles.loader;
    }

    protected static loader: Profiles;

    public loadedProfile: zowe.imperative.IProfileLoaded;
    public validProfile: ValidProfileEnum = ValidProfileEnum.INVALID;
    private dsSchema: string = globals.SETTINGS_DS_HISTORY;
    private ussSchema: string = globals.SETTINGS_USS_HISTORY;
    private jobsSchema: string = globals.SETTINGS_JOBS_HISTORY;
    private mProfileInfo: zowe.imperative.ProfileInfo;
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
        this.mProfileInfo = await super.getProfileInfo();
        return this.mProfileInfo;
    }

    public async checkCurrentProfile(theProfile: zowe.imperative.IProfileLoaded) {
        let profileStatus: IProfileValidation;
        if (!theProfile.profile.tokenType && (!theProfile.profile.user || !theProfile.profile.password)) {
            // The profile will need to be reactivated, so remove it from profilesForValidation
            this.profilesForValidation.filter((profile, index) => {
                if (profile.name === theProfile.name && profile.status !== "unverified") {
                    this.profilesForValidation.splice(index, 1);
                }
            });
            let values: string[];
            try {
                values = await Profiles.getInstance().promptCredentials(theProfile);
            } catch (error) {
                errorHandling(
                    error,
                    theProfile.name,
                    localize("checkCurrentProfile.error", "Error encountered in ") + `checkCurrentProfile.optionalProfiles!`
                );
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
                this.validProfile = ValidProfileEnum.UNVERIFIED;
                break;
            case "inactive":
                this.validProfile = ValidProfileEnum.INVALID;
                break;
            case "active":
                this.validProfile = ValidProfileEnum.VALID;
                break;
        }
        return profileStatus;
    }

    public async getProfileSetting(theProfile: zowe.imperative.IProfileLoaded): Promise<IProfileValidation> {
        let profileStatus: IProfileValidation;
        let found: boolean = false;
        this.profilesValidationSetting.filter(async (instance) => {
            if (instance.name === theProfile.name && instance.setting === false) {
                profileStatus = {
                    status: "unverified",
                    name: instance.name,
                };
                if (this.profilesForValidation.length > 0) {
                    this.profilesForValidation.filter((profile) => {
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

    public async disableValidation(node: IZoweNodeType): Promise<IZoweNodeType> {
        this.disableValidationContext(node);
        return node;
    }

    public async disableValidationContext(node: IZoweNodeType) {
        const theProfile: zowe.imperative.IProfileLoaded = node.getProfile();
        this.validationArraySetup(theProfile, false);
        if (node.contextValue.includes(`${globals.VALIDATE_SUFFIX}true`)) {
            node.contextValue = node.contextValue
                .replace(/(_validate=true)/g, "")
                .replace(/(_Active)/g, "")
                .replace(/(_Inactive)/g, "");
            node.contextValue = node.contextValue + `${globals.VALIDATE_SUFFIX}false`;
        } else if (node.contextValue.includes(`${globals.VALIDATE_SUFFIX}false`)) {
            return node;
        } else {
            node.contextValue = node.contextValue + `${globals.VALIDATE_SUFFIX}false`;
        }
        return node;
    }

    public async enableValidation(node: IZoweNodeType): Promise<IZoweNodeType> {
        this.enableValidationContext(node);
        return node;
    }

    public async enableValidationContext(node: IZoweNodeType) {
        const theProfile: zowe.imperative.IProfileLoaded = node.getProfile();
        this.validationArraySetup(theProfile, true);
        if (node.contextValue.includes(`${globals.VALIDATE_SUFFIX}false`)) {
            node.contextValue = node.contextValue.replace(/(_validate=false)/g, "").replace(/(_Unverified)/g, "");
            node.contextValue = node.contextValue + `${globals.VALIDATE_SUFFIX}true`;
        } else if (node.contextValue.includes(`${globals.VALIDATE_SUFFIX}true`)) {
            return node;
        } else {
            node.contextValue = node.contextValue + `${globals.VALIDATE_SUFFIX}true`;
        }

        return node;
    }

    public async validationArraySetup(theProfile: zowe.imperative.IProfileLoaded, validationSetting: boolean): Promise<IValidationSetting> {
        let found: boolean = false;
        let profileSetting: IValidationSetting;
        if (this.profilesValidationSetting.length > 0) {
            this.profilesValidationSetting.filter((instance) => {
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
    public async createZoweSession(zoweFileProvider: IZoweTree<IZoweTreeNode>) {
        let profileNamesList: string[] = [];
        try {
            const allProfiles = Profiles.getInstance().allProfiles;
            if (allProfiles) {
                // Get all profiles
                profileNamesList = allProfiles.map((profile) => {
                    return profile.name;
                });
                // Filter to list of the APIs available for current tree explorer
                profileNamesList = profileNamesList.filter((profileName) => {
                    const profile = Profiles.getInstance().loadNamedProfile(profileName);
                    if (profile) {
                        if (zoweFileProvider.getTreeType() === PersistenceSchemaEnum.USS) {
                            const ussProfileTypes = ZoweExplorerApiRegister.getInstance().registeredUssApiTypes();
                            return ussProfileTypes.includes(profile.type);
                        }
                        if (zoweFileProvider.getTreeType() === PersistenceSchemaEnum.Dataset) {
                            const mvsProfileTypes = ZoweExplorerApiRegister.getInstance().registeredMvsApiTypes();
                            return mvsProfileTypes.includes(profile.type);
                        }
                        if (zoweFileProvider.getTreeType() === PersistenceSchemaEnum.Job) {
                            const jesProfileTypes = ZoweExplorerApiRegister.getInstance().registeredJesApiTypes();
                            return jesProfileTypes.includes(profile.type);
                        }
                    }
                });
                profileNamesList = profileNamesList.filter(
                    (profileName) =>
                        // Find all cases where a profile is not already displayed
                        !zoweFileProvider.mSessionNodes?.find((sessionNode) => sessionNode.getProfileName() === profileName)
                );
            }
        } catch (err) {
            this.log.warn(err);
        }
        // Set Options according to profile management in use

        const createNewProfile = "Create a New Connection to z/OS";
        const createNewConfig = "Create a New Team Configuration File";
        const editConfig = "Edit Team Configuration File";

        const createPick = new FilterDescriptor("\uFF0B " + createNewProfile);
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
            this.log.warn(err);
        }

        const quickpick = Gui.createQuickPick();
        let addProfilePlaceholder = "";
        switch (zoweFileProvider.getTreeType()) {
            case PersistenceSchemaEnum.Dataset:
                addProfilePlaceholder = localize(
                    "ds.addSession.quickPickOption",
                    'Choose "Create new..." to define or select a profile to add to the DATA SETS Explorer'
                );
                break;
            case PersistenceSchemaEnum.Job:
                addProfilePlaceholder = localize(
                    "jobs.addSession.quickPickOption",
                    'Choose "Create new..." to define or select a profile to add to the JOBS Explorer'
                );
                break;
            default:
                // Use USS View as default for placeholder text
                addProfilePlaceholder = localize(
                    "uss.addSession.quickPickOption",
                    'Choose "Create new..." to define or select a profile to add to the USS Explorer'
                );
        }
        if (mProfileInfo && mProfileInfo.usingTeamConfig) {
            quickpick.items = [configPick, configEdit, ...items];
        } else {
            quickpick.items = [createPick, configPick, ...items];
        }
        quickpick.placeholder = addProfilePlaceholder;
        quickpick.ignoreFocusOut = true;
        quickpick.show();
        const choice = await Gui.resolveQuickPick(quickpick);
        quickpick.hide();
        if (!choice) {
            Gui.showMessage(localize("enterPattern.pattern", "No selection made. Operation cancelled."));
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
                this.log.error(error);
                ZoweExplorerExtender.showZoweConfigError(error.message);
            }
            if (config.usingTeamConfig) {
                const profiles = config.getAllProfiles();
                const currentProfile = await this.getProfileFromConfig(profiles[0].profName);
                const filePath = currentProfile.profLoc.osLoc[0];
                await this.openConfigFile(filePath);
                return;
            } else {
                let newprofile: any;
                let profileName: string;
                if (quickpick.value) {
                    profileName = quickpick.value;
                }

                const options = {
                    placeHolder: localize("createNewConnection.option.prompt.profileName.placeholder", "Connection Name"),
                    prompt: localize("createNewConnection.option.prompt.profileName", "Enter a name for the connection"),
                    value: profileName,
                };
                profileName = await Gui.showInputBox(options);
                if (!profileName) {
                    Gui.showMessage(localize("createNewConnection.enterprofileName", "Profile Name was not supplied. Operation Cancelled"));
                    return;
                }
                chosenProfile = profileName.trim();
                this.log.debug(localize("addSession.log.debug.createNewProfile", "User created a new profile"));
                try {
                    newprofile = await Profiles.getInstance().createNewConnection(chosenProfile);
                } catch (error) {
                    await errorHandling(error, chosenProfile, error.message);
                }
                if (newprofile) {
                    try {
                        await Profiles.getInstance().refresh(ZoweExplorerApiRegister.getInstance());
                    } catch (error) {
                        await errorHandling(error, newprofile, error.message);
                    }
                    await zoweFileProvider.addSession(newprofile);
                    await zoweFileProvider.refresh();
                }
            }
        } else if (chosenProfile) {
            this.log.debug(localize("createZoweSession.log.debug.selectProfile", "User selected profile ") + chosenProfile);
            await zoweFileProvider.addSession(chosenProfile);
        } else {
            this.log.debug(localize("createZoweSession.log.debug.cancelledSelection", "User cancelled profile selection"));
        }
    }

    public async editSession(profileLoaded: zowe.imperative.IProfileLoaded, profileName: string): Promise<any | undefined> {
        if ((await this.getProfileInfo()).usingTeamConfig) {
            const currentProfile = await this.getProfileFromConfig(profileLoaded.name);
            const filePath = currentProfile.profLoc.osLoc[0];
            await this.openConfigFile(filePath);
            return;
        }
        const editSession = this.loadNamedProfile(profileLoaded.name, profileLoaded.type).profile;
        const editURL = editSession.host + ":" + editSession.port;
        const editUser = editSession.user;
        const editPass = editSession.password;
        const editrej = editSession.rejectUnauthorized;
        let updUser: string;
        let updPass: string;
        let updRU: boolean;
        let updUrl: IUrlValidator | undefined;
        let updPort: any;

        const schema: {} = this.getSchema(profileLoaded.type);
        const schemaArray = Object.keys(schema);

        const updSchemaValues: any = {};
        updSchemaValues.name = profileName;

        // Go through array of schema for input values
        for (const value of schemaArray) {
            switch (value) {
                case "host":
                    updUrl = await this.urlInfo(editURL);
                    if (updUrl === undefined) {
                        Gui.showMessage(localize("editConnection.zosmfURL", "No valid value for z/OS URL. Operation Cancelled"));
                        return undefined;
                    }
                    updSchemaValues[value] = updUrl.host;
                    if (updUrl.port) {
                        updSchemaValues.port = updUrl.port;
                    }
                    break;
                case "port":
                    if (updSchemaValues[value] === undefined) {
                        updPort = await this.portInfo(value, schema);
                        if (Number.isNaN(Number(updPort))) {
                            Gui.showMessage(localize("editConnection.undefined.port", "Invalid Port number provided or operation was cancelled"));
                            return undefined;
                        }
                        updSchemaValues[value] = updPort;
                        break;
                    }
                    break;
                case "user":
                    updUser = await this.userInfo(editUser);
                    if (updUser === undefined) {
                        Gui.showMessage(localize("editConnection.undefined.username", "Operation Cancelled"));
                        return undefined;
                    }
                    updSchemaValues[value] = updUser;
                    break;
                case "password":
                    updPass = await this.passwordInfo(editPass);
                    if (updPass === undefined) {
                        Gui.showMessage(localize("editConnection.undefined.username", "Operation Cancelled"));
                        return undefined;
                    }
                    updSchemaValues[value] = updPass;
                    break;
                case "rejectUnauthorized":
                    updRU = await this.ruInfo(editrej);
                    if (updRU === undefined) {
                        Gui.showMessage(localize("editConnection.rejectUnauthorize", "Operation Cancelled"));
                        return undefined;
                    }
                    updSchemaValues[value] = updRU;
                    break;
                // for extenders that have their own token authentication methods with values in schema
                // tokenType & tokenValue does not need to be presented to user as this is collected via login
                case "tokenType":
                    break;
                case "tokenValue":
                    break;
                default:
                    let options: vscode.InputBoxOptions;
                    const response = await this.checkType(schema[value].type);
                    switch (response) {
                        case "number":
                            options = await this.optionsValue(value, schema, editSession[value]);
                            const updValue = await Gui.showInputBox(options);
                            if (!Number.isNaN(Number(updValue))) {
                                updSchemaValues[value] = Number(updValue);
                            } else {
                                switch (true) {
                                    case updValue === undefined:
                                        Gui.showMessage(localize("editConnection.number", "Operation Cancelled"));
                                        return undefined;
                                    case schema[value].optionDefinition.hasOwnProperty("defaultValue"):
                                        updSchemaValues[value] = schema[value].optionDefinition.defaultValue;
                                        break;
                                    default:
                                        updSchemaValues[value] = undefined;
                                        break;
                                }
                            }
                            break;
                        case "boolean":
                            let updIsTrue: boolean;
                            updIsTrue = await this.boolInfo(value, schema);
                            if (updIsTrue === undefined) {
                                Gui.showMessage(localize("editConnection.booleanValue", "Operation Cancelled"));
                                return undefined;
                            }
                            updSchemaValues[value] = updIsTrue;
                            break;
                        default:
                            options = await this.optionsValue(value, schema, editSession[value]);
                            const updDefValue = await Gui.showInputBox(options);
                            if (updDefValue === undefined) {
                                Gui.showMessage(localize("editConnection.default", "Operation Cancelled"));
                                return undefined;
                            }
                            if (updDefValue === "") {
                                break;
                            }
                            updSchemaValues[value] = updDefValue;
                            break;
                    }
            }
        }

        try {
            const updSession = await zowe.ZosmfSession.createSessCfgFromArgs(updSchemaValues);
            updSchemaValues.base64EncodedAuth = updSession.base64EncodedAuth;
            await this.updateProfile({
                profile: updSchemaValues,
                name: profileName,
                type: profileLoaded.type,
            });
            Gui.showMessage(localize("editConnection.success", "Profile was successfully updated"));

            return updSchemaValues;
        } catch (error) {
            await errorHandling(error, profileName, error.message);
        }
    }

    public async getProfileType(): Promise<string> {
        let profileType: string;
        const profTypes = ZoweExplorerApiRegister.getInstance().registeredApiTypes();
        const typeOptions = Array.from(profTypes);
        if (typeOptions.length === 1 && typeOptions[0] === "zosmf") {
            profileType = typeOptions[0];
        } else {
            const quickPickTypeOptions: vscode.QuickPickOptions = {
                placeHolder: localize("createNewConnection.option.prompt.type.placeholder", "Profile Type"),
                ignoreFocusOut: true,
                canPickMany: false,
            };
            profileType = await Gui.showQuickPick(typeOptions, quickPickTypeOptions);
        }
        return profileType;
    }

    public async createZoweSchema(_zoweFileProvider: IZoweTree<IZoweTreeNode>): Promise<string> {
        try {
            let user = false;
            let global = true;
            let rootPath = getZoweDir();
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]) {
                const choice = await this.getConfigLocationPrompt("create");
                if (choice === undefined) {
                    Gui.showMessage(localize("createZoweSchema.undefined.location", "Operation Cancelled"));
                    return;
                }
                if (choice === "project") {
                    rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                    user = true;
                    global = false;
                }
            }
            // call check for existing and prompt here
            const existingFile = await this.checkExistingConfig(rootPath);
            if (!existingFile) {
                return;
            }
            if (existingFile.includes("zowe")) {
                if (existingFile.includes("user")) {
                    user = true;
                    global = false;
                } else {
                    user = false;
                    global = true;
                }
            }
            const config = await zowe.imperative.Config.load("zowe", {
                homeDir: getZoweDir(),
                projectDir: getFullPath(rootPath),
            });
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]) {
                config.api.layers.activate(user, global, rootPath);
            }

            const impConfig: zowe.imperative.IImperativeConfig = zowe.getImperativeConfig();
            const knownCliConfig: zowe.imperative.ICommandProfileTypeConfiguration[] = impConfig.profiles;
            // add extenders config info from global variable
            globals.EXTENDER_CONFIG.forEach((item) => {
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
            await this.promptToRefreshForProfiles(rootPath);
            return path.join(rootPath, configName);
        } catch (err) {
            this.log.error(err);
            ZoweExplorerExtender.showZoweConfigError(err.message);
        }
    }

    public async editZoweConfigFile() {
        const existingLayers = await this.getConfigLayers();
        if (existingLayers.length === 1) {
            await this.openConfigFile(existingLayers[0].path);
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
                    break;
                case "global":
                    for (const file of existingLayers) {
                        if (file.global) {
                            await this.openConfigFile(file.path);
                        }
                    }
                    break;
                default:
                    Gui.showMessage(localize("createZoweSchema.undefined.location", "Operation Cancelled"));
                    return;
            }
            return;
        }
    }

    public async createNewConnection(profileName: string, requestedProfileType?: string): Promise<string | undefined> {
        let newUser: string;
        let newPass: string;
        let newRU: boolean;
        let newUrl: IUrlValidator | undefined;
        let newPort: any;

        const newProfileName = profileName.trim();

        if (newProfileName === undefined || newProfileName === "") {
            Gui.showMessage(localize("createNewConnection.profileName", "Profile name was not supplied. Operation Cancelled"));
            return undefined;
        }

        const profileType = requestedProfileType ? requestedProfileType : await this.getProfileType();
        if (profileType === undefined) {
            Gui.showMessage(localize("createNewConnection.profileType", "No profile type was chosen. Operation Cancelled"));
            return undefined;
        }

        const schema: {} = this.getSchema(profileType);
        const schemaArray = Object.keys(schema);

        const schemaValues: any = {};
        schemaValues.name = newProfileName;

        // Go through array of schema for input values
        for (const value of schemaArray) {
            switch (value) {
                case "host":
                    newUrl = await this.urlInfo();
                    if (newUrl === undefined) {
                        Gui.showMessage(localize("createNewConnection.zosmfURL", "No valid value for z/OS URL. Operation Cancelled"));
                        return undefined;
                    }
                    schemaValues[value] = newUrl.host;
                    if (newUrl.port) {
                        schemaValues.port = newUrl.port;
                    }
                    break;
                case "port":
                    if (schemaValues[value] === undefined) {
                        newPort = await this.portInfo(value, schema);
                        if (Number.isNaN(Number(newPort))) {
                            Gui.showMessage(
                                localize("createNewConnection.undefined.port", "Invalid Port number provided or operation was cancelled")
                            );
                            return undefined;
                        }
                        schemaValues[value] = newPort;
                        break;
                    }
                    break;
                case "user":
                    newUser = await this.userInfo();
                    if (newUser === undefined) {
                        Gui.showMessage(localize("createNewConnection.undefined.username", "Operation Cancelled"));
                        return undefined;
                    } else if (newUser === "") {
                        delete schemaValues[value];
                    } else {
                        schemaValues[value] = newUser;
                    }
                    break;
                case "password":
                    newPass = await this.passwordInfo();
                    if (newPass === undefined) {
                        Gui.showMessage(localize("createNewConnection.undefined.username", "Operation Cancelled"));
                        return undefined;
                    } else if (newPass === "") {
                        delete schemaValues[value];
                    } else {
                        schemaValues[value] = newPass;
                    }
                    break;
                case "rejectUnauthorized":
                    newRU = await this.ruInfo();
                    if (newRU === undefined) {
                        Gui.showMessage(localize("createNewConnection.rejectUnauthorize", "Operation Cancelled"));
                        return undefined;
                    }
                    schemaValues[value] = newRU;
                    break;
                // for extenders that have their own token authentication methods with values in schema
                // tokenType & tokenValue does not need to be presented to user as this is collected via login
                case "tokenType":
                    break;
                case "tokenValue":
                    break;
                default:
                    let options: vscode.InputBoxOptions;
                    const response = await this.checkType(schema[value].type);
                    switch (response) {
                        case "number":
                            options = await this.optionsValue(value, schema);
                            const enteredValue = Number(await Gui.showInputBox(options));
                            if (!Number.isNaN(Number(enteredValue))) {
                                if ((value === "encoding" || value === "responseTimeout") && enteredValue === 0) {
                                    delete schemaValues[value];
                                } else {
                                    schemaValues[value] = Number(enteredValue);
                                }
                            } else {
                                if (schema[value].optionDefinition.hasOwnProperty("defaultValue")) {
                                    schemaValues[value] = schema[value].optionDefinition.defaultValue;
                                } else {
                                    delete schemaValues[value];
                                }
                            }
                            break;
                        case "boolean":
                            let isTrue: boolean;
                            isTrue = await this.boolInfo(value, schema);
                            if (isTrue === undefined) {
                                Gui.showMessage(localize("createNewConnection.booleanValue", "Operation Cancelled"));
                                return undefined;
                            }
                            schemaValues[value] = isTrue;
                            break;
                        default:
                            options = await this.optionsValue(value, schema);
                            const defValue = await Gui.showInputBox(options);
                            if (defValue === undefined) {
                                Gui.showMessage(localize("createNewConnection.default", "Operation Cancelled"));
                                return undefined;
                            }
                            if (defValue === "") {
                                delete schemaValues[value];
                            } else {
                                schemaValues[value] = defValue;
                            }
                            break;
                    }
            }
        }

        try {
            for (const profile of this.allProfiles) {
                if (profile.name.toLowerCase() === profileName.toLowerCase()) {
                    Gui.errorMessage(
                        localize(
                            "createNewConnection.duplicateProfileName",
                            "Profile name already exists. Please create a profile using a different name"
                        )
                    );
                    return undefined;
                }
            }
            await this.saveProfile(schemaValues, schemaValues.name, profileType);
            Gui.showMessage(localize("createProfile.success.info", "Profile {0} was created.", newProfileName));
            // Trigger a ProfilesCache.createConfigInstance with a fresh Config.load
            // This shall capture any profiles created (v1 or v2)
            await readConfigFromDisk();
            return newProfileName;
        } catch (error) {
            await errorHandling(error, profileName, error.message);
            ZoweExplorerExtender.showZoweConfigError(error.message);
        }
    }

    public async promptCredentials(profile: string | zowe.imperative.IProfileLoaded, rePrompt?: boolean): Promise<string[]> {
        const userInputBoxOptions: vscode.InputBoxOptions = {
            placeHolder: localize("createNewConnection.option.prompt.username.placeholder", "User Name"),
            prompt: localize("createNewConnection.option.prompt.username", "Enter the user name for the connection. Leave blank to not store."),
        };
        const passwordInputBoxOptions: vscode.InputBoxOptions = {
            placeHolder: localize("createNewConnection.option.prompt.password.placeholder", "Password"),
            prompt: localize("createNewConnection.option.prompt.password", "Enter the password for the connection. Leave blank to not store."),
        };

        const promptInfo = await ZoweVsCodeExtension.updateCredentials(
            {
                sessionName: typeof profile !== "string" ? profile.name : profile,
                sessionType: typeof profile !== "string" ? profile.type : undefined,
                rePrompt,
                secure: (await this.getProfileInfo()).isSecured(),
                userInputBoxOptions,
                passwordInputBoxOptions,
            },
            ZoweExplorerApiRegister.getInstance()
        );
        if (!promptInfo) {
            Gui.showMessage(localize("promptCredentials.undefined.value", "Operation Cancelled"));
            return; // See https://github.com/zowe/vscode-extension-for-zowe/issues/1827
        }

        const updSession = promptInfo.profile as zowe.imperative.ISession;
        const returnValue = [updSession.user, updSession.password, updSession.base64EncodedAuth];
        this.updateProfilesArrays(promptInfo);
        return returnValue;
    }

    public async getDeleteProfile() {
        const allProfiles: zowe.imperative.IProfileLoaded[] = this.allProfiles;
        const profileNamesList = allProfiles.map((temprofile) => {
            return temprofile.name;
        });

        if (!profileNamesList.length) {
            Gui.showMessage(localize("deleteProfile.noProfilesLoaded", "No profiles available"));
            return;
        }

        const quickPickList: vscode.QuickPickOptions = {
            placeHolder: localize("deleteProfile.quickPickOption", "Select the profile you want to delete"),
            ignoreFocusOut: true,
            canPickMany: false,
        };
        const sesName = await Gui.showQuickPick(profileNamesList, quickPickList);

        if (sesName === undefined) {
            Gui.showMessage(localize("deleteProfile.undefined.profilename", "Operation Cancelled"));
            return;
        }

        return allProfiles.find((temprofile) => temprofile.name === sesName);
    }

    public async deleteProfile(
        datasetTree: IZoweTree<IZoweDatasetTreeNode>,
        ussTree: IZoweTree<IZoweUSSTreeNode>,
        jobsProvider: IZoweTree<IZoweJobTreeNode>,
        node?: IZoweNodeType
    ) {
        let deleteLabel: string;
        let deletedProfile: zowe.imperative.IProfileLoaded;
        if (!node) {
            deletedProfile = await this.getDeleteProfile();
        } else {
            deletedProfile = node.getProfile();
        }
        if (!deletedProfile) {
            return;
        }
        deleteLabel = deletedProfile.name;

        if ((await this.getProfileInfo()).usingTeamConfig) {
            const currentProfile = await this.getProfileFromConfig(deleteLabel);
            const filePath = currentProfile.profLoc.osLoc[0];
            await this.openConfigFile(filePath);
            return;
        }

        const deleteSuccess = await this.deletePrompt(deletedProfile);
        if (!deleteSuccess) {
            Gui.showMessage(localize("deleteProfile.noSelected", "Operation Cancelled"));
            return;
        }

        // Delete from data det file history
        const fileHistory: string[] = datasetTree.getFileHistory();
        fileHistory
            .slice()
            .reverse()
            .filter((ds) => ds.substring(1, ds.indexOf("]")).trim() === deleteLabel.toUpperCase())
            .forEach((ds) => {
                datasetTree.removeFileHistory(ds);
            });

        // Delete from Data Set Favorites
        datasetTree.removeFavProfile(deleteLabel, false);

        // Delete from Data Set Tree
        datasetTree.mSessionNodes.forEach((sessNode) => {
            if (sessNode.getProfileName() === deleteLabel) {
                datasetTree.deleteSession(sessNode);
                sessNode.dirty = true;
                datasetTree.refresh();
            }
        });

        // Delete from USS file history
        const fileHistoryUSS: string[] = ussTree.getFileHistory();
        fileHistoryUSS
            .slice()
            .reverse()
            .filter((uss) => uss.substring(1, uss.indexOf("]")).trim() === deleteLabel.toUpperCase())
            .forEach((uss) => {
                ussTree.removeFileHistory(uss);
            });

        // Delete from USS Favorites
        ussTree.removeFavProfile(deleteLabel, false);

        // Delete from USS Tree
        ussTree.mSessionNodes.forEach((sessNode) => {
            if (sessNode.getProfileName() === deleteLabel) {
                ussTree.deleteSession(sessNode);
                sessNode.dirty = true;
                ussTree.refresh();
            }
        });

        // Delete from Jobs Favorites
        jobsProvider.removeFavProfile(deleteLabel, false);

        // Delete from Jobs Tree
        jobsProvider.mSessionNodes.forEach((jobNode) => {
            if (jobNode.getProfileName() === deleteLabel) {
                jobsProvider.deleteSession(jobNode);
                jobNode.dirty = true;
                jobsProvider.refresh();
            }
        });

        // Delete from Data Set Sessions list
        const dsSetting: any = {
            ...SettingsConfig.getDirectValue(this.dsSchema),
        };
        let sessDS: string[] = dsSetting.sessions;
        let faveDS: string[] = dsSetting.favorites;
        sessDS = sessDS.filter((element) => {
            return element.trim() !== deleteLabel;
        });
        faveDS = faveDS.filter((element) => {
            return element.substring(1, element.indexOf("]")).trim() !== deleteLabel;
        });
        dsSetting.sessions = sessDS;
        dsSetting.favorites = faveDS;
        await SettingsConfig.setDirectValue(this.dsSchema, dsSetting);

        // Delete from USS Sessions list
        const ussSetting: any = {
            ...SettingsConfig.getDirectValue(this.ussSchema),
        };
        let sessUSS: string[] = ussSetting.sessions;
        let faveUSS: string[] = ussSetting.favorites;
        sessUSS = sessUSS.filter((element) => {
            return element.trim() !== deleteLabel;
        });
        faveUSS = faveUSS.filter((element) => {
            return element.substring(1, element.indexOf("]")).trim() !== deleteLabel;
        });
        ussSetting.sessions = sessUSS;
        ussSetting.favorites = faveUSS;
        await SettingsConfig.setDirectValue(this.ussSchema, ussSetting);

        // Delete from Jobs Sessions list
        const jobsSetting: any = {
            ...SettingsConfig.getDirectValue(this.jobsSchema),
        };
        let sessJobs: string[] = jobsSetting.sessions;
        let faveJobs: string[] = jobsSetting.favorites;
        sessJobs = sessJobs.filter((element) => {
            return element.trim() !== deleteLabel;
        });
        faveJobs = faveJobs.filter((element) => {
            return element.substring(1, element.indexOf("]")).trim() !== deleteLabel;
        });
        jobsSetting.sessions = sessJobs;
        jobsSetting.favorites = faveJobs;
        await SettingsConfig.setDirectValue(this.jobsSchema, jobsSetting);

        // Remove from list of all profiles
        const index = this.allProfiles.findIndex((deleteItem) => {
            return deleteItem.name === deletedProfile.name;
        });
        if (index >= 0) {
            this.allProfiles.splice(index, 1);
        }
    }

    public async validateProfiles(theProfile: zowe.imperative.IProfileLoaded) {
        let filteredProfile: IProfileValidation;
        let profileStatus;
        const getSessStatus = await ZoweExplorerApiRegister.getInstance().getCommonApi(theProfile);

        // Filter profilesForValidation to check if the profile is already validated as active
        this.profilesForValidation.filter((profile) => {
            if (profile.name === theProfile.name && profile.status === "active") {
                filteredProfile = {
                    status: profile.status,
                    name: profile.name,
                };
            }
        });

        // If not yet validated or inactive, call getStatus and validate the profile
        // status will be stored in profilesForValidation
        if (filteredProfile === undefined) {
            try {
                if (getSessStatus.getStatus) {
                    profileStatus = await Gui.withProgress(
                        {
                            location: vscode.ProgressLocation.Notification,
                            title: localize("Profiles.validateProfiles.validationProgress", "Validating {0} Profile.", theProfile.name),
                            cancellable: true,
                        },
                        async (progress, token) => {
                            token.onCancellationRequested(() => {
                                // will be returned as undefined
                                Gui.showMessage(
                                    localize("Profiles.validateProfiles.validationCancelled", "Validating {0} was cancelled.", theProfile.name)
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
                await errorHandling(error, theProfile.name);
                this.log.debug("Validate Error - Invalid Profile: " + error);
                filteredProfile = {
                    status: "inactive",
                    name: theProfile.name,
                };
                this.profilesForValidation.push(filteredProfile);
            }
        }

        return filteredProfile;
    }

    public async ssoLogin(node?: IZoweNodeType, label?: string): Promise<void> {
        let loginToken: string;
        let loginTokenType: string;
        let creds: string[];
        let serviceProfile: zowe.imperative.IProfileLoaded;
        let session: zowe.imperative.Session;
        if (node) {
            serviceProfile = node.getProfile();
        } else {
            serviceProfile = this.loadNamedProfile(label.trim());
        }
        // This check will handle service profiles that have username and password
        if (serviceProfile.profile.user && serviceProfile.profile.password) {
            Gui.showMessage(localize("ssoAuth.noBase", "This profile does not support token authentication."));
            return;
        }

        try {
            loginTokenType = await ZoweExplorerApiRegister.getInstance().getCommonApi(serviceProfile).getTokenTypeName();
        } catch (error) {
            this.log.info(error);
            Gui.showMessage(localize("ssoAuth.noBase", "This profile does not support token authentication."));
            return;
        }
        if (loginTokenType && loginTokenType !== zowe.imperative.SessConstants.TOKEN_TYPE_APIML) {
            // this will handle extenders
            if (node) {
                session = node.getSession();
            } else {
                session = await ZoweExplorerApiRegister.getInstance().getCommonApi(serviceProfile).getSession();
            }
            creds = await this.loginCredentialPrompt();
            if (!creds) {
                return;
            }
            session.ISession.user = creds[0];
            session.ISession.password = creds[1];
            try {
                loginToken = await ZoweExplorerApiRegister.getInstance().getCommonApi(serviceProfile).login(session);
                const profIndex = this.allProfiles.findIndex((profile) => profile.name === serviceProfile.name);
                this.allProfiles[profIndex] = { ...serviceProfile, profile: { ...serviceProfile, ...session } };
                node.setProfileToChoice({
                    ...node.getProfile(),
                    profile: { ...node.getProfile().profile, ...session },
                });
            } catch (error) {
                this.log.error(error);
                Gui.errorMessage(localize("ssoLogin.unableToLogin", "Unable to log in. ") + error.message);
                return;
            }
        } else {
            const baseProfile = await this.fetchBaseProfile();
            if (baseProfile) {
                creds = await this.loginCredentialPrompt();
                if (!creds) {
                    return;
                }
                try {
                    const updSession = new zowe.imperative.Session({
                        hostname: serviceProfile.profile.host,
                        port: serviceProfile.profile.port,
                        user: creds[0],
                        password: creds[1],
                        rejectUnauthorized: serviceProfile.profile.rejectUnauthorized,
                        tokenType: loginTokenType,
                        type: zowe.imperative.SessConstants.AUTH_TYPE_TOKEN,
                    });
                    loginToken = await ZoweExplorerApiRegister.getInstance().getCommonApi(serviceProfile).login(updSession);
                    const updBaseProfile: zowe.imperative.IProfile = {
                        tokenType: loginTokenType,
                        tokenValue: loginToken,
                    };
                    await this.updateBaseProfileFileLogin(baseProfile, updBaseProfile);
                    const baseIndex = this.allProfiles.findIndex((profile) => profile.name === baseProfile.name);
                    this.allProfiles[baseIndex] = { ...baseProfile, profile: { ...baseProfile, ...updBaseProfile } };
                    node.setProfileToChoice({
                        ...node.getProfile(),
                        profile: { ...node.getProfile().profile, ...updBaseProfile },
                    });
                } catch (error) {
                    this.log.error(error);
                    Gui.errorMessage(localize("ssoLogin.unableToLogin", "Unable to log in. ") + error.message);
                    return;
                }
            }
        }
        Gui.showMessage(localize("ssoLogin.successful", "Login to authentication service was successful."));
    }

    public async ssoLogout(node: IZoweNodeType): Promise<void> {
        const serviceProfile = node.getProfile();
        // This check will handle service profiles that have username and password
        if (serviceProfile.profile?.user && serviceProfile.profile?.password) {
            Gui.showMessage(localize("ssoAuth.noBase", "This profile does not support token authentication."));
            return;
        }
        try {
            // this will handle extenders
            if (serviceProfile.type !== "zosmf" && serviceProfile.profile?.tokenType !== zowe.imperative.SessConstants.TOKEN_TYPE_APIML) {
                await ZoweExplorerApiRegister.getInstance()
                    .getCommonApi(serviceProfile)
                    .logout(await node.getSession());
            } else {
                // this will handle base profile apiml tokens
                const baseProfile = await this.fetchBaseProfile();
                const loginTokenType = ZoweExplorerApiRegister.getInstance().getCommonApi(serviceProfile).getTokenTypeName();
                const updSession = new zowe.imperative.Session({
                    hostname: serviceProfile.profile.host,
                    port: serviceProfile.profile.port,
                    rejectUnauthorized: serviceProfile.profile.rejectUnauthorized,
                    tokenType: loginTokenType,
                    tokenValue: serviceProfile.profile.tokenValue,
                    type: zowe.imperative.SessConstants.AUTH_TYPE_TOKEN,
                });
                await ZoweExplorerApiRegister.getInstance().getCommonApi(serviceProfile).logout(updSession);

                await this.updateBaseProfileFileLogout(baseProfile);
            }
            Gui.showMessage(localize("ssoLogout.successful", "Logout from authentication service was successful."));
        } catch (error) {
            this.log.error(error);
            Gui.errorMessage(localize("ssoLogout.unableToLogout", "Unable to log out. ") + error.message);
            return;
        }
    }

    public async openConfigFile(filePath: string) {
        const document = await vscode.workspace.openTextDocument(filePath);
        await Gui.showTextDocument(document);
    }

    private async getConfigLocationPrompt(action: string): Promise<string> {
        let placeHolderText: string;
        if (action === "create") {
            placeHolderText = localize("getConfigLocationPrompt.placeholder.create", "Select the location where the config file will be initialized");
        } else {
            placeHolderText = localize("getConfigLocationPrompt.placeholder.edit", "Select the location of the config file to edit");
        }
        const quickPickOptions: vscode.QuickPickOptions = {
            placeHolder: placeHolderText,
            ignoreFocusOut: true,
            canPickMany: false,
        };
        const globalText = localize("getConfigLocationPrompt.showQuickPick.global", "Global: in the Zowe home directory");
        const projectText = localize("getConfigLocationPrompt.showQuickPick.project", "Project: in the current working directory");
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

    private async checkExistingConfig(filePath: string) {
        let found = false;
        let location: string;
        const existingLayers = await this.getConfigLayers();
        for (const file of existingLayers) {
            if (file.path.includes(filePath)) {
                found = true;
                const createButton = localize("checkExistingConfig.createNew.button", "Create New");
                const message = localize(
                    "checkExistingConfig.createNew.message",
                    // eslint-disable-next-line max-len
                    `A Team Configuration File already exists in this location\n{0}\nContinuing may alter the existing file, would you like to proceed?`,
                    file.path
                );
                await Gui.infoMessage(message, { items: [createButton], vsCodeOpts: { modal: true } }).then(async (selection) => {
                    if (selection) {
                        location = path.basename(file.path);
                    } else {
                        await this.openConfigFile(file.path);
                        location = undefined;
                    }
                });
            }
        }
        if (found) {
            return location;
        }
        return "none";
    }

    private async getConfigLayers(): Promise<zowe.imperative.IConfigLayer[]> {
        const existingLayers: zowe.imperative.IConfigLayer[] = [];
        const config = await zowe.imperative.Config.load("zowe", {
            homeDir: getZoweDir(),
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

    private async promptToRefreshForProfiles(rootPath: string) {
        if (globals.ISTHEIA) {
            const reloadButton = localize("createZoweSchema.reload.button", "Refresh Zowe Explorer");
            const infoMsg = localize(
                "createZoweSchema.reload.infoMessage",
                "Team Configuration file created. Location: {0}. \n Please update file and refresh Zowe Explorer via button or command palette.",
                rootPath
            );
            await Gui.showMessage(infoMsg, { items: [reloadButton] }).then(async (selection) => {
                if (selection === reloadButton) {
                    await vscode.commands.executeCommand("zowe.extRefresh");
                }
            });
        }
        return undefined;
    }

    private getProfileIcon(osLocInfo: zowe.imperative.IProfLocOsLoc[]): string[] {
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

    private async updateBaseProfileFileLogin(profile: zowe.imperative.IProfileLoaded, updProfile: zowe.imperative.IProfile) {
        const upd = { profileName: profile.name, profileType: profile.type };
        const mProfileInfo = await this.getProfileInfo();
        const setSecure = mProfileInfo.isSecured();
        await mProfileInfo.updateProperty({ ...upd, property: "tokenType", value: updProfile.tokenType });
        await mProfileInfo.updateProperty({ ...upd, property: "tokenValue", value: updProfile.tokenValue, setSecure });
    }

    private async updateBaseProfileFileLogout(profile: zowe.imperative.IProfileLoaded) {
        const mProfileInfo = await this.getProfileInfo();
        const setSecure = mProfileInfo.isSecured();
        const prof = mProfileInfo.getAllProfiles(profile.type).find((p) => p.profName === profile.name);
        const mergedArgs = mProfileInfo.mergeArgsForProfile(prof);
        await mProfileInfo.updateKnownProperty({ mergedArgs, property: "tokenValue", value: undefined, setSecure });
        await mProfileInfo.updateKnownProperty({ mergedArgs, property: "tokenType", value: undefined });
    }

    private async loginCredentialPrompt(): Promise<string[]> {
        let newPass: string;
        const newUser = await this.userInfo();
        if (!newUser) {
            Gui.showMessage(localize("ssoLogin.undefined.username", "Operation Cancelled"));
            return;
        } else {
            newPass = await this.passwordInfo();
            if (!newPass) {
                Gui.showMessage(localize("ssoLogin.undefined.username", "Operation Cancelled"));
                return;
            }
        }
        return [newUser, newPass];
    }

    private async deletePrompt(deletedProfile: zowe.imperative.IProfileLoaded) {
        const profileName = deletedProfile.name;
        this.log.debug(localize("deleteProfile.log.debug", "Deleting profile ") + profileName);
        const quickPickOptions: vscode.QuickPickOptions = {
            placeHolder: localize("deleteProfile.quickPickOption", "Delete {0}? This will permanently remove it from your system.", profileName),
            ignoreFocusOut: true,
            canPickMany: false,
        };
        // confirm that the user really wants to delete
        if (
            (await Gui.showQuickPick(
                [localize("deleteProfile.showQuickPick.delete", "Delete"), localize("deleteProfile.showQuickPick.cancel", "Cancel")],
                quickPickOptions
            )) !== localize("deleteProfile.showQuickPick.delete", "Delete")
        ) {
            this.log.debug(localize("deleteProfile.showQuickPick.log.debug", "User picked Cancel. Cancelling delete of profile"));
            return;
        }

        try {
            await this.deleteProfileOnDisk(deletedProfile);
        } catch (error) {
            this.log.error(localize("deleteProfile.delete.log.error", "Error encountered when deleting profile! ") + JSON.stringify(error));
            await errorHandling(error, profileName, error.message);
            throw error;
        }

        Gui.showMessage(localize("deleteProfile.success.info", "Profile {0} was deleted.", profileName));
        return profileName;
    }

    // ** Functions for handling Profile Information */

    private async urlInfo(input?): Promise<IUrlValidator | undefined> {
        let zosURL: string;
        if (input) {
            zosURL = input;
        }
        const options: vscode.InputBoxOptions = {
            prompt: localize("createNewConnection.option.prompt.url", "Enter a z/OS URL in the format 'https://url:port'."),
            value: zosURL,
            ignoreFocusOut: true,
            placeHolder: localize("createNewConnection.option.prompt.url.placeholder", "https://url:port"),
            validateInput: (text: string): string | undefined => {
                const host = this.getUrl(text);
                if (this.validateAndParseUrl(host).valid) {
                    return undefined;
                } else {
                    return localize("createNewConnection.invalidzosURL", "Please enter a valid host URL in the format 'company.com'.");
                }
            },
        };
        zosURL = await Gui.showInputBox(options);

        let hostName: string;
        if (!zosURL) {
            return undefined;
        } else {
            hostName = this.getUrl(zosURL);
        }

        return this.validateAndParseUrl(hostName);
    }

    private getUrl(host: string): string {
        let url: string;
        if (host.includes(":")) {
            if (host.includes("/")) {
                url = host;
            } else {
                url = `https://${host}`;
            }
        } else {
            url = `https://${host}`;
        }
        return url;
    }

    private async portInfo(input: string, schema: {}) {
        let options: vscode.InputBoxOptions;
        let port: number;
        if (schema[input].optionDefinition.hasOwnProperty("defaultValue")) {
            options = {
                prompt: schema[input].optionDefinition.description.toString(),
                value: schema[input].optionDefinition.defaultValue.toString(),
            };
        } else {
            options = {
                placeHolder: localize("createNewConnection.option.prompt.port.placeholder", "Port Number"),
                prompt: schema[input].optionDefinition.description.toString(),
            };
        }
        port = Number(await Gui.showInputBox(options));

        if (port === 0 && schema[input].optionDefinition.hasOwnProperty("defaultValue")) {
            port = Number(schema[input].optionDefinition.defaultValue.toString());
        } else {
            return port;
        }
        return port;
    }

    private async userInfo(input?) {
        let userName: string;

        if (input) {
            userName = input;
        }
        InputBoxOptions = {
            placeHolder: localize("createNewConnection.option.prompt.username.placeholder", "User Name"),
            prompt: localize("createNewConnection.option.prompt.username", "Enter the user name for the connection. Leave blank to not store."),
            ignoreFocusOut: true,
            value: userName,
        };
        userName = await Gui.showInputBox(InputBoxOptions);

        if (userName === undefined) {
            Gui.showMessage(localize("createNewConnection.undefined.passWord", "Operation Cancelled"));
            return undefined;
        }

        return userName.trim();
    }

    private async passwordInfo(input?) {
        let passWord: string;

        if (input) {
            passWord = input;
        }

        InputBoxOptions = {
            placeHolder: localize("createNewConnection.option.prompt.password.placeholder", "Password"),
            prompt: localize("createNewConnection.option.prompt.password", "Enter the password for the connection. Leave blank to not store."),
            password: true,
            ignoreFocusOut: true,
            value: passWord,
        };
        passWord = await Gui.showInputBox(InputBoxOptions);

        if (passWord === undefined) {
            Gui.showMessage(localize("createNewConnection.undefined.passWord", "Operation Cancelled"));
            return undefined;
        }

        return passWord.trim();
    }

    private async ruInfo(input?) {
        let rejectUnauthorize: boolean;
        let placeholder: string;
        let selectRU: string[];
        const falseString = localize("createNewConnection.ru.false", "False - Accept connections with self-signed certificates");
        const trueString = localize("createNewConnection.ru.true", "True - Reject connections with self-signed certificates");

        if (input !== undefined) {
            rejectUnauthorize = input;
            if (!input) {
                placeholder = falseString;
                selectRU = [falseString, trueString];
            } else {
                placeholder = trueString;
                selectRU = [trueString, falseString];
            }
        } else {
            placeholder = localize("createNewConnection.option.prompt.ru.placeholder", "Reject Unauthorized Connections");
            selectRU = [trueString, falseString];
        }

        const quickPickOptions: vscode.QuickPickOptions = {
            placeHolder: placeholder,
            ignoreFocusOut: true,
            canPickMany: false,
        };

        const ruOptions = Array.from(selectRU);

        const chosenRU = await Gui.showQuickPick(ruOptions, quickPickOptions);

        if (chosenRU && chosenRU.includes(trueString)) {
            rejectUnauthorize = true;
        } else if (chosenRU && chosenRU.includes(falseString)) {
            rejectUnauthorize = false;
        } else {
            Gui.showMessage(localize("createNewConnection.rejectUnauthorize", "Operation Cancelled"));
            return undefined;
        }

        return rejectUnauthorize;
    }

    private async boolInfo(input: string, schema: {}) {
        let isTrue: boolean;
        const description: string = schema[input].optionDefinition.description.toString();
        const quickPickBooleanOptions: vscode.QuickPickOptions = {
            placeHolder: description,
            ignoreFocusOut: true,
            canPickMany: false,
        };
        const selectBoolean = ["True", "False"];
        const chosenValue = await Gui.showQuickPick(selectBoolean, quickPickBooleanOptions);
        if (chosenValue === selectBoolean[0]) {
            isTrue = true;
        } else if (chosenValue === selectBoolean[1]) {
            isTrue = false;
        } else {
            return undefined;
        }
        return isTrue;
    }

    private async optionsValue(value: string, schema: {}, input?: string): Promise<vscode.InputBoxOptions> {
        let options: vscode.InputBoxOptions;
        const description: string = schema[value].optionDefinition.description.toString();
        let editValue: any;

        if (input !== undefined) {
            editValue = input;
            options = {
                prompt: description,
                value: editValue,
            };
        } else if (schema[value].optionDefinition.hasOwnProperty("defaultValue")) {
            options = {
                prompt: description,
                value: schema[value].optionDefinition.defaultValue,
            };
        } else {
            options = {
                placeHolder: description,
                prompt: description,
            };
        }
        return options;
    }

    private async checkType(input?): Promise<string> {
        const isTrue = Array.isArray(input);
        let test: string;
        let index: number;
        if (isTrue) {
            if (input.includes("boolean")) {
                index = input.indexOf("boolean");
                test = input[index];
                return test;
            }
            if (input.includes("number")) {
                index = input.indexOf("number");
                test = input[index];
                return test;
            }
            if (input.includes("string")) {
                index = input.indexOf("string");
                test = input[index];
                return test;
            }
        } else {
            test = input;
        }
        return test;
    }

    /**
     * Functions that Calls Get CLI Profile Manager, v1 profile specific.
     * @param updProfileInfo
     * @param rePrompt
     * @returns
     */

    private async updateProfile(updProfileInfo, rePrompt?: boolean) {
        if (zowe.imperative.ImperativeConfig.instance.config?.exists) {
            return;
        }
        if (updProfileInfo.type !== undefined) {
            const profileManager = this.getCliProfileManager(updProfileInfo.type);
            this.loadedProfile = await profileManager.load({
                name: updProfileInfo.name,
            });
        } else {
            for (const type of ZoweExplorerApiRegister.getInstance().registeredApiTypes()) {
                const profileManager = this.getCliProfileManager(type);
                this.loadedProfile = await profileManager.load({
                    name: updProfileInfo.name,
                });
            }
        }

        // use direct load since merging was done previously during initialization
        const OrigProfileInfo = (await this.directLoad(this.loadedProfile.type, this.loadedProfile.name)).profile;
        const NewProfileInfo = updProfileInfo.profile;

        // Update the currently-loaded profile with the new info
        const profileArray = Object.keys(this.loadedProfile.profile);
        for (const value of profileArray) {
            if ((value === "encoding" || value === "responseTimeout") && NewProfileInfo[value] === 0) {
                // If the updated profile had these fields set to 0, delete them...
                // this should get rid of a bad value that was stored
                // in these properties before this update
                delete OrigProfileInfo[value];
            } else if (NewProfileInfo[value] !== undefined && NewProfileInfo[value] !== "") {
                if (value === "user" || value === "password") {
                    if (!rePrompt) {
                        OrigProfileInfo.user = NewProfileInfo.user;
                        OrigProfileInfo.password = NewProfileInfo.password;
                    }
                } else {
                    OrigProfileInfo[value] = NewProfileInfo[value];
                }
            } else if (NewProfileInfo[value] === undefined || NewProfileInfo[value] === "") {
                // If the updated profile had an empty property, delete it...
                // this should get rid of any empty strings
                // that were stored in the profile before this update
                delete OrigProfileInfo[value];
            }
        }

        const updateParms: zowe.imperative.IUpdateProfile = {
            name: this.loadedProfile.name,
            merge: false,
            profile: OrigProfileInfo as zowe.imperative.IProfile,
        };
        try {
            this.getCliProfileManager(this.loadedProfile.type).update(updateParms);
        } catch (error) {
            this.log.error(error);
            Gui.errorMessage(error.message);
        }
    }

    // Temporary solution for handling unsecure profiles until CLI team's work is made
    // Remove secure properties and set autoStore to false when vscode setting is true
    private createNonSecureProfile(newConfig: zowe.imperative.IConfig): void {
        const isSecureCredsEnabled: boolean = SettingsConfig.getDirectValue(globals.SETTINGS_SECURE_CREDENTIALS_ENABLED);
        if (!isSecureCredsEnabled) {
            for (const profile of Object.entries(newConfig.profiles)) {
                delete newConfig.profiles[profile[0]].secure;
            }
            newConfig.autoStore = false;
        }
    }
}
