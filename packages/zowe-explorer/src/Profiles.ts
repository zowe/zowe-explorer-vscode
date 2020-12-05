/*
 * This program and the accompanying materials are made available under the terms of the *
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at *
 * https://www.eclipse.org/legal/epl-v20.html                                      *
 *                                                                                 *
 * SPDX-License-Identifier: EPL-2.0                                                *
 *                                                                                 *
 * Copyright Contributors to the Zowe Project.                                     *
 *                                                                                 *
 */

import {
    IProfileLoaded,
    Logger,
    ISession,
    IUpdateProfileFromCliArgs,
    ICommandArguments,
    Session,
    SessConstants,
    IUpdateProfile,
    IProfile,
} from "@zowe/imperative";
import * as vscode from "vscode";
import * as zowe from "@zowe/cli";
import {
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
} from "@zowe/zowe-explorer-api";
import { errorHandling, FilterDescriptor, FilterItem, resolveQuickPickHelper, isTheia } from "./utils/ProfilesUtils";
import { ZoweExplorerApiRegister } from "./ZoweExplorerApiRegister";

import * as nls from "vscode-nls";

// TODO: find a home for constants
export const CONTEXT_PREFIX = "_";
const VALIDATE_SUFFIX = CONTEXT_PREFIX + "validate=";

// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();
let InputBoxOptions: vscode.InputBoxOptions;

export class Profiles extends ProfilesCache {
    // Processing stops if there are no profiles detected
    public static async createInstance(log: Logger): Promise<Profiles> {
        Profiles.loader = new Profiles(log);
        await Profiles.loader.refresh(ZoweExplorerApiRegister.getInstance());
        return Profiles.loader;
    }

    public static getInstance(): Profiles {
        return Profiles.loader;
    }

    private static loader: Profiles;

    public loadedProfile: IProfileLoaded;
    public validProfile: ValidProfileEnum = ValidProfileEnum.INVALID;
    private dsSchema: string = "Zowe-DS-Persistent";
    private ussSchema: string = "Zowe-USS-Persistent";
    private jobsSchema: string = "Zowe-Jobs-Persistent";
    private usrNme: string;
    private passWrd: string;
    private baseEncd: string;
    public constructor(log: Logger) {
        super(log);
    }

    public async checkCurrentProfile(theProfile: IProfileLoaded) {
        const profileStatus: IProfileValidation = await this.getProfileSetting(theProfile);
        if (profileStatus.status === "inactive") {
            this.validProfile = ValidProfileEnum.INVALID;
            return profileStatus;
        }

        // if (profileStatus.status === "unverified") {
        //     this.validProfile = ValidProfileEnum.UNVERIFIED;
        //     return profileStatus;
        // }

        // This step is for prompting of credentials. It will be triggered if it meets the following conditions:
        // - The service does not have username or password and base profile doesn't exists
        // - The service does not have username or password and the base profile has a different host and port
        const baseProfile = this.getBaseProfile();

        if (
            (!theProfile.profile.tokenType && (!theProfile.profile.user || !theProfile.profile.password)) ||
            (baseProfile &&
                baseProfile.profile.host !== theProfile.profile.host &&
                baseProfile.profile.port !== theProfile.profile.port)
        ) {
            try {
                const values = await Profiles.getInstance().promptCredentials(theProfile.name);
                if (values !== undefined) {
                    this.usrNme = values[0];
                    this.passWrd = values[1];
                    this.baseEncd = values[2];
                }
            } catch (error) {
                errorHandling(
                    error,
                    theProfile.name,
                    localize("checkCurrentProfile.error", "Error encountered in ") +
                        `checkCurrentProfile.optionalProfiles!`
                );
                return profileStatus;
            }
            if (this.usrNme !== undefined && this.passWrd !== undefined && this.baseEncd !== undefined) {
                theProfile.profile.user = this.usrNme;
                theProfile.profile.password = this.passWrd;
                theProfile.profile.base64EncodedAuth = this.baseEncd;
                if (profileStatus.status === "unverified") {
                    this.validProfile = ValidProfileEnum.UNVERIFIED;
                } else {
                    this.validProfile = ValidProfileEnum.VALID;
                }
                return profileStatus;
            } else {
                // return invalid if credentials are not provided
                if (profileStatus.status === "unverified") {
                    this.validProfile = ValidProfileEnum.UNVERIFIED;
                } else {
                    this.validProfile = ValidProfileEnum.INVALID;
                }
                return profileStatus;
            }
        } else {
            if (profileStatus.status === "unverified") {
                this.validProfile = ValidProfileEnum.UNVERIFIED;
            } else {
                this.validProfile = ValidProfileEnum.VALID;
            }
            return profileStatus;
        }
    }

    public async getProfileSetting(theProfile: IProfileLoaded): Promise<IProfileValidation> {
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
        const theProfile: IProfileLoaded = node.getProfile();
        this.validationArraySetup(theProfile, false);
        if (node.contextValue.includes(`${VALIDATE_SUFFIX}true`)) {
            node.contextValue = node.contextValue
                .replace(/(_validate=true)/g, "")
                .replace(/(_Active)/g, "")
                .replace(/(_Inactive)/g, "");
            node.contextValue = node.contextValue + `${VALIDATE_SUFFIX}false`;
        } else if (node.contextValue.includes(`${VALIDATE_SUFFIX}false`)) {
            return node;
        } else {
            node.contextValue = node.contextValue + `${VALIDATE_SUFFIX}false`;
        }
        return node;
    }

    public async enableValidation(node: IZoweNodeType): Promise<IZoweNodeType> {
        this.enableValidationContext(node);
        return node;
    }

    public async enableValidationContext(node: IZoweNodeType) {
        const theProfile: IProfileLoaded = node.getProfile();
        this.validationArraySetup(theProfile, true);
        if (node.contextValue.includes(`${VALIDATE_SUFFIX}false`)) {
            node.contextValue = node.contextValue.replace(/(_validate=false)/g, "").replace(/(_Unverified)/g, "");
            node.contextValue = node.contextValue + `${VALIDATE_SUFFIX}true`;
        } else if (node.contextValue.includes(`${VALIDATE_SUFFIX}true`)) {
            return node;
        } else {
            node.contextValue = node.contextValue + `${VALIDATE_SUFFIX}true`;
        }

        return node;
    }

    public async validationArraySetup(
        theProfile: IProfileLoaded,
        validationSetting: boolean
    ): Promise<IValidationSetting> {
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
        const allProfiles = (await Profiles.getInstance()).allProfiles;
        const createNewProfile = "Create a New Connection to z/OS";
        let chosenProfile: string = "";

        // Get all profiles
        let profileNamesList = allProfiles.map((profile) => {
            return profile.name;
        });
        // Filter to list of the APIs available for current tree explorer
        profileNamesList = profileNamesList.filter((profileName) => {
            const profile = Profiles.getInstance().loadNamedProfile(profileName);
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
        });
        if (profileNamesList) {
            profileNamesList = profileNamesList.filter(
                (profileName) =>
                    // Find all cases where a profile is not already displayed
                    !zoweFileProvider.mSessionNodes.find((sessionNode) => sessionNode.getProfileName() === profileName)
            );
        }
        const createPick = new FilterDescriptor("\uFF0B " + createNewProfile);
        const items: vscode.QuickPickItem[] = profileNamesList.map((element) => new FilterItem(element));
        const quickpick = vscode.window.createQuickPick();
        const placeholder = localize(
            "addSession.quickPickOption",
            'Choose "Create new..." to define a new profile or select an existing profile to Add to the USS Explorer'
        );

        if (isTheia()) {
            const options: vscode.QuickPickOptions = {
                placeHolder: placeholder,
            };
            // get user selection
            const choice = await vscode.window.showQuickPick([createPick, ...items], options);
            if (!choice) {
                vscode.window.showInformationMessage(localize("enterPattern.pattern", "No selection made."));
                return;
            }
            chosenProfile = choice === createPick ? "" : choice.label;
        } else {
            quickpick.items = [createPick, ...items];
            quickpick.placeholder = placeholder;
            quickpick.ignoreFocusOut = true;
            quickpick.show();
            const choice = await resolveQuickPickHelper(quickpick);
            quickpick.hide();
            if (!choice) {
                vscode.window.showInformationMessage(localize("enterPattern.pattern", "No selection made."));
                return;
            }
            if (choice instanceof FilterDescriptor) {
                chosenProfile = "";
            } else {
                chosenProfile = choice.label;
            }
        }

        if (chosenProfile === "") {
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
            profileName = await vscode.window.showInputBox(options);
            if (!profileName) {
                vscode.window.showInformationMessage(
                    localize(
                        "createNewConnection.enterprofileName",
                        "Profile Name was not supplied. Operation Cancelled"
                    )
                );
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
        } else if (chosenProfile) {
            this.log.debug(
                localize("createZoweSession.log.debug.selectProfile", "User selected profile ") + chosenProfile
            );
            await zoweFileProvider.addSession(chosenProfile);
        } else {
            this.log.debug(
                localize("createZoweSession.log.debug.cancelledSelection", "User cancelled profile selection")
            );
        }
    }

    public async editSession(profileLoaded: IProfileLoaded, profileName: string): Promise<any | undefined> {
        const editSession = profileLoaded.profile;
        const editURL = editSession.host + ":" + editSession.port;
        const editUser = editSession.user;
        const editPass = editSession.password;
        const editrej = editSession.rejectUnauthorized;
        let updUser: string;
        let updPass: string;
        let updRU: boolean;
        let updPort: number;
        let updUrl: any;

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
                        vscode.window.showInformationMessage(
                            localize("createNewConnection.zosmfURL", "No valid value for z/OS URL. Operation Cancelled")
                        );
                        return undefined;
                    }
                    updSchemaValues[value] = updUrl.host;
                    if (updUrl.port !== 0) {
                        updSchemaValues.port = updUrl.port;
                    } else if (editSession.port === Number("443")) {
                        updSchemaValues.port = editSession.port;
                    }
                    break;
                case "port":
                    if (updSchemaValues[value] === undefined) {
                        updPort = await this.portInfo(value, schema);
                        if (Number.isNaN(updPort)) {
                            vscode.window.showInformationMessage(
                                localize(
                                    "createNewConnection.undefined.port",
                                    "Invalid Port number provided or operation was cancelled"
                                )
                            );
                            return undefined;
                        }
                        updSchemaValues[value] = updPort;
                        break;
                    }
                    break;
                case "user":
                    updUser = await this.userInfo(editUser);
                    if (updUser === undefined) {
                        vscode.window.showInformationMessage(
                            localize("createNewConnection.undefined.username", "Operation Cancelled")
                        );
                        return undefined;
                    }
                    updSchemaValues[value] = updUser;
                    break;
                case "password":
                    updPass = await this.passwordInfo(editPass);
                    if (updPass === undefined) {
                        vscode.window.showInformationMessage(
                            localize("createNewConnection.undefined.username", "Operation Cancelled")
                        );
                        return undefined;
                    }
                    updSchemaValues[value] = updPass;
                    break;
                case "rejectUnauthorized":
                    updRU = await this.ruInfo(editrej);
                    if (updRU === undefined) {
                        vscode.window.showInformationMessage(
                            localize("createNewConnection.rejectUnauthorize", "Operation Cancelled")
                        );
                        return undefined;
                    }
                    updSchemaValues[value] = updRU;
                    break;
                default:
                    let options: vscode.InputBoxOptions;
                    const response = await this.checkType(schema[value].type);
                    switch (response) {
                        case "number":
                            options = await this.optionsValue(value, schema, editSession[value]);
                            const updValue = await vscode.window.showInputBox(options);
                            if (!Number.isNaN(Number(updValue))) {
                                updSchemaValues[value] = Number(updValue);
                            } else {
                                if (schema[value].optionDefinition.hasOwnProperty("defaultValue")) {
                                    updSchemaValues[value] = schema[value].optionDefinition.defaultValue;
                                } else {
                                    break;
                                }
                            }
                            break;
                        case "boolean":
                            let updIsTrue: boolean;
                            updIsTrue = await this.boolInfo(value, schema);
                            if (updIsTrue === undefined) {
                                vscode.window.showInformationMessage(
                                    localize("createNewConnection.booleanValue", "Operation Cancelled")
                                );
                                return undefined;
                            }
                            updSchemaValues[value] = updIsTrue;
                            break;
                        default:
                            options = await this.optionsValue(value, schema, editSession[value]);
                            const updDefValue = await vscode.window.showInputBox(options);
                            if (updDefValue === "") {
                                break;
                            }
                            updSchemaValues[value] = updDefValue;
                            break;
                    }
            }
        }

        try {
            const updSession = await zowe.ZosmfSession.createBasicZosmfSession(updSchemaValues);
            updSchemaValues.base64EncodedAuth = updSession.ISession.base64EncodedAuth;
            await this.updateProfile({
                profile: updSchemaValues,
                name: profileName,
                type: profileLoaded.type,
            });
            vscode.window.showInformationMessage(
                localize("editConnection.success", "Profile was successfully updated")
            );

            return updSchemaValues;
        } catch (error) {
            await errorHandling(error.message);
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
            profileType = await vscode.window.showQuickPick(typeOptions, quickPickTypeOptions);
        }
        return profileType;
    }

    public async createNewConnection(profileName: string, requestedProfileType?: string): Promise<string | undefined> {
        let newUser: string;
        let newPass: string;
        let newRU: boolean;
        let newUrl: any;
        let newPort: number;

        const newProfileName = profileName.trim();

        if (newProfileName === undefined || newProfileName === "") {
            vscode.window.showInformationMessage(
                localize("createNewConnection.profileName", "Profile name was not supplied. Operation Cancelled")
            );
            return undefined;
        }

        const profileType = requestedProfileType ? requestedProfileType : await this.getProfileType();
        if (profileType === undefined) {
            vscode.window.showInformationMessage(
                localize("createNewConnection.profileType", "No profile type was chosen. Operation Cancelled")
            );
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
                        vscode.window.showInformationMessage(
                            localize("createNewConnection.zosmfURL", "No valid value for z/OS URL. Operation Cancelled")
                        );
                        return undefined;
                    }
                    schemaValues[value] = newUrl.host;
                    if (newUrl.port !== 0) {
                        schemaValues.port = newUrl.port;
                    }
                    break;
                case "port":
                    if (schemaValues[value] === undefined) {
                        newPort = await this.portInfo(value, schema);
                        if (Number.isNaN(newPort)) {
                            vscode.window.showInformationMessage(
                                localize(
                                    "createNewConnection.undefined.port",
                                    "Invalid Port number provided or operation was cancelled"
                                )
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
                        vscode.window.showInformationMessage(
                            localize("createNewConnection.undefined.username", "Operation Cancelled")
                        );
                        return undefined;
                    }
                    schemaValues[value] = newUser;
                    break;
                case "password":
                    newPass = await this.passwordInfo();
                    if (newPass === undefined) {
                        vscode.window.showInformationMessage(
                            localize("createNewConnection.undefined.username", "Operation Cancelled")
                        );
                        return undefined;
                    }
                    schemaValues[value] = newPass;
                    break;
                case "rejectUnauthorized":
                    newRU = await this.ruInfo();
                    if (newRU === undefined) {
                        vscode.window.showInformationMessage(
                            localize("createNewConnection.rejectUnauthorize", "Operation Cancelled")
                        );
                        return undefined;
                    }
                    schemaValues[value] = newRU;
                    break;
                default:
                    let options: vscode.InputBoxOptions;
                    const response = await this.checkType(schema[value].type);
                    switch (response) {
                        case "number":
                            options = await this.optionsValue(value, schema);
                            const enteredValue = await vscode.window.showInputBox(options);
                            if (!Number.isNaN(Number(enteredValue))) {
                                schemaValues[value] = Number(enteredValue);
                            } else {
                                if (schema[value].optionDefinition.hasOwnProperty("defaultValue")) {
                                    schemaValues[value] = schema[value].optionDefinition.defaultValue;
                                } else {
                                    schemaValues[value] = undefined;
                                }
                            }
                            break;
                        case "boolean":
                            let isTrue: boolean;
                            isTrue = await this.boolInfo(value, schema);
                            if (isTrue === undefined) {
                                vscode.window.showInformationMessage(
                                    localize("createNewConnection.booleanValue", "Operation Cancelled")
                                );
                                return undefined;
                            }
                            schemaValues[value] = isTrue;
                            break;
                        default:
                            options = await this.optionsValue(value, schema);
                            const defValue = await vscode.window.showInputBox(options);
                            if (defValue === "") {
                                break;
                            }
                            schemaValues[value] = defValue;
                            break;
                    }
            }
        }

        try {
            for (const profile of this.allProfiles) {
                if (profile.name.toLowerCase() === profileName.toLowerCase()) {
                    vscode.window.showErrorMessage(
                        localize(
                            "createNewConnection.duplicateProfileName",
                            "Profile name already exists. Please create a profile using a different name"
                        )
                    );
                    return undefined;
                }
            }
            await this.saveProfile(schemaValues, schemaValues.name, profileType);
            vscode.window.showInformationMessage("Profile " + newProfileName + " was created.");
            return newProfileName;
        } catch (error) {
            await errorHandling(error.message);
        }
    }

    public async promptCredentials(sessName, rePrompt?: boolean) {
        let repromptUser: string;
        let repromptPass: string;
        let loadProfile: IProfileLoaded;
        let loadSession: ISession;
        let newUser: string;
        let newPass: string;

        try {
            loadProfile = this.loadNamedProfile(sessName.trim());
            loadSession = loadProfile.profile as ISession;
        } catch (error) {
            await errorHandling(error.message);
        }

        if (rePrompt) {
            repromptUser = loadSession.user;
            repromptPass = loadSession.password;
        }

        if (!loadSession.user || rePrompt) {
            newUser = await this.userInfo(repromptUser);
            loadSession.user = loadProfile.profile.user = newUser;
        } else {
            newUser = loadSession.user = loadProfile.profile.user;
        }

        if (newUser === undefined) {
            vscode.window.showInformationMessage(
                localize("promptCredentials.undefined.username", "Operation Cancelled")
            );
            await this.refresh(ZoweExplorerApiRegister.getInstance());
            return undefined;
        } else {
            if (!loadSession.password || rePrompt) {
                newPass = await this.passwordInfo(repromptPass);
                loadSession.password = loadProfile.profile.password = newPass;
            } else {
                newPass = loadSession.password = loadProfile.profile.password;
            }
        }

        if (newPass === undefined) {
            vscode.window.showInformationMessage(
                localize("promptCredentials.undefined.password", "Operation Cancelled")
            );
            await this.refresh(ZoweExplorerApiRegister.getInstance());
            return undefined;
        } else {
            try {
                const updSession = await ZoweExplorerApiRegister.getMvsApi(loadProfile).getSession();
                if (rePrompt) {
                    const saveButton = localize("promptCredentials.saveCredentials.button", "Save Credentials");
                    const doNotSaveButton = localize("promptCredentials.doNotSave.button", "Do Not Save");
                    const infoMsg = localize(
                        "promptCredentials.saveCredentials.infoMessage",
                        "Save entered credentials for future use with profile: {0}? Saving credentials will update the local yaml file.",
                        loadProfile.name
                    );
                    await vscode.window
                        .showInformationMessage(infoMsg, ...[saveButton, doNotSaveButton])
                        .then((selection) => {
                            if (selection === saveButton) {
                                rePrompt = false;
                            }
                        });
                    await this.updateProfile(loadProfile, rePrompt);
                }
                return [updSession.ISession.user, updSession.ISession.password, updSession.ISession.base64EncodedAuth];
            } catch (error) {
                await errorHandling(error.message);
            }
        }
    }

    public async getDeleteProfile() {
        const allProfiles: IProfileLoaded[] = this.allProfiles;
        const profileNamesList = allProfiles.map((temprofile) => {
            return temprofile.name;
        });

        if (!profileNamesList.length) {
            vscode.window.showInformationMessage(localize("deleteProfile.noProfilesLoaded", "No profiles available"));
            return;
        }

        const quickPickList: vscode.QuickPickOptions = {
            placeHolder: localize("deleteProfile.quickPickOption", "Select the profile you want to delete"),
            ignoreFocusOut: true,
            canPickMany: false,
        };
        const sesName = await vscode.window.showQuickPick(profileNamesList, quickPickList);

        if (sesName === undefined) {
            vscode.window.showInformationMessage(
                localize("deleteProfile.undefined.profilename", "Operation Cancelled")
            );
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
        let deletedProfile: IProfileLoaded;
        if (!node) {
            deletedProfile = await this.getDeleteProfile();
        } else {
            deletedProfile = node.getProfile();
        }
        if (!deletedProfile) {
            return;
        }
        deleteLabel = deletedProfile.name;

        const deleteSuccess = await this.deletePrompt(deletedProfile);
        if (!deleteSuccess) {
            vscode.window.showInformationMessage(localize("deleteProfile.noSelected", "Operation Cancelled"));
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
            ...vscode.workspace.getConfiguration().get(this.dsSchema),
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
        await vscode.workspace.getConfiguration().update(this.dsSchema, dsSetting, vscode.ConfigurationTarget.Global);

        // Delete from USS Sessions list
        const ussSetting: any = {
            ...vscode.workspace.getConfiguration().get(this.ussSchema),
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
        await vscode.workspace.getConfiguration().update(this.ussSchema, ussSetting, vscode.ConfigurationTarget.Global);

        // Delete from Jobs Sessions list
        const jobsSetting: any = {
            ...vscode.workspace.getConfiguration().get(this.jobsSchema),
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
        await vscode.workspace
            .getConfiguration()
            .update(this.jobsSchema, jobsSetting, vscode.ConfigurationTarget.Global);

        // Remove from list of all profiles
        const index = this.allProfiles.findIndex((deleteItem) => {
            return deleteItem === deletedProfile;
        });
        if (index >= 0) {
            this.allProfiles.splice(index, 1);
        }
    }

    public async validateProfiles(theProfile: IProfileLoaded) {
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
                    profileStatus = await vscode.window.withProgress(
                        {
                            location: vscode.ProgressLocation.Notification,
                            title: localize(
                                "Profiles.validateProfiles.validationProgress",
                                "Validating {0} Profile.",
                                theProfile.name
                            ),
                            cancellable: true,
                        },
                        async (progress, token) => {
                            token.onCancellationRequested(() => {
                                // will be returned as undefined
                                vscode.window.showInformationMessage(
                                    localize(
                                        "Profiles.validateProfiles.validationCancelled",
                                        "Validating {0} was cancelled.",
                                        theProfile.name
                                    )
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
                // tslint:disable-next-line: no-magic-numbers
                if (error.errorCode === 401) {
                    await errorHandling(error, theProfile.name);
                }

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

    public async getCombinedProfile(serviceProfile: IProfileLoaded, baseProfile: IProfileLoaded) {
        // TODO: This needs to be improved
        // The idea is to handle all type of ZE Profiles
        const commonApi = ZoweExplorerApiRegister.getInstance().getCommonApi(serviceProfile);

        // This check will handle service profiles that have username and password
        if (serviceProfile.profile.user && serviceProfile.profile.password) {
            return serviceProfile;
        }

        // This check is for optional credentials
        if (
            baseProfile &&
            serviceProfile.profile.host &&
            serviceProfile.profile.port &&
            baseProfile.profile.host !== serviceProfile.profile.host &&
            baseProfile.profile.port !== serviceProfile.profile.port
        ) {
            return serviceProfile;
        }

        let session;
        if (!commonApi.getSessionFromCommandArgument) {
            // This is here for extenders
            session = ZoweExplorerApiRegister.getInstance().getCommonApi(serviceProfile).getSession(serviceProfile);
        } else {
            // This process combines the information from baseprofile to serviceprofile and create a new session
            const profSchema = this.getSchema(serviceProfile.type);
            const cmdArgs: ICommandArguments = {
                $0: "zowe",
                _: [""],
            };
            for (const prop of Object.keys(profSchema)) {
                cmdArgs[prop] = serviceProfile.profile[prop] ? serviceProfile.profile[prop] : baseProfile.profile[prop];
            }
            if (baseProfile) {
                cmdArgs.tokenType = serviceProfile.profile.tokenType
                    ? serviceProfile.profile.tokenType
                    : baseProfile.profile.tokenType;
                cmdArgs.tokenValue = serviceProfile.profile.tokenValue
                    ? serviceProfile.profile.tokenValue
                    : baseProfile.profile.tokenValue;
            }
            if (commonApi.getSessionFromCommandArgument) {
                if (cmdArgs.tokenType === undefined || cmdArgs.tokenValue === undefined) {
                    this.log.debug(
                        localize(
                            "getCombinedProfile.noToken",
                            "Profile {0} {1} is not authorized. Please check the connection and try again.",
                            baseProfile.name,
                            serviceProfile.name
                        )
                    );
                    session = baseProfile.profile;
                } else {
                    const res = await commonApi.getSessionFromCommandArgument(cmdArgs);
                    session = res.ISession;
                }
            } else {
                vscode.window.showErrorMessage(
                    localize("getCombinedProfile.log.debug", "This extension does not support base profiles.")
                );
            }
        }

        // For easier debugging, move serviceProfile to updatedServiceProfile and then update it with combinedProfile
        const updatedServiceProfile: IProfileLoaded = serviceProfile;
        for (const prop of Object.keys(session)) {
            if (prop === "hostname") {
                updatedServiceProfile.profile.host = session[prop];
            } else {
                updatedServiceProfile.profile[prop] = session[prop];
            }
        }
        return updatedServiceProfile;
    }

    public async ssoLogin(node?: IZoweNodeType, label?: string): Promise<void> {
        const baseProfile = this.getBaseProfile();
        let serviceProfile: IProfileLoaded;
        if (node) {
            serviceProfile = node.getProfile();
        } else {
            serviceProfile = this.loadNamedProfile(label.trim());
        }

        // Skip if there is no base profile
        if (!baseProfile) {
            vscode.window.showInformationMessage(localize("ssoLogin.noBase", "This profile does not support login."));
            return;
        }

        // This check will handle service profiles that have username and password
        if (serviceProfile.profile.user && serviceProfile.profile.password) {
            vscode.window.showInformationMessage(localize("ssoLogin.noBase", "This profile does not support login."));
            return;
        }

        // This check is for optional credentials
        if (
            baseProfile &&
            serviceProfile.profile.host &&
            serviceProfile.profile.port &&
            ((baseProfile.profile.host !== serviceProfile.profile.host &&
                baseProfile.profile.port !== serviceProfile.profile.port) ||
                (baseProfile.profile.host === serviceProfile.profile.host &&
                    baseProfile.profile.port !== serviceProfile.profile.port))
        ) {
            vscode.window.showInformationMessage(localize("ssoLogin.noBase", "This profile does not support login."));
            return;
        }

        let newUser: string;
        let newPass: string;

        if (baseProfile) {
            newUser = await this.userInfo();
            if (newUser === undefined) {
                vscode.window.showInformationMessage(localize("ssoLogin.undefined.username", "Operation Cancelled"));
                return;
            } else {
                newPass = await this.passwordInfo();
                if (newPass === undefined) {
                    vscode.window.showInformationMessage(
                        localize("ssoLogin.undefined.username", "Operation Cancelled")
                    );
                    return;
                }
            }

            try {
                const combinedProfile = await Profiles.getInstance().getCombinedProfile(serviceProfile, baseProfile);
                const loginTokenType = ZoweExplorerApiRegister.getInstance()
                    .getCommonApi(serviceProfile)
                    .getTokenTypeName();
                const updSession = new Session({
                    hostname: combinedProfile.profile.host,
                    port: combinedProfile.profile.port,
                    user: newUser,
                    password: newPass,
                    rejectUnauthorized: combinedProfile.profile.rejectUnauthorized,
                    tokenType: loginTokenType,
                    type: SessConstants.AUTH_TYPE_TOKEN,
                });
                const loginToken = await ZoweExplorerApiRegister.getInstance()
                    .getCommonApi(serviceProfile)
                    .login(updSession);
                const profileManager = Profiles.getInstance().getCliProfileManager(baseProfile.type);
                const updBaseProfile: IProfile = {
                    tokenType: loginTokenType,
                    tokenValue: loginToken,
                };

                const updateParms: IUpdateProfile = {
                    name: baseProfile.name,
                    merge: true,
                    profile: updBaseProfile,
                };

                try {
                    await profileManager.update(updateParms);
                } catch (error) {
                    vscode.window.showErrorMessage(
                        localize("ssoLogin.unableToLogin", "Unable to log in. ") + error.message
                    );
                    return;
                }
                vscode.window.showInformationMessage(
                    localize("ssoLogin.successful", "Login to authentication service was successful.")
                );
                this.allProfiles = this.allProfiles.map((item) => {
                    item.profile.tokenValue = loginToken;
                    return item;
                });
            } catch (error) {
                vscode.window.showErrorMessage(
                    localize("ssoLogin.unableToLogin", "Unable to log in. ") + error.message
                );
                return;
            }
        }
    }

    public async ssoLogout(node: IZoweNodeType): Promise<void> {
        const baseProfile = this.getBaseProfile();
        const serviceProfile = node.getProfile();

        // Skip if there is no base profile
        if (!baseProfile) {
            vscode.window.showInformationMessage(localize("ssoLogout.noBase", "This profile does not support logout."));
            return;
        }

        // This check will handle service profiles that have username and password
        if (serviceProfile.profile.user && serviceProfile.profile.password) {
            vscode.window.showInformationMessage(localize("ssoLogout.noBase", "This profile does not support logout."));
            return;
        }

        // This check is for optional credentials
        if (
            baseProfile &&
            serviceProfile.profile.host &&
            serviceProfile.profile.port &&
            ((baseProfile.profile.host !== serviceProfile.profile.host &&
                baseProfile.profile.port !== serviceProfile.profile.port) ||
                (baseProfile.profile.host === serviceProfile.profile.host &&
                    baseProfile.profile.port !== serviceProfile.profile.port))
        ) {
            vscode.window.showInformationMessage(localize("ssoLogout.noBase", "This profile does not support logout."));
            return;
        }

        try {
            const profiles = Profiles.getInstance();
            const combinedProfile = await profiles.getCombinedProfile(serviceProfile, baseProfile);
            const loginTokenType = ZoweExplorerApiRegister.getInstance()
                .getCommonApi(serviceProfile)
                .getTokenTypeName();
            const updSession = new Session({
                hostname: combinedProfile.profile.host,
                port: combinedProfile.profile.port,
                rejectUnauthorized: combinedProfile.profile.rejectUnauthorized,
                tokenType: loginTokenType,
                type: SessConstants.AUTH_TYPE_TOKEN,
                tokenValue: combinedProfile.profile.tokenValue,
            });
            await ZoweExplorerApiRegister.getInstance().getCommonApi(serviceProfile).logout(updSession);
            vscode.window.showInformationMessage(
                localize("ssoLogout.successful", "Logout from authentication service was successful.")
            );

            try {
                this.getCliProfileManager(baseProfile.type).save({
                    name: baseProfile.name,
                    type: baseProfile.type,
                    overwrite: true,
                    profile: {
                        ...baseProfile.profile,
                        tokenType: undefined,
                        tokenValue: undefined,
                    },
                });
            } catch (error) {
                vscode.window.showErrorMessage(error.message);
            }
        } catch (error) {
            vscode.window.showErrorMessage(localize("ssoLogout.unableToLogout", "Unable to log out. ") + error.message);
            return;
        }
    }

    private async deletePrompt(deletedProfile: IProfileLoaded) {
        const profileName = deletedProfile.name;
        this.log.debug(localize("deleteProfile.log.debug", "Deleting profile ") + profileName);
        const quickPickOptions: vscode.QuickPickOptions = {
            placeHolder: localize(
                "deleteProfile.quickPickOption",
                "Delete {0}? This will permanently remove it from your system.",
                profileName
            ),
            ignoreFocusOut: true,
            canPickMany: false,
        };
        // confirm that the user really wants to delete
        if (
            (await vscode.window.showQuickPick(
                [
                    localize("deleteProfile.showQuickPick.delete", "Delete"),
                    localize("deleteProfile.showQuickPick.cancel", "Cancel"),
                ],
                quickPickOptions
            )) !== localize("deleteProfile.showQuickPick.delete", "Delete")
        ) {
            this.log.debug(
                localize("deleteProfile.showQuickPick.log.debug", "User picked Cancel. Cancelling delete of profile")
            );
            return;
        }

        try {
            await this.deleteProfileOnDisk(deletedProfile);
        } catch (error) {
            this.log.error(
                localize("deleteProfile.delete.log.error", "Error encountered when deleting profile! ") +
                    JSON.stringify(error)
            );
            await errorHandling(error, profileName, error.message);
            throw error;
        }

        vscode.window.showInformationMessage(
            localize("deleteProfile.success.info", "Profile {0} was deleted.", profileName)
        );
        return profileName;
    }

    // ** Functions for handling Profile Information */

    private async urlInfo(input?) {
        let zosURL: string;

        const urlInputBox = vscode.window.createInputBox();
        if (input) {
            urlInputBox.value = input;
        }
        urlInputBox.ignoreFocusOut = true;
        urlInputBox.placeholder = localize("createNewConnection.option.prompt.url.placeholder", "https://url:port");
        urlInputBox.prompt = localize(
            "createNewConnection.option.prompt.url",
            "Enter a z/OS URL in the format 'https://url:port'."
        );

        urlInputBox.show();
        zosURL = await this.getUrl(urlInputBox);
        urlInputBox.dispose();

        if (!zosURL) {
            return undefined;
        }

        return this.validateAndParseUrl(zosURL);
    }

    private async getUrl(urlInputBox): Promise<string | undefined> {
        return new Promise<string | undefined>((resolve, reject) => {
            urlInputBox.onDidHide(() => {
                reject(undefined);
                resolve(urlInputBox.value);
            });
            urlInputBox.onDidAccept(() => {
                let host: string;
                if (urlInputBox.value.includes(":")) {
                    if (urlInputBox.value.includes("/")) {
                        host = urlInputBox.value;
                    } else {
                        host = `https://${urlInputBox.value}`;
                    }
                } else {
                    host = `https://${urlInputBox.value}`;
                }

                if (this.validateAndParseUrl(host).valid) {
                    resolve(host);
                } else {
                    urlInputBox.validationMessage = localize(
                        "createNewConnection.invalidzosURL",
                        "Please enter a valid host URL in the format 'company.com'."
                    );
                }
            });
        });
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
        port = Number(await vscode.window.showInputBox(options));

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
            placeHolder: localize("createNewConnection.option.prompt.username.placeholder", "Optional: User Name"),
            prompt: localize(
                "createNewConnection.option.prompt.username",
                "Enter the user name for the connection. Leave blank to not store."
            ),
            value: userName,
        };
        userName = await vscode.window.showInputBox(InputBoxOptions);

        if (userName === undefined) {
            vscode.window.showInformationMessage(
                localize("createNewConnection.undefined.passWord", "Operation Cancelled")
            );
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
            placeHolder: localize("createNewConnection.option.prompt.password.placeholder", "Optional: Password"),
            prompt: localize(
                "createNewConnection.option.prompt.password",
                "Enter the password for the connection. Leave blank to not store."
            ),
            password: true,
            value: passWord,
        };
        passWord = await vscode.window.showInputBox(InputBoxOptions);

        if (passWord === undefined) {
            vscode.window.showInformationMessage(
                localize("createNewConnection.undefined.passWord", "Operation Cancelled")
            );
            return undefined;
        }

        return passWord.trim();
    }

    private async ruInfo(input?) {
        let rejectUnauthorize: boolean;

        if (input !== undefined) {
            rejectUnauthorize = input;
        }

        const quickPickOptions: vscode.QuickPickOptions = {
            placeHolder: localize(
                "createNewConnection.option.prompt.ru.placeholder",
                "Reject Unauthorized Connections"
            ),
            ignoreFocusOut: true,
            canPickMany: false,
        };

        const selectRU = [
            "True - Reject connections with self-signed certificates",
            "False - Accept connections with self-signed certificates",
        ];

        const ruOptions = Array.from(selectRU);

        const chosenRU = await vscode.window.showQuickPick(ruOptions, quickPickOptions);

        if (chosenRU === ruOptions[0]) {
            rejectUnauthorize = true;
        } else if (chosenRU === ruOptions[1]) {
            rejectUnauthorize = false;
        } else {
            vscode.window.showInformationMessage(
                localize("createNewConnection.rejectUnauthorize", "Operation Cancelled")
            );
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
        const chosenValue = await vscode.window.showQuickPick(selectBoolean, quickPickBooleanOptions);
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

    // ** Functions that Calls Get CLI Profile Manager  */

    private async updateProfile(ProfileInfo, rePrompt?: boolean) {
        if (ProfileInfo.type !== undefined) {
            const profileManager = this.getCliProfileManager(ProfileInfo.type);
            this.loadedProfile = await profileManager.load({
                name: ProfileInfo.name,
            });
        } else {
            for (const type of ZoweExplorerApiRegister.getInstance().registeredApiTypes()) {
                const profileManager = this.getCliProfileManager(type);
                this.loadedProfile = await profileManager.load({
                    name: ProfileInfo.name,
                });
            }
        }

        const OrigProfileInfo = this.loadedProfile.profile;
        const NewProfileInfo = ProfileInfo.profile;

        const profileArray = Object.keys(this.loadedProfile.profile);
        for (const value of profileArray) {
            if (value === "user" || value === "password") {
                if (!rePrompt) {
                    OrigProfileInfo.user = NewProfileInfo.user;
                    OrigProfileInfo.password = NewProfileInfo.password;
                }
            } else {
                OrigProfileInfo[value] = NewProfileInfo[value];
            }
        }

        // Using `IUpdateProfileFromCliArgs` here instead of `IUpdateProfile` is
        // kind of a hack, but necessary to support storing secure credentials
        // until this is fixed: https://github.com/zowe/imperative/issues/379
        const updateParms: IUpdateProfileFromCliArgs = {
            name: this.loadedProfile.name,
            merge: true,
            // profile: OrigProfileInfo as IProfile
            args: OrigProfileInfo as any,
        };
        try {
            this.getCliProfileManager(this.loadedProfile.type).update(updateParms);
        } catch (error) {
            vscode.window.showErrorMessage(error.message);
        }
    }
}
