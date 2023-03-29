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
import * as vscode from "vscode";
import { Gui, IZoweTree, IZoweTreeNode } from "@zowe/zowe-explorer-api";
import { markDocumentUnsaved } from "../utils/workspace";
import { ZoweLogger } from "../utils/LoggerUtils";

// Set up localization
import * as nls from "vscode-nls";
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

interface SaveRequest {
    uploadRequest: (document: SaveRequest["savedFile"], provider: SaveRequest["fileProvider"]) => Promise<void>;
    savedFile: vscode.TextDocument;
    fileProvider: IZoweTree<IZoweTreeNode>;
}

/**
 * Class to handle queueing of file save/upload operations.
 * Architecture is documented in `docs/developer/File-Save-Flow.md`
 */
export class ZoweSaveQueue {
    /**
     * Enqueue a request to upload a file that has been saved. Also start
     * processing the next item in the queue if there are no active upload
     * operations.
     */
    public static push(request: SaveRequest): void {
        ZoweLogger.trace("ZoweSaveQueue.push called.");
        this.savingQueue.push(request);
        this.ongoingSave = this.all().then(this.processNext.bind(this));
    }

    /**
     * Wait for all items in the queue to be processed.
     */
    public static async all(): Promise<void> {
        ZoweLogger.trace("ZoweSaveQueue.all called.");
        await this.ongoingSave;
    }

    private static ongoingSave = Promise.resolve();
    private static savingQueue: SaveRequest[] = [];

    /**
     * Iterate over the queue and process next item until it is empty.
     */
    private static async processNext(): Promise<void> {
        ZoweLogger.trace("ZoweSaveQueue.processNext called.");
        const nextRequest = this.savingQueue.shift();
        if (nextRequest == null || this.savingQueue.some(({ savedFile }) => savedFile.fileName === nextRequest.savedFile.fileName)) {
            return;
        }

        try {
            await nextRequest.uploadRequest(nextRequest.savedFile, nextRequest.fileProvider);
        } catch (err) {
            ZoweLogger.error(err);
            await markDocumentUnsaved(nextRequest.savedFile);
            await Gui.errorMessage(
                localize(
                    "processNext.error.uploadFailed",
                    "Failed to upload changes for {0}: {1}",
                    this.buildFileHyperlink(nextRequest.savedFile),
                    err.message
                )
            );
        }
    }

    /**
     * Generate hyperlink for document to show in VS Code message.
     */
    private static buildFileHyperlink(document: vscode.TextDocument): string {
        ZoweLogger.trace("ZoweSaveQueue.buildFileHyperlink called.");
        const encodedUrl = JSON.stringify([document.uri.toString()]);
        return `[${path.basename(document.fileName)}](command:vscode.open?${encodedUrl})`;
    }
}
