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
import { TreeItem } from "vscode";
import * as extension from "../src/extension";

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
export function applyIcons(node: TreeItem, state?: string ): any {
    let light: string;
    let dark: string;

    if ([extension.DS_PDS_CONTEXT, extension.DS_PDS_CONTEXT + extension.FAV_SUFFIX,
            extension.USS_DIR_CONTEXT,
            extension.USS_DIR_CONTEXT + extension.FAV_SUFFIX,
            extension.JOBS_JOB_CONTEXT,
            extension.JOBS_JOB_CONTEXT + extension.FAV_SUFFIX].includes(node.contextValue)) {
        if (state === extension.ICON_STATE_OPEN) {
            light = path.join(__dirname, "..", "..", "resources", "light", "folder-open.svg");
            dark = path.join(__dirname, "..", "..", "resources", "dark", "folder-open.svg");
        } else {
            light = path.join(__dirname, "..", "..", "resources", "light", "folder-closed.svg");
            dark = path.join(__dirname, "..", "..", "resources", "dark", "folder-closed.svg");
        }
    } else if ([extension.FAVORITE_CONTEXT].includes(node.contextValue)) {
        if (state === extension.ICON_STATE_OPEN) {
            light = path.join(__dirname, "..", "..", "resources", "light", "folder-root-favorite-open.svg");
            dark = path.join(__dirname, "..", "..", "resources", "dark", "folder-root-favorite-open.svg");
        } else {
            light = path.join(__dirname, "..", "..", "resources", "light", "folder-root-favorite-closed.svg");
            dark = path.join(__dirname, "..", "..", "resources", "dark", "folder-root-favorite-closed.svg");
        }
    } else if ([extension.DS_SESSION_CONTEXT, extension.USS_SESSION_CONTEXT,
                extension.JOBS_SESSION_CONTEXT].includes(node.contextValue)) {
        if (state === extension.ICON_STATE_OPEN) {
            light = path.join(__dirname, "..", "..", "resources", "light", "folder-root-default-open.svg");
            dark = path.join(__dirname, "..", "..", "resources", "dark", "folder-root-default-open.svg");
        } else {
            light = path.join(__dirname, "..", "..", "resources", "light", "folder-root-default-closed.svg");
            dark = path.join(__dirname, "..", "..", "resources", "dark", "folder-root-default-closed.svg");
        }
    } else if ([extension.DS_SESSION_CONTEXT + extension.FAV_SUFFIX,
                extension.JOBS_SESSION_CONTEXT + extension.FAV_SUFFIX,
                extension.USS_SESSION_CONTEXT + extension.FAV_SUFFIX].includes(node.contextValue)) {
        light = path.join(__dirname, "..", "..", "resources", "light", "pattern.svg");
        dark = path.join(__dirname, "..", "..", "resources", "dark", "pattern.svg");
    } else if ([extension.DS_PDS_CONTEXT,
                extension.DS_PDS_CONTEXT + extension.FAV_SUFFIX,
                extension.DS_MEMBER_CONTEXT, extension.DS_TEXT_FILE_CONTEXT,
                extension.DS_TEXT_FILE_CONTEXT + extension.FAV_SUFFIX,
                extension.JOBS_SPOOL_CONTEXT].includes(node.contextValue)) {
        light = path.join(__dirname, "..", "..", "resources", "light", "document.svg");
        dark = path.join(__dirname, "..", "..", "resources", "dark", "document.svg");
    } else if ([extension.DS_BINARY_FILE_CONTEXT,
                extension.DS_BINARY_FILE_CONTEXT + extension.FAV_SUFFIX].includes(node.contextValue)) {
        light = path.join(__dirname, "..", "..", "resources", "light", "document.svg");
        dark = path.join(__dirname, "..", "..", "resources", "dark", "document.svg");
    } else {
        return undefined;
    }
    node.iconPath = { light, dark };
    return { light, dark };
}

/**
 * For no obvious reason a label change is often required to make a node repaint.
 * This function does this by adding or removing a blank.
 * @param {vscode.TreeItem} node - the node element
 */
export function labelHack( node: TreeItem ): void {
    node.label = node.label.endsWith(" ") ? node.label.substring(0, node.label.length -1 ) : node.label+ " ";
}
