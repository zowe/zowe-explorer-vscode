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
import * as nls from "vscode-nls";
import * as path from "path";
import { URL } from "url";
import * as vscode from "vscode";
import * as zowe from "@zowe/cli";
import { ZoweExplorerApiRegister } from "./api/ZoweExplorerApiRegister";
import { getZoweDir } from "./extension";  // TODO: resolve cyclic dependency

const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

interface IUrlValidator {
    valid: boolean;
    protocol: string;
    host: string;
    port: number;
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
    private profilesByType = new Map<string, IProfileLoaded[]>();
    private defaultProfileByType = new Map<string, IProfileLoaded>();
    private profileManagerByType= new Map<string, CliProfileManager>();
    private constructor(private log: Logger) {
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

    public getProfiles(type?: string): IProfileLoaded[] {
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

    public validateAndParseUrl(newUrl: string): IUrlValidator {
        let url: URL;
        const validProtocols: string[] = ["https","http"];
        const DEFAULT_HTTPS_PORT: number = 443;

        const validationResult: IUrlValidator = {
            valid: false,
            protocol: null,
            host: null,
            port: null
        };

        try {
            url = new URL(newUrl);
        } catch (error) {
            return validationResult;
        }

        // overkill with only one valid protocol, but we may expand profile types and protocols in the future?
        if (!validProtocols.some((validProtocol: string) => url.protocol.includes(validProtocol))) {
            return validationResult;
        }

        // if port is empty, set https defaults
        if (!url.port.trim()) {
            validationResult.port = DEFAULT_HTTPS_PORT;
        }
        else {
            validationResult.port = Number(url.port);
        }

        validationResult.protocol = url.protocol.replace(":","");
        validationResult.host = url.hostname;
        validationResult.valid = true;
        return validationResult;
    }

    public async getUrl(urlInputBox): Promise<string | undefined> {
        return new Promise<string | undefined> ((resolve) => {
            urlInputBox.onDidHide(() => { resolve(urlInputBox.value); });
            urlInputBox.onDidAccept(() => {
                if (this.validateAndParseUrl(urlInputBox.value).valid) {
                    resolve(urlInputBox.value);
                } else {
                    urlInputBox.validationMessage = localize("createNewConnection.invalidzosURL",
                        "Please enter a valid URL in the format https://url:port.");
                }
            });
        });
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
                    value: userName
                };
                const host = await vscode.window.showInputBox(options);
                schemaValues[value] = host;
                break;
            case "port":
                options = {
                    placeHolder: localize("createNewConnection.option.prompt.port.placeholder", "Port Number"),
                    prompt: schema[value].optionDefinition.description.toString(),
                    value: userName
                };
                port = Number(await vscode.window.showInputBox(options));
                if (port === 0 && schema[value].optionDefinition.hasOwnProperty("defaultValue")) {
                    schemaValues[value] = Number(schema[value].optionDefinition.defaultValue.toString());
                } else {
                    schemaValues[value] = port;
                }
                break;
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
                let isRequired: boolean;
                const requiredField: boolean = schema[value].optionDefinition.hasOwnProperty("required");
                // tslint:disable-next-line:no-console
                console.log(requiredField);
                if (requiredField) {
                    isRequired = Boolean(schema[value].optionDefinition.required.toString());
                }
                // tslint:disable-next-line:no-console
                console.log(isRequired);
                if (isRequired) {
                    const description: string = schema[value].optionDefinition.description.toString();
                    switch (schema[value].type) {
                        case "string":
                            options = {
                                placeHolder: description,
                                prompt: description,
                            };
                            const profValue = await vscode.window.showInputBox(options);
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
                            options = {
                                placeHolder: description,
                                prompt: description
                            };
                            const enteredValue = await vscode.window.showInputBox(options);
                            const numValue = Number(enteredValue);
                            if (Number.isNaN(numValue) === false) {
                            schemaValues[value] = Number(enteredValue);
                            } else {
                                // default value
                                schemaValues[value] = null;
                            }
                            break;
                        default:
                            options = {
                                placeHolder: description,
                                prompt: description
                            };
                            const defaultValue = await vscode.window.showInputBox(options);
                            switch (defaultValue){
                            case "true":
                                schemaValues[value] = true;
                                break;
                            case "false":
                                schemaValues[value] = false;
                                break;
                            default:
                                schemaValues[value] = defaultValue;
                                break;
                            }
                            break;
                    }
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

        let newProfile: IProfile;

        try {
            newProfile = await this.saveProfile(schemaValues, schemaValues.name, profileType);
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

    private async getCliProfileManager(type: string): Promise<CliProfileManager> {
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
}
