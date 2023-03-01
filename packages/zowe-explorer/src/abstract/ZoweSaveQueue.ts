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
import { Gui, IZoweDatasetTreeNode, IZoweTree, IZoweUSSTreeNode } from "@zowe/zowe-explorer-api";
import * as globals from "../globals";
import { markDocumentUnsaved } from "../utils/workspace";

// Set up localization
import * as nls from "vscode-nls";
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

interface SaveRequest {
    uploadRequest: (document, provider) => Promise<void | string | vscode.MessageItem>;
    savedFile: vscode.TextDocument;
    fileProvider: IZoweTree<IZoweUSSTreeNode | IZoweDatasetTreeNode>;
}

// TODO Use deferred promise implementation from PR #2082
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RejectFn = (reason?: any) => void;
type ResolveFn = (val?: unknown) => void;

type DeferredPromise = {
    promise: Promise<unknown>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reject: RejectFn;
    resolve: ResolveFn;
};

/**
 * Create a deferred promise that can be resolved or rejected at any point.
 * @returns The promise object alongside its resolve/reject functions.
 */
function createDeferredPromise(): DeferredPromise {
    let resolve: ResolveFn, reject: RejectFn;
    const promise = new Promise((res, rej) => {
        [resolve, reject] = [res, rej];
    });
    return { promise, reject, resolve };
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
    public static push(request: SaveRequest) {
        this.savingQueue.push(request);
        if (this.ongoingSave == null) {
            this.processNext();
        }
    }

    /**
     * Wait for all items in the queue to be processed.
     */
    public static async all() {
        await this.ongoingSave?.promise;
    }

    private static ongoingSave: DeferredPromise | null;
    private static savingQueue: SaveRequest[] = [];

    /**
     * Iterate over the queue and process next item until it is empty.
     */
    private static async processNext() {
        const nextRequest = this.savingQueue.shift();
        if (nextRequest == null) {
            if (this.ongoingSave != null) {
                this.ongoingSave.resolve();
                this.ongoingSave = null;
            }
            return;
        }
        this.ongoingSave = this.ongoingSave ?? createDeferredPromise();
        const pendingSavesForSameFile = this.savingQueue.filter(({ savedFile }) => savedFile.fileName === nextRequest.savedFile.fileName);
        if (pendingSavesForSameFile.length === 0) {
            try {
                await nextRequest.uploadRequest(nextRequest.savedFile, nextRequest.fileProvider);
            } catch (err) {
                globals.LOG.error(err);
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
        this.processNext();
    }

    /**
     * Generate hyperlink for document to show in VS Code message.
     */
    private static buildFileHyperlink(document: vscode.TextDocument) {
        const encodedUrl = JSON.stringify([document.uri.toString()]);
        return `[${path.basename(document.fileName)}](command:vscode.open?${encodedUrl})`;
    }
}
