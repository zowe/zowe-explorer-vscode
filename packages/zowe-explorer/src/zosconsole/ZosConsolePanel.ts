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
import * as globals from "../globals";
import { imperative, HTMLTemplate } from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { ProfileManagement } from "../utils/ProfileManagement";
import { Profiles } from "../Profiles";
import { randomUUID } from "crypto";
import Mustache = require("mustache");

export class ZosConsoleViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = "zosconsole";

    private _view?: vscode.WebviewView;

    private profiles: Map<string, imperative.IProfileLoaded> = new Map();
    private defaultProfileName: string | undefined;

    public constructor(private _extensionUri: vscode.Uri) {
        this.refreshProfileList();
    }

    private refreshProfileList(): void {
        const profileNamesList = ProfileManagement.getRegisteredProfileNameList(globals.Trees.MVS);
        this.defaultProfileName = profileNamesList[0];

        const loadedProfiles = Profiles.getInstance().allProfiles;
        loadedProfiles.forEach((profile) => {
            if (profileNamesList.includes(profile.name)) {
                this.profiles.set(profile.name, profile);
            }
        });
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext<unknown>,
        _token: vscode.CancellationToken
    ): void | Thenable<void> {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (message: any) => {
            const command = message.command;
            const text = message.text;
            const profile = message.profile;

            switch (command) {
                case "startup": {
                    this.refreshProfileList();
                    const profileArray = [];
                    for (const profileName of this.profiles.keys()) {
                        profileArray.push(profileName);
                    }
                    webviewView.webview.postMessage({
                        type: "optionsList",
                        profiles: profileArray,
                        defaultProfile: this.defaultProfileName,
                    });
                    break;
                }
                case "opercmd":
                    webviewView.webview.postMessage({
                        type: "commandResult",
                        cmd: text,
                        profile: profile,
                        result: await this.runOperCmd(text, profile),
                    });
                    return;
            }
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "src", "webviews", "dist", "zos-console", "zos-console.js"));
        const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "src", "webviews", "dist", "codicons", "codicon.css"));
        const nonce = randomUUID();

        // Tip: Install the es6-string-html VS Code extension to enable code highlighting below
        return Mustache.render(HTMLTemplate.default, {
            uris: { resource: { script: scriptUri } },
            nonce,
            style: /* html */ `
                <link href="${codiconsUri?.toString()}" rel="stylesheet" />
                <style>
                    html,
                    body {
                        display: flex;
                        height: 100%;
                        width: 100%;
                        overflow: hidden;
                        margin: 0px;
                        padding: 0px;
                    }
                    #webviewRoot {
                        width: 100%;
                    }
                    .box {
                        display: flex;
                        height: 100%;
                        width: 100%;
                        flex-direction: column;
                    }
                </style>`,
            startup: /* html */ `
                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                    window.onload = function() {
                        vscode.postMessage({ command: 'startup' });
                    };
                </script>`,
        });
    }

    private async runOperCmd(command: string, profile: string): Promise<string> {
        try {
            const theProfile: imperative.IProfileLoaded = this.profiles.get(profile);
            const response = await ZoweExplorerApiRegister.getCommandApi(theProfile).issueMvsCommand(command, theProfile.profile?.consoleName);
            return response.commandResponse;
        } catch (e) {
            return (e as Error).message + "\n";
        }
    }
}
