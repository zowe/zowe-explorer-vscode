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
import { IJestIt, ITestContext, processSubscriptions } from "../../../__common__/testUtils";
import { ZoweScheme } from "@zowe/zowe-explorer-api";
import { SharedActions } from "../../../../src/trees/shared/SharedActions";
import { Profiles } from "../../../../src/configuration/Profiles";
import { DatasetTree } from "../../../../src/trees/dataset/DatasetTree";
import { SharedContext } from "../../../../src/trees/shared/SharedContext";
import { DatasetActions } from "../../../../src/trees/dataset/DatasetActions";
import { DatasetInit } from "../../../../src/trees/dataset/DatasetInit";
import { SharedInit } from "../../../../src/trees/shared/SharedInit";

describe("Test src/dataset/extension", () => {
    describe("initDatasetProvider", () => {
        let registerCommand;
        let onDidChangeConfiguration;
        let spyCreateDatasetTree;
        const test: ITestContext = {
            context: { subscriptions: [] },
            value: {
                label: "test",
                getParent: () => "test",
                openDs: jest.fn(),
                command: { command: "vscode.open", title: "", arguments: [vscode.Uri.from({ scheme: ZoweScheme.DS, path: "TEST.DS" })] },
            },
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
            onDidCloseTextDocument: jest.fn(),
            getTreeView: jest.fn(),
            refreshElement: jest.fn(),
            sortPdsMembersDialog: jest.fn(),
            filterPdsMembersDialog: jest.fn(),
            openWithEncoding: jest.fn(),
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
                mock: [{ spy: jest.spyOn(SharedActions, "refreshAll"), arg: [dsProvider] }],
            },
            {
                name: "zowe.ds.refreshNode",
                mock: [
                    { spy: jest.spyOn(SharedContext, "isDs"), arg: [test.value], ret: false },
                    { spy: jest.spyOn(SharedContext, "isDsMember"), arg: [test.value], ret: true },
                    { spy: jest.spyOn(DatasetActions, "refreshPS"), arg: [test.value] },
                ],
            },
            {
                name: "zowe.ds.refreshDataset",
                mock: [
                    { spy: jest.spyOn(SharedContext, "isDs"), arg: [test.value], ret: false },
                    { spy: jest.spyOn(SharedContext, "isPdsNotFav"), arg: [test.value], ret: true },
                    { spy: jest.spyOn(DatasetActions, "refreshDataset"), arg: [test.value, dsProvider] },
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
                name: "zowe.ds.createDataset",
                mock: [{ spy: jest.spyOn(DatasetActions, "createFile"), arg: [test.value, dsProvider] }],
            },
            {
                name: "zowe.ds.createMember",
                mock: [{ spy: jest.spyOn(DatasetActions, "createMember"), arg: [test.value, dsProvider] }],
            },
            {
                name: "zowe.ds.deleteDataset",
                mock: [{ spy: jest.spyOn(DatasetActions, "deleteDatasetPrompt"), arg: [dsProvider, test.value] }],
            },
            {
                name: "zowe.ds.allocateLike",
                mock: [{ spy: jest.spyOn(DatasetActions, "allocateLike"), arg: [dsProvider, test.value] }],
            },
            {
                name: "zowe.ds.uploadDialog",
                mock: [{ spy: jest.spyOn(DatasetActions, "uploadDialog"), arg: [test.value, dsProvider] }],
            },
            {
                name: "zowe.ds.deleteMember",
                mock: [{ spy: jest.spyOn(DatasetActions, "deleteDatasetPrompt"), arg: [dsProvider, test.value] }],
            },
            {
                name: "zowe.ds.editDataSet",
                mock: [
                    { spy: jest.spyOn(SharedContext, "isDs"), arg: [test.value], ret: false },
                    { spy: jest.spyOn(SharedContext, "isDsMember"), arg: [test.value], ret: true },
                ],
            },
            {
                name: "zowe.ds.editMember",
                mock: [
                    { spy: jest.spyOn(SharedContext, "isDs"), arg: [test.value], ret: false },
                    { spy: jest.spyOn(SharedContext, "isDsMember"), arg: [test.value], ret: true },
                ],
            },
            {
                name: "zowe.ds.removeSession",
                mock: [
                    { spy: jest.spyOn(SharedContext, "isDsSession"), arg: [test.value], ret: true },
                    { spy: jest.spyOn(dsProvider, "deleteSession"), arg: [test.value, undefined] },
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
                mock: [{ spy: jest.spyOn(DatasetActions, "submitJcl"), arg: [dsProvider, test.value] }],
            },
            {
                name: "zowe.ds.submitMember",
                mock: [{ spy: jest.spyOn(DatasetActions, "submitMember"), arg: [test.value] }],
            },
            {
                name: "zowe.ds.showAttributes",
                mock: [
                    { spy: jest.spyOn(SharedContext, "isDs"), arg: [test.value], ret: false },
                    { spy: jest.spyOn(SharedContext, "isPds"), arg: [test.value], ret: false },
                    { spy: jest.spyOn(SharedContext, "isDsMember"), arg: [test.value], ret: true },
                    { spy: jest.spyOn(DatasetActions, "showAttributes"), arg: [test.value, dsProvider] },
                ],
            },
            {
                name: "zowe.ds.renameDataSet",
                mock: [{ spy: jest.spyOn(dsProvider, "rename"), arg: [test.value] }],
            },
            {
                name: "zowe.ds.copyDataSets",
                mock: [{ spy: jest.spyOn(DatasetActions, "copyDataSets"), arg: [test.value, undefined, dsProvider] }],
            },
            {
                name: "zowe.ds.pasteDataSets:1",
                parm: [false],
                mock: [
                    { spy: jest.spyOn(dsProvider, "getTreeView"), arg: [], ret: { reveal: jest.fn(), selection: [test.value] } },
                    { spy: jest.spyOn(DatasetActions, "pasteDataSetMembers"), arg: [dsProvider, test.value] },
                    { spy: jest.spyOn(DatasetActions, "refreshDataset"), arg: ["test", dsProvider] },
                ],
            },
            {
                name: "zowe.ds.pasteDataSets:2",
                mock: [
                    { spy: jest.spyOn(dsProvider, "getTreeView"), arg: [], ret: { reveal: jest.fn(), selection: [test.value] } },
                    { spy: jest.spyOn(DatasetActions, "pasteDataSetMembers"), arg: [dsProvider, test.value] },
                    { spy: jest.spyOn(DatasetActions, "refreshDataset"), arg: ["test", dsProvider] },
                ],
            },
            {
                name: "zowe.ds.renameDataSetMember",
                mock: [{ spy: jest.spyOn(dsProvider, "rename"), arg: [test.value] }],
            },
            {
                name: "zowe.ds.hMigrateDataSet",
                mock: [
                    { spy: jest.spyOn(SharedContext, "isDs"), arg: [test.value], ret: false },
                    { spy: jest.spyOn(SharedContext, "isPdsNotFav"), arg: [test.value], ret: true },
                    { spy: jest.spyOn(DatasetActions, "hMigrateDataSet"), arg: [test.value] },
                ],
            },
            {
                name: "zowe.ds.hRecallDataSet",
                mock: [
                    { spy: jest.spyOn(SharedContext, "isMigrated"), arg: [test.value], ret: true },
                    { spy: jest.spyOn(DatasetActions, "hRecallDataSet"), arg: [test.value] },
                ],
            },
            {
                name: "zowe.ds.showFileErrorDetails",
                mock: [
                    { spy: jest.spyOn(SharedContext, "hasFileError"), arg: [test.value], ret: true },
                    { spy: jest.spyOn(DatasetActions, "showFileErrorDetails"), arg: [test.value] },
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
                        ret: { enableValidation: jest.fn(), disableValidation: jest.fn() },
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
                name: "zowe.ds.sortBy",
                mock: [{ spy: jest.spyOn(dsProvider, "sortPdsMembersDialog"), arg: [test.value] }],
            },
            {
                name: "zowe.ds.filterBy",
                mock: [{ spy: jest.spyOn(dsProvider, "filterPdsMembersDialog"), arg: [test.value] }],
            },
            {
                name: "zowe.ds.openWithEncoding",
                mock: [{ spy: jest.spyOn(dsProvider, "openWithEncoding"), arg: [test.value, undefined] }],
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
            spyCreateDatasetTree = jest.spyOn(DatasetInit, "createDatasetTree");
            jest.spyOn(SharedInit, "initSubscribers").mockImplementation(jest.fn());
            Object.defineProperty(vscode.commands, "registerCommand", { value: registerCommand });
            Object.defineProperty(vscode.workspace, "onDidChangeConfiguration", { value: onDidChangeConfiguration });

            spyCreateDatasetTree.mockResolvedValue(dsProvider as any);
            jest.spyOn(vscode.workspace, "onDidCloseTextDocument").mockImplementation(dsProvider.onDidCloseTextDocument);
            await DatasetInit.initDatasetProvider(test.context);
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
            const myProvider = await DatasetInit.initDatasetProvider(test.context);
            expect(myProvider).toBe(null);
        });

        it("should register onDidCloseTextDocument event listener from DatasetTree", () => {
            expect(dsProvider.onDidCloseTextDocument).toHaveBeenCalledWith(DatasetTree.onDidCloseTextDocument);
        });
    });
});
