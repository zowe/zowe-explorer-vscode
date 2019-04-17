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

import * as vscode from "vscode";
import { ZoweUSSNode } from "../../src/ZoweUSSNode";
import * as brtimperative from "@brightside/imperative";
import * as brightside from "@brightside/core";
import { createUSSNode, deleteUSSNode, parseUSSPath } from "../../src/uss/ussNodeActions";

const Create = jest.fn();
const Delete = jest.fn();
const uss = jest.fn();
const ussFile = jest.fn();
const mockAddUSSSession = jest.fn();
const mockUSSRefresh = jest.fn();
const mockGetUSSChildren = jest.fn();
const showInputBox = jest.fn();
const showErrorMessage = jest.fn();
const showQuickPick = jest.fn();

function getUSSNode() {
    const ussNode = new ZoweUSSNode("usstest", vscode.TreeItemCollapsibleState.Expanded, null, session, null);
    ussNode.contextValue = "uss_session";
    ussNode.fullPath = "/u/myuser";
    return ussNode;
}

function getUSSTree() {
    const ussNode = getUSSNode();
    const USSTree = jest.fn().mockImplementation(() => {
        return {
            mSessionNodes: [],
            addSession: mockAddUSSSession,
            refresh: mockUSSRefresh,
            getChildren: mockGetUSSChildren,
        };
    });
    const testUSSTree = USSTree();
    testUSSTree.mSessionNodes = [];
    testUSSTree.mSessionNodes.push(ussNode);
    return testUSSTree;
}

const session = new brtimperative.Session({
    user: "fake",
    password: "fake",
    hostname: "fake",
    protocol: "https",
    type: "basic",
});

const ussNode = getUSSNode();
const testUSSTree = getUSSTree();

Object.defineProperty(brightside, "Create", {value: Create});
Object.defineProperty(brightside, "Delete", {value: Delete});
Object.defineProperty(Create, "uss", { value: uss });
Object.defineProperty(Delete, "ussFile", { value: ussFile });
Object.defineProperty(vscode.window, "showInputBox", {value: showInputBox});
Object.defineProperty(vscode.window, "showErrorMessage", {value: showErrorMessage});
Object.defineProperty(vscode.window, "showQuickPick", {value: showQuickPick});

describe("ussNodeActions", async () => {
    beforeEach(() => {
        showErrorMessage.mockReset();
        testUSSTree.refresh.mockReset();
        showQuickPick.mockReset();
    });
    describe("createUSSNode", () => {
        it("createUSSNode is executed successfully", async () => {
            showInputBox.mockReset();
            showInputBox.mockReturnValueOnce("USSFolder");
            await createUSSNode(ussNode, testUSSTree, "file");
            expect(testUSSTree.refresh).toHaveBeenCalled();
            expect(showErrorMessage.mock.calls.length).toBe(0);
        });
        it("createUSSNode does not execute if node name was not entered", async () => {
            showInputBox.mockReset();
            showInputBox.mockReturnValueOnce("");
            await createUSSNode(ussNode, testUSSTree, "file");
            expect(testUSSTree.refresh).not.toHaveBeenCalled();
            expect(showErrorMessage.mock.calls.length).toBe(0);
        });
    })
    describe("deleteUSSNode", () => {
        it("deleteUSSNode is executed successfully", async () => {
            showQuickPick.mockResolvedValueOnce("Yes");
            await deleteUSSNode(ussNode, testUSSTree, "");
            expect(testUSSTree.refresh).toHaveBeenCalled();
        });
        it("should not delete node if user did not verify", async () => {
            showQuickPick.mockResolvedValueOnce("No");
            await deleteUSSNode(ussNode, testUSSTree, "");
            expect(testUSSTree.refresh).not.toHaveBeenCalled();
        });
    });
    describe("parseUSSPath", () => {
        it("should append slash", () => {
            expect(parseUSSPath("/u/user")).toEqual("//u/user");
            expect(parseUSSPath("/test")).toEqual("//test");
            expect(parseUSSPath("/u/kri/dir/dir2")).toEqual("//u/kri/dir/dir2");
        });
        it("should not append slash", () => {
            expect(parseUSSPath("//u/user")).toEqual("//u/user");
            expect(parseUSSPath("//")).toEqual("//");
            expect(parseUSSPath("///")).toEqual("///");
            expect(parseUSSPath("/")).toEqual("/");
            expect(parseUSSPath("")).toEqual("");
            expect(parseUSSPath(undefined)).toEqual(undefined);
            expect(parseUSSPath("//u/kri/dir/dir2")).toEqual("//u/kri/dir/dir2");
        });
    });
});