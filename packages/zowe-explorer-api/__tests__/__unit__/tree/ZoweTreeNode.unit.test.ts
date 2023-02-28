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
import { ZoweTreeNode } from "../../../src/tree/ZoweTreeNode";

describe("ZoweTreeNode", () => {
    it("getSession should return session of current node", () => {
        const node = new (ZoweTreeNode as any)("test", vscode.TreeItemCollapsibleState.None, undefined);
        node.setSessionToChoice("mySession");
        expect(node.getSession()).toBe("mySession");
    });

    it("getSession should return session of parent node", () => {
        const parentNode = new (ZoweTreeNode as any)("test", vscode.TreeItemCollapsibleState.None, undefined, "parentSession");
        const node = new (ZoweTreeNode as any)("test", vscode.TreeItemCollapsibleState.None, parentNode);
        expect(node.getSession()).toBe("parentSession");
    });

    it("getProfile should return profile of current node", () => {
        const node = new (ZoweTreeNode as any)("test", vscode.TreeItemCollapsibleState.None, undefined);
        node.setProfileToChoice("myProfile");
        expect(node.getProfile()).toBe("myProfile");
    });

    it("getProfile should return profile of parent node", () => {
        const parentNode = new (ZoweTreeNode as any)("test", vscode.TreeItemCollapsibleState.None, undefined, undefined, "parentProfile");
        const node = new (ZoweTreeNode as any)("test", vscode.TreeItemCollapsibleState.None, parentNode);
        expect(node.getProfile()).toBe("parentProfile");
    });

    it("getProfileName should return profile name of current node", () => {
        const node = new (ZoweTreeNode as any)("test", vscode.TreeItemCollapsibleState.None, undefined, undefined, { name: "myProfile" });
        expect(node.getProfileName()).toBe("myProfile");
    });

    it("getProfileName should return profile name of parent node", () => {
        const parentNode = new (ZoweTreeNode as any)("test", vscode.TreeItemCollapsibleState.None, undefined, undefined, { name: "parentProfile" });
        const node = new (ZoweTreeNode as any)("test", vscode.TreeItemCollapsibleState.None, parentNode, undefined, undefined);
        expect(node.getProfileName()).toBe("parentProfile");
    });

    it("getLabel should return label of current node", () => {
        const node = new (ZoweTreeNode as any)("test", vscode.TreeItemCollapsibleState.None, undefined);
        expect(node.getLabel()).toBe("test");
    });

    it("profile and session info should be undefined for empty node", () => {
        const node = new (ZoweTreeNode as any)("test", vscode.TreeItemCollapsibleState.None, undefined);
        expect(node.getSession()).toBeUndefined();
        expect(node.getProfile()).toBeUndefined();
        expect(node.getProfileName()).toBeUndefined();
    });
});
