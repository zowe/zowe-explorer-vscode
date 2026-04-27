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

import { ProfileConstants } from "@zowe/core-for-zowe-sdk";
import type { IProfile } from "@zowe/imperative";
import { Gui, ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import * as vscode from "vscode";
import { type AbstractConfigManager, MESSAGE_TYPE, type PrivateKeyWarningOptions, ZSshClient } from "@zowe/zowex-for-zowe-sdk";
import { ConfigUtils, VscePromptApi } from "../src/ConfigUtils";
import { getVsceConfig } from "../src/Utilities";

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
}));

vi.mock("@zowe/zowe-explorer-api", () => ({
    Gui: {},
    ZoweExplorerApiType: {
        All: "all",
        Mvs: "mvs",
        Uss: "uss",
        Jobs: "jobs",
        Command: "command",
    },
    ZoweVsCodeExtension: {
        getZoweExplorerApi: vi.fn(),
    },
    imperative: {
        DeferredPromise: class {
            promise: Promise<unknown>;
            resolve!: (v?: unknown) => void;
            reject!: (r?: unknown) => void;
            constructor() {
                this.promise = new Promise((res, rej) => {
                    this.resolve = res;
                    this.reject = rej;
                });
            }
        },
    },
}));
vi.mock("../src/Utilities", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../src/Utilities")>();
    return {
        ...actual,
        getVsceConfig: vi.fn(),
    };
});

describe("SshConfigUtils", () => {
    const defaultPath = "~/.zowe-server";
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("getServerPath", () => {
        beforeEach(async () => {
            delete process.env.ZOWE_OPT_SERVER_PATH;
            vi.spyOn(ZSshClient, "DEFAULT_SERVER_PATH", "get").mockReturnValue(defaultPath);
        });
        afterEach(() => {
            vi.restoreAllMocks();
        });
        it("returns path from VS Code config when host is mapped", () => {
            const profile: IProfile = { host: "testHost" } as IProfile;
            (getVsceConfig as Mock).mockReturnValue({
                get: vi.fn().mockReturnValue({ testHost: "/mapped/path" }),
            });

            const result = ConfigUtils.getServerPath(profile);
            expect(result).toBe("/mapped/path");
        });
        it("falls back to env var if no config", () => {
            const profile: IProfile = { host: "testHost" } as IProfile;
            (getVsceConfig as Mock).mockReturnValue({ get: vi.fn().mockReturnValue({}) });
            process.env.ZOWE_OPT_SERVER_PATH = "/env/path";

            const result = ConfigUtils.getServerPath(profile);
            expect(result).toBe("/env/path");
        });
        it("returns default path if nothing else is set", () => {
            const profile: IProfile = { host: "testHost" } as IProfile;
            (getVsceConfig as Mock).mockReturnValue({ get: vi.fn().mockReturnValue({}) });

            const result = ConfigUtils.getServerPath(profile);
            expect(result).toBe(defaultPath);
        });
        it("returns profile.serverPath if set and no mapping/env", () => {
            const profile: IProfile = { host: "testHost", serverPath: "/profile/path" } as IProfile;
            (getVsceConfig as Mock).mockReturnValue({ get: vi.fn().mockReturnValue({}) });

            const result = ConfigUtils.getServerPath(profile);
            expect(result).toBe("/profile/path");
        });

        it("returns default path if serverPathMap is undefined", () => {
            const profile: IProfile = { host: "testHost" } as IProfile;
            (getVsceConfig as Mock).mockReturnValue({ get: vi.fn().mockReturnValue(undefined) });
            delete process.env.ZOWE_OPT_SERVER_PATH;

            const result = ConfigUtils.getServerPath(profile);
            expect(result).toBe(defaultPath);
        });
    });
    describe("showSessionInTree", () => {
        let mockApi: any;
        let mockProvider: any;
        let mockLocalStorage: any;
        beforeEach(() => {
            mockLocalStorage = {
                getValue: vi.fn().mockReturnValue({ sessions: [] }),
                setValue: vi.fn(),
            };

            mockProvider = {
                mSessionNodes: [],
                addSession: vi.fn(),
                deleteSession: vi.fn(),
                getTreeType: vi.fn().mockReturnValue("datasetProvider"),
            };

            mockApi = {
                datasetProvider: mockProvider,
                ussFileProvider: { ...mockProvider },
                jobsProvider: { ...mockProvider },
                getLocalStorage: vi.fn().mockReturnValue(mockLocalStorage),
            };
            vi.spyOn(ZoweVsCodeExtension, "getZoweExplorerApi").mockReturnValue({
                getExplorerExtenderApi: () => mockApi,
            } as any);
        });
        afterEach(() => {
            vi.restoreAllMocks();
        });
        it("should add a session when visible is true and session is not present", async () => {
            await ConfigUtils.showSessionInTree("testProfile", true);

            expect(mockProvider.addSession).toHaveBeenCalledWith(expect.objectContaining({ sessionName: "testProfile", profileType: "ssh" }));
            expect(mockLocalStorage.setValue).toHaveBeenCalledWith("datasetProvider", expect.objectContaining({ sessions: ["testProfile"] }));
        });
        it("should delete a session when visible is false and session is present", async () => {
            const fakeNode = { getProfileName: () => "testProfile" };
            mockProvider.mSessionNodes = [fakeNode];

            await ConfigUtils.showSessionInTree("testProfile", false);

            expect(mockProvider.deleteSession).toHaveBeenCalledWith(fakeNode);
            expect(mockLocalStorage.setValue).toHaveBeenCalledWith("datasetProvider", expect.objectContaining({ sessions: [] }));
        });
    });
    describe("VscePromptApi", () => {
        let mockQuickPick: any;
        const mockProfilesCache = {} as unknown as AbstractConfigManager["mProfilesCache"];
        const instance = new VscePromptApi(mockProfilesCache);

        beforeEach(() => {
            vi.resetAllMocks();
            mockQuickPick = {
                items: [],
                selectedItems: [],
                show: vi.fn(),
                hide: vi.fn(),
                onDidAccept: vi.fn(),
                onDidHide: vi.fn(),
                onDidChangeValue: vi.fn(),
            };
        });
        describe("showMessage", () => {
            beforeEach(() => {
                vscode.window.showInformationMessage = vi.fn();
                vscode.window.showWarningMessage = vi.fn();
                vscode.window.showErrorMessage = vi.fn();
            });

            afterEach(() => {
                vi.restoreAllMocks();
            });
            it("returns an information message", () => {
                (instance as any).showMessage("test info message", MESSAGE_TYPE.INFORMATION);
                expect(vscode.window.showInformationMessage).toHaveBeenCalledWith("test info message");
            });
            it("returns a warning message", () => {
                (instance as any).showMessage("test warning message", MESSAGE_TYPE.WARNING);
                expect(vscode.window.showWarningMessage).toHaveBeenCalledWith("test warning message");
            });
            it("returns an error message", () => {
                (instance as any).showMessage("test error message", MESSAGE_TYPE.ERROR);
                expect(vscode.window.showErrorMessage).toHaveBeenCalledWith("test error message");
            });
            it("does nothing when message type is unknown", () => {
                (instance as any).showMessage("test message", "UNKNOWN" as any);
                expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
            });
        });
        describe("showInputBox", () => {
            beforeEach(() => {
                vscode.window.showInputBox = vi.fn();
            });
            afterEach(() => {
                vi.restoreAllMocks();
            });
            it("returns an input box", () => {
                (instance as any).showInputBox({ prompt: "test prompt" });
                expect(vscode.window.showInputBox).toHaveBeenCalledWith({
                    ignoreFocusOut: true,
                    prompt: "test prompt",
                });
            });
        });
        describe("showMenu", () => {
            beforeEach(() => {
                vi.spyOn(vscode.window, "createQuickPick").mockReturnValue(mockQuickPick);
            });
            afterEach(() => {
                vi.restoreAllMocks();
            });
            it("resolves with the selected item when user selects an item", async () => {
                const opts = {
                    items: [{ label: "Option 1" }, { label: "Option 2" }],
                    title: "Select an option",
                    placeholder: "Choose...",
                };
                mockQuickPick.selectedItems = [opts.items[0]];
                mockQuickPick.onDidAccept.mockImplementation((cb: () => void) => cb());
                const result = await (instance as any).showMenu(opts);

                expect(vscode.window.createQuickPick).toHaveBeenCalled();
                expect(mockQuickPick.show).toHaveBeenCalled();
                expect(mockQuickPick.hide).toHaveBeenCalled();
                expect(result).toBe("Option 1");
            });
            it("resolves undefined when QuickPick is hidden without selection", async () => {
                const opts = {
                    items: [{ label: "Option 1" }, { label: "Option 2" }],
                    title: "Select an option",
                    placeholder: "Choose...",
                };
                const promise = (instance as any).showMenu(opts);
                const onDidHide = mockQuickPick.onDidHide.mock.calls[0][0];
                onDidHide();

                const result = await promise;
                expect(result).toBeUndefined();
            });
        });
        describe("showCustomMenu", () => {
            beforeEach(() => {
                vi.spyOn(vscode.window, "createQuickPick").mockReturnValue(mockQuickPick);
            });
            afterEach(() => {
                vi.restoreAllMocks();
            });
            it("shows mapped items in quick pick", async () => {
                const opts = {
                    title: "Select SSH",
                    placeholder: "Pick one",
                    items: [{ label: "host1", description: "host" }],
                };
                const promise = (instance as any).showCustomMenu(opts);
                expect(mockQuickPick.items).toEqual([{ label: "host1", description: "host" }]);
                expect(mockQuickPick.title).toBe("Select SSH");
                expect(mockQuickPick.placeholder).toBe("Pick one");
                expect(mockQuickPick.ignoreFocusOut).toBe(true);

                const onDidHide = (mockQuickPick.onDidHide as any).mock.calls[0][0];
                onDidHide();

                const result = await promise;
                expect(result).toBeUndefined();
            });
            it("returns custom item when input starts with >", async () => {
                const opts = { items: [{ label: "host1", description: "host" }] };
                const promise = (instance as any).showCustomMenu(opts);
                const onDidChangeValue = (mockQuickPick.onDidChangeValue as any).mock.calls[0][0];
                onDidChangeValue("customHost");

                expect(mockQuickPick.items[0]).toEqual({
                    label: "> customHost",
                    description: "Custom SSH Host",
                });
                mockQuickPick.selectedItems = [mockQuickPick.items[0]];
                const onDidAccept = (mockQuickPick.onDidAccept as any).mock.calls[0][0];
                onDidAccept();

                const result = await promise;
                expect(result).toEqual({
                    label: "customHost",
                    description: "Custom SSH Host",
                });
            });

            it("returns undefined when quick pick is hidden", async () => {
                const opts = { items: [] } as any;
                const promise = (instance as any).showCustomMenu(opts);
                const onDidHide = (mockQuickPick.onDidHide as any).mock.calls[0][0];
                onDidHide();
                const result = await promise;
                expect(result).toBeUndefined();
            });
            it("resolves with regular item when selected item does not start with >", async () => {
                const opts = {
                    title: "Select an option",
                    placeholder: "Pick one",
                    items: [{ label: "test", description: "desc1" }],
                };

                const promise = (instance as any).showCustomMenu(opts);
                mockQuickPick.selectedItems = [mockQuickPick.items[0]];
                const onDidAccept = (mockQuickPick.onDidAccept as any).mock.calls[0][0];
                onDidAccept();

                const result = await promise;

                expect(result).toEqual({
                    label: "test",
                    description: "desc1",
                });
            });
        });
        describe("getCurrentDir", () => {
            it("returns the fsPath when workspaceRoot is defined", () => {
                const testPath = "/user/project";
                (ZoweVsCodeExtension as any).workspaceRoot = {
                    uri: { fsPath: testPath },
                };

                const result = (instance as any).getCurrentDir();
                expect(result).toBe(testPath);
            });
        });
        describe("getProfileSchema", () => {
            let mockGetProfilesCache: any;
            let mockExplorerApi: any;
            beforeEach(() => {
                mockGetProfilesCache = {
                    getCoreProfileTypes: vi.fn().mockReturnValue([{ type: "core1" }]),
                    getConfigArray: vi.fn().mockReturnValue([{ type: "config1" }]),
                };

                mockExplorerApi = {
                    getExplorerExtenderApi: vi.fn().mockReturnValue({
                        getProfilesCache: vi.fn().mockReturnValue(mockGetProfilesCache),
                    }),
                };

                vi.spyOn(ZoweVsCodeExtension, "getZoweExplorerApi").mockReturnValue(mockExplorerApi as any);
            });
            afterEach(() => {
                vi.restoreAllMocks();
            });

            it("returns combined profile schemas including core, config, and base profile", () => {
                const result = (instance as any).getProfileSchemas();

                expect(ZoweVsCodeExtension.getZoweExplorerApi).toHaveBeenCalled();
                expect(mockExplorerApi.getExplorerExtenderApi).toHaveBeenCalled();
                expect(mockGetProfilesCache.getCoreProfileTypes).toHaveBeenCalled();
                expect(mockGetProfilesCache.getConfigArray).toHaveBeenCalled();

                expect(result).toEqual([{ type: "core1" }, { type: "config1" }, ProfileConstants.BaseProfile]);
            });

            it("returns empty arrays if profCache methods return empty arrays", () => {
                mockGetProfilesCache.getCoreProfileTypes.mockReturnValue([]);
                mockGetProfilesCache.getConfigArray.mockReturnValue([]);

                const result = (instance as any).getProfileSchemas();

                expect(result).toEqual([ProfileConstants.BaseProfile]);
            });
        });
        describe("showPrivateKeyWarning", () => {
            beforeEach(() => {
                vi.spyOn(vscode.window, "createQuickPick").mockReturnValue(mockQuickPick);
            });
            afterEach(() => {
                vi.restoreAllMocks();
            });
            it("resolves true when 'continue' is selected", async () => {
                const opts: PrivateKeyWarningOptions = {
                    profileName: "test",
                    privateKeyPath: "",
                };
                const promise = (instance as any).showPrivateKeyWarning(opts);

                const accept = mockQuickPick.onDidAccept.mock.calls[0][0];
                mockQuickPick.selectedItems = [{ action: "continue" }];
                accept();

                const result = await promise;
                expect(result).toBe(true);
            });
            it("resolves true and calls onDelete for delete action", async () => {
                const opts: PrivateKeyWarningOptions = {
                    profileName: "test",
                    privateKeyPath: "",
                    onDelete: vi.fn(),
                };
                const promise = (instance as any).showPrivateKeyWarning(opts);

                const accept = mockQuickPick.onDidAccept.mock.calls[0][0];
                mockQuickPick.selectedItems = [{ action: "delete" }];
                await accept();

                const result = await promise;
                expect(result).toBe(true);
                expect(opts.onDelete).toHaveBeenCalled();
            });

            it("resolves false and calls onUndo for undo action", async () => {
                const opts: PrivateKeyWarningOptions = {
                    profileName: "test",
                    privateKeyPath: "",
                    onUndo: vi.fn(),
                };
                const promise = (instance as any).showPrivateKeyWarning(opts);

                const accept = mockQuickPick.onDidAccept.mock.calls[0][0];
                mockQuickPick.selectedItems = [{ action: "undo" }];
                await accept();

                const result = await promise;
                expect(result).toBe(false);
                expect(opts.onUndo).toHaveBeenCalled();
            });

            it("returns false when no selection", async () => {
                const opts: PrivateKeyWarningOptions = {
                    profileName: "test",
                    privateKeyPath: "",
                };
                const promise = (instance as any).showPrivateKeyWarning(opts);

                const accept = mockQuickPick.onDidAccept.mock.calls[0][0];
                mockQuickPick.selectedItems = [];
                await accept();

                const result = await promise;
                expect(result).toBe(false);
            });
        });
        describe("storeServerPath", () => {
            let mockGet: any;
            let mockUpdate: any;
            beforeEach(() => {
                mockGet = vi.fn();
                mockUpdate = vi.fn();
                (getVsceConfig as Mock).mockReturnValue({ get: mockGet, update: mockUpdate });
            });
            afterEach(() => {
                vi.resetAllMocks();
            });
            it("updates an existing serverPathMap with new host and path", () => {
                mockGet.mockReturnValue({ oldHost: "/old/path" });
                (instance as any).storeServerPath("newHost", "/new/path");
                expect(mockUpdate).toHaveBeenCalledWith(
                    "serverInstallPath",
                    {
                        oldHost: "/old/path",
                        newHost: "/new/path",
                    },
                    vscode.ConfigurationTarget.Global
                );
            });
            it("adds a new host and path entry when serverPathMap is empty", () => {
                mockGet.mockReturnValue(undefined);
                (instance as any).storeServerPath("newHost", "/new/path");
                expect(mockUpdate).toHaveBeenCalledWith("serverInstallPath", { newHost: "/new/path" }, vscode.ConfigurationTarget.Global);
            });
        });

        describe("getClientSetting", () => {
            let mockGet: any;
            beforeEach(() => {
                mockGet = vi.fn();
                (getVsceConfig as Mock).mockReturnValue({ get: mockGet });
            });
            afterEach(() => {
                vi.resetAllMocks();
            });
            it("returns the value from vscode config for the given setting", () => {
                mockGet.mockReturnValue("testValue");
                const result = (instance as any).getClientSetting("handshakeTimeout");
                expect(mockGet).toHaveBeenCalledWith("defaultHandshakeTimeout");
                expect(result).toBe("testValue");
            });
        });

        describe("showStatusBar", () => {
            let mockSetStatusBarMessage: any;
            beforeEach(() => {
                mockSetStatusBarMessage = vi.fn();
                (Gui.setStatusBarMessage as Mock) = mockSetStatusBarMessage;
            });
            afterEach(() => {
                vi.resetAllMocks();
            });
            it("displays SSH connection loading message in status bar", () => {
                const mockDisposable = { dispose: vi.fn() };
                mockSetStatusBarMessage.mockReturnValue(mockDisposable);
                const result = (instance as any).showStatusBar();
                expect(mockSetStatusBarMessage).toHaveBeenCalledWith("$(loading~spin) Attempting SSH connection");
                expect(result).toBe(mockDisposable);
            });
        });
    });
});
