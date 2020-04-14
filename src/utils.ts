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
import { moveSync } from "fs-extra";
import { Profiles } from "./Profiles";
import { ImperativeConfig } from "@zowe/imperative";

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
 * Moves temp folder to user defined location in preferences
 * @param previousTempPath temp path settings value before updated by user
 * @param currentTempPath temp path settings value after updated by user
 */
export function moveTempFolder(previousTempPath: string, currentTempPath: string) {
    // Re-define globals with updated path
    globals.defineGlobals(currentTempPath);

    if (previousTempPath === "") {
        previousTempPath = path.join(__dirname, "..", "..", "resources");
    }

    // Make certain that "temp" folder is cleared
    cleanTempDir();

    try {
        fs.mkdirSync(globals.ZOWETEMPFOLDER);
        fs.mkdirSync(globals.ZOWE_TMP_FOLDER);
        fs.mkdirSync(globals.USS_DIR);
        fs.mkdirSync(globals.DS_DIR);
    } catch (err) {
        globals.LOG.error(localize("moveTempFolder.error", "Error encountered when creating temporary folder! ") + JSON.stringify(err));
        errorHandling(err, null, localize("moveTempFolder.error", "Error encountered when creating temporary folder! ") + err.message);
    }
    const previousTemp = path.join(previousTempPath, "temp");
    try {
        // If source and destination path are same, exit
        if (previousTemp === globals.ZOWETEMPFOLDER) {
            return;
        }

        // TODO: Possibly remove when supporting "Multiple Instances"
        // If a second instance has already moved the temp folder, exit
        // Ideally, `moveSync()` would alert user if path doesn't exist.
        // However when supporting "Multiple Instances", might not be possible.
        if (!fs.existsSync(previousTemp)) {
            return;
        }

        moveSync(previousTemp, globals.ZOWETEMPFOLDER, { overwrite: true });
    } catch (err) {
        globals.LOG.error("Error moving temporary folder! " + JSON.stringify(err));
        vscode.window.showErrorMessage(err.message);
    }
}

/**
 * function to check if imperative.json contains
 * information about security or not and then
 * Imports the neccesary security modules
 */
export function getSecurityModules(moduleName): NodeRequire | undefined {
  let imperativeIsSecure: boolean = false;
  try {
      const fileName = path.join(getZoweDir(), "settings", "imperative.json");
      let settings: any;
      if (fs.existsSync(fileName)) {
          settings = JSON.parse(fs.readFileSync(fileName).toString());
      }
      const value1 = settings?.overrides.CredentialManager;
      const value2 = settings?.overrides["credential-manager"];
      imperativeIsSecure = ((typeof value1 === "string") && (value1.length > 0)) ||
          ((typeof value2 === "string") && (value2.length > 0));
  } catch (error) {
      globals.LOG.warn(localize("profile.init.read.imperative", "Unable to read imperative file. ") + error.message);
      vscode.window.showWarningMessage(error.message);
      return undefined;
  }
  if (imperativeIsSecure) {
      // Workaround for Theia issue (https://github.com/eclipse-theia/theia/issues/4935)
      const appRoot = globals.ISTHEIA ? process.cwd() : vscode.env.appRoot;
      try {
          return require(`${appRoot}/node_modules/${moduleName}`);
      } catch (err) { /* Do nothing */ }
      try {
          return require(`${appRoot}/node_modules.asar/${moduleName}`);
      } catch (err) { /* Do nothing */ }
      vscode.window.showWarningMessage(localize("initialize.module.load",
          "Credentials not managed, unable to load security file: ") + moduleName);
  }
  return undefined;
}
