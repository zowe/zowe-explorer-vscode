import type { SshSession } from "@zowe/zos-uss-for-zowe-sdk";
import { Gui, ZoweExplorerApiType } from "@zowe/zowe-explorer-api";
import * as vscode from "vscode";
import { SshErrorHandler } from "./SshErrorHandler";
import { ZSshUtils } from "@zowe/zowex-for-zowe-sdk";

export function deployWithProgress(session: SshSession, serverPath: string): Thenable<boolean> {
    return Gui.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: "Deploying Zowe Remote SSH server...",
        },
        async (progress) => {
            // Create error callback that uses error correlations
            const errorCallback = SshErrorHandler.getInstance().createErrorCallback(ZoweExplorerApiType.All, "Server installation");

            // Pass callbacks for both progress and error handling
            return await ZSshUtils.installServer(session, serverPath, {
                onProgress: (progressIncrement) => {
                    progress.report({ increment: progressIncrement });
                },
                onError: errorCallback,
            });
        }
    );
}
