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
import { createIProfile, createISession, createInstanceOfProfile } from "../../../__mocks__/mockCreators/shared";
import { createDatasetSessionNode } from "../../../__mocks__/mockCreators/datasets";
import { UssFSProvider } from "../../../../src/trees/uss/UssFSProvider";
import { imperative, ProfilesCache, Gui, ZosEncoding, BaseProvider } from "@zowe/zowe-explorer-api";
import { Constants } from "../../../../src/configuration/Constants";
import { FilterItem } from "../../../../src/management/FilterManagement";
import { ZoweLocalStorage } from "../../../../src/tools/ZoweLocalStorage";
import { ZoweLogger } from "../../../../src/tools/ZoweLogger";
import { DatasetFSProvider } from "../../../../src/trees/dataset/DatasetFSProvider";
import { ZoweDatasetNode } from "../../../../src/trees/dataset/ZoweDatasetNode";
import { ZoweJobNode } from "../../../../src/trees/job/ZoweJobNode";
import { SharedUtils } from "../../../../src/trees/shared/SharedUtils";
import { ZoweUSSNode } from "../../../../src/trees/uss/ZoweUSSNode";
import { AuthUtils } from "../../../../src/utils/AuthUtils";

function createGlobalMocks() {
    const newMocks = {
        session: createISession(),
        profileOne: createIProfile(),
        mockGetInstance: jest.fn(),
        mockProfileInstance: null,
        mockProfilesCache: null,
        createDirectory: jest.fn(),
    };
    jest.spyOn(UssFSProvider.instance, "createDirectory").mockImplementation(newMocks.createDirectory);
    newMocks.mockProfilesCache = new ProfilesCache(imperative.Logger.getAppLogger());
    newMocks.mockProfileInstance = createInstanceOfProfile(createIProfile());
    Object.defineProperty(Constants, "PROFILES_CACHE", {
        value: newMocks.mockProfileInstance,
        configurable: true,
    });

    Object.defineProperty(newMocks.mockProfilesCache, "getConfigInstance", {
        value: jest.fn(() => {
            return {
                usingTeamConfig: false,
            };
        }),
    });

    return newMocks;
}

describe("Shared Utils Unit Tests - Function node.concatChildNodes()", () => {
    it("Checks that concatChildNodes returns the proper array of children", async () => {
        const globalMocks = await createGlobalMocks();
        const rootNode = new ZoweUSSNode({
            label: "root",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: globalMocks.session,
        });
        const childNode1 = new ZoweUSSNode({
            label: "child1",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: rootNode,
            session: globalMocks.session,
        });
        const childNode2 = new ZoweUSSNode({
            label: "child2",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: childNode1,
            session: globalMocks.session,
        });

        childNode1.children.push(childNode2);
        rootNode.children.push(childNode1);

        const returnedArray = SharedUtils.concatChildNodes([rootNode]);
        expect(returnedArray).toEqual([childNode2, childNode1, rootNode]);
    });
});

describe("syncSessionNode shared util function", () => {
    const serviceProfile = {
        name: "test",
        profile: {},
        type: "zosmf",
        message: "",
        failNotFound: true,
    };

    const sessionNode = createDatasetSessionNode(undefined, serviceProfile);

    it("should update a session and a profile in the provided node", async () => {
        const globalMocks = await createGlobalMocks();
        // given
        Object.defineProperty(globalMocks.mockProfilesCache, "loadNamedProfile", {
            value: jest.fn().mockReturnValue(createIProfile()),
        });
        const expectedSession = new imperative.Session({});
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        const sessionForProfile = (_profile) =>
            ({
                getSession: () => new imperative.Session({}),
            } as any);
        // when
        AuthUtils.syncSessionNode(sessionForProfile, sessionNode);
        expect(sessionNode.getSession()).toEqual(expectedSession);
        expect(sessionNode.getProfile()).toEqual(createIProfile());
    });
    it("should do nothing, if there is no profile from provided node in the file system", () => {
        const profiles = createInstanceOfProfile(serviceProfile);
        profiles.loadNamedProfile = jest.fn(() =>
            jest.fn(() => {
                throw new Error(`There is no such profile with name: ${serviceProfile.name}`);
            })
        );
        profiles.getBaseProfile = jest.fn(() => undefined);
        // when
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        const dummyFn = (_profile) =>
            ({
                getSession: () => new imperative.Session({}),
            } as any);
        AuthUtils.syncSessionNode(dummyFn, sessionNode);
        // then
        const initialSession = sessionNode.getSession();
        const initialProfile = sessionNode.getProfile();
        expect(sessionNode.getSession()).toEqual(initialSession);
        expect(sessionNode.getProfile()).toEqual(initialProfile);
    });
});

describe("Positive testing", () => {
    it("should pass for ZoweDatasetTreeNode with ZoweDatasetNode node type", () => {
        const dsNode = new ZoweDatasetNode({ label: "", collapsibleState: vscode.TreeItemCollapsibleState.None });
        const value = SharedUtils.isZoweDatasetTreeNode(dsNode);
        expect(value).toBeTruthy();
    });
    it("should pass for ZoweUSSTreeNode with ZoweUSSNode node type", () => {
        const ussNode = new ZoweUSSNode({ label: "", collapsibleState: vscode.TreeItemCollapsibleState.None });
        const value = SharedUtils.isZoweUSSTreeNode(ussNode);
        expect(value).toBeTruthy();
    });
    it("should pass for ZoweJobTreeNode with ZoweJobNode node type", () => {
        const jobNode = new ZoweJobNode({ label: "", collapsibleState: vscode.TreeItemCollapsibleState.None });
        const value = SharedUtils.isZoweJobTreeNode(jobNode);
        expect(value).toBeTruthy();
    });
});

describe("Negative testing for ZoweDatasetTreeNode", () => {
    it("should fail with ZoweUSSNode node type", () => {
        const ussNode = new ZoweUSSNode({ label: "", collapsibleState: vscode.TreeItemCollapsibleState.None });
        const value = SharedUtils.isZoweDatasetTreeNode(ussNode);
        expect(value).toBeFalsy();
    });
    it("should fail with ZoweJobNode node type", () => {
        const jobNode = new ZoweJobNode({ label: "", collapsibleState: vscode.TreeItemCollapsibleState.None });
        const value = SharedUtils.isZoweDatasetTreeNode(jobNode);
        expect(value).toBeFalsy();
    });
});

describe("Negative testing for ZoweUSSTreeNode", () => {
    it("should fail with ZoweDatasetNode node type", () => {
        const dsNode = new ZoweDatasetNode({ label: "", collapsibleState: vscode.TreeItemCollapsibleState.None });
        const value = SharedUtils.isZoweUSSTreeNode(dsNode);
        expect(value).toBeFalsy();
    });
    it("should fail with ZoweJobNode node type", () => {
        const jobNode = new ZoweJobNode({ label: "", collapsibleState: vscode.TreeItemCollapsibleState.None });
        const value = SharedUtils.isZoweUSSTreeNode(jobNode);
        expect(value).toBeFalsy();
    });
});

describe("Negative testing for ZoweJobTreeNode", () => {
    it("should fail with ZoweDatasetNode node type", () => {
        const dsNode = new ZoweDatasetNode({ label: "", collapsibleState: vscode.TreeItemCollapsibleState.None });
        const value = SharedUtils.isZoweJobTreeNode(dsNode);
        expect(value).toBeFalsy();
    });
    it("should fail with ZoweUSSNode node type", () => {
        const ussNode = new ZoweUSSNode({ label: "", collapsibleState: vscode.TreeItemCollapsibleState.None });
        const value = SharedUtils.isZoweJobTreeNode(ussNode);
        expect(value).toBeFalsy();
    });
});

describe("Shared Utils Unit Tests - Function filterTreeByString", () => {
    it("Testing that filterTreeByString returns the correct array", async () => {
        const qpItems = [
            new FilterItem({ text: "[sestest]: HLQ.PROD2.STUFF1" }),
            new FilterItem({ text: "[sestest]: HLQ.PROD3.STUFF2(TESTMEMB)" }),
            new FilterItem({ text: "[sestest]: /test/tree/abc" }),
        ];

        let filteredValues = await SharedUtils.filterTreeByString("testmemb", qpItems);
        expect(filteredValues).toStrictEqual([qpItems[1]]);
        filteredValues = await SharedUtils.filterTreeByString("sestest", qpItems);
        expect(filteredValues).toStrictEqual(qpItems);
        filteredValues = await SharedUtils.filterTreeByString("HLQ.PROD2.STUFF1", qpItems);
        expect(filteredValues).toStrictEqual([qpItems[0]]);
        filteredValues = await SharedUtils.filterTreeByString("HLQ.*.STUFF*", qpItems);
        expect(filteredValues).toStrictEqual([qpItems[0], qpItems[1]]);
        filteredValues = await SharedUtils.filterTreeByString("/test/tree/abc", qpItems);
        expect(filteredValues).toStrictEqual([qpItems[2]]);
        filteredValues = await SharedUtils.filterTreeByString("*/abc", qpItems);
        expect(filteredValues).toStrictEqual([qpItems[2]]);
    });
});

describe("Shared Utils Unit Tests - Function getSelectedNodeList", () => {
    it("Testing that getSelectedNodeList returns the correct array when single node is selected", () => {
        const selectedNodes = [];
        const aNode = createTestNode();
        selectedNodes.push(aNode);
        const nodeList = SharedUtils.getSelectedNodeList(aNode, selectedNodes);

        expect(nodeList).toEqual(selectedNodes);
    });

    it("Testing that getSelectedNodeList returns the correct array when single node is selected via quickKeys", () => {
        const selectedNodes = undefined;
        const aNode = createTestNode();
        const nodeList = SharedUtils.getSelectedNodeList(aNode, selectedNodes);

        expect(nodeList[0]).toEqual(aNode);
    });

    it("Testing that getSelectedNodeList returns the correct array when multiple node is selected", () => {
        const selectedNodes = [];
        const aNode = createTestNode();
        selectedNodes.push(aNode);
        const bNode = createTestNode();
        selectedNodes.push(bNode);
        const nodeList = SharedUtils.getSelectedNodeList(aNode, selectedNodes);

        expect(nodeList).toEqual(selectedNodes);
    });

    function createTestNode() {
        const node = new ZoweDatasetNode({ label: "testLabel", collapsibleState: vscode.TreeItemCollapsibleState.Collapsed });
        return node;
    }
});

describe("Shared utils unit tests - function sortTreeItems", () => {
    it("prioritizes context value when sorting", () => {
        const toSort = [
            { label: "A", contextValue: "some_context" },
            { label: "Z", contextValue: "some_other_context" },
            { label: "Y", contextValue: "some_context" },
            { label: "X", contextValue: "some_context" },
            { label: "W", contextValue: "some_other_context" },
            { label: "V", contextValue: "some_context" },
            { label: "U", contextValue: "some_other_context" },
            { label: "T", contextValue: "some_other_context" },
            { label: "B", contextValue: "some_other_context" },
        ];
        SharedUtils.sortTreeItems(toSort, "some_context");
        expect(toSort).toStrictEqual([
            { label: "A", contextValue: "some_context" },
            { label: "V", contextValue: "some_context" },
            { label: "X", contextValue: "some_context" },
            { label: "Y", contextValue: "some_context" },
            { label: "B", contextValue: "some_other_context" },
            { label: "T", contextValue: "some_other_context" },
            { label: "U", contextValue: "some_other_context" },
            { label: "W", contextValue: "some_other_context" },
            { label: "Z", contextValue: "some_other_context" },
        ]);
    });
});

describe("Shared utils unit tests - function promptForEncoding", () => {
    const binaryEncoding: ZosEncoding = { kind: "binary" };
    const textEncoding: ZosEncoding = { kind: "text" };
    const otherEncoding: ZosEncoding = { kind: "other", codepage: "IBM-1047" };

    function createBlockMocks() {
        const showInputBox = jest.spyOn(Gui, "showInputBox").mockResolvedValue(undefined);
        const showQuickPick = jest.spyOn(Gui, "showQuickPick").mockResolvedValue(undefined);
        const localStorageGet = jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValue(undefined);
        const localStorageSet = jest.spyOn(ZoweLocalStorage, "setValue").mockReturnValue(undefined);
        const getEncodingForFile = jest.spyOn((BaseProvider as any).prototype, "getEncodingForFile");
        const setEncodingForFile = jest.spyOn((BaseProvider as any).prototype, "setEncodingForFile").mockReturnValue(undefined);
        const fetchEncodingForUri = jest.spyOn(UssFSProvider.instance, "fetchEncodingForUri").mockResolvedValue(undefined as any);
        const createDirectorySpy = jest.spyOn(UssFSProvider.instance, "createDirectory").mockImplementation();
        const getEncodingForFileSpy = jest.spyOn(UssFSProvider.instance, "getEncodingForFile").mockReturnValue({ kind: "binary" });

        return {
            profile: createIProfile(),
            session: createISession(),
            showInputBox,
            showQuickPick,
            localStorageGet,
            localStorageSet,
            getEncodingForFile,
            setEncodingForFile,
            fetchEncodingForUri,
            createDirectorySpy,
            getEncodingForFileSpy,
        };
    }

    beforeEach(() => {
        jest.resetAllMocks();
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    it("prompts for text encoding for USS file", async () => {
        const blockMocks = createBlockMocks();
        const node = new ZoweUSSNode({
            label: "testFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.profile,
            parentPath: "/root",
        });
        blockMocks.showQuickPick.mockImplementationOnce(async (items) => items[0]);
        blockMocks.getEncodingForFile.mockReturnValueOnce(undefined);
        const encoding = await SharedUtils.promptForEncoding(node);
        expect(blockMocks.showQuickPick).toHaveBeenCalled();
        expect(encoding).toEqual(textEncoding);
    });

    it("prompts for binary encoding for USS file", async () => {
        const blockMocks = createBlockMocks();
        const node = new ZoweUSSNode({
            label: "testFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.profile,
            parentPath: "/root",
        });
        blockMocks.showQuickPick.mockImplementationOnce(async (items) => items[1]);
        const encoding = await SharedUtils.promptForEncoding(node);
        expect(blockMocks.showQuickPick).toHaveBeenCalled();
        expect(encoding).toEqual(binaryEncoding);
    });

    it("prompts for other encoding for USS file and returns codepage", async () => {
        const blockMocks = createBlockMocks();
        const node = new ZoweUSSNode({
            label: "testFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.profile,
            parentPath: "/root",
        });
        blockMocks.showQuickPick.mockImplementationOnce(async (items) => items[2]);
        blockMocks.showInputBox.mockResolvedValueOnce("IBM-1047");
        const encoding = await SharedUtils.promptForEncoding(node);
        expect(blockMocks.showQuickPick).toHaveBeenCalled();
        expect(blockMocks.showInputBox).toHaveBeenCalled();
        expect(encoding).toEqual(otherEncoding);
    });

    it("prompts for other encoding for USS file and returns undefined", async () => {
        const blockMocks = createBlockMocks();
        const node = new ZoweUSSNode({
            label: "testFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.profile,
            parentPath: "/root",
        });
        blockMocks.showQuickPick.mockImplementationOnce(async (items) => items[2]);
        blockMocks.showInputBox.mockResolvedValueOnce(undefined);
        const encoding = await SharedUtils.promptForEncoding(node);
        expect(blockMocks.showQuickPick).toHaveBeenCalled();
        expect(blockMocks.showInputBox).toHaveBeenCalled();
        expect(encoding).toBeUndefined();
    });

    it("prompts for encoding for tagged USS file", async () => {
        const blockMocks = createBlockMocks();
        const node = new ZoweUSSNode({
            label: "testFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.profile,
            parentPath: "/root",
        });
        node.setEncoding(binaryEncoding);
        await SharedUtils.promptForEncoding(node, "IBM-1047");
        expect(blockMocks.showQuickPick).toHaveBeenCalled();
        expect(await blockMocks.showQuickPick.mock.calls[0][0][0]).toEqual({ label: "IBM-1047", description: "USS file tag" });
        expect(blockMocks.showQuickPick.mock.calls[0][1]).toEqual(
            expect.objectContaining({ placeHolder: "Current encoding is Binary", title: "Choose encoding for testFile" })
        );
    });

    it("prompts for encoding for USS file when profile contains encoding", async () => {
        const blockMocks = createBlockMocks();
        (blockMocks.profile.profile as any).encoding = "IBM-1047";
        const node = new ZoweUSSNode({
            label: "testFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.profile,
            parentPath: "/root",
        });
        blockMocks.getEncodingForFile.mockReturnValueOnce({ kind: "text" });
        await SharedUtils.promptForEncoding(node);
        expect(blockMocks.showQuickPick).toHaveBeenCalled();
        expect(await blockMocks.showQuickPick.mock.calls[0][0][0]).toEqual({
            label: "IBM-1047",
            description: `From profile ${blockMocks.profile.name}`,
        });
        expect(blockMocks.showQuickPick.mock.calls[0][1]).toEqual(expect.objectContaining({ placeHolder: "Current encoding is EBCDIC" }));
    });

    it("prompts for encoding for USS file and shows recent values", async () => {
        const blockMocks = createBlockMocks();
        const node = new ZoweUSSNode({
            label: "testFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.profile,
            parentPath: "/root",
        });
        node.setEncoding(otherEncoding);
        blockMocks.getEncodingForFile.mockReturnValueOnce(otherEncoding);
        const encodingHistory = ["IBM-123", "IBM-456", "IBM-789"];
        blockMocks.localStorageGet.mockReturnValueOnce(encodingHistory);
        blockMocks.showQuickPick.mockImplementationOnce(async (items) => items[4]);
        const encoding = await SharedUtils.promptForEncoding(node);
        expect(blockMocks.showQuickPick).toHaveBeenCalled();
        expect((await blockMocks.showQuickPick.mock.calls[0][0]).slice(4)).toEqual(encodingHistory.map((x) => ({ label: x })));
        expect(blockMocks.showQuickPick.mock.calls[0][1]).toEqual(expect.objectContaining({ placeHolder: "Current encoding is IBM-1047" }));
        expect(encoding).toEqual({ ...otherEncoding, codepage: encodingHistory[0] });
    });

    it("remembers cached encoding for USS node", async () => {
        const blockMocks = createBlockMocks();
        const node = new ZoweUSSNode({
            label: "testFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.profile,
            parentPath: "/root",
        });
        node.setEncoding(binaryEncoding);
        blockMocks.getEncodingForFile.mockReturnValueOnce(binaryEncoding);
        await SharedUtils.promptForEncoding(node);
        expect(blockMocks.showQuickPick).toHaveBeenCalled();
        expect(blockMocks.showQuickPick.mock.calls[0][1]).toEqual(expect.objectContaining({ placeHolder: "Current encoding is Binary" }));
    });

    it("remembers cached encoding for data set node", async () => {
        const blockMocks = createBlockMocks();
        const sessionNode = createDatasetSessionNode(blockMocks.session, blockMocks.profile);
        const node = new ZoweDatasetNode({
            label: "TEST.PS",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.profile,
            parentNode: sessionNode,
        });
        DatasetFSProvider.instance.encodingMap["TEST.PS"] = { kind: "text" };
        blockMocks.getEncodingForFile.mockReturnValueOnce(undefined);
        await SharedUtils.promptForEncoding(node);
        expect(blockMocks.showQuickPick).toHaveBeenCalled();
        expect(blockMocks.showQuickPick.mock.calls[0][1]).toEqual(expect.objectContaining({ placeHolder: "Current encoding is EBCDIC" }));
    });

    it("remembers cached encoding for data set member node", async () => {
        const blockMocks = createBlockMocks();
        const parentNode = new ZoweDatasetNode({
            label: "TEST.PDS",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: blockMocks.session,
        });
        const node = new ZoweDatasetNode({
            label: "MEMBER",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            profile: blockMocks.profile,
            parentNode,
            contextOverride: Constants.DS_MEMBER_CONTEXT,
        });
        node.setEncoding(otherEncoding);
        blockMocks.getEncodingForFile.mockReturnValueOnce(undefined);
        await SharedUtils.promptForEncoding(node);
        expect(blockMocks.showQuickPick).toHaveBeenCalled();
        expect(blockMocks.showQuickPick.mock.calls[0][1]).toEqual(expect.objectContaining({ placeHolder: "Current encoding is IBM-1047" }));
    });
});

describe("Shared utils unit tests - function parseFavorites", () => {
    it("correctly parses a saved favorite", () => {
        const favData = SharedUtils.parseFavorites(["[testProfile]: favoriteDir{directory}"]);
        expect(favData[0]).toStrictEqual({
            profileName: "testProfile",
            label: "favoriteDir",
            contextValue: "directory",
        });
    });

    it("filters out an incomplete favorite entry (missing label and context)", () => {
        const warnSpy = jest.spyOn(ZoweLogger, "warn");
        const favData = SharedUtils.parseFavorites(["[testProfile]: "]);
        expect(favData.length).toBe(0);
        expect(warnSpy).toHaveBeenCalledWith("Failed to parse a saved favorite. Attempted to parse: [testProfile]: ");
    });
});
