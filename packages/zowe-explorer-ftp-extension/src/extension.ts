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
import { ZoweExplorerApi } from "@zowe/zowe-explorer-api";
import { FtpUssApi } from "./ZoweExplorerFtpUssApi";
import { FtpMvsApi } from "./ZoweExplorerFtpMvsApi";
import { FtpJesApi } from "./ZoweExplorerFtpJesApi";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function activate(context: vscode.ExtensionContext): void {
    void registerFtpApis();
}

/**
 * Function that searches for the Zowe VS Code Extension and if found
 * registers the additional USS API implementation provided by this extension.
 */

async function registerFtpApis(): Promise<boolean> {
    const zoweExplorerApi = vscode.extensions.getExtension("Zowe.vscode-extension-for-zowe");

    if (zoweExplorerApi && zoweExplorerApi.exports) {
        const importedApi = zoweExplorerApi.exports as ZoweExplorerApi.IApiRegisterClient;
        importedApi.registerUssApi(new FtpUssApi());
        importedApi.registerMvsApi(new FtpMvsApi());
        importedApi.registerJesApi(new FtpJesApi());
        // check as getExplorerExtenderApi().reloadProfiles() was add in Zowe Explorer 1.5 only
        if (importedApi.getExplorerExtenderApi && importedApi.getExplorerExtenderApi().reloadProfiles) {
            await importedApi.getExplorerExtenderApi().reloadProfiles();
        }
        void vscode.window.showInformationMessage("Zowe Explorer was modified for FTP support.");
        return true;
    }
    void vscode.window.showInformationMessage(
        "Zowe Explorer was not found: either it is not installed or you are using an older version without extensibility API."
    );
    return false;
}
