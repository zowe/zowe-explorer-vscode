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
import { ZSshClient, ZSshUtils } from "@zowe/zowex-for-zowe-sdk";
import { ConfigUtils } from "./ConfigUtils";
import { VscePromptApi } from "./VscePromptApi";
import { SshClientCache } from "./SshClientCache";
import { SshErrorHandler } from "./SshErrorHandler";
import { deployWithProgress } from "./ServerDeployment";

export class Utilities {
    public static registerCommands(_context: vscode.ExtensionContext, zoweExplorerApi: IApiExplorerExtender): vscode.Disposable[] {
        return [
            vscode.commands.registerCommand(`zowe.zowex.connect`, async (profName?: string) => {
                await Utilities.connectCallback(zoweExplorerApi, profName);
            }),
            vscode.commands.registerCommand(`zowe.zowex.restart`, async (profName?: string) => {
                await Utilities.restartCallback(zoweExplorerApi, profName);
            }),
            vscode.commands.registerCommand(`zowe.zowex.uninstall`, async (profName?: string) => {
                await Utilities.uninstallCallback(zoweExplorerApi, profName);
            }),
        ];
    }

    private static async connectCallback(zoweExplorerApi: IApiExplorerExtender, profName?: string): Promise<void> {
        imperative.Logger.getAppLogger().trace("Running connect command for profile %s", profName);
        const profCache = zoweExplorerApi.getProfilesCache();
        const vscePromptApi = new VscePromptApi(await profCache.getProfileInfo());
        const profile = await vscePromptApi.promptForProfile(profName, { prioritizeProjectLevelConfig: false });
        if (!profile?.profile) {
            return;
        }
        let configuredServerPath = ConfigUtils.getServerPath(profile.profile);
        const sshSession = ZSshUtils.buildSession(profile.profile);
        let serverIsOnPath = false;
        if (configuredServerPath == null) {
            serverIsOnPath = await SshClientCache.inst.isServerDetectedOnPath(sshSession, profile.profile);
            // isServerDetectedOnPath will set the configured server path if a $PATH instance is found
            configuredServerPath = ConfigUtils.getServerPath(profile.profile) ?? ZSshClient.DEFAULT_SERVER_PATH;
        }

        const deployDirectory = serverIsOnPath
            ? configuredServerPath
            : await vscePromptApi.promptForDeployDirectory(profile.profile.host, configuredServerPath);
        if (!deployDirectory) {
            return;
        }
        let deployStatus = false;
        if (!await ZSshUtils.lacksWriteAccess(sshSession, deployDirectory)) {
            deployStatus = await deployWithProgress(sshSession, deployDirectory);
            if (!deployStatus) {
                return;
            }
        } else {
            imperative.Logger.getAppLogger()
                .info("Skipped deploy step as server path '%s' is not writeable by the user", deployDirectory);
        }

        await ConfigUtils.showSessionInTree(profile.name!, true, zoweExplorerApi);
        if (deployStatus) {
            const infoMsg = `Installed Zowe Remote SSH server on ${(profile.profile.host as string) ?? profile.name}`;
            imperative.Logger.getAppLogger().info(infoMsg);
            await Gui.showMessage(infoMsg);
        }
    }

    private static async restartCallback(zoweExplorerApi: IApiExplorerExtender, profName?: string): Promise<void> {
        imperative.Logger.getAppLogger().trace("Running restart command for profile %s", profName);
        const profCache = zoweExplorerApi.getProfilesCache();
        const vscePromptApi = new VscePromptApi(await profCache.getProfileInfo());
        const profile = await vscePromptApi.promptForProfile(profName, { prioritizeProjectLevelConfig: false, disableCreateNewProfile: true });
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
    }

    private static async uninstallCallback(zoweExplorerApi: IApiExplorerExtender, profName?: string): Promise<void> {
        imperative.Logger.getAppLogger().trace("Running uninstall command for profile %s", profName);
        const profCache = zoweExplorerApi.getProfilesCache();
        const vscePromptApi = new VscePromptApi(await profCache.getProfileInfo());
        const profile = await vscePromptApi.promptForProfile(profName, { prioritizeProjectLevelConfig: false, disableCreateNewProfile: true });
        if (!profile?.profile) {
            return;
        }

        SshClientCache.inst.end(profile);
        const serverPath = ConfigUtils.getServerPath(profile.profile);
        if (serverPath == null) {
            return;
        }

        await ConfigUtils.showSessionInTree(profile.name!, false, zoweExplorerApi);

        // Create error callback for uninstall operation
        const errorCallback = SshErrorHandler.getInstance().createErrorCallback(ZoweExplorerApiType.All, "Server uninstall");
        await ZSshUtils.uninstallServer(ZSshUtils.buildSession(profile.profile), serverPath, {
            onError: errorCallback,
        });

        const infoMsg = `Uninstalled Zowe Remote SSH server from ${(profile.profile.host as string) ?? profile.name}`;
        imperative.Logger.getAppLogger().info(infoMsg);
        await Gui.showMessage(infoMsg);
    }
}
