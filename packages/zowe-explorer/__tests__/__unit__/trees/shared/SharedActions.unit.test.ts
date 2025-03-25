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
    createGetConfigMock,
    createInstanceOfProfile,
    createIProfile,
    createISession,
    createISessionWithoutCredentials,
    createQuickPickContent,
    createQuickPickItem,
    createTreeProviders,
    createTreeView,
} from "../../../__mocks__/mockCreators/shared";
import { createDatasetSessionNode, createDatasetTree } from "../../../__mocks__/mockCreators/datasets";
import { Gui, IZoweTree, IZoweTreeNode, Sorting, Types } from "@zowe/zowe-explorer-api";
import { Profiles } from "../../../../src/configuration/Profiles";
import { ZoweDatasetNode } from "../../../../src/trees/dataset/ZoweDatasetNode";
import { createUSSSessionNode, createUSSTree } from "../../../__mocks__/mockCreators/uss";
import { ZoweUSSNode } from "../../../../src/trees/uss/ZoweUSSNode";
import * as zosfiles from "@zowe/zos-files-for-zowe-sdk";
import { ZoweLogger } from "../../../../src/tools/ZoweLogger";
import { ZoweLocalStorage } from "../../../../src/tools/ZoweLocalStorage";
import { mocked } from "../../../__mocks__/mockUtils";
import { UssFSProvider } from "../../../../src/trees/uss/UssFSProvider";
import { Constants } from "../../../../src/configuration/Constants";
import { FilterDescriptor, FilterItem } from "../../../../src/management/FilterManagement";
import { SharedActions } from "../../../../src/trees/shared/SharedActions";
import { IconUtils } from "../../../../src/icons/IconUtils";
import { IconGenerator } from "../../../../src/icons/IconGenerator";
import { SharedTreeProviders } from "../../../../src/trees/shared/SharedTreeProviders";
import { TreeViewUtils } from "../../../../src/utils/TreeViewUtils";
import { SettingsConfig } from "../../../../src/configuration/SettingsConfig";
import { ZoweExplorerExtender } from "../../../../src/extending/ZoweExplorerExtender";
import { ZoweExplorerApiRegister } from "../../../../src/extending/ZoweExplorerApiRegister";
import { AuthUtils } from "../../../../src/utils/AuthUtils";

function createGlobalMocks() {
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
        FileSystemProvider: {
            createDirectory: jest.fn(),
        },
    };

    jest.spyOn(UssFSProvider.instance, "createDirectory").mockImplementation(globalMocks.FileSystemProvider.createDirectory);

    Object.defineProperty(vscode.window, "withProgress", {
        value: jest.fn().mockImplementation((_, callback) => {
            const progress = {
                report: jest.fn(),
            };
            const token = {
                isCancellationRequested: false,
                onCancellationRequested: jest.fn(),
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
    Object.defineProperty(vscode.window, "createTreeView", {
        value: jest.fn().mockReturnValue({ onDidCollapseElement: jest.fn() }),
        configurable: true,
    });
    Object.defineProperty(vscode.workspace, "getConfiguration", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showInformationMessage", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showInputBox", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showErrorMessage", { value: jest.fn(), configurable: true });
    Object.defineProperty(Gui, "showMessage", { value: jest.fn(), configurable: true });
    Object.defineProperty(Gui, "resolveQuickPick", { value: jest.fn(), configurable: true });
    Object.defineProperty(Gui, "createQuickPick", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode, "ProgressLocation", { value: globalMocks.ProgressLocation, configurable: true });
    Object.defineProperty(Profiles, "getInstance", {
        value: jest.fn().mockReturnValue(createInstanceOfProfile(globalMocks.imperativeProfile)),
        configurable: true,
    });
    Object.defineProperty(SettingsConfig, "getDirectValue", {
        value: createGetConfigMock({
            "zowe.ds.default.sort": Sorting.DatasetSortOpts.Name,
            "zowe.jobs.default.sort": Sorting.JobSortOpts.Id,
        }),
        configurable: true,
    });
    Object.defineProperty(zosfiles, "Download", {
        value: {
            ussFile: jest.fn().mockReturnValue({
                apiResponse: {
                    etag: "ABC123",
                },
            }),
        },
        configurable: true,
    });
    Object.defineProperty(zosfiles, "Utilities", { value: jest.fn(), configurable: true });
    Object.defineProperty(zosfiles.Utilities, "isFileTagBinOrAscii", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "log", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger.log, "debug", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger.log, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger.log, "warn", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "debug", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "warn", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "info", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "trace", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLocalStorage, "globalState", {
        value: {
            get: () => ({ persistence: true, favorites: [], history: [], sessions: ["zosmf"], searchHistory: [], fileHistory: [] }),
            update: jest.fn(),
            keys: () => [],
        },
        configurable: true,
    });

    return globalMocks;
}

describe("Shared Actions Unit Tests - Function searchInAllLoadedItems", () => {
    function createBlockMocks(globalMocks) {
        const newMocks = {
            datasetSessionNode: createDatasetSessionNode(globalMocks.session, globalMocks.imperativeProfile),
            ussSessionNode: createUSSSessionNode(globalMocks.session, globalMocks.imperativeProfile),
        };
        return newMocks;
    }

    afterAll(() => jest.restoreAllMocks());

    it("Checking that searchInAllLoadedItems works for a PS", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const testNode = new ZoweDatasetNode({
            label: "HLQ.PROD2.STUFF",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
            session: globalMocks.session,
        });
        testNode.command = {
            command: "vscode.open",
            title: "",
            arguments: [testNode.resourceUri],
        };
        const testDatasetTree = createDatasetTree(blockMocks.datasetSessionNode, globalMocks.treeView);

        jest.spyOn(ZoweDatasetNode.prototype, "openDs").mockResolvedValueOnce(undefined);
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

        const qpItem = new FilterItem({ text: "[sestest]: HLQ.PROD2.STUFF" });
        const quickPickContent = createQuickPickContent(qpItem, [qpItem], globalMocks.qpPlaceholder);
        quickPickContent.placeholder = "Select a filter";
        mocked(Gui.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(qpItem);

        await SharedActions.searchInAllLoadedItems(testDatasetTree, testUssTree);
        expect(testDatasetTree.addSearchHistory).toHaveBeenCalledWith("HLQ.PROD2.STUFF");
    });
    it("Checking that searchInAllLoadedItems works for a PDS", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const testNode = new ZoweDatasetNode({
            label: "HLQ.PROD2.STUFF",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetSessionNode,
            session: globalMocks.session,
        });
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

        const qpItem = new FilterItem({ text: "[sestest]: HLQ.PROD2.STUFF" });
        const quickPickContent = createQuickPickContent(qpItem, [qpItem], globalMocks.qpPlaceholder);
        quickPickContent.placeholder = "Select a filter";
        mocked(Gui.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(qpItem);

        await SharedActions.searchInAllLoadedItems(testDatasetTree, testUssTree);
        expect(testDatasetTree.addSearchHistory).not.toHaveBeenCalled();
    });
    it("Checking that searchInAllLoadedItems works for a member", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const testNode = new ZoweDatasetNode({
            label: "HLQ.PROD2.STUFF",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetSessionNode,
            session: globalMocks.session,
        });
        const testMember = new ZoweDatasetNode({
            label: "TESTMEMB",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: testNode,
            session: globalMocks.session,
        });
        testMember.command = {
            command: "vscode.open",
            title: "",
            arguments: [testMember.resourceUri],
        };
        testNode.children.push(testMember);
        const testDatasetTree = createDatasetTree(blockMocks.datasetSessionNode, globalMocks.treeView);
        testDatasetTree.getChildren.mockReturnValue([blockMocks.datasetSessionNode]);

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
        const qpItem = new FilterItem({ text: "[sestest]: HLQ.PROD2.STUFF(TESTMEMB)" });
        const quickPickContent = createQuickPickContent(qpItem, [qpItem], globalMocks.qpPlaceholder);
        quickPickContent.placeholder = "Select a filter";
        mocked(Gui.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(qpItem);

        await SharedActions.searchInAllLoadedItems(testDatasetTree, testUssTree);
        expect(testDatasetTree.addSearchHistory).toHaveBeenCalledWith("HLQ.PROD2.STUFF(TESTMEMB)");
    });
    it("Checking that searchInAllLoadedItems works for a USS folder", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const folder = new ZoweUSSNode({
            label: "folder",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.ussSessionNode,
            profile: globalMocks.imperativeProfile,
            parentPath: "/",
        });
        const testUssTree = createUSSTree([], [blockMocks.ussSessionNode], globalMocks.treeView);
        Object.defineProperty(testUssTree, "getAllLoadedItems", {
            value: jest.fn().mockResolvedValueOnce([folder]),
            configurable: true,
        });
        jest.spyOn(folder, "getProfileName").mockImplementationOnce(() => "firstName");
        jest.spyOn(blockMocks.ussSessionNode, "getChildren").mockResolvedValueOnce([folder]);

        const qpItem = new FilterItem({ text: "[sestest]: /folder" });
        const quickPickContent = createQuickPickContent(qpItem, [qpItem], globalMocks.qpPlaceholder);
        quickPickContent.placeholder = "Select a filter";
        mocked(Gui.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(qpItem);
        Object.defineProperty(testUssTree, "setItem", {
            value: jest.fn().mockImplementation(),
            configurable: true,
        });

        const openNode = jest.spyOn(folder, "openUSS").mockImplementation();
        await SharedActions.searchInAllLoadedItems(undefined, testUssTree);
        expect(openNode).not.toHaveBeenCalled();
    });
    it("Checking that searchInAllLoadedItems works for a USS file", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const folder = new ZoweUSSNode({
            label: "folder",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.ussSessionNode,
            profile: globalMocks.imperativeProfile,
            parentPath: "/",
        });
        const file = new ZoweUSSNode({
            label: "file",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: folder,
            profile: globalMocks.imperativeProfile,
            parentPath: "/folder",
        });
        const testUssTree = createUSSTree([], [blockMocks.ussSessionNode], globalMocks.treeView);
        Object.defineProperty(testUssTree, "getAllLoadedItems", {
            value: jest.fn().mockResolvedValueOnce([file]),
            configurable: true,
        });
        jest.spyOn(blockMocks.ussSessionNode, "getChildren").mockResolvedValueOnce([folder]);
        jest.spyOn(folder, "getChildren").mockResolvedValueOnce([file]);

        const qpItem = new FilterItem({ text: "[sestest]: /folder/file" });
        const quickPickContent = createQuickPickContent(qpItem, [qpItem], globalMocks.qpPlaceholder);
        quickPickContent.placeholder = "Select a filter";
        mocked(Gui.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(qpItem);
        Object.defineProperty(testUssTree, "setItem", {
            value: jest.fn().mockImplementation(),
            configurable: true,
        });

        const openNode = jest.spyOn(file, "openUSS").mockImplementation();
        await SharedActions.searchInAllLoadedItems(undefined, testUssTree);

        expect(testUssTree.addSearchHistory).toHaveBeenCalledWith("/folder/file");
        expect(openNode).toHaveBeenCalledWith(false, true, testUssTree);
    });
    it("Checking that searchInAllLoadedItems fails when no pattern is entered", async () => {
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

        await SharedActions.searchInAllLoadedItems(testDatasetTree, testUssTree);
        expect(testUssTree.addSearchHistory).not.toHaveBeenCalled();
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

        const dsNode = new ZoweDatasetNode({
            label: "node",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetSessionNode,
            session: globalMocks.session,
        });
        const child = new ZoweDatasetNode({
            label: "child",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: dsNode,
            session: globalMocks.session,
        });
        child.contextValue = Constants.DS_MEMBER_CONTEXT;
        child.pattern = child.label as string;
        const qpItem = new FilterDescriptor(child.pattern);
        const quickPickContent = createQuickPickContent("[sestest]: node(child)", [qpItem], globalMocks.qpPlaceholder);

        const testDatasetTree = createDatasetTree(blockMocks.datasetSessionNode, globalMocks.treeView);
        mocked(testDatasetTree.getFileHistory).mockReturnValueOnce([`[sestest]: node(child)`]);
        const testUSSTree = createUSSTree([], [blockMocks.ussSessionNode], globalMocks.treeView);
        mocked(testUSSTree.getFileHistory).mockReturnValueOnce([]);
        mocked(Gui.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(qpItem);

        await SharedActions.openRecentMemberPrompt(testDatasetTree, testUSSTree);
        expect(testDatasetTree.openItemFromPath).toHaveBeenCalledWith(`[sestest]: node(child)`, blockMocks.datasetSessionNode);
    });

    it("Tests that openRecentMemberPrompt (opening a recent member) is executed successfully on a DS", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const dsNode = new ZoweDatasetNode({
            label: "node",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetSessionNode,
            session: globalMocks.session,
        });
        dsNode.contextValue = Constants.DS_DS_CONTEXT;
        const qpItem = new FilterDescriptor(dsNode.label as string);
        const quickPickContent = createQuickPickContent("[sestest]: node", [qpItem], globalMocks.qpPlaceholder);

        const testDatasetTree = createDatasetTree(blockMocks.datasetSessionNode, globalMocks.treeView);
        mocked(testDatasetTree.getFileHistory).mockReturnValueOnce([`[sestest]: node`]);
        const testUSSTree = createUSSTree([], [blockMocks.ussSessionNode], globalMocks.treeView);
        mocked(testUSSTree.getFileHistory).mockReturnValueOnce([]);
        mocked(Gui.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(qpItem);

        await SharedActions.openRecentMemberPrompt(testDatasetTree, testUSSTree);
        expect(testDatasetTree.openItemFromPath).toHaveBeenCalledWith(`[sestest]: node`, blockMocks.datasetSessionNode);
    });

    it("Tests that openRecentMemberPrompt (opening a recent member) is executed successfully on a USS file", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const node = new ZoweUSSNode({
            label: "node3.txt",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.ussSessionNode,
            profile: globalMocks.imperativeProfile,
            parentPath: "/node1/node2",
        });
        node.contextValue = Constants.DS_DS_CONTEXT;
        const qpItem = new FilterDescriptor(node.label as string);
        const quickPickContent = createQuickPickContent("[sestest]: /node1/node2/node3.txt", [qpItem], globalMocks.qpPlaceholder);

        const testDatasetTree = createDatasetTree(blockMocks.datasetSessionNode, globalMocks.treeView);
        mocked(testDatasetTree.getFileHistory).mockReturnValueOnce([]);
        const testUSSTree = createUSSTree([], [blockMocks.ussSessionNode], globalMocks.treeView);
        mocked(testUSSTree.getFileHistory).mockReturnValueOnce([`[sestest]: /node1/node2/node3.txt`]);
        mocked(Gui.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(qpItem);

        await SharedActions.openRecentMemberPrompt(testDatasetTree, testUSSTree);
        expect(testUSSTree.openItemFromPath).toHaveBeenCalledWith(`/node1/node2/node3.txt`, blockMocks.ussSessionNode);
    });

    it("Tests that openRecentMemberPrompt shows 'Profile not found' message when session is not valid", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const quickPickContent = createQuickPickContent("[invalid]: node", [], globalMocks.qpPlaceholder);
        const testDatasetTree = createDatasetTree(blockMocks.datasetSessionNode, globalMocks.treeView);
        mocked(testDatasetTree.getFileHistory).mockReturnValueOnce([`[invalid]: node`]);
        const testUSSTree = createUSSTree([], [blockMocks.ussSessionNode], globalMocks.treeView);
        mocked(testUSSTree.getFileHistory).mockReturnValueOnce([]);
        mocked(Gui.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(new FilterDescriptor("node"));

        const showMessageSpy = jest.spyOn(Gui, "showMessage");

        await SharedActions.openRecentMemberPrompt(testDatasetTree, testUSSTree);
        expect(showMessageSpy).toHaveBeenCalledWith("Profile not found.");
    });

    it("Tests that openRecentMemberPrompt handles profile names with different casings for Data Set", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const dsNode = new ZoweDatasetNode({
            label: "node",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: blockMocks.datasetSessionNode,
            session: globalMocks.session,
        });
        dsNode.contextValue = Constants.DS_DS_CONTEXT;
        const qpItem = new FilterDescriptor(dsNode.label as string);
        const quickPickContent = createQuickPickContent("[SESTEST]: node", [qpItem], globalMocks.qpPlaceholder);

        const testDatasetTree = createDatasetTree(blockMocks.datasetSessionNode, globalMocks.treeView);
        mocked(testDatasetTree.getFileHistory).mockReturnValueOnce([`[SESTEST]: node`]);
        const testUSSTree = createUSSTree([], [blockMocks.ussSessionNode], globalMocks.treeView);
        mocked(testUSSTree.getFileHistory).mockReturnValueOnce([]);
        mocked(Gui.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(qpItem);

        await SharedActions.openRecentMemberPrompt(testDatasetTree, testUSSTree);
        expect(testDatasetTree.openItemFromPath).toHaveBeenCalledWith(`[SESTEST]: node`, blockMocks.datasetSessionNode);
    });

    it("Tests that openRecentMemberPrompt handles profile names with different casings for USS", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const node = new ZoweUSSNode({
            label: "node3.txt",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.ussSessionNode,
            profile: globalMocks.imperativeProfile,
            parentPath: "/node1/node2",
        });
        node.contextValue = Constants.DS_DS_CONTEXT;
        const qpItem = new FilterDescriptor(node.label as string);
        const quickPickContent = createQuickPickContent("[SESTEST]: /node1/node2/node3.txt", [qpItem], globalMocks.qpPlaceholder);

        const testDatasetTree = createDatasetTree(blockMocks.datasetSessionNode, globalMocks.treeView);
        mocked(testDatasetTree.getFileHistory).mockReturnValueOnce([]);
        const testUSSTree = createUSSTree([], [blockMocks.ussSessionNode], globalMocks.treeView);
        mocked(testUSSTree.getFileHistory).mockReturnValueOnce([`[SESTEST]: /node1/node2/node3.txt`]);
        mocked(Gui.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(qpItem);

        await SharedActions.openRecentMemberPrompt(testDatasetTree, testUSSTree);
        expect(testUSSTree.openItemFromPath).toHaveBeenCalledWith(`/node1/node2/node3.txt`, blockMocks.ussSessionNode);
    });

    it("Tests that openRecentMemberPrompt shows a UI message when the profile is not found on a USS path and returns early", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const quickPickContent = createQuickPickContent("[invalid]: /profile/dir/file.txt", [], globalMocks.qpPlaceholder);
        const testDatasetTree = createDatasetTree(blockMocks.datasetSessionNode, globalMocks.treeView);
        mocked(testDatasetTree.getFileHistory).mockReturnValueOnce([]);
        const testUSSTree = createUSSTree([], [blockMocks.ussSessionNode], globalMocks.treeView);
        mocked(testUSSTree.getFileHistory).mockReturnValueOnce([`[invalid]: /profile/dir/file.txt`]);
        mocked(Gui.createQuickPick).mockReturnValueOnce(quickPickContent);
        jest.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(new FilterDescriptor("[invalid]: /profile/dir/file.txt"));
        const showMessageSpy = jest.spyOn(Gui, "showMessage");

        await SharedActions.openRecentMemberPrompt(testDatasetTree, testUSSTree);
        expect(showMessageSpy).toHaveBeenCalledWith("Profile not found.");
        expect(testDatasetTree.openItemFromPath).not.toHaveBeenCalled();
        expect(testUSSTree.openItemFromPath).not.toHaveBeenCalled();
    });
});

describe("Shared Actions Unit Tests - Function returnIconState", () => {
    function createBlockMocks(globalMocks) {
        const newMocks = {
            datasetSessionNode: createDatasetSessionNode(globalMocks.session, globalMocks.imperativeProfile),
            mockGetIconByNode: jest.fn(),
        };
        newMocks.mockGetIconByNode.mockReturnValue(IconUtils.IconId.sessionActive);
        return newMocks;
    }

    it("Tests that returnIconState is resetting active icons", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const resultNode: Types.IZoweNodeType = blockMocks.datasetSessionNode;
        const resultIcon = IconGenerator.getIconById(IconUtils.IconId.session);
        resultNode.iconPath = resultIcon.path;

        const testNode: Types.IZoweNodeType = blockMocks.datasetSessionNode;
        const sessionIcon = IconGenerator.getIconById(IconUtils.IconId.sessionActive);
        testNode.iconPath = sessionIcon.path;

        SharedActions.returnIconState(testNode);
        expect(IconGenerator.getIconByNode(testNode)).toEqual(IconGenerator.getIconByNode(resultNode));
    });

    it("Tests that returnIconState is resetting inactive icons", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const resultNode: Types.IZoweNodeType = blockMocks.datasetSessionNode;
        const resultIcon = IconGenerator.getIconById(IconUtils.IconId.session);
        resultNode.iconPath = resultIcon.path;
        const testNode: Types.IZoweNodeType = blockMocks.datasetSessionNode;
        const sessionIcon = IconGenerator.getIconById(IconUtils.IconId.sessionInactive);
        testNode.iconPath = sessionIcon.path;

        blockMocks.mockGetIconByNode.mockReturnValueOnce(IconUtils.IconId.sessionInactive);
        SharedActions.returnIconState(testNode);
        expect(IconGenerator.getIconByNode(testNode)).toEqual(IconGenerator.getIconByNode(resultNode));
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
        const testNode: Types.IZoweNodeType = blockMocks.datasetSessionNode;
        testNode.contextValue = `${Constants.DS_SESSION_CONTEXT}${Constants.VALIDATE_SUFFIX}true`;
        const mockNode: Types.IZoweNodeType = blockMocks.datasetSessionNode;
        mockNode.contextValue = `${Constants.DS_SESSION_CONTEXT}${Constants.VALIDATE_SUFFIX}false`;
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    disableValidationContext: blockMocks.mockDisableValidationContext.mockReturnValue(mockNode),
                    checkProfileValidationSetting: blockMocks.mockCheckProfileValidationSetting.mockReturnValue(false),
                };
            }),
        });
        const response = await SharedActions.resetValidationSettings(testNode, false);
        expect(response.contextValue).toContain(`${Constants.VALIDATE_SUFFIX}false`);
    });

    it("Tests that resetValidationSettings resets contextValue to true upon global change", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);
        const testNode: Types.IZoweNodeType = blockMocks.datasetSessionNode;
        testNode.contextValue = `${Constants.DS_SESSION_CONTEXT}${Constants.VALIDATE_SUFFIX}false`;
        const mockNode: Types.IZoweNodeType = blockMocks.datasetSessionNode;
        mockNode.contextValue = `${Constants.DS_SESSION_CONTEXT}${Constants.VALIDATE_SUFFIX}true`;
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    enableValidationContext: blockMocks.mockEnableValidationContext.mockReturnValue(mockNode),
                    checkProfileValidationSetting: blockMocks.mockCheckProfileValidationSetting.mockReturnValue(true),
                };
            }),
        });
        const response = await SharedActions.resetValidationSettings(testNode, true);
        expect(response.contextValue).toContain(`${Constants.VALIDATE_SUFFIX}true`);
    });
});

describe("Shared Actions Unit Tests - Function refreshAll", () => {
    afterAll(() => {
        jest.restoreAllMocks();
    });

    it("should refresh all tree providers and update session nodes", async () => {
        createGlobalMocks();
        jest.spyOn(SharedTreeProviders, "providers", "get").mockReturnValue(createTreeProviders());
        const removedProfNames = new Set<string>();
        const addedProfTypes = new Set<string>();
        const removeSessionSpy = jest
            .spyOn(TreeViewUtils, "removeSession")
            .mockImplementation((treeProvider, profileName) => removedProfNames.add(profileName) as any);
        const addDefaultSessionSpy = jest
            .spyOn(TreeViewUtils, "addDefaultSession")
            .mockImplementation((treeProvider, profileType) => addedProfTypes.add(profileType) as any);
        await SharedActions.refreshAll();
        expect(removeSessionSpy).toHaveBeenCalledTimes(6);
        expect([...removedProfNames]).toEqual(["zosmf", "zosmf2"]);
        expect(addDefaultSessionSpy).toHaveBeenCalledTimes(3);
        expect([...addedProfTypes]).toEqual(["zosmf"]);
    });

    it("should avoid running the refresh logic twice if a refresh is already in progress", async () => {
        createGlobalMocks();
        jest.spyOn(SharedTreeProviders, "providers", "get").mockReturnValue(createTreeProviders());
        const removedProfNames = new Set<string>();
        const addedProfTypes = new Set<string>();
        const removeSessionSpy = jest
            .spyOn(TreeViewUtils, "removeSession")
            .mockImplementation((treeProvider, profileName) => removedProfNames.add(profileName) as any);
        const addDefaultSessionSpy = jest
            .spyOn(TreeViewUtils, "addDefaultSession")
            .mockImplementation((treeProvider, profileType) => addedProfTypes.add(profileType) as any);
        void SharedActions.refreshAll();
        await SharedActions.refreshAll();

        // expect same amount of assertions even though refresh was called twice
        expect(removeSessionSpy).toHaveBeenCalledTimes(6);
        expect(addDefaultSessionSpy).toHaveBeenCalledTimes(3);
    });
});

describe("Shared Actions Unit Tests - Function refreshProfiles", () => {
    it("calls refresh on Profiles instance", async () => {
        const refresh = jest.fn().mockResolvedValueOnce(undefined);
        const profilesMock = jest
            .spyOn(Profiles, "getInstance")
            .mockClear()
            .mockReturnValue({
                refresh,
            } as any);
        await expect(SharedActions.refreshProfiles()).resolves.not.toThrow();
        expect(profilesMock).toHaveBeenCalledTimes(1);
        expect(refresh).toHaveBeenCalledTimes(1);
        profilesMock.mockRestore();
    });

    it("handles any errors in the catch block", async () => {
        const refreshError = new Error("Unknown error loading profiles");
        const refresh = jest.fn().mockRejectedValueOnce(refreshError);
        const errorLoggerSpy = jest.spyOn(ZoweLogger, "error");
        const showZoweConfigErrorMock = jest.spyOn(ZoweExplorerExtender, "showZoweConfigError").mockReturnValue(undefined);
        const profilesMock = jest
            .spyOn(Profiles, "getInstance")
            .mockClear()
            .mockReturnValue({
                refresh,
            } as any);
        await expect(SharedActions.refreshProfiles()).resolves.not.toThrow();
        expect(profilesMock).toHaveBeenCalledTimes(1);
        expect(refresh).toHaveBeenCalledTimes(1);
        expect(errorLoggerSpy).toHaveBeenCalledTimes(1);
        expect(errorLoggerSpy).toHaveBeenCalledWith("Unknown error loading profiles");
        expect(showZoweConfigErrorMock).toHaveBeenCalledTimes(1);
        expect(showZoweConfigErrorMock).toHaveBeenCalledWith("Unknown error loading profiles");
        profilesMock.mockRestore();
    });
});

describe("Shared Actions Unit Tests - Function refreshProvider", () => {
    it("refreshes the tree provider and adds default sessions for API types", async () => {
        const addDefaultSessionMock = jest.spyOn(TreeViewUtils, "addDefaultSession").mockResolvedValueOnce(undefined);
        const registeredApiTypesMock = jest.spyOn(ZoweExplorerApiRegister, "getInstance").mockReturnValueOnce({
            registeredApiTypes: jest.fn().mockReturnValue(["zftp", "zosmf"]),
        } as any);
        const refresh = jest.fn().mockResolvedValueOnce(undefined);
        const treeProvider: IZoweTree<IZoweTreeNode> = {
            mSessionNodes: [],
            refresh,
        } as any;
        await SharedActions.refreshProvider(treeProvider);
        expect(registeredApiTypesMock).toHaveBeenCalledTimes(1);
        expect(addDefaultSessionMock).toHaveBeenCalledTimes(2);
        expect(addDefaultSessionMock).toHaveBeenCalledWith(treeProvider, "zftp");
        expect(addDefaultSessionMock).toHaveBeenCalledWith(treeProvider, "zosmf");
        expect(refresh).toHaveBeenCalledTimes(1);
    });

    it("refreshes profiles if refreshProfiles parameter is true", async () => {
        const addDefaultSessionMock = jest.spyOn(TreeViewUtils, "addDefaultSession").mockClear().mockResolvedValueOnce(undefined);
        const registeredApiTypesMock = jest
            .spyOn(ZoweExplorerApiRegister, "getInstance")
            .mockClear()
            .mockReturnValueOnce({
                registeredApiTypes: jest.fn().mockReturnValue(["zftp", "zosmf"]),
            } as any);
        const refresh = jest.fn().mockResolvedValueOnce(undefined);
        const treeProvider: IZoweTree<IZoweTreeNode> = {
            mSessionNodes: [],
            refresh,
        } as any;
        const refreshProfilesMock = jest.spyOn(SharedActions, "refreshProfiles").mockResolvedValueOnce(undefined);
        await SharedActions.refreshProvider(treeProvider, true);
        expect(refreshProfilesMock).toHaveBeenCalledTimes(1);
        expect(registeredApiTypesMock).toHaveBeenCalledTimes(1);
        expect(addDefaultSessionMock).toHaveBeenCalledTimes(2);
        expect(addDefaultSessionMock).toHaveBeenCalledWith(treeProvider, "zftp");
        expect(addDefaultSessionMock).toHaveBeenCalledWith(treeProvider, "zosmf");
        expect(refresh).toHaveBeenCalledTimes(1);
    });

    it("refreshes the session nodes in the given provider", async () => {
        const addDefaultSessionMock = jest.spyOn(TreeViewUtils, "addDefaultSession").mockClear().mockResolvedValueOnce(undefined);
        const removeSessionMock = jest.spyOn(TreeViewUtils, "removeSession").mockClear().mockResolvedValueOnce(undefined);
        const registeredApiTypesMock = jest
            .spyOn(ZoweExplorerApiRegister, "getInstance")
            .mockClear()
            .mockReturnValueOnce({
                registeredApiTypes: jest.fn().mockReturnValue(["zftp", "zosmf"]),
            } as any);
        const returnIconStateMock = jest.spyOn(SharedActions, "returnIconState").mockReturnValueOnce(undefined);
        const refresh = jest.fn().mockResolvedValueOnce(undefined);
        const refreshElement = jest.fn().mockResolvedValueOnce(undefined);
        const treeProvider: IZoweTree<IZoweTreeNode> = {
            mSessionNodes: [createDatasetSessionNode(createISession(), createIProfile())],
            refresh,
            refreshElement,
        } as any;
        const profilesMock = jest.spyOn(Profiles, "getInstance").mockReturnValueOnce({
            fetchAllProfiles: jest.fn().mockReturnValue([{ name: "sestest" }]),
        } as any);
        const syncSessionNodeMock = jest.spyOn(AuthUtils, "syncSessionNode").mockReturnValueOnce(undefined);
        const refreshProfilesMock = jest.spyOn(SharedActions, "refreshProfiles").mockClear().mockResolvedValueOnce(undefined);
        await SharedActions.refreshProvider(treeProvider, true);
        expect(refreshProfilesMock).toHaveBeenCalledTimes(1);
        expect(registeredApiTypesMock).toHaveBeenCalledTimes(1);
        expect(returnIconStateMock).toHaveBeenCalledTimes(1);
        expect(syncSessionNodeMock).toHaveBeenCalledTimes(1);
        expect(removeSessionMock).not.toHaveBeenCalled();
        expect(refreshElement).toHaveBeenCalledTimes(1);
        expect(addDefaultSessionMock).toHaveBeenCalledTimes(2);
        expect(addDefaultSessionMock).toHaveBeenCalledWith(treeProvider, "zftp");
        expect(addDefaultSessionMock).toHaveBeenCalledWith(treeProvider, "zosmf");
        expect(refresh).toHaveBeenCalledTimes(1);
        profilesMock.mockRestore();
    });

    it("removes a session node in the given provider if the profile no longer exists", async () => {
        const addDefaultSessionMock = jest.spyOn(TreeViewUtils, "addDefaultSession").mockClear().mockResolvedValueOnce(undefined);
        const removeSessionMock = jest.spyOn(TreeViewUtils, "removeSession").mockClear().mockResolvedValueOnce(undefined);
        const registeredApiTypesMock = jest
            .spyOn(ZoweExplorerApiRegister, "getInstance")
            .mockClear()
            .mockReturnValueOnce({
                registeredApiTypes: jest.fn().mockReturnValue(["zftp", "zosmf"]),
            } as any);
        const refresh = jest.fn().mockResolvedValueOnce(undefined);
        const refreshElement = jest.fn().mockResolvedValueOnce(undefined);
        const treeProvider: IZoweTree<IZoweTreeNode> = {
            mSessionNodes: [createDatasetSessionNode(createISession(), createIProfile())],
            refresh,
            refreshElement,
        } as any;
        const profilesMock = jest.spyOn(Profiles, "getInstance").mockReturnValueOnce({
            fetchAllProfiles: jest.fn().mockReturnValue([]),
        } as any);
        const syncSessionNodeMock = jest.spyOn(AuthUtils, "syncSessionNode").mockReturnValueOnce(undefined);
        const refreshProfilesMock = jest.spyOn(SharedActions, "refreshProfiles").mockClear().mockResolvedValueOnce(undefined);
        await SharedActions.refreshProvider(treeProvider, true);
        expect(refreshProfilesMock).toHaveBeenCalledTimes(1);
        expect(registeredApiTypesMock).toHaveBeenCalledTimes(1);
        expect(syncSessionNodeMock).toHaveBeenCalledTimes(1);
        expect(removeSessionMock).toHaveBeenCalledTimes(1);
        expect(removeSessionMock).toHaveBeenCalledWith(treeProvider, "sestest");
        expect(refreshElement).not.toHaveBeenCalled();
        expect(addDefaultSessionMock).toHaveBeenCalledTimes(2);
        expect(addDefaultSessionMock).toHaveBeenCalledWith(treeProvider, "zftp");
        expect(addDefaultSessionMock).toHaveBeenCalledWith(treeProvider, "zosmf");
        expect(refresh).toHaveBeenCalledTimes(1);
        profilesMock.mockRestore();
    });
});

describe("Shared Actions Unit Tests - Function isRefreshInProgress", () => {
    it("returns the state of refresh", () => {
        (SharedActions as any).refreshInProgress = true;
        expect(SharedActions.isRefreshInProgress()).toBe(true);

        (SharedActions as any).refreshInProgress = false;
        expect(SharedActions.isRefreshInProgress()).toBe(false);
    });
});
