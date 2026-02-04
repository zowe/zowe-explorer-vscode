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

import {
    Gui,
    IZoweDatasetTreeNode,
    Table,
    TableBuilder,
    TableViewProvider,
    IDataSetInfo,
    IDataSetSource,
    DataSetTableType,
    IDataSetTableEvent,
    DataSetTableEventType,
    Sorting,
    PersistenceSchemaEnum,
} from "@zowe/zowe-explorer-api";
import { commands, Event, EventEmitter, ExtensionContext, l10n, Uri } from "vscode";
import { SharedUtils } from "../shared/SharedUtils";
import { SharedContext } from "../shared/SharedContext";
import { SharedTreeProviders } from "../shared/SharedTreeProviders";
import { ProfileManagement } from "../../management/ProfileManagement";
import { Definitions } from "../../configuration/Definitions";
import { Profiles } from "../../configuration/Profiles";
import { ZoweExplorerApiRegister } from "../../extending/ZoweExplorerApiRegister";
import { AuthUtils } from "../../utils/AuthUtils";
import * as imperative from "@zowe/imperative";
import { ZoweExplorerExtender } from "../../extending/ZoweExplorerExtender";
import { ZowePersistentFilters } from "../../tools/ZowePersistentFilters";

/**
 * Tree-based data source that uses existing tree nodes
 */
export class TreeDataSource implements IDataSetSource {
    public constructor(public treeNode: IZoweDatasetTreeNode) { }

    /**
     * Fetches dataset information based on the cached children tree nodes.
     *
     * @returns {IDataSetInfo[]} An array of dataset information objects, each representing a dataset.
     */
    public async fetchDataSets(): Promise<IDataSetInfo[]> {
        // Force a refresh of the tree node
        this.treeNode.dirty = true;
        const children = await this.treeNode.getChildren(false);
        return children.map((dsNode) => this.mapNodeToInfo(dsNode));
    }

    /**
     * Retrieves the title for the dataset table view based on the tree node context.
     *
     * @returns {string} A formatted string representing the title of the table view.
     *
     * - If the tree node represents a PDS, it includes the profile name and the dataset label.
     * - If the tree node has a search pattern, it includes the profile name and the search pattern.
     * - Otherwise, it includes only the profile name with a wildcard.
     */
    public getTitle(): string {
        if (SharedContext.isPds(this.treeNode)) {
            return `[${this.treeNode.getProfileName()}]: ${this.treeNode.label as string}`;
        }
        if (this.treeNode.pattern) {
            return l10n.t({
                message: `[{0}]: {1}`,
                args: [this.treeNode.getProfileName(), this.treeNode.pattern],
                comment: ["Profile Name", "Data Set Search Pattern"],
            });
        }

        return l10n.t("[{0}]: *", this.treeNode.getProfileName());
    }

    /**
     * Determines whether the data source supports a hierarchical tree structure.
     *
     * The function checks if the tree node represents a session and if any of its cached children
     * are PDS nodes.
     *
     * @returns {boolean} Returns `true` if the tree node is a session and at least one of its children
     * is a PDS, indicating support for hierarchical tree structure. Returns `false` otherwise.
     */
    public async supportsHierarchy(): Promise<boolean> {
        if (!SharedContext.isSession(this.treeNode)) {
            return false;
        }
        const children = await this.treeNode.getChildren(false);
        return children.some((child) => SharedContext.isPds(child));
    }

    /**
     * Loads children for a specific parent (PDS) based on the cached children tree nodes.
     * Falls back to using the API directly if the PDS is no longer accessible in the tree.
     *
     * @param parentId The ID of the parent dataset.
     * @returns {IDataSetInfo[]} An array of dataset information objects, each representing a dataset.
     */
    public async loadChildren(parentId: string): Promise<IDataSetInfo[]> {
        const parentUri = Uri.parse(parentId);
        const children = await this.treeNode.getChildren(false);
        const pdsNode = children.find((child) => {
            return child.resourceUri?.path === parentUri.path && SharedContext.isPds(child);
        });

        if (pdsNode) {
            const mChildren: IZoweDatasetTreeNode[] = await pdsNode.getChildren(false);
            return (
                mChildren
                    ?.filter((memberNode: IZoweDatasetTreeNode) => !SharedContext.isInformation(memberNode))
                    .map((memberNode: IZoweDatasetTreeNode) => this.mapNodeToInfo(memberNode, parentId)) ?? []
            );
        }

        // Fallback: If the PDS node is not found in the tree (e.g., pattern changed),
        // use the API directly to load the members
        const profile = this.treeNode.getSessionNode()?.getProfile();
        if (profile) {
            const uriSegments = parentUri.path.split("/");
            if (uriSegments.length >= 3) {
                // URI format: /profile/dataset.name
                const datasetName = uriSegments[2];

                try {
                    const mvsApi = ZoweExplorerApiRegister.getMvsApi(profile);
                    const membersResp = await mvsApi.allMembers(datasetName, { attributes: true });
                    const members: IDataSetInfo[] = [];

                    for (const member of membersResp.apiResponse?.items || []) {
                        members.push(buildMemberInfo(member, parentId));
                    }

                    return members;
                } catch (err) {
                    await AuthUtils.handleProfileAuthOnError(err, profile);
                    return [];
                }
            }
        }

        return [];
    }

    /**
     * Maps a dataset tree node to a dataset information object.
     *
     * @param dsNode The dataset tree node to be mapped.
     * @param parentId An optional parent ID for hierarchical context.
     *
     * @returns {IDataSetInfo} An object containing the dataset information.
     */
    private mapNodeToInfo(dsNode: IZoweDatasetTreeNode, parentId?: string): IDataSetInfo {
        const dsStats = dsNode.getStats();
        const isMigrated = dsStats == null || (Object.keys(dsStats).length === 0 && !SharedContext.isDsMember(dsNode));
        const migr = isMigrated ? "YES" : dsStats?.["migr"];

        return {
            name: dsNode.label as string,
            dsorg: dsStats?.["dsorg"],
            createdDate: dsStats?.createdDate,
            modifiedDate: dsStats?.modifiedDate,
            lrecl: dsStats?.["lrecl"],
            migr,
            recfm: dsStats?.["recfm"],
            volumes: dsStats?.["vols"] ?? dsStats?.["vol"],
            user: dsStats?.["user"],
            uri: dsNode.resourceUri?.toString(),
            isMember: SharedContext.isDsMember(dsNode),
            isDirectory: SharedContext.isPds(dsNode),
            parentId,
        };
    }
}

/**
 * Helper function to build member information from API response
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildMemberInfo(member: any, parentUri: string): IDataSetInfo {
    // Parse c4date and m4date with mtime if available
    let createdDate: Date | undefined;
    let modifiedDate: Date | undefined;

    if (member.c4date) {
        createdDate = new Date(member.c4date);
    }

    if (member.m4date) {
        modifiedDate = new Date(member.m4date);
        // Add time component if available
        if (member.mtime) {
            const [hours, minutes] = member.mtime.split(":");
            modifiedDate.setHours(parseInt(hours, 10), parseInt(minutes, 10));

            // Add seconds component if available
            if (member.msec) {
                modifiedDate.setSeconds(parseInt(member.msec, 10));
            }
        }
    }

    const memberUri = `${parentUri}/${member.member as string}`;

    return {
        name: member.member,
        createdDate,
        modifiedDate,
        user: member.user,
        uri: memberUri,
        isMember: true,
        isDirectory: false,
        parentId: parentUri,
        vers: member.vers,
        mod: member.mod,
        cnorc: member.cnorc,
        inorc: member.inorc,
        mnorc: member.mnorc,
        sclm: member.sclm,
    };
}

/**
 * API-based data source that directly queries the MVS API with a pattern
 */
export class PatternDataSource implements IDataSetSource {
    public constructor(public profile: imperative.IProfileLoaded, private pattern: string) {
        this.pattern = this.pattern.toLocaleUpperCase();
    }

    public getPattern(): string {
        return this.pattern;
    }

    public async fetchDataSets(): Promise<IDataSetInfo[]> {
        const mvsApi = ZoweExplorerApiRegister.getMvsApi(this.profile);
        const dataSets: IDataSetInfo[] = [];

        const dsPatterns = [
            ...new Set(
                this.pattern
                    .toUpperCase()
                    .split(",")
                    .map((p: string) => p.trim())
            ),
        ];

        try {
            const datasetResponses = [];
            if (mvsApi.dataSetsMatchingPattern) {
                datasetResponses.push(await mvsApi.dataSetsMatchingPattern(dsPatterns, { attributes: true }));
            } else {
                for (const dsp of dsPatterns) {
                    datasetResponses.push(await mvsApi.dataSet(dsp, { attributes: true }));
                }
            }

            for (const resp of datasetResponses) {
                for (const ds of resp.apiResponse?.items ?? resp.apiResponse ?? []) {
                    if (ds.dsorg === "VS") {
                        // Skip VSAM data sets for now
                        continue;
                    }

                    dataSets.push({
                        name: ds.dsname,
                        dsorg: ds.dsorg,
                        createdDate: ds.createdDate ? new Date(ds.createdDate) : undefined,
                        modifiedDate: ds.modifiedDate ? new Date(ds.modifiedDate) : undefined,
                        lrecl: ds.lrecl,
                        migr: ds.migr?.toLocaleUpperCase() === "YES" ? "YES" : "NO",
                        recfm: ds.recfm,
                        volumes: ds.vols || ds.vol,
                        user: ds.user,
                        uri: `zowe-ds:/${this.profile.name}/${ds.dsname as string}`,
                        isMember: false,
                        isDirectory: ds.dsorg?.startsWith("PO"),
                    });
                }
            }
        } catch (err) {
            await AuthUtils.handleProfileAuthOnError(err, this.profile);
            throw err;
        }

        return dataSets;
    }

    public getTitle(): string {
        return l10n.t({
            message: "[{0}]: {1}",
            args: [this.profile.name, this.pattern],
            comment: ["Profile Name", "Data Set Search Pattern"],
        });
    }

    public supportsHierarchy(): boolean {
        return true; // API results can include PDS that support lazy loading
    }

    public async loadChildren(parentId: string): Promise<IDataSetInfo[]> {
        // Extract dataset name from URI
        const segments = parentId.split("/");
        if (segments.length < 3) {
            // Invalid URI, format must be zowe-ds:/<profile_name>/<data_set_name>
            return [];
        }

        const datasetName = segments.pop();
        if (!datasetName) {
            return [];
        }

        const mvsApi = ZoweExplorerApiRegister.getMvsApi(this.profile);

        try {
            const membersResp = await mvsApi.allMembers(datasetName, { attributes: true });
            const members: IDataSetInfo[] = [];

            for (const member of membersResp.apiResponse?.items || []) {
                members.push(buildMemberInfo(member, parentId));
            }

            return members;
        } catch (err) {
            await AuthUtils.handleProfileAuthOnError(err, this.profile);
            return [];
        }
    }
}

/**
 * Data source for PDS members view
 */
export class PDSMembersDataSource implements IDataSetSource {
    public constructor(
        public parentDataSource: IDataSetSource | null,
        public pdsName: string,
        private pdsUri: string,
        private profile: imperative.IProfileLoaded
    ) { }

    public async fetchDataSets(): Promise<IDataSetInfo[]> {
        if (this.parentDataSource?.loadChildren && this.parentDataSource instanceof PatternDataSource) {
            return await this.parentDataSource.loadChildren(this.pdsUri);
        }

        // Fallback to API if parent data source doesn't support loading children
        if (this.profile) {
            const mvsApi = ZoweExplorerApiRegister.getMvsApi(this.profile);
            try {
                const membersResp = await mvsApi.allMembers(this.pdsName, { attributes: true });
                const members: IDataSetInfo[] = [];

                for (const member of membersResp.apiResponse?.items || []) {
                    members.push(buildMemberInfo(member, this.pdsUri));
                }

                return members;
            } catch (err) {
                if (this.profile) {
                    await AuthUtils.handleProfileAuthOnError(err, this.profile);
                }
                return [];
            }
        }

        return [];
    }

    public getTitle(): string {
        return l10n.t({
            message: "[{0}] Members of {1}",
            args: [this.profile.name, this.pdsName],
            comment: ["Profile name", "PDS name"],
        });
    }

    public supportsHierarchy(): boolean {
        return false; // Members don't have children
    }

    public getParentDataSource(): IDataSetSource {
        return this.parentDataSource;
    }
}

export class DatasetTableView {
    // Justification: Table page size options are not considered magic numbers
    // eslint-disable-next-line no-magic-numbers
    private PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 500, 1000];
    private contextOptions: Record<string, Table.ContextMenuOption> = {
        displayInTree: {
            title: l10n.t("Display in Tree"),
            command: "display-in-tree",
            callback: {
                fn: DatasetTableView.displayInTree,
                typ: "single-row",
            },
        },
        pinRow: {
            title: (data: Table.RowData): Promise<string> => {
                return this.getPinTitle([data]);
            },
            command: "pin-row",
            callback: {
                fn: this.togglePinRows.bind(this),
                typ: "single-row",
            },
        },
    };

    // User locale captured at table build time for date formatting
    private userLocale: string = "en-US";

    // These fields are typically included in data set metadata.
    private expectedFields: Partial<Table.Column | Table.ColumnOpts>[] = [
        {
            field: "dsname",
            headerName: l10n.t("Data Set Name"),
            initialSort: "asc",
        },
        {
            field: "dsorg",
            headerName: l10n.t("Data Set Organization"),
        },
        {
            field: "createdDate",
            headerName: l10n.t("Creation Date"),
            useDateComparison: true,
            valueFormatter: (params: { value: string }): string => {
                if (!params.value) {
                    return "";
                }
                return new Date(params.value).toLocaleDateString(this.userLocale);
            },
        },
        {
            field: "modifiedDate",
            headerName: l10n.t("Modified Date"),
            useDateComparison: true,
            valueFormatter: (params: { value: string }): string => {
                if (!params.value) {
                    return "";
                }
                return new Date(params.value).toLocaleString(this.userLocale);
            },
        },
        { field: "lrecl", headerName: l10n.t("Record Length") },
        { field: "migr", headerName: l10n.t("Migrated") },
        { field: "recfm", headerName: l10n.t("Record Format") },
        { field: "volumes", headerName: l10n.t("Volumes") },
        { field: "user", headerName: l10n.t("Last Modified By") },
        // Member-specific fields
        { field: "vers", headerName: l10n.t("Version") },
        { field: "mod", headerName: l10n.t("Modification Level") },
        { field: "cnorc", headerName: l10n.t("Current Records") },
        { field: "inorc", headerName: l10n.t("Initial Records") },
        { field: "mnorc", headerName: l10n.t("Modified Records") },
        { field: "sclm", headerName: l10n.t("SCLM") },
    ];

    // Dataset-specific columns (shown when currentTableType is not "members")
    private datasetFields = ["dsname", "dsorg", "createdDate", "modifiedDate", "lrecl", "migr", "recfm", "volumes", "user"];

    // Member-specific columns (shown when currentTableType is "members")
    private memberFields = ["dsname", "createdDate", "modifiedDate", "user", "vers", "mod", "cnorc", "inorc", "mnorc", "sclm"];

    private rowActions: Record<string, Table.Action> = {
        openInEditor: {
            title: l10n.t("Open"),
            command: "open",
            callback: { fn: DatasetTableView.openInEditor, typ: "multi-row" },
            type: "primary",
            condition: (rows: Table.RowData[]): boolean => {
                return this.canOpenInEditor(rows);
            },
        },
        pinRows: {
            title: (rows: Table.RowData[]): Promise<string> => {
                return this.getPinTitle(rows);
            },
            command: "pin-selected-rows",
            callback: { fn: this.togglePinRows.bind(this), typ: "multi-row" },
            type: "secondary",
            condition: (rows: Table.RowData[]): boolean => {
                // Allow pinning/unpinning any selected rows
                return rows.length > 0;
            },
        },
        focusPDS: {
            title: l10n.t("Focus"),
            command: "focus",
            type: "secondary",
            callback: { fn: this.focusOnPDS.bind(this), typ: "single-row" },
            condition: (elem: { index: number; row: Table.RowData[] }): boolean => {
                const dsorg = elem.row?.["dsorg"] as string;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const hasTreeData = (elem.row as any)._tree as Table.TreeNodeData;
                const isMember = hasTreeData?.parentId != null;

                // Only allow focus for PDS datasets (not members)
                return dsorg?.startsWith("PO") && !isMember;
            },
            hideCondition: () => this.currentDataSource instanceof PDSMembersDataSource,
        },
        goBack: {
            title: l10n.t("Back"),
            type: "primary",
            command: "back",
            callback: { fn: this.goBack.bind(this), typ: "no-selection" },
            hideCondition: () => this.currentTableType == null || this.currentTableType === "dataSets",
        },
    };

    private canOpenInEditor(rows: Table.RowData[]): boolean {
        if (rows.length === 0) {
            return false;
        }

        return rows.every((r) => {
            // Check if it's a sequential dataset (PS) or a PDS member
            const dsorg = r["dsorg"] as string;
            const hasTreeData = (r as Record<string, unknown>)._tree as Table.TreeNodeData;
            const isMember = hasTreeData?.parentId != null;

            // Allow opening for PS data sets or PDS members, whether in focused mode or as tree view
            return this.currentTableType === "members" || dsorg?.startsWith("PS") || isMember;
        });
    }

    private static readonly URI_SEGMENTS = {
        MEMBER: 3,
        DATASET: 2,
    };

    private static async openInEditor(this: void, _view: Table.View, rows: Record<number, Table.RowData>): Promise<void> {
        const allRows = Object.values(rows);
        for (const row of allRows) {
            await commands.executeCommand("vscode.open", Uri.parse(row.uri as string), { preview: false });
        }
    }

    /**
     * Focus on a selected PDS to show its members
     */
    private async focusOnPDS(this: DatasetTableView, _view: Table.View, data: Table.RowInfo): Promise<void> {
        const row = data.row;
        const pdsName = row.dsname as string;
        const pdsUri = row.uri as string;

        let profile: imperative.IProfileLoaded | undefined;
        if (this.currentDataSource instanceof PatternDataSource) {
            profile = this.currentDataSource.profile;
        } else if (this.currentDataSource instanceof TreeDataSource) {
            profile = this.currentDataSource.treeNode.getSessionNode()?.getProfile();
        }

        let pinnedRows: Table.RowData[] = [];
        try {
            pinnedRows = await this.table.getPinnedRows();
        } catch (error) {
            // TODO: Use ZoweLogger
            // eslint-disable-next-line no-console
            console.warn("Failed to get pinned rows:", error);
        }

        // Store current table state before navigating
        this.previousTableData = {
            dataSource: this.currentDataSource,
            tableType: this.currentTableType,
            shouldShow: { ...this.shouldShow },
            table: this.table,
            gridState: await this.table.getGridState(),
            pinnedRows: pinnedRows,
            originalPattern: this.originalPattern,
        };

        // Create a new data source for PDS members
        const membersDataSource = new PDSMembersDataSource(this.currentDataSource, pdsName, pdsUri, profile);

        // Update current state
        this.currentDataSource = membersDataSource;
        this.currentTableType = "members";
        this.shouldShow = {}; // Reset for members view

        // Generate and display the members table (this will create a new table)
        this.table = await this.generateTable(this.context);
        await TableViewProvider.getInstance().setTableView(this.table);
        await this.table.setPage(0);
        await this.table.setPinnedRows([]);
    }

    /**
     * Go back to the previous data source view
     */
    private async goBack(this: DatasetTableView, _view: Table.View, _data: Table.RowInfo): Promise<void> {
        if (this.previousTableData) {
            // Check if we need to replace TreeDataSource with PatternDataSource due to pattern change
            let dataSourceToRestore = this.previousTableData.dataSource;

            if (this.previousTableData.dataSource instanceof TreeDataSource && this.previousTableData.originalPattern) {
                const treeNode = this.previousTableData.dataSource.treeNode;
                const currentPattern = treeNode.pattern;

                // If the pattern has changed since the table was created, use PatternDataSource
                // to preserve the original pattern that was used when the table was shown
                if (currentPattern !== this.previousTableData.originalPattern) {
                    const profile = treeNode.getSessionNode()?.getProfile();
                    if (profile) {
                        dataSourceToRestore = new PatternDataSource(profile, this.previousTableData.originalPattern);
                    }
                }
            }

            // Restore previous table state
            this.currentDataSource = dataSourceToRestore;
            this.currentTableType = "dataSets";
            this.shouldShow = this.previousTableData.shouldShow;
            // Restore the original pattern from when the table was first created
            this.originalPattern = this.previousTableData.originalPattern;

            // Force re-generation of the table by clearing the current instance.
            // This is necessary because generateTable tries to update an existing table if one exists,
            // but we need a completely new table instance to get a fresh webview with active listeners.
            this.table = null;
            this.table = await this.generateTable(this.context);
            await TableViewProvider.getInstance().setTableView(this.table);
            await this.table.waitForAPI();
            await this.table.setGridState(this.previousTableData.gridState);

            // Restore pinned rows after grid state is restored
            if (this.previousTableData.pinnedRows && this.previousTableData.pinnedRows.length > 0) {
                try {
                    await this.table.setPinnedRows(this.previousTableData.pinnedRows);
                } catch (error) {
                    // TODO: Use ZoweLogger
                    // eslint-disable-next-line no-console
                    console.warn("Failed to restore pinned rows:", error);
                }
            }

            // Clear navigation state
            this.previousTableData = null;
        }
    }

    /**
     * Get the appropriate title for the pin/unpin action based on provided rows
     *
     * @param rows The rows to check pin status for (single or multiple)
     * @returns Promise resolving to "Pin" or "Unpin" based on current state
     */
    private async getPinTitle(rows: Table.RowData[]): Promise<string> {
        try {
            if (!this.table || rows.length === 0) {
                return l10n.t("Pin");
            }

            const pinnedRows = await this.table.getPinnedRows();

            // Check if all provided rows are currently pinned
            const allRowsPinned = rows.every((selectedRow) =>
                pinnedRows.some((pinnedRow) => JSON.stringify(selectedRow) === JSON.stringify(pinnedRow))
            );

            return allRowsPinned ? l10n.t("Unpin") : l10n.t("Pin");
        } catch (_error) {
            // Fallback to "Pin" if we can't determine the state
            return l10n.t("Pin");
        }
    }

    /**
     * Toggle pin/unpin for rows based on their current pinned state
     *
     * This action dynamically pins or unpins dataset rows. If all target rows
     * are currently pinned, it will unpin them. If any target rows are not pinned,
     * it will pin all target rows to the top of the table view.
     *
     * Supports both single-row (context menu) and multi-row (action button) operations.
     *
     * @param _view The table view instance
     * @param data Either a single row data (for context menu) or record of selected rows (for action button)
     *
     * @example
     * // When user selects rows and clicks "Pin/Unpin" action:
     * // - If rows are not pinned: they are moved to the top of the table
     * // - If rows are already pinned: they are unpinned and returned to normal position
     * // - User receives confirmation message about the action performed
     */
    private async togglePinRows(this: DatasetTableView, _view: Table.View, data: Table.RowInfo | Record<number, Table.RowData>): Promise<void> {
        try {
            // Handle both single-row (RowInfo) and multi-row (Record) cases
            const rowsArray: Table.RowData[] =
                "row" in data
                    ? [data.row] // Single-row case (context menu)
                    : Object.values(data); // Multi-row case (action button)

            const pinnedRows = await this.table.getPinnedRows();

            // Check if all target rows are currently pinned
            const allRowsPinned = rowsArray.every((selectedRow) =>
                pinnedRows.some((pinnedRow) => JSON.stringify(selectedRow) === JSON.stringify(pinnedRow))
            );

            let success: boolean;
            let actionPerformed: string;

            if (allRowsPinned) {
                // All target rows are pinned, so unpin them
                success = await this.table.unpinRows(rowsArray);
                actionPerformed = "unpinned";
            } else {
                // Some or all target rows are not pinned, so pin them
                success = await this.table.pinRows(rowsArray);
                actionPerformed = "pinned";
            }

            if (success) {
                const messageKey =
                    actionPerformed === "pinned"
                        ? "Successfully pinned {0} row(s) to the top of the table."
                        : "Successfully unpinned {0} row(s) from the table.";

                Gui.infoMessage(
                    l10n.t({
                        message: messageKey,
                        args: [rowsArray.length.toString()],
                        comment: ["Number of rows pinned/unpinned"],
                    })
                );
            } else {
                const errorKey = actionPerformed === "pinned" ? "Failed to pin rows to the table." : "Failed to unpin rows from the table.";

                Gui.errorMessage(l10n.t(errorKey));
            }
        } catch (error) {
            Gui.errorMessage(
                l10n.t({
                    message: "Error toggling pin state for rows: {0}",
                    args: [error instanceof Error ? error.message : String(error)],
                    comment: ["Error message"],
                })
            );
        }
    }
    private onDataSetTableChangedEmitter: EventEmitter<IDataSetTableEvent>;
    public onDataSetTableChanged: Event<IDataSetTableEvent>;
    private static _instance: DatasetTableView;
    private constructor() {
        this.onDataSetTableChangedEmitter = new EventEmitter<IDataSetTableEvent>();
        this.onDataSetTableChanged = this.onDataSetTableChangedEmitter.event;
    }

    private currentTableType: DataSetTableType = null;
    private shouldShow: Record<string, boolean> = {};
    private table: Table.Instance = null;
    private currentDataSource: IDataSetSource = null;
    private context: ExtensionContext = null;
    private originalPattern: string = null;
    private persistence = new ZowePersistentFilters(PersistenceSchemaEnum.Dataset);

    // Store previous table state for navigation
    private previousTableData: {
        dataSource: IDataSetSource;
        tableType: DataSetTableType;
        shouldShow: Record<string, boolean>;
        table: Table.Instance;
        gridState?: Record<string, unknown>;
        pinnedRows: Table.RowData[];
        originalPattern?: string;
    } = null;

    // Static table identifiers for this table view
    private static readonly TABLE_ID_DATASETS = Table.Context.Identifiers.DATA_SETS;
    private static readonly TABLE_ID_MEMBERS = Table.Context.Identifiers.DATA_SET_MEMBERS;

    public static getInstance(): DatasetTableView {
        if (!DatasetTableView._instance) {
            DatasetTableView._instance = new DatasetTableView();
        }

        return DatasetTableView._instance;
    }

    private isDsMemberUri(uri: string): boolean {
        // zowe-ds:/<profile_name>/<data_set_name>/<member_name>
        return uri.split("/").length > DatasetTableView.URI_SEGMENTS.MEMBER;
    }

    /**
     * Action callback fired when selecting the "Reveal in tree" context-menu option.
     * @param _view The table view (for use within the callback)
     * @param data The selected job (row contents) to reveal in the tree view.
     */
    public static async displayInTree(this: void, _view: Table.View, data: Table.RowInfo): Promise<void> {
        const datasetTable = DatasetTableView.getInstance();

        // Check if this is a tree node with parent-child relationship
        const treeData = (data.row as Record<string, unknown>)._tree as Table.TreeNodeData;
        const isDsMember = datasetTable.isDsMemberUri(data.row.uri as string) || treeData?.parentId != null;

        if (isDsMember) {
            // For members, we need to find or create the PDS node in the tree
            const uri = data.row.uri as string;
            const uriParts = uri.substring(uri.indexOf("/") + 1).split("/");
            const [profileName, datasetName, memberName] = uriParts;

            // First, try to find in session nodes
            const profileNode = SharedTreeProviders.ds.mSessionNodes.find(
                (node) => (node.label as string).toString() === profileName
            ) as IZoweDatasetTreeNode;
            let foundInSession = false;

            if (profileNode) {
                // Load children if not already loaded
                await profileNode.getChildren(false);

                // Find the PDS node
                const pdsNode = profileNode.children?.find((child) => (child.label as string).toString() === datasetName);

                if (pdsNode) {
                    // Load PDS members if not already loaded
                    await pdsNode.getChildren(false);

                    // Find the member node
                    const memberNode = pdsNode.children?.find((child) => (child.label as string).toString() === memberName);

                    if (memberNode) {
                        await SharedTreeProviders.ds.getTreeView().reveal(memberNode, { focus: true });
                        foundInSession = true;
                    }
                }
            }

            // If not found in session nodes, search in favorites
            if (!foundInSession) {
                for (const favProfileNode of SharedTreeProviders.ds.mFavorites) {
                    if ((favProfileNode.label as string).toString() === profileName) {
                        await favProfileNode.getChildren(false);

                        // Look for the PDS in favorites
                        const favPdsNode = favProfileNode.children?.find((child) => (child.label as string).toString() === datasetName);

                        if (favPdsNode) {
                            // Load PDS members if not already loaded
                            await favPdsNode.getChildren(false);

                            // Find the member node
                            const favMemberNode = favPdsNode.children?.find((child) => (child.label as string).toString() === memberName);

                            if (favMemberNode) {
                                await SharedTreeProviders.ds.getTreeView().reveal(favMemberNode, { focus: true });
                                return;
                            }
                        }
                    }
                }
            }
        } else {
            // For dataset nodes, try to find in tree or expand session
            const uri = data.row.uri as string;
            const uriParts = uri.substring(uri.indexOf("/") + 1).split("/");
            const [profileName, datasetName] = uriParts;

            // First, try to find in session nodes
            const profileNode = SharedTreeProviders.ds.mSessionNodes.find(
                (node) => (node.label as string).toString() === profileName
            ) as IZoweDatasetTreeNode;
            let foundInSession = false;

            if (profileNode) {
                await profileNode.getChildren(false);
                const dsNode = profileNode.children?.find((child) => (child.label as string).toString() === datasetName);

                if (dsNode) {
                    await SharedTreeProviders.ds.getTreeView().reveal(dsNode, { expand: true });
                    foundInSession = true;
                }
            }

            // If not found in session nodes, search in favorites
            if (!foundInSession) {
                for (const favProfileNode of SharedTreeProviders.ds.mFavorites) {
                    if ((favProfileNode.label as string).toString() === profileName) {
                        await favProfileNode.getChildren(false);

                        // Look for the dataset in favorites
                        const favDsNode = favProfileNode.children?.find((child) => (child.label as string).toString() === datasetName);

                        if (favDsNode) {
                            await SharedTreeProviders.ds.getTreeView().reveal(favDsNode, { expand: true });
                            return;
                        }
                    }
                }
            }
        }
    }

    private mapDatasetInfoToRow(info: IDataSetInfo): Table.RowData {
        const fieldsToCheck = ["createdDate", "dsorg", "modifiedDate", "lrecl", "migr", "recfm", "user"];
        fieldsToCheck.forEach((field) => {
            this.shouldShow[field] ||= info[field] != null;
        });

        // Member-specific fields
        const memberFieldsToCheck = ["vers", "mod", "cnorc", "inorc", "mnorc", "sclm"];
        memberFieldsToCheck.forEach((field) => {
            this.shouldShow[field] ||= info[field] != null;
        });

        this.shouldShow["volumes"] ||= info.volumes != null;
        this.shouldShow["dsname"] = true;

        return {
            dsname: info.name,
            dsorg: info.dsorg || "",
            createdDate: info.createdDate?.toISOString(),
            modifiedDate: info.modifiedDate?.toISOString(),
            lrecl: info.lrecl,
            migr: info.migr,
            recfm: info.recfm,
            volumes: info.volumes,
            user: info.user,
            uri: info.uri,
            vers: info.vers,
            mod: info.mod,
            cnorc: info.cnorc,
            inorc: info.inorc,
            mnorc: info.mnorc,
            sclm: info.sclm,
        };
    }

    /**
     * Maps dataset info to table rows with hierarchical tree data structure.
     */
    private mapDatasetInfoToRowWithTree(info: IDataSetInfo): Table.RowData {
        const fieldsToCheck = ["createdDate", "dsorg", "modifiedDate", "lrecl", "migr", "recfm", "user"];
        fieldsToCheck.forEach((field) => {
            this.shouldShow[field] ||= info[field] != null;
        });

        const memberFieldsToCheck = ["vers", "mod", "cnorc", "inorc", "mnorc", "sclm"];
        memberFieldsToCheck.forEach((field) => {
            this.shouldShow[field] ||= info[field] != null;
        });

        this.shouldShow["volumes"] ||= info.volumes != null;
        this.shouldShow["dsname"] ||= true;

        const nodeId = info.uri || info.name;

        const baseRow = {
            dsname: info.name,
            dsorg: info.dsorg,
            createdDate: info.createdDate?.toISOString(),
            modifiedDate: info.modifiedDate?.toISOString(),
            lrecl: info.lrecl,
            migr: info.migr,
            recfm: info.recfm,
            volumes: info.volumes,
            user: info.user,
            uri: info.uri,
            vers: info.vers,
            mod: info.mod,
            cnorc: info.cnorc,
            inorc: info.inorc,
            mnorc: info.mnorc,
            sclm: info.sclm,
        };

        if (info.isMember) {
            return {
                ...baseRow,
                _tree: {
                    id: nodeId,
                    parentId: info.parentId,
                    depth: 1,
                    hasChildren: false,
                    isExpanded: false,
                } as Table.TreeNodeData,
            };
        } else {
            return {
                ...baseRow,
                _tree: {
                    id: nodeId,
                    parentId: undefined,
                    depth: 0,
                    hasChildren: info.isDirectory,
                    isExpanded: false,
                } as Table.TreeNodeData,
            };
        }
    }

    /**
     * Generates table rows from the current data source
     */
    private async generateRows(useTreeMode: boolean): Promise<Table.RowData[]> {
        const dataSets = await this.currentDataSource.fetchDataSets();

        if (useTreeMode) {
            return dataSets.map((info) => this.mapDatasetInfoToRowWithTree(info));
        } else {
            return dataSets.map((info) => this.mapDatasetInfoToRow(info));
        }
    }

    /**
     * Maps sorting options from tree view to corresponding table column fields
     */
    private mapSortOptionToColumnField(sortMethod: Sorting.DatasetSortOpts | Sorting.JobSortOpts): string {
        if (typeof sortMethod === "number" && sortMethod in Sorting.DatasetSortOpts) {
            switch (sortMethod as Sorting.DatasetSortOpts) {
                case Sorting.DatasetSortOpts.Name:
                    return "dsname";
                case Sorting.DatasetSortOpts.DateCreated:
                    return "createdDate";
                case Sorting.DatasetSortOpts.LastModified:
                    return "modifiedDate";
                case Sorting.DatasetSortOpts.UserId:
                    return "user";
                default:
                    return "dsname";
            }
        }
        return "dsname";
    }

    /**
     * Gets the tree node for sort order context
     */
    private getTreeNodeForSortContext(): IZoweDatasetTreeNode | undefined {
        if (this.currentDataSource instanceof TreeDataSource) {
            return this.currentDataSource.treeNode;
        } else if (this.currentDataSource instanceof PDSMembersDataSource) {
            // For PDS members, try to get the parent tree data source and use the PDS name to find the node
            const parentDataSource = this.currentDataSource.parentDataSource;
            if (parentDataSource instanceof TreeDataSource) {
                const treeNode = parentDataSource.treeNode;
                if (treeNode && treeNode.children) {
                    const pdsName = this.currentDataSource.pdsName;
                    const pdsNode = treeNode.children.find((child) => (child.label as string).toString() === pdsName);
                    return pdsNode;
                }
            }
        }
        return undefined;
    }

    /**
     * Gets the effective sort settings for a tree node, preferring persisted settings.
     */
    private getEffectiveSortSettings(treeNode: IZoweDatasetTreeNode): Sorting.NodeSort | undefined {
        return (
            this.persistence.getSortSetting(treeNode) ??
            treeNode.sort ??
            (SharedContext.isSession(treeNode) ? undefined : treeNode.getSessionNode()?.sort)
        );
    }

    /**
     * Applies tree node sorting to column definitions
     */
    private applyTreeSortToColumns(columnDefs: Table.Column[], treeNode?: IZoweDatasetTreeNode): Table.Column[] {
        if (!treeNode) {
            return columnDefs;
        }

        const sortSettings = this.getEffectiveSortSettings(treeNode);
        if (!sortSettings) {
            return columnDefs;
        }

        const { method, direction } = sortSettings;
        const sortField = this.mapSortOptionToColumnField(method);
        const sortDirection = direction === Sorting.SortDirection.Ascending ? "asc" : "desc";

        return columnDefs.map((col) => {
            if (col.field === sortField) {
                return {
                    ...col,
                    initialSort: sortDirection,
                };
            }
            return { ...col, initialSort: undefined };
        });
    }

    /**
     * Generates a table given the data source
     */
    private async generateTable(context: ExtensionContext): Promise<Table.Instance> {
        this.context = context; // Store context for navigation actions
        // Capture user locale at table build time for date formatting
        // Use Intl API to get the system's regional locale
        this.userLocale = new Intl.DateTimeFormat().resolvedOptions().locale;
        const useTreeMode = await this.currentDataSource.supportsHierarchy();
        const rows = await this.generateRows(useTreeMode);

        // Prepare column definitions based on table type
        const relevantFields = this.currentTableType === "members" ? this.memberFields : this.datasetFields;
        const filteredFields = this.expectedFields.filter((field) => relevantFields.includes(field.field));

        let columnDefs: Partial<Table.Column | Table.ColumnOpts>[] = filteredFields.map((field) => ({
            filter: true,
            ...field,
            // Update header name for dsname when showing members
            headerName: field.field === "dsname" && this.currentTableType === "members" ? l10n.t("Member Name") : field.headerName,
            initialHide: this.shouldShow[field.field] === false,
            // Set the tree column for dataset name when using tree mode
            ...(useTreeMode && field.field === "dsname"
                ? {
                    cellRenderer: "TreeCellRenderer",
                }
                : {}),
        }));

        // Apply tree node sorting to columns if this table is created from tree view
        const treeNode = this.getTreeNodeForSortContext();
        if (treeNode) {
            columnDefs = this.applyTreeSortToColumns(columnDefs as Table.Column[], treeNode);
        }

        const tableOptions: Table.GridProperties = {
            autoSizeStrategy: { type: "fitCellContents" } as const,
            pagination: true,
            paginationPageSize: 1000,
            paginationPageSizeSelector: this.PAGE_SIZE_OPTIONS,
            rowSelection: "multiple" as const,
            selectEverything: true,
            suppressRowClickSelection: true,
            // Enable custom tree mode when needed
            ...(useTreeMode
                ? {
                    customTreeMode: true,
                    customTreeColumnField: "dsname",
                    customTreeInitialExpansionDepth: 0, // Start with all PDS collapsed
                }
                : {}),
        };

        // Get additional actions and context menu items from registered providers
        const registry = ZoweExplorerExtender.getInstance().getTableProviderRegistry();
        const tableContext = this.buildTableContext();

        const additionalActions = await registry.getActions(tableContext);
        const additionalContextItems = await registry.getContextMenuItems(tableContext);

        if (this.table) {
            this.table.dispose();
        }

        const tableBuilder = new TableBuilder(context)
            .options(tableOptions)
            .isView()
            .title(this.currentDataSource.getTitle())
            .addRows(rows)
            .columns(...[...columnDefs as Table.ColumnOpts[], { field: "actions", hide: true }])
            .addContextOption("all", this.contextOptions.displayInTree)
            .addContextOption("all", this.contextOptions.pinRow)
            .addRowAction("all", this.rowActions.openInEditor)
            .addRowAction("all", this.rowActions.pinRows)
            .addRowAction("all", this.rowActions.focusPDS)
            .addRowAction("all", this.rowActions.goBack);

        // Add additional actions from registered providers
        for (const action of additionalActions) {
            tableBuilder.addRowAction("all", action);
        }

        // Add additional context menu items from registered providers
        for (const contextItem of additionalContextItems) {
            tableBuilder.addContextOption("all", contextItem);
        }

        this.table = tableBuilder.build();

        this.table.onDisposed((_e) => {
            this.dispose();

            this.onDataSetTableChangedEmitter.fire({
                source: this.currentDataSource,
                tableType: "dataSets",
                eventType: DataSetTableEventType.Disposed,
            });
        });

        this.onDataSetTableChangedEmitter.fire({
            source: this.currentDataSource,
            tableType: this.currentTableType,
            eventType: DataSetTableEventType.Created,
        });

        // Set up message handler for lazy loading if using tree mode
        if (useTreeMode) {
            // Subscribe to the onDidReceiveMessage event to handle "external" lazy loading command
            this.table.onDidReceiveMessage((e: Record<string, unknown>) => this.onDidReceiveMessage(e));
        }

        return this.table;
    }

    /**
     * Builds context information to pass to table action providers
     */
    private buildTableContext(): Table.Context.DataSet {
        const context: Table.Context.DataSet = {
            tableId: this.currentTableType === "members" ? DatasetTableView.TABLE_ID_MEMBERS : DatasetTableView.TABLE_ID_DATASETS,
            tableType: this.currentTableType,
            dataSource: this.currentDataSource,
        };

        // Add profile information if available
        if (this.currentDataSource instanceof PatternDataSource) {
            context.profile = this.currentDataSource.profile;
            context.profileName = this.currentDataSource.profile.name;
        } else if (this.currentDataSource instanceof TreeDataSource) {
            // Extract profile from tree node if possible
            const treeNode = this.currentDataSource.treeNode;
            if (treeNode) {
                context.profileName = treeNode.getProfileName?.() || treeNode.getProfile()?.name;
                context.treeNode = treeNode;
            }
        }

        return context;
    }

    private async onDidReceiveMessage(message: Record<string, unknown>): Promise<void> {
        const { command, requestId } = message;
        if (!command) {
            return;
        }
        // Handle custom lazy loading of PDS members
        if (message.command === "loadTreeChildren") {
            const { nodeId } = message.payload as { nodeId: string };

            if (this.currentDataSource.loadChildren) {
                const memberRows = await this.currentDataSource.loadChildren(nodeId);
                const tableRows = memberRows.map((info) => this.mapDatasetInfoToRowWithTree(info));

                // Send the loaded children back to the webview
                await (this.table.panel ?? this.table.view).webview.postMessage({
                    command: "treeChildrenLoaded",
                    requestId,
                    data: {
                        parentNodeId: nodeId,
                        children: tableRows,
                    },
                });
                return;
            }
        }
    }

    /**
     * Command handler for the Dataset table view from tree nodes.
     */
    public async handleCommand(context: ExtensionContext, node: IZoweDatasetTreeNode, nodeList: IZoweDatasetTreeNode[]): Promise<void> {
        this.shouldShow = {};
        this.originalPattern = null;
        const selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList) as IZoweDatasetTreeNode[];
        if (selectedNodes.length === 0) {
            selectedNodes.push(await this.selectAndAddProfile());
            if (!selectedNodes[0]) {
                return;
            }
        }

        if (selectedNodes.length !== 1) {
            Gui.infoMessage(l10n.t("Please select a single profile or PDS."));
            return;
        }

        const selectedNode = selectedNodes[0];
        if (!SharedContext.isSession(selectedNode) && !SharedContext.isPds(selectedNode)) {
            Gui.infoMessage(l10n.t("This action is only supported for session and PDS nodes. Please select a session or PDS node."));
            return;
        }

        await this.prepareAndDisplayTable(context, selectedNode);
    }

    /**
     * Command handler for pattern-based dataset searching from Command Palette.
     */
    public async handlePatternSearch(context: ExtensionContext): Promise<void> {
        this.shouldShow = {};
        this.originalPattern = null;

        // Get available profiles
        const allProfiles = ProfileManagement.getRegisteredProfileNameList(Definitions.Trees.MVS);
        if (allProfiles.length === 0) {
            Gui.infoMessage(l10n.t("No profiles available."));
            return;
        }

        // Let user select a profile
        const selectedProfileName = await Gui.showQuickPick(allProfiles, {
            title: l10n.t("Select a profile to search for data sets"),
            placeHolder: l10n.t("Select a profile"),
            ignoreFocusOut: true,
        });

        if (!selectedProfileName) {
            return;
        }

        // Get the pattern from user
        const pattern = await Gui.showInputBox({
            title: l10n.t("Enter Data Set Pattern"),
            placeHolder: l10n.t("e.g., USER.*, PUBLIC.DATA.*, etc."),
            prompt: l10n.t("Enter a dataset pattern to search for"),
            ignoreFocusOut: true,
        });

        if (!pattern) {
            return;
        }

        // Load the profile
        const profile = Profiles.getInstance().loadNamedProfile(selectedProfileName);
        if (!profile) {
            Gui.errorMessage(l10n.t({ message: "Profile {0} not found.", args: [selectedProfileName], comment: ["Name of the selected profile"] }));
            return;
        }

        // Create the pattern-based data source
        this.currentDataSource = new PatternDataSource(profile, pattern);
        this.currentTableType = "dataSets";
        this.originalPattern = pattern;

        // Generate and display the table
        await TableViewProvider.getInstance().setTableView(await this.generateTable(context));
        await commands.executeCommand("zowe-resources.focus");
    }

    // Helper method to select a profile and add it if not already added
    private async selectAndAddProfile(): Promise<IZoweDatasetTreeNode | undefined> {
        const allProfiles = ProfileManagement.getRegisteredProfileNameList(Definitions.Trees.MVS);
        if (allProfiles.length === 0) {
            Gui.infoMessage(l10n.t("No profiles available."));
            return undefined;
        }

        const resp = await Gui.showQuickPick(allProfiles, {
            title: l10n.t("Select a profile to search for data sets"),
            placeHolder: l10n.t("Select a profile"),
            ignoreFocusOut: true,
        });

        if (resp == null) {
            return undefined;
        }

        const profile = Profiles.getInstance().loadNamedProfile(resp);
        let profileNode = SharedTreeProviders.ds.mSessionNodes.find((s) => (s.label as string).toString() === resp) as IZoweDatasetTreeNode;
        if (!profileNode) {
            await SharedTreeProviders.ds.addSingleSession(profile);
            profileNode = SharedTreeProviders.ds.mSessionNodes.find((s) => (s.label as string).toString() === resp) as IZoweDatasetTreeNode;
        }

        await profileNode.getChildren(false);
        return profileNode;
    }

    // Helper method to prepare and display the table from tree nodes
    private async prepareAndDisplayTable(context: ExtensionContext, selectedNode: IZoweDatasetTreeNode): Promise<void> {
        if (SharedContext.isSession(selectedNode)) {
            if (selectedNode.pattern == null || selectedNode.pattern.length === 0) {
                await SharedTreeProviders.ds.filterPrompt(selectedNode);
            }
            this.currentDataSource = new TreeDataSource(selectedNode);
            this.currentTableType = "dataSets";
            this.originalPattern = selectedNode.pattern;
        } else if (SharedContext.isPds(selectedNode)) {
            const sessionNode = selectedNode.getSessionNode() as IZoweDatasetTreeNode;
            const profile = sessionNode.getProfile();
            const uri = selectedNode.resourceUri;

            this.currentDataSource = new PDSMembersDataSource(
                new TreeDataSource(sessionNode),
                (selectedNode.label as string).toString(),
                uri.toString(),
                profile
            );
            this.currentTableType = "members";
            this.originalPattern = sessionNode.pattern;
        }

        await TableViewProvider.getInstance().setTableView(await this.generateTable(context));
        await commands.executeCommand("zowe-resources.focus");
    }

    public dispose(): void {
        this.shouldShow = {};
    }
}
