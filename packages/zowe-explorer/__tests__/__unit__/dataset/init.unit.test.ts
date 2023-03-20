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
import * as dsTree from "../../../src/dataset/DatasetTree";
import * as refreshActions from "../../../src/shared/refresh";
import * as contextuals from "../../../src/shared/context";
import * as dsActions from "../../../src/dataset/actions";
import * as sharedExtension from "../../../src/shared/init";
import { initDatasetProvider } from "../../../src/dataset/init";
import { Profiles } from "../../../src/Profiles";
import { IJestIt, ITestContext, processSubscriptions, spyOnSubscriptions } from "../../__common__/testUtils";

describe("Test src/dataset/extension", () => {
    describe("initDatasetProvider", () => {
        let registerCommand;
        let onDidChangeConfiguration;
        let spyCreateDatasetTree;
        const test: ITestContext = {
            context: { subscriptions: [] },
            value: { label: "test", getParent: () => "test" },
            _: { _: "_" },
        };
        const dsProvider: { [key: string]: jest.Mock } = {
            createZoweSchema: jest.fn(),
            createZoweSession: jest.fn(),
            addFavorite: jest.fn(),
            filterPrompt: jest.fn(),
            editSession: jest.fn(),
            deleteSession: jest.fn(),
            removeFavorite: jest.fn(),
            removeFavProfile: jest.fn(),
            rename: jest.fn(),
            ssoLogin: jest.fn(),
            ssoLogout: jest.fn(),
            onDidChangeConfiguration: jest.fn(),
            getTreeView: jest.fn(),
        };
        const commands: IJestIt[] = [
            {
                name: "zowe.all.config.init",
                mock: [{ spy: jest.spyOn(dsProvider, "createZoweSchema"), arg: [dsProvider] }],
            },
            {
                name: "zowe.ds.addSession",
                mock: [{ spy: jest.spyOn(dsProvider, "createZoweSession"), arg: [dsProvider] }],
            },
            {
                name: "zowe.ds.addFavorite",
                mock: [{ spy: jest.spyOn(dsProvider, "addFavorite"), arg: [test.value] }],
            },
            {
                name: "zowe.ds.refreshAll",
                mock: [{ spy: jest.spyOn(refreshActions, "refreshAll"), arg: [dsProvider] }],
            },
            {
                name: "zowe.ds.refreshNode",
                mock: [
                    { spy: jest.spyOn(contextuals, "isDs"), arg: [test.value], ret: false },
                    { spy: jest.spyOn(contextuals, "isDsMember"), arg: [test.value], ret: true },
                    { spy: jest.spyOn(dsActions, "refreshPS"), arg: [test.value] },
                ],
            },
            {
                name: "zowe.ds.refreshDataset",
                mock: [
                    { spy: jest.spyOn(contextuals, "isDs"), arg: [test.value], ret: false },
                    { spy: jest.spyOn(contextuals, "isPdsNotFav"), arg: [test.value], ret: true },
                    { spy: jest.spyOn(dsActions, "refreshDataset"), arg: [test.value, dsProvider] },
                ],
            },
            {
                name: "zowe.ds.pattern",
                mock: [{ spy: jest.spyOn(dsProvider, "filterPrompt"), arg: [test.value] }],
            },
            {
                name: "zowe.ds.editSession",
                mock: [{ spy: jest.spyOn(dsProvider, "editSession"), arg: [test.value, dsProvider] }],
            },
            {
                name: "zowe.ds.ZoweNode.openPS",
                mock: [{ spy: jest.spyOn(dsActions, "openPS"), arg: [test.value, true, dsProvider] }],
            },
            {
                name: "zowe.ds.createDataset",
                mock: [{ spy: jest.spyOn(dsActions, "createFile"), arg: [test.value, dsProvider] }],
            },
            {
                name: "zowe.ds.createMember",
                mock: [{ spy: jest.spyOn(dsActions, "createMember"), arg: [test.value, dsProvider] }],
            },
            {
                name: "zowe.ds.deleteDataset",
                mock: [{ spy: jest.spyOn(dsActions, "deleteDatasetPrompt"), arg: [dsProvider, test.value] }],
            },
            {
                name: "zowe.ds.allocateLike",
                mock: [{ spy: jest.spyOn(dsActions, "allocateLike"), arg: [dsProvider, test.value] }],
            },
            {
                name: "zowe.ds.uploadDialog",
                mock: [{ spy: jest.spyOn(dsActions, "uploadDialog"), arg: [test.value, dsProvider] }],
            },
            {
                name: "zowe.ds.deleteMember",
                mock: [{ spy: jest.spyOn(dsActions, "deleteDatasetPrompt"), arg: [dsProvider, test.value] }],
            },
            {
                name: "zowe.ds.editDataSet",
                mock: [
                    { spy: jest.spyOn(contextuals, "isDs"), arg: [test.value], ret: false },
                    { spy: jest.spyOn(contextuals, "isDsMember"), arg: [test.value], ret: true },
                    { spy: jest.spyOn(dsActions, "openPS"), arg: [test.value, false, dsProvider] },
                ],
            },
            {
                name: "zowe.ds.editMember",
                mock: [
                    { spy: jest.spyOn(contextuals, "isDs"), arg: [test.value], ret: false },
                    { spy: jest.spyOn(contextuals, "isDsMember"), arg: [test.value], ret: true },
                    { spy: jest.spyOn(dsActions, "openPS"), arg: [test.value, false, dsProvider] },
                ],
            },
            {
                name: "zowe.ds.removeSession",
                mock: [
                    { spy: jest.spyOn(contextuals, "isDsSession"), arg: [test.value], ret: true },
                    { spy: jest.spyOn(dsProvider, "deleteSession"), arg: [test.value] },
                ],
            },
            {
                name: "zowe.ds.removeFavorite",
                mock: [{ spy: jest.spyOn(dsProvider, "removeFavorite"), arg: [test.value] }],
            },
            {
                name: "zowe.ds.saveSearch",
                mock: [{ spy: jest.spyOn(dsProvider, "addFavorite"), arg: [test.value] }],
            },
            {
                name: "zowe.ds.removeSavedSearch",
                mock: [{ spy: jest.spyOn(dsProvider, "removeFavorite"), arg: [test.value] }],
            },
            {
                name: "zowe.ds.removeFavProfile",
                mock: [{ spy: jest.spyOn(dsProvider, "removeFavProfile"), arg: [test.value.label, true] }],
            },
            {
                name: "zowe.ds.submitJcl",
                mock: [{ spy: jest.spyOn(dsActions, "submitJcl"), arg: [dsProvider] }],
            },
            {
                name: "zowe.ds.submitMember",
                mock: [{ spy: jest.spyOn(dsActions, "submitMember"), arg: [test.value] }],
            },
            {
                name: "zowe.ds.showAttributes",
                mock: [
                    { spy: jest.spyOn(contextuals, "isDs"), arg: [test.value], ret: false },
                    { spy: jest.spyOn(contextuals, "isPds"), arg: [test.value], ret: false },
                    { spy: jest.spyOn(contextuals, "isDsMember"), arg: [test.value], ret: true },
                    { spy: jest.spyOn(dsActions, "showAttributes"), arg: [test.value, dsProvider] },
                ],
            },
            {
                name: "zowe.ds.renameDataSet",
                mock: [{ spy: jest.spyOn(dsProvider, "rename"), arg: [test.value] }],
            },
            {
                name: "zowe.ds.copyDataSets",
                mock: [{ spy: jest.spyOn(dsActions, "copyDataSets"), arg: [test.value, undefined, dsProvider] }],
            },
            {
                name: "zowe.ds.pasteDataSets:1",
                parm: [false],
                mock: [
                    { spy: jest.spyOn(dsProvider, "getTreeView"), arg: [], ret: { reveal: jest.fn(), selection: [test.value] } },
                    { spy: jest.spyOn(dsActions, "pasteDataSetMembers"), arg: [dsProvider, test.value] },
                    { spy: jest.spyOn(dsActions, "refreshDataset"), arg: ["test", dsProvider] },
                ],
            },
            {
                name: "zowe.ds.pasteDataSets:2",
                mock: [
                    { spy: jest.spyOn(dsProvider, "getTreeView"), arg: [], ret: { reveal: jest.fn(), selection: [test.value] } },
                    { spy: jest.spyOn(dsActions, "pasteDataSetMembers"), arg: [dsProvider, test.value] },
                    { spy: jest.spyOn(dsActions, "refreshDataset"), arg: ["test", dsProvider] },
                ],
            },
            {
                name: "zowe.ds.renameDataSetMember",
                mock: [{ spy: jest.spyOn(dsProvider, "rename"), arg: [test.value] }],
            },
            {
                name: "zowe.ds.hMigrateDataSet",
                mock: [
                    { spy: jest.spyOn(contextuals, "isDs"), arg: [test.value], ret: false },
                    { spy: jest.spyOn(contextuals, "isPdsNotFav"), arg: [test.value], ret: true },
                    { spy: jest.spyOn(dsActions, "hMigrateDataSet"), arg: [test.value] },
                ],
            },
            {
                name: "zowe.ds.hRecallDataSet",
                mock: [
                    { spy: jest.spyOn(contextuals, "isMigrated"), arg: [test.value], ret: true },
                    { spy: jest.spyOn(dsActions, "hRecallDataSet"), arg: [test.value] },
                ],
            },
            {
                name: "zowe.ds.showFileErrorDetails",
                mock: [
                    { spy: jest.spyOn(contextuals, "hasFileError"), arg: [test.value], ret: true },
                    { spy: jest.spyOn(dsActions, "showFileErrorDetails"), arg: [test.value] },
                ],
            },
            {
                name: "zowe.ds.disableValidation",
                mock: [
                    {
                        spy: jest.spyOn(Profiles, "getInstance"),
                        arg: [],
                        ret: { disableValidation: jest.fn() },
                    },
                ],
            },
            {
                name: "zowe.ds.enableValidation",
                mock: [
                    {
                        spy: jest.spyOn(Profiles, "getInstance"),
                        arg: [],
                        ret: { enableValidation: jest.fn() },
                    },
                ],
            },
            {
                name: "zowe.ds.ssoLogin",
                mock: [{ spy: jest.spyOn(dsProvider, "ssoLogin"), arg: [test.value] }],
            },
            {
                name: "zowe.ds.ssoLogout",
                mock: [{ spy: jest.spyOn(dsProvider, "ssoLogout"), arg: [test.value] }],
            },
            {
                name: "onDidChangeConfiguration",
                mock: [{ spy: jest.spyOn(dsProvider, "onDidChangeConfiguration"), arg: [test.value] }],
            },
        ];

        beforeAll(async () => {
            registerCommand = (cmd: string, fun: () => void) => {
                return { [cmd]: fun };
            };
            onDidChangeConfiguration = (fun: () => void) => {
                return { onDidChangeConfiguration: fun };
            };
            spyCreateDatasetTree = jest.spyOn(dsTree, "createDatasetTree");
            jest.spyOn(sharedExtension, "initSubscribers").mockImplementation(jest.fn());
            Object.defineProperty(vscode.commands, "registerCommand", { value: registerCommand });
            Object.defineProperty(vscode.workspace, "onDidChangeConfiguration", { value: onDidChangeConfiguration });

            spyCreateDatasetTree.mockResolvedValue(dsProvider as any);
            spyOnSubscriptions(commands);
            await initDatasetProvider(test.context);
        });
        beforeEach(() => {
            spyCreateDatasetTree.mockResolvedValue(dsProvider as any);
        });
        afterAll(() => {
            jest.restoreAllMocks();
        });

        processSubscriptions(commands, test);

        it("should not initialize if it is unable to create the dataset tree", async () => {
            spyCreateDatasetTree.mockResolvedValue(null);
            const myProvider = await initDatasetProvider({} as any);
            expect(myProvider).toBe(null);
        });
    });
});
