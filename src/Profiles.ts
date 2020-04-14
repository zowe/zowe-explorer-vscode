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
import * as globals from "./globals";
import { ZoweExplorerApiRegister } from "./api/ZoweExplorerApiRegister";
import { errorHandling, getZoweDir, FilterDescriptor, FilterItem, resolveQuickPickHelper } from "./utils";
import { DatasetTree } from "./dataset/DatasetTree";
import { ZosJobsProvider } from "./job/ZosJobsProvider";
import { USSTree } from "./uss/USSTree";
import { IZoweTree } from "./api/IZoweTree";
import { IZoweDatasetTreeNode, IZoweJobTreeNode, IZoweUSSTreeNode } from "./api/IZoweTreeNode";

import * as nls from "vscode-nls";
const localize = nls.config({messageFormat: nls.MessageFormat.file})();

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
                    urlInputBox.validationMessage = localize("createNewConnection.invalidzosmfURL",
                        "Please enter a valid URL in the format https://url:port.");
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

    /**
     * Adds a new Profile to the provided treeview by clicking the 'Plus' button and
     * selecting which profile you would like to add from the drop-down that appears.
     * The profiles that are in the tree view already will not appear in the drop-down.
     *
     * @export
     * @param {USSTree} zoweNodeProvider - either the USS, MVS, JES tree
     */
    public async addZoweSession(zoweNodeProvider: IZoweTree<IZoweDatasetTreeNode|IZoweUSSTreeNode|IZoweJobTreeNode>) {
        const allProfiles = Profiles.getInstance().allProfiles;

        // Get all profiles
        let profileNamesList = allProfiles.map((profile) => {
            return profile.name;
        });

        // Filter to list of the APIs available for current tree explorer
        profileNamesList = this.filterProfileNames(zoweNodeProvider, profileNamesList);

        // Select a profile regardless of whether we are in Theia or not
        // IFF this function is made into a class, sharing information would be simpler between functions. Also functions will be properly protected
        const { chosenProfile, quickpickValue } = await this.selectProfile(profileNamesList);

        if (chosenProfile === "") {
          // Create profile
          await this.createProfile(zoweNodeProvider, quickpickValue);
        } else if (chosenProfile) {
            globals.LOG.debug(localize("addZoweSession.log.debug.selectProfile", "User selected profile ") + chosenProfile);
            await zoweNodeProvider.addSession(chosenProfile);
        } else {
            globals.LOG.debug(localize("addZoweSession.log.debug.cancelledSelection", "User cancelled profile selection"));
        }
    }

    /**
     * Filter the list of profile names based on APIs available for current tree explorer
     *
     * @param zoweNodeProvider - either the USS, MVS, JES tree
     * @param profileNamesList - List of all profile names
     */
    private filterProfileNames(zoweNodeProvider: IZoweTree<IZoweDatasetTreeNode|IZoweUSSTreeNode|IZoweJobTreeNode>, profileNamesList: string[]) {
        // Filter to list of the APIs available for current tree explorer
        let returnList = profileNamesList.filter((profileName) => {
            const profile = Profiles.getInstance().loadNamedProfile(profileName);
            if (zoweNodeProvider instanceof USSTree) {
                const ussProfileTypes = ZoweExplorerApiRegister.getInstance().registeredUssApiTypes();
                return ussProfileTypes.includes(profile.type);
            }
            if (zoweNodeProvider instanceof DatasetTree) {
                const mvsProfileTypes = ZoweExplorerApiRegister.getInstance().registeredMvsApiTypes();
                return mvsProfileTypes.includes(profile.type);
            }
            if (zoweNodeProvider instanceof ZosJobsProvider) {
                const jesProfileTypes = ZoweExplorerApiRegister.getInstance().registeredJesApiTypes();
                return jesProfileTypes.includes(profile.type);
            }
        });

        if (returnList) {
            returnList = returnList.filter((profileName) =>
                // Find all cases where a profile is not already displayed
                !zoweNodeProvider.mSessionNodes.find((sessionNode) => sessionNode.getProfileName() === profileName )
            );
        }
        return returnList;
    }

    /**
     * Select a profile regardless of whether we are in Thei or not
     *
     * @param profileNamesList - List of filtered profile names
     */
    private async selectProfile(profileNamesList: string[]) {
        const createNewProfile = "Create a New Connection to z/OS";

        let chosenProfile = "";
        const createPick = new FilterDescriptor("\uFF0B " + createNewProfile);
        const items: vscode.QuickPickItem[] = profileNamesList.map((element) => new FilterItem(element));
        const quickpick = vscode.window.createQuickPick();
        const placeholder = localize("addSession.quickPickOption",
            "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the USS Explorer");

        if (globals.ISTHEIA) {
            const options: vscode.QuickPickOptions = {
                placeHolder: placeholder
            };
            // get user selection
            const choice = (await vscode.window.showQuickPick([createPick, ...items], options));
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

        const quickpickValue = quickpick.value ? quickpick.value : "";
        return { chosenProfile, quickpickValue };
    }

    /**
     * Create a user connection/profile based on the information entered by the user
     *
     * @param zoweNodeProvider - either the USS, MVS, JES tree
     * @param quickpickValue - Name entered by the user
     */
    private async createProfile(zoweNodeProvider: IZoweTree<IZoweDatasetTreeNode|IZoweUSSTreeNode|IZoweJobTreeNode>, quickpickValue: string) {
        let newprofile: any;
        let profileName: string;
        if (quickpickValue) {
            profileName = quickpickValue;
        }

        const options = {
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
        globals.LOG.debug(localize("addSession.log.debug.createNewProfile", "User created a new profile"));
        try {
            newprofile = await Profiles.getInstance().createNewConnection(profileName.trim());
        } catch (error) { errorHandling(error, profileName.trim(), error.message); }
        if (newprofile) {
            try {
                await Profiles.getInstance().refresh();
            } catch (error) {
                errorHandling(error, newprofile, error.message);
            }
            await zoweNodeProvider.addSession(newprofile);
            zoweNodeProvider.refresh();
        }
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
