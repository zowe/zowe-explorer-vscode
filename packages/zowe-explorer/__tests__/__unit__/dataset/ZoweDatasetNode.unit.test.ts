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
import { imperative, Gui, ValidProfileEnum, DatasetSortOpts, SortDirection } from "@zowe/zowe-explorer-api";
import {
    createSessCfgFromArgs,
    createInstanceOfProfile,
    createIProfile,
    createISession,
    createISessionWithoutCredentials,
    createTreeView,
} from "../../../__mocks__/mockCreators/shared";
import { createDatasetSessionNode, createDatasetTree } from "../../../__mocks__/mockCreators/datasets";
import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";
import { bindMvsApi, createMvsApi } from "../../../__mocks__/mockCreators/api";
import * as globals from "../../../src/globals";
import * as path from "path";
import * as fs from "fs";
import * as sharedUtils from "../../../src/shared/utils";
import { Profiles } from "../../../src/Profiles";
import { ZoweLogger } from "../../../src/utils/LoggerUtils";
import { LocalFileManagement } from "../../../src/utils/LocalFileManagement";
import { getIconById, IconId } from "../../../src/generators/icons";
import { List } from "@zowe/cli";

// Missing the definition of path module, because I need the original logic for tests
jest.mock("fs");
jest.mock("vscode");

// Idea is borrowed from: https://github.com/kulshekhar/ts-jest/blob/master/src/util/testing.ts
const mocked = <T extends (...args: any[]) => any>(fn: T): jest.Mock<ReturnType<T>> => fn as any;

function createGlobalMocks() {
    globals.defineGlobals("");

    const newMocks = {
        imperativeProfile: createIProfile(),
        profileInstance: null,
        getContentsSpy: null,
        mvsApi: null,
    };

    newMocks.profileInstance = createInstanceOfProfile(newMocks.imperativeProfile);
    newMocks.mvsApi = createMvsApi(newMocks.imperativeProfile);
    newMocks.getContentsSpy = jest.spyOn(newMocks.mvsApi, "getContents");
    bindMvsApi(newMocks.mvsApi);
    Object.defineProperty(Gui, "errorMessage", { value: jest.fn(), configurable: true });
    Object.defineProperty(Profiles, "getInstance", { value: jest.fn(), configurable: true });
    mocked(Profiles.getInstance).mockReturnValue(newMocks.profileInstance);
    Object.defineProperty(fs, "existsSync", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.commands, "executeCommand", {
        value: jest.fn(),
        configurable: true,
    });
    Object.defineProperty(vscode.workspace, "openTextDocument", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.window, "createTreeView", {
        value: jest.fn().mockReturnValue({ onDidCollapseElement: jest.fn() }),
        configurable: true,
    });
    jest.spyOn(LocalFileManagement, "storeFileInfo").mockImplementation();

    return newMocks;
}

describe("ZoweDatasetNode Unit Tests", () => {
    // Globals
    const session = new imperative.Session({
        user: "fake",
        password: "fake",
        hostname: "fake",
        protocol: "https",
        type: "basic",
    });
    const profileOne: imperative.IProfileLoaded = {
        name: "profile1",
        profile: {},
        type: "zosmf",
        message: "",
        failNotFound: false,
    };
    const ProgressLocation = jest.fn().mockImplementation(() => {
        return {
            Notification: 15,
        };
    });

    const withProgress = jest.fn().mockImplementation((progLocation, callback) => {
        return callback();
    });

    Object.defineProperty(globals, "LOG", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals.LOG, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode, "ProgressLocation", { value: ProgressLocation });
    Object.defineProperty(vscode.window, "withProgress", { value: withProgress });
    Object.defineProperty(ZoweLogger, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "trace", { value: jest.fn(), configurable: true });

    beforeEach(() => {
        withProgress.mockImplementation((progLocation, callback) => {
            return callback();
        });
    });

    const showErrorMessage = jest.fn();
    Object.defineProperty(vscode.window, "showErrorMessage", { value: showErrorMessage });

    afterEach(() => {
        jest.resetAllMocks();
    });

    /*************************************************************************************************************
     * Creates an ZoweDatasetNode and checks that its members are all initialized by the constructor
     *************************************************************************************************************/
    it("Testing that the ZoweDatasetNode is defined", async () => {
        const testNode = new ZoweDatasetNode({ label: "BRTVS99", collapsibleState: vscode.TreeItemCollapsibleState.None, session });
        testNode.contextValue = globals.DS_SESSION_CONTEXT;

        expect(testNode.label).toBeDefined();
        expect(testNode.collapsibleState).toBeDefined();
        expect(testNode.label).toBeDefined();
        expect(testNode.getParent()).toBeUndefined();
        expect(testNode.getSession()).toBeDefined();
    });

    /*************************************************************************************************************
     * Creates sample ZoweDatasetNode list and checks that getChildren() returns the correct array
     *************************************************************************************************************/
    it("Testing that getChildren returns the correct Thenable<ZoweDatasetNode[]>", async () => {
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    loadNamedProfile: jest.fn().mockReturnValue(profileOne),
                };
            }),
        });
        // Creating a rootNode
        const rootNode = new ZoweDatasetNode({
            label: "root",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session,
            profile: profileOne,
        });
        rootNode.dirty = true;
        rootNode.contextValue = globals.DS_SESSION_CONTEXT;
        rootNode.pattern = "SAMPLE, SAMPLE.PUBLIC, SAMPLE";
        let rootChildren = await rootNode.getChildren();

        // Creating structure of files and folders under BRTVS99 profile
        const sampleChildren: ZoweDatasetNode[] = [
            new ZoweDatasetNode({
                label: "BRTVS99",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                parentNode: rootNode,
                profile: profileOne,
            }),
            new ZoweDatasetNode({
                label: "BRTVS99.CA10",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                parentNode: rootNode,
                profile: profileOne,
                contextOverride: globals.DS_MIGRATED_FILE_CONTEXT,
            }),
            new ZoweDatasetNode({
                label: "BRTVS99.CA11.SPFTEMP0.CNTL",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                parentNode: rootNode,
                profile: profileOne,
            }),
            new ZoweDatasetNode({
                label: "BRTVS99.DDIR",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                parentNode: rootNode,
                profile: profileOne,
            }),
            new ZoweDatasetNode({
                label: "BRTVS99.VS1",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                parentNode: rootNode,
                profile: profileOne,
                contextOverride: globals.VSAM_CONTEXT,
            }),
        ];
        sampleChildren[0].command = { command: "zowe.ds.ZoweNode.openPS", title: "", arguments: [sampleChildren[0]] };

        // Checking that the rootChildren are what they are expected to be
        expect(rootChildren).toEqual(sampleChildren);

        rootNode.dirty = true;
        // Check the dirty and children variable have been set
        rootChildren = await rootNode.getChildren();

        // Checking that the rootChildren are what they are expected to be
        expect(rootChildren).toEqual(sampleChildren);

        // Check that error is thrown when label is blank
        const errorNode = new ZoweDatasetNode({
            label: "",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session,
            profile: profileOne,
        });
        errorNode.dirty = true;
        await expect(errorNode.getChildren()).rejects.toEqual(Error("Invalid node"));

        // Check that label is different when label contains a []
        const rootNode2 = new ZoweDatasetNode({
            label: "root[test]",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session,
            profile: profileOne,
        });
        rootNode2.dirty = true;
        rootChildren = await rootNode2.getChildren();
    });

    /*************************************************************************************************************
     * Creates sample ZoweDatasetNode list and checks that getChildren() returns the correct array for a PO
     *************************************************************************************************************/
    it("Testing that getChildren returns the correct Thenable<ZoweDatasetNode[]> for a PO", async () => {
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    loadNamedProfile: jest.fn().mockReturnValue(profileOne),
                };
            }),
        });
        // Creating a rootNode
        const rootNode = new ZoweDatasetNode({ label: "root", collapsibleState: vscode.TreeItemCollapsibleState.None, session, profile: profileOne });
        rootNode.contextValue = globals.DS_SESSION_CONTEXT;
        rootNode.dirty = true;
        const subNode = new ZoweDatasetNode({
            label: "sub",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: rootNode,
            profile: profileOne,
        });
        subNode.dirty = true;
        const subChildren = await subNode.getChildren();

        // Creating structure of files and folders under BRTVS99 profile
        const sampleChildren: ZoweDatasetNode[] = [
            new ZoweDatasetNode({
                label: "BRTVS99",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                parentNode: subNode,
                profile: profileOne,
            }),
            new ZoweDatasetNode({
                label: "BRTVS99.DDIR",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                parentNode: subNode,
                profile: profileOne,
            }),
        ];

        sampleChildren[0].command = { command: "zowe.ds.ZoweNode.openPS", title: "", arguments: [sampleChildren[0]] };
        sampleChildren[1].command = { command: "zowe.ds.ZoweNode.openPS", title: "", arguments: [sampleChildren[1]] };
        // Checking that the rootChildren are what they are expected to be
        expect(subChildren).toEqual(sampleChildren);
    });

    /*************************************************************************************************************
     * Checks that returning an unsuccessful response results in an error being thrown and caught
     *************************************************************************************************************/
    it("Checks that when List.dataSet/allMembers() throws an error, it returns an empty list", async () => {
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    loadNamedProfile: jest.fn().mockReturnValue(profileOne),
                };
            }),
        });
        // Creating a rootNode
        const rootNode = new ZoweDatasetNode({
            label: "root",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session,
            profile: profileOne,
            contextOverride: globals.DS_SESSION_CONTEXT,
        });
        rootNode.dirty = true;
        const subNode = new ZoweDatasetNode({
            label: "Response Fail",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: rootNode,
            profile: profileOne,
        });
        jest.spyOn(List, "allMembers").mockRejectedValueOnce(new Error(subNode.label as string));
        // Populate node with children from previous search to ensure they are removed
        subNode.children = [
            new ZoweDatasetNode({ label: "old", collapsibleState: vscode.TreeItemCollapsibleState.None, session, profile: profileOne }),
        ];
        subNode.dirty = true;
        const response = await subNode.getChildren();
        expect(response).toEqual([]);
    });

    it("Checks that when List.dataSet/allMembers() returns an empty response, it returns a label of 'No data sets found'", async () => {
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    loadNamedProfile: jest.fn().mockReturnValue(profileOne),
                };
            }),
        });
        // Creating a rootNode
        const rootNode = new ZoweDatasetNode({
            label: "root",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session,
            profile: profileOne,
            contextOverride: globals.DS_SESSION_CONTEXT,
        });
        rootNode.dirty = true;
        const subNode = new ZoweDatasetNode({
            label: "Response Fail",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: rootNode,
            profile: profileOne,
        });
        jest.spyOn(subNode as any, "getDatasets").mockResolvedValueOnce([
            {
                success: true,
                apiResponse: {
                    items: [],
                },
            },
        ]);
        subNode.dirty = true;
        const response = await subNode.getChildren();
        expect(response[0].label).toBe("No data sets found");
    });

    /*************************************************************************************************************
     * Checks that passing a session node that is not dirty ignores the getChildren() method
     *************************************************************************************************************/
    it("Checks that passing a session node that is not dirty the getChildren() method is exited early", async () => {
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    loadNamedProfile: jest.fn().mockReturnValue(profileOne),
                };
            }),
        });
        // Creating a rootNode
        const rootNode = new ZoweDatasetNode({
            label: "root",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session,
            profile: profileOne,
            contextOverride: globals.DS_SESSION_CONTEXT,
        });
        const infoChild = new ZoweDatasetNode({
            label: "Use the search button to display data sets",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: rootNode,
            contextOverride: globals.INFORMATION_CONTEXT,
        });
        rootNode.dirty = false;
        expect(await rootNode.getChildren()).toEqual([infoChild]);
    });

    /*************************************************************************************************************
     * Checks that passing a session node with no hlq ignores the getChildren() method
     *************************************************************************************************************/
    it("Checks that passing a session node with no hlq the getChildren() method is exited early", async () => {
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    loadNamedProfile: jest.fn().mockReturnValue(profileOne),
                };
            }),
        });
        // Creating a rootNode
        const rootNode = new ZoweDatasetNode({
            label: "root",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session,
            profile: profileOne,
            contextOverride: globals.DS_SESSION_CONTEXT,
        });
        const infoChild = new ZoweDatasetNode({
            label: "Use the search button to display data sets",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: rootNode,
            contextOverride: globals.INFORMATION_CONTEXT,
        });
        expect(await rootNode.getChildren()).toEqual([infoChild]);
    });

    /*************************************************************************************************************
     * Checks that when getSession() is called on a memeber it returns the proper session
     *************************************************************************************************************/
    it("Checks that a member can reach its session properly", async () => {
        // Creating a rootNode
        const rootNode = new ZoweDatasetNode({
            label: "root",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session,
            profile: profileOne,
        });
        rootNode.contextValue = globals.DS_SESSION_CONTEXT;
        const subNode = new ZoweDatasetNode({
            label: globals.DS_PDS_CONTEXT,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: rootNode,
            profile: profileOne,
        });
        const member = new ZoweDatasetNode({
            label: globals.DS_MEMBER_CONTEXT,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: subNode,
            profile: profileOne,
        });
        expect(member.getSession()).toBeDefined();
    });
    /*************************************************************************************************************
     * Tests that certain types can't have children
     *************************************************************************************************************/
    it("Testing that certain types can't have children", async () => {
        // Creating a rootNode
        const rootNode = new ZoweDatasetNode({
            label: "root",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session,
            profile: profileOne,
        });
        rootNode.dirty = true;
        rootNode.contextValue = globals.DS_DS_CONTEXT;
        expect(await rootNode.getChildren()).toHaveLength(0);
        rootNode.contextValue = globals.DS_MEMBER_CONTEXT;
        expect(await rootNode.getChildren()).toHaveLength(0);
        rootNode.contextValue = globals.INFORMATION_CONTEXT;
        expect(await rootNode.getChildren()).toHaveLength(0);
    });
    /*************************************************************************************************************
     * Tests that we shouldn't be updating children
     *************************************************************************************************************/
    it("Tests that we shouldn't be updating children", async () => {
        // Creating a rootNode
        const rootNode = new ZoweDatasetNode({
            label: "root",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session,
            profile: profileOne,
        });
        rootNode.children = [
            new ZoweDatasetNode({ label: "onestep", collapsibleState: vscode.TreeItemCollapsibleState.Collapsed, session, profile: profileOne }),
        ];
        rootNode.dirty = false;
        rootNode.contextValue = globals.DS_PDS_CONTEXT;
        expect((await rootNode.getChildren())[0].label).toEqual("onestep");
    });

    /*************************************************************************************************************
     * Multiple member names returned
     *************************************************************************************************************/
    it("Testing what happens when response has multiple members", async () => {
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    loadNamedProfile: jest.fn().mockReturnValue(profileOne),
                };
            }),
        });
        const sessionNode = {
            encodingMap: {},
            getSessionNode: jest.fn(),
            sort: { method: DatasetSortOpts.Name, direction: SortDirection.Ascending },
        } as unknown as ZoweDatasetNode;
        const getSessionNodeSpy = jest.spyOn(ZoweDatasetNode.prototype, "getSessionNode").mockReturnValue(sessionNode);
        // Creating a rootNode
        const pds = new ZoweDatasetNode({
            label: "[root]: something",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: sessionNode,
            session,
            profile: profileOne,
            contextOverride: globals.DS_PDS_CONTEXT,
        });
        pds.dirty = true;
        const allMembers = jest.fn();
        allMembers.mockImplementationOnce(() => {
            return {
                success: true,
                apiResponse: {
                    items: [{ member: "MEMBER1" }],
                    returnedRows: 3,
                },
            };
        });
        Object.defineProperty(List, "allMembers", { value: allMembers });
        const pdsChildren = await pds.getChildren();
        expect(pdsChildren[0].label).toEqual("MEMBER1");
        expect(pdsChildren[0].contextValue).toEqual(globals.DS_MEMBER_CONTEXT);
        expect(pdsChildren[1].label).toEqual("2 members with errors");
        expect(pdsChildren[1].contextValue).toEqual(globals.DS_FILE_ERROR_MEMBER_CONTEXT);
        getSessionNodeSpy.mockRestore();
    });
    it("Testing what happens when response has multiple members and member pattern is set", async () => {
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    loadNamedProfile: jest.fn().mockReturnValue(profileOne),
                };
            }),
        });
        const sessionNode = {
            encodingMap: {},
            getSessionNode: jest.fn(),
            sort: { method: DatasetSortOpts.Name, direction: SortDirection.Ascending },
        } as unknown as ZoweDatasetNode;
        const getSessionNodeSpy = jest.spyOn(ZoweDatasetNode.prototype, "getSessionNode").mockReturnValue(sessionNode);
        // Creating a rootNode
        const pds = new ZoweDatasetNode({
            label: "[root]: something",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: sessionNode,
            session,
            profile: profileOne,
            contextOverride: globals.DS_PDS_CONTEXT,
        });
        pds.dirty = true;
        pds.memberPattern = "MEM*";
        const allMembers = jest.fn();
        allMembers.mockImplementationOnce(() => {
            return {
                success: true,
                apiResponse: {
                    items: [{ member: "MEMBER1" }],
                    returnedRows: 1,
                },
            };
        });
        Object.defineProperty(List, "allMembers", { value: allMembers });
        const pdsChildren = await pds.getChildren();
        expect(pdsChildren[0].label).toEqual("MEMBER1");
        expect(pdsChildren[0].contextValue).toEqual(globals.DS_MEMBER_CONTEXT);
        expect(allMembers).toHaveBeenCalledWith(expect.any(imperative.Session), pds.label, expect.objectContaining({ pattern: pds.memberPattern }));
        getSessionNodeSpy.mockRestore();
    });

    /*************************************************************************************************************
     * No values returned
     *************************************************************************************************************/
    it("Testing what happens when response has no members", async () => {
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    loadNamedProfile: jest.fn().mockReturnValue(profileOne),
                };
            }),
        });
        // Creating a rootNode
        const pds = new ZoweDatasetNode({
            label: "[root]: something",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session,
            profile: profileOne,
        });
        pds.dirty = true;
        pds.contextValue = globals.DS_PDS_CONTEXT;
        const allMembers = jest.fn();
        allMembers.mockImplementationOnce(() => {
            return {
                success: true,
                apiResponse: {
                    items: [],
                },
            };
        });
        Object.defineProperty(List, "allMembers", { value: allMembers });
        expect((await pds.getChildren())[0].label).toEqual("No data sets found");
    });
});

describe("ZoweDatasetNode Unit Tests - Function node.openDs()", () => {
    function createBlockMocks() {
        const session = createISession();
        const sessionWithoutCredentials = createISessionWithoutCredentials();
        const imperativeProfile = createIProfile();
        const profileInstance = createInstanceOfProfile(imperativeProfile);
        const zosmfSession = createSessCfgFromArgs(imperativeProfile);
        const treeView = createTreeView();
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const testDatasetTree = createDatasetTree(datasetSessionNode, treeView);
        const mvsApi = createMvsApi(imperativeProfile);
        bindMvsApi(mvsApi);

        return {
            session,
            sessionWithoutCredentials,
            zosmfSession,
            treeView,
            imperativeProfile,
            datasetSessionNode,
            mvsApi,
            profileInstance,
            testDatasetTree,
        };
    }

    it("Checking of opening for common dataset", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(blockMocks.mvsApi.getContents).mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                etag: "123",
            },
        });
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode({
            label: "node",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });

        await node.openDs(false, true, blockMocks.testDatasetTree);

        expect(mocked(fs.existsSync)).toBeCalledWith(path.join(globals.DS_DIR, node.getSessionNode().label.toString(), node.label.toString()));
        expect(mocked(vscode.workspace.openTextDocument)).toBeCalledWith(sharedUtils.getDocumentFilePath(node.label.toString(), node));
    });

    it("Checking of opening for common dataset with unverified profile", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const profile = blockMocks.imperativeProfile;

        mocked(blockMocks.mvsApi.getContents).mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                etag: "123",
            },
        });
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    validProfile: ValidProfileEnum.UNVERIFIED,
                    loadNamedProfile: jest.fn().mockReturnValue(profile),
                };
            }),
        });
        const node = new ZoweDatasetNode({
            label: "node",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        await node.openDs(false, true, blockMocks.testDatasetTree);

        expect(mocked(fs.existsSync)).toBeCalledWith(path.join(globals.DS_DIR, node.getSessionNode().label.toString(), node.label.toString()));
        expect(mocked(vscode.workspace.openTextDocument)).toBeCalledWith(sharedUtils.getDocumentFilePath(node.label.toString(), node));
    });

    it("Checking of opening for common dataset without supporting ongoing actions", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(blockMocks.mvsApi.getContents).mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                etag: "123",
            },
        });
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode({
            label: "node",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        node.ongoingActions = undefined as any;

        await node.openDs(false, true, blockMocks.testDatasetTree);

        expect(mocked(fs.existsSync)).toBeCalledWith(path.join(globals.DS_DIR, node.getSessionNode().label.toString(), node.label.toString()));
        expect(mocked(vscode.workspace.openTextDocument)).toBeCalledWith(sharedUtils.getDocumentFilePath(node.label.toString(), node));
    });

    it("Checking of failed attempt to open dataset", async () => {
        globals.defineGlobals("");
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks();
        globalMocks.getContentsSpy.mockRejectedValueOnce(new Error("testError"));
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode({
            label: "node",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });

        try {
            await node.openDs(false, true, blockMocks.testDatasetTree);
        } catch (err) {
            // do nothing
        }

        expect(mocked(Gui.errorMessage)).toBeCalledWith("Error: testError");
    });

    it("Check for invalid/null response when contents are already fetched", async () => {
        globals.defineGlobals("");
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks();
        globalMocks.getContentsSpy.mockClear();
        mocked(fs.existsSync).mockReturnValueOnce(true);
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode({
            label: "node",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
            etag: "abc",
        });
        node.ongoingActions = undefined as any;

        await node.openDs(false, true, blockMocks.testDatasetTree);

        expect(globalMocks.getContentsSpy).not.toHaveBeenCalled();
        expect(node.getEtag()).toBe("abc");
    });

    it("Checking of opening for PDS Member", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(blockMocks.mvsApi.getContents).mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                etag: "123",
            },
        });
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const parent = new ZoweDatasetNode({
            label: "parent",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        parent.contextValue = globals.DS_PDS_CONTEXT;
        const child = new ZoweDatasetNode({ label: "child", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode: parent });
        child.contextValue = globals.DS_MEMBER_CONTEXT;

        await child.openDs(false, true, blockMocks.testDatasetTree);

        expect(mocked(fs.existsSync)).toBeCalledWith(
            path.join(globals.DS_DIR, child.getSessionNode().label.toString(), `${parent.label.toString()}(${child.label.toString()})`)
        );
        expect(mocked(vscode.workspace.openTextDocument)).toBeCalledWith(
            sharedUtils.getDocumentFilePath(`${parent.label.toString()}(${child.label.toString()})`, child)
        );
    });
    it("Checking of opening for PDS Member of favorite dataset", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(blockMocks.mvsApi.getContents).mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                etag: "123",
            },
        });
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const parent = new ZoweDatasetNode({
            label: "parent",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });
        parent.contextValue = globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX;
        const child = new ZoweDatasetNode({ label: "child", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode: parent });
        child.contextValue = globals.DS_MEMBER_CONTEXT;

        await child.openDs(false, true, blockMocks.testDatasetTree);

        expect(mocked(fs.existsSync)).toBeCalledWith(
            path.join(globals.DS_DIR, child.getSessionNode().label.toString(), `${parent.label.toString()}(${child.label.toString()})`)
        );
        expect(mocked(vscode.workspace.openTextDocument)).toBeCalledWith(
            sharedUtils.getDocumentFilePath(`${parent.label.toString()}(${child.label.toString()})`, child)
        );
    });
    it("Checking of opening for sequential DS of favorite session", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(blockMocks.mvsApi.getContents).mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                etag: "123",
            },
        });
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const favProfileNode = new ZoweDatasetNode({
            label: "parent",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            profile: blockMocks.imperativeProfile,
        });
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        const child = new ZoweDatasetNode({ label: "child", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode: favProfileNode });
        child.contextValue = globals.DS_FAV_CONTEXT;

        await child.openDs(false, true, blockMocks.testDatasetTree);

        expect(mocked(fs.existsSync)).toBeCalledWith(path.join(globals.DS_DIR, blockMocks.imperativeProfile.name, child.label.toString()));
        expect(mocked(vscode.workspace.openTextDocument)).toBeCalledWith(sharedUtils.getDocumentFilePath(child.label.toString(), child));
    });
    it("Checks that openDs fails if called from an invalid node", async () => {
        globals.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();

        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const node = new ZoweDatasetNode({
            label: "parent",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
            profile: blockMocks.imperativeProfile,
        });
        blockMocks.datasetSessionNode.contextValue = "aieieiieeeeooooo";

        try {
            await node.openDs(false, true, blockMocks.testDatasetTree);
        } catch (err) {
            // Prevent exception from failing test
        }

        expect(mocked(Gui.errorMessage)).toBeCalledWith("Invalid data set or member.");
    });
    it("Checking that error is displayed and logged for opening of node with invalid context value", async () => {
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        mocked(Profiles.getInstance).mockReturnValue(blockMocks.profileInstance);
        const parentNode = new ZoweDatasetNode({
            label: "badParent",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
            contextOverride: "badContext",
        });
        const node = new ZoweDatasetNode({
            label: "cantOpen",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode,
            session: blockMocks.session,
            profile: blockMocks.imperativeProfile,
            contextOverride: globals.DS_MEMBER_CONTEXT,
        });
        const showErrorMessageSpy = jest.spyOn(Gui, "errorMessage");
        const logErrorSpy = jest.spyOn(ZoweLogger, "error").mockClear();

        try {
            await node.openDs(false, true, blockMocks.testDatasetTree);
        } catch (err) {
            // Do nothing
        }

        expect(showErrorMessageSpy).toBeCalledWith("Invalid data set or member.");
        expect(logErrorSpy).toBeCalledTimes(1);
    });
});

describe("ZoweDatasetNode Unit Tests - Function node.setEncoding()", () => {
    function createBlockMocks() {
        const imperativeProfile = createIProfile();
        const profileInstance = createInstanceOfProfile(imperativeProfile);
        return {
            imperativeProfile,
            profileInstance,
        };
    }
    it("sets encoding to binary", () => {
        const node = new ZoweDatasetNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        node.setEncoding({ kind: "binary" });
        expect(node.binary).toEqual(true);
        expect(node.encoding).toBeUndefined();
    });

    it("sets encoding to text", () => {
        const node = new ZoweDatasetNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        node.setEncoding({ kind: "text" });
        expect(node.binary).toEqual(false);
        expect(node.encoding).toBeNull();
    });

    it("sets encoding to other codepage", () => {
        const node = new ZoweDatasetNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        node.setEncoding({ kind: "other", codepage: "IBM-1047" });
        expect(node.binary).toEqual(false);
        expect(node.encoding).toEqual("IBM-1047");
    });

    it("sets encoding for favorite node", () => {
        const blockMocks = createBlockMocks();
        const parentNode = new ZoweDatasetNode({
            label: "favoriteTest",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            contextOverride: globals.FAV_PROFILE_CONTEXT,
            profile: blockMocks.imperativeProfile,
        });
        const node = new ZoweDatasetNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode });
        node.setEncoding({ kind: "text" });
        expect(node.binary).toEqual(false);
        expect(node.encoding).toBeNull();
    });

    it("resets encoding to undefined", () => {
        const node = new ZoweDatasetNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        node.setEncoding(undefined as any);
        expect(node.binary).toEqual(false);
        expect(node.encoding).toBeUndefined();
    });

    it("fails to set encoding for session node", () => {
        const node = new ZoweDatasetNode({
            label: "sessionTest",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextOverride: globals.DS_SESSION_CONTEXT,
        });
        expect(node.setEncoding.bind(node)).toThrowError("Cannot set encoding for node with context session");
    });
});

describe("ZoweDatasetNode Unit Tests - Function node.setIcon()", () => {
    it("sets icon path and refreshes node", () => {
        const node = new ZoweDatasetNode({ label: "iconTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        const iconTest = { light: "icon0", dark: "icon1" };
        node.setIcon(iconTest);
        expect(node.iconPath).toEqual(iconTest);
        expect(mocked(vscode.commands.executeCommand)).toHaveBeenCalledWith("zowe.ds.refreshDataset", node);
    });
});

describe("ZoweDatasetNode Unit Tests - function datasetRecalled", () => {
    it("changes the collapsible state", async () => {
        const dsNode = new ZoweDatasetNode({
            label: "MIGRATED.PDS",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextOverride: globals.DS_MIGRATED_FILE_CONTEXT,
            profile: createIProfile(),
        });
        await (dsNode as any).datasetRecalled(true);
        expect(dsNode.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);
    });

    it("adds the open command to the node - PS", async () => {
        const dsNode = new ZoweDatasetNode({
            label: "MIGRATED.PS",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextOverride: globals.DS_MIGRATED_FILE_CONTEXT,
            profile: createIProfile(),
        });
        await (dsNode as any).datasetRecalled(false);
        expect(dsNode.command).toStrictEqual({ command: "zowe.ds.ZoweNode.openPS", title: "", arguments: [dsNode] });
    });

    it("updates the icon to folder - PDS", async () => {
        const dsNode = new ZoweDatasetNode({
            label: "MIGRATED.PDS",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextOverride: globals.DS_MIGRATED_FILE_CONTEXT,
            profile: createIProfile(),
        });
        await (dsNode as any).datasetRecalled(true);
        expect(dsNode.iconPath).toBe(getIconById(IconId.folder).path);
    });

    it("updates the icon to file - PS", async () => {
        const dsNode = new ZoweDatasetNode({
            label: "MIGRATED.PS",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextOverride: globals.DS_MIGRATED_FILE_CONTEXT,
            profile: createIProfile(),
        });
        await (dsNode as any).datasetRecalled(false);
        expect(dsNode.iconPath).toBe(getIconById(IconId.document).path);
    });
});

describe("ZoweDatasetNode Unit Tests - function datasetMigrated", () => {
    it("changes the collapsible state", () => {
        const dsNode = new ZoweDatasetNode({
            label: "SOME.PDS",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextOverride: globals.DS_PDS_CONTEXT,
            profile: createIProfile(),
        });
        dsNode.datasetMigrated();
        expect(dsNode.collapsibleState).toBe(vscode.TreeItemCollapsibleState.None);
    });

    it("removes the node command", () => {
        const dsNode = new ZoweDatasetNode({
            label: "SOME.PDS",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextOverride: globals.DS_PDS_CONTEXT,
            parentNode: createDatasetSessionNode(createISession(), createIProfile()),
            profile: createIProfile(),
        });
        dsNode.datasetMigrated();
        expect(dsNode.resourceUri).toBeUndefined();
        expect(dsNode.command).toBeUndefined();
    });

    it("changes the icon to the migrated icon", () => {
        const dsNode = new ZoweDatasetNode({
            label: "MIGRATED.PDS",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextOverride: globals.DS_MIGRATED_FILE_CONTEXT,
            profile: createIProfile(),
        });
        dsNode.datasetMigrated();
        expect(dsNode.iconPath).toBe(getIconById(IconId.migrated).path);
    });
});
