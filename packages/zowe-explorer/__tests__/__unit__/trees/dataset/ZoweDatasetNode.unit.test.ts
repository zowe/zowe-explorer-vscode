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
import * as path from "path";
import * as fs from "fs";
import { Gui, Validation } from "@zowe/zowe-explorer-api";
import {
    createSessCfgFromArgs,
    createInstanceOfProfile,
    createIProfile,
    createISession,
    createISessionWithoutCredentials,
    createTreeView,
} from "../../../__mocks__/mockCreators/shared";
import { createDatasetSessionNode, createDatasetTree } from "../../../__mocks__/mockCreators/datasets";
import { ZoweDatasetNode } from "../../../../src/trees/dataset";
import { bindMvsApi, createMvsApi } from "../../../__mocks__/mockCreators/api";
import { Constants, Profiles } from "../../../../src/configuration";
import { SharedUtils } from "../../../../src/trees/shared";
import { ZoweLogger } from "../../../../src/tools";

// Missing the definition of path module, because I need the original logic for tests
jest.mock("fs");
jest.mock("vscode");

// Idea is borrowed from: https://github.com/kulshekhar/ts-jest/blob/master/src/util/testing.ts
const mocked = <T extends (...args: any[]) => any>(fn: T): jest.Mock<ReturnType<T>> => fn as any;

function createGlobalMocks() {
    Constants.defineGlobals("");

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

    return newMocks;
}

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
        Constants.defineGlobals("");
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

        expect(mocked(fs.existsSync)).toHaveBeenCalledWith(
            path.join(Constants.DS_DIR, node.getSessionNode().label.toString(), node.label.toString())
        );
        expect(mocked(vscode.workspace.openTextDocument)).toHaveBeenCalledWith(SharedUtils.getDocumentFilePath(node.label.toString(), node));
    });

    it("Checking of opening for common dataset with unverified profile", async () => {
        Constants.defineGlobals("");
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

        expect(mocked(fs.existsSync)).toHaveBeenCalledWith(
            path.join(Constants.DS_DIR, node.getSessionNode().label.toString(), node.label.toString())
        );
        expect(mocked(vscode.workspace.openTextDocument)).toHaveBeenCalledWith(SharedUtils.getDocumentFilePath(node.label.toString(), node));
    });

    it("Checking of opening for common dataset without supporting ongoing actions", async () => {
        Constants.defineGlobals("");
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

        expect(mocked(fs.existsSync)).toHaveBeenCalledWith(
            path.join(Constants.DS_DIR, node.getSessionNode().label.toString(), node.label.toString())
        );
        expect(mocked(vscode.workspace.openTextDocument)).toHaveBeenCalledWith(SharedUtils.getDocumentFilePath(node.label.toString(), node));
    });

    it("Checking of failed attempt to open dataset", async () => {
        Constants.defineGlobals("");
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

        expect(mocked(Gui.errorMessage)).toHaveBeenCalledWith("Error: testError");
    });

    it("Check for invalid/null response when contents are already fetched", async () => {
        Constants.defineGlobals("");
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
        Constants.defineGlobals("");
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

        expect(mocked(fs.existsSync)).toHaveBeenCalledWith(
            path.join(Constants.DS_DIR, child.getSessionNode().label.toString(), `${parent.label.toString()}(${child.label.toString()})`)
        );
        expect(mocked(vscode.workspace.openTextDocument)).toHaveBeenCalledWith(
            SharedUtils.getDocumentFilePath(`${parent.label.toString()}(${child.label.toString()})`, child)
        );
    });
    it("Checking of opening for PDS Member of favorite dataset", async () => {
        Constants.defineGlobals("");
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

        expect(mocked(fs.existsSync)).toHaveBeenCalledWith(
            path.join(Constants.DS_DIR, child.getSessionNode().label.toString(), `${parent.label.toString()}(${child.label.toString()})`)
        );
        expect(mocked(vscode.workspace.openTextDocument)).toHaveBeenCalledWith(
            SharedUtils.getDocumentFilePath(`${parent.label.toString()}(${child.label.toString()})`, child)
        );
    });
    it("Checking of opening for sequential DS of favorite session", async () => {
        Constants.defineGlobals("");
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

        expect(mocked(fs.existsSync)).toHaveBeenCalledWith(path.join(Constants.DS_DIR, blockMocks.imperativeProfile.name, child.label.toString()));
        expect(mocked(vscode.workspace.openTextDocument)).toHaveBeenCalledWith(SharedUtils.getDocumentFilePath(child.label.toString(), child));
    });
    it("Checks that openDs fails if called from an invalid node", async () => {
        Constants.defineGlobals("");
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

        expect(mocked(Gui.errorMessage)).toHaveBeenCalledWith("Invalid data set or member.");
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

        expect(showErrorMessageSpy).toHaveBeenCalledWith("Invalid data set or member.");
        expect(logErrorSpy).toHaveBeenCalledTimes(1);
    });
});

describe("ZoweDatasetNode Unit Tests - Function node.downloadDs()", () => {
    function createBlockMocks() {
        const session = createISession();
        const imperativeProfile = createIProfile();
        const profileInstance = createInstanceOfProfile(imperativeProfile);
        const datasetSessionNode = createDatasetSessionNode(session, imperativeProfile);
        const pdsSessionNode = new ZoweDatasetNode({
            label: "sestest",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            parentNode: datasetSessionNode,
            session,
            profile: profileInstance,
        });
        pdsSessionNode.contextValue = Constants.DS_PDS_CONTEXT;

        return {
            imperativeProfile,
            pdsSessionNode,
        };
    }

    it("Testing downloadDs() called with invalid node", async () => {
        Constants.defineGlobals("");
        createGlobalMocks();
        const blockMocks = createBlockMocks();
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.TO.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.pdsSessionNode,
            profile: blockMocks.imperativeProfile,
        });
        blockMocks.pdsSessionNode.contextValue = "fakeContext";

        try {
            await node.downloadDs(true);
        } catch (err) {
            /* Do nothing */
        }

        expect(mocked(Gui.errorMessage)).toHaveBeenCalledWith("Invalid data set or member.");
    });

    it("Testing downloadDs() called with a member", async () => {
        Constants.defineGlobals("");
        const globalMocks = createGlobalMocks();
        const blockMocks = createBlockMocks();
        const node = new ZoweDatasetNode({
            label: "HLQ.TEST.TO.NODE",
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            parentNode: blockMocks.pdsSessionNode,
            profile: blockMocks.imperativeProfile,
        });
        globalMocks.getContentsSpy.mockResolvedValueOnce({
            success: true,
            commandResponse: null,
            apiResponse: {
                etag: "123",
            },
        });

        const label = node.getParent().getLabel().toString() + "(" + node.getLabel().toString() + ")";
        const filePathSpy = jest.spyOn(SharedUtils, "getDocumentFilePath");
        await node.downloadDs(true);
        expect(filePathSpy).toHaveBeenCalledWith(label, node);
    });
});

describe("ZoweDatasetNode Unit Tests - Function node.setEncoding()", () => {
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
        const parentNode = new ZoweDatasetNode({
            label: "favoriteTest",
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            contextOverride: Constants.FAV_PROFILE_CONTEXT,
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
            contextOverride: Constants.DS_SESSION_CONTEXT,
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
