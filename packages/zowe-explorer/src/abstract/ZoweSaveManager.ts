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

import * as vscode from "vscode";
import { IZoweDatasetTreeNode, IZoweTree, IZoweUSSTreeNode } from "@zowe/zowe-explorer-api";

interface SaveRequest {
    uploadRequest: (document, provider) => Promise<void | string | vscode.MessageItem>;
    savedFile: vscode.TextDocument;
    fileProvider: IZoweTree<IZoweUSSTreeNode | IZoweDatasetTreeNode>;
}

/**
 * Class to handle queueing of file save/upload operations.
 * Architecture is documented in `docs/developer/File-Save-Flow.md`
 */
export class ZoweSaveManager {
    public static enqueueSave(request: SaveRequest) {
        this.savingQueue.push({
            ...request,
            uploadRequest: (document, provider) =>
                request.uploadRequest(document, provider).then(async () => {
                    this.pendingUpload = null;
                    await this.processNext();
                }),
        });
        this.processNext();
    }

    public static async waitForQueue() {
        if (this.pendingUpload != null) {
            await this.pendingUpload;
        }
    }

    private static pendingUpload: Promise<void | string | vscode.MessageItem>;
    private static savingQueue: SaveRequest[] = [];

    private static async processNext() {
        if (this.pendingUpload != null) {
            return;
        }
        const nextRequest = this.savingQueue.shift();
        if (nextRequest == null) {
            return;
        }
        const pendingRequestsForSameFile = this.savingQueue.filter((sr) => sr.savedFile.fileName === nextRequest.savedFile.fileName);
        if (pendingRequestsForSameFile.length === 0) {
            this.pendingUpload = nextRequest.uploadRequest(nextRequest.savedFile, nextRequest.fileProvider);
            return this.pendingUpload;
        } else {
            return this.processNext();
        }
    }
}
