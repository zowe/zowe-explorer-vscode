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
import * as zosfiles from "@zowe/zos-files-for-zowe-sdk";
import { imperative, Sorting } from "@zowe/zowe-explorer-api";
import { ZoweDatasetNode } from "../../../src/trees/dataset/ZoweDatasetNode";
import { Constants } from "../../../src/configuration/Constants";
import { Profiles } from "../../../src/configuration/Profiles";
import { DatasetFSProvider } from "../../../src/trees/dataset/DatasetFSProvider";

jest.mock("vscode");
jest.mock("@zowe/zos-files-for-zowe-sdk");
jest.mock("Session");

describe("Unit Tests (Jest)", () => {
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
     * Checks that returning an unsuccessful response results in an error being thrown and caught
     *************************************************************************************************************/
    it(
        "Checks that when bright.List.dataSet/allMembers() returns an unsuccessful response, " + "it returns a label of 'No data sets found'",
        async () => {
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
            rootNode.contextValue = Constants.DS_SESSION_CONTEXT;
            rootNode.dirty = true;
            const subNode = new ZoweDatasetNode({
                label: "Response Fail",
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                parentNode: rootNode,
                profile: profileOne,
            });
            jest.spyOn(subNode as any, "getDatasets").mockReturnValueOnce([
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
        }
    );

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
        });
        const infoChild = new ZoweDatasetNode({
            label: "Use the search button to display data sets",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: rootNode,
            profile: profileOne,
            contextOverride: Constants.INFORMATION_CONTEXT,
        });
        infoChild.command = {
            command: "zowe.placeholderCommand",
            title: "Placeholder",
        };
        rootNode.contextValue = Constants.DS_SESSION_CONTEXT;
        rootNode.dirty = false;
        await expect(await rootNode.getChildren()).toEqual([infoChild]);
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
        });
        const infoChild = new ZoweDatasetNode({
            label: "Use the search button to display data sets",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: rootNode,
            profile: profileOne,
            contextOverride: Constants.INFORMATION_CONTEXT,
        });
        infoChild.command = {
            command: "zowe.placeholderCommand",
            title: "Placeholder",
        };
        rootNode.contextValue = Constants.DS_SESSION_CONTEXT;
        await expect(await rootNode.getChildren()).toEqual([infoChild]);
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
        await expect(member.getSession()).toBeDefined();
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

        const sessionNode = {
            encodingMap: {},
            getSessionNode: jest.fn(),
            sort: { method: Sorting.DatasetSortOpts.Name, direction: Sorting.SortDirection.Ascending },
        } as unknown as ZoweDatasetNode;
        const getSessionNodeSpy = jest.spyOn(ZoweDatasetNode.prototype, "getSessionNode").mockReturnValue(sessionNode);
        // Creating a rootNode
        const pds = new ZoweDatasetNode({
            label: "[root]: something",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            parentNode: sessionNode,
            session,
            profile: profileOne,
        });
        pds.dirty = true;
        pds.contextValue = Constants.DS_PDS_CONTEXT;
        const allMembers = jest.fn();
        allMembers.mockImplementationOnce(() => {
            return {
                success: true,
                apiResponse: {
                    items: [{ member: "BADMEM\ufffd" }, { member: "GOODMEM1" }],
                },
            };
        });
        jest.spyOn(DatasetFSProvider.instance, "exists").mockReturnValue(false);
        jest.spyOn(DatasetFSProvider.instance, "writeFile").mockImplementation();
        jest.spyOn(DatasetFSProvider.instance, "createDirectory").mockImplementation();
        Object.defineProperty(zosfiles.List, "allMembers", { value: allMembers });
        const pdsChildren = await pds.getChildren();
        expect(pdsChildren[0].label).toEqual("BADMEM\ufffd");
        expect(pdsChildren[0].contextValue).toEqual(Constants.DS_FILE_ERROR_CONTEXT);
        expect(pdsChildren[1].label).toEqual("GOODMEM1");
        expect(pdsChildren[1].contextValue).toEqual(Constants.DS_MEMBER_CONTEXT);
        getSessionNodeSpy.mockRestore();
        getStatsMock.mockRestore();
    });
});
