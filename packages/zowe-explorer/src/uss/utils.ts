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
import type { ZoweUSSNode } from "./ZoweUSSNode";
import { ZoweLogger } from "../utils/ZoweLogger";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { imperative, IZoweUSSTreeNode, ZosEncoding } from "@zowe/zowe-explorer-api";

function zosEncodingToString(encoding: ZosEncoding): string {
    switch (encoding.kind) {
        case "binary":
            return vscode.l10n.t("Binary");
        case "other":
            return encoding.codepage;
        case "text":
            return null;
    }
}

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
        tooltip +=
            "  \n" +
            vscode.l10n.t({
                message: "Downloaded: {0}",
                args: [downloadedTime],
                comment: ["Download time"],
            });
    }

    const encodingString = zosEncodingToString(node.getEncoding());
    if (encodingString != null) {
        tooltip +=
            "  \n" +
            vscode.l10n.t({
                message: "Encoding: {0}",
                args: [encodingString],
                comment: ["Encoding name"],
            });
    }

    return tooltip;
}

/**
 * Checks whether file already exists while case sensitivity taken into account
 * @param filepath
 * @returns {boolean}
 */
export function fileExistsCaseSensitiveSync(filepath: string): boolean {
    ZoweLogger.trace("uss.utils.fileExistsCaseSensitveSync called.");
    const dir = path.dirname(filepath);
    if (dir === path.dirname(dir)) {
        return true;
    }
    const filenames = fs.readdirSync(dir);
    if (filenames.indexOf(path.basename(filepath)) === -1) {
        return false;
    }
    return fileExistsCaseSensitiveSync(dir);
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
    if (node.getEncoding() !== undefined) {
        return;
    }
    const ussApi = ZoweExplorerApiRegister.getUssApi(profile ?? node.getProfile());
    if (ussApi.getTag != null) {
        const taggedEncoding = await ussApi.getTag(node.fullPath);
        if (taggedEncoding === "binary" || taggedEncoding === "mixed") {
            await node.setEncoding({ kind: "binary" });
        } else {
            await node.setEncoding(taggedEncoding !== "untagged" ? { kind: "other", codepage: taggedEncoding } : undefined);
        }
    } else {
        const isBinary = await ussApi.isFileTagBinOrAscii(node.fullPath);
        await node.setEncoding(isBinary ? { kind: "binary" } : undefined);
    }
}
