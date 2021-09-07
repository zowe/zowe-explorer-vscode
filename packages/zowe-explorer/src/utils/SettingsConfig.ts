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
                console.log(configuration);
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

    if (globalIsNotMigrated) standardizeGlobalSettings();
    if (workspaceIsNotMigrated && workspaceIsOpen) standardizeWorkspaceSettings();
}
