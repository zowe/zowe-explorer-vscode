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

import { TreeItemCollapsibleState, commands, Uri, ExtensionContext, l10n } from "vscode";
import {
    DatasetTableView,
    PatternDataSource,
    TreeDataSource,
    PDSMembersDataSource,
    buildMemberInfo,
} from "../../../../src/trees/dataset/DatasetTableView";
import { ZoweDatasetNode } from "../../../../src/trees/dataset/ZoweDatasetNode";
import { createIProfile, createISession } from "../../../__mocks__/mockCreators/shared";
import { Constants } from "../../../../src/configuration/Constants";
import { Gui, Table, Types, TableViewProvider, Sorting, TableBuilder } from "@zowe/zowe-explorer-api";
import { SharedContext } from "../../../../src/trees/shared/SharedContext";
import { ZoweExplorerApiRegister } from "../../../../src/extending/ZoweExplorerApiRegister";
import { AuthUtils } from "../../../../src/utils/AuthUtils";
import { SharedTreeProviders } from "../../../../src/trees/shared/SharedTreeProviders";
import { SharedUtils } from "../../../../src/trees/shared/SharedUtils";
import { ProfileManagement } from "../../../../src/management/ProfileManagement";
import { Profiles } from "../../../../src/configuration/Profiles";
import { ZoweExplorerExtender } from "../../../../src/extending/ZoweExplorerExtender";
import * as imperative from "@zowe/imperative";

jest.mock("../../../../src/tools/ZoweLocalStorage");

describe("TreeDataSource", () => {
    describe("fetchDatasets", () => {
        it("returns a map of data set info based on the result of getChildren", async () => {
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
                getStatsMock: jest.fn(),
            }));

            const dsNodes = dataSets.map((ds) => ds.node);
            const getStatsMock = jest
                .spyOn(ZoweDatasetNode.prototype, "getStats")
                .mockImplementation(function (this: ZoweDatasetNode): Types.DatasetStats {
                    return dataSets.find((ds) => ds.node.label === this.label)?.stats as Types.DatasetStats;
                });
            dsProfileNode.children = dsNodes;
            const getChildrenMock = jest.spyOn(dsProfileNode, "getChildren").mockImplementation((_paginate) => {
                return Promise.resolve(dsNodes);
            });
            const treeDataSource = new TreeDataSource(dsProfileNode);
            const result = await treeDataSource.fetchDataSets();
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
            expect(getChildrenMock).toHaveBeenCalledTimes(1);
            expect(getChildrenMock).toHaveBeenCalledWith(false);
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
            const loadNamedProfile = jest.fn().mockResolvedValue(profile);
            const profilesMock = jest.spyOn(Profiles, "getInstance").mockReturnValue({
                loadNamedProfile,
            } as any);
            const treeDataSource = new TreeDataSource(profileNode);
            const parentId = `zowe-ds:/wrongProfile/${pdsNode.label?.toString()}`;
            const children = await treeDataSource.loadChildren(parentId);
            expect(getChildrenMock).not.toHaveBeenCalledTimes(1);
            expect(children).toEqual([]);
            expect(profilesMock).toHaveBeenCalled();
            expect(loadNamedProfile).toHaveBeenCalledWith("sestest");
            profilesMock.mockRestore();
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
            const getProfileNameMock = jest.spyOn(pdsNode, "getProfileName").mockReturnValue("sestest");
            const treeDataSource = new TreeDataSource(pdsNode);
            expect(treeDataSource.getTitle()).toBe("[sestest]: TEST.PDS");
            expect(getProfileNameMock).toHaveBeenCalledTimes(1);
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

            const treeDataSource = new TreeDataSource(profileNode);
            expect(treeDataSource.getTitle()).toBe(`[${profileNode.getProfileName()}]: ${profileNode.pattern}`);
        });
    });

    describe("supportsHierarchy", () => {
        it("returns true if tree node is a profile and one child is a PDS", async () => {
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
            const treeDataSource = new TreeDataSource(profileNode);
            const getChildrenMock = jest.spyOn(profileNode, "getChildren").mockImplementation((_paginate) => {
                return Promise.resolve(profileNode.children);
            });
            expect(await treeDataSource.supportsHierarchy()).toBe(true);
            expect(getChildrenMock).toHaveBeenCalledTimes(1);
            expect(getChildrenMock).toHaveBeenCalledWith(false);
        });

        it("returns false if tree node is not a profile", async () => {
            const pdsNode = new ZoweDatasetNode({
                label: "TEST.PDS",
                collapsibleState: TreeItemCollapsibleState.Expanded,
                contextOverride: Constants.DS_PDS_CONTEXT,
                profile: createIProfile(),
            });
            const treeDataSource = new TreeDataSource(pdsNode);
            const getChildrenMock = jest.spyOn(pdsNode, "getChildren").mockImplementation((_paginate) => {
                return Promise.resolve(pdsNode.children);
            });
            expect(await treeDataSource.supportsHierarchy()).toBe(false);
            expect(getChildrenMock).not.toHaveBeenCalledTimes(1);
        });

        it("returns false if no PDS child found under profile node", async () => {
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
            const treeDataSource = new TreeDataSource(profileNode);
            const getChildrenMock = jest.spyOn(profileNode, "getChildren").mockImplementation((_paginate) => {
                return Promise.resolve(profileNode.children);
            });
            expect(await treeDataSource.supportsHierarchy()).toBe(false);
            expect(getChildrenMock).toHaveBeenCalledTimes(1);
            expect(getChildrenMock).toHaveBeenCalledWith(false);
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
            const pdsMember = new ZoweDatasetNode({
                label: "MEM1",
                collapsibleState: TreeItemCollapsibleState.None,
                contextOverride: Constants.DS_MEMBER_CONTEXT,
                profile,
                parentNode: pdsNode,
            });
            const newChildren = [pdsMember];
            jest.spyOn(pdsMember, "getStats").mockReturnValue({
                migr: "NO",
                user: "USER1",
                createdDate: new Date(),
                modifiedDate: new Date(),
            } as Types.DatasetStats);
            profileNode.children = [pdsNode];
            const getChildrenMock = jest.spyOn(profileNode, "getChildren").mockImplementation((_paginate) => {
                return Promise.resolve(profileNode.children);
            });
            const pdsGetChildrenMock = jest.spyOn(pdsNode, "getChildren").mockImplementation((_paginate) => {
                return Promise.resolve(newChildren);
            });
            const treeDataSource = new TreeDataSource(profileNode);
            const parentId = `zowe-ds:/${profile.name}/${pdsNode.label?.toString()}`;
            const children = await treeDataSource.loadChildren(parentId);
            expect(getChildrenMock).toHaveBeenCalledTimes(1);
            expect(getChildrenMock).toHaveBeenCalledWith(false);
            expect(pdsGetChildrenMock).toHaveBeenCalledTimes(1);
            expect(pdsGetChildrenMock).toHaveBeenCalledWith(false);
            expect(children).toEqual([
                expect.objectContaining({
                    name: "MEM1",
                    migr: "NO",
                    uri: "zowe-ds:///sestest/TEST.PDS/MEM1",
                    isMember: true,
                    isDirectory: false,
                    parentId: "zowe-ds:/sestest/TEST.PDS",
                }),
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
            const loadNamedProfile = jest.fn().mockResolvedValue(profile);
            const profilesMock = jest.spyOn(Profiles, "getInstance").mockReturnValue({
                loadNamedProfile,
            } as any);
            const getChildrenMock = jest.spyOn(pdsNode, "getChildren").mockImplementation((_paginate) => {
                return Promise.resolve(newChildren);
            });
            const treeDataSource = new TreeDataSource(profileNode);
            const parentId = `zowe-ds:/wrongProfile/${pdsNode.label?.toString()}`;
            const children = await treeDataSource.loadChildren(parentId);
            expect(getChildrenMock).not.toHaveBeenCalledTimes(1);
            expect(children).toEqual([]);
            expect(loadNamedProfile).toHaveBeenCalledWith("sestest");
            profilesMock.mockRestore();
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

            expect(mvsApiMock.allMembers).toHaveBeenCalledWith("TEST.PDS", { attributes: true });
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

        it("should return empty array when datasetName is falsy", async () => {
            const patternDataSource = new PatternDataSource(profile, "TEST.PDS");
            // Test with URI that has empty dataset name (ends with slash)
            const parentIdWithEmptyName = `zowe-ds:/${profile.name}/`;
            const children = await patternDataSource.loadChildren(parentIdWithEmptyName);
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

describe("PDSMembersDataSource", () => {
    let profile: imperative.IProfileLoaded;
    let getMvsApiMock: jest.SpyInstance;
    let authUtilsMock: jest.SpyInstance;
    let parentDataSource: PatternDataSource;
    let pdsName: string;
    let pdsUri: string;

    beforeEach(() => {
        profile = createIProfile();
        getMvsApiMock = jest.spyOn(ZoweExplorerApiRegister, "getMvsApi");
        authUtilsMock = jest.spyOn(AuthUtils, "handleProfileAuthOnError").mockImplementation(jest.fn());
        parentDataSource = new PatternDataSource(profile, "TEST.*");
        pdsName = "TEST.PDS";
        pdsUri = `zowe-ds:/${profile.name}/TEST.PDS`;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("getParentDataSource", () => {
        it("should return the parent data source", () => {
            const pdsDataSource = new PDSMembersDataSource(parentDataSource, pdsName, pdsUri, profile);

            const result = pdsDataSource.getParentDataSource();

            expect(result).toBe(parentDataSource);
        });

        it("should return null when parent data source is null", () => {
            const pdsDataSource = new PDSMembersDataSource(null, pdsName, pdsUri, profile);

            const result = pdsDataSource.getParentDataSource();

            expect(result).toBeNull();
        });
    });

    describe("fetchDataSets", () => {
        it("should return result of loadChildren when parentDataSource is PatternDataSource with loadChildren", async () => {
            const expectedMembers = [
                { name: "MEM1", isMember: true, parentId: pdsUri },
                { name: "MEM2", isMember: true, parentId: pdsUri },
            ];

            jest.spyOn(parentDataSource, "loadChildren").mockResolvedValue(expectedMembers);

            const pdsDataSource = new PDSMembersDataSource(parentDataSource, pdsName, pdsUri, profile);

            const result = await pdsDataSource.fetchDataSets();

            expect(parentDataSource.loadChildren).toHaveBeenCalledWith(pdsUri);
            expect(result).toEqual(expectedMembers);
        });

        it("should use API fallback when parentDataSource is not PatternDataSource", async () => {
            const treeDataSource = new TreeDataSource({} as any);

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

            const pdsDataSource = new PDSMembersDataSource(treeDataSource, pdsName, pdsUri, profile);

            const result = await pdsDataSource.fetchDataSets();

            expect(getMvsApiMock).toHaveBeenCalledWith(profile);
            expect(mvsApiMock.allMembers).toHaveBeenCalledWith(pdsName, { attributes: true });
            expect(result).toHaveLength(2);
            expect(result[0].name).toBe("MEM1");
            expect(result[0].isMember).toBe(true);
            expect(result[1].name).toBe("MEM2");
            expect(result[1].isMember).toBe(true);
        });

        it("should use API fallback when parentDataSource does not have loadChildren method", async () => {
            const parentWithoutLoadChildren = {
                fetchDataSets: jest.fn(),
                getTitle: jest.fn(),
                supportsHierarchy: jest.fn(),
                getParentDataSource: jest.fn(),
            };

            const mvsApiMock = {
                allMembers: jest.fn().mockResolvedValue({
                    apiResponse: {
                        items: [{ member: "MEM1", user: "USER1" }],
                    },
                }),
            };
            getMvsApiMock.mockReturnValue(mvsApiMock as any);

            const pdsDataSource = new PDSMembersDataSource(parentWithoutLoadChildren, pdsName, pdsUri, profile);

            const result = await pdsDataSource.fetchDataSets();

            expect(getMvsApiMock).toHaveBeenCalledWith(profile);
            expect(mvsApiMock.allMembers).toHaveBeenCalledWith(pdsName, { attributes: true });
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe("MEM1");
        });

        it("should return empty array when API call fails and handle auth error", async () => {
            const error = new Error("API Error");
            const mvsApiMock = {
                allMembers: jest.fn().mockRejectedValue(error),
            };
            getMvsApiMock.mockReturnValue(mvsApiMock as any);

            const pdsDataSource = new PDSMembersDataSource(null, pdsName, pdsUri, profile);

            const result = await pdsDataSource.fetchDataSets();

            expect(result).toEqual([]);
            expect(authUtilsMock).toHaveBeenCalledWith(error, profile);
        });

        it("should return empty array when API response has no items", async () => {
            const mvsApiMock = {
                allMembers: jest.fn().mockResolvedValue({
                    apiResponse: {
                        items: null,
                    },
                }),
            };
            getMvsApiMock.mockReturnValue(mvsApiMock as any);

            const pdsDataSource = new PDSMembersDataSource(null, pdsName, pdsUri, profile);

            const result = await pdsDataSource.fetchDataSets();

            expect(result).toEqual([]);
        });

        it("should return empty array when API response has empty items array", async () => {
            const mvsApiMock = {
                allMembers: jest.fn().mockResolvedValue({
                    apiResponse: {
                        items: [],
                    },
                }),
            };
            getMvsApiMock.mockReturnValue(mvsApiMock as any);

            const pdsDataSource = new PDSMembersDataSource(null, pdsName, pdsUri, profile);

            const result = await pdsDataSource.fetchDataSets();

            expect(result).toEqual([]);
        });
    });

    describe("supportsHierarchy", () => {
        it("should return false as members don't have children", () => {
            const pdsDataSource = new PDSMembersDataSource(parentDataSource, pdsName, pdsUri, profile);

            const result = pdsDataSource.supportsHierarchy();

            expect(result).toBe(false);
        });
    });
});

describe("DatasetTableView", () => {
    let datasetTableView: DatasetTableView;

    beforeEach(() => {
        // Reset the singleton instance
        (DatasetTableView as any)._instance = undefined;
        datasetTableView = DatasetTableView.getInstance();
    });

    describe("getInstance", () => {
        it("should return a singleton instance", () => {
            const instance1 = DatasetTableView.getInstance();
            const instance2 = DatasetTableView.getInstance();
            expect(instance1).toBe(instance2);
            expect(instance1).toBeInstanceOf(DatasetTableView);
        });
    });

    describe("isDsMemberUri", () => {
        it("should return true for member URIs", () => {
            const memberUri = "zowe-ds:/profile/DATASET.NAME/MEMBER";
            const result = (datasetTableView as any).isDsMemberUri(memberUri);
            expect(result).toBe(true);
        });

        it("should return false for dataset URIs", () => {
            const datasetUri = "zowe-ds:/profile/DATASET.NAME";
            const result = (datasetTableView as any).isDsMemberUri(datasetUri);
            expect(result).toBe(false);
        });

        it("should return false for session URIs", () => {
            const sessionUri = "zowe-ds:/profile";
            const result = (datasetTableView as any).isDsMemberUri(sessionUri);
            expect(result).toBe(false);
        });

        it("should return true for member URIs with deeply nested datasets", () => {
            const memberUri = "zowe-ds:/profile/VERY.LONG.DATASET.NAME/MEMBER";
            const result = (datasetTableView as any).isDsMemberUri(memberUri);
            expect(result).toBe(true);
        });

        it("should return false for malformed URIs", () => {
            const malformedUri = "invalid-uri";
            const result = (datasetTableView as any).isDsMemberUri(malformedUri);
            expect(result).toBe(false);
        });

        it("should return false for URIs with no profile", () => {
            const noProfileUri = "zowe-ds:/";
            const result = (datasetTableView as any).isDsMemberUri(noProfileUri);
            expect(result).toBe(false);
        });
    });

    describe("mapDatasetInfoToRow", () => {
        it("should map dataset info to table row data with ISO date strings", () => {
            const datasetInfo = {
                name: "TEST.DATASET",
                dsorg: "PS",
                createdDate: new Date("2025-01-01T10:00:00Z"),
                modifiedDate: new Date("2025-01-02T15:30:00Z"),
                lrecl: "80",
                migr: "NO",
                recfm: "FB",
                volumes: "VOL001",
                user: "USER1",
                uri: "zowe-ds:/profile/TEST.DATASET",
                isMember: false,
                isDirectory: false,
            };

            const result = (datasetTableView as any).mapDatasetInfoToRow(datasetInfo);

            expect(result).toEqual({
                dsname: "TEST.DATASET",
                dsorg: "PS",
                createdDate: datasetInfo.createdDate.toISOString(),
                modifiedDate: datasetInfo.modifiedDate.toISOString(),
                lrecl: "80",
                migr: "NO",
                recfm: "FB",
                volumes: "VOL001",
                uri: "zowe-ds:/profile/TEST.DATASET",
                user: "USER1",
                cnorc: undefined,
                inorc: undefined,
                mnorc: undefined,
                mod: undefined,
                sclm: undefined,
                vers: undefined,
            });
        });

        it("should use ISO format for dates to ensure locale-independent sorting", () => {
            const datasetInfo = {
                name: "TEST.DATASET",
                dsorg: "PS",
                createdDate: new Date("2025-06-15T10:00:00Z"),
                modifiedDate: new Date("2025-07-20T15:30:00Z"),
                uri: "zowe-ds:/profile/TEST.DATASET",
                isMember: false,
                isDirectory: false,
            };

            const result = (datasetTableView as any).mapDatasetInfoToRow(datasetInfo);

            // Verify dates are in ISO format (parseable by new Date())
            expect(result.createdDate).toBe("2025-06-15T10:00:00.000Z");
            expect(result.modifiedDate).toBe("2025-07-20T15:30:00.000Z");

            // Verify ISO strings can be reliably parsed back to Date objects
            expect(new Date(result.createdDate).getTime()).toBe(datasetInfo.createdDate.getTime());
            expect(new Date(result.modifiedDate).getTime()).toBe(datasetInfo.modifiedDate.getTime());
        });

        it("should handle missing optional fields", () => {
            const datasetInfo = {
                name: "TEST.DATASET",
                uri: "zowe-ds:/profile/TEST.DATASET",
                isMember: false,
                isDirectory: false,
            };

            const result = (datasetTableView as any).mapDatasetInfoToRow(datasetInfo);

            expect(result).toEqual({
                dsname: "TEST.DATASET",
                dsorg: "",
                createdDate: undefined,
                modifiedDate: undefined,
                lrecl: undefined,
                migr: undefined,
                recfm: undefined,
                volumes: undefined,
                uri: "zowe-ds:/profile/TEST.DATASET",
            });
        });
    });

    describe("mapDatasetInfoToRowWithTree", () => {
        it("should map dataset info to tree row data for PDS", () => {
            const datasetInfo = {
                name: "TEST.PDS",
                dsorg: "PO",
                uri: "zowe-ds:/profile/TEST.PDS",
                isMember: false,
                isDirectory: true,
            };

            const result = (datasetTableView as any).mapDatasetInfoToRowWithTree(datasetInfo);

            expect(result).toMatchObject({
                dsname: "TEST.PDS",
                dsorg: "PO",
                uri: "zowe-ds:/profile/TEST.PDS",
                _tree: {
                    id: "zowe-ds:/profile/TEST.PDS",
                    parentId: undefined,
                    depth: 0,
                    hasChildren: true,
                    isExpanded: false,
                },
            });
        });

        it("should map dataset info to tree row data for member", () => {
            const datasetInfo = {
                name: "MEMBER1",
                uri: "zowe-ds:/profile/TEST.PDS/MEMBER1",
                isMember: true,
                isDirectory: false,
                parentId: "zowe-ds:/profile/TEST.PDS",
            };

            const result = (datasetTableView as any).mapDatasetInfoToRowWithTree(datasetInfo);

            expect(result).toMatchObject({
                dsname: "MEMBER1",
                uri: "zowe-ds:/profile/TEST.PDS/MEMBER1",
                _tree: {
                    id: "zowe-ds:/profile/TEST.PDS/MEMBER1",
                    parentId: "zowe-ds:/profile/TEST.PDS",
                    depth: 1,
                    hasChildren: false,
                    isExpanded: false,
                },
            });
        });

        it("should use ISO format for dates to ensure locale-independent sorting", () => {
            const datasetInfo = {
                name: "TEST.PDS",
                dsorg: "PO",
                createdDate: new Date("2025-03-10T08:00:00Z"),
                modifiedDate: new Date("2025-04-15T12:45:00Z"),
                uri: "zowe-ds:/profile/TEST.PDS",
                isMember: false,
                isDirectory: true,
            };

            const result = (datasetTableView as any).mapDatasetInfoToRowWithTree(datasetInfo);

            // Verify dates are in ISO format (parseable by new Date())
            expect(result.createdDate).toBe("2025-03-10T08:00:00.000Z");
            expect(result.modifiedDate).toBe("2025-04-15T12:45:00.000Z");

            // Verify ISO strings can be reliably parsed back to Date objects
            expect(new Date(result.createdDate).getTime()).toBe(datasetInfo.createdDate.getTime());
            expect(new Date(result.modifiedDate).getTime()).toBe(datasetInfo.modifiedDate.getTime());
        });
    });

    describe("date column valueFormatters", () => {
        it("createdDate valueFormatter should format ISO string to locale date string using userLocale", () => {
            // Set the userLocale to ensure consistent behavior
            (datasetTableView as any).userLocale = "en";

            const expectedFields = (datasetTableView as any).expectedFields;
            const createdDateField = expectedFields.find((field: any) => field.field === "createdDate");

            expect(createdDateField).toBeDefined();
            expect(createdDateField.valueFormatter).toBeDefined();

            const isoDateString = "2025-06-15T10:00:00.000Z";
            const result = createdDateField.valueFormatter({ value: isoDateString });

            // Verify the formatter returns a locale-formatted date string using userLocale
            expect(result).toBe(new Date(isoDateString).toLocaleDateString("en-US"));
        });

        it("modifiedDate valueFormatter should format ISO string to locale date-time string using userLocale", () => {
            // Set the userLocale to ensure consistent behavior
            (datasetTableView as any).userLocale = "en-US";

            const expectedFields = (datasetTableView as any).expectedFields;
            const modifiedDateField = expectedFields.find((field: any) => field.field === "modifiedDate");

            expect(modifiedDateField).toBeDefined();
            expect(modifiedDateField.valueFormatter).toBeDefined();

            const isoDateString = "2025-07-20T15:30:00.000Z";
            const result = modifiedDateField.valueFormatter({ value: isoDateString });

            // Verify the formatter returns a locale-formatted date-time string using userLocale
            expect(result).toBe(new Date(isoDateString).toLocaleString("en"));
        });

        it("valueFormatters should return empty string for null/undefined values", () => {
            const expectedFields = (datasetTableView as any).expectedFields;
            const createdDateField = expectedFields.find((field: any) => field.field === "createdDate");
            const modifiedDateField = expectedFields.find((field: any) => field.field === "modifiedDate");

            expect(createdDateField.valueFormatter({ value: null })).toBe("");
            expect(createdDateField.valueFormatter({ value: undefined })).toBe("");
            expect(modifiedDateField.valueFormatter({ value: null })).toBe("");
            expect(modifiedDateField.valueFormatter({ value: undefined })).toBe("");
        });

        it("createdDate valueFormatter should respect non-en-US locale (de-DE)", () => {
            // Set the userLocale to German
            (datasetTableView as any).userLocale = "de";

            const expectedFields = (datasetTableView as any).expectedFields;
            const createdDateField = expectedFields.find((field: any) => field.field === "createdDate");

            const isoDateString = "2025-06-15T10:00:00.000Z";
            const result = createdDateField.valueFormatter({ value: isoDateString });

            // Verify the formatter uses the German locale format
            expect(result).toBe(new Date(isoDateString).toLocaleDateString("de"));
        });

        it("modifiedDate valueFormatter should respect non-en-US locale (fr-FR)", () => {
            // Set the userLocale to French
            (datasetTableView as any).userLocale = "fr";

            const expectedFields = (datasetTableView as any).expectedFields;
            const modifiedDateField = expectedFields.find((field: any) => field.field === "modifiedDate");

            const isoDateString = "2025-07-20T15:30:00.000Z";
            const result = modifiedDateField.valueFormatter({ value: isoDateString });

            // Verify the formatter uses the French locale format
            expect(result).toBe(new Date(isoDateString).toLocaleString("fr"));
        });

        it("createdDate valueFormatter should respect Traditional Chinese locale (zh-TW)", () => {
            // Set the userLocale to Traditional Chinese
            (datasetTableView as any).userLocale = "zh-TW";

            const expectedFields = (datasetTableView as any).expectedFields;
            const createdDateField = expectedFields.find((field: any) => field.field === "createdDate");

            const isoDateString = "2025-06-15T10:00:00.000Z";
            const result = createdDateField.valueFormatter({ value: isoDateString });

            // Verify the formatter uses the Traditional Chinese locale format
            expect(result).toBe(new Date(isoDateString).toLocaleDateString("zh-TW"));
        });
    });

    describe("generateRows", () => {
        it("should generate rows in tree mode", async () => {
            const mockDataSource = {
                fetchDataSets: jest.fn().mockResolvedValue([
                    {
                        name: "TEST.PDS",
                        dsorg: "PO",
                        uri: "zowe-ds:/profile/TEST.PDS",
                        isMember: false,
                        isDirectory: true,
                    },
                ]),
                supportsHierarchy: jest.fn().mockReturnValue(true),
            };

            (datasetTableView as any).currentDataSource = mockDataSource;
            const result = await (datasetTableView as any).generateRows(true);

            expect(result).toHaveLength(1);
            expect(result[0]).toHaveProperty("_tree");
            expect(mockDataSource.fetchDataSets).toHaveBeenCalled();
        });

        it("should generate rows in flat mode", async () => {
            const mockDataSource = {
                fetchDataSets: jest.fn().mockResolvedValue([
                    {
                        name: "TEST.DATASET",
                        dsorg: "PS",
                        uri: "zowe-ds:/profile/TEST.DATASET",
                        isMember: false,
                        isDirectory: false,
                    },
                ]),
                supportsHierarchy: jest.fn().mockReturnValue(false),
            };

            (datasetTableView as any).currentDataSource = mockDataSource;
            const result = await (datasetTableView as any).generateRows(false);

            expect(result).toHaveLength(1);
            expect(result[0]).not.toHaveProperty("_tree");
            expect(mockDataSource.fetchDataSets).toHaveBeenCalled();
        });
    });

    describe("openInEditor", () => {
        let executeCommandSpy: jest.SpyInstance;

        beforeEach(() => {
            executeCommandSpy = jest.spyOn(commands, "executeCommand").mockResolvedValue(undefined);
        });

        afterEach(() => {
            executeCommandSpy.mockRestore();
        });

        it("should open a single data set in the editor", async () => {
            const rows: Record<number, Table.RowData> = {
                0: { uri: "zowe-ds:/profile/DATA.SET.NAME" },
            };

            await (DatasetTableView as any).openInEditor(null, rows);

            expect(executeCommandSpy).toHaveBeenCalledTimes(1);
            expect(executeCommandSpy).toHaveBeenCalledWith("vscode.open", Uri.parse("zowe-ds:/profile/DATA.SET.NAME"), { preview: false });
        });

        it("should open multiple data sets in the editor", async () => {
            const rows: Record<number, Table.RowData> = {
                0: { uri: "zowe-ds:/profile/DATA.SET.NAME1" },
                1: { uri: "zowe-ds:/profile/DATA.SET.NAME2" },
            };

            await (DatasetTableView as any).openInEditor(null, rows);

            expect(executeCommandSpy).toHaveBeenCalledTimes(2);
            expect(executeCommandSpy).toHaveBeenCalledWith("vscode.open", Uri.parse("zowe-ds:/profile/DATA.SET.NAME1"), { preview: false });
            expect(executeCommandSpy).toHaveBeenCalledWith("vscode.open", Uri.parse("zowe-ds:/profile/DATA.SET.NAME2"), { preview: false });
        });

        it("should do nothing for an empty list of rows", async () => {
            const rows: Record<number, Table.RowData> = {};

            await (DatasetTableView as any).openInEditor(null, rows);

            expect(executeCommandSpy).not.toHaveBeenCalled();
        });
    });

    describe("displayInTree", () => {
        let mockTreeView: any;
        let mockProfileNode: ZoweDatasetNode;
        let mockPdsNode: ZoweDatasetNode;
        let mockMemberNode: ZoweDatasetNode;
        let mockFavProfileNode: ZoweDatasetNode;
        let mockFavPdsNode: ZoweDatasetNode;
        let mockFavMemberNode: ZoweDatasetNode;

        beforeEach(() => {
            mockTreeView = {
                reveal: jest.fn().mockResolvedValue(undefined),
            };

            const profile = createIProfile();

            // Session nodes setup
            mockProfileNode = new ZoweDatasetNode({
                label: "sestest",
                collapsibleState: TreeItemCollapsibleState.Expanded,
                contextOverride: Constants.DS_SESSION_CONTEXT,
                profile,
                session: createISession(),
            });

            mockPdsNode = new ZoweDatasetNode({
                label: "TEST.PDS",
                collapsibleState: TreeItemCollapsibleState.Collapsed,
                contextOverride: Constants.DS_PDS_CONTEXT,
                profile,
            });

            mockMemberNode = new ZoweDatasetNode({
                label: "MEMBER1",
                collapsibleState: TreeItemCollapsibleState.None,
                contextOverride: Constants.DS_MEMBER_CONTEXT,
                profile,
                parentNode: mockPdsNode,
            });

            mockProfileNode.children = [mockPdsNode];
            mockPdsNode.children = [mockMemberNode];

            // Favorites nodes setup
            mockFavProfileNode = new ZoweDatasetNode({
                label: "sestest",
                collapsibleState: TreeItemCollapsibleState.Collapsed,
                contextOverride: Constants.FAV_PROFILE_CONTEXT,
                profile,
                session: createISession(),
            });

            mockFavPdsNode = new ZoweDatasetNode({
                label: "FAV.PDS",
                collapsibleState: TreeItemCollapsibleState.Collapsed,
                contextOverride: Constants.DS_PDS_CONTEXT + Constants.FAV_SUFFIX,
                profile,
                parentNode: mockFavProfileNode,
            });

            mockFavMemberNode = new ZoweDatasetNode({
                label: "FAVMEMBER",
                collapsibleState: TreeItemCollapsibleState.None,
                contextOverride: Constants.DS_MEMBER_CONTEXT,
                profile,
                parentNode: mockFavPdsNode,
            });

            mockFavProfileNode.children = [mockFavPdsNode];
            mockFavPdsNode.children = [mockFavMemberNode];

            jest.spyOn(SharedTreeProviders, "ds", "get").mockReturnValue({
                mSessionNodes: [mockProfileNode],
                mFavorites: [mockFavProfileNode],
                getTreeView: () => mockTreeView,
            } as any);
        });

        it("should reveal member in tree for member URI found in session nodes", async () => {
            const mockGetChildren = jest.spyOn(mockProfileNode, "getChildren").mockResolvedValue(mockProfileNode.children);
            const mockPdsGetChildren = jest.spyOn(mockPdsNode, "getChildren").mockResolvedValue(mockPdsNode.children);

            const rowInfo: Table.RowInfo = {
                row: {
                    uri: "zowe-ds:/sestest/TEST.PDS/MEMBER1",
                },
                index: 0,
            };

            await DatasetTableView.displayInTree(null as any, rowInfo);

            expect(mockGetChildren).toHaveBeenCalled();
            expect(mockPdsGetChildren).toHaveBeenCalled();
            expect(mockTreeView.reveal).toHaveBeenCalledWith(mockMemberNode, { focus: true });
        });

        it("should reveal dataset in tree for dataset URI found in session nodes", async () => {
            const mockGetChildren = jest.spyOn(mockProfileNode, "getChildren").mockResolvedValue(mockProfileNode.children);

            const rowInfo: Table.RowInfo = {
                row: {
                    uri: "zowe-ds:/sestest/TEST.PDS",
                },
                index: 0,
            };

            await DatasetTableView.displayInTree(null as any, rowInfo);

            expect(mockGetChildren).toHaveBeenCalled();
            expect(mockTreeView.reveal).toHaveBeenCalledWith(mockPdsNode, { expand: true });
        });

        it("should reveal member in tree for member URI found in favorites when not in session nodes", async () => {
            const mockGetChildren = jest.spyOn(mockProfileNode, "getChildren").mockResolvedValue([]);
            const mockFavGetChildren = jest.spyOn(mockFavProfileNode, "getChildren").mockResolvedValue(mockFavProfileNode.children);
            const mockFavPdsGetChildren = jest.spyOn(mockFavPdsNode, "getChildren").mockResolvedValue(mockFavPdsNode.children);

            const rowInfo: Table.RowInfo = {
                row: {
                    uri: "zowe-ds:/sestest/FAV.PDS/FAVMEMBER",
                },
                index: 0,
            };

            await DatasetTableView.displayInTree(null as any, rowInfo);

            expect(mockGetChildren).toHaveBeenCalled();
            expect(mockFavGetChildren).toHaveBeenCalled();
            expect(mockFavPdsGetChildren).toHaveBeenCalled();
            expect(mockTreeView.reveal).toHaveBeenCalledWith(mockFavMemberNode, { focus: true });
        });

        it("should reveal dataset in tree for dataset URI found in favorites when not in session nodes", async () => {
            const mockGetChildren = jest.spyOn(mockProfileNode, "getChildren").mockResolvedValue([]);
            const mockFavGetChildren = jest.spyOn(mockFavProfileNode, "getChildren").mockResolvedValue(mockFavProfileNode.children);

            const rowInfo: Table.RowInfo = {
                row: {
                    uri: "zowe-ds:/sestest/FAV.PDS",
                },
                index: 0,
            };

            await DatasetTableView.displayInTree(null as any, rowInfo);

            expect(mockGetChildren).toHaveBeenCalled();
            expect(mockFavGetChildren).toHaveBeenCalled();
            expect(mockTreeView.reveal).toHaveBeenCalledWith(mockFavPdsNode, { expand: true });
        });

        it("should handle member with tree data found in session nodes", async () => {
            const mockGetChildren = jest.spyOn(mockProfileNode, "getChildren").mockResolvedValue(mockProfileNode.children);
            const mockPdsGetChildren = jest.spyOn(mockPdsNode, "getChildren").mockResolvedValue(mockPdsNode.children);

            const rowInfo: Table.RowInfo = {
                row: {
                    uri: "zowe-ds:/sestest/TEST.PDS/MEMBER1",
                    _tree: {
                        parentId: "zowe-ds:/sestest/TEST.PDS",
                        id: "zowe-ds:/sestest/TEST.PDS/MEMBER1",
                    },
                },
                index: 0,
            };

            await DatasetTableView.displayInTree(null as any, rowInfo);

            expect(mockGetChildren).toHaveBeenCalled();
            expect(mockPdsGetChildren).toHaveBeenCalled();
            expect(mockTreeView.reveal).toHaveBeenCalledWith(mockMemberNode, { focus: true });
        });

        it("should handle member with tree data found in favorites when not in session nodes", async () => {
            const mockGetChildren = jest.spyOn(mockProfileNode, "getChildren").mockResolvedValue([]);
            const mockFavGetChildren = jest.spyOn(mockFavProfileNode, "getChildren").mockResolvedValue(mockFavProfileNode.children);
            const mockFavPdsGetChildren = jest.spyOn(mockFavPdsNode, "getChildren").mockResolvedValue(mockFavPdsNode.children);

            const rowInfo: Table.RowInfo = {
                row: {
                    uri: "zowe-ds:/sestest/FAV.PDS/FAVMEMBER",
                    _tree: {
                        parentId: "zowe-ds:/sestest/FAV.PDS",
                        id: "zowe-ds:/sestest/FAV.PDS/FAVMEMBER",
                    },
                },
                index: 0,
            };

            await DatasetTableView.displayInTree(null as any, rowInfo);

            expect(mockGetChildren).toHaveBeenCalled();
            expect(mockFavGetChildren).toHaveBeenCalled();
            expect(mockFavPdsGetChildren).toHaveBeenCalled();
            expect(mockTreeView.reveal).toHaveBeenCalledWith(mockFavMemberNode, { focus: true });
        });

        it("should handle case when profile not found in session nodes or favorites", async () => {
            jest.spyOn(mockProfileNode, "getChildren").mockResolvedValue([]);

            // Mock empty favorites
            jest.spyOn(SharedTreeProviders, "ds", "get").mockReturnValue({
                mSessionNodes: [],
                mFavorites: [],
                getTreeView: () => mockTreeView,
            } as any);

            const rowInfo: Table.RowInfo = {
                row: {
                    uri: "zowe-ds:/nonexistent/TEST.PDS/MEMBER1",
                },
                index: 0,
            };

            await DatasetTableView.displayInTree(null as any, rowInfo);

            expect(mockTreeView.reveal).not.toHaveBeenCalled();
        });

        it("should handle case when dataset not found in profile children", async () => {
            const mockGetChildren = jest.spyOn(mockProfileNode, "getChildren").mockResolvedValue([]);
            const mockFavGetChildren = jest.spyOn(mockFavProfileNode, "getChildren").mockResolvedValue([]);

            const rowInfo: Table.RowInfo = {
                row: {
                    uri: "zowe-ds:/sestest/NONEXISTENT.DS",
                },
                index: 0,
            };

            await DatasetTableView.displayInTree(null as any, rowInfo);

            expect(mockGetChildren).toHaveBeenCalled();
            expect(mockFavGetChildren).toHaveBeenCalled();
            expect(mockTreeView.reveal).not.toHaveBeenCalled();
        });

        it("should handle case when member not found in PDS children", async () => {
            const mockGetChildren = jest.spyOn(mockProfileNode, "getChildren").mockResolvedValue([mockPdsNode]);
            const mockPdsGetChildren = jest.spyOn(mockPdsNode, "getChildren").mockResolvedValue([]);
            const mockFavGetChildren = jest.spyOn(mockFavProfileNode, "getChildren").mockResolvedValue([mockFavPdsNode]);
            const mockFavPdsGetChildren = jest.spyOn(mockFavPdsNode, "getChildren").mockResolvedValue([]);

            const rowInfo: Table.RowInfo = {
                row: {
                    uri: "zowe-ds:/sestest/TEST.PDS/NONEXISTENT",
                },
                index: 0,
            };

            await DatasetTableView.displayInTree(null as any, rowInfo);

            expect(mockGetChildren).toHaveBeenCalled();
            expect(mockPdsGetChildren).toHaveBeenCalled();
            expect(mockFavGetChildren).toHaveBeenCalled();
            // PDS members should not be listed through favorites in this case since it was found in session nodes
            expect(mockFavPdsGetChildren).not.toHaveBeenCalled();
            expect(mockTreeView.reveal).not.toHaveBeenCalled();
        });

        it("should prioritize session nodes over favorites when node exists in both", async () => {
            // Setup session nodes with a dataset that exists
            const mockGetChildren = jest.spyOn(mockProfileNode, "getChildren").mockResolvedValue([mockPdsNode]);
            const mockPdsGetChildren = jest.spyOn(mockPdsNode, "getChildren").mockResolvedValue([mockMemberNode]);

            // Setup favorites with a dataset of the same name
            const mockFavGetChildren = jest.spyOn(mockFavProfileNode, "getChildren").mockResolvedValue([mockFavPdsNode]);
            const mockFavPdsGetChildren = jest.spyOn(mockFavPdsNode, "getChildren").mockResolvedValue([mockFavMemberNode]);

            const rowInfo: Table.RowInfo = {
                row: {
                    uri: "zowe-ds:/sestest/TEST.PDS/MEMBER1",
                },
                index: 0,
            };

            await DatasetTableView.displayInTree(null as any, rowInfo);

            // Should reveal from session nodes, not favorites
            expect(mockGetChildren).toHaveBeenCalled();
            expect(mockPdsGetChildren).toHaveBeenCalled();
            expect(mockTreeView.reveal).toHaveBeenCalledWith(mockMemberNode, { focus: true });

            // Favorites should not be searched since it was found in session nodes
            expect(mockFavGetChildren).not.toHaveBeenCalled();
            expect(mockFavPdsGetChildren).not.toHaveBeenCalled();
        });
    });

    describe("handleCommand", () => {
        let mockContext: ExtensionContext;
        let mockNode: ZoweDatasetNode;
        let mockTableViewProvider: any;

        beforeEach(() => {
            mockContext = {
                extensionPath: "/mock/extension/path",
            } as ExtensionContext;
            const profile = createIProfile();
            mockNode = new ZoweDatasetNode({
                label: "sestest",
                collapsibleState: TreeItemCollapsibleState.Expanded,
                contextOverride: Constants.DS_SESSION_CONTEXT,
                profile,
                session: createISession(),
            });

            mockTableViewProvider = {
                setTableView: jest.fn().mockResolvedValue(undefined),
            };

            jest.spyOn(TableViewProvider, "getInstance").mockReturnValue(mockTableViewProvider);
            jest.spyOn(SharedUtils, "getSelectedNodeList").mockReturnValue([mockNode]);
            jest.spyOn(SharedTreeProviders, "ds", "get").mockReturnValue({
                filterPrompt: jest.fn().mockResolvedValue(undefined),
            } as any);
            jest.spyOn(commands, "executeCommand").mockResolvedValue(undefined);
        });

        it("should handle session node command", async () => {
            mockNode.pattern = "TEST.*";
            mockNode.children = [];
            jest.spyOn(SharedContext, "isSession").mockReturnValue(true);
            jest.spyOn(SharedContext, "isPds").mockReturnValue(false);
            jest.spyOn(SharedContext, "isInformation").mockReturnValue(false);
            const loadNamedProfile = jest.fn().mockResolvedValue(createIProfile());
            const profilesMock = jest.spyOn(Profiles, "getInstance").mockReturnValue({
                loadNamedProfile,
            } as any);

            await datasetTableView.handleCommand(mockContext, mockNode, [mockNode]);

            expect(mockTableViewProvider.setTableView).toHaveBeenCalled();
            expect(loadNamedProfile).toHaveBeenCalledWith("sestest");
            profilesMock.mockRestore();
        });

        it("should handle PDS node command", async () => {
            jest.spyOn(SharedContext, "isSession").mockReturnValue(false);
            jest.spyOn(SharedContext, "isPds").mockReturnValue(true);
            jest.spyOn(SharedContext, "isInformation").mockReturnValue(false);
            mockNode.children = [];

            await datasetTableView.handleCommand(mockContext, mockNode, [mockNode]);

            expect(mockTableViewProvider.setTableView).toHaveBeenCalled();
        });

        it("should show error for invalid node type", async () => {
            jest.spyOn(SharedContext, "isSession").mockReturnValue(false);
            jest.spyOn(SharedContext, "isPds").mockReturnValue(false);
            const infoMessageSpy = jest.spyOn(Gui, "infoMessage").mockResolvedValue(undefined);

            await datasetTableView.handleCommand(mockContext, mockNode, [mockNode]);

            expect(infoMessageSpy).toHaveBeenCalledWith(expect.stringContaining("This action is only supported for session and PDS nodes"));
        });

        it("should show error for multiple selected nodes", async () => {
            const mockNode2 = new ZoweDatasetNode({
                label: "sestest2",
                collapsibleState: TreeItemCollapsibleState.Expanded,
                contextOverride: Constants.DS_SESSION_CONTEXT,
                profile: createIProfile(),
                session: createISession(),
            });

            jest.spyOn(SharedUtils, "getSelectedNodeList").mockReturnValue([mockNode, mockNode2]);
            const infoMessageSpy = jest.spyOn(Gui, "infoMessage").mockResolvedValue(undefined);

            await datasetTableView.handleCommand(mockContext, mockNode, [mockNode, mockNode2]);

            expect(infoMessageSpy).toHaveBeenCalledWith(expect.stringContaining("Please select a single profile or PDS"));
        });
    });

    describe("handlePatternSearch", () => {
        let mockContext: ExtensionContext;
        let mockTableViewProvider: any;

        beforeEach(() => {
            mockContext = {
                extensionPath: "/mock/extension/path",
            } as ExtensionContext;
            mockTableViewProvider = {
                setTableView: jest.fn().mockResolvedValue(undefined),
            };

            jest.spyOn(TableViewProvider, "getInstance").mockReturnValue(mockTableViewProvider);
            jest.spyOn(commands, "executeCommand").mockResolvedValue(undefined);
        });

        it("should handle pattern search successfully", async () => {
            const mockProfile = createIProfile();
            const loadNamedProfileMock = jest.fn().mockReturnValue(mockProfile);
            const profilesMock = jest.spyOn(Profiles, "getInstance").mockReturnValue({
                loadNamedProfile: loadNamedProfileMock,
            } as any);
            jest.spyOn(ProfileManagement, "getRegisteredProfileNameList").mockReturnValue(["sestest"]);
            jest.spyOn(Gui, "showQuickPick").mockResolvedValue("sestest" as any);
            jest.spyOn(Gui, "showInputBox").mockResolvedValue("TEST.*");

            await datasetTableView.handlePatternSearch(mockContext);

            expect(mockTableViewProvider.setTableView).toHaveBeenCalled();
            expect(commands.executeCommand).toHaveBeenCalledWith("zowe-resources.focus");
            expect(loadNamedProfileMock).toHaveBeenCalledWith("sestest");
            profilesMock.mockRestore();
        });

        it("should handle no profiles available", async () => {
            jest.spyOn(ProfileManagement, "getRegisteredProfileNameList").mockReturnValue([]);
            const infoMessageSpy = jest.spyOn(Gui, "infoMessage").mockResolvedValue(undefined);

            await datasetTableView.handlePatternSearch(mockContext);

            expect(infoMessageSpy).toHaveBeenCalledWith("No profiles available.");
            expect(mockTableViewProvider.setTableView).not.toHaveBeenCalled();
        });

        it("should handle cancelled profile selection", async () => {
            jest.spyOn(ProfileManagement, "getRegisteredProfileNameList").mockReturnValue(["sestest"]);
            jest.spyOn(Gui, "showQuickPick").mockResolvedValue(undefined);

            await datasetTableView.handlePatternSearch(mockContext);

            expect(mockTableViewProvider.setTableView).not.toHaveBeenCalled();
        });

        it("should handle cancelled pattern input", async () => {
            jest.spyOn(ProfileManagement, "getRegisteredProfileNameList").mockReturnValue(["sestest"]);
            jest.spyOn(Gui, "showQuickPick").mockResolvedValue("sestest" as any);
            jest.spyOn(Gui, "showInputBox").mockResolvedValue(undefined);

            await datasetTableView.handlePatternSearch(mockContext);

            expect(mockTableViewProvider.setTableView).not.toHaveBeenCalled();
        });

        it("should handle profile not found error", async () => {
            const loadNamedProfileMock = jest.fn().mockReturnValue(undefined);
            const profilesMock = jest.spyOn(Profiles, "getInstance").mockReturnValue({
                loadNamedProfile: loadNamedProfileMock,
            } as any);
            jest.spyOn(ProfileManagement, "getRegisteredProfileNameList").mockReturnValue(["sestest"]);
            jest.spyOn(Gui, "showQuickPick").mockResolvedValue("sestest" as any);
            jest.spyOn(Gui, "showInputBox").mockResolvedValue("TEST.*");
            const errorMessageSpy = jest.spyOn(Gui, "errorMessage").mockResolvedValue(undefined);

            await datasetTableView.handlePatternSearch(mockContext);

            expect(errorMessageSpy).toHaveBeenCalledWith("Profile sestest not found.");
            expect(mockTableViewProvider.setTableView).not.toHaveBeenCalled();
            expect(loadNamedProfileMock).toHaveBeenCalledWith("sestest");
            profilesMock.mockRestore();
        });
    });

    describe("selectAndAddProfile", () => {
        beforeEach(() => {
            jest.spyOn(SharedTreeProviders, "ds", "get").mockReturnValue({
                mSessionNodes: [],
                addSingleSession: jest.fn().mockResolvedValue(undefined),
            } as any);
        });

        it("should select and add a profile successfully", async () => {
            const mockProfile = createIProfile();
            const mockProfileNode = new ZoweDatasetNode({
                label: "sestest",
                collapsibleState: TreeItemCollapsibleState.Expanded,
                contextOverride: Constants.DS_SESSION_CONTEXT,
                profile: mockProfile,
                session: createISession(),
            });
            const loadNamedProfileMock = jest.fn().mockReturnValue(mockProfile);
            const profilesMock = jest.spyOn(Profiles, "getInstance").mockReturnValue({
                loadNamedProfile: loadNamedProfileMock,
            } as any);

            jest.spyOn(ProfileManagement, "getRegisteredProfileNameList").mockReturnValue(["sestest"]);
            jest.spyOn(Gui, "showQuickPick").mockResolvedValue("sestest" as any);

            const sessionNodes: ZoweDatasetNode[] = [];
            // Mock the tree provider to return the profile node after adding
            const mockTreeProvider = {
                mSessionNodes: sessionNodes,
                addSingleSession: jest.fn().mockImplementation((_p) => {
                    sessionNodes.push(mockProfileNode);
                    return Promise.resolve(undefined);
                }),
            };
            jest.spyOn(SharedTreeProviders, "ds", "get").mockReturnValue(mockTreeProvider as any);
            jest.spyOn(mockProfileNode, "getChildren").mockResolvedValue([]);

            const result = await (datasetTableView as any).selectAndAddProfile();

            expect(result).toBe(mockProfileNode);
            expect(mockTreeProvider.addSingleSession).toHaveBeenCalledWith(mockProfile);
            expect(loadNamedProfileMock).toHaveBeenCalledWith("sestest");
            profilesMock.mockRestore();
        });

        it("should handle no profiles available", async () => {
            jest.spyOn(ProfileManagement, "getRegisteredProfileNameList").mockReturnValue([]);
            const infoMessageSpy = jest.spyOn(Gui, "infoMessage").mockResolvedValue(undefined);

            const result = await (datasetTableView as any).selectAndAddProfile();

            expect(result).toBeUndefined();
            expect(infoMessageSpy).toHaveBeenCalledWith("No profiles available.");
        });

        it("should handle cancelled selection", async () => {
            jest.spyOn(ProfileManagement, "getRegisteredProfileNameList").mockReturnValue(["sestest"]);
            jest.spyOn(Gui, "showQuickPick").mockResolvedValue(null as any);

            const result = await (datasetTableView as any).selectAndAddProfile();

            expect(result).toBeUndefined();
        });
    });

    describe("DatasetTableView", () => {
        let xDatasetTableView: DatasetTableView;

        beforeEach(() => {
            // Reset the singleton instance
            (DatasetTableView as any)._instance = undefined;
            xDatasetTableView = DatasetTableView.getInstance();
        });

        // ... existing tests

        describe("generateTable", () => {
            let mockContext: ExtensionContext;
            let mockDataSource: any;
            let mockExtender: any;
            let mockTableInstance: jest.Mocked<Table.Instance>;

            beforeEach(() => {
                mockContext = {
                    extensionPath: "/mock/extension/path",
                } as ExtensionContext;

                // Create a mock table instance for this test suite
                mockTableInstance = {
                    getPinnedRows: jest.fn().mockResolvedValue([]),
                    getGridState: jest.fn().mockResolvedValue({}),
                    setGridState: jest.fn().mockResolvedValue(true),
                    setPinnedRows: jest.fn().mockResolvedValue(true),
                    pinRows: jest.fn().mockResolvedValue(true),
                    unpinRows: jest.fn().mockResolvedValue(true),
                    setPage: jest.fn().mockResolvedValue(true),
                    waitForAPI: jest.fn().mockResolvedValue(true),
                    setTitle: jest.fn(),
                    setColumns: jest.fn(),
                    setContent: jest.fn(),
                    setOptions: jest.fn(),
                    onDisposed: jest.fn(),
                    onDidReceiveMessage: jest.fn(),
                } as unknown as jest.Mocked<Table.Instance>;

                mockDataSource = {
                    fetchDataSets: jest.fn().mockResolvedValue([
                        {
                            name: "TEST.DATASET",
                            dsorg: "PS",
                            uri: "zowe-ds:/profile/TEST.DATASET",
                            isMember: false,
                            isDirectory: false,
                        },
                    ]),
                    getTitle: jest.fn().mockReturnValue("Test Title"),
                    supportsHierarchy: jest.fn().mockReturnValue(false),
                    buildTable: jest.fn(),
                };

                mockExtender = {
                    getTableProviderRegistry: jest.fn().mockReturnValue({
                        getActions: jest.fn().mockResolvedValue([]),
                        getContextMenuItems: jest.fn().mockResolvedValue([]),
                    }),
                };

                jest.spyOn(ZoweExplorerExtender, "getInstance").mockReturnValue(mockExtender);

                // Mock TableBuilder constructor to return our mockTableBuilder
                jest.spyOn(TableBuilder.prototype, "options").mockImplementation(function () {
                    return this;
                });
                jest.spyOn(TableBuilder.prototype, "isView").mockImplementation(function () {
                    return this;
                });
                jest.spyOn(TableBuilder.prototype, "title").mockImplementation(function () {
                    return this;
                });
                jest.spyOn(TableBuilder.prototype, "addRows").mockImplementation(function () {
                    return this;
                });
                jest.spyOn(TableBuilder.prototype, "columns").mockImplementation(function () {
                    return this;
                });
                jest.spyOn(TableBuilder.prototype, "addContextOption").mockImplementation(function () {
                    return this;
                });
                jest.spyOn(TableBuilder.prototype, "addRowAction").mockImplementation(function () {
                    return this;
                });
                jest.spyOn(TableBuilder.prototype, "build").mockImplementation(() => mockTableInstance);

                (xDatasetTableView as any).currentDataSource = mockDataSource;
            });

            it("should always generate a new table", async () => {
                const result = await (xDatasetTableView as any).generateTable(mockContext);

                expect(result).toBeDefined();
                expect(mockDataSource.fetchDataSets).toHaveBeenCalled();
                expect(mockDataSource.getTitle).toHaveBeenCalled();
                expect(mockDataSource.supportsHierarchy).toHaveBeenCalled();
                expect(result).toBe(mockTableInstance);
            });

            it("should add both displayInTree and pinRow context options", async () => {
                const addContextOptionSpy = jest.spyOn(TableBuilder.prototype, "addContextOption");

                await (xDatasetTableView as any).generateTable(mockContext);

                // Verify that addContextOption was called with the correct parameters
                const calls = addContextOptionSpy.mock.calls;
                expect(calls).toEqual(
                    expect.arrayContaining([
                        ["all", (xDatasetTableView as any).contextOptions.displayInTree],
                        ["all", (xDatasetTableView as any).contextOptions.pinRow],
                    ])
                );
            });

            it("should set up tree mode when data source supports hierarchy", async () => {
                mockDataSource.supportsHierarchy.mockReturnValue(true);
                mockDataSource.loadChildren = jest.fn().mockResolvedValue([]);

                const result = await (xDatasetTableView as any).generateTable(mockContext);

                expect(result).toBeDefined();
                expect(mockDataSource.supportsHierarchy).toHaveBeenCalled();
            });

            it("should handle data source error during fetchDataSets", async () => {
                const errorDataSource = {
                    fetchDataSets: jest.fn().mockRejectedValue(new Error("Fetch error")),
                    getTitle: jest.fn().mockReturnValue("Error Title"),
                    supportsHierarchy: jest.fn().mockReturnValue(false),
                };

                (xDatasetTableView as any).currentDataSource = errorDataSource;

                await expect((xDatasetTableView as any).generateTable(mockContext)).rejects.toThrow("Fetch error");
            });

            it("should capture system locale as userLocale at table build time", async () => {
                // Mock Intl.DateTimeFormat to return a specific locale
                const originalDateTimeFormat = Intl.DateTimeFormat;
                const mockResolvedOptions = jest.fn().mockReturnValue({ locale: "fr-FR" });
                (global as any).Intl.DateTimeFormat = jest.fn().mockImplementation(() => ({
                    resolvedOptions: mockResolvedOptions,
                }));

                await (xDatasetTableView as any).generateTable(mockContext);

                // Verify that userLocale was captured from Intl.DateTimeFormat
                expect((xDatasetTableView as any).userLocale).toBe("fr-FR");

                // Restore original Intl.DateTimeFormat
                (global as any).Intl.DateTimeFormat = originalDateTimeFormat;
            });

            it("should use captured locale for date formatting in table columns", async () => {
                // Mock Intl.DateTimeFormat to return German locale
                const originalDateTimeFormat = Intl.DateTimeFormat;
                const mockResolvedOptions = jest.fn().mockReturnValue({ locale: "de-DE" });
                (global as any).Intl.DateTimeFormat = jest.fn().mockImplementation(() => ({
                    resolvedOptions: mockResolvedOptions,
                }));

                await (xDatasetTableView as any).generateTable(mockContext);

                // Get the valueFormatter for createdDate
                const expectedFields = (xDatasetTableView as any).expectedFields;
                const createdDateField = expectedFields.find((field: any) => field.field === "createdDate");

                const isoDateString = "2025-06-15T10:00:00.000Z";
                const result = createdDateField.valueFormatter({ value: isoDateString });

                // Verify the formatter uses the German locale
                expect(result).toBe(new Date(isoDateString).toLocaleDateString("de-DE"));

                // Restore original Intl.DateTimeFormat
                (global as any).Intl.DateTimeFormat = originalDateTimeFormat;
            });
        });

        describe("prepareAndDisplayTable", () => {
            let mockContext: ExtensionContext;
            let mockNode: ZoweDatasetNode;
            let mockTableViewProvider: any;

            beforeEach(() => {
                mockContext = {
                    extensionPath: "/mock/extension/path",
                } as ExtensionContext;
                const profile = createIProfile();
                mockNode = new ZoweDatasetNode({
                    label: "sestest",
                    collapsibleState: TreeItemCollapsibleState.Expanded,
                    contextOverride: Constants.DS_SESSION_CONTEXT,
                    profile,
                    session: createISession(),
                });

                mockTableViewProvider = {
                    setTableView: jest.fn().mockResolvedValue(undefined),
                };

                jest.spyOn(TableViewProvider, "getInstance").mockReturnValue(mockTableViewProvider);
                jest.spyOn(SharedTreeProviders, "ds", "get").mockReturnValue({
                    filterPrompt: jest.fn().mockResolvedValue(undefined),
                } as any);
                jest.spyOn(commands, "executeCommand").mockResolvedValue(undefined);
            });

            it("should prepare and display table for session node", async () => {
                mockNode.pattern = "TEST.*";
                mockNode.children = [];
                jest.spyOn(SharedContext, "isSession").mockReturnValue(true);
                jest.spyOn(SharedContext, "isPds").mockReturnValue(false);
                jest.spyOn(SharedContext, "isInformation").mockReturnValue(false);

                const profilesMock = jest.spyOn(Profiles, "getInstance").mockReturnValue({
                    loadNamedProfile: jest.fn().mockResolvedValue(createIProfile()),
                } as any);
                await (xDatasetTableView as any).prepareAndDisplayTable(mockContext, mockNode);

                expect(mockTableViewProvider.setTableView).toHaveBeenCalled();
                expect(commands.executeCommand).toHaveBeenCalledWith("zowe-resources.focus");
                profilesMock.mockRestore();
            });

            it("should call filterPrompt for session node without pattern", async () => {
                mockNode.pattern = "";
                mockNode.children = [];
                jest.spyOn(SharedContext, "isSession").mockReturnValue(true);
                jest.spyOn(SharedContext, "isPds").mockReturnValue(false);
                jest.spyOn(SharedContext, "isInformation").mockReturnValue(false);

                const filterPromptSpy = jest.spyOn(SharedTreeProviders.ds, "filterPrompt");

                await (xDatasetTableView as any).prepareAndDisplayTable(mockContext, mockNode);

                expect(filterPromptSpy).toHaveBeenCalledWith(mockNode);
            });

            it("should prepare and display table for PDS node", async () => {
                mockNode.children = [];
                jest.spyOn(SharedContext, "isSession").mockReturnValue(false);
                jest.spyOn(SharedContext, "isPds").mockReturnValue(true);
                jest.spyOn(SharedContext, "isInformation").mockReturnValue(false);

                await (xDatasetTableView as any).prepareAndDisplayTable(mockContext, mockNode);

                expect(mockTableViewProvider.setTableView).toHaveBeenCalled();
                expect(commands.executeCommand).toHaveBeenCalledWith("zowe-resources.focus");
            });
        });

        describe("event emitter", () => {
            it("should emit events when table is created and disposed", async () => {
                const eventSpy = jest.fn();
                xDatasetTableView.onDataSetTableChanged(eventSpy);

                const mockContext = {
                    extensionPath: "/mock/extension/path",
                } as ExtensionContext;
                const mockDataSource = {
                    fetchDataSets: jest.fn().mockResolvedValue([]),
                    getTitle: jest.fn().mockReturnValue("Test"),
                    supportsHierarchy: jest.fn().mockReturnValue(false),
                };

                (xDatasetTableView as any).currentDataSource = mockDataSource;
                const table = await (xDatasetTableView as any).generateTable(mockContext);

                expect(eventSpy).toHaveBeenCalledWith({
                    source: mockDataSource,
                    tableType: null,
                    eventType: 1,
                });

                // Simulate table disposal
                const onDisposedCallback = jest.fn();
                table.onDisposed = onDisposedCallback;

                // Call the onDisposed callback that was registered
                const onDisposedCalls = table.onDisposed.mock.calls;
                if (onDisposedCalls.length > 0) {
                    const callback = onDisposedCalls[0][0];
                    callback();
                }
            });
        });

        describe("canOpenInEditor", () => {
            it("should return true for all PS (sequential) datasets", () => {
                const rows: Table.RowData[] = [
                    { dsorg: "PS", uri: "zowe-ds:/profile/TEST.PS1" },
                    { dsorg: "PS-L", uri: "zowe-ds:/profile/TEST.PS2" },
                ];

                const result = (xDatasetTableView as any).canOpenInEditor(rows);
                expect(result).toBe(true);
            });

            it("should return true for all PDS members", () => {
                const rows: Table.RowData[] = [
                    {
                        uri: "zowe-ds:/profile/TEST.PDS/MEM1",
                        _tree: { parentId: "zowe-ds:/profile/TEST.PDS", id: "zowe-ds:/profile/TEST.PDS/MEM1" },
                    },
                    {
                        uri: "zowe-ds:/profile/TEST.PDS/MEM2",
                        _tree: { parentId: "zowe-ds:/profile/TEST.PDS", id: "zowe-ds:/profile/TEST.PDS/MEM2" },
                    },
                ];

                const result = (xDatasetTableView as any).canOpenInEditor(rows);
                expect(result).toBe(true);
            });

            it("should return true for mixed PS datasets and PDS members", () => {
                const rows: Table.RowData[] = [
                    { dsorg: "PS", uri: "zowe-ds:/profile/TEST.PS" },
                    {
                        uri: "zowe-ds:/profile/TEST.PDS/MEM1",
                        _tree: { parentId: "zowe-ds:/profile/TEST.PDS", id: "zowe-ds:/profile/TEST.PDS/MEM1" },
                    },
                ];

                const result = (xDatasetTableView as any).canOpenInEditor(rows);
                expect(result).toBe(true);
            });

            it("should return false for PO (PDS) datasets without member context", () => {
                const rows: Table.RowData[] = [{ dsorg: "PO", uri: "zowe-ds:/profile/TEST.PDS" }];

                const result = (xDatasetTableView as any).canOpenInEditor(rows);
                expect(result).toBe(false);
            });

            it("should return false when at least one row doesn't meet criteria", () => {
                const rows: Table.RowData[] = [
                    { dsorg: "PS", uri: "zowe-ds:/profile/TEST.PS" },
                    { dsorg: "PO", uri: "zowe-ds:/profile/TEST.PDS" }, // This one fails the condition
                ];

                const result = (xDatasetTableView as any).canOpenInEditor(rows);
                expect(result).toBe(false);
            });

            it("should return false for VSAM datasets", () => {
                const rows: Table.RowData[] = [{ dsorg: "VS", uri: "zowe-ds:/profile/TEST.VSAM" }];

                const result = (xDatasetTableView as any).canOpenInEditor(rows);
                expect(result).toBe(false);
            });

            it("should handle undefined dsorg gracefully", () => {
                const rows: Table.RowData[] = [
                    { uri: "zowe-ds:/profile/TEST.UNKNOWN" }, // No dsorg property
                ];

                const result = (xDatasetTableView as any).canOpenInEditor(rows);
                expect(result).toBe(false);
            });

            it("should handle empty rows array", () => {
                const rows: Table.RowData[] = [];

                const result = (xDatasetTableView as any).canOpenInEditor(rows);
                expect(result).toBe(false); // can't open in editor if no rows
            });

            it("should return true for PDS member with undefined dsorg", () => {
                const rows: Table.RowData[] = [
                    {
                        dsorg: undefined,
                        uri: "zowe-ds:/profile/TEST.PDS/MEM1",
                        _tree: { parentId: "zowe-ds:/profile/TEST.PDS", id: "zowe-ds:/profile/TEST.PDS/MEM1" },
                    },
                ];

                const result = (xDatasetTableView as any).canOpenInEditor(rows);
                expect(result).toBe(true);
            });
        });

        describe("onDidReceiveMessage", () => {
            let mockContext: ExtensionContext;
            let mockNode: ZoweDatasetNode;
            let mockTableViewProvider: any;
            let yDatasetTableView: DatasetTableView;

            beforeEach(() => {
                mockContext = {
                    extensionPath: "/mock/extension/path",
                } as ExtensionContext;
                const profile = createIProfile();
                mockNode = new ZoweDatasetNode({
                    label: "sestest",
                    collapsibleState: TreeItemCollapsibleState.Expanded,
                    contextOverride: Constants.DS_SESSION_CONTEXT,
                    profile,
                    session: createISession(),
                });

                mockTableViewProvider = {
                    setTableView: jest.fn().mockResolvedValue(undefined),
                };

                jest.spyOn(TableViewProvider, "getInstance").mockReturnValue(mockTableViewProvider);
                jest.spyOn(SharedUtils, "getSelectedNodeList").mockReturnValue([mockNode]);
                jest.spyOn(SharedTreeProviders, "ds", "get").mockReturnValue({
                    filterPrompt: jest.fn().mockResolvedValue(undefined),
                } as any);
                jest.spyOn(commands, "executeCommand").mockResolvedValue(undefined);
                (DatasetTableView as any)._instance = undefined; // Reset the singleton instance
                yDatasetTableView = DatasetTableView.getInstance();
            });

            it("should handle 'loadTreeChildren' command", async () => {
                const mockDataSource = {
                    loadChildren: jest.fn().mockResolvedValue([
                        {
                            name: "MEMBER1",
                            volumes: "VOL001",
                            uri: "zowe-ds:/sestest/TEST.PDS/MEMBER1",
                            _tree: {
                                id: "zowe-ds:/sestest/TEST.PDS/MEMBER1",
                                parentId: "zowe-ds:/sestest/TEST.PDS",
                                depth: 1,
                                hasChildren: false,
                                isExpanded: false,
                            },
                        },
                        {
                            name: "MEMBER2",
                            volumes: "VOL002",
                            uri: "zowe-ds:/sestest/TEST.PDS/MEMBER2",
                            _tree: {
                                id: "zowe-ds:/sestest/TEST.PDS/MEMBER2",
                                parentId: "zowe-ds:/sestest/TEST.PDS",
                                depth: 1,
                                hasChildren: false,
                                isExpanded: false,
                            },
                        },
                    ]),
                };

                (yDatasetTableView as any).currentDataSource = mockDataSource;

                // Mock the table instance and its webview
                const mockWebview = { postMessage: jest.fn() };
                const mockPanel = { webview: mockWebview };
                (yDatasetTableView as any).table = { panel: mockPanel };

                const message = {
                    command: "loadTreeChildren",
                    payload: {
                        nodeId: "zowe-ds:/sestest/TEST.PDS",
                    },
                };

                await yDatasetTableView["onDidReceiveMessage"](message);

                expect(mockDataSource.loadChildren).toHaveBeenCalledWith(message.payload.nodeId);
                expect(mockWebview.postMessage).toHaveBeenCalledWith({
                    command: "treeChildrenLoaded",
                    data: {
                        parentNodeId: message.payload.nodeId,
                        children: expect.arrayContaining([
                            {
                                dsname: "MEMBER1",
                                volumes: "VOL001",
                                uri: "zowe-ds:/sestest/TEST.PDS/MEMBER1",
                                _tree: expect.objectContaining({
                                    id: "zowe-ds:/sestest/TEST.PDS/MEMBER1",
                                }),
                                cnorc: undefined,
                                createdDate: undefined,
                                dsorg: undefined,
                                inorc: undefined,
                                lrecl: undefined,
                                migr: undefined,
                                mnorc: undefined,
                                mod: undefined,
                                modifiedDate: undefined,
                                recfm: undefined,
                                sclm: undefined,
                                user: undefined,
                                vers: undefined,
                            },
                            {
                                dsname: "MEMBER2",
                                volumes: "VOL002",
                                uri: "zowe-ds:/sestest/TEST.PDS/MEMBER2",
                                _tree: expect.objectContaining({
                                    id: "zowe-ds:/sestest/TEST.PDS/MEMBER2",
                                }),
                                cnorc: undefined,
                                createdDate: undefined,
                                dsorg: undefined,
                                inorc: undefined,
                                lrecl: undefined,
                                migr: undefined,
                                mnorc: undefined,
                                mod: undefined,
                                modifiedDate: undefined,
                                recfm: undefined,
                                sclm: undefined,
                                user: undefined,
                                vers: undefined,
                            },
                        ]),
                    },
                    requestId: undefined,
                });
            });

            it("should do nothing if 'loadTreeChildren' command is not provided", async () => {
                const mockDataSource = {
                    loadChildren: jest.fn(),
                };

                (yDatasetTableView as any).currentDataSource = mockDataSource;

                // Mock the table instance and its webview
                const mockWebview = { postMessage: jest.fn() };
                const mockPanel = { webview: mockWebview };
                (yDatasetTableView as any).table = { panel: mockPanel };

                const message = {
                    command: "someOtherCommand",
                    payload: {
                        nodeId: "zowe-ds:/sestest/TEST.PDS",
                    },
                };

                await yDatasetTableView["onDidReceiveMessage"](message);

                expect(mockDataSource.loadChildren).not.toHaveBeenCalled();
                expect(mockWebview.postMessage).not.toHaveBeenCalled();
            });

            it("should handle 'loadTreeChildren' when currentDataSource does not have loadChildren method", async () => {
                const mockDataSource = {
                    // No loadChildren method
                };

                (yDatasetTableView as any).currentDataSource = mockDataSource;

                // Mock the table instance and its webview
                const mockWebview = { postMessage: jest.fn() };
                const mockPanel = { webview: mockWebview };
                (yDatasetTableView as any).table = { panel: mockPanel };

                const message = {
                    command: "loadTreeChildren",
                    payload: {
                        nodeId: "zowe-ds:/sestest/TEST.PDS",
                    },
                };

                await yDatasetTableView["onDidReceiveMessage"](message);

                expect(mockWebview.postMessage).not.toHaveBeenCalled();
            });
        });
    });
});

describe("DatasetTableView action handlers/callbacks", () => {
    let datasetTableView: DatasetTableView;
    let mockTable: jest.Mocked<Table.Instance>;
    let mockTableViewProvider: jest.Mocked<TableViewProvider>;
    let mockContext: ExtensionContext;

    beforeEach(() => {
        // Reset singleton instance for test isolation
        (DatasetTableView as any)._instance = undefined;
        datasetTableView = DatasetTableView.getInstance();

        mockTable = {
            getPinnedRows: jest.fn().mockResolvedValue([]),
            getGridState: jest.fn().mockResolvedValue({}),
            setGridState: jest.fn().mockResolvedValue(true),
            setPinnedRows: jest.fn().mockResolvedValue(true),
            pinRows: jest.fn().mockResolvedValue(true),
            unpinRows: jest.fn().mockResolvedValue(true),
            setPage: jest.fn().mockResolvedValue(true),
            waitForAPI: jest.fn().mockResolvedValue(true),
            setTitle: jest.fn(),
            setColumns: jest.fn(),
            setContent: jest.fn(),
            setOptions: jest.fn(),
            onDisposed: jest.fn(),
            onDidReceiveMessage: jest.fn(),
        } as unknown as jest.Mocked<Table.Instance>;

        mockTableViewProvider = {
            setTableView: jest.fn().mockResolvedValue(undefined),
        } as unknown as jest.Mocked<TableViewProvider>;

        jest.spyOn(TableViewProvider, "getInstance").mockReturnValue(mockTableViewProvider);
        jest.spyOn(Gui, "infoMessage").mockImplementation();
        jest.spyOn(Gui, "errorMessage").mockImplementation();
        jest.spyOn(l10n, "t").mockImplementation((key: any) => (typeof key === "string" ? key : key.message));

        (datasetTableView as any).table = mockTable;

        mockContext = {
            extensionUri: Uri.parse("fake://uri"),
        } as ExtensionContext;

        // Mock generateTable to avoid actual table generation logic
        jest.spyOn(datasetTableView as any, "generateTable").mockResolvedValue(mockTable);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("focusOnPds", () => {
        it("should switch to members view for a PDS from PatternDataSource", async () => {
            const profile = createIProfile();
            const pdsRow = { dsname: "TEST.PDS", uri: "zowe-ds:/sestest/TEST.PDS", dsorg: "PO" };
            const dataSource = new PatternDataSource(profile, "TEST.*");
            (datasetTableView as any).currentDataSource = dataSource;
            (datasetTableView as any).currentTableType = "dataSets";
            (datasetTableView as any).context = mockContext;

            await (datasetTableView as any).focusOnPDS({} as Table.View, { row: pdsRow, index: 0 });

            expect((datasetTableView as any).previousTableData).not.toBeNull();
            expect((datasetTableView as any).currentDataSource.constructor.name).toBe("PDSMembersDataSource");
            expect((datasetTableView as any).currentTableType).toBe("members");
            expect(mockTableViewProvider.setTableView).toHaveBeenCalledWith(mockTable);
            expect(mockTable.setPage).toHaveBeenCalledWith(0);
            expect(mockTable.setPinnedRows).toHaveBeenCalledWith([]);
        });

        it("should switch to members view for a PDS from TreeDataSource", async () => {
            const profile = createIProfile();
            const sessionNode = new ZoweDatasetNode({
                label: "sestest",
                collapsibleState: TreeItemCollapsibleState.Expanded,
                profile,
                session: createISession(),
            });
            jest.spyOn(sessionNode, "getSessionNode").mockReturnValue(sessionNode);

            const pdsRow = { dsname: "TEST.PDS", uri: "zowe-ds:/sestest/TEST.PDS", dsorg: "PO" };
            const dataSource = new TreeDataSource(sessionNode);
            (datasetTableView as any).currentDataSource = dataSource;
            (datasetTableView as any).currentTableType = "dataSets";
            (datasetTableView as any).context = mockContext;

            await (datasetTableView as any).focusOnPDS({} as Table.View, { row: pdsRow, index: 0 });

            expect((datasetTableView as any).previousTableData).not.toBeNull();
            expect((datasetTableView as any).currentDataSource.constructor.name).toBe("PDSMembersDataSource");
            expect((datasetTableView as any).currentTableType).toBe("members");
        });
    });

    describe("goBack", () => {
        it("should restore previous table view", async () => {
            const previousState = {
                dataSource: new PatternDataSource(createIProfile(), "OLD.PATTERN"),
                tableType: "dataSets",
                shouldShow: { dsname: true },
                table: mockTable,
                gridState: { sort: "asc" },
                pinnedRows: [{ dsname: "PINNED.DS" }],
            };
            (datasetTableView as any).previousTableData = previousState;
            (datasetTableView as any).context = mockContext;

            await (datasetTableView as any).goBack({} as Table.View, {} as Table.RowInfo);

            expect((datasetTableView as any).currentDataSource).toBe(previousState.dataSource);
            expect((datasetTableView as any).currentTableType).toBe("dataSets");
            expect(mockTableViewProvider.setTableView).toHaveBeenCalledWith(mockTable);
            expect(mockTable.waitForAPI).toHaveBeenCalled();
            expect(mockTable.setGridState).toHaveBeenCalledWith(previousState.gridState);
            expect(mockTable.setPinnedRows).toHaveBeenCalledWith(previousState.pinnedRows);
            expect((datasetTableView as any).previousTableData).toBeNull();
        });

        it("should do nothing if no previous data", async () => {
            (datasetTableView as any).previousTableData = null;
            await (datasetTableView as any).goBack({} as Table.View, {} as Table.RowInfo);
            expect(mockTableViewProvider.setTableView).not.toHaveBeenCalled();
        });
    });

    describe("getPinTitle", () => {
        it('should return "Pin" if no rows are provided', async () => {
            const title = await (datasetTableView as any).getPinTitle([]);
            expect(title).toBe("Pin");
        });

        it('should return "Unpin" if all provided rows are pinned', async () => {
            const rows = [{ dsname: "A" }, { dsname: "B" }];
            (mockTable.getPinnedRows as jest.Mock).mockResolvedValue(rows);
            const title = await (datasetTableView as any).getPinTitle(rows);
            expect(title).toBe("Unpin");
        });

        it('should return "Pin" if some provided rows are not pinned', async () => {
            const rows = [{ dsname: "A" }, { dsname: "B" }];
            (mockTable.getPinnedRows as jest.Mock).mockResolvedValue([{ dsname: "A" }]);
            const title = await (datasetTableView as any).getPinTitle(rows);
            expect(title).toBe("Pin");
        });

        it('should return "Pin" on error', async () => {
            (mockTable.getPinnedRows as jest.Mock).mockRejectedValue(new Error("failure"));
            const title = await (datasetTableView as any).getPinTitle([{ dsname: "A" }]);
            expect(title).toBe("Pin");
        });

        it("should work for single row (context menu case)", async () => {
            const row = { dsname: "A" };
            (mockTable.getPinnedRows as jest.Mock).mockResolvedValue([row]);
            const title = await (datasetTableView as any).getPinTitle([row]);
            expect(title).toBe("Unpin");
        });

        it('should return "Pin" for table that is null', async () => {
            (datasetTableView as any).table = null;
            const title = await (datasetTableView as any).getPinTitle([{ dsname: "A" }]);
            expect(title).toBe("Pin");
        });
    });

    describe("togglePinRows", () => {
        it("should unpin rows if all are pinned (multi-row case)", async () => {
            const rows = { 0: { dsname: "A" }, 1: { dsname: "B" } };
            const rowsArray = Object.values(rows);
            (mockTable.getPinnedRows as jest.Mock).mockResolvedValue(rowsArray);

            await (datasetTableView as any).togglePinRows({} as Table.View, rows);

            expect(mockTable.unpinRows).toHaveBeenCalledWith(rowsArray);
            expect(mockTable.pinRows).not.toHaveBeenCalled();
            expect(Gui.infoMessage).toHaveBeenCalledWith("Successfully unpinned {0} row(s) from the table.");
        });

        it("should pin rows if some are not pinned (multi-row case)", async () => {
            const rows = { 0: { dsname: "A" }, 1: { dsname: "B" } };
            const rowsArray = Object.values(rows);
            (mockTable.getPinnedRows as jest.Mock).mockResolvedValue([{ dsname: "A" }]);

            await (datasetTableView as any).togglePinRows({} as Table.View, rows);

            expect(mockTable.pinRows).toHaveBeenCalledWith(rowsArray);
            expect(mockTable.unpinRows).not.toHaveBeenCalled();
            expect(Gui.infoMessage).toHaveBeenCalledWith("Successfully pinned {0} row(s) to the top of the table.");
        });

        it("should unpin single row if pinned (single-row case)", async () => {
            const rowInfo = { row: { dsname: "A" }, index: 0 };
            const rowsArray = [rowInfo.row];
            (mockTable.getPinnedRows as jest.Mock).mockResolvedValue(rowsArray);

            await (datasetTableView as any).togglePinRows({} as Table.View, rowInfo);

            expect(mockTable.unpinRows).toHaveBeenCalledWith(rowsArray);
            expect(mockTable.pinRows).not.toHaveBeenCalled();
            expect(Gui.infoMessage).toHaveBeenCalledWith("Successfully unpinned {0} row(s) from the table.");
        });

        it("should pin single row if not pinned (single-row case)", async () => {
            const rowInfo = { row: { dsname: "A" }, index: 0 };
            const rowsArray = [rowInfo.row];
            (mockTable.getPinnedRows as jest.Mock).mockResolvedValue([]);

            await (datasetTableView as any).togglePinRows({} as Table.View, rowInfo);

            expect(mockTable.pinRows).toHaveBeenCalledWith(rowsArray);
            expect(mockTable.unpinRows).not.toHaveBeenCalled();
            expect(Gui.infoMessage).toHaveBeenCalledWith("Successfully pinned {0} row(s) to the top of the table.");
        });

        it("should show error message on failure", async () => {
            const rows = { 0: { dsname: "A" } };
            (mockTable.pinRows as jest.Mock).mockResolvedValue(false);

            await (datasetTableView as any).togglePinRows({} as Table.View, rows);

            expect(Gui.errorMessage).toHaveBeenCalledWith("Failed to pin rows to the table.");
        });

        it("should show error message on exception", async () => {
            const rows = { 0: { dsname: "A" } };
            const error = new Error("API error");
            (mockTable.getPinnedRows as jest.Mock).mockRejectedValue(error);

            await (datasetTableView as any).togglePinRows({} as Table.View, rows);

            expect(Gui.errorMessage).toHaveBeenCalledWith("Error toggling pin state for rows: {0}");
        });

        it("should handle mixed pinned state correctly (multi-row case)", async () => {
            const rows = { 0: { dsname: "A" }, 1: { dsname: "B" }, 2: { dsname: "C" } };
            const rowsArray = Object.values(rows);
            // Only row A is pinned, so it should pin all rows
            (mockTable.getPinnedRows as jest.Mock).mockResolvedValue([{ dsname: "A" }]);

            await (datasetTableView as any).togglePinRows({} as Table.View, rows);

            expect(mockTable.pinRows).toHaveBeenCalledWith(rowsArray);
            expect(mockTable.unpinRows).not.toHaveBeenCalled();
            expect(Gui.infoMessage).toHaveBeenCalledWith("Successfully pinned {0} row(s) to the top of the table.");
        });

        it("should correctly detect single-row vs multi-row input type", async () => {
            // Test that the function correctly identifies input types
            const singleRowInput = { row: { dsname: "A" }, index: 0 };
            const multiRowInput = { 0: { dsname: "A" }, 1: { dsname: "B" } };

            (mockTable.getPinnedRows as jest.Mock).mockResolvedValue([]);

            // Test single-row case
            await (datasetTableView as any).togglePinRows({} as Table.View, singleRowInput);
            expect(mockTable.pinRows).toHaveBeenCalledWith([singleRowInput.row]);

            // Reset mocks
            jest.clearAllMocks();
            (mockTable.getPinnedRows as jest.Mock).mockResolvedValue([]);

            // Test multi-row case
            await (datasetTableView as any).togglePinRows({} as Table.View, multiRowInput);
            expect(mockTable.pinRows).toHaveBeenCalledWith(Object.values(multiRowInput));
        });
    });

    describe("context menu options", () => {
        describe("pinRow contextOption", () => {
            it("should have correct title function that calls getPinTitle", async () => {
                const contextOptions = (datasetTableView as any).contextOptions;

                expect(contextOptions.pinRow).toBeDefined();
                expect(contextOptions.pinRow.title).toBeDefined();
                expect(contextOptions.pinRow.command).toBe("pin-row");
                expect(contextOptions.pinRow.callback.typ).toBe("single-row");

                // Mock getPinTitle to verify it gets called
                const getPinTitleSpy = jest.spyOn(datasetTableView as any, "getPinTitle").mockResolvedValue("Pin");

                const rowData = { dsname: "TEST.DS" };
                const title = await contextOptions.pinRow.title(rowData);

                expect(getPinTitleSpy).toHaveBeenCalledWith([rowData]);
                expect(title).toBe("Pin");
            });
        });

        describe("displayInTree contextOption", () => {
            it("should have correct configuration", () => {
                const contextOptions = (datasetTableView as any).contextOptions;

                expect(contextOptions.displayInTree).toBeDefined();
                expect(contextOptions.displayInTree.title).toBe("Display in Tree");
                expect(contextOptions.displayInTree.command).toBe("display-in-tree");
                expect(contextOptions.displayInTree.callback.typ).toBe("single-row");
                expect(contextOptions.displayInTree.callback.fn).toBe(DatasetTableView.displayInTree);
            });
        });
    });

    describe("row actions", () => {
        describe("pinRows action", () => {
            it("should have correct title function that calls getPinTitle", async () => {
                const rowActions = (datasetTableView as any).rowActions;

                expect(rowActions.pinRows).toBeDefined();
                expect(rowActions.pinRows.title).toBeDefined();
                expect(rowActions.pinRows.command).toBe("pin-selected-rows");
                expect(rowActions.pinRows.callback.typ).toBe("multi-row");
                expect(rowActions.pinRows.type).toBe("secondary");

                // Mock getPinTitle to verify it gets called
                const getPinTitleSpy = jest.spyOn(datasetTableView as any, "getPinTitle").mockResolvedValue("Unpin");

                const rows = [{ dsname: "TEST.DS1" }, { dsname: "TEST.DS2" }];
                const title = await rowActions.pinRows.title(rows);

                expect(getPinTitleSpy).toHaveBeenCalledWith(rows);
                expect(title).toBe("Unpin");
            });

            it("should have correct condition function", () => {
                const rowActions = (datasetTableView as any).rowActions;

                expect(rowActions.pinRows.condition([{ dsname: "A" }])).toBe(true);
                expect(rowActions.pinRows.condition([{ dsname: "A" }, { dsname: "B" }])).toBe(true);
                expect(rowActions.pinRows.condition([])).toBe(false);
            });
        });
    });

    describe("dispose", () => {
        it("should reset shouldShow property", () => {
            (datasetTableView as any).shouldShow = { dsname: true, dsorg: true };
            datasetTableView.dispose();
            expect((datasetTableView as any).shouldShow).toEqual({});
        });
    });

    describe("sorting functions", () => {
        beforeEach(() => {
            (DatasetTableView as any)._instance = undefined;
            datasetTableView = DatasetTableView.getInstance();
        });

        describe("mapSortOptionToColumnField", () => {
            it("should map DatasetSortOpts.Name to dsname", () => {
                const result = (datasetTableView as any).mapSortOptionToColumnField(0); // DatasetSortOpts.Name = 0
                expect(result).toBe("dsname");
            });

            it("should map DatasetSortOpts.DateCreated to createdDate", () => {
                const result = (datasetTableView as any).mapSortOptionToColumnField(1); // DatasetSortOpts.DateCreated = 1
                expect(result).toBe("createdDate");
            });

            it("should map DatasetSortOpts.LastModified to modifiedDate", () => {
                const result = (datasetTableView as any).mapSortOptionToColumnField(2); // DatasetSortOpts.LastModified = 2
                expect(result).toBe("modifiedDate");
            });

            it("should map DatasetSortOpts.UserId to user", () => {
                const result = (datasetTableView as any).mapSortOptionToColumnField(3); // DatasetSortOpts.UserId = 3
                expect(result).toBe("user");
            });

            it("should return dsname for invalid sort method", () => {
                const result = (datasetTableView as any).mapSortOptionToColumnField(999);
                expect(result).toBe("dsname");
            });

            it("should return dsname for JobSortOpts (non-dataset sort options)", () => {
                const result = (datasetTableView as any).mapSortOptionToColumnField(10); // JobSortOpts value
                expect(result).toBe("dsname");
            });
        });

        describe("getEffectiveSortSettings", () => {
            let mockTreeNode: ZoweDatasetNode;
            let mockSessionNode: ZoweDatasetNode;

            beforeEach(() => {
                const profile = createIProfile();
                mockSessionNode = new ZoweDatasetNode({
                    label: "sestest",
                    collapsibleState: TreeItemCollapsibleState.Expanded,
                    contextOverride: Constants.DS_SESSION_CONTEXT,
                    profile,
                    session: createISession(),
                });

                mockTreeNode = new ZoweDatasetNode({
                    label: "TEST.PDS",
                    collapsibleState: TreeItemCollapsibleState.Collapsed,
                    contextOverride: Constants.DS_PDS_CONTEXT,
                    profile,
                    parentNode: mockSessionNode,
                });
            });

            it("should return tree node sort settings when available", () => {
                const expectedSort = { method: Sorting.DatasetSortOpts.LastModified, direction: Sorting.SortDirection.Descending };
                mockTreeNode.sort = expectedSort;

                const result = (datasetTableView as any).getEffectiveSortSettings(mockTreeNode);
                expect(result).toEqual(expectedSort);
            });

            it("should fall back to session node sort settings when tree node has no sort", () => {
                const expectedSort = { method: Sorting.DatasetSortOpts.DateCreated, direction: Sorting.SortDirection.Ascending };
                mockTreeNode.sort = undefined;
                mockSessionNode.sort = expectedSort;
                jest.spyOn(mockTreeNode, "getSessionNode").mockReturnValue(mockSessionNode);

                const result = (datasetTableView as any).getEffectiveSortSettings(mockTreeNode);
                expect(result).toEqual(expectedSort);
            });

            it("should return undefined when neither tree node nor session has sort settings", () => {
                mockTreeNode.sort = undefined;
                mockSessionNode.sort = undefined;
                jest.spyOn(mockTreeNode, "getSessionNode").mockReturnValue(mockSessionNode);

                const result = (datasetTableView as any).getEffectiveSortSettings(mockTreeNode);
                expect(result).toBeUndefined();
            });

            it("should return undefined when getSessionNode returns undefined", () => {
                mockTreeNode.sort = undefined;
                jest.spyOn(mockTreeNode, "getSessionNode").mockReturnValue(undefined as any);

                const result = (datasetTableView as any).getEffectiveSortSettings(mockTreeNode);
                expect(result).toBeUndefined();
            });
        });

        describe("getTreeNodeForSortContext", () => {
            let mockTreeNode: ZoweDatasetNode;
            let mockPdsNode: ZoweDatasetNode;

            beforeEach(() => {
                const profile = createIProfile();
                mockTreeNode = new ZoweDatasetNode({
                    label: "sestest",
                    collapsibleState: TreeItemCollapsibleState.Expanded,
                    contextOverride: Constants.DS_SESSION_CONTEXT,
                    profile,
                    session: createISession(),
                });

                mockPdsNode = new ZoweDatasetNode({
                    label: "TEST.PDS",
                    collapsibleState: TreeItemCollapsibleState.Collapsed,
                    contextOverride: Constants.DS_PDS_CONTEXT,
                    profile,
                    parentNode: mockTreeNode,
                });

                mockTreeNode.children = [mockPdsNode];
            });

            it("should return tree node for TreeDataSource", () => {
                const treeDataSource = new TreeDataSource(mockTreeNode);
                (datasetTableView as any).currentDataSource = treeDataSource;

                const result = (datasetTableView as any).getTreeNodeForSortContext();
                expect(result).toBe(mockTreeNode);
            });

            it("should return PDS node for PDSMembersDataSource with TreeDataSource parent", () => {
                const profile = createIProfile();
                const parentTreeDataSource = new TreeDataSource(mockTreeNode);
                const pdsDataSource = new PDSMembersDataSource(parentTreeDataSource, "TEST.PDS", "zowe-ds:/sestest/TEST.PDS", profile);
                (datasetTableView as any).currentDataSource = pdsDataSource;

                const result = (datasetTableView as any).getTreeNodeForSortContext();
                expect(result).toBe(mockPdsNode);
            });

            it("should return undefined for PDSMembersDataSource without matching PDS name", () => {
                const profile = createIProfile();
                const parentTreeDataSource = new TreeDataSource(mockTreeNode);
                const pdsDataSource = new PDSMembersDataSource(parentTreeDataSource, "NONEXISTENT.PDS", "zowe-ds:/sestest/NONEXISTENT.PDS", profile);
                (datasetTableView as any).currentDataSource = pdsDataSource;

                const result = (datasetTableView as any).getTreeNodeForSortContext();
                expect(result).toBeUndefined();
            });

            it("should return undefined for PDSMembersDataSource without tree node children", () => {
                const profile = createIProfile();
                mockTreeNode.children = [];
                const parentTreeDataSource = new TreeDataSource(mockTreeNode);
                const pdsDataSource = new PDSMembersDataSource(parentTreeDataSource, "TEST.PDS", "zowe-ds:/sestest/TEST.PDS", profile);
                (datasetTableView as any).currentDataSource = pdsDataSource;

                const result = (datasetTableView as any).getTreeNodeForSortContext();
                expect(result).toBeUndefined();
            });

            it("should return undefined for PDSMembersDataSource with non-TreeDataSource parent", () => {
                const profile = createIProfile();
                const patternDataSource = new PatternDataSource(profile, "TEST.*");
                const pdsDataSource = new PDSMembersDataSource(patternDataSource, "TEST.PDS", "zowe-ds:/sestest/TEST.PDS", profile);
                (datasetTableView as any).currentDataSource = pdsDataSource;

                const result = (datasetTableView as any).getTreeNodeForSortContext();
                expect(result).toBeUndefined();
            });

            it("should return undefined for PatternDataSource", () => {
                const profile = createIProfile();
                const patternDataSource = new PatternDataSource(profile, "TEST.*");
                (datasetTableView as any).currentDataSource = patternDataSource;

                const result = (datasetTableView as any).getTreeNodeForSortContext();
                expect(result).toBeUndefined();
            });

            it("should return undefined for PDSMembersDataSource without parent data source", () => {
                const profile = createIProfile();
                const pdsDataSource = new PDSMembersDataSource(null, "TEST.PDS", "zowe-ds:/sestest/TEST.PDS", profile);
                (datasetTableView as any).currentDataSource = pdsDataSource;

                const result = (datasetTableView as any).getTreeNodeForSortContext();
                expect(result).toBeUndefined();
            });
        });

        describe("applyTreeSortToColumns", () => {
            let mockTreeNode: ZoweDatasetNode;
            let mockSessionNode: ZoweDatasetNode;
            let columnDefs: any[];

            beforeEach(() => {
                const profile = createIProfile();
                mockSessionNode = new ZoweDatasetNode({
                    label: "sestest",
                    collapsibleState: TreeItemCollapsibleState.Expanded,
                    contextOverride: Constants.DS_SESSION_CONTEXT,
                    profile,
                    session: createISession(),
                });

                mockTreeNode = new ZoweDatasetNode({
                    label: "TEST.PDS",
                    collapsibleState: TreeItemCollapsibleState.Collapsed,
                    contextOverride: Constants.DS_PDS_CONTEXT,
                    profile,
                    parentNode: mockSessionNode,
                });

                columnDefs = [
                    { field: "dsname", headerName: "Data Set Name" },
                    { field: "dsorg", headerName: "Organization" },
                    { field: "createdDate", headerName: "Created" },
                    { field: "modifiedDate", headerName: "Modified" },
                    { field: "user", headerName: "User" },
                ];
            });

            it("should return original columns when no tree node provided", () => {
                const result = (datasetTableView as any).applyTreeSortToColumns(columnDefs, undefined);
                expect(result).toEqual(columnDefs.map((col) => ({ ...col, initialSort: undefined })));
            });

            it("should return original columns when tree node has no sort settings", () => {
                mockTreeNode.sort = undefined;
                jest.spyOn(mockTreeNode, "getSessionNode").mockReturnValue(undefined as any);

                const result = (datasetTableView as any).applyTreeSortToColumns(columnDefs, mockTreeNode);
                expect(result).toEqual(columnDefs.map((col) => ({ ...col, initialSort: undefined })));
            });

            it("should apply ascending sort to dsname column for Name sort method", () => {
                mockTreeNode.sort = { method: Sorting.DatasetSortOpts.Name, direction: Sorting.SortDirection.Ascending };
                jest.spyOn(mockTreeNode, "getSessionNode").mockReturnValue(mockSessionNode);

                const result = (datasetTableView as any).applyTreeSortToColumns(columnDefs, mockTreeNode);

                const dsnameColumn = result.find((col) => col.field === "dsname");
                expect(dsnameColumn.initialSort).toBe("asc");

                const otherColumns = result.filter((col) => col.field !== "dsname");
                otherColumns.forEach((col) => {
                    expect(col.initialSort).toBeUndefined();
                });
            });

            it("should apply descending sort to modifiedDate column for LastModified sort method", () => {
                mockTreeNode.sort = { method: Sorting.DatasetSortOpts.LastModified, direction: Sorting.SortDirection.Descending };
                jest.spyOn(mockTreeNode, "getSessionNode").mockReturnValue(mockSessionNode);

                const result = (datasetTableView as any).applyTreeSortToColumns(columnDefs, mockTreeNode);

                const modifiedDateColumn = result.find((col) => col.field === "modifiedDate");
                expect(modifiedDateColumn.initialSort).toBe("desc");

                const otherColumns = result.filter((col) => col.field !== "modifiedDate");
                otherColumns.forEach((col) => {
                    expect(col.initialSort).toBeUndefined();
                });
            });

            it("should apply ascending sort to createdDate column for DateCreated sort method", () => {
                mockTreeNode.sort = { method: Sorting.DatasetSortOpts.DateCreated, direction: Sorting.SortDirection.Ascending };
                jest.spyOn(mockTreeNode, "getSessionNode").mockReturnValue(mockSessionNode);

                const result = (datasetTableView as any).applyTreeSortToColumns(columnDefs, mockTreeNode);

                const createdDateColumn = result.find((col) => col.field === "createdDate");
                expect(createdDateColumn.initialSort).toBe("asc");

                const otherColumns = result.filter((col) => col.field !== "createdDate");
                otherColumns.forEach((col) => {
                    expect(col.initialSort).toBeUndefined();
                });
            });

            it("should apply descending sort to user column for UserId sort method", () => {
                mockTreeNode.sort = { method: Sorting.DatasetSortOpts.UserId, direction: Sorting.SortDirection.Descending };
                jest.spyOn(mockTreeNode, "getSessionNode").mockReturnValue(mockSessionNode);

                const result = (datasetTableView as any).applyTreeSortToColumns(columnDefs, mockTreeNode);

                const userColumn = result.find((col) => col.field === "user");
                expect(userColumn.initialSort).toBe("desc");

                const otherColumns = result.filter((col) => col.field !== "user");
                otherColumns.forEach((col) => {
                    expect(col.initialSort).toBeUndefined();
                });
            });

            it("should fall back to session sort when PDS has no sort settings", () => {
                mockTreeNode.sort = undefined;
                mockSessionNode.sort = { method: Sorting.DatasetSortOpts.LastModified, direction: Sorting.SortDirection.Ascending };
                jest.spyOn(mockTreeNode, "getSessionNode").mockReturnValue(mockSessionNode);

                const result = (datasetTableView as any).applyTreeSortToColumns(columnDefs, mockTreeNode);

                const modifiedDateColumn = result.find((col) => col.field === "modifiedDate");
                expect(modifiedDateColumn.initialSort).toBe("asc");

                const otherColumns = result.filter((col) => col.field !== "modifiedDate");
                otherColumns.forEach((col) => {
                    expect(col.initialSort).toBeUndefined();
                });
            });

            it("should preserve other column properties when applying sort", () => {
                const enrichedColumnDefs = [
                    { field: "dsname", headerName: "Data Set Name", width: 200, filter: true },
                    { field: "dsorg", headerName: "Organization", resizable: false },
                ];

                mockTreeNode.sort = { method: Sorting.DatasetSortOpts.Name, direction: Sorting.SortDirection.Descending };
                jest.spyOn(mockTreeNode, "getSessionNode").mockReturnValue(mockSessionNode);

                const result = (datasetTableView as any).applyTreeSortToColumns(enrichedColumnDefs, mockTreeNode);

                const dsnameColumn = result.find((col) => col.field === "dsname");
                expect(dsnameColumn.initialSort).toBe("desc");
                expect(dsnameColumn.width).toBe(200);
                expect(dsnameColumn.filter).toBe(true);
                expect(dsnameColumn.headerName).toBe("Data Set Name");

                const dsorgColumn = result.find((col) => col.field === "dsorg");
                expect(dsorgColumn.initialSort).toBeUndefined();
                expect(dsorgColumn.resizable).toBe(false);
                expect(dsorgColumn.headerName).toBe("Organization");
            });
        });
    });
});

describe("buildMemberInfo", () => {
    const parentUri = "zowe-ds:/profile/TEST.PDS";

    describe("createdDate handling", () => {
        it("should set createdDate properly when c4date exists on a member", () => {
            const member = {
                member: "MEMBER1",
                c4date: "2023-12-01",
                user: "USER1",
            };

            const result = buildMemberInfo(member, parentUri);

            expect(result.createdDate).toEqual(new Date("2023-12-01"));
            expect(result.name).toBe("MEMBER1");
            expect(result.user).toBe("USER1");
            expect(result.uri).toBe(`${parentUri}/MEMBER1`);
            expect(result.isMember).toBe(true);
            expect(result.isDirectory).toBe(false);
            expect(result.parentId).toBe(parentUri);
        });

        it("should leave createdDate undefined when c4date does not exist", () => {
            const member = {
                member: "MEMBER1",
                user: "USER1",
            };

            const result = buildMemberInfo(member, parentUri);

            expect(result.createdDate).toBeUndefined();
            expect(result.name).toBe("MEMBER1");
        });

        it("should handle invalid c4date gracefully", () => {
            const member = {
                member: "MEMBER1",
                c4date: "invalid-date",
                user: "USER1",
            };

            const result = buildMemberInfo(member, parentUri);

            // Invalid date should still create a Date object, but it will be "Invalid Date"
            expect(result.createdDate).toBeInstanceOf(Date);
            expect(result.createdDate?.toString()).toBe("Invalid Date");
        });
    });

    describe("modifiedDate handling", () => {
        it("should set modifiedDate properly when m4date exists on a member", () => {
            const member = {
                member: "MEMBER1",
                m4date: "2023-12-15",
                user: "USER1",
            };

            const result = buildMemberInfo(member, parentUri);

            expect(result.modifiedDate).toEqual(new Date("2023-12-15"));
            expect(result.name).toBe("MEMBER1");
        });

        it("should leave modifiedDate undefined when m4date does not exist", () => {
            const member = {
                member: "MEMBER1",
                user: "USER1",
            };

            const result = buildMemberInfo(member, parentUri);

            expect(result.modifiedDate).toBeUndefined();
        });

        it("should handle mtime component when both m4date and mtime exist", () => {
            const member = {
                member: "MEMBER1",
                m4date: "2023-12-15",
                mtime: "14:30",
                user: "USER1",
            };

            const result = buildMemberInfo(member, parentUri);

            const expectedDate = new Date("2023-12-15");
            expectedDate.setHours(14, 30);

            expect(result.modifiedDate).toEqual(expectedDate);
            expect(result.modifiedDate?.getHours()).toBe(14);
            expect(result.modifiedDate?.getMinutes()).toBe(30);
        });

        it("should handle msec component when m4date, mtime, and msec exist", () => {
            const member = {
                member: "MEMBER1",
                m4date: "2023-12-15",
                mtime: "14:30",
                msec: "45",
                user: "USER1",
            };

            const result = buildMemberInfo(member, parentUri);

            const expectedDate = new Date("2023-12-15");
            expectedDate.setHours(14, 30, 45);

            expect(result.modifiedDate).toEqual(expectedDate);
            expect(result.modifiedDate?.getHours()).toBe(14);
            expect(result.modifiedDate?.getMinutes()).toBe(30);
            expect(result.modifiedDate?.getSeconds()).toBe(45);
        });

        it("should handle mtime without msec", () => {
            const member = {
                member: "MEMBER1",
                m4date: "2023-12-15",
                mtime: "09:15",
                user: "USER1",
            };

            const result = buildMemberInfo(member, parentUri);

            const expectedDate = new Date("2023-12-15");
            expectedDate.setHours(9, 15);

            expect(result.modifiedDate).toEqual(expectedDate);
            expect(result.modifiedDate?.getHours()).toBe(9);
            expect(result.modifiedDate?.getMinutes()).toBe(15);
            expect(result.modifiedDate?.getSeconds()).toBe(0); // Should default to 0 when msec not provided
        });

        it("should ignore mtime and msec when m4date does not exist", () => {
            const member = {
                member: "MEMBER1",
                mtime: "14:30",
                msec: "45",
                user: "USER1",
            };

            const result = buildMemberInfo(member, parentUri);

            expect(result.modifiedDate).toBeUndefined();
        });

        it("should handle invalid m4date gracefully", () => {
            const member = {
                member: "MEMBER1",
                m4date: "invalid-date",
                mtime: "14:30",
                msec: "45",
                user: "USER1",
            };

            const result = buildMemberInfo(member, parentUri);

            // Invalid date should still create a Date object, but it will be "Invalid Date"
            expect(result.modifiedDate).toBeInstanceOf(Date);
            expect(result.modifiedDate?.toString()).toBe("Invalid Date");
        });

        it("should handle invalid mtime format gracefully", () => {
            const member = {
                member: "MEMBER1",
                m4date: "2023-12-15",
                mtime: "invalid-time",
                user: "USER1",
            };

            const result = buildMemberInfo(member, parentUri);

            const expectedDate = new Date("2023-12-15");
            // Invalid time format should result in NaN for hours/minutes
            expectedDate.setHours(NaN, NaN);

            expect(result.modifiedDate).toBeInstanceOf(Date);
            expect(result.modifiedDate?.toString()).toBe("Invalid Date");
        });
    });

    describe("complete member info structure", () => {
        it("should return complete member info with all fields", () => {
            const member = {
                member: "MEMBER1",
                c4date: "2023-12-01",
                m4date: "2023-12-15",
                mtime: "14:30",
                msec: "45",
                user: "USER1",
                vers: "01.02",
                mod: "03",
                cnorc: "100",
                inorc: "95",
                mnorc: "5",
                sclm: "Y",
            };

            const result = buildMemberInfo(member, parentUri);

            expect(result).toEqual({
                name: "MEMBER1",
                createdDate: new Date("2023-12-01"),
                modifiedDate: (() => {
                    const date = new Date("2023-12-15");
                    date.setHours(14, 30, 45);
                    return date;
                })(),
                user: "USER1",
                uri: `${parentUri}/MEMBER1`,
                isMember: true,
                isDirectory: false,
                parentId: parentUri,
                vers: "01.02",
                mod: "03",
                cnorc: "100",
                inorc: "95",
                mnorc: "5",
                sclm: "Y",
            });
        });

        it("should handle minimal member info", () => {
            const member = {
                member: "MEMBER1",
            };

            const result = buildMemberInfo(member, parentUri);

            expect(result).toEqual({
                name: "MEMBER1",
                createdDate: undefined,
                modifiedDate: undefined,
                user: undefined,
                uri: `${parentUri}/MEMBER1`,
                isMember: true,
                isDirectory: false,
                parentId: parentUri,
                vers: undefined,
                mod: undefined,
                cnorc: undefined,
                inorc: undefined,
                mnorc: undefined,
                sclm: undefined,
            });
        });
    });
});
