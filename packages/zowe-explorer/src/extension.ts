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
import { ZoweExplorerApiRegister } from "./ZoweExplorerApiRegister";
import { ZoweExplorerExtender } from "./ZoweExplorerExtender";
import { Profiles } from "./Profiles";
import { ProfilesUtils } from "./utils/ProfilesUtils";
import { cleanTempDir } from "./utils/TempFolder";
import { initZoweLogger, registerCommonCommands, registerRefreshCommand, watchConfigProfile, watchForZoweButtonClick } from "./shared/init";
import { ZoweLogger } from "./utils/ZoweLogger";
import { ZoweSaveQueue } from "./abstract/ZoweSaveQueue";
import { ZoweLocalStorage } from "./utils/ZoweLocalStorage";
import { TreeProviders } from "./shared/TreeProviders";
import { initDatasetProvider } from "./dataset/init";
import { initUSSProvider } from "./uss/init";
import { initJobsProvider } from "./job/init";

/**
 * The function that runs when the extension is loaded
 *
 * @export
 * @param {vscode.ExtensionContext} context - Context of vscode at the time that the function is called
 * @returns {Promise<ZoweExplorerApiRegister>}
 */
export async function activate(context: vscode.ExtensionContext): Promise<ZoweExplorerApiRegister> {
    ZoweLocalStorage.initializeZoweLocalStorage(context.globalState);
    await initZoweLogger(context);

    await ProfilesUtils.initializeZoweProfiles((msg) => ZoweExplorerExtender.showZoweConfigError(msg));
    await Profiles.createInstance(ZoweLogger.imperativeLogger);

    const providers = await TreeProviders.initializeProviders(context, { ds: initDatasetProvider, uss: initUSSProvider, job: initJobsProvider });
    registerCommonCommands(context, providers);
    registerRefreshCommand(context, activate, deactivate);
    ZoweExplorerExtender.createInstance(providers.ds, providers.uss, providers.job);

    watchConfigProfile(context, providers);
    await watchForZoweButtonClick();

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
