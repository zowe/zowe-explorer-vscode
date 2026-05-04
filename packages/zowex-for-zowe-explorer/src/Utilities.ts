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

import { Gui, imperative, ZoweExplorerApiType, type IApiExplorerExtender } from "@zowe/zowe-explorer-api";
import * as vscode from "vscode";
import { ZSshUtils } from "@zowe/zowex-for-zowe-sdk";
import { ConfigUtils } from "./ConfigUtils";
import { VscePromptApi } from "./VscePromptApi";
import { SshClientCache } from "./SshClientCache";
import { SshErrorHandler } from "./SshErrorHandler";
import { deployWithProgress } from "./ServerDeployment";

export function registerCommands(context: vscode.ExtensionContext, zoweExplorerApi: IApiExplorerExtender): vscode.Disposable[] {
    const profCache = zoweExplorerApi.getProfilesCache();
    return [
        vscode.commands.registerCommand(`zowe.zowex.connect`, async (profName?: string) => {
            imperative.Logger.getAppLogger().trace("Running connect command for profile %s", profName);
            const vscePromptApi = new VscePromptApi(await profCache.getProfileInfo());
            const profile = await vscePromptApi.promptForProfile(profName);
            if (!profile?.profile) {
                return;
            }
            const defaultServerPath = ConfigUtils.getServerPath(profile.profile);
            const deployDirectory = await vscePromptApi.promptForDeployDirectory(profile.profile.host, defaultServerPath);
            if (!deployDirectory) {
                return;
            }

            const sshSession = ZSshUtils.buildSession(profile.profile);
            const deployStatus = await deployWithProgress(sshSession, deployDirectory);
            if (!deployStatus) {
                return;
            }

            await ConfigUtils.showSessionInTree(profile.name!, true, zoweExplorerApi);
            const infoMsg = `Installed Zowe Remote SSH server on ${(profile.profile.host as string) ?? profile.name}`;
            imperative.Logger.getAppLogger().info(infoMsg);
            await Gui.showMessage(infoMsg);
        }),
        vscode.commands.registerCommand(`zowe.zowex.restart`, async (profName?: string) => {
            imperative.Logger.getAppLogger().trace("Running restart command for profile %s", profName);
            const vscePromptApi = new VscePromptApi(await profCache.getProfileInfo());
            const profile = await vscePromptApi.promptForProfile(profName);
            if (!profile?.profile) {
                return;
            }

            await SshClientCache.inst.connect(profile, { restart: true, retryRequests: false });

            imperative.Logger.getAppLogger().info(`Restarted Zowe Remote SSH server on ${(profile.profile?.host as string) ?? profile.name}`);
            const statusMsg = Gui.setStatusBarMessage("Restarted Zowe Remote SSH server");
            setTimeout(() => {
                statusMsg.dispose();
                // eslint-disable-next-line no-magic-numbers
            }, 5000);
        }),
        vscode.commands.registerCommand(`zowe.zowex.uninstall`, async (profName?: string) => {
            imperative.Logger.getAppLogger().trace("Running uninstall command for profile %s", profName);
            const vscePromptApi = new VscePromptApi(await profCache.getProfileInfo());
            const profile = await vscePromptApi.promptForProfile(profName);
            if (!profile?.profile) {
                return;
            }

            SshClientCache.inst.end(profile);
            const serverPath = ConfigUtils.getServerPath(profile.profile);
            await ConfigUtils.showSessionInTree(profile.name!, false, zoweExplorerApi);

            // Create error callback for uninstall operation
            const errorCallback = SshErrorHandler.getInstance().createErrorCallback(ZoweExplorerApiType.All, "Server uninstall");
            await ZSshUtils.uninstallServer(ZSshUtils.buildSession(profile.profile), serverPath, {
                onError: errorCallback,
            });

            const infoMsg = `Uninstalled Zowe Remote SSH server from ${(profile.profile.host as string) ?? profile.name}`;
            imperative.Logger.getAppLogger().info(infoMsg);
            await Gui.showMessage(infoMsg);
        }),
    ];
}
