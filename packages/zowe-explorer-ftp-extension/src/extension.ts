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
import { Gui, MessageSeverity, ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";
import { FtpUssApi } from "./ZoweExplorerFtpUssApi";
import { FtpMvsApi } from "./ZoweExplorerFtpMvsApi";
import { FtpJesApi } from "./ZoweExplorerFtpJesApi";
import { CoreUtils } from "@zowe/zos-ftp-for-zowe-cli";
import * as globals from "./globals";

export function activate(_context: vscode.ExtensionContext): void {
    void registerFtpApis();
}

export function deactivate(_context: vscode.ExtensionContext): void {
    globals.SESSION_MAP.forEach((session) => session.releaseConnections());
    globals.SESSION_MAP.clear();
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
        await zoweExplorerApi.getExplorerExtenderApi().initForZowe("zftp", [{ ...meta[0], schemaVersion: "2.0" } as any]);
        await zoweExplorerApi.getExplorerExtenderApi().reloadProfiles("zftp");

        await Gui.showMessage("Zowe Explorer was modified for FTP support.", { logger: globals.LOGGER });

        return true;
    }
    await Gui.showMessage("Zowe Explorer was not found: either it is not installed or you are using an older version without extensibility API.", {
        severity: MessageSeverity.FATAL,
        logger: globals.LOGGER,
    });
    return false;
}
