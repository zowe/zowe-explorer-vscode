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
    TableProviderRegistry,
    IDataSetInfo,
    IDataSetSource,
    DataSetTableType,
    IDataSetTableEvent,
    DataSetTableEventType,
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

/**
 * Tree-based data source that uses existing tree nodes
 */
export class TreeDataSource implements IDataSetSource {
    public constructor(public treeNode: IZoweDatasetTreeNode, private cachedChildren: IZoweDatasetTreeNode[]) {}

    /**
     * Fetches dataset information based on the cached children tree nodes.
     *
     * @returns {IDataSetInfo[]} An array of dataset information objects, each representing a dataset.
     */
    public fetchDataSets(): IDataSetInfo[] {
        return this.cachedChildren.map((dsNode) => this.mapNodeToInfo(dsNode));
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
            return `[${this.treeNode.getProfileName()}]: ${this.treeNode.label?.toString()}`;
        }
        if (this.treeNode.pattern) {
            return l10n.t({
                message: `[${this.treeNode.getProfileName()}]: {0}`,
                args: [this.treeNode.pattern],
                comment: ["Data Set Search Pattern"],
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
    public supportsHierarchy(): boolean {
        return SharedContext.isSession(this.treeNode) && this.cachedChildren.some((child) => SharedContext.isPds(child));
    }

    /**
     * Loads children for a specific parent (PDS) based on the cached children tree nodes.
     *
     * @param parentId The ID of the parent dataset.
     * @returns {IDataSetInfo[]} An array of dataset information objects, each representing a dataset.
     */
    public async loadChildren(parentId: string): Promise<IDataSetInfo[]> {
        const parentUri = Uri.parse(parentId);
        const pdsNode = this.cachedChildren.find((child) => {
            return child.resourceUri.path === parentUri.path && SharedContext.isPds(child);
        });

        if (pdsNode) {
            const children = await pdsNode.getChildren();
            return (
                children
                    ?.filter((memberNode) => !SharedContext.isInformation(memberNode))
                    .map((memberNode) => this.mapNodeToInfo(memberNode, parentId)) ?? []
            );
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

        return {
            name: dsNode.label?.toString(),
            dsorg: dsStats?.["dsorg"],
            createdDate: dsStats?.createdDate,
            modifiedDate: dsStats?.modifiedDate,
            lrecl: dsStats?.["lrecl"],
            migr: dsStats?.["migr"] ?? (SharedContext.isDsMember(dsNode) ? undefined : "NO"),
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
function buildMemberInfo(member: any, parentUri: string, profileName?: string): IDataSetInfo {
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
    public constructor(public profile: imperative.IProfileLoaded, private pattern: string) {}

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
                        migr: ds.migr === "yes" ? "YES" : "NO",
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
            message: `[${this.profile.name}]: {0}`,
            args: [this.pattern],
            comment: ["Data Set Search Pattern"],
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
            const membersResp = await mvsApi.allMembers(datasetName);
            const members: IDataSetInfo[] = [];

            for (const member of membersResp.apiResponse?.items || []) {
                members.push(buildMemberInfo(member, parentId, this.profile.name));
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
        private parentDataSource: IDataSetSource,
        private pdsName: string,
        private pdsUri: string,
        private profile?: imperative.IProfileLoaded
    ) {}

    public async fetchDataSets(): Promise<IDataSetInfo[]> {
        if (this.parentDataSource.loadChildren) {
            return await this.parentDataSource.loadChildren(this.pdsUri);
        }

        // Fallback to API if parent data source doesn't support loading children
        if (this.profile) {
            const mvsApi = ZoweExplorerApiRegister.getMvsApi(this.profile);
            try {
                const membersResp = await mvsApi.allMembers(this.pdsName);
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
            message: "Members of {0}",
            args: [this.pdsName],
            comment: ["PDS member list title"],
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
    private contextOptions: Record<string, Table.ContextMenuOpts> = {
        displayInTree: {
            title: l10n.t("Display in Tree"),
            command: "display-in-tree",
            callback: {
                fn: DatasetTableView.displayInTree,
                typ: "single-row",
            },
        },
    };

    // These fields are typically included in data set metadata.
    private expectedFields = [
        {
            field: "dsname",
            headerName: l10n.t("Data Set Name"),
            initialSort: "asc",
        } as Table.ColumnOpts,
        {
            field: "dsorg",
            headerName: l10n.t("Data Set Organization"),
        },
        {
            field: "createdDate",
            headerName: l10n.t("Creation Date"),
        },
        {
            field: "modifiedDate",
            headerName: l10n.t("Modified Date"),
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

    private rowActions: Record<string, Table.ActionOpts> = {
        openInEditor: {
            title: l10n.t("Open"),
            command: "open",
            callback: { fn: DatasetTableView.openInEditor, typ: "multi-row" },
            type: "primary",
            condition: (rows: Table.RowData[]): boolean =>
                rows.every((r) => {
                    // Check if it's a sequential dataset (PS) or a PDS member
                    const dsorg = r["dsorg"] as string;
                    const hasTreeData = (r as any)._tree as Table.TreeNodeData;
                    const isMember = hasTreeData?.parentId != null;

                    // Allow opening for PS data sets or PDS members, whether in focused mode or as tree view
                    return this.currentTableType === "members" || dsorg?.startsWith("PS") || isMember;
                }),
        },
        focusPDS: {
            title: l10n.t("Focus"),
            command: "focus",
            type: "secondary",
            callback: { fn: this.focusOnPDS.bind(this), typ: "single-row" },
            condition: (elem: { index: number; row: Table.RowData[] }): boolean => {
                const dsorg = elem.row?.["dsorg"] as string;
                const hasTreeData = (elem.row as any)._tree as Table.TreeNodeData;
                const isMember = hasTreeData?.parentId != null;

                // Only allow focus for PDS datasets (not members)
                return dsorg?.startsWith("PO") && !isMember;
            },
        },
        goBack: {
            title: l10n.t("Back"),
            type: "primary",
            command: "back",
            callback: { fn: this.goBack.bind(this), typ: "no-selection" },
            hideCondition: () => this.currentTableType !== "members",
        },
    };

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

        // Extract profile from current data source if it's a PatternDataSource
        let profile: imperative.IProfileLoaded | undefined;
        if (this.currentDataSource instanceof PatternDataSource) {
            profile = this.currentDataSource.profile;
        }

        // Store current table state before navigating
        this.previousTableData = {
            dataSource: this.currentDataSource,
            tableType: this.currentTableType,
            shouldShow: { ...this.shouldShow },
            table: this.table,
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
    }

    /**
     * Go back to the previous data source view
     */
    private async goBack(this: DatasetTableView, _view: Table.View, _data: Table.RowInfo): Promise<void> {
        if (this.previousTableData) {
            // Restore previous table state
            this.currentDataSource = this.previousTableData.dataSource;
            this.currentTableType = this.previousTableData.tableType;
            this.shouldShow = this.previousTableData.shouldShow;

            // Force re-generation of the table by clearing the current instance.
            // This is necessary because generateTable tries to update an existing table if one exists,
            // but we need a completely new table instance to get a fresh webview with active listeners.
            this.table = null;
            this.table = await this.generateTable(this.context);
            await TableViewProvider.getInstance().setTableView(this.table);

            // Clear navigation state
            this.previousTableData = null;
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

    // Store previous table state for navigation
    private previousTableData: {
        dataSource: IDataSetSource;
        tableType: DataSetTableType;
        shouldShow: Record<string, boolean>;
        table: Table.Instance;
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
        const treeData = (data.row as any)._tree as Table.TreeNodeData;
        const isDsMember = datasetTable.isDsMemberUri(data.row.uri as string) || treeData?.parentId != null;

        if (isDsMember) {
            // For members, we need to find or create the PDS node in the tree
            const uri = data.row.uri as string;
            const uriParts = uri.substring(uri.indexOf("/") + 1).split("/");
            const [profileName, datasetName, memberName] = uriParts;

            // Find the profile node
            const profileNode = SharedTreeProviders.ds.mSessionNodes.find((node) => node.label.toString() === profileName) as IZoweDatasetTreeNode;

            if (profileNode) {
                // Load children if not already loaded
                await profileNode.getChildren();

                // Find the PDS node
                const pdsNode = profileNode.children?.find((child) => child.label.toString() === datasetName);

                if (pdsNode) {
                    // Load PDS members if not already loaded
                    await pdsNode.getChildren();

                    // Find the member node
                    const memberNode = pdsNode.children?.find((child) => child.label.toString() === memberName);

                    if (memberNode) {
                        await SharedTreeProviders.ds.getTreeView().reveal(memberNode, { focus: true });
                        return;
                    }
                }
            }
        } else {
            // For dataset nodes, try to find in tree or expand session
            const uri = data.row.uri as string;
            const uriParts = uri.substring(uri.indexOf("/") + 1).split("/");
            const [profileName, datasetName] = uriParts;

            const profileNode = SharedTreeProviders.ds.mSessionNodes.find((node) => node.label.toString() === profileName) as IZoweDatasetTreeNode;

            if (profileNode) {
                await profileNode.getChildren();
                const dsNode = profileNode.children?.find((child) => child.label.toString() === datasetName);

                if (dsNode) {
                    await SharedTreeProviders.ds.getTreeView().reveal(dsNode, { expand: true });
                }
            }
        }
    }

    private mapDatasetInfoToRow(info: IDataSetInfo): Table.RowData {
        const fieldsToCheck = ["createdDate", "dsorg", "modifiedDate", "lrecl", "migr", "recfm", "user"];
        fieldsToCheck.forEach((field) => {
            this.shouldShow[field] ||= (info as any)[field] != null;
        });

        // Member-specific fields
        const memberFieldsToCheck = ["vers", "mod", "cnorc", "inorc", "mnorc", "sclm"];
        memberFieldsToCheck.forEach((field) => {
            this.shouldShow[field] ||= (info as any)[field] != null;
        });

        this.shouldShow["volumes"] ||= info.volumes != null;
        this.shouldShow["dsname"] = true;

        return {
            dsname: info.name,
            dsorg: info.dsorg || "",
            createdDate: info.createdDate?.toLocaleDateString(),
            modifiedDate: info.modifiedDate?.toLocaleString(),
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
            this.shouldShow[field] ||= (info as any)[field] != null;
        });

        const memberFieldsToCheck = ["vers", "mod", "cnorc", "inorc", "mnorc", "sclm"];
        memberFieldsToCheck.forEach((field) => {
            this.shouldShow[field] ||= (info as any)[field] != null;
        });

        this.shouldShow["volumes"] ||= info.volumes != null;
        this.shouldShow["dsname"] ||= true;

        const nodeId = info.uri || info.name;

        const baseRow = {
            dsname: info.name,
            dsorg: info.dsorg,
            createdDate: info.createdDate?.toLocaleDateString(),
            modifiedDate: info.modifiedDate?.toLocaleString(),
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
     * Generates a table given the data source
     */
    private async generateTable(context: ExtensionContext): Promise<Table.Instance> {
        this.context = context; // Store context for navigation actions
        const useTreeMode = this.currentDataSource.supportsHierarchy();
        const rows = await this.generateRows(useTreeMode);

        // Determine the current table type and ID
        const previousTableType = this.currentTableType;
        const tableTypeChanged = previousTableType !== this.currentTableType;

        // Prepare column definitions
        const columnDefs = this.expectedFields.map((field) => ({
            filter: true,
            ...field,
            initialHide: this.shouldShow[field.field] === false,
            // Set the tree column for dataset name when using tree mode
            ...(useTreeMode && field.field === "dsname"
                ? {
                      cellRenderer: "TreeCellRenderer",
                  }
                : {}),
        }));

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
        const registry = TableProviderRegistry.getInstance();
        const tableContext = this.buildTableContext();

        const additionalActions = await registry.getActions(tableContext);
        const additionalContextItems = await registry.getContextMenuItems(tableContext);

        if (this.table && !tableTypeChanged) {
            await this.table.setTitle(this.currentDataSource.getTitle());
            await this.table.setColumns([...columnDefs, { field: "actions", hide: true }]);
            await this.table.setContent(rows);
            if (useTreeMode) {
                await this.table.setOptions(tableOptions);
            }
        } else {
            const tableBuilder = new TableBuilder(context)
                .options(tableOptions)
                .isView()
                .title(this.currentDataSource.getTitle())
                .addRows(rows)
                .columns(...[...columnDefs, { field: "actions", hide: true }])
                .addContextOption("all", this.contextOptions.displayInTree)
                .addRowAction("all", this.rowActions.openInEditor)
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

            this.table.onDisposed((e) => {
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
                this.table.onDidReceiveMessage((e) => this.onDidReceiveMessage(e));
            }
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

    private async onDidReceiveMessage(message: Record<string, any>): Promise<any> {
        const { command, requestId } = message;
        if (!command) {
            return;
        }
        // Handle custom lazy loading of PDS members
        if (message.command === "loadTreeChildren") {
            const { nodeId } = message.payload;

            if (this.currentDataSource.loadChildren) {
                const memberRows = await this.currentDataSource.loadChildren(nodeId);
                const tableRows = memberRows.map((info) => this.mapDatasetInfoToRowWithTree(info));

                // Send the loaded children back to the webview
                await ((this.table as any).panel ?? (this.table as any).view).webview.postMessage({
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
            title: l10n.t("Enter Dataset Pattern"),
            placeHolder: l10n.t("e.g., USER.*, PUBLIC.DATA.*, etc."),
            prompt: l10n.t("Enter a dataset pattern to search for"),
            ignoreFocusOut: true,
        });

        if (!pattern) {
            return;
        }

        // Load the profile
        const profile = Profiles.getInstance().getProfileByName(selectedProfileName);
        if (!profile) {
            Gui.errorMessage(l10n.t({ message: "Profile {0} not found.", args: [selectedProfileName], comment: ["Name of the selected profile"] }));
            return;
        }

        // Create the pattern-based data source
        this.currentDataSource = new PatternDataSource(profile, pattern);

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

        const profile = Profiles.getInstance().getProfileByName(resp);
        let profileNode = SharedTreeProviders.ds.mSessionNodes.find((s) => s.label.toString() === resp) as IZoweDatasetTreeNode;
        if (!profileNode) {
            await SharedTreeProviders.ds.addSingleSession(profile);
            profileNode = SharedTreeProviders.ds.mSessionNodes.find((s) => s.label.toString() === resp) as IZoweDatasetTreeNode;
        }

        await profileNode.getChildren();
        return profileNode;
    }

    // Helper method to prepare and display the table from tree nodes
    private async prepareAndDisplayTable(context: ExtensionContext, selectedNode: IZoweDatasetTreeNode): Promise<void> {
        if (SharedContext.isSession(selectedNode)) {
            if (selectedNode.pattern == null || selectedNode.pattern.length === 0) {
                await SharedTreeProviders.ds.filterPrompt(selectedNode);
            }
            this.currentDataSource = new TreeDataSource(
                selectedNode,
                selectedNode.children.filter((child) => !SharedContext.isInformation(child))
            );
        } else if (SharedContext.isPds(selectedNode)) {
            this.currentDataSource = new TreeDataSource(
                selectedNode,
                selectedNode.children?.filter((child) => !SharedContext.isInformation(child)) || []
            );
        }

        await TableViewProvider.getInstance().setTableView(await this.generateTable(context));
        await commands.executeCommand("zowe-resources.focus");
    }

    public dispose(): void {
        this.shouldShow = {};
    }
}
