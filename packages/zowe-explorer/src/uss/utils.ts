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

import * as vscode from "vscode";
import type { ZoweUSSNode } from "./ZoweUSSNode";
import { ZoweLogger } from "../utils/ZoweLogger";
import * as contextually from "../shared/context";
import { ZosEncoding } from "@zowe/zowe-explorer-api";

export function zosEncodingToString(encoding: ZosEncoding): string {
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

    if (!contextually.isUssDirectory(node)) {
        const zosEncoding = node.getEncoding();
        const encodingString = zosEncoding ? zosEncodingToString(zosEncoding) : null;
        if (encodingString != null) {
            tooltip +=
                "  \n" +
                vscode.l10n.t({
                    message: "Encoding: {0}",
                    args: [encodingString],
                    comment: ["Encoding name"],
                });
        }
    }
    return tooltip;
}

/**
 * Removes clipboard contents
 * @returns {void}
 */
export function disposeClipboardContents(): void {
    ZoweLogger.trace("uss.utils.disposeClipboardContents called.");
    vscode.env.clipboard.writeText("");
}
