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
            // DEBUG ONLY — simulate a fatal ZRS crash to test the reload prompt and status bar message
            vscode.commands.registerCommand(`zowe.zowex.debugSimulateCrash`, async (profName?: string) => {
                await Utilities.debugSimulateCrash(zoweExplorerApi, profName);
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
        let onEnvPathServer: string | undefined = undefined;
        if (configuredServerPath == null) {
            onEnvPathServer = await SshClientCache.inst.detectServerOnPath(sshSession);
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
            const errMsg = vscode.l10n.t(SshClientCache.WRITE_ACCESS_TO_SERVER_PATH_ERR, deployDirectory);
            imperative.Logger.getAppLogger().error(errMsg);
            throw new ImperativeError({ msg: errMsg });
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

    // DEBUG ONLY — remove before merging to main
    private static async debugSimulateCrash(zoweExplorerApi: IApiExplorerExtender, profName?: string): Promise<void> {
        const profCache = zoweExplorerApi.getProfilesCache();
        const vscePromptApi = new VscePromptApi(await profCache.getProfileInfo());
        const profile = await vscePromptApi.promptForProfile(profName, { prioritizeProjectLevelConfig: false, disableCreateNewProfile: true });
        if (!profile?.profile) {
            return;
        }
        const clientId = `${profile.name}_${profile.type}`;
        // Inject a fake session so handleClientError has something to work with
        const cache = SshClientCache.inst as any;
        if (!cache.mClientSessionMap.has(clientId)) {
            vscode.window.showErrorMessage(`No active session found for profile "${profile.name as string}". Connect first then try again.`);
            return;
        }
        // Simulate a fatal crash error — triggers the Reload/Reload and Retry popup
        (cache as any).handleClientError(clientId, new Error("Fatal error encountered in zowex: simulated crash for testing"));
    }
}
