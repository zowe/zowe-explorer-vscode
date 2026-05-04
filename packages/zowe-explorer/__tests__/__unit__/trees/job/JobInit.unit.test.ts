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
import { JobFSProvider } from "../../../../src/trees/job/JobFSProvider";
import { SettingsConfig } from "../../../../src/configuration/SettingsConfig";
import { ZoweScheme } from "@zowe/zowe-explorer-api";

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

        const jobsProvider: { [key: string]: Mock } = {
            createZoweSchema: vi.fn(),
            createZoweSession: vi.fn(),
            filterPrompt: vi.fn(),
            onDidChangeConfiguration: vi.fn(),
            pollData: vi.fn(),
            pollActiveJobs: vi.fn(),
            filterJobsDialog: vi.fn(),
        };
        const commands: IJestIt[] = [
            {
                name: "zowe.jobs.deleteJob",
                parm: [test.value, test._],
                mock: [{ spy: vi.spyOn(JobActions, "deleteCommand"), arg: [jobsProvider, test.value, test._] }],
            },
            {
                name: "zowe.jobs.runModifyCommand",
                mock: [{ spy: vi.spyOn(JobActions, "modifyCommand"), arg: [test.value] }],
            },
            {
                name: "zowe.jobs.runStopCommand",
                mock: [{ spy: vi.spyOn(JobActions, "stopCommand"), arg: [test.value] }],
            },
            {
                name: "zowe.jobs.refreshJobsServer",
                mock: [{ spy: vi.spyOn(JobActions, "refreshJob"), arg: [test.value, jobsProvider] }],
            },
            {
                name: "zowe.jobs.refreshAllJobs",
                mock: [{ spy: vi.spyOn(SharedActions, "refreshAll"), arg: [] }],
            },
            {
                name: "zowe.jobs.refresh",
                mock: [{ spy: vi.spyOn(SharedActions, "refreshProvider"), arg: [jobsProvider] }],
            },
            {
                name: "zowe.jobs.refreshJob",
                parm: [{ mParent: test.value }],
                mock: [{ spy: vi.spyOn(JobActions, "refreshJob"), arg: [test.value, jobsProvider] }],
            },
            {
                name: "zowe.jobs.downloadSingleSpool",
                mock: [{ spy: vi.spyOn(JobActions, "downloadSingleSpool"), arg: [[test.value], false] }],
            },
            {
                name: "zowe.jobs.downloadSingleSpoolBinary",
                mock: [{ spy: vi.spyOn(JobActions, "downloadSingleSpool"), arg: [[test.value], true] }],
            },
            {
                name: "zowe.jobs.addJobsSession",
                mock: [{ spy: vi.spyOn(jobsProvider, "createZoweSession"), arg: [jobsProvider] }],
            },
            {
                name: "zowe.jobs.setOwner",
                mock: [{ spy: vi.spyOn(JobActions, "setOwner"), arg: [test.value, jobsProvider] }],
            },
            {
                name: "zowe.jobs.setPrefix",
                mock: [{ spy: vi.spyOn(JobActions, "setPrefix"), arg: [test.value, jobsProvider] }],
            },
            {
                name: "zowe.jobs.downloadSpool",
                mock: [{ spy: vi.spyOn(JobActions, "downloadSpool"), arg: [[test.value], false] }],
            },
            {
                name: "zowe.jobs.downloadSpoolBinary",
                mock: [{ spy: vi.spyOn(JobActions, "downloadSpool"), arg: [[test.value], true] }],
            },
            {
                name: "zowe.jobs.getJobJcl",
                mock: [
                    { spy: vi.spyOn(SharedContext, "isJob"), arg: [test.value], ret: true },
                    { spy: vi.spyOn(JobActions, "downloadJcl"), arg: [test.value] },
                ],
            },
            {
                name: "zowe.jobs.setJobSpool",
                parm: [test._, test.value],
                mock: [{ spy: vi.spyOn(JobActions, "focusOnJob"), arg: [jobsProvider, test._, test.value] }],
            },
            {
                name: "zowe.jobs.search",
                mock: [{ spy: vi.spyOn(jobsProvider, "filterPrompt"), arg: [test.value] }],
            },
            {
                name: "onDidChangeConfiguration",
                mock: [{ spy: vi.spyOn(jobsProvider, "onDidChangeConfiguration"), arg: [test.value] }],
            },
            {
                name: "zowe.jobs.startPolling",
                mock: [{ spy: vi.spyOn(jobsProvider, "pollData"), arg: [test.value] }],
            },
            {
                name: "zowe.jobs.stopPolling",
                mock: [{ spy: vi.spyOn(jobsProvider, "pollData"), arg: [test.value] }],
            },
            {
                name: "zowe.jobs.startPollingActiveJobs",
                mock: [{ spy: vi.spyOn(jobsProvider, "pollActiveJobs"), arg: [test.value] }],
            },
            {
                name: "zowe.jobs.stopPollingActiveJobs",
                mock: [{ spy: vi.spyOn(jobsProvider, "pollActiveJobs"), arg: [test.value] }],
            },
            {
                name: "zowe.jobs.cancelJob",
                mock: [{ spy: vi.spyOn(JobActions, "cancelJobs"), arg: [jobsProvider, [exampleData.job]] }],
                parm: [exampleData.job],
            },
            {
                name: "zowe.jobs.filterJobs",
                mock: [{ spy: vi.spyOn(jobsProvider, "filterJobsDialog"), arg: [test.value] }],
            },
            {
                name: "zowe.jobs.tableView",
                mock: [{ spy: vi.spyOn(JobTableView, "handleCommand"), arg: [test.context, test.value, undefined] }],
            },
            {
                name: "zowe.jobs.loadMoreRecords",
                mock: [{ spy: vi.spyOn(JobFSProvider.instance, "fetchSpoolAtUri"), arg: [{ scheme: ZoweScheme.Jobs }, undefined] }],
                parm: [{ scheme: ZoweScheme.Jobs }],
            },
        ];

        beforeAll(async () => {
            registerCommand = (cmd: string, fun: () => void) => {
                return { [cmd]: fun };
            };
            onDidChangeConfiguration = (fun: () => void) => {
                return { onDidChangeConfiguration: fun };
            };
            spyCreateJobsTree = vi.spyOn(JobInit, "createJobsTree");
            vi.spyOn(SharedInit, "initSubscribers").mockImplementation(vi.fn());
            Object.defineProperty(vscode.commands, "registerCommand", { value: registerCommand });
            Object.defineProperty(vscode.workspace, "onDidChangeConfiguration", { value: onDidChangeConfiguration });
            Object.defineProperty(vscode.window, "showWarningMessage", { value: onDidChangeConfiguration });
            Object.defineProperty(ZoweLogger, "trace", { value: vi.fn(), configurable: true });
            Object.defineProperty(ZoweLocalStorage, "globalState", {
                value: {
                    get: () => ({ persistence: true, favorites: [], history: [], sessions: ["zosmf"], searchHistory: [], fileHistory: [] }),
                    update: vi.fn(),
                    keys: () => [],
                },
                configurable: true,
            });

            vi.spyOn(SettingsConfig, "getDirectValue").mockImplementation((key: string) => {
                if (key === "zowe.jobs.paginate.enabled") {
                    return true;
                }
                if (key === "zowe.jobs.paginate.recordsToFetch") {
                    return 20;
                }
            });

            spyCreateJobsTree.mockResolvedValue(jobsProvider as any);
            await JobInit.initJobsProvider(test.context);
        });
        beforeEach(() => {
            spyCreateJobsTree.mockResolvedValue(jobsProvider as any);
        });
        afterAll(() => {
            vi.restoreAllMocks();
        });

        processSubscriptions(commands, test);

        it("should not initialize if it is unable to create the jobs tree", async () => {
            spyCreateJobsTree.mockResolvedValue(null);
            const myProvider = await JobInit.initJobsProvider(test.context);
            expect(myProvider).toBe(null);
        });
    });
});
