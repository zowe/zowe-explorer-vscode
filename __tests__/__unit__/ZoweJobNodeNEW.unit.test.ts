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

import { createJobsTree } from "../../src/job/ZosJobsProvider";
import * as vscode from "vscode";
import * as zowe from "@zowe/cli";
import { Logger } from "@zowe/imperative";
import { createIJobFile, createIJobObject } from "../../__mocks__/mockCreators/jobs";
import { Job } from "../../src/job/ZoweJobNode";
import { Profiles } from "../../src/Profiles";
import { createIProfile, createISession, createInstanceOfProfile } from "../../__mocks__/mockCreators/shared";
import { ZosmfSession } from "@zowe/cli";

async function createGlobalMocks() {
    const globalMocks = {
        getConfiguration: jest.fn(),
        mockGetJobs: jest.fn(),
        mockGetJob: jest.fn(),
        mockRefresh: jest.fn(),
        mockAffectsConfig: jest.fn(),
        createTreeView: jest.fn(),
        mockCreateBasicZosmfSession: jest.fn(),
        mockGetSpoolFiles: jest.fn(),
        mockGetJobsByOwnerAndPrefix: jest.fn(),
        mockLoadNamedProfile: jest.fn(),
        mockLoadDefaultProfile: jest.fn(),
        testJobsProvider: null,
        testSession: createISession(),
        testProfile: createIProfile(),
        testIJob: createIJobObject(),
        testIJobComplete: createIJobObject(),
        testJobNode: null,
        mockIJobFile: createIJobFile(),
        mockProfileInstance: null,
        withProgress: jest.fn().mockImplementation((progLocation, callback) => {
            return callback();
        }),
        ProgressLocation: jest.fn().mockImplementation(() => {
            return {
                Notification: 15
            };
        }),
        enums: jest.fn().mockImplementation(() => {
            return {
                Global: 1,
                Workspace: 2,
                WorkspaceFolder: 3
            };
        })
    }

    Object.defineProperty(vscode, "ProgressLocation", { value: globalMocks.ProgressLocation, configurable: true });
    Object.defineProperty(vscode.window, "withProgress", { value: globalMocks.withProgress, configurable: true });
    Object.defineProperty(zowe, "GetJobs", { value: globalMocks.mockGetJobs, configurable: true });
    Object.defineProperty(globalMocks.mockGetJobs, "getJob", { value: globalMocks.mockGetJob });
    Object.defineProperty(globalMocks.mockGetJobs, "getJobsByOwnerAndPrefix", { value: globalMocks.mockGetJobsByOwnerAndPrefix, configurable: true });
    Object.defineProperty(ZosmfSession, "createBasicZosmfSession", { value: globalMocks.mockCreateBasicZosmfSession });
    Object.defineProperty(globalMocks.mockGetJobs, "getSpoolFiles", { value: globalMocks.mockGetSpoolFiles, configurable: true });
    Object.defineProperty(vscode.window, "createTreeView", { value: globalMocks.createTreeView, configurable: true });
    Object.defineProperty(vscode, "ConfigurationTarget", { value: globalMocks.enums, configurable: true });
    Object.defineProperty(vscode.workspace, "getConfiguration", { value: globalMocks.getConfiguration, configurable: true });
    Object.defineProperty(Profiles, "getInstance", { value: jest.fn(() => { return globalMocks.mockProfileInstance }), configurable: true });

    globalMocks.mockCreateBasicZosmfSession.mockReturnValue(globalMocks.testSession);

    globalMocks.mockProfileInstance = createInstanceOfProfile(globalMocks.testProfile);
    globalMocks.mockGetSpoolFiles.mockReturnValue([globalMocks.mockIJobFile]);
    globalMocks.mockLoadNamedProfile.mockReturnValue(globalMocks.testProfile);
    globalMocks.mockProfileInstance.loadNamedProfile = globalMocks.mockLoadNamedProfile;
    globalMocks.mockLoadDefaultProfile.mockReturnValue(globalMocks.testProfile);
    globalMocks.mockProfileInstance.getDefaultProfile = globalMocks.mockLoadDefaultProfile;

    globalMocks.createTreeView.mockReturnValue("testTreeView");
    globalMocks.mockGetJob.mockReturnValue(globalMocks.testIJob);
    globalMocks.mockGetJobsByOwnerAndPrefix.mockReturnValue([globalMocks.testIJob, globalMocks.testIJobComplete]);
    globalMocks.getConfiguration.mockReturnValue({
        get: (setting: string) => [
            "[test]: /u/aDir{directory}",
            "[test]: /u/myFile.txt{textFile}",
        ],
        update: jest.fn(() => {
            return {};
        })
    });
    globalMocks.mockProfileInstance.editSession = jest.fn(() => {
        return globalMocks.testProfile;
    }),
    globalMocks.testJobNode = new Job("jobtest", vscode.TreeItemCollapsibleState.Expanded, null, globalMocks.testSession, globalMocks.testIJob, globalMocks.testProfile);
    globalMocks.testJobNode.contextValue = "job";
    globalMocks.testJobNode.dirty = true;
    globalMocks.testIJobComplete.jobid = "JOB1235";
    globalMocks.testIJobComplete.retcode = "0";
    globalMocks.testJobsProvider = await createJobsTree(Logger.getAppLogger());
    Object.defineProperty(globalMocks.testJobsProvider, "refresh", { value: globalMocks.mockRefresh, configurable: true });
    // Reset getConfiguration because we called it when testJobsProvider was assigned
    globalMocks.getConfiguration.mockClear();

    return globalMocks;
}

describe("ZoweJobNode unit tests - Function createJobsTree", () => {
    it("Tests that createJobsTree is executed successfully", async () => {
        const globalMocks = await createGlobalMocks();

        const newJobsProvider = await createJobsTree(Logger.getAppLogger());
        const newProviderKeys = JSON.stringify(Object.keys(newJobsProvider).sort());
        const testProviderKeys = JSON.stringify(Object.keys(globalMocks.testJobsProvider).sort());

        expect(newProviderKeys).toEqual(testProviderKeys);
    })
});

describe("ZoweJobNode unit tests - Function addSession", () => {
    it("Tests that addSession adds the session to the tree", async () => {
        const globalMocks = await createGlobalMocks();

        globalMocks.testJobsProvider.mSessionNodes.pop();

        await globalMocks.testJobsProvider.addSession("sestest");

        expect(globalMocks.testJobsProvider.mSessionNodes[1]).toBeDefined();
        expect(globalMocks.testJobsProvider.mSessionNodes[1].label).toEqual("sestest");
        expect(globalMocks.testJobsProvider.mSessionNodes[1].tooltip).toEqual("sestest - owner: fake prefix: *");
    });
});

describe("ZoweJobNode unit tests - Function deleteSession", () => {
    it("Tests that deleteSession removes the session from the tree", async () => {
        const globalMocks = await createGlobalMocks();

        await globalMocks.testJobsProvider.deleteSession(globalMocks.testJobsProvider.mSessionNodes[1]);

        expect(globalMocks.testJobsProvider.mSessionNodes.length).toBe(1);
    });
});

describe("ZoweJobNode unit tests - Function onDidConfiguration", () => {
    it("Tests that onDidConfiguration is executed successfully", async () => {
        const globalMocks = await createGlobalMocks();

        const Event = jest.fn().mockImplementation(() => {
            return {
                affectsConfiguration: globalMocks.mockAffectsConfig
            };
        });
        const e = new Event();
        globalMocks.mockAffectsConfig.mockReturnValue(true);

        await globalMocks.testJobsProvider.onDidChangeConfiguration(e);
        expect(globalMocks.getConfiguration).toHaveBeenCalled();
        expect(globalMocks.getConfiguration).toHaveBeenCalledTimes(2);
    })
});

describe("ZoweJobNode unit tests - Function getChildren", () => {
    it("Tests that getChildren returns the jobs of the session, when called on the session", async () => {
        const globalMocks = await createGlobalMocks();

        await globalMocks.testJobsProvider.addSession("fake");

        const jobs = await globalMocks.testJobsProvider.mSessionNodes[1].getChildren();

        expect(jobs.length).toBe(2);
        expect(jobs[0].job.jobid).toEqual(globalMocks.testIJob.jobid);
        expect(jobs[0].tooltip).toEqual("TESTJOB(JOB1234)");
        expect(jobs[1].job.jobid).toEqual(globalMocks.testIJobComplete.jobid);
        expect(jobs[1].tooltip).toEqual("TESTJOB(JOB1235) - 0");
    });

    it("Tests that getChildren retrieves only child jobs which match a provided searchId", async () => {
        const globalMocks = await createGlobalMocks();

        await globalMocks.testJobsProvider.addSession("fake");
        globalMocks.testJobsProvider.mSessionNodes[1].searchId = "JOB1234";
        globalMocks.testJobsProvider.mSessionNodes[1].dirty = true;

        const jobs = await globalMocks.testJobsProvider.mSessionNodes[1].getChildren();

        expect(jobs.length).toBe(1);
        expect(jobs[0].job.jobid).toEqual(globalMocks.testIJob.jobid);
        expect(jobs[0].tooltip).toEqual("TESTJOB(JOB1234)");
    });

    it("Tests that getChildren returns the spool files if called on a job", async () => {
        const globalMocks = await createGlobalMocks();

        const spoolFiles = await globalMocks.testJobNode.getChildren();
        expect(spoolFiles.length).toBe(1);
        expect(spoolFiles[0].label).toEqual("STEP:STDOUT(101)");
        expect(spoolFiles[0].owner).toEqual("fake");
    });
});

describe("ZoweJobNode unit tests - Function interpretFreeform", () => {
    it("Tests that interpretFreeform returns the correct string interpretations", async () => {
        const globalMocks = await createGlobalMocks();

        expect(globalMocks.testJobsProvider.interpretFreeform("STC01234")).toEqual("JobId:STC01234");
        expect(globalMocks.testJobsProvider.interpretFreeform("job STC01234")).toEqual("JobId:STC01234");
        expect(globalMocks.testJobsProvider.interpretFreeform("STC01234 JOB")).toEqual("JobId:STC01234");
        expect(globalMocks.testJobsProvider.interpretFreeform("JOB12345")).toEqual("JobId:JOB12345");
        expect(globalMocks.testJobsProvider.interpretFreeform("JOB0123456")).toEqual("JobId:JOB01234");
        expect(globalMocks.testJobsProvider.interpretFreeform("JOB012345N")).toEqual("JobId:JOB01234");
        // We interpret this as an owner prefix as the value is invalid as a job
        expect(globalMocks.testJobsProvider.interpretFreeform("JOB0X25N")).toEqual("Owner:JOB0X25N");
        expect(globalMocks.testJobsProvider.interpretFreeform("MYHLQ*")).toEqual("Owner:MYHLQ*");
        expect(globalMocks.testJobsProvider.interpretFreeform("Owner: MYHLQ pRefix: STYYY*")).toEqual("Owner:MYHLQ Prefix:STYYY*");
        expect(globalMocks.testJobsProvider.interpretFreeform("jobid: JOB0X25N")).toEqual("JobId:JOB0X25N");
        expect(globalMocks.testJobsProvider.interpretFreeform("MYHLQ")).toEqual("Owner:MYHLQ");
        // Although Job ID is invalid the user is explicit
        expect(globalMocks.testJobsProvider.interpretFreeform("MYHLQ* myJobname")).toEqual("Owner:MYHLQ* Prefix:myJobname");
        expect(globalMocks.testJobsProvider.interpretFreeform("MYHLQ* myJob")).toEqual("Owner:MYHLQ* Prefix:myJob");
        expect(globalMocks.testJobsProvider.interpretFreeform("MYHLQ* myJob*")).toEqual("Owner:MYHLQ* Prefix:myJob*");
        expect(globalMocks.testJobsProvider.interpretFreeform("* * STC01234")).toEqual("JobId:STC01234");
    });
});

describe("ZoweJobNode unit tests - Function flipState", () => {
    it("Tests that flipState is executed successfully", async () => {
        const globalMocks = await createGlobalMocks();
        globalMocks.testJobsProvider.addSession("fake");

        await globalMocks.testJobsProvider.flipState(globalMocks.testJobsProvider.mSessionNodes[1], true);
        expect(JSON.stringify(globalMocks.testJobsProvider.mSessionNodes[1].iconPath)).toContain("folder-root-default-open.svg");
        await globalMocks.testJobsProvider.flipState(globalMocks.testJobsProvider.mSessionNodes[1], false);
        expect(JSON.stringify(globalMocks.testJobsProvider.mSessionNodes[1].iconPath)).toContain("folder-root-default-closed.svg");
        await globalMocks.testJobsProvider.flipState(globalMocks.testJobsProvider.mSessionNodes[1], true);
        expect(JSON.stringify(globalMocks.testJobsProvider.mSessionNodes[1].iconPath)).toContain("folder-root-default-open.svg");

        await globalMocks.testJobsProvider.flipState(globalMocks.testJobNode, true);
        expect(JSON.stringify(globalMocks.testJobNode.iconPath)).toContain("folder-open.svg");
        await globalMocks.testJobsProvider.flipState(globalMocks.testJobNode, false);
        expect(JSON.stringify(globalMocks.testJobNode.iconPath)).toContain("folder-closed.svg");
        await globalMocks.testJobsProvider.flipState(globalMocks.testJobNode, true);
        expect(JSON.stringify(globalMocks.testJobNode.iconPath)).toContain("folder-open.svg");
    });
});

describe("ZoweJobNode unit tests - Function addFavorite", () => {
    async function createBlockMocks(globalMocks) {
        let newMocks = {
            testJobNode: new Job("MYHLQ(JOB1283) - Input", vscode.TreeItemCollapsibleState.Collapsed, globalMocks.testJobsProvider.mSessionNodes[1],
                                 globalMocks.testJobsProvider.mSessionNodes[1].getSession(), globalMocks.testIJob, globalMocks.testProfile)
        }

        return newMocks;
    }

    it("Tests that addFavorite successfully favorites a job", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.testJobsProvider.mFavorites = [];

        await globalMocks.testJobsProvider.addFavorite(blockMocks.testJobNode);

        expect(globalMocks.testJobsProvider.mFavorites.length).toEqual(1);
        expect(globalMocks.testJobsProvider.mFavorites[0].label).toEqual("[sestest]: MYHLQ(JOB1283)");
    });
});

describe("ZoweJobNode unit tests - Function removeFavorite", () => {
    async function createBlockMocks(globalMocks) {
        let newMocks = {
            testJobNode: new Job("MYHLQ(JOB1283) - Input", vscode.TreeItemCollapsibleState.Collapsed, globalMocks.testJobsProvider.mSessionNodes[1],
                                 globalMocks.testJobsProvider.mSessionNodes[1].getSession(), globalMocks.testIJob, globalMocks.testProfile)
        }

        return newMocks;
    }

    it("Tests that removeFavorite successfully removes a favorited job", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.testJobsProvider.mFavorites = [];

        await globalMocks.testJobsProvider.addFavorite(blockMocks.testJobNode);

        expect(globalMocks.testJobsProvider.mFavorites.length).toEqual(1);

        await globalMocks.testJobsProvider.removeFavorite(globalMocks.testJobsProvider.mFavorites[0]);

        expect(globalMocks.testJobsProvider.mFavorites.length).toEqual(0);
    });
});

describe("ZoweJobNode unit tests - Function saveSearch", () => {
    async function createBlockMocks(globalMocks) {
        let newMocks = {
            testJobNode: new Job("MYHLQ(JOB1283) - Input", vscode.TreeItemCollapsibleState.Collapsed, globalMocks.testJobsProvider.mSessionNodes[1],
                                 globalMocks.testJobsProvider.mSessionNodes[1].getSession(), globalMocks.testIJob, globalMocks.testProfile)
        }

        globalMocks.testJobsProvider.mFavorites = [];
        globalMocks.testJobNode.label = "MYHLQ(JOB1283) - Input";
        globalMocks.getConfiguration.mockReturnValue({
            get: (setting: string) => [
                "[sestest]: Owner:stonecc Prefix:*{server}",
                "[sestest]: USER1(JOB30148){job}",
            ],
            update: jest.fn(()=>{
                return {};
            })
        });

        return newMocks;
    }

    it("Tests that saveSearch is executed successfully when owner is set", async () => {
        const globalMocks = await createGlobalMocks();
        await createBlockMocks(globalMocks);

        globalMocks.testJobsProvider.mSessionNodes[1].owner = "myHLQ";
        globalMocks.testJobsProvider.mSessionNodes[1].prefix = "*";

        await globalMocks.testJobsProvider.saveSearch(globalMocks.testJobsProvider.mSessionNodes[1]);

        expect(globalMocks.testJobsProvider.mFavorites.length).toEqual(1);
        expect(globalMocks.testJobsProvider.mFavorites[0].label).toEqual("[sestest]: Owner:myHLQ Prefix:*");
    });

    it("Tests that saveSearch is executed successfully when prefix is set", async () => {
        const globalMocks = await createGlobalMocks();
        await createBlockMocks(globalMocks);

        globalMocks.testJobsProvider.mSessionNodes[1].owner = "*";
        globalMocks.testJobsProvider.mSessionNodes[1].prefix = "aH*";

        await globalMocks.testJobsProvider.saveSearch(globalMocks.testJobsProvider.mSessionNodes[1]);

        expect(globalMocks.testJobsProvider.mFavorites.length).toEqual(1);
        expect(globalMocks.testJobsProvider.mFavorites[0].label).toEqual("[sestest]: Owner:* Prefix:aH*");
    });

    it("Tests that saveSearch is executed successfully when searchId is set", async () => {
        const globalMocks = await createGlobalMocks();
        await createBlockMocks(globalMocks);

        globalMocks.testJobsProvider.mSessionNodes[1].owner = "*";
        globalMocks.testJobsProvider.mSessionNodes[1].prefix = "*";
        globalMocks.testJobsProvider.mSessionNodes[1].searchId = "JOB1234";

        await globalMocks.testJobsProvider.saveSearch(globalMocks.testJobsProvider.mSessionNodes[1]);

        expect(globalMocks.testJobsProvider.mFavorites.length).toEqual(1);
        expect(globalMocks.testJobsProvider.mFavorites[0].label).toEqual("[sestest]: JobId:JOB1234");
    });
});