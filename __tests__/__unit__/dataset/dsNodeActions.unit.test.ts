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
jest.mock("@zowe/cli");
import * as vscode from "vscode";
import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";
import * as brtimperative from "@zowe/imperative";
import * as zowe from "@zowe/cli";
import * as dsNodeActions from "../../../src/dataset/actions";
import { Profiles } from "../../../src/Profiles";
import { FAVORITE_CONTEXT, DS_SESSION_CONTEXT, FAV_SUFFIX } from "../../../src/globals";

jest.mock("vscode");
jest.mock("Session");
jest.mock("@zowe/cli");
jest.mock("@zowe/imperative");
jest.mock("util");
jest.mock("DatasetTree");
jest.mock("USSTree");

const mockRemoveFavorite = jest.fn();
const showInputBox = jest.fn();
const showErrorMessage = jest.fn();
const showInformationMessage = jest.fn();
const showQuickPick = jest.fn();
const getConfiguration = jest.fn();
const existsSync = jest.fn();
const createBasicZosmfSession = jest.fn();
const refreshAll = jest.fn();
const mockcreateZoweSession = jest.fn();
const mockAddHistory  = jest.fn();
const mockGetHistory = jest.fn();
const mockRefresh = jest.fn();
const mockRefreshElement  = jest.fn();
const mockGetChildren = jest.fn();
const mockGetTreeView = jest.fn();
const mockPattern = jest.fn();
const mockInitialize = jest.fn();
const mockRenameFavorite = jest.fn();
const mockUpdateFavorites = jest.fn();
const mockRenameNode = jest.fn();
const mockFindFavoritedNode = jest.fn();
const mockFindNonFavoritedNode = jest.fn();
const mockGetProfileName = jest.fn();
const mockGetSession = jest.fn();
const mockGetProfiles = jest.fn();

const profileOne: brtimperative.IProfileLoaded = {
    name: "profile1",
    profile: {},
    type: "zosmf",
    message: "",
    failNotFound: false
};

function getDSNode() {
    const mParent = new ZoweDatasetNode("parentNode", vscode.TreeItemCollapsibleState.Expanded, null, session, undefined, undefined, profileOne);
    const dsNode = new ZoweDatasetNode("sestest", vscode.TreeItemCollapsibleState.Expanded, mParent, session, undefined, undefined, profileOne);
    dsNode.contextValue = DS_SESSION_CONTEXT;
    dsNode.pattern = "test hlq";
    return dsNode;
}

function getFavoriteDSNode() {
    const mParent = new ZoweDatasetNode("Favorites", vscode.TreeItemCollapsibleState.Expanded, null, session, undefined, undefined, profileOne);
    const dsNodeF = new ZoweDatasetNode("[sestest]: sestest", vscode.TreeItemCollapsibleState.Expanded,
            mParent, session, undefined, undefined, profileOne);
    mParent.contextValue = FAVORITE_CONTEXT;
    dsNodeF.contextValue = DS_SESSION_CONTEXT + FAV_SUFFIX;
    return dsNodeF;
}

function getDSTree() {
    const dsNode1 = getDSNode();
    const dsNodeFav = getFavoriteDSNode();
    const DatasetTree = jest.fn().mockImplementation(() => {
        return {
            log: jest.fn(),
            mSessionNodes: [],
            mFavorites: [],
            addSession: mockcreateZoweSession,
            addHistory: mockAddHistory,
            getHistory: mockGetHistory,
            refresh: mockRefresh,
            refreshAll: mockRefresh,
            refreshElement: mockRefreshElement,
            getChildren: mockGetChildren,
            getTreeView: mockGetTreeView,
            removeFavorite: mockRemoveFavorite,
            enterPattern: mockPattern,
            initializeFavorites: mockInitialize,
            renameFavorite: mockRenameFavorite,
            updateFavorites: mockUpdateFavorites,
            renameNode: mockRenameNode,
            findFavoritedNode: mockFindFavoritedNode,
            findNonFavoritedNode: mockFindNonFavoritedNode,
            getProfileName: mockGetProfileName,
            getSession: mockGetSession,
            getProfiles: mockGetProfiles
        };
    });
    const testDSTree1 = DatasetTree();
    testDSTree1.mSessionNodes = [];
    testDSTree1.mSessionNodes.push(dsNode1);
    return testDSTree1;
}

const session = new brtimperative.Session({
    user: "fake",
    password: "fake",
    hostname: "fake",
    protocol: "https",
    type: "basic",
});

describe("dsNodeActions", () => {

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
    const dsNode = getDSNode();
    const dsFavNode = getFavoriteDSNode();
    const testDSTree = getDSTree();

    Object.defineProperty(dsNodeActions, "RefreshAll", { value: refreshAll });
    Object.defineProperty(vscode.window, "showInputBox", { value: showInputBox });
    Object.defineProperty(vscode.window, "showErrorMessage", { value: showErrorMessage });
    Object.defineProperty(vscode.window, "showQuickPick", { value: showQuickPick });
    Object.defineProperty(vscode.window, "showInformationMessage", {value: showInformationMessage});
    Object.defineProperty(vscode.workspace, "getConfiguration", { value: getConfiguration });
    Object.defineProperty(zowe.ZosmfSession, "createBasicZosmfSession", { value: createBasicZosmfSession});

    beforeEach(() => {
        showErrorMessage.mockReset();
        testDSTree.refresh.mockReset();
        testDSTree.refreshAll.mockReset();
        testDSTree.refreshElement.mockReset();
        showQuickPick.mockReset();
        showInputBox.mockReset();
        existsSync.mockReturnValue(true);
    });
    afterEach(() => {
        jest.resetAllMocks();
    });
    describe("refreshAll", () => {
        it("Testing that refreshAllJobs is executed successfully", async () => {
            Object.defineProperty(Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
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
            const spy = jest.spyOn(dsNodeActions, "refreshAll");
            dsNodeActions.refreshAll(testDSTree);
            expect(spy).toHaveBeenCalledTimes(1);
        });
    });
});
