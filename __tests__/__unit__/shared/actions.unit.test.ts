import * as vscode from "vscode";
import {
    generateInstanceOfProfile,
    generateIProfile,
    generateISessionWithoutCredentials, generateQuickPickContent, generateQuickPickItem, generateTreeView
} from "../../../__mocks__/generators/shared";
import * as extension from "../../../src/extension";
import { generateDatasetSessionNode, generateDatasetTree } from "../../../__mocks__/generators/datasets";
import { Profiles } from "../../../src/Profiles";
import * as utils from "../../../src/utils";
import * as globals from "../../../src/globals";
import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";
import * as sharedActions from "../../../src/shared/actions";
import { generateUSSSessionNode, generateUSSTree } from "../../../__mocks__/generators/uss";
import * as dsActions from "../../../src/dataset/actions";
import { ZoweUSSNode } from "../../../src/uss/ZoweUSSNode";

Object.defineProperty(vscode.window, "showInformationMessage", { value: jest.fn() });
Object.defineProperty(vscode.window, "showInputBox", { value: jest.fn() });
Object.defineProperty(vscode.window, "showErrorMessage", { value: jest.fn() });
Object.defineProperty(vscode.window, "showQuickPick", { value: jest.fn() });
Object.defineProperty(vscode.window, "createQuickPick", { value: jest.fn() });
Object.defineProperty(Profiles, "getInstance", { value: jest.fn() });
Object.defineProperty(globals, "LOG", { value: jest.fn() });
Object.defineProperty(globals.LOG, "debug", { value: jest.fn() });
Object.defineProperty(globals.LOG, "error", { value: jest.fn() });

// Idea is borrowed from: https://github.com/kulshekhar/ts-jest/blob/master/src/util/testing.ts
const mocked = (fn: any): jest.Mock => fn;

describe("Add Session Unit Test", () => {
    function generateEnvironmentalMocks() {
        const session = generateISessionWithoutCredentials();
        const treeView = generateTreeView();
        const imperativeProfile = generateIProfile();
        const profileInstance = generateInstanceOfProfile(imperativeProfile);
        const datasetSessionNode = generateDatasetSessionNode(session, imperativeProfile);
        const quickPickItem = generateQuickPickItem();

        return {
            session,
            imperativeProfile,
            profileInstance,
            datasetSessionNode,
            testDatasetTree: generateDatasetTree(datasetSessionNode, treeView),
            quickPickItem
        };
    }

    afterEach(() => jest.clearAllMocks());

    it("Checking that addSession will cancel if there is no profile name", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const entered = undefined;
        mocked(vscode.window.showInputBox).mockResolvedValueOnce(entered);
        mocked(Profiles.getInstance).mockReturnValue(environmentalMocks.profileInstance);

        // Assert edge condition user cancels the input path box
        mocked(vscode.window.createQuickPick).mockReturnValue(generateQuickPickContent(entered, environmentalMocks.quickPickItem));
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(environmentalMocks.quickPickItem);

        await extension.addZoweSession(environmentalMocks.testDatasetTree);
        expect(mocked(vscode.window.showInformationMessage).mock.calls[0][0]).toEqual("Profile Name was not supplied. Operation Cancelled");
    });
    it("Checking that addSession works correctly with supplied profile name", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const entered = undefined;
        mocked(vscode.window.showInputBox).mockResolvedValueOnce("fake");
        mocked(Profiles.getInstance).mockReturnValue(environmentalMocks.profileInstance);

        // Assert edge condition user cancels the input path box
        mocked(vscode.window.createQuickPick).mockReturnValue(generateQuickPickContent(entered, environmentalMocks.quickPickItem));
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(environmentalMocks.quickPickItem);

        await extension.addZoweSession(environmentalMocks.testDatasetTree);
        expect(environmentalMocks.testDatasetTree.addSession).toBeCalled();
        expect(environmentalMocks.testDatasetTree.addSession.mock.calls[0][0]).toEqual({ newprofile: "fake" });
    });
    it("Checking that addSession works correctly with existing profile", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const entered = "";
        mocked(Profiles.getInstance).mockReturnValue(environmentalMocks.profileInstance);

        // Assert edge condition user cancels the input path box
        const quickPickContent = generateQuickPickContent(entered, environmentalMocks.quickPickItem);
        quickPickContent.label = "firstName";
        mocked(vscode.window.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(quickPickContent);

        await extension.addZoweSession(environmentalMocks.testDatasetTree);
        expect(environmentalMocks.testDatasetTree.addSession).toBeCalled();
        expect(environmentalMocks.testDatasetTree.addSession.mock.calls[0][0]).toBe("firstName");
    });
    it("Checking that addSession works correctly with supplied resolveQuickPickHelper", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const entered = "fake";
        mocked(Profiles.getInstance).mockReturnValue(environmentalMocks.profileInstance);

        mocked(vscode.window.createQuickPick).mockReturnValue(generateQuickPickContent(entered, environmentalMocks.quickPickItem));
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(environmentalMocks.quickPickItem);

        await extension.addZoweSession(environmentalMocks.testDatasetTree);
        expect(environmentalMocks.testDatasetTree.addSession).not.toBeCalled();
    });
    it("Checking that addSession works correctly with undefined profile", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const entered = "";
        mocked(Profiles.getInstance).mockReturnValue(environmentalMocks.profileInstance);

        // Assert edge condition user cancels the input path box
        const quickPickContent = generateQuickPickContent(entered, environmentalMocks.quickPickItem);
        quickPickContent.label = undefined;
        mocked(vscode.window.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(quickPickContent);

        await extension.addZoweSession(environmentalMocks.testDatasetTree);
        expect(environmentalMocks.testDatasetTree.addSession).not.toBeCalled();
    });
    it("Checking that addSession works correctly if createNewConnection is invalid", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const entered = "fake";
        environmentalMocks.profileInstance.createNewConnection = jest.fn().mockRejectedValue(new Error("create connection error"));
        mocked(Profiles.getInstance).mockReturnValue(environmentalMocks.profileInstance);
        mocked(vscode.window.showInputBox).mockResolvedValueOnce(entered);

        mocked(vscode.window.createQuickPick).mockReturnValue(generateQuickPickContent(entered, environmentalMocks.quickPickItem));
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(environmentalMocks.quickPickItem);
        const errorHandlingSpy = jest.spyOn(utils, "errorHandling");

        await extension.addZoweSession(environmentalMocks.testDatasetTree);
        expect(errorHandlingSpy).toBeCalled();
        expect(errorHandlingSpy.mock.calls[0][0]).toEqual(new Error("create connection error"));
    });
});

describe("Add searchForLoadedItems Tests", () => {
    function generateEnvironmentalMocks() {
        const session = generateISessionWithoutCredentials();
        const treeView = generateTreeView();
        const imperativeProfile = generateIProfile();
        const profileInstance = generateInstanceOfProfile(imperativeProfile);
        const datasetSessionNode = generateDatasetSessionNode(session, imperativeProfile);

        // It's required to have proper mock of profile for USS Node generation
        mocked(Profiles.getInstance).mockReturnValue(profileInstance);
        const ussSessionNode = generateUSSSessionNode(session, imperativeProfile);

        return {
            session,
            imperativeProfile,
            profileInstance,
            datasetSessionNode,
            ussSessionNode,
            testDatasetTree: generateDatasetTree(datasetSessionNode, treeView),
            testUssTree: generateUSSTree([], [ussSessionNode], treeView)
        };
    }

    afterEach(() => jest.clearAllMocks());

    it("Checking that searchForLoadedItems works for a PDS", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const testNode = new ZoweDatasetNode("HLQ.PROD2.STUFF", null,
            environmentalMocks.datasetSessionNode, environmentalMocks.session, globals.DS_PDS_CONTEXT);
        testNode.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        environmentalMocks.testDatasetTree.searchInLoadedItems.mockResolvedValueOnce([testNode]);
        environmentalMocks.testUssTree.searchInLoadedItems.mockResolvedValueOnce([]);
        environmentalMocks.testDatasetTree.getChildren.mockImplementation((arg) => {
            if (arg) {
                return Promise.resolve([testNode]);
            } else {
                return Promise.resolve([environmentalMocks.datasetSessionNode]);
            }
        });

        const qpItem = new utils.FilterItem("[sestest]: HLQ.PROD2.STUFF");
        const quickPickContent = generateQuickPickContent(qpItem, qpItem);
        quickPickContent.placeholder = "Select a filter";
        mocked(vscode.window.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(qpItem);

        await sharedActions.searchInAllLoadedItems(environmentalMocks.testDatasetTree, environmentalMocks.testUssTree);
        expect(environmentalMocks.testDatasetTree.addHistory).not.toBeCalled();
    });
    it("Checking that searchForLoadedItems works for a member", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const testNode = new ZoweDatasetNode("HLQ.PROD2.STUFF", null,
            environmentalMocks.datasetSessionNode, environmentalMocks.session, globals.DS_DS_CONTEXT);
        testNode.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        const testMember = new ZoweDatasetNode("TESTMEMB", null, testNode,
            environmentalMocks.session, globals.DS_MEMBER_CONTEXT);
        testMember.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        testNode.children.push(testMember);
        environmentalMocks.testDatasetTree.getChildren.mockReturnValue([environmentalMocks.datasetSessionNode]);

        jest.spyOn(dsActions, "openPS").mockResolvedValueOnce(null);
        environmentalMocks.testDatasetTree.searchInLoadedItems.mockResolvedValueOnce([testMember]);
        environmentalMocks.testUssTree.searchInLoadedItems.mockResolvedValueOnce([]);
        environmentalMocks.testDatasetTree.getChildren.mockImplementation((arg) => {
            if (arg === testNode) {
                return Promise.resolve([testMember]);
            } else if (arg) {
                return Promise.resolve([testNode]);
            } else {
                return Promise.resolve([environmentalMocks.datasetSessionNode]);
            }
        });
        const qpItem = new utils.FilterItem("[sestest]: HLQ.PROD2.STUFF(TESTMEMB)");
        const quickPickContent = generateQuickPickContent(qpItem, qpItem);
        quickPickContent.placeholder = "Select a filter";
        mocked(vscode.window.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(qpItem);

        await sharedActions.searchInAllLoadedItems(environmentalMocks.testDatasetTree, environmentalMocks.testUssTree);
        expect(environmentalMocks.testDatasetTree.addHistory).toBeCalledWith("HLQ.PROD2.STUFF(TESTMEMB)");
    });
    it("Checking that searchForLoadedItems works for a USS folder", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const folder = new ZoweUSSNode("folder", vscode.TreeItemCollapsibleState.Collapsed, environmentalMocks.ussSessionNode, null, "/");
        environmentalMocks.testDatasetTree.getChildren.mockReturnValue([environmentalMocks.ussSessionNode]);

        environmentalMocks.testDatasetTree.searchInLoadedItems.mockResolvedValueOnce([]);
        environmentalMocks.testUssTree.searchInLoadedItems.mockResolvedValueOnce([folder]);
        jest.spyOn(folder, "getProfileName").mockImplementationOnce(() => "firstName");
        jest.spyOn(environmentalMocks.ussSessionNode, "getChildren").mockResolvedValueOnce([folder]);

        const qpItem = new utils.FilterItem("[sestest]: /folder");
        const quickPickContent = generateQuickPickContent(qpItem, qpItem);
        quickPickContent.placeholder = "Select a filter";
        mocked(vscode.window.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(qpItem);

        const openNode = jest.spyOn(folder, "openUSS");
        await sharedActions.searchInAllLoadedItems(environmentalMocks.testDatasetTree, environmentalMocks.testUssTree);
        expect(openNode).not.toBeCalled();
    });
    it("Checking that searchForLoadedItems works for a USS file", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        const folder = new ZoweUSSNode("folder", vscode.TreeItemCollapsibleState.Collapsed,
            environmentalMocks.ussSessionNode, null, "/");
        const file = new ZoweUSSNode("file", vscode.TreeItemCollapsibleState.None, folder, null, "/folder");
        environmentalMocks.testDatasetTree.getChildren.mockReturnValue([environmentalMocks.ussSessionNode]);

        environmentalMocks.testDatasetTree.searchInLoadedItems.mockResolvedValueOnce([]);
        environmentalMocks.testUssTree.searchInLoadedItems.mockResolvedValueOnce([file]);
        jest.spyOn(environmentalMocks.ussSessionNode, "getChildren").mockResolvedValueOnce([folder]);
        jest.spyOn(folder, "getChildren").mockResolvedValueOnce([file]);

        const qpItem = new utils.FilterItem("[sestest]: /folder/file");
        const quickPickContent = generateQuickPickContent(qpItem, qpItem);
        quickPickContent.placeholder = "Select a filter";
        mocked(vscode.window.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(qpItem);

        const openNode = jest.spyOn(file, "openUSS");
        await sharedActions.searchInAllLoadedItems(environmentalMocks.testDatasetTree, environmentalMocks.testUssTree);

        expect(environmentalMocks.testUssTree.addHistory).toBeCalledWith("/folder/file");
        expect(openNode).toHaveBeenCalledWith(false, true, environmentalMocks.testUssTree);
    });
    it("Checking that searchForLoadedItems fails when no pattern is entered", async () => {
        const environmentalMocks = generateEnvironmentalMocks();
        environmentalMocks.testDatasetTree.searchInLoadedItems.mockResolvedValueOnce([]);
        environmentalMocks.testUssTree.searchInLoadedItems.mockResolvedValueOnce([]);
        const qpItem = null;
        const quickPickContent = generateQuickPickContent(qpItem, qpItem);
        quickPickContent.placeholder = "Select a filter";
        mocked(vscode.window.createQuickPick).mockReturnValue(quickPickContent);
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(qpItem);

        await sharedActions.searchInAllLoadedItems(environmentalMocks.testDatasetTree, environmentalMocks.testUssTree);
        expect(environmentalMocks.testUssTree.addHistory).not.toBeCalled();
    });
});
