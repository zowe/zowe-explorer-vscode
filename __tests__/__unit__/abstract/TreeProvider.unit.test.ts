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

async function createGlobalMocks() {
    const globalMocks = {
        mockLoadNamedProfile: jest.fn(),
        mockDefaultProfile: jest.fn(),
        withProgress: jest.fn(),
        createTreeView: jest.fn(),
        mockAffects: jest.fn(),
        getConfiguration: jest.fn(),
        refresh: jest.fn(),
        testProfile: createIProfile(),
        testSession: createISession(),
        testResponse: createFileResponse({items: []}),
        testUSSTree: null,
        testSessionNode: null,
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
                checkCurrentProfile: jest.fn(),
                loadNamedProfile: globalMocks.mockLoadNamedProfile
            };
        }),
        configurable: true
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
