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

import { ZoweUSSNode } from "../../../src/uss/ZoweUSSNode";
import * as vscode from "vscode";
import { createIProfile, createISession, createFileResponse } from "../../../__mocks__/mockCreators/shared";
import { createUSSSessionNode } from "../../../__mocks__/mockCreators/uss";
import { ValidProfileEnum, Profiles } from "../../../src/Profiles";
import { Logger } from "@zowe/imperative";
import * as globals from "../../../src/globals";
import { createUSSTree } from "../../../src/uss/USSTree";
import { createIJobObject } from "../../../__mocks__/mockCreators/jobs";
import { Job } from "../../../src/job/ZoweJobNode";
import { createJobsTree } from "../../../src/job/ZosJobsProvider";
import { PersistentFilters } from "../../../src/PersistentFilters";

async function createGlobalMocks() {
    const globalMocks = {
        mockLoadNamedProfile: jest.fn(),
        mockDefaultProfile: jest.fn(),
        withProgress: jest.fn(),
        createTreeView: jest.fn(),
        mockAffects: jest.fn(),
        mockEditSession: jest.fn(),
        mockCheckCurrentProfile: jest.fn(),
        mockDisableValidationContext: jest.fn(),
        mockEnableValidationContext: jest.fn(),
        getConfiguration: jest.fn(),
        refresh: jest.fn(),
        testProfile: createIProfile(),
        testSession: createISession(),
        testResponse: createFileResponse({items: []}),
        testUSSTree: null,
        testSessionNode: null,
        mockGetProfileSetting: jest.fn(),
        mockProfilesForValidation: jest.fn(),
        mockProfilesValidationSetting: jest.fn(),
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

    Object.defineProperty(vscode, "ConfigurationTarget", { value: globalMocks.enums, configurable: true });
    Object.defineProperty(vscode.window, "createTreeView", { value: globalMocks.createTreeView, configurable: true });
    Object.defineProperty(vscode, "ProgressLocation", { value: globalMocks.ProgressLocation, configurable: true });
    Object.defineProperty(vscode.window, "withProgress", { value: globalMocks.withProgress, configurable: true });
    Object.defineProperty(vscode.workspace, "getConfiguration", { value: globalMocks.getConfiguration, configurable: true });
    Object.defineProperty(Profiles, "getInstance", {
        value: jest.fn(() => {
            return {
                allProfiles: [globalMocks.testProfile, { name: "firstName" }, { name: "secondName" }],
                getDefaultProfile: globalMocks.mockDefaultProfile,
                validProfile: ValidProfileEnum.VALID,
                validateProfiles: jest.fn(),
                loadNamedProfile: globalMocks.mockLoadNamedProfile,
                editSession: globalMocks.mockEditSession,
                disableValidationContext: globalMocks.mockDisableValidationContext,
                enableValidationContext: globalMocks.mockEnableValidationContext,
                checkCurrentProfile: globalMocks.mockCheckCurrentProfile.mockReturnValue({name: globalMocks.testProfile.name, status: "active"}),
                getProfileSetting: globalMocks.mockGetProfileSetting.mockReturnValue({name: globalMocks.testProfile.name, status: "active"}),
                profilesForValidation: globalMocks.mockProfilesForValidation.mockReturnValue({name: globalMocks.testProfile.name, status: "active"}),
                // tslint:disable-next-line:max-line-length
                profileValidationSetting: globalMocks.mockProfilesValidationSetting.mockReturnValue({name: globalMocks.testProfile.name, setting: true})
            };
        }),
        configurable: true
    });
    Object.defineProperty(PersistentFilters, "getDirectValue", {
        value: jest.fn(() => {
            return {
                "Zowe-Automatic-Validation": true
            };
        })
    });

    globalMocks.mockAffects.mockReturnValue(true);
    globalMocks.withProgress.mockImplementation((progLocation, callback) => callback());
    globalMocks.withProgress.mockReturnValue(globalMocks.testResponse);
    globalMocks.testSessionNode = createUSSSessionNode(globalMocks.testSession, globalMocks.testProfile);
    globalMocks.testUSSTree = await createUSSTree(Logger.getAppLogger());
    Object.defineProperty(globalMocks.testUSSTree, "refresh", { value: globalMocks.refresh, configurable: true });
    globalMocks.testUSSTree.mSessionNodes.push(globalMocks.testSessionNode);
    globalMocks.mockLoadNamedProfile.mockReturnValue(globalMocks.testProfile);
    globalMocks.mockDefaultProfile.mockReturnValue(globalMocks.testProfile);
    globalMocks.mockEditSession.mockReturnValue(globalMocks.testProfile);
    globalMocks.getConfiguration.mockReturnValue({
        get: (setting: string) => [
            "[test]: /u/aDir{directory}",
            "[test]: /u/myFile.txt{textFile}",
        ],
        update: jest.fn(()=>{
            return {};
        })
    });

    return globalMocks;
}

describe("ZoweJobNode unit tests - Function editSession", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            testIJob: createIJobObject(),
            testJobsProvider: await createJobsTree(Logger.getAppLogger()),
            jobNode: null
        };

        newMocks.jobNode = new Job("jobtest", vscode.TreeItemCollapsibleState.Expanded,
                                   null, globalMocks.testSession, newMocks.testIJob, globalMocks.testProfile);
        newMocks.jobNode.contextValue = "job";
        newMocks.jobNode.dirty = true;

        return newMocks;
    }

    it("Tests that editSession is executed successfully ", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const checkSession = jest.spyOn(blockMocks.testJobsProvider, "editSession");

        await blockMocks.testJobsProvider.editSession(blockMocks.jobNode);
        expect(globalMocks.mockEditSession).toHaveBeenCalled();
    });
});

describe("Tree Provider unit tests, function getTreeItem", () => {
    it("Tests that getTreeItem returns an object of type vscode.TreeItem", async () => {
        const globalMocks = await createGlobalMocks();
        const sampleElement = new ZoweUSSNode("/u/myUser", vscode.TreeItemCollapsibleState.None,
            null, null, null);
        expect(globalMocks.testUSSTree.getTreeItem(sampleElement)).toBeInstanceOf(vscode.TreeItem);
    });
});

describe("Tree Provider unit tests, function getParent", () => {
    it("Tests that getParent returns null when called on a root node", async () => {
        const globalMocks = await createGlobalMocks();

        // Await return value from getChildren
        const rootChildren = await globalMocks.testUSSTree.getChildren();
        const parent = globalMocks.testUSSTree.getParent(rootChildren[1]);

        expect(parent).toEqual(null);
    });

    it("Tests that getParent returns the correct ZoweUSSNode when called on a non-root node", async () => {
        const globalMocks = await createGlobalMocks();

        // Creating child of session node
        const sampleChild: ZoweUSSNode = new ZoweUSSNode("/u/myUser/zowe1", vscode.TreeItemCollapsibleState.None,
        globalMocks.testUSSTree.mSessionNodes[1], globalMocks.testSession, null);

        expect(globalMocks.testUSSTree.getParent(sampleChild)).toBe(globalMocks.testUSSTree.mSessionNodes[1]);
    });
});

describe("Tree Provider unit tests, function getTreeItem", () => {
    it("Testing the onDidConfiguration", async () => {
        const globalMocks = await createGlobalMocks();

        const Event = jest.fn().mockImplementation(() => {
            return {
                affectsConfiguration: globalMocks.mockAffects
            };
        });
        const e = new Event();
        globalMocks.getConfiguration.mockClear();

        await globalMocks.testUSSTree.onDidChangeConfiguration(e);
        expect(globalMocks.getConfiguration.mock.calls.length).toBe(2);
    });
});

describe("Tree Provider unit tests, function getTreeItem", () => {
    it("Testing that expand tree is executed successfully", async () => {
        const globalMocks = await createGlobalMocks();

        const folder = new ZoweUSSNode("/u/myuser", vscode.TreeItemCollapsibleState.Collapsed,
                                       globalMocks.testUSSTree.mSessionNodes[0], globalMocks.testSession, null);
        folder.contextValue = globals.USS_DIR_CONTEXT;

        // Testing flipState to open
        await globalMocks.testUSSTree.flipState(folder, true);
        expect(JSON.stringify(folder.iconPath)).toContain("folder-open.svg");

        // Testing flipState to closed
        await globalMocks.testUSSTree.flipState(folder, false);
        expect(JSON.stringify(folder.iconPath)).toContain("folder-closed.svg");
    });
});

describe("ZoweJobNode unit tests - Function checkCurrentProfile", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            testIJob: createIJobObject(),
            testJobsProvider: await createJobsTree(Logger.getAppLogger()),
            jobNode: null
        };

        newMocks.jobNode = new Job("jobtest", vscode.TreeItemCollapsibleState.Expanded,
                                   null, globalMocks.testSession, newMocks.testIJob, globalMocks.testProfile);
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
                    checkCurrentProfile: globalMocks.mockCheckCurrentProfile.mockReturnValueOnce({name: globalMocks.testProfile.name, status: "unverified"}),
                    validProfile: ValidProfileEnum.UNVERIFIED
                };
            })
        });
        const checkSession = jest.spyOn(blockMocks.testJobsProvider, "checkCurrentProfile");

        await blockMocks.testJobsProvider.checkCurrentProfile(blockMocks.jobNode);
        expect(globalMocks.mockCheckCurrentProfile).toHaveBeenCalled();
    });

    it("Tests that checkCurrentProfile is executed successfully with inactive status", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        blockMocks.jobNode.contextValue = "SERVER";
        globalMocks.mockCheckCurrentProfile.mockReturnValueOnce({name: globalMocks.testProfile.name, status: "inactive"});
        const checkSession = jest.spyOn(blockMocks.testJobsProvider, "checkCurrentProfile");

        await blockMocks.testJobsProvider.checkCurrentProfile(blockMocks.jobNode);
        expect(globalMocks.mockCheckCurrentProfile).toHaveBeenCalled();
    });
});
