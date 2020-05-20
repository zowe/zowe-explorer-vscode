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
import { ZoweUSSNode } from "../../../src/uss/ZoweUSSNode";
import { Session, IProfileLoaded } from "@zowe/imperative";
import * as zowe from "@zowe/cli";
import * as ussNodeActions from "../../../src/uss/actions";
import * as globals from "../../../src/globals";
import * as path from "path";
import * as isbinaryfile from "isbinaryfile";
import { Profiles, ValidProfileEnum } from "../../../src/Profiles";

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
const mockRemoveRecall = jest.fn();
const mockAddFavorite = jest.fn();
const mockCheckCurrentProfile = jest.fn();
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
const createBasicZosmfSession = jest.fn();
const isBinaryFileSync = jest.fn();

const profileOne: IProfileLoaded = {
    name: "profile1",
    profile: {},
    type: "zosmf",
    message: "",
    failNotFound: false
};

const session = new Session({
    user: "fake",
    password: "fake",
    hostname: "fake",
    protocol: "https",
    type: "basic",
});

const sessionwocred = new Session({
    user: "",
    password: "",
    hostname: "fake",
    port: 443,
    protocol: "https",
    type: "basic",
});

const sessNode = new ZoweUSSNode("sestest", vscode.TreeItemCollapsibleState.Expanded, null, session, null);
sessNode.contextValue = globals.USS_SESSION_CONTEXT;
const dsNode = new ZoweUSSNode("testSess", vscode.TreeItemCollapsibleState.Expanded, sessNode, sessionwocred, null);
dsNode.contextValue = globals.USS_SESSION_CONTEXT;

function getUSSNode() {
    const mParent = new ZoweUSSNode("parentNode", vscode.TreeItemCollapsibleState.Expanded, null, session, null, false, profileOne.name);
    const ussNode1 = new ZoweUSSNode("usstest", vscode.TreeItemCollapsibleState.Expanded, mParent, session, null, false, profileOne.name);
    ussNode1.contextValue = globals.USS_SESSION_CONTEXT;
    ussNode1.fullPath = "/u/myuser";
    return ussNode1;
}

function getFavoriteUSSNode() {
    const ussNodeF = new ZoweUSSNode("[profile]: usstest", vscode.TreeItemCollapsibleState.Expanded, null, session, null, false, profileOne.name);
    const mParent = new ZoweUSSNode("Favorites", vscode.TreeItemCollapsibleState.Expanded, null, session, null, false, profileOne.name);
    mParent.contextValue = globals.FAVORITE_CONTEXT;
    ussNodeF.contextValue = globals.DS_TEXT_FILE_CONTEXT + globals.FAV_SUFFIX;
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
            removeRecall: mockRemoveRecall,
            checkCurrentProfile: mockCheckCurrentProfile,
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

describe("ussNodeActions", () => {

    const mockLoadNamedProfile = jest.fn();
    mockLoadNamedProfile.mockReturnValue(profileOne);
    Object.defineProperty(Profiles, "getInstance", {
        value: jest.fn(() => {
            return {
                allProfiles: [{name: "firstName"}, {name: "secondName"}],
                defaultProfile: {name: "firstName"},
                type: "zosmf",
                validProfile: ValidProfileEnum.VALID,
                checkCurrentProfile: jest.fn(),
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
    Object.defineProperty(zowe.ZosmfSession, "createBasicZosmfSession", { value: createBasicZosmfSession});

    beforeEach(() => {
        showErrorMessage.mockReset();
        testUSSTree.refresh.mockReset();
        testUSSTree.refreshAll.mockReset();
        testUSSTree.refreshElement.mockReset();
        showQuickPick.mockReset();
        showInputBox.mockReset();
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
                        validProfile: ValidProfileEnum.VALID,
                        checkCurrentProfile: jest.fn(),
                        promptCredentials: jest.fn(()=> {
                            return [{values: "fake"}, {values: "fake"}, {values: "fake"}];
                        }),
                    };
                })
            });
            const dsNode2 = new ZoweUSSNode("testSess", vscode.TreeItemCollapsibleState.Expanded, sessNode,
                sessionwocred, null, false, profileOne.name);

            showInputBox.mockReturnValueOnce("fake");
            showInputBox.mockReturnValueOnce("fake");
            showQuickPick.mockReturnValueOnce("directory");
            await ussNodeActions.createUSSNodeDialog(dsNode2, testUSSTree);

            expect(testUSSTree.refresh).toHaveBeenCalled();

        });

        it("tests the uss create node credentials operation cancelled", async () => {
            showQuickPick.mockReset();
            showInputBox.mockReset();
            showInformationMessage.mockReset();
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
                        validProfile: ValidProfileEnum.VALID,
                        checkCurrentProfile: jest.fn(),
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
            Object.defineProperty(Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [{
                            name: "firstName",
                            profile: {user: undefined, password: undefined}
                        }, {name: "secondName"}],
                        defaultProfile: {name: "firstName"},
                        validProfile: ValidProfileEnum.VALID,
                        checkCurrentProfile: jest.fn(),
                    };
                })
            });

            await ussNodeActions.createUSSNodeDialog(dsNode, testUSSTree);

            expect(testUSSTree.refresh).not.toHaveBeenCalled();
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
            Object.defineProperty(globals, "ISTHEIA", {get: () => theia});
            await ussNodeActions.copyPath(ussNode);
            expect(writeText).not.toBeCalled();
            theia = false;
        });
    });
});
