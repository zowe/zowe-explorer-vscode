/*
 * This program and the accompanying materials are made available under the terms of the *
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at *
 * https://www.eclipse.org/legal/epl-v20.html                                      *
 *                                                                                 *
 * SPDX-License-Identifier: EPL-2.0                                                *
 *                                                                                 *
 * Copyright Contributors to the Zowe Project.                                     *
 *                                                                                 *
 */

import * as vscode from "vscode";
import * as dsTree from "../../../src/dataset/DatasetTree";
import * as refreshActions from "../../../src/shared/refresh";
import * as contextuals from "../../../src/shared/context";
import * as dsActions from "../../../src/dataset/actions";
import * as sharedExtension from "../../../src/shared/extension";
import { initDatasetProvider } from "../../../src/dataset/extension";
import { Profiles } from "../../../src/Profiles";
import { ISubscriptionTesting } from "../extension.unit.test";
import { ITestContext, processSubscriptions, spyOnSubscriptions } from "../../__common__/testUtils";

describe("Test src/dataset/extension", () => {
    describe("initDatasetProvider", () => {
        let registerCommand;
        let onDidChangeConfiguration;
        let spyCreateDatasetTree;
        const test: ITestContext = {
            context: { subscriptions: [] },
            value: { label: "test" },
            _: { _: "_" }
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
        };
        const commands: ISubscriptionTesting[] = [
            {
                name: "zowe.all.config.init",
                mock: [jest.spyOn(dsProvider, "createZoweSchema")],
                args: [[dsProvider]],
            },
            {
                name: "zowe.ds.addSession",
                mock: [jest.spyOn(dsProvider, "createZoweSession")],
                args: [[dsProvider]],
            },
            {
                name: "zowe.ds.addFavorite",
                mock: [jest.spyOn(dsProvider, "addFavorite")],
                args: [[test.value]],
            },
            {
                name: "zowe.ds.refreshAll",
                mock: [jest.spyOn(refreshActions, "refreshAll")],
                args: [[dsProvider]],
            },
            {
                name: "zowe.ds.refreshNode",
                mock: [
                    jest.spyOn(contextuals, "isDs"),
                    jest.spyOn(contextuals, "isDsMember"),
                    jest.spyOn(dsActions, "refreshPS"),
                ],
                args: [[test.value], [test.value], [test.value]],
                returnValue: [false, true],
            },
            {
                name: "zowe.ds.refreshDataset",
                mock: [
                    jest.spyOn(contextuals, "isDs"),
                    jest.spyOn(contextuals, "isPdsNotFav"),
                    jest.spyOn(dsActions, "refreshDataset"),
                ],
                args: [[test.value], [test.value], [test.value, dsProvider]],
                returnValue: [false, true],
            },
            {
                name: "zowe.ds.pattern",
                mock: [jest.spyOn(dsProvider, "filterPrompt")],
                args: [[test.value]],
            },
            {
                name: "zowe.ds.editSession",
                mock: [jest.spyOn(dsProvider, "editSession")],
                args: [[test.value, dsProvider]],
            },
            {
                name: "zowe.ds.ZoweNode.openPS",
                mock: [jest.spyOn(dsActions, "openPS")],
                args: [[test.value, true, dsProvider]],
            },
            {
                name: "zowe.ds.createDataset",
                mock: [jest.spyOn(dsActions, "createFile")],
                args: [[test.value, dsProvider]],
            },
            {
                name: "zowe.ds.createMember",
                mock: [jest.spyOn(dsActions, "createMember")],
                args: [[test.value, dsProvider]],
            },
            {
                name: "zowe.ds.deleteDataset",
                mock: [jest.spyOn(dsActions, "deleteDatasetPrompt")],
                args: [[dsProvider, test.value]],
            },
            {
                name: "zowe.ds.allocateLike",
                mock: [jest.spyOn(dsActions, "allocateLike")],
                args: [[dsProvider, test.value]],
            },
            {
                name: "zowe.ds.uploadDialog",
                mock: [jest.spyOn(dsActions, "uploadDialog")],
                args: [[test.value, dsProvider]],
            },
            {
                name: "zowe.ds.deleteMember",
                mock: [jest.spyOn(dsActions, "deleteDatasetPrompt")],
                args: [[dsProvider, test.value]],
            },
            {
                name: "zowe.ds.editDataSet",
                mock: [
                    jest.spyOn(contextuals, "isDs"),
                    jest.spyOn(contextuals, "isDsMember"),
                    jest.spyOn(dsActions, "openPS"),
                ],
                args: [[test.value], [test.value], [test.value, false, dsProvider]],
                returnValue: [false, true],
            },
            {
                name: "zowe.ds.editMember",
                mock: [
                    jest.spyOn(contextuals, "isDs"),
                    jest.spyOn(contextuals, "isDsMember"),
                    jest.spyOn(dsActions, "openPS"),
                ],
                args: [[test.value], [test.value], [test.value, false, dsProvider]],
                returnValue: [false, true],
            },
            {
                name: "zowe.ds.removeSession",
                mock: [jest.spyOn(contextuals, "isDsSession"), jest.spyOn(dsProvider, "deleteSession")],
                args: [[test.value], [test.value]],
                returnValue: [true],
            },
            {
                name: "zowe.ds.removeFavorite",
                mock: [jest.spyOn(dsProvider, "removeFavorite")],
                args: [[test.value]],
            },
            {
                name: "zowe.ds.saveSearch",
                mock: [jest.spyOn(dsProvider, "addFavorite")],
                args: [[test.value]],
            },
            {
                name: "zowe.ds.removeSavedSearch",
                mock: [jest.spyOn(dsProvider, "removeFavorite")],
                args: [[test.value]],
            },
            {
                name: "zowe.ds.removeFavProfile",
                mock: [jest.spyOn(dsProvider, "removeFavProfile")],
                args: [[test.value.label, true]],
            },
            {
                name: "zowe.ds.submitJcl",
                mock: [jest.spyOn(dsActions, "submitJcl")],
                args: [[dsProvider]],
            },
            {
                name: "zowe.ds.submitMember",
                mock: [jest.spyOn(dsActions, "submitMember")],
                args: [[test.value]],
            },
            {
                name: "zowe.ds.showAttributes",
                mock: [
                    jest.spyOn(contextuals, "isDs"),
                    jest.spyOn(contextuals, "isPds"),
                    jest.spyOn(contextuals, "isDsMember"),
                    jest.spyOn(dsActions, "showAttributes"),
                ],
                args: [[test.value], [test.value], [test.value], [test.value, dsProvider]],
                returnValue: [false, false, true],
            },
            {
                name: "zowe.ds.renameDataSet",
                mock: [jest.spyOn(dsProvider, "rename")],
                args: [[test.value]],
            },
            {
                name: "zowe.ds.copyMember",
                mock: [jest.spyOn(dsActions, "copyDataSet")],
                args: [[test.value]],
            },
            {
                name: "zowe.ds.copyDataSet",
                mock: [jest.spyOn(dsActions, "copyDataSet")],
                args: [[test.value]],
            },
            {
                name: "zowe.ds.pasteMember",
                mock: [jest.spyOn(dsActions, "pasteMember")],
                args: [[test.value, dsProvider]],
            },
            {
                name: "zowe.ds.renameDataSetMember",
                mock: [jest.spyOn(dsProvider, "rename")],
                args: [[test.value]],
            },
            {
                name: "zowe.ds.hMigrateDataSet",
                mock: [
                    jest.spyOn(contextuals, "isDs"),
                    jest.spyOn(contextuals, "isPdsNotFav"),
                    jest.spyOn(dsActions, "hMigrateDataSet"),
                ],
                args: [[test.value], [test.value], [test.value]],
                returnValue: [false, true],
            },
            {
                name: "zowe.ds.hRecallDataSet",
                mock: [jest.spyOn(contextuals, "isMigrated"), jest.spyOn(dsActions, "hRecallDataSet")],
                args: [[test.value], [test.value]],
                returnValue: [true],
            },
            {
                name: "zowe.ds.showImperativeErrorDetails",
                mock: [
                    jest.spyOn(contextuals, "hasImperativeError"),
                    jest.spyOn(dsActions, "showImperativeErrorDetails"),
                ],
                args: [[test.value], [test.value]],
                returnValue: [true],
            },
            {
                name: "zowe.ds.disableValidation",
                mock: [jest.spyOn(Profiles, "getInstance")],
                args: [[]],
                returnValue: [{ enableValidation: jest.fn(), disableValidation: jest.fn() }],
            },
            {
                name: "zowe.ds.enableValidation",
                mock: [jest.spyOn(Profiles, "getInstance")],
                args: [[]],
                returnValue: [{ enableValidation: jest.fn(), disableValidation: jest.fn() }],
            },
            {
                name: "zowe.ds.ssoLogin",
                mock: [jest.spyOn(dsProvider, "ssoLogin")],
                args: [[test.value]],
            },
            {
                name: "zowe.ds.ssoLogout",
                mock: [jest.spyOn(dsProvider, "ssoLogout")],
                args: [[test.value]],
            },
            {
                name: "onDidChangeConfiguration",
                mock: [jest.spyOn(dsProvider, "onDidChangeConfiguration")],
                args: [[test.value]],
            },
        ];

        beforeAll(async () => {
            registerCommand = (cmd: string, fun: Function) => {
                return { [cmd]: fun };
            };
            onDidChangeConfiguration = (fun: Function) => {
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
            const dsProvider = await initDatasetProvider({} as any);
            expect(dsProvider).toBe(null);
        });
    });
});
