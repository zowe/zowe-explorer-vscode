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
import { SettingsConfig } from "../configuration/SettingsConfig";
import { ZoweLogger } from "../tools/ZoweLogger";

export class TableViewUtils {
    /**
     * Initialize and set up configuration listener
     * The setting controls showZoweResources context variable
     */
    public static async initialize(context: vscode.ExtensionContext): Promise<void> {
        // Set initial value based on setting
        await this.updateShowZoweResourcesContext();

        // Register configuration change listener for instant updates
        this.registerConfigurationChangeListener(context);
    }

    /**
     * Updates the showZoweResources context variable based on the setting
     *
     */
    public static async updateShowZoweResourcesContext(): Promise<void> {
        // Get the user setting from Feature Enablement category
        const tableViewEnabled = SettingsConfig.getDirectValue<boolean>("zowe.featureEnablement.tableView", false);

        // Update showZoweResources based on setting
        // When true: override to true (user wants table)
        // When false: set to false (hide table)
        const showZoweResources = tableViewEnabled === true ? true : false;

        // Set the context variable
        await vscode.commands.executeCommand("setContext", "zowe.vscode-extension-for-zowe.showZoweResources", showZoweResources);

        // Log for debugging
        ZoweLogger.debug(`[updateShowZoweResourcesContext] featureEnablement.tableView: ${String(tableViewEnabled)}`);
        ZoweLogger.debug(`[updateShowZoweResourcesContext] showZoweResources (set to): ${String(showZoweResources)}`);
    }

    /**
     * Registers a configuration change listener to update the context when settings change
     * This ensures instant updates without requiring extension reload
     */
    private static registerConfigurationChangeListener(context: vscode.ExtensionContext): void {
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(async (e) => {
                // Respond to setting changes instantly
                if (e.affectsConfiguration("zowe.featureEnablement.tableView")) {
                    ZoweLogger.debug("[ConfigListener] zowe.featureEnablement.tableView changed, updating showZoweResources context...");
                    await TableViewUtils.updateShowZoweResourcesContext();
                }
            })
        );
    }
}
