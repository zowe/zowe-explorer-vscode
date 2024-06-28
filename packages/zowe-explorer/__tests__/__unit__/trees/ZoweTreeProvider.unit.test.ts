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
import { imperative, ProfilesCache, Validation, PersistenceSchemaEnum } from "@zowe/zowe-explorer-api";
import { ZoweLocalStorage } from "../../../src/tools/ZoweLocalStorage";
import { ZoweTreeProvider } from "../../../src/trees/ZoweTreeProvider";
import {
    createIProfile,
    createISession,
    createFileResponse,
    createInstanceOfProfileInfo,
    createGetConfigMock,
} from "../../__mocks__/mockCreators/shared";
import { Constants } from "../../../src/configuration/Constants";
import { Profiles } from "../../../src/configuration/Profiles";
import { SettingsConfig } from "../../../src/configuration/SettingsConfig";
import { ZoweLogger } from "../../../src/tools/ZoweLogger";
import { ZoweJobNode } from "../../../src/trees/job/ZoweJobNode";
import { SharedActions } from "../../../src/trees/shared/SharedActions";
import { SharedTreeProviders } from "../../../src/trees/shared/SharedTreeProviders";
import { UssFSProvider } from "../../../src/trees/uss/UssFSProvider";
import { ZoweUSSNode } from "../../../src/trees/uss/ZoweUSSNode";
import { createUSSSessionNode } from "../../__mocks__/mockCreators/uss";
import { USSInit } from "../../../src/trees/uss/USSInit";
import { JobInit } from "../../../src/trees/job/JobInit";
import { createIJobObject, createJobSessionNode } from "../../__mocks__/mockCreators/jobs";
import { createDatasetSessionNode } from "../../__mocks__/mockCreators/datasets";
import { DatasetInit } from "../../../src/trees/dataset/DatasetInit";

async function createGlobalMocks() {
    Object.defineProperty(ZoweLocalStorage, "storage", {
        value: {
            get: () => ({ persistence: true, favorites: [], history: [], sessions: ["zosmf"], searchHistory: [], fileHistory: [] }),
            update: jest.fn(),
            keys: () => [],
        },
        configurable: true,
    });
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
        FileSystemProvider: {
            createDirectory: jest.fn(),
        },
    };

    jest.spyOn(UssFSProvider.instance, "createDirectory").mockImplementation(globalMocks.FileSystemProvider.createDirectory);

    Object.defineProperty(globalMocks.mockProfilesCache, "getProfileInfo", {
        value: jest.fn(() => {
            return { value: globalMocks.mockProfileInfo, configurable: true };
        }),
    });
    Object.defineProperty(vscode, "ConfigurationTarget", { value: globalMocks.enums, configurable: true });
    Object.defineProperty(vscode.window, "createTreeView", { value: globalMocks.createTreeView, configurable: true });
    Object.defineProperty(vscode, "ProgressLocation", { value: globalMocks.ProgressLocation, configurable: true });
    Object.defineProperty(vscode.window, "withProgress", { value: globalMocks.withProgress, configurable: true });
    Object.defineProperty(Profiles, "getInstance", {
        value: jest.fn(() => {
            return {
                allProfiles: [globalMocks.testProfile, { name: "firstName" }, { name: "secondName" }],
                getDefaultProfile: globalMocks.mockDefaultProfile,
                validProfile: Validation.ValidationType.VALID,
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

    globalMocks.mockAffects.mockReturnValue(true);
    globalMocks.withProgress.mockImplementation((progLocation, callback) => callback());
    globalMocks.withProgress.mockReturnValue(globalMocks.testResponse);
    globalMocks.testSessionNode = createUSSSessionNode(globalMocks.testSession, globalMocks.testProfile);
    globalMocks.testUSSTree = await USSInit.createUSSTree(imperative.Logger.getAppLogger());
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
            testJobsProvider: await JobInit.createJobsTree(imperative.Logger.getAppLogger()),
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

    it("Tests that editSession is executed successfully", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const spy = jest.spyOn(ZoweLogger, "trace");
        await blockMocks.testJobsProvider.editSession(blockMocks.jobNode, globalMocks.testUSSTree);
        expect(globalMocks.mockEditSession).toHaveBeenCalled();
        expect(spy).toHaveBeenCalled();
        spy.mockClear();
    });
    it("Tests that the session is edited and added to only the specific tree modified", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const deleteSessionSpy = jest.spyOn(blockMocks.testJobsProvider, "deleteSession");
        jest.spyOn(SharedTreeProviders, "getProviderForNode").mockReturnValue(blockMocks.testJobsProvider);
        jest.spyOn(blockMocks.jobNode, "getSession").mockReturnValue(null);
        blockMocks.jobNode.contextValue = Constants.JOBS_SESSION_CONTEXT;
        await blockMocks.testJobsProvider.editSession(blockMocks.jobNode);
        expect(globalMocks.mockEditSession).toHaveBeenCalled();
        expect(deleteSessionSpy).toHaveBeenCalledWith(blockMocks.jobNode);
    });
});

describe("Tree Provider unit tests, function getTreeItem", () => {
    it("Tests that getTreeItem returns an object of type vscode.TreeItem", async () => {
        const globalMocks = await createGlobalMocks();
        const spy = jest.spyOn(ZoweLogger, "trace");
        const sampleElement = new ZoweUSSNode({ label: "/u/myUser", collapsibleState: vscode.TreeItemCollapsibleState.None });
        expect(globalMocks.testUSSTree.getTreeItem(sampleElement)).toBeInstanceOf(vscode.TreeItem);
        expect(spy).toHaveBeenCalled();
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
        expect(spy).toHaveBeenCalled();
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
            get: () => ["[test]: /u/aDir{directory}", "[test]: /u/myFile.txt{textFile}"],
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
        jest.spyOn(vscode.workspace, "getConfiguration").mockImplementationOnce(globalMocks.getConfiguration);
        jest.spyOn(vscode.workspace, "getConfiguration").mockImplementationOnce(globalMocks.getConfiguration);
        globalMocks.getConfiguration.mockClear();

        await globalMocks.testUSSTree.onDidChangeConfiguration(e);
        expect(globalMocks.getConfiguration.mock.calls.length).toBe(2);
    });
});

describe("Tree Provider unit tests, function getTreeItem", () => {
    it("Testing that expand tree is executed successfully", async () => {
        const globalMocks = await createGlobalMocks();
        const spy = jest.spyOn(ZoweLogger, "trace");
        const folder = new ZoweUSSNode({
            label: "/u/myuser",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: globalMocks.testUSSTree.mSessionNodes[0],
            session: globalMocks.testSession,
        });
        folder.contextValue = Constants.USS_DIR_CONTEXT;

        // Testing flipState to open
        await globalMocks.testUSSTree.flipState(folder, true);
        expect(JSON.stringify(folder.iconPath)).toContain("folder-open.svg");

        // Testing flipState to closed
        await globalMocks.testUSSTree.flipState(folder, false);
        expect(JSON.stringify(folder.iconPath)).toContain("folder-closed.svg");
        expect(spy).toHaveBeenCalled();
        spy.mockClear();
    });
});

describe("ZoweJobNode unit tests - Function checkCurrentProfile", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            testIJob: createIJobObject(),
            testJobsProvider: await JobInit.createJobsTree(imperative.Logger.getAppLogger()),
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
                    validProfile: Validation.ValidationType.UNVERIFIED,
                };
            }),
        });

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
        expect(spy).toHaveBeenCalled();
        spy.mockClear();
    });
});

describe("Tree Provider Unit Tests - function getTreeType", () => {
    it("should return the persistence schema of the tree", async () => {
        const globalMocks = await createGlobalMocks();
        const spy = jest.spyOn(ZoweLogger, "trace");
        expect(globalMocks.testUSSTree.getTreeType()).toEqual(globalMocks.testUSSTree.persistenceSchema);
        expect(spy).toHaveBeenCalled();
        spy.mockClear();
    });
});

describe("Tree Provider Unit Tests - function findNonFavoritedNode", () => {
    it("should return undefined", async () => {
        const globalMocks = await createGlobalMocks();
        const spy = jest.spyOn(ZoweLogger, "trace");
        expect(globalMocks.testTreeProvider.findNonFavoritedNode(globalMocks.testUSSNode)).toEqual(undefined);
        expect(spy).toHaveBeenCalled();
        spy.mockClear();
    });
});

describe("Tree Provider Unit Tests - function findFavoritedNode", () => {
    it("should return undefined", async () => {
        const globalMocks = await createGlobalMocks();
        const spy = jest.spyOn(ZoweLogger, "trace");
        expect(globalMocks.testTreeProvider.findFavoritedNode(globalMocks.testUSSNode)).toEqual(undefined);
        expect(spy).toHaveBeenCalled();
        spy.mockClear();
    });
});

describe("Tree Provider Unit Tests - function renameFavorite", () => {
    it("should return undefined", async () => {
        const globalMocks = await createGlobalMocks();
        const spy = jest.spyOn(ZoweLogger, "trace");
        expect(globalMocks.testTreeProvider.renameFavorite(globalMocks.testUSSNode, "test")).toEqual(undefined);
        expect(spy).toHaveBeenCalled();
        spy.mockClear();
    });
});

describe("Tree Provider Unit Tests - function renameNode", () => {
    it("should return undefined", async () => {
        const globalMocks = await createGlobalMocks();
        const spy = jest.spyOn(ZoweLogger, "trace");
        expect(globalMocks.testTreeProvider.renameNode("test", "test1", "test2")).toEqual(undefined);
        expect(spy).toHaveBeenCalled();
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
        globalMocks.testDSTree = DatasetInit.createDatasetTree(imperative.Logger.getAppLogger());
        globalMocks.testDSTree.mSessionNodes = [
            { label: "sestest", getProfileName: (): string => "profile1" },
            { label: "sestest", getProfileName: (): string => "profile2" },
        ];
        globalMocks.testDSTree.getSessions = (): string[] => ["profile1", "profile2"];
        globalMocks.testDSTree.addSingleSession = jest.fn();

        const resetValidationSettingsSpy = jest.spyOn(SharedActions, "resetValidationSettings");
        resetValidationSettingsSpy.mockImplementation().mockClear();
        const zoweLoggerWarnSpy = jest.spyOn(ZoweLogger, "warn");

        await expect(
            (ZoweTreeProvider.prototype as any).loadProfileByPersistedProfile(globalMocks.testDSTree, undefined, true)
        ).resolves.not.toThrow();
        expect(globalMocks.testDSTree.addSingleSession).toHaveBeenCalledTimes(2);
        expect(resetValidationSettingsSpy).toHaveBeenCalledTimes(2);
        expect(zoweLoggerWarnSpy).not.toHaveBeenCalled();
    });

    it("should load all profiles of a given type for a tree provider", async () => {
        const globalMocks = await createGlobalMocks();
        globalMocks.testDSTree = DatasetInit.createDatasetTree(imperative.Logger.getAppLogger());
        globalMocks.testDSTree.mSessionNodes = [
            { label: "sestest", getProfileName: (): string => "profile1" },
            { label: "sestest", getProfileName: (): string => "profile2" },
        ];
        globalMocks.testDSTree.getSessions = (): string[] => ["profile1", "profile2"];
        globalMocks.testDSTree.addSingleSession = jest.fn();

        const resetValidationSettingsSpy = jest.spyOn(SharedActions, "resetValidationSettings");
        resetValidationSettingsSpy.mockImplementation().mockClear();
        const zoweLoggerWarnSpy = jest.spyOn(ZoweLogger, "warn");

        await expect((ZoweTreeProvider.prototype as any).loadProfileByPersistedProfile(globalMocks.testDSTree, "zosmf", true)).resolves.not.toThrow();
        expect(globalMocks.testDSTree.addSingleSession).toHaveBeenCalledTimes(1);
        expect(resetValidationSettingsSpy).toHaveBeenCalledTimes(1);
        expect(zoweLoggerWarnSpy).not.toHaveBeenCalled();
    });

    it("should reset validation settings and warn the user of an error when loading default", async () => {
        const globalMocks = await createGlobalMocks();
        globalMocks.testDSTree = DatasetInit.createDatasetTree(imperative.Logger.getAppLogger());
        globalMocks.testDSTree.mSessionNodes = [{ label: "sestest", getProfileName: (): string => "profile1" }];
        globalMocks.testDSTree.getSessions = (): string[] => ["profile1"];
        globalMocks.testDSTree.addSingleSession = jest.fn();

        const resetValidationSettingsSpy = jest.spyOn(SharedActions, "resetValidationSettings");
        resetValidationSettingsSpy.mockImplementation();
        jest.spyOn(Profiles.getInstance(), "getDefaultProfile").mockImplementationOnce(() => {
            throw new Error();
        });

        const zoweLoggerWarnSpy = jest.spyOn(ZoweLogger, "warn");

        await expect(ZoweTreeProvider.prototype["loadProfileByPersistedProfile"](globalMocks.testDSTree, "zosmf", true)).resolves.not.toThrow();
        expect(globalMocks.testDSTree.addSingleSession).toHaveBeenCalledTimes(2);
        expect(resetValidationSettingsSpy).toHaveBeenCalled();
        expect(zoweLoggerWarnSpy).toHaveBeenCalledTimes(1);
        resetValidationSettingsSpy.mockClear();
        zoweLoggerWarnSpy.mockClear();
    });
});

describe("Tree Provider Unit Tests - function isGlobalProfileNode", () => {
    it("returns true if the profile is located in the global config", async () => {
        const globalMocks = await createGlobalMocks();
        const getAllProfilesMock = jest.spyOn(globalMocks.mockProfileInfo, "getAllProfiles").mockReturnValue([
            {
                profName: "sestest",
            },
        ]);
        const getOsLocInfoMock = jest.spyOn(globalMocks.mockProfileInfo, "getOsLocInfo").mockReturnValue([{ global: true }]);
        await expect((globalMocks.testTreeProvider as any).isGlobalProfileNode({ getProfileName: () => "sestest" })).resolves.toBe(true);
        getAllProfilesMock.mockRestore();
        getOsLocInfoMock.mockRestore();
    });

    it("returns false if the node does not have HOME_SUFFIX in its contextValue", async () => {
        const globalMocks = await createGlobalMocks();
        const getAllProfilesMock = jest.spyOn(globalMocks.mockProfileInfo, "getAllProfiles").mockReturnValue([
            {
                profName: "sestest",
            },
        ]);
        const getOsLocInfoMock = jest.spyOn(globalMocks.mockProfileInfo, "getOsLocInfo").mockReturnValue([{ global: false }]);
        await expect(
            (globalMocks.testTreeProvider as any).isGlobalProfileNode({
                contextValue: Constants.FAV_PROFILE_CONTEXT,
                getProfileName: () => "sestest",
            })
        ).resolves.toBe(false);
        getAllProfilesMock.mockRestore();
        getOsLocInfoMock.mockRestore();
    });
});
