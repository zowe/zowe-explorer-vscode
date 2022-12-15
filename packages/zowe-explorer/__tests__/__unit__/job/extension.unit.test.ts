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
import * as jobTree from "../../../src/job/ZosJobsProvider";
import * as refreshActions from "../../../src/shared/refresh";
import * as contextuals from "../../../src/shared/context";
import * as jobActions from "../../../src/job/actions";
import * as sharedExtension from "../../../src/shared/extension";
import { initJobsProvider } from "../../../src/job/extension";
import { Profiles } from "../../../src/Profiles";
import { ISubscriptionTesting } from "../extension.unit.test";
import { ITestContext, processSubscriptions, spyOnSubscriptions } from "../../__common__/testUtils";

describe("Test src/dataset/extension", () => {
    describe("initDatasetProvider", function () {
        let registerCommand;
        let onDidChangeConfiguration;
        let spyCreateJobsTree;
        const test: ITestContext = {
            context: { subscriptions: [] },
            value: { test: "job" },
            _: { _: "_" },
        };
        const jobsProvider: { [key: string]: jest.Mock } = {
            createZoweSchema: jest.fn(),
            createZoweSession: jest.fn(),
            deleteSession: jest.fn(),
            filterPrompt: jest.fn(),
            editSession: jest.fn(),
            addFavorite: jest.fn(),
            removeFavorite: jest.fn(),
            saveSearch: jest.fn(),
            removeFavProfile: jest.fn(),
            ssoLogin: jest.fn(),
            ssoLogout: jest.fn(),
            onDidChangeConfiguration: jest.fn(),
        };
        const commands: ISubscriptionTesting[] = [
            {
                name: "zowe.jobs.zosJobsOpenspool",
                parm: [test._, test.value, test._],
                mock: [jest.spyOn(jobActions, "getSpoolContent")],
                args: [[test._, test.value, test._]],
            },
            {
                name: "zowe.jobs.deleteJob",
                parm: [test.value, test._],
                mock: [jest.spyOn(jobActions, "deleteCommand")],
                args: [[jobsProvider, test.value, test._]],
            },
            {
                name: "zowe.jobs.runModifyCommand",
                mock: [jest.spyOn(jobActions, "modifyCommand")],
                args: [[test.value]],
            },
            {
                name: "zowe.jobs.runStopCommand",
                mock: [jest.spyOn(jobActions, "stopCommand")],
                args: [[test.value]],
            },
            {
                name: "zowe.jobs.refreshJobsServer",
                mock: [jest.spyOn(jobActions, "refreshJobsServer")],
                args: [[test.value, jobsProvider]],
            },
            {
                name: "zowe.jobs.refreshAllJobs",
                mock: [jest.spyOn(refreshActions, "refreshAll")],
                args: [[jobsProvider]],
            },
            {
                name: "zowe.jobs.refreshJob",
                parm: [{ mParent: test.value }],
                mock: [jest.spyOn(jobActions, "refreshJob")],
                args: [[test.value, jobsProvider]],
            },
            {
                name: "zowe.jobs.refreshSpool",
                parm: [{ mParent: { mParent: test.value } }],
                mock: [jest.spyOn(jobActions, "getSpoolContentFromMainframe"), jest.spyOn(jobActions, "refreshJob")],
                args: [[{ mParent: { mParent: test.value } }], [test.value, jobsProvider]],
            },
            {
                name: "zowe.jobs.addJobsSession",
                mock: [jest.spyOn(jobsProvider, "createZoweSession")],
                args: [[jobsProvider]],
            },
            {
                name: "zowe.jobs.setOwner",
                mock: [jest.spyOn(jobActions, "setOwner")],
                args: [[test.value, jobsProvider]],
            },
            {
                name: "zowe.jobs.setPrefix",
                mock: [jest.spyOn(jobActions, "setPrefix")],
                args: [[test.value, jobsProvider]],
            },
            {
                name: "zowe.jobs.removeJobsSession",
                mock: [jest.spyOn(contextuals, "isJobsSession"), jest.spyOn(jobsProvider, "deleteSession")],
                args: [[test.value], [test.value]],
                returnValue: [true],
            },
            {
                name: "zowe.jobs.downloadSpool",
                mock: [jest.spyOn(jobActions, "downloadSpool")],
                // Selected nodes array is passed to the downloadSpool method
                // Hence why the expected value is `[test.value]`
                args: [[[test.value]]],
            },
            {
                name: "zowe.jobs.getJobJcl",
                mock: [jest.spyOn(contextuals, "isJob"), jest.spyOn(jobActions, "downloadJcl")],
                args: [[test.value], [test.value]],
                returnValue: [true],
            },
            {
                name: "zowe.jobs.setJobSpool",
                parm: [test._, test.value],
                mock: [jest.spyOn(jobActions, "focusOnJob")],
                args: [[jobsProvider, test._, test.value]],
            },
            {
                name: "zowe.jobs.search",
                mock: [jest.spyOn(jobsProvider, "filterPrompt")],
                args: [[test.value]],
            },
            {
                name: "zowe.jobs.editSession",
                mock: [jest.spyOn(jobsProvider, "editSession")],
                args: [[test.value, jobsProvider]],
            },
            {
                name: "zowe.jobs.addFavorite",
                mock: [jest.spyOn(jobsProvider, "addFavorite")],
                args: [[test.value]],
            },
            {
                name: "zowe.jobs.removeFavorite",
                mock: [jest.spyOn(jobsProvider, "removeFavorite")],
                args: [[test.value]],
            },
            {
                name: "zowe.jobs.saveSearch",
                mock: [jest.spyOn(jobsProvider, "saveSearch")],
                args: [[test.value]],
            },
            {
                name: "zowe.jobs.removeSearchFavorite",
                mock: [jest.spyOn(jobsProvider, "removeFavorite")],
                args: [[test.value]],
            },
            {
                name: "zowe.jobs.removeFavProfile",
                parm: [{ label: test.value }],
                mock: [jest.spyOn(jobsProvider, "removeFavProfile")],
                args: [[test.value, true]],
            },
            {
                name: "zowe.jobs.disableValidation",
                mock: [jest.spyOn(Profiles, "getInstance")],
                args: [[]],
                returnValue: [{ enableValidation: jest.fn(), disableValidation: jest.fn() }],
            },
            {
                name: "zowe.jobs.enableValidation",
                mock: [jest.spyOn(Profiles, "getInstance")],
                args: [[]],
                returnValue: [{ enableValidation: jest.fn(), disableValidation: jest.fn() }],
            },
            {
                name: "zowe.jobs.ssoLogin",
                mock: [jest.spyOn(jobsProvider, "ssoLogin")],
                args: [[test.value]],
            },
            {
                name: "zowe.jobs.ssoLogout",
                mock: [jest.spyOn(jobsProvider, "ssoLogout")],
                args: [[test.value]],
            },
            {
                name: "onDidChangeConfiguration",
                mock: [jest.spyOn(jobsProvider, "onDidChangeConfiguration")],
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
            spyCreateJobsTree = jest.spyOn(jobTree, "createJobsTree");
            jest.spyOn(sharedExtension, "initSubscribers").mockImplementation(jest.fn());
            Object.defineProperty(vscode.commands, "registerCommand", { value: registerCommand });
            Object.defineProperty(vscode.workspace, "onDidChangeConfiguration", { value: onDidChangeConfiguration });

            spyCreateJobsTree.mockResolvedValue(jobsProvider as any);
            spyOnSubscriptions(commands);
            await initJobsProvider(test.context);
        });
        beforeEach(() => {
            spyCreateJobsTree.mockResolvedValue(jobsProvider as any);
        });
        afterAll(() => {
            jest.restoreAllMocks();
        });

        processSubscriptions(commands, test);

        it("should not initialize if it is unable to create the dataset tree", async () => {
            spyCreateJobsTree.mockResolvedValue(null);
            const dsProvider = await initJobsProvider({} as any);
            expect(dsProvider).toBe(null);
        });
    });
});
