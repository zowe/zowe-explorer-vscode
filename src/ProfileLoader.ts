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

import { spawnSync } from "child_process";
import * as path from "path";
import { IProfileLoaded, Logger } from "@brightside/imperative";
import * as vscode from "vscode";
import * as nls from "vscode-nls";
const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

/**
 * Load all profiles by spawning a script that uses the users' globally installed
 * 'node' command. This should work regardless of what credential manager plugins
 * the user has installed
 */
export function loadAllProfiles(): IProfileLoaded[] {
    const getProfileProcess = spawnSync("node", [path.join(__dirname, "getAllProfiles.js")]);

    if (getProfileProcess.status !== 0) {
        throw new Error(localize("loadAllProfiles.error.spawnProcess", "Failed to spawn process to retrieve profile contents!\n") +
            getProfileProcess.stderr.toString());
    }
    if (getProfileProcess.stdout.toString().length === 0) {
        throw new Error(localize("loadAllProfiles.error.loadAll1",
            "Error attempting to load all zosmf profiles.") +
            localize("loadAllProfiles.error.loadAll2",
                "Please ensure that you have created at least one profile with Zowe CLI before attempting to use this extension. Error text:")
            + getProfileProcess.stderr.toString());
    }

    return JSON.parse(getProfileProcess.stdout.toString());
}

/**
 * Load a specific profile. Works the same way as loadAllProfiles, then
 * finds the specific named profile
 * @param name the name of the profile you would like to load
 */
export function loadNamedProfile(name: string): IProfileLoaded {
    const allProfiles = loadAllProfiles();
    for (const profile of allProfiles) {
        if (profile.name === name && profile.type === "zosmf") {
            return profile;
        }
    }
    throw new Error(localize("loadNamedProfile.error.profileName", "Could not find profile named: ")
        + name + localize("loadNamedProfile.error.period", "."));
}

/**
 * Load the default zosmf profile
 */
export function loadDefaultProfile(log: Logger): IProfileLoaded {
    const getProfileProcess = spawnSync("node", [path.join(__dirname, "getDefaultProfile.js")]);

    if (getProfileProcess.status !== 0) {
        throw new Error(
            localize("loadDefaultProfile.error.spawnProcess", "Failed to spawn process to retrieve default profile contents!\n") +
            getProfileProcess.stderr.toString());
    }
    if (getProfileProcess.stdout.toString().length === 0) {
        const defaultProfileMessage = localize("loadDefaultProfile.error.profile1", "No default zosmf profile found for Zowe CLI.")
            + localize("loadDefaultProfile.error.profile2", " A default zosmf profile created with Zowe CLI is required to use the Zowe extension.")
            + localize("loadDefaultProfile.error.profile3", " Please [create at least one profile with Zowe CLI]")
            + localize("loadDefaultProfile.error.profile4",
                "(https://docs.zowe.org/stable/user-guide/cli-configuringcli.html#creating-zowe-cli-profiles).");
        // Display info message to user
        vscode.window.showInformationMessage(defaultProfileMessage);
        // Include stack trace in debug log
        log.debug(defaultProfileMessage + localize("loadDefaultProfile.debug.errorText", "Error text:") + getProfileProcess.stderr.toString());
        // Keep from continuing
        return undefined;
    }
    return JSON.parse(getProfileProcess.stdout.toString());
}
