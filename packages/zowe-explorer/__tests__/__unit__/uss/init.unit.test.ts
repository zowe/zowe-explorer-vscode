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
import * as ussTree from "../../../src/uss/USSTree";
import * as refreshActions from "../../../src/shared/refresh";
import * as contextuals from "../../../src/shared/context";
import * as ussActions from "../../../src/uss/actions";
import * as sharedExtension from "../../../src/shared/init";
import { initUSSProvider } from "../../../src/uss/init";
import { Profiles } from "../../../src/Profiles";
import { IJestIt, ITestContext, processSubscriptions, spyOnSubscriptions } from "../../__common__/testUtils";

describe("Test src/dataset/extension", () => {
    describe("initDatasetProvider", () => {
        let registerCommand;
        let onDidChangeConfiguration;
        let spyCreateUssTree;
        const test: ITestContext = {
            context: { subscriptions: [] },
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
            getTreeView: jest.fn().mockReturnValue({
                reveal: jest.fn(),
            }),
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
                mock: [{ spy: jest.spyOn(refreshActions, "refreshAll"), arg: [ussFileProvider] }],
            },
            {
                name: "zowe.uss.refreshUSS",
                mock: [
                    { spy: jest.spyOn(contextuals, "isDocument"), arg: [test.value], ret: true },
                    { spy: jest.spyOn(test.value, "refreshUSS"), arg: [] },
                ],
            },
            {
                name: "zowe.uss.refreshUSSInTree",
                mock: [{ spy: jest.spyOn(ussActions, "refreshUSSInTree"), arg: [test.value, ussFileProvider] }],
            },
            {
                name: "zowe.uss.refreshDirectory",
                mock: [
                    { spy: jest.spyOn(contextuals, "isUssDirectory"), arg: [test.value], ret: true },
                    { spy: jest.spyOn(ussActions, "refreshDirectory"), arg: [test.value, ussFileProvider] },
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
                name: "zowe.uss.ZoweUSSNode.open",
                mock: [{ spy: jest.spyOn(test.value, "openUSS"), arg: [false, true, ussFileProvider] }],
            },
            {
                name: "zowe.uss.removeSession",
                mock: [
                    { spy: jest.spyOn(contextuals, "isUssSession"), arg: [test.value], ret: true },
                    { spy: jest.spyOn(ussFileProvider, "deleteSession"), arg: [test.value] },
                ],
            },
            {
                name: "zowe.uss.createFile",
                mock: [{ spy: jest.spyOn(ussActions, "createUSSNode"), arg: [test.value, ussFileProvider, "file"] }],
            },
            {
                name: "zowe.uss.createFolder",
                mock: [{ spy: jest.spyOn(ussActions, "createUSSNode"), arg: [test.value, ussFileProvider, "directory"] }],
            },
            {
                name: "zowe.uss.deleteNode",
                mock: [
                    { spy: jest.spyOn(contextuals, "isDocument"), arg: [test.value], ret: false },
                    { spy: jest.spyOn(contextuals, "isUssDirectory"), arg: [test.value], ret: true },
                    { spy: jest.spyOn(ussActions, "deleteUSSFilesPrompt"), arg: [[test.value]], ret: true },
                    { spy: jest.spyOn(test.value, "getUSSDocumentFilePath"), arg: [], ret: "dummy" },
                    { spy: jest.spyOn(test.value, "deleteUSSNode"), arg: [ussFileProvider, "dummy", true] },
                ],
            },
            {
                name: "zowe.uss.binary",
                mock: [
                    { spy: jest.spyOn(contextuals, "isText"), arg: [test.value], ret: true },
                    { spy: jest.spyOn(ussActions, "changeFileType"), arg: [test.value, true, ussFileProvider] },
                ],
            },
            {
                name: "zowe.uss.text",
                mock: [
                    { spy: jest.spyOn(contextuals, "isBinary"), arg: [test.value], ret: true },
                    { spy: jest.spyOn(ussActions, "changeFileType"), arg: [test.value, false, ussFileProvider] },
                ],
            },
            {
                name: "zowe.uss.renameNode",
                mock: [{ spy: jest.spyOn(ussFileProvider, "rename"), arg: [test.value] }],
            },
            {
                name: "zowe.uss.uploadDialog",
                mock: [{ spy: jest.spyOn(ussActions, "uploadDialog"), arg: [test.value, ussFileProvider] }],
            },
            {
                name: "zowe.uss.copyPath",
                mock: [{ spy: jest.spyOn(ussActions, "copyPath"), arg: [test.value] }],
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
                        ret: { enableValidation: jest.fn() },
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
                mock: [{ spy: jest.spyOn(ussActions, "pasteUss"), arg: [ussFileProvider, test.value] }],
            },
            {
                name: "zowe.uss.copyUssFile",
                mock: [{ spy: jest.spyOn(ussActions, "copyUssFiles"), arg: [test.value, undefined, ussFileProvider] }],
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
            spyCreateUssTree = jest.spyOn(ussTree, "createUSSTree");
            jest.spyOn(sharedExtension, "initSubscribers").mockImplementation(jest.fn());
            Object.defineProperty(vscode.commands, "registerCommand", { value: registerCommand });
            Object.defineProperty(vscode.workspace, "onDidChangeConfiguration", { value: onDidChangeConfiguration });

            spyCreateUssTree.mockResolvedValue(ussFileProvider as any);
            spyOnSubscriptions(commands);
            await initUSSProvider(test.context);
        });
        beforeEach(() => {
            spyCreateUssTree.mockResolvedValue(ussFileProvider as any);
        });
        afterAll(() => {
            jest.restoreAllMocks();
        });

        processSubscriptions(commands, test);

        it("should not initialize if it is unable to create the dataset tree", async () => {
            spyCreateUssTree.mockResolvedValue(null);
            const myProvider = await initUSSProvider({} as any);
            expect(myProvider).toBe(null);
        });
    });
});
