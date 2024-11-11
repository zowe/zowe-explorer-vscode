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
import { Constants } from "./configuration/Constants";
import { Profiles } from "./configuration/Profiles";
import { ZoweExplorerApiRegister } from "./extending/ZoweExplorerApiRegister";
import { ZoweExplorerExtender } from "./extending/ZoweExplorerExtender";
import { ZoweLocalStorage } from "./tools/ZoweLocalStorage";
import { ZoweLogger } from "./tools/ZoweLogger";
import { ZoweSaveQueue } from "./tools/ZoweSaveQueue";
import { DatasetInit } from "./trees/dataset/DatasetInit";
import { JobInit } from "./trees/job/JobInit";
import { SharedInit } from "./trees/shared/SharedInit";
import { SharedTreeProviders } from "./trees/shared/SharedTreeProviders";
import { USSInit } from "./trees/uss/USSInit";
import { ProfilesUtils } from "./utils/ProfilesUtils";

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
    await ProfilesUtils.handleV1MigrationStatus();
    await Profiles.createInstance(ZoweLogger.imperativeLogger);

    const providers = await SharedTreeProviders.initializeProviders(
        {
            ds: () => DatasetInit.initDatasetProvider(context),
            uss: () => USSInit.initUSSProvider(context),
            job: () => JobInit.initJobsProvider(context),
        },
        async () => {
            await SharedInit.setupRemoteWorkspaceFolders();
        }
    );
    SharedInit.registerCommonCommands(context, providers);
    SharedInit.registerZosConsoleView(context);
    ZoweExplorerExtender.createInstance(providers.ds, providers.uss, providers.job);

    SharedInit.watchConfigProfile(context);
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
    Constants.ACTIVATED = false;
    ZoweLogger.disposeZoweLogger();
}
