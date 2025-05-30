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

import { IZoweDatasetTreeNode, Table, TableBuilder, TableViewProvider } from "@zowe/zowe-explorer-api";
import { commands, ExtensionContext, l10n, Uri } from "vscode";
import { SharedUtils } from "../shared/SharedUtils";
import { SharedContext } from "../shared/SharedContext";
import { SharedTreeProviders } from "../shared/SharedTreeProviders";
import { posix } from "path";

export class DatasetTableView {
    private cachedChildren: IZoweDatasetTreeNode[];
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
            field: "member",
            headerName: l10n.t("Member Name"),
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
    ];
    private rowActions: Record<string, Table.ActionOpts> = {
        openInEditor: {
            title: l10n.t("Open"),
            command: "open",
            callback: { fn: DatasetTableView.openInEditor, typ: "multi-row" },
            condition: (rows: Table.RowData[]) => rows.every((r) => (r["dsorg"] as string)?.startsWith("PS")),
        },
    };

    private static async openInEditor(this: void, _view: Table.View, rows: Record<number, Table.RowData>): Promise<void> {
        const allRows = Object.values(rows);
        for (const row of allRows) {
            await commands.executeCommand("vscode.open", Uri.parse(row.uri as string));
        }
    }

    private static _instance: DatasetTableView;
    private constructor() {}

    private profileName: string = "";
    private shouldShow: Record<string, boolean> = {};
    private table: Table.Instance;

    public static getInstance(): DatasetTableView {
        if (!DatasetTableView._instance) {
            DatasetTableView._instance = new DatasetTableView();
        }

        return DatasetTableView._instance;
    }

    private buildTitle(profileNode: IZoweDatasetTreeNode): string {
        if (profileNode.pattern) {
            return l10n.t({
                message: `[${this.profileName}]: {0}`,
                args: [profileNode.pattern],
                comment: ["Data Set Search Pattern"],
            });
        }

        return l10n.t(`[${this.profileName}]: *`);
    }

    private cacheChildren(sessionNode: IZoweDatasetTreeNode): void {
        this.cachedChildren = sessionNode.children.filter((child) => !SharedContext.isInformation(child));
    }

    private isDsMemberUri(uri: string): boolean {
        return uri.split("/").length > 3;
    }

    /**
     * Action callback fired when selecting the "Reveal in tree" context-menu option.
     * @param _view The table view (for use within the callback)
     * @param data The selected job (row contents) to reveal in the tree view.
     */
    public static async displayInTree(this: void, _view: Table.View, data: Table.RowInfo): Promise<void> {
        const datasetTable = DatasetTableView.getInstance();
        const isDsMember = datasetTable.isDsMemberUri(data.row.uri as string);
        if (isDsMember) {
            // First find the parent data set
            const parentUri = posix.resolve(data.row.uri as string, "..");
            const parentDsNode = datasetTable.cachedChildren.find((child) => child.resourceUri?.toString() === parentUri);
            if (parentDsNode) {
                const child = parentDsNode.children?.find((c) => c.label === data.row.member);
                await SharedTreeProviders.ds.getTreeView().reveal(child, { focus: true });
            }
        } else {
            const dsNode = datasetTable.cachedChildren.find((child) => child.resourceUri?.toString() === data.row.uri);
            await SharedTreeProviders.ds.getTreeView().reveal(dsNode, { expand: true });
        }
    }

    private mapDsNodeToRow(dsNode: IZoweDatasetTreeNode): Table.RowData {
        const dsStats = dsNode.getStats();

        const fieldsToCheck = ["createdDate", "dsorg", "modifiedDate", "lrecl", "migr", "recfm", "user"];
        fieldsToCheck.forEach((field) => {
            this.shouldShow[field] ||= dsStats?.[field] != null;
        });

        this.shouldShow["volumes"] ||= dsStats?.["vols"] != null || dsStats?.["vol"] != null;
        this.shouldShow["member"] ||= SharedContext.isDsMember(dsNode);
        this.shouldShow["dsname"] ||= !SharedContext.isDsMember(dsNode);

        if (SharedContext.isDsMember(dsNode)) {
            this.shouldShow["member"] = true;
            this.shouldShow["dsname"] = false;
            return {
                member: dsNode.label.toString(),
                createdDate: dsStats?.createdDate?.toLocaleTimeString(),
                modifiedDate: dsStats?.modifiedDate?.toLocaleTimeString(),
                lrecl: dsStats?.["lrecl"],
                migr: dsStats?.["migr"],
                recfm: dsStats?.["recfm"],
                user: dsStats?.["user"],
                uri: dsNode.resourceUri?.toString(),
            };
        } else {
            this.shouldShow["dsname"] = true;
            this.shouldShow["member"] = false;
            return {
                dsname: dsNode.label.toString(),
                dsorg: dsStats?.["dsorg"],
                createdDate: dsStats?.createdDate?.toLocaleTimeString(),
                modifiedDate: dsStats?.modifiedDate?.toLocaleTimeString(),
                lrecl: dsStats?.["lrecl"],
                migr: dsStats?.["migr"] ?? "NO",
                recfm: dsStats?.["recfm"],
                volumes: dsStats?.["vols"] ?? dsStats?.["vol"],
                uri: dsNode.resourceUri?.toString(),
            };
        }
    }

    /**
     * Generates a table given the list of children and the profile node that was selected.
     * @param context The VS Code extension context (to provide to the table view)
     * @param profileNode The profile node selected for the "Show as Table" action
     */
    private async generateTable(context: ExtensionContext, profileNode: IZoweDatasetTreeNode): Promise<Table.Instance> {
        const rows = this.cachedChildren.map((item) => this.mapDsNodeToRow(item));
        if (this.table) {
            await this.table.setTitle(this.buildTitle(profileNode));
            await this.table.setContent(rows);
        } else {
            this.table = new TableBuilder(context)
                .options({
                    autoSizeStrategy: { type: "fitCellContents" },
                    pagination: true,
                    rowSelection: "multiple",
                    selectEverything: true,
                    suppressRowClickSelection: true,
                })
                .isView()
                .title(this.buildTitle(profileNode))
                .addRows(rows)
                .columns(
                    ...[
                        ...this.expectedFields.map((field) => ({
                            filter: true,
                            ...field,
                            initialHide: this.shouldShow[field.field] === false,
                        })),
                        { field: "actions", hide: true },
                    ]
                )
                .addContextOption("all", this.contextOptions.displayInTree)
                .addRowAction("all", this.rowActions.openInEditor)
                .build();
        }

        return this.table;
    }

    /**
     * Command handler for the Jobs table view. Called when the action "Show as Table" is selected on a Job session node.
     *
     * @param context The VS Code extension context (to provide to the table view)
     * @param node The Job session node that was selected for the action
     * @param nodeList Passed to `SharedUtils.getSelectedNodeList` to get final list of selected nodes
     */
    public async handleCommand(context: ExtensionContext, node: IZoweDatasetTreeNode, nodeList: IZoweDatasetTreeNode[]): Promise<void> {
        const selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList) as IZoweDatasetTreeNode[];
        if (selectedNodes.length !== 1) {
            return;
        }
        if (!SharedContext.isSession(selectedNodes[0])) {
            return;
        }

        this.profileName = selectedNodes[0].label.toString();
        this.cacheChildren(selectedNodes[0]);
        await TableViewProvider.getInstance().setTableView(await this.generateTable(context, selectedNodes[0]));
    }
}
