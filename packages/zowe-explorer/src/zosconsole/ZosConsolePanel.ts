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
import { imperative, HTMLTemplate } from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "../extending/ZoweExplorerApiRegister";
import { ProfileManagement } from "../management/ProfileManagement";
import { Profiles } from "../configuration/Profiles";
import { randomUUID } from "crypto";
import { Definitions } from "../configuration/Definitions";
import Mustache = require("mustache");
import * as fs from "fs";

/**
 * @deprecated
 */
export class ZosConsoleViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = "zosconsole";

    private profiles: Map<string, imperative.IProfileLoaded> = new Map();
    private defaultProfileName: string | undefined;

    public constructor(private _extensionUri: vscode.Uri) {
        this.refreshProfileList();
    }

    private refreshProfileList(): void {
        const profileNamesList = ProfileManagement.getRegisteredProfileNameList(Definitions.Trees.MVS);
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
                    break;
                case "GET_LOCALIZATION":
                    {
                        const filePath = vscode.l10n.uri?.fsPath + "";
                        fs.readFile(filePath, "utf8", (err, data) => {
                            if (err) {
                                // File doesn't exist, fallback to English strings
                                return;
                            }
                            webviewView.webview.postMessage({
                                type: "GET_LOCALIZATION",
                                contents: data,
                            });
                        });
                    }
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
            const response = await ZoweExplorerApiRegister.getCommandApi(theProfile).issueMvsCommand(command);
            return response.commandResponse;
        } catch (e) {
            return (e as Error).message + "\n";
        }
    }
}
