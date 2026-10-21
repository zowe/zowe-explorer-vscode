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
import { SessionContext, ZSshClient, ZSshUtils } from "@zowe/zowex-for-zowe-sdk";
import { ConfigUtils } from "./ConfigUtils";
import { VscePromptApi } from "./VscePromptApi";
import { SshClientCache } from "./SshClientCache";
import { SshErrorHandler } from "./SshErrorHandler";
import { deployWithProgress } from "./ServerDeployment";
import { deploySshOnlyWithProgress } from "./SshOnlyDeployment";
import * as path from "path";
import { ImperativeError } from "@zowe/imperative";

export class Utilities {
    public static registerCommands(context: vscode.ExtensionContext, zoweExplorerApi: IApiExplorerExtender): vscode.Disposable[] {
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
            vscode.commands.registerCommand(`zowe.zowex.connectSshOnly`, async (profName?: string) => {
                // The server PAX ships in the extension's bin directory, same as for the SFTP-based deploy
                const localPaxPath = path.join(context.extensionPath, "bin", "server.pax.Z");
                await Utilities.connectCallback(
                    zoweExplorerApi,
                    profName,
                    (session, dir) => deploySshOnlyWithProgress(session, dir, localPaxPath),
                    true
                );
            }),
        ];
    }

    private static async connectCallback(
        zoweExplorerApi: IApiExplorerExtender,
        profName?: string,
        deploy: (session: SessionContext, serverPath: string) => Thenable<boolean> = deployWithProgress,
        skipPreChecks = false
    ): Promise<void> {
        imperative.Logger.getAppLogger().trace("Running connect command for profile %s", profName);
        const profCache = zoweExplorerApi.getProfilesCache();
        const vscePromptApi = new VscePromptApi(await profCache.getProfileInfo());
        // Validation opens its own SSH connection, which means an extra MFA prompt, so skip it when asked to
        const profile = skipPreChecks
            ? await Utilities.promptForUnvalidatedProfile(profCache, vscePromptApi, profName)
            : await vscePromptApi.promptForProfile(profName, { prioritizeProjectLevelConfig: false });
        if (!profile?.profile) {
            return;
        }
        let configuredServerPath = ConfigUtils.getServerPath(profile.profile);
        const sshSession = ZSshUtils.buildSession(profile.profile);
        using sessionHandle = new SessionContext(sshSession);
        let onEnvPathServer: string | undefined = undefined;
        if (configuredServerPath == null && !skipPreChecks) {
            onEnvPathServer = await SshClientCache.inst.detectServerOnPath(sessionHandle);
        }
        configuredServerPath ??= onEnvPathServer ?? ZSshClient.DEFAULT_SERVER_PATH;

        const deployDirectory = onEnvPathServer
            ? configuredServerPath
            : await vscePromptApi.promptForDeployDirectory(profile.profile.host, configuredServerPath);
        if (!deployDirectory) {
            return;
        }
        let deployStatus = false;
        if (skipPreChecks || !(await ZSshUtils.lacksWriteAccess(sessionHandle, deployDirectory))) {
            deployStatus = await deploy(sessionHandle, deployDirectory);
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

    /**
     * Select an SSH profile without opening any connection to validate it. Credentials missing from the profile
     * are prompted for and kept in memory only, so the deploy session is the first and only authentication.
     */
    private static async promptForUnvalidatedProfile(
        profCache: ReturnType<IApiExplorerExtender["getProfilesCache"]>,
        vscePromptApi: VscePromptApi,
        profName?: string
    ): Promise<imperative.IProfileLoaded | undefined> {
        let name = profName;
        if (!name) {
            const profiles = (await profCache.fetchAllProfilesByType("ssh")).filter((prof) => prof.name && prof.profile?.host);
            const selected = await Gui.showQuickPick(
                profiles.map((prof) => ({ label: prof.name!, description: prof.profile!.host as string })),
                { placeHolder: vscode.l10n.t("Select configured SSH host"), ignoreFocusOut: true }
            );
            name = selected?.label;
            if (!name) {
                return undefined;
            }
        }
        // With a profile name this returns the merged profile (including secure values) without validating it
        const profile = await vscePromptApi.promptForProfile(name);
        if (!profile?.profile) {
            return undefined;
        }
        const props = profile.profile;
        if (!props.user) {
            props.user = await Gui.showInputBox({
                title: vscode.l10n.t("Enter user for host: '{0}'", props.host as string),
                ignoreFocusOut: true,
            });
            if (!props.user) {
                return undefined;
            }
        }
        if (!props.password && !props.privateKey && !props.identityAgent) {
            props.password = await Gui.showInputBox({
                title: vscode.l10n.t("{0}@{1}'s password:", props.user as string, props.host as string),
                password: true,
                ignoreFocusOut: true,
            });
            if (!props.password) {
                return undefined;
            }
        }
        return profile;
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
