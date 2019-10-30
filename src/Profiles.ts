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

import { IProfileLoaded, Logger, CliProfileManager, Imperative, ImperativeConfig } from "@brightside/imperative";
import * as nls from "vscode-nls";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import * as ProfileLoader from "./ProfileLoader";
import { URL } from "url";
import * as vscode from "vscode";
import * as zowe from "@brightside/core";
import { DatasetTree } from "./DatasetTree";
import { addSession } from "./extension";
const localize = nls.config({ messageFormat: nls.MessageFormat.file })();
let IConnection: {
    name: string;
    host: string;
    port: number;
    user: string;
    password: string;
    rejectUnauthorized: boolean;
};

export class Profiles { // Processing stops if there are no profiles detected
    public static async createInstance(log: Logger) {
        Profiles.loader = new Profiles(log);
        await Profiles.loader.refresh();
        return Profiles.loader;

    }
    public static getInstance() {
        return Profiles.loader;
    }
    private static loader: Profiles;
    public allProfiles: IProfileLoaded[] = [];
    public defaultProfile: IProfileLoaded;

    private spawnValue: number = -1;
    private constructor(public log: Logger) {}

    public loadNamedProfile(name: string): IProfileLoaded {
        for (const profile of this.allProfiles) {
            if (profile.name === name && profile.type === "zosmf") {
                return profile;
            }
        }
        throw new Error(localize("loadNamedProfile.error.profileName", "Could not find profile named: ")
            + name + localize("loadNamedProfile.error.period", "."));
    }
    public getDefaultProfile(): IProfileLoaded {
        return this.defaultProfile;
    }
    public async refresh() {
        if (this.isSpawnReqd() === 0) {
            this.allProfiles = ProfileLoader.loadAllProfiles();
            this.defaultProfile = ProfileLoader.loadDefaultProfile(this.log);
        } else {
            const profileManager = new CliProfileManager({
                profileRootDirectory: path.join(os.homedir(), ".zowe", "profiles"),
                type: "zosmf"
            });
            this.allProfiles = (await profileManager.loadAll()).filter((profile) => {
                return profile.type === "zosmf";
            });
            if (this.allProfiles.length > 0 ) {
                this.defaultProfile = (await profileManager.load({ loadDefault: true }));
            } else {
                ProfileLoader.loadDefaultProfile(this.log);
            }
        }
    }

    public listProfile(){
        this.allProfiles = ProfileLoader.loadAllProfiles();
        this.allProfiles.map((profile) => {
            return profile.name;
        });
        return this.allProfiles;
    }

    public async createNewConnection() {
        let url: URL;
        let profileName: string;
        let userName: string;
        let passWord: string;
        let zosmfURL: string;
        let rejectUnauthorize: boolean;
        let options: vscode.InputBoxOptions;

        const validateUrl = (newUrl: string) => {
            try {
                url = new URL(newUrl);
            } catch (error) {
                return false;
            }
            return url.port ? true : false;
        };

        options = {
            placeHolder: localize("createNewConnection.option.prompt.profileName.placeholder", "Connection Name"),
            prompt: localize("createNewConnection.option.prompt.profileName", "Enter a name for the connection"),
            value: profileName
        };
        profileName = await vscode.window.showInputBox(options);
        if (!profileName) {
            vscode.window.showInformationMessage(localize("createNewConnection.enterprofileName",
                    "Profile Name was not supplied. Operation Cancelled"));
            return;
        }

        zosmfURL = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            placeHolder: localize("createNewConnection.option.prompt.url.placeholder", "http(s)://url:port"),
            prompt: localize("createNewConnection.option.prompt.url",
            "Enter a z/OSMF URL in the format 'http(s)://url:port'."),
            validateInput: (text: string) => (validateUrl(text) ? "" : "Please enter a valid URL."),
            value: zosmfURL
        });

        if (!zosmfURL) {
            vscode.window.showInformationMessage(localize("createNewConnection.enterzosmfURL",
                    "No valid value for z/OSMF URL. Operation Cancelled"));
            return;
        }

        options = {
            placeHolder: localize("createNewConnection.option.prompt.userName.placeholder", "User Name"),
            prompt: localize("createNewConnection.option.prompt.userName", "Enter the user name for the connection"),
            value: userName
        };
        userName = await vscode.window.showInputBox(options);

        if (!userName) {
            vscode.window.showInformationMessage(localize("createNewConnection.enterzosmfURL",
                    "Please enter your z/OS username. Operation Cancelled"));
            return;
        }

        options = {
            placeHolder: localize("createNewConnection.option.prompt.passWord.placeholder", "Password"),
            prompt: localize("createNewConnection.option.prompt.userName", "Enter a password for the connection"),
            password: true,
            value: passWord
        };
        passWord = await vscode.window.showInputBox(options);

        if (!passWord) {
            vscode.window.showInformationMessage(localize("createNewConnection.enterzosmfURL",
                    "Please enter your z/OS password. Operation Cancelled"));
            return;
        }

        const quickPickOptions: vscode.QuickPickOptions = {
            placeHolder: localize("createNewConnection.option.prompt.ru.placeholder", "Reject Unauthorized Connections"),
            ignoreFocusOut: true,
            canPickMany: false
        };

        const selectRU = [ "True - Reject connections with self-signed certificates",
                           "False - Accept connections with self-signed certificates" ];

        const ruOptions = Array.from(selectRU);

        const chosenRU = await vscode.window.showQuickPick(ruOptions, quickPickOptions);

        if (chosenRU === ruOptions[0]) {
            rejectUnauthorize = true;
        } else if (chosenRU === ruOptions[1]) {
            rejectUnauthorize = false;
        } else {
            vscode.window.showInformationMessage(localize("createNewConnection.rejectUnauthorize",
                    "Operation Cancelled"));
            return;
        }

        for (const verifyProfile of this.listProfile()) {
            if (verifyProfile.name === profileName) {
                vscode.window.showErrorMessage(localize("createNewConnection.duplicateProfileName",
                "Profile name already exists. Please create a profile using a different name"));
                return;
            }
        }

        IConnection = {
            name: profileName,
            host: url.hostname,
            port: Number(url.port),
            user: userName,
            password: passWord,
            rejectUnauthorized: rejectUnauthorize,
        };

        const mainZoweDir = path.join(require.resolve("@brightside/core"), "..", "..", "..", "..");
        // we have to mock a few things to get the Imperative.init to work properly
        (process.mainModule as any).filename = require.resolve("@brightside/core");
        ((process.mainModule as any).paths as any).unshift(mainZoweDir);
        // we need to call Imperative.init so that any installed credential manager plugins are loaded
        await Imperative.init({ configurationModule: require.resolve("@brightside/core/lib/imperative.js") });
        const zosmfProfile = await new CliProfileManager({
            profileRootDirectory: path.join(ImperativeConfig.instance.cliHome, "profiles"),
            type: "zosmf"
        }).save({profile: IConnection, name: IConnection.name, type: "zosmf"});
        await zowe.ZosmfSession.createBasicZosmfSession(zosmfProfile.profile);
        vscode.window.showInformationMessage("Profile " + profileName + " was created.");
        return profileName;
    }

    private isSpawnReqd() {
        if (this.spawnValue === -1) {
            const homedir = os.homedir();
            this.spawnValue = 0;
            try {
                const fileName = path.join(homedir, ".zowe", "settings", "imperative.json");
                const settings = JSON.parse(fs.readFileSync(fileName).toString());
                const value = settings.overrides.CredentialManager;
                this.spawnValue = value !== false ? 0 : 1;
            } catch (error) {
                // default to spawn
                this.spawnValue = 0;
            }
        }
        return this.spawnValue;
    }
}
