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

jest.mock("@zowe/cli");
import { createJobsTree } from "../../../src/job/ZosJobsProvider";
import * as vscode from "vscode";
import * as zowe from "@zowe/cli";
import * as globals from "../../../src/globals";
import { createIJobFile, createIJobObject, createJobSessionNode } from "../../../__mocks__/mockCreators/jobs";
import { Job } from "../../../src/job/ZoweJobNode";
import { IZoweJobTreeNode, ProfilesCache, Gui, JobSortOpts, SortDirection } from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "../../../src/ZoweExplorerApiRegister";
import { Profiles } from "../../../src/Profiles";
import * as sessUtils from "../../../src/utils/SessionUtils";
import {
    createIProfile,
    createISession,
    createInstanceOfProfile,
    createISessionWithoutCredentials,
    createInstanceOfProfileInfo,
} from "../../../__mocks__/mockCreators/shared";
import * as contextually from "../../../src/shared/context";
import { ZoweLogger } from "../../../src/utils/LoggerUtils";
import { bindJesApi, createJesApi } from "../../../__mocks__/mockCreators/api";

async function createGlobalMocks() {
    const globalMocks = {
        getConfiguration: jest.fn(),
        mockGetJobs: jest.fn(),
        mockGetJob: jest.fn(),
        mockRefresh: jest.fn(),
        mockAffectsConfig: jest.fn(),
        createTreeView: jest.fn(() => ({
            reveal: jest.fn(),
        })),
        mockCreateSessCfgFromArgs: jest.fn(),
        mockGetSpoolFiles: jest.fn(),
        testSessionNode: null,
        mockDeleteJobs: jest.fn(),
        mockShowInputBox: jest.fn(),
        mockDeleteJob: jest.fn(),
        mockGetJobsByOwnerAndPrefix: jest.fn(),
        mockShowInformationMessage: jest.fn(),
        mockLoadNamedProfile: jest.fn(),
        mockCreateQuickPick: jest.fn(),
        mockLoadDefaultProfile: jest.fn(),
        mockShowQuickPick: jest.fn(),
        testJobsProvider: null,
        jesApi: null,
        testSession: createISession(),
        mockGetBaseProfile: jest.fn(),
        testSessionNoCred: createISessionWithoutCredentials(),
        testProfile: createIProfile(),
        testIJob: createIJobObject(),
        testIJobComplete: createIJobObject(),
        testJobNode: null,
        mockIJobFile: createIJobFile(),
        mockProfileInstance: null,
        mockValidationSetting: jest.fn(),
        mockDisableValidationContext: jest.fn(),
        mockEnableValidationContext: jest.fn(),
        mockCheckProfileValidationSetting: jest.fn(),
        withProgress: jest.fn().mockImplementation((progLocation, callback) => {
            return callback();
        }),
        ProgressLocation: jest.fn().mockImplementation(() => {
            return {
                Notification: 15,
            };
        }),
        enums: jest.fn().mockImplementation(() => {
            return {
                Global: 1,
                Workspace: 2,
                WorkspaceFolder: 3,
            };
        }),
        mockProfileInfo: createInstanceOfProfileInfo(),
        mockProfilesCache: new ProfilesCache(zowe.imperative.Logger.getAppLogger()),
    };

    Object.defineProperty(globals, "LOG", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals.LOG, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(globalMocks.mockProfilesCache, "getProfileInfo", {
        value: jest.fn(() => {
            return { value: globalMocks.mockProfileInfo, configurable: true };
        }),
    });
    globalMocks.mockProfileInstance = createInstanceOfProfile(globalMocks.testProfile);
    Object.defineProperty(vscode, "ProgressLocation", { value: globalMocks.ProgressLocation, configurable: true });
    Object.defineProperty(vscode.window, "withProgress", { value: globalMocks.withProgress, configurable: true });
    Object.defineProperty(zowe, "GetJobs", { value: globalMocks.mockGetJobs, configurable: true });
    Object.defineProperty(vscode.window, "showInformationMessage", {
        value: globalMocks.mockShowInformationMessage,
        configurable: true,
    });
    Object.defineProperty(globalMocks.mockGetJobs, "getJob", { value: globalMocks.mockGetJob, configurable: true });
    Object.defineProperty(globalMocks.mockGetJobs, "getJobsByOwnerAndPrefix", {
        value: globalMocks.mockGetJobsByOwnerAndPrefix,
        configurable: true,
    });
    Object.defineProperty(zowe.ZosmfSession, "createSessCfgFromArgs", {
        value: globalMocks.mockCreateSessCfgFromArgs,
        configurable: true,
    });
    Object.defineProperty(globalMocks.mockGetJobs, "getSpoolFiles", {
        value: globalMocks.mockGetSpoolFiles,
        configurable: true,
    });
    Object.defineProperty(vscode.window, "createTreeView", { value: globalMocks.createTreeView, configurable: true });
    Object.defineProperty(vscode.window, "showQuickPick", { value: globalMocks.mockShowQuickPick, configurable: true });
    Object.defineProperty(vscode, "ConfigurationTarget", { value: globalMocks.enums, configurable: true });
    Object.defineProperty(vscode.window, "showInputBox", { value: globalMocks.mockShowInputBox, configurable: true });
    Object.defineProperty(vscode.workspace, "getConfiguration", {
        value: globalMocks.getConfiguration,
        configurable: true,
    });
    Object.defineProperty(Profiles, "getInstance", {
        value: jest.fn(() => globalMocks.mockProfileInstance),
        configurable: true,
    });
    Object.defineProperty(zowe, "DeleteJobs", { value: globalMocks.mockDeleteJobs, configurable: true });
    Object.defineProperty(vscode.window, "createQuickPick", {
        value: globalMocks.mockCreateQuickPick,
        configurable: true,
    });
    Object.defineProperty(globalMocks.mockDeleteJobs, "deleteJob", {
        value: globalMocks.mockDeleteJob,
        configurable: true,
    });
    Object.defineProperty(sessUtils, "removeSession", {
        value: jest.fn().mockImplementationOnce(() => Promise.resolve()),
        configurable: true,
    });
    Object.defineProperty(ZoweLogger, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "debug", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "warn", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "info", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "trace", { value: jest.fn(), configurable: true });

    // Profile instance mocks
    globalMocks.mockProfileInstance = createInstanceOfProfile(globalMocks.testProfile);
    globalMocks.mockGetSpoolFiles.mockReturnValue([globalMocks.mockIJobFile]);
    globalMocks.mockLoadNamedProfile.mockReturnValue(globalMocks.testProfile);
    globalMocks.mockProfileInstance.loadNamedProfile = globalMocks.mockLoadNamedProfile;
    globalMocks.mockLoadDefaultProfile.mockReturnValue(globalMocks.testProfile);
    globalMocks.mockProfileInstance.getDefaultProfile = globalMocks.mockLoadDefaultProfile;
    globalMocks.mockGetBaseProfile.mockResolvedValue(globalMocks.testProfile);
    globalMocks.mockProfileInstance.getValidSession.mockResolvedValue(globalMocks.testSession);
    globalMocks.mockProfileInstance.getBaseProfile = globalMocks.mockGetBaseProfile;
    globalMocks.mockProfileInstance.checkProfileValidationSetting = globalMocks.mockValidationSetting.mockReturnValue(true);
    globalMocks.mockProfileInstance.enableValidationContext = globalMocks.mockEnableValidationContext;
    globalMocks.mockProfileInstance.disableValidationContext = globalMocks.mockDisableValidationContext;

    // Jes API mocks
    globalMocks.jesApi = createJesApi(globalMocks.testProfile);
    bindJesApi(globalMocks.jesApi);

    globalMocks.mockCreateSessCfgFromArgs.mockReturnValue(globalMocks.testSession);
    globalMocks.testSessionNode = createJobSessionNode(globalMocks.testSession, globalMocks.testProfile);
    globalMocks.mockGetJob.mockReturnValue(globalMocks.testIJob);
    globalMocks.mockGetJobsByOwnerAndPrefix.mockReturnValue([globalMocks.testIJob, globalMocks.testIJobComplete]);
    globalMocks.mockProfileInstance.editSession = jest.fn(() => globalMocks.testProfile);
    globalMocks.testJobNode = new Job(
        "jobtest",
        vscode.TreeItemCollapsibleState.Expanded,
        null,
        globalMocks.testSession,
        globalMocks.testIJob,
        globalMocks.testProfile
    );
    globalMocks.testJobNode.contextValue = "job";
    globalMocks.testJobNode.dirty = true;
    globalMocks.testIJobComplete.jobid = "JOB1235";
    globalMocks.testIJobComplete.retcode = "0";
    globalMocks.getConfiguration.mockReturnValue({
        get: (setting: string) => ["[test]: /u/aDir{directory}", "[test]: /u/myFile.txt{textFile}"],
        update: jest.fn(() => {
            return {};
        }),
    });
    globalMocks.testJobsProvider = await createJobsTree(zowe.imperative.Logger.getAppLogger());
    globalMocks.testJobsProvider.mSessionNodes.push(globalMocks.testSessionNode);
    Object.defineProperty(globalMocks.testJobsProvider, "refresh", {
        value: globalMocks.mockRefresh,
        configurable: true,
    });

    // Reset getConfiguration because we called it when testJobsProvider was assigned
    globalMocks.getConfiguration.mockClear();

    return globalMocks;
}

describe("ZoweJobNode unit tests - Function createJobsTree", () => {
    it("Tests that createJobsTree is executed successfully", async () => {
        const globalMocks = await createGlobalMocks();

        const newJobsProvider = await createJobsTree(zowe.imperative.Logger.getAppLogger());
        const newProviderKeys = JSON.stringify(Object.keys(newJobsProvider).sort());
        const testProviderKeys = JSON.stringify(Object.keys(globalMocks.testJobsProvider).sort());

        expect(newProviderKeys).toEqual(testProviderKeys);
    });
});

describe("ZoweJobNode unit tests - Function addSession", () => {
    it("Tests that addSession adds the session to the tree", async () => {
        const globalMocks = await createGlobalMocks();

        await globalMocks.testJobsProvider.addSession("sestest");

        expect(globalMocks.testJobsProvider.mSessionNodes[1]).toBeDefined();
        expect(globalMocks.testJobsProvider.mSessionNodes[1].label).toEqual("sestest");
    });

    it("Tests that addSession adds the session to the tree with disabled global setting", async () => {
        const globalMocks = await createGlobalMocks();
        globalMocks.mockProfileInstance.mockDisableValidationContext = globalMocks.testJobsProvider.mSessionNodes[1].contextValue += `_noValidate`;
        await globalMocks.testJobsProvider.addSession("sestest");

        expect(globalMocks.testJobsProvider.mSessionNodes[1]).toBeDefined();
        expect(globalMocks.testJobsProvider.mSessionNodes[1].label).toEqual("sestest");
        expect(globalMocks.testJobsProvider.mSessionNodes[1].contextValue).toContain(globals.NO_VALIDATE_SUFFIX);
    });
});

describe("ZoweJobNode unit tests - Function deleteSession", () => {
    it("Tests that deleteSession removes the session from the tree", async () => {
        const globalMocks = await createGlobalMocks();

        await globalMocks.testJobsProvider.deleteSession(globalMocks.testJobsProvider.mSessionNodes[1]);

        expect(globalMocks.testJobsProvider.mSessionNodes.length).toBe(1);
    });
});

describe("ZoweJobNode unit tests - Function delete", () => {
    it("Tests that delete handles an error thrown during job deletion", async () => {
        const globalMocks = await createGlobalMocks();
        const badJobNode = new Job(
            "badJobNode",
            vscode.TreeItemCollapsibleState.Collapsed,
            null,
            globalMocks.testSession,
            globalMocks.testIJob,
            globalMocks.testProfile
        );

        const apiRegisterInstance = ZoweExplorerApiRegister.getInstance();
        const mockJesApi = await apiRegisterInstance.getJesApi(globalMocks.testProfile);
        const getJesApiMock = jest.fn();
        getJesApiMock.mockReturnValue(mockJesApi);
        apiRegisterInstance.getJesApi = getJesApiMock.bind(apiRegisterInstance);
        jest.spyOn(mockJesApi, "deleteJob").mockImplementationOnce(() => Promise.reject("test error"));
        await expect(globalMocks.testJobsProvider.delete(badJobNode.job.jobname, badJobNode.job.jobid)).rejects.toThrow();
    });
});

describe("ZoweJobNode unit tests - Function onDidConfiguration", () => {
    it("Tests that onDidConfiguration is executed successfully", async () => {
        const globalMocks = await createGlobalMocks();

        const Event = jest.fn().mockImplementation(() => {
            return {
                affectsConfiguration: globalMocks.mockAffectsConfig,
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
    xit("Tests that getChildren returns the jobs of the session, when called on the session", async () => {
        const globalMocks = await createGlobalMocks();

        await globalMocks.testJobsProvider.addSession("fake");

        const jobs = await globalMocks.testJobsProvider.mSessionNodes[1].getChildren();

        expect(jobs.length).toBe(2);
        expect(jobs[0].job.jobid).toEqual(globalMocks.testIJob.jobid);
        expect(jobs[0].tooltip).toEqual("TESTJOB(JOB1234)");
        expect(jobs[1].job.jobid).toEqual(globalMocks.testIJobComplete.jobid);
        expect(jobs[1].tooltip).toEqual("TESTJOB(JOB1235) - 0");
    });

    it("Tests that getChildren updates existing job nodes with new statuses", async () => {
        const globalMocks = await createGlobalMocks();

        await globalMocks.testJobsProvider.addSession("fake");
        globalMocks.testJobsProvider.mSessionNodes[1].searchId = "JOB1234";
        globalMocks.testJobsProvider.mSessionNodes[1].dirty = true;
        globalMocks.testJobsProvider.mSessionNodes[1].filtered = true;
        const jobs = await globalMocks.testJobsProvider.mSessionNodes[1].getChildren();
        expect(jobs[0].label).toEqual("TESTJOB(JOB1234) - ACTIVE");

        globalMocks.mockGetJob.mockReturnValueOnce({ ...globalMocks.testIJob, retcode: "CC 0000" });
        globalMocks.testJobsProvider.mSessionNodes[1].dirty = true;
        const newJobs = await globalMocks.testJobsProvider.mSessionNodes[1].getChildren();

        expect(newJobs[0].label).toEqual("TESTJOB(JOB1234) - CC 0000");
    });

    it("Tests that getChildren retrieves only child jobs which match a provided searchId", async () => {
        const globalMocks = await createGlobalMocks();

        await globalMocks.testJobsProvider.addSession("fake");
        globalMocks.testJobsProvider.mSessionNodes[1].searchId = "JOB1234";
        globalMocks.testJobsProvider.mSessionNodes[1].dirty = true;
        globalMocks.testJobsProvider.mSessionNodes[1].filtered = true;

        const jobs = await globalMocks.testJobsProvider.mSessionNodes[1].getChildren();

        expect(jobs.length).toBe(1);
        expect(jobs[0].job.jobid).toEqual(globalMocks.testIJob.jobid);
        expect(jobs[0].tooltip).toEqual("TESTJOB(JOB1234)");
    });

    it("Tests that getChildren returns the spool files if called on a job", async () => {
        const globalMocks = await createGlobalMocks();

        const spoolFiles = await globalMocks.testJobNode.getChildren();
        expect(spoolFiles.length).toBe(1);
        expect(spoolFiles[0].label).toEqual("STEP:STDOUT - 1");
        expect(spoolFiles[0].owner).toEqual("fake");
    });

    it("Tests that getChildren updates existing spool nodes if called again on a job", async () => {
        const globalMocks = await createGlobalMocks();

        const spoolFiles = await globalMocks.testJobNode.getChildren();
        expect(spoolFiles.length).toBe(1);
        expect(spoolFiles[0].label).toEqual("STEP:STDOUT - 1");
        expect(spoolFiles[0].owner).toEqual("fake");

        jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValueOnce({
            getSpoolFiles: jest.fn().mockReturnValueOnce([{ ...globalMocks.mockIJobFile, "record-count": 2 }]),
        } as any);
        globalMocks.testJobNode.dirty = true;
        const spoolFilesAfter = await globalMocks.testJobNode.getChildren();
        expect(spoolFilesAfter.length).toBe(1);
        expect(spoolFilesAfter[0].label).toEqual("STEP:STDOUT - 2");
        expect(spoolFilesAfter[0].owner).toEqual("fake");
    });

    it("Tests that getChildren returns a placeholder node if no spool files are available", async () => {
        const globalMocks = await createGlobalMocks();

        jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValueOnce({
            getSpoolFiles: jest.fn().mockReturnValueOnce([]),
        } as any);
        globalMocks.testJobNode.dirty = true;
        const spoolFilesAfter = await globalMocks.testJobNode.getChildren();
        expect(spoolFilesAfter.length).toBe(1);
        expect(spoolFilesAfter[0].label).toEqual("There are no JES spool messages to display");
    });

    it("Tests that getChildren returns the spool files if user/owner is not defined", async () => {
        const globalMocks = await createGlobalMocks();

        globalMocks.testJobsProvider.mSessionNodes[1]._owner = null;
        globalMocks.testJobsProvider.mSessionNodes[1]._prefix = "*";
        globalMocks.testJobsProvider.mSessionNodes[1]._searchId = "";
        globalMocks.testJobNode.session.ISession = globalMocks.testSessionNoCred;
        const spoolFiles = await globalMocks.testJobNode.getChildren();
        expect(spoolFiles.length).toBe(1);
        expect(spoolFiles[0].label).toEqual("STEP:STDOUT - 1");
        expect(spoolFiles[0].owner).toEqual("*");
    });

    it("should return a new job if not owner and is a session", async () => {
        const globalMocks = await createGlobalMocks();
        const expectedJob = new Job(
            "Use the search button to display jobs",
            vscode.TreeItemCollapsibleState.None,
            globalMocks.testJobNode,
            null,
            null,
            null
        );

        globalMocks.testJobNode._owner = null;
        jest.spyOn(contextually, "isSession").mockReturnValueOnce(true);
        await expect(globalMocks.testJobNode.getChildren()).resolves.toEqual([expectedJob]);
    });

    it("should return 'No jobs found' if no children is found", async () => {
        const globalMocks = await createGlobalMocks();
        const expectedJob = [
            new Job("No jobs found", vscode.TreeItemCollapsibleState.None, globalMocks.testJobsProvider.mSessionNodes[1], null, null, null),
        ];
        expectedJob[0].iconPath = null;
        expectedJob[0].contextValue = "information";
        await globalMocks.testJobsProvider.addSession("fake");
        globalMocks.testJobsProvider.mSessionNodes[1].filtered = true;
        jest.spyOn(globalMocks.testJobsProvider.mSessionNodes[1], "getJobs").mockResolvedValue([]);
        const jobs = await globalMocks.testJobsProvider.mSessionNodes[1].getChildren();
        expect(jobs).toEqual(expectedJob);
    });
});

describe("ZoweJobNode unit tests - Function flipState", () => {
    it("Tests that flipState is executed successfully", async () => {
        const globalMocks = await createGlobalMocks();
        globalMocks.testJobsProvider.addSession("fake");
        globalMocks.testJobsProvider.mSessionNodes[1].contextValue = globals.JOBS_SESSION_CONTEXT;
        globalMocks.mockCreateSessCfgFromArgs.mockReturnValue(globalMocks.testSession);

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
            testJobNode: new Job(
                "MYHLQ(JOB1283) - Input",
                vscode.TreeItemCollapsibleState.Collapsed,
                globalMocks.testJobsProvider.mSessionNodes[1],
                globalMocks.testJobsProvider.mSessionNodes[1].getSession(),
                globalMocks.testIJob,
                globalMocks.testProfile
            ),
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
        expect(profileNodeInFavs.children[0].label).toEqual("Owner: myHLQ | Prefix: * | Status: *");
        expect(profileNodeInFavs.children[0].contextValue).toEqual(globals.JOBS_SESSION_CONTEXT + globals.FAV_SUFFIX);
    });
});

describe("ZoweJobNode unit tests - Function removeFavorite", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            testJobNode1: new Job(
                "MYHLQ(JOB1283) - Input",
                vscode.TreeItemCollapsibleState.Collapsed,
                globalMocks.testJobsProvider.mSessionNodes[1],
                globalMocks.testJobsProvider.mSessionNodes[1].getSession(),
                globalMocks.testIJob,
                globalMocks.testProfile
            ),
            testJobNode2: new Job(
                "MYHLQ(JOB1284) - Input",
                vscode.TreeItemCollapsibleState.Collapsed,
                globalMocks.testJobsProvider.mSessionNodes[1],
                globalMocks.testJobsProvider.mSessionNodes[1].getSession(),
                globalMocks.testIJob,
                globalMocks.testProfile
            ),
        };

        return newMocks;
    }

    it("Tests removeFavorite when starting with more than one favorite for the profile", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const removeFavProfileSpy = jest.spyOn(globalMocks.testJobsProvider, "removeFavProfile");

        globalMocks.testJobsProvider.mFavorites = [];

        await globalMocks.testJobsProvider.addFavorite(blockMocks.testJobNode1);
        await globalMocks.testJobsProvider.addFavorite(blockMocks.testJobNode2);
        const profileNodeInFavs: IZoweJobTreeNode = globalMocks.testJobsProvider.mFavorites[0];
        // Make sure setup is correct
        expect(profileNodeInFavs.children.length).toEqual(2);
        expect(profileNodeInFavs.children[0].label).toBe("MYHLQ(JOB1283)");
        expect(profileNodeInFavs.children[1].label).toBe("MYHLQ(JOB1284)");

        // Actual test
        await globalMocks.testJobsProvider.removeFavorite(profileNodeInFavs.children[0]);
        expect(removeFavProfileSpy).not.toBeCalled();
        expect(profileNodeInFavs.children.length).toEqual(1);
        expect(profileNodeInFavs.children[0].label).toBe("MYHLQ(JOB1284)");
    });
    it("Tests removeFavorite when starting with only one favorite for the profile", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const removeFavProfileSpy = jest.spyOn(globalMocks.testJobsProvider, "removeFavProfile");

        globalMocks.testJobsProvider.mFavorites = [];

        await globalMocks.testJobsProvider.addFavorite(blockMocks.testJobNode1);
        const profileNodeInFavs: IZoweJobTreeNode = globalMocks.testJobsProvider.mFavorites[0];
        const favoritedNode = profileNodeInFavs.children[0];

        expect(profileNodeInFavs.children.length).toEqual(1);

        await globalMocks.testJobsProvider.removeFavorite(favoritedNode);
        expect(removeFavProfileSpy).toHaveBeenCalledWith(profileNodeInFavs.label, false);

        expect(profileNodeInFavs.children.length).toEqual(0);
    });
});

describe("ZoweJobNode unit tests - Function saveSearch", () => {
    async function createBlockMocks(globalMocks) {
        const testSession = globalMocks.testJobsProvider.mSessionNodes[1].getSession();
        const newMocks = {
            testSession,
            testJobNode: new Job(
                "MYHLQ(JOB1283) - Input",
                vscode.TreeItemCollapsibleState.Collapsed,
                globalMocks.testJobsProvider.mSessionNodes[1],
                testSession,
                globalMocks.testIJob,
                globalMocks.testProfile
            ),
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

        globalMocks.testJobsProvider.saveSearch(favJob);
        expect(expectedJob.contextValue).toEqual(favJob.contextValue);
    });
});

describe("ZosJobsProvider - Function searchPrompt", () => {
    it("should exit if searchCriteria is undefined", async () => {
        const globalMocks = await createGlobalMocks();
        jest.spyOn(globalMocks.testJobsProvider, "applyRegularSessionSearchLabel").mockReturnValue(undefined);
        const addSearchHistory = jest.spyOn(globalMocks.testJobsProvider, "addSearchHistory");
        const refreshElement = jest.spyOn(globalMocks.testJobsProvider, "refreshElement");
        await globalMocks.testJobsProvider.searchPrompt(globalMocks.testJobsProvider.mSessionNodes[1]);
        expect(globalMocks.testJobsProvider);
        expect(addSearchHistory).not.toHaveBeenCalled();
        expect(refreshElement).not.toHaveBeenCalled();
    });
    it("should add history if searchCriteria is returned", async () => {
        const globalMocks = await createGlobalMocks();
        jest.spyOn(globalMocks.testJobsProvider, "applyRegularSessionSearchLabel").mockReturnValue("Owner:kristina Prefix:* Status:*");
        const addSearchHistory = jest.spyOn(globalMocks.testJobsProvider, "addSearchHistory");
        await globalMocks.testJobsProvider.searchPrompt(globalMocks.testJobsProvider.mSessionNodes[1]);
        expect(globalMocks.testJobsProvider);
        expect(addSearchHistory).toHaveBeenCalled();
    });
    it("testing fav node to call applySearchLabelToNode", async () => {
        const globalMocks = await createGlobalMocks();
        jest.spyOn(globalMocks.testJobsProvider, "applySavedFavoritesSearchLabel").mockReturnValue(undefined);
        const applySearchLabelToNode = jest.spyOn(globalMocks.testJobsProvider, "applySearchLabelToNode");
        const jobSessionNode = new Job("sestest", vscode.TreeItemCollapsibleState.Collapsed, null, null, null, null);
        jobSessionNode.contextValue = globals.JOBS_SESSION_CONTEXT + globals.FAV_SUFFIX;
        await globalMocks.testJobsProvider.searchPrompt(jobSessionNode);
        expect(applySearchLabelToNode).toHaveBeenCalled();
    });
});

describe("ZosJobsProvider - Function applyRegularSessionSearchLabel", () => {
    it("should call applySearchLabelToNode", async () => {
        const globalMocks = await createGlobalMocks();
        const searchObj = {
            Owner: "zowe",
            Prefix: "*",
            JobId: undefined,
            Status: "*",
        };
        jest.spyOn(globalMocks.testJobsProvider, "getUserJobsMenuChoice").mockReturnValue({ text: "test" });
        jest.spyOn(globalMocks.testJobsProvider, "getUserSearchQueryInput").mockReturnValue(searchObj);
        jest.spyOn(globalMocks.testJobsProvider, "createSearchLabel").mockReturnValue(searchObj);
        const applySearchLabelToNode = jest.spyOn(globalMocks.testJobsProvider, "applySearchLabelToNode");
        const returnedSearchCriteria = await globalMocks.testJobsProvider.applyRegularSessionSearchLabel(
            globalMocks.testJobsProvider.mSessionNodes[1]
        );
        expect(returnedSearchCriteria).toEqual(searchObj);
        expect(applySearchLabelToNode).toHaveBeenCalled();
    });
    it("should not call applySearchLabelToNode and return undefined", async () => {
        const globalMocks = await createGlobalMocks();
        const searchObj = {
            Owner: undefined,
            Prefix: undefined,
            JobId: undefined,
            Status: undefined,
        };
        jest.spyOn(globalMocks.testJobsProvider, "getUserJobsMenuChoice").mockReturnValue({ text: "test" });
        jest.spyOn(globalMocks.testJobsProvider, "getUserSearchQueryInput").mockReturnValue(undefined);
        jest.spyOn(globalMocks.testJobsProvider, "createSearchLabel").mockReturnValue(searchObj);
        const applySearchLabelToNode = jest.spyOn(globalMocks.testJobsProvider, "applySearchLabelToNode");
        const returnedSearchCriteria = await globalMocks.testJobsProvider.applyRegularSessionSearchLabel(
            globalMocks.testJobsProvider.mSessionNodes[1]
        );
        expect(returnedSearchCriteria).toEqual(undefined);
        expect(applySearchLabelToNode).not.toHaveBeenCalled();
    });
});

describe("ZosJobsProvider - Function parseJobSearchQuery", () => {
    const emptySearchCriteriaObj = {
        Owner: undefined,
        Prefix: undefined,
        JobId: undefined,
        Status: undefined,
    };
    it("should return empty object for undefined criteria", async () => {
        const globalMocks = await createGlobalMocks();
        const actualCriteriaObj = globalMocks.testJobsProvider.parseJobSearchQuery(undefined);
        expect(actualCriteriaObj).toEqual(emptySearchCriteriaObj);
    });
    it("should parse a valid search criteria", async () => {
        const globalMocks = await createGlobalMocks();
        const actualCriteriaObj = globalMocks.testJobsProvider.parseJobSearchQuery("Owner:zowe Prefix:* Status:*");
        const expectedSearchCriteriaObj = {
            Owner: "zowe",
            Prefix: "*",
            JobId: undefined,
            Status: "*",
        };
        expect(actualCriteriaObj).toEqual(expectedSearchCriteriaObj);
    });
    it("should parse search criteria without status", async () => {
        const globalMocks = await createGlobalMocks();
        const actualCriteriaObj = globalMocks.testJobsProvider.parseJobSearchQuery("Owner: zowe | Prefix: *");
        const expectedSearchCriteriaObj = {
            Owner: "zowe",
            Prefix: "*",
            JobId: undefined,
            Status: undefined,
        };
        expect(actualCriteriaObj).toEqual(expectedSearchCriteriaObj);
    });
    it("should parse valid items out of bad query with special characters", async () => {
        const globalMocks = await createGlobalMocks();
        const actualCriteriaObj = globalMocks.testJobsProvider.parseJobSearchQuery("Owner:zowe::\\// . : Prefix:BA*      Status:ACTIVE");
        const expectedSearchCriteriaObj = {
            Owner: "zowe",
            Prefix: "BA*",
            JobId: undefined,
            Status: "ACTIVE",
        };
        expect(actualCriteriaObj).toEqual(expectedSearchCriteriaObj);
    });
    it("should return empty object for query with only :", async () => {
        const globalMocks = await createGlobalMocks();
        const actualCriteriaObj = globalMocks.testJobsProvider.parseJobSearchQuery("::::::::::");
        expect(actualCriteriaObj).toEqual(emptySearchCriteriaObj);
    });
    it("should not add extra key value pairs to searchCriteriaObj", async () => {
        const globalMocks = await createGlobalMocks();
        const actualCriteriaObj = globalMocks.testJobsProvider.parseJobSearchQuery("Owner:zowe Prefix:* Random:value Another:random JobId:123");
        const expectedSearchCriteriaObj = {
            Owner: "zowe",
            Prefix: "*",
            JobId: "123",
            Status: undefined,
        };
        expect(actualCriteriaObj).toEqual(expectedSearchCriteriaObj);
    });
    it("should return empty searchCriteriaObj for empty string", async () => {
        const globalMocks = await createGlobalMocks();
        const actualCriteriaObj = globalMocks.testJobsProvider.parseJobSearchQuery("      ");
        expect(actualCriteriaObj).toEqual(emptySearchCriteriaObj);
    });
});

describe("ZosJobsProvider - Function handleEditingMultiJobParameters", () => {
    it("should resolve and retun if user cancels quick pick", async () => {
        const globalMocks = await createGlobalMocks();
        globalMocks.mockShowQuickPick.mockReturnValueOnce(undefined);
        const setJobStatus = jest.spyOn(globalMocks.testJobsProvider, "setJobStatus");
        await globalMocks.testJobsProvider.handleEditingMultiJobParameters(
            globalMocks.testJobsProvider.JOB_PROPERTIES,
            globalMocks.testJobsProvider.mSessionNodes[0]
        );
        expect(setJobStatus).not.toHaveBeenCalled();
    });
    it("should set job status if user chose Job Status in Quick Pick", async () => {
        const globalMocks = await createGlobalMocks();
        const setJobStatus = jest.spyOn(globalMocks.testJobsProvider, "setJobStatus").mockReturnValue({
            key: `All`,
            label: `*`,
            value: null,
            picked: true,
        });
        globalMocks.mockShowQuickPick.mockReturnValueOnce({ label: "Job Status" });
        await globalMocks.testJobsProvider.handleEditingMultiJobParameters(
            globalMocks.testJobsProvider.JOB_PROPERTIES,
            globalMocks.testJobsProvider.mSessionNodes[0]
        );
        expect(setJobStatus).toHaveBeenCalled();
    });
    it("return search criteria object if user clicks submit in Quick Pick", async () => {
        const myJobProperties = [
            {
                key: `owner`,
                label: `Job Owner`,
                value: "zowe",
                show: true,
                placeHolder: "Enter job owner ID",
            },
            {
                key: `prefix`,
                label: `Job Prefix`,
                value: "KRI*",
                show: true,
                placeHolder: "Enter job prefix",
            },
            {
                key: `job-status`,
                label: `Job Status`,
                value: "ACTIVE",
                show: true,
                placeHolder: "Enter job status",
            },
        ];
        const globalMocks = await createGlobalMocks();
        const setJobStatus = jest.spyOn(globalMocks.testJobsProvider, "setJobStatus");
        globalMocks.mockShowQuickPick.mockReturnValueOnce({ label: "$(check) Submit this query" });
        const result = await globalMocks.testJobsProvider.handleEditingMultiJobParameters(
            myJobProperties,
            globalMocks.testJobsProvider.mSessionNodes[0]
        );
        expect(setJobStatus).not.toHaveBeenCalled();
        expect(result).toEqual({ Owner: "zowe", Prefix: "KRI*", JobId: undefined, Status: "ACTIVE" });
    });
});

describe("ZosJobsProvider - tooltip", () => {
    it("should return undefined tooltip", async () => {
        const globalMocks = await createGlobalMocks();
        globalMocks.testJobsProvider.mSessionNodes[1]._tooltip = undefined;
        globalMocks.testJobsProvider.mSessionNodes[1].job = undefined;
        globalMocks.testJobsProvider.mSessionNodes[1].label = undefined;
        const actualTooltip = globalMocks.testJobsProvider.mSessionNodes[1].tooltip;
        expect(undefined).toEqual(actualTooltip);
    });
    it("should return existing _tooltip", async () => {
        const globalMocks = await createGlobalMocks();
        globalMocks.testJobsProvider.mSessionNodes[1]._tooltip = "my_tooltip";
        const actualTooltip = globalMocks.testJobsProvider.mSessionNodes[1].tooltip;
        expect("my_tooltip").toEqual(actualTooltip);
    });
    it("should return job id tooltip", async () => {
        const globalMocks = await createGlobalMocks();
        const job = { jobname: "myJob", jobid: 123, retcode: 345 };
        globalMocks.testJobsProvider.mSessionNodes[1].job = job;
        const actualTooltip = globalMocks.testJobsProvider.mSessionNodes[1].tooltip;
        expect("myJob(123) - 345").toEqual(actualTooltip);
    });
});

describe("ZosJobsProvider - getJobs", () => {
    it("should filter duplicate jobs", async () => {
        const globalMocks = await createGlobalMocks();
        Object.defineProperty(ZoweExplorerApiRegister, "getJesApi", {
            value: () => ({
                getJobsByParameters: false,
                getJobsByOwnerAndPrefix: () => ["test"],
                getSession: () => globalMocks.testSession,
            }),
        });
        jest.spyOn(Gui, "warningMessage").mockImplementation();
        await expect(globalMocks.testJobNode.getJobs("test", "test", "test", "test")).resolves.not.toThrow();
    });
});

describe("Job - sortJobs", () => {
    it("should sort jobs based on job ID", () => {
        const sorted = [
            {
                job: {
                    jobid: "JOBID123",
                },
            } as IZoweJobTreeNode,
            {
                job: {
                    jobid: "JOBID120",
                },
            } as IZoweJobTreeNode,
            {
                job: {
                    jobid: "JOBID124",
                },
            } as IZoweJobTreeNode,
            // In most cases, there won't be two identical job IDs. In case of overflow, this covers the case for equal job IDs.
            {
                job: {
                    jobid: "JOBID120",
                },
            } as IZoweJobTreeNode,
        ].sort(Job.sortJobs({ method: JobSortOpts.Id, direction: SortDirection.Ascending }));
        expect(sorted[0].job.jobid).toBe("JOBID120");
        expect(sorted[1].job.jobid).toBe("JOBID120");
        expect(sorted[2].job.jobid).toBe("JOBID123");
        expect(sorted[3].job.jobid).toBe("JOBID124");
    });
});
