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
import { createUSSNode, createUSSSessionNode } from "../../../__mocks__/mockCreators/uss";
import { UssFSProvider } from "../../../../src/trees/uss/UssFSProvider";
import { imperative, ProfilesCache, Gui, ZosEncoding, BaseProvider, Sorting } from "@zowe/zowe-explorer-api";
import { Constants } from "../../../../src/configuration/Constants";
import { SettingsConfig } from "../../../../src/configuration/SettingsConfig";
import { FilterItem } from "../../../../src/management/FilterManagement";
import { ZoweLocalStorage } from "../../../../src/tools/ZoweLocalStorage";
import { ZoweLogger } from "../../../../src/tools/ZoweLogger";
import { DatasetFSProvider } from "../../../../src/trees/dataset/DatasetFSProvider";
import { ZoweDatasetNode } from "../../../../src/trees/dataset/ZoweDatasetNode";
import { ZoweJobNode, ZoweSpoolNode } from "../../../../src/trees/job/ZoweJobNode";
import { SharedUtils } from "../../../../src/trees/shared/SharedUtils";
import { ZoweUSSNode } from "../../../../src/trees/uss/ZoweUSSNode";
import { AuthUtils } from "../../../../src/utils/AuthUtils";
import { SharedTreeProviders } from "../../../../src/trees/shared/SharedTreeProviders";
import { MockedProperty } from "../../../__mocks__/mockUtils";
import { createIJobFile, createJobSessionNode } from "../../../__mocks__/mockCreators/jobs";
import { JobFSProvider } from "../../../../src/trees/job/JobFSProvider";

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
        const globalMocks = createGlobalMocks();
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
        name: "sestest",
        profile: {},
        type: "zosmf",
        message: "",
        failNotFound: false,
    };

    const sessionNode = createDatasetSessionNode(undefined, serviceProfile);

    it("should update a session and a profile in the provided node", async () => {
        const globalMocks = createGlobalMocks();
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
    it("should update session node and refresh tree node if provided", async () => {
        const globalMocks = createGlobalMocks();
        // given
        Object.defineProperty(globalMocks.mockProfilesCache, "loadNamedProfile", {
            value: jest.fn().mockReturnValue(createIProfile()),
        });
        const getChildrenSpy = jest.spyOn(sessionNode, "getChildren").mockResolvedValueOnce([]);
        const refreshElementMock = jest.fn();
        jest.spyOn(SharedTreeProviders, "getProviderForNode").mockReturnValueOnce({
            refreshElement: refreshElementMock,
        } as any);
        const getSessionMock = jest.fn().mockReturnValue(new imperative.Session({}));
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        const sessionForProfile = (_profile) =>
            ({
                getSession: getSessionMock,
            } as any);
        // when
        AuthUtils.syncSessionNode(sessionForProfile, sessionNode, sessionNode);
        expect(getSessionMock).toHaveBeenCalled();
        expect(sessionNode.dirty).toBe(true);
        expect(await getChildrenSpy).toHaveBeenCalled();
        expect(refreshElementMock).toHaveBeenCalledWith(sessionNode);
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

    it("prompts for encoding for tagged USS binary file", async () => {
        const blockMocks = createBlockMocks();
        const node = new ZoweUSSNode({
            label: "testFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.profile,
            parentPath: "/root",
        });
        node.setEncoding(binaryEncoding);
        blockMocks.showQuickPick.mockImplementationOnce(async (items) => items[0]);
        const encoding = await SharedUtils.promptForEncoding(node, "binary");
        expect(blockMocks.showQuickPick).toHaveBeenCalled();
        expect(await blockMocks.showQuickPick.mock.calls[0][0][0]).toEqual({ label: "binary", description: "USS file tag" });
        expect(encoding).toEqual({ kind: "binary" });
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
        DatasetFSProvider.instance.encodingMap[node.resourceUri?.path] = { kind: "text" };
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
        const existsMock = jest.spyOn(DatasetFSProvider.instance, "exists").mockReturnValueOnce(true);
        node.setEncoding(otherEncoding);
        expect(existsMock).toHaveBeenCalled();
        blockMocks.getEncodingForFile.mockReturnValueOnce(undefined);
        await SharedUtils.promptForEncoding(node);
        expect(blockMocks.showQuickPick).toHaveBeenCalled();
        expect(blockMocks.showQuickPick.mock.calls[0][1]).toEqual(expect.objectContaining({ placeHolder: "Current encoding is IBM-1047" }));
    });

    it("remembers cached encoding for spool node", async () => {
        const blockMocks = createBlockMocks();
        const sessionNode = createJobSessionNode(blockMocks.session, blockMocks.profile);
        const jobNode = new ZoweJobNode({
            label: "TESTPS",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: blockMocks.session,
            profile: blockMocks.profile,
            parentNode: sessionNode,
        });
        const spoolNode = new ZoweSpoolNode({
            label: "SPOOL",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            spool: createIJobFile(),
            parentNode: jobNode,
        });
        JobFSProvider.instance.encodingMap[spoolNode.resourceUri?.path] = { kind: "text" };
        blockMocks.getEncodingForFile.mockReturnValueOnce(undefined);
        await SharedUtils.promptForEncoding(spoolNode);
        expect(blockMocks.showQuickPick).toHaveBeenCalled();
        expect(blockMocks.showQuickPick.mock.calls[0][1]).toEqual(expect.objectContaining({ placeHolder: "Current encoding is EBCDIC" }));
    });

    it("prompts for text encoding for Spool file", async () => {
        const blockMocks = createBlockMocks();
        const sessionNode = createJobSessionNode(blockMocks.session, blockMocks.profile);
        const jobNode = new ZoweJobNode({
            label: "TESTPS",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: blockMocks.session,
            profile: blockMocks.profile,
            parentNode: sessionNode,
        });
        const node = new ZoweSpoolNode({
            label: "testFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.profile,
            parentNode: jobNode,
            spool: createIJobFile(),
        });

        blockMocks.showQuickPick.mockImplementationOnce(async (items) => items[0]);
        blockMocks.getEncodingForFile.mockReturnValueOnce(undefined);
        const encoding = await SharedUtils.promptForEncoding(node);
        expect(blockMocks.showQuickPick).toHaveBeenCalled();
        expect(encoding).toEqual(textEncoding);
    });

    it("prompts for binary encoding for Spool file", async () => {
        const blockMocks = createBlockMocks();
        const sessionNode = createJobSessionNode(blockMocks.session, blockMocks.profile);
        const jobNode = new ZoweJobNode({
            label: "TESTPS",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: blockMocks.session,
            profile: blockMocks.profile,
            parentNode: sessionNode,
        });
        const node = new ZoweSpoolNode({
            label: "testFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.profile,
            parentNode: jobNode,
            spool: createIJobFile(),
        });

        blockMocks.showQuickPick.mockImplementationOnce(async (items) => items[1]);
        const encoding = await SharedUtils.promptForEncoding(node);
        expect(blockMocks.showQuickPick).toHaveBeenCalled();
        expect(encoding).toEqual(binaryEncoding);
    });

    it("prompts for other encoding for Spool file and returns codepage", async () => {
        const blockMocks = createBlockMocks();
        const sessionNode = createJobSessionNode(blockMocks.session, blockMocks.profile);
        const jobNode = new ZoweJobNode({
            label: "TESTPS",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: blockMocks.session,
            profile: blockMocks.profile,
            parentNode: sessionNode,
        });
        const node = new ZoweSpoolNode({
            label: "testFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.profile,
            parentNode: jobNode,
            spool: createIJobFile(),
        });

        blockMocks.showQuickPick.mockImplementationOnce(async (items) => items[2]);
        blockMocks.showInputBox.mockResolvedValueOnce("IBM-1047");
        const encoding = await SharedUtils.promptForEncoding(node);
        expect(blockMocks.showQuickPick).toHaveBeenCalled();
        expect(blockMocks.showInputBox).toHaveBeenCalled();
        expect(encoding).toEqual(otherEncoding);
    });

    it("prompts for other encoding for Spool file and returns undefined", async () => {
        const blockMocks = createBlockMocks();
        const sessionNode = createJobSessionNode(blockMocks.session, blockMocks.profile);
        const jobNode = new ZoweJobNode({
            label: "TESTPS",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: blockMocks.session,
            profile: blockMocks.profile,
            parentNode: sessionNode,
        });
        const node = new ZoweSpoolNode({
            label: "testFile",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            session: blockMocks.session,
            profile: blockMocks.profile,
            parentNode: jobNode,
            spool: createIJobFile(),
        });

        blockMocks.showQuickPick.mockImplementationOnce(async (items) => items[2]);
        blockMocks.showInputBox.mockResolvedValueOnce(undefined);
        const encoding = await SharedUtils.promptForEncoding(node);
        expect(blockMocks.showQuickPick).toHaveBeenCalled();
        expect(blockMocks.showInputBox).toHaveBeenCalled();
        expect(encoding).toBeUndefined();
    });
});

describe("Shared utils unit tests - function getCachedEncoding", () => {
    const mockSession = createISession();
    const mockProfile = createIProfile();
    describe("Spool nodes", () => {
        it("correctly returns the cached encoding for binary", async () => {
            const sessionNode = createJobSessionNode(mockSession, mockProfile);
            const jobNode = new ZoweJobNode({
                label: "TESTPS",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                session: mockSession,
                profile: mockProfile,
                parentNode: sessionNode,
            });
            const node = new ZoweSpoolNode({
                label: "testFile",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                session: mockSession,
                profile: mockProfile,
                parentNode: jobNode,
                spool: createIJobFile(),
            });
            const encoding = { kind: "binary" };

            const encodingMapSpy = jest.spyOn(node, "getEncodingInMap").mockResolvedValue(encoding);
            const response = await SharedUtils.getCachedEncoding(node);

            expect(encodingMapSpy).toHaveBeenCalledWith(node.resourceUri?.path);
            expect(response).toEqual(encoding.kind);
        });

        it("correctly returns the cached encoding for text", async () => {
            const sessionNode = createJobSessionNode(mockSession, mockProfile);
            const jobNode = new ZoweJobNode({
                label: "TESTPS",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                session: mockSession,
                profile: mockProfile,
                parentNode: sessionNode,
            });
            const node = new ZoweSpoolNode({
                label: "testFile",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                session: mockSession,
                profile: mockProfile,
                parentNode: jobNode,
                spool: createIJobFile(),
            });
            const encoding = { kind: "text" };

            const encodingMapSpy = jest.spyOn(node, "getEncodingInMap").mockResolvedValue(encoding);
            const response = await SharedUtils.getCachedEncoding(node);

            expect(encodingMapSpy).toHaveBeenCalledWith(node.resourceUri?.path);
            expect(response).toEqual(encoding.kind);
        });

        it("correctly returns the cached encoding for other", async () => {
            const sessionNode = createJobSessionNode(mockSession, mockProfile);
            const jobNode = new ZoweJobNode({
                label: "TESTPS",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                session: mockSession,
                profile: mockProfile,
                parentNode: sessionNode,
            });
            const node = new ZoweSpoolNode({
                label: "testFile",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                session: mockSession,
                profile: mockProfile,
                parentNode: jobNode,
                spool: createIJobFile(),
            });
            const encoding = { kind: "other", codepage: "IBM-1147" };

            const encodingMapSpy = jest.spyOn(node, "getEncodingInMap").mockResolvedValue(encoding);
            const response = await SharedUtils.getCachedEncoding(node);

            expect(encodingMapSpy).toHaveBeenCalledWith(node.resourceUri?.path);
            expect(response).toEqual(encoding.codepage);
        });

        it("correctly returns the cached encoding for undefined", async () => {
            const sessionNode = createJobSessionNode(mockSession, mockProfile);
            const jobNode = new ZoweJobNode({
                label: "TESTPS",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                session: mockSession,
                profile: mockProfile,
                parentNode: sessionNode,
            });
            const node = new ZoweSpoolNode({
                label: "testFile",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                session: mockSession,
                profile: mockProfile,
                parentNode: jobNode,
                spool: createIJobFile(),
            });
            const encoding = undefined;

            const encodingMapSpy = jest.spyOn(node, "getEncodingInMap").mockResolvedValue(encoding);
            const response = await SharedUtils.getCachedEncoding(node);

            expect(encodingMapSpy).toHaveBeenCalledWith(node.resourceUri?.path);
            expect(response).toEqual(encoding);
        });
    });

    describe("USS nodes", () => {
        it("correctly returns the cached encoding for binary", async () => {
            const sessionNode = createUSSSessionNode(mockSession, mockProfile);
            const ussNode = new ZoweUSSNode({
                label: "TEST.PS",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                contextOverride: Constants.USS_BINARY_FILE_CONTEXT,
                session: mockSession,
                profile: mockProfile,
                parentNode: sessionNode,
            });
            const encoding = { kind: "binary" };

            const encodingMapSpy = jest.spyOn(ussNode, "getEncodingInMap").mockResolvedValue(encoding);
            const response = await SharedUtils.getCachedEncoding(ussNode);

            expect(encodingMapSpy).toHaveBeenCalledWith(ussNode.resourceUri?.path);
            expect(response).toEqual(encoding.kind);
        });

        it("correctly returns the cached encoding for text", async () => {
            const sessionNode = createUSSSessionNode(mockSession, mockProfile);
            const ussNode = new ZoweUSSNode({
                label: "TEST.PS",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                contextOverride: Constants.USS_TEXT_FILE_CONTEXT,
                session: mockSession,
                profile: mockProfile,
                parentNode: sessionNode,
            });
            const encoding = { kind: "text" };

            const encodingMapSpy = jest.spyOn(ussNode, "getEncodingInMap").mockResolvedValue(encoding);
            const response = await SharedUtils.getCachedEncoding(ussNode);

            expect(encodingMapSpy).toHaveBeenCalledWith(ussNode.resourceUri?.path);
            expect(response).toEqual(encoding.kind);
        });

        it("correctly returns the cached encoding for other", async () => {
            const sessionNode = createUSSSessionNode(mockSession, mockProfile);
            const ussNode = new ZoweUSSNode({
                label: "TEST.PS",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                contextOverride: Constants.USS_TEXT_FILE_CONTEXT,
                session: mockSession,
                profile: mockProfile,
                parentNode: sessionNode,
            });
            const encoding = { kind: "other", codepage: "IBM-1147" };

            const encodingMapSpy = jest.spyOn(ussNode, "getEncodingInMap").mockResolvedValue(encoding);
            const response = await SharedUtils.getCachedEncoding(ussNode);

            expect(encodingMapSpy).toHaveBeenCalledWith(ussNode.resourceUri?.path);
            expect(response).toEqual(encoding.codepage);
        });

        it("correctly returns the cached encoding for undefined", async () => {
            const sessionNode = createUSSSessionNode(mockSession, mockProfile);
            const ussNode = new ZoweUSSNode({
                label: "TEST.PS",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                contextOverride: Constants.USS_TEXT_FILE_CONTEXT,
                session: mockSession,
                profile: mockProfile,
                parentNode: sessionNode,
            });
            const encoding = undefined;

            const encodingMapSpy = jest.spyOn(ussNode, "getEncodingInMap").mockResolvedValue(encoding);
            const response = await SharedUtils.getCachedEncoding(ussNode);

            expect(encodingMapSpy).toHaveBeenCalledWith(ussNode.resourceUri?.path);
            expect(response).toEqual(encoding);
        });
    });

    describe("Dataset nodes", () => {
        describe("Sequential", () => {
            it("correctly returns the cached encoding for binary", async () => {
                const sessionNode = createDatasetSessionNode(mockSession, mockProfile);
                const dsNode = new ZoweDatasetNode({
                    label: "TEST.PS",
                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                    contextOverride: Constants.DS_DS_BINARY_CONTEXT,
                    session: mockSession,
                    profile: mockProfile,
                    parentNode: sessionNode,
                });
                const encoding = { kind: "binary" };

                const encodingMapSpy = jest.spyOn(dsNode, "getEncodingInMap").mockResolvedValue(encoding);
                const response = await SharedUtils.getCachedEncoding(dsNode);

                expect(encodingMapSpy).toHaveBeenCalledWith(dsNode.resourceUri?.path);
                expect(response).toEqual(encoding.kind);
            });

            it("correctly returns the cached encoding for text", async () => {
                const sessionNode = createDatasetSessionNode(mockSession, mockProfile);
                const dsNode = new ZoweDatasetNode({
                    label: "TEST.PS",
                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                    contextOverride: Constants.DS_DS_CONTEXT,
                    session: mockSession,
                    profile: mockProfile,
                    parentNode: sessionNode,
                });
                const encoding = { kind: "test" };

                const encodingMapSpy = jest.spyOn(dsNode, "getEncodingInMap").mockResolvedValue(encoding);
                const response = await SharedUtils.getCachedEncoding(dsNode);

                expect(encodingMapSpy).toHaveBeenCalledWith(dsNode.resourceUri?.path);
                expect(response).toEqual(encoding.kind);
            });

            it("correctly returns the cached encoding for other", async () => {
                const sessionNode = createDatasetSessionNode(mockSession, mockProfile);
                const dsNode = new ZoweDatasetNode({
                    label: "TEST.PS",
                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                    contextOverride: Constants.DS_DS_CONTEXT,
                    session: mockSession,
                    profile: mockProfile,
                    parentNode: sessionNode,
                });
                const encoding = { kind: "other", codepage: "IBM-1147" };

                const encodingMapSpy = jest.spyOn(dsNode, "getEncodingInMap").mockResolvedValue(encoding);
                const response = await SharedUtils.getCachedEncoding(dsNode);

                expect(encodingMapSpy).toHaveBeenCalledWith(dsNode.resourceUri?.path);
                expect(response).toEqual(encoding.codepage);
            });

            it("correctly returns the cached encoding for undefined", async () => {
                const sessionNode = createDatasetSessionNode(mockSession, mockProfile);
                const dsNode = new ZoweDatasetNode({
                    label: "TEST.PS",
                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                    contextOverride: Constants.DS_DS_CONTEXT,
                    session: mockSession,
                    profile: mockProfile,
                    parentNode: sessionNode,
                });
                const encoding = undefined;

                const encodingMapSpy = jest.spyOn(dsNode, "getEncodingInMap").mockResolvedValue(encoding);
                const response = await SharedUtils.getCachedEncoding(dsNode);

                expect(encodingMapSpy).toHaveBeenCalledWith(dsNode.resourceUri?.path);
                expect(response).toEqual(encoding);
            });
        });

        describe("Partitioned", () => {
            it("correctly returns the cached encoding for binary", async () => {
                const sessionNode = createDatasetSessionNode(mockSession, mockProfile);
                const dsNode = new ZoweDatasetNode({
                    label: "TEST.PDS",
                    collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                    contextOverride: Constants.DS_PDS_CONTEXT,
                    session: mockSession,
                    profile: mockProfile,
                    parentNode: sessionNode,
                });
                const memNode = new ZoweDatasetNode({
                    label: "TESTMEM",
                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                    contextOverride: Constants.DS_MEMBER_BINARY_CONTEXT,
                    session: mockSession,
                    profile: mockProfile,
                    parentNode: dsNode,
                });
                const encoding = { kind: "binary" };

                const encodingMapSpy = jest.spyOn(memNode, "getEncodingInMap").mockResolvedValue(encoding);
                const response = await SharedUtils.getCachedEncoding(memNode);

                expect(encodingMapSpy).toHaveBeenCalledWith(memNode.resourceUri?.path);
                expect(response).toEqual(encoding.kind);
            });

            it("correctly returns the cached encoding for text", async () => {
                const sessionNode = createDatasetSessionNode(mockSession, mockProfile);
                const dsNode = new ZoweDatasetNode({
                    label: "TEST.PDS",
                    collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                    contextOverride: Constants.DS_PDS_CONTEXT,
                    session: mockSession,
                    profile: mockProfile,
                    parentNode: sessionNode,
                });
                const memNode = new ZoweDatasetNode({
                    label: "TESTMEM",
                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                    contextOverride: Constants.DS_MEMBER_CONTEXT,
                    session: mockSession,
                    profile: mockProfile,
                    parentNode: dsNode,
                });
                const encoding = { kind: "text" };

                const encodingMapSpy = jest.spyOn(memNode, "getEncodingInMap").mockResolvedValue(encoding);
                const response = await SharedUtils.getCachedEncoding(memNode);

                expect(encodingMapSpy).toHaveBeenCalledWith(memNode.resourceUri?.path);
                expect(response).toEqual(encoding.kind);
            });

            it("correctly returns the cached encoding for other", async () => {
                const sessionNode = createDatasetSessionNode(mockSession, mockProfile);
                const dsNode = new ZoweDatasetNode({
                    label: "TEST.PDS",
                    collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                    contextOverride: Constants.DS_PDS_CONTEXT,
                    session: mockSession,
                    profile: mockProfile,
                    parentNode: sessionNode,
                });
                const memNode = new ZoweDatasetNode({
                    label: "TESTMEM",
                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                    contextOverride: Constants.DS_MEMBER_CONTEXT,
                    session: mockSession,
                    profile: mockProfile,
                    parentNode: dsNode,
                });
                const encoding = { kind: "other", codepage: "IBM-1147" };

                const encodingMapSpy = jest.spyOn(memNode, "getEncodingInMap").mockResolvedValue(encoding);
                const response = await SharedUtils.getCachedEncoding(memNode);

                expect(encodingMapSpy).toHaveBeenCalledWith(memNode.resourceUri?.path);
                expect(response).toEqual(encoding.codepage);
            });

            it("correctly returns the cached encoding for undefined", async () => {
                const sessionNode = createDatasetSessionNode(mockSession, mockProfile);
                const dsNode = new ZoweDatasetNode({
                    label: "TEST.PDS",
                    collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                    contextOverride: Constants.DS_PDS_CONTEXT,
                    session: mockSession,
                    profile: mockProfile,
                    parentNode: sessionNode,
                });
                const memNode = new ZoweDatasetNode({
                    label: "TESTMEM",
                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                    contextOverride: Constants.DS_MEMBER_CONTEXT,
                    session: mockSession,
                    profile: mockProfile,
                    parentNode: dsNode,
                });
                const encoding = undefined;

                const encodingMapSpy = jest.spyOn(memNode, "getEncodingInMap").mockResolvedValue(encoding);
                const response = await SharedUtils.getCachedEncoding(memNode);

                expect(encodingMapSpy).toHaveBeenCalledWith(memNode.resourceUri?.path);
                expect(response).toEqual(encoding);
            });
        });
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

describe("Shared utils unit tests - function addToWorkspace", () => {
    it("adds a Data Set resource to the workspace", () => {
        const datasetNode = new ZoweDatasetNode({
            label: "EXAMPLE.PDS",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextOverride: Constants.DS_PDS_CONTEXT,
            profile: createIProfile(),
        });
        const updateWorkspaceFoldersMock = jest.spyOn(vscode.workspace, "updateWorkspaceFolders").mockImplementation();
        SharedUtils.addToWorkspace(datasetNode, null as any);
        expect(updateWorkspaceFoldersMock).toHaveBeenCalledWith(0, null, {
            uri: datasetNode.resourceUri,
            name: `[sestest] ${datasetNode.label as string}`,
        });
    });
    it("adds a USS resource to the workspace", () => {
        const ussNode = new ZoweUSSNode({
            label: "textFile.txt",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextOverride: Constants.USS_TEXT_FILE_CONTEXT,
            profile: createIProfile(),
        });
        const updateWorkspaceFoldersMock = jest.spyOn(vscode.workspace, "updateWorkspaceFolders").mockImplementation();
        SharedUtils.addToWorkspace(ussNode, null as any);
        expect(updateWorkspaceFoldersMock).toHaveBeenCalledWith(0, null, { uri: ussNode.resourceUri, name: `[sestest] ${ussNode.fullPath}` });
    });
    it("adds multiple resources to the workspace at once", () => {
        const datasetNode1 = new ZoweDatasetNode({
            label: "EXAMPLE.PDS1",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextOverride: Constants.DS_PDS_CONTEXT,
            profile: createIProfile(),
        });
        const datasetNode2 = new ZoweDatasetNode({
            label: "EXAMPLE.PDS2",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextOverride: Constants.DS_PDS_CONTEXT,
            profile: createIProfile(),
        });
        const updateWorkspaceFoldersMock = jest.spyOn(vscode.workspace, "updateWorkspaceFolders").mockImplementation();
        SharedUtils.addToWorkspace(null as any, [datasetNode1, datasetNode2]);
        expect(updateWorkspaceFoldersMock).toHaveBeenCalledWith(
            0,
            null,
            {
                uri: datasetNode1.resourceUri,
                name: `[sestest] ${datasetNode1.label as string}`,
            },
            {
                uri: datasetNode2.resourceUri,
                name: `[sestest] ${datasetNode2.label as string}`,
            }
        );
    });
    it("adds a USS session w/ fullPath to the workspace", () => {
        const ussNode = new ZoweUSSNode({
            label: "sestest",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextOverride: Constants.USS_SESSION_CONTEXT,
            profile: createIProfile(),
            session: createISession(),
        });
        ussNode.fullPath = "/u/users/smpluser";
        const updateWorkspaceFoldersMock = jest.spyOn(vscode.workspace, "updateWorkspaceFolders").mockImplementation();
        SharedUtils.addToWorkspace(ussNode, null as any);
        expect(updateWorkspaceFoldersMock).toHaveBeenCalledWith(0, null, {
            uri: ussNode.resourceUri?.with({ path: `/sestest${ussNode.fullPath}` }),
            name: `[${ussNode.label as string}] ${ussNode.fullPath}`,
        });
    });
    it("displays an info message when adding a USS session w/o fullPath", () => {
        const ussNode = new ZoweUSSNode({
            label: "sestest",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextOverride: Constants.USS_SESSION_CONTEXT,
            profile: createIProfile(),
            session: createISession(),
        });
        ussNode.fullPath = "";
        const updateWorkspaceFoldersMock = jest.spyOn(vscode.workspace, "updateWorkspaceFolders").mockImplementation();
        const infoMessageSpy = jest.spyOn(Gui, "infoMessage");
        updateWorkspaceFoldersMock.mockClear();
        SharedUtils.addToWorkspace(ussNode, null as any);
        expect(updateWorkspaceFoldersMock).not.toHaveBeenCalledWith(0, null, {
            uri: ussNode.resourceUri?.with({ path: `/sestest${ussNode.fullPath}` }),
            name: `[${ussNode.label as string}] ${ussNode.fullPath}`,
        });
        expect(infoMessageSpy).toHaveBeenCalledWith("A search must be set for sestest before it can be added to a workspace.");
    });
    it("skips adding a resource that's already in the workspace", () => {
        const ussNode = new ZoweUSSNode({
            label: "testFolder",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextOverride: Constants.USS_DIR_CONTEXT,
            profile: createIProfile(),
        });
        const workspaceFolders = new MockedProperty(vscode.workspace, "workspaceFolders", {
            value: [{ uri: ussNode.resourceUri, name: ussNode.label }],
        });
        const updateWorkspaceFoldersMock = jest.spyOn(vscode.workspace, "updateWorkspaceFolders").mockImplementation();
        updateWorkspaceFoldersMock.mockClear();
        SharedUtils.addToWorkspace(ussNode, null as any);
        expect(updateWorkspaceFoldersMock).not.toHaveBeenCalledWith(0, null, {
            uri: ussNode.resourceUri,
            name: `[sestest] ${ussNode.fullPath}`,
        });
        workspaceFolders[Symbol.dispose]();
    });
});

describe("Shared utils unit tests - function copyExternalLink", () => {
    it("does nothing for an invalid node or one without a resource URI", async () => {
        const copyClipboardMock = jest.spyOn(vscode.env.clipboard, "writeText");
        const ussNode = createUSSNode(createISession(), createIProfile());
        ussNode.resourceUri = undefined;
        await SharedUtils.copyExternalLink({ extension: { id: "Zowe.vscode-extension-for-zowe" } } as any, ussNode);
        expect(copyClipboardMock).not.toHaveBeenCalled();
    });

    it("copies a link for a node with a resource URI", async () => {
        const copyClipboardMock = jest.spyOn(vscode.env.clipboard, "writeText");
        const ussNode = createUSSNode(createISession(), createIProfile());
        await SharedUtils.copyExternalLink({ extension: { id: "Zowe.vscode-extension-for-zowe" } } as any, ussNode);
        expect(copyClipboardMock).toHaveBeenCalledWith(`vscode://Zowe.vscode-extension-for-zowe?${ussNode.resourceUri?.toString()}`);
    });
});

describe("Shared utils unit tests - function debounce", () => {
    beforeAll(() => {
        jest.useFakeTimers();
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    it("executes a function twice when time between calls is long", () => {
        const mockEventHandler = jest.fn();
        const debouncedFn = SharedUtils.debounce(mockEventHandler, 100);
        debouncedFn();
        jest.runAllTimers();
        debouncedFn();
        jest.runAllTimers();
        expect(mockEventHandler).toHaveBeenCalledTimes(2);
    });

    it("executes a function only once when time between calls is short", () => {
        const mockEventHandler = jest.fn();
        const debouncedFn = SharedUtils.debounce(mockEventHandler, 100);
        debouncedFn();
        jest.advanceTimersByTime(10);
        debouncedFn();
        jest.runAllTimers();
        expect(mockEventHandler).toHaveBeenCalledTimes(1);
    });
});

describe("Shared utils unit tests - updateSortOptionsWithDefault", () => {
    it("should add (default) to the correct sort option", () => {
        const sortOptions = ["Name", "Date Created", "Date Modified", "User ID"];
        const sortMethod = 2; // Date Modified

        SharedUtils.updateSortOptionsWithDefault(sortMethod, sortOptions);

        expect(sortOptions).toEqual(["Name", "Date Created", "Date Modified (default)", "User ID"]);
    });

    it("should remove existing (default) from other sort options", () => {
        const sortOptions = ["Name (default)", "Date Created", "Date Modified", "User ID"];
        const sortMethod = 2; // Date Modified

        SharedUtils.updateSortOptionsWithDefault(sortMethod, sortOptions);

        expect(sortOptions).toEqual(["Name", "Date Created", "Date Modified (default)", "User ID"]);
    });

    it("should handle empty sort options array", () => {
        const sortOptions: string[] = [];
        const sortMethod = 0; // Any index

        SharedUtils.updateSortOptionsWithDefault(sortMethod, sortOptions);

        expect(sortOptions).toEqual([]);
    });

    it("should handle sort method out of bounds", () => {
        const sortOptions = ["Name", "Date Created", "Date Modified", "User ID"];
        const sortMethod = 10; // Out of bounds

        SharedUtils.updateSortOptionsWithDefault(sortMethod, sortOptions);

        expect(sortOptions).toEqual(["Name", "Date Created", "Date Modified", "User ID"]);
    });

    it("should handle sort method as string", () => {
        const sortOptions = ["Name", "Date Created", "Date Modified", "User ID"];
        const sortMethod = "2"; // Date Modified

        SharedUtils.updateSortOptionsWithDefault(sortMethod, sortOptions);

        expect(sortOptions).toEqual(["Name", "Date Created", "Date Modified (default)", "User ID"]);
    });
});

describe("Shared utils unit tests - getDefaultSortOptions", () => {
    it("should return default sort options when settings are not defined", () => {
        const sortOptions = ["Name", "Date Created", "Date Modified", "User ID"];
        const settingsKey = "defaultSort";
        const sortMethod = {
            Name: 0,
            DateCreated: 1,
            DateModified: 2,
            UserId: 3,
        };

        jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValueOnce(undefined);

        const result = SharedUtils.getDefaultSortOptions(sortOptions, settingsKey, sortMethod);

        expect(result).toEqual({
            method: sortMethod.Name,
            direction: Sorting.SortDirection.Ascending,
        });
    });

    it("should return sort options from settings with default sort option marked", () => {
        const sortOptions = ["Name", "Date Created", "Date Modified", "User ID"];
        const settingsKey = "defaultSort";
        const sortMethod = {
            Name: 0,
            DateCreated: 1,
            DateModified: 2,
            UserId: 3,
        };

        jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValueOnce({
            method: "DateModified",
            direction: "Descending",
        });

        const result = SharedUtils.getDefaultSortOptions(sortOptions, settingsKey, sortMethod);

        expect(result).toEqual({
            method: sortMethod.DateModified,
            direction: Sorting.SortDirection.Descending,
        });
        expect(sortOptions).toEqual(["Name", "Date Created", "Date Modified (default)", "User ID"]);
    });

    it("should handle string sort method and direction from settings", () => {
        const sortOptions = ["Name", "Date Created", "Date Modified", "User ID"];
        const settingsKey = "defaultSort";
        const sortMethod = {
            Name: 0,
            DateCreated: 1,
            DateModified: 2,
            UserId: 3,
        };

        jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValueOnce({
            method: "UserId",
            direction: "Ascending",
        });

        const result = SharedUtils.getDefaultSortOptions(sortOptions, settingsKey, sortMethod);

        expect(result).toEqual({
            method: sortMethod.UserId,
            direction: Sorting.SortDirection.Ascending,
        });
        expect(sortOptions).toEqual(["Name", "Date Created", "Date Modified", "User ID (default)"]);
    });

    it("should handle invalid sort method and direction from settings", () => {
        const sortOptions = ["Name", "Date Created", "Date Modified", "User ID"];
        const settingsKey = "defaultSort";
        const sortMethod = {
            Name: 0,
            DateCreated: 1,
            DateModified: 2,
            UserId: 3,
        };

        jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValueOnce({
            method: "InvalidMethod",
            direction: "InvalidDirection",
        });

        const result = SharedUtils.getDefaultSortOptions(sortOptions, settingsKey, sortMethod);

        expect(result).toEqual({
            method: sortMethod.Name,
            direction: Sorting.SortDirection.Ascending,
        });
        expect(sortOptions).toEqual(["Name (default)", "Date Created", "Date Modified", "User ID"]);
    });

    it("should handle missing sort method and direction from settings", () => {
        const sortOptions = ["Name", "Date Created", "Date Modified", "User ID"];
        const settingsKey = "defaultSort";
        const sortMethod = {
            Name: 0,
            DateCreated: 1,
            DateModified: 2,
            UserId: 3,
        };

        jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValueOnce({
            method: undefined,
            direction: undefined,
        });

        const result = SharedUtils.getDefaultSortOptions(sortOptions, settingsKey, sortMethod);

        expect(result).toEqual({
            method: sortMethod.Name,
            direction: Sorting.SortDirection.Ascending,
        });
        expect(sortOptions).toEqual(["Name (default)", "Date Created", "Date Modified", "User ID"]);
    });
});
