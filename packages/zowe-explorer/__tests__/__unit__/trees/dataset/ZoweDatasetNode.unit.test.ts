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
    BaseProvider,
    DsEntry,
    Gui,
    imperative,
    NavigationTreeItem,
    Paginator,
    PdsEntry,
    Sorting,
    Validation,
    ZoweScheme,
} from "@zowe/zowe-explorer-api";
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
import { SharedTreeProviders } from "../../../../src/trees/shared/SharedTreeProviders";
import { ZoweExplorerApiRegister } from "../../../../src/extending/ZoweExplorerApiRegister";
import { SettingsConfig } from "../../../../src/configuration/SettingsConfig";
import { MockedProperty } from "../../../__mocks__/mockUtils";
import { AuthUtils } from "../../../../src/utils/AuthUtils";

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
        rootNode.children = [infoChild];
        rootNode.dirty = false;
        expect(await rootNode.getChildren()).toEqual([infoChild]);
    });

    /*************************************************************************************************************
     * Checks that passing a session node with no hlq ignores the getChildren() method
     *************************************************************************************************************/
    it("Checks that passing a session node with no hlq the getChildren() method is exited early", async () => {
        // Creating a rootNode
        const rootNode = new ZoweDatasetNode({
            label: "profile1",
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
        rootNode.children = [infoChild];
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
        const profInstanceSpy = jest.spyOn(Profiles, "getInstance");
        profInstanceSpy.mockImplementationOnce(() => {
            return {
                loadNamedProfile: jest.fn().mockReturnValue({ ...profileOne, profile: { encoding: "IBM-939" } } as any),
            } as any;
        });
        profInstanceSpy.mockImplementationOnce(() => {
            return {
                loadNamedProfile: jest.fn().mockReturnValue(profileOne as any),
            } as any;
        });
        profInstanceSpy.mockReturnValueOnce(profileOne as any);

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

    /*************************************************************************************************************
     * Checks pagination navigation item descriptions are set correctly
     *************************************************************************************************************/
    it("pagination nav items should have correct descriptions", async () => {
        const profilesMock = jest.spyOn(Profiles, "getInstance").mockReturnValue({
            loadNamedProfile: jest.fn().mockReturnValue(profileOne),
        } as any);
        const sessionNode = createDatasetSessionNode(session, profileOne);
        const pdsNode = new ZoweDatasetNode({
            label: "TEST.PDS.PAGINATED",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: sessionNode,
            session,
            profile: profileOne,
            contextOverride: Constants.DS_PDS_CONTEXT,
        });
        pdsNode.sort = {
            method: Sorting.DatasetSortOpts.Name,
            direction: Sorting.SortDirection.Ascending,
        };
        pdsNode.dirty = true;

        const totalItems = 10;
        const itemsPerPage = 5;
        const pageCount = Math.ceil(totalItems / itemsPerPage);
        const paginatorFetchFn = jest
            .fn()
            .mockResolvedValueOnce({
                items: Array.from({ length: itemsPerPage }, (_, i) => ({ member: `MEMBER${i + 1}` })),
                totalItems,
                nextPageCursor: "MEMBER5",
            })
            .mockResolvedValueOnce({
                items: Array.from({ length: itemsPerPage }, (_, i) => ({ member: `MEMBER${i + 6}` })),
                totalItems,
            });
        const mockPaginator = new Paginator<Partial<zosfiles.IZosmfListResponse>>(itemsPerPage, paginatorFetchFn);
        await mockPaginator.initialize();

        (pdsNode as any).paginator = mockPaginator as any; // Assign mock paginator
        (pdsNode as any).paginatorData = { totalItems }; // Ensure totalItems is set

        const getDatasetsSpy = jest.spyOn(pdsNode as any, "getDatasets").mockResolvedValue([
            {
                success: true,
                apiResponse: {
                    // Simulate items for page 2
                    items: [{ member: "MEMBER6" }, { member: "MEMBER7" }, { member: "MEMBER8" }, { member: "MEMBER9" }, { member: "MEMBER10" }],
                },
            },
        ]);

        let children = await pdsNode.getChildren(true); // Request pagination

        expect(children.length).toBe(itemsPerPage + 2); // 5 members + 2 navigation items

        let prevPageItem = children[0] as unknown as NavigationTreeItem;
        let nextPageItem = children[children.length - 1] as unknown as NavigationTreeItem;

        expect(prevPageItem).toBeInstanceOf(NavigationTreeItem);
        expect(nextPageItem).toBeInstanceOf(NavigationTreeItem);
        expect(prevPageItem.label).toBe("Previous page");
        expect(nextPageItem.label).toBe("Next page");

        // Check descriptions for current page
        // Current page index is 0 (page 1), total pages 2
        expect(mockPaginator.canGoPrevious()).toBe(false);
        expect(mockPaginator.canGoNext()).toBe(true);
        expect(prevPageItem.disabled).toBe(true);
        expect(prevPageItem.description).toBeUndefined();

        expect(nextPageItem.disabled).toBe(false);
        expect(nextPageItem.description).toBe(`2/${pageCount}`);

        // --- Test case for being on page 2 ---
        await mockPaginator.fetchNextPage();
        children = await pdsNode.getChildren(true);

        expect(children.length).toBe(itemsPerPage + 2); // 5 members + 2 navigation items

        prevPageItem = children[0] as unknown as NavigationTreeItem;
        nextPageItem = children[children.length - 1] as unknown as NavigationTreeItem;

        expect(prevPageItem).toBeInstanceOf(NavigationTreeItem);
        expect(nextPageItem).toBeInstanceOf(NavigationTreeItem);

        // Check descriptions for Page 2
        expect(mockPaginator.canGoPrevious()).toBe(true);
        expect(mockPaginator.canGoNext()).toBe(false);
        expect(prevPageItem.disabled).toBe(false);
        expect(prevPageItem.description).toBe(`1/${pageCount}`);

        expect(nextPageItem.disabled).toBe(true);
        expect(nextPageItem.description).toBeUndefined();

        getDatasetsSpy.mockRestore();
        profilesMock.mockRestore();
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

    it("fails to set encoding for session node", async () => {
        const globalMocks = await createGlobalMocks();
        const node = new ZoweDatasetNode({
            label: "sessionTest",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextOverride: Constants.DS_SESSION_CONTEXT,
            profile: globalMocks.imperativeProfile,
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
});

describe("ZoweDatasetNode Unit Tests - Function node.updateStats", () => {
    it("updates stats when m4date is present in the object", () => {
        const dsEntry = new DsEntry("TEST.DS", false);
        const lookupMock = jest.spyOn(DatasetFSProvider.instance, "lookup").mockReturnValueOnce(dsEntry);
        const createDirMock = jest.spyOn(DatasetFSProvider.instance, "createDirectory").mockImplementation();
        const node = new ZoweDatasetNode({ label: "statsTest", collapsibleState: vscode.TreeItemCollapsibleState.None });

        // Create mock item with m4date, c4date, mtime, msec, and user properties
        const mockItem = {
            c4date: "2024-01-15",
            m4date: "2024-02-20",
            mtime: "14:30",
            msec: "45",
            user: "testuser",
            dsorg: "PO",
            lrecl: 80,
            recfm: "FB",
            vols: ["VOL001"],
        };

        // Call updateStats with the mock item
        node.updateStats(mockItem);

        // Verify setStats was called internally and that the stats were set correctly
        expect(lookupMock).toHaveBeenCalled();
        expect(dsEntry.stats).toBeDefined();
        expect(dsEntry.stats.user).toBe("testuser");
        expect(dsEntry.stats.dsorg).toBe("PO");
        expect(dsEntry.stats.lrecl).toBe(80);
        expect(dsEntry.stats.recfm).toBe("FB");
        expect(dsEntry.stats.vols).toEqual(["VOL001"]);

        lookupMock.mockRestore();
        createDirMock.mockRestore();
    });

    it("updates stats when FTP properties (id, changed) are present in the object", () => {
        const dsEntry = new DsEntry("TEST.DS", false);
        const lookupMock = jest.spyOn(DatasetFSProvider.instance, "lookup").mockReturnValueOnce(dsEntry);
        const createDirMock = jest.spyOn(DatasetFSProvider.instance, "createDirectory").mockImplementation();
        const node = new ZoweDatasetNode({ label: "statsTest", collapsibleState: vscode.TreeItemCollapsibleState.None });

        // Create mock item with FTP properties
        const mockItem = {
            id: "ftpuser",
            c4date: "2024-01-15T10:30:00Z",
            m4date: "2024-02-20T14:30:45Z",
            dsorg: "PS",
            lrecl: 133,
            recfm: "VB",
            vol: "VOL002",
        };

        // Call updateStats with the mock item
        node.updateStats(mockItem);

        // Verify setStats was called internally and that the stats were set correctly
        expect(lookupMock).toHaveBeenCalled();
        expect(dsEntry.stats).toBeDefined();
        expect(dsEntry.stats.user).toBe("ftpuser");
        expect(dsEntry.stats.createdDate).toEqual(new Date("2024-01-15T10:30:00Z"));
        expect(dsEntry.stats.modifiedDate).toEqual(new Date("2024-02-20T14:30:45Z"));
        expect(dsEntry.stats.dsorg).toBe("PS");
        expect(dsEntry.stats.lrecl).toBe(133);
        expect(dsEntry.stats.recfm).toBe("VB");
        expect(dsEntry.stats.vol).toBe("VOL002");

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

describe("ZoweDatasetNode Unit Tests - getChildren() misc scenarios", () => {
    const session = createISession();
    const profileOne: imperative.IProfileLoaded = createIProfile();

    beforeEach(() => {
        jest.resetAllMocks();
    });

    describe("migration/recall", () => {
        it("should handle a dataset that was migrated", async () => {
            const sessionNode = new ZoweDatasetNode({
                label: "sestest",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                session,
                profile: profileOne,
                contextOverride: Constants.DS_SESSION_CONTEXT,
            });

            const pdsNode = new ZoweDatasetNode({
                label: "TEST.PDS",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                parentNode: sessionNode,
                profile: profileOne,
                contextOverride: Constants.DS_PDS_CONTEXT,
            });

            sessionNode.pattern = "TEST.*";
            sessionNode.children = [pdsNode];

            jest.spyOn(SharedTreeProviders, "ds", "get").mockReturnValueOnce({
                applyPatternsToChildren: jest.fn(),
                resetFilterForChildren: jest.fn(),
            } as any);
            jest.spyOn(Profiles, "getInstance").mockReturnValueOnce({
                loadNamedProfile: jest.fn().mockReturnValueOnce(profileOne),
            } as any);
            jest.spyOn(sessionNode as any, "getDatasets").mockResolvedValueOnce([
                {
                    success: true,
                    apiResponse: {
                        items: [
                            {
                                dsname: "TEST.PDS",
                                migr: "YES",
                                dsorg: "PO",
                            },
                        ],
                    },
                },
            ]);

            await sessionNode.getChildren();

            expect(pdsNode.contextValue).toBe(Constants.DS_MIGRATED_FILE_CONTEXT);
            expect(pdsNode.collapsibleState).toBe(vscode.TreeItemCollapsibleState.None);
            expect(pdsNode.resourceUri).toBeUndefined();
            expect(pdsNode.command).toBeUndefined();
        });

        it("should handle a PS that was recalled", async () => {
            const sessionNode = new ZoweDatasetNode({
                label: "sestest",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                session,
                profile: profileOne,
                contextOverride: Constants.DS_SESSION_CONTEXT,
            });

            const dsNode = new ZoweDatasetNode({
                label: "TEST.DS",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                parentNode: sessionNode,
                profile: profileOne,
                contextOverride: Constants.DS_MIGRATED_FILE_CONTEXT,
            });

            sessionNode.pattern = "TEST.*";
            sessionNode.children = [dsNode];

            jest.spyOn(SharedTreeProviders, "ds", "get").mockReturnValueOnce({
                applyPatternsToChildren: jest.fn(),
                resetFilterForChildren: jest.fn(),
            } as any);
            jest.spyOn(Profiles, "getInstance").mockReturnValueOnce({
                loadNamedProfile: jest.fn().mockReturnValueOnce(profileOne),
            } as any);
            jest.spyOn(sessionNode as any, "getDatasets").mockResolvedValueOnce([
                {
                    success: true,
                    apiResponse: {
                        items: [
                            {
                                dsname: "TEST.DS",
                                migr: "NO",
                                dsorg: "PS",
                            },
                        ],
                    },
                },
            ]);

            await sessionNode.getChildren();

            expect(dsNode.contextValue).toBe(Constants.DS_DS_CONTEXT);
            expect(dsNode.collapsibleState).toBe(vscode.TreeItemCollapsibleState.None);
            expect(dsNode.resourceUri).toBeDefined();
            expect(dsNode.resourceUri.path).toBe("/sestest/TEST.DS");
            expect(dsNode.command).toBeDefined();
        });

        it("should handle a PDS that was recalled", async () => {
            const sessionNode = new ZoweDatasetNode({
                label: "sestest",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                session,
                profile: profileOne,
                contextOverride: Constants.DS_SESSION_CONTEXT,
            });

            const pdsNode = new ZoweDatasetNode({
                label: "TEST.PDS",
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                parentNode: sessionNode,
                profile: profileOne,
                contextOverride: Constants.DS_MIGRATED_FILE_CONTEXT,
            });

            sessionNode.pattern = "TEST.*";
            sessionNode.children = [pdsNode];

            jest.spyOn(SharedTreeProviders, "ds", "get").mockReturnValueOnce({
                applyPatternsToChildren: jest.fn(),
                resetFilterForChildren: jest.fn(),
            } as any);
            jest.spyOn(Profiles, "getInstance").mockReturnValueOnce({
                loadNamedProfile: jest.fn().mockReturnValueOnce(profileOne),
            } as any);
            jest.spyOn(sessionNode as any, "getDatasets").mockResolvedValueOnce([
                {
                    success: true,
                    apiResponse: {
                        items: [
                            {
                                dsname: "TEST.PDS",
                                migr: "NO",
                                dsorg: "PO",
                            },
                        ],
                    },
                },
            ]);

            await sessionNode.getChildren();

            expect(pdsNode.contextValue).toBe(Constants.DS_PDS_CONTEXT);
            expect(pdsNode.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);
            expect(pdsNode.resourceUri).toBeDefined();
            expect(pdsNode.resourceUri.path).toBe("/sestest/TEST.PDS");
        });
    });

    describe("pagination", () => {
        it("returns children wrapped in navigation controls - session node", async () => {
            const sessionNode = new ZoweDatasetNode({
                label: "sestest",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                session,
                profile: profileOne,
                contextOverride: Constants.DS_SESSION_CONTEXT,
            });
            sessionNode.pattern = "PDS.*";
            (sessionNode as any).paginator = new Paginator(2, jest.fn());
            (sessionNode as any).paginatorData = {
                lastItemName: "PDS.EXAMPLE2",
                totalItems: 4,
            };
            jest.spyOn((sessionNode as any).paginator, "canGoNext").mockReturnValueOnce(true);
            jest.spyOn(SharedTreeProviders, "ds", "get").mockReturnValueOnce({
                applyPatternsToChildren: jest.fn(),
                resetFilterForChildren: jest.fn(),
            } as any);
            jest.spyOn(Profiles, "getInstance").mockReturnValueOnce({
                loadNamedProfile: jest.fn().mockReturnValueOnce(profileOne),
            } as any);
            const getDatasetsSpy = jest.spyOn(sessionNode as any, "getDatasets").mockResolvedValueOnce([
                {
                    success: true,
                    apiResponse: {
                        items: [
                            {
                                dsname: "PDS.EXAMPLE1",
                                migr: "NO",
                                dsorg: "PO",
                            },
                            {
                                dsname: "PDS.EXAMPLE2",
                                migr: "NO",
                                dsorg: "PO",
                            },
                        ],
                        returnedRows: 2,
                    },
                    commandResponse: "2 data set(s) returned successfully",
                },
            ]);

            const children = await sessionNode.getChildren(true);
            expect(getDatasetsSpy).toHaveBeenCalledTimes(1);
            expect(getDatasetsSpy).toHaveBeenCalledWith(profileOne, true);
            expect(children[0]).toBeInstanceOf(NavigationTreeItem);
            expect(children[0].label).toBe("Previous page");
            expect(children.at(-1)).toBeInstanceOf(NavigationTreeItem);
            expect(children.at(-1)?.label).toBe("Next page");
            children.slice(1, -1).forEach((child) => expect(child).toBeInstanceOf(ZoweDatasetNode));
        });
    });

    it("calls error handling when list response is unsuccessful", async () => {
        const errorHandlingMock = new MockedProperty(AuthUtils, "errorHandling");
        const mockProfilesInstance = jest.spyOn(Profiles, "getInstance").mockReturnValue({
            loadNamedProfile: jest.fn().mockReturnValue(profileOne),
        } as any);

        const sessionNode = new ZoweDatasetNode({
            label: "sestest",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session,
            profile: profileOne,
            contextOverride: Constants.DS_SESSION_CONTEXT,
        });
        sessionNode.pattern = "PDS.*";
        jest.spyOn(sessionNode as any, "getDatasets").mockResolvedValueOnce([
            {
                success: false,
                commandResponse: null,
                apiResponse: "Error: test error",
            },
        ]);

        expect(await sessionNode.getChildren()).toStrictEqual([]);
        expect(errorHandlingMock.mock).toHaveBeenCalled();
        mockProfilesInstance.mockRestore();
        errorHandlingMock[Symbol.dispose]();
    });
});

describe("ZoweDatasetNode Unit Tests - getDatasets()", () => {
    it("returns undefined from listDatasets() when session is invalid - profile node", async () => {
        const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValueOnce({
            getSession: jest.fn().mockReturnValue(undefined),
        } as any);
        const warnLoggerSpy = jest.spyOn(ZoweLogger, "warn");
        const dsTreeMock = jest.spyOn(SharedTreeProviders, "ds", "get").mockReturnValue({
            extractPatterns: jest.fn().mockReturnValue([]),
            buildFinalPattern: jest.fn().mockReturnValue(""),
        } as any);
        const profile = createIProfile();
        const sessionNode = createDatasetSessionNode(createISession(), profile);
        sessionNode.pattern = "A.B.*";
        const listDatasetsSpy = jest.spyOn(sessionNode as any, "listDatasets");
        await (sessionNode as any).getDatasets(profile);
        expect(warnLoggerSpy).toHaveBeenCalledTimes(1);
        expect(warnLoggerSpy).toHaveBeenCalledWith("[ZoweDatasetNode.listDatasets] Session undefined for profile sestest");
        expect(listDatasetsSpy).toHaveBeenCalledTimes(1);
        expect(listDatasetsSpy).toHaveBeenCalledWith([], { attributes: true, profile });
        expect(listDatasetsSpy).toHaveReturnedWith(Promise.resolve(undefined));
        mvsApiMock.mockRestore();
        dsTreeMock.mockRestore();
    });

    it("returns undefined from listDatasets() when session is invalid - PDS node", async () => {
        const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValueOnce({
            getSession: jest.fn().mockReturnValue(undefined),
        } as any);
        const warnLoggerSpy = jest.spyOn(ZoweLogger, "warn").mockClear();
        const dsTreeMock = jest.spyOn(SharedTreeProviders, "ds", "get").mockReturnValue({
            extractPatterns: jest.fn().mockReturnValue([]),
            buildFinalPattern: jest.fn().mockReturnValue(""),
        } as any);
        const profile = createIProfile();
        const sessionNode = createDatasetSessionNode(createISession(), profile);
        sessionNode.pattern = "PDS.*";
        const pdsNode = new ZoweDatasetNode({
            label: "PDS.EXAMPLE",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            contextOverride: Constants.DS_PDS_CONTEXT,
            parentNode: sessionNode,
        });
        sessionNode.pattern = "A.B.*";
        const listMembersSpy = jest.spyOn(pdsNode as any, "listMembers");
        await (pdsNode as any).getDatasets(profile);
        expect(warnLoggerSpy).toHaveBeenCalledTimes(1);
        expect(warnLoggerSpy).toHaveBeenCalledWith("[ZoweDatasetNode.listMembers] Session undefined for profile sestest");
        expect(listMembersSpy).toHaveBeenCalledTimes(1);
        expect(listMembersSpy).toHaveBeenCalledWith([], { attributes: true, profile });
        expect(listMembersSpy).toHaveReturnedWith(Promise.resolve(undefined));
        mvsApiMock.mockRestore();
        dsTreeMock.mockRestore();
    });

    it("calls mvsApi.dataSet when dataSetsMatchingPattern API is not available", async () => {
        const dataSet = jest.fn();
        const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValueOnce({
            getSession: jest.fn().mockReturnValue(createISession()),
            dataSet,
        } as any);
        const dsTreeMock = jest.spyOn(SharedTreeProviders, "ds", "get").mockReturnValue({
            extractPatterns: jest.fn().mockReturnValue([]),
            buildFinalPattern: jest.fn().mockReturnValue(""),
        } as any);
        const profile = createIProfile();
        const sessionNode = createDatasetSessionNode(createISession(), profile);
        sessionNode.pattern = "A.B.*";
        sessionNode.tooltip = "Pattern: A.B.*";
        await expect((sessionNode as any).getDatasets(profile)).resolves.not.toThrow();
        expect(dataSet).toHaveBeenCalledWith("A.B.*", { attributes: true, profile });
        dsTreeMock.mockRestore();
        mvsApiMock.mockRestore();
    });

    it("sorts dataset patterns when pagination is enabled to ensure proper cursor navigation", async () => {
        const pageOne = Array.from({ length: 100 }).map((_, i) => (i < 10 ? `A.${i}` : `B.${i}`));
        const pageTwo = Array.from({ length: 13 }).map((_, i) => (i < 10 ? `B.${i + 100}` : `SYS1.${i - 10}`));
        const allItems = pageOne.concat(pageTwo);

        const dataSetsMatchingPattern = jest
            .fn()
            .mockResolvedValueOnce({
                success: true,
                apiResponse: allItems,
            })
            .mockResolvedValueOnce({
                success: true,
                apiResponse: pageOne.map((dsname) => ({ dsname, dsorg: "PO" })),
            });

        const mvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi").mockReturnValue({
            getSession: jest.fn().mockReturnValue(createISession()),
            dataSetsMatchingPattern,
        } as any);
        const profile = createIProfile();
        const profilesMock = jest.spyOn(Profiles, "getInstance").mockReturnValue(createInstanceOfProfile(profile));
        const sessionNode = createDatasetSessionNode(createISession(), profile);
        sessionNode.dirty = false;
        const dsTree = createDatasetTree(sessionNode, jest.fn());
        const dsTreeMock = jest.spyOn(SharedTreeProviders, "ds", "get").mockReturnValue(dsTree);
        sessionNode.pattern = "B.*,SYS1.*,A.*";
        await expect((sessionNode as any).getDatasets(profile, true)).resolves.not.toThrow();
        // expect full list to be fetched in alphabetical order
        expect(dataSetsMatchingPattern).toHaveBeenCalledWith(["A.*", "B.*", "SYS1.*"], {
            attributes: false,
        });
        // expect second call to fetch first X items
        expect(dataSetsMatchingPattern).toHaveBeenCalledWith(["A.*", "B.*", "SYS1.*"], {
            attributes: true,
            maxLength: 100,
        });
        dsTreeMock.mockRestore();
        mvsApiMock.mockRestore();
        profilesMock.mockRestore();
    });

    it("calls listMembers() - pagination off, node is a PDS", async () => {
        const profile = createIProfile();
        const sessionNode = new ZoweDatasetNode({
            label: "PDS.EXAMPLE",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextOverride: Constants.DS_PDS_CONTEXT,
        });

        const listMembersMock = jest.spyOn(sessionNode as any, "listMembers").mockResolvedValueOnce(undefined);
        await (sessionNode as any).getDatasets(profile);
        expect(listMembersMock).toHaveBeenCalledTimes(1);
        expect(listMembersMock).toHaveBeenCalledWith([], { attributes: true, profile });
    });

    it("calls getCurrentPageItems() - pagination on, node is a PDS", async () => {
        const profile = createIProfile();
        const pdsNode = new ZoweDatasetNode({
            label: "PDS.EXAMPLE",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextOverride: Constants.DS_PDS_CONTEXT,
        });

        const paginatorInitSpy = jest.spyOn(Paginator.prototype, "initialize").mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);

        // two cases where paginator is initialized:
        // case 1: paginator not yet instantiated
        expect((pdsNode as any).paginator).toBeUndefined();
        expect((pdsNode as any).paginatorData).toBeUndefined();
        await (pdsNode as any).getDatasets(profile, true);
        expect((pdsNode as any).paginator).toBeDefined();
        expect(paginatorInitSpy).toHaveBeenCalledTimes(1);

        const ds = [
            {
                success: true,
                apiResponse: {
                    items: [
                        {
                            member: "EX1",
                        },
                        {
                            member: "EX2",
                        },
                    ],
                    returnedRows: 2,
                },
            },
        ];
        const getCurrentPageItemsMock = jest.spyOn(Paginator.prototype, "getCurrentPageItems").mockReturnValueOnce(ds).mockReturnValueOnce(ds);

        // case 2: paginator is defined, but paginator max items has changed
        const getDirectValueMock = jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValueOnce(Constants.DEFAULT_ITEMS_PER_PAGE / 4);
        paginatorInitSpy.mockClear();
        await expect((pdsNode as any).getDatasets(profile, true)).resolves.toStrictEqual(ds);
        // paginator should be re-initialized
        expect(paginatorInitSpy).toHaveBeenCalledTimes(1);
        expect(getCurrentPageItemsMock).toHaveBeenCalledTimes(1);
        getDirectValueMock.mockRestore();
    });
});

describe("ZoweDatasetNode Unit Tests - listDatasetsInRange()", () => {
    it("calls listDatasets to fetch basic list when cached data is null", async () => {
        const sessionNode = new ZoweDatasetNode({
            label: "sestest",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            contextOverride: Constants.DS_SESSION_CONTEXT,
            profile: createIProfile(),
            session: createISession(),
        });
        const listDatasetsMock = jest
            .spyOn(sessionNode, "listDatasets")
            .mockImplementationOnce(async (responses) => {
                responses.push({
                    success: true,
                    apiResponse: {
                        items: [{ dsname: "PDS.EXAMPLE1" }, { dsname: "PDS.EXAMPLE2" }, { dsname: "PDS.EXAMPLE3" }, { dsname: "PDS.EXAMPLE4" }],
                        returnedRows: 4,
                    },
                    commandResponse: "4 data set(s) were listed successfully",
                });
            })
            .mockImplementationOnce(async (responses) => {
                responses.push({
                    success: true,
                    apiResponse: {
                        items: [
                            { dsname: "PDS.EXAMPLE1", dsorg: "PO" },
                            { dsname: "PDS.EXAMPLE2", dsorg: "PO" },
                        ],
                        returnedRows: 2,
                    },
                    commandResponse: "2 data set(s) were listed successfully",
                });
            });

        await (sessionNode as any).listDatasetsInRange(undefined, 2);
        expect(listDatasetsMock).toHaveBeenCalledTimes(2);
        expect(listDatasetsMock.mock.calls[0][1]).toStrictEqual({ attributes: false });
        expect(listDatasetsMock.mock.calls[1][1]).toStrictEqual({ attributes: true, start: undefined, maxLength: 2 });
    });

    it("returns an empty list of items to paginator when an error is encountered", async () => {
        const sessionNode = new ZoweDatasetNode({
            label: "sestest",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            contextOverride: Constants.DS_SESSION_CONTEXT,
            profile: createIProfile(),
            session: createISession(),
        });
        jest.spyOn(sessionNode, "listDatasets").mockImplementationOnce(async () => {
            throw new Error("Simulated error");
        });
        const result = await (sessionNode as any).listDatasetsInRange(undefined, 2);
        expect(result).toStrictEqual({ items: [] });
    });

    it("uses cached data to fetch next page", async () => {
        const sessionNode = new ZoweDatasetNode({
            label: "sestest",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            contextOverride: Constants.DS_SESSION_CONTEXT,
            profile: createIProfile(),
            session: createISession(),
        });
        // session using cached data
        sessionNode.dirty = false;
        (sessionNode as any).paginatorData = {
            totalItems: 4,
            lastItemName: "PDS.EXAMPLE4",
        };
        const actualResponses: zosfiles.IZosFilesResponse[] = [];
        const listDatasetsMock = jest.spyOn(sessionNode, "listDatasets").mockImplementationOnce(async (responses) => {
            const resp = {
                success: true,
                apiResponse: {
                    items: [
                        { dsname: "PDS.EXAMPLE3", dsorg: "PO" },
                        { dsname: "PDS.EXAMPLE4", dsorg: "PO" },
                    ],
                    returnedRows: 2,
                },
                commandResponse: "2 data set(s) were listed successfully",
            };
            responses.push(resp);
            actualResponses.push(resp);
        });

        expect(await (sessionNode as any).listDatasetsInRange("PDS.EXAMPLE2", 2)).toStrictEqual({
            items: actualResponses,
            nextPageCursor: undefined,
            totalItems: 4,
        });
        expect(listDatasetsMock).toHaveBeenCalledTimes(1);
        // maxLength: given limit parameter in listDatasets + 1 to account for filtering the start DS
        expect(listDatasetsMock.mock.calls[0][1]).toStrictEqual({ attributes: true, start: "PDS.EXAMPLE2", maxLength: 3 });
    });
});

describe("ZoweDatasetNode Unit Tests - listMembersInRange()", () => {
    it("calls listMembers to fetch basic list when cached data is null - start param undefined", async () => {
        const pdsNode = new ZoweDatasetNode({
            label: "PDS.EXAMPLE",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            contextOverride: Constants.DS_PDS_CONTEXT,
        });
        const actualResponses: zosfiles.IZosFilesResponse[] = [];
        const listMembersMock = jest
            .spyOn(pdsNode, "listMembers")
            .mockImplementationOnce(async (responses) => {
                responses.push({
                    success: true,
                    apiResponse: {
                        items: [{ member: "EX1" }, { member: "EX2" }, { member: "EX3" }, { member: "EX4" }],
                        returnedRows: 4,
                    },
                    commandResponse: "4 data set(s) were listed successfully",
                });
            })
            .mockImplementationOnce(async (responses) => {
                responses.push({
                    success: true,
                    apiResponse: {
                        items: [
                            { member: "EX1", m4date: new Date() },
                            { member: "EX2", m4date: new Date() },
                        ],
                        returnedRows: 2,
                    },
                    commandResponse: "2 data set(s) were listed successfully",
                });
                actualResponses.push(responses.at(-1)!);
            });
        expect(await (pdsNode as any).listMembersInRange(undefined, 2)).toStrictEqual({
            items: actualResponses,
            nextPageCursor: "EX2",
            totalItems: 4,
        });
        expect(listMembersMock).toHaveBeenCalledTimes(2);
        expect(listMembersMock.mock.calls[0][1]).toStrictEqual({ attributes: false });
        expect(listMembersMock.mock.calls[1][1]).toStrictEqual({ attributes: true, start: undefined, maxLength: 2 });
    });

    it("returns an empty list of items to paginator when an error is encountered", async () => {
        const pdsNode = new ZoweDatasetNode({
            label: "PDS.ERROR",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            contextOverride: Constants.DS_PDS_CONTEXT,
        });
        jest.spyOn(pdsNode, "listMembers").mockImplementationOnce(async () => {
            throw new Error("Simulated error");
        });
        const result = await (pdsNode as any).listMembersInRange(undefined, 2);
        expect(result).toStrictEqual({ items: [] });
    });

    it("uses cached data to fetch next page - start param defined", async () => {
        const pdsNode = new ZoweDatasetNode({
            label: "PDS.EXAMPLE",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            contextOverride: Constants.DS_PDS_CONTEXT,
            profile: createIProfile(),
        });
        // PDS using cached data
        pdsNode.dirty = false;
        (pdsNode as any).paginatorData = {
            totalItems: 4,
            lastItemName: "EX4",
        };
        const actualResponses: zosfiles.IZosFilesResponse[] = [];
        const listMembersMock = jest.spyOn(pdsNode, "listMembers").mockImplementationOnce(async (responses) => {
            const resp = {
                success: true,
                apiResponse: {
                    items: [
                        { member: "EX3", m4date: new Date() },
                        { member: "EX4", m4date: new Date() },
                    ],
                    returnedRows: 2,
                },
                commandResponse: "2 data set(s) were listed successfully",
            };
            responses.push(resp);
            actualResponses.push(resp);
        });

        expect(await (pdsNode as any).listMembersInRange("EX2", 2)).toStrictEqual({
            items: actualResponses,
            nextPageCursor: undefined,
            totalItems: 4,
        });
        expect(listMembersMock).toHaveBeenCalledTimes(1);
        // maxLength: given limit parameter in listMembersInRange + 1 to account for filtering the start member
        expect(listMembersMock.mock.calls[0][1]).toStrictEqual({ attributes: true, start: "EX2", maxLength: 3 });
    });
});
