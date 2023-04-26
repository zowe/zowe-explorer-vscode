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

import { Poller } from "@zowe/zowe-explorer-api/src/utils";
import * as vscode from "vscode";

class PollDecorationProvider implements vscode.FileDecorationProvider {
    private disposables: vscode.Disposable[];

    private static fileDecorationsEmitter: vscode.EventEmitter<vscode.Uri | vscode.Uri[]> = new vscode.EventEmitter<vscode.Uri | vscode.Uri[]>();
    public onDidChangeFileDecorations: vscode.Event<vscode.Uri | vscode.Uri[]> = PollDecorationProvider.fileDecorationsEmitter.event;

    public constructor() {
        this.disposables = [];
    }

    public register(): void {
        vscode.window.registerFileDecorationProvider(this);
    }

    public updateIcon(uri: vscode.Uri): void {
        PollDecorationProvider.fileDecorationsEmitter.fire(uri);
    }

    public provideFileDecoration(uri: vscode.Uri, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.FileDecoration> {
        const inPollQueue = Poller.pollRequests[uri.path];
        // Only show polling decoration beside URIs w/ valid poll requests
        if (inPollQueue && !inPollQueue.dispose) {
            if (inPollQueue["decoration"]) {
                // A decoration was already constructed, update existing tooltip
                (inPollQueue["decoration"] as vscode.FileDecoration).tooltip = `Polling (${inPollQueue.msInterval}ms)`;
                Poller.pollRequests[uri.path] = inPollQueue;
                return inPollQueue["decoration"] as vscode.FileDecoration;
            }

            const newDecoration = new vscode.FileDecoration("P", `Polling (${inPollQueue.msInterval}ms)`);
            // Cache latest decoration when emitter is called
            Poller.pollRequests[uri.path]["decoration"] = newDecoration;
            return newDecoration;
        }

        return null;
    }

    public dispose(): void {
        this.disposables.forEach((d) => {
            d.dispose();
        });
    }
}

export const PollDecorator = new PollDecorationProvider();
