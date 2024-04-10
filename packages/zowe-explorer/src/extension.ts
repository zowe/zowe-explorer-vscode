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

import * as vscode from "vscode";
import { ZoweExplorerExtender, ZoweExplorerApiRegister } from "./extending";
import { Profiles, TempFolder, Constants } from "./configuration";
import { ProfilesUtils } from "./utils";
import { SpoolProvider } from "./providers";
import { SharedInit, SharedTreeProviders } from "./trees/shared";
import { ZoweLogger, ZoweSaveQueue, ZoweLocalStorage } from "./tools";
import { DatasetInit } from "./trees/dataset";
import { USSInit } from "./trees/uss";
import { JobInit } from "./trees/job";

/**
 * The function that runs when the extension is loaded
 *
 * @export
 * @param {vscode.ExtensionContext} context - Context of vscode at the time that the function is called
 * @returns {Promise<ZoweExplorerApiRegister>}
 */
export async function activate(context: vscode.ExtensionContext): Promise<ZoweExplorerApiRegister> {
    ZoweLocalStorage.initializeZoweLocalStorage(context.globalState);
    await SharedInit.initZoweLogger(context);

    await ProfilesUtils.initializeZoweProfiles((msg) => ZoweExplorerExtender.showZoweConfigError(msg));
    await Profiles.createInstance(ZoweLogger.imperativeLogger);
    SpoolProvider.initializeSpoolProvider(context);

    const providers = await SharedTreeProviders.initializeProviders({
        ds: () => DatasetInit.initDatasetProvider(context),
        uss: () => USSInit.initUSSProvider(context),
        job: () => JobInit.initJobsProvider(context),
    });
    SharedInit.registerCommonCommands(context, providers);
    SharedInit.registerRefreshCommand(context, activate, deactivate);
    ZoweExplorerExtender.createInstance(providers.ds, providers.uss, providers.job);

    await SharedInit.watchConfigProfile(context, providers);
    await SharedInit.watchForZoweButtonClick();

    return ZoweExplorerApiRegister.getInstance();
}
/**
 * Called by VSCode on shutdown
 *
 * @export
 */
export async function deactivate(): Promise<void> {
    await ZoweSaveQueue.all();
    TempFolder.cleanDir(Constants.ZOWETEMPFOLDER);
    Constants.setActivated(false);
    ZoweLogger.disposeZoweLogger();
}
