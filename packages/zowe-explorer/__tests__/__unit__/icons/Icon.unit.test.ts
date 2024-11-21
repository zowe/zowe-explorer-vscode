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

import * as vscode from "vscode";
import { imperative } from "@zowe/zowe-explorer-api";
import { ZoweDatasetNode } from "../../../src/trees/dataset/ZoweDatasetNode";
import { IconGenerator } from "../../../src/icons/IconGenerator";
import { ZoweLocalStorage } from "../../../src/tools/ZoweLocalStorage";
import { IconUtils } from "../../../src/icons/IconUtils";

describe("Checking icon generator's basics", () => {
    const setGlobalMocks = () => {
        const createTreeView = jest.fn().mockReturnValue({ onDidCollapseElement: jest.fn() });

        Object.defineProperty(vscode.window, "createTreeView", { value: createTreeView });
        Object.defineProperty(ZoweLocalStorage, "globalState", {
            value: {
                get: () => ({ persistence: true, favorites: [], history: [], sessions: ["zosmf"], searchHistory: [], fileHistory: [] }),
                update: jest.fn(),
                keys: () => [],
            },
            configurable: true,
        });
        jest.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
            get: jest.fn(),
        } as any);
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
        const profile: imperative.IProfileLoaded = {
            name: "aProfile",
            profile: {},
            type: "zosmf",
            message: "",
            failNotFound: false,
        };
        return new ZoweDatasetNode({
            label: "folder",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            session,
            profile,
        });
    };

    setGlobalMocks();

    it("Testing that you can correctly get Icon by ID", () => {
        const targetId = IconUtils.IconId.document;
        const resultIcon = IconGenerator.getIconById(IconUtils.IconId.document);

        expect(resultIcon).toBeDefined();
        expect(resultIcon.id).toBe(targetId);
    });
    it("Testing that you you can't get Icon with not existing ID", () => {
        const targetId = "some-not-existing-id";
        const resultIcon = IconGenerator.getIconById(targetId as any);

        expect(resultIcon).not.toBeDefined();
    });
    it("Testing that you can correctly get Icon by Node", () => {
        const sessionNode = generateTestSessionNode();
        const resultIcon = IconGenerator.getIconByNode(sessionNode);

        expect(resultIcon).toBeDefined();
        expect(resultIcon.id).toBe(IconUtils.IconId.folder);
        expect(resultIcon.path.dark).toContain("folder-closed.svg");
    });
    it("Testing that you can correctly get Derived Icon By Node", () => {
        const sessionNode = generateTestSessionNode();
        sessionNode.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;

        const resultIcon = IconGenerator.getIconByNode(sessionNode);

        expect(resultIcon).toBeDefined();
        expect(resultIcon.id).toBe(IconUtils.IconId.folderOpen);
        expect(resultIcon.path.dark).toContain("folder-open.svg");
    });
    it("Testing that you can't get Icon using incorrect Node", () => {
        const randomNode = {};
        const resultIcon = IconGenerator.getIconByNode(randomNode);
        expect(resultIcon).not.toBeDefined();
    });
});
