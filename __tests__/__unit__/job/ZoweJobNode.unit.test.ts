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

jest.mock("@zowe/cli");
jest.mock("@zowe/imperative");
import { createJobsTree } from "../../../src/job/ZosJobsProvider";
import * as vscode from "vscode";
import * as zowe from "@zowe/cli";
import * as globals from "../../../src/globals";
import * as utils from "../../../src/utils";
import { Logger } from "@zowe/imperative";
import { createIJobFile, createIJobObject, createJobSessionNode } from "../../../__mocks__/mockCreators/jobs";
import { Job } from "../../../src/job/ZoweJobNode";
import { Profiles, ValidProfileEnum } from "../../../src/Profiles";
import { createIProfile, createISession, createInstanceOfProfile, createISessionWithoutCredentials, createQuickPickContent } from "../../../__mocks__/mockCreators/shared";
import { ZoweExplorerApiRegister } from "../../../src/api/ZoweExplorerApiRegister";
import { DefaultProfileManager } from "../../../src/profiles/DefaultProfileManager";
import { IZoweJobTreeNode } from "../../../src/api/IZoweTreeNode";
import * as profileUtils from "../../../src/profiles/utils";

async function createGlobalMocks() {
    const globalMocks = {
        getConfiguration: jest.fn(),
        mockGetJobs: jest.fn(),
        mockGetJob: jest.fn(),
        mockRefresh: jest.fn(),
        mockAffectsConfig: jest.fn(),
        createTreeView: jest.fn(),
        mockCreateBasicZosmfSessionFromArguments: jest.fn(),
        mockGetSpoolFiles: jest.fn(),
        mockDeleteJobs: jest.fn(),
        mockShowInputBox: jest.fn(),
        mockDeleteJob: jest.fn(),
        mockGetJobsByOwnerAndPrefix: jest.fn(),
        mockShowInformationMessage: jest.fn(),
        mockLoadNamedProfile: jest.fn(),
        mockCreateQuickPick: jest.fn(),
        mockLoadDefaultProfile: jest.fn(),
        mockGetJesApi: jest.fn(),
        mockGetCommonApi: jest.fn(),
        mockShowQuickPick: jest.fn(),
        testJobsProvider: null,
        jesApi: null,
        commonApi: null,
        testSession: createISession(),
        testSessionNode: null,
        testSessionNoCred: createISessionWithoutCredentials(),
        testProfile: createIProfile(),
        testIJob: createIJobObject(),
        testIJobComplete: createIJobObject(),
        testJobNode: null,
        mockIJobFile: createIJobFile(),
        mockProfileInstance: null,
        defaultProfileManagerInstance: null,
        defaultProfile: null,
        mockValidationSetting: jest.fn(),
        mockDisableValidationContext: jest.fn(),
        mockEnableValidationContext: jest.fn(),
        mockCheckProfileValidationSetting: jest.fn(),
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
    };

    Object.defineProperty(vscode, "ProgressLocation", { value: globalMocks.ProgressLocation, configurable: true });
    Object.defineProperty(vscode.window, "withProgress", { value: globalMocks.withProgress, configurable: true });
    Object.defineProperty(zowe, "GetJobs", { value: globalMocks.mockGetJobs, configurable: true });
    Object.defineProperty(vscode.window, "showInformationMessage", { value: globalMocks.mockShowInformationMessage, configurable: true });
    Object.defineProperty(globalMocks.mockGetJobs, "getJob", { value: globalMocks.mockGetJob, configurable: true });
    Object.defineProperty(globalMocks.mockGetJobs, "getJobsByOwnerAndPrefix", { value: globalMocks.mockGetJobsByOwnerAndPrefix, configurable: true });
    Object.defineProperty(zowe.ZosmfSession, "createBasicZosmfSessionFromArguments",
                                             { value: globalMocks.mockCreateBasicZosmfSessionFromArguments, configurable: true });
    Object.defineProperty(globalMocks.mockGetJobs, "getSpoolFiles", { value: globalMocks.mockGetSpoolFiles, configurable: true });
    Object.defineProperty(vscode.window, "createTreeView", { value: globalMocks.createTreeView, configurable: true });
    Object.defineProperty(vscode.window, "showQuickPick", { value: globalMocks.mockShowQuickPick, configurable: true });
    Object.defineProperty(vscode, "ConfigurationTarget", { value: globalMocks.enums, configurable: true });
    Object.defineProperty(vscode.window, "showInputBox", { value: globalMocks.mockShowInputBox, configurable: true });
    Object.defineProperty(vscode.workspace, "getConfiguration", { value: globalMocks.getConfiguration, configurable: true });
    Object.defineProperty(Profiles, "getInstance", { value: jest.fn(() => globalMocks.mockProfileInstance), configurable: true });
    Object.defineProperty(zowe, "DeleteJobs", { value: globalMocks.mockDeleteJobs, configurable: true });
    Object.defineProperty(vscode.window, "createQuickPick", { value: globalMocks.mockCreateQuickPick, configurable: true });
    Object.defineProperty(globalMocks.mockDeleteJobs, "deleteJob", { value: globalMocks.mockDeleteJob, configurable: true });

    globalMocks.testSessionNode = createJobSessionNode(globalMocks.testSession, globalMocks.testProfile);
    globalMocks.mockProfileInstance = createInstanceOfProfile(globalMocks.testProfile, globalMocks.testSession);
    globalMocks.mockGetSpoolFiles.mockReturnValue([globalMocks.mockIJobFile]);
    globalMocks.mockLoadNamedProfile.mockReturnValue(globalMocks.testProfile);
    globalMocks.mockProfileInstance.loadNamedProfile = globalMocks.mockLoadNamedProfile;
    globalMocks.mockLoadDefaultProfile.mockReturnValue(globalMocks.testProfile);
    globalMocks.mockProfileInstance.getDefaultProfile = globalMocks.mockLoadDefaultProfile;
    globalMocks.mockProfileInstance.checkProfileValidationSetting = globalMocks.mockValidationSetting.mockReturnValue(true);
    globalMocks.mockProfileInstance.enableValidationContext = globalMocks.mockEnableValidationContext;
    globalMocks.mockProfileInstance.disableValidationContext = globalMocks.mockDisableValidationContext;

    // Profile instance mocks
    globalMocks.defaultProfileManagerInstance = await DefaultProfileManager.createInstance(Logger.getAppLogger());
    await Profiles.createInstance(Logger.getAppLogger());
    globalMocks.defaultProfile = DefaultProfileManager.getInstance().getDefaultProfile("zosmf");
    Object.defineProperty(DefaultProfileManager,
                          "getInstance",
                          { value: jest.fn(() => globalMocks.defaultProfileManagerInstance), configurable: true });
    Object.defineProperty(globalMocks.defaultProfileManagerInstance,
                          "getDefaultProfile",
                          { value: jest.fn(() => globalMocks.defaultProfile), configurable: true });

    // Jes API mocks
    globalMocks.jesApi = ZoweExplorerApiRegister.getJesApi(globalMocks.testProfile);
    globalMocks.mockGetJesApi.mockReturnValue(globalMocks.jesApi);
    ZoweExplorerApiRegister.getJesApi = globalMocks.mockGetJesApi.bind(ZoweExplorerApiRegister);
    Object.defineProperty(globalMocks.jesApi, "getSession", {
        value: jest.fn(() => {
            return globalMocks.testSession;
        }),
        configurable: true
    });

    // Common API mocks
    globalMocks.commonApi = ZoweExplorerApiRegister.getCommonApi(globalMocks.testProfile);
    globalMocks.mockGetCommonApi.mockReturnValue(globalMocks.commonApi);
    ZoweExplorerApiRegister.getCommonApi = globalMocks.mockGetCommonApi.bind(ZoweExplorerApiRegister);
    Object.defineProperty(globalMocks.commonApi, "getSession", {
        value: jest.fn(() => {
            return globalMocks.testSession;
        }),
        configurable: true
    });

    globalMocks.mockCreateBasicZosmfSessionFromArguments.mockReturnValue(globalMocks.testSession);
    globalMocks.createTreeView.mockReturnValue("testTreeView");
    globalMocks.mockGetJob.mockReturnValue(globalMocks.testIJob);
    globalMocks.mockGetJobsByOwnerAndPrefix.mockReturnValue([globalMocks.testIJob, globalMocks.testIJobComplete]);
    globalMocks.mockProfileInstance.editSession = jest.fn(() => globalMocks.testProfile);
    globalMocks.testJobNode = new Job("jobtest", vscode.TreeItemCollapsibleState.Expanded,
                                      null, globalMocks.testSession, globalMocks.testIJob, globalMocks.testProfile);
    globalMocks.testJobNode.contextValue = "job";
    globalMocks.testJobNode.dirty = true;
    globalMocks.testIJobComplete.jobid = "JOB1235";
    globalMocks.testIJobComplete.retcode = "0";
    globalMocks.getConfiguration.mockReturnValue({
        get: (setting: string) => [
            "[test]: /u/aDir{directory}",
            "[test]: /u/myFile.txt{textFile}",
        ],
        update: jest.fn(() => {
            return {};
        })
    });
    globalMocks.testJobsProvider = await createJobsTree(Logger.getAppLogger());
    const i = globalMocks.testJobsProvider.mSessionNodes.findIndex((node) => node.label === "sestest");
    globalMocks.testJobsProvider.mSessionNodes[i] = globalMocks.testSessionNode;
    Object.defineProperty(globalMocks.testJobsProvider, "refresh", { value: globalMocks.mockRefresh, configurable: true });
    Object.defineProperty(profileUtils, "getValidSession", { value: jest.fn(() => globalMocks.testSession), configurable: true });

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
    });
});

describe("ZoweJobNode unit tests - Function hideSession", () => {
    it("Tests that hideSession removes the session from the tree", async () => {
        const globalMocks = await createGlobalMocks();

        await globalMocks.testJobsProvider.hideSession(globalMocks.testJobsProvider.mSessionNodes[1]);

        expect(globalMocks.testJobsProvider.mSessionNodes.length).toBe(1);
    });
});

describe("ZoweJobNode unit tests - Function delete", () => {
    it("Tests that delete informs the user that a job was deleted", async () => {
        const globalMocks = await createGlobalMocks();

        await globalMocks.testJobsProvider.delete(globalMocks.testJobNode);
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toEqual(
            `Job ${globalMocks.testJobNode.job.jobname}(${globalMocks.testJobNode.job.jobid}) deleted`
        );
    });
    it("Tests that delete handles an error thrown during job deletion", async () => {
        const globalMocks = await createGlobalMocks();
        const badJobNode = new Job("badJobNode",vscode.TreeItemCollapsibleState.Collapsed, null,
            globalMocks.testSession, null, globalMocks.testProfile);
        const errorHandlingSpy = jest.spyOn(utils, "errorHandling");

        await globalMocks.testJobsProvider.delete(badJobNode);

        expect(errorHandlingSpy).toBeCalledTimes(1);
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
    });
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
        globalMocks.testJobsProvider.mSessionNodes[1].contextValue = globals.JOBS_SESSION_CONTEXT;
        globalMocks.mockCreateBasicZosmfSessionFromArguments.mockReturnValue(globalMocks.testSession);

        await globalMocks.testJobsProvider.flipState(globalMocks.testJobsProvider.mSessionNodes[1], true);
        expect(JSON.stringify(globalMocks.testJobsProvider.mSessionNodes[1].iconPath)).toContain("folder-root-unverified-closed.svg");
        await globalMocks.testJobsProvider.flipState(globalMocks.testJobsProvider.mSessionNodes[1], false);
        expect(JSON.stringify(globalMocks.testJobsProvider.mSessionNodes[1].iconPath)).toContain("folder-root-unverified-closed.svg");
        await globalMocks.testJobsProvider.flipState(globalMocks.testJobsProvider.mSessionNodes[1], true);
        expect(JSON.stringify(globalMocks.testJobsProvider.mSessionNodes[1].iconPath)).toContain("folder-root-unverified-closed.svg");

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
        const newMocks = {
            testJobNode: new Job("MYHLQ(JOB1283) - Input", vscode.TreeItemCollapsibleState.Collapsed, globalMocks.testJobsProvider.mSessionNodes[1],
                                 globalMocks.testJobsProvider.mSessionNodes[1].getSession(), globalMocks.testIJob, globalMocks.testProfile)
        };

        return newMocks;
    }

    it("Tests that addFavorite successfully favorites a job", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        globalMocks.testJobsProvider.mFavorites = [];
        blockMocks.testJobNode.contextValue = globals.JOBS_JOB_CONTEXT;

        await globalMocks.testJobsProvider.addFavorite(blockMocks.testJobNode);

        const profileNodeInFavs: IZoweJobTreeNode = globalMocks.testJobsProvider.mFavorites[0];
        const favoritedNode = profileNodeInFavs.children[0];

        expect(globalMocks.testJobsProvider.mFavorites.length).toEqual(1);
        expect(profileNodeInFavs.label).toEqual("sestest");
        expect(profileNodeInFavs.children.length).toEqual(1);
        expect(favoritedNode.label).toEqual("MYHLQ(JOB1283)");
        expect(favoritedNode.contextValue).toEqual(globals.JOBS_JOB_CONTEXT + globals.FAV_SUFFIX);
    });
    it("Tests that addFavorite successfully favorites a search", async () => {
        const globalMocks = await createGlobalMocks();
        await createBlockMocks(globalMocks);
        globalMocks.testJobsProvider.mFavorites = [];
        globalMocks.testJobsProvider.mSessionNodes[1].owner = "myHLQ";
        globalMocks.testJobsProvider.mSessionNodes[1].prefix = "*";
        globalMocks.testJobsProvider.mSessionNodes[1].contextValue = globals.JOBS_SESSION_CONTEXT;

        await globalMocks.testJobsProvider.addFavorite(globalMocks.testJobsProvider.mSessionNodes[1]);
        const profileNodeInFavs: IZoweJobTreeNode = globalMocks.testJobsProvider.mFavorites[0];

        expect(profileNodeInFavs.children.length).toEqual(1);
        expect(profileNodeInFavs.children[0].label).toEqual("Owner:myHLQ Prefix:*");
        expect(profileNodeInFavs.children[0].contextValue).toEqual(globals.JOBS_SESSION_CONTEXT + globals.FAV_SUFFIX);
    });
});

describe("ZoweJobNode unit tests - Function removeFavorite", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            testJobNode: new Job("MYHLQ(JOB1283) - Input", vscode.TreeItemCollapsibleState.Collapsed, globalMocks.testJobsProvider.mSessionNodes[1],
                                 globalMocks.testJobsProvider.mSessionNodes[1].getSession(), globalMocks.testIJob, globalMocks.testProfile)
        };

        return newMocks;
    }

    it("Tests that removeFavorite successfully removes a favorited job", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.testJobsProvider.mFavorites = [];

        await globalMocks.testJobsProvider.addFavorite(blockMocks.testJobNode);
        const profileNodeInFavs: IZoweJobTreeNode = globalMocks.testJobsProvider.mFavorites[0];
        const favoritedNode = profileNodeInFavs.children[0];

        expect(profileNodeInFavs.children.length).toEqual(1);

        await globalMocks.testJobsProvider.removeFavorite(favoritedNode);

        expect(profileNodeInFavs.children.length).toEqual(0);
    });
});

describe("ZoweJobNode unit tests - Function saveSearch", () => {
    async function createBlockMocks(globalMocks) {
        const testSession = globalMocks.testJobsProvider.mSessionNodes[1].getSession();
        const newMocks = {
            testSession,
            testJobNode: new Job("MYHLQ(JOB1283) - Input", vscode.TreeItemCollapsibleState.Collapsed, globalMocks.testJobsProvider.mSessionNodes[1],
                                 testSession, globalMocks.testIJob, globalMocks.testProfile)
        };

        globalMocks.testJobsProvider.mFavorites = [];
        globalMocks.testJobNode.label = "MYHLQ(JOB1283) - Input";

        return newMocks;
    }

    it("Tests that saveSearch is executed successfully", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const favJob = blockMocks.testJobNode;
        favJob.owner = "myHLQ";
        favJob.prefix = "*";
        favJob.contextValue = globals.JOBS_SESSION_CONTEXT;

        const expectedJob = favJob;
        expectedJob.contextValue = globals.JOBS_SESSION_CONTEXT + globals.FAV_SUFFIX;

        const savedFavJob = await globalMocks.testJobsProvider.saveSearch(favJob);

        expect(savedFavJob).toEqual(expectedJob);
    });
});

describe("ZoweJobNode unit tests - Function filterPrompt", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            testJobNodeNoCred: new Job("jobtest", vscode.TreeItemCollapsibleState.Expanded, globalMocks.jobNode,
                                       globalMocks.testSession, globalMocks.testIJob, globalMocks.testProfile),
            qpItem: globalMocks.testJobsProvider.createOwner,
            theia: false,
            mockCheckCurrentProfile: jest.fn(),
            qpContent: createQuickPickContent("", [globalMocks.testJobsProvider.createOwner, globalMocks.testJobsProvider.createId],
                                              "Select a filter")
        };

        newMocks.testJobNodeNoCred.contextValue = globals.JOBS_SESSION_CONTEXT;
        globalMocks.testJobsProvider.initializeJobsTree(Logger.getAppLogger());
        globalMocks.mockCreateBasicZosmfSessionFromArguments.mockReturnValue(globalMocks.testSessionNoCred);
        globalMocks.mockCreateQuickPick.mockReturnValue(newMocks.qpContent);
        Object.defineProperty(globals, "ISTHEIA", { get: () => newMocks.theia });
        jest.spyOn(utils, "resolveQuickPickHelper").mockImplementation(
            () => Promise.resolve(newMocks.qpItem)
        );

        return newMocks;
    }

    it("Testing that prompt credentials is called when filterPrompt is triggered", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.mockShowInputBox.mockReturnValueOnce("MYHLQ");
        globalMocks.mockShowInputBox.mockReturnValueOnce("");
        globalMocks.mockShowInputBox.mockReturnValueOnce("");

        await globalMocks.testJobsProvider.filterPrompt(blockMocks.testJobNodeNoCred);

        expect(blockMocks.testJobNodeNoCred.contextValue).toEqual(globals.JOBS_SESSION_CONTEXT + "_Active");
        expect(blockMocks.testJobNodeNoCred.owner).toEqual("MYHLQ");
        expect(blockMocks.testJobNodeNoCred.prefix).toEqual("*");
        expect(blockMocks.testJobNodeNoCred.searchId).toEqual("");
    });

    it("Testing filterPrompt is successfully canceled when user enters no credentials", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.mockShowInputBox.mockReturnValueOnce(undefined);

        await globalMocks.testJobsProvider.filterPrompt(blockMocks.testJobNodeNoCred);

        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Search Cancelled");
    });

    it("Testing that prompt credentials is called when filterPrompt is triggered for fav", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.testJobNodeNoCred.label = "[sestest]: Owner:fakeUser Prefix:*";
        blockMocks.testJobNodeNoCred.contextValue = globals.JOBS_SESSION_CONTEXT + globals.FAV_SUFFIX;
        globalMocks.mockShowInputBox.mockReturnValueOnce("MYHLQ");
        globalMocks.mockShowInputBox.mockReturnValueOnce("");
        globalMocks.mockShowInputBox.mockReturnValueOnce("");

        await globalMocks.testJobsProvider.filterPrompt(blockMocks.testJobNodeNoCred);

        expect(Profiles.getInstance().validProfile).toBe(ValidProfileEnum.VALID);
    });

    it("Testing that filterPrompt is successfully executed when searching by owner, VSCode route", async () => {
        const globalMocks = await createGlobalMocks();
        await createBlockMocks(globalMocks);

        globalMocks.mockShowInputBox.mockReturnValueOnce("MYHLQ");
        globalMocks.mockShowInputBox.mockReturnValueOnce("");
        globalMocks.mockShowInputBox.mockReturnValueOnce(""); // need the jobId in this case

        await globalMocks.testJobsProvider.filterPrompt(globalMocks.testJobsProvider.mSessionNodes[1]);

        expect(globalMocks.testJobsProvider.mSessionNodes[1].contextValue).toEqual(globals.JOBS_SESSION_CONTEXT + "_Active");
        expect(globalMocks.testJobsProvider.mSessionNodes[1].owner).toEqual("MYHLQ");
        expect(globalMocks.testJobsProvider.mSessionNodes[1].prefix).toEqual("*");
        expect(globalMocks.testJobsProvider.mSessionNodes[1].searchId).toEqual("");
    });

    it("Testing that filterPrompt is successfully executed when searching by prefix, VSCode route", async () => {
        const globalMocks = await createGlobalMocks();
        await createBlockMocks(globalMocks);

        globalMocks.mockShowInputBox.mockReturnValueOnce("");
        globalMocks.mockShowInputBox.mockReturnValueOnce("STO*");

        await globalMocks.testJobsProvider.filterPrompt(globalMocks.testJobsProvider.mSessionNodes[1]);

        expect(globalMocks.testJobsProvider.mSessionNodes[1].contextValue).toEqual(globals.JOBS_SESSION_CONTEXT + "_Active");
        expect(globalMocks.testJobsProvider.mSessionNodes[1].owner).toEqual("*");
        expect(globalMocks.testJobsProvider.mSessionNodes[1].prefix).toEqual("STO*");
        expect(globalMocks.testJobsProvider.mSessionNodes[1].searchId).toEqual("");
    });

    it("Testing that filterPrompt is successfully executed when searching by prefix, VSCode route with Unverified profile", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        await createBlockMocks(globalMocks);

        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    checkCurrentProfile: blockMocks.mockCheckCurrentProfile.mockReturnValueOnce({name: globalMocks.testProfile.name, status: "unverified"}),
                    validProfile: ValidProfileEnum.UNVERIFIED
                };
            })
        });

        globalMocks.mockShowInputBox.mockReturnValueOnce("");
        globalMocks.mockShowInputBox.mockReturnValueOnce("STO*");

        await globalMocks.testJobsProvider.filterPrompt(globalMocks.testJobsProvider.mSessionNodes[1]);

        expect(globalMocks.testJobsProvider.mSessionNodes[1].contextValue).toEqual(globals.JOBS_SESSION_CONTEXT + "_Unverified");
        expect(globalMocks.testJobsProvider.mSessionNodes[1].owner).toEqual("*");
        expect(globalMocks.testJobsProvider.mSessionNodes[1].prefix).toEqual("STO*");
        expect(globalMocks.testJobsProvider.mSessionNodes[1].searchId).toEqual("");
    });

    it("Testing that filterPrompt is successfully executed when searching by owner & prefix, VSCode route", async () => {
        const globalMocks = await createGlobalMocks();
        await createBlockMocks(globalMocks);

        globalMocks.mockShowInputBox.mockReturnValueOnce("MYHLQ");
        globalMocks.mockShowInputBox.mockReturnValueOnce("STO*");

        await globalMocks.testJobsProvider.filterPrompt(globalMocks.testJobsProvider.mSessionNodes[1]);

        expect(globalMocks.testJobsProvider.mSessionNodes[1].contextValue).toEqual(globals.JOBS_SESSION_CONTEXT + "_Active");
        expect(globalMocks.testJobsProvider.mSessionNodes[1].owner).toEqual("MYHLQ");
        expect(globalMocks.testJobsProvider.mSessionNodes[1].prefix).toEqual("STO*");
        expect(globalMocks.testJobsProvider.mSessionNodes[1].searchId).toEqual("");
    });

    it("Testing that filterPrompt is successfully executed when searching by job ID, VSCode route", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.qpItem = globalMocks.testJobsProvider.createId;
        globalMocks.mockShowInputBox.mockReturnValueOnce("STO12345");

        await globalMocks.testJobsProvider.filterPrompt(globalMocks.testJobsProvider.mSessionNodes[1]);

        expect(globalMocks.testJobsProvider.mSessionNodes[1].contextValue).toEqual(globals.JOBS_SESSION_CONTEXT + "_Active");
        expect(globalMocks.testJobsProvider.mSessionNodes[1].owner).toEqual("*");
        expect(globalMocks.testJobsProvider.mSessionNodes[1].prefix).toEqual("*");
        expect(globalMocks.testJobsProvider.mSessionNodes[1].searchId).toEqual("STO12345");
    });

    it("Testing that filterPrompt is successfully canceled by the user at the owner input box, VSCode route", async () => {
        const globalMocks = await createGlobalMocks();
        await createBlockMocks(globalMocks);

        globalMocks.mockShowInputBox.mockReturnValueOnce(undefined);

        await globalMocks.testJobsProvider.filterPrompt(globalMocks.testJobsProvider.mSessionNodes[1]);

        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Search Cancelled");
    });

    it("Testing that filterPrompt is successfully executed when user selects from the recent searches list, VSCode route", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.qpItem = new utils.FilterItem("Owner:fake Prefix:*");

        await globalMocks.testJobsProvider.filterPrompt(globalMocks.testJobsProvider.mSessionNodes[1]);

        expect(globalMocks.testJobsProvider.mSessionNodes[1].owner).toEqual("fake");
        expect(globalMocks.testJobsProvider.mSessionNodes[1].prefix).toEqual("*");
    });

    it("Testing that filterPrompt is successfully canceled by the user at first quick pick selection, VSCode route", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.qpItem = undefined;

        await globalMocks.testJobsProvider.filterPrompt(globalMocks.testJobsProvider.mSessionNodes[1]);

        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("No selection made.");
    });

    it("Testing that filterPrompt is successfully executed, favorites route", async () => {
        const globalMocks = await createGlobalMocks();
        await createBlockMocks(globalMocks);

        globalMocks.testJobNode.label = "Owner:stonecc Prefix:*";
        globalMocks.testJobNode.contextValue = globals.JOBS_SESSION_CONTEXT + globals.FAV_SUFFIX;
        const checkSession = jest.spyOn(globalMocks.testJobsProvider, "addSession");
        expect(checkSession).not.toHaveBeenCalled();

        await globalMocks.testJobsProvider.filterPrompt(globalMocks.testJobNode);

        expect(checkSession).toHaveBeenCalledTimes(1);
        expect(checkSession).toHaveBeenLastCalledWith("sestest");
    });

    it("Testing that filterPrompt from favorited search can pass session values into node in Sessions", async () => {
        const globalMocks = await createGlobalMocks();
        await createBlockMocks(globalMocks);
        globalMocks.testJobNode.label = "Owner:stonecc Prefix:*";
        globalMocks.testJobNode.contextValue = globals.JOBS_SESSION_CONTEXT + globals.FAV_SUFFIX;

        const sessionNoCreds = createISessionWithoutCredentials();
        globalMocks.testJobsProvider.mSessionNodes[1].session = sessionNoCreds;
        const sessNodeNoCreds = globalMocks.testJobsProvider.mSessionNodes[1];

        await globalMocks.testJobsProvider.filterPrompt(globalMocks.testJobNode);

        expect(sessNodeNoCreds.session.ISession.user).toEqual(globalMocks.testJobNode.session.ISession.user);
        expect(sessNodeNoCreds.session.ISession.password).toEqual(globalMocks.testJobNode.session.ISession.password);
        expect(sessNodeNoCreds.session.ISession.base64EncodedAuth).toEqual(globalMocks.testJobNode.session.ISession.base64EncodedAuth);
    });

    it("Testing that filterPrompt is successfully executed when searching by owner, Theia route", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.theia = true;
        globalMocks.mockShowQuickPick.mockReturnValueOnce(blockMocks.qpItem);
        globalMocks.mockShowInputBox.mockReturnValueOnce("MYHLQY");
        globalMocks.mockShowInputBox.mockReturnValueOnce("");
        globalMocks.mockShowInputBox.mockReturnValueOnce(""); // need the jobId in this case

        await globalMocks.testJobsProvider.filterPrompt(globalMocks.testJobsProvider.mSessionNodes[1]);

        expect(globalMocks.testJobsProvider.mSessionNodes[1].contextValue).toEqual(globals.JOBS_SESSION_CONTEXT + "_Active");
        expect(globalMocks.testJobsProvider.mSessionNodes[1].owner).toEqual("MYHLQY");
        expect(globalMocks.testJobsProvider.mSessionNodes[1].prefix).toEqual("*");
        expect(globalMocks.testJobsProvider.mSessionNodes[1].searchId).toEqual("");
    });

    it("Testing that filterPrompt is successfully executed when searching by prefix, Theia route", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.theia = true;
        globalMocks.mockShowQuickPick.mockReturnValueOnce(blockMocks.qpItem);
        globalMocks.mockShowInputBox.mockReturnValueOnce("");
        globalMocks.mockShowInputBox.mockReturnValueOnce("STO*");

        await globalMocks.testJobsProvider.filterPrompt(globalMocks.testJobsProvider.mSessionNodes[1]);

        expect(globalMocks.testJobsProvider.mSessionNodes[1].contextValue).toEqual(globals.JOBS_SESSION_CONTEXT + "_Active");
        expect(globalMocks.testJobsProvider.mSessionNodes[1].owner).toEqual("*");
        expect(globalMocks.testJobsProvider.mSessionNodes[1].prefix).toEqual("STO*");
        expect(globalMocks.testJobsProvider.mSessionNodes[1].searchId).toEqual("");
    });

    it("Testing that filterPrompt is successfully executed when searching by owner & prefix, Theia route", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.theia = true;
        globalMocks.mockShowQuickPick.mockReturnValueOnce(blockMocks.qpItem);
        globalMocks.mockShowInputBox.mockReturnValueOnce("MYHLQX");
        globalMocks.mockShowInputBox.mockReturnValueOnce("STO*");

        await globalMocks.testJobsProvider.filterPrompt(globalMocks.testJobsProvider.mSessionNodes[1]);

        expect(globalMocks.testJobsProvider.mSessionNodes[1].contextValue).toEqual(globals.JOBS_SESSION_CONTEXT + "_Active");
        expect(globalMocks.testJobsProvider.mSessionNodes[1].owner).toEqual("MYHLQX");
        expect(globalMocks.testJobsProvider.mSessionNodes[1].prefix).toEqual("STO*");
        expect(globalMocks.testJobsProvider.mSessionNodes[1].searchId).toEqual("");
    });

    it("Testing that filterPrompt is successfully executed when searching by job ID, Theia route", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.theia = true;
        blockMocks.qpItem = globalMocks.testJobsProvider.createId;
        globalMocks.mockShowQuickPick.mockReturnValueOnce(blockMocks.qpItem);
        globalMocks.mockShowInputBox.mockReturnValueOnce("STO12345");

        await globalMocks.testJobsProvider.filterPrompt(globalMocks.testJobsProvider.mSessionNodes[1]);

        expect(globalMocks.testJobsProvider.mSessionNodes[1].contextValue).toEqual(globals.JOBS_SESSION_CONTEXT + "_Active");
        expect(globalMocks.testJobsProvider.mSessionNodes[1].owner).toEqual("*");
        expect(globalMocks.testJobsProvider.mSessionNodes[1].prefix).toEqual("*");
        expect(globalMocks.testJobsProvider.mSessionNodes[1].searchId).toEqual("STO12345");

    });

    it("Testing that filterPrompt is successfully canceled by the user at the owner input box, Theia route", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.theia = true;
        globalMocks.mockShowInputBox.mockReturnValueOnce(undefined);
        globalMocks.mockShowQuickPick.mockReturnValueOnce(blockMocks.qpItem);

        await globalMocks.testJobsProvider.filterPrompt(globalMocks.testJobsProvider.mSessionNodes[1]);

        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Search Cancelled");
    });

    it("Testing that filterPrompt is successfully executed when user selects from the recent searches list, Theia route", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.theia = true;
        blockMocks.qpItem = new utils.FilterItem("Owner:fake Prefix:*");
        globalMocks.mockShowQuickPick.mockReturnValueOnce(blockMocks.qpItem);

        await globalMocks.testJobsProvider.filterPrompt(globalMocks.testJobsProvider.mSessionNodes[1]);

        expect(globalMocks.testJobsProvider.mSessionNodes[1].owner).toEqual("fake");
        expect(globalMocks.testJobsProvider.mSessionNodes[1].prefix).toEqual("*");
    });

    it("Testing that filterPrompt is successfully canceled by the user at first quick pick selection, Theia route", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.theia = true;
        globalMocks.mockShowQuickPick.mockReturnValueOnce(undefined);

        // Assert edge condition user cancels the quick pick
        await globalMocks.testJobsProvider.filterPrompt(globalMocks.testJobsProvider.mSessionNodes[1]);

        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("No selection made.");
    });
});
