/*
* This program and the accompanying materials are made available under the terms of the *
* Eclipse Public License v2.0 which accompanies this distribution, and is available at *
* https://www.eclipse.org/legal/epl-v20.html                                      *
*                                                                                 *
* SPDX-License-Identifier: EPL-2.0                                                *
*                                                                                 *
* Copyright Contributors to the Zowe Project.                                     *
*                                                                                 *
*/

jest.mock("@zowe/imperative");

import * as vscode from "vscode";
import { ZoweUSSNode } from "../../../src/ZoweUSSNode";
import { Session, IProfileLoaded } from "@zowe/imperative";
import * as zowe from "@zowe/cli";
import * as ussNodeActions from "../../../src/uss/ussNodeActions";
import * as extension from "../../../src/extension";
import * as path from "path";
import * as fs from "fs";
import * as isbinaryfile from "isbinaryfile";
import { Profiles } from "../../../src/Profiles";
import * as utils from "../../../src/utils";

const Create = jest.fn();
const Delete = jest.fn();
const Utilities = jest.fn();
const uss = jest.fn();
const ussFile = jest.fn();
const renameUSSFile = jest.fn();
const mockaddZoweSession = jest.fn();
const mockUSSRefresh = jest.fn();
const mockUSSRefreshElement = jest.fn();
const mockGetUSSChildren = jest.fn();
const mockRemoveFavorite = jest.fn();
const mockAddFavorite = jest.fn();
const mockInitializeFavorites = jest.fn();
const showInputBox = jest.fn();
const showErrorMessage = jest.fn();
const showInformationMessage = jest.fn();
const showQuickPick = jest.fn();
const getConfiguration = jest.fn();
const showOpenDialog = jest.fn();
const openTextDocument = jest.fn();
const Upload = jest.fn();
const fileToUSSFile = jest.fn();
const writeText = jest.fn();
const existsSync = jest.fn();
const createBasicZosmfSession = jest.fn();
const isBinaryFileSync = jest.fn();

const profileOne: IProfileLoaded = {
    name: "profile1",
    profile: {},
    type: "zosmf",
    message: "",
    failNotFound: false
};

function getUSSNode() {
    const mParent = new ZoweUSSNode("parentNode", vscode.TreeItemCollapsibleState.Expanded, null, session, null, false, profileOne.name);
    const ussNode1 = new ZoweUSSNode("usstest", vscode.TreeItemCollapsibleState.Expanded, mParent, session, null, false, profileOne.name);
    ussNode1.contextValue = extension.USS_SESSION_CONTEXT;
    ussNode1.fullPath = "/u/myuser";
    return ussNode1;
}

function getFavoriteUSSNode() {
    const ussNodeF = new ZoweUSSNode("[profile]: usstest", vscode.TreeItemCollapsibleState.Expanded, null, session, null, false, profileOne.name);
    const mParent = new ZoweUSSNode("Favorites", vscode.TreeItemCollapsibleState.Expanded, null, session, null, false, profileOne.name);
    mParent.contextValue = extension.FAVORITE_CONTEXT;
    ussNodeF.contextValue = extension.DS_TEXT_FILE_CONTEXT + extension.FAV_SUFFIX;
    ussNodeF.fullPath = "/u/myuser/usstest";
    ussNodeF.tooltip = "/u/myuser/usstest";
    return ussNodeF;
}

function getUSSTree() {
    const ussNode1 = getUSSNode();
    const ussNodeFav = getFavoriteUSSNode();
    const USSTree = jest.fn().mockImplementation(() => {
        return {
            mSessionNodes: [],
            mFavorites: [ussNodeFav],
            addSession: mockaddZoweSession,
            refresh: mockUSSRefresh,
            refreshAll: mockUSSRefresh,
            refreshElement: mockUSSRefreshElement,
            getChildren: mockGetUSSChildren,
            addFavorite: mockAddFavorite,
            removeFavorite: mockRemoveFavorite,
            initializeUSSFavorites: mockInitializeFavorites
        };
    });
    const testUSSTree1 = USSTree();
    testUSSTree1.mSessionNodes = [];
    testUSSTree1.mSessionNodes.push(ussNode1);
    return testUSSTree1;
}

const session = new Session({
    user: "fake",
    password: "fake",
    hostname: "fake",
    protocol: "https",
    type: "basic",
});

describe("ussNodeActions", () => {

    const mockLoadNamedProfile = jest.fn();
    mockLoadNamedProfile.mockReturnValue(profileOne);
    Object.defineProperty(Profiles, "getInstance", {
        value: jest.fn(() => {
            return {
                allProfiles: [{name: "firstName"}, {name: "secondName"}],
                defaultProfile: {name: "firstName"},
                type: "zosmf",
                loadNamedProfile: mockLoadNamedProfile
            };
        })
    });
    const ussNode = getUSSNode();
    const ussFavNode = getFavoriteUSSNode();
    const testUSSTree = getUSSTree();

    Object.defineProperty(zowe, "Create", { value: Create });
    Object.defineProperty(zowe, "Delete", { value: Delete });
    Object.defineProperty(zowe, "Utilities", { value: Utilities });
    Object.defineProperty(Create, "uss", { value: uss });
    Object.defineProperty(Delete, "ussFile", { value: ussFile });
    Object.defineProperty(Utilities, "renameUSSFile", { value: renameUSSFile });
    Object.defineProperty(vscode.window, "showInputBox", { value: showInputBox });
    Object.defineProperty(vscode.window, "showErrorMessage", { value: showErrorMessage });
    Object.defineProperty(vscode.window, "showQuickPick", { value: showQuickPick });
    Object.defineProperty(vscode.window, "showInformationMessage", {value: showInformationMessage});
    Object.defineProperty(vscode.workspace, "getConfiguration", { value: getConfiguration });
    Object.defineProperty(vscode.window, "showOpenDialog", {value: showOpenDialog});
    Object.defineProperty(vscode.workspace, "openTextDocument", {value: openTextDocument});
    Object.defineProperty(vscode.env.clipboard, "writeText", {value: writeText});
    Object.defineProperty(fs, "existsSync", {value: existsSync});
    Object.defineProperty(zowe.ZosmfSession, "createBasicZosmfSession", { value: createBasicZosmfSession});

    beforeEach(() => {
        showErrorMessage.mockReset();
        testUSSTree.refresh.mockReset();
        testUSSTree.refreshAll.mockReset();
        testUSSTree.refreshElement.mockReset();
        showQuickPick.mockReset();
        showInputBox.mockReset();
        existsSync.mockReturnValue(true);
    });
    afterEach(() => {
        jest.resetAllMocks();
    });
    describe("createUSSNodeDialog", () => {
        it("createUSSNode is executed successfully", async () => {
            showQuickPick.mockResolvedValueOnce("File");
            showInputBox.mockReturnValueOnce("USSFolder");
            await ussNodeActions.createUSSNodeDialog(ussNode, testUSSTree);
            expect(testUSSTree.refreshAll).toHaveBeenCalled();
            expect(testUSSTree.refreshElement).not.toHaveBeenCalled();
            expect(showErrorMessage.mock.calls.length).toBe(0);
        });
    });

    describe("createUSSNode", () => {
        it("createUSSNode is executed successfully", async () => {
            showInputBox.mockReturnValueOnce("USSFolder");
            await ussNodeActions.createUSSNode(ussNode, testUSSTree, "file");
            expect(testUSSTree.refreshElement).toHaveBeenCalled();
            expect(showErrorMessage.mock.calls.length).toBe(0);
        });
        it("createUSSNode does not execute if node name was not entered", async () => {
            showInputBox.mockReturnValueOnce("");
            await ussNodeActions.createUSSNode(ussNode, testUSSTree, "file");
            expect(testUSSTree.refresh).not.toHaveBeenCalled();
            expect(showErrorMessage.mock.calls.length).toBe(0);
        });
        it("should refresh only the child folder", async () => {
            showInputBox.mockReturnValueOnce("USSFolder");
            const isTopLevel = false;
            spyOn(ussNodeActions, "refreshAllUSS");
            await ussNodeActions.createUSSNode(ussNode, testUSSTree, "folder", isTopLevel);
            expect(testUSSTree.refreshElement).toHaveBeenCalled();
            expect(ussNodeActions.refreshAllUSS).not.toHaveBeenCalled();
        });

        it("Testing that refreshAllUSS is executed successfully", async () => {
            Object.defineProperty(Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [{name: "firstName"}, {name: "secondName"}],
                        defaultProfile: {name: "firstName"},
                        getDefaultProfile: mockLoadNamedProfile,
                        loadNamedProfile: mockLoadNamedProfile,
                        usesSecurity: true,
                        getProfiles: jest.fn(() => {
                            return [{name: profileOne.name, profile: profileOne}, {name: profileOne.name, profile: profileOne}];
                        }),
                        refresh: jest.fn(),
                    };
                })
            });
            const spy = jest.spyOn(ussNodeActions, "refreshAllUSS");
            ussNodeActions.refreshAllUSS(testUSSTree);
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it("createUSSNode throws an error", async () => {
            showInputBox.mockReturnValueOnce("USSFolder");
            showErrorMessage.mockReset();
            testUSSTree.refreshElement.mockReset();
            uss.mockImplementationOnce(() => {
                throw (Error("testError"));
            });
            try {
                await ussNodeActions.createUSSNode(ussNode, testUSSTree, "file");
                // tslint:disable-next-line:no-empty
            } catch (err) {
            }
            expect(testUSSTree.refreshElement).not.toHaveBeenCalled();
            expect(showErrorMessage.mock.calls.length).toBe(1);
        });
        it("tests the uss create node credentials", async () => {
            showQuickPick.mockReset();
            showInputBox.mockReset();
            showInformationMessage.mockReset();
            mockLoadNamedProfile.mockReturnValue(profileOne);

            const sessionwocred = new Session({
                user: "",
                password: "",
                hostname: "fake",
                port: 443,
                protocol: "https",
                type: "basic",
            });
            Object.defineProperty(Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [{
                            name: "firstName",
                            profile: {user: undefined, password: undefined}
                        }, {name: "secondName"}],
                        defaultProfile: {name: "firstName"},
                        loadNamedProfile: mockLoadNamedProfile,
                        type: "zosmf",
                        promptCredentials: jest.fn(()=> {
                            return [{values: "fake"}, {values: "fake"}, {values: "fake"}];
                        }),
                    };
                })
            });
            const sessNode = new ZoweUSSNode("sestest", vscode.TreeItemCollapsibleState.Expanded, null, session, null);
            sessNode.contextValue = extension.USS_SESSION_CONTEXT;
            const dsNode = new ZoweUSSNode("testSess", vscode.TreeItemCollapsibleState.Expanded, sessNode,
                sessionwocred, null, false, profileOne.name);
            dsNode.contextValue = extension.USS_SESSION_CONTEXT;

            showInputBox.mockReturnValueOnce("fake");
            showInputBox.mockReturnValueOnce("fake");
            showQuickPick.mockReturnValueOnce("directory");
            await ussNodeActions.createUSSNodeDialog(dsNode, testUSSTree);

            expect(testUSSTree.refresh).toHaveBeenCalled();

        });

        it("tests the uss create node credentials operation cancelled", async () => {
            showQuickPick.mockReset();
            showInputBox.mockReset();
            showInformationMessage.mockReset();
            const sessionwocred = new Session({
                user: "",
                password: "",
                hostname: "fake",
                port: 443,
                protocol: "https",
                type: "basic",
            });
            const sessNode = new ZoweUSSNode("sestest", vscode.TreeItemCollapsibleState.Expanded, null, session, null);
            sessNode.contextValue = extension.USS_SESSION_CONTEXT;
            const dsNode = new ZoweUSSNode("testSess", vscode.TreeItemCollapsibleState.Expanded, sessNode, sessionwocred, null);
            dsNode.contextValue = extension.USS_SESSION_CONTEXT;
            Object.defineProperty(Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [{
                            name: "firstName",
                            profile: {user: undefined, password: undefined}
                        }, {name: "secondName"}],
                        defaultProfile: {name: "firstName"},
                        loadNamedProfile: mockLoadNamedProfile,
                        type: "zosmf",
                        promptCredentials: jest.fn(()=> {
                            return [undefined, undefined, undefined];
                        }),
                    };
                })
            });

            await ussNodeActions.createUSSNodeDialog(dsNode, testUSSTree);

            expect(testUSSTree.refresh).not.toHaveBeenCalled();

        });

        it("tests the uss filter prompt credentials error", async () => {
            showQuickPick.mockReset();
            showInputBox.mockReset();
            showInformationMessage.mockReset();
            const sessionwocred = new Session({
                user: "",
                password: "",
                hostname: "fake",
                port: 443,
                protocol: "https",
                type: "basic",
            });
            const sessNode = new ZoweUSSNode("sestest", vscode.TreeItemCollapsibleState.Expanded, null, session, null);
            sessNode.contextValue = extension.USS_SESSION_CONTEXT;
            const dsNode = new ZoweUSSNode("testSess", vscode.TreeItemCollapsibleState.Expanded, sessNode, sessionwocred, null);
            dsNode.contextValue = extension.USS_SESSION_CONTEXT;
            Object.defineProperty(Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [{
                            name: "firstName",
                            profile: {user: undefined, password: undefined}
                        }, {name: "secondName"}],
                        defaultProfile: {name: "firstName"}
                    };
                })
            });

            await ussNodeActions.createUSSNodeDialog(dsNode, testUSSTree);

            expect(testUSSTree.refresh).not.toHaveBeenCalled();
        });
    });

    describe("deleteUSSNode", () => {
        it("should delete node if user verified", async () => {
            showQuickPick.mockResolvedValueOnce("Yes");
            await ussNode.deleteUSSNode(testUSSTree, "");
            expect(testUSSTree.refresh).toHaveBeenCalled();
        });
        it("should not delete node if user did not verify", async () => {
            showQuickPick.mockResolvedValueOnce("No");
            await ussNode.deleteUSSNode(testUSSTree, "");
            expect(testUSSTree.refresh).not.toHaveBeenCalled();
        });
        it("should not delete node if user cancelled", async () => {
            showQuickPick.mockResolvedValueOnce(undefined);
            await ussNode.deleteUSSNode(testUSSTree, "");
            expect(testUSSTree.refresh).not.toHaveBeenCalled();
        });
        it("should not delete node if an error thrown", async () => {
            showErrorMessage.mockReset();
            showQuickPick.mockResolvedValueOnce("Yes");
            ussFile.mockImplementationOnce(() => {
                throw (Error("testError"));
            });
            try {
                await ussNode.deleteUSSNode(testUSSTree, "");
                // tslint:disable-next-line:no-empty
            } catch (err) {
            }
            expect(showErrorMessage.mock.calls.length).toBe(1);
            expect(testUSSTree.refresh).not.toHaveBeenCalled();
        });
    });

    describe("renameUSSNode", () => {
        const executeCommand = jest.fn();
        Object.defineProperty(vscode.commands, "executeCommand", {value: executeCommand});

        const resetMocks = () => {
            executeCommand.mockReset();
            showErrorMessage.mockReset();
            renameUSSFile.mockReset();
            showInputBox.mockReset();
        };
        const resetNode = (node: ZoweUSSNode) => {
          node.label = "";
          node.shortLabel = "";
        };

        it("should exit if blank input is provided", async () => {
            resetMocks();
            resetNode(ussNode);

            showInputBox.mockReturnValueOnce("");
            await ussNodeActions.renameUSSNode(ussNode, testUSSTree, "file");
            expect(showErrorMessage.mock.calls.length).toBe(0);
            expect(renameUSSFile.mock.calls.length).toBe(0);
            expect(testUSSTree.refreshElement).not.toHaveBeenCalled();
        });
        it("should execute rename USS file and and refresh the tree", async () => {
            resetMocks();
            resetNode(ussNode);

            showInputBox.mockReturnValueOnce("new name");
            await ussNodeActions.renameUSSNode(ussNode, testUSSTree, "file");
            expect(showErrorMessage.mock.calls.length).toBe(0);
            expect(renameUSSFile.mock.calls.length).toBe(1);
        });
        it("should attempt rename USS file but abort with no name", async () => {
            resetMocks();
            resetNode(ussNode);

            showInputBox.mockReturnValueOnce(undefined);
            await ussNodeActions.renameUSSNode(ussNode, testUSSTree, "file");
            expect(testUSSTree.refreshElement).not.toHaveBeenCalled();
        });
        // TODO CHeck this has been duplicated
        // it("should execute rename favorite USS file", async () => {
        //     resetMocks();
        //     resetNode(ussNode);

        //     showInputBox.mockReturnValueOnce("new name");
        //     await ussNodeActions.renameUSSNode(ussFavNode, testUSSTree, "file");
        //     expect(showErrorMessage.mock.calls.length).toBe(0);
        //     expect(renameUSSFile.mock.calls.length).toBe(1);
        //     expect(mockRemoveUSSFavorite.mock.calls.length).toBe(1);
        //     expect(mockAddUSSFavorite.mock.calls.length).toBe(1);
        // });
        it("should attempt to rename USS file but throw an error", async () => {
            resetMocks();
            resetNode(ussNode);

            showInputBox.mockReturnValueOnce("new name");
            renameUSSFile.mockRejectedValueOnce(Error("testError"));
            try {
                await ussNodeActions.renameUSSNode(ussNode, testUSSTree, "file");
                // tslint:disable-next-line:no-empty
            } catch (err) {
            }
            expect(showErrorMessage.mock.calls.length).toBe(1);
        });
        it("should execute rename favorite USS file", async () => {
            showInputBox.mockReturnValueOnce("new name");
            await ussNodeActions.renameUSSNode(ussFavNode, testUSSTree, "file");
            expect(showErrorMessage.mock.calls.length).toBe(0);
            expect(renameUSSFile.mock.calls.length).toBe(1);
            expect(mockRemoveFavorite.mock.calls.length).toBe(1);
            expect(mockAddFavorite.mock.calls.length).toBe(1);
        });
    });
    describe("uploadFile", () => {
        Object.defineProperty(zowe, "Upload", {value: Upload});
        Object.defineProperty(Upload, "fileToUSSFile", {value: fileToUSSFile});
        Object.defineProperty(isbinaryfile, "isBinaryFileSync", {value: isBinaryFileSync});

        it("should call upload dialog and upload not binary file", async () => {
            fileToUSSFile.mockReset();
            const testDoc2: vscode.TextDocument = {
                fileName: path.normalize("/sestest/tmp/foo.txt"),
                uri: null,
                isUntitled: null,
                languageId: null,
                version: null,
                isDirty: null,
                isClosed: null,
                save: null,
                eol: null,
                lineCount: null,
                lineAt: null,
                offsetAt: null,
                positionAt: null,
                getText: null,
                getWordRangeAtPosition: null,
                validateRange: null,
                validatePosition: null
            };

            const fileUri = {fsPath: "/tmp/foo.txt"};
            showOpenDialog.mockReturnValue([fileUri]);
            openTextDocument.mockResolvedValueOnce(testDoc2);
            isBinaryFileSync.mockReturnValueOnce(false);
            await ussNodeActions.uploadDialog(ussNode, testUSSTree);
            expect(showOpenDialog).toBeCalled();
            expect(openTextDocument).toBeCalled();
            expect(testUSSTree.refresh).toBeCalled();
        });
        it("should call upload dialog and upload binary file", async () => {
            showErrorMessage.mockReset();
            fileToUSSFile.mockReset();

            const fileUri = {fsPath: "/tmp/foo.zip"};
            showOpenDialog.mockReturnValue([fileUri]);
            isBinaryFileSync.mockReturnValueOnce(true);
            await ussNodeActions.uploadDialog(ussNode, testUSSTree);

            expect(showOpenDialog).toBeCalled();
            expect(testUSSTree.refresh).toBeCalled();
        });
        it("should attempt to upload USS file but throw an error", async () => {
            showInputBox.mockReturnValueOnce("new name");
            showErrorMessage.mockReset();
            fileToUSSFile.mockReset();
            fileToUSSFile.mockImplementationOnce(() => {
                throw (Error("testError"));
            });
            const testDoc2: vscode.TextDocument = {
                fileName: path.normalize("/sestest/tmp/foo.txt"),
                uri: null,
                isUntitled: null,
                languageId: null,
                version: null,
                isDirty: null,
                isClosed: null,
                save: null,
                eol: null,
                lineCount: null,
                lineAt: null,
                offsetAt: null,
                positionAt: null,
                getText: null,
                getWordRangeAtPosition: null,
                validateRange: null,
                validatePosition: null
            };
            const fileUri = {fsPath: "/tmp/foo.txt"};
            showOpenDialog.mockReturnValue([fileUri]);
            openTextDocument.mockResolvedValueOnce(testDoc2);
            isBinaryFileSync.mockReturnValueOnce(false);

            try {
                await ussNodeActions.uploadDialog(ussNode, testUSSTree);
                // tslint:disable-next-line:no-empty
            } catch (err) {
            }
            expect(showErrorMessage.mock.calls.length).toBe(1);
        });
    });
    describe("copyPath", () => {
        it("should copy the node's full path to the system clipboard", async () => {
            await ussNodeActions.copyPath(ussNode);
            expect(writeText).toBeCalledWith(ussNode.fullPath);
        });
        it("should not copy the node's full path to the system clipboard if theia", async () => {
            let theia = true;
            Object.defineProperty(extension, "ISTHEIA", {get: () => theia});
            await ussNodeActions.copyPath(ussNode);
            expect(writeText).not.toBeCalled();
            theia = false;
        });
    });
});
