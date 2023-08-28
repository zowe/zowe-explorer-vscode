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

import * as globals from "./globals";
import * as vscode from "vscode";
import { getZoweDir } from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "./ZoweExplorerApiRegister";
import { ZoweExplorerExtender } from "./ZoweExplorerExtender";
import { Profiles } from "./Profiles";
import { ProfilesUtils } from "./utils/ProfilesUtils";
import { initializeSpoolProvider } from "./SpoolProvider";
import { cleanTempDir, hideTempFolder } from "./utils/TempFolder";
import { SettingsConfig } from "./utils/SettingsConfig";
import { initDatasetProvider } from "./dataset/init";
import { initUSSProvider } from "./uss/init";
import { initJobsProvider } from "./job/init";
import { IZoweProviders, registerCommonCommands, registerRefreshCommand, watchConfigProfile } from "./shared/init";
import { ZoweLogger } from "./utils/LoggerUtils";
import { ZoweSaveQueue } from "./abstract/ZoweSaveQueue";
import { PollDecorator } from "./utils/DecorationProviders";

/**
 * The function that runs when the extension is loaded
 *
 * @export
 * @param {vscode.ExtensionContext} context - Context of vscode at the time that the function is called
 * @returns {Promise<ZoweExplorerApiRegister>}
 */
export async function activate(context: vscode.ExtensionContext): Promise<ZoweExplorerApiRegister> {
    await ZoweLogger.initializeZoweLogger(context);
    // Get temp folder location from settings
    const tempPath: string = SettingsConfig.getDirectValue(globals.SETTINGS_TEMP_FOLDER_PATH);
    // Determine the runtime framework to support special behavior for Theia
    globals.defineGlobals(tempPath);

    await hideTempFolder(getZoweDir());
    await ProfilesUtils.initializeZoweProfiles();
    ProfilesUtils.initializeZoweTempFolder();

    // Initialize profile manager
    await Profiles.createInstance(globals.LOG);
    registerRefreshCommand(context, activate, deactivate);
    initializeSpoolProvider(context);

    PollDecorator.register();

    const providers: IZoweProviders = {
        ds: await initDatasetProvider(context),
        uss: await initUSSProvider(context),
        job: await initJobsProvider(context),
    };

    registerCommonCommands(context, providers);
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
export async function deactivate(): Promise<void> {
    await ZoweSaveQueue.all();
    await cleanTempDir();
    globals.setActivated(false);
    ZoweLogger.disposeZoweLogger();
}
