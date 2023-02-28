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

jest.mock("vscode");

import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";
import { getIconById, getIconByNode, IconId } from "../../../src/generators/icons/index";
import { imperative } from "@zowe/cli";
import { DatasetTree } from "../../../src/dataset/DatasetTree";
import * as vscode from "vscode";

describe("Checking icon generator's basics", () => {
    const setGlobalMocks = () => {
        const createTreeView = jest.fn();
        const getConfiguration = jest.fn();

        Object.defineProperty(vscode.window, "createTreeView", { value: createTreeView });
        Object.defineProperty(vscode.workspace, "getConfiguration", { value: getConfiguration });
    };
    const generateTestSessionNode = () => {
        const session = new imperative.Session({
            user: "fake",
            password: "fake",
            hostname: "fake",
            port: 443,
            protocol: "https",
            type: "basic",
        });
        const testTree = new DatasetTree();
        const profile: imperative.IProfileLoaded = {
            name: "aProfile",
            profile: {},
            type: "zosmf",
            message: "",
            failNotFound: false,
        };
        return new ZoweDatasetNode("folder", vscode.TreeItemCollapsibleState.Collapsed, null, session, undefined, undefined, profile);
    };

    setGlobalMocks();

    it("Testing that you can correctly get Icon by ID", () => {
        const targetId = IconId.document;
        const resultIcon = getIconById(IconId.document);

        expect(resultIcon).toBeDefined();
        expect(resultIcon.id).toBe(targetId);
    });
    it("Testing that you you can't get Icon with not existing ID", () => {
        const targetId = "some-not-existing-id";
        const resultIcon = getIconById(targetId as any);

        expect(resultIcon).not.toBeDefined();
    });
    it("Testing that you can correctly get Icon by Node", () => {
        const sessionNode = generateTestSessionNode();
        const resultIcon = getIconByNode(sessionNode);

        expect(resultIcon).toBeDefined();
        expect(resultIcon.id).toBe(IconId.folder);
        expect(resultIcon.path.dark).toContain("folder-closed.svg");
    });
    it("Testing that you can correctly get Derived Icon By Node", () => {
        const sessionNode = generateTestSessionNode();
        sessionNode.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;

        const resultIcon = getIconByNode(sessionNode);

        expect(resultIcon).toBeDefined();
        expect(resultIcon.id).toBe(IconId.folderOpen);
        expect(resultIcon.path.dark).toContain("folder-open.svg");
    });
    it("Testing that you can't get Icon using incorrect Node", () => {
        const randomNode = {};
        const resultIcon = getIconByNode(randomNode);
        expect(resultIcon).not.toBeDefined();
    });
});
