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

import { IProfileLoaded, Logger, CliProfileManager, IProfile, ISession, IUpdateProfileFromCliArgs,
         ICommandArguments, Session, ConnectionPropsForSessCfg, SessConstants } from "@zowe/imperative";
import * as path from "path";
import { URL } from "url";
import * as zowe from "@zowe/cli";
import * as vscode from "vscode";
import * as globals from "./globals";
import { ZoweExplorerApiRegister } from "./api/ZoweExplorerApiRegister";
import { errorHandling, getZoweDir, FilterDescriptor, FilterItem, resolveQuickPickHelper } from "./utils";
import { IZoweTree } from "./api/IZoweTree";
import { IZoweNodeType, IZoweUSSTreeNode, IZoweDatasetTreeNode, IZoweJobTreeNode, IZoweTreeNode } from "./api/IZoweTreeNode";
import * as nls from "vscode-nls";

// Set up localization
nls.config({ messageFormat: nls.MessageFormat.bundle, bundleFormat: nls.BundleFormat.standalone })();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

interface IUrlValidator {
    valid: boolean;
    protocol: string;
    host: string;
    port: number;
}

interface IProfileValidation {
    status: string;
    name: string;
}

let InputBoxOptions: vscode.InputBoxOptions;
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

    public static getInstance(): Profiles { return Profiles.loader; }

    private static loader: Profiles;

    public profilesForValidation: IProfileValidation[] = [];
    public allProfiles: IProfileLoaded[] = [];
    public loadedProfile: IProfileLoaded;
    public validProfile: ValidProfileEnum = ValidProfileEnum.INVALID;
    private dsSchema: string = "Zowe-DS-Persistent";
    private ussSchema: string = "Zowe-USS-Persistent";
    private jobsSchema: string = "Zowe-Jobs-Persistent";
    private allTypes: string[];
    private profilesByType = new Map<string, IProfileLoaded[]>();
    private defaultProfileByType = new Map<string, IProfileLoaded>();
    private profileManagerByType= new Map<string, CliProfileManager>();
    private constructor(private log: Logger) {}

    public async checkCurrentProfile(profileLoaded: IProfileLoaded, prompt?: boolean) {
        try {
            const validSession = await (Profiles.getInstance().getValidSession(profileLoaded.profile, profileLoaded.name, null, prompt));

            if ((!profileLoaded.profile.user || !profileLoaded.profile.password) && !validSession) {
                // Credentials are invalid
                this.validProfile = ValidProfileEnum.INVALID;
                return "inactive";
            } else {
                // Credentials are valid
                this.validProfile = ValidProfileEnum.VALID;
                return "active";
            }
        } catch (error) {
            errorHandling(error, profileLoaded.name,
                localize("checkCurrentProfile.error", "Error encountered in {0}", `checkCurrentProfile.optionalProfiles!`));
            return "inactive";
        }
    }

    public async getValidSession(serviceProfile: IProfile, profileName: string, baseProfile?: IProfile, prompt?: boolean) {
        if (this.getDefaultProfile("base") && this.getDefaultProfile("base").profile.tokenValue) {
            baseProfile = this.getDefaultProfile("base").profile;

            const sessCfg = {
                rejectUnauthorized: serviceProfile.rejectUnauthorized,
                basePath: serviceProfile.basePath,
                hostname: baseProfile.host,
                port: baseProfile.port,
            };

            const cmdArgs: ICommandArguments = {
                $0: "zowe",
                _: [""],
                tokenType: SessConstants.TOKEN_TYPE_APIML,
                tokenValue: baseProfile.tokenValue
            };

            try {
                let connectableSessCfg: ISession;
                if (prompt) {
                    connectableSessCfg = await ConnectionPropsForSessCfg.addPropsOrPrompt<ISession>(sessCfg, cmdArgs,
                                                                                                        { requestToken: false, doPrompting: true });
                }
                else {
                    connectableSessCfg = await ConnectionPropsForSessCfg.addPropsOrPrompt<ISession>(sessCfg, cmdArgs,
                                                                                                        { requestToken: false, doPrompting: true });
                }
                return new Session(connectableSessCfg);
            } catch (error) { await errorHandling(error.message); }
        } else {
            // No baseProfile exists
            const schemaArray = [];
            if (prompt) {
                // Select for prompting only fields which are not defined
                if (!serviceProfile.user) { schemaArray.push("user"); }
                if (!serviceProfile.password) { schemaArray.push("password"); }
                if (!serviceProfile.host) {
                    schemaArray.push("host");
                    if (!serviceProfile.port) { schemaArray.push("port"); }
                    if (!serviceProfile.basePath) { schemaArray.push("basePath"); }
                }
                const newDetails = await this.collectProfileDetails(profileName, null, schemaArray);
                for (const detail of schemaArray) { serviceProfile[detail] = newDetails[detail]; }
            }
            try { return zowe.ZosmfSession.createBasicZosmfSession(serviceProfile); }
            catch (error) { await errorHandling(error.message); }
        }
    }

    public loadNamedProfile(name: string, type?: string): IProfileLoaded {
        for (const profile of this.allProfiles) {
            if (profile.name === name && (type ? profile.type === type : true)) { return profile; }
        }
        throw new Error(localize("loadNamedProfile.error.profileName", "Could not find profile named: {0}.", name));
    }

    public getDefaultProfile(type: string = "zosmf"): IProfileLoaded { return this.defaultProfileByType.get(type); }

    public getProfiles(type: string = "zosmf"): IProfileLoaded[] { return this.profilesByType.get(type); }

    public async refresh(): Promise<void> {
        this.allProfiles = [];
        this.allTypes = [];

        // Set the default base profile (base is not a type included in registeredApiTypes)
        let profileManager = await this.getCliProfileManager("base");
        this.defaultProfileByType.set("base", (await profileManager.load({ loadDefault: true })));

        // Handle all API profiles
        for (const type of ZoweExplorerApiRegister.getInstance().registeredApiTypes()) {
            profileManager = await this.getCliProfileManager(type);
            const profilesForType = (await profileManager.loadAll()).filter((profile) => profile.type === type);
            if (profilesForType && profilesForType.length > 0) {
                this.allProfiles.push(...profilesForType);
                this.profilesByType.set(type, profilesForType);
                let defaultProfile: IProfileLoaded;

                try { defaultProfile = await profileManager.load({ loadDefault: true }); }
                catch (error) { vscode.window.showInformationMessage(error.message); }

                this.defaultProfileByType.set(type, defaultProfile);
            }
            // This is in the loop because I need an instantiated profile manager config
            if (profileManager.configurations && this.allTypes.length === 0) {
                for (const element of profileManager.configurations) { this.allTypes.push(element.type); }
            }
        }
    }

    public validateAndParseUrl(newUrl: string): IUrlValidator {
        let url: URL;

        const validationResult: IUrlValidator = {
            valid: false,
            protocol: null,
            host: null,
            port: null
        };

        if (newUrl === "https://") {
            validationResult.host = "";
            validationResult.port = 0;
            validationResult.valid = true;
            return validationResult;
        }

        try { url = new URL(newUrl); }
        catch (error) { return validationResult; }

        validationResult.port = Number(url.port);
        validationResult.host = url.hostname;
        validationResult.valid = true;
        return validationResult;
    }

    public async getUrl(urlInputBox): Promise<string | undefined> {
        return new Promise<string | undefined>((resolve, reject) => {
            urlInputBox.onDidHide(() => {
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
                    urlInputBox.validationMessage = localize("createNewConnection.invalidzosURL",
                        "Please enter a valid host URL in the format 'company.com'.");
                }
            });
        });
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
            if (zoweFileProvider.getTreeType() === globals.PersistenceSchemaEnum.USS) {
                const ussProfileTypes = ZoweExplorerApiRegister.getInstance().registeredUssApiTypes();
                return ussProfileTypes.includes(profile.type);
            }
            if (zoweFileProvider.getTreeType() === globals.PersistenceSchemaEnum.Dataset) {
                const mvsProfileTypes = ZoweExplorerApiRegister.getInstance().registeredMvsApiTypes();
                return mvsProfileTypes.includes(profile.type);
            }
            if (zoweFileProvider.getTreeType() === globals.PersistenceSchemaEnum.Job) {
                const jesProfileTypes = ZoweExplorerApiRegister.getInstance().registeredJesApiTypes();
                return jesProfileTypes.includes(profile.type);
            }
        });
        if (profileNamesList) {
            profileNamesList = profileNamesList.filter((profileName) =>
                // Find all cases where a profile is not already displayed
                !zoweFileProvider.mSessionNodes.find((sessionNode) => sessionNode.getProfileName() === profileName)
            );
        }
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

        if (chosenProfile === "") {
            let newprofile: any;
            let profileName: string;
            if (quickpick.value) { profileName = quickpick.value; }

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
            chosenProfile = profileName.trim();
            globals.LOG.debug(localize("addSession.log.debug.createNewProfile", "User created a new profile"));
            try { newprofile = await Profiles.getInstance().createNewConnection(chosenProfile); }
            catch (error) { await errorHandling(error, chosenProfile, error.message); }
            if (newprofile) {
                try { await Profiles.getInstance().refresh(); }
                catch (error) { await errorHandling(error, newprofile, error.message); }
                await zoweFileProvider.addSession(newprofile);
                await zoweFileProvider.refresh();
            }
        } else if (chosenProfile) {
            globals.LOG.debug(localize("createZoweSession.log.debug.selectProfile", "User selected profile ") + chosenProfile);
            await zoweFileProvider.addSession(chosenProfile);
        } else {
            globals.LOG.debug(localize("createZoweSession.log.debug.cancelledSelection", "User cancelled profile selection"));
        }
    }

    public async editSession(profileLoaded: IProfileLoaded, profileName: string): Promise<any| undefined> {
        const updSchemaValues = await this.collectProfileDetails(profileName, profileLoaded.type);
        updSchemaValues.name = profileName;

        try {
            const updSession = await Profiles.getInstance().getValidSession(updSchemaValues, profileName);
            updSchemaValues.base64EncodedAuth = updSession.ISession.base64EncodedAuth;
            await this.updateProfile({profile: updSchemaValues, name: profileName, type: profileLoaded.type});
            vscode.window.showInformationMessage(localize("editConnection.success", "Profile was successfully updated"));

            return updSchemaValues;
        } catch (error) { await errorHandling(error.message); }
    }

    public async getProfileType(): Promise<string> {
        let profileType: string;
        const profTypes = ZoweExplorerApiRegister.getInstance().registeredApiTypes();
        const typeOptions = Array.from(profTypes);
        if (typeOptions.length === 1 && typeOptions[0] === "zosmf") { profileType = typeOptions[0]; }
        else {
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

    public async createNewConnection(profileName: string, requestedProfileType?: string): Promise<string | undefined> {
        const newProfileName = profileName.trim();
        if (newProfileName === undefined || newProfileName === "") {
            vscode.window.showInformationMessage(localize("createNewConnection.profileName",
                "Profile name was not supplied. Operation Cancelled"));
            return undefined;
        }

        const newProfileDetails = await this.collectProfileDetails(newProfileName, requestedProfileType);
        newProfileDetails.name = newProfileName;

        try {
            for (const profile of this.allProfiles) {
                if (profile.name.toLowerCase() === profileName.toLowerCase()) {
                    vscode.window.showErrorMessage(localize("createNewConnection.duplicateProfileName",
                        "Profile name already exists. Please create a profile using a different name"));
                    return undefined;
                }
            }
            await this.saveProfile(newProfileDetails, newProfileDetails.name, newProfileDetails.type);
            vscode.window.showInformationMessage("Profile " + newProfileDetails.name + " was created.");
            return newProfileDetails.name;
        } catch (error) { await errorHandling(error.message); }
    }

    public async collectProfileDetails(profileName: string, profileType?: string, schemaArray?: string[]): Promise<any> {
        let newUser: string;
        let newPass: string;
        let newRU: boolean;
        let newUrl: any;
        let newPort: number;

        if (!profileType) { profileType = await this.getProfileType(); }
        const schema = await this.getSchema(profileType);
        if (!schemaArray) { schemaArray = Object.keys(schema); }

        const schemaValues: any = {};
        schemaValues.name = profileName;
        schemaValues.type = profileType;

        // Go through array of schema for input values
        for (const value of schemaArray) {
            switch (value) {
            case "host" :
                newUrl = await this.urlInfo();
                schemaValues[value] = newUrl.host;
                if (newUrl.port !== 0) { schemaValues.port = newUrl.port; }
                break;
            case "port" :
                if (schemaValues[value] === undefined) {
                    newPort = await this.portInfo(value, schema);
                    if (Number.isNaN(newPort)) {
                        vscode.window.showInformationMessage(localize("createNewConnection.undefined.port",
                            "Invalid Port number provided or operation was cancelled"));
                        return undefined;
                    }
                    if (schemaValues.host === "") { schemaValues[value] = 0; }
                    else { schemaValues[value] = newPort; }
                    break;
                }
                break;
            case "user" :
                newUser = await this.userInfo();
                if (newUser === undefined) {
                    vscode.window.showInformationMessage(localize("createNewConnection.undefined.username",
                        "Operation Cancelled"));
                    return undefined;
                }
                schemaValues[value] = newUser;
                break;
            case "password" :
                newPass = await this.passwordInfo();
                if (newPass === undefined) {
                    vscode.window.showInformationMessage(localize("createNewConnection.undefined.username",
                        "Operation Cancelled"));
                    return undefined;
                }
                schemaValues[value] = newPass;
                break;
            case "rejectUnauthorized" :
                newRU = await this.ruInfo();
                if (newRU === undefined) {
                    vscode.window.showInformationMessage(localize("createNewConnection.rejectUnauthorize",
                    "Operation Cancelled"));
                    return undefined;
                }
                schemaValues[value] = newRU;
                break;
            default:
                let options: vscode.InputBoxOptions;
                const response = await this.checkType(schema[value].type);
                switch (response) {
                    case "number" :
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
                    case "boolean" :
                        let isTrue: boolean;
                        isTrue = await this.boolInfo(value, schema);
                        if (isTrue === undefined) {
                            vscode.window.showInformationMessage(localize("createNewConnection.booleanValue",
                            "Operation Cancelled"));
                            return undefined;
                        }
                        schemaValues[value] = isTrue;
                        break;
                    default :
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

        return schemaValues;
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
            canPickMany: false
        };
        const sesName = await vscode.window.showQuickPick(profileNamesList, quickPickList);

        if (sesName === undefined) {
            vscode.window.showInformationMessage(localize("deleteProfile.undefined.profilename",
                "Operation Cancelled"));
            return;
        }

        return allProfiles.find((temprofile) => temprofile.name === sesName);
    }

    public async deleteProfile(datasetTree: IZoweTree<IZoweDatasetTreeNode>, ussTree: IZoweTree<IZoweUSSTreeNode>,
                               jobsProvider: IZoweTree<IZoweJobTreeNode>, node?: IZoweNodeType) {

        let deleteLabel: string;
        let deletedProfile: IProfileLoaded;
        if (!node){ deletedProfile = await this.getDeleteProfile(); }
        else { deletedProfile = node.getProfile(); }

        if (!deletedProfile) { return; }
        deleteLabel = deletedProfile.name;

        const deleteSuccess = await this.deletePrompt(deletedProfile);
        if (!deleteSuccess){
            vscode.window.showInformationMessage(localize("deleteProfile.noSelected",
                "Operation Cancelled"));
            return;
        }

        // Delete from data det file history
        const fileHistory: string[] = datasetTree.getFileHistory();
        fileHistory.slice().reverse()
            .filter((ds) => ds.substring(1, ds.indexOf("]")).trim() === deleteLabel.toUpperCase())
            .forEach((ds) => {
                datasetTree.removeFileHistory(ds);
            });

        // Delete from Data Set Favorites
        datasetTree.mFavorites.forEach((favNode) => {
            const findNode = favNode.label.substring(1, favNode.label.indexOf("]")).trim();
            if (findNode === deleteLabel) {
                datasetTree.removeFavorite(favNode);
                favNode.dirty = true;
                datasetTree.refresh();
            }
        });

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
        fileHistoryUSS.slice().reverse()
            .filter((uss) => uss.substring(1, uss.indexOf("]")).trim()  === deleteLabel.toUpperCase())
            .forEach((uss) => {
                ussTree.removeFileHistory(uss);
            });

        // Delete from USS Favorites
        ussTree.mFavorites.forEach((ses) => {
            const findNode = ses.label.substring(1, ses.label.indexOf("]")).trim();
            if (findNode === deleteLabel) {
                ussTree.removeFavorite(ses);
                ses.dirty = true;
                ussTree.refresh();
            }
        });

        // Delete from USS Tree
        ussTree.mSessionNodes.forEach((sessNode) => {
            if (sessNode.getProfileName() === deleteLabel) {
                ussTree.deleteSession(sessNode);
                sessNode.dirty = true;
                ussTree.refresh();
            }
        });

        // Delete from Jobs Favorites
        jobsProvider.mFavorites.forEach((ses) => {
            const findNode = ses.label.substring(1, ses.label.indexOf("]")).trim();
            if (findNode === deleteLabel) {
                jobsProvider.removeFavorite(ses);
                ses.dirty = true;
                jobsProvider.refresh();
            }
        });

        // Delete from Jobs Tree
        jobsProvider.mSessionNodes.forEach((jobNode) => {
            if (jobNode.getProfileName() === deleteLabel) {
                jobsProvider.deleteSession(jobNode);
                jobNode.dirty = true;
                jobsProvider.refresh();
            }
        });

        // Delete from Data Set Sessions list
        const dsSetting: any = {...vscode.workspace.getConfiguration().get(this.dsSchema)};
        let sessDS: string[] = dsSetting.sessions;
        let faveDS: string[] = dsSetting.favorites;
        sessDS = sessDS.filter( (element) => {
            return element.trim() !== deleteLabel;
        });
        faveDS = faveDS.filter( (element) => {
            return element.substring(1, element.indexOf("]")).trim() !== deleteLabel;
        });
        dsSetting.sessions = sessDS;
        dsSetting.favorites = faveDS;
        await vscode.workspace.getConfiguration().update(this.dsSchema, dsSetting, vscode.ConfigurationTarget.Global);

        // Delete from USS Sessions list
        const ussSetting: any = {...vscode.workspace.getConfiguration().get(this.ussSchema)};
        let sessUSS: string[] = ussSetting.sessions;
        let faveUSS: string[] = ussSetting.favorites;
        sessUSS = sessUSS.filter( (element) => {
            return element.trim() !== deleteLabel;
        });
        faveUSS = faveUSS.filter( (element) => {
            return element.substring(1, element.indexOf("]")).trim() !== deleteLabel;
        });
        ussSetting.sessions = sessUSS;
        ussSetting.favorites = faveUSS;
        await vscode.workspace.getConfiguration().update(this.ussSchema, ussSetting, vscode.ConfigurationTarget.Global);

        // Delete from Jobs Sessions list
        const jobsSetting: any = {...vscode.workspace.getConfiguration().get(this.jobsSchema)};
        let sessJobs: string[] = jobsSetting.sessions;
        let faveJobs: string[] = jobsSetting.favorites;
        sessJobs = sessJobs.filter( (element) => {
            return element.trim() !== deleteLabel;
        });
        faveJobs = faveJobs.filter( (element) => {
            return element.substring(1, element.indexOf("]")).trim() !== deleteLabel;
        });
        jobsSetting.sessions = sessJobs;
        jobsSetting.favorites = faveJobs;
        await vscode.workspace.getConfiguration().update(this.jobsSchema, jobsSetting, vscode.ConfigurationTarget.Global);

        // Remove from list of all profiles
        const index = this.allProfiles.findIndex((deleteItem) => {
            return deleteItem === deletedProfile;
        });
        if (index >= 0) { this.allProfiles.splice(index, 1); }
    }

    public getAllTypes() { return this.allTypes; }

    public async getNamesForType(type: string) {
        const profileManager = await this.getCliProfileManager(type);
        const profilesForType = (await profileManager.loadAll()).filter((profile) => {
            return profile.type === type;
        });
        return profilesForType.map((profile)=> {
            return profile.name;
        });
    }

    public async directLoad(type: string, name: string): Promise<IProfileLoaded> {
        let directProfile: IProfileLoaded;
        const profileManager = await this.getCliProfileManager(type);
        if (profileManager) { directProfile = await profileManager.load({ name }); }

        return directProfile;
    }

    public async getCliProfileManager(type: string): Promise<CliProfileManager> {
        let profileManager = this.profileManagerByType.get(type);
        if (!profileManager) {
            profileManager = await new CliProfileManager({
                profileRootDirectory: path.join(getZoweDir(), "profiles"),
                type
            });
            if (profileManager) { this.profileManagerByType.set(type, profileManager); }
            else { return undefined; }
        }
        return profileManager;
    }

    private async deletePrompt(deletedProfile: IProfileLoaded) {
        const profileName = deletedProfile.name;
        this.log.debug(localize("deleteProfile.log.debug", "Deleting profile ") + profileName);
        const quickPickOptions: vscode.QuickPickOptions = {
            placeHolder: localize("deleteProfile.quickPickOption", "Delete {0}? This will permanently remove it from your system.", profileName),
            ignoreFocusOut: true,
            canPickMany: false
        };
        // confirm that the user really wants to delete
        if (await vscode.window.showQuickPick([localize("deleteProfile.showQuickPick.delete", "Delete"),
                                               localize("deleteProfile.showQuickPick.cancel", "Cancel")], quickPickOptions) !==
                                               localize("deleteProfile.showQuickPick.delete", "Delete")) {
            this.log.debug(localize("deleteProfile.showQuickPick.log.debug", "User picked Cancel. Cancelling delete of profile"));
            return;
        }

        try {
            this.deleteProfileOnDisk(deletedProfile);
        } catch (error) {
            this.log.error(localize("deleteProfile.delete.log.error", "Error encountered when deleting profile! ") + JSON.stringify(error));
            await errorHandling(error, profileName, error.message);
            throw error;
        }

        vscode.window.showInformationMessage("Profile " + profileName + " was deleted.");
        return profileName;
    }

    private async deleteProfileOnDisk(ProfileInfo) {
        let zosmfProfile: IProfile;
        try {
            zosmfProfile = await (await this.getCliProfileManager(ProfileInfo.type))
            .delete({ profile: ProfileInfo, name: ProfileInfo.name, type: ProfileInfo.type });
        } catch (error) { vscode.window.showErrorMessage(error.message); }

        return zosmfProfile.profile;
    }

    // ** Functions for handling Profile Information */

    private async urlInfo(input?) {
        let zosURL: string;

        const urlInputBox = vscode.window.createInputBox();
        if (input) {
            urlInputBox.value = input;
        }
        urlInputBox.ignoreFocusOut = true;
        urlInputBox.placeholder = localize("createNewConnection.option.prompt.url.placeholder", "Optional: https://url:port");
        urlInputBox.prompt = localize("createNewConnection.option.prompt.url",
            "Enter a z/OS URL in the format 'https://url:port'.");

        urlInputBox.show();
        zosURL = await this.getUrl(urlInputBox);
        urlInputBox.dispose();

        return this.validateAndParseUrl(zosURL);
    }

    private async portInfo(input: string, schema: {}){
        let options: vscode.InputBoxOptions;
        let port: number;
        if (schema[input].optionDefinition.hasOwnProperty("defaultValue")){
            options = {
                prompt: schema[input].optionDefinition.description.toString(),
                value: schema[input].optionDefinition.defaultValue.toString()
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
            prompt: localize("createNewConnection.option.prompt.username",
                                     "Enter the user name for the connection."),
            value: userName
        };
        userName = await vscode.window.showInputBox(InputBoxOptions);

        if (userName === undefined) {
            vscode.window.showInformationMessage(localize("createNewConnection.undefined.passWord",
                "Operation Cancelled"));
            return undefined;
        }

        return userName.trim();
    }

    private async passwordInfo(input?) {

        let passWord: string;

        if (input) { passWord = input; }

        InputBoxOptions = {
            placeHolder: localize("createNewConnection.option.prompt.password.placeholder", "Optional: Password"),
            prompt: localize("createNewConnection.option.prompt.password",
                                     "Enter the password for the connection."),
            password: true,
            value: passWord
        };
        passWord = await vscode.window.showInputBox(InputBoxOptions);

        if (passWord === undefined) {
            vscode.window.showInformationMessage(localize("createNewConnection.undefined.passWord",
                "Operation Cancelled"));
            return undefined;
        }

        return passWord.trim();
    }

    private async ruInfo(input?) {

        let rejectUnauthorize: boolean;

        if (input !== undefined) { rejectUnauthorize = input; }

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

        return rejectUnauthorize;
    }

    private async boolInfo(input: string, schema: {}) {
        let isTrue: boolean;
        const description: string = schema[input].optionDefinition.description.toString();
        const quickPickBooleanOptions: vscode.QuickPickOptions = {
            placeHolder: description,
            ignoreFocusOut: true,
            canPickMany: false
        };
        const selectBoolean = ["True", "False"];
        const chosenValue = await vscode.window.showQuickPick(selectBoolean, quickPickBooleanOptions);
        if (chosenValue === selectBoolean[0]) { isTrue = true; }
        else if (chosenValue === selectBoolean[1]) { isTrue = false; }
        else { return undefined; }
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
                value: editValue
            };
        } else if (schema[value].optionDefinition.hasOwnProperty("defaultValue")){
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
        } else { test = input; }
        return test;
    }

    // ** Functions that Calls Get CLI Profile Manager  */

    private async updateProfile(ProfileInfo, rePrompt?: boolean) {
        if (ProfileInfo.type !== undefined) {
            const profileManager = await this.getCliProfileManager(ProfileInfo.type);
            this.loadedProfile = (await profileManager.load({ name: ProfileInfo.name}));
        } else {
            for (const type of ZoweExplorerApiRegister.getInstance().registeredApiTypes()) {
                const profileManager = await this.getCliProfileManager(type);
                this.loadedProfile = (await profileManager.load({ name: ProfileInfo.name }));
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
            } else { OrigProfileInfo[value] = NewProfileInfo[value]; }

        }

        // Using `IUpdateProfileFromCliArgs` here instead of `IUpdateProfile` is
        // kind of a hack, but necessary to support storing secure credentials
        // until this is fixed: https://github.com/zowe/imperative/issues/379
        const updateParms: IUpdateProfileFromCliArgs = {
            name: this.loadedProfile.name,
            merge: true,
            // profile: OrigProfileInfo as IProfile
            args: OrigProfileInfo as any
        };
        try { (await this.getCliProfileManager(this.loadedProfile.type)).update(updateParms); }
        catch (error) { vscode.window.showErrorMessage(error.message); }
    }

    private async saveProfile(ProfileInfo, ProfileName, ProfileType) {
        let newProfile: IProfile;
        try {
            newProfile = await (await this.getCliProfileManager(ProfileType)).save({ profile: ProfileInfo, name: ProfileName, type: ProfileType });
        } catch (error) { vscode.window.showErrorMessage(error.message); }
        return newProfile.profile;
    }
}
