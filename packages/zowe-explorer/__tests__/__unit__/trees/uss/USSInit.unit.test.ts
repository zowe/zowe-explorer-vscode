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

import * as vscode from "vscode";
import { USSActions } from "../../../../src/trees/uss/USSActions";
import { Profiles } from "../../../../src/configuration/Profiles";
import { IJestIt, ITestContext, processSubscriptions } from "../../../__common__/testUtils";
import { SharedContext } from "../../../../src/trees/shared/SharedContext";
import { USSInit } from "../../../../src/trees/uss/USSInit";
import { SharedActions } from "../../../../src/trees/shared/SharedActions";
import { SharedInit } from "../../../../src/trees/shared/SharedInit";
import { USSTree } from "../../../../src/trees/uss/USSTree";

describe("Test src/uss/extension", () => {
    describe("initUSSProvider", () => {
        let registerCommand;
        let onDidChangeConfiguration;
        let spyCreateUssTree;
        const test: ITestContext = {
            context: { subscriptions: new Array() },
            value: { test: "uss", refreshUSS: jest.fn(), openUSS: jest.fn(), deleteUSSNode: jest.fn(), getUSSDocumentFilePath: jest.fn() },
            _: { _: "_" },
        };
        const ussFileProvider: { [key: string]: jest.Mock } = {
            addFavorite: jest.fn(),
            removeFavorite: jest.fn(),
            createZoweSession: jest.fn(),
            filterPrompt: jest.fn(),
            editSession: jest.fn(),
            deleteSession: jest.fn(),
            rename: jest.fn(),
            saveSearch: jest.fn(),
            removeFavProfile: jest.fn(),
            ssoLogin: jest.fn(),
            ssoLogout: jest.fn(),
            onDidChangeConfiguration: jest.fn(),
            onDidCloseTextDocument: jest.fn(),
            getTreeView: jest.fn().mockReturnValue({
                reveal: jest.fn(),
            }),
            refreshElement: jest.fn(),
            openWithEncoding: jest.fn(),
        };
        const commands: IJestIt[] = [
            {
                name: "zowe.uss.addFavorite",
                mock: [{ spy: jest.spyOn(ussFileProvider, "addFavorite"), arg: [test.value] }],
            },
            {
                name: "zowe.uss.removeFavorite",
                mock: [{ spy: jest.spyOn(ussFileProvider, "removeFavorite"), arg: [test.value] }],
            },
            {
                name: "zowe.uss.addSession",
                mock: [{ spy: jest.spyOn(ussFileProvider, "createZoweSession"), arg: [ussFileProvider] }],
            },
            {
                name: "zowe.uss.refreshAll",
                mock: [{ spy: jest.spyOn(SharedActions, "refreshAll"), arg: [ussFileProvider] }],
            },
            {
                name: "zowe.uss.refreshUSS",
                mock: [
                    { spy: jest.spyOn(SharedContext, "isDocument"), arg: [test.value], ret: true },
                    { spy: jest.spyOn(SharedContext, "isUssDirectory"), arg: [test.value], ret: false },
                ],
            },
            {
                name: "zowe.uss.refreshUSSInTree",
                mock: [{ spy: jest.spyOn(USSActions, "refreshUSSInTree"), arg: [test.value, ussFileProvider] }],
            },
            {
                name: "zowe.uss.refreshDirectory",
                mock: [
                    { spy: jest.spyOn(SharedContext, "isUssDirectory"), arg: [test.value], ret: true },
                    { spy: jest.spyOn(USSActions, "refreshDirectory"), arg: [test.value, ussFileProvider] },
                ],
            },
            {
                name: "zowe.uss.fullPath",
                mock: [{ spy: jest.spyOn(ussFileProvider, "filterPrompt"), arg: [test.value] }],
            },
            {
                name: "zowe.uss.editSession",
                mock: [{ spy: jest.spyOn(ussFileProvider, "editSession"), arg: [test.value, ussFileProvider] }],
            },
            {
                name: "zowe.uss.removeSession",
                mock: [
                    { spy: jest.spyOn(SharedContext, "isUssSession"), arg: [test.value], ret: true },
                    { spy: jest.spyOn(ussFileProvider, "deleteSession"), arg: [test.value, undefined] },
                ],
            },
            {
                name: "zowe.uss.createFile",
                mock: [{ spy: jest.spyOn(USSActions, "createUSSNode"), arg: [test.value, ussFileProvider, "file"] }],
            },
            {
                name: "zowe.uss.createFolder",
                mock: [{ spy: jest.spyOn(USSActions, "createUSSNode"), arg: [test.value, ussFileProvider, "directory"] }],
            },
            {
                name: "zowe.uss.deleteNode",
                mock: [
                    { spy: jest.spyOn(SharedContext, "isDocument"), arg: [test.value], ret: true },
                    { spy: jest.spyOn(SharedContext, "isUssDirectory"), arg: [test.value], ret: true },
                    { spy: jest.spyOn(USSActions, "deleteUSSFilesPrompt"), arg: [[test.value]], ret: false },
                    { spy: jest.spyOn(test.value, "deleteUSSNode"), arg: [ussFileProvider, ""], ret: true },
                ],
            },
            {
                name: "zowe.uss.renameNode",
                mock: [{ spy: jest.spyOn(ussFileProvider, "rename"), arg: [test.value] }],
            },
            {
                name: "zowe.uss.uploadDialog",
                mock: [{ spy: jest.spyOn(USSActions, "uploadDialog"), arg: [test.value, ussFileProvider] }],
            },
            {
                name: "zowe.uss.copyPath",
                mock: [{ spy: jest.spyOn(USSActions, "copyPath"), arg: [test.value] }],
            },
            {
                name: "zowe.uss.editFile",
                mock: [{ spy: jest.spyOn(test.value, "openUSS"), arg: [false, false, ussFileProvider] }],
            },
            {
                name: "zowe.uss.saveSearch",
                mock: [{ spy: jest.spyOn(ussFileProvider, "saveSearch"), arg: [test.value] }],
            },
            {
                name: "zowe.uss.removeSavedSearch",
                mock: [{ spy: jest.spyOn(ussFileProvider, "removeFavorite"), arg: [test.value] }],
            },
            {
                name: "zowe.uss.removeFavProfile",
                parm: [{ label: test.value }],
                mock: [{ spy: jest.spyOn(ussFileProvider, "removeFavProfile"), arg: [test.value, true] }],
            },
            {
                name: "zowe.uss.disableValidation",
                mock: [
                    {
                        spy: jest.spyOn(Profiles, "getInstance"),
                        arg: [],
                        ret: { disableValidation: jest.fn() },
                    },
                ],
            },
            {
                name: "zowe.uss.enableValidation",
                mock: [
                    {
                        spy: jest.spyOn(Profiles, "getInstance"),
                        arg: [],
                        ret: { enableValidation: jest.fn(), disableValidation: jest.fn() },
                    },
                ],
            },
            {
                name: "zowe.uss.ssoLogin",
                mock: [{ spy: jest.spyOn(ussFileProvider, "ssoLogin"), arg: [test.value] }],
            },
            {
                name: "zowe.uss.ssoLogout",
                mock: [{ spy: jest.spyOn(ussFileProvider, "ssoLogout"), arg: [test.value] }],
            },
            {
                name: "zowe.uss.pasteUssFile",
                mock: [{ spy: jest.spyOn(USSActions, "pasteUss"), arg: [ussFileProvider, test.value] }],
            },
            {
                name: "zowe.uss.copyUssFile",
                mock: [{ spy: jest.spyOn(USSActions, "copyUssFiles"), arg: [test.value, undefined, ussFileProvider] }],
            },
            {
                name: "zowe.uss.editAttributes",
                mock: [{ spy: jest.spyOn(USSActions, "editAttributes"), arg: [test.context, ussFileProvider, test.value] }],
            },
            {
                name: "zowe.uss.openWithEncoding",
                mock: [{ spy: jest.spyOn(ussFileProvider, "openWithEncoding"), arg: [test.value, undefined] }],
            },
            {
                name: "onDidChangeConfiguration",
                mock: [{ spy: jest.spyOn(ussFileProvider, "onDidChangeConfiguration"), arg: [test.value] }],
            },
        ];

        beforeAll(async () => {
            registerCommand = (cmd: string, fun: () => void) => {
                return { [cmd]: fun };
            };
            onDidChangeConfiguration = (fun: () => void) => {
                return { onDidChangeConfiguration: fun };
            };
            spyCreateUssTree = jest.spyOn(USSInit, "createUSSTree");
            jest.spyOn(SharedInit, "initSubscribers").mockImplementation(jest.fn());
            Object.defineProperty(vscode.commands, "registerCommand", { value: registerCommand });
            Object.defineProperty(vscode.workspace, "onDidChangeConfiguration", { value: onDidChangeConfiguration });

            spyCreateUssTree.mockResolvedValue(ussFileProvider as any);
            jest.spyOn(vscode.workspace, "onDidCloseTextDocument").mockImplementation(ussFileProvider.onDidCloseTextDocument);
            await USSInit.initUSSProvider(test.context);
        });
        beforeEach(() => {
            spyCreateUssTree.mockResolvedValue(ussFileProvider as any);
        });
        afterAll(() => {
            jest.restoreAllMocks();
        });

        processSubscriptions(commands, test);

        it("should not initialize if it is unable to create the USS tree", async () => {
            spyCreateUssTree.mockResolvedValue(null);
            const myProvider = await USSInit.initUSSProvider(test.context);
            expect(myProvider).toBe(null);
        });

        it("should register onDidCloseTextDocument event listener from USSTree", () => {
            expect(ussFileProvider.onDidCloseTextDocument).toHaveBeenCalledWith(USSTree.onDidCloseTextDocument);
        });
    });
});
