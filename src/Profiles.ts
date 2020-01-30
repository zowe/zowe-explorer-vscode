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

// tslint:disable: max-classes-per-file

import { IProfileLoaded, Logger, CliProfileManager, IProfile, ISession } from "@brightside/imperative";
import * as nls from "vscode-nls";
import * as path from "path";
import { URL } from "url";
import * as vscode from "vscode";
import * as zowe from "@brightside/core";
import { ZoweExplorerApiRegister } from "./api/ZoweExplorerApiRegister";
import { getZoweDir } from "./extension";  // TODO: resolve cyclic dependency

const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

interface IUrlValidator {
    valid: boolean;
    host: string;
    port: number;
}

let IConnection: {
    name: string;
    host: string;
    port: number;
    user: string;
    password: string;
    rejectUnauthorized: boolean;
};

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

    // TODO: Temporary hack for creditials entered via user prompts to survive a refresh.
    // The way credentials are prompted and queried needs to be rewritten and a clear method added.
    private static credentialsHash = new Map<string,Map<string, string>>();
    private static credentialHashPropUsername = "user";
    private static credentialHashPropPassword = "password";
    private static credentialHashSetValue(profile: string, property: string, value: string): void {
        let properties = this.credentialsHash.get(profile);
        if (!properties) {
            properties = new Map<string, string>();
            this.credentialsHash.set(profile, properties);
        }
        properties.set(property, value);
    }

    public allProfiles: IProfileLoaded[] = [];

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
        // TODO: Temporary hack to be consistent with sessions storing prompted passwords.
        // Should be rewritten and a clear method needs to be added.
        for (const profile of this.allProfiles) {
            const credentialProps = Profiles.credentialsHash.get(profile.name);
            if (credentialProps) {
                profile.profile.user = credentialProps.get(Profiles.credentialHashPropUsername);
                profile.profile.password = credentialProps.get(Profiles.credentialHashPropPassword);
            }
        }
    }

    public validateAndParseUrl(newUrl: string): IUrlValidator {
        let url: URL;
        const validProtocols: string[] = ["https"];
        const DEFAULT_HTTPS_PORT: number = 443;

        const validationResult: IUrlValidator = {
            valid: false,
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
                    urlInputBox.validationMessage = localize("createNewConnection.invalidzosmfURL", "Please enter a valid URL in the format https://url:port.");
                }
            });
        });
    }

    public async createNewConnection(profileName: string, profileType: string ="zosmf"): Promise<string | undefined> {
        let userName: string;
        let passWord: string;
        let zosmfURL: string;
        let rejectUnauthorize: boolean;
        let options: vscode.InputBoxOptions;

        const urlInputBox = vscode.window.createInputBox();
        urlInputBox.ignoreFocusOut = true;
        urlInputBox.placeholder = localize("createNewConnection.option.prompt.url.placeholder", "https://url:port");
        urlInputBox.prompt = localize("createNewConnection.option.prompt.url",
            "Enter a z/OSMF URL in the format 'https://url:port'.");

        urlInputBox.show();
        zosmfURL = await this.getUrl(urlInputBox);
        urlInputBox.dispose();

        if (!zosmfURL) {
            vscode.window.showInformationMessage(localize("createNewConnection.zosmfURL",
                "No valid value for z/OSMF URL. Operation Cancelled"));
            return undefined;
        }

        const zosmfUrlParsed = this.validateAndParseUrl(zosmfURL);

        options = {
            placeHolder: localize("createNewConnection.option.prompt.username.placeholder", "Optional: User Name"),
            prompt: localize("createNewConnection.option.prompt.username", "Enter the user name for the connection. Leave blank to not store."),
            value: userName
        };
        userName = await vscode.window.showInputBox(options);

        if (userName === undefined) {
            vscode.window.showInformationMessage(localize("createNewConnection.undefined.username",
                "Operation Cancelled"));
            return;
        }

        options = {
            placeHolder: localize("createNewConnection.option.prompt.password.placeholder", "Optional: Password"),
            prompt: localize("createNewConnection.option.prompt.password", "Enter the password for the connection. Leave blank to not store."),
            password: true,
            value: passWord
        };
        passWord = await vscode.window.showInputBox(options);

        if (passWord === undefined) {
            vscode.window.showInformationMessage(localize("createNewConnection.undefined.passWord",
                "Operation Cancelled"));
            return;
        }

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
            vscode.window.showInformationMessage(localize("createNewConnection.rejectUnauthorize",
                "Operation Cancelled"));
            return undefined;
        }

        for (const profile of this.allProfiles) {
            if (profile.name === profileName) {
                vscode.window.showErrorMessage(localize("createNewConnection.duplicateProfileName",
                    "Profile name already exists. Please create a profile using a different name"));
                return undefined;
            }
        }

        IConnection = {
            name: profileName,
            host: zosmfUrlParsed.host,
            port: zosmfUrlParsed.port,
            user: userName,
            password: passWord,
            rejectUnauthorized: rejectUnauthorize
        };

        let newProfile: IProfile;

        try {
            newProfile = await this.saveProfile(IConnection, IConnection.name, profileType);
        } catch (error) {
            vscode.window.showErrorMessage(error.message);
        }
        await zowe.ZosmfSession.createBasicZosmfSession(newProfile);
        vscode.window.showInformationMessage("Profile " + profileName + " was created.");
        return profileName;
    }

    public async promptCredentials(sessName) {
        let userName: string;
        let passWord: string;
        let options: vscode.InputBoxOptions;

        const loadProfile = this.loadNamedProfile(sessName);
        const loadSession = loadProfile.profile as ISession;

        if (!loadSession.user) {

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
                Profiles.credentialHashSetValue(sessName, Profiles.credentialHashPropUsername, userName);
            }
        }

        if (!loadSession.password) {
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
                Profiles.credentialHashSetValue(sessName, Profiles.credentialHashPropPassword, loadSession.password);
            }
        }
        const updSession = await zowe.ZosmfSession.createBasicZosmfSession(loadSession as IProfile);
        return [updSession.ISession.user, updSession.ISession.password, updSession.ISession.base64EncodedAuth];
    }

    private async saveProfile(ProfileInfo, ProfileName, ProfileType) {
        let zosmfProfile: IProfile;
        try {
            zosmfProfile = await (await this.getCliProfileManager(ProfileType)).save({ profile: ProfileInfo, name: ProfileName, type: ProfileType });
        } catch (error) {
            vscode.window.showErrorMessage(error.message);
        }
        return zosmfProfile.profile;
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
