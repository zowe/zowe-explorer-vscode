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

import * as fs from "fs";
import * as path from "path";
import * as globals from "../globals";
import * as vscode from "vscode";
import { moveSync } from "fs-extra";
declare const __webpack_require__: typeof require;
declare const __non_webpack_require__: typeof require;
import * as nls from "vscode-nls";
import { errorHandling, getZoweDir } from "../utils/ProfilesUtils";

// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

/**
 * function to check if imperative.json contains
 * information about security or not and then
 * Imports the neccesary security modules
 */
export function getSecurityModules(moduleName): NodeRequire | undefined {
    let imperativeIsSecure: boolean = false;
    const r = typeof __webpack_require__ === "function" ? __non_webpack_require__ : require;
    try {
        const fileName = path.join(getZoweDir(), "settings", "imperative.json");
        let settings: any;
        if (fs.existsSync(fileName)) {
            settings = JSON.parse(fs.readFileSync(fileName).toString());
        }
        const value1 = settings?.overrides.CredentialManager;
        const value2 = settings?.overrides["credential-manager"];
        imperativeIsSecure =
            (typeof value1 === "string" && value1.length > 0) || (typeof value2 === "string" && value2.length > 0);
    } catch (error) {
        globals.LOG.warn(localize("profile.init.read.imperative", "Unable to read imperative file. ") + error.message);
        vscode.window.showWarningMessage(error.message);
        return undefined;
    }
    if (imperativeIsSecure) {
        // Workaround for Theia issue (https://github.com/eclipse-theia/theia/issues/4935)
        const appRoot = globals.ISTHEIA ? process.cwd() : vscode.env.appRoot;
        try {
            return r(`${appRoot}/node_modules/${moduleName}`);
        } catch (err) {
            /* Do nothing */
        }
        try {
            return r(`${appRoot}/node_modules.asar/${moduleName}`);
        } catch (err) {
            /* Do nothing */
        }
        vscode.window.showWarningMessage(
            localize("initialize.module.load", "Credentials not managed, unable to load security file: ") + moduleName
        );
    }
    return undefined;
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
        globals.LOG.error(
            localize("moveTempFolder.error", "Error encountered when creating temporary folder! ") + JSON.stringify(err)
        );
        errorHandling(
            err,
            null,
            localize("moveTempFolder.error", "Error encountered when creating temporary folder! ") + err.message
        );
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
