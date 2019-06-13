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
import { IProfileLoaded } from "@brightside/imperative";
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();
/**
 * Load all profiles by spawning a script that uses the users' globally installed 
 * 'node' command. This should work regardless of what credential manager plugins 
 * the user has installed
 */
export function loadAllProfiles(): IProfileLoaded[] {
    const getProfileProcess = spawnSync("node", [path.join(__dirname, "getAllProfiles.js")]);
 
    if (getProfileProcess.status !== 0) {
        throw new Error(localize("ProfileLoader.loadAllProfiles.error.spawnProcess.text", "Failed to spawn process to retrieve profile contents!\n") +
            getProfileProcess.stderr.toString());
    }
    if (getProfileProcess.stdout.toString().length === 0) {
        throw new Error(localize("ProfileLoader.loadAllProfiles.error.loadAll.text1", 
        "Error attempting to load all zosmf profiles.") +
        localize("ProfileLoader.loadAllProfiles.error.loadAll.text2",
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
    throw new Error(localize("ProfileLoader.loadNamedProfile.error.profileName.text", "Couldn't find profile named: ") + name);
}

/**
 * Load the default zosmf profile
 */
export function loadDefaultProfile(): IProfileLoaded {
    const getProfileProcess = spawnSync("node", [path.join(__dirname, "getDefaultProfile.js")]);

    if (getProfileProcess.status !== 0) {
        throw new Error(
            localize("ProfileLoader.loadDefaultProfile.error.spawnProcess.text", "Failed to spawn process to retrieve default profile contents!\n") +
            getProfileProcess.stderr.toString());
    }
    if (getProfileProcess.stdout.toString().length === 0) {
        throw new Error(
            localize("ProfileLoader.loadDefaultProfile.error.profile.text1", "Error attempting to load the default zosmf profile for Zowe CLI. ") +
            localize("ProfileLoader.loadDefaultProfile.error.profile.text2",
                     "Please ensure that you have created at least one profile with Zowe CLI ") +
            localize("ProfileLoader.loadDefaultProfile.error.profile.text3","before attempting to use this extension. Error text:")
             + getProfileProcess.stderr.toString());
    }
    return JSON.parse(getProfileProcess.stdout.toString());
}