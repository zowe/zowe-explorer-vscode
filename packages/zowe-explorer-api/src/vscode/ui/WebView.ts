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

import * as fs from "fs";
import Mustache = require("mustache");
import HTMLTemplate from "./utils/HTMLTemplate";
import { Types } from "../../Types";
import { Disposable, ExtensionContext, Uri, ViewColumn, WebviewPanel, WebviewView, window } from "vscode";
import { join as joinPath } from "path";
import { randomUUID } from "crypto";

export type WebViewOpts = {
    /** Callback function that is called when the extension has received a message from the webview. */
    onDidReceiveMessage?: (message: object) => void | Promise<void>;
    /** Retains context of the webview even after it is hidden. */
    retainContext?: boolean;
    /** Whether the webview should be prepared for a WebviewViewProvider. */
    isView?: boolean;
    /** Allow evaluation of functions within the webview script code. */
    unsafeEval?: boolean;
};

export type UriPair = {
    /** The paths for the webview on-disk. */
    disk?: Types.WebviewUris;
    /** The paths for the webview resources, before transformation by the `asWebviewUri` function. */
    resource?: Types.WebviewUris;
};

export class WebView {
    protected disposables: Disposable[];

    // The webview HTML content to render after filling the HTML template.
    protected webviewContent: string;
    public panel: WebviewPanel;
    public view: WebviewView;

    // Resource identifiers for the on-disk content and vscode-webview resource.
    protected uris: UriPair = {};

    // Unique identifier
    private nonce: string;
    protected title: string;

    protected context: ExtensionContext;

    private webviewOpts: WebViewOpts;

    /**
     * Constructs a webview for use with bundled assets.
     * The webview entrypoint must be located at src/<webview folder>/dist/<webview-name>/index.js.
     *
     * @param title The title for the new webview
     * @param webviewName The webview name, the same name given to the directory of your webview in the webviews/src directory.
     * @param context The VSCode extension context
     * @param onDidReceiveMessage Event callback: called when messages are received from the webview
     */
    public constructor(title: string, webviewName: string, context: ExtensionContext, opts?: WebViewOpts) {
        this.context = context;
        this.disposables = [];

        // Generate random nonce for loading the bundled script
        this.nonce = randomUUID();
        this.title = title;

        this.webviewOpts = opts;

        const codiconPath = joinPath(context.extensionPath, "src", "webviews", "dist", "codicons", "codicon.css");
        const cssPath = joinPath(context.extensionPath, "src", "webviews", "dist", "style", "style.css");
        const codiconsExists = fs.existsSync(codiconPath);
        const cssExists = fs.existsSync(cssPath);

        // Build URIs for the webview directory and get the paths as VScode resources
        this.uris.disk = {
            build: Uri.file(joinPath(context.extensionPath, "src", "webviews")),
            script: Uri.file(joinPath(context.extensionPath, "src", "webviews", "dist", webviewName, `${webviewName}.js`)),
            codicons: codiconsExists ? Uri.file(codiconPath) : undefined,
            css: cssExists ? Uri.file(cssPath) : undefined,
        };

        if (!(opts?.isView ?? false)) {
            this.panel = window.createWebviewPanel("ZEAPIWebview", this.title, ViewColumn.Beside, {
                enableScripts: true,
                localResourceRoots: [this.uris.disk.build, this.uris.disk.codicons],
                retainContextWhenHidden: opts?.retainContext ?? false,
            });

            // Associate URI resources with webview
            this.uris.resource = {
                build: this.panel.webview.asWebviewUri(this.uris.disk.build),
                script: this.panel.webview.asWebviewUri(this.uris.disk.script),
                codicons: this.uris.disk.codicons ? this.panel.webview.asWebviewUri(this.uris.disk.codicons) : undefined,
                css: this.uris.disk.css ? this.panel.webview.asWebviewUri(this.uris.disk.css) : undefined,
            };

            const builtHtml = Mustache.render(HTMLTemplate, {
                cspSource: this.panel.webview.cspSource,
                unsafeEval: this.webviewOpts?.unsafeEval,
                uris: this.uris,
                nonce: this.nonce,
                title: this.title,
            });
            this.webviewContent = builtHtml;
            if (opts?.onDidReceiveMessage) {
                this.panel.webview.onDidReceiveMessage(async (message) => opts.onDidReceiveMessage(message));
            }
            this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
            this.panel.webview.html = this.webviewContent;
        }
    }

    public resolveForView(webviewView: WebviewView): void {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.uris.disk.build],
        };

        // Associate URI resources with webview
        this.uris.resource = {
            build: webviewView.webview.asWebviewUri(this.uris.disk.build),
            script: webviewView.webview.asWebviewUri(this.uris.disk.script),
            codicons: this.uris.disk.codicons ? webviewView.webview.asWebviewUri(this.uris.disk.codicons) : undefined,
            css: this.uris.disk.css ? webviewView.webview.asWebviewUri(this.uris.disk.css) : undefined,
        };

        const builtHtml = Mustache.render(HTMLTemplate, {
            cspSource: webviewView.webview.cspSource,
            unsafeEval: this.webviewOpts?.unsafeEval,
            uris: this.uris,
            nonce: this.nonce,
            title: this.title,
        });
        this.webviewContent = builtHtml;
        if (this.webviewOpts?.onDidReceiveMessage) {
            webviewView.webview.onDidReceiveMessage(async (message) => this.webviewOpts.onDidReceiveMessage(message));
        }
        webviewView.onDidDispose(() => this.dispose(), null, this.disposables);
        webviewView.webview.html = this.webviewContent;
        webviewView.show();
        this.view = webviewView;
    }

    /**
     * Disposes of the webview instance
     */
    protected dispose(): void {
        this.panel?.dispose();

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
