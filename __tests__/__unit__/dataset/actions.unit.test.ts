import * as vscode from "vscode";
import * as zowe from "@zowe/cli";
import {
    generateBasicZosmfSession, generateInstanceOfProfile,
    generateIProfile,
    generateISession, generateISessionWithoutCredentials, generateTextDocument,
    generateTreeView
} from "../../../__mocks__/generators/shared";
import { generateDatasetSessionNode, generateDatasetTree } from "../../../__mocks__/generators/datasets";
import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";
import { bindMvsApi, generateMvsApi } from "../../../__mocks__/generators/api";
import * as dsActions from "../../../src/dataset/actions";
import * as globals from "../../../src/globals";
import * as path from "path";
import * as fs from "fs";
import * as sharedUtils from "../../../src/shared/utils";
import { Profiles } from "../../../src/Profiles";

Object.defineProperty(vscode.window, "withProgress", { value: jest.fn() });
Object.defineProperty(zowe, "Upload", { value: jest.fn() });
Object.defineProperty(zowe.Upload, "bufferToDataSet", { value: jest.fn() });
Object.defineProperty(zowe.Upload, "pathToDataSet", { value: jest.fn() });
Object.defineProperty(vscode.window, "showErrorMessage", { value: jest.fn() });
Object.defineProperty(vscode.window, "showInformationMessage", { value: jest.fn() });
Object.defineProperty(vscode.window, "showWarningMessage", { value: jest.fn() });
Object.defineProperty(vscode.window, "showInputBox", { value: jest.fn() });
Object.defineProperty(vscode.workspace, "openTextDocument", { value: jest.fn() });
Object.defineProperty(vscode.window, "showTextDocument", { value: jest.fn() });
Object.defineProperty(vscode.window, "showQuickPick", { value: jest.fn() });
Object.defineProperty(vscode.commands, "executeCommand", { value: jest.fn() });
Object.defineProperty(globals, "LOG", { value: jest.fn() });
Object.defineProperty(globals.LOG, "debug", { value: jest.fn() });
Object.defineProperty(globals.LOG, "error", { value: jest.fn() });
Object.defineProperty(zowe, "Download", { value: jest.fn() });
Object.defineProperty(zowe.Download, "dataSet", { value: jest.fn() });
Object.defineProperty(zowe, "Delete", { value: jest.fn() });
Object.defineProperty(zowe.Delete, "dataSet", { value: jest.fn() });
Object.defineProperty(fs, "unlinkSync", { value: jest.fn() });
Object.defineProperty(fs, "existsSync", { value: jest.fn() });
Object.defineProperty(sharedUtils, "concatChildNodes", { value: jest.fn() });
Object.defineProperty(Profiles, "getInstance", { value: jest.fn() });
Object.defineProperty(zowe, "List", { value: jest.fn() });
Object.defineProperty(zowe.List, "dataSet", { value: jest.fn() });
Object.defineProperty(vscode, "ProgressLocation", { value: jest.fn() });

// Idea is borrowed from: https://github.com/kulshekhar/ts-jest/blob/master/src/util/testing.ts
const mocked = (fn: any): jest.Mock => fn;

describe("Add createMember tests", () => {
    function generateEnvironmentalMocks() {
        const session = generateISession();
        const imperativeProfile = generateIProfile();
        const zosmfSession = generateBasicZosmfSession(imperativeProfile);
        const treeView = generateTreeView();
        const datasetSessionNode = generateDatasetSessionNode(session, imperativeProfile);
        const mvsApi = generateMvsApi(imperativeProfile);
        bindMvsApi(mvsApi);

        return {
            session,
            zosmfSession,
            treeView,
            imperativeProfile,
            datasetSessionNode,
            mvsApi,
            testDatasetTree: generateDatasetTree(datasetSessionNode, treeView)
        };
    }

    afterEach(() => jest.clearAllMocks());
    afterAll(() => jest.restoreAllMocks());

    it("Checking of common dataset member creation", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const parent = new ZoweDatasetNode("parent", vscode.TreeItemCollapsibleState.Collapsed,
            environmentalMocks.datasetSessionNode, environmentalMocks.session);

        mocked(vscode.window.showInputBox).mockResolvedValue("testMember");
        mocked(vscode.window.withProgress).mockImplementation((progLocation, callback) => {
            return callback();
        });
        jest.spyOn(environmentalMocks.mvsApi, "getContents").mockResolvedValueOnce({
            success: true,
            commandResponse: null,
            apiResponse: {
                etag: "123"
            }
        });

        await dsActions.createMember(parent, environmentalMocks.testDatasetTree);

        expect(mocked(vscode.window.showInputBox)).toBeCalledWith({ placeHolder: "Name of Member" });
        expect(mocked(zowe.Upload.bufferToDataSet)).toBeCalledWith(
            environmentalMocks.zosmfSession,
            Buffer.from(""),
            parent.label + "(testMember)",
            undefined
        );
    });
    it("Checking failed attempt to create dataset member", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const parent = new ZoweDatasetNode("parent", vscode.TreeItemCollapsibleState.Collapsed,
            environmentalMocks.datasetSessionNode, environmentalMocks.session);

        mocked(vscode.window.showInputBox).mockResolvedValue("testMember");
        mocked(zowe.Upload.bufferToDataSet).mockRejectedValueOnce(Error("test"));

        try {
            await dsActions.createMember(parent, environmentalMocks.testDatasetTree);
            // tslint:disable-next-line:no-empty
        } catch (err) {
        }

        expect(mocked(vscode.window.showErrorMessage)).toBeCalledWith("Unable to create member: test Error: test");
    });
    it("Checking of attempt to create member without name", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const parent = new ZoweDatasetNode("parent", vscode.TreeItemCollapsibleState.Collapsed,
            environmentalMocks.datasetSessionNode, environmentalMocks.session);

        mocked(vscode.window.showInputBox).mockResolvedValue("");
        await dsActions.createMember(parent, environmentalMocks.testDatasetTree);

        expect(mocked(zowe.Upload.bufferToDataSet)).not.toBeCalled();
    });
    it("Checking of member creation for favorite dataset", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const parent = new ZoweDatasetNode("parent", vscode.TreeItemCollapsibleState.Collapsed,
            environmentalMocks.datasetSessionNode, environmentalMocks.session);
        const nonFavoriteLabel = parent.label;
        parent.label = `[${environmentalMocks.datasetSessionNode.label}]: ${parent.label}`;
        parent.contextValue = globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX;

        mocked(vscode.window.showInputBox).mockResolvedValue("testMember");
        mocked(vscode.window.withProgress).mockImplementation((progLocation, callback) => {
            return callback();
        });
        jest.spyOn(environmentalMocks.mvsApi, "getContents").mockResolvedValueOnce({
            success: true,
            commandResponse: null,
            apiResponse: {
                etag: "123"
            }
        });

        await dsActions.createMember(parent, environmentalMocks.testDatasetTree);

        expect(mocked(vscode.window.showInputBox)).toBeCalledWith({ placeHolder: "Name of Member" });
        expect(mocked(zowe.Upload.bufferToDataSet)).toBeCalledWith(
            environmentalMocks.zosmfSession,
            Buffer.from(""),
            nonFavoriteLabel + "(testMember)",
            undefined
        );
    });
});

describe("Add refreshPS tests", () => {
    function generateEnvironmentalMocks() {
        const session = generateISession();
        const imperativeProfile = generateIProfile();
        const zosmfSession = generateBasicZosmfSession(imperativeProfile);
        const treeView = generateTreeView();
        const datasetSessionNode = generateDatasetSessionNode(session, imperativeProfile);
        const mvsApi = generateMvsApi(imperativeProfile);
        bindMvsApi(mvsApi);

        return {
            session,
            zosmfSession,
            treeView,
            imperativeProfile,
            datasetSessionNode,
            mvsApi,
            testDatasetTree: generateDatasetTree(datasetSessionNode, treeView)
        };
    }

    beforeEach(() => globals.defineGlobals(""));
    afterEach(() => jest.clearAllMocks());

    it("Checking common PS dataset refresh", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const node = new ZoweDatasetNode("HLQ.TEST.AFILE7", vscode.TreeItemCollapsibleState.None, environmentalMocks.datasetSessionNode, null);

        mocked(vscode.workspace.openTextDocument).mockResolvedValueOnce({ isDirty: true });
        mocked(zowe.Download.dataSet).mockReturnValueOnce({
            success: true,
            commandResponse: null,
            apiResponse: {
                etag: "123"
            }
        });

        await dsActions.refreshPS(node);

        expect(mocked(zowe.Download.dataSet)).toBeCalledWith(
            environmentalMocks.zosmfSession,
            node.label,
            {
                file: path.join(globals.DS_DIR, node.getSessionNode().label, node.label),
                returnEtag: true
            }
        );
        expect(mocked(vscode.workspace.openTextDocument)).toBeCalledWith(path.join(globals.DS_DIR,
            node.getSessionNode().label, node.label));
        expect(mocked(vscode.window.showTextDocument)).toBeCalledTimes(2);
        expect(mocked(vscode.commands.executeCommand)).toBeCalledWith("workbench.action.closeActiveEditor");
    });
    it("Checking duplicate PS dataset refresh attempt", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const node = new ZoweDatasetNode("HLQ.TEST.AFILE7", vscode.TreeItemCollapsibleState.None, environmentalMocks.datasetSessionNode, null);

        mocked(vscode.workspace.openTextDocument).mockResolvedValueOnce({ isDirty: false });
        mocked(zowe.Download.dataSet).mockReturnValueOnce({
            success: true,
            commandResponse: null,
            apiResponse: {
                etag: "123"
            }
        });

        await dsActions.refreshPS(node);

        expect(mocked(vscode.commands.executeCommand)).not.toBeCalled();
    });
    it("Checking failed attempt to refresh PS dataset (not found exception)", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const node = new ZoweDatasetNode("HLQ.TEST.AFILE7", vscode.TreeItemCollapsibleState.None, environmentalMocks.datasetSessionNode, null);

        mocked(vscode.workspace.openTextDocument).mockResolvedValueOnce({ isDirty: true });
        mocked(zowe.Download.dataSet).mockRejectedValueOnce(Error("not found"));

        await dsActions.refreshPS(node);

        expect(mocked(vscode.window.showInformationMessage)).toBeCalledWith("Unable to find file: " + node.label + " was probably deleted.");
        expect(mocked(vscode.commands.executeCommand)).not.toBeCalled();
    });
    it("Checking failed attempt to refresh PDS Member", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const parent = new ZoweDatasetNode("parent", vscode.TreeItemCollapsibleState.Collapsed, environmentalMocks.datasetSessionNode, null);
        const child = new ZoweDatasetNode("child", vscode.TreeItemCollapsibleState.None, parent, null);

        mocked(vscode.workspace.openTextDocument).mockResolvedValueOnce({ isDirty: true });
        mocked(zowe.Download.dataSet).mockRejectedValueOnce(Error(""));

        await dsActions.refreshPS(child);

        expect(mocked(zowe.Download.dataSet)).toBeCalledWith(
            environmentalMocks.zosmfSession,
            child.getParent().getLabel() + "(" + child.label + ")",
            {
                file: path.join(globals.DS_DIR, child.getSessionNode().label, `${child.getParent().label}(${child.label})`),
                returnEtag: true
            }
        );
        expect(mocked(vscode.window.showErrorMessage)).toBeCalledWith(" Error");
    });
    it("Checking favorite empty PDS refresh", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const node = new ZoweDatasetNode("HLQ.TEST.AFILE7", vscode.TreeItemCollapsibleState.None, environmentalMocks.datasetSessionNode, null);
        node.contextValue = globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX;

        mocked(vscode.workspace.openTextDocument).mockResolvedValueOnce({ isDirty: true });
        mocked(zowe.Download.dataSet).mockReturnValueOnce({
            success: true,
            commandResponse: null,
            apiResponse: {
                etag: "123"
            }
        });

        await dsActions.refreshPS(node);
        expect(mocked(vscode.workspace.openTextDocument)).toBeCalled();
        expect(mocked(vscode.window.showTextDocument)).toBeCalledTimes(2);
        expect(mocked(vscode.commands.executeCommand)).toBeCalledWith("workbench.action.closeActiveEditor");
    });
    it("Checking favorite PDS Member refresh", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const parent = new ZoweDatasetNode("parent", vscode.TreeItemCollapsibleState.Collapsed, environmentalMocks.datasetSessionNode, null);
        const child = new ZoweDatasetNode("child", vscode.TreeItemCollapsibleState.None, parent, null);
        parent.contextValue = globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX;

        mocked(vscode.workspace.openTextDocument).mockResolvedValueOnce({ isDirty: true });
        mocked(zowe.Download.dataSet).mockReturnValueOnce({
            success: true,
            commandResponse: null,
            apiResponse: {
                etag: "123"
            }
        });

        await dsActions.refreshPS(child);
        expect(mocked(vscode.workspace.openTextDocument)).toBeCalled();
        expect(mocked(vscode.window.showTextDocument)).toBeCalledTimes(2);
        expect(mocked(vscode.commands.executeCommand)).toBeCalledWith("workbench.action.closeActiveEditor");
    });
    it("Checking favorite PS refresh", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const parent = new ZoweDatasetNode("parent", vscode.TreeItemCollapsibleState.Collapsed, environmentalMocks.datasetSessionNode, null);
        const child = new ZoweDatasetNode("child", vscode.TreeItemCollapsibleState.None, parent, null);
        parent.contextValue = globals.FAVORITE_CONTEXT;

        mocked(vscode.workspace.openTextDocument).mockResolvedValueOnce({ isDirty: true });
        mocked(zowe.Download.dataSet).mockReturnValueOnce({
            success: true,
            commandResponse: null,
            apiResponse: {
                etag: "123"
            }
        });

        await dsActions.refreshPS(child);
        expect(mocked(vscode.workspace.openTextDocument)).toBeCalled();
        expect(mocked(vscode.window.showTextDocument)).toBeCalledTimes(2);
        expect(mocked(vscode.commands.executeCommand)).toBeCalledWith("workbench.action.closeActiveEditor");
    });
});

describe("Add deleteDataset tests", () => {
    function generateEnvironmentalMocks() {
        const session = generateISession();
        const imperativeProfile = generateIProfile();
        const zosmfSession = generateBasicZosmfSession(imperativeProfile);
        const treeView = generateTreeView();
        const datasetSessionNode = generateDatasetSessionNode(session, imperativeProfile);
        const mvsApi = generateMvsApi(imperativeProfile);
        bindMvsApi(mvsApi);

        return {
            session,
            zosmfSession,
            treeView,
            imperativeProfile,
            datasetSessionNode,
            mvsApi,
            testDatasetTree: generateDatasetTree(datasetSessionNode, treeView)
        };
    }

    beforeEach(() => globals.defineGlobals(""));
    afterEach(() => jest.clearAllMocks());

    it("Checking common PS dataset deletion", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const node = new ZoweDatasetNode("HLQ.TEST.NODE", vscode.TreeItemCollapsibleState.None,
            environmentalMocks.datasetSessionNode, null, undefined, undefined, environmentalMocks.imperativeProfile);

        mocked(fs.existsSync).mockReturnValueOnce(true);
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Yes");
        const deleteSpy = jest.spyOn(environmentalMocks.mvsApi, "deleteDataSet");

        await dsActions.deleteDataset(node, environmentalMocks.testDatasetTree);

        expect(deleteSpy).toBeCalledWith(node.label);
        expect(mocked(fs.existsSync)).toBeCalledWith(path.join(globals.DS_DIR,
            node.getSessionNode().label, node.label));
        expect(mocked(fs.unlinkSync)).toBeCalledWith(path.join(globals.DS_DIR,
            node.getSessionNode().label, node.label));
    });
    it("Checking common PS dataset deletion with not existing local file", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const node = new ZoweDatasetNode("HLQ.TEST.NODE", vscode.TreeItemCollapsibleState.None,
            environmentalMocks.datasetSessionNode, null, undefined, undefined, environmentalMocks.imperativeProfile);

        mocked(fs.existsSync).mockReturnValueOnce(false);
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Yes");
        const deleteSpy = jest.spyOn(environmentalMocks.mvsApi, "deleteDataSet");

        await dsActions.deleteDataset(node, environmentalMocks.testDatasetTree);

        expect(mocked(fs.unlinkSync)).not.toBeCalled();
        expect(deleteSpy).toBeCalledWith(node.label);
    });
    it("Checking common PS dataset failed deletion attempt due to absence on remote", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const node = new ZoweDatasetNode("HLQ.TEST.NODE", vscode.TreeItemCollapsibleState.None,
            environmentalMocks.datasetSessionNode, null, undefined, undefined, environmentalMocks.imperativeProfile);

        mocked(fs.existsSync).mockReturnValueOnce(true);
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Yes");
        const deleteSpy = jest.spyOn(environmentalMocks.mvsApi, "deleteDataSet");
        deleteSpy.mockRejectedValueOnce(Error("not found"));

        await expect(dsActions.deleteDataset(node, environmentalMocks.testDatasetTree)).rejects.toEqual(Error("not found"));

        expect(mocked(vscode.window.showInformationMessage)).toBeCalledWith("Unable to find file: " + node.label + " was probably already deleted.");
    });
    it("Checking common PS dataset failed deletion attempt", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const node = new ZoweDatasetNode("HLQ.TEST.NODE", vscode.TreeItemCollapsibleState.None,
            environmentalMocks.datasetSessionNode, null, undefined, undefined, environmentalMocks.imperativeProfile);

        mocked(fs.existsSync).mockReturnValueOnce(true);
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Yes");
        const deleteSpy = jest.spyOn(environmentalMocks.mvsApi, "deleteDataSet");
        deleteSpy.mockRejectedValueOnce(Error(""));

        await expect(dsActions.deleteDataset(node, environmentalMocks.testDatasetTree)).rejects.toEqual(Error(""));
        expect(mocked(vscode.window.showErrorMessage)).toBeCalledWith(" Error");
    });
    it("Checking PS deletion attempt which was rejected by user in the process", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const node = new ZoweDatasetNode("HLQ.TEST.NODE", vscode.TreeItemCollapsibleState.None,
            environmentalMocks.datasetSessionNode, null, undefined, undefined, environmentalMocks.imperativeProfile);

        mocked(fs.existsSync).mockReturnValueOnce(true);
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("No");
        const deleteSpy = jest.spyOn(environmentalMocks.mvsApi, "deleteDataSet");

        await dsActions.deleteDataset(node, environmentalMocks.testDatasetTree);

        expect(mocked(fs.unlinkSync)).not.toBeCalled();
        expect(deleteSpy).not.toBeCalled();
    });
    it("Checking Favorite PDS dataset deletion", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const parent = new ZoweDatasetNode("parent", vscode.TreeItemCollapsibleState.Collapsed, environmentalMocks.datasetSessionNode, null);
        parent.contextValue = globals.FAVORITE_CONTEXT;
        const node = new ZoweDatasetNode("HLQ.TEST.NODE", vscode.TreeItemCollapsibleState.None,
            parent, null, undefined, undefined, environmentalMocks.imperativeProfile);
        node.contextValue = globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX;

        mocked(fs.existsSync).mockReturnValueOnce(true);
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Yes");
        const deleteSpy = jest.spyOn(environmentalMocks.mvsApi, "deleteDataSet");

        await dsActions.deleteDataset(node, environmentalMocks.testDatasetTree);

        expect(deleteSpy).toBeCalledWith(node.label);
        expect(environmentalMocks.testDatasetTree.removeFavorite).toBeCalledWith(node);
        expect(environmentalMocks.testDatasetTree.refreshElement).toBeCalledWith(parent);
        expect(mocked(fs.existsSync)).toBeCalledWith(path.join(globals.DS_DIR,
            parent.getSessionNode().label, "HLQ.TEST.NODE"));
        expect(mocked(fs.unlinkSync)).toBeCalledWith(path.join(globals.DS_DIR,
            parent.getSessionNode().label, "HLQ.TEST.NODE"));
    });
    it("Checking Favorite PDS Member deletion", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const parent = new ZoweDatasetNode("parent", vscode.TreeItemCollapsibleState.Collapsed, environmentalMocks.datasetSessionNode, null);
        parent.contextValue = globals.DS_PDS_CONTEXT + globals.FAV_SUFFIX;
        const child = new ZoweDatasetNode("child", vscode.TreeItemCollapsibleState.None, parent, null);

        mocked(fs.existsSync).mockReturnValueOnce(true);
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Yes");
        const deleteSpy = jest.spyOn(environmentalMocks.mvsApi, "deleteDataSet");

        await dsActions.deleteDataset(child, environmentalMocks.testDatasetTree);

        expect(deleteSpy).toBeCalledWith(`${child.getParent().label}(${child.label})`);
        expect(environmentalMocks.testDatasetTree.removeFavorite).toBeCalledWith(child);
        expect(environmentalMocks.testDatasetTree.refreshElement).toBeCalledWith(parent);
        expect(mocked(fs.existsSync)).toBeCalledWith(path.join(globals.DS_DIR,
            parent.getSessionNode().label, `${child.getParent().label}(${child.label})`));
        expect(mocked(fs.unlinkSync)).toBeCalledWith(path.join(globals.DS_DIR,
            parent.getSessionNode().label, `${child.getParent().label}(${child.label})`));
    });
    it("Checking Favorite PS dataset deletion", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const parent = new ZoweDatasetNode("[sestest]: HLQ.TEST.DELETE.PARENT",
            vscode.TreeItemCollapsibleState.Collapsed, environmentalMocks.datasetSessionNode, null);
        parent.contextValue = globals.FAVORITE_CONTEXT;
        const child = new ZoweDatasetNode("[sestest]: HLQ.TEST.DELETE.NODE", vscode.TreeItemCollapsibleState.None, parent, null);
        environmentalMocks.datasetSessionNode.children.push(parent, child);
        environmentalMocks.testDatasetTree.mFavorites.push(child);

        mocked(fs.existsSync).mockReturnValueOnce(true);
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Yes");
        const deleteSpy = jest.spyOn(environmentalMocks.mvsApi, "deleteDataSet");

        await dsActions.deleteDataset(child, environmentalMocks.testDatasetTree);

        expect(deleteSpy).toBeCalledWith("HLQ.TEST.DELETE.NODE");
        expect(environmentalMocks.testDatasetTree.removeFavorite).toBeCalledWith(child);
        expect(mocked(fs.existsSync)).toBeCalledWith(path.join(globals.DS_DIR,
            parent.getSessionNode().label, "HLQ.TEST.DELETE.NODE"));
        expect(mocked(fs.unlinkSync)).toBeCalledWith(path.join(globals.DS_DIR,
            parent.getSessionNode().label, "HLQ.TEST.DELETE.NODE"));
    });
    it("Checking incorrect dataset failed deletion attempt", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const parent = new ZoweDatasetNode("parent", vscode.TreeItemCollapsibleState.Collapsed, environmentalMocks.datasetSessionNode, null);
        parent.contextValue = "junk";
        const child = new ZoweDatasetNode("child", vscode.TreeItemCollapsibleState.None,
            parent, null, undefined, undefined, environmentalMocks.imperativeProfile);

        mocked(fs.existsSync).mockReturnValueOnce(true);
        mocked(vscode.window.showQuickPick).mockResolvedValueOnce("Yes");
        const deleteSpy = jest.spyOn(environmentalMocks.mvsApi, "deleteDataSet");

        await expect(dsActions.deleteDataset(child, environmentalMocks.testDatasetTree)).rejects.toEqual(Error("deleteDataSet() called from invalid node."));
        expect(deleteSpy).not.toBeCalled();
    });
});

describe("Add enterPattern tests", () => {
    function generateEnvironmentalMocks() {
        const session = generateISession();
        const imperativeProfile = generateIProfile();
        const zosmfSession = generateBasicZosmfSession(imperativeProfile);
        const treeView = generateTreeView();
        const datasetSessionNode = generateDatasetSessionNode(session, imperativeProfile);
        const mvsApi = generateMvsApi(imperativeProfile);
        bindMvsApi(mvsApi);

        return {
            session,
            zosmfSession,
            treeView,
            imperativeProfile,
            datasetSessionNode,
            mvsApi,
            testDatasetTree: generateDatasetTree(datasetSessionNode, treeView)
        };
    }

    afterEach(() => jest.clearAllMocks());

    it("Checking common dataset filter action", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const node = new ZoweDatasetNode("node", vscode.TreeItemCollapsibleState.None, environmentalMocks.datasetSessionNode, null);
        node.pattern = "TEST";
        node.contextValue = globals.DS_SESSION_CONTEXT;

        mocked(vscode.window.showInputBox).mockReturnValueOnce("test");
        await dsActions.enterPattern(node, environmentalMocks.testDatasetTree);

        expect(mocked(vscode.window.showInputBox)).toBeCalledWith({
            prompt: "Search data sets by entering patterns: use a comma to separate multiple patterns",
            value: node.pattern
        });
        expect(mocked(vscode.window.showInformationMessage)).not.toBeCalled();
    });
    it("Checking common dataset filter failed attempt", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const node = new ZoweDatasetNode("node", vscode.TreeItemCollapsibleState.None, environmentalMocks.datasetSessionNode, null);
        node.pattern = "TEST";
        node.contextValue = globals.DS_SESSION_CONTEXT;

        mocked(vscode.window.showInputBox).mockReturnValueOnce("");
        await dsActions.enterPattern(node, environmentalMocks.testDatasetTree);

        expect(mocked(vscode.window.showInformationMessage)).toBeCalledWith("You must enter a pattern.");
    });
    it("Checking favorite dataset filter action", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const favoriteSample = new ZoweDatasetNode("[sestest]: HLQ.TEST", vscode.TreeItemCollapsibleState.None, undefined, null);

        await dsActions.enterPattern(favoriteSample, environmentalMocks.testDatasetTree);
        expect(environmentalMocks.testDatasetTree.addSession).toBeCalledWith("sestest");
    });
});

describe("Add saveFile tests", () => {
    function generateEnvironmentalMocks() {
        const session = generateISession();
        const sessionWithoutCredentials = generateISessionWithoutCredentials();
        const imperativeProfile = generateIProfile();
        const profileInstance = generateInstanceOfProfile(imperativeProfile);
        const zosmfSession = generateBasicZosmfSession(imperativeProfile);
        const treeView = generateTreeView();
        const datasetSessionNode = generateDatasetSessionNode(session, imperativeProfile);
        const mvsApi = generateMvsApi(imperativeProfile);
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
            testDatasetTree: generateDatasetTree(datasetSessionNode, treeView)
        };
    }

    beforeEach(() => globals.defineGlobals(""));
    afterEach(() => jest.clearAllMocks());

    it("Checking common dataset saving action when no session is defined", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const nodeWithoutSession = new ZoweDatasetNode("HLQ.TEST.AFILE", vscode.TreeItemCollapsibleState.None,
            null, null, undefined, undefined, environmentalMocks.imperativeProfile);

        environmentalMocks.testDatasetTree.getChildren.mockReturnValueOnce([nodeWithoutSession]);
        mocked(sharedUtils.concatChildNodes).mockReturnValueOnce([nodeWithoutSession]);
        environmentalMocks.profileInstance.loadNamedProfile.mockReturnValueOnce(environmentalMocks.imperativeProfile);
        mocked(Profiles.getInstance).mockReturnValue(environmentalMocks.profileInstance);
        const getSessionSpy = jest.spyOn(environmentalMocks.mvsApi, "getSession").mockReturnValueOnce(environmentalMocks.sessionWithoutCredentials);
        const testDocument = generateTextDocument(environmentalMocks.datasetSessionNode, "HLQ.TEST.AFILE");
        (testDocument as any).fileName = path.join(globals.DS_DIR, testDocument.fileName);

        await dsActions.saveFile(testDocument, environmentalMocks.testDatasetTree);

        // tslint:disable-next-line: no-magic-numbers
        expect(getSessionSpy).toBeCalledTimes(2);
        expect(getSessionSpy).toReturnWith(environmentalMocks.sessionWithoutCredentials);
    });
    it("Checking common dataset saving failed attempt due to inability to locate session and profile", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const nodeWithoutSession = new ZoweDatasetNode("HLQ.TEST.AFILE", vscode.TreeItemCollapsibleState.None,
            null, null, undefined, undefined, environmentalMocks.imperativeProfile);

        environmentalMocks.profileInstance.loadNamedProfile.mockReturnValueOnce(undefined);
        mocked(Profiles.getInstance).mockReturnValue(environmentalMocks.profileInstance);
        environmentalMocks.testDatasetTree.getChildren.mockReturnValueOnce([nodeWithoutSession]);
        const testDocument = generateTextDocument(environmentalMocks.datasetSessionNode, "HLQ.TEST.AFILE");
        (testDocument as any).fileName = path.join(globals.DS_DIR, testDocument.fileName);

        await dsActions.saveFile(testDocument, environmentalMocks.testDatasetTree);

        expect(mocked(vscode.window.showErrorMessage)).toBeCalledWith("Couldn't locate session when saving data set!");
    });
    it("Checking common dataset saving failed attempt due to its absence on the side of the server", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const node = new ZoweDatasetNode("node", vscode.TreeItemCollapsibleState.None,
            environmentalMocks.datasetSessionNode, undefined, undefined, undefined, environmentalMocks.imperativeProfile);

        environmentalMocks.testDatasetTree.getChildren.mockReturnValueOnce([node, environmentalMocks.datasetSessionNode]);
        environmentalMocks.profileInstance.loadNamedProfile.mockReturnValueOnce(environmentalMocks.imperativeProfile);
        mocked(Profiles.getInstance).mockReturnValue(environmentalMocks.profileInstance);
        const dataSetSpy = jest.spyOn(environmentalMocks.mvsApi, "dataSet").mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: []
            }
        });
        const testDocument = generateTextDocument(environmentalMocks.datasetSessionNode, "HLQ.TEST.AFILE");
        (testDocument as any).fileName = path.join(globals.DS_DIR, testDocument.fileName);

        await dsActions.saveFile(testDocument, environmentalMocks.testDatasetTree);

        expect(dataSetSpy).toBeCalledWith("HLQ.TEST.AFILE");
        expect(mocked(vscode.window.showErrorMessage)).toBeCalledWith("Data set failed to save. Data set may have been deleted on mainframe.");
    });
    it("Checking common dataset saving", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const node = new ZoweDatasetNode("HLQ.TEST.AFILE", vscode.TreeItemCollapsibleState.None, environmentalMocks.datasetSessionNode,
            null, undefined, undefined, environmentalMocks.imperativeProfile);
        environmentalMocks.datasetSessionNode.children.push(node);

        mocked(sharedUtils.concatChildNodes).mockReturnValueOnce([node]);
        environmentalMocks.testDatasetTree.getChildren.mockReturnValueOnce([environmentalMocks.datasetSessionNode]);
        mocked(zowe.List.dataSet).mockResolvedValue({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [{ dsname: "HLQ.TEST.AFILE" }, { dsname: "HLQ.TEST.AFILE(mem)" }]
            }
        });
        mocked(zowe.Upload.pathToDataSet).mockResolvedValueOnce({
            success: true,
            commandResponse: "success",
            apiResponse: [{
                etag: "123"
            }]
        });
        mocked(vscode.window.withProgress).mockImplementation((progLocation, callback) => {
            return callback();
        });
        environmentalMocks.profileInstance.loadNamedProfile.mockReturnValueOnce(environmentalMocks.imperativeProfile);
        mocked(Profiles.getInstance).mockReturnValue(environmentalMocks.profileInstance);
        const mockSetEtag = jest.spyOn(node, "setEtag").mockImplementation(() => null);
        const testDocument = generateTextDocument(environmentalMocks.datasetSessionNode, "HLQ.TEST.AFILE");
        (testDocument as any).fileName = path.join(globals.DS_DIR, testDocument.fileName);

        await dsActions.saveFile(testDocument, environmentalMocks.testDatasetTree);

        expect(mocked(sharedUtils.concatChildNodes)).toBeCalled();
        expect(mockSetEtag).toHaveBeenCalledWith("123");
        expect(mocked(vscode.window.showInformationMessage)).toBeCalledWith("success");
    });
    it("Checking common dataset failed saving attempt", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const node = new ZoweDatasetNode("HLQ.TEST.AFILE", vscode.TreeItemCollapsibleState.None, environmentalMocks.datasetSessionNode,
            null, undefined, undefined, environmentalMocks.imperativeProfile);
        environmentalMocks.datasetSessionNode.children.push(node);

        mocked(sharedUtils.concatChildNodes).mockReturnValueOnce([node]);
        environmentalMocks.testDatasetTree.getChildren.mockReturnValueOnce([environmentalMocks.datasetSessionNode]);
        mocked(zowe.List.dataSet).mockResolvedValue({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [{ dsname: "HLQ.TEST.AFILE" }, { dsname: "HLQ.TEST.AFILE(mem)" }]
            }
        });
        mocked(zowe.Upload.pathToDataSet).mockResolvedValueOnce({
            success: false,
            commandResponse: "failed",
            apiResponse: [{
                etag: "123"
            }]
        });
        mocked(vscode.window.withProgress).mockImplementation((progLocation, callback) => {
            return callback();
        });
        environmentalMocks.profileInstance.loadNamedProfile.mockReturnValueOnce(environmentalMocks.imperativeProfile);
        mocked(Profiles.getInstance).mockReturnValue(environmentalMocks.profileInstance);
        const testDocument = generateTextDocument(environmentalMocks.datasetSessionNode, "HLQ.TEST.AFILE");
        (testDocument as any).fileName = path.join(globals.DS_DIR, testDocument.fileName);

        await dsActions.saveFile(testDocument, environmentalMocks.testDatasetTree);

        expect(mocked(sharedUtils.concatChildNodes)).toBeCalled();
        expect(mocked(vscode.window.showErrorMessage)).toBeCalledWith("failed");
    });
    it("Checking common dataset failed saving attempt due to incorrect document path", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const node = new ZoweDatasetNode("HLQ.TEST.AFILE", vscode.TreeItemCollapsibleState.None, environmentalMocks.datasetSessionNode,
            null, undefined, undefined, environmentalMocks.imperativeProfile);
        environmentalMocks.datasetSessionNode.children.push(node);

        mocked(sharedUtils.concatChildNodes).mockReturnValueOnce([node]);
        environmentalMocks.testDatasetTree.getChildren.mockReturnValueOnce([environmentalMocks.datasetSessionNode]);
        environmentalMocks.profileInstance.loadNamedProfile.mockReturnValueOnce(environmentalMocks.imperativeProfile);
        mocked(Profiles.getInstance).mockReturnValue(environmentalMocks.profileInstance);
        const testDocument = generateTextDocument(environmentalMocks.datasetSessionNode, "HLQ.TEST.AFILE");

        await dsActions.saveFile(testDocument, environmentalMocks.testDatasetTree);

        expect(mocked(zowe.List.dataSet)).not.toBeCalled();
        expect(mocked(zowe.Upload.pathToDataSet)).not.toBeCalled();
    });
    it("Checking PDS member saving attempt", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const node = new ZoweDatasetNode(
            "HLQ.TEST.AFILE(mem)", vscode.TreeItemCollapsibleState.None, environmentalMocks.datasetSessionNode,
            null, undefined, undefined, environmentalMocks.imperativeProfile);
        environmentalMocks.datasetSessionNode.children.push(node);

        mocked(sharedUtils.concatChildNodes).mockReturnValueOnce([node]);
        environmentalMocks.testDatasetTree.getChildren.mockReturnValueOnce([environmentalMocks.datasetSessionNode]);
        mocked(zowe.List.dataSet).mockResolvedValue({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [{ dsname: "HLQ.TEST.AFILE" }, { dsname: "HLQ.TEST.AFILE(mem)" }]
            }
        });
        mocked(zowe.Upload.pathToDataSet).mockResolvedValueOnce({
            success: true,
            commandResponse: "success",
            apiResponse: [{
                etag: "123"
            }]
        });
        mocked(vscode.window.withProgress).mockImplementation((progLocation, callback) => {
            return callback();
        });
        environmentalMocks.profileInstance.loadNamedProfile.mockReturnValueOnce(environmentalMocks.imperativeProfile);
        mocked(Profiles.getInstance).mockReturnValue(environmentalMocks.profileInstance);
        const testDocument = generateTextDocument(environmentalMocks.datasetSessionNode, "HLQ.TEST.AFILE(mem)");
        (testDocument as any).fileName = path.join(globals.DS_DIR, testDocument.fileName);

        await dsActions.saveFile(testDocument, environmentalMocks.testDatasetTree);

        expect(mocked(sharedUtils.concatChildNodes)).toBeCalled();
        expect(mocked(vscode.window.showInformationMessage)).toBeCalledWith("success");
    });
    it("Checking common dataset saving failed due to conflict with server version", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const node = new ZoweDatasetNode("HLQ.TEST.AFILE", vscode.TreeItemCollapsibleState.None, environmentalMocks.datasetSessionNode,
            null, undefined, undefined, environmentalMocks.imperativeProfile);
        environmentalMocks.datasetSessionNode.children.push(node);

        mocked(sharedUtils.concatChildNodes).mockReturnValueOnce([node]);
        environmentalMocks.testDatasetTree.getChildren.mockReturnValueOnce([environmentalMocks.datasetSessionNode]);
        mocked(zowe.List.dataSet).mockResolvedValue({
            success: true,
            commandResponse: "",
            apiResponse: {
                items: [{ dsname: "HLQ.TEST.AFILE" }]
            }
        });
        mocked(zowe.Upload.pathToDataSet).mockResolvedValueOnce({
            success: false,
            commandResponse: "Rest API failure with HTTP(S) status 412",
            apiResponse: []
        });
        mocked(zowe.Download.dataSet).mockResolvedValueOnce({
            success: true,
            commandResponse: "",
            apiResponse: {
                etag: ""
            }
        });
        mocked(vscode.window.withProgress).mockImplementation((progLocation, callback) => {
            return callback();
        });
        environmentalMocks.profileInstance.loadNamedProfile.mockReturnValueOnce(environmentalMocks.imperativeProfile);
        mocked(Profiles.getInstance).mockReturnValue(environmentalMocks.profileInstance);
        const testDocument = generateTextDocument(environmentalMocks.datasetSessionNode, "HLQ.TEST.AFILE");
        (testDocument as any).fileName = path.join(globals.DS_DIR, testDocument.fileName);

        await dsActions.saveFile(testDocument, environmentalMocks.testDatasetTree);

        expect(mocked(vscode.window.showWarningMessage)).toBeCalledWith("Remote file has been modified in the meantime.\nSelect 'Compare' to resolve the conflict.");
        expect(mocked(sharedUtils.concatChildNodes)).toBeCalled();
    });
});
