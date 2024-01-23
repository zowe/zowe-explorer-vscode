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
import { createJobsTree, ZosJobsProvider } from "../../../src/job/ZosJobsProvider";
import * as vscode from "vscode";
import * as zowe from "@zowe/cli";
import * as globals from "../../../src/globals";
import * as utils from "../../../src/utils/ProfilesUtils";
import { Gui, IZoweJobTreeNode, ProfilesCache, ValidProfileEnum } from "@zowe/zowe-explorer-api";
import { createIJobFile, createIJobObject, createJobFavoritesNode, createJobSessionNode, MockJobDetail } from "../../../__mocks__/mockCreators/jobs";
import { ZoweJobNode, ZoweSpoolNode } from "../../../src/job/ZoweJobNode";
import { ZoweExplorerApiRegister } from "../../../src/ZoweExplorerApiRegister";
import { Profiles } from "../../../src/Profiles";
import {
    createIProfile,
    createISession,
    createInstanceOfProfile,
    createISessionWithoutCredentials,
    createTreeView,
    createInstanceOfProfileInfo,
} from "../../../__mocks__/mockCreators/shared";
import { getIconByNode } from "../../../src/generators/icons";
import { createJesApi } from "../../../__mocks__/mockCreators/api";
import * as sessUtils from "../../../src/utils/SessionUtils";
import { jobStringValidator } from "../../../src/shared/utils";
import { ZoweLogger } from "../../../src/utils/LoggerUtils";
import { Poller } from "@zowe/zowe-explorer-api/src/utils";
import { SettingsConfig } from "../../../src/utils/SettingsConfig";
import { mocked } from "../../../__mocks__/mockUtils";
import { TreeProviders } from "../../../src/shared/TreeProviders";

jest.mock("vscode");
const showMock = jest.fn();
const onDidChangeValueMock = {
    event: (callback: (value: string) => void): vscode.Disposable => {
        const disposable = {
            dispose: jest.fn(),
        };
        callback("");
        return disposable;
    },
};
const mockInputBox: vscode.InputBox = {
    title: "",
    value: "",
    placeholder: "",
    password: false,
    onDidChangeValue: onDidChangeValueMock.event,
    onDidAccept: jest.fn(),
    show: showMock,
    hide: jest.fn(),
    dispose: jest.fn(),
    buttons: [],
    onDidTriggerButton: jest.fn(),
    prompt: "",
    validationMessage: "",
    step: 1,
    totalSteps: 100,
    enabled: true,
    busy: false,
    ignoreFocusOut: false,
    onDidHide: jest.fn(),
};
function setJobObjects(job: zowe.IJob, newJobName: string, newJobId: string, newRetCode: string, newExecMember: string | undefined) {
    job.jobname = newJobName;
    job.jobid = newJobId;
    job.retcode = newRetCode;
    job["exec-member"] = newExecMember;
    return job;
}

async function createGlobalMocks() {
    const globalMocks = {
        mockGetConfiguration: jest.fn(),
        mockGetJobs: {
            getStatusForJob: jest.fn(),
        },
        mockGetJob: jest.fn(),
        mockRefresh: jest.fn(),
        mockAffectsConfig: jest.fn(),
        createTreeView: jest.fn().mockReturnValue({ onDidCollapseElement: jest.fn() }),
        mockGetSpoolFiles: jest.fn(),
        mockDeleteJobs: jest.fn(),
        mockShowInputBox: jest.fn(),
        mockDeleteJob: jest.fn(),
        mockGetJobsByOwnerAndPrefix: jest.fn(),
        mockShowInformationMessage: jest.fn(),
        mockShowWarningMessage: jest.fn(),
        mockLoadNamedProfile: jest.fn(),
        mockCreateQuickPick: jest.fn(),
        mockLoadDefaultProfile: jest.fn(),
        mockGetJesApi: jest.fn(),
        mockShowQuickPick: jest.fn(),
        testJobsProvider: null,
        jesApi: null,
        testSession: createISession(),
        testSessionNoCred: createISessionWithoutCredentials(),
        testProfile: createIProfile(),
        testIJob: createIJobObject(),
        testIJobComplete: createIJobObject(),
        testJobNode: null,
        testSessionNode: null,
        mockIJobFile: createIJobFile(),
        mockProfileInstance: null,
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
    };
    jest.spyOn(Gui, "createTreeView").mockImplementation(globalMocks.createTreeView);
    Object.defineProperty(ProfilesCache, "getConfigInstance", {
        value: jest.fn(() => {
            return {
                usingTeamConfig: false,
            };
        }),
        configurable: true,
    });
    Object.defineProperty(ProfilesCache, "allProfiles", {
        value: [globalMocks.testProfile],
        configurable: true,
    });
    Object.defineProperty(vscode, "ProgressLocation", { value: globalMocks.ProgressLocation, configurable: true });
    Object.defineProperty(vscode.window, "withProgress", { value: globalMocks.withProgress, configurable: true });
    Object.defineProperty(zowe, "GetJobs", { value: globalMocks.mockGetJobs, configurable: true });
    Object.defineProperty(vscode.window, "showInformationMessage", {
        value: globalMocks.mockShowInformationMessage,
        configurable: true,
    });
    Object.defineProperty(vscode.window, "showWarningMessage", {
        value: globalMocks.mockShowWarningMessage,
        configurable: true,
    });
    Object.defineProperty(vscode.window, "showTextDocument", {
        value: jest.fn().mockImplementation(),
        configurable: true,
    });
    Object.defineProperty(Poller, "poll", {
        value: jest.fn(),
        configurable: true,
    });
    Object.defineProperty(globalMocks.mockGetJobs, "getJob", { value: globalMocks.mockGetJob, configurable: true });
    Object.defineProperty(globalMocks.mockGetJobs, "getJobsByOwnerAndPrefix", {
        value: globalMocks.mockGetJobsByOwnerAndPrefix,
        configurable: true,
    });
    Object.defineProperty(globalMocks.mockGetJobs, "getSpoolFiles", {
        value: globalMocks.mockGetSpoolFiles,
        configurable: true,
    });
    Object.defineProperty(vscode.window, "createInputBox", {
        value: jest.fn(() => mockInputBox),
        configurable: true,
    });

    Object.defineProperty(vscode.window, "createTreeView", { value: globalMocks.createTreeView, configurable: true });
    Object.defineProperty(vscode.window, "showQuickPick", { value: globalMocks.mockShowQuickPick, configurable: true });
    Object.defineProperty(vscode, "ConfigurationTarget", { value: globalMocks.enums, configurable: true });
    Object.defineProperty(vscode.window, "showInputBox", { value: globalMocks.mockShowInputBox, configurable: true });
    Object.defineProperty(vscode.workspace, "getConfiguration", {
        value: globalMocks.mockGetConfiguration,
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

    // Profile instance mocks
    globalMocks.mockProfileInstance = createInstanceOfProfile(globalMocks.testProfile);
    globalMocks.mockGetSpoolFiles.mockReturnValue([globalMocks.mockIJobFile]);
    globalMocks.mockLoadNamedProfile.mockReturnValue(globalMocks.testProfile);
    globalMocks.mockProfileInstance.loadNamedProfile = globalMocks.mockLoadNamedProfile;
    globalMocks.mockProfileInstance.allProfiles = [globalMocks.testProfile];
    globalMocks.mockLoadDefaultProfile.mockReturnValue(globalMocks.testProfile);
    globalMocks.mockProfileInstance.getDefaultProfile = globalMocks.mockLoadDefaultProfile;
    Object.defineProperty(Profiles, "getInstance", {
        value: jest.fn(() => globalMocks.mockProfileInstance),
        configurable: true,
    });
    Object.defineProperty(sessUtils, "removeSession", {
        value: jest.fn().mockImplementationOnce(() => Promise.resolve()),
        configurable: true,
    });

    // Jes API mocks
    globalMocks.jesApi = ZoweExplorerApiRegister.getJesApi(globalMocks.testProfile);
    globalMocks.mockGetJesApi.mockReturnValue(globalMocks.jesApi);
    ZoweExplorerApiRegister.getJesApi = globalMocks.mockGetJesApi.bind(ZoweExplorerApiRegister);

    Object.defineProperty(globals, "LOG", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals.LOG, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "debug", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "warn", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "info", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "trace", { value: jest.fn(), configurable: true });
    globalMocks.testSessionNode = createJobSessionNode(globalMocks.testSession, globalMocks.testProfile);
    globalMocks.mockGetJob.mockReturnValue(globalMocks.testIJob);
    globalMocks.mockGetJobsByOwnerAndPrefix.mockReturnValue([globalMocks.testIJob, globalMocks.testIJobComplete]);
    globalMocks.mockProfileInstance.editSession = jest.fn(() => globalMocks.testProfile);
    globalMocks.mockGetConfiguration.mockReturnValue({
        persistence: true,
        get: (setting: string) => [],
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

    return globalMocks;
}

describe("ZosJobsProvider unit tests - Function getChildren", () => {
    function createBlockMocks(globalMocks) {
        const newMocks = {
            session: createISession(),
            jobSessionNode: null,
            jobFavoritesNode: createJobFavoritesNode(),
            treeView: createTreeView(),
            testIJob: createIJobObject(),
        };
        newMocks.jobSessionNode = createJobSessionNode(newMocks.session, globalMocks.testProfile);

        return newMocks;
    }

    it("Tests that getChildren returns the Favorites and sessions when called at the root node", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new ZosJobsProvider();
        testTree.mSessionNodes.push(blockMocks.jobSessionNode);
        const targetIcon = getIconByNode(blockMocks.jobFavoritesNode);
        if (targetIcon) {
            blockMocks.jobFavoritesNode.iconPath = targetIcon.path;
        }

        const children = await testTree.getChildren();

        expect(blockMocks.jobFavoritesNode).toMatchObject(children[0]);
        expect(blockMocks.jobSessionNode).toMatchObject(children[1]);
    });
    it("Tests that getChildren returns favorites profile node when called on Favorites", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);

        const testTree = new ZosJobsProvider();
        const favoriteSessionNode = blockMocks.jobFavoritesNode;
        const favProfileNode = new ZoweJobNode({
            label: "sestest",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: favoriteSessionNode,
        });
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        testTree.mFavorites.push(favProfileNode);

        const children = await testTree.getChildren(favoriteSessionNode);

        expect(children).toEqual([favProfileNode]);
    });
    it("Tests that getChildren gets profile-loaded favorites for profile node in Favorites section ", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);

        const testTree = new ZosJobsProvider();
        const log = zowe.imperative.Logger.getAppLogger();
        const favProfileNode = new ZoweJobNode({
            label: "sestest",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.jobFavoritesNode,
        });
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        testTree.mFavorites.push(favProfileNode);
        const loadProfilesForFavoritesSpy = jest.spyOn(testTree, "loadProfilesForFavorites").mockImplementationOnce(() => Promise.resolve([]));

        await testTree.getChildren(favProfileNode);
        expect(loadProfilesForFavoritesSpy).toHaveBeenCalledWith(log, favProfileNode);
    });
    it("Tests that getChildren gets children of a session element", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);
        const testTree = new ZosJobsProvider();
        testTree.mSessionNodes.push(blockMocks.jobSessionNode);
        testTree.mSessionNodes[1].dirty = true;
        const sessionElement = testTree.mSessionNodes[1];
        const elementGetChildrenSpy = jest.spyOn(sessionElement, "getChildren");

        await testTree.getChildren(testTree.mSessionNodes[1]);

        expect(elementGetChildrenSpy).toHaveBeenCalledTimes(1);
    });
});

describe("ZosJobsProvider unit tests - Function initializeFavChildNodeForProfile", () => {
    function createBlockMocks() {
        const newMocks = {
            session: createISession(),
            imperativeProfile: createIProfile(),
            jobSessionNode: null,
            jobFavoritesNode: createJobFavoritesNode(),
        };

        newMocks.jobSessionNode = createJobSessionNode(newMocks.session, newMocks.imperativeProfile);

        return newMocks;
    }
    it("Checks that profile-less node is initiated for favorited Job", async () => {
        await createGlobalMocks();
        const blockMocks = createBlockMocks();
        const testTree = new ZosJobsProvider();

        const favProfileNode = new ZoweJobNode({
            label: "testProfile",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.jobFavoritesNode,
        });
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        const node = new ZoweJobNode({
            label: "testJob(JOB123)",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: favProfileNode,
            job: new MockJobDetail("testJob(JOB123)"),
        });
        node.contextValue = globals.JOBS_JOB_CONTEXT + globals.FAV_SUFFIX;
        node.command = { command: "zowe.zosJobsSelectjob", title: "", arguments: [node] };
        const targetIcon = getIconByNode(node);
        if (targetIcon) {
            node.iconPath = targetIcon.path;
        }

        const favChildNodeForProfile = await testTree.initializeFavChildNodeForProfile("testJob(JOB123)", globals.JOBS_JOB_CONTEXT, favProfileNode);

        expect(favChildNodeForProfile).toEqual(node);
    });
    it("Checks that profile-less node is initiated for favorited search", async () => {
        await createGlobalMocks();
        const blockMocks = createBlockMocks();
        const testTree = new ZosJobsProvider();

        const favProfileNode = new ZoweJobNode({
            label: "testProfile",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.jobFavoritesNode,
        });
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        const node = new ZoweJobNode({
            label: "Owner:USER Prefix:*",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: favProfileNode,
        });
        node.command = { command: "zowe.jobs.search", title: "", arguments: [node] };
        node.contextValue = globals.JOBS_SESSION_CONTEXT + globals.FAV_SUFFIX;
        const targetIcon = getIconByNode(node);
        if (targetIcon) {
            node.iconPath = targetIcon.path;
        }

        const favChildNodeForProfile = await testTree.initializeFavChildNodeForProfile(
            "Owner:USER Prefix:*",
            globals.JOBS_SESSION_CONTEXT,
            favProfileNode
        );

        expect(favChildNodeForProfile).toEqual(node);
    });
});

describe("ZosJobsProvider unit tests - Function loadProfilesForFavorites", () => {
    function createBlockMocks() {
        const log = zowe.imperative.Logger.getAppLogger();
        const imperativeProfile = createIProfile();
        const session = createISession();
        const jobFavoritesNode = createJobFavoritesNode();
        const jesApi = createJesApi(imperativeProfile);

        return {
            log,
            imperativeProfile,
            session,
            jobFavoritesNode,
            jesApi,
        };
    }

    it("Checks that loaded profile and session values are added to the profile grouping node in Favorites", async () => {
        await createGlobalMocks();
        const blockMocks = createBlockMocks();
        const favProfileNode = new ZoweJobNode({
            label: "testProfile",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.jobFavoritesNode,
        });
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        const testTree = new ZosJobsProvider();
        testTree.mFavorites.push(favProfileNode);
        const expectedFavProfileNode = new ZoweJobNode({
            label: "testProfile",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.jobFavoritesNode,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
        });
        expectedFavProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;

        // Mock successful loading of profile/session
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    getDefaultProfile: jest.fn(() => {
                        return blockMocks.imperativeProfile;
                    }),
                    allProfiles: [blockMocks.imperativeProfile],
                    loadNamedProfile: jest.fn(() => {
                        return blockMocks.imperativeProfile;
                    }),
                    checkCurrentProfile: jest.fn(() => {
                        return {
                            name: blockMocks.imperativeProfile.name,
                            status: "unverified",
                        };
                    }),
                    getBaseProfile: jest.fn(() => {
                        return blockMocks.imperativeProfile;
                    }),
                    validProfile: ValidProfileEnum.VALID,
                    getProfileInfo: jest.fn(() => createInstanceOfProfileInfo()),
                    fetchAllProfiles: jest.fn(() => {
                        return [{ name: "sestest" }, { name: "profile1" }, { name: "profile2" }];
                    }),
                };
            }),
        });
        Object.defineProperty(blockMocks.jesApi, "getSession", {
            value: jest.fn(() => {
                return blockMocks.session;
            }),
        });

        await testTree.loadProfilesForFavorites(blockMocks.log, favProfileNode);
        const resultFavProfileNode = testTree.mFavorites[0];

        expect(resultFavProfileNode).toEqual(expectedFavProfileNode);
    });
    it("Checks that the error is handled if profile fails to load", async () => {
        await createGlobalMocks();
        const blockMocks = createBlockMocks();
        const testTree = new ZosJobsProvider();
        const favProfileNode = new ZoweJobNode({
            label: "badTestProfile",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.jobFavoritesNode,
        });
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        testTree.mFavorites.push(favProfileNode);
        const showErrorMessageSpy = jest.spyOn(Gui, "errorMessage");

        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [blockMocks.imperativeProfile],
                    loadNamedProfile: jest.fn(() => {
                        throw new Error();
                    }),
                    getDefaultProfile: jest.fn(() => {
                        return blockMocks.imperativeProfile;
                    }),
                    getBaseProfile: jest.fn(() => {
                        return blockMocks.imperativeProfile;
                    }),
                    getProfileInfo: jest.fn(() => createInstanceOfProfileInfo()),
                    fetchAllProfiles: jest.fn(() => {
                        return [{ name: "sestest" }, { name: "profile1" }, { name: "profile2" }];
                    }),
                };
            }),
            configurable: true,
        });
        mocked(Gui.errorMessage).mockResolvedValueOnce({ title: "Remove" });
        await testTree.loadProfilesForFavorites(blockMocks.log, favProfileNode);
        expect(showErrorMessageSpy).toBeCalledTimes(1);
        showErrorMessageSpy.mockClear();
    });
    it("Checks that favorite nodes with pre-existing profile/session values continue using those values", async () => {
        await createGlobalMocks();
        const blockMocks = createBlockMocks();
        const favProfileNode = new ZoweJobNode({
            label: "testProfile",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.jobFavoritesNode,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
        });
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        const favJobNode = new ZoweJobNode({
            label: "JOBTEST(JOB1234)",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: favProfileNode,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
        });
        favJobNode.contextValue = globals.JOBS_JOB_CONTEXT + globals.FAV_SUFFIX;
        const testTree = new ZosJobsProvider();
        favProfileNode.children.push(favJobNode);
        testTree.mFavorites.push(favProfileNode);

        const expectedFavJobNode = new ZoweJobNode({
            label: "JOBTEST(JOB1234)",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: favProfileNode,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
        });
        expectedFavJobNode.contextValue = globals.JOBS_JOB_CONTEXT + globals.FAV_SUFFIX;

        await testTree.loadProfilesForFavorites(blockMocks.log, favProfileNode);
        const resultFavJobNode = testTree.mFavorites[0].children[0];

        expect(resultFavJobNode).toEqual(expectedFavJobNode);
    });
    it("Checks that profile, session, and owner from profile node in Favorites get passed to child favorites without those values", async () => {
        await createGlobalMocks();
        const blockMocks = createBlockMocks();
        const favProfileNode = new ZoweJobNode({
            label: "testProfile",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.jobFavoritesNode,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
        });
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        // Leave mParent parameter undefined for favJobNode and expectedFavPdsNode to test undefined profile/session condition
        const favJobNode = new ZoweJobNode({ label: "JOBTEST(JOB1234)", collapsibleState: vscode.TreeItemCollapsibleState.Collapsed });
        favJobNode.contextValue = globals.JOBS_JOB_CONTEXT + globals.FAV_SUFFIX;
        const testTree = new ZosJobsProvider();
        favProfileNode.children.push(favJobNode);
        testTree.mFavorites.push(favProfileNode);
        const expectedFavJobNode = new ZoweJobNode({
            label: "JOBTEST(JOB1234)",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
        });
        expectedFavJobNode.contextValue = globals.JOBS_JOB_CONTEXT + globals.FAV_SUFFIX;

        await testTree.loadProfilesForFavorites(blockMocks.log, favProfileNode);
        const resultFavJobNode = testTree.mFavorites[0].children[0];

        expect(resultFavJobNode).toEqual(expectedFavJobNode);
    });
});

describe("ZosJobsProvider unit tests - Function removeFavProfile", () => {
    async function createBlockMocks(globalMocks) {
        globalMocks.testJobsProvider.mFavorites = [];
        const testJobNode = new ZoweJobNode({
            label: "MYHLQ(JOB1283) - Input",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: globalMocks.testJobsProvider.mSessionNodes[1],
            session: globalMocks.testJobsProvider.mSessionNodes[1].getSession(),
            profile: globalMocks.testProfile,
            job: globalMocks.testIJob,
        });
        await globalMocks.testJobsProvider.addFavorite(testJobNode);
        const profileNodeInFavs: IZoweJobTreeNode = globalMocks.testJobsProvider.mFavorites[0];
        const newMocks = {
            profileNodeInFavs,
        };

        return newMocks;
    }
    it("Tests successful removal of profile node in Favorites when user confirms they want to Continue removing it", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const updateFavoritesSpy = jest.spyOn(globalMocks.testJobsProvider, "updateFavorites");
        // Make sure favorite is added before the actual unit test
        expect(globalMocks.testJobsProvider.mFavorites.length).toEqual(1);

        globalMocks.mockShowWarningMessage.mockResolvedValueOnce("Continue");
        await globalMocks.testJobsProvider.removeFavProfile(blockMocks.profileNodeInFavs.label, true);

        // Check that favorite is removed from UI
        expect(globalMocks.testJobsProvider.mFavorites.length).toEqual(0);
        // Check that favorite is removed from settings file
        expect(updateFavoritesSpy).toBeCalledTimes(1);
    });
    it("Tests that removeFavProfile leaves profile node in Favorites when user cancels", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        // Make sure favorite is added before the actual unit test
        expect(globalMocks.testJobsProvider.mFavorites.length).toEqual(1);

        const expectedFavProfileNode = globalMocks.testJobsProvider.mFavorites[0];
        globalMocks.mockShowWarningMessage.mockResolvedValueOnce("Cancel");

        await globalMocks.testJobsProvider.removeFavProfile(blockMocks.profileNodeInFavs.label, true);

        expect(globalMocks.testJobsProvider.mFavorites.length).toEqual(1);
        expect(globalMocks.testJobsProvider.mFavorites[0]).toEqual(expectedFavProfileNode);
    });
    it("Tests that removeFavProfile successfully removes profile node in Favorites when called outside user command", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        // Make sure favorite is added before the actual unit test
        expect(globalMocks.testJobsProvider.mFavorites.length).toEqual(1);

        await globalMocks.testJobsProvider.removeFavProfile(blockMocks.profileNodeInFavs.label, false);

        expect(globalMocks.testJobsProvider.mFavorites.length).toEqual(0);
    });
});

describe("ZosJobsProvider unit tests - Function delete", () => {
    const createTestJob = async (globalMocks) => {
        globalMocks.testJobsProvider.mFavorites = [];
        const testJobNode = new ZoweJobNode({
            label: "IEFBR14(JOB1234) - CC 0000",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: globalMocks.testJobsProvider.mSessionNodes[1],
            session: globalMocks.testJobsProvider.mSessionNodes[1].getSession(),
            profile: globalMocks.testProfile,
            job: globalMocks.testIJob,
        });
        return testJobNode;
    };

    it("Removes a job node from session parent and refreshes job provider", async () => {
        const globalMocks = await createGlobalMocks();
        const testJob = await createTestJob(globalMocks);

        const deleteSpy = jest.spyOn(globalMocks.testJobsProvider, "delete");
        const removeFavoriteSpy = jest.spyOn(globalMocks.testJobsProvider, "removeFavorite");
        const refreshSpy = jest.spyOn(globalMocks.testJobsProvider, "refresh");

        await globalMocks.testJobsProvider.delete(testJob);
        expect(deleteSpy).toHaveBeenCalledWith(testJob);
        expect(removeFavoriteSpy).toHaveBeenCalledWith(testJob);
        expect(globalMocks.testJobsProvider.mSessionNodes[1]).not.toContain(testJob);
        expect(refreshSpy).toHaveBeenCalled();
    });
});

describe("ZosJobsProvider Unit Tests - Function findEquivalentNode()", () => {
    it("Testing that findEquivalentNode() returns the corresponding nodes", async () => {
        const globalMocks = await createGlobalMocks();
        const favNodeParent = new ZoweJobNode({
            label: "sestest",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            parentNode: globalMocks.testJobsProvider.mSessionNodes[0],
            session: globalMocks.testJobsProvider.mSessionNodes[0].getSession(),
            profile: globalMocks.testProfile,
        });
        const favNode = new ZoweJobNode({
            label: "exampleName",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            session: favNodeParent.getSession(),
            profile: globalMocks.testProfile,
            job: globalMocks.testIJob,
        });
        favNode.contextValue = globals.JOBS_JOB_CONTEXT + globals.FAV_SUFFIX;
        favNodeParent.children.push(favNode);
        // Create a copy of the above job object to designate as a non-favorited node
        const nonFavNode = new ZoweJobNode({
            label: "exampleName",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            session: globalMocks.testSession,
            profile: globalMocks.testProfile,
            job: globalMocks.testIJob,
        });
        nonFavNode.contextValue = globals.JOBS_JOB_CONTEXT;

        globalMocks.testJobsProvider.mFavorites.push(favNodeParent);
        globalMocks.testJobsProvider.mSessionNodes[0].children.push(favNodeParent);
        globalMocks.testJobsProvider.mSessionNodes[1].children.push(nonFavNode);

        expect(globalMocks.testJobsProvider.findEquivalentNode(favNode, true)).toStrictEqual(nonFavNode);
        expect(globalMocks.testJobsProvider.findEquivalentNode(nonFavNode, false)).toStrictEqual(favNode);
    });
});

describe("ZosJobsProvider Unit Tests - unimplemented functions", () => {
    it("Testing that each unimplemented function throws an error", async () => {
        const globalMocks = await createGlobalMocks();

        const unimplementedFns = [
            globalMocks.testJobsProvider.rename,
            globalMocks.testJobsProvider.open,
            globalMocks.testJobsProvider.copy,
            globalMocks.testJobsProvider.paste,
            globalMocks.testJobsProvider.saveFile,
            globalMocks.testJobsProvider.refreshPS,
            globalMocks.testJobsProvider.uploadDialog,
        ];

        for (const fn of unimplementedFns) {
            try {
                fn(undefined);
            } catch (e) {
                expect(e.message).toEqual("Method not implemented.");
            }
        }
    });
});

describe("ZosJobsProvider unit tests - Function getUserJobsMenuChoice", () => {
    let showInformationMessage;
    let globalMocks;
    beforeEach(async () => {
        globalMocks = await createGlobalMocks();
        showInformationMessage = jest.spyOn(Gui, "showMessage");
        globalMocks.mockCreateQuickPick.mockReturnValue({
            show: () => Promise.resolve(undefined),
            hide: () => Promise.resolve(undefined),
            onDidAccept: () => Promise.resolve(undefined),
            onDidHide: () => Promise.resolve(undefined),
        });
        jest.spyOn(globalMocks.testJobsProvider.mHistory, "getSearchHistory").mockReturnValue(["JobId:123"]);
    });
    it("should return undefined and warn if user did not select a menu", async () => {
        jest.spyOn(Gui, "resolveQuickPick").mockReturnValue(undefined);
        const result = await globalMocks.testJobsProvider.getUserJobsMenuChoice();
        expect(result).toEqual(undefined);
        expect(showInformationMessage).toHaveBeenCalled();
        showInformationMessage.mockClear();
    });
    it("should return user menu choice and not show vscode warning", async () => {
        const menuItem = new utils.FilterItem({ text: "searchById" });
        jest.spyOn(Gui, "resolveQuickPick").mockReturnValue(Promise.resolve(menuItem));
        const result = await globalMocks.testJobsProvider.getUserJobsMenuChoice();
        expect(result).toEqual(menuItem);
        expect(showInformationMessage).not.toHaveBeenCalled();
        showInformationMessage.mockClear();
    });
});

describe("ZosJobsProvider unit tests - Function getUserSearchQueryInput", () => {
    let globalMocks;
    let handleEditingMultiJobParameters;
    let handleSearchByJobId;
    beforeEach(async () => {
        globalMocks = await createGlobalMocks();
        handleEditingMultiJobParameters = jest.spyOn(globalMocks.testJobsProvider, "handleEditingMultiJobParameters");
        handleSearchByJobId = jest.spyOn(globalMocks.testJobsProvider, "handleSearchByJobId");
    });
    it("should call handleEditingMultiJobParameters if user chose QuerySearch menu", async () => {
        const multiSearchMenu = new utils.FilterItem({
            text: "Create search query",
            menuType: globals.JobPickerTypes.QuerySearch,
        });
        await globalMocks.testJobsProvider.getUserSearchQueryInput(multiSearchMenu, globalMocks.testJobsProvider.mSessionNodes[1]);
        expect(handleEditingMultiJobParameters).toHaveBeenCalled();
    });
    it("should call handleSearchByJobId if user chose IdSearch menu", async () => {
        const multiSearchMenu = new utils.FilterItem({
            text: "Create search query",
            menuType: globals.JobPickerTypes.IdSearch,
        });
        await globalMocks.testJobsProvider.getUserSearchQueryInput(multiSearchMenu, globalMocks.testJobsProvider.mSessionNodes[1]);
        expect(handleEditingMultiJobParameters).not.toHaveBeenCalled();
        expect(handleSearchByJobId).toHaveBeenCalled();
    });
    it("should call handleSearchByJobId if user chose History item with job id", async () => {
        const multiSearchMenu = new utils.FilterItem({
            text: "Create search query",
            menuType: globals.JobPickerTypes.History,
        });

        jest.spyOn(globalMocks.testJobsProvider, "parseJobSearchQuery").mockReturnValue({
            Owner: undefined,
            Prefix: undefined,
            JobId: "123",
            Status: undefined,
        });
        await globalMocks.testJobsProvider.getUserSearchQueryInput(multiSearchMenu, globalMocks.testJobsProvider.mSessionNodes[1]);
        expect(handleEditingMultiJobParameters).not.toHaveBeenCalled();
        expect(handleSearchByJobId).toHaveBeenCalled();
    });
    it("should call handleEditingMultiJobParameters if user chose History item with query", async () => {
        const multiSearchMenu = new utils.FilterItem({
            text: "Create search query",
            menuType: globals.JobPickerTypes.History,
        });

        jest.spyOn(globalMocks.testJobsProvider, "parseJobSearchQuery").mockReturnValue({
            Owner: "zowe",
            Prefix: undefined,
            JobId: undefined,
            Status: "ACTIVE",
        });
        await globalMocks.testJobsProvider.getUserSearchQueryInput(multiSearchMenu, globalMocks.testJobsProvider.mSessionNodes[1]);
        expect(handleEditingMultiJobParameters).toHaveBeenCalled();
        expect(handleSearchByJobId).not.toHaveBeenCalled();
    });
    it("should return undefined if no user choice was made", async () => {
        const result = await globalMocks.testJobsProvider.getUserSearchQueryInput(undefined, globalMocks.testJobsProvider.mSessionNodes[1]);
        expect(handleEditingMultiJobParameters).not.toHaveBeenCalled();
        expect(handleSearchByJobId).not.toHaveBeenCalled();
        expect(result).toEqual(undefined);
    });
    it("tests handleEditingMultiJobParameters default case", async () => {
        globalMocks.mockShowQuickPick.mockReturnValueOnce({ label: "Job Prefix" });
        mocked(vscode.window.showInputBox).mockImplementation((options) => {
            options.value = "test";
            options.validateInput("test");
            return Promise.resolve("test");
        });
        const jobProps = [
            {
                key: `owner`,
                label: `Job Owner`,
                value: "owner",
                show: true,
                placeHolder: `enter placeholder`,
            },
            {
                key: `prefix`,
                label: `Job Prefix`,
                value: "job*",
                show: true,
                placeHolder: `Enter job prefix`,
                validateInput: () => (text) => jobStringValidator(text, "prefix"),
            },
            {
                key: `key`,
                label: `label`,
                value: "value",
                show: false,
                placeHolder: `placeholder`,
            },
        ];

        expect(await globalMocks.testJobsProvider.handleEditingMultiJobParameters(jobProps, globalMocks.testJobsProvider.mSessionNodes[0])).toEqual(
            undefined
        );
    });
});

describe("ZosJobsProvider unit tests - Function getPopulatedPickerArray", () => {
    it("should return picker option with prefilled query", async () => {
        const globalMocks = await createGlobalMocks();
        const parsedHistoryObj = {
            Owner: "kristina",
            Prefix: "job*",
            JobId: undefined,
            Status: "output",
        };

        const actualPickerObj = globalMocks.testJobsProvider.getPopulatedPickerValues(parsedHistoryObj);
        const expectedObj = [
            {
                key: `owner`,
                label: `Job Owner`,
                value: "kristina",
                show: true,
                placeHolder: `Enter job owner ID`,
                validateInput: (text) => jobStringValidator(text, "owner"),
            },
            {
                key: `prefix`,
                label: `Job Prefix`,
                value: "job*",
                show: true,
                placeHolder: `Enter job prefix`,
                validateInput: (text) => jobStringValidator(text, "prefix"),
            },
            {
                key: `job-status`,
                label: `Job Status`,
                value: "output",
                show: true,
                placeHolder: `Enter job status`,
            },
        ];
        expect(JSON.stringify(actualPickerObj)).toEqual(JSON.stringify(expectedObj));
    });
});

describe("ZosJobsProvider unit tests - function pollData", () => {
    jest.useFakeTimers();
    it("correctly toggles polling on and off", async () => {
        const globalMocks = await createGlobalMocks();
        const testJobNode = new ZoweJobNode({
            label: "SOME(JOBNODE) - Input",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: globalMocks.testJobsProvider.mSessionNodes[1],
            session: globalMocks.testJobsProvider.mSessionNodes[1].getSession(),
            profile: globalMocks.testProfile,
            job: globalMocks.testIJob,
        });
        const spoolNode = new ZoweSpoolNode({
            label: "exampleSpool",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: testJobNode,
            session: globalMocks.testSession,
            job: globalMocks.testIJob,
            spool: globalMocks.mockIJobFile,
        });

        // Case 1: pollData called, polling dialog is dismissed
        const getDirectValueSpy = jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValueOnce(0);
        const inputBoxSpy = jest.spyOn(Gui, "showInputBox").mockResolvedValueOnce(undefined);
        await globalMocks.testJobsProvider.pollData(spoolNode);
        // Poll requests should be empty
        expect(Poller.pollRequests).toStrictEqual({});

        // Case 2: pollData called, user provides poll interval in input box
        getDirectValueSpy.mockReturnValueOnce(5000);
        inputBoxSpy.mockResolvedValueOnce("5000");
        await globalMocks.testJobsProvider.pollData(spoolNode);
        expect(Poller.pollRequests).not.toStrictEqual({});

        // Case 3: pollData called again to turn polling off
        await globalMocks.testJobsProvider.pollData(spoolNode);

        // Case 4: pollData called with invalid node (verify spool file context check)
        await globalMocks.testJobsProvider.pollData(testJobNode);
    });

    it("properly validates the user-provided polling interval", async () => {
        const globalMocks = await createGlobalMocks();

        // a string is not a valid number, should return desc. for a valid polling interval
        expect(globalMocks.testJobsProvider.validatePollInterval("string that should be a number")).toStrictEqual(
            "The polling interval must be greater than or equal to 1000ms."
        );
        // number < 1000 should also return the desc. for a valid polling interval
        expect(globalMocks.testJobsProvider.validatePollInterval("999")).toStrictEqual(
            "The polling interval must be greater than or equal to 1000ms."
        );
        // number >= 1000 should be undefined
        expect(globalMocks.testJobsProvider.validatePollInterval("1000")).toStrictEqual(undefined);
        expect(globalMocks.testJobsProvider.validatePollInterval("1001")).toStrictEqual(undefined);
    });
});

describe("Jobs utils unit tests - Function jobStringValidator", () => {
    it("should return null with correct input", async () => {
        const validOpts: [string, "owner" | "prefix"][] = [
            ["job*", "prefix"],
            ["owner*", "owner"],
        ];

        validOpts.forEach((validOpt) => expect(jobStringValidator(validOpt[0], validOpt[1])).toBeNull());
    });
    it("should return invalid string with invalid input", async () => {
        const invalidOpts: [string, "owner" | "prefix"][] = [
            ["invalidowner", "owner"],
            ["job1234567*", "prefix"],
        ];
        invalidOpts.forEach((invalidOpt) => expect(jobStringValidator(invalidOpt[0], invalidOpt[1])).toContain("Invalid"));
    });
});

describe("removeSearchHistory", () => {
    it("removes the search item passed in from the current history", () => {
        const tree = new ZosJobsProvider();
        tree.addSearchHistory("test");
        expect(tree["mHistory"]["mSearchHistory"].length).toEqual(1);
        tree.removeSearchHistory("test");
        expect(tree["mHistory"]["mSearchHistory"].length).toEqual(0);
    });
});

describe("resetSearchHistory", () => {
    it("clears the entire search history", () => {
        const tree = new ZosJobsProvider();
        tree.addSearchHistory("test1");
        tree.addSearchHistory("test2");
        tree.addSearchHistory("test3");
        tree.addSearchHistory("test4");
        expect(tree["mHistory"]["mSearchHistory"].length).toEqual(4);
        tree.resetSearchHistory();
        expect(tree["mHistory"]["mSearchHistory"].length).toEqual(0);
    });
});

describe("getSessions", () => {
    it("gets all the available sessions from persistent object", () => {
        const tree = new ZosJobsProvider();
        tree["mHistory"]["mSessions"] = ["sestest"];
        expect(tree.getSessions()).toEqual(["sestest"]);
    });
});

describe("getFileHistory", () => {
    it("gets all the file history from persistent object", () => {
        const tree = new ZosJobsProvider();
        tree["mHistory"]["mFileHistory"] = ["test1", "test2", "test3"];
        expect(tree.getFileHistory()).toEqual(["test1", "test2", "test3"]);
    });
});

describe("getFavorites", () => {
    it("gets all the favorites from persistent object", () => {
        const tree = new ZosJobsProvider();
        jest.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
            get: () => ["test1", "test2", "test3"],
        } as any);
        expect(tree.getFavorites()).toEqual(["test1", "test2", "test3"]);
    });
});

describe("ZosJobsProvider Unit Test - Filter Jobs", () => {
    const node1: IZoweJobTreeNode = new ZoweJobNode({
        label: "node1",
        collapsibleState: vscode.TreeItemCollapsibleState.None,
        job: setJobObjects(createIJobObject(), "ZOWEUSR1", "JOB04945", "CC 0000", "IPO1"),
    });
    const node2: IZoweJobTreeNode = new ZoweJobNode({
        label: "node2",
        collapsibleState: vscode.TreeItemCollapsibleState.None,
        job: setJobObjects(createIJobObject(), "ZOWEUSR2", "JOB05037", "CC 0000", undefined),
    });
    const node3: IZoweJobTreeNode = new ZoweJobNode({
        label: "node3",
        collapsibleState: vscode.TreeItemCollapsibleState.None,
        job: setJobObjects(createIJobObject(), "ZOWEUSR3", "TSU07707", "ABEND S222", "IPO3"),
    });

    let globalMocks;
    beforeEach(async () => {
        globalMocks = await createGlobalMocks();
        const mockTreeProvider = {
            refresh: jest.fn(),
        } as any;
        jest.spyOn(TreeProviders, "job", "get").mockReturnValue(mockTreeProvider);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.resetAllMocks();
        jest.clearAllMocks();
    });

    it("To show showInformationMessage", async () => {
        const testTree = new ZosJobsProvider();
        node1.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        const infoMessageSpy = jest.spyOn(Gui, "infoMessage");
        await testTree.filterJobsDialog(node1);
        expect(infoMessageSpy).toHaveBeenCalled();
    });

    it("To filter jobs based on a combination of JobName, JobId and Return code", async () => {
        const testTree = new ZosJobsProvider();
        node1.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        node1.children = [node2, node3];
        const createInputBoxSpy = jest.spyOn(vscode.window, "createInputBox");
        mockInputBox.value = "ZOWEUSR2(JOB05037) - CC 0000";
        createInputBoxSpy.mockReturnValue(mockInputBox);
        globalMocks.mockShowQuickPick.mockReturnValueOnce("Go to Local Filtering");
        const filterJobsSpy = jest.spyOn(testTree, "filterJobsDialog");
        await testTree.filterJobsDialog(node1);
        expect(filterJobsSpy).toHaveBeenCalled();
        expect(filterJobsSpy).toBeCalledWith(node1);
        expect(filterJobsSpy.mock.calls[0][0].children[0].job.jobname).toBe("ZOWEUSR2");
    });

    it("To check Clear filter for profile", async () => {
        const testTree = new ZosJobsProvider();
        node1.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        node1.children = [node2, node3];
        const createInputBoxSpy = jest.spyOn(vscode.window, "createInputBox");
        mockInputBox.value = "ZOWEUSR2(JOB05037) - CC 0000";
        createInputBoxSpy.mockReturnValue(mockInputBox);
        globalMocks.mockShowQuickPick.mockReturnValueOnce("$(clear-all) Clear filter for profile");
        const filterJobsSpy = jest.spyOn(testTree, "filterJobsDialog");
        await testTree.filterJobsDialog(node1);
        expect(filterJobsSpy).toHaveBeenCalled();
        expect(filterJobsSpy).toBeCalledWith(node1);
    });
});

describe("onDidCloseTextDocument", () => {
    it("sets the entry in openFiles record to null if Spool URI is valid", async () => {
        const doc = { uri: { scheme: "zosspool", path: "JOB12345.SPOOL1.SYSOUT" } } as vscode.TextDocument;
        await createGlobalMocks();
        const tree = new ZosJobsProvider();

        jest.spyOn(TreeProviders, "job", "get").mockReturnValue(tree);
        ZosJobsProvider.onDidCloseTextDocument(doc);
        expect(tree.openFiles[doc.uri.path]).toBeNull();
    });
});
