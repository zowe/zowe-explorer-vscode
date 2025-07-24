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
import { ProfilesCache } from "../../../src/profiles/ProfilesCache";

describe("ZoweTreeNode", () => {
    const innerProfile = { user: "apple", password: "banana" };
    const fakeProfile: imperative.IProfileLoaded = {
        name: "amazingProfile",
        profile: innerProfile,
        message: "",
        type: "zosmf",
        failNotFound: true,
    };

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
        node.setProfileToChoice(fakeProfile);
        expect(node.getProfile().name).toBe("amazingProfile");
    });

    it("getProfile should return profile of parent node", () => {
        const parentNode = makeNode("test", vscode.TreeItemCollapsibleState.None, undefined, undefined, "parentProfile");
        const node = makeNode("test", vscode.TreeItemCollapsibleState.None, parentNode);
        expect(node.getProfile()).toBe("parentProfile");
    });

    describe("getProfile with ProfilesCache dependency injection", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should return loaded profile when ProfilesCache.loadNamedProfile succeeds", () => {
            const node = makeNode("testNode", vscode.TreeItemCollapsibleState.None, undefined);
            node.setProfileToChoice(fakeProfile);

            const loadedProfile = { ...fakeProfile, profile: { ...fakeProfile.profile, user: "newUser" } };
            const mockProfilesCache = {
                loadNamedProfile: jest.fn().mockReturnValue(loadedProfile),
            } as unknown as ProfilesCache;

            const result = node.getProfile(mockProfilesCache);

            expect(mockProfilesCache.loadNamedProfile).toHaveBeenCalledWith("amazingProfile");
            expect(result).toBe(loadedProfile);
        });

        it("should log error and return last known profile when ProfilesCache.loadNamedProfile throws error", () => {
            const node = makeNode("testNode", vscode.TreeItemCollapsibleState.None, undefined);
            node.setProfileToChoice(fakeProfile);

            const mockError = new Error("Profile not found");
            const mockProfilesCache = {
                loadNamedProfile: jest.fn().mockImplementation(() => {
                    throw mockError;
                }),
            } as unknown as ProfilesCache;

            const mockLogger = {
                error: jest.fn(),
            };
            jest.spyOn(imperative.Logger, "getAppLogger").mockReturnValue(mockLogger as any);

            const result = node.getProfile(mockProfilesCache);

            expect(mockProfilesCache.loadNamedProfile).toHaveBeenCalledWith("amazingProfile");
            expect(mockLogger.error).toHaveBeenCalledWith(
                "[ZoweTreeNode.getProfile] Profile amazingProfile does not exist for node testNode, returning last known profile"
            );
            // If the profile no longer exists, we return the last known profile
            expect(result).toStrictEqual(fakeProfile);
        });

        it("should return current profile when profilesCache is undefined", () => {
            const node = makeNode("testNode", vscode.TreeItemCollapsibleState.None, undefined);
            node.setProfileToChoice(fakeProfile);

            const result = node.getProfile(undefined);

            expect(result).toStrictEqual(fakeProfile);
        });

        it("should return current profile when profilesCache.loadNamedProfile is undefined", () => {
            const node = makeNode("testNode", vscode.TreeItemCollapsibleState.None, undefined);
            node.setProfileToChoice(fakeProfile);

            const mockProfilesCache = {} as ProfilesCache;

            const result = node.getProfile(mockProfilesCache);

            expect(result).toStrictEqual(fakeProfile);
        });

        it("should return parent profile when current profile is null and profilesCache throws error", () => {
            const parentNode = makeNode("parentNode", vscode.TreeItemCollapsibleState.None, undefined, undefined, "parentProfile");
            const node = makeNode("testNode", vscode.TreeItemCollapsibleState.None, parentNode);

            const mockProfilesCache = {
                loadNamedProfile: jest.fn().mockImplementation(() => {
                    throw new Error("Profile not found");
                }),
            } as unknown as ProfilesCache;

            const result = node.getProfile(mockProfilesCache);

            expect(mockProfilesCache.loadNamedProfile).toHaveBeenCalled();
            expect(result).toBe("parentProfile");
        });
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
            ...fakeProfile,
        });
        node.setProfileToChoice({ ...fakeProfile, profile: { host: "example.com", port: 443 } });
        expect(node.getProfile().profile?.port).toBeDefined();
    });

    it("setProfileToChoice should update profile for associated FSProvider entry", () => {
        const node = makeNode("test", vscode.TreeItemCollapsibleState.None, undefined);
        node.resourceUri = vscode.Uri.file(__dirname);
        const prof = { ...fakeProfile, profile: { ...innerProfile } };
        const fsEntry = {
            metadata: {
                profile: prof,
            },
        };
        prof.profile.user = "banana";
        prof.profile.password = "apple";
        node.setProfileToChoice(prof);
        expect(node.getProfile().profile?.user).toBe("banana");
        expect(node.getProfile().profile?.password).toBe("apple");
        expect(fsEntry.metadata.profile.profile?.user).toBe("banana");
        expect(fsEntry.metadata.profile.profile?.password).toBe("apple");
    });

    it("setProfileToChoice should update child nodes with the new profile", () => {
        const node = makeNode("test", vscode.TreeItemCollapsibleState.Expanded, undefined);
        node.setProfileToChoice({ ...fakeProfile, profile: { ...fakeProfile.profile, user: "banana" } });
        const nodeChild = makeNode("child", vscode.TreeItemCollapsibleState.None, undefined);
        nodeChild.setProfileToChoice(node.getProfile());
        node.children = [nodeChild as any];
        const fsEntry = {
            metadata: {
                profile: node.getProfile(),
            },
        };
        expect(node.getProfile().profile?.user).toBe("banana");
        expect(nodeChild.getProfile().profile?.user).toBe("banana");
        expect(fsEntry.metadata.profile.profile?.user).toBe("banana");
    });
});
