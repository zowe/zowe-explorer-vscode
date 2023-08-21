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
import HTMLTemplate from "./utils/HTMLTemplate";
import { WebviewUris } from "./utils/types";
import { Disposable, ExtensionContext, Uri, ViewColumn, WebviewPanel, window } from "vscode";
import { join as joinPath } from "path";
import { randomUUID } from "crypto";

export class WebView {
    private disposables: Disposable[];

    // The webview HTML content to render after filling the HTML template.
    private webviewContent: string;
    public panel: WebviewPanel;

    // Resource identifiers for the on-disk content and vscode-webview resource.
    private uris: {
        disk?: WebviewUris;
        resource?: WebviewUris;
    } = {};

    // Unique identifier
    private nonce: string;

    private title: string;

    /**
     * Constructs a webview for use with bundled assets.
     * The webview entrypoint must be located at <webview folder>/dist/assets/index.js.
     *
     * @param title The title for the new webview
     * @param dirName The directory name (relative to the "webviews" folder in the extension root) with a valid entrypoint (see above).
     * @param context The VSCode extension context
     * @param onDidReceiveMessage Event callback: called when messages are received from the webview
     */
    public constructor(title: string, dirName: string, context: ExtensionContext, onDidReceiveMessage?: (message: object) => void | Promise<void>) {
        this.disposables = [];

        // Generate random nonce for loading the bundled script
        this.nonce = randomUUID();
        this.title = title;

        // Build URIs for the webview directory and get the paths as VScode resources
        this.uris.disk = {
            build: Uri.file(joinPath(context.extensionPath, "webviews", dirName)),
            script: Uri.file(joinPath(context.extensionPath, "webviews", dirName, "dist", "assets", "index.js")),
        };

        this.panel = window.createWebviewPanel("ZEAPIWebview", this.title, ViewColumn.Beside, {
            enableScripts: true,
            localResourceRoots: [this.uris.disk.build],
        });

        // Associate URI resources with webview
        this.uris.resource = {
            build: this.panel.webview.asWebviewUri(this.uris.disk.build),
            script: this.panel.webview.asWebviewUri(this.uris.disk.script),
        };

        const template = Handlebars.compile(HTMLTemplate);
        this.webviewContent = template({
            uris: this.uris,
            nonce: this.nonce,
            title: this.title,
        });
        if (onDidReceiveMessage) {
            this.panel.webview.onDidReceiveMessage(async (message) => onDidReceiveMessage(message));
        }
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        this.panel.webview.html = this.webviewContent;
    }

    /**
     * Disposes of the webview instance
     */
    private dispose(): void {
        this.panel.dispose();

        for (const disp of this.disposables) {
            disp.dispose();
        }
        this.disposables = [];
        this.panel = undefined;
    }

    /**
     * Pre-processed HTML content that loads the bundled script through the webview.
     */
    public get htmlContent(): string {
        return this.webviewContent;
    }
}
