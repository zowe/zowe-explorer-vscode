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

import { Gui, imperative, ProfilesCache, ZoweExplorerApiType } from "@zowe/zowe-explorer-api";
import * as vscode from "vscode";
import {
    type ClientOptions,
    SshClientCache,
    type IDisposable,
    type ZSshRestartOptions,
    ServerStatus,
    ZSshClient,
    ZSshUtils,
} from "@zowe/zowex-for-zowe-sdk";
import { ConfigUtils } from "./ConfigUtils";
import { deployWithProgress } from "./ServerDeployment";
import { SshErrorHandler } from "./SshErrorHandler";

/** Integrates SDK connection management with Explorer profiles, settings, and deployment/reload UI. */
export class SshClientManager extends SshClientCache {
    // Profiles with a reload prompt already on screen. One dropped connection can fail
    // several in-flight requests, and each would otherwise stack its own prompt.
    private readonly mActivePrompts: Set<string> = new Set();
    private static readonly ERROR_SNIPPETS = {
        FATAL: ["CEE5207E", "CEE3204S", "at compile unit offset", "Fatal error encountered in zowex"],
        UNSUPPORTED: ["CEE3561S"],
        TIMEOUT: ["Request timed out"],
    };
    private static readonly ACTIONS = {
        RELOAD: "Reload",
        RELOAD_RETRY: "Reload and Retry",
        CLOSE: "Close",
    };

    private constructor(private readonly mProfilesCache: ProfilesCache) {
        super();
    }

    public static initialize(profCache: ProfilesCache): SshClientManager {
        const instance = new SshClientManager(profCache);
        this.setInstance(instance);
        return instance;
    }

    public static get inst(): SshClientManager {
        return super.inst as SshClientManager;
    }

    public get profilesCache(): ProfilesCache {
        return this.mProfilesCache;
    }
    /**
     * Store the zo server path for the given host
     * @param host - host from the profile
     * @param path - parent directory of the zo server binary
     */
    public storeServerPath(host: string, serverPath: string): void {
        const config = vscode.workspace.getConfiguration("zowe");
        let serverPathMap: Record<string, string> = config.get("zowex.serverInstallPath") ?? {};
        if (!serverPathMap) {
            serverPathMap = {};
        }
        serverPathMap[host] = serverPath;
        config.update("zowex.serverInstallPath", serverPathMap, vscode.ConfigurationTarget.Global);
    }
    public async detectServerOnPath(session: Parameters<typeof ZSshUtils.installServer>[0]): Promise<string | undefined> {
        try {
            const serverPath = await super.detectServerOnPath(session);
            if (serverPath) {
                this.storeServerPath(session.ISshSession.hostname!, serverPath);
            }
            return serverPath;
        } catch (error) {
            imperative.Logger.getAppLogger().error(`Error detecting server on user's $PATH: ${(error as Error).toString()}`);
            await SshErrorHandler.getInstance().handleError(error as Error, ZoweExplorerApiType.All, "Detecting server on $PATH");
            return undefined;
        }
    }

    protected getClientOptions(profile: imperative.IProfileLoaded): ClientOptions {
        const config = vscode.workspace.getConfiguration("zowe");
        return {
            serverPath: ConfigUtils.getServerPath(profile.profile) ?? ZSshClient.DEFAULT_SERVER_PATH,
            keepAliveInterval: config.get<number>("zowex.keepAliveInterval"),
            numWorkers: config.get<number>("zowex.workerCount"),
            requestTimeout: config.get<number>("settings.requestTimeout", 0) / 1000 || 60,
            responseTimeout: config.get<number>("zowex.responseTimeout") ?? 60,
            useNativeSsh: config.get<boolean>("zowex.experimentalNativeSsh", false),
        };
    }

    protected onConnecting(profile: imperative.IProfileLoaded, opts: ZSshRestartOptions): IDisposable {
        return Gui.setStatusBarMessage(
            `$(sync~spin) ${opts.restart ? "Restarting" : "Starting"} zo server for profile "${profile.name as string}"...`
        );
    }

    protected deployServer(session: Parameters<typeof ZSshUtils.installServer>[0], serverPath: string): Promise<boolean> {
        return Promise.resolve(deployWithProgress(session, serverPath));
    }

    protected getWriteAccessError(serverPath: string): string {
        return vscode.l10n.t(SshClientManager.WRITE_ACCESS_TO_SERVER_PATH_ERR, serverPath);
    }

    protected createCancellationError(): Error {
        return new vscode.CancellationError();
    }

    protected async confirmServerDeployment(): Promise<boolean> {
        const config = vscode.workspace.getConfiguration("zowe");
        if (!config.get<boolean>("confirmSshServerDeploy", true)) {
            return true;
        }

        const connectButton = vscode.l10n.t("Connect");
        const connectDontAskButton = vscode.l10n.t("Connect, don't ask me again");
        const selection = await Gui.showMessage(
            vscode.l10n.t("The zo server must be installed or updated on z/OS UNIX before connecting. Would you like to proceed?"),
            { items: [vscode.l10n.t("Cancel"), connectButton, connectDontAskButton] }
        );
        if (selection === connectDontAskButton) {
            await config.update("confirmSshServerDeploy", false, vscode.ConfigurationTarget.Global);
        } else if (selection !== connectButton) {
            imperative.Logger.getAppLogger().info("User declined zo server deployment");
            return false;
        }
        return true;
    }

    private async reloadClient(profile: imperative.IProfileLoaded, retryRequests: boolean = false): Promise<void> {
        const clientId = this.getClientId(profile);
        const clientSession = this.mClientSessionMap.get(clientId);
        if (clientSession) {
            clientSession.status = ServerStatus.RESTARTING;
        }

        try {
            // Reconnecting can take up to the server startup timeout, so surface progress
            // rather than leaving the user with no feedback after they click Reload
            const reconnectPromise = Gui.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Reconnecting to Zowe Remote SSH for profile "${profile.name as string}"...`,
                },
                async () => {
                    const updatedProfile = await this.mProfilesCache.getLoadedProfConfig(profile.name!, profile.type);
                    if (updatedProfile == null) {
                        throw new Error(`Could not load profile ${profile.name}. Check that this profile still exists in your Zowe team config.`);
                    }

                    if (clientSession) {
                        clientSession.profile = updatedProfile;
                    }
                    await this.connect(updatedProfile, {
                        restart: clientSession != null,
                        retryRequests: clientSession != null && retryRequests,
                    });
                }
            );
            Gui.setStatusBarMessage(
                `$(sync~spin) ${clientSession != null ? "Restarting" : "Starting"} zo server for profile "${profile.name as string}"...`,
                reconnectPromise
            );
            await reconnectPromise;
            Gui.showMessage(`Reconnected to Zowe Remote SSH for profile "${profile.name as string}".`);
        } catch (err) {
            if (clientSession) {
                clientSession.status = ServerStatus.DOWN;
            }
            throw err;
        }
    }

    protected handleClientError(clientId: string, err: Error): void {
        const errorMsg = err.toString();
        const clientSession = this.mClientSessionMap.get(clientId);
        if (!clientSession) {
            imperative.Logger.getAppLogger().error(`Received SSH client error for untracked session ${clientId}: ${errorMsg}`);
            vscode.window.showErrorMessage(`Zowe Remote SSH encountered an error: ${errorMsg}. Try the operation again.`);
            return;
        }

        // If we're mid-reload, swallow the error notification (could be cascading)
        if (clientSession.status === ServerStatus.RESTARTING) {
            return;
        }

        const isFatal = SshClientManager.ERROR_SNIPPETS.FATAL.some((item) => errorMsg.includes(item));
        const isTimeout = SshClientManager.ERROR_SNIPPETS.TIMEOUT.some((item) => errorMsg.includes(item));
        const isUnsupported = SshClientManager.ERROR_SNIPPETS.UNSUPPORTED.some((item) => errorMsg.includes(item));

        if (isFatal) {
            clientSession.status = ServerStatus.DOWN;

            /** FYI: with the below `delete` ZRS silently restarts on error (good when navigating file trees and recovering from an error),
            /*   but makes managing sessions and replay requests more complex (repeated errors and restarts / merging long, multi-session replay queues)
            /*   and de-syncs notification pop-ups from ZRS state, creating unintuitive ux in some scenarios
            /*  Keeping this comment for posterity in case we revisit restart behavior later.
             */
            // this.mClientSessionMap.delete(clientId);
            this.promptErrorAndReload(
                "Zowe Remote SSH stopped unexpectedly. Choose 'Reload' to restart it, or 'Reload and Retry' to restart and automatically resend your active requests.",
                clientSession.profile
            );
            return;
        }

        if (isTimeout) {
            // This came before the server started, implying a crash and reload, and so we should ignore the error.
            const isOldTimeout = Date.now() - clientSession.responseTimeoutMillis < clientSession.startTime;
            if (!isOldTimeout) {
                const isDown = clientSession?.status === ServerStatus.DOWN;
                const msg = isDown
                    ? "A request timed out because the server is down. Click 'Reload' to restart it, or 'Reload and Retry' to restart and resend your active requests."
                    : "A request timed out. If the issue persists, select 'Reload' to restart the server, or 'Reload and Retry' to restart and resend your active requests.";

                this.promptErrorAndReload(msg, clientSession.profile);
            }

            return;
        }

        if (isUnsupported) {
            imperative.Logger.getAppLogger().error(JSON.stringify(err));
            vscode.window.showErrorMessage(
                "Zowe Remote SSH doesn't currently support this version of z/OS. Please check the documentation for supported systems, or contact support for help."
            );
            return;
        }

        // Fallback for unclassified errors
        vscode.window.showErrorMessage(errorMsg);
    }

    private promptErrorAndReload(message: string, profile: imperative.IProfileLoaded): void {
        const clientId = this.getClientId(profile);
        if (this.mActivePrompts.has(clientId)) {
            imperative.Logger.getAppLogger().debug(`Suppressed duplicate reload prompt for ${clientId}: ${message}`);
            return;
        }
        this.mActivePrompts.add(clientId);

        vscode.window
            .showErrorMessage(message, SshClientManager.ACTIONS.RELOAD, SshClientManager.ACTIONS.RELOAD_RETRY, SshClientManager.ACTIONS.CLOSE)
            .then((selection) => {
                this.mActivePrompts.delete(clientId);
                if (selection === SshClientManager.ACTIONS.RELOAD) {
                    this.reloadClient(profile, false).catch((err) => {
                        imperative.Logger.getAppLogger().error(`Failed to reload ZRS. Error: ${err.toString()}`);
                        vscode.window.showErrorMessage(`Failed to reload ZRS. Try reloading your VSCode environment`);
                    });
                } else if (selection === SshClientManager.ACTIONS.RELOAD_RETRY) {
                    this.reloadClient(profile, true).catch((err) => {
                        imperative.Logger.getAppLogger().error(`Failed to reload ZRS and retry requests. Error: ${err.toString()}`);
                        vscode.window.showErrorMessage(`Failed to reload ZRS and retry requests. Try reloading your VSCode environment`);
                    });
                }
            });
    }
}
