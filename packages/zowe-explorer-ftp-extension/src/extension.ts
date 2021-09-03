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
import { ZoweExplorerApi, ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";
import { FtpUssApi } from "./ZoweExplorerFtpUssApi";
import { FtpMvsApi } from "./ZoweExplorerFtpMvsApi";
import { FtpJesApi } from "./ZoweExplorerFtpJesApi";
import { CoreUtils } from "@zowe/zos-ftp-for-zowe-cli";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function activate(context: vscode.ExtensionContext): void {
    void registerFtpApis();
}

/**
 * Function that searches for the Zowe VS Code Extension and if found
 * registers the additional USS API implementation provided by this extension.
 */

async function registerFtpApis(): Promise<boolean> {
    const zoweExplorerApi = ZoweVsCodeExtension.getZoweExplorerApi("1.15.0");
    if (zoweExplorerApi) {
        zoweExplorerApi.registerUssApi(new FtpUssApi());
        zoweExplorerApi.registerMvsApi(new FtpMvsApi());
        zoweExplorerApi.registerJesApi(new FtpJesApi());

        const meta = await CoreUtils.getProfileMeta();
        await zoweExplorerApi.getExplorerExtenderApi().initForZowe("zftp", meta);
        await zoweExplorerApi.getExplorerExtenderApi().reloadProfiles("zftp");

        void vscode.window.showInformationMessage("Zowe Explorer was modified for FTP support.");

        return true;
    }
    void vscode.window.showInformationMessage(
        "Zowe Explorer was not found: either it is not installed or you are using an older version without extensibility API."
    );
    return false;
}
