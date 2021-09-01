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

import * as vscode from "vscode";
import * as semver from "semver";
import * as globals from "../globals";

export async function standardizeSettings() {
    // Carry over old settings to new standardized settings only if the migration has not been performed once already on workspace or global scope
    const configurations = vscode.workspace.getConfiguration();

    // Track whether global, workspace or both settings have been migrated to standardized configurations
    const currentVersionNumber = semver.major(
        await vscode.extensions.getExtension("zowe.vscode-extension-for-zowe").packageJSON.version
    );

    let globalIsNotMigrated =
        (await configurations.inspect(globals.SETTINGS_VERSION).globalValue) !== currentVersionNumber;
    let workspaceIsNotMigrated =
        (await configurations.inspect(globals.SETTINGS_VERSION).workspaceValue) !== currentVersionNumber;

    if (globalIsNotMigrated || workspaceIsNotMigrated) {
        const zoweOldConfigurations = Object.keys(configurations).filter((key) =>
            key.match(new RegExp("Zowe-*|Zowe\\s*", "g"))
        );

        // Dictionary describing translation from old configuration names to new standardized names
        const configurationDictionary = {
            "Zowe-Default-Datasets-Binary": "zowe.ds.default.binary",
            "Zowe-Default-Datasets-C": "zowe.ds.default.c",
            "Zowe-Default-Datasets-Classic": "zowe.ds.default.classic",
            "Zowe-Default-Datasets-PDS": "zowe.ds.default.pds",
            "Zowe-Default-Datasets-PS": "zowe.ds.default.ps",
            "Zowe-Temp-Folder-Location": "zowe.files.temporaryDownloadsFolder.path",
            "Zowe Security: Credential Key": "zowe.security.credentialPlugin",
            "Zowe Commands: History": "zowe.commands.history",
            "Zowe Commands: Always edit": "zowe.commands.alwaysEdit",
            "Zowe-Automatic-Validation": "zowe.automaticProfileValidation",
            "Zowe-DS-Persistent": "zowe.ds.history",
            "Zowe-USS-Persistent": "zowe.uss.history",
            "Zowe-Jobs-Persistent": "zowe.jobs.history",
        };

        // Migrate old settings to new settings if any old settings exist and migration has not been run yet
        if (zoweOldConfigurations.length > 0) {
            zoweOldConfigurations.forEach(async (configuration) => {
                // Retrieve the old setting for both scopes
                let globalValue: any = globalIsNotMigrated
                    ? await configurations.inspect(configuration).globalValue
                    : undefined;
                let workspaceValue: any = workspaceIsNotMigrated
                    ? await configurations.inspect(configuration).workspaceValue
                    : undefined;

                // Handle edge case where Zowe-Temp-Folder-Location is migrated but has new schema
                // Reassign value only if object retrieved is not undefined
                if (configuration === "Zowe-Temp-Folder-Location") {
                    globalValue = globalValue ? globalValue.folderPath : globalValue;
                    workspaceValue = workspaceValue ? workspaceValue.folderPath : workspaceValue;
                }

                const newSetting = configurationDictionary[configuration];

                // Handle case where a configuration could be in either workspace or global settings and determine where to migrate
                if (globalIsNotMigrated && globalValue !== undefined && workspaceValue === undefined) {
                    await configurations.update(newSetting, globalValue, vscode.ConfigurationTarget.Global);
                    globalIsNotMigrated = true;
                } else if (workspaceIsNotMigrated && workspaceValue !== undefined && globalValue === undefined) {
                    await configurations.update(newSetting, workspaceValue, vscode.ConfigurationTarget.Workspace);
                    workspaceIsNotMigrated = true;
                } else if (
                    workspaceIsNotMigrated &&
                    globalIsNotMigrated &&
                    workspaceValue !== undefined &&
                    globalValue !== undefined
                ) {
                    await configurations.update(newSetting, globalValue, vscode.ConfigurationTarget.Global);
                    await configurations.update(newSetting, workspaceValue, vscode.ConfigurationTarget.Workspace);
                }
            });

            // Confirm migration is completed so it will not run more than once for either global or workspace settings
            if (globalIsNotMigrated) {
                await configurations.update(
                    globals.SETTINGS_VERSION,
                    currentVersionNumber,
                    vscode.ConfigurationTarget.Global
                );
            }
            if (workspaceIsNotMigrated) {
                await configurations.update(
                    globals.SETTINGS_VERSION,
                    currentVersionNumber,
                    vscode.ConfigurationTarget.Workspace
                );
            }
        }
    }
}
