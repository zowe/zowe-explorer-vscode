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

import * as vscode from "vscode";
import * as globals from "./globals";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Profiles } from "./Profiles";
import { ImperativeConfig } from "@zowe/imperative";
import { DatasetTree } from "./dataset/DatasetTree";
import { ZosJobsProvider } from "./job/ZosJobsProvider";
import { USSTree } from "./uss/USSTree";
import { IZoweTree } from "./api/IZoweTree";
import { IZoweDatasetTreeNode, IZoweJobTreeNode, IZoweUSSTreeNode } from "./api/IZoweTreeNode";
import { ZoweExplorerApiRegister } from "./api/ZoweExplorerApiRegister";

import * as nls from "vscode-nls";
const localize = nls.config({messageFormat: nls.MessageFormat.file})();

/*************************************************************************************************************
 * Error Handling
 * @param {errorDetails} error.mDetails
 * @param {label} - additional information such as profile name, credentials, messageID etc
 * @param {moreInfo} - additional/customized error messages
 *************************************************************************************************************/
export function errorHandling(errorDetails: any, label?: string, moreInfo?: string) {
    let httpErrCode = null;
    const errMsg = localize("errorHandling.invalid.credentials", "Invalid Credentials. Please ensure the username and password for ") +
        `\n${label}\n` + localize("errorHandling.invalid.credentials2"," are valid or this may lead to a lock-out.");

    if (errorDetails.mDetails !== undefined) {
        httpErrCode = errorDetails.mDetails.errorCode;
    }

    switch(httpErrCode) {
        // tslint:disable-next-line: no-magic-numbers
        case 401:
            if (label.includes("[")) {
                label = label.substring(0, label.indexOf(" ["));
            }

            if (globals.ISTHEIA) {
                vscode.window.showErrorMessage(errMsg);
                Profiles.getInstance().promptCredentials(label.trim());
            } else {
                vscode.window.showErrorMessage(errMsg, "Check Credentials").then((selection) => {
                    if (selection) {
                        Profiles.getInstance().promptCredentials(label.trim(), true);
                    }
                });
            }
            break;
        default:
            vscode.window.showErrorMessage(moreInfo + " " +  errorDetails);
            break;
    }
    return;
}

export async function resolveQuickPickHelper(quickpick: vscode.QuickPick<vscode.QuickPickItem>): Promise<vscode.QuickPickItem | undefined> {
    return new Promise<vscode.QuickPickItem | undefined>(
        (c) => quickpick.onDidAccept(() => c(quickpick.activeItems[0])));
}

// tslint:disable-next-line: max-classes-per-file
export class FilterItem implements vscode.QuickPickItem {
    constructor(private text: string, private desc?: string) { }
    get label(): string { return this.text; }
    get description(): string { if (this.desc) { return this.desc; } else { return ""; } }
    get alwaysShow(): boolean { return false; }
}

// tslint:disable-next-line: max-classes-per-file
export class FilterDescriptor implements vscode.QuickPickItem {
    constructor(private text: string) { }
    get label(): string { return this.text; }
    get description(): string { return ""; }
    get alwaysShow(): boolean { return true; }
}

/**
 * Function to retrieve the home directory. In the situation Imperative has
 * not initialized it we mock a default value.
 */
export function getZoweDir(): string {
    ImperativeConfig.instance.loadedConfig = {
        defaultHome: path.join(os.homedir(), ".zowe"),
        envVariablePrefix: "ZOWE"
    };
    return ImperativeConfig.instance.cliHome;
}

/**
 * Recursively deletes directory
 *
 * @param directory path to directory to be deleted
 */
export function cleanDir(directory) {
  if (!fs.existsSync(directory)) {
      return;
  }
  fs.readdirSync(directory).forEach((file) => {
      const fullpath = path.join(directory, file);
      const lstat = fs.lstatSync(fullpath);
      if (lstat.isFile()) {
          fs.unlinkSync(fullpath);
      } else {
          cleanDir(fullpath);
      }
  });
  fs.rmdirSync(directory);
}

/**
 * Cleans up local temp directory
 *
 * @export
 */
export async function cleanTempDir() {
  // logger hasn't necessarily been initialized yet, don't use the `log` in this function
  if (!fs.existsSync(globals.ZOWETEMPFOLDER)) {
      return;
  }
  try {
      cleanDir(globals.ZOWETEMPFOLDER);
  } catch (err) {
      vscode.window.showErrorMessage(localize("deactivate.error", "Unable to delete temporary folder. ") + err);
  }
}

/**
 * Adds a new Profile to the provided treeview by clicking the 'Plus' button and
 * selecting which profile you would like to add from the drop-down that appears.
 * The profiles that are in the tree view already will not appear in the drop-down.
 *
 * @export
 * @param {USSTree} zoweNodeProvider - either the USS, MVS, JES tree
 */
export async function addZoweSession(zoweNodeProvider: IZoweTree<IZoweDatasetTreeNode|IZoweUSSTreeNode|IZoweJobTreeNode>) {
  const allProfiles = (await Profiles.getInstance()).allProfiles;

  // Get all profiles
  let profileNamesList = allProfiles.map((profile) => {
      return profile.name;
  });

  // Filter to list of the APIs available for current tree explorer
  profileNamesList = filterProfileNames(zoweNodeProvider, profileNamesList);

  // Select a profile regardless of whether we are in Theia or not
  // IFF this function is made into a class, sharing information would be simpler between functions. Also functions will be properly protected
  const { chosenProfile, quickpickValue } = await selectProfile(profileNamesList);

  if (chosenProfile === "") {
    // Create profile
    await createProfile(zoweNodeProvider, quickpickValue);
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
function filterProfileNames(zoweNodeProvider: IZoweTree<IZoweDatasetTreeNode|IZoweUSSTreeNode|IZoweJobTreeNode>, profileNamesList: string[]) {
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
async function selectProfile(profileNamesList: string[]) {
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
async function createProfile(zoweNodeProvider: IZoweTree<IZoweDatasetTreeNode|IZoweUSSTreeNode|IZoweJobTreeNode>, quickpickValue: string) {
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
      await zoweNodeProvider.refresh();
  }
}
