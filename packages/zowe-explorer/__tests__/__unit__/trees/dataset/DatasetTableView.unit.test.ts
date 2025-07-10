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

import { TreeItemCollapsibleState, commands, Uri, ExtensionContext } from "vscode";
import { DatasetTableView, PatternDataSource, TreeDataSource } from "../../../../src/trees/dataset/DatasetTableView";
import { ZoweDatasetNode } from "../../../../src/trees/dataset/ZoweDatasetNode";
import { createIProfile, createISession } from "../../../__mocks__/mockCreators/shared";
import { Constants } from "../../../../src/configuration/Constants";
import { Gui, Table, Types, TableViewProvider } from "@zowe/zowe-explorer-api";
import { SharedContext } from "../../../../src/trees/shared/SharedContext";
import { ZoweExplorerApiRegister } from "../../../../src/extending/ZoweExplorerApiRegister";
import { AuthUtils } from "../../../../src/utils/AuthUtils";
import { SharedTreeProviders } from "../../../../src/trees/shared/SharedTreeProviders";
import { SharedUtils } from "../../../../src/trees/shared/SharedUtils";
import { ProfileManagement } from "../../../../src/management/ProfileManagement";
import { Profiles } from "../../../../src/configuration/Profiles";
import * as imperative from "@zowe/imperative";
import { l10n } from "vscode";

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
    });

    describe("mapDatasetInfoToRow", () => {
        it("should map dataset info to table row data", () => {
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
                createdDate: datasetInfo.createdDate.toLocaleDateString(),
                modifiedDate: datasetInfo.modifiedDate.toLocaleString(),
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

        beforeEach(() => {
            mockTreeView = {
                reveal: jest.fn().mockResolvedValue(undefined),
            };

            const profile = createIProfile();
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

            jest.spyOn(SharedTreeProviders, "ds", "get").mockReturnValue({
                mSessionNodes: [mockProfileNode],
                getTreeView: () => mockTreeView,
            } as any);
        });

        it("should reveal member in tree for member URI", async () => {
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

        it("should reveal dataset in tree for dataset URI", async () => {
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

        it("should handle member with tree data", async () => {
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

            await datasetTableView.handleCommand(mockContext, mockNode, [mockNode]);

            expect(mockTableViewProvider.setTableView).toHaveBeenCalled();
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
            jest.spyOn(Gui, "showQuickPick").mockResolvedValue("sestest");
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
            jest.spyOn(Gui, "showQuickPick").mockResolvedValue("sestest");
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
            jest.spyOn(Gui, "showQuickPick").mockResolvedValue("sestest");
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
            jest.spyOn(Gui, "showQuickPick").mockResolvedValue("sestest");

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
            jest.spyOn(Gui, "showQuickPick").mockResolvedValue(null);

            const result = await (datasetTableView as any).selectAndAddProfile();

            expect(result).toBeUndefined();
        });
    });

    describe("DatasetTableView", () => {
        let datasetTableView: DatasetTableView;

        beforeEach(() => {
            // Reset the singleton instance
            (DatasetTableView as any)._instance = undefined;
            datasetTableView = DatasetTableView.getInstance();
        });

        // ... existing tests

        describe("generateTable", () => {
            let mockContext: ExtensionContext;
            let mockDataSource: any;

            beforeEach(() => {
                mockContext = {
                    extensionPath: "/mock/extension/path",
                } as ExtensionContext;
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

                (datasetTableView as any).currentDataSource = mockDataSource;
            });

            it("should generate a new table when no existing table", async () => {
                const result = await (datasetTableView as any).generateTable(mockContext);

                expect(result).toBeDefined();
                expect(mockDataSource.fetchDataSets).toHaveBeenCalled();
                expect(mockDataSource.getTitle).toHaveBeenCalled();
                expect(mockDataSource.supportsHierarchy).toHaveBeenCalled();
                expect(result).toBeInstanceOf(Table.Instance);
            });

            it("should update existing table when table exists and type unchanged", async () => {
                // First create a table
                await (datasetTableView as any).generateTable(mockContext);

                // Mock the existing table
                const mockTable = {
                    setTitle: jest.fn().mockResolvedValue(undefined),
                    setColumns: jest.fn().mockResolvedValue(undefined),
                    setContent: jest.fn().mockResolvedValue(undefined),
                    setOptions: jest.fn().mockResolvedValue(undefined),
                    onDisposed: jest.fn(),
                    onDidReceiveMessage: jest.fn(),
                };
                (datasetTableView as any).table = mockTable;

                // Generate table again
                await (datasetTableView as any).generateTable(mockContext);

                expect(mockTable.setTitle).toHaveBeenCalledWith("Test Title");
                expect(mockTable.setColumns).toHaveBeenCalled();
                expect(mockTable.setContent).toHaveBeenCalled();
            });

            it("should set up tree mode when data source supports hierarchy", async () => {
                mockDataSource.supportsHierarchy.mockReturnValue(true);
                mockDataSource.loadChildren = jest.fn().mockResolvedValue([]);

                const result = await (datasetTableView as any).generateTable(mockContext);

                expect(result).toBeDefined();
                expect(mockDataSource.supportsHierarchy).toHaveBeenCalled();
            });

            it("should handle data source error during fetchDataSets", async () => {
                const errorDataSource = {
                    fetchDataSets: jest.fn().mockRejectedValue(new Error("Fetch error")),
                    getTitle: jest.fn().mockReturnValue("Error Title"),
                    supportsHierarchy: jest.fn().mockReturnValue(false),
                };

                (datasetTableView as any).currentDataSource = errorDataSource;

                await expect((datasetTableView as any).generateTable(mockContext)).rejects.toThrow("Fetch error");
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

                await (datasetTableView as any).prepareAndDisplayTable(mockContext, mockNode);

                expect(mockTableViewProvider.setTableView).toHaveBeenCalled();
                expect(commands.executeCommand).toHaveBeenCalledWith("zowe-resources.focus");
            });

            it("should call filterPrompt for session node without pattern", async () => {
                mockNode.pattern = null;
                mockNode.children = [];
                jest.spyOn(SharedContext, "isSession").mockReturnValue(true);
                jest.spyOn(SharedContext, "isPds").mockReturnValue(false);
                jest.spyOn(SharedContext, "isInformation").mockReturnValue(false);

                const filterPromptSpy = jest.spyOn(SharedTreeProviders.ds, "filterPrompt");

                await (datasetTableView as any).prepareAndDisplayTable(mockContext, mockNode);

                expect(filterPromptSpy).toHaveBeenCalledWith(mockNode);
            });

            it("should prepare and display table for PDS node", async () => {
                mockNode.children = [];
                jest.spyOn(SharedContext, "isSession").mockReturnValue(false);
                jest.spyOn(SharedContext, "isPds").mockReturnValue(true);
                jest.spyOn(SharedContext, "isInformation").mockReturnValue(false);

                await (datasetTableView as any).prepareAndDisplayTable(mockContext, mockNode);

                expect(mockTableViewProvider.setTableView).toHaveBeenCalled();
                expect(commands.executeCommand).toHaveBeenCalledWith("zowe-resources.focus");
            });
        });

        describe("event emitter", () => {
            it("should emit events when table is created and disposed", async () => {
                const eventSpy = jest.fn();
                datasetTableView.onDataSetTableChanged(eventSpy);

                const mockContext = {
                    extensionPath: "/mock/extension/path",
                } as ExtensionContext;
                const mockDataSource = {
                    fetchDataSets: jest.fn().mockResolvedValue([]),
                    getTitle: jest.fn().mockReturnValue("Test"),
                    supportsHierarchy: jest.fn().mockReturnValue(false),
                };

                (datasetTableView as any).currentDataSource = mockDataSource;
                const table = await (datasetTableView as any).generateTable(mockContext);

                expect(eventSpy).toHaveBeenCalledWith({
                    source: mockDataSource,
                    tableType: null,
                    eventType: 1,
                });

                // Simulate table disposal
                const onDisposedCallback = jest.fn();
                table.onDisposed = onDisposedCallback;

                // Call the onDisposed callback that was registered
                const onDisposedCalls = (table as any).onDisposed.mock.calls;
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

                const result = (datasetTableView as any).canOpenInEditor(rows);
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

                const result = (datasetTableView as any).canOpenInEditor(rows);
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

                const result = (datasetTableView as any).canOpenInEditor(rows);
                expect(result).toBe(true);
            });

            it("should return false for PO (PDS) datasets without member context", () => {
                const rows: Table.RowData[] = [{ dsorg: "PO", uri: "zowe-ds:/profile/TEST.PDS" }];

                const result = (datasetTableView as any).canOpenInEditor(rows);
                expect(result).toBe(false);
            });

            it("should return false when at least one row doesn't meet criteria", () => {
                const rows: Table.RowData[] = [
                    { dsorg: "PS", uri: "zowe-ds:/profile/TEST.PS" },
                    { dsorg: "PO", uri: "zowe-ds:/profile/TEST.PDS" }, // This one fails the condition
                ];

                const result = (datasetTableView as any).canOpenInEditor(rows);
                expect(result).toBe(false);
            });

            it("should return false for VSAM datasets", () => {
                const rows: Table.RowData[] = [{ dsorg: "VS", uri: "zowe-ds:/profile/TEST.VSAM" }];

                const result = (datasetTableView as any).canOpenInEditor(rows);
                expect(result).toBe(false);
            });

            it("should handle undefined dsorg gracefully", () => {
                const rows: Table.RowData[] = [
                    { uri: "zowe-ds:/profile/TEST.UNKNOWN" }, // No dsorg property
                ];

                const result = (datasetTableView as any).canOpenInEditor(rows);
                expect(result).toBe(false);
            });

            it("should handle empty rows array", () => {
                const rows: Table.RowData[] = [];

                const result = (datasetTableView as any).canOpenInEditor(rows);
                expect(result).toBe(true); // every() returns true for empty arrays
            });

            it("should return true for PDS member with undefined dsorg", () => {
                const rows: Table.RowData[] = [
                    {
                        dsorg: undefined,
                        uri: "zowe-ds:/profile/TEST.PDS/MEM1",
                        _tree: { parentId: "zowe-ds:/profile/TEST.PDS", id: "zowe-ds:/profile/TEST.PDS/MEM1" },
                    },
                ];

                const result = (datasetTableView as any).canOpenInEditor(rows);
                expect(result).toBe(true);
            });
        });

        describe("onDidReceiveMessage", () => {
            let mockContext: ExtensionContext;
            let mockNode: ZoweDatasetNode;
            let mockTableViewProvider: any;
            let datasetTableView: DatasetTableView;

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
                datasetTableView = DatasetTableView.getInstance();
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

                (datasetTableView as any).currentDataSource = mockDataSource;

                // Mock the table instance and its webview
                const mockWebview = { postMessage: jest.fn() };
                const mockPanel = { webview: mockWebview };
                (datasetTableView as any).table = { panel: mockPanel };

                const message = {
                    command: "loadTreeChildren",
                    payload: {
                        nodeId: "zowe-ds:/sestest/TEST.PDS",
                    },
                };

                await datasetTableView["onDidReceiveMessage"](message);

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

                (datasetTableView as any).currentDataSource = mockDataSource;

                // Mock the table instance and its webview
                const mockWebview = { postMessage: jest.fn() };
                const mockPanel = { webview: mockWebview };
                (datasetTableView as any).table = { panel: mockPanel };

                const message = {
                    command: "someOtherCommand",
                    payload: {
                        nodeId: "zowe-ds:/sestest/TEST.PDS",
                    },
                };

                await datasetTableView["onDidReceiveMessage"](message);

                expect(mockDataSource.loadChildren).not.toHaveBeenCalled();
                expect(mockWebview.postMessage).not.toHaveBeenCalled();
            });

            it("should handle 'loadTreeChildren' when currentDataSource does not have loadChildren method", async () => {
                const mockDataSource = {
                    // No loadChildren method
                };

                (datasetTableView as any).currentDataSource = mockDataSource;

                // Mock the table instance and its webview
                const mockWebview = { postMessage: jest.fn() };
                const mockPanel = { webview: mockWebview };
                (datasetTableView as any).table = { panel: mockPanel };

                const message = {
                    command: "loadTreeChildren",
                    payload: {
                        nodeId: "zowe-ds:/sestest/TEST.PDS",
                    },
                };

                await datasetTableView["onDidReceiveMessage"](message);

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
        jest.spyOn(Gui, "infoMessage").mockImplementation(async () => {});
        jest.spyOn(Gui, "errorMessage").mockImplementation(async () => {});
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
            const dataSource = new TreeDataSource(sessionNode, []);
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

    describe("getPinActionTitle", () => {
        it('should return "Pin" if no rows are selected', async () => {
            const title = await (datasetTableView as any).getPinActionTitle([]);
            expect(title).toBe("Pin");
        });

        it('should return "Unpin" if all selected rows are pinned', async () => {
            const rows = [{ dsname: "A" }, { dsname: "B" }];
            (mockTable.getPinnedRows as jest.Mock).mockResolvedValue(rows);
            const title = await (datasetTableView as any).getPinActionTitle(rows);
            expect(title).toBe("Unpin");
        });

        it('should return "Pin" if some selected rows are not pinned', async () => {
            const rows = [{ dsname: "A" }, { dsname: "B" }];
            (mockTable.getPinnedRows as jest.Mock).mockResolvedValue([{ dsname: "A" }]);
            const title = await (datasetTableView as any).getPinActionTitle(rows);
            expect(title).toBe("Pin");
        });

        it('should return "Pin" on error', async () => {
            (mockTable.getPinnedRows as jest.Mock).mockRejectedValue(new Error("failure"));
            const title = await (datasetTableView as any).getPinActionTitle([{ dsname: "A" }]);
            expect(title).toBe("Pin");
        });
    });

    describe("togglePinSelectedRows", () => {
        it("should unpin rows if all are pinned", async () => {
            const rows = { 0: { dsname: "A" }, 1: { dsname: "B" } };
            const rowsArray = Object.values(rows);
            (mockTable.getPinnedRows as jest.Mock).mockResolvedValue(rowsArray);

            await (datasetTableView as any).togglePinSelectedRows({} as Table.View, rows);

            expect(mockTable.unpinRows).toHaveBeenCalledWith(rowsArray);
            expect(mockTable.pinRows).not.toHaveBeenCalled();
            expect(Gui.infoMessage).toHaveBeenCalledWith("Successfully unpinned {0} row(s) from the table.");
        });

        it("should pin rows if some are not pinned", async () => {
            const rows = { 0: { dsname: "A" }, 1: { dsname: "B" } };
            const rowsArray = Object.values(rows);
            (mockTable.getPinnedRows as jest.Mock).mockResolvedValue([{ dsname: "A" }]);

            await (datasetTableView as any).togglePinSelectedRows({} as Table.View, rows);

            expect(mockTable.pinRows).toHaveBeenCalledWith(rowsArray);
            expect(mockTable.unpinRows).not.toHaveBeenCalled();
            expect(Gui.infoMessage).toHaveBeenCalledWith("Successfully pinned {0} row(s) to the top of the table.");
        });

        it("should show error message on failure", async () => {
            const rows = { 0: { dsname: "A" } };
            (mockTable.pinRows as jest.Mock).mockResolvedValue(false);

            await (datasetTableView as any).togglePinSelectedRows({} as Table.View, rows);

            expect(Gui.errorMessage).toHaveBeenCalledWith("Failed to pin rows to the table.");
        });

        it("should show error message on exception", async () => {
            const rows = { 0: { dsname: "A" } };
            const error = new Error("API error");
            (mockTable.getPinnedRows as jest.Mock).mockRejectedValue(error);

            await (datasetTableView as any).togglePinSelectedRows({} as Table.View, rows);

            expect(Gui.errorMessage).toHaveBeenCalledWith("Error toggling pin state for rows: {0}");
        });
    });

    describe("dispose", () => {
        it("should reset shouldShow property", () => {
            (datasetTableView as any).shouldShow = { dsname: true, dsorg: true };
            datasetTableView.dispose();
            expect((datasetTableView as any).shouldShow).toEqual({});
        });
    });
});
