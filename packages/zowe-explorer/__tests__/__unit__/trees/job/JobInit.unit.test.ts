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
import { createISession, createIProfile } from "../../../__mocks__/mockCreators/shared";
import { createJobNode, createJobSessionNode } from "../../../__mocks__/mockCreators/jobs";
import { IJestIt, ITestContext, processSubscriptions } from "../../../__common__/testUtils";
import { JobActions } from "../../../../src/trees/job/JobActions";
import { ZoweLocalStorage } from "../../../../src/tools/ZoweLocalStorage";
import { ZoweLogger } from "../../../../src/tools/ZoweLogger";
import { SharedActions } from "../../../../src/trees/shared/SharedActions";
import { SharedContext } from "../../../../src/trees/shared/SharedContext";
import { JobInit } from "../../../../src/trees/job/JobInit";
import { SharedInit } from "../../../../src/trees/shared/SharedInit";
import { JobTableView } from "../../../../src/trees/job/JobTableView";

describe("Test src/jobs/extension", () => {
    describe("initJobsProvider", () => {
        let registerCommand;
        let onDidChangeConfiguration;
        let spyCreateJobsTree;
        const test: ITestContext = {
            context: { subscriptions: [] },
            value: { test: "job" },
            _: { _: "_" },
        };
        const exampleData: Record<string, any> = {
            profile: createIProfile(),
            session: createISession(),
        };
        exampleData["jobSession"] = createJobSessionNode(exampleData.session, exampleData.profile);
        exampleData["job"] = createJobNode(exampleData["jobSession"], exampleData.profile);

        const jobsProvider: { [key: string]: jest.Mock } = {
            createZoweSchema: jest.fn(),
            createZoweSession: jest.fn(),
            filterPrompt: jest.fn(),
            onDidChangeConfiguration: jest.fn(),
            pollData: jest.fn(),
            filterJobsDialog: jest.fn(),
        };
        const commands: IJestIt[] = [
            {
                name: "zowe.jobs.deleteJob",
                parm: [test.value, test._],
                mock: [{ spy: jest.spyOn(JobActions, "deleteCommand"), arg: [jobsProvider, test.value, test._] }],
            },
            {
                name: "zowe.jobs.runModifyCommand",
                mock: [{ spy: jest.spyOn(JobActions, "modifyCommand"), arg: [test.value] }],
            },
            {
                name: "zowe.jobs.runStopCommand",
                mock: [{ spy: jest.spyOn(JobActions, "stopCommand"), arg: [test.value] }],
            },
            {
                name: "zowe.jobs.refreshJobsServer",
                mock: [{ spy: jest.spyOn(JobActions, "refreshJob"), arg: [test.value, jobsProvider] }],
            },
            {
                name: "zowe.jobs.refreshAllJobs",
                mock: [{ spy: jest.spyOn(SharedActions, "refreshAll"), arg: [jobsProvider] }],
            },
            {
                name: "zowe.jobs.refreshJob",
                parm: [{ mParent: test.value }],
                mock: [{ spy: jest.spyOn(JobActions, "refreshJob"), arg: [test.value, jobsProvider] }],
            },
            {
                name: "zowe.jobs.downloadSingleSpool",
                mock: [{ spy: jest.spyOn(JobActions, "downloadSingleSpool"), arg: [[test.value], false] }],
            },
            {
                name: "zowe.jobs.downloadSingleSpoolBinary",
                mock: [{ spy: jest.spyOn(JobActions, "downloadSingleSpool"), arg: [[test.value], true] }],
            },
            {
                name: "zowe.jobs.addJobsSession",
                mock: [{ spy: jest.spyOn(jobsProvider, "createZoweSession"), arg: [jobsProvider] }],
            },
            {
                name: "zowe.jobs.setOwner",
                mock: [{ spy: jest.spyOn(JobActions, "setOwner"), arg: [test.value, jobsProvider] }],
            },
            {
                name: "zowe.jobs.setPrefix",
                mock: [{ spy: jest.spyOn(JobActions, "setPrefix"), arg: [test.value, jobsProvider] }],
            },
            {
                name: "zowe.jobs.downloadSpool",
                mock: [{ spy: jest.spyOn(JobActions, "downloadSpool"), arg: [[test.value], false] }],
            },
            {
                name: "zowe.jobs.downloadSpoolBinary",
                mock: [{ spy: jest.spyOn(JobActions, "downloadSpool"), arg: [[test.value], true] }],
            },
            {
                name: "zowe.jobs.getJobJcl",
                mock: [
                    { spy: jest.spyOn(SharedContext, "isJob"), arg: [test.value], ret: true },
                    { spy: jest.spyOn(JobActions, "downloadJcl"), arg: [test.value] },
                ],
            },
            {
                name: "zowe.jobs.setJobSpool",
                parm: [test._, test.value],
                mock: [{ spy: jest.spyOn(JobActions, "focusOnJob"), arg: [jobsProvider, test._, test.value] }],
            },
            {
                name: "zowe.jobs.search",
                mock: [{ spy: jest.spyOn(jobsProvider, "filterPrompt"), arg: [test.value] }],
            },
            {
                name: "onDidChangeConfiguration",
                mock: [{ spy: jest.spyOn(jobsProvider, "onDidChangeConfiguration"), arg: [test.value] }],
            },
            {
                name: "zowe.jobs.startPolling",
                mock: [{ spy: jest.spyOn(jobsProvider, "pollData"), arg: [test.value] }],
            },
            {
                name: "zowe.jobs.stopPolling",
                mock: [{ spy: jest.spyOn(jobsProvider, "pollData"), arg: [test.value] }],
            },
            {
                name: "zowe.jobs.cancelJob",
                mock: [{ spy: jest.spyOn(JobActions, "cancelJobs"), arg: [jobsProvider, [exampleData.job]] }],
                parm: [exampleData.job],
            },
            {
                name: "zowe.jobs.filterJobs",
                mock: [{ spy: jest.spyOn(jobsProvider, "filterJobsDialog"), arg: [test.value] }],
            },
            {
                name: "zowe.jobs.tableView",
                mock: [{ spy: jest.spyOn(JobTableView, "handleCommand"), arg: [test.context, test.value, undefined] }],
            },
        ];

        beforeAll(async () => {
            registerCommand = (cmd: string, fun: () => void) => {
                return { [cmd]: fun };
            };
            onDidChangeConfiguration = (fun: () => void) => {
                return { onDidChangeConfiguration: fun };
            };
            spyCreateJobsTree = jest.spyOn(JobInit, "createJobsTree");
            jest.spyOn(SharedInit, "initSubscribers").mockImplementation(jest.fn());
            Object.defineProperty(vscode.commands, "registerCommand", { value: registerCommand });
            Object.defineProperty(vscode.workspace, "onDidChangeConfiguration", { value: onDidChangeConfiguration });
            Object.defineProperty(vscode.window, "showWarningMessage", { value: onDidChangeConfiguration });
            Object.defineProperty(ZoweLogger, "trace", { value: jest.fn(), configurable: true });
            Object.defineProperty(ZoweLocalStorage, "globalState", {
                value: {
                    get: () => ({ persistence: true, favorites: [], history: [], sessions: ["zosmf"], searchHistory: [], fileHistory: [] }),
                    update: jest.fn(),
                    keys: () => [],
                },
                configurable: true,
            });

            spyCreateJobsTree.mockResolvedValue(jobsProvider as any);
            await JobInit.initJobsProvider(test.context);
        });
        beforeEach(() => {
            spyCreateJobsTree.mockResolvedValue(jobsProvider as any);
        });
        afterAll(() => {
            jest.restoreAllMocks();
        });

        processSubscriptions(commands, test);

        it("should not initialize if it is unable to create the jobs tree", async () => {
            spyCreateJobsTree.mockResolvedValue(null);
            const myProvider = await JobInit.initJobsProvider(test.context);
            expect(myProvider).toBe(null);
        });
    });
});
