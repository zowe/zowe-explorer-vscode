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
import { type IZoweTree, type IZoweTreeNode, type imperative, type IApiExplorerExtender } from "@zowe/zowe-explorer-api";
import { ZSshClient } from "@zowe/zowex-for-zowe-sdk";

export class ConfigUtils {
    public static getServerPath(profile?: imperative.IProfile): string {
        const serverPathMap: Record<string, string> = vscode.workspace.getConfiguration("zowe").get("zowex.serverInstallPath") ?? {};
        return (
            (profile && serverPathMap[profile?.host]) ??
            process.env.ZOWE_OPT_SERVER_PATH ??
            (profile?.serverPath as string) ??
            ZSshClient.DEFAULT_SERVER_PATH
        );
    }

    public static async showSessionInTree(profileName: string, visible: boolean, zoweExplorerApi: IApiExplorerExtender): Promise<void> {
        // This method is a hack until the ZE API offers a method to show/hide profile in tree
        // See https://github.com/zowe/zowe-explorer-vscode/issues/3506
        const treeProviders = ["datasetProvider", "ussFileProvider", "jobsProvider"].map(
            (prop) => (zoweExplorerApi as any)[prop] as IZoweTree<IZoweTreeNode>
        );
        const localStorage = zoweExplorerApi.getLocalStorage?.();
        for (const provider of treeProviders) {
            // Show or hide profile in active window
            const sessionNode = provider.mSessionNodes.find((node) => node.getProfileName() === profileName);
            if (visible && sessionNode == null) {
                await provider.addSession({ sessionName: profileName, profileType: "ssh" });
            } else if (!visible && sessionNode != null) {
                provider.deleteSession(sessionNode);
            }
            // Update tree session history to persist
            const settingName = provider.getTreeType();
            if (localStorage != null) {
                const treeHistory = localStorage.getValue<{ sessions: string[] }>(settingName);
                treeHistory.sessions = treeHistory.sessions.filter((session: string) => session !== profileName);
                if (visible) {
                    treeHistory.sessions.push(profileName);
                }
                localStorage.setValue(settingName, treeHistory);
            }
        }
    }
}
