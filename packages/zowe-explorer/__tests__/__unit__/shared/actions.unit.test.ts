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
import {
    createInstanceOfProfile,
    createIProfile,
    createISessionWithoutCredentials,
    createQuickPickContent,
    createQuickPickItem,
    createTreeView,
} from "../../../__mocks__/mockCreators/shared";
import { createDatasetSessionNode, createDatasetTree } from "../../../__mocks__/mockCreators/datasets";
import { Gui, IZoweNodeType } from "@zowe/zowe-explorer-api";
import { Profiles } from "../../../src/Profiles";
import * as utils from "../../../src/utils/ProfilesUtils";
import * as globals from "../../../src/globals";
import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";
import * as sharedActions from "../../../src/shared/actions";
import { createUSSSessionNode, createUSSTree } from "../../../__mocks__/mockCreators/uss";
import * as dsActions from "../../../src/dataset/actions";
import { ZoweUSSNode } from "../../../src/uss/ZoweUSSNode";
import { getIconById, IconId, getIconByNode } from "../../../src/generators/icons";
import * as zowe from "@zowe/cli";
import { ZoweLogger } from "../../../src/utils/LoggerUtils";

async function createGlobalMocks() {
    const globalMocks = {
        session: createISessionWithoutCredentials(),
        treeView: createTreeView(),
        imperativeProfile: createIProfile(),
        withProgress: null,
        mockCallback: null,
        ProgressLocation: jest.fn().mockImplementation(() => {
            return {
                Notification: 15,
            };
        }),
        qpPlaceholder: 'Choose "Create new..." to define a new profile or select an existing profile to add to the Data Set Explorer',
    };

    Object.defineProperty(vscode.window, "withProgress", {
        value: jest.fn().mockImplementation((progLocation, callback) => {
            const progress = {
                report: (message) => {
                    return;
                },
            };
            const token = {
                isCancellationRequested: false,
                onCancellationRequested: undefined,
            };
            return callback(progress, token);
        }),
        configurable: true,
    });

    Object.defineProperty(Gui, "setStatusBarMessage", {
        value: jest.fn().mockReturnValue({
            dispose: jest.fn(),
        }),
        configurable: true,
    });
    Object.defineProperty(vscode.window, "createTreeView", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.workspace, "getConfiguration", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showInformationMessage", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showInputBox", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showErrorMessage", { value: jest.fn(), configurable: true });
    Object.defineProperty(Gui, "showMessage", { value: jest.fn(), configurable: true });
    Object.defineProperty(Gui, "resolveQuickPick", { value: jest.fn(), configurable: true });
    Object.defineProperty(Gui, "createQuickPick", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.commands, "executeCommand", { value: globalMocks.withProgress, configurable: true });
    Object.defineProperty(vscode, "ProgressLocation", { value: globalMocks.ProgressLocation, configurable: true });
    Object.defineProperty(Profiles, "getInstance", {
        value: jest.fn().mockReturnValue(createInstanceOfProfile(globalMocks.imperativeProfile)),
        configurable: true,
    });
    Object.defineProperty(zowe, "Download", {
        value: {
            ussFile: jest.fn().mockReturnValue({
                apiResponse: {
                    etag: "ABC123",
                },
            }),
        },
        configurable: true,
    });
    Object.defineProperty(zowe, "Utilities", { value: jest.fn(), configurable: true });
    Object.defineProperty(zowe.Utilities, "isFileTagBinOrAscii", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals, "LOG", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals.LOG, "debug", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals.LOG, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals.LOG, "warn", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "debug", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "warn", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "info", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "trace", { value: jest.fn(), configurable: true });

    return globalMocks;
}

// Idea is borrowed from: https://github.com/kulshekhar/ts-jest/blob/master/src/util/testing.ts
const mocked = <T extends (...args: any[]) => any>(fn: T): jest.Mock<ReturnType<T>> => fn as any;

describe("Shared Actions Unit Tests - Function searchForLoadedItems", () => {
    function createBlockMocks(globalMocks) {
        const newMocks = {
            datasetSessionNode: createDatasetSessionNode(globalMocks.session, globalMocks.imperativeProfile),
            ussSessionNode: createUSSSessionNode(globalMocks.session, globalMocks.imperativeProfile),
        };
        return newMocks;
    }

    afterAll(() => jest.restoreAllMocks());

    it("Checking that searchForLoadedItems works for a PDS", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const testNode = new ZoweDatasetNode(
            "HLQ.PROD2.STUFF",
            vscode.TreeItemCollapsibleState.Collapsed,
            blockMocks.datasetSessionNode,
            globalMocks.session,
            globals.DS_PDS_CONTEXT
        );
        const testDatasetTree = createDatasetTree(blockMocks.datasetSessionNode, globalMocks.treeView);
        testDatasetTree.getAllLoadedItems.mockResolvedValueOnce([testNode]);
        const testUssTree = createUSSTree([], [blockMocks.ussSessionNode], globalMocks.treeView);
        Object.defineProperty(testUssTree, "getAllLoadedItems", {
            value: jest.fn().mockResolvedValueOnce([]),
            configurable: true,
        });
        testDatasetTree.getChildren.mockImplementation((arg) => {
            if (arg) {
                return Promise.resolve([testNode]);
            } else {
                return Promise.resolve([blockMocks.datasetSessionNode]);
            }
        });

        const qpItem = new utils.FilterItem({ text: "[sestest]: HLQ.PROD2.STUFF" });
        const quickPickContent = createQuickPickContent(qpItem, [qpItem], globalMocks.qpPlaceholder);
        quickPickContent.placeholder = "Select a filter";
        mocked(Gui.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(qpItem);

        await sharedActions.searchInAllLoadedItems(testDatasetTree, testUssTree);
        expect(testDatasetTree.addSearchHistory).not.toBeCalled();
    });
    it("Checking that searchForLoadedItems works for a member", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const testNode = new ZoweDatasetNode(
            "HLQ.PROD2.STUFF",
            vscode.TreeItemCollapsibleState.Collapsed,
            blockMocks.datasetSessionNode,
            globalMocks.session,
            globals.DS_DS_CONTEXT
        );
        const testMember = new ZoweDatasetNode(
            "TESTMEMB",
            vscode.TreeItemCollapsibleState.Collapsed,
            testNode,
            globalMocks.session,
            globals.DS_MEMBER_CONTEXT
        );
        testNode.children.push(testMember);
        const testDatasetTree = createDatasetTree(blockMocks.datasetSessionNode, globalMocks.treeView);
        testDatasetTree.getChildren.mockReturnValue([blockMocks.datasetSessionNode]);

        jest.spyOn(dsActions, "openPS").mockResolvedValueOnce(null as any);
        testDatasetTree.getAllLoadedItems.mockResolvedValueOnce([testMember]);
        const testUssTree = createUSSTree([], [blockMocks.ussSessionNode], globalMocks.treeView);
        Object.defineProperty(testUssTree, "getAllLoadedItems", {
            value: jest.fn().mockResolvedValueOnce([]),
            configurable: true,
        });
        testDatasetTree.getChildren.mockImplementation((arg) => {
            if (arg === testNode) {
                return Promise.resolve([testMember]);
            } else if (arg) {
                return Promise.resolve([testNode]);
            } else {
                return Promise.resolve([blockMocks.datasetSessionNode]);
            }
        });
        const qpItem = new utils.FilterItem({ text: "[sestest]: HLQ.PROD2.STUFF(TESTMEMB)" });
        const quickPickContent = createQuickPickContent(qpItem, [qpItem], globalMocks.qpPlaceholder);
        quickPickContent.placeholder = "Select a filter";
        mocked(Gui.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(qpItem);

        await sharedActions.searchInAllLoadedItems(testDatasetTree, testUssTree);
        expect(testDatasetTree.addSearchHistory).toBeCalledWith("HLQ.PROD2.STUFF(TESTMEMB)");
    });
    it("Checking that searchForLoadedItems works for a USS folder", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const folder = new ZoweUSSNode(
            "folder",
            vscode.TreeItemCollapsibleState.Collapsed,
            blockMocks.ussSessionNode,
            null as any,
            "/",
            false,
            globalMocks.imperativeProfile.name
        );
        const testUssTree = createUSSTree([], [blockMocks.ussSessionNode], globalMocks.treeView);
        Object.defineProperty(testUssTree, "getAllLoadedItems", {
            value: jest.fn().mockResolvedValueOnce([folder]),
            configurable: true,
        });
        jest.spyOn(folder, "getProfileName").mockImplementationOnce(() => "firstName");
        jest.spyOn(blockMocks.ussSessionNode, "getChildren").mockResolvedValueOnce([folder]);

        const qpItem = new utils.FilterItem({ text: "[sestest]: /folder" });
        const quickPickContent = createQuickPickContent(qpItem, [qpItem], globalMocks.qpPlaceholder);
        quickPickContent.placeholder = "Select a filter";
        mocked(Gui.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(qpItem);
        Object.defineProperty(testUssTree, "setItem", {
            value: jest.fn().mockImplementation(),
            configurable: true,
        });

        const openNode = jest.spyOn(folder, "openUSS").mockImplementation();
        await sharedActions.searchInAllLoadedItems(undefined, testUssTree);
        expect(openNode).not.toBeCalled();
    });
    it("Checking that searchForLoadedItems works for a USS file", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const folder = new ZoweUSSNode(
            "folder",
            vscode.TreeItemCollapsibleState.Collapsed,
            blockMocks.ussSessionNode,
            null as any,
            "/",
            false,
            globalMocks.imperativeProfile.name
        );
        const file = new ZoweUSSNode(
            "file",
            vscode.TreeItemCollapsibleState.None,
            folder,
            null as any,
            "/folder",
            false,
            globalMocks.imperativeProfile.name,
            "",
            globalMocks.imperativeProfile
        );
        const testUssTree = createUSSTree([], [blockMocks.ussSessionNode], globalMocks.treeView);
        Object.defineProperty(testUssTree, "getAllLoadedItems", {
            value: jest.fn().mockResolvedValueOnce([file]),
            configurable: true,
        });
        jest.spyOn(blockMocks.ussSessionNode, "getChildren").mockResolvedValueOnce([folder]);
        jest.spyOn(folder, "getChildren").mockResolvedValueOnce([file]);

        const qpItem = new utils.FilterItem({ text: "[sestest]: /folder/file" });
        const quickPickContent = createQuickPickContent(qpItem, [qpItem], globalMocks.qpPlaceholder);
        quickPickContent.placeholder = "Select a filter";
        mocked(Gui.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(qpItem);
        Object.defineProperty(testUssTree, "setItem", {
            value: jest.fn().mockImplementation(),
            configurable: true,
        });

        const openNode = jest.spyOn(file, "openUSS").mockImplementation();
        await sharedActions.searchInAllLoadedItems(undefined, testUssTree);

        expect(testUssTree.addSearchHistory).toBeCalledWith("/folder/file");
        expect(openNode).toHaveBeenCalledWith(false, true, testUssTree);
    });
    it("Checking that searchForLoadedItems fails when no pattern is entered", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const testDatasetTree = createDatasetTree(blockMocks.datasetSessionNode, globalMocks.treeView);
        testDatasetTree.getAllLoadedItems.mockResolvedValueOnce([]);
        const testUssTree = createUSSTree([], [blockMocks.ussSessionNode], globalMocks.treeView);
        Object.defineProperty(testUssTree, "getAllLoadedItems", {
            value: jest.fn().mockResolvedValueOnce([]),
            configurable: true,
        });
        const qpItem = "";
        const quickPickContent = createQuickPickContent(qpItem, [qpItem as any], globalMocks.qpPlaceholder);
        quickPickContent.placeholder = "Select a filter";
        mocked(Gui.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(qpItem as any);

        await sharedActions.searchInAllLoadedItems(testDatasetTree, testUssTree);
        expect(testUssTree.addSearchHistory).not.toBeCalled();
    });
});

describe("Shared Actions Unit Tests - Function openRecentMemberPrompt", () => {
    function createBlockMocks(globalMocks) {
        const newMocks = {
            datasetSessionNode: createDatasetSessionNode(globalMocks.session, globalMocks.imperativeProfile),
            ussSessionNode: createUSSSessionNode(globalMocks.session, globalMocks.imperativeProfile),
            quickPickItem: createQuickPickItem(),
        };
        return newMocks;
    }

    it("Tests that openRecentMemberPrompt (opening a recent member) is executed successfully on a PDS", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const dsNode = new ZoweDatasetNode("node", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.datasetSessionNode, globalMocks.session);
        const child = new ZoweDatasetNode("child", vscode.TreeItemCollapsibleState.None, dsNode, globalMocks.session);
        child.contextValue = globals.DS_MEMBER_CONTEXT;
        child.pattern = child.label as string;
        const qpItem = new utils.FilterDescriptor(child.pattern);
        const quickPickContent = createQuickPickContent("[sestest]: node(child)", [qpItem], globalMocks.qpPlaceholder);

        const testDatasetTree = createDatasetTree(blockMocks.datasetSessionNode, globalMocks.treeView);
        mocked(testDatasetTree.getFileHistory).mockReturnValueOnce([`[sestest]: node(child)`]);
        const testUSSTree = createUSSTree([], [blockMocks.ussSessionNode], globalMocks.treeView);
        mocked(testUSSTree.getFileHistory).mockReturnValueOnce([]);
        mocked(Gui.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(qpItem);

        await sharedActions.openRecentMemberPrompt(testDatasetTree, testUSSTree);
        expect(testDatasetTree.openItemFromPath).toBeCalledWith(`[sestest]: node(child)`, blockMocks.datasetSessionNode);
    });

    it("Tests that openRecentMemberPrompt (opening a recent member) is executed successfully on a DS", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const dsNode = new ZoweDatasetNode("node", vscode.TreeItemCollapsibleState.Collapsed, blockMocks.datasetSessionNode, globalMocks.session);
        dsNode.contextValue = globals.DS_DS_CONTEXT;
        const qpItem = new utils.FilterDescriptor(dsNode.label as string);
        const quickPickContent = createQuickPickContent("[sestest]: node", [qpItem], globalMocks.qpPlaceholder);

        const testDatasetTree = createDatasetTree(blockMocks.datasetSessionNode, globalMocks.treeView);
        mocked(testDatasetTree.getFileHistory).mockReturnValueOnce([`[sestest]: node`]);
        const testUSSTree = createUSSTree([], [blockMocks.ussSessionNode], globalMocks.treeView);
        mocked(testUSSTree.getFileHistory).mockReturnValueOnce([]);
        mocked(Gui.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(qpItem);

        await sharedActions.openRecentMemberPrompt(testDatasetTree, testUSSTree);
        expect(testDatasetTree.openItemFromPath).toBeCalledWith(`[sestest]: node`, blockMocks.datasetSessionNode);
    });

    it("Tests that openRecentMemberPrompt (opening a recent member) is executed successfully on a USS file", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const node = new ZoweUSSNode(
            "node3.txt",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.ussSessionNode,
            null as any,
            "/node1/node2",
            false,
            globalMocks.imperativeProfile.name
        );
        node.contextValue = globals.DS_DS_CONTEXT;
        const qpItem = new utils.FilterDescriptor(node.label as string);
        const quickPickContent = createQuickPickContent("[sestest]: /node1/node2/node3.txt", [qpItem], globalMocks.qpPlaceholder);

        const testDatasetTree = createDatasetTree(blockMocks.datasetSessionNode, globalMocks.treeView);
        mocked(testDatasetTree.getFileHistory).mockReturnValueOnce([]);
        const testUSSTree = createUSSTree([], [blockMocks.ussSessionNode], globalMocks.treeView);
        mocked(testUSSTree.getFileHistory).mockReturnValueOnce([`[sestest]: /node1/node2/node3.txt`]);
        mocked(Gui.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(qpItem);

        await sharedActions.openRecentMemberPrompt(testDatasetTree, testUSSTree);
        expect(testUSSTree.openItemFromPath).toBeCalledWith(`/node1/node2/node3.txt`, blockMocks.ussSessionNode);
    });
});

describe("Shared Actions Unit Tests - Function returnIconState", () => {
    function createBlockMocks(globalMocks) {
        const newMocks = {
            datasetSessionNode: createDatasetSessionNode(globalMocks.session, globalMocks.imperativeProfile),
            mockGetIconByNode: jest.fn(),
        };
        newMocks.mockGetIconByNode.mockReturnValue(IconId.sessionActive);
        return newMocks;
    }

    it("Tests that returnIconState is resetting active icons", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const resultNode: IZoweNodeType = blockMocks.datasetSessionNode;
        const resultIcon = getIconById(IconId.session);
        resultNode.iconPath = resultIcon.path;

        const testNode: IZoweNodeType = blockMocks.datasetSessionNode;
        const sessionIcon = getIconById(IconId.sessionActive);
        testNode.iconPath = sessionIcon.path;

        const response = await sharedActions.returnIconState(testNode);
        expect(getIconByNode(response)).toEqual(getIconByNode(resultNode));
    });

    it("Tests that returnIconState is resetting inactive icons", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const resultNode: IZoweNodeType = blockMocks.datasetSessionNode;
        const resultIcon = getIconById(IconId.session);
        resultNode.iconPath = resultIcon.path;
        const testNode: IZoweNodeType = blockMocks.datasetSessionNode;
        const sessionIcon = getIconById(IconId.sessionInactive);
        testNode.iconPath = sessionIcon.path;

        blockMocks.mockGetIconByNode.mockReturnValueOnce(IconId.sessionInactive);
        const response = await sharedActions.returnIconState(testNode);
        expect(getIconByNode(response)).toEqual(getIconByNode(resultNode));
    });
});

describe("Shared Actions Unit Tests - Function resetValidationSettings", () => {
    function createBlockMocks(globalMocks) {
        const newMocks = {
            datasetSessionNode: createDatasetSessionNode(globalMocks.session, globalMocks.imperativeProfile),
            mockEnableValidationContext: jest.fn(),
            mockDisableValidationContext: jest.fn(),
            mockCheckProfileValidationSetting: jest.fn(),
        };
        return newMocks;
    }

    it("Tests that resetValidationSettings resets contextValue to false upon global change", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const testNode: IZoweNodeType = blockMocks.datasetSessionNode;
        testNode.contextValue = `${globals.DS_SESSION_CONTEXT}${globals.VALIDATE_SUFFIX}true`;
        const mockNode: IZoweNodeType = blockMocks.datasetSessionNode;
        mockNode.contextValue = `${globals.DS_SESSION_CONTEXT}${globals.VALIDATE_SUFFIX}false`;
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    disableValidationContext: blockMocks.mockDisableValidationContext.mockReturnValue(mockNode),
                    checkProfileValidationSetting: blockMocks.mockCheckProfileValidationSetting.mockReturnValue(false),
                };
            }),
        });
        const response = await sharedActions.resetValidationSettings(testNode, false);
        expect(response.contextValue).toContain(`${globals.VALIDATE_SUFFIX}false`);
    });

    it("Tests that resetValidationSettings resets contextValue to true upon global change", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const testNode: IZoweNodeType = blockMocks.datasetSessionNode;
        testNode.contextValue = `${globals.DS_SESSION_CONTEXT}${globals.VALIDATE_SUFFIX}false`;
        const mockNode: IZoweNodeType = blockMocks.datasetSessionNode;
        mockNode.contextValue = `${globals.DS_SESSION_CONTEXT}${globals.VALIDATE_SUFFIX}true`;
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    enableValidationContext: blockMocks.mockEnableValidationContext.mockReturnValue(mockNode),
                    checkProfileValidationSetting: blockMocks.mockCheckProfileValidationSetting.mockReturnValue(true),
                };
            }),
        });
        const response = await sharedActions.resetValidationSettings(testNode, true);
        expect(response.contextValue).toContain(`${globals.VALIDATE_SUFFIX}true`);
    });
});
