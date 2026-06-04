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
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { ZSshUtils } from "@zowe/zowex-for-zowe-sdk";
import { ConfigUtils } from "../src/ConfigUtils";
import * as deploy from "../src/ServerDeployment";
import { VscePromptApi } from "../src/VscePromptApi";

function createMocks(): void {
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
    // vi.mock("../src/VscePromptApi", async () => {
    //     const VscePromptApi = vi.fn().mockImplementation(() => {
    //         return { prototype: {} };
    //     });
    //     VscePromptApi.prototype.promptForProfile = vi
    //         .fn()
    //         .mockResolvedValue({ type: "fake", message: "fake", failNotFound: true, profile: { data: "fake" } });
    //     VscePromptApi.prototype.promptForDeployDirectory = vi.fn().mockResolvedValue("fake");
    //     return { VscePromptApi };
    // });
    vi.mock("../src/ServerDeployment", () => {
        return {
            deployWithProgress: vi.fn().mockResolvedValue(true),
        };
    });
}

describe("Utilities", () => {
    beforeEach(() => {
        createMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should register commands with vscode", async () => {
        const mockedExplorer = await vi.importMock("@zowe/zowe-explorer-api");
        const mockedVscode = await vi.importMock("vscode");
        const registerCommandSpy = vi.spyOn(mockedVscode.commands, "registerCommand");
        const connectCallbackSpy = vi.spyOn(Utilities as any, "connectCallback");
        const restartCallbackSpy = vi.spyOn(Utilities as any, "restartCallback");
        const uninstallCallbackSpy = vi.spyOn(Utilities as any, "uninstallCallback");
        Utilities.registerCommands({} as ExtensionContext, mockedExplorer.ZoweVsCodeExtension.getZoweExplorerApi().getExplorerExtenderApi());
        expect(registerCommandSpy).toHaveBeenCalledTimes(3);
        expect(registerCommandSpy).toHaveBeenCalledWith("zowe.zowex.connect", expect.any(Function));
        expect(registerCommandSpy).toHaveBeenCalledWith("zowe.zowex.restart", expect.any(Function));
        expect(registerCommandSpy).toHaveBeenCalledWith("zowe.zowex.uninstall", expect.any(Function));
        expect(connectCallbackSpy).not.toHaveBeenCalled();
        expect(restartCallbackSpy).not.toHaveBeenCalled();
        expect(uninstallCallbackSpy).not.toHaveBeenCalled();
    });

    describe("connectCallback", () => {
        it("should invoke the connect callback", async () => {
            const mockedExplorer = await vi.importMock("@zowe/zowe-explorer-api");
            const _mockedVscode = await vi.importMock("vscode");

            const traceLoggerSpy = vi.fn();
            const infoLoggerSpy = vi.fn();
            const getProfileInfoSpy = vi.fn();
            const getProfilesCacheSpy = vi.fn().mockReturnValue({ getProfileInfo: getProfileInfoSpy });
            const getExplorerExtenderApiSpy = vi.fn().mockReturnValue({ getProfilesCache: getProfilesCacheSpy });

            const getLoggerSpy = vi
                .spyOn(mockedExplorer.imperative.Logger, "getAppLogger")
                .mockReturnValue({ trace: traceLoggerSpy, info: infoLoggerSpy });
            const getZoweExplorerApiSpy = vi
                .spyOn(mockedExplorer.ZoweVsCodeExtension, "getZoweExplorerApi")
                .mockReturnValue({ getExplorerExtenderApi: getExplorerExtenderApiSpy });
            const buildSessionSpy = vi.spyOn(ZSshUtils, "buildSession");
            const showSessionSpy = vi.spyOn(ConfigUtils, "showSessionInTree");
            const getServerPathSpy = vi.spyOn(ConfigUtils, "getServerPath");
            const guiSpy = vi.spyOn(mockedExplorer.Gui, "showMessage");
            const deploySpy = vi.spyOn(deploy, "deployWithProgress");
            const promptForProfileSpy = vi.spyOn(VscePromptApi.prototype, "promptForProfile");
            const promptForDeployDirectorySpy = vi.spyOn(VscePromptApi.prototype, "promptForDeployDirectory");

            getServerPathSpy.mockReturnValueOnce("fakepath");
            showSessionSpy.mockResolvedValue();
            deploySpy.mockResolvedValue(true);
            promptForProfileSpy.mockResolvedValue({ type: "fake", message: "fake", failNotFound: true, profile: { data: "fake" } });
            promptForDeployDirectorySpy.mockResolvedValue("fakedir");

            (Utilities as any).connectCallback(mockedExplorer.ZoweVsCodeExtension.getZoweExplorerApi().getExplorerExtenderApi());

            expect(getLoggerSpy).toHaveBeenCalledTimes(1);
            // expect(traceLoggerSpy).toHaveBeenCalledTimes(1);
            // expect(getProfilesCacheSpy).toHaveBeenCalledTimes(1);
            // expect(promptForProfileSpy).toHaveBeenCalledTimes(1);
            // expect(promptForDeployDirectorySpy).toHaveBeenCalledTimes(1);
            // expect(getServerPathSpy).toHaveBeenCalledTimes(1);
            // expect(buildSessionSpy).toHaveBeenCalledTimes(1);
            // expect(showSessionSpy).toHaveBeenCalledTimes(1);
            // expect(guiSpy).toHaveBeenCalledTimes(1);
            // expect(deploySpy).toHaveBeenCalledTimes(1);
            // expect(infoLoggerSpy).toHaveBeenCalledTimes(1);
        });
    });

    it("should invoke the restart callback", () => {});

    it("should invoke the uninstall callback", () => {});
});
