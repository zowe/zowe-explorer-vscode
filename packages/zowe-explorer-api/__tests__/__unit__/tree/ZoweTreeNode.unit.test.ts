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
        node.setProfileToChoice("myProfile" as unknown as imperative.IProfileLoaded);
        expect(node.getProfile()).toBe("myProfile");
    });

    it("getProfile should return profile of parent node", () => {
        const parentNode = makeNode("test", vscode.TreeItemCollapsibleState.None, undefined, undefined, "parentProfile");
        const node = makeNode("test", vscode.TreeItemCollapsibleState.None, parentNode);
        expect(node.getProfile()).toBe("parentProfile");
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
        const node = makeNode("test", vscode.TreeItemCollapsibleState.None, undefined, undefined, {
            name: "oldProfile",
            profile: { host: "example.com" },
        });
        node.setProfileToChoice({ name: "newProfile", profile: { host: "example.com", port: 443 } } as unknown as imperative.IProfileLoaded);
        // Profile name should not change but properties should
        expect(node.getProfileName()).toBe("oldProfile");
        expect(node.getProfile().profile?.port).toBeDefined();
    });

    it("setProfileToChoice should update profile for associated FSProvider entry", () => {
        const node = makeNode("test", vscode.TreeItemCollapsibleState.None, undefined);
        node.resourceUri = vscode.Uri.file(__dirname);
        const fsEntry = {
            metadata: {
                profile: { name: "oldProfile" },
            },
        };
        node.setProfileToChoice(
            { name: "newProfile" } as unknown as imperative.IProfileLoaded,
            {
                lookup: jest.fn().mockReturnValue(fsEntry),
            } as unknown as BaseProvider
        );
        expect(node.getProfileName()).toBe("newProfile");
        expect(fsEntry.metadata.profile.name).toBe("newProfile");
    });

    it("setProfileToChoice should update child nodes with the new profile", () => {
        const node = makeNode("test", vscode.TreeItemCollapsibleState.Expanded, undefined);
        const nodeChild = makeNode("child", vscode.TreeItemCollapsibleState.None, undefined);
        node.children = [nodeChild as any];
        const setProfileToChoiceChildMock = jest.spyOn(nodeChild, "setProfileToChoice").mockImplementation();
        const fsEntry = {
            metadata: {
                profile: { name: "oldProfile" },
            },
        };
        const mockNewProfile = { name: "newProfile" } as unknown as imperative.IProfileLoaded;
        const mockProvider = {
            lookup: jest.fn().mockReturnValue(fsEntry),
        } as unknown as BaseProvider;
        node.setProfileToChoice(mockNewProfile, mockProvider);
        expect(node.getProfileName()).toBe("newProfile");
        expect(setProfileToChoiceChildMock).toHaveBeenCalledWith(mockNewProfile, mockProvider);
    });
});
