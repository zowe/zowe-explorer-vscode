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
import * as vscode from "vscode";
import { moveSync } from "fs-extra";
import { Gui } from "@zowe/zowe-explorer-api";
import { SettingsConfig } from "./SettingsConfig";
import { Constants } from "./Constants";
import { ZoweLogger } from "../tools/ZoweLogger";
import { AuthUtils } from "../utils/AuthUtils";
import { ExtensionUtils } from "../utils/ExtensionUtils";

export class TempFolder {
    /**
     * Moves temp folder to user defined location in preferences
     * @param previousTempPath temp path settings value before updated by user
     * @param currentTempPath temp path settings value after updated by user
     */
    public static async moveTempFolder(previousTempPath: string, currentTempPath: string): Promise<void> {
        ZoweLogger.trace("TempFolder.moveTempFolder called.");
        // Re-define globals with updated path
        ExtensionUtils.defineConstants(currentTempPath);

        if (previousTempPath === "") {
            previousTempPath = path.join(__dirname, "..", "..", "resources");
        }

        // Make certain that "temp" folder is cleared
        await TempFolder.cleanTempDir();

        try {
            fs.mkdirSync(Constants.ZOWETEMPFOLDER);
            fs.mkdirSync(Constants.ZOWE_TMP_FOLDER);
            fs.mkdirSync(Constants.USS_DIR);
            fs.mkdirSync(Constants.DS_DIR);
        } catch (err) {
            if (err instanceof Error) {
                await AuthUtils.errorHandling(err, null, vscode.l10n.t("Error encountered when creating temporary folder!"));
            }
        }
        const previousTemp = path.join(previousTempPath, "temp");
        try {
            // If source and destination path are same, exit
            if (previousTemp === Constants.ZOWETEMPFOLDER) {
                return;
            }

            // TODO: Possibly remove when supporting "Multiple Instances"
            // If a second instance has already moved the temp folder, exit
            // Ideally, `moveSync()` would alert user if path doesn't exist.
            // However when supporting "Multiple Instances", might not be possible.
            if (!fs.existsSync(previousTemp)) {
                return;
            }

            moveSync(previousTemp, Constants.ZOWETEMPFOLDER, { overwrite: true });
        } catch (err) {
            ZoweLogger.error("Error moving temporary folder! " + JSON.stringify(err));
            if (err instanceof Error) {
                Gui.errorMessage(err.message);
            }
        }
    }

    /**
     * Recursively deletes directory
     *
     * @param directory path to directory to be deleted
     */
    public static cleanDir(directory: string): void {
        ZoweLogger.trace("TempFolder.cleanDir called.");
        if (!fs.existsSync(directory)) {
            return;
        }
        fs.readdirSync(directory).forEach((file) => {
            const fullpath = path.join(directory, file);
            const lstat = fs.lstatSync(fullpath);
            if (lstat.isFile()) {
                fs.unlinkSync(fullpath);
            } else {
                TempFolder.cleanDir(fullpath);
            }
        });
        fs.rmdirSync(directory);
    }

    /**
     * Cleans up local temp directory
     *
     * @export
     */
    public static cleanTempDir(): Promise<void> {
        ZoweLogger.trace("TempFolder.cleanTempDir called.");
        // Get temp folder cleanup preference from settings
        const preferencesTempCleanupEnabled: boolean = SettingsConfig.getDirectValue(Constants.SETTINGS_TEMP_FOLDER_CLEANUP);
        // logger hasn't necessarily been initialized yet, don't use the `log` in this function
        if (!fs.existsSync(Constants.ZOWETEMPFOLDER) || !preferencesTempCleanupEnabled) {
            return;
        }
        try {
            TempFolder.cleanDir(Constants.ZOWETEMPFOLDER);
        } catch (err) {
            ZoweLogger.error(err);
            if (err instanceof Error) {
                Gui.errorMessage(
                    vscode.l10n.t({
                        message: "Unable to delete temporary folder. {0}",
                        args: [err.message],
                        comment: ["Error message"],
                    })
                );
            }
        }
    }

    /**
     * Hides local temp directory from workspace
     *
     * @export
     */
    public static async hideTempFolder(zoweDir: string): Promise<void> {
        ZoweLogger.trace("TempFolder.hideTempFolder called.");
        if (SettingsConfig.getDirectValue<boolean>(Constants.SETTINGS_TEMP_FOLDER_HIDE)) {
            await SettingsConfig.setDirectValue("files.exclude", { [zoweDir]: true, [Constants.ZOWETEMPFOLDER]: true });
        }
    }
}
