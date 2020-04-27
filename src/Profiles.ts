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

import { IProfileLoaded, Logger, CliProfileManager, IProfile, ISession, IUpdateProfile } from "@zowe/imperative";
import * as path from "path";
import { URL } from "url";
import * as vscode from "vscode";
import * as zowe from "@zowe/cli";
import { ZoweExplorerApiRegister } from "./api/ZoweExplorerApiRegister";
import * as nls from "vscode-nls";
import { errorHandling, getZoweDir } from "./utils";
const localize = nls.config({messageFormat: nls.MessageFormat.file})();

interface IUrlValidator {
    valid: boolean;
    protocol: string;
    host: string;
    port: number;
}

export enum ValidProfileEnum {
    VALID = 0,
    INVALID = -1
}
export class Profiles {
    // Processing stops if there are no profiles detected
    public static async createInstance(log: Logger): Promise<Profiles> {
        Profiles.loader = new Profiles(log);
        await Profiles.loader.refresh();
        return Profiles.loader;
    }

    public static getInstance(): Profiles {
        return Profiles.loader;
    }

    private static loader: Profiles;

    public allProfiles: IProfileLoaded[] = [];
    public loadedProfile: IProfileLoaded;
    public validProfile: ValidProfileEnum = ValidProfileEnum.INVALID;
    private profilesByType = new Map<string, IProfileLoaded[]>();
    private defaultProfileByType = new Map<string, IProfileLoaded>();
    private profileManagerByType= new Map<string, CliProfileManager>();
    private usrNme: string;
    private passWrd: string;
    private baseEncd: string;
    private constructor(private log: Logger) {}

    public async checkCurrentProfile(theProfile: IProfileLoaded) {
        if ((!theProfile.profile.user) || (!theProfile.profile.password)) {
            try {
                const values = await Profiles.getInstance().promptCredentials(theProfile.name);
                if (values !== undefined) {
                    this.usrNme = values[0];
                    this.passWrd = values[1];
                    this.baseEncd = values[2];
                }
            } catch (error) {
                errorHandling(error, theProfile.name,
                    localize("ussNodeActions.error", "Error encountered in ") + `createUSSNodeDialog.optionalProfiles!`);
                return;
            }
            if (this.usrNme !== undefined && this.passWrd !== undefined && this.baseEncd !== undefined) {
                theProfile.profile.user = this.usrNme;
                theProfile.profile.password = this.passWrd;
                theProfile.profile.base64EncodedAuth = this.baseEncd;
                this.validProfile = ValidProfileEnum.VALID;
            } else {
                return;
            }
        } else {
            this.validProfile = ValidProfileEnum.VALID;
        }
    }

    public loadNamedProfile(name: string, type?: string): IProfileLoaded {
        for (const profile of this.allProfiles) {
            if (profile.name === name && (type ? profile.type === type : true)) {
                return profile;
            }
        }
        throw new Error(localize("loadNamedProfile.error.profileName", "Could not find profile named: ")
            + name + localize("loadNamedProfile.error.period", "."));
    }

    public getDefaultProfile(type: string = "zosmf"): IProfileLoaded {
        return this.defaultProfileByType.get(type);
    }

    public getProfiles(type: string = "zosmf"): IProfileLoaded[] {
        return this.profilesByType.get(type);
    }

    public async refresh(): Promise<void> {
        this.allProfiles = [];
        for (const type of ZoweExplorerApiRegister.getInstance().registeredApiTypes()) {
            const profileManager = await this.getCliProfileManager(type);
            const profilesForType = (await profileManager.loadAll()).filter((profile) => {
                return profile.type === type;
            });
            if (profilesForType && profilesForType.length > 0) {
                this.allProfiles.push(...profilesForType);
                this.profilesByType.set(type, profilesForType);
                this.defaultProfileByType.set(type, (await profileManager.load({ loadDefault: true })));
            }
        }
    }

    public parseUrl(newUrl: string): IUrlValidator {
        let url: URL;

        const validationResult: IUrlValidator = {
            valid: false,
            protocol: null,
            host: null,
            port: null
        };

        try {
            url = new URL(newUrl);
        } catch (error) {
            if (validationResult.host === null) {
                vscode.window.showInformationMessage(localize("createNewConnection.zosmfURL",
                        "No valid value for z/OS Host. Operation Cancelled"));
                return undefined;
            } else {
                return validationResult;
            }
        }

        validationResult.protocol = url.protocol;
        validationResult.host = url.hostname;
        validationResult.port = Number(url.port);
        validationResult.valid = true;
        return validationResult;
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
                canPickMany: false
            };
            profileType = await vscode.window.showQuickPick(typeOptions, quickPickTypeOptions);
        }
        return profileType;
    }

    public async getSchema(profileType: string): Promise<{}> {
        const profileManager = await this.getCliProfileManager(profileType);
        const configOptions = Array.from(profileManager.configurations);
        let schema: {};
        for (const val of configOptions) {
            if (val.type === profileType) {
                schema = val.schema.properties;
            }
        }
        return schema;
    }

    public async optionsValue(value: string, schema: {}): Promise<vscode.InputBoxOptions> {
        let options: vscode.InputBoxOptions;
        const description: string = schema[value].optionDefinition.description.toString();
        if (schema[value].optionDefinition.hasOwnProperty("defaultValue")){
            options = {
                prompt: description,
                value: schema[value].optionDefinition.defaultValue
            };
        } else {
            options = {
                placeHolder: description,
                prompt: description
            };
        }
        return options;
    }

    public async createNewConnection(profileName: string): Promise<string | undefined> {
        let profileType: string;
        let userName: string;
        let passWord: string;
        let port: number;
        let rejectUnauthorize: boolean;
        let options: vscode.InputBoxOptions;
        let isTrue: boolean;

        profileType = await this.getProfileType();

        const schema: {} = await this.getSchema(profileType);
        const schemaArray = Object.keys(schema);

        const schemaValues: any = {};
        schemaValues.name = profileName;

        // Go through array of schema for input values
        for (const value of schemaArray) {
            switch (value) {
            case "host" :
                options = {
                    placeHolder: localize("createNewConnection.option.prompt.host.placeholder", "host.com"),
                    prompt: localize("createNewConnection.option.prompt.host",
                    "Enter a z/OS Host in the format 'host.com'."),
                };
                let host = await vscode.window.showInputBox(options);
                if (!host) {
                    vscode.window.showInformationMessage(localize("createNewConnection.zosmfURL",
                        "No valid value for z/OS Host. Operation Cancelled"));
                    return undefined;
                }
                try {
                    if (host.includes(":")) {
                        if (host.includes("/")) {
                            const result = this.parseUrl(host);
                            if (result === undefined) {
                                return undefined;
                            } else {
                            host = result.host;
                            if (result.port !== null) {
                                port = result.port;
                            }}
                        } else {
                            host = "https://" + host;
                            const result = this.parseUrl(host);
                            if (result === undefined) {
                                return undefined;
                            } else {
                            host = result.host;
                            if (result.port !== null) {
                                port = result.port;
                            }}
                        }
                    }
                }catch(error){
                    vscode.window.showErrorMessage("Operation Cancelled");
                }
                schemaValues[value] = host;
                if (port !== null || port !== undefined) {
                schemaValues.port = port;
                }
                break;
            case "port":
                if (schemaValues[value] === undefined || schemaValues[value] === null){
                    if (schema[value].optionDefinition.hasOwnProperty("defaultValue")){
                        options = {
                            prompt: schema[value].optionDefinition.description.toString(),
                            value: schema[value].optionDefinition.defaultValue.toString()
                        };
                    } else {
                        options = {
                            placeHolder: localize("createNewConnection.option.prompt.port.placeholder", "Port Number"),
                            prompt: schema[value].optionDefinition.description.toString(),
                        };
                    }
                    port = Number(await vscode.window.showInputBox(options));
                    if (Number.isNaN(port)) {
                        vscode.window.showInformationMessage(localize("createNewConnection.undefined.port",
                        "Invalid Port number provided or operation was cancelled"));
                        return undefined;
                    }
                    if (port === 0 && schema[value].optionDefinition.hasOwnProperty("defaultValue")) {
                        schemaValues[value] = Number(schema[value].optionDefinition.defaultValue.toString());
                    } else {
                        schemaValues[value] = port;
                    }
                    break;
                } else {
                    break;
                }
            case "user":
                options = {
                    placeHolder: localize("createNewConnection.option.prompt.username.placeholder", "Optional: User Name"),
                    prompt: localize("createNewConnection.option.prompt.username",
                    "Enter the user name for the connection. Leave blank to not store."),
                    value: userName
                };
                userName = await vscode.window.showInputBox(options);
                if (userName === undefined) {
                    vscode.window.showInformationMessage(localize("createNewConnection.undefined.username",
                        "Operation Cancelled"));
                    return;
                }
                schemaValues[value] = userName;
                break;
            case "password":
                options = {
                    placeHolder: localize("createNewConnection.option.prompt.password.placeholder", "Optional: Password"),
                    prompt: localize("createNewConnection.option.prompt.password",
                    "Enter the password for the connection. Leave blank to not store."),
                    password: true,
                    value: passWord
                };
                passWord = await vscode.window.showInputBox(options);
                if (passWord === undefined) {
                    vscode.window.showInformationMessage(localize("createNewConnection.undefined.passWord",
                        "Operation Cancelled"));
                    return;
                }
                schemaValues[value] = passWord;
                break;
            case "rejectUnauthorized":
                const quickPickOptions: vscode.QuickPickOptions = {
                    placeHolder: localize("createNewConnection.option.prompt.ru.placeholder", "Reject Unauthorized Connections"),
                    ignoreFocusOut: true,
                    canPickMany: false
                };
                const selectRU = ["True - Reject connections with self-signed certificates",
                    "False - Accept connections with self-signed certificates"];
                const ruOptions = Array.from(selectRU);
                const chosenRU = await vscode.window.showQuickPick(ruOptions, quickPickOptions);
                if (chosenRU === ruOptions[0]) {
                    rejectUnauthorize = true;
                } else if (chosenRU === ruOptions[1]) {
                    rejectUnauthorize = false;
                } else {
                    vscode.window.showInformationMessage(localize("createNewConnection.rejectUnauthorize","Operation Cancelled"));
                    return undefined;
                }
                schemaValues[value] = rejectUnauthorize;
                break;
            default:
                const description: string = schema[value].optionDefinition.description.toString();
                switch (schema[value].type) {
                    case "string":
                        options = await this.optionsValue(value, schema);
                        const profValue = await vscode.window.showInputBox(options);
                        if (profValue === "") {
                            break;
                        }
                        schemaValues[value] = profValue;
                        break;
                    case "boolean":
                        const quickPickBooleanOptions: vscode.QuickPickOptions = {
                            placeHolder: description,
                            ignoreFocusOut: true,
                            canPickMany: false
                        };
                        const selectBoolean = ["True", "False"];
                        const chosenValue = await vscode.window.showQuickPick(selectBoolean, quickPickBooleanOptions);
                        if (chosenValue === selectBoolean[0]) {
                                isTrue = true;
                            } else if (chosenValue === selectBoolean[1]) {
                                isTrue = false;
                            } else {
                                vscode.window.showInformationMessage(localize("createNewConnection","Operation Cancelled"));
                                return undefined;
                            }
                        schemaValues[value] = isTrue;
                        break;
                    case "number":
                        options = await this.optionsValue(value, schema);
                        const enteredValue = await vscode.window.showInputBox(options);
                        if (!Number.isNaN(Number(enteredValue))) {
                            schemaValues[value] = Number(enteredValue);
                            } else {
                                if (schema[value].optionDefinition.hasOwnProperty("defaultValue")){
                                    schemaValues[value] = schema[value].optionDefinition.defaultValue;
                                } else {
                                    schemaValues[value] = undefined;
                                }
                            }
                        break;
                    default:
                        options = await this.optionsValue(value, schema);
                        const defaultValue = await vscode.window.showInputBox(options);
                        switch (defaultValue){
                            case "True" || "true":
                                schemaValues[value] = true;
                                break;
                            case "False" || "false":
                                schemaValues[value] = false;
                                break;
                            default:
                                if (defaultValue === "") {
                                    break;
                                } else {
                                schemaValues[value] = defaultValue;
                                break;
                                }
                            }
                        break;
                }
            }
        }

        for (const profile of this.allProfiles) {
            if (profile.name === profileName) {
                vscode.window.showErrorMessage(localize("createNewConnection.duplicateProfileName",
                    "Profile name already exists. Please create a profile using a different name"));
                return undefined;
            }
        }

        try {
            await this.saveProfile(schemaValues, schemaValues.name, profileType);
        } catch (error) {
            vscode.window.showErrorMessage(error.message);
        }
        vscode.window.showInformationMessage("Profile " + profileName + " was created.");
        return profileName;
    }

    public async promptCredentials(sessName, rePrompt?: boolean) {
        let userName: string;
        let passWord: string;
        let options: vscode.InputBoxOptions;

        const loadProfile = this.loadNamedProfile(sessName.trim());
        const loadSession = loadProfile.profile as ISession;

        if (rePrompt) {
            userName = loadSession.user;
            passWord = loadSession.password;
        }

        if (!loadSession.user || rePrompt) {

            options = {
                placeHolder: localize("promptcredentials.option.prompt.username.placeholder", "User Name"),
                prompt: localize("promptcredentials.option.prompt.username", "Enter the user name for the connection"),
                value: userName
            };
            userName = await vscode.window.showInputBox(options);

            if (!userName) {
                vscode.window.showErrorMessage(localize("promptcredentials.invalidusername",
                        "Please enter your z/OS username. Operation Cancelled"));
                return;
            } else {
                loadSession.user = loadProfile.profile.user = userName;
            }
        }

        if (!loadSession.password || rePrompt) {
            passWord = loadSession.password;

            options = {
                placeHolder: localize("promptcredentials.option.prompt.password.placeholder", "Password"),
                prompt: localize("promptcredentials.option.prompt.password", "Enter a password for the connection"),
                password: true,
                value: passWord
            };
            passWord = await vscode.window.showInputBox(options);

            if (!passWord) {
                vscode.window.showErrorMessage(localize("promptcredentials.invalidpassword",
                        "Please enter your z/OS password. Operation Cancelled"));
                return;
            } else {
                loadSession.password = loadProfile.profile.password = passWord.trim();
            }
        }
        const updSession = await zowe.ZosmfSession.createBasicZosmfSession(loadSession as IProfile);
        if (rePrompt) {
            await this.updateProfile(loadProfile);
        }
        return [updSession.ISession.user, updSession.ISession.password, updSession.ISession.base64EncodedAuth];
    }
    public async getCliProfileManager(type: string): Promise<CliProfileManager> {
        let profileManager = this.profileManagerByType.get(type);
        if (!profileManager) {
            profileManager = await new CliProfileManager({
                profileRootDirectory: path.join(getZoweDir(), "profiles"),
                type
            });
            if (profileManager) {
                this.profileManagerByType.set(type, profileManager);
            } else {
                return undefined;
            }
        }
        return profileManager;
    }

    private async updateProfile(ProfileInfo) {

        for (const type of ZoweExplorerApiRegister.getInstance().registeredApiTypes()) {
            const profileManager = await this.getCliProfileManager(type);
            this.loadedProfile = (await profileManager.load({ name: ProfileInfo.name }));
        }
        const OrigProfileInfo = this.loadedProfile.profile as ISession;
        const NewProfileInfo = ProfileInfo.profile;
        if (OrigProfileInfo.user) {
            OrigProfileInfo.user = NewProfileInfo.user;
        }
        if (OrigProfileInfo.password) {
            OrigProfileInfo.password = NewProfileInfo.password;
        }

        const updateParms: IUpdateProfile = {
            name: this.loadedProfile.name,
            merge: true,
            profile: OrigProfileInfo as IProfile
        };
        try {
            (await this.getCliProfileManager(this.loadedProfile.type)).update(updateParms);
        } catch (error) {
            vscode.window.showErrorMessage(error.message);
        }
    }

    private async saveProfile(ProfileInfo, ProfileName, ProfileType) {
        let newProfile: IProfile;
        try {
            newProfile = await (await this.getCliProfileManager(ProfileType)).save({ profile: ProfileInfo, name: ProfileName, type: ProfileType });
        } catch (error) {
            vscode.window.showErrorMessage(error.message);
        }
        return newProfile.profile;
    }
}
