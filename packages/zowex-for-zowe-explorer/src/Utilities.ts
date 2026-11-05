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
import { SshClientManager } from "./SshClientManager";
import { SshErrorHandler } from "./SshErrorHandler";
import { deployWithProgress } from "./ServerDeployment";
import { ImperativeError } from "@zowe/imperative";

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
        const profile = await vscePromptApi.promptForProfile(profName, {
            prioritizeProjectLevelConfig: false,
            keepAliveInterval: vscode.workspace.getConfiguration("zowe").get<number>("zowex.keepAliveInterval"),
        });
        if (!profile?.profile) {
            return;
        }
        let configuredServerPath = ConfigUtils.getServerPath(profile.profile);
        const sshSession = ZSshUtils.buildSession(profile.profile);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Keeps the transport alive for the workflow.
        using _connectionLease = await SshClientManager.inst.acquire(sshSession, {
            keepaliveInterval: vscode.workspace.getConfiguration("zowe").get<number>("zowex.keepAliveInterval"),
        });
        let onEnvPathServer: string | undefined = undefined;
        if (configuredServerPath == null) {
            onEnvPathServer = await SshClientManager.inst.detectServerOnPath(sshSession);
            configuredServerPath = onEnvPathServer ?? ZSshClient.DEFAULT_SERVER_PATH;
        }

        const deployDirectory = onEnvPathServer
            ? configuredServerPath
            : await vscePromptApi.promptForDeployDirectory(profile.profile.host, configuredServerPath);
        if (!deployDirectory) {
            return;
        }
        let deployStatus = false;
        if (!(await ZSshUtils.lacksWriteAccess(sshSession, deployDirectory))) {
            deployStatus = await deployWithProgress(sshSession, deployDirectory);
            if (!deployStatus) {
                return;
            }
        } else {
            const errMsg = vscode.l10n.t(SshClientManager.WRITE_ACCESS_TO_SERVER_PATH_ERR, deployDirectory);
            imperative.Logger.getAppLogger().error(errMsg);
            throw new ImperativeError({ msg: errMsg });
        }

        await ConfigUtils.showSessionInTree(profile.name!, true, zoweExplorerApi);
        if (deployStatus) {
            const infoMsg = `Installed zo server on ${(profile.profile.host as string) ?? profile.name}`;
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

        await SshClientManager.inst.connect(profile, { restart: true, retryRequests: false });

        imperative.Logger.getAppLogger().info(`Restarted zo server on ${(profile.profile?.host as string) ?? profile.name}`);
        const statusMsg = Gui.setStatusBarMessage("Restarted zo server");
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

        SshClientManager.inst.end(profile);
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

        const infoMsg = `Uninstalled zo server from ${(profile.profile.host as string) ?? profile.name}`;
        imperative.Logger.getAppLogger().info(infoMsg);
        await Gui.showMessage(infoMsg);
    }
}
