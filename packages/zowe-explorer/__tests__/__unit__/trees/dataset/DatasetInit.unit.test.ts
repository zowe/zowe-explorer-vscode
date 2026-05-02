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
import { Mock, vi } from "vitest";

import * as vscode from "vscode";
import { IJestIt, ITestContext, processSubscriptions } from "../../../__common__/testUtils";
import { ZoweScheme } from "@zowe/zowe-explorer-api";
import { SharedActions } from "../../../../src/trees/shared/SharedActions";
import { SharedContext } from "../../../../src/trees/shared/SharedContext";
import { DatasetActions } from "../../../../src/trees/dataset/DatasetActions";
import { DatasetInit } from "../../../../src/trees/dataset/DatasetInit";
import { SharedInit } from "../../../../src/trees/shared/SharedInit";
import { ProfilesUtils } from "../../../../src/utils/ProfilesUtils";
import { DatasetSearch } from "../../../../src/trees/dataset/DatasetSearch";
import { DatasetTableView } from "../../../../src/trees/dataset/DatasetTableView";

vi.mock("../../../../src/tools/ZoweLocalStorage");

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
                openDs: vi.fn(),
                command: { command: "vscode.open", title: "", arguments: [vscode.Uri.from({ scheme: ZoweScheme.DS, path: "TEST.DS" })] },
            },
            _: { _: "_" },
        };
        const dsProvider: { [key: string]: Mock } = {
            createZoweSchema: vi.fn(),
            createZoweSession: vi.fn(),
            filterPrompt: vi.fn(),
            rename: vi.fn(),
            onDidChangeConfiguration: vi.fn(),
            getTreeView: vi.fn().mockReturnValue({
                onDidChangeVisibility: vi.fn(),
            }),
            sortPdsMembersDialog: vi.fn(),
            filterPdsMembersDialog: vi.fn(),
            openWithEncoding: vi.fn(),
        };
        const commands: IJestIt[] = [
            {
                name: "zowe.all.config.init",
                mock: [{ spy: vi.spyOn(dsProvider, "createZoweSchema"), arg: [dsProvider] }],
            },
            {
                name: "zowe.ds.addSession",
                mock: [{ spy: vi.spyOn(dsProvider, "createZoweSession"), arg: [dsProvider] }],
            },
            {
                name: "zowe.ds.refreshAll",
                mock: [{ spy: vi.spyOn(SharedActions, "refreshAll"), arg: [] }],
            },
            {
                name: "zowe.ds.refresh",
                mock: [{ spy: vi.spyOn(SharedActions, "refreshProvider"), arg: [dsProvider] }],
            },
            {
                name: "zowe.ds.refreshNode",
                mock: [
                    { spy: vi.spyOn(SharedContext, "isDs"), arg: [test.value], ret: false },
                    { spy: vi.spyOn(SharedContext, "isDsMember"), arg: [test.value], ret: true },
                    { spy: vi.spyOn(DatasetActions, "refreshPS"), arg: [test.value] },
                ],
            },
            {
                name: "zowe.ds.refreshDataset",
                mock: [
                    { spy: vi.spyOn(SharedContext, "isDs"), arg: [test.value], ret: false },
                    { spy: vi.spyOn(SharedContext, "isPdsNotFav"), arg: [test.value], ret: true },
                    { spy: vi.spyOn(DatasetActions, "refreshDataset"), arg: [test.value, dsProvider] },
                ],
            },
            {
                name: "zowe.ds.pattern",
                mock: [{ spy: vi.spyOn(dsProvider, "filterPrompt"), arg: [test.value] }],
            },
            {
                name: "zowe.ds.createDataset",
                mock: [{ spy: vi.spyOn(DatasetActions, "createFile"), arg: [test.value, dsProvider] }],
            },
            {
                name: "zowe.ds.createMember",
                mock: [{ spy: vi.spyOn(DatasetActions, "createMember"), arg: [test.value, dsProvider] }],
            },
            {
                name: "zowe.ds.deleteDataset",
                mock: [{ spy: vi.spyOn(DatasetActions, "deleteDatasetPrompt"), arg: [dsProvider, test.value, undefined] }],
            },
            {
                name: "zowe.ds.allocateLike",
                mock: [{ spy: vi.spyOn(DatasetActions, "allocateLike"), arg: [dsProvider, test.value] }],
            },
            {
                name: "zowe.ds.pdsSearchFor",
                mock: [{ spy: vi.spyOn(DatasetSearch, "search"), arg: [test.context, test.value] }],
            },
            {
                name: "zowe.ds.filteredDataSetsSearchFor",
                mock: [{ spy: vi.spyOn(DatasetSearch, "search"), arg: [test.context, test.value] }],
            },
            {
                name: "zowe.ds.uploadDialog",
                mock: [{ spy: vi.spyOn(DatasetActions, "uploadDialog"), arg: [test.value, dsProvider] }],
            },
            {
                name: "zowe.ds.uploadDialogWithEncoding",
                mock: [{ spy: vi.spyOn(DatasetActions, "uploadDialogWithEncoding"), arg: [test.value, dsProvider] }],
            },
            {
                name: "zowe.ds.downloadAllMembers",
                mock: [{ spy: vi.spyOn(DatasetActions, "downloadAllMembers"), arg: [test.value] }],
            },
            {
                name: "zowe.ds.downloadMember",
                mock: [{ spy: vi.spyOn(DatasetActions, "downloadMember"), arg: [test.value] }],
            },
            {
                name: "zowe.ds.downloadDataSet",
                mock: [{ spy: vi.spyOn(DatasetActions, "downloadDataSet"), arg: [test.value] }],
            },
            {
                name: "zowe.ds.deleteMember",
                mock: [{ spy: vi.spyOn(DatasetActions, "deleteDatasetPrompt"), arg: [dsProvider, test.value, undefined] }],
            },
            {
                name: "zowe.ds.editDataSet",
                mock: [
                    { spy: vi.spyOn(SharedContext, "isDs"), arg: [test.value], ret: false },
                    { spy: vi.spyOn(SharedContext, "isDsMember"), arg: [test.value], ret: true },
                ],
            },
            {
                name: "zowe.ds.editMember",
                mock: [
                    { spy: vi.spyOn(SharedContext, "isDs"), arg: [test.value], ret: false },
                    { spy: vi.spyOn(SharedContext, "isDsMember"), arg: [test.value], ret: true },
                ],
            },
            {
                name: "zowe.ds.submitJcl",
                mock: [{ spy: vi.spyOn(DatasetActions, "submitJcl"), arg: [dsProvider, test.value] }],
            },
            {
                name: "zowe.ds.zoom",
                mock: [{ spy: vi.spyOn(DatasetActions, "zoom"), arg: [] }],
            },
            {
                name: "zowe.ds.submitMember",
                mock: [{ spy: vi.spyOn(DatasetActions, "submitMember"), arg: [test.value] }],
            },
            {
                name: "zowe.ds.showAttributes",
                mock: [
                    { spy: vi.spyOn(SharedContext, "isDs"), arg: [test.value], ret: false },
                    { spy: vi.spyOn(SharedContext, "isVsam"), arg: [test.value], ret: false },
                    { spy: vi.spyOn(SharedContext, "isPds"), arg: [test.value], ret: false },
                    { spy: vi.spyOn(SharedContext, "isDsMember"), arg: [test.value], ret: true },
                    { spy: vi.spyOn(DatasetActions, "showAttributes"), arg: [test.value, dsProvider] },
                ],
            },
            {
                name: "zowe.ds.renameDataSet",
                mock: [{ spy: vi.spyOn(dsProvider, "rename"), arg: [test.value] }],
            },
            {
                name: "zowe.ds.copyDataSets",
                mock: [{ spy: vi.spyOn(DatasetActions, "copyDataSets"), arg: [test.value, undefined, dsProvider] }],
            },
            {
                name: "zowe.ds.pasteDataSets",
                parm: [false],
                mock: [
                    {
                        spy: vi.spyOn(dsProvider, "getTreeView"),
                        arg: [],
                        ret: { reveal: vi.fn(), onDidChangeVisibility: vi.fn(), selection: [test.value] },
                    },
                    { spy: vi.spyOn(DatasetActions, "pasteDataSet"), arg: [dsProvider, test.value] },
                ],
            },
            {
                name: "zowe.ds.renameDataSetMember",
                mock: [{ spy: vi.spyOn(dsProvider, "rename"), arg: [test.value] }],
            },
            {
                name: "zowe.ds.hMigrateDataSet",
                mock: [
                    { spy: vi.spyOn(SharedContext, "isDs"), arg: [test.value], ret: false },
                    { spy: vi.spyOn(SharedContext, "isPdsNotFav"), arg: [test.value], ret: true },
                    { spy: vi.spyOn(DatasetActions, "hMigrateDataSet"), arg: [dsProvider, test.value] },
                ],
            },
            {
                name: "zowe.ds.hRecallDataSet",
                mock: [
                    { spy: vi.spyOn(SharedContext, "isMigrated"), arg: [test.value], ret: true },
                    { spy: vi.spyOn(DatasetActions, "hRecallDataSet"), arg: [dsProvider, test.value] },
                ],
            },
            {
                name: "zowe.ds.showFileErrorDetails",
                mock: [
                    { spy: vi.spyOn(SharedContext, "hasFileError"), arg: [test.value], ret: true },
                    { spy: vi.spyOn(DatasetActions, "showFileErrorDetails"), arg: [test.value] },
                ],
            },
            {
                name: "zowe.ds.sortBy",
                mock: [{ spy: vi.spyOn(dsProvider, "sortPdsMembersDialog"), arg: [test.value] }],
            },
            {
                name: "zowe.ds.filterBy",
                mock: [{ spy: vi.spyOn(dsProvider, "filterPdsMembersDialog"), arg: [test.value] }],
            },
            {
                name: "zowe.ds.tableView",
                mock: [{ spy: vi.spyOn(DatasetTableView.getInstance(), "handleCommand"), arg: [test.context, test.value, undefined] }],
            },
            {
                name: "zowe.ds.listDataSets",
                mock: [{ spy: vi.spyOn(DatasetTableView.getInstance(), "handlePatternSearch"), arg: [test.context] }],
            },
            {
                name: "zowe.ds.setDataSetFilter",
                parm: [undefined, undefined],
                mock: [{ spy: vi.spyOn(DatasetActions, "filterDatasetTreePrompt"), arg: [dsProvider] }],
            },
            {
                name: "zowe.ds.setDataSetFilter",
                parm: ["testSession", "HLQ.DATASET"],
                mock: [{ spy: vi.spyOn(DatasetActions, "filterDatasetTree"), arg: [dsProvider, "testSession", "HLQ.DATASET"] }],
            },
            {
                name: "onDidChangeConfiguration",
                mock: [{ spy: vi.spyOn(dsProvider, "onDidChangeConfiguration"), arg: [test.value] }],
            },
        ];

        beforeAll(async () => {
            registerCommand = (cmd: string, fun: () => void) => {
                return { [cmd]: fun };
            };
            onDidChangeConfiguration = (fun: () => void) => {
                return { onDidChangeConfiguration: fun };
            };
            spyCreateDatasetTree = vi.spyOn(DatasetInit, "createDatasetTree").mockResolvedValue(dsProvider as any);
            vi.spyOn(SharedInit, "initSubscribers").mockImplementation(vi.fn());
            Object.defineProperty(vscode.commands, "registerCommand", { value: registerCommand });
            Object.defineProperty(vscode.workspace, "onDidChangeConfiguration", { value: onDidChangeConfiguration });

            await DatasetInit.initDatasetProvider(test.context);
        });
        beforeEach(() => {
            spyCreateDatasetTree.mockResolvedValue(dsProvider as any);
        });
        afterAll(() => {
            vi.restoreAllMocks();
        });

        processSubscriptions(commands, test);

        it("should not initialize if it is unable to create the dataset tree", async () => {
            spyCreateDatasetTree.mockResolvedValue(null);
            const myProvider = await DatasetInit.initDatasetProvider(test.context);
            expect(myProvider).toBe(null);
        });
    });

    describe("datasetTreeVisibilityChanged", () => {
        it("calls ProfilesUtils.promptUserWithNoConfigs if visible", async () => {
            const promptUserWithNoConfigsMock = vi.spyOn(ProfilesUtils, "promptUserWithNoConfigs").mockImplementation((() => undefined) as any);
            await DatasetInit.datasetTreeVisibilityChanged({ visible: true });
            expect(promptUserWithNoConfigsMock).toHaveBeenCalled();
        });
    });
});
