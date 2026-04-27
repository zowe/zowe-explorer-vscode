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

import type { SshSession } from "@zowe/zos-uss-for-zowe-sdk";
import { imperative, ProfilesCache } from "@zowe/zowe-explorer-api";
import * as vscode from "vscode";
import { type ClientOptions, type ExistingClientRequest, ZSshClient, ZSshUtils } from "@zowe/zowex-for-zowe-sdk";
import { ConfigUtils } from "./ConfigUtils";
import { deployWithProgress } from "./ServerDeployment";
import { getVsceConfig } from "./VsceConfig";

class AsyncMutex extends imperative.DeferredPromise<void> implements Disposable {
    constructor(private onDispose?: () => void) {
        super();
    }

    public [Symbol.dispose](): void {
        this.resolve();
        this.onDispose?.();
    }
}

type ZSshRestartOptions = {
    restart: boolean;
    retryRequests: boolean;
};

type ZSshClientSessions = {
    client: ZSshClient;
    profile: imperative.IProfileLoaded;
    status: ServerStatus;
    startTime: number;
    responseTimeoutMillis: number;
};

enum ServerStatus {
    UP,
    DOWN,
    RESTARTING,
}

export class SshClientCache extends vscode.Disposable {
    private static readonly mNoRestart: ZSshRestartOptions = { restart: false, retryRequests: false };
    private static mInstance: SshClientCache;
    private readonly mClientSessionMap: Map<string, ZSshClientSessions> = new Map();
    private mMutexMap: Map<string, AsyncMutex> = new Map();
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
        super(() => this.dispose());
    }

    public dispose(opts?: ZSshRestartOptions): void {
        for (const session of this.mClientSessionMap.values()) {
            session.client.dispose(opts?.restart);
        }
    }

    public static initialize(profCache: ProfilesCache): SshClientCache {
        SshClientCache.mInstance = new SshClientCache(profCache);
        return SshClientCache.mInstance;
    }

    public static get inst(): SshClientCache {
        return SshClientCache.mInstance;
    }

    public get profilesCache(): ProfilesCache {
        return this.mProfilesCache;
    }

    public async connect(
        profile: imperative.IProfileLoaded,
        opts: ZSshRestartOptions = SshClientCache.mNoRestart,
    ): Promise<ZSshClient> {
        const clientId = this.getClientId(profile);
        let replayRequests: Set<ExistingClientRequest> = new Set();
        await this.mMutexMap.get(clientId)?.promise;
        if (opts.restart) {
            if (opts.retryRequests) {
                const existingClient = this.mClientSessionMap.get(clientId)!.client;
                replayRequests = existingClient.collectAllRequests(opts.retryRequests); // client must exist if we're restarting it
            }
            this.end(clientId, opts);
        }

        if (!this.mClientSessionMap.has(clientId)) {
            using _lock = this.acquireProfileLock(clientId);
            const session = ZSshUtils.buildSession(profile.profile!);
            const serverPath = ConfigUtils.getServerPath(profile.profile);
            const vsceConfig = getVsceConfig();
            const keepAliveInterval = vsceConfig.get<number>("zowex.keepAliveInterval");
            const numWorkers = vsceConfig.get<number>("zowex.workerCount");
            const requestTimeout = (vsceConfig.get<number>("settings.requestTimeout", 0) / 1000) || 60;
            const responseTimeout = vsceConfig.get<number>("zowex.responseTimeout") ?? 60;
            const useNativeSsh = vsceConfig.get<boolean>("zowex.experimentalNativeSsh", false);
            const autoUpdate = vsceConfig.get<boolean>("zowex.serverAutoUpdate", true);

            let newClient: ZSshClient | undefined;
            try {
                newClient = await this.buildClient(session, clientId, {
                    serverPath,
                    keepAliveInterval,
                    numWorkers,
                    requestTimeout,
                    responseTimeout,
                    requests: replayRequests,
                    useNativeSsh,
                });
                imperative.Logger.getAppLogger().debug(
                    `Server checksums: ${JSON.stringify(newClient.serverChecksums)}`,
                );
                if (await ZSshUtils.checkIfOutdated(newClient.serverChecksums)) {
                    if (autoUpdate) {
                        imperative.Logger.getAppLogger().info(`Server is out of date, deploying to ${profile.name}`);
                        newClient = undefined;
                    } else {
                        imperative.Logger.getAppLogger().warn(
                            `Server is out of date, skipping update for ${profile.name}`,
                        );
                    }
                }
            } catch (err) {
                if (err instanceof imperative.ImperativeError && err.errorCode === "ENOTFOUND") {
                    imperative.Logger.getAppLogger().info(`Server is missing, deploying to ${profile.name}`);
                } else {
                    throw err;
                }
            }
            if (newClient == null) {
                await deployWithProgress(session, serverPath);
                newClient = await this.buildClient(session, clientId, {
                    serverPath,
                    keepAliveInterval,
                    numWorkers,
                    requestTimeout,
                    requests: replayRequests,
                    useNativeSsh,
                });
            }
            this.mClientSessionMap.set(clientId, {
                client: newClient,
                profile: profile,
                status: ServerStatus.UP,
                startTime: Date.now(),
                responseTimeoutMillis: responseTimeout * 1000,
            });
        }

        return this.mClientSessionMap.get(clientId)?.client as ZSshClient;
    }

    public end(
        hostOrProfile: string | imperative.IProfileLoaded,
        opts: ZSshRestartOptions = SshClientCache.mNoRestart,
    ): void {
        const clientId = typeof hostOrProfile === "string" ? hostOrProfile : this.getClientId(hostOrProfile);
        this.mClientSessionMap.get(clientId)?.client.dispose(opts.restart);
        this.mClientSessionMap.delete(clientId);
    }

    private async reloadClient(clientId: string, retryRequests: boolean = false): Promise<void> {
        const clientSession = this.mClientSessionMap.get(clientId);
        if (!clientSession) {
            imperative.Logger.getAppLogger().debug(
                `Attempted to reload non-existent session for ${clientId}. The session will not be reloaded.`,
            );
            return;
        }
        clientSession.status = ServerStatus.RESTARTING;
        const profile = clientSession.profile;
        const updatedProfile = await this.mProfilesCache.getLoadedProfConfig(profile.name!, profile.type);

        if (updatedProfile == null) {
            throw new Error(
                `Could not load profile ${profile.name}. Check that this profile still exists in your Zowe team config.`,
            );
        }

        clientSession.profile = updatedProfile;
        await this.connect(updatedProfile, { restart: true, retryRequests });
    }

    private getClientId(profile: imperative.IProfileLoaded): string {
        return `${profile.name}_${profile.type}`;
    }

    private acquireProfileLock(clientId: string): AsyncMutex {
        const lock = new AsyncMutex(() => this.mMutexMap.delete(clientId));
        this.mMutexMap.set(clientId, lock);
        return lock;
    }

    private buildClient(session: SshSession, clientId: string, opts: ClientOptions): Promise<ZSshClient> {
        return ZSshClient.create(session, {
            ...opts,
            onClose: () => {
                this.end(clientId);
            },
            onError: (err: Error) => {
                this.handleClientError(clientId, err);
            },
        });
    }

    private handleClientError(clientId: string, err: Error): void {
        const errorMsg = err.toString();
        const clientSession = this.mClientSessionMap.get(clientId)!; // a session must exist, since we're handling the client's error

        // If we're mid-reload, swallow the error notification (could be cascading)
        if (clientSession.status === ServerStatus.RESTARTING) {
            return;
        }

        const isFatal = SshClientCache.ERROR_SNIPPETS.FATAL.some((item) => errorMsg.includes(item));
        const isTimeout = SshClientCache.ERROR_SNIPPETS.TIMEOUT.some((item) => errorMsg.includes(item));
        const isUnsupported = SshClientCache.ERROR_SNIPPETS.UNSUPPORTED.some((item) => errorMsg.includes(item));

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
                clientId,
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

                this.promptErrorAndReload(msg, clientId);
            }

            return;
        }

        if (isUnsupported) {
            imperative.Logger.getAppLogger().error(JSON.stringify(err));
            vscode.window.showErrorMessage(
                "Zowe Remote SSH doesn't currently support this version of z/OS. Please check the documentation for supported systems, or contact support for help.",
            );
            return;
        }

        // Fallback for unclassified errors
        vscode.window.showErrorMessage(errorMsg);
    }

    private promptErrorAndReload(message: string, clientId: string): void {
        vscode.window
            .showErrorMessage(
                message,
                SshClientCache.ACTIONS.RELOAD,
                SshClientCache.ACTIONS.RELOAD_RETRY,
                SshClientCache.ACTIONS.CLOSE,
            )
            .then((selection) => {
                if (selection === SshClientCache.ACTIONS.RELOAD) {
                    this.reloadClient(clientId, false).catch((err) => {
                        imperative.Logger.getAppLogger().error(`Failed to reload ZRS. Error: ${err.toString()}`);
                        vscode.window.showErrorMessage(`Failed to reload ZRS. Try reloading your VSCode environment`);
                    });
                } else if (selection === SshClientCache.ACTIONS.RELOAD_RETRY) {
                    this.reloadClient(clientId, true).catch((err) => {
                        imperative.Logger.getAppLogger().error(
                            `Failed to reload ZRS and retry requests. Error: ${err.toString()}`,
                        );
                        vscode.window.showErrorMessage(
                            `Failed to reload ZRS and retry requests. Try reloading your VSCode environment`,
                        );
                    });
                }
            });
    }
}
