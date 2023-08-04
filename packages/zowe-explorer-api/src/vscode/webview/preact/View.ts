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

import * as Handlebars from "handlebars";
import HTMLTemplate from "../utils/HTMLTemplate";
import { WebviewUris } from "../utils/types";
import { Disposable, ExtensionContext, Uri, ViewColumn, WebviewPanel, window } from "vscode";
import { join as joinPath } from "path";
import { randomUUID } from "crypto";

export class View {
    private disposables: Disposable[];

    // The webview HTML content to render after filling the HTML template.
    private webviewContent: string;
    public panel: WebviewPanel;
    
    private uris: {
        disk?: WebviewUris,
        resource?: WebviewUris
    } = {};
    
    // Unique identifier and title for the Preact webview.
    private nonce: string;
    private title: string;

    /**
     * Constructs a Preact View.
     * @param title The title for the new webview
     * @param dirName The directory name (in the "webviews" folder) that contains the bundled "index.js" file.
     * @param context The extension context
     */
    public constructor(title: string, dirName: string, 
        context: ExtensionContext, onDidReceiveMessage?: (message: object) => void) {
        this.disposables = [];

        // Generate random nonce for loading the bundled script
        this.nonce = randomUUID();
        this.title = title;

        // Build URIs for the webview directory and get the paths as VScode resources
        this.uris.disk = {
            build: Uri.file(joinPath(context.extensionPath, "webviews", dirName)),
            script: Uri.file(joinPath(context.extensionPath, "webviews", dirName, "dist", "assets", "index.js"))
        };
        this.uris.resource = {
            build: this.uris.disk.build.with({ scheme: "vscode-resource" }),
            script: this.uris.disk.script.with({ scheme: "vscode-resource" }),
        };

        const template = Handlebars.compile(HTMLTemplate);
        this.webviewContent = template({
            uris: this.uris,
            nonce: this.nonce,
            title: this.title,
        });

        this.panel = window.createWebviewPanel("preact", this.title, ViewColumn.Beside, {
            enableScripts: true,
            localResourceRoots: [
                this.uris.disk.build
            ]
        });
        if (onDidReceiveMessage) {
            this.panel.webview.onDidReceiveMessage((message) => onDidReceiveMessage(message));
        }
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        this.panel.webview.html = this.webviewContent;
        // TODO: handle `onDidDispose`, `onDidReceiveMessage` for.panel
    }

    private dispose(): void {
        this.panel.dispose();

        for (const disp of this.disposables) {
            disp.dispose();
        }
        this.disposables = [];
    }

    public get htmlContent(): string {
        return this.webviewContent;
    }
}