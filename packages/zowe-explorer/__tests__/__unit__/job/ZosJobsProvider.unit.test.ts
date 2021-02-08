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
import { createJobsTree, ZosJobsProvider } from "../../../src/job/ZosJobsProvider";
import * as vscode from "vscode";
import * as zowe from "@zowe/cli";
import * as globals from "../../../src/globals";
import { Logger } from "@zowe/imperative";
import { IZoweJobTreeNode, ValidProfileEnum } from "@zowe/zowe-explorer-api";
import {
    createIJobFile,
    createIJobObject,
    createJobFavoritesNode,
    createJobSessionNode,
    MockJobDetail,
} from "../../../__mocks__/mockCreators/jobs";
import { Job } from "../../../src/job/ZoweJobNode";
import { ZoweExplorerApiRegister } from "../../../src/ZoweExplorerApiRegister";
import { Profiles } from "../../../src/Profiles";
import * as utils from "../../../src/utils/ProfilesUtils";
import {
    createIProfile,
    createISession,
    createInstanceOfProfile,
    createISessionWithoutCredentials,
    createTreeView,
} from "../../../__mocks__/mockCreators/shared";
import { getIconByNode } from "../../../src/generators/icons";
import { createJesApi } from "../../../__mocks__/mockCreators/api";

async function createGlobalMocks() {
    const globalMocks = {
        mockGetConfiguration: jest.fn(),
        mockGetJobs: jest.fn(),
        mockGetJob: jest.fn(),
        mockRefresh: jest.fn(),
        mockAffectsConfig: jest.fn(),
        createTreeView: jest.fn(),
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
    Object.defineProperty(globalMocks.mockGetJobs, "getSpoolFiles", {
        value: globalMocks.mockGetSpoolFiles,
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

    // Profile instance mocks
    globalMocks.mockProfileInstance = createInstanceOfProfile(globalMocks.testProfile);
    globalMocks.mockGetSpoolFiles.mockReturnValue([globalMocks.mockIJobFile]);
    globalMocks.mockLoadNamedProfile.mockReturnValue(globalMocks.testProfile);
    globalMocks.mockProfileInstance.loadNamedProfile = globalMocks.mockLoadNamedProfile;
    globalMocks.mockLoadDefaultProfile.mockReturnValue(globalMocks.testProfile);
    globalMocks.mockProfileInstance.getDefaultProfile = globalMocks.mockLoadDefaultProfile;

    // Jes API mocks
    globalMocks.jesApi = ZoweExplorerApiRegister.getJesApi(globalMocks.testProfile);
    globalMocks.mockGetJesApi.mockReturnValue(globalMocks.jesApi);
    ZoweExplorerApiRegister.getJesApi = globalMocks.mockGetJesApi.bind(ZoweExplorerApiRegister);

    globalMocks.createTreeView.mockReturnValue("testTreeView");
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
    globalMocks.testJobsProvider = await createJobsTree(Logger.getAppLogger());
    globalMocks.testJobsProvider.mSessionNodes.push(globalMocks.testSessionNode);
    Object.defineProperty(globalMocks.testJobsProvider, "refresh", {
        value: globalMocks.mockRefresh,
        configurable: true,
    });

    return globalMocks;
}

// Idea is borrowed from: https://github.com/kulshekhar/ts-jest/blob/master/src/util/testing.ts
const mocked = <T extends (...args: any[]) => any>(fn: T): jest.Mock<ReturnType<T>> => fn as any;

describe("ZosJobsProvider unit tests - Function getChildren", () => {
    function createBlockMocks() {
        const imperativeProfile = createIProfile();
        const profile = createInstanceOfProfile(imperativeProfile);
        const session = createISession();
        const jobSessionNode = createJobSessionNode(session, imperativeProfile);
        const jobFavoritesNode = createJobFavoritesNode();
        const treeView = createTreeView();
        const testIJob = createIJobObject();

        return {
            profile,
            session,
            jobSessionNode,
            jobFavoritesNode,
            treeView,
            testIJob,
        };
    }

    it("Tests that getChildren returns the Favorites and sessions when called at the root node", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
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
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);

        const testTree = new ZosJobsProvider();
        const favoriteSessionNode = blockMocks.jobFavoritesNode;
        const favProfileNode = new Job(
            "sestest",
            vscode.TreeItemCollapsibleState.Collapsed,
            favoriteSessionNode,
            null,
            null,
            null
        );
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        testTree.mFavorites.push(favProfileNode);

        const children = await testTree.getChildren(favoriteSessionNode);

        expect(children).toEqual([favProfileNode]);
    });
    it("Tests that getChildren gets profile-loaded favorites for profile node in Favorites section ", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(vscode.window.createTreeView).mockReturnValueOnce(blockMocks.treeView);

        const testTree = new ZosJobsProvider();
        const log = Logger.getAppLogger();
        const favProfileNode = new Job(
            "sestest",
            vscode.TreeItemCollapsibleState.Collapsed,
            blockMocks.jobFavoritesNode,
            null,
            null,
            null
        );
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        testTree.mFavorites.push(favProfileNode);

        const loadProfilesForFavoritesSpy = jest.spyOn(testTree, "loadProfilesForFavorites");

        await testTree.getChildren(favProfileNode);

        expect(loadProfilesForFavoritesSpy).toHaveBeenCalledWith(log, favProfileNode);
    });
    it("Tests that getChildren gets children of a session element", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profile);
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
        const session = createISession();
        const imperativeProfile = createIProfile();
        const jobSessionNode = createJobSessionNode(session, imperativeProfile);
        const jobFavoritesNode = createJobFavoritesNode();

        return {
            imperativeProfile,
            session,
            jobSessionNode,
            jobFavoritesNode,
        };
    }
    it("Checks that profile-less node is initiated for favorited Job", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const testTree = new ZosJobsProvider();

        const favProfileNode = new Job(
            "testProfile",
            vscode.TreeItemCollapsibleState.Collapsed,
            blockMocks.jobFavoritesNode,
            null,
            null,
            null
        );
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        const node = new Job(
            "testJob(JOB123)",
            vscode.TreeItemCollapsibleState.Collapsed,
            favProfileNode,
            null,
            new MockJobDetail("testJob(JOB123)"),
            null
        );
        node.contextValue = globals.JOBS_JOB_CONTEXT + globals.FAV_SUFFIX;
        node.command = { command: "zowe.zosJobsSelectjob", title: "", arguments: [node] };
        const targetIcon = getIconByNode(node);
        if (targetIcon) {
            node.iconPath = targetIcon.path;
        }

        const favChildNodeForProfile = await testTree.initializeFavChildNodeForProfile(
            "testJob(JOB123)",
            globals.JOBS_JOB_CONTEXT,
            favProfileNode
        );

        expect(favChildNodeForProfile).toEqual(node);
    });
    it("Checks that profile-less node is initiated for favorited search", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const testTree = new ZosJobsProvider();

        const favProfileNode = new Job(
            "testProfile",
            vscode.TreeItemCollapsibleState.Collapsed,
            blockMocks.jobFavoritesNode,
            null,
            null,
            null
        );
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        const node = new Job(
            "Owner:USER Prefix:*",
            vscode.TreeItemCollapsibleState.None,
            favProfileNode,
            null,
            null,
            null
        );
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
        const log = Logger.getAppLogger();
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
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const favProfileNode = new Job(
            "testProfile",
            vscode.TreeItemCollapsibleState.Collapsed,
            blockMocks.jobFavoritesNode,
            null,
            null,
            null
        );
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        const testTree = new ZosJobsProvider();
        testTree.mFavorites.push(favProfileNode);
        const expectedFavProfileNode = new Job(
            "testProfile",
            vscode.TreeItemCollapsibleState.Collapsed,
            blockMocks.jobFavoritesNode,
            blockMocks.session,
            null,
            blockMocks.imperativeProfile
        );
        expectedFavProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;

        // Mock successful loading of profile/session
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    loadNamedProfile: jest.fn(() => {
                        return blockMocks.imperativeProfile;
                    }),
                    checkCurrentProfile: jest.fn(() => {
                        return {
                            name: blockMocks.imperativeProfile.name,
                            status: "unverified",
                        };
                    }),
                    validProfile: ValidProfileEnum.VALID,
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
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const testTree = new ZosJobsProvider();
        const favProfileNode = new Job(
            "badTestProfile",
            vscode.TreeItemCollapsibleState.Collapsed,
            blockMocks.jobFavoritesNode,
            null,
            null,
            null
        );
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        testTree.mFavorites.push(favProfileNode);
        const errorHandlingSpy = jest.spyOn(utils, "errorHandling");

        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    loadNamedProfile: jest.fn(() => {
                        throw new Error();
                    }),
                };
            }),
        });

        await testTree.loadProfilesForFavorites(blockMocks.log, favProfileNode);

        expect(errorHandlingSpy).toBeCalledTimes(1);
    });
    it("Checks that favorite nodes with pre-existing profile/session values continue using those values", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const favProfileNode = new Job(
            "testProfile",
            vscode.TreeItemCollapsibleState.Collapsed,
            blockMocks.jobFavoritesNode,
            blockMocks.session,
            null,
            blockMocks.imperativeProfile
        );
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        const favJobNode = new Job(
            "JOBTEST(JOB1234)",
            vscode.TreeItemCollapsibleState.Collapsed,
            favProfileNode,
            blockMocks.session,
            null,
            blockMocks.imperativeProfile
        );
        favJobNode.contextValue = globals.JOBS_JOB_CONTEXT + globals.FAV_SUFFIX;
        const testTree = new ZosJobsProvider();
        favProfileNode.children.push(favJobNode);
        testTree.mFavorites.push(favProfileNode);

        const expectedFavJobNode = new Job(
            "JOBTEST(JOB1234)",
            vscode.TreeItemCollapsibleState.Collapsed,
            favProfileNode,
            blockMocks.session,
            null,
            blockMocks.imperativeProfile
        );
        expectedFavJobNode.contextValue = globals.JOBS_JOB_CONTEXT + globals.FAV_SUFFIX;

        await testTree.loadProfilesForFavorites(blockMocks.log, favProfileNode);
        const resultFavJobNode = testTree.mFavorites[0].children[0];

        expect(resultFavJobNode).toEqual(expectedFavJobNode);
    });
    it("Checks that profile, session, and owner from profile node in Favorites get passed to child favorites without those values", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const favProfileNode = new Job(
            "testProfile",
            vscode.TreeItemCollapsibleState.Collapsed,
            blockMocks.jobFavoritesNode,
            blockMocks.session,
            null,
            blockMocks.imperativeProfile
        );
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        // Leave mParent parameter undefined for favJobNode and expectedFavPdsNode to test undefined profile/session condition
        const favJobNode = new Job(
            "JOBTEST(JOB1234)",
            vscode.TreeItemCollapsibleState.Collapsed,
            null,
            null,
            null,
            null
        );
        favJobNode.contextValue = globals.JOBS_JOB_CONTEXT + globals.FAV_SUFFIX;
        const testTree = new ZosJobsProvider();
        favProfileNode.children.push(favJobNode);
        testTree.mFavorites.push(favProfileNode);
        const expectedFavJobNode = new Job(
            "JOBTEST(JOB1234)",
            vscode.TreeItemCollapsibleState.Collapsed,
            null,
            blockMocks.session,
            null,
            blockMocks.imperativeProfile
        );
        expectedFavJobNode.contextValue = globals.JOBS_JOB_CONTEXT + globals.FAV_SUFFIX;

        await testTree.loadProfilesForFavorites(blockMocks.log, favProfileNode);
        const resultFavJobNode = testTree.mFavorites[0].children[0];

        expect(resultFavJobNode).toEqual(expectedFavJobNode);
    });
});

describe("ZosJobsProvider unit tests - Function removeFavProfile", () => {
    async function createBlockMocks(globalMocks) {
        globalMocks.testJobsProvider.mFavorites = [];
        const testJobNode = new Job(
            "MYHLQ(JOB1283) - Input",
            vscode.TreeItemCollapsibleState.Collapsed,
            globalMocks.testJobsProvider.mSessionNodes[1],
            globalMocks.testJobsProvider.mSessionNodes[1].getSession(),
            globalMocks.testIJob,
            globalMocks.testProfile
        );
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

        globalMocks.mockShowQuickPick.mockResolvedValueOnce("Continue");
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

        globalMocks.mockShowQuickPick.mockResolvedValueOnce("Cancel");
        const expectedFavProfileNode = globalMocks.testJobsProvider.mFavorites[0];

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
