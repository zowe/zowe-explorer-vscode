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

import * as sharedUtils from "../../../src/shared/utils";
import * as globals from "../../../src/globals";
import { imperative } from "@zowe/cli";
import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";
import * as vscode from "vscode";
import * as path from "path";
import {
    createIProfile,
    createISessionWithoutCredentials,
    createISession,
    createFileResponse,
    createInstanceOfProfile,
    createTextDocument,
} from "../../../__mocks__/mockCreators/shared";
import { createDatasetSessionNode } from "../../../__mocks__/mockCreators/datasets";
import { ZoweUSSNode } from "../../../src/uss/ZoweUSSNode";
import { Job } from "../../../src/job/ZoweJobNode";
import { ZoweExplorerApiRegister } from "../../../src/ZoweExplorerApiRegister";
import { Profiles } from "../../../src/Profiles";
import * as utils from "../../../src/utils/ProfilesUtils";
import { IZoweTreeNode, ProfilesCache } from "@zowe/zowe-explorer-api";
import { ZoweLogger } from "../../../src/utils/LoggerUtils";

async function createGlobalMocks() {
    const newMocks = {
        session: createISession(),
        profileOne: createIProfile(),
        mockGetInstance: jest.fn(),
        mockProfileInstance: null,
        mockProfilesCache: null,
    };
    newMocks.mockProfilesCache = new ProfilesCache(imperative.Logger.getAppLogger());
    newMocks.mockProfileInstance = createInstanceOfProfile(createIProfile());
    Object.defineProperty(Profiles, "CreateInstance", {
        value: () => newMocks.mockProfileInstance,
        configurable: true,
    });
    Object.defineProperty(Profiles, "getInstance", {
        value: () => newMocks.mockProfileInstance,
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
        const rootNode = new ZoweUSSNode("root", vscode.TreeItemCollapsibleState.Collapsed, null, globalMocks.session, null, false, null, undefined);
        const childNode1 = new ZoweUSSNode(
            "child1",
            vscode.TreeItemCollapsibleState.Collapsed,
            rootNode,
            globalMocks.session,
            null,
            false,
            null,
            undefined
        );
        const childNode2 = new ZoweUSSNode(
            "child2",
            vscode.TreeItemCollapsibleState.Collapsed,
            childNode1,
            globalMocks.session,
            null,
            false,
            null,
            undefined
        );

        childNode1.children.push(childNode2);
        rootNode.children.push(childNode1);

        const returnedArray = sharedUtils.concatChildNodes([rootNode]);
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
        utils.syncSessionNode(sessionForProfile, sessionNode);
        expect(await sessionNode.getSession()).toEqual(expectedSession);
        expect(await sessionNode.getProfile()).toEqual(createIProfile());
    });
    it("should do nothing, if there is no profile from provided node in the file system", async () => {
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
        utils.syncSessionNode(dummyFn, sessionNode);
        // then
        const initialSession = sessionNode.getSession();
        const initialProfile = sessionNode.getProfile();
        expect(sessionNode.getSession()).toEqual(initialSession);
        expect(sessionNode.getProfile()).toEqual(initialProfile);
    });
});

describe("Shared Utils Unit Tests - Function filterTreeByString", () => {
    it("Testing that filterTreeByString returns the correct array", async () => {
        const qpItems = [
            new utils.FilterItem({ text: "[sestest]: HLQ.PROD2.STUFF1" }),
            new utils.FilterItem({ text: "[sestest]: HLQ.PROD3.STUFF2(TESTMEMB)" }),
            new utils.FilterItem({ text: "[sestest]: /test/tree/abc" }),
        ];

        let filteredValues = await sharedUtils.filterTreeByString("testmemb", qpItems);
        expect(filteredValues).toStrictEqual([qpItems[1]]);
        filteredValues = await sharedUtils.filterTreeByString("sestest", qpItems);
        expect(filteredValues).toStrictEqual(qpItems);
        filteredValues = await sharedUtils.filterTreeByString("HLQ.PROD2.STUFF1", qpItems);
        expect(filteredValues).toStrictEqual([qpItems[0]]);
        filteredValues = await sharedUtils.filterTreeByString("HLQ.*.STUFF*", qpItems);
        expect(filteredValues).toStrictEqual([qpItems[0], qpItems[1]]);
        filteredValues = await sharedUtils.filterTreeByString("/test/tree/abc", qpItems);
        expect(filteredValues).toStrictEqual([qpItems[2]]);
        filteredValues = await sharedUtils.filterTreeByString("*/abc", qpItems);
        expect(filteredValues).toStrictEqual([qpItems[2]]);
    });
});

describe("Shared Utils Unit Tests - Function getDocumentFilePath", () => {
    let blockMocks;
    function createBlockMocks() {
        const session = createISessionWithoutCredentials();
        const imperativeProfile = createIProfile();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);

        return {
            session,
            imperativeProfile,
            datasetSessionNode,
        };
    }

    it("Testing that the add Suffix for datasets works", async () => {
        blockMocks = createBlockMocks();
        globals.defineGlobals("/test/path/");

        let node = new ZoweDatasetNode("AUSER.TEST.JCL(member)", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.JCL(member).jcl")
        );
        node = new ZoweDatasetNode("AUSER.TEST.ASM(member)", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.ASM(member).asm")
        );
        node = new ZoweDatasetNode("AUSER.COBOL.TEST(member)", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.COBOL.TEST(member).cbl")
        );
        node = new ZoweDatasetNode("AUSER.PROD.PLI(member)", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.PROD.PLI(member).pli")
        );
        node = new ZoweDatasetNode("AUSER.PROD.PLX(member)", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.PROD.PLX(member).pli")
        );
        node = new ZoweDatasetNode("AUSER.PROD.SH(member)", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.PROD.SH(member).sh")
        );
        node = new ZoweDatasetNode("AUSER.REXX.EXEC(member)", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.REXX.EXEC(member).rexx")
        );
        node = new ZoweDatasetNode("AUSER.TEST.XML(member)", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.XML(member).xml")
        );

        node = new ZoweDatasetNode("AUSER.TEST.XML", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.XML.xml")
        );
        node = new ZoweDatasetNode("AUSER.TEST.TXML", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.TXML")
        );
        node = new ZoweDatasetNode("AUSER.XML.TGML", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.XML.TGML.xml")
        );
        node = new ZoweDatasetNode("AUSER.XML.ASM", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.XML.ASM.asm")
        );
        node = new ZoweDatasetNode("AUSER", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER")
        );
        node = new ZoweDatasetNode("AUSER.XML.TEST(member)", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.XML.TEST(member).xml")
        );
        node = new ZoweDatasetNode("XML.AUSER.TEST(member)", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "XML.AUSER.TEST(member)")
        );
        node = new ZoweDatasetNode("AUSER.COBOL.PL1.XML.TEST(member)", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.COBOL.PL1.XML.TEST(member).xml")
        );
        node = new ZoweDatasetNode(
            "AUSER.COBOL.PL1.XML.ASSEMBLER.TEST(member)",
            vscode.TreeItemCollapsibleState.None,
            blockMocks.datasetSessionNode,
            null
        );
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.COBOL.PL1.XML.ASSEMBLER.TEST(member).asm")
        );
        node = new ZoweDatasetNode("AUSER.TEST.COPYBOOK", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.COPYBOOK.cpy")
        );
        node = new ZoweDatasetNode("AUSER.TEST.PLINC", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toBe(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.PLINC.inc")
        );
        node = new ZoweDatasetNode("AUSER.TEST.SPFLOG1", vscode.TreeItemCollapsibleState.None, blockMocks.datasetSessionNode, null);
        expect(sharedUtils.getDocumentFilePath(node.label.toString(), node)).toEqual(
            path.join(path.sep, "test", "path", "temp", "_D_", "sestest", "AUSER.TEST.SPFLOG1.log")
        );
    });
});

describe("Shared Utils Unit Tests - Function getSelectedNodeList", () => {
    it("Testing that getSelectedNodeList returns the correct array when single node is selected", async () => {
        const selectedNodes = [];
        const aNode = createTestNode();
        selectedNodes.push(aNode);
        const nodeList = sharedUtils.getSelectedNodeList(aNode, selectedNodes);

        expect(nodeList).toEqual(selectedNodes);
    });

    it("Testing that getSelectedNodeList returns the correct array when single node is selected via quickKeys", async () => {
        const selectedNodes = undefined;
        const aNode = createTestNode();
        const nodeList = sharedUtils.getSelectedNodeList(aNode, selectedNodes);

        expect(nodeList[0]).toEqual(aNode);
    });

    it("Testing that getSelectedNodeList returns the correct array when multiple node is selected", async () => {
        const selectedNodes = [];
        const aNode = createTestNode();
        selectedNodes.push(aNode);
        const bNode = createTestNode();
        selectedNodes.push(bNode);
        const nodeList = sharedUtils.getSelectedNodeList(aNode, selectedNodes);

        expect(nodeList).toEqual(selectedNodes);
    });

    function createTestNode() {
        const node = new ZoweDatasetNode("testLabel", vscode.TreeItemCollapsibleState.Collapsed, null, null, null);
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
        sharedUtils.sortTreeItems(toSort, "some_context");
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

describe("Shared utils unit tests - function updateOpenFiles", () => {
    const someTree = { openFiles: {} };

    it("sets a file entry to null in the openFiles record", () => {
        sharedUtils.updateOpenFiles(someTree as any, "/a/doc/path", null);
        expect(someTree.openFiles["/a/doc/path"]).toBeNull();
    });

    it("sets a file entry to a valid node in the openFiles record", () => {
        sharedUtils.updateOpenFiles(someTree as any, "/a/doc/path", { label: "testLabel" } as IZoweTreeNode);
        expect(someTree.openFiles["/a/doc/path"].label).toBe("testLabel");
    });

    it("does nothing if openFiles is not defined", () => {
        someTree.openFiles = undefined as any;
        sharedUtils.updateOpenFiles(someTree as any, "/a/doc/path", null);
        expect(someTree.openFiles).toBeUndefined();
    });
});
