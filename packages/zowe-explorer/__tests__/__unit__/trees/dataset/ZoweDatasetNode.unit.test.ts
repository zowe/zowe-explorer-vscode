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
import { DsEntry, Gui, PdsEntry, Validation } from "@zowe/zowe-explorer-api";
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

        expect(mocked(Gui.errorMessage)).toHaveBeenCalledWith("Error: testError");
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
    const setEncodingForFileMock = jest.spyOn(DatasetFSProvider.instance, "setEncodingForFile").mockImplementation();

    afterAll(() => {
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
