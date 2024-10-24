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
import { IZoweTreeNode } from "../../../src/tree/IZoweTreeNode";
import * as imperative from "@zowe/imperative";
import { BaseProvider } from "../../../src";

describe("ZoweTreeNode", () => {
    const makeNode = (
        name: string,
        collapseState: vscode.TreeItemCollapsibleState,
        parent: IZoweTreeNode | ZoweTreeNode | undefined,
        session?: imperative.Session | string | undefined,
        profile?: imperative.IProfileLoaded | string | any
    ): ZoweTreeNode => {
        const node = new ZoweTreeNode(
            name,
            collapseState,
            parent as unknown as IZoweTreeNode,
            session as unknown as imperative.Session,
            profile as unknown as imperative.IProfileLoaded
        );

        return node;
    };

    it("getSession should return session of current node", () => {
        const node = makeNode("test", vscode.TreeItemCollapsibleState.None, undefined);
        node.setSessionToChoice("mySession" as unknown as imperative.Session);
        expect(node.getSession()).toBe("mySession");
    });

    it("getSession should return session of parent node", () => {
        const parentNode = makeNode("test", vscode.TreeItemCollapsibleState.None, undefined, "parentSession");
        const node = makeNode("test", vscode.TreeItemCollapsibleState.None, parentNode);
        expect(node.getSession()).toBe("parentSession");
    });

    it("getProfile should return profile of current node", () => {
        const node = makeNode("test", vscode.TreeItemCollapsibleState.None, undefined);
        node.setProfileToChoice({ name: "myProfile" } as unknown as imperative.IProfileLoaded);
        expect(node.getProfile()).toEqual({ name: "myProfile" });
    });

    it("getProfile should return profile of parent node", () => {
        const parentNode = makeNode("test", vscode.TreeItemCollapsibleState.None, undefined, undefined, { name: "parentProfile" });
        const node = makeNode("test", vscode.TreeItemCollapsibleState.None, parentNode);
        expect(node.getProfile()).toEqual({ name: "parentProfile" });
    });

    it("getProfileName should return profile name of current node", () => {
        const node = makeNode("test", vscode.TreeItemCollapsibleState.None, undefined, undefined, { name: "myProfile" });
        expect(node.getProfileName()).toBe("myProfile");
    });

    it("getProfileName should return profile name of parent node", () => {
        const parentNode = makeNode("test", vscode.TreeItemCollapsibleState.None, undefined, undefined, { name: "parentProfile" });
        const node = makeNode("test", vscode.TreeItemCollapsibleState.None, parentNode, undefined, undefined);
        expect(node.getProfileName()).toBe("parentProfile");
    });

    it("getLabel should return label of current node", () => {
        const node = makeNode("test", vscode.TreeItemCollapsibleState.None, undefined);
        expect(node.getLabel()).toBe("test");
    });

    it("profile and session info should be undefined for empty node", () => {
        const node = makeNode("test", vscode.TreeItemCollapsibleState.None, undefined);
        expect(node.getSession()).toBeUndefined();
        expect(node.getProfile()).toBeUndefined();
        expect(node.getProfileName()).toBeUndefined();
    });

    it("setProfileToChoice should update properties on existing profile object", () => {
        const origProfile: Partial<imperative.IProfileLoaded> = { name: "oldProfile", profile: { host: "example.com" } };
        const node = makeNode("test", vscode.TreeItemCollapsibleState.None, undefined, undefined, origProfile);
        node.setProfileToChoice({ name: "newProfile", profile: { host: "example.com", port: 443 } } as unknown as imperative.IProfileLoaded);
        // Profile properties should be updated in original reference
        expect(node.getProfileName()).toBe("newProfile");
        expect(node.getProfile().profile?.port).toBeDefined();
        expect(origProfile.name).toBe("newProfile");
        expect(origProfile.profile?.port).toBeDefined();
    });
});
