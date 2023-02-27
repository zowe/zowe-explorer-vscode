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

import * as globals from "./globals";
import * as vscode from "vscode";
import { getZoweDir } from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "./ZoweExplorerApiRegister";
import { ZoweExplorerExtender } from "./ZoweExplorerExtender";
import { Profiles } from "./Profiles";
import { initializeZoweProfiles } from "./utils/ProfilesUtils";
import { initializeSpoolProvider } from "./SpoolProvider";
import { cleanTempDir, hideTempFolder } from "./utils/TempFolder";
import { SettingsConfig } from "./utils/SettingsConfig";
import { initDatasetProvider } from "./dataset/init";
import { initUSSProvider } from "./uss/init";
import { initJobsProvider } from "./job/init";
import { IZoweProviders, registerCommonCommands, registerRefreshCommand, watchConfigProfile } from "./shared/init";
import { initializeZoweLogger } from "./utils/LoggerUtils";
import { ZoweSaveManager } from "./abstract/ZoweSaveManager";

/**
 * The function that runs when the extension is loaded
 *
 * @export
 * @param {vscode.ExtensionContext} context - Context of vscode at the time that the function is called
 * @returns {Promise<ZoweExplorerApiRegister>}
 */
export async function activate(context: vscode.ExtensionContext): Promise<ZoweExplorerApiRegister> {
    // Get temp folder location from settings
    const tempPath: string = SettingsConfig.getDirectValue(globals.SETTINGS_TEMP_FOLDER_PATH);

    // Determine the runtime framework to support special behavior for Theia
    globals.defineGlobals(tempPath);

    hideTempFolder(getZoweDir());

    await initializeZoweLogger(context);
    await initializeZoweProfiles();

    // Initialize profile manager
    await Profiles.createInstance(globals.LOG);

    registerRefreshCommand(context, activate, deactivate);

    initializeSpoolProvider(context);

    const providers: IZoweProviders = {
        ds: await initDatasetProvider(context),
        uss: await initUSSProvider(context),
        job: await initJobsProvider(context),
    };

    await registerCommonCommands(context, providers);

    ZoweExplorerExtender.createInstance(providers.ds, providers.uss, providers.job);
    await SettingsConfig.standardizeSettings();
    await watchConfigProfile(context, providers);
    globals.setActivated(true);
    return ZoweExplorerApiRegister.getInstance();
}
/**
 * Called by VSCode on shutdown
 *
 * @export
 */
export async function deactivate() {
    await ZoweSaveManager.waitForQueue();
    await cleanTempDir();
    globals.setActivated(false);
}
