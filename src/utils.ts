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

import * as path from "path";
import * as os from "os";
import * as zowe from "@brightside/core";
import { CliProfileManager } from "@brightside/imperative";

/*
 * Created this file to be a place where commonly used functions will be defined.
 * I noticed we have a lot of repetition of some common
 * functionality in many places.
 */
export async function getSession(profileName: string) {
    const zosmfProfile = await new CliProfileManager({
        profileRootDirectory: path.join(os.homedir(), ".zowe", "profiles"),
        type: "zosmf"
    }).load({name: profileName});
    return zowe.ZosmfSession.createBasicZosmfSession(zosmfProfile.profile);
}

export function applyIcons(context: string, state?: string ): any {
    let light: string;
    let dark: string;
    if (["pds", "pdsf", "dsf", "directory", "directoryf", "job"].includes(context)) {
        if (state === "open") {
            light = path.join(__dirname, "..", "..", "resources", "light", "folder-open.svg");
            dark = path.join(__dirname, "..", "..", "resources", "dark", "folder-open.svg");
        } else {
            light = path.join(__dirname, "..", "..", "resources", "light", "folder.svg");
            dark = path.join(__dirname, "..", "..", "resources", "dark", "folder.svg");
        }
    } else if (["session", "favorite", "uss_session", "server"].includes(context)) {
        if (state === "open") {
            light = path.join(__dirname, "..", "..", "resources", "light", "root-folder-open.svg");
            dark = path.join(__dirname, "..", "..", "resources", "dark", "root-folder-open.svg");
        } else {
            light = path.join(__dirname, "..", "..", "resources", "light", "root-folder.svg");
            dark = path.join(__dirname, "..", "..", "resources", "dark", "root-folder.svg");
        }
    } else if (["sessionf"].includes(context)) {
        light = path.join(__dirname, "..", "..", "resources", "light", "pattern.svg");
        dark = path.join(__dirname, "..", "..", "resources", "dark", "pattern.svg");
    } else if (["ds", "member", "textFile", "textFilef", "spool"].includes(context)) {
        light = path.join(__dirname, "..", "..", "resources", "light", "document.svg");
        dark = path.join(__dirname, "..", "..", "resources", "dark", "document.svg");
    } else {
        return undefined;
    }
    return { light, dark };
}
