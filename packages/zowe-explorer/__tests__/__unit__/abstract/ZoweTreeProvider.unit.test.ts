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

import { ZoweUSSNode } from "../../../src/uss/ZoweUSSNode";
import * as vscode from "vscode";
import {
    createIProfile,
    createISession,
    createFileResponse,
    createInstanceOfProfileInfo,
    createGetConfigMock,
} from "../../../__mocks__/mockCreators/shared";
import { createUSSSessionNode } from "../../../__mocks__/mockCreators/uss";
import { ProfilesCache, ValidProfileEnum, PersistenceSchemaEnum } from "@zowe/zowe-explorer-api";
import { Profiles } from "../../../src/Profiles";
import { imperative } from "@zowe/cli";
import * as globals from "../../../src/globals";
import { createUSSTree } from "../../../src/uss/USSTree";
import { createIJobObject, createJobSessionNode } from "../../../__mocks__/mockCreators/jobs";
import { ZoweJobNode } from "../../../src/job/ZoweJobNode";
import { createJobsTree } from "../../../src/job/ZosJobsProvider";
import { SettingsConfig } from "../../../src/utils/SettingsConfig";
import { ZoweTreeProvider } from "../../../src/abstract/ZoweTreeProvider";
import { ZoweLogger } from "../../../src/utils/LoggerUtils";
import { createDatasetSessionNode } from "../../../__mocks__/mockCreators/datasets";
import { TreeProviders } from "../../../src/shared/TreeProviders";
import { createDatasetTree } from "../../../src/dataset/DatasetTree";
import * as sharedActions from "../../../src/shared/actions";

async function createGlobalMocks() {
    const globalMocks = {
        mockLoadNamedProfile: jest.fn(),
        mockDefaultProfile: jest.fn(),
        withProgress: jest.fn(),
        createTreeView: jest.fn().mockReturnValue({ onDidCollapseElement: jest.fn() }),
        mockAffects: jest.fn(),
        mockEditSession: jest.fn(),
        mockCheckCurrentProfile: jest.fn(),
        mockDisableValidationContext: jest.fn(),
        mockEnableValidationContext: jest.fn(),
        getConfiguration: jest.fn(),
        refresh: jest.fn(),
        testProfile: createIProfile(),
        testSession: createISession(),
        testResponse: createFileResponse({ items: [] }),
        testUSSTree: null,
        testDSTree: null,
        testUSSNode: null,
        testSessionNode: null,
        testTreeProvider: new ZoweTreeProvider(PersistenceSchemaEnum.USS, null),
        mockGetProfileSetting: jest.fn(),
        mockProfilesForValidation: jest.fn(),
        mockProfilesValidationSetting: jest.fn(),
        mockSsoLogin: jest.fn(),
        mockSsoLogout: jest.fn(),
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
    };

    Object.defineProperty(globals, "LOG", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals.LOG, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(globalMocks.mockProfilesCache, "getProfileInfo", {
        value: jest.fn(() => {
            return { value: globalMocks.mockProfileInfo, configurable: true };
        }),
    });
    Object.defineProperty(vscode, "ConfigurationTarget", { value: globalMocks.enums, configurable: true });
    Object.defineProperty(vscode.window, "createTreeView", { value: globalMocks.createTreeView, configurable: true });
    Object.defineProperty(vscode, "ProgressLocation", { value: globalMocks.ProgressLocation, configurable: true });
    Object.defineProperty(vscode.window, "withProgress", { value: globalMocks.withProgress, configurable: true });
    Object.defineProperty(vscode.workspace, "getConfiguration", {
        value: globalMocks.getConfiguration,
        configurable: true,
    });
    Object.defineProperty(Profiles, "getInstance", {
        value: jest.fn(() => {
            return {
                allProfiles: [globalMocks.testProfile, { name: "firstName" }, { name: "secondName" }],
                getDefaultProfile: globalMocks.mockDefaultProfile,
                validProfile: ValidProfileEnum.VALID,
                validateProfiles: jest.fn(),
                loadNamedProfile: globalMocks.mockLoadNamedProfile,
                getBaseProfile: jest.fn(() => {
                    return globalMocks.testProfile;
                }),
                editSession: globalMocks.mockEditSession,
                disableValidationContext: globalMocks.mockDisableValidationContext,
                enableValidationContext: globalMocks.mockEnableValidationContext,
                checkCurrentProfile: globalMocks.mockCheckCurrentProfile.mockReturnValue({
                    name: globalMocks.testProfile.name,
                    status: "active",
                }),
                getProfileSetting: globalMocks.mockGetProfileSetting.mockReturnValue({
                    name: globalMocks.testProfile.name,
                    status: "active",
                }),
                profilesForValidation: globalMocks.mockProfilesForValidation.mockReturnValue({
                    name: globalMocks.testProfile.name,
                    status: "active",
                }),
                profileValidationSetting: globalMocks.mockProfilesValidationSetting.mockReturnValue({
                    name: globalMocks.testProfile.name,
                    setting: true,
                }),
                ssoLogin: globalMocks.mockSsoLogin,
                ssoLogout: globalMocks.mockSsoLogout,
                getProfileInfo: () => globalMocks.mockProfileInfo,
                fetchAllProfiles: jest.fn(() => {
                    return [{ name: "profile1" }, { name: "profile2" }, { name: "base" }];
                }),
                fetchAllProfilesByType: jest.fn(() => {
                    return [{ name: "profile1" }];
                }),
            };
        }),
        configurable: true,
    });
    Object.defineProperty(SettingsConfig, "getDirectValue", {
        value: createGetConfigMock({
            "zowe.automaticProfileValidation": true,
        }),
    });
    Object.defineProperty(ZoweLogger, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "debug", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "warn", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "info", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "trace", { value: jest.fn(), configurable: true });

    globalMocks.mockAffects.mockReturnValue(true);
    globalMocks.withProgress.mockImplementation((progLocation, callback) => callback());
    globalMocks.withProgress.mockReturnValue(globalMocks.testResponse);
    globalMocks.testSessionNode = createUSSSessionNode(globalMocks.testSession, globalMocks.testProfile);
    globalMocks.testUSSTree = await createUSSTree(imperative.Logger.getAppLogger());
    Object.defineProperty(globalMocks.testUSSTree, "refresh", { value: globalMocks.refresh, configurable: true });
    globalMocks.testUSSTree.mSessionNodes.push(globalMocks.testSessionNode);
    globalMocks.testUSSNode = new ZoweUSSNode({
        label: "/u/test",
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        parentNode: globalMocks.testUSSTree.mSessionNodes[0],
        session: globalMocks.testSession,
    });
    globalMocks.mockLoadNamedProfile.mockReturnValue(globalMocks.testProfile);
    globalMocks.mockDefaultProfile.mockReturnValue(globalMocks.testProfile);
    globalMocks.mockEditSession.mockReturnValue(globalMocks.testProfile);

    return globalMocks;
}

describe("ZoweJobNode unit tests - Function editSession", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            testIJob: createIJobObject(),
            testJobsProvider: await createJobsTree(imperative.Logger.getAppLogger()),
            jobNode: null,
        };

        newMocks.jobNode = new ZoweJobNode({
            label: "jobtest",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            session: globalMocks.testSession,
            profile: globalMocks.testProfile,
            job: newMocks.testIJob,
        });
        newMocks.jobNode.contextValue = "job";
        newMocks.jobNode.dirty = true;

        return newMocks;
    }

    it("Tests that editSession is executed successfully ", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const spy = jest.spyOn(ZoweLogger, "trace");
        await blockMocks.testJobsProvider.editSession(blockMocks.jobNode, globalMocks.testUSSTree);
        expect(globalMocks.mockEditSession).toHaveBeenCalled();
        expect(spy).toBeCalled();
        spy.mockClear();
    });
    it("Tests that the session is edited and added to only the specific tree modified", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const deleteSessionForProviderSpy = jest.spyOn(ZoweTreeProvider.prototype as any, "deleteSessionForProvider");
        const mockJobProvider = {
            addSingleSession: jest.fn(),
            mSessionNodes: [blockMocks.jobNode],
            refresh: jest.fn(),
            removeSession: jest.fn(),
        } as any;
        jest.spyOn(TreeProviders, "providers", "get").mockReturnValue({ job: mockJobProvider } as any);
        jest.spyOn(blockMocks.jobNode, "getSession").mockReturnValue(null);
        blockMocks.jobNode.contextValue = globals.JOBS_SESSION_CONTEXT;
        await blockMocks.testJobsProvider.editSession(blockMocks.jobNode, globalMocks.testUSSTree);
        expect(globalMocks.mockEditSession).toHaveBeenCalled();
        expect(deleteSessionForProviderSpy).toBeCalledWith(blockMocks.jobNode, mockJobProvider);
    });
});

describe("Tree Provider unit tests, function getTreeItem", () => {
    it("Tests that getTreeItem returns an object of type vscode.TreeItem", async () => {
        const globalMocks = await createGlobalMocks();
        const spy = jest.spyOn(ZoweLogger, "trace");
        const sampleElement = new ZoweUSSNode({ label: "/u/myUser", collapsibleState: vscode.TreeItemCollapsibleState.None });
        expect(globalMocks.testUSSTree.getTreeItem(sampleElement)).toBeInstanceOf(vscode.TreeItem);
        expect(spy).toBeCalled();
        spy.mockClear();
    });
});

describe("Tree Provider unit tests, function getParent", () => {
    it("Tests that getParent returns undefined when called on a root node", async () => {
        const globalMocks = await createGlobalMocks();
        const spy = jest.spyOn(ZoweLogger, "trace");
        // Await return value from getChildren
        const rootChildren = await globalMocks.testUSSTree.getChildren();
        const parent = globalMocks.testUSSTree.getParent(rootChildren[1]);

        expect(parent).toBeUndefined();
        expect(spy).toBeCalled();
        spy.mockClear();
    });

    it("Tests that getParent returns the correct ZoweUSSNode when called on a non-root node", async () => {
        const globalMocks = await createGlobalMocks();

        // Creating child of session node
        const sampleChild: ZoweUSSNode = new ZoweUSSNode({
            label: "/u/myUser/zowe1",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: globalMocks.testUSSTree.mSessionNodes[1],
            session: globalMocks.testSession,
        });

        expect(globalMocks.testUSSTree.getParent(sampleChild)).toBe(globalMocks.testUSSTree.mSessionNodes[1]);
    });
});

describe("Tree Provider unit tests, function getTreeItem", () => {
    it("Testing the onDidConfiguration", async () => {
        const globalMocks = await createGlobalMocks();
        globalMocks.getConfiguration.mockReturnValue({
            get: (setting: string) => ["[test]: /u/aDir{directory}", "[test]: /u/myFile.txt{textFile}"],
            update: jest.fn(() => {
                return {};
            }),
        });

        const Event = jest.fn().mockImplementation(() => {
            return {
                affectsConfiguration: globalMocks.mockAffects,
            };
        });
        const e = new Event();
        globalMocks.getConfiguration.mockClear();

        await globalMocks.testUSSTree.onDidChangeConfiguration(e);
        expect(globalMocks.getConfiguration.mock.calls.length).toBe(2);
    });
});

describe("Tree Provider unit tests, function flipState", () => {
    it("Testing that expand tree is executed successfully", async () => {
        const globalMocks = await createGlobalMocks();
        const spy = jest.spyOn(ZoweLogger, "trace");
        const folder = new ZoweUSSNode({
            label: "/u/myuser",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: globalMocks.testUSSTree.mSessionNodes[0],
            session: globalMocks.testSession,
        });
        folder.contextValue = globals.USS_DIR_CONTEXT;
        folder.dirty = false;

        // Testing flipState to open
        await globalMocks.testUSSTree.flipState(folder, true);
        expect(JSON.stringify(folder.iconPath)).toContain("folder-open.svg");
        expect(folder.dirty).toBe(false);

        // Testing flipState to closed
        await globalMocks.testUSSTree.flipState(folder, false);
        expect(JSON.stringify(folder.iconPath)).toContain("folder-closed.svg");
        expect(folder.dirty).toBe(true);
        expect(spy).toBeCalled();
        spy.mockClear();
    });
});

describe("ZoweJobNode unit tests - Function checkCurrentProfile", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            testIJob: createIJobObject(),
            testJobsProvider: await createJobsTree(imperative.Logger.getAppLogger()),
            jobNode: null,
        };

        newMocks.jobNode = new ZoweJobNode({
            label: "jobtest",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            session: globalMocks.testSession,
            profile: globalMocks.testProfile,
            job: newMocks.testIJob,
        });
        newMocks.jobNode.contextValue = "job";
        newMocks.jobNode.dirty = true;

        return newMocks;
    }

    it("Tests that checkCurrentProfile is executed successfully with active status ", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const checkSession = jest.spyOn(blockMocks.testJobsProvider, "checkCurrentProfile");

        await blockMocks.testJobsProvider.checkCurrentProfile(blockMocks.jobNode);
        expect(globalMocks.mockCheckCurrentProfile).toHaveBeenCalled();
    });

    it("Tests that checkCurrentProfile is executed successfully with unverified status", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        blockMocks.jobNode.contextValue = "SERVER";
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    checkCurrentProfile: globalMocks.mockCheckCurrentProfile.mockReturnValueOnce({
                        name: globalMocks.testProfile.name,
                        status: "unverified",
                    }),
                    validProfile: ValidProfileEnum.UNVERIFIED,
                };
            }),
        });
        const checkSession = jest.spyOn(blockMocks.testJobsProvider, "checkCurrentProfile");

        await blockMocks.testJobsProvider.checkCurrentProfile(blockMocks.jobNode);
        expect(globalMocks.mockCheckCurrentProfile).toHaveBeenCalled();
    });

    it("Tests that checkCurrentProfile is executed successfully with inactive status", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        blockMocks.jobNode.contextValue = "session";
        globalMocks.mockCheckCurrentProfile.mockReturnValueOnce({
            name: globalMocks.testProfile.name,
            status: "inactive",
        });
        const checkSession = jest.spyOn(blockMocks.testJobsProvider, "checkCurrentProfile");
        await blockMocks.testJobsProvider.checkCurrentProfile(blockMocks.jobNode);
        expect(globalMocks.mockCheckCurrentProfile).toHaveBeenCalled();
    });
});

describe("Tree Provider Unit Tests - refreshHomeProfileContext", () => {
    it("should set tthe node context value to the HOME_SUFFIX global value", async () => {
        const globalMocks = await createGlobalMocks();
        globalMocks.mockProfileInfo.usingTeamConfig = true;
        globalMocks.mockProfileInfo.getOsLocInfo = () => [{ global: true }];
        const spy = jest.spyOn(ZoweLogger, "trace");
        await expect(globalMocks.testUSSTree.refreshHomeProfileContext(globalMocks.testUSSNode)).resolves.not.toThrow();
        expect(globalMocks.testUSSNode.contextValue).toEqual("directory_home");
        expect(spy).toBeCalled();
        spy.mockClear();
    });
});

describe("Tree Provider Unit Tests - function getTreeType", () => {
    it("should return the persistence schema of the tree", async () => {
        const globalMocks = await createGlobalMocks();
        const spy = jest.spyOn(ZoweLogger, "trace");
        expect(globalMocks.testUSSTree.getTreeType()).toEqual(globalMocks.testUSSTree.persistenceSchema);
        expect(spy).toBeCalled();
        spy.mockClear();
    });
});

describe("Tree Provider Unit Tests - function findNonFavoritedNode", () => {
    it("should return undefined", async () => {
        const globalMocks = await createGlobalMocks();
        const spy = jest.spyOn(ZoweLogger, "trace");
        expect(globalMocks.testTreeProvider.findNonFavoritedNode(globalMocks.testUSSNode)).toEqual(undefined);
        expect(spy).toBeCalled();
        spy.mockClear();
    });
});

describe("Tree Provider Unit Tests - function findFavoritedNode", () => {
    it("should return undefined", async () => {
        const globalMocks = await createGlobalMocks();
        const spy = jest.spyOn(ZoweLogger, "trace");
        expect(globalMocks.testTreeProvider.findFavoritedNode(globalMocks.testUSSNode)).toEqual(undefined);
        expect(spy).toBeCalled();
        spy.mockClear();
    });
});

describe("Tree Provider Unit Tests - function renameFavorite", () => {
    it("should return undefined", async () => {
        const globalMocks = await createGlobalMocks();
        const spy = jest.spyOn(ZoweLogger, "trace");
        expect(globalMocks.testTreeProvider.renameFavorite(globalMocks.testUSSNode, "test")).toEqual(undefined);
        expect(spy).toBeCalled();
        spy.mockClear();
    });
});

describe("Tree Provider Unit Tests - function renameNode", () => {
    it("should return undefined", async () => {
        const globalMocks = await createGlobalMocks();
        const spy = jest.spyOn(ZoweLogger, "trace");
        expect(globalMocks.testTreeProvider.renameNode("test", "test1", "test2")).toEqual(undefined);
        expect(spy).toBeCalled();
        spy.mockClear();
    });
});

describe("Tree Provider Unit Tests - function ssoLogin", () => {
    const createBlockMocks = () => {
        const executeCommandSpy = jest.spyOn(vscode.commands, "executeCommand");
        return {
            executeCommandSpy,
        };
    };

    const blockMocks = createBlockMocks();

    afterEach(() => {
        blockMocks.executeCommandSpy.mockClear();
    });

    it("should only call zowe.ds.refreshAll for a Data Set session node", async () => {
        const globalMocks = await createGlobalMocks();
        const dsNode = createDatasetSessionNode(globalMocks.testSession, globalMocks.testProfile);

        await globalMocks.testTreeProvider.ssoLogin(dsNode);
        expect(globalMocks.mockSsoLogin).toHaveBeenCalled();
        expect(blockMocks.executeCommandSpy).toHaveBeenCalledWith("zowe.ds.refreshAll");
        expect(blockMocks.executeCommandSpy).not.toHaveBeenCalledWith("zowe.uss.refreshAll");
        expect(blockMocks.executeCommandSpy).not.toHaveBeenCalledWith("zowe.jobs.refreshAllJobs");
    });

    it("should only call zowe.uss.refreshAll for a USS session node", async () => {
        const globalMocks = await createGlobalMocks();
        const ussNode = createUSSSessionNode(globalMocks.testSession, globalMocks.testProfile);

        await globalMocks.testTreeProvider.ssoLogin(ussNode);
        expect(globalMocks.mockSsoLogin).toHaveBeenCalled();
        expect(blockMocks.executeCommandSpy).toHaveBeenCalledWith("zowe.uss.refreshAll");
        expect(blockMocks.executeCommandSpy).not.toHaveBeenCalledWith("zowe.ds.refreshAll");
        expect(blockMocks.executeCommandSpy).not.toHaveBeenCalledWith("zowe.jobs.refreshAllJobs");
    });

    it("should only call zowe.jobs.refreshAllJobs for a Job session node", async () => {
        const globalMocks = await createGlobalMocks();
        const jobNode = createJobSessionNode(globalMocks.testSession, globalMocks.testProfile);

        await globalMocks.testTreeProvider.ssoLogin(jobNode);
        expect(globalMocks.mockSsoLogin).toHaveBeenCalled();
        expect(blockMocks.executeCommandSpy).toHaveBeenCalledWith("zowe.jobs.refreshAllJobs");
        expect(blockMocks.executeCommandSpy).not.toHaveBeenCalledWith("zowe.uss.refreshAll");
        expect(blockMocks.executeCommandSpy).not.toHaveBeenCalledWith("zowe.ds.refreshAll");
    });
});

describe("Tree Provider Unit Tests - function ssoLogout", () => {
    const createBlockMocks = () => {
        const executeCommandSpy = jest.spyOn(vscode.commands, "executeCommand");
        return {
            executeCommandSpy,
        };
    };

    const blockMocks = createBlockMocks();

    afterEach(() => {
        blockMocks.executeCommandSpy.mockClear();
    });

    afterAll(() => {
        blockMocks.executeCommandSpy.mockRestore();
    });

    it("should only call zowe.ds.refreshAll for a Data Set session node", async () => {
        const globalMocks = await createGlobalMocks();
        const dsNode = createDatasetSessionNode(globalMocks.testSession, globalMocks.testProfile);

        await globalMocks.testTreeProvider.ssoLogout(dsNode);
        expect(globalMocks.mockSsoLogout).toHaveBeenCalled();
        expect(blockMocks.executeCommandSpy).toHaveBeenCalledWith("zowe.ds.refreshAll");
        expect(blockMocks.executeCommandSpy).not.toHaveBeenCalledWith("zowe.uss.refreshAll");
        expect(blockMocks.executeCommandSpy).not.toHaveBeenCalledWith("zowe.jobs.refreshAllJobs");
    });

    it("should only call zowe.uss.refreshAll for a USS session node", async () => {
        const globalMocks = await createGlobalMocks();
        const ussNode = createUSSSessionNode(globalMocks.testSession, globalMocks.testProfile);

        await globalMocks.testTreeProvider.ssoLogout(ussNode);
        expect(globalMocks.mockSsoLogout).toHaveBeenCalled();
        expect(blockMocks.executeCommandSpy).toHaveBeenCalledWith("zowe.uss.refreshAll");
        expect(blockMocks.executeCommandSpy).not.toHaveBeenCalledWith("zowe.ds.refreshAll");
        expect(blockMocks.executeCommandSpy).not.toHaveBeenCalledWith("zowe.jobs.refreshAllJobs");
    });

    it("should only call zowe.jobs.refreshAllJobs for a Job session node", async () => {
        const globalMocks = await createGlobalMocks();
        const jobNode = createJobSessionNode(globalMocks.testSession, globalMocks.testProfile);

        await globalMocks.testTreeProvider.ssoLogout(jobNode);
        expect(globalMocks.mockSsoLogout).toHaveBeenCalled();
        expect(blockMocks.executeCommandSpy).toHaveBeenCalledWith("zowe.jobs.refreshAllJobs");
        expect(blockMocks.executeCommandSpy).not.toHaveBeenCalledWith("zowe.uss.refreshAll");
        expect(blockMocks.executeCommandSpy).not.toHaveBeenCalledWith("zowe.ds.refreshAll");
    });
});

describe("Tree Provider Unit Tests - function loadProfileByPersistedProfile", () => {
    it("should load all profiles for a tree provider", async () => {
        const globalMocks = await createGlobalMocks();
        globalMocks.testDSTree = createDatasetTree(imperative.Logger.getAppLogger());
        globalMocks.testDSTree.mSessionNodes = [
            { label: "sestest", getProfileName: (): string => "profile1" },
            { label: "sestest", getProfileName: (): string => "profile2" },
        ];
        globalMocks.testDSTree.getSessions = (): string[] => ["profile1", "profile2"];
        globalMocks.testDSTree.addSingleSession = jest.fn();

        const resetValidationSettingsSpy = jest.spyOn(sharedActions, "resetValidationSettings");
        resetValidationSettingsSpy.mockImplementation().mockClear();
        const zoweLoggerWarnSpy = jest.spyOn(ZoweLogger, "warn");

        await expect(
            (ZoweTreeProvider.prototype as any).loadProfileByPersistedProfile(globalMocks.testDSTree, undefined, true)
        ).resolves.not.toThrow();
        expect(globalMocks.testDSTree.addSingleSession).toBeCalledTimes(2);
        expect(resetValidationSettingsSpy).toBeCalledTimes(2);
        expect(zoweLoggerWarnSpy).not.toBeCalled();
    });

    it("should load all profiles of a given type for a tree provider", async () => {
        const globalMocks = await createGlobalMocks();
        globalMocks.testDSTree = createDatasetTree(imperative.Logger.getAppLogger());
        globalMocks.testDSTree.mSessionNodes = [
            { label: "sestest", getProfileName: (): string => "profile1" },
            { label: "sestest", getProfileName: (): string => "profile2" },
        ];
        globalMocks.testDSTree.getSessions = (): string[] => ["profile1", "profile2"];
        globalMocks.testDSTree.addSingleSession = jest.fn();

        const resetValidationSettingsSpy = jest.spyOn(sharedActions, "resetValidationSettings");
        resetValidationSettingsSpy.mockImplementation().mockClear();
        const zoweLoggerWarnSpy = jest.spyOn(ZoweLogger, "warn");

        await expect((ZoweTreeProvider.prototype as any).loadProfileByPersistedProfile(globalMocks.testDSTree, "zosmf", true)).resolves.not.toThrow();
        expect(globalMocks.testDSTree.addSingleSession).toBeCalledTimes(1);
        expect(resetValidationSettingsSpy).toBeCalledTimes(1);
        expect(zoweLoggerWarnSpy).not.toBeCalled();
    });
});
