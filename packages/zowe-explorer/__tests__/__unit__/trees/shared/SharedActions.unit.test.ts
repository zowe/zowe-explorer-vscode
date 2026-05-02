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
import { vi } from "vitest";
import * as vscode from "vscode";
import {
    createConfigLoad,
    createGetConfigMock,
    createInstanceOfProfile,
    createInstanceOfProfileInfo,
    createIProfile,
    createISession,
    createISessionWithoutCredentials,
    createQuickPickContent,
    createQuickPickItem,
    createTreeProviders,
    createTreeView,
} from "../../../__mocks__/mockCreators/shared";
import { createDatasetSessionNode, createDatasetTree, createDatasetFavoritesNode } from "../../../__mocks__/mockCreators/datasets";
import { FileManagement, Gui, IZoweTree, IZoweTreeNode, Sorting, Types } from "@zowe/zowe-explorer-api";
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
import { ProfilesUtils } from "../../../../src/utils/ProfilesUtils";

function createGlobalMocks() {
    const globalMocks = {
        session: createISessionWithoutCredentials(),
        treeView: createTreeView(),
        imperativeProfile: createIProfile(),
        withProgress: null,
        mockCallback: null,
        ProgressLocation: vi.fn().mockImplementation(() => {
            return {
                Notification: 15,
            };
        }),
        qpPlaceholder: 'Choose "Create new..." to define a new profile or select an existing profile to add to the Data Set Explorer',
        FileSystemProvider: {
            createDirectory: vi.fn(),
        },
    };

    vi.spyOn(UssFSProvider.instance, "createDirectory").mockImplementation(globalMocks.FileSystemProvider.createDirectory);

    Object.defineProperty(vscode.window, "withProgress", {
        value: vi.fn().mockImplementation((_, callback) => {
            const progress = {
                report: vi.fn(),
            };
            const token = {
                isCancellationRequested: false,
                onCancellationRequested: vi.fn(),
            };
            return callback(progress, token);
        }),
        configurable: true,
    });

    Object.defineProperty(Gui, "setStatusBarMessage", {
        value: vi.fn().mockReturnValue({
            dispose: vi.fn(),
        }),
        configurable: true,
    });
    Object.defineProperty(vscode.window, "createTreeView", {
        value: vi.fn().mockReturnValue({ onDidCollapseElement: vi.fn() }),
        configurable: true,
    });
    Object.defineProperty(vscode.workspace, "getConfiguration", { value: vi.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showInformationMessage", { value: vi.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showInputBox", { value: vi.fn(), configurable: true });
    Object.defineProperty(vscode.window, "showErrorMessage", { value: vi.fn(), configurable: true });
    Object.defineProperty(Gui, "showMessage", { value: vi.fn(), configurable: true });
    Object.defineProperty(Gui, "resolveQuickPick", { value: vi.fn(), configurable: true });
    Object.defineProperty(Gui, "createQuickPick", { value: vi.fn(), configurable: true });
    Object.defineProperty(vscode, "ProgressLocation", { value: globalMocks.ProgressLocation, configurable: true });
    Object.defineProperty(Profiles, "getInstance", {
        value: vi.fn().mockReturnValue(createInstanceOfProfile(globalMocks.imperativeProfile)),
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
            ussFile: vi.fn().mockReturnValue({
                apiResponse: {
                    etag: "ABC123",
                },
            }),
        },
        configurable: true,
    });
    Object.defineProperty(zosfiles, "Utilities", { value: vi.fn(), configurable: true });
    Object.defineProperty(zosfiles.Utilities, "isFileTagBinOrAscii", { value: vi.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "log", { value: vi.fn(), configurable: true });
    Object.defineProperty(ZoweLogger.log, "debug", { value: vi.fn(), configurable: true });
    Object.defineProperty(ZoweLogger.log, "error", { value: vi.fn(), configurable: true });
    Object.defineProperty(ZoweLogger.log, "warn", { value: vi.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "error", { value: vi.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "debug", { value: vi.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "warn", { value: vi.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "info", { value: vi.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "trace", { value: vi.fn(), configurable: true });
    Object.defineProperty(ZoweLocalStorage, "globalState", {
        value: {
            get: () => ({ persistence: true, favorites: [], history: [], sessions: ["zosmf"], searchHistory: [], fileHistory: [] }),
            update: vi.fn(),
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

    afterAll(() => vi.restoreAllMocks());

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

        vi.spyOn(ZoweDatasetNode.prototype, "openDs").mockResolvedValueOnce(undefined);
        testDatasetTree.getAllLoadedItems.mockResolvedValueOnce([testNode]);
        const testUssTree = createUSSTree([], [blockMocks.ussSessionNode], globalMocks.treeView);
        Object.defineProperty(testUssTree, "getAllLoadedItems", {
            value: vi.fn().mockResolvedValueOnce([]),
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
        vi.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(qpItem);

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
            value: vi.fn().mockResolvedValueOnce([]),
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
        vi.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(qpItem);

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
            value: vi.fn().mockResolvedValueOnce([]),
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
        vi.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(qpItem);

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
            value: vi.fn().mockResolvedValueOnce([folder]),
            configurable: true,
        });
        vi.spyOn(folder, "getProfileName").mockImplementationOnce(() => "firstName");
        vi.spyOn(blockMocks.ussSessionNode, "getChildren").mockResolvedValueOnce([folder]);

        const qpItem = new FilterItem({ text: "[sestest]: /folder" });
        const quickPickContent = createQuickPickContent(qpItem, [qpItem], globalMocks.qpPlaceholder);
        quickPickContent.placeholder = "Select a filter";
        mocked(Gui.createQuickPick).mockReturnValue(quickPickContent);
        vi.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(qpItem);
        Object.defineProperty(testUssTree, "setItem", {
            value: vi.fn().mockImplementation((() => undefined) as any),
            configurable: true,
        });

        const openNode = vi.spyOn(folder, "openUSS").mockImplementation((() => undefined) as any);
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
            value: vi.fn().mockResolvedValueOnce([file]),
            configurable: true,
        });
        vi.spyOn(blockMocks.ussSessionNode, "getChildren").mockResolvedValueOnce([folder]);
        vi.spyOn(folder, "getChildren").mockResolvedValueOnce([file]);

        const qpItem = new FilterItem({ text: "[sestest]: /folder/file" });
        const quickPickContent = createQuickPickContent(qpItem, [qpItem], globalMocks.qpPlaceholder);
        quickPickContent.placeholder = "Select a filter";
        mocked(Gui.createQuickPick).mockReturnValue(quickPickContent);
        vi.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(qpItem);
        Object.defineProperty(testUssTree, "setItem", {
            value: vi.fn().mockImplementation((() => undefined) as any),
            configurable: true,
        });

        const openNode = vi.spyOn(file, "openUSS").mockImplementation((() => undefined) as any);
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
            value: vi.fn().mockResolvedValueOnce([]),
            configurable: true,
        });
        const qpItem = "";
        const quickPickContent = createQuickPickContent(qpItem, [qpItem as any], globalMocks.qpPlaceholder);
        quickPickContent.placeholder = "Select a filter";
        mocked(Gui.createQuickPick).mockReturnValue(quickPickContent);
        vi.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(qpItem as any);

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
        vi.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(qpItem);

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
        vi.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(qpItem);

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
        vi.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(qpItem);

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
        vi.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(new FilterDescriptor("node"));

        const showMessageSpy = vi.spyOn(Gui, "showMessage");

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
        vi.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(qpItem);

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
        vi.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(qpItem);

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
        vi.spyOn(Gui, "resolveQuickPick").mockResolvedValueOnce(new FilterDescriptor("[invalid]: /profile/dir/file.txt"));
        const showMessageSpy = vi.spyOn(Gui, "showMessage");

        await SharedActions.openRecentMemberPrompt(testDatasetTree, testUSSTree);
        expect(showMessageSpy).toHaveBeenCalledWith("Profile not found.");
        expect(testDatasetTree.openItemFromPath).not.toHaveBeenCalled();
        expect(testUSSTree.openItemFromPath).not.toHaveBeenCalled();
    });
});

describe("Shared Actions Unit Tests - Function returnIconState", () => {
    function createBlockMocks(globalMocks) {
        const datasetSessionNode = createDatasetSessionNode(globalMocks.session, globalMocks.imperativeProfile);
        const newMocks = {
            datasetSessionNode,
            datasetTree: createDatasetTree(datasetSessionNode, globalMocks.treeView),
            mockGetIconByNode: vi.fn(),
        };
        newMocks.mockGetIconByNode.mockReturnValue(IconUtils.IconId.sessionActive);
        return newMocks;
    }

    it("Tests that returnIconState applies an inactive icon to an inactive session", () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const testNode: Types.IZoweNodeType = blockMocks.datasetSessionNode;
        // reset session node to default
        testNode.iconPath = IconGenerator.getIconById(IconUtils.IconId.session).path;

        const profilesMock = vi.spyOn(Profiles, "getInstance").mockReturnValue({
            profilesForValidation: [
                {
                    name: "sestest",
                    status: "inactive",
                },
            ],
        } as any);

        SharedActions.returnIconState(testNode, blockMocks.datasetTree);
        expect(testNode.iconPath).toEqual(IconGenerator.getIconById(IconUtils.IconId.sessionInactive).path);
        profilesMock.mockRestore();
    });

    it("Tests that returnIconState applies an unverified icon to an unverified session - collapsed", () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const testNode: Types.IZoweNodeType = blockMocks.datasetSessionNode;
        // reset session node to default
        testNode.iconPath = IconGenerator.getIconById(IconUtils.IconId.session).path;
        testNode.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;

        const profilesMock = vi.spyOn(Profiles, "getInstance").mockReturnValue({
            profilesForValidation: [
                {
                    name: "sestest",
                    status: "unverified",
                },
            ],
        } as any);

        SharedActions.returnIconState(testNode, blockMocks.datasetTree);
        expect(testNode.iconPath).toEqual(IconGenerator.getIconById(IconUtils.IconId.session).path);
        profilesMock.mockRestore();
    });

    it("Tests that returnIconState applies an unverified icon to an unverified session - expanded", () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const testNode: Types.IZoweNodeType = blockMocks.datasetSessionNode;
        // reset session node to default
        testNode.iconPath = IconGenerator.getIconById(IconUtils.IconId.session).path;

        const profilesMock = vi.spyOn(Profiles, "getInstance").mockReturnValue({
            profilesForValidation: [
                {
                    name: "sestest",
                    status: "unverified",
                },
            ],
        } as any);

        SharedActions.returnIconState(testNode, blockMocks.datasetTree);
        expect(testNode.iconPath).toEqual(IconGenerator.getIconById(IconUtils.IconId.sessionOpen).path);
        profilesMock.mockRestore();
    });

    it("Tests that returnIconState applies an active icon to a validated session - collapsed", () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const testNode: Types.IZoweNodeType = blockMocks.datasetSessionNode;
        // reset session node to default
        testNode.iconPath = IconGenerator.getIconById(IconUtils.IconId.session).path;
        testNode.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;

        const profilesMock = vi.spyOn(Profiles, "getInstance").mockReturnValue({
            profilesForValidation: [
                {
                    name: "sestest",
                    status: "active",
                },
            ],
        } as any);

        SharedActions.returnIconState(testNode, blockMocks.datasetTree);
        expect(testNode.iconPath).toEqual(IconGenerator.getIconById(IconUtils.IconId.sessionActive).path);
        profilesMock.mockRestore();
    });

    it("Tests that returnIconState applies an active icon to a validated session - expanded", () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const testNode: Types.IZoweNodeType = blockMocks.datasetSessionNode;
        // reset session node to default
        testNode.iconPath = IconGenerator.getIconById(IconUtils.IconId.session).path;

        const profilesMock = vi.spyOn(Profiles, "getInstance").mockReturnValue({
            profilesForValidation: [
                {
                    name: "sestest",
                    status: "active",
                },
            ],
        } as any);

        SharedActions.returnIconState(testNode, blockMocks.datasetTree);
        expect(testNode.iconPath).toEqual(IconGenerator.getIconById(IconUtils.IconId.sessionActiveOpen).path);
        profilesMock.mockRestore();
    });

    it("Tests that returnIconState returns early when a profile has not been validated", () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const testNode: Types.IZoweNodeType = blockMocks.datasetSessionNode;
        // reset session node to default
        const originalPath = IconGenerator.getIconById(IconUtils.IconId.session).path;
        testNode.iconPath = originalPath;

        const profilesMock = vi.spyOn(Profiles, "getInstance").mockReturnValue({
            profilesForValidation: [],
        } as any);

        SharedActions.returnIconState(testNode);
        expect(testNode.iconPath).not.toEqual(IconGenerator.getIconById(IconUtils.IconId.sessionActiveOpen).path);
        expect(testNode.iconPath).toBe(originalPath);
        profilesMock.mockRestore();
    });

    it("Tests that returnIconState returns early if the validation status is unknown", () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks(globalMocks);

        const testNode: Types.IZoweNodeType = blockMocks.datasetSessionNode;
        // reset session node to default
        const originalPath = IconGenerator.getIconById(IconUtils.IconId.session).path;
        testNode.iconPath = originalPath;

        const profilesMock = vi.spyOn(Profiles, "getInstance").mockReturnValue({
            profilesForValidation: [
                {
                    name: "sestest",
                    status: "impossibleStatusValue",
                },
            ],
        } as any);

        SharedActions.returnIconState(testNode);
        expect(testNode.iconPath).not.toEqual(IconGenerator.getIconById(IconUtils.IconId.sessionActiveOpen).path);
        expect(testNode.iconPath).toBe(originalPath);
        profilesMock.mockRestore();
    });
});

describe("Shared Actions Unit Tests - Function resetValidationSettings", () => {
    function createBlockMocks(globalMocks) {
        const newMocks = {
            datasetSessionNode: createDatasetSessionNode(globalMocks.session, globalMocks.imperativeProfile),
            mockEnableValidationContext: vi.fn(),
            mockDisableValidationContext: vi.fn(),
            mockCheckProfileValidationSetting: vi.fn(),
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
            value: vi.fn(() => {
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
            value: vi.fn(() => {
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
        vi.restoreAllMocks();
    });

    it("should refresh all tree providers and update session nodes", async () => {
        createGlobalMocks();
        vi.spyOn(SharedTreeProviders, "providers", "get").mockReturnValue(createTreeProviders());
        const removedProfNames = new Set<string>();
        const addedProfTypes = new Set<string>();
        const removeSessionSpy = vi
            .spyOn(TreeViewUtils, "removeSession")
            .mockImplementation((treeProvider, profileName) => removedProfNames.add(profileName) as any);
        const addDefaultSessionSpy = vi
            .spyOn(TreeViewUtils, "addDefaultSession")
            .mockImplementation((treeProvider, profileType) => addedProfTypes.add(profileType) as any);
        await SharedActions.refreshAll();
        expect(removeSessionSpy).toHaveBeenCalledTimes(6);
        expect([...removedProfNames]).toEqual(["zosmf", "zosmf2"]);
        expect(addDefaultSessionSpy).toHaveBeenCalledTimes(6);
        expect([...addedProfTypes]).toEqual(["zosmf", "ssh"]);
    });

    it("should avoid running the refresh logic twice if a refresh is already in progress", async () => {
        createGlobalMocks();
        vi.spyOn(SharedTreeProviders, "providers", "get").mockReturnValue(createTreeProviders());
        const removedProfNames = new Set<string>();
        const addedProfTypes = new Set<string>();
        const removeSessionSpy = vi
            .spyOn(TreeViewUtils, "removeSession")
            .mockImplementation((treeProvider, profileName) => removedProfNames.add(profileName) as any);
        const addDefaultSessionSpy = vi
            .spyOn(TreeViewUtils, "addDefaultSession")
            .mockImplementation((treeProvider, profileType) => addedProfTypes.add(profileType) as any);
        void SharedActions.refreshAll();
        await SharedActions.refreshAll();

        // expect same amount of assertions even though refresh was called twice
        expect(removeSessionSpy).toHaveBeenCalledTimes(6);
        expect(addDefaultSessionSpy).toHaveBeenCalledTimes(6);
    });
});

describe("Shared Actions Unit Tests - Function refreshProfiles", () => {
    it("calls refresh on Profiles instance", async () => {
        const refresh = vi.fn().mockResolvedValueOnce(undefined);
        const profilesMock = vi
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
        const refresh = vi.fn().mockRejectedValueOnce(refreshError);
        const errorLoggerSpy = vi.spyOn(ZoweLogger, "error");
        const showZoweConfigErrorMock = vi.spyOn(ZoweExplorerExtender, "showZoweConfigError").mockReturnValue(undefined);
        const profilesMock = vi
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
        const addDefaultSessionMock = vi.spyOn(TreeViewUtils, "addDefaultSession").mockResolvedValueOnce(undefined);
        const registeredApiTypesMock = vi.spyOn(ZoweExplorerApiRegister, "getInstance").mockReturnValueOnce({
            registeredApiTypes: vi.fn().mockReturnValue(["zftp", "zosmf"]),
        } as any);
        const updateSessionNodeTooltipsMock = vi.spyOn(SharedActions, "updateSessionNodeTooltips").mockResolvedValueOnce(undefined);
        const refresh = vi.fn().mockResolvedValueOnce(undefined);
        const treeProvider: IZoweTree<IZoweTreeNode> = {
            mSessionNodes: [],
            mFavorites: [],
            refresh,
        } as any;
        await SharedActions.refreshProvider(treeProvider);
        expect(registeredApiTypesMock).toHaveBeenCalledTimes(1);
        expect(addDefaultSessionMock).toHaveBeenCalledTimes(2);
        expect(addDefaultSessionMock).toHaveBeenCalledWith(treeProvider, "zftp");
        expect(addDefaultSessionMock).toHaveBeenCalledWith(treeProvider, "zosmf");
        expect(updateSessionNodeTooltipsMock).toHaveBeenCalledWith(treeProvider);
        expect(refresh).toHaveBeenCalledTimes(1);
    });

    it("refreshes profiles if refreshProfiles parameter is true", async () => {
        const addDefaultSessionMock = vi.spyOn(TreeViewUtils, "addDefaultSession").mockClear().mockResolvedValueOnce(undefined);
        const registeredApiTypesMock = vi
            .spyOn(ZoweExplorerApiRegister, "getInstance")
            .mockClear()
            .mockReturnValueOnce({
                registeredApiTypes: vi.fn().mockReturnValue(["zftp", "zosmf"]),
            } as any);
        const updateSessionNodeTooltipsMock = vi.spyOn(SharedActions, "updateSessionNodeTooltips").mockResolvedValueOnce(undefined);
        const refresh = vi.fn().mockResolvedValueOnce(undefined);
        const treeProvider: IZoweTree<IZoweTreeNode> = {
            mSessionNodes: [],
            mFavorites: [],
            refresh,
        } as any;
        const refreshProfilesMock = vi.spyOn(SharedActions, "refreshProfiles").mockResolvedValueOnce(undefined);
        await SharedActions.refreshProvider(treeProvider, true);
        expect(refreshProfilesMock).toHaveBeenCalledTimes(1);
        expect(registeredApiTypesMock).toHaveBeenCalledTimes(1);
        expect(addDefaultSessionMock).toHaveBeenCalledTimes(2);
        expect(addDefaultSessionMock).toHaveBeenCalledWith(treeProvider, "zftp");
        expect(addDefaultSessionMock).toHaveBeenCalledWith(treeProvider, "zosmf");
        expect(updateSessionNodeTooltipsMock).toHaveBeenCalledWith(treeProvider);
        expect(refresh).toHaveBeenCalledTimes(1);
    });

    it("refreshes the session nodes in the given provider", async () => {
        const addDefaultSessionMock = vi.spyOn(TreeViewUtils, "addDefaultSession").mockClear().mockResolvedValueOnce(undefined);
        const removeSessionMock = vi.spyOn(TreeViewUtils, "removeSession").mockClear().mockResolvedValueOnce(undefined);
        const registeredApiTypesMock = vi
            .spyOn(ZoweExplorerApiRegister, "getInstance")
            .mockClear()
            .mockReturnValueOnce({
                registeredApiTypes: vi.fn().mockReturnValue(["zftp", "zosmf"]),
            } as any);
        const returnIconStateMock = vi.spyOn(SharedActions, "returnIconState").mockReturnValueOnce(undefined);
        const updateSessionNodeTooltipsMock = vi.spyOn(SharedActions, "updateSessionNodeTooltips").mockResolvedValueOnce(undefined);
        const refresh = vi.fn().mockResolvedValueOnce(undefined);
        const refreshElement = vi.fn().mockResolvedValueOnce(undefined);
        const treeProvider: IZoweTree<IZoweTreeNode> = {
            mSessionNodes: [createDatasetSessionNode(createISession(), createIProfile())],
            mFavorites: [],
            refresh,
            refreshElement,
        } as any;
        const profilesMock = vi.spyOn(Profiles, "getInstance").mockReturnValue({
            allProfiles: [{ name: "sestest" }],
            checkCurrentProfile: vi.fn().mockResolvedValue(undefined),
        } as any);
        const syncSessionNodeMock = vi.spyOn(AuthUtils, "syncSessionNode").mockReturnValueOnce(undefined);
        const refreshProfilesMock = vi.spyOn(SharedActions, "refreshProfiles").mockClear().mockResolvedValueOnce(undefined);
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
        expect(updateSessionNodeTooltipsMock).toHaveBeenCalledWith(treeProvider);
        expect(refresh).toHaveBeenCalledTimes(1);
        profilesMock.mockRestore();
    });

    it("removes a session node in the given provider if the profile no longer exists", async () => {
        const addDefaultSessionMock = vi.spyOn(TreeViewUtils, "addDefaultSession").mockClear().mockResolvedValueOnce(undefined);
        const removeSessionMock = vi.spyOn(TreeViewUtils, "removeSession").mockClear().mockResolvedValueOnce(undefined);
        const registeredApiTypesMock = vi
            .spyOn(ZoweExplorerApiRegister, "getInstance")
            .mockClear()
            .mockReturnValueOnce({
                registeredApiTypes: vi.fn().mockReturnValue(["zftp", "zosmf"]),
            } as any);
        const updateSessionNodeTooltipsMock = vi.spyOn(SharedActions, "updateSessionNodeTooltips").mockResolvedValueOnce(undefined);
        const refresh = vi.fn().mockResolvedValueOnce(undefined);
        const refreshElement = vi.fn().mockResolvedValueOnce(undefined);
        const treeProvider: IZoweTree<IZoweTreeNode> = {
            mSessionNodes: [createDatasetSessionNode(createISession(), createIProfile())],
            mFavorites: [],
            refresh,
            refreshElement,
        } as any;
        const profilesMock = vi.spyOn(Profiles, "getInstance").mockReturnValue({
            allProfiles: [],
            profilesForValidation: [],
            checkCurrentProfile: vi.fn().mockResolvedValue(undefined),
        } as any);
        const syncSessionNodeMock = vi.spyOn(AuthUtils, "syncSessionNode").mockReturnValueOnce(undefined);
        const refreshProfilesMock = vi.spyOn(SharedActions, "refreshProfiles").mockClear().mockResolvedValueOnce(undefined);
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
        expect(updateSessionNodeTooltipsMock).toHaveBeenCalledWith(treeProvider);
        expect(refresh).toHaveBeenCalledTimes(1);
        profilesMock.mockRestore();
    });

    describe("Shared Actions Unit Tests - Function updateSessionNodeTooltips", () => {
        it("updates tooltips for all session nodes in the tree provider", async () => {
            const sessionNode = createDatasetSessionNode(createISession(), createIProfile());
            const nodeDataChanged = vi.fn();
            const treeProvider: IZoweTree<IZoweTreeNode> = {
                mSessionNodes: [sessionNode],
                nodeDataChanged,
            } as any;
            const profile = { name: "sestest" };
            const updateProfileHoverInfoMock = vi.fn().mockResolvedValue(undefined);
            const profilesMock = vi.spyOn(Profiles, "getInstance").mockReturnValue({
                allProfiles: [profile],
                updateProfileHoverInfo: updateProfileHoverInfoMock,
            } as any);
            const updateNodeToolTipMock = vi.spyOn(AuthUtils, "updateNodeToolTip").mockReturnValueOnce(undefined);

            await SharedActions.updateSessionNodeTooltips(treeProvider);

            expect(updateNodeToolTipMock).toHaveBeenCalledWith(sessionNode, profile);
            expect(updateProfileHoverInfoMock).toHaveBeenCalledWith(sessionNode);
            expect(nodeDataChanged).toHaveBeenCalledWith(sessionNode);
            profilesMock.mockRestore();
        });

        it("skips Favorites folder when updating tooltips", async () => {
            const favoritesNode = createDatasetFavoritesNode();
            const sessionNode = createDatasetSessionNode(createISession(), createIProfile());
            const nodeDataChanged = vi.fn();
            const treeProvider: IZoweTree<IZoweTreeNode> = {
                mSessionNodes: [favoritesNode, sessionNode],
                nodeDataChanged,
            } as any;
            const profile = { name: "sestest" };
            const updateProfileHoverInfoMock = vi.fn().mockResolvedValue(undefined);
            const profilesMock = vi.spyOn(Profiles, "getInstance").mockReturnValue({
                allProfiles: [profile],
                updateProfileHoverInfo: updateProfileHoverInfoMock,
            } as any);
            const updateNodeToolTipMock = vi.spyOn(AuthUtils, "updateNodeToolTip").mockClear().mockReturnValueOnce(undefined);

            await SharedActions.updateSessionNodeTooltips(treeProvider);

            // Should only be called once for the non-Favorites node
            expect(updateNodeToolTipMock).toHaveBeenCalledTimes(1);
            expect(updateNodeToolTipMock).toHaveBeenCalledWith(sessionNode, profile);
            expect(updateProfileHoverInfoMock).toHaveBeenCalledTimes(1);
            expect(updateProfileHoverInfoMock).toHaveBeenCalledWith(sessionNode);
            expect(nodeDataChanged).toHaveBeenCalledTimes(1);
            expect(nodeDataChanged).toHaveBeenCalledWith(sessionNode);
            profilesMock.mockRestore();
        });

        it("handles errors gracefully when updating tooltips", async () => {
            const sessionNode = createDatasetSessionNode(createISession(), createIProfile());
            const nodeDataChanged = vi.fn();
            const treeProvider: IZoweTree<IZoweTreeNode> = {
                mSessionNodes: [sessionNode],
                nodeDataChanged,
            } as any;
            const profile = { name: "sestest" };
            const checkCurrentProfileMock = vi.fn().mockRejectedValue(new Error("Test error"));
            const profilesMock = vi.spyOn(Profiles, "getInstance").mockReturnValue({
                allProfiles: [profile],
                checkCurrentProfile: checkCurrentProfileMock,
            } as any);
            const updateNodeToolTipMock = vi.spyOn(AuthUtils, "updateNodeToolTip").mockReturnValueOnce(undefined);
            const warnMock = vi.spyOn(ZoweLogger, "warn").mockImplementation((() => undefined) as any);

            await SharedActions.updateSessionNodeTooltips(treeProvider);

            expect(updateNodeToolTipMock).toHaveBeenCalledWith(sessionNode, profile);
            expect(warnMock).toHaveBeenCalledWith(expect.stringContaining("Failed to update tooltip for session node sestest"));
            expect(nodeDataChanged).not.toHaveBeenCalled();
            profilesMock.mockRestore();
            warnMock.mockRestore();
        });

        it("skips session nodes without matching profiles", async () => {
            const sessionNode = createDatasetSessionNode(createISession(), createIProfile());
            const nodeDataChanged = vi.fn();
            const treeProvider: IZoweTree<IZoweTreeNode> = {
                mSessionNodes: [sessionNode],
                nodeDataChanged,
            } as any;
            const checkCurrentProfileMock = vi.fn().mockResolvedValue(undefined);
            const profilesMock = vi.spyOn(Profiles, "getInstance").mockReturnValue({
                allProfiles: [], // No matching profile
                checkCurrentProfile: checkCurrentProfileMock,
            } as any);
            const updateNodeToolTipMock = vi.spyOn(AuthUtils, "updateNodeToolTip").mockClear();

            await SharedActions.updateSessionNodeTooltips(treeProvider);

            expect(updateNodeToolTipMock).not.toHaveBeenCalled();
            expect(nodeDataChanged).not.toHaveBeenCalled();
            profilesMock.mockRestore();
        });
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

describe("Shared Actions Unit Tests - Function updateSchemaCommand", () => {
    function createBlockMocks() {
        const newMocks = {
            updateSpy: vi.spyOn(ProfilesUtils, "updateSchema").mockImplementation(() => vi.fn()),
            guiSpy: vi.spyOn(Gui, "showQuickPick"),
            mockGlobalPath: "file://globalPath/.zowe",
            mockProjectDir: { fsPath: "file://projectPath/", scheme: "file" },
            profInstance: createInstanceOfProfile(createIProfile()),
            testConfig: createConfigLoad(),
            globalLayer: {
                path: "file://globalPath/.zowe/zowe.config.json",
                exists: true,
                properties: undefined,
                global: true,
                user: false,
            },
            projectLayer: {
                path: "file://projectPath/zowe.config.user.json",
                exists: true,
                properties: undefined,
                global: false,
                user: true,
            },
            mockProfileInfo: createInstanceOfProfileInfo(),
            mockGetConfigLayers: vi.fn(),
            globalChoice: new FilterItem({ text: vscode.l10n.t("Update Global schema only"), show: true }),
            bothChoice: new FilterItem({ text: vscode.l10n.t("Update Global and Project level schemas"), show: true }),
            opCancelledSpy: vi.spyOn(Gui, "infoMessage"),
        };

        vi.spyOn(FileManagement, "getZoweDir").mockReturnValue(newMocks.mockGlobalPath);
        Object.defineProperty(vscode.workspace, "workspaceFolders", { value: [{ uri: newMocks.mockProjectDir }], configurable: true });
        Object.defineProperty(FileManagement, "getFullPath", {
            value: vi.fn().mockReturnValue(newMocks.mockProjectDir.fsPath),
            configurable: true,
        });
        Object.defineProperty(Profiles, "getInstance", {
            value: vi.fn(() => {
                return {
                    getConfigLayers: newMocks.mockGetConfigLayers,
                };
            }),
        });
        Object.defineProperty(ProfilesUtils, "setupProfileInfo", {
            value: vi.fn().mockResolvedValue(newMocks.mockProfileInfo),
            configurable: true,
        });
        Object.defineProperty(Constants, "PROFILES_CACHE", {
            value: newMocks.profInstance,
            configurable: true,
        });
        Object.defineProperty(Constants.PROFILES_CACHE, "getConfigArray", { value: vi.fn().mockReturnValue([]), configurable: true });

        return newMocks;
    }
    beforeEach(() => {
        vi.restoreAllMocks();
    });
    it("updates only global layer without prompt", async () => {
        const blockMocks = createBlockMocks();
        blockMocks.mockProjectDir = { fsPath: "", scheme: "" };
        blockMocks.mockGetConfigLayers.mockResolvedValueOnce([blockMocks.globalLayer]);

        await SharedActions.updateSchemaCommand();
        expect(blockMocks.guiSpy).not.toHaveBeenCalled();
        expect(blockMocks.updateSpy).toHaveBeenCalledWith(blockMocks.mockProfileInfo, [], false);
    });
    it("updates only project layer without prompt", async () => {
        const blockMocks = createBlockMocks();
        blockMocks.mockProjectDir = { fsPath: "file://projectPath/", scheme: "file" };
        blockMocks.mockGetConfigLayers.mockResolvedValueOnce([blockMocks.projectLayer]);

        await SharedActions.updateSchemaCommand();
        expect(blockMocks.guiSpy).not.toHaveBeenCalled();
        expect(blockMocks.updateSpy).toHaveBeenCalledWith(blockMocks.mockProfileInfo, [], true);
    });
    it("updates only global layer with prompt", async () => {
        const blockMocks = createBlockMocks();
        blockMocks.mockProjectDir = { fsPath: "file://projectPath/", scheme: "file" };
        blockMocks.mockGetConfigLayers.mockResolvedValueOnce([blockMocks.globalLayer, blockMocks.projectLayer]);
        vi.spyOn(Gui, "showQuickPick").mockResolvedValueOnce(blockMocks.globalChoice);

        await SharedActions.updateSchemaCommand();
        expect(blockMocks.guiSpy).toHaveBeenCalled();
        expect(blockMocks.updateSpy).toHaveBeenCalledWith(blockMocks.mockProfileInfo, [], false);
    });
    it("updates both layers with prompt", async () => {
        const blockMocks = createBlockMocks();
        blockMocks.mockProjectDir = { fsPath: "file://projectPath/", scheme: "file" };
        blockMocks.mockGetConfigLayers.mockResolvedValueOnce([blockMocks.globalLayer, blockMocks.projectLayer]);
        vi.spyOn(Gui, "showQuickPick").mockResolvedValueOnce(blockMocks.bothChoice);

        await SharedActions.updateSchemaCommand();
        expect(blockMocks.guiSpy).toHaveBeenCalled();
        expect(blockMocks.updateSpy).toHaveBeenCalledWith(blockMocks.mockProfileInfo, [], true);
    });
    it("displays operation cancelled with escaping prompt", async () => {
        const blockMocks = createBlockMocks();
        blockMocks.mockProjectDir = { fsPath: "file://projectPath/", scheme: "file" };
        blockMocks.mockGetConfigLayers.mockResolvedValueOnce([blockMocks.globalLayer, blockMocks.projectLayer]);
        vi.spyOn(Gui, "showQuickPick").mockResolvedValueOnce(undefined);

        await SharedActions.updateSchemaCommand();
        expect(blockMocks.guiSpy).toHaveBeenCalled();
        expect(blockMocks.opCancelledSpy).toHaveBeenCalledWith("Operation cancelled");
        expect(blockMocks.updateSpy).not.toHaveBeenCalled();
    });
});
