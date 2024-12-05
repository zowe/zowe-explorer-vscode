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
import { BaseProvider, DsEntry, Gui, imperative, PdsEntry, Validation, ZoweScheme } from "@zowe/zowe-explorer-api";
import * as zosfiles from "@zowe/zos-files-for-zowe-sdk";
import {
    createSessCfgFromArgs,
    createInstanceOfProfile,
    createIProfile,
    createISession,
    createISessionWithoutCredentials,
    createTreeView,
} from "../../../__mocks__/mockCreators/shared";
import { createDatasetSessionNode, createDatasetTree } from "../../../__mocks__/mockCreators/datasets";
import { bindMvsApi, createMvsApi } from "../../../__mocks__/mockCreators/api";
import * as fs from "fs";
import { Constants } from "../../../../src/configuration/Constants";
import { Profiles } from "../../../../src/configuration/Profiles";
import { ZoweLogger } from "../../../../src/tools/ZoweLogger";
import { DatasetFSProvider } from "../../../../src/trees/dataset/DatasetFSProvider";
import { ZoweDatasetNode } from "../../../../src/trees/dataset/ZoweDatasetNode";
import { IconUtils } from "../../../../src/icons/IconUtils";
import { IconGenerator } from "../../../../src/icons/IconGenerator";

// Missing the definition of path module, because I need the original logic for tests
jest.mock("fs");
jest.mock("vscode");

// Idea is borrowed from: https://github.com/kulshekhar/ts-jest/blob/master/src/util/testing.ts
const mocked = <T extends (...args: any[]) => any>(fn: T): jest.Mock<ReturnType<T>> => fn as any;

function createGlobalMocks() {
    const newMocks = {
        imperativeProfile: createIProfile(),
        profileInstance: null as any as Profiles,
        getContentsSpy: null as any as jest.SpyInstance,
        mvsApi: null as any as ReturnType<typeof createMvsApi>,
        openTextDocument: jest.fn(),
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

    Object.defineProperty(vscode, "ProgressLocation", { value: ProgressLocation });
    Object.defineProperty(vscode.window, "withProgress", { value: withProgress });

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
    it("Testing that the ZoweDatasetNode is defined", () => {
        const testNode = new ZoweDatasetNode({ label: "BRTVS99", collapsibleState: vscode.TreeItemCollapsibleState.None, session });
        testNode.contextValue = Constants.DS_SESSION_CONTEXT;

        expect(testNode.label).toBeDefined();
        expect(testNode.collapsibleState).toBeDefined();
        expect(testNode.label).toBeDefined();
        expect(testNode.getParent()).toBeUndefined();
        expect(testNode.getSession()).toBeDefined();
    });

    /*************************************************************************************************************
     * Creates an ZoweDatasetNode and checks that its members are all initialized by the constructor
     *************************************************************************************************************/
    it("calls setEncoding when constructing a node with encoding", () => {
        jest.spyOn(BaseProvider.prototype, "setEncodingForFile").mockImplementationOnce(() => {});
        const makeEmptyDsWithEncodingMock = jest.spyOn(DatasetFSProvider.instance, "makeEmptyDsWithEncoding").mockImplementationOnce(() => {});
        const setEncodingSpy = jest.spyOn(ZoweDatasetNode.prototype, "setEncoding");
        const testNode = new ZoweDatasetNode({
            label: "BRTVS99",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextOverride: Constants.DS_DS_CONTEXT,
            encoding: { kind: "binary" },
            profile: createIProfile(),
            parentNode: createDatasetSessionNode(createISession(), createIProfile()),
        });

        expect(testNode.label).toBe("BRTVS99");
        expect(testNode.collapsibleState).toBe(vscode.TreeItemCollapsibleState.None);
        expect(setEncodingSpy).toHaveBeenCalled();
        expect(makeEmptyDsWithEncodingMock).toHaveBeenCalled();
        setEncodingSpy.mockRestore();
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
            contextOverride: Constants.DS_SESSION_CONTEXT,
        });
        rootNode.dirty = true;
        const subNode = new ZoweDatasetNode({
            label: "Response Fail",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: rootNode,
            profile: profileOne,
        });
        jest.spyOn(zosfiles.List, "allMembers").mockRejectedValueOnce(new Error(subNode.label as string));
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
            contextOverride: Constants.DS_SESSION_CONTEXT,
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
        // Creating a rootNode
        const rootNode = new ZoweDatasetNode({
            label: "root",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session,
            profile: profileOne,
            contextOverride: Constants.DS_SESSION_CONTEXT,
        });
        const infoChild = new ZoweDatasetNode({
            label: "Use the search button to display data sets",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: rootNode,
            contextOverride: Constants.INFORMATION_CONTEXT,
        });
        rootNode.dirty = false;
        expect(await rootNode.getChildren()).toEqual([infoChild]);
    });

    /*************************************************************************************************************
     * Checks that passing a session node with no hlq ignores the getChildren() method
     *************************************************************************************************************/
    it("Checks that passing a session node with no hlq the getChildren() method is exited early", async () => {
        // Creating a rootNode
        const rootNode = new ZoweDatasetNode({
            label: "root",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session,
            profile: profileOne,
            contextOverride: Constants.DS_SESSION_CONTEXT,
        });
        const infoChild = new ZoweDatasetNode({
            label: "Use the search button to display data sets",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: rootNode,
            contextOverride: Constants.INFORMATION_CONTEXT,
        });
        expect(await rootNode.getChildren()).toEqual([infoChild]);
    });

    /*************************************************************************************************************
     * Checks that when getSession() is called on a memeber it returns the proper session
     *************************************************************************************************************/
    it("Checks that a member can reach its session properly", () => {
        // Creating a rootNode
        const rootNode = new ZoweDatasetNode({
            label: "root",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session,
            profile: profileOne,
        });
        rootNode.contextValue = Constants.DS_SESSION_CONTEXT;
        const subNode = new ZoweDatasetNode({
            label: Constants.DS_PDS_CONTEXT,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: rootNode,
            profile: profileOne,
        });
        const member = new ZoweDatasetNode({
            label: Constants.DS_MEMBER_CONTEXT,
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
        rootNode.contextValue = Constants.DS_DS_CONTEXT;
        expect(await rootNode.getChildren()).toHaveLength(0);
        rootNode.contextValue = Constants.DS_MEMBER_CONTEXT;
        expect(await rootNode.getChildren()).toHaveLength(0);
        rootNode.contextValue = Constants.INFORMATION_CONTEXT;
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
        rootNode.contextValue = Constants.DS_PDS_CONTEXT;
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

        const getStatsMock = jest.spyOn(ZoweDatasetNode.prototype, "getStats").mockImplementation();

        const sessionNode = createDatasetSessionNode(session, profileOne);
        const getSessionNodeSpy = jest.spyOn(ZoweDatasetNode.prototype, "getSessionNode").mockReturnValue(sessionNode);
        // Creating a rootNode
        const pds = new ZoweDatasetNode({
            label: "[root]: something",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: sessionNode,
            session,
            profile: profileOne,
            contextOverride: Constants.DS_PDS_CONTEXT,
        });
        pds.dirty = true;
        const allMembers = jest.fn().mockReturnValueOnce({
            success: true,
            apiResponse: {
                items: [{ member: "MEMBER1" }],
                returnedRows: 3,
            },
        });
        jest.spyOn(DatasetFSProvider.instance, "exists").mockReturnValue(false);
        jest.spyOn(DatasetFSProvider.instance, "writeFile").mockImplementation();
        jest.spyOn(DatasetFSProvider.instance, "createDirectory").mockImplementation();
        Object.defineProperty(zosfiles.List, "allMembers", { value: allMembers });
        const pdsChildren = await pds.getChildren();
        expect(pdsChildren[0].label).toEqual("MEMBER1");
        expect(pdsChildren[0].contextValue).toEqual(Constants.DS_MEMBER_CONTEXT);
        expect(pdsChildren[1].label).toEqual("2 members with errors");
        expect(pdsChildren[1].contextValue).toEqual(Constants.DS_FILE_ERROR_MEMBER_CONTEXT);
        getSessionNodeSpy.mockRestore();
        getStatsMock.mockRestore();
    });
    it("Testing what happens when response has multiple members and member pattern is set", async () => {
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    loadNamedProfile: jest.fn().mockReturnValue(profileOne),
                };
            }),
        });

        const getStatsMock = jest.spyOn(ZoweDatasetNode.prototype, "getStats").mockImplementation();

        const sessionNode = createDatasetSessionNode(session, profileOne);
        const getSessionNodeSpy = jest.spyOn(ZoweDatasetNode.prototype, "getSessionNode").mockReturnValue(sessionNode);
        // Creating a rootNode
        const pds = new ZoweDatasetNode({
            label: "[root]: something",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: sessionNode,
            session,
            profile: profileOne,
            contextOverride: Constants.DS_PDS_CONTEXT,
        });
        pds.dirty = true;
        pds.memberPattern = "MEM*";
        const allMembers = jest.fn().mockReturnValueOnce({
            success: true,
            apiResponse: {
                items: [{ member: "MEMBER1" }],
                returnedRows: 1,
            },
        });
        jest.spyOn(DatasetFSProvider.instance, "exists").mockReturnValue(false);
        jest.spyOn(DatasetFSProvider.instance, "writeFile").mockImplementation();
        jest.spyOn(DatasetFSProvider.instance, "createDirectory").mockImplementation();
        Object.defineProperty(zosfiles.List, "allMembers", { value: allMembers });
        const pdsChildren = await pds.getChildren();
        expect(pdsChildren[0].label).toEqual("MEMBER1");
        expect(pdsChildren[0].contextValue).toEqual(Constants.DS_MEMBER_CONTEXT);
        expect(allMembers).toHaveBeenCalledWith(expect.any(imperative.Session), pds.label, expect.objectContaining({ pattern: pds.memberPattern }));
        getSessionNodeSpy.mockRestore();
        getStatsMock.mockRestore();
    });

    /*************************************************************************************************************
     * Profile properties have changed
     *************************************************************************************************************/
    it("Testing what happens when profile has been updated", async () => {
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    loadNamedProfile: jest.fn().mockReturnValue({ ...profileOne, profile: { encoding: "IBM-939" } }),
                };
            }),
        });

        const sessionNode = createDatasetSessionNode(session, profileOne);
        const pds = new ZoweDatasetNode({
            label: "TEST.PDS",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: sessionNode,
            session,
            profile: profileOne,
        });
        pds.dirty = true;
        pds.contextValue = Constants.DS_PDS_CONTEXT;
        jest.spyOn(pds as any, "getDatasets").mockReturnValueOnce([
            {
                success: true,
                apiResponse: {
                    items: [{ member: "IEFBR14" }],
                },
            },
        ]);
        const pdsChildren = await pds.getChildren();
        expect(pdsChildren[0].label).toEqual("IEFBR14");
        expect(pds.getProfile().profile?.encoding).toBeUndefined();
        expect(pdsChildren[0].getProfile().profile?.encoding).toBe("IBM-939");
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

        expect(mocked(vscode.commands.executeCommand)).toHaveBeenCalledWith("vscode.open", node.resourceUri);
    });

    it("Checking of opening for common dataset with unverified profile", async () => {
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
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    validProfile: Validation.ValidationType.UNVERIFIED,
                };
            }),
        });
        const node = new ZoweDatasetNode({
            label: "node",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.datasetSessionNode,
        });

        await node.openDs(false, true, blockMocks.testDatasetTree);
        expect(mocked(vscode.commands.executeCommand)).toHaveBeenCalledWith("vscode.open", node.resourceUri);
    });

    it("Checking of failed attempt to open dataset", async () => {
        const blockMocks = createBlockMocks();
        mocked(vscode.commands.executeCommand).mockRejectedValueOnce(new Error("testError"));
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

        expect(mocked(Gui.errorMessage)).toHaveBeenCalledWith("testError", { items: ["Show log", "Troubleshoot"] });
    });

    it("Checking of opening for PDS Member", async () => {
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
        parent.contextValue = Constants.DS_PDS_CONTEXT;
        const child = new ZoweDatasetNode({ label: "child", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode: parent });
        child.contextValue = Constants.DS_MEMBER_CONTEXT;

        await child.openDs(false, true, blockMocks.testDatasetTree);

        expect(mocked(vscode.commands.executeCommand)).toHaveBeenCalledWith("vscode.open", child.resourceUri);
    });
    it("Checking of opening for PDS Member of favorite dataset", async () => {
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
        parent.contextValue = Constants.DS_PDS_CONTEXT + Constants.FAV_SUFFIX;
        const child = new ZoweDatasetNode({ label: "child", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode: parent });
        child.contextValue = Constants.DS_MEMBER_CONTEXT;

        await child.openDs(false, true, blockMocks.testDatasetTree);

        expect(mocked(vscode.commands.executeCommand)).toHaveBeenCalledWith("vscode.open", child.resourceUri);
    });
    it("Checking of opening for sequential DS of favorite session", async () => {
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
        favProfileNode.contextValue = Constants.FAV_PROFILE_CONTEXT;
        const child = new ZoweDatasetNode({ label: "child", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode: favProfileNode });
        child.contextValue = Constants.DS_FAV_CONTEXT;

        await child.openDs(false, true, blockMocks.testDatasetTree);

        expect(mocked(vscode.commands.executeCommand)).toHaveBeenCalledWith("vscode.open", child.resourceUri);
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
            contextOverride: Constants.DS_MEMBER_CONTEXT,
        });
        const showErrorMessageSpy = jest.spyOn(Gui, "errorMessage");
        const logErrorSpy = jest.spyOn(ZoweLogger, "error");

        try {
            await node.openDs(false, true, blockMocks.testDatasetTree);
        } catch (err) {
            // Do nothing
        }

        expect(showErrorMessageSpy).toHaveBeenCalledWith("Cannot download, item invalid.");
        expect(logErrorSpy).toHaveBeenCalledTimes(1);
    });
});

describe("ZoweDatasetNode Unit Tests - Function node.setEncoding()", () => {
    let setEncodingForFileMock: jest.SpyInstance;
    let existsMock: jest.SpyInstance;

    beforeAll(() => {
        setEncodingForFileMock = jest.spyOn(DatasetFSProvider.instance, "setEncodingForFile").mockImplementation();
        existsMock = jest.spyOn(DatasetFSProvider.instance, "exists").mockReturnValue(true);
    });

    afterAll(() => {
        existsMock.mockRestore();
        setEncodingForFileMock.mockRestore();
    });

    it("sets encoding to binary", () => {
        const node = new ZoweDatasetNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        node.setEncoding({ kind: "binary" });
        expect(setEncodingForFileMock).toHaveBeenCalledWith(node.resourceUri, { kind: "binary" });
    });

    it("sets encoding to text", () => {
        const node = new ZoweDatasetNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        node.setEncoding({ kind: "text" });
        expect(setEncodingForFileMock).toHaveBeenCalledWith(node.resourceUri, { kind: "text" });
    });

    it("sets encoding to other codepage", () => {
        const node = new ZoweDatasetNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        node.setEncoding({ kind: "other", codepage: "IBM-1047" });
        expect(setEncodingForFileMock).toHaveBeenCalledWith(node.resourceUri, { kind: "other", codepage: "IBM-1047" });
    });

    it("sets encoding for favorite node", () => {
        const parentNode = new ZoweDatasetNode({
            label: "favoriteTest",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            contextOverride: Constants.FAV_PROFILE_CONTEXT,
        });
        const node = new ZoweDatasetNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None, parentNode });
        node.setEncoding({ kind: "text" });
        expect(setEncodingForFileMock).toHaveBeenCalledWith(node.resourceUri, { kind: "text" });
    });

    it("resets encoding to undefined", () => {
        const node = new ZoweDatasetNode({ label: "encodingTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        node.setEncoding(undefined as any);
        expect(setEncodingForFileMock).toHaveBeenCalledWith(node.resourceUri, undefined);
    });

    it("fails to set encoding for session node", () => {
        const node = new ZoweDatasetNode({
            label: "sessionTest",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextOverride: Constants.DS_SESSION_CONTEXT,
        });
        expect(node.setEncoding.bind(node)).toThrow("Cannot set encoding for node with context session");
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

describe("ZoweDatasetNode Unit Tests - Function node.setEtag", () => {
    it("sets the e-tag for a member/PS", () => {
        const dsEntry = new DsEntry("TEST.DS", false);
        const lookupMock = jest.spyOn(DatasetFSProvider.instance, "lookup").mockReturnValueOnce(dsEntry);
        const createDirMock = jest.spyOn(DatasetFSProvider.instance, "createDirectory").mockImplementation();

        const node = new ZoweDatasetNode({ label: "etagTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        node.setEtag("123ETAG");
        expect(lookupMock).toHaveBeenCalled();
        expect(dsEntry.etag).toBe("123ETAG");
        lookupMock.mockRestore();
        createDirMock.mockRestore();
    });

    it("returns early when trying to set the e-tag for a PDS", () => {
        const pdsEntry = new PdsEntry("TEST.PDS");
        const lookupMock = jest.spyOn(DatasetFSProvider.instance, "lookup").mockReturnValueOnce(pdsEntry);
        const createDirMock = jest.spyOn(DatasetFSProvider.instance, "createDirectory").mockImplementation();

        const node = new ZoweDatasetNode({ label: "pds", collapsibleState: vscode.TreeItemCollapsibleState.Collapsed });
        node.setEtag("123ETAG");
        expect(lookupMock).toHaveBeenCalled();
        expect(pdsEntry).not.toHaveProperty("etag");
        lookupMock.mockRestore();
        createDirMock.mockRestore();
    });
});

describe("ZoweDatasetNode Unit Tests - Function node.setStats", () => {
    it("sets the stats for a data set or PDS member", () => {
        const dsEntry = new DsEntry("TEST.DS", false);
        const createdDate = new Date();
        const modifiedDate = new Date();
        dsEntry.stats = { user: "aUser", createdDate, modifiedDate };
        const lookupMock = jest.spyOn(DatasetFSProvider.instance, "lookup").mockReturnValueOnce(dsEntry);
        const createDirMock = jest.spyOn(DatasetFSProvider.instance, "createDirectory").mockImplementation();
        const node = new ZoweDatasetNode({ label: "statsTest", collapsibleState: vscode.TreeItemCollapsibleState.None });
        node.setStats({ user: "bUser" });
        expect(lookupMock).toHaveBeenCalled();
        expect(dsEntry.stats).toStrictEqual({ user: "bUser", createdDate, modifiedDate });
        lookupMock.mockRestore();
        createDirMock.mockRestore();
    });

    it("returns early when trying to set the stats for a PDS", () => {
        const pdsEntry = new PdsEntry("TEST.PDS");
        const lookupMock = jest.spyOn(DatasetFSProvider.instance, "lookup").mockClear().mockReturnValueOnce(pdsEntry);
        const createDirMock = jest.spyOn(DatasetFSProvider.instance, "createDirectory").mockImplementation();

        const node = new ZoweDatasetNode({ label: "pds", collapsibleState: vscode.TreeItemCollapsibleState.Collapsed });
        node.setStats({ user: "bUser" });
        expect(lookupMock).toHaveBeenCalled();
        expect(pdsEntry).not.toHaveProperty("stats");
        lookupMock.mockRestore();
        createDirMock.mockRestore();
    });
});

describe("ZoweDatasetNode Unit Tests - function datasetRecalled", () => {
    it("changes the collapsible state", async () => {
        const dsNode = new ZoweDatasetNode({
            label: "MIGRATED.PDS",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextOverride: Constants.DS_MIGRATED_FILE_CONTEXT,
            profile: createIProfile(),
        });
        await (dsNode as any).datasetRecalled(true);
        expect(dsNode.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);
    });

    it("adds a resource URI", async () => {
        const dsNode = new ZoweDatasetNode({
            label: "MIGRATED.PDS",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextOverride: Constants.DS_MIGRATED_FILE_CONTEXT,
            parentNode: createDatasetSessionNode(createISession(), createIProfile()),
            profile: createIProfile(),
        });
        await (dsNode as any).datasetRecalled(true);
        expect(dsNode.resourceUri).toStrictEqual(
            vscode.Uri.from({
                scheme: ZoweScheme.DS,
                path: "/sestest/MIGRATED.PDS",
            })
        );
    });

    it("adds a command to the node - PS", async () => {
        const dsNode = new ZoweDatasetNode({
            label: "MIGRATED.PS",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextOverride: Constants.DS_MIGRATED_FILE_CONTEXT,
            parentNode: createDatasetSessionNode(createISession(), createIProfile()),
            profile: createIProfile(),
        });
        await (dsNode as any).datasetRecalled(false);
        expect(dsNode.resourceUri).toStrictEqual(
            vscode.Uri.from({
                scheme: ZoweScheme.DS,
                path: "/sestest/MIGRATED.PS",
            })
        );
        expect(dsNode.command).toStrictEqual({ command: "vscode.open", title: "", arguments: [dsNode.resourceUri] });
    });

    it("creates a file system entry - PDS", async () => {
        const dsNode = new ZoweDatasetNode({
            label: "MIGRATED.PDS",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextOverride: Constants.DS_MIGRATED_FILE_CONTEXT,
            profile: createIProfile(),
        });
        const createDirMock = jest.spyOn(vscode.workspace.fs, "createDirectory").mockImplementation();
        await (dsNode as any).datasetRecalled(true);
        expect(createDirMock).toHaveBeenCalledWith(dsNode.resourceUri);
    });

    it("creates a file system entry - PS", async () => {
        const dsNode = new ZoweDatasetNode({
            label: "MIGRATED.PS",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextOverride: Constants.DS_MIGRATED_FILE_CONTEXT,
            parentNode: createDatasetSessionNode(createISession(), createIProfile()),
            profile: createIProfile(),
        });
        const writeFileMock = jest.spyOn(vscode.workspace.fs, "writeFile").mockImplementation();
        await (dsNode as any).datasetRecalled(false);
        expect(writeFileMock).toHaveBeenCalledWith(dsNode.resourceUri, new Uint8Array());
    });

    it("updates the icon to folder - PDS", async () => {
        const dsNode = new ZoweDatasetNode({
            label: "MIGRATED.PDS",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextOverride: Constants.DS_MIGRATED_FILE_CONTEXT,
            profile: createIProfile(),
        });
        await (dsNode as any).datasetRecalled(true);
        expect(dsNode.iconPath).toBe(IconGenerator.getIconById(IconUtils.IconId.folder).path);
    });

    it("updates the icon to file - PS", async () => {
        const dsNode = new ZoweDatasetNode({
            label: "MIGRATED.PS",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextOverride: Constants.DS_MIGRATED_FILE_CONTEXT,
            profile: createIProfile(),
        });
        await (dsNode as any).datasetRecalled(false);
        expect(dsNode.iconPath).toBe(IconGenerator.getIconById(IconUtils.IconId.document).path);
    });
});

describe("ZoweDatasetNode Unit Tests - function datasetMigrated", () => {
    it("changes the collapsible state", () => {
        const dsNode = new ZoweDatasetNode({
            label: "SOME.PDS",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextOverride: Constants.DS_PDS_CONTEXT,
            profile: createIProfile(),
        });
        dsNode.datasetMigrated();
        expect(dsNode.collapsibleState).toBe(vscode.TreeItemCollapsibleState.None);
    });

    it("removes the resource URI and command", () => {
        const dsNode = new ZoweDatasetNode({
            label: "SOME.PDS",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextOverride: Constants.DS_PDS_CONTEXT,
            parentNode: createDatasetSessionNode(createISession(), createIProfile()),
            profile: createIProfile(),
        });
        dsNode.datasetMigrated();
        expect(dsNode.resourceUri).toBeUndefined();
        expect(dsNode.command).toBeUndefined();
    });

    it("removes the file system entry", () => {
        const dsNode = new ZoweDatasetNode({
            label: "MIGRATED.PDS",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextOverride: Constants.DS_MIGRATED_FILE_CONTEXT,
            profile: createIProfile(),
        });
        const uri = dsNode.resourceUri;
        const removeEntryMock = jest.spyOn(DatasetFSProvider.instance, "removeEntry").mockImplementation();
        dsNode.datasetMigrated();
        expect(removeEntryMock).toHaveBeenCalledWith(uri);
    });

    it("changes the icon to the migrated icon", () => {
        const dsNode = new ZoweDatasetNode({
            label: "MIGRATED.PDS",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextOverride: Constants.DS_MIGRATED_FILE_CONTEXT,
            profile: createIProfile(),
        });
        dsNode.datasetMigrated();
        expect(dsNode.iconPath).toBe(IconGenerator.getIconById(IconUtils.IconId.migrated).path);
    });
});
