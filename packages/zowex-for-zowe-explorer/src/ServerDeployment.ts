import type { SshSession } from "@zowe/zos-uss-for-zowe-sdk";
import { Gui, imperative, ZoweExplorerApiType } from "@zowe/zowe-explorer-api";
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
                onInsufficientSpaceWarning: async (remainingMB: number, recommendedMB: number) => {
                    const deployButton = vscode.l10n.t("Deploy");
                    const cancelButton = vscode.l10n.t("Cancel");
                    const message = vscode.l10n.t({
                        message: "The remote directory {0} appears to only have {1} MB available," +
                            " less than the recommended {2} MB of free space. Would you like to attempt deployment anyway?",
                        args: [serverPath, remainingMB, recommendedMB],
                        comment: ["The user-specified or default server path, available space " +
                            "for the server path and recommended available space in megabytes"],
                    });
                    imperative.Logger.getAppLogger().info(`Prompting the user to determine whether we should proceed` +
                        ` with the deployment despite the apparent lack of disk space (${remainingMB} of ${recommendedMB} MB)`);
                    const selection = await Gui.showMessage(message, { items: [deployButton, cancelButton] });
                    if (selection === deployButton) {
                        imperative.Logger.getAppLogger().info("User accepted the risk of insufficient disk space");
                        return true;
                    } else {
                        imperative.Logger.getAppLogger().info("User declined to continue with the deployment after disk space warning");
                        return false;
                    }
                }
            });
        }
    );
}
