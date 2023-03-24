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
import { Gui } from "@zowe/zowe-explorer-api";
import * as vscode from "vscode";
import * as nls from "vscode-nls";
import * as globals from "../globals";
import { SettingsConfig } from "./SettingsConfig";

// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

export async function initializeZoweLogger(context: vscode.ExtensionContext): Promise<void> {
    const logsFolder: string = SettingsConfig.getDirectValue(this.SETTINGS_LOGS_FOLDER_PATH) || context.extensionPath;
    try {
        try {
            fs.accessSync(logsFolder, fs.constants.W_OK);
        } catch (err) {
            throw new Error(localize("initialize.logsFolder.readonly", "Missing write access to logs folder: {0}", logsFolder));
        }
        globals.initLogger(logsFolder);
        globals.LOG.debug(localize("initialize.log.debug", "Initialized logger from VSCode extension"));
    } catch (err) {
        globals.LOG.error(err);
        const errorMessage = localize("initialize.log.error", "Error encountered while activating and initializing logger! ");
        await Gui.errorMessage(`${errorMessage}: ${err.message}`);
    }
}
