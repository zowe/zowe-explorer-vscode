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
import { imperative } from "@zowe/cli";
import { ZoweUSSNode } from "../uss/ZoweUSSNode";
import { ZoweLogger } from "../utils/LoggerUtils";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { IZoweUSSTreeNode } from "@zowe/zowe-explorer-api";
import * as nls from "vscode-nls";

// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

/**
 * Injects extra data to tooltip based on node status and other conditions
 * @param node
 * @param tooltip
 * @returns {string}
 */
export function injectAdditionalDataToTooltip(node: ZoweUSSNode, tooltip: string): string {
    ZoweLogger.trace("uss.utils.injectAdditionalDataToTooltip called.");
    if (node.downloaded && node.downloadedTime) {
        const downloadedTime = new Date(node.downloadedTime).toLocaleString(vscode.env.language);
        tooltip += "  \n" + localize("zowe.uss.utils.tooltip.downloaded", "Downloaded: {0}", downloadedTime);
        const encodingString = node.binary ? localize("zowe.uss.utils.tooltip.binary", "Binary") : node.encoding;
        if (encodingString != null) {
            tooltip += "  \n" + localize("zowe.uss.utils.tooltip.encoding", "Encoding: {0}", encodingString);
        }
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

export async function autoDetectEncoding(node: IZoweUSSTreeNode, profile?: imperative.IProfileLoaded): Promise<void> {
    if (node.binary || node.encoding !== undefined) {
        return;
    }
    const ussApi = ZoweExplorerApiRegister.getUssApi(profile ?? node.getProfile());
    if (ussApi.getTag != null) {
        const taggedEncoding = await ussApi.getTag(node.fullPath);
        if (taggedEncoding === "binary" || taggedEncoding === "mixed") {
            node.setEncoding({ kind: "binary" });
        } else {
            node.setEncoding(taggedEncoding !== "untagged" ? { kind: "other", codepage: taggedEncoding } : { kind: "text" });
        }
    } else {
        const isBinary = await ussApi.isFileTagBinOrAscii(node.fullPath);
        node.setEncoding({ kind: isBinary ? "binary" : "text" });
    }
}
