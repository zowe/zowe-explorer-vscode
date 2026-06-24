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

import { ExtensionContext } from "vscode";
import { Utilities } from "../src/Utilities";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ZSshUtils } from "@zowe/zowex-for-zowe-sdk";

vi.mock("vscode", () => ({
    Disposable: vi.fn(),
    window: {
        createQuickPick: vi.fn(),
    },
    workspace: {
        getConfiguration: vi.fn(() => ({
            get: vi.fn(),
            update: vi.fn(),
        })),
    },
    ConfigurationTarget: {
        Global: 1,
        Workspace: 2,
        WorkspaceFolder: 3,
    },
    commands: {
        registerCommand: vi.fn(),
    },
}));

vi.mock("@zowe/zowe-explorer-api", () => {
    class MockDeferredPromise {
        promise = Promise.resolve();
        resolve = vi.fn();
    }
    return {
        Gui: {
            showMessage: vi.fn(),
            setStatusBarMessage: vi.fn(() => ({ dispose: vi.fn() })),
        },
        ZoweExplorerApiType: {
            All: "all",
            Mvs: "mvs",
            Uss: "uss",
            Jobs: "jobs",
            Command: "command",
        },
        ZoweVsCodeExtension: {
            getZoweExplorerApi: () => ({
                getExplorerExtenderApi: () => ({
                    getProfilesCache: () => ({
                        getLoadedProfConfig: vi.fn(),
                        getProfilesCache: vi.fn(),
                        getProfileInfo: vi.fn().mockResolvedValue({}),
                    }),
                }),
            }),
        },
        imperative: {
            Logger: {
                getAppLogger: () => ({
                    debug: vi.fn(),
                    error: vi.fn(),
                    info: vi.fn(),
                    warn: vi.fn(),
                    trace: vi.fn(),
                }),
            },
            ImperativeError: class extends Error {
                errorCode: string;
                constructor(msg: string) {
                    super(msg);
                    this.errorCode = "ENOTFOUND";
                }
            },
            DeferredPromise: MockDeferredPromise,
        },
    };
});

// VscePromptApi is instantiated inside the callbacks; replace its prototype methods.
vi.mock("../src/VscePromptApi", () => ({
    VscePromptApi: vi.fn().mockImplementation(() => ({
        promptForProfile: vi.fn(),
        promptForDeployDirectory: vi.fn(),
    })),
}));
vi.mock("../src/ServerDeployment", () => ({
    deployWithProgress: vi.fn().mockResolvedValue(true),
}));
vi.mock("../src/ConfigUtils", () => ({
    ConfigUtils: {
        getServerPath: vi.fn().mockReturnValue("/mock/server/path"),
        showSessionInTree: vi.fn().mockResolvedValue(undefined),
    },
}));
vi.mock("../src/SshClientCache", () => ({
    SshClientCache: {
        inst: {
            connect: vi.fn().mockResolvedValue({}),
            end: vi.fn(),
        },
    },
}));
vi.mock("../src/SshErrorHandler", () => ({
    SshErrorHandler: {
        getInstance: () => ({
            createErrorCallback: vi.fn().mockReturnValue(vi.fn()),
        }),
    },
}));
vi.mock("@zowe/zowex-for-zowe-sdk", () => ({
    ZSshUtils: {
        buildSession: vi.fn().mockReturnValue({ ISshSession: {} }),
        uninstallServer: vi.fn().mockResolvedValue(undefined),
    },
}));

describe("Utilities", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should register the connect/restart/uninstall commands", async () => {
        const mockedExplorer = await vi.importMock("@zowe/zowe-explorer-api");
        const mockedVscode = await vi.importMock("vscode");
        const registerCommandSpy = vi.spyOn(mockedVscode.commands, "registerCommand");

        Utilities.registerCommands({} as ExtensionContext, mockedExplorer.ZoweVsCodeExtension.getZoweExplorerApi().getExplorerExtenderApi());

        expect(registerCommandSpy).toHaveBeenCalledTimes(3);
        expect(registerCommandSpy).toHaveBeenCalledWith("zowe.zowex.connect", expect.any(Function));
        expect(registerCommandSpy).toHaveBeenCalledWith("zowe.zowex.restart", expect.any(Function));
        expect(registerCommandSpy).toHaveBeenCalledWith("zowe.zowex.uninstall", expect.any(Function));
    });

    it("should invoke the underlying callbacks when the registered commands are called", async () => {
        const mockedExplorer = await vi.importMock("@zowe/zowe-explorer-api");
        const mockedVscode = await vi.importMock("vscode");
        const registerCommandSpy = vi.spyOn(mockedVscode.commands, "registerCommand");
        const connectSpy = vi.spyOn(Utilities as any, "connectCallback").mockResolvedValue(undefined);
        const restartSpy = vi.spyOn(Utilities as any, "restartCallback").mockResolvedValue(undefined);
        const uninstallSpy = vi.spyOn(Utilities as any, "uninstallCallback").mockResolvedValue(undefined);
        const api = mockedExplorer.ZoweVsCodeExtension.getZoweExplorerApi().getExplorerExtenderApi();

        Utilities.registerCommands({} as ExtensionContext, api);

        await registerCommandSpy.mock.calls[0][1]("prof1");
        await registerCommandSpy.mock.calls[1][1]("prof2");
        await registerCommandSpy.mock.calls[2][1]("prof3");

        expect(connectSpy).toHaveBeenCalledWith(api, "prof1");
        expect(restartSpy).toHaveBeenCalledWith(api, "prof2");
        expect(uninstallSpy).toHaveBeenCalledWith(api, "prof3");
    });

    it("should dispose the restart status message after the timeout elapses", async () => {
        vi.useFakeTimers();
        try {
            const mockedExplorer = await vi.importMock("@zowe/zowe-explorer-api");
            const { VscePromptApi } = await vi.importMock("../src/VscePromptApi");
            const profile = { name: "myProf", profile: { host: "h" } };
            VscePromptApi.mockImplementation(() => ({ promptForProfile: vi.fn().mockResolvedValue(profile) }));
            const mockedCache = await vi.importMock("../src/SshClientCache");
            vi.spyOn(mockedCache.SshClientCache.inst, "connect").mockResolvedValue({} as any);
            const disposeSpy = vi.fn();
            vi.spyOn(mockedExplorer.Gui, "setStatusBarMessage").mockReturnValue({ dispose: disposeSpy } as any);

            const api = mockedExplorer.ZoweVsCodeExtension.getZoweExplorerApi().getExplorerExtenderApi();
            await (Utilities as any).restartCallback(api, "myProf");

            expect(disposeSpy).not.toHaveBeenCalled();
            // eslint-disable-next-line no-magic-numbers
            vi.advanceTimersByTime(5000);
            expect(disposeSpy).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });

    describe("connectCallback", () => {
        it("should deploy the server and report success when a profile and directory are chosen", async () => {
            const mockedExplorer = await vi.importMock("@zowe/zowe-explorer-api");
            const mockedConfig = await vi.importMock("../src/ConfigUtils");
            const mockedDeploy = await vi.importMock("../src/ServerDeployment");
            const { VscePromptApi } = await vi.importMock("../src/VscePromptApi");

            const profile = { name: "myProf", profile: { host: "myHost", serverPath: "/x" } };
            const promptForProfile = vi.fn().mockResolvedValue(profile);
            const promptForDeployDirectory = vi.fn().mockResolvedValue("/deploy/dir");
            VscePromptApi.mockImplementation(() => ({ promptForProfile, promptForDeployDirectory }));

            vi.spyOn(mockedConfig.ConfigUtils, "getServerPath").mockReturnValue("/default/path");
            const showSessionSpy = vi.spyOn(mockedConfig.ConfigUtils, "showSessionInTree").mockResolvedValue(undefined);
            const showMessageSpy = vi.spyOn(mockedExplorer.Gui, "showMessage");
            const deploySpy = vi.spyOn(mockedDeploy, "deployWithProgress").mockResolvedValue(true);
            const buildSessionSpy = vi.spyOn(ZSshUtils, "buildSession").mockReturnValue({ ISshSession: {} });

            const api = mockedExplorer.ZoweVsCodeExtension.getZoweExplorerApi().getExplorerExtenderApi();
            await (Utilities as any).connectCallback(api, "myProf");

            expect(promptForProfile).toHaveBeenCalledWith("myProf", { prioritizeProjectLevelConfig: false });
            expect(promptForDeployDirectory).toHaveBeenCalledWith("myHost", "/default/path");
            expect(buildSessionSpy).toHaveBeenCalledWith(profile.profile);
            expect(deploySpy).toHaveBeenCalledWith({ ISshSession: {} }, "/deploy/dir");
            expect(showSessionSpy).toHaveBeenCalledWith("myProf", true, api);
            expect(showMessageSpy).toHaveBeenCalledTimes(1);
        });

        it("should fall back to the profile name in the info message when host is undefined", async () => {
            const mockedExplorer = await vi.importMock("@zowe/zowe-explorer-api");
            const mockedDeploy = await vi.importMock("../src/ServerDeployment");
            const { VscePromptApi } = await vi.importMock("../src/VscePromptApi");
            const profile = { name: "myProf", profile: {} }; // no host
            VscePromptApi.mockImplementation(() => ({
                promptForProfile: vi.fn().mockResolvedValue(profile),
                promptForDeployDirectory: vi.fn().mockResolvedValue("/deploy/dir"),
            }));
            vi.spyOn(mockedDeploy, "deployWithProgress").mockResolvedValue(true);
            const showMessageSpy = vi.spyOn(mockedExplorer.Gui, "showMessage");

            const api = mockedExplorer.ZoweVsCodeExtension.getZoweExplorerApi().getExplorerExtenderApi();
            await (Utilities as any).connectCallback(api, "myProf");

            expect(showMessageSpy).toHaveBeenCalledWith("Installed Zowe Remote SSH server on myProf");
        });

        it("should abort when no profile is selected", async () => {
            const { VscePromptApi } = await vi.importMock("../src/VscePromptApi");
            const promptForProfile = vi.fn().mockResolvedValue(undefined);
            const promptForDeployDirectory = vi.fn();
            VscePromptApi.mockImplementation(() => ({ promptForProfile, promptForDeployDirectory }));

            const api = (await vi.importMock("@zowe/zowe-explorer-api")).ZoweVsCodeExtension.getZoweExplorerApi().getExplorerExtenderApi();
            await (Utilities as any).connectCallback(api);

            expect(promptForDeployDirectory).not.toHaveBeenCalled();
        });

        it("should abort when no deploy directory is chosen", async () => {
            const mockedExplorer = await vi.importMock("@zowe/zowe-explorer-api");
            const mockedDeploy = await vi.importMock("../src/ServerDeployment");
            const { VscePromptApi } = await vi.importMock("../src/VscePromptApi");
            const profile = { name: "p", profile: { host: "h" } };
            const promptForProfile = vi.fn().mockResolvedValue(profile);
            const promptForDeployDirectory = vi.fn().mockResolvedValue(undefined);
            VscePromptApi.mockImplementation(() => ({ promptForProfile, promptForDeployDirectory }));

            const deploySpy = vi.spyOn(mockedDeploy, "deployWithProgress");
            const api = mockedExplorer.ZoweVsCodeExtension.getZoweExplorerApi().getExplorerExtenderApi();
            await (Utilities as any).connectCallback(api);

            expect(deploySpy).not.toHaveBeenCalled();
        });

        it("should abort when deployment fails", async () => {
            const mockedConfig = await vi.importMock("../src/ConfigUtils");
            const mockedDeploy = await vi.importMock("../src/ServerDeployment");
            const { VscePromptApi } = await vi.importMock("../src/VscePromptApi");
            const profile = { name: "p", profile: { host: "h" } };
            VscePromptApi.mockImplementation(() => ({
                promptForProfile: vi.fn().mockResolvedValue(profile),
                promptForDeployDirectory: vi.fn().mockResolvedValue("/dir"),
            }));
            vi.spyOn(mockedDeploy, "deployWithProgress").mockResolvedValue(false);
            const showSessionSpy = vi.spyOn(mockedConfig.ConfigUtils, "showSessionInTree");

            const api = (await vi.importMock("@zowe/zowe-explorer-api")).ZoweVsCodeExtension.getZoweExplorerApi().getExplorerExtenderApi();
            await (Utilities as any).connectCallback(api);

            expect(showSessionSpy).not.toHaveBeenCalled();
        });

        it("should propagate a thrown error from deployWithProgress", async () => {
            const mockedDeploy = await vi.importMock("../src/ServerDeployment");
            const { VscePromptApi } = await vi.importMock("../src/VscePromptApi");
            const profile = { name: "p", profile: { host: "h" } };
            VscePromptApi.mockImplementation(() => ({
                promptForProfile: vi.fn().mockResolvedValue(profile),
                promptForDeployDirectory: vi.fn().mockResolvedValue("/dir"),
            }));
            vi.spyOn(mockedDeploy, "deployWithProgress").mockRejectedValue(new Error("deploy exploded"));

            const api = (await vi.importMock("@zowe/zowe-explorer-api")).ZoweVsCodeExtension.getZoweExplorerApi().getExplorerExtenderApi();
            await expect((Utilities as any).connectCallback(api)).rejects.toThrow("deploy exploded");
        });
    });

    describe("restartCallback", () => {
        it("should restart the SSH server and report a status message", async () => {
            const mockedExplorer = await vi.importMock("@zowe/zowe-explorer-api");
            const mockedCache = await vi.importMock("../src/SshClientCache");
            const { VscePromptApi } = await vi.importMock("../src/VscePromptApi");
            const profile = { name: "myProf", profile: { host: "myHost" } };
            VscePromptApi.mockImplementation(() => ({
                promptForProfile: vi.fn().mockResolvedValue(profile),
            }));

            const connectSpy = vi.spyOn(mockedCache.SshClientCache.inst, "connect").mockResolvedValue({} as any);
            const statusSpy = vi.spyOn(mockedExplorer.Gui, "setStatusBarMessage");

            const api = mockedExplorer.ZoweVsCodeExtension.getZoweExplorerApi().getExplorerExtenderApi();
            await (Utilities as any).restartCallback(api, "myProf");

            expect(connectSpy).toHaveBeenCalledWith(profile, { restart: true, retryRequests: false });
            expect(statusSpy).toHaveBeenCalledWith("Restarted Zowe Remote SSH server");
        });

        it("should abort when no profile is selected", async () => {
            const mockedCache = await vi.importMock("../src/SshClientCache");
            const { VscePromptApi } = await vi.importMock("../src/VscePromptApi");
            VscePromptApi.mockImplementation(() => ({ promptForProfile: vi.fn().mockResolvedValue(undefined) }));

            const connectSpy = vi.spyOn(mockedCache.SshClientCache.inst, "connect");
            const api = (await vi.importMock("@zowe/zowe-explorer-api")).ZoweVsCodeExtension.getZoweExplorerApi().getExplorerExtenderApi();
            await (Utilities as any).restartCallback(api);

            expect(connectSpy).not.toHaveBeenCalled();
        });

        it("should fall back to the profile name in the info log when host is undefined", async () => {
            const mockedExplorer = await vi.importMock("@zowe/zowe-explorer-api");
            const mockedCache = await vi.importMock("../src/SshClientCache");
            const { VscePromptApi } = await vi.importMock("../src/VscePromptApi");
            const profile = { name: "myProf", profile: {} }; // no host
            VscePromptApi.mockImplementation(() => ({ promptForProfile: vi.fn().mockResolvedValue(profile) }));
            vi.spyOn(mockedCache.SshClientCache.inst, "connect").mockResolvedValue({} as any);
            const infoSpy = vi.fn();
            vi.spyOn(mockedExplorer.imperative.Logger, "getAppLogger").mockReturnValue({ trace: vi.fn(), info: infoSpy } as any);

            const api = mockedExplorer.ZoweVsCodeExtension.getZoweExplorerApi().getExplorerExtenderApi();
            await (Utilities as any).restartCallback(api, "myProf");

            expect(infoSpy).toHaveBeenCalledWith("Restarted Zowe Remote SSH server on myProf");
        });

        it("should propagate a rejection from connect", async () => {
            const mockedCache = await vi.importMock("../src/SshClientCache");
            const { VscePromptApi } = await vi.importMock("../src/VscePromptApi");
            const profile = { name: "myProf", profile: { host: "myHost" } };
            VscePromptApi.mockImplementation(() => ({
                promptForProfile: vi.fn().mockResolvedValue(profile),
            }));
            vi.spyOn(mockedCache.SshClientCache.inst, "connect").mockRejectedValue(new Error("connect failed"));

            const api = (await vi.importMock("@zowe/zowe-explorer-api")).ZoweVsCodeExtension.getZoweExplorerApi().getExplorerExtenderApi();
            await expect((Utilities as any).restartCallback(api, "myProf")).rejects.toThrow("connect failed");
        });
    });

    describe("uninstallCallback", () => {
        it("should end the session and uninstall the server", async () => {
            const mockedExplorer = await vi.importMock("@zowe/zowe-explorer-api");
            const mockedConfig = await vi.importMock("../src/ConfigUtils");
            const mockedCache = await vi.importMock("../src/SshClientCache");
            const { VscePromptApi } = await vi.importMock("../src/VscePromptApi");
            const profile = { name: "myProf", profile: { host: "myHost" } };
            VscePromptApi.mockImplementation(() => ({
                promptForProfile: vi.fn().mockResolvedValue(profile),
            }));

            vi.spyOn(mockedConfig.ConfigUtils, "getServerPath").mockReturnValue("/server/path");
            const showSessionSpy = vi.spyOn(mockedConfig.ConfigUtils, "showSessionInTree").mockResolvedValue(undefined);
            const endSpy = vi.spyOn(mockedCache.SshClientCache.inst, "end");
            const uninstallSpy = vi.spyOn(ZSshUtils, "uninstallServer").mockResolvedValue(undefined);
            vi.spyOn(ZSshUtils, "buildSession").mockReturnValue({ ISshSession: {} });
            const showMessageSpy = vi.spyOn(mockedExplorer.Gui, "showMessage");

            const api = mockedExplorer.ZoweVsCodeExtension.getZoweExplorerApi().getExplorerExtenderApi();
            await (Utilities as any).uninstallCallback(api, "myProf");

            expect(endSpy).toHaveBeenCalledWith(profile);
            expect(showSessionSpy).toHaveBeenCalledWith("myProf", false, api);
            expect(uninstallSpy).toHaveBeenCalledWith({ ISshSession: {} }, "/server/path", { onError: expect.any(Function) });
            expect(showMessageSpy).toHaveBeenCalledTimes(1);
        });

        it("should abort when no profile is selected", async () => {
            const mockedCache = await vi.importMock("../src/SshClientCache");
            const { VscePromptApi } = await vi.importMock("../src/VscePromptApi");
            VscePromptApi.mockImplementation(() => ({ promptForProfile: vi.fn().mockResolvedValue(undefined) }));

            const endSpy = vi.spyOn(mockedCache.SshClientCache.inst, "end");
            const api = (await vi.importMock("@zowe/zowe-explorer-api")).ZoweVsCodeExtension.getZoweExplorerApi().getExplorerExtenderApi();
            await (Utilities as any).uninstallCallback(api);

            expect(endSpy).not.toHaveBeenCalled();
        });

        it("should fall back to the profile name in the info message when host is undefined", async () => {
            const mockedExplorer = await vi.importMock("@zowe/zowe-explorer-api");
            const mockedConfig = await vi.importMock("../src/ConfigUtils");
            const mockedCache = await vi.importMock("../src/SshClientCache");
            const { VscePromptApi } = await vi.importMock("../src/VscePromptApi");
            const profile = { name: "myProf", profile: {} }; // no host
            VscePromptApi.mockImplementation(() => ({ promptForProfile: vi.fn().mockResolvedValue(profile) }));

            vi.spyOn(mockedConfig.ConfigUtils, "getServerPath").mockReturnValue("/server/path");
            vi.spyOn(mockedConfig.ConfigUtils, "showSessionInTree").mockResolvedValue(undefined);
            vi.spyOn(mockedCache.SshClientCache.inst, "end");
            vi.spyOn(ZSshUtils, "uninstallServer").mockResolvedValue(undefined);
            vi.spyOn(ZSshUtils, "buildSession").mockReturnValue({ ISshSession: {} });
            const showMessageSpy = vi.spyOn(mockedExplorer.Gui, "showMessage");

            const api = mockedExplorer.ZoweVsCodeExtension.getZoweExplorerApi().getExplorerExtenderApi();
            await (Utilities as any).uninstallCallback(api, "myProf");

            expect(showMessageSpy).toHaveBeenCalledWith("Uninstalled Zowe Remote SSH server from myProf");
        });

        it("should propagate a rejection from ZSshUtils.uninstallServer", async () => {
            const mockedExplorer = await vi.importMock("@zowe/zowe-explorer-api");
            const mockedConfig = await vi.importMock("../src/ConfigUtils");
            const { VscePromptApi } = await vi.importMock("../src/VscePromptApi");
            const profile = { name: "myProf", profile: { host: "myHost" } };
            VscePromptApi.mockImplementation(() => ({ promptForProfile: vi.fn().mockResolvedValue(profile) }));

            vi.spyOn(mockedConfig.ConfigUtils, "getServerPath").mockReturnValue("/server/path");
            vi.spyOn(mockedConfig.ConfigUtils, "showSessionInTree").mockResolvedValue(undefined);
            vi.spyOn(ZSshUtils, "buildSession").mockReturnValue({ ISshSession: {} });
            vi.spyOn(ZSshUtils, "uninstallServer").mockRejectedValue(new Error("uninstall failed"));

            const api = mockedExplorer.ZoweVsCodeExtension.getZoweExplorerApi().getExplorerExtenderApi();
            await expect((Utilities as any).uninstallCallback(api, "myProf")).rejects.toThrow("uninstall failed");
        });
    });
});
