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

// Dictionary describing translation from old configuration names to new standardized names
const configurationDictionary = {
    "Zowe-Default-Datasets-Binary": globals.SETTINGS_DS_DEFAULT_BINARY,
    "Zowe-Default-Datasets-C": globals.SETTINGS_DS_DEFAULT_C,
    "Zowe-Default-Datasets-Classic": globals.SETTINGS_DS_DEFAULT_CLASSIC,
    "Zowe-Default-Datasets-PDS": globals.SETTINGS_DS_DEFAULT_PDS,
    "Zowe-Default-Datasets-PS": globals.SETTINGS_DS_DEFAULT_PS,
    "Zowe-Temp-Folder-Location": globals.SETTINGS_TEMP_FOLDER_PATH,
    "Zowe Security: Credential Key": globals.SETTINGS_SECURITY_CREDENTIAL_PLUGIN,
    "Zowe Commands: History": globals.SETTINGS_COMMANDS_HISTORY,
    "Zowe Commands: Always edit": globals.SETTINGS_COMMANDS_ALWAYS_EDIT,
    "Zowe-Automatic-Validation": globals.SETTINGS_AUTOMATIC_PROFILE_VALIDATION,
    "Zowe-DS-Persistent": globals.SETTINGS_DS_HISTORY,
    "Zowe-USS-Persistent": globals.SETTINGS_USS_HISTORY,
    "Zowe-Jobs-Persistent": globals.SETTINGS_JOBS_HISTORY,
};

const configurations = vscode.workspace.getConfiguration();

const zoweOldConfigurations = Object.keys(configurations).filter((key) =>
    key.match(new RegExp("Zowe-*|Zowe\\s*", "g"))
);

const currentVersionNumber = semver.major(
    vscode.extensions.getExtension("zowe.vscode-extension-for-zowe").packageJSON.version
);

export async function standardizeGlobalSettings() {
    let globalIsMigrated =
        (await configurations.inspect(globals.SETTINGS_VERSION).globalValue) !== currentVersionNumber;

    // Standardize global settings when old Zowe settings were found
    if (zoweOldConfigurations.length > 0) {
        zoweOldConfigurations.forEach(async (configuration) => {
            let globalValue: any = await configurations.inspect(configuration).globalValue;

            // Adjust fetching of value due to schema change
            if (configuration === "Zowe-Temp-Folder-Location") {
                globalValue = globalValue ? globalValue.folderPath : globalValue;
            }

            const newSetting = configurationDictionary[configuration];

            if (globalValue !== undefined) {
                await configurations.update(newSetting, globalValue, vscode.ConfigurationTarget.Global);
                globalIsMigrated = true;
            }
        });
    }

    if (globalIsMigrated) {
        await configurations.update(globals.SETTINGS_VERSION, currentVersionNumber, vscode.ConfigurationTarget.Global);
    }
}

export async function standardizeWorkspaceSettings() {
    let workspaceIsNotMigrated =
        (await configurations.inspect(globals.SETTINGS_VERSION).workspaceValue) !== currentVersionNumber;

    // Standardize workspace settings when old Zowe settings were found
    if (zoweOldConfigurations.length > 0) {
        zoweOldConfigurations
            .filter((c) => !c.match(new RegExp("Zowe-[A-Za-z]+-Persistent|Zowe Commands: History", "g")))
            .forEach(async (configuration) => {
                let workspaceValue: any = await configurations.inspect(configuration).workspaceValue;

                if (configuration === "Zowe-Temp-Folder-Location") {
                    workspaceValue = workspaceValue ? workspaceValue.folderPath : workspaceValue;
                }

                const newSetting = configurationDictionary[configuration];

                if (workspaceValue !== undefined) {
                    await configurations.update(newSetting, workspaceValue, vscode.ConfigurationTarget.Workspace);
                    workspaceIsNotMigrated = true;
                }
            });
    }

    if (workspaceIsNotMigrated) {
        await configurations.update(
            globals.SETTINGS_VERSION,
            currentVersionNumber,
            vscode.ConfigurationTarget.Workspace
        );
    }
}

export async function standardizeSettings() {
    const globalIsNotMigrated =
        (await configurations.inspect(globals.SETTINGS_VERSION).globalValue) !== currentVersionNumber;
    const workspaceIsNotMigrated =
        (await configurations.inspect(globals.SETTINGS_VERSION).workspaceValue) !== currentVersionNumber;
    const workspaceIsOpen = vscode.workspace.workspaceFolders !== undefined;

    if (globalIsNotMigrated) {
        await standardizeGlobalSettings();
    }
    if (workspaceIsNotMigrated && workspaceIsOpen) {
        await standardizeWorkspaceSettings();
    }
}
