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
import { ExtensionContext, l10n } from "vscode";
import { SharedUtils } from "../shared/SharedUtils";
import { SharedContext } from "../shared/SharedContext";

export class DatasetTableView {
    private static cachedChildren: IZoweDatasetTreeNode[];
    // private static contextOptions: Record<string, Table.ContextMenuOpts> = {
    //     displayInTree: {
    //         title: l10n.t("Display in Tree"),
    //         command: "display-in-tree",
    //         callback: {
    //             fn: DatasetTableView.displayInTree,
    //             typ: "single-row",
    //         },
    //     },
    // };
    // These fields are typically included in dataset metadata.
    private static expectedFields = [
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

    private static showHide = this.expectedFields.map((f) => f.initialHide);

    private static table: Table.Instance;

    private static buildTitle(profileNode: IZoweDatasetTreeNode): string {
        if (profileNode.pattern) {
            return l10n.t({
                message: `[${profileNode.label.toString()}]: {0}`,
                args: [profileNode.pattern],
                comment: ["Data Set Search Pattern"],
            });
        }

        return l10n.t(`[${profileNode.label.toString()}]: *`);
    }

    private static cacheChildren(sessionNode: IZoweDatasetTreeNode): void {
        this.cachedChildren = sessionNode.children.filter((child) => !SharedContext.isInformation(child));
    }

    /**
     * Action callback fired when selecting the "Reveal in tree" context-menu option.
     * @param _view The table view (for use within the callback)
     * @param data The selected job (row contents) to reveal in the tree view.
     */
    public static async displayInTree(this: void, _view: Table.View, data: Table.RowInfo): Promise<void> {
        // TODO: Determine if PDS member or PDS/DS
        // const child = DatasetTableView.cachedChildren.find((c) => data.row.jobid === c.job?.jobid);
        // if (child) {
        //     await SharedTreeProviders.ds.getTreeView().reveal(child, { expand: true });
        // }
    }

    private static mapDsNodeToRow(dsNode: IZoweDatasetTreeNode): Table.RowData {
        const dsStats = dsNode.getStats();

        if (SharedContext.isDsMember(dsNode)) {
            return {
                member: dsNode.label.toString(),
                createdDate: dsStats?.createdDate?.toLocaleTimeString(),
                modifiedDate: dsStats?.modifiedDate?.toLocaleTimeString(),
                lrecl: dsStats?.["lrecl"],
                migr: dsStats?.["migr"],
                recfm: dsStats?.["recfm"],
                user: dsStats?.["user"],
            };
        } else {
            return {
                dsname: dsNode.label.toString(),
                createdDate: dsStats?.createdDate?.toLocaleTimeString(),
                modifiedDate: dsStats?.modifiedDate?.toLocaleTimeString(),
                lrecl: dsStats?.["lrecl"],
                migr: dsStats?.["migr"],
                recfm: dsStats?.["recfm"],
                volumes: dsStats?.["vols"] ?? dsStats?.["vol"],
            };
        }
    }

    /**
     * Generates a table given the list of children and the profile node that was selected.
     * @param context The VS Code extension context (to provide to the table view)
     * @param profileNode The profile node selected for the "Show as Table" action
     */
    private static async generateTable(context: ExtensionContext, profileNode: IZoweDatasetTreeNode): Promise<Table.Instance> {
        const rows = DatasetTableView.cachedChildren.map((item) => this.mapDsNodeToRow(item));
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
                            initialHide: field.field === "member" && rows.some((r) => r["dsname"] != null),
                        })),
                        { field: "actions", hide: true },
                    ]
                )
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
    public static async handleCommand(context: ExtensionContext, node: IZoweDatasetTreeNode, nodeList: IZoweDatasetTreeNode[]): Promise<void> {
        const selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList) as IZoweDatasetTreeNode[];
        if (selectedNodes.length !== 1) {
            return;
        }
        if (!SharedContext.isSession(selectedNodes[0])) {
            return;
        }

        await this.cacheChildren(selectedNodes[0]);
        await TableViewProvider.getInstance().setTableView(await DatasetTableView.generateTable(context, selectedNodes[0]));
    }
}
