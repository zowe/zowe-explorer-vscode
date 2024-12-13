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

jest.mock("@zowe/zos-jobs-for-zowe-sdk");
import * as vscode from "vscode";
import * as zosjobs from "@zowe/zos-jobs-for-zowe-sdk";
import * as zosmf from "@zowe/zosmf-for-zowe-sdk";
import { createIJobFile, createIJobObject, createJobNode, createJobSessionNode } from "../../../__mocks__/mockCreators/jobs";
import { imperative, IZoweJobTreeNode, ProfilesCache, Gui, Sorting } from "@zowe/zowe-explorer-api";
import { TreeViewUtils } from "../../../../src/utils/TreeViewUtils";
import {
    createIProfile,
    createISession,
    createInstanceOfProfile,
    createISessionWithoutCredentials,
    createInstanceOfProfileInfo,
    createTreeProviders,
} from "../../../__mocks__/mockCreators/shared";
import { bindJesApi, createJesApi } from "../../../__mocks__/mockCreators/api";
import { Constants } from "../../../../src/configuration/Constants";
import { Profiles } from "../../../../src/configuration/Profiles";
import { ZoweExplorerApiRegister } from "../../../../src/extending/ZoweExplorerApiRegister";
import { ZoweLocalStorage } from "../../../../src/tools/ZoweLocalStorage";
import { JobFSProvider } from "../../../../src/trees/job/JobFSProvider";
import { ZoweJobNode, ZoweSpoolNode } from "../../../../src/trees/job/ZoweJobNode";
import { SharedContext } from "../../../../src/trees/shared/SharedContext";
import { SharedTreeProviders } from "../../../../src/trees/shared/SharedTreeProviders";
import { JobInit } from "../../../../src/trees/job/JobInit";
import { ZoweLogger } from "../../../../src/tools/ZoweLogger";

async function createGlobalMocks() {
    const globalMocks = {
        getConfiguration: jest.fn(),
        mockGetJobs: jest.fn(),
        mockGetJob: jest.fn(),
        mockRefresh: jest.fn(),
        mockAffectsConfig: jest.fn(),
        createTreeView: jest.fn(() => ({
            reveal: jest.fn(),
            onDidCollapseElement: jest.fn(),
        })),
        mockCreateSessCfgFromArgs: jest.fn(),
        mockGetSpoolFiles: jest.fn(),
        testSessionNode: null,
        mockDeleteJobs: jest.fn(),
        mockShowInputBox: jest.fn(),
        mockDeleteJob: jest.fn(),
        mockGetJobsByParameters: jest.fn(),
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
        mockProfilesCache: new ProfilesCache(imperative.Logger.getAppLogger()),
        mockTreeProviders: createTreeProviders(),
        FileSystemProvider: {
            createDirectory: jest.fn(),
            writeFile: jest.fn(),
        },
    };

    jest.spyOn(JobFSProvider.instance, "createDirectory").mockImplementation(globalMocks.FileSystemProvider.createDirectory);
    jest.spyOn(JobFSProvider.instance, "writeFile").mockImplementation(globalMocks.FileSystemProvider.writeFile);

    Object.defineProperty(globalMocks.mockProfilesCache, "getProfileInfo", {
        value: jest.fn(() => {
            return { value: globalMocks.mockProfileInfo, configurable: true };
        }),
    });
    globalMocks.mockProfileInstance = createInstanceOfProfile(globalMocks.testProfile);
    Object.defineProperty(vscode, "ProgressLocation", { value: globalMocks.ProgressLocation, configurable: true });
    Object.defineProperty(vscode.window, "withProgress", { value: globalMocks.withProgress, configurable: true });
    Object.defineProperty(zosjobs, "GetJobs", { value: globalMocks.mockGetJobs, configurable: true });
    Object.defineProperty(vscode.window, "showInformationMessage", {
        value: globalMocks.mockShowInformationMessage,
        configurable: true,
    });
    Object.defineProperty(globalMocks.mockGetJobs, "getJob", { value: globalMocks.mockGetJob, configurable: true });
    Object.defineProperty(globalMocks.mockGetJobs, "getJobsByParameters", {
        value: globalMocks.mockGetJobsByParameters,
        configurable: true,
    });
    Object.defineProperty(zosmf.ZosmfSession, "createSessCfgFromArgs", {
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

    Object.defineProperty(Profiles, "getInstance", {
        value: jest.fn(() => globalMocks.mockProfileInstance),
        configurable: true,
    });
    Object.defineProperty(zosjobs, "DeleteJobs", { value: globalMocks.mockDeleteJobs, configurable: true });
    Object.defineProperty(vscode.window, "createQuickPick", {
        value: globalMocks.mockCreateQuickPick,
        configurable: true,
    });
    Object.defineProperty(globalMocks.mockDeleteJobs, "deleteJob", {
        value: globalMocks.mockDeleteJob,
        configurable: true,
    });
    Object.defineProperty(TreeViewUtils, "removeSession", {
        value: jest.fn().mockImplementationOnce(() => Promise.resolve()),
        configurable: true,
    });
    Object.defineProperty(ZoweLocalStorage, "globalState", {
        value: {
            get: () => ({ persistence: true, favorites: [], history: [], sessions: ["zosmf"], searchHistory: [], fileHistory: [] }),
            update: jest.fn(),
            keys: () => [],
        },
        configurable: true,
    });

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
    globalMocks.mockGetJobsByParameters.mockReturnValue([globalMocks.testIJob, globalMocks.testIJobComplete]);
    globalMocks.mockProfileInstance.editSession = jest.fn(() => globalMocks.testProfile);
    globalMocks.testJobNode = new ZoweJobNode({
        label: "jobtest",
        collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
        session: globalMocks.testSession,
        profile: globalMocks.testProfile,
        job: globalMocks.testIJob,
    });
    globalMocks.testJobNode.contextValue = "job";
    globalMocks.testJobNode.dirty = true;
    globalMocks.testIJobComplete.jobid = "JOB1235";
    globalMocks.testIJobComplete.retcode = "0";
    globalMocks.getConfiguration.mockReturnValueOnce({
        get: (_setting: string) => ["[test]: /u/aDir{directory}", "[test]: /u/myFile.txt{textFile}"],
        update: jest.fn(() => {
            return {};
        }),
    });
    globalMocks.testJobsProvider = await JobInit.createJobsTree(imperative.Logger.getAppLogger());
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

        const newJobsProvider = await JobInit.createJobsTree(imperative.Logger.getAppLogger());
        const newProviderKeys = JSON.stringify(Object.keys(newJobsProvider).sort());
        const testProviderKeys = JSON.stringify(Object.keys(globalMocks.testJobsProvider).sort());

        expect(newProviderKeys).toEqual(testProviderKeys);
    });
});

describe("ZoweJobNode unit tests - Function addSession", () => {
    it("Tests that addSession adds the session to the tree", async () => {
        const globalMocks = await createGlobalMocks();
        jest.spyOn(SharedTreeProviders, "providers", "get").mockReturnValue({
            ds: {
                addSingleSession: jest.fn(),
                mSessionNodes: [...globalMocks.testJobsProvider.mSessionNodes],
                setStatusForSession: jest.fn(),
                refresh: jest.fn(),
            } as any,
            uss: {
                addSingleSession: jest.fn(),
                mSessionNodes: [...globalMocks.testJobsProvider.mSessionNodes],
                setStatusForSession: jest.fn(),
                refresh: jest.fn(),
            } as any,
            jobs: {
                addSingleSession: jest.fn(),
                mSessionNodes: [...globalMocks.testJobsProvider.mSessionNodes],
                setStatusForSession: jest.fn(),
                refresh: jest.fn(),
            } as any,
        } as any);
        await globalMocks.testJobsProvider.addSession("sestest");
        expect(globalMocks.testJobsProvider.mSessionNodes[1]).toBeDefined();
        expect(globalMocks.testJobsProvider.mSessionNodes[1].label).toEqual("sestest");
        expect(globalMocks.testJobsProvider.mSessionNodes[1].tooltip).toEqual("sestest");
    });

    it("Tests that addSession adds the session to the tree with disabled global setting", async () => {
        const globalMocks = await createGlobalMocks();
        globalMocks.mockProfileInstance.mockDisableValidationContext = globalMocks.testJobsProvider.mSessionNodes[1].contextValue += `_noValidate`;
        await globalMocks.testJobsProvider.addSession("sestest");

        expect(globalMocks.testJobsProvider.mSessionNodes[1]).toBeDefined();
        expect(globalMocks.testJobsProvider.mSessionNodes[1].label).toEqual("sestest");
        expect(globalMocks.testJobsProvider.mSessionNodes[1].contextValue).toContain(Constants.NO_VALIDATE_SUFFIX);
    });
});

describe("ZoweJobNode unit tests - Function deleteSession", () => {
    it("Tests that deleteSession removes the session from the tree", async () => {
        const globalMocks = await createGlobalMocks();
        jest.spyOn(SharedTreeProviders, "providers", "get").mockReturnValue(globalMocks.mockTreeProviders);
        globalMocks.testJobsProvider.mSessionNodes = globalMocks.mockTreeProviders.ds.mSessionNodes;
        expect(globalMocks.mockTreeProviders.ds.mSessionNodes.length).toEqual(2);
        expect(globalMocks.mockTreeProviders.uss.mSessionNodes.length).toEqual(2);
        expect(globalMocks.mockTreeProviders.job.mSessionNodes.length).toEqual(2);
        await globalMocks.testJobsProvider.deleteSession(globalMocks.testJobsProvider.mSessionNodes[1], true);
        expect(globalMocks.mockTreeProviders.ds.mSessionNodes.length).toEqual(1);
        expect(globalMocks.mockTreeProviders.uss.mSessionNodes.length).toEqual(1);
        expect(globalMocks.mockTreeProviders.job.mSessionNodes.length).toEqual(1);
    });
});

describe("ZoweJobNode unit tests - Function delete", () => {
    it("Tests that delete handles an error thrown during job deletion", async () => {
        const globalMocks = await createGlobalMocks();
        const badJobNode = new ZoweJobNode({
            label: "badJobNode",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: globalMocks.testSession,
            profile: globalMocks.testProfile,
            job: globalMocks.testIJob,
        });

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

        jest.spyOn(vscode.workspace, "getConfiguration").mockImplementationOnce(globalMocks.getConfiguration);
        await globalMocks.testJobsProvider.onDidChangeConfiguration(e);
        expect(globalMocks.getConfiguration).toHaveBeenCalled();
    });
});

describe("ZoweJobNode unit tests - Function getChildren", () => {
    it("Tests that getChildren returns the jobs of the session, when called on the session", async () => {
        const globalMocks = await createGlobalMocks();

        await globalMocks.testJobsProvider.addSession("fake");
        globalMocks.testJobsProvider.mSessionNodes[1].filtered = true;

        const jobs = await globalMocks.testJobsProvider.mSessionNodes[1].getChildren();
        expect(jobs.length).toBe(2);
        expect(jobs[0].job.jobid).toEqual(globalMocks.testIJob.jobid);
        expect(jobs[0].tooltip).toEqual("TESTJOB(JOB1234) - ACTIVE");
        expect(jobs[1].job.jobid).toEqual(globalMocks.testIJobComplete.jobid);
        expect(jobs[1].tooltip).toEqual("TESTJOB(JOB1235) - sampleMember - 0");
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

        expect(newJobs[0].label).toEqual("TESTJOB(JOB1234) - sampleMember - CC 0000");
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
        expect(jobs[0].tooltip).toEqual("TESTJOB(JOB1234) - ACTIVE");
    });

    it("Tests that getChildren returns the spool files if called on a job", async () => {
        const globalMocks = await createGlobalMocks();

        const spoolFiles = await globalMocks.testJobNode.getChildren();
        expect(spoolFiles.length).toBe(1);
        expect(spoolFiles[0].label).toEqual("STEP:STDOUT(101)");
        expect(spoolFiles[0].owner).toEqual("fake");
    });

    it("Tests that getChildren updates existing spool nodes if called again on a job", async () => {
        const globalMocks = await createGlobalMocks();

        const spoolFiles = await globalMocks.testJobNode.getChildren();
        expect(spoolFiles.length).toBe(1);
        expect(spoolFiles[0].label).toEqual("STEP:STDOUT(101)");
        expect(spoolFiles[0].owner).toEqual("fake");

        jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValueOnce({
            getSpoolFiles: jest.fn().mockReturnValueOnce([{ ...globalMocks.mockIJobFile, "record-count": 2 }]),
        } as any);
        globalMocks.testJobNode.dirty = true;
        const spoolFilesAfter = await globalMocks.testJobNode.getChildren();
        expect(spoolFilesAfter.length).toBe(1);
        expect(spoolFilesAfter[0].label).toEqual("STEP:STDOUT(101)");
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
        expect(spoolFilesAfter[0].label).toEqual("No spool files found");
    });

    it("Tests that getChildren returns empty list if there is error retrieving spool files", async () => {
        const globalMocks = await createGlobalMocks();
        jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValueOnce({
            getSpoolFiles: jest.fn().mockResolvedValue(new Error("Response Fail")),
        } as any);
        // Populate node with children from previous search to ensure they are removed
        globalMocks.testJobNode.children = [
            new ZoweSpoolNode({
                label: "old",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                session: globalMocks.testSession,
                profile: globalMocks.testProfile,
            }),
        ];
        globalMocks.testJobNode.dirty = true;
        const spools = await globalMocks.testJobNode.getChildren();
        expect(spools).toEqual([]);
    });

    it("Tests that getChildren returns the spool files if user/owner is not defined", async () => {
        const globalMocks = await createGlobalMocks();

        globalMocks.testJobsProvider.mSessionNodes[1]._owner = null;
        globalMocks.testJobsProvider.mSessionNodes[1]._prefix = "*";
        globalMocks.testJobsProvider.mSessionNodes[1]._searchId = "";
        globalMocks.testJobNode.session.ISession = globalMocks.testSessionNoCred;
        const spoolFiles = await globalMocks.testJobNode.getChildren();
        expect(spoolFiles.length).toBe(1);
        expect(spoolFiles[0].label).toEqual("STEP:STDOUT(101)");
        expect(spoolFiles[0].owner).toEqual("*");
    });

    it("should return placeholder node if session node expanded without search params", async () => {
        const globalMocks = await createGlobalMocks();
        const expectedJob = new ZoweJobNode({
            label: "Use the search button to display jobs",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: globalMocks.testJobNode,
            contextOverride: Constants.INFORMATION_CONTEXT,
        });

        globalMocks.testJobNode._owner = null;
        jest.spyOn(SharedContext, "isSession").mockReturnValueOnce(true);
        await expect(globalMocks.testJobNode.getChildren()).resolves.toEqual([expectedJob]);
    });

    it("should return 'No jobs found' if no children is found", async () => {
        const globalMocks = await createGlobalMocks();
        const job = new ZoweJobNode({
            label: "No jobs found",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: globalMocks.testJobsProvider.mSessionNodes[1],
            contextOverride: Constants.INFORMATION_CONTEXT,
        });
        await globalMocks.testJobsProvider.addSession("fake");
        globalMocks.testJobsProvider.mSessionNodes[1].filtered = true;
        jest.spyOn(globalMocks.testJobsProvider.mSessionNodes[1], "getJobs").mockResolvedValue([]);
        const jobs = await globalMocks.testJobsProvider.mSessionNodes[1].getChildren();
        expect(jobs[0]).toEqual(job);
    });

    it("should return empty list if there is error retrieving jobs", async () => {
        const globalMocks = await createGlobalMocks();
        await globalMocks.testJobsProvider.addSession("fake");
        // Populate node with children from previous search to ensure they are removed
        globalMocks.testJobsProvider.mSessionNodes[1].children = [
            new ZoweJobNode({
                label: "old",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                session: globalMocks.testSession,
                profile: globalMocks.testProfile,
            }),
        ];
        globalMocks.testJobsProvider.mSessionNodes[1].filtered = true;
        globalMocks.mockGetJobsByParameters.mockRejectedValue(new Error("Response Fail"));
        jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValueOnce({
            getSession: jest.fn().mockReturnValue(globalMocks.testSession),
        } as any);
        const jobs = await globalMocks.testJobsProvider.mSessionNodes[1].getChildren();
        expect(jobs).toEqual([]);
    });

    it("To check smfid field in Jobs Tree View", async () => {
        const globalMocks = await createGlobalMocks();

        await globalMocks.testJobsProvider.addSession("fake");
        globalMocks.testJobsProvider.mSessionNodes[1].searchId = "JOB1234";
        globalMocks.testJobsProvider.mSessionNodes[1].dirty = true;
        globalMocks.testJobsProvider.mSessionNodes[1].filtered = true;
        globalMocks.testIJob.retcode = "ACTIVE";

        const jobs = await globalMocks.testJobsProvider.mSessionNodes[1].getChildren();
        expect(jobs[0].label).toEqual("TESTJOB(JOB1234) - sampleMember - ACTIVE");
    });

    it("smfid field is not in Jobs Tree View", async () => {
        const globalMocks = await createGlobalMocks();

        await globalMocks.testJobsProvider.addSession("fake");
        globalMocks.testJobsProvider.mSessionNodes[1].searchId = "JOB1234";
        globalMocks.testJobsProvider.mSessionNodes[1].dirty = true;
        globalMocks.testJobsProvider.mSessionNodes[1].filtered = true;
        globalMocks.testIJob.retcode = "ACTIVE";
        globalMocks.testIJob["exec-member"] = "";
        const jobs = await globalMocks.testJobsProvider.mSessionNodes[1].getChildren();
        expect(jobs[0].label).toEqual("TESTJOB(JOB1234) - ACTIVE");
    });

    it("To check smfid field when return code is undefined", async () => {
        const globalMocks = await createGlobalMocks();

        await globalMocks.testJobsProvider.addSession("fake");
        globalMocks.testJobsProvider.mSessionNodes[1].searchId = "JOB1234";
        globalMocks.testJobsProvider.mSessionNodes[1].dirty = true;
        globalMocks.testJobsProvider.mSessionNodes[1].filtered = true;

        const jobs = await globalMocks.testJobsProvider.mSessionNodes[1].getChildren();
        expect(jobs[0].label).toEqual("TESTJOB(JOB1234) - ACTIVE");
    });

    it("To check Order of Spool files don't reverse when the job is Expanded and Collapsed", async () => {
        const globalMocks = await createGlobalMocks();
        globalMocks.testJobsProvider.mSessionNodes[1]._owner = null;
        globalMocks.testJobsProvider.mSessionNodes[1]._prefix = "*";
        globalMocks.testJobsProvider.mSessionNodes[1]._searchId = "";
        globalMocks.testJobNode.session.ISession = globalMocks.testSessionNoCred;
        jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValueOnce({
            getSpoolFiles: jest.fn().mockReturnValueOnce([
                { ...globalMocks.mockIJobFile, stepname: "JES2", ddname: "JESMSGLG", "record-count": 11 },
                { ...globalMocks.mockIJobFile, stepname: "JES2", ddname: "JESJCL", "record-count": 21 },
                { ...globalMocks.mockIJobFile, stepname: "JES2", ddname: "JESYSMSG", "record-count": 6 },
            ]),
        } as any);
        jest.spyOn(SharedContext, "isSession").mockReturnValueOnce(false);
        const spoolFiles = await globalMocks.testJobNode.getChildren();
        expect(spoolFiles.length).toBe(3);
        expect(spoolFiles[0].label).toBe("JES2:JESMSGLG(101)");
        expect(spoolFiles[1].label).toBe("JES2:JESJCL(101)");
        expect(spoolFiles[2].label).toBe("JES2:JESYSMSG(101)");
    });

    it("To check smfid field in Jobs Tree View", async () => {
        const globalMocks = await createGlobalMocks();

        await globalMocks.testJobsProvider.addSession("fake");
        globalMocks.testJobsProvider.mSessionNodes[1].searchId = "JOB1234";
        globalMocks.testJobsProvider.mSessionNodes[1].dirty = true;
        globalMocks.testJobsProvider.mSessionNodes[1].filtered = true;
        globalMocks.testIJob.retcode = "ACTIVE";

        const jobs = await globalMocks.testJobsProvider.mSessionNodes[1].getChildren();
        expect(jobs[0].label).toEqual("TESTJOB(JOB1234) - sampleMember - ACTIVE");
    });

    it("smfid field is not in Jobs Tree View", async () => {
        const globalMocks = await createGlobalMocks();

        await globalMocks.testJobsProvider.addSession("fake");
        globalMocks.testJobsProvider.mSessionNodes[1].searchId = "JOB1234";
        globalMocks.testJobsProvider.mSessionNodes[1].dirty = true;
        globalMocks.testJobsProvider.mSessionNodes[1].filtered = true;
        globalMocks.testIJob.retcode = "ACTIVE";
        globalMocks.testIJob["exec-member"] = "";
        const jobs = await globalMocks.testJobsProvider.mSessionNodes[1].getChildren();
        expect(jobs[0].label).toEqual("TESTJOB(JOB1234) - ACTIVE");
    });

    it("To check smfid field when return code is undefined", async () => {
        const globalMocks = await createGlobalMocks();

        await globalMocks.testJobsProvider.addSession("fake");
        globalMocks.testJobsProvider.mSessionNodes[1].searchId = "JOB1234";
        globalMocks.testJobsProvider.mSessionNodes[1].dirty = true;
        globalMocks.testJobsProvider.mSessionNodes[1].filtered = true;

        const jobs = await globalMocks.testJobsProvider.mSessionNodes[1].getChildren();
        expect(jobs[0].label).toEqual("TESTJOB(JOB1234) - ACTIVE");
    });

    it("To check Order of Spool files don't reverse when the job is Expanded and Collapsed", async () => {
        const globalMocks = await createGlobalMocks();
        globalMocks.testJobsProvider.mSessionNodes[1]._owner = null;
        globalMocks.testJobsProvider.mSessionNodes[1]._prefix = "*";
        globalMocks.testJobsProvider.mSessionNodes[1]._searchId = "";
        globalMocks.testJobNode.session.ISession = globalMocks.testSessionNoCred;
        jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValueOnce({
            getSpoolFiles: jest.fn().mockReturnValueOnce([
                { ...globalMocks.mockIJobFile, stepname: "JES2", ddname: "JESMSGLG", "record-count": 11 },
                { ...globalMocks.mockIJobFile, stepname: "JES2", ddname: "JESJCL", "record-count": 21 },
                { ...globalMocks.mockIJobFile, stepname: "JES2", ddname: "JESYSMSG", "record-count": 6 },
            ]),
        } as any);
        jest.spyOn(SharedContext, "isSession").mockReturnValueOnce(false);
        const spoolFiles = await globalMocks.testJobNode.getChildren();
        expect(spoolFiles.length).toBe(3);
        expect(spoolFiles[0].label).toBe("JES2:JESMSGLG(101)");
        expect(spoolFiles[1].label).toBe("JES2:JESJCL(101)");
        expect(spoolFiles[2].label).toBe("JES2:JESYSMSG(101)");
    });

    it("Check that jobs with duplicate DD names do not overwrite each other", async () => {
        const globalMocks = await createGlobalMocks();
        const mockSpoolOne = { ...globalMocks.mockIJobFile, stepname: "JES2", ddname: "JESMSGLG", "record-count": 11 };
        const mockSpoolTwo = { ...globalMocks.mockIJobFile, stepname: "SOMEJOB", ddname: "TEST", "record-count": 13 };
        const mockSpoolThree = { ...globalMocks.mockIJobFile, stepname: "SOMEJOB", ddname: "TEST", "record-count": 5 };

        mockSpoolOne.procstep = "TEST";
        mockSpoolTwo.id = 12;
        mockSpoolThree.id = 13;

        globalMocks.testJobsProvider.mSessionNodes[1]._owner = null;
        globalMocks.testJobsProvider.mSessionNodes[1]._prefix = "*";
        globalMocks.testJobsProvider.mSessionNodes[1]._searchId = "";
        globalMocks.testJobNode.session.ISession = globalMocks.testSessionNoCred;
        jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValueOnce({
            getSpoolFiles: jest
                .fn()
                .mockReturnValueOnce([
                    mockSpoolOne,
                    { ...globalMocks.mockIJobFile, stepname: "JES2", ddname: "JESJCL", "record-count": 21 },
                    { ...globalMocks.mockIJobFile, stepname: "JES2", ddname: "JESYSMSG", "record-count": 6 },
                    mockSpoolTwo,
                    mockSpoolThree,
                ]),
        } as any);
        jest.spyOn(SharedContext, "isSession").mockReturnValueOnce(false);
        const spoolFiles = await globalMocks.testJobNode.getChildren();
        expect(spoolFiles.length).toBe(5);
        expect(spoolFiles[0].label).toBe("JES2:JESMSGLG(101) - TEST");
        expect(spoolFiles[1].label).toBe("JES2:JESJCL(101)");
        expect(spoolFiles[2].label).toBe("JES2:JESYSMSG(101)");
        expect(spoolFiles[3].label).toBe("SOMEJOB:TEST(12)");
        expect(spoolFiles[4].label).toBe("SOMEJOB:TEST(13)");
    });
});

describe("ZoweJobNode unit tests - Function flipState", () => {
    it("Tests that flipState is executed successfully", async () => {
        const globalMocks = await createGlobalMocks();
        globalMocks.testJobsProvider.addSession("fake");
        globalMocks.testJobsProvider.mSessionNodes[1].contextValue = Constants.JOBS_SESSION_CONTEXT;
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
    function createBlockMocks(globalMocks) {
        const newMocks = {
            testJobNode: new ZoweJobNode({
                label: "MYHLQ(JOB1283) - Input",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                parentNode: globalMocks.testJobsProvider.mSessionNodes[1],
                session: globalMocks.testJobsProvider.mSessionNodes[1].getSession(),
                profile: globalMocks.testIProfile,
                job: globalMocks.testIJob,
            }),
        };

        return newMocks;
    }

    it("Tests that addFavorite successfully favorites a job", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        globalMocks.testJobsProvider.mFavorites = [];
        blockMocks.testJobNode.contextValue = Constants.JOBS_JOB_CONTEXT;

        await globalMocks.testJobsProvider.addFavorite(blockMocks.testJobNode);

        const profileNodeInFavs: IZoweJobTreeNode = globalMocks.testJobsProvider.mFavorites[0];
        const favoritedNode = profileNodeInFavs.children[0];

        expect(globalMocks.testJobsProvider.mFavorites.length).toEqual(1);
        expect(profileNodeInFavs.label).toEqual("sestest");
        expect(profileNodeInFavs.children.length).toEqual(1);
        expect(favoritedNode.label).toEqual("MYHLQ(JOB1283)");
        expect(favoritedNode.contextValue).toEqual(Constants.JOBS_JOB_CONTEXT + Constants.FAV_SUFFIX);
    });
    it("Tests that addFavorite successfully favorites a search", async () => {
        const globalMocks = await createGlobalMocks();
        createBlockMocks(globalMocks);
        globalMocks.testJobsProvider.mFavorites = [];
        globalMocks.testJobsProvider.mSessionNodes[1].owner = "myHLQ";
        globalMocks.testJobsProvider.mSessionNodes[1].prefix = "*";
        globalMocks.testJobsProvider.mSessionNodes[1].contextValue = Constants.JOBS_SESSION_CONTEXT;

        await globalMocks.testJobsProvider.addFavorite(globalMocks.testJobsProvider.mSessionNodes[1]);
        const profileNodeInFavs: IZoweJobTreeNode = globalMocks.testJobsProvider.mFavorites[0];

        expect(profileNodeInFavs.children.length).toEqual(1);
        expect(profileNodeInFavs.children[0].label).toEqual("Owner: myHLQ | Prefix: * | Status: *");
        expect(profileNodeInFavs.children[0].contextValue).toEqual(Constants.JOBS_SESSION_CONTEXT + Constants.FAV_SUFFIX);
    });
});

describe("ZoweJobNode unit tests - Function removeFavorite", () => {
    function createBlockMocks(globalMocks) {
        const newMocks = {
            testJobNode1: new ZoweJobNode({
                label: "MYHLQ(JOB1283) - Input",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                parentNode: globalMocks.testJobsProvider.mSessionNodes[1],
                session: globalMocks.testJobsProvider.mSessionNodes[1].getSession(),
                profile: globalMocks.testProfile,
                job: globalMocks.testIJob,
            }),
            testJobNode2: new ZoweJobNode({
                label: "MYHLQ(JOB1284) - Input",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                parentNode: globalMocks.testJobsProvider.mSessionNodes[1],
                session: globalMocks.testJobsProvider.mSessionNodes[1].getSession(),
                profile: globalMocks.testProfile,
                job: globalMocks.testIJob,
            }),
        };

        return newMocks;
    }

    it("Tests removeFavorite when starting with more than one favorite for the profile", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
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
        expect(removeFavProfileSpy).not.toHaveBeenCalled();
        expect(profileNodeInFavs.children.length).toEqual(1);
        expect(profileNodeInFavs.children[0].label).toBe("MYHLQ(JOB1284)");
    });
    it("Tests removeFavorite when starting with only one favorite for the profile", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
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
    function createBlockMocks(globalMocks) {
        const testSession = globalMocks.testJobsProvider.mSessionNodes[1].getSession();
        const newMocks = {
            testSession,
            testJobNode: new ZoweJobNode({
                label: "MYHLQ(JOB1283) - Input",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                parentNode: globalMocks.testJobsProvider.mSessionNodes[1],
                session: testSession,
                profile: globalMocks.testProfile,
                job: globalMocks.testIJob,
            }),
        };

        globalMocks.testJobsProvider.mFavorites = [];
        globalMocks.testJobNode.label = "MYHLQ(JOB1283) - Input";

        return newMocks;
    }

    it("Tests that saveSearch is executed successfully", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const favJob = blockMocks.testJobNode;
        favJob.owner = "myHLQ";
        favJob.prefix = "*";
        favJob.contextValue = Constants.JOBS_SESSION_CONTEXT;

        const expectedJob = favJob;
        expectedJob.contextValue = Constants.JOBS_SESSION_CONTEXT + Constants.FAV_SUFFIX;

        globalMocks.testJobsProvider.saveSearch(favJob);
        expect(expectedJob.contextValue).toEqual(favJob.contextValue);
    });
});

describe("ZoweJobNode unit tests - Function getEncodingInMap", () => {
    it("should get the encoding in the map", async () => {
        const globalMocks = await createGlobalMocks();
        JobFSProvider.instance.encodingMap["fakePath"] = { kind: "text" };
        const encoding = globalMocks.testJobNode.getEncodingInMap("fakePath");
        expect(encoding).toEqual({ kind: "text" });
    });
});

describe("ZoweJobNode unit tests - Function updateEncodingInMap", () => {
    it("should update the encoding in the map", async () => {
        const globalMocks = await createGlobalMocks();
        globalMocks.testJobNode.updateEncodingInMap("fakePath", { kind: "binary" });
        expect(JobFSProvider.instance.encodingMap["fakePath"]).toEqual({ kind: "binary" });
    });
});

describe("ZoweJobNode unit tests - Function getEncoding", () => {
    it("should update the encoding of the node", () => {
        const testNode = createJobNode(createJobSessionNode(createISession(), createIProfile()), createIProfile());
        const getEncodingForFileSpy = jest
            .spyOn(JobFSProvider.instance, "getEncodingForFile")
            .mockReturnValue({ kind: "other", codepage: "IBM-1147" });
        const encoding = testNode.getEncoding();
        expect(getEncodingForFileSpy).toHaveBeenCalledTimes(1);
        expect(getEncodingForFileSpy).toHaveBeenCalledWith(testNode.resourceUri);
        expect(encoding).toEqual({ kind: "other", codepage: "IBM-1147" });
    });
});

describe("ZoweJobNode unit tests - Function setEncoding", () => {
    const zoweLoggerTraceSpy = jest.spyOn(ZoweLogger, "trace").mockImplementation();
    const setEncodingForFileSpy = jest.spyOn(JobFSProvider.instance, "setEncodingForFile").mockImplementation();
    const existsSpy = jest.spyOn(JobFSProvider.instance, "exists");

    beforeEach(() => {
        jest.clearAllMocks();
        JobFSProvider.instance.encodingMap = {};
    });

    afterAll(() => {
        zoweLoggerTraceSpy.mockRestore();
        setEncodingForFileSpy.mockRestore();
        existsSpy.mockRestore();
    });

    it("should error if set encoding is called on a non-spool node", () => {
        const testNode = createJobNode(createJobSessionNode(createISession(), createIProfile()), createIProfile());
        const updateEncodingSpy = jest.spyOn(testNode, "updateEncodingInMap");

        testNode.dirty = false;

        let e: Error;
        try {
            testNode.setEncoding({ kind: "text" });
        } catch (err) {
            e = err;
        }

        expect(e).toBeDefined();
        expect(e.message).toEqual("Cannot set encoding for node with context job");
        expect(existsSpy).not.toHaveBeenCalled();
        expect(setEncodingForFileSpy).not.toHaveBeenCalled();
        expect(updateEncodingSpy).not.toHaveBeenCalled();
        expect(testNode.dirty).toEqual(false);
    });

    it("should error if the resource does not exist", () => {
        const testNode = new ZoweSpoolNode({ label: "SPOOL", collapsibleState: vscode.TreeItemCollapsibleState.None, spool: createIJobFile() });
        const updateEncodingSpy = jest.spyOn(testNode, "updateEncodingInMap");
        testNode.dirty = false;

        existsSpy.mockReturnValueOnce(false);

        let e: Error;
        try {
            testNode.setEncoding({ kind: "text" });
        } catch (err) {
            e = err;
        }

        expect(e).toBeDefined();
        expect(e.message).toEqual("Cannot set encoding for non-existent node");
        expect(existsSpy).toHaveBeenCalledWith(testNode.resourceUri);
        expect(setEncodingForFileSpy).not.toHaveBeenCalled();
        expect(updateEncodingSpy).not.toHaveBeenCalled();
        expect(testNode.dirty).toEqual(false);
    });

    it("should delete a null encoding from the provider", () => {
        const testParentNode = createJobNode(createJobSessionNode(createISession(), createIProfile()), createIProfile());
        const testNode = new ZoweSpoolNode({
            label: "SPOOL",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            spool: createIJobFile(),
            parentNode: testParentNode,
        });
        const updateEncodingSpy = jest.spyOn(testNode, "updateEncodingInMap").mockImplementation();
        const nodePath = testNode.resourceUri.path;

        testNode.dirty = false;
        JobFSProvider.instance.encodingMap[nodePath] = { kind: "text" };
        existsSpy.mockReturnValueOnce(true);

        let e: Error;
        try {
            testNode.setEncoding(null);
        } catch (err) {
            e = err;
        }

        expect(e).not.toBeDefined();
        expect(existsSpy).toHaveBeenCalledWith(testNode.resourceUri);
        expect(setEncodingForFileSpy).toHaveBeenCalledWith(testNode.resourceUri, null);
        expect(updateEncodingSpy).not.toHaveBeenCalled();
        expect(JobFSProvider.instance.encodingMap[nodePath]).not.toBeDefined();
        expect(testNode.dirty).toEqual(true);
    });

    it("should update the encoding in the provider map", () => {
        const testParentNode = createJobNode(createJobSessionNode(createISession(), createIProfile()), createIProfile());
        const testNode = new ZoweSpoolNode({
            label: "SPOOL",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            spool: createIJobFile(),
            parentNode: testParentNode,
        });
        const nodePath = testNode.resourceUri.path;
        const updateEncodingSpy = jest.spyOn(testNode, "updateEncodingInMap").mockImplementation();

        testNode.dirty = false;
        existsSpy.mockReturnValueOnce(true);

        let e: Error;
        try {
            testNode.setEncoding({ kind: "binary" });
        } catch (err) {
            e = err;
        }

        expect(e).not.toBeDefined();
        expect(existsSpy).toHaveBeenCalledWith(testNode.resourceUri);
        expect(setEncodingForFileSpy).toHaveBeenCalledWith(testNode.resourceUri, { kind: "binary" });
        expect(updateEncodingSpy).toHaveBeenCalledWith(nodePath, { kind: "binary" });
        expect(testNode.dirty).toEqual(true);
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
        const jobSessionNode = new ZoweJobNode({
            label: "sestest",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            profile: createIProfile(),
        });
        jobSessionNode.contextValue = Constants.JOBS_SESSION_CONTEXT + Constants.FAV_SUFFIX;
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

describe("ZosJobsProvider - getJobs", () => {
    it("should filter duplicate jobs", async () => {
        const globalMocks = await createGlobalMocks();
        Object.defineProperty(ZoweExplorerApiRegister, "getJesApi", {
            value: () => ({
                getJobsByParameters: () => ["test"],
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
        ].sort(ZoweJobNode.sortJobs({ method: Sorting.JobSortOpts.Id, direction: Sorting.SortDirection.Ascending }));
        expect(sorted[0].job.jobid).toBe("JOBID120");
        expect(sorted[1].job.jobid).toBe("JOBID120");
        expect(sorted[2].job.jobid).toBe("JOBID123");
        expect(sorted[3].job.jobid).toBe("JOBID124");
    });
});
