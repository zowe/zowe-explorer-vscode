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

import { TreeItemCollapsibleState } from "vscode";
import { PatternDataSource, TreeDataSource } from "../../../../src/trees/dataset/DatasetTableView";
import { ZoweDatasetNode } from "../../../../src/trees/dataset/ZoweDatasetNode";
import { createIProfile, createISession } from "../../../__mocks__/mockCreators/shared";
import { Constants } from "../../../../src/configuration/Constants";
import { Types } from "@zowe/zowe-explorer-api";
import { SharedContext } from "../../../../src/trees/shared/SharedContext";
import { ZoweExplorerApiRegister } from "../../../../src/extending/ZoweExplorerApiRegister";
import { AuthUtils } from "../../../../src/utils/AuthUtils";
import * as imperative from "@zowe/imperative";

describe("TreeDataSource", () => {
    describe("fetchDatasets", () => {
        it("returns a map of data set info based on the cachedChildren property", () => {
            const profile = createIProfile();
            const dsProfileNode = new ZoweDatasetNode({
                label: "sestest",
                collapsibleState: TreeItemCollapsibleState.Expanded,
                contextOverride: Constants.DS_SESSION_CONTEXT,
                profile,
                session: createISession(),
            });
            const dataSets = Array.from({ length: 3 }, (_, i) => ({
                node: new ZoweDatasetNode({
                    label: `DS.EXAMPLE.A${i + 1}`,
                    collapsibleState: TreeItemCollapsibleState.None,
                    parentNode: dsProfileNode,
                    contextOverride: i % 2 === 0 ? Constants.DS_DS_CONTEXT : Constants.DS_PDS_CONTEXT,
                }),
                stats: {
                    dsorg: i % 2 === 0 ? "PS" : "PO",
                    createdDate: new Date(),
                    lrecl: 32,
                    migr: "NO",
                    modifiedDate: new Date(),
                    name: `DS.EXAMPLE.A${i + 1}`,
                    recfm: "VB",
                    user: "USER1",
                    vol: "WRK001",
                },
            }));

            const dsNodes = dataSets.map((ds) => ds.node);
            const getStatsMock = jest
                .spyOn(ZoweDatasetNode.prototype, "getStats")
                .mockImplementation(function (this: ZoweDatasetNode): Types.DatasetStats {
                    return dataSets.find((ds) => ds.node.label === this.label)!.stats;
                });
            dsProfileNode.children = dsNodes;
            const treeDataSource = new TreeDataSource(dsProfileNode, dsProfileNode.children);
            const result = treeDataSource.fetchDataSets();
            expect(result).toEqual(
                dataSets.map((ds) => {
                    const stats: Record<string, any> = { ...ds.stats };
                    const volumes = stats["vols"] ?? stats["vol"];
                    delete stats["vol"];
                    delete stats["vols"];

                    return {
                        volumes,
                        ...stats,
                        isDirectory: ds.stats.dsorg.startsWith("PO"),
                        isMember: SharedContext.isDsMember(ds.node),
                        uri: ds.node.resourceUri?.toString(),
                    };
                })
            );
            expect(getStatsMock).toHaveBeenCalledTimes(dsNodes.length);
            getStatsMock.mockRestore();
        });

        it("returns an empty array for a nonexistent parentId", async () => {
            const profile = createIProfile();
            const profileNode = new ZoweDatasetNode({
                label: "sestest",
                collapsibleState: TreeItemCollapsibleState.Expanded,
                contextOverride: Constants.DS_SESSION_CONTEXT,
                profile,
                session: createISession(),
            });
            profileNode.pattern = "TEST.*";
            const pdsNode = new ZoweDatasetNode({
                label: "TEST.PDS",
                collapsibleState: TreeItemCollapsibleState.Collapsed,
                contextOverride: Constants.DS_PDS_CONTEXT,
                profile,
            });
            const newChildren = [
                new ZoweDatasetNode({
                    label: "MEM1",
                    collapsibleState: TreeItemCollapsibleState.None,
                    profile,
                    parentNode: pdsNode,
                }),
            ];
            profileNode.children = [pdsNode];
            const getChildrenMock = jest.spyOn(pdsNode, "getChildren").mockImplementation((_paginate) => {
                return Promise.resolve(newChildren);
            });
            const treeDataSource = new TreeDataSource(profileNode, profileNode.children);
            const parentId = `zowe-ds:/wrongProfile/${pdsNode.label?.toString()}`;
            const children = await treeDataSource.loadChildren(parentId);
            expect(getChildrenMock).not.toHaveBeenCalledTimes(1);
            expect(children).toEqual([]);
        });
    });

    describe("getTitle", () => {
        it("returns the label if the node is a PDS", () => {
            const pdsNode = new ZoweDatasetNode({
                label: "TEST.PDS",
                collapsibleState: TreeItemCollapsibleState.Collapsed,
                contextOverride: Constants.DS_PDS_CONTEXT,
                profile: createIProfile(),
            });
            pdsNode.children = Array.from(
                { length: 3 },
                (_, i) =>
                    new ZoweDatasetNode({
                        label: `MEM${i + 1}`,
                        collapsibleState: TreeItemCollapsibleState.None,
                        parentNode: pdsNode,
                        profile: createIProfile(),
                        contextOverride: Constants.DS_MEMBER_CONTEXT,
                    })
            );

            const treeDataSource = new TreeDataSource(pdsNode, pdsNode.children);
            expect(treeDataSource.getTitle()).toBe("[sestest]: TEST.PDS");
        });

        it("returns the profile name with the pattern if pattern specified", () => {
            const profileNode = new ZoweDatasetNode({
                label: "sestest",
                collapsibleState: TreeItemCollapsibleState.Collapsed,
                contextOverride: Constants.DS_SESSION_CONTEXT,
                profile: createIProfile(),
                session: createISession(),
            });
            profileNode.pattern = "DS.EXAMPLE.*";
            profileNode.children = Array.from(
                { length: 3 },
                (_, i) =>
                    new ZoweDatasetNode({
                        label: `DS.EXAMPLE.A${i + 1}`,
                        collapsibleState: TreeItemCollapsibleState.None,
                        parentNode: profileNode,
                        profile: createIProfile(),
                        contextOverride: Constants.DS_DS_CONTEXT,
                    })
            );

            const treeDataSource = new TreeDataSource(profileNode, profileNode.children);
            expect(treeDataSource.getTitle()).toBe(`[${profileNode.getProfileName()}]: ${profileNode.pattern}`);
        });
    });

    describe("supportsHierarchy", () => {
        it("returns true if tree node is a profile and one child is a PDS", () => {
            const profileNode = new ZoweDatasetNode({
                label: "sestest",
                collapsibleState: TreeItemCollapsibleState.Expanded,
                contextOverride: Constants.DS_SESSION_CONTEXT,
                profile: createIProfile(),
                session: createISession(),
            });
            profileNode.pattern = "TEST.*";
            profileNode.children = [
                new ZoweDatasetNode({
                    label: "TEST.PDS",
                    collapsibleState: TreeItemCollapsibleState.Collapsed,
                    contextOverride: Constants.DS_PDS_CONTEXT,
                    profile: createIProfile(),
                }),
                new ZoweDatasetNode({
                    label: "TEST.DS",
                    collapsibleState: TreeItemCollapsibleState.None,
                    contextOverride: Constants.DS_DS_CONTEXT,
                    profile: createIProfile(),
                }),
            ];
            const treeDataSource = new TreeDataSource(profileNode, profileNode.children);
            expect(treeDataSource.supportsHierarchy()).toBe(true);
        });

        it("returns false if tree node is not a profile", () => {
            const pdsNode = new ZoweDatasetNode({
                label: "TEST.PDS",
                collapsibleState: TreeItemCollapsibleState.Expanded,
                contextOverride: Constants.DS_PDS_CONTEXT,
                profile: createIProfile(),
            });
            const treeDataSource = new TreeDataSource(pdsNode, pdsNode.children);
            expect(treeDataSource.supportsHierarchy()).toBe(false);
        });

        it("returns false if no PDS child found under profile node", () => {
            const profileNode = new ZoweDatasetNode({
                label: "sestest",
                collapsibleState: TreeItemCollapsibleState.Expanded,
                contextOverride: Constants.DS_SESSION_CONTEXT,
                profile: createIProfile(),
                session: createISession(),
            });
            profileNode.pattern = "TEST.*";
            profileNode.children = [
                new ZoweDatasetNode({
                    label: "TEST.DS1",
                    collapsibleState: TreeItemCollapsibleState.None,
                    contextOverride: Constants.DS_DS_CONTEXT,
                    profile: createIProfile(),
                }),
                new ZoweDatasetNode({
                    label: "TEST.DS2",
                    collapsibleState: TreeItemCollapsibleState.None,
                    contextOverride: Constants.DS_DS_CONTEXT,
                    profile: createIProfile(),
                }),
            ];
            const treeDataSource = new TreeDataSource(profileNode, profileNode.children);
            expect(treeDataSource.supportsHierarchy()).toBe(false);
        });
    });

    describe("loadChildren", () => {
        it("loads children when given a parentId for a matching PDS", async () => {
            const profile = createIProfile();
            const profileNode = new ZoweDatasetNode({
                label: "sestest",
                collapsibleState: TreeItemCollapsibleState.Expanded,
                contextOverride: Constants.DS_SESSION_CONTEXT,
                profile,
                session: createISession(),
            });
            profileNode.pattern = "TEST.*";
            const pdsNode = new ZoweDatasetNode({
                label: "TEST.PDS",
                collapsibleState: TreeItemCollapsibleState.Collapsed,
                contextOverride: Constants.DS_PDS_CONTEXT,
                profile,
            });
            const newChildren = [
                new ZoweDatasetNode({
                    label: "MEM1",
                    collapsibleState: TreeItemCollapsibleState.None,
                    profile,
                    parentNode: pdsNode,
                }),
            ];
            profileNode.children = [pdsNode];
            const getChildrenMock = jest.spyOn(pdsNode, "getChildren").mockImplementation((_paginate) => {
                return Promise.resolve(newChildren);
            });
            const treeDataSource = new TreeDataSource(profileNode, profileNode.children);
            const parentId = `zowe-ds:/${profile.name}/${pdsNode.label?.toString()}`;
            const children = await treeDataSource.loadChildren(parentId);
            expect(getChildrenMock).toHaveBeenCalledTimes(1);
            expect(children).toEqual([
                {
                    name: "MEM1",
                    migr: "NO",
                    uri: "zowe-ds:///sestest/MEM1",
                    isMember: false,
                    isDirectory: false,
                    parentId: "zowe-ds:/sestest/TEST.PDS",
                },
            ]);
        });

        it("returns an empty array for a nonexistent parentId", async () => {
            const profile = createIProfile();
            const profileNode = new ZoweDatasetNode({
                label: "sestest",
                collapsibleState: TreeItemCollapsibleState.Expanded,
                contextOverride: Constants.DS_SESSION_CONTEXT,
                profile,
                session: createISession(),
            });
            profileNode.pattern = "TEST.*";
            const pdsNode = new ZoweDatasetNode({
                label: "TEST.PDS",
                collapsibleState: TreeItemCollapsibleState.Collapsed,
                contextOverride: Constants.DS_PDS_CONTEXT,
                profile,
            });
            const newChildren = [
                new ZoweDatasetNode({
                    label: "MEM1",
                    collapsibleState: TreeItemCollapsibleState.None,
                    profile,
                    parentNode: pdsNode,
                }),
            ];
            profileNode.children = [pdsNode];
            const getChildrenMock = jest.spyOn(pdsNode, "getChildren").mockImplementation((_paginate) => {
                return Promise.resolve(newChildren);
            });
            const treeDataSource = new TreeDataSource(profileNode, profileNode.children);
            const parentId = `zowe-ds:/wrongProfile/${pdsNode.label?.toString()}`;
            const children = await treeDataSource.loadChildren(parentId);
            expect(getChildrenMock).not.toHaveBeenCalledTimes(1);
            expect(children).toEqual([]);
        });
    });
});

describe("PatternDataSource", () => {
    let profile: imperative.IProfileLoaded;
    let getMvsApiMock: jest.SpyInstance;
    let authUtilsMock: jest.SpyInstance;

    beforeEach(() => {
        profile = createIProfile();
        getMvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi");
        authUtilsMock = jest.spyOn(AuthUtils, "handleProfileAuthOnError").mockImplementation(jest.fn());
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("fetchDataSets", () => {
        it("should use dataSetsMatchingPattern when available", async () => {
            const mvsApiMock = {
                dataSetsMatchingPattern: jest.fn().mockResolvedValue({
                    apiResponse: {
                        items: [
                            { dsname: "TEST.A", dsorg: "PO", migr: "no" },
                            { dsname: "TEST.B", dsorg: "PS", lrecl: 80, migr: "no" },
                        ],
                    },
                }),
            };
            getMvsApiMock.mockReturnValue(mvsApiMock as any);
            const patternDataSource = new PatternDataSource(profile, "TEST.*");
            const datasets = await patternDataSource.fetchDataSets();

            expect(getMvsApiMock).toHaveBeenCalledWith(profile);
            expect(mvsApiMock.dataSetsMatchingPattern).toHaveBeenCalledWith(["TEST.*"], { attributes: true });
            expect(datasets).toHaveLength(2);
            expect(datasets[0].name).toBe("TEST.A");
            expect(datasets[0].isDirectory).toBe(true);
            expect(datasets[1].name).toBe("TEST.B");
            expect(datasets[1].isDirectory).toBe(false);
        });

        it("should use dataSet as a fallback", async () => {
            const mvsApiMock = {
                // dataSetsMatchingPattern is undefined
                dataSet: jest
                    .fn()
                    .mockResolvedValueOnce({ apiResponse: [{ dsname: "TEST.A", dsorg: "PO", migr: "no" }] })
                    .mockResolvedValueOnce({ apiResponse: [{ dsname: "TEST.B", dsorg: "PS", lrecl: 80, migr: "no" }] }),
            };
            getMvsApiMock.mockReturnValue(mvsApiMock as any);
            const patternDataSource = new PatternDataSource(profile, "TEST.A, TEST.B");
            const datasets = await patternDataSource.fetchDataSets();

            expect(getMvsApiMock).toHaveBeenCalledWith(profile);
            expect(mvsApiMock.dataSet).toHaveBeenCalledTimes(2);
            expect(mvsApiMock.dataSet).toHaveBeenCalledWith("TEST.A", { attributes: true });
            expect(mvsApiMock.dataSet).toHaveBeenCalledWith("TEST.B", { attributes: true });
            expect(datasets).toHaveLength(2);
        });

        it("should skip VSAM datasets", async () => {
            const mvsApiMock = {
                dataSetsMatchingPattern: jest.fn().mockResolvedValue({
                    apiResponse: {
                        items: [
                            { dsname: "TEST.VSAM", dsorg: "VS" },
                            { dsname: "TEST.PS", dsorg: "PS" },
                        ],
                    },
                }),
            };
            getMvsApiMock.mockReturnValue(mvsApiMock as any);
            const patternDataSource = new PatternDataSource(profile, "TEST.*");
            const datasets = await patternDataSource.fetchDataSets();
            expect(datasets).toHaveLength(1);
            expect(datasets[0].name).toBe("TEST.PS");
        });

        it("should handle API errors", async () => {
            const error = new Error("API Error");
            const mvsApiMock = {
                dataSetsMatchingPattern: jest.fn().mockRejectedValue(error),
            };
            getMvsApiMock.mockReturnValue(mvsApiMock as any);
            const patternDataSource = new PatternDataSource(profile, "TEST.*");

            await expect(patternDataSource.fetchDataSets()).rejects.toThrow("API Error");
            expect(authUtilsMock).toHaveBeenCalledWith(error, profile);
        });
    });

    describe("getTitle", () => {
        it("should return a formatted title", () => {
            const patternDataSource = new PatternDataSource(profile, "MY.PATTERN.*");
            expect(patternDataSource.getTitle()).toBe(`[${profile.name}]: MY.PATTERN.*`);
        });
    });

    describe("supportsHierarchy", () => {
        it("should return true", () => {
            const patternDataSource = new PatternDataSource(profile, "TEST.*");
            expect(patternDataSource.supportsHierarchy()).toBe(true);
        });
    });

    describe("loadChildren", () => {
        it("should load members of a PDS", async () => {
            const mvsApiMock = {
                allMembers: jest.fn().mockResolvedValue({
                    apiResponse: {
                        items: [
                            { member: "MEM1", user: "USER1" },
                            { member: "MEM2", user: "USER2" },
                        ],
                    },
                }),
            };
            getMvsApiMock.mockReturnValue(mvsApiMock as any);

            const patternDataSource = new PatternDataSource(profile, "TEST.PDS");
            const parentId = `zowe-ds:/${profile.name}/TEST.PDS`;
            const children = await patternDataSource.loadChildren(parentId);

            expect(mvsApiMock.allMembers).toHaveBeenCalledWith("TEST.PDS");
            expect(children).toHaveLength(2);
            expect(children[0].name).toBe("MEM1");
            expect(children[0].isMember).toBe(true);
            expect(children[0].parentId).toBe(parentId);
            expect(children[1].name).toBe("MEM2");
        });

        it("should return empty array for invalid parentId", async () => {
            const patternDataSource = new PatternDataSource(profile, "TEST.PDS");
            const children = await patternDataSource.loadChildren("invalid-uri");
            expect(children).toEqual([]);
        });

        it("should handle API errors and return empty array", async () => {
            const error = new Error("API Error");
            const mvsApiMock = {
                allMembers: jest.fn().mockRejectedValue(error),
            };
            getMvsApiMock.mockReturnValue(mvsApiMock as any);

            const patternDataSource = new PatternDataSource(profile, "TEST.PDS");
            const parentId = `zowe-ds:/${profile.name}/TEST.PDS`;
            const children = await patternDataSource.loadChildren(parentId);

            expect(children).toEqual([]);
            expect(authUtilsMock).toHaveBeenCalledWith(error, profile);
        });
    });
});
