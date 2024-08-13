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

import { IZoweJobTreeNode, Table, TableBuilder, TableViewProvider } from "@zowe/zowe-explorer-api";
import { SharedTreeProviders } from "../shared/SharedTreeProviders";
import { ExtensionContext, l10n } from "vscode";
import { JobActions } from "./JobActions";
import { ZoweJobNode } from "./ZoweJobNode";
import { SharedUtils } from "../shared/SharedUtils";
import { SharedContext } from "../shared/SharedContext";

export class JobTableView {
    private static cachedChildren: IZoweJobTreeNode[];
    private static table: Table.Instance;

    private static contextOptions: Record<string, Table.ContextMenuOpts> = {
        getJcl: {
            title: "Get JCL",
            command: "get-jcl",
            callback: {
                fn: JobTableView.getJcl,
                typ: "single-row",
            },
        },
        revealInTree: {
            title: "Reveal in tree",
            command: "reveal-in-tree",
            callback: {
                fn: JobTableView.revealInTree,
                typ: "single-row",
            },
        },
    };
    private static rowActions: Record<string, Table.ActionOpts> = {
        cancelJob: {
            title: "Cancel",
            command: "cancel-job",
            callback: {
                fn: JobTableView.cancelJobs,
                typ: "multi-row",
            },
            type: "secondary",
            condition: (data: Table.RowData[]): boolean => data.every((row) => row["status"] === "ACTIVE"),
        },
        deleteJob: {
            title: "Delete",
            command: "delete-job",
            callback: {
                fn: JobTableView.deleteJobs,
                typ: "multi-row",
            },
            type: "secondary",
        },
        downloadJob: {
            title: "Download",
            command: "download-job",
            callback: {
                fn: JobTableView.downloadJobs,
                typ: "multi-row",
            },
            type: "primary",
        },
    };

    /**
     * Action callback fired when selecting the "Get JCL" context-menu option.
     * @param _view The table view (for use within the callback)
     * @param data The selected job (row contents) to fetch the JCL for.
     */
    public static async getJcl(_view: Table.View, data: Table.RowInfo) {
        const child = JobTableView.cachedChildren.find((c) => data.row.id === c.job?.jobid);
        if (child != null) {
            await JobActions.downloadJcl(child as ZoweJobNode);
        }
    }

    /**
     * Action callback fired when selecting the "Reveal in tree" context-menu option.
     * @param _view The table view (for use within the callback)
     * @param data The selected job (row contents) to reveal in the tree view.
     */
    public static async revealInTree(_view: Table.View, data: Table.RowInfo) {
        const child = JobTableView.cachedChildren.find((c) => data.row.id === c.job?.jobid);
        if (child) {
            await SharedTreeProviders.job.getTreeView().reveal(child, { expand: true });
        }
    }

    /**
     * "Cancel job" action callback for one or more jobs in the table.
     * @param view The table view, for use inside the callback
     * @param data The selected job row(s) to cancel
     */
    public static async cancelJobs(view: Table.View, data: Record<number, Table.RowData>): Promise<void> {
        const childrenToCancel = Object.values(data)
            .map((row) => JobTableView.cachedChildren.find((c) => row.id === c.job?.jobid))
            .filter((child) => child);
        if (childrenToCancel.length > 0) {
            await JobActions.cancelJobs(SharedTreeProviders.job, childrenToCancel);
            const profNode = childrenToCancel[0].getSessionNode() as ZoweJobNode;
            JobTableView.cachedChildren = await profNode.getChildren();
            await view.setContent(
                JobTableView.cachedChildren.map((item) => ({
                    name: item.job.jobname,
                    class: item.job.class,
                    owner: item.job.owner,
                    id: item.job.jobid,
                    retcode: item.job.retcode,
                    status: item.job.status,
                }))
            );
        }
    }

    /**
     * "Delete job" action callback for one or more jobs in the table.
     * @param view The table view, for use inside the callback
     * @param data The selected job row(s) to delete
     */
    public static async deleteJobs(view: Table.View, data: Record<number, Table.RowData>): Promise<void> {
        const childrenToDelete = Object.values(data)
            .map((row) => JobTableView.cachedChildren.find((c) => row.id === c.job?.jobid))
            .filter((child) => child);
        if (childrenToDelete.length > 0) {
            const sessionNode = childrenToDelete[0].getSessionNode();
            await JobActions.deleteCommand(SharedTreeProviders.job, undefined, childrenToDelete);
            JobTableView.cachedChildren = await sessionNode.getChildren();
            await view.setContent(
                JobTableView.cachedChildren.map((item: IZoweJobTreeNode) => ({
                    name: item.job.jobname,
                    class: item.job.class,
                    owner: item.job.owner,
                    id: item.job.jobid,
                    retcode: item.job.retcode,
                    status: item.job.status,
                }))
            );
        }
    }

    /**
     * "Download job" action callback for one or more jobs in the table.
     * @param view The table view, for use inside the callback
     * @param data The selected job row(s) to download
     */
    public static async downloadJobs(_view: Table.View, data: Record<number, Table.RowData>): Promise<void> {
        const childrenToDelete = Object.values(data)
            .map((row) => JobTableView.cachedChildren.find((c) => row.id === c.job?.jobid))
            .filter((child) => child);
        if (childrenToDelete.length > 0) {
            await JobActions.downloadSpool(childrenToDelete);
        }
    }

    /**
     * Command handler for the Jobs table view. Called when the action "Show as table" is selected on a Job session node.
     *
     * @param context The VS Code extension context (to provide to the table view)
     * @param node The Job session node that was selected for the action
     * @param nodeList (unused)
     */
    public static async handleCommand(context: ExtensionContext, node: IZoweJobTreeNode, nodeList: IZoweJobTreeNode[]): Promise<void> {
        const selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList) as IZoweJobTreeNode[];
        if (selectedNodes.length !== 1) {
            return;
        }
        if (!SharedContext.isSession(selectedNodes[0])) {
            return;
        }

        const profileNode = selectedNodes[0];
        this.cachedChildren = await profileNode.getChildren();
        TableViewProvider.getInstance().setTableView(await JobTableView.generateTable(context, profileNode));
    }

    /**
     * Generates a table given the list of children and the profile node that was selected.
     * @param context The VS Code extension context (to provide to the table view)
     * @param profileNode The profile node selected for the "Show as table" action
     */
    private static async generateTable(context: ExtensionContext, profileNode: IZoweJobTreeNode): Promise<Table.Instance> {
        if (this.table) {
            await this.table.setTitle(`Jobs view: ${profileNode.owner} | ${profileNode.prefix} | ${profileNode.status}`);
            await this.table.setContent(
                JobTableView.cachedChildren
                    .filter((c) => c.label !== l10n.t("No jobs found"))
                    .map((item) => ({
                        name: item.job.jobname,
                        class: item.job.class,
                        owner: item.job.owner,
                        id: item.job.jobid,
                        retcode: item.job.retcode,
                        status: item.job.status,
                    }))
            );
        } else {
            this.table = new TableBuilder(context)
                .options({
                    autoSizeStrategy: { type: "fitCellContents", colIds: ["name", "class", "owner", "id", "retcode", "status"] },
                    pagination: true,
                    rowSelection: "multiple",
                })
                .isView()
                .title(`Jobs: ${profileNode.owner} | ${profileNode.prefix} | ${profileNode.status}`)
                .rows(
                    ...JobTableView.cachedChildren
                        .filter((c) => c.label !== l10n.t("No jobs found"))
                        .map((item) => ({
                            name: item.job.jobname,
                            class: item.job.class,
                            owner: item.job.owner,
                            id: item.job.jobid,
                            retcode: item.job.retcode,
                            status: item.job.status,
                        }))
                )
                .columns(
                    ...[
                        {
                            field: "name",
                            headerName: "Name",
                            checkboxSelection: true,
                            filter: true,
                            headerCheckboxSelection: true,
                            sort: "asc",
                        } as Table.ColumnOpts,
                        {
                            field: "class",
                            headerName: "Class",
                            filter: true,
                        },
                        { field: "owner", headerName: "Owner", filter: true },
                        { field: "id", headerName: "ID", filter: true },
                        { field: "retcode", headerName: "Return Code", filter: true },
                        { field: "status", headerName: "Status", filter: true },
                        { field: "actions", hide: true },
                    ]
                )
                .addContextOption("all", this.contextOptions.getJcl)
                .addContextOption("all", this.contextOptions.revealInTree)
                .addRowAction("all", this.rowActions.cancelJob)
                .addRowAction("all", this.rowActions.deleteJob)
                .addRowAction("all", this.rowActions.downloadJob)
                .build();
        }

        return this.table;
    }
}
