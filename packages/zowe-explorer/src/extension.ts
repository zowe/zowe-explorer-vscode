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
    ZoweLocalStorage.initializeZoweLocalStorage(context.globalState, context.workspaceState);
    await SharedInit.initZoweLogger(context);

    await ProfilesUtils.initializeZoweProfiles((msg) => ZoweExplorerExtender.showZoweConfigError(msg));
    await ProfilesUtils.handleV1MigrationStatus();
    await Profiles.createInstance(ZoweLogger.imperativeLogger);
    await migrateShowHiddenFilesDefault(context);

    const providers = await SharedTreeProviders.initializeProviders({
        ds: () => DatasetInit.initDatasetProvider(context),
        uss: () => USSInit.initUSSProvider(context),
        job: () => JobInit.initJobsProvider(context),
    });
    SharedInit.registerCommonCommands(context, providers);
    SharedInit.registerZosConsoleView(context);
    ZoweExplorerExtender.createInstance(providers.ds, providers.uss, providers.job);

    SharedInit.watchConfigProfile(context);
    await SharedInit.watchForZoweButtonClick();

    SharedInit.onDidActivateExtensionEmitter.fire();
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
/**
 * Called by the activate function to monitor the default value of setting showHiddenFiles
 *
 * @export
 */
export async function migrateShowHiddenFilesDefault(context: vscode.ExtensionContext): Promise<void> {
    const MIGRATION_KEY = "showHiddenFiles.defaultMigrated";
    const config = vscode.workspace.getConfiguration("zowe.files");

    if (context.globalState.get(MIGRATION_KEY)) {
        return;
    }

    // Check if user has explicitly set the value
    const inspectResult = config.inspect<boolean>("ShowHiddenFiles.disabled");
    const hasUserValue = inspectResult?.globalValue !== undefined || inspectResult?.workspaceValue !== undefined;

    if (!hasUserValue) {
        // Get current extension version
        const extensionVersion = context.extension.packageJSON.version;
        const majorVersion = parseInt(extensionVersion.split(".")[0]);

        // Set default based on version
        const defaultValue = majorVersion <= 3 ? true : false;
        await config.update("ShowHiddenFiles.disabled", defaultValue, vscode.ConfigurationTarget.Global);
    }

    // Mark migration as complete
    await context.globalState.update(MIGRATION_KEY, true);
}
