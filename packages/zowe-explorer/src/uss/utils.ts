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

import * as path from "path";
import * as fs from "fs";
import * as vscode from "vscode";
import { ZoweUSSNode } from "../uss/ZoweUSSNode";
import { ZoweLogger } from "../utils/LoggerUtils";

/**
 * Injects extra data to tooltip based on node status and other conditions
 * @param node
 * @param tooltip
 * @returns {string}
 */
export function injectAdditionalDataToTooltip(node: ZoweUSSNode, tooltip: string): string {
    ZoweLogger.trace("uss.utils.injectAdditionalDataToTooltip called.");
    if (node.downloaded && node.downloadedTime) {
        // TODO: Add time formatter to localization so we will use not just US variant
        return `${tooltip} (Downloaded: ${new Date(node.downloadedTime)
            .toISOString()
            .replace(/(\d{4})-(\d{2})-(\d{2})T((\d{2}):(\d{2}):([^Z]+))Z/, "$5:$6 $2/$3/$1")})`;
    }

    return tooltip;
}

/**
 * Checks whether file already exists while case sensitivity taken into account
 * @param filepath
 * @returns {boolean}
 */
export function fileExistsCaseSensitveSync(filepath: string): boolean {
    ZoweLogger.trace("uss.utils.fileExistsCaseSensitveSync called.");
    const dir = path.dirname(filepath);
    if (dir === path.dirname(dir)) {
        return true;
    }
    const filenames = fs.readdirSync(dir);
    if (filenames.indexOf(path.basename(filepath)) === -1) {
        return false;
    }
    return fileExistsCaseSensitveSync(dir);
}

/**
 * Removes clipboard contents
 * @returns {void}
 */
export function disposeClipboardContents(): void {
    ZoweLogger.trace("uss.utils.disposeClipboardContents called.");
    vscode.env.clipboard.writeText("");
}
