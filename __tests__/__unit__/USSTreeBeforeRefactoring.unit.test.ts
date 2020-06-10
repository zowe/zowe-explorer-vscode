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

// tslint:disable:no-shadowed-variable
import { getIconByNode } from "../../src/generators/icons";

jest.mock("vscode");
jest.mock("@zowe/imperative");
jest.mock("Session");
jest.mock("../../src/Profiles");

import * as zowe from "@zowe/cli";
import { Session, IProfileLoaded } from "@zowe/imperative";
import * as vscode from "vscode";
import { USSTree } from "../../src/uss/USSTree";
import { ZoweUSSNode } from "../../src/uss/ZoweUSSNode";
import * as globals from "../../src/globals";
import { Profiles, ValidProfileEnum } from "../../src/Profiles";
import { IZoweTree } from "../../src/api/IZoweTree";
import { IZoweUSSTreeNode } from "../../src/api/IZoweTreeNode";
import { createFileResponse } from "../../__mocks__/mockCreators/shared";

describe("Unit Tests (Jest)", () => {
    // Globals
    const session = new Session({
        user: "fake",
        password: "fake",
        hostname: "fake",
        protocol: "https",
        type: "basic",
    });

    const getConfiguration = jest.fn();
    Object.defineProperty(vscode.workspace, "getConfiguration", { value: getConfiguration });
    getConfiguration.mockReturnValue({
        get: (setting: string) => [
            "[test]: /u/aDir{directory}",
            "[test]: /u/myFile.txt{textFile}",
        ],
        update: jest.fn(()=>{
            return {};
        })
    });
    const ProgressLocation = jest.fn().mockImplementation(() => {
        return {
            Notification: 15
        };
    });
    const withProgress = jest.fn().mockImplementation(() => {
        return {
            location: 15,
            title: "Saving file..."
        };
    });
    const testResponse = createFileResponse([]);
    withProgress.mockReturnValue(testResponse);

    const showErrorMessage = jest.fn();
    const showInformationMessage = jest.fn();
    const showInputBox = jest.fn();
    const createQuickPick = jest.fn();
    const createTreeView = jest.fn();
    const showQuickPick = jest.fn();
    const filters = jest.fn();
    const getFilters = jest.fn();
    const Utilities = jest.fn();
    const renameUSSFile = jest.fn();
    Object.defineProperty(vscode.window, "showErrorMessage", {value: showErrorMessage});
    Object.defineProperty(vscode.window, "showInformationMessage", {value: showInformationMessage});
    Object.defineProperty(vscode.window, "createQuickPick", {value: createQuickPick});
    Object.defineProperty(vscode.window, "showQuickPick", {value: showQuickPick});
    Object.defineProperty(vscode.window, "showInputBox", {value: showInputBox});
    Object.defineProperty(zowe, "Utilities", { value: Utilities });
    Object.defineProperty(Utilities, "renameUSSFile", { value: renameUSSFile });
    Object.defineProperty(filters, "getFilters", { value: getFilters });
    Object.defineProperty(vscode, "ProgressLocation", {value: ProgressLocation});
    Object.defineProperty(vscode.window, "withProgress", {value: withProgress});
    Object.defineProperty(vscode.window, "createTreeView", {value: createTreeView});
    getFilters.mockReturnValue(["/u/aDir{directory}", "/u/myFile.txt{textFile}"]);
    createTreeView.mockReturnValue("testTreeView");

    const testTree: IZoweTree<IZoweUSSTreeNode> = new USSTree();
    const profilesForValidation = {status: "active", name: "fake"};
    const profileOne: IProfileLoaded = {
        name: "aProfile",
        profile: {
            user:undefined,
            password: undefined
        },
        type: "zosmf",
        message: "",
        failNotFound: false
    };
    const mockLoadNamedProfile = jest.fn();
    mockLoadNamedProfile.mockReturnValue(profileOne);
    const mockDefaultProfile = jest.fn();
    mockDefaultProfile.mockReturnValue(profileOne);
    Object.defineProperty(Profiles, "getInstance", {
        value: jest.fn(() => {
            return {
                allProfiles: [profileOne, {name: "secondName"}],
                getDefaultProfile: mockDefaultProfile,
                validProfile: ValidProfileEnum.VALID,
                checkCurrentProfile: jest.fn(() => {
                    return profilesForValidation;
                }),
                profilesForValidation: [],
                validateProfiles: jest.fn(),
                loadNamedProfile: mockLoadNamedProfile
            };
        })
    });
    testTree.mSessionNodes.push(new ZoweUSSNode("ussTestSess", vscode.TreeItemCollapsibleState.Collapsed, null, session,
        null, false, profileOne.name, undefined));
    testTree.mSessionNodes[1].contextValue = globals.USS_SESSION_CONTEXT;
    testTree.mSessionNodes[1].fullPath = "test";
    const targetIcon = getIconByNode(testTree.mSessionNodes[1]);
    if (targetIcon) {
        testTree.mSessionNodes[1].iconPath = targetIcon.path;
    }

    beforeEach(() => {
        withProgress.mockImplementation((progLocation, callback) => {
            return callback();
        });
    });

    afterEach(async () => {
        getConfiguration.mockClear();
    });
    afterAll(() => {
        jest.resetAllMocks();
    });

    /*************************************************************************************************************
     * Calls getTreeItem with sample element and checks the return is vscode.TreeItem
     * SHOULD BE MOVED TO ZoweTreeProvider tests
     *************************************************************************************************************/
    it("Testing the getTreeItem method", async () => {
        const sampleElement = new ZoweUSSNode("/u/myUser", vscode.TreeItemCollapsibleState.None,
            null, null, null);
        expect(testTree.getTreeItem(sampleElement)).toBeInstanceOf(vscode.TreeItem);
    });

    /*************************************************************************************************************
     * Creates a rootNode and checks that a getParent() call returns null
     * SHOULD BE MOVED TO ZoweTreeProvider tests
     *************************************************************************************************************/
    it("Tests that getParent returns null when called on a rootNode", async () => {
        // Waiting until we populate rootChildren with what getChildren() returns
        const rootChildren = await testTree.getChildren();
        const parent = testTree.getParent(rootChildren[0]);
        // We expect parent to equal null because when we call getParent() on the rootNode
        // It should return null rather than itself
        expect(parent).toEqual(null);
    });

    /*************************************************************************************************************
     * Creates a child with a rootNode as parent and checks that a getParent() call returns null.
     * Also creates a child with a non-rootNode parent and checks that getParent() returns the correct ZoweUSSNode
     * SHOULD BE MOVED TO ZoweTreeProvider tests
     *************************************************************************************************************/
    it("Tests that getParent returns the correct ZoweUSSNode when called on a non-rootNode ZoweUSSNode", async () => {
        // Creating fake directories and uss members to test
        const sampleChild1: ZoweUSSNode = new ZoweUSSNode("/u/myUser/zowe1", vscode.TreeItemCollapsibleState.None,
            testTree.mSessionNodes[0], session, null);
        const parent1 = testTree.getParent(sampleChild1);

        // Creating fake directories and uss members to test
        const sampleChild2: ZoweUSSNode = new ZoweUSSNode("/u/myUser/zowe2", vscode.TreeItemCollapsibleState.None,
            sampleChild1, null, null);
        const parent2 = testTree.getParent(sampleChild2);

        // The first expect expected that parent is null because when getParent() is called on a child
        // of the rootNode, it should return null
        expect(testTree.getParent(testTree.mSessionNodes[0])).toBe(null);
        expect(parent1).toBe(testTree.mSessionNodes[0]);
        expect(parent2).toBe(sampleChild1);

    });

    /*************************************************************************************************************
     * Testing that expand tree is executed successfully
     * SHOULD BE MOVED TO ZoweTreeProvider tests
     *************************************************************************************************************/
    it("Testing that expand tree is executed successfully", async () => {
        const refresh = jest.fn();
        Object.defineProperty(testTree, "refresh", {value: refresh});
        refresh.mockReset();
        const folder = new ZoweUSSNode("/u/myuser", vscode.TreeItemCollapsibleState.Collapsed, testTree.mSessionNodes[0], session, null);
        folder.contextValue = globals.USS_DIR_CONTEXT;
        await testTree.flipState(folder, true);
        expect(JSON.stringify(folder.iconPath)).toContain("folder-open.svg");
        await testTree.flipState(folder, false);
        expect(JSON.stringify(folder.iconPath)).toContain("folder-closed.svg");
        await testTree.flipState(folder, true);
        expect(JSON.stringify(folder.iconPath)).toContain("folder-open.svg");
    });

    it("Testing that expand tree with credential prompt is executed successfully", async () => {
        const sessionwocred = new Session({
            user: "",
            password: "",
            hostname: "fake",
            port: 443,
            protocol: "https",
            type: "basic",
        });
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "firstName", profile: {user:undefined, password: undefined}}, {name: "secondName"}],
                    defaultProfile: {name: "firstName"},
                    promptCredentials: jest.fn(()=> {
                        return [{values: "fake"}, {values: "fake"}, {values: "fake"}];
                    }),
                    checkCurrentProfile: jest.fn(() => {
                        return profilesForValidation;
                    }),
                    validateProfiles: jest.fn(),
                };
            })
        });
        const folder = new ZoweUSSNode("/u/myuser", vscode.TreeItemCollapsibleState.Collapsed, testTree.mSessionNodes[0], sessionwocred, null);
        folder.contextValue = globals.USS_DIR_CONTEXT;
        await testTree.flipState(folder, true);
        expect(JSON.stringify(folder.iconPath)).toContain("folder-open.svg");
        await testTree.flipState(folder, false);
        expect(JSON.stringify(folder.iconPath)).toContain("folder-closed.svg");
        await testTree.flipState(folder, true);
        expect(JSON.stringify(folder.iconPath)).toContain("folder-open.svg");
    });

    /*************************************************************************************************************
     * Testing the onDidConfiguration
     * SHOULD BE MOVED TO ZoweTreeProvider tests
     *************************************************************************************************************/
    it("Testing the onDidConfiguration", async () => {
        getConfiguration.mockReturnValue({
            get: (setting: string) => [
                "[test]: /u/aDir{directory}",
                "[test]: /u/myFile.txt{textFile}",
            ],
            update: jest.fn(()=>{
                return {};
            })
        });
        const mockAffects = jest.fn();
        const Event = jest.fn().mockImplementation(() => {
            return {
                affectsConfiguration: mockAffects
            };
        });
        const e = new Event();
        mockAffects.mockReturnValue(true);

        const enums = jest.fn().mockImplementation(() => {
            return {
                Global: 1,
                Workspace: 2,
                WorkspaceFolder: 3
            };
        });
        Object.defineProperty(vscode, "ConfigurationTarget", {value: enums});
        await testTree.onDidChangeConfiguration(e);
        expect(getConfiguration.mock.calls.length).toBe(2);
    });
});
