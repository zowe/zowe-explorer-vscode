/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 */

import * as fs from "fs";
import * as path from "path";
import * as globals from "../globals";
import { moveSync } from "fs-extra";
import * as nls from "vscode-nls";
import { errorHandling } from "../utils/ProfilesUtils";
import { SettingsConfig } from "./SettingsConfig";
import { Gui } from "@zowe/zowe-explorer-api";

// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

// /**
//  * Moves temp folder to user defined location in preferences
//  * @param previousTempPath temp path settings value before updated by user
//  * @param currentTempPath temp path settings value after updated by user
//  */
export async function moveTempFolder(previousTempPath: string, currentTempPath: string) {
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
        await errorHandling(err, null, localize("moveTempFolder.error", "Error encountered when creating temporary folder!"));
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
        Gui.errorMessage(err.message);
    }
}

/**
 * Recursively deletes directory
 *
 * @param directory path to directory to be deleted
 */
export async function cleanDir(directory) {
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
    // Get temp folder cleanup preference from settings
    const preferencesTempCleanupEnabled: boolean = SettingsConfig.getDirectValue(globals.SETTINGS_TEMP_FOLDER_CLEANUP);
    // logger hasn't necessarily been initialized yet, don't use the `log` in this function
    if (!fs.existsSync(globals.ZOWETEMPFOLDER) || !preferencesTempCleanupEnabled) {
        return;
    }
    try {
        await cleanDir(globals.ZOWETEMPFOLDER);
    } catch (err) {
        globals.LOG.error(err);
        Gui.errorMessage(localize("deactivate.error", "Unable to delete temporary folder. ") + err);
    }
}

/**
 * Hides local temp directory from workspace
 *
 * @export
 */
export async function hideTempFolder(zoweDir: string) {
    if (SettingsConfig.getDirectValue<boolean>(globals.SETTINGS_TEMP_FOLDER_HIDE)) {
        await SettingsConfig.setDirectValue("files.exclude", { [zoweDir]: true, [globals.ZOWETEMPFOLDER]: true });
    }
}
