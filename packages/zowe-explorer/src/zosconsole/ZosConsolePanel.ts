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
import { ProfileInfo, IProfAttrs } from "@zowe/imperative";
import { IIssueParms, IssueCommand } from "@zowe/zos-console-for-zowe-sdk";

export class ZosConsoleViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = "zosconsole";

    private profiles: Map<string, IProfAttrs> = new Map();
    private defaultProfileName: string | undefined;

    public constructor(private readonly _extensionUri: vscode.Uri) {
        const profInfo = new ProfileInfo("zowe");
        profInfo
            .readProfilesFromDisk()
            .then(() => {
                const loadedProfiles = profInfo.getAllProfiles("zosmf");
                const defaultProfile = profInfo.getDefaultProfile("zosmf");
                this.defaultProfileName = defaultProfile?.profName;
                loadedProfiles.forEach((profile) => {
                    this.profiles.set(profile.profName, profile);
                });
            })
            .catch(() => {});
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
        const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "node_modules", "@vscode/codicons", "dist", "codicon.css"));
        const nonce = this.getNonce();

        // Tip: Install the es6-string-html VS Code extension to enable code highlighting below
        return /*html*/ `
          <!DOCTYPE html>
          <html lang="en">
              <head>
                  <meta charset="UTF-8" />
                  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                  <!--<meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; 
                        style-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />-->
                  <link href="${codiconsUri.toString()}" rel="stylesheet" />
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

                    .box {
                        display: flex;
                        height: 100%;
                        width: 100%;
                        flex-direction: column;
                    }
                 </style>
              </head>
              <body>
                <div id="webviewRoot" style="width: 100%;"></div>
                <script>
                    const vscode = acquireVsCodeApi();
                    window.onload = function() {
                        vscode.postMessage({ command: 'startup' });
                    };
                </script>
                <script type="module" nonce="${nonce}" src="${scriptUri.toString()}"></script>
                </body>
              </body>
          </html>
          `;
    }

    private async runOperCmd(command: string, profile: string): Promise<string> {
        try {
            const profInfo = new ProfileInfo("zowe");
            await profInfo.readProfilesFromDisk();
            const zosmfProfAttrs = this.profiles.get(profile);
            const zosmfMergedArgs = profInfo.mergeArgsForProfile(zosmfProfAttrs, { getSecureVals: true });
            const session = ProfileInfo.createSession(zosmfMergedArgs.knownArgs);

            const parms: IIssueParms = {
                command: command,
                sysplexSystem: undefined,
                solicitedKeyword: undefined,
                async: "N",
            };
            const response = await IssueCommand.issue(session, parms);
            return response.commandResponse;
        } catch (e) {
            return (e as Error).message;
        }
    }

    private getNonce(): string {
        let text = "";
        const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(this.cryptoRandom() * possible.length));
        }
        return text;
    }

    private cryptoRandom(): number {
        const typedArray = new Uint8Array(1);
        const randomValue = crypto.getRandomValues(typedArray)[0];
        const randomFloat = randomValue / Math.pow(2, 8);
        return randomFloat;
    }
}
