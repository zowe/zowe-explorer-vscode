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
import { Mock } from "vitest";

import * as vscode from "vscode";
import { USSActions } from "../../../../src/trees/uss/USSActions";
import { IJestIt, ITestContext, processSubscriptions } from "../../../__common__/testUtils";
import { SharedContext } from "../../../../src/trees/shared/SharedContext";
import { USSInit } from "../../../../src/trees/uss/USSInit";
import { SharedActions } from "../../../../src/trees/shared/SharedActions";
import { SharedInit } from "../../../../src/trees/shared/SharedInit";
import { UssFSProvider } from "../../../../src/trees/uss/UssFSProvider";
import { Gui } from "@zowe/zowe-explorer-api";

describe("Test src/uss/extension", () => {
    describe("initUSSProvider", () => {
        let registerCommand;
        let onDidChangeConfiguration;
        let spyCreateUssTree;
        const test: ITestContext = {
            context: { subscriptions: new Array() },
            value: { test: "uss", refreshUSS: vi.fn(), openUSS: vi.fn(), deleteUSSNode: vi.fn(), getUSSDocumentFilePath: vi.fn() },
            _: { _: "_" },
            statusMsg: { dispose: vi.fn() },
        };
        const ussFileProvider: { [key: string]: Mock } = {
            createZoweSession: vi.fn(),
            filterPrompt: vi.fn(),
            rename: vi.fn(),
            onDidChangeConfiguration: vi.fn(),
            getTreeView: vi.fn().mockReturnValue({
                reveal: vi.fn(),
            }),
            refreshElement: vi.fn(),
            openWithEncoding: vi.fn(),
        };
        const commands: IJestIt[] = [
            {
                name: "zowe.uss.addSession",
                mock: [{ spy: vi.spyOn(ussFileProvider, "createZoweSession"), arg: [ussFileProvider] }],
            },
            {
                name: "zowe.uss.refreshAll",
                mock: [{ spy: vi.spyOn(SharedActions, "refreshAll"), arg: [] }],
            },
            {
                name: "zowe.uss.refresh",
                mock: [{ spy: vi.spyOn(SharedActions, "refreshProvider"), arg: [ussFileProvider] }],
            },
            {
                name: "zowe.uss.refreshUSS",
                mock: [
                    { spy: vi.spyOn(SharedContext, "isDocument"), arg: [test.value], ret: true },
                    { spy: vi.spyOn(SharedContext, "isUssDirectory"), arg: [test.value], ret: false },
                    { spy: vi.spyOn(Gui, "setStatusBarMessage"), arg: ["$(sync~spin) Pulling from Mainframe..."], ret: test.statusMsg },
                    { spy: vi.spyOn(test.statusMsg, "dispose"), arg: [] },
                    { spy: vi.spyOn(UssFSProvider.instance, "fetchFileAtUri"), arg: [undefined, { editor: undefined }] },
                ],
            },
            {
                name: "zowe.uss.refreshUSSInTree",
                mock: [{ spy: vi.spyOn(USSActions, "refreshUSSInTree"), arg: [test.value, ussFileProvider] }],
            },
            {
                name: "zowe.uss.refreshDirectory",
                mock: [
                    { spy: vi.spyOn(SharedContext, "isUssDirectory"), arg: [test.value], ret: true },
                    { spy: vi.spyOn(USSActions, "refreshDirectory"), arg: [test.value, ussFileProvider] },
                ],
            },
            {
                name: "zowe.uss.fullPath",
                mock: [{ spy: vi.spyOn(ussFileProvider, "filterPrompt"), arg: [test.value] }],
            },
            {
                name: "zowe.uss.createFile",
                mock: [{ spy: vi.spyOn(USSActions, "createUSSNode"), arg: [test.value, ussFileProvider, "file"] }],
            },
            {
                name: "zowe.uss.createFolder",
                mock: [{ spy: vi.spyOn(USSActions, "createUSSNode"), arg: [test.value, ussFileProvider, "directory"] }],
            },
            {
                name: "zowe.uss.deleteNode",
                mock: [{ spy: vi.spyOn(USSActions, "deleteUSSFilesPrompt"), arg: [test.value, undefined, ussFileProvider] }],
            },
            {
                name: "zowe.uss.renameNode",
                mock: [{ spy: vi.spyOn(ussFileProvider, "rename"), arg: [test.value] }],
            },
            {
                name: "zowe.uss.uploadDialog",
                mock: [{ spy: vi.spyOn(USSActions, "uploadDialog"), arg: [test.value, ussFileProvider, false] }],
            },
            {
                name: "zowe.uss.uploadDialogBinary",
                mock: [{ spy: vi.spyOn(USSActions, "uploadDialog"), arg: [test.value, ussFileProvider, true] }],
            },
            {
                name: "zowe.uss.uploadDialogWithEncoding",
                mock: [{ spy: vi.spyOn(USSActions, "uploadDialogWithEncoding"), arg: [test.value, ussFileProvider] }],
            },
            {
                name: "zowe.uss.downloadFile",
                mock: [{ spy: vi.spyOn(USSActions, "downloadUssFile"), arg: [test.value] }],
            },
            {
                name: "zowe.uss.downloadDirectory",
                mock: [{ spy: vi.spyOn(USSActions, "downloadUssDirectory"), arg: [test.value] }],
            },
            {
                name: "zowe.uss.copyPath",
                mock: [{ spy: vi.spyOn(USSActions, "copyPath"), arg: [test.value] }],
            },
            {
                name: "zowe.uss.editFile",
                mock: [{ spy: vi.spyOn(test.value, "openUSS"), arg: [false, false, ussFileProvider] }],
            },
            {
                name: "zowe.uss.pasteUssFile",
                mock: [{ spy: vi.spyOn(USSActions, "pasteUss"), arg: [ussFileProvider, test.value] }],
            },
            {
                name: "zowe.uss.copyUssFile",
                mock: [{ spy: vi.spyOn(USSActions, "copyUssFiles"), arg: [test.value, undefined, ussFileProvider] }],
            },
            {
                name: "zowe.uss.editAttributes",
                mock: [{ spy: vi.spyOn(USSActions, "editAttributes"), arg: [test.context, ussFileProvider, test.value] }],
            },
            {
                name: "zowe.uss.setUssPath",
                parm: [undefined, undefined],
                mock: [{ spy: vi.spyOn(USSActions, "filterUssTreePrompt"), arg: [ussFileProvider] }],
            },
            {
                name: "zowe.uss.setUssPath",
                parm: ["testSession", "/u/myuser"],
                mock: [{ spy: vi.spyOn(USSActions, "filterUssTree"), arg: [ussFileProvider, "testSession", "/u/myuser"] }],
            },
            {
                name: "onDidChangeConfiguration",
                mock: [{ spy: vi.spyOn(ussFileProvider, "onDidChangeConfiguration"), arg: [test.value] }],
            },
        ];

        beforeAll(async () => {
            registerCommand = (cmd: string, fun: () => void) => {
                return { [cmd]: fun };
            };
            onDidChangeConfiguration = (fun: () => void) => {
                return { onDidChangeConfiguration: fun };
            };
            spyCreateUssTree = vi.spyOn(USSInit, "createUSSTree");
            vi.spyOn(SharedInit, "initSubscribers").mockImplementation(vi.fn());
            Object.defineProperty(vscode.commands, "registerCommand", { value: registerCommand });
            Object.defineProperty(vscode.workspace, "onDidChangeConfiguration", { value: onDidChangeConfiguration });

            spyCreateUssTree.mockResolvedValue(ussFileProvider as any);
            await USSInit.initUSSProvider(test.context);
        });
        beforeEach(() => {
            spyCreateUssTree.mockResolvedValue(ussFileProvider as any);
        });
        afterAll(() => {
            vi.restoreAllMocks();
        });

        processSubscriptions(commands, test);

        it("should not initialize if it is unable to create the USS tree", async () => {
            spyCreateUssTree.mockResolvedValue(null);
            const myProvider = await USSInit.initUSSProvider(test.context);
            expect(myProvider).toBe(null);
        });
    });
});
