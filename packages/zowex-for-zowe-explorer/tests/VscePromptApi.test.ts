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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";
import { VscePromptApi } from "../src/VscePromptApi";
import { SshClientCache } from "../src/SshClientCache";
import { MESSAGE_TYPE } from "@zowe/zowex-for-zowe-sdk";
import { ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";

describe("VscePromptApi", () => {
    let api: VscePromptApi;

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function makeApi(): VscePromptApi {
        // AbstractConfigManager requires a ProfileInfo in its constructor.
        return new VscePromptApi({} as any);
    }

    describe("showMessage", () => {
        beforeEach(() => {
            api = makeApi();
        });

        it("should show an information message", () => {
            const spy = vi.spyOn(vscode.window, "showInformationMessage").mockReturnValue(undefined as any);
            (api as any).showMessage("hello", MESSAGE_TYPE.INFORMATION);
            expect(spy).toHaveBeenCalledWith("hello");
        });

        it("should show a warning message", () => {
            const spy = vi.spyOn(vscode.window, "showWarningMessage").mockReturnValue(undefined);
            (api as any).showMessage("careful", MESSAGE_TYPE.WARNING);
            expect(spy).toHaveBeenCalledWith("careful");
        });

        it("should show an error message", () => {
            const spy = vi.spyOn(vscode.window, "showErrorMessage").mockReturnValue(undefined);
            (api as any).showMessage("oops", MESSAGE_TYPE.ERROR);
            expect(spy).toHaveBeenCalledWith("oops");
        });

        it("should do nothing for an unknown message type", () => {
            const infoSpy = vi.spyOn(vscode.window, "showInformationMessage");
            const warnSpy = vi.spyOn(vscode.window, "showWarningMessage");
            const errSpy = vi.spyOn(vscode.window, "showErrorMessage");
            (api as any).showMessage("ignored", 999);
            expect(infoSpy).not.toHaveBeenCalled();
            expect(warnSpy).not.toHaveBeenCalled();
            expect(errSpy).not.toHaveBeenCalled();
        });
    });

    describe("showInputBox", () => {
        it("should show an input box with ignoreFocusOut forced on", async () => {
            api = makeApi();
            const spy = vi.spyOn(vscode.window, "showInputBox").mockResolvedValue("typed");
            const result = await (api as any).showInputBox({ prompt: "enter" });
            expect(spy).toHaveBeenCalledWith(expect.objectContaining({ ignoreFocusOut: true, prompt: "enter" }));
            expect(result).toEqual("typed");
        });
    });

    describe("withProgress", () => {
        it("should wrap a task with Gui.withProgress and report increments", async () => {
            api = makeApi();
            const wpSpy = vi.spyOn(vscode.window, "withProgress");
            const task = vi.fn(async (report: (v: { increment: number }) => void) => {
                report({ increment: 42 });
                return "done";
            });

            const result = await (api as any).withProgress("working", task);

            expect(wpSpy).toHaveBeenCalledTimes(1);
            expect(wpSpy.mock.calls[0][0]).toEqual(expect.objectContaining({ title: "working", cancellable: false }));
            expect(result).toEqual("done");
            expect(task).toHaveBeenCalledTimes(1);
        });
    });

    describe("showMenu", () => {
        it("should resolve the selected item label on accept", async () => {
            api = makeApi();
            const qp: any = {
                items: [],
                title: "",
                placeholder: "",
                selectedItems: [{ label: "Picked" }],
                onDidAccept: vi.fn((cb) => {
                    qp._accept = cb;
                    return { dispose: vi.fn() };
                }),
                onDidHide: vi.fn((cb) => {
                    qp._hide = cb;
                    return { dispose: vi.fn() };
                }),
                show: vi.fn(() => qp._accept()),
                hide: vi.fn(),
            };
            vi.spyOn(vscode.window, "createQuickPick").mockReturnValue(qp);

            const result = await (api as any).showMenu({ items: [{ label: "A" }], title: "T", placeholder: "P" });

            expect(qp.title).toEqual("T");
            expect(qp.placeholder).toEqual("P");
            expect(qp.ignoreFocusOut).toEqual(true);
            expect(result).toEqual("Picked");
            expect(qp.hide).toHaveBeenCalled();
        });

        it("should resolve undefined when the user cancels (hide)", async () => {
            api = makeApi();
            const qp: any = {
                items: [],
                selectedItems: [],
                onDidAccept: vi.fn(() => ({ dispose: vi.fn() })),
                onDidHide: vi.fn((cb) => {
                    qp._hide = cb;
                    return { dispose: vi.fn() };
                }),
                show: vi.fn(() => qp._hide()),
                hide: vi.fn(),
            };
            vi.spyOn(vscode.window, "createQuickPick").mockReturnValue(qp);

            const result = await (api as any).showMenu({ items: [], title: "T", placeholder: "P" });
            expect(result).toBeUndefined();
        });
    });

    describe("showCustomMenu", () => {
        it("should resolve a normal selection", async () => {
            api = makeApi();
            const qp: any = {
                items: [],
                title: "",
                placeholder: "",
                selectedItems: [{ label: "HostA", description: "desc" }],
                onDidChangeValue: vi.fn(() => ({ dispose: vi.fn() })),
                onDidAccept: vi.fn((cb) => {
                    qp._accept = cb;
                    return { dispose: vi.fn() };
                }),
                onDidHide: vi.fn(() => ({ dispose: vi.fn() })),
                show: vi.fn(() => qp._accept()),
                hide: vi.fn(),
            };
            vi.spyOn(vscode.window, "createQuickPick").mockReturnValue(qp);

            const result = await (api as any).showCustomMenu({ items: [{ label: "HostA", description: "desc" }], title: "T", placeholder: "P" });
            expect(result).toEqual({ label: "HostA", description: "desc" });
        });

        it("should resolve a custom host when the selection starts with '>'", async () => {
            api = makeApi();
            const qp: any = {
                items: [],
                title: "",
                placeholder: "",
                selectedItems: [{ label: "> myhost", description: "Custom SSH Host" }],
                onDidChangeValue: vi.fn((cb) => {
                    qp._change = cb;
                    return { dispose: vi.fn() };
                }),
                onDidAccept: vi.fn((cb) => {
                    qp._accept = cb;
                    return { dispose: vi.fn() };
                }),
                onDidHide: vi.fn(() => ({ dispose: vi.fn() })),
                show: vi.fn(() => qp._accept()),
                hide: vi.fn(),
            };
            vi.spyOn(vscode.window, "createQuickPick").mockReturnValue(qp);

            const result = await (api as any).showCustomMenu({ items: [{ label: "HostA" }], title: "T", placeholder: "P" });
            expect(result).toEqual({ label: "myhost", description: "Custom SSH Host" });
        });

        it("should resolve undefined when the user cancels", async () => {
            api = makeApi();
            const qp: any = {
                items: [],
                selectedItems: [],
                onDidChangeValue: vi.fn(() => ({ dispose: vi.fn() })),
                onDidAccept: vi.fn(() => ({ dispose: vi.fn() })),
                onDidHide: vi.fn((cb) => {
                    qp._hide = cb;
                    return { dispose: vi.fn() };
                }),
                show: vi.fn(() => qp._hide()),
                hide: vi.fn(),
            };
            vi.spyOn(vscode.window, "createQuickPick").mockReturnValue(qp);

            const result = await (api as any).showCustomMenu({ items: [], title: "T", placeholder: "P" });
            expect(result).toBeUndefined();
        });

        it("should react to typed input by adding a custom-host entry, and restore the list when cleared", async () => {
            api = makeApi();
            const qp: any = {
                items: [],
                title: "",
                placeholder: "",
                selectedItems: [{ label: "HostA" }],
                onDidChangeValue: vi.fn((cb) => {
                    qp._change = cb;
                    return { dispose: vi.fn() };
                }),
                onDidAccept: vi.fn((cb) => {
                    qp._accept = cb;
                    return { dispose: vi.fn() };
                }),
                onDidHide: vi.fn(() => ({ dispose: vi.fn() })),
                show: vi.fn(() => {
                    // user types a value, then clears it, then accepts
                    qp._change("myhost");
                    expect(qp.items[0]).toEqual(expect.objectContaining({ label: "> myhost" }));
                    qp._change("");
                    expect(qp.items[0]).not.toEqual(expect.objectContaining({ label: expect.stringContaining(">") }));
                    qp._accept();
                }),
                hide: vi.fn(),
            };
            vi.spyOn(vscode.window, "createQuickPick").mockReturnValue(qp);

            await (api as any).showCustomMenu({ items: [{ label: "HostA" }], title: "T", placeholder: "P" });
        });
    });

    describe("getCurrentDir", () => {
        it("should return the workspace root fs path", () => {
            api = makeApi();
            vi.spyOn(ZoweVsCodeExtension, "workspaceRoot", "get").mockReturnValue({ uri: { fsPath: "/workspace" } } as any);
            expect((api as any).getCurrentDir()).toEqual("/workspace");
        });

        it("should return undefined when there is no workspace folder", () => {
            api = makeApi();
            vi.spyOn(ZoweVsCodeExtension, "workspaceRoot", "get").mockReturnValue(undefined);
            expect((api as any).getCurrentDir()).toBeUndefined();
        });
    });

    describe("getProfileSchemas", () => {
        it("should combine core profile types, config array, and the Base profile", () => {
            api = makeApi();
            const coreTypes = [{ type: "zosmf" }];
            const configTypes = [{ type: "ssh" }];
            const base = { type: "base" };
            vi.spyOn(SshClientCache, "inst", "get").mockReturnValue({
                profilesCache: {
                    getCoreProfileTypes: vi.fn().mockReturnValue(coreTypes),
                    getConfigArray: vi.fn().mockReturnValue(configTypes),
                },
            } as any);

            const result = (api as any).getProfileSchemas();
            expect(result.length).toEqual(3);
            expect(result[0]).toEqual(coreTypes[0]);
            expect(result[1]).toEqual(configTypes[0]);
        });
    });

    describe("showPrivateKeyWarning", () => {
        function setupQuickPick(action: string | undefined): void {
            const qp: any = {
                items: [],
                selectedItems: action ? [{ action }] : [],
                onDidAccept: vi.fn((cb) => {
                    qp._accept = cb;
                    return { dispose: vi.fn() };
                }),
                onDidHide: vi.fn(() => ({ dispose: vi.fn() })),
                show: vi.fn(() => qp._accept()),
                hide: vi.fn(),
            };
            vi.spyOn(vscode.window, "createQuickPick").mockReturnValue(qp);
        }

        it("should return true and call onDelete when 'delete' is selected", async () => {
            api = makeApi();
            setupQuickPick("delete");
            const onDelete = vi.fn();
            const result = await (api as any).showPrivateKeyWarning({ profileName: "prof", onDelete });
            expect(onDelete).toHaveBeenCalledTimes(1);
            expect(result).toEqual(true);
        });

        it("should return true (without onDelete) when 'continue' is selected", async () => {
            api = makeApi();
            setupQuickPick("continue");
            const result = await (api as any).showPrivateKeyWarning({ profileName: "prof" });
            expect(result).toEqual(true);
        });

        it("should return false and call onUndo for any other selection", async () => {
            api = makeApi();
            setupQuickPick("undo");
            const onUndo = vi.fn();
            const result = await (api as any).showPrivateKeyWarning({ profileName: "prof", onUndo });
            expect(onUndo).toHaveBeenCalledTimes(1);
            expect(result).toEqual(false);
        });

        it("should return false when the user cancels (no selection)", async () => {
            api = makeApi();
            setupQuickPick(undefined);
            const result = await (api as any).showPrivateKeyWarning({ profileName: "prof" });
            expect(result).toEqual(false);
        });
    });

    describe("storeServerPath", () => {
        it("should update the zowex.serverInstallPath setting for the given host", () => {
            api = makeApi();
            const updateSpy = vi.fn();
            const existing: Record<string, string> = { otherHost: "/old" };
            vi.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
                get: vi.fn(() => existing),
                update: updateSpy,
            } as any);

            (api as any).storeServerPath("myHost", "/new/path");

            expect(updateSpy).toHaveBeenCalledWith(
                "zowex.serverInstallPath",
                { otherHost: "/old", myHost: "/new/path" },
                vscode.ConfigurationTarget.Global
            );
        });

        it("should initialize an empty map when the setting is absent", () => {
            api = makeApi();
            const updateSpy = vi.fn();
            vi.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
                get: vi.fn(() => undefined),
                update: updateSpy,
            } as any);

            (api as any).storeServerPath("myHost", "/new/path");

            expect(updateSpy).toHaveBeenCalledWith("zowex.serverInstallPath", { myHost: "/new/path" }, vscode.ConfigurationTarget.Global);
        });

        it("should initialize an empty map when the setting returns a falsy non-nullish value", () => {
            api = makeApi();
            const updateSpy = vi.fn();
            vi.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
                get: vi.fn(() => 0),
                update: updateSpy,
            } as any);

            (api as any).storeServerPath("myHost", "/new/path");

            expect(updateSpy).toHaveBeenCalledWith("zowex.serverInstallPath", { myHost: "/new/path" }, vscode.ConfigurationTarget.Global);
        });
    });

    describe("getClientSetting", () => {
        it("should read a known client setting", () => {
            api = makeApi();
            vi.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
                get: vi.fn(() => 30),
                update: vi.fn(),
            } as any);

            const result = (api as any).getClientSetting("handshakeTimeout");
            expect(result).toEqual(30);
        });

        it("should return undefined for an unmapped setting", () => {
            api = makeApi();
            const result = (api as any).getClientSetting("host");
            expect(result).toBeUndefined();
        });
    });

    describe("showStatusBar", () => {
        it("should set a status bar message", () => {
            api = makeApi();
            const spy = vi.spyOn(vscode.window, "setStatusBarMessage");
            (api as any).showStatusBar();
            expect(spy.mock.calls[0][0]).toEqual("$(loading~spin) Attempting SSH connection");
        });
    });
});
