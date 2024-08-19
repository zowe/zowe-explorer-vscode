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
import { ExtensionContext } from "vscode";
import { JobActions } from "./JobActions";
import { ZoweJobNode } from "./ZoweJobNode";
import { SharedUtils } from "../shared/SharedUtils";
import { SharedContext } from "../shared/SharedContext";
import { IJob } from "@zowe/zos-jobs-for-zowe-sdk";

export class JobTableView {
    private static cachedChildren: IZoweJobTreeNode[];
    private static contextOptions: Record<string, Table.ContextMenuOpts> = {
        getJcl: {
            title: "Get JCL",
            command: "get-jcl",
            callback: {
                fn: JobTableView.getJcl,
                typ: "single-row",
            },
        },
        displayInTree: {
            title: "Display in tree",
            command: "display-in-tree",
            callback: {
                fn: JobTableView.displayInTree,
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
    private static table: Table.Instance;

    private static buildTitle(profileNode: IZoweJobTreeNode): string {
        if (profileNode.searchId) {
            return `Jobs with ID: ${profileNode.searchId}`;
        }

        if (profileNode.owner && profileNode.prefix && profileNode.status) {
            return `Jobs: ${profileNode.owner} | ${profileNode.prefix} | ${profileNode.status}`;
        }

        return "Jobs";
    }

    private static async cacheChildren(sessionNode: IZoweJobTreeNode): Promise<void> {
        this.cachedChildren = (await sessionNode.getChildren()).filter((child) => !SharedContext.isInformation(child));
    }

    /**
     * "Cancel job" action callback for one or more jobs in the table.
     * @param view The table view, for use inside the callback
     * @param data The selected job row(s) to cancel
     */
    public static async cancelJobs(this: void, view: Table.View, data: Record<number, Table.RowData>): Promise<void> {
        const childrenToCancel = Object.values(data)
            .map((row) => JobTableView.cachedChildren.find((c) => row.jobid === c.job?.jobid))
            .filter((child) => child);
        if (childrenToCancel.length > 0) {
            await JobActions.cancelJobs(SharedTreeProviders.job, childrenToCancel);
            const profNode = childrenToCancel[0].getSessionNode();
            await JobTableView.cacheChildren(profNode);
            await view.setContent(JobTableView.cachedChildren.map((item) => JobTableView.jobPropertiesFor(item)));
        }
    }

    /**
     * "Delete job" action callback for one or more jobs in the table.
     * @param view The table view, for use inside the callback
     * @param data The selected job row(s) to delete
     */
    public static async deleteJobs(this: void, view: Table.View, data: Record<number, Table.RowData>): Promise<void> {
        const childrenToDelete = Object.values(data)
            .map((row) => JobTableView.cachedChildren.find((c) => row.jobid === c.job?.jobid))
            .filter((child) => child);
        if (childrenToDelete.length > 0) {
            const sessionNode = childrenToDelete[0].getSessionNode();
            await JobActions.deleteCommand(SharedTreeProviders.job, undefined, childrenToDelete);
            await JobTableView.cacheChildren(sessionNode);
            await view.setContent(JobTableView.cachedChildren.map((item: IZoweJobTreeNode) => JobTableView.jobPropertiesFor(item)));
        }
    }

    /**
     * Action callback fired when selecting the "Reveal in tree" context-menu option.
     * @param _view The table view (for use within the callback)
     * @param data The selected job (row contents) to reveal in the tree view.
     */
    public static async displayInTree(this: void, _view: Table.View, data: Table.RowInfo): Promise<void> {
        const child = JobTableView.cachedChildren.find((c) => data.row.jobid === c.job?.jobid);
        if (child) {
            await SharedTreeProviders.job.getTreeView().reveal(child, { expand: true });
        }
    }

    /**
     * "Download job" action callback for one or more jobs in the table.
     * @param view The table view, for use inside the callback
     * @param data The selected job row(s) to download spool files for
     */
    public static async downloadJobs(this: void, _view: Table.View, data: Record<number, Table.RowData>): Promise<void> {
        const childrenToDelete = Object.values(data)
            .map((row) => JobTableView.cachedChildren.find((c) => row.jobid === c.job?.jobid))
            .filter((child) => child);
        if (childrenToDelete.length > 0) {
            await JobActions.downloadSpool(childrenToDelete);
        }
    }

    /**
     * Action callback fired when selecting the "Get JCL" context-menu option.
     * @param _view The table view (for use within the callback)
     * @param data The selected job (row contents) to fetch the JCL for.
     */
    public static async getJcl(this: void, _view: Table.View, data: Table.RowInfo): Promise<void> {
        const child = JobTableView.cachedChildren.find((c) => data.row.jobid === c.job?.jobid);
        if (child != null) {
            await JobActions.downloadJcl(child as ZoweJobNode);
        }
    }

    /**
     * Generates a table given the list of children and the profile node that was selected.
     * @param context The VS Code extension context (to provide to the table view)
     * @param profileNode The profile node selected for the "Show as Table" action
     */
    private static async generateTable(context: ExtensionContext, profileNode: IZoweJobTreeNode): Promise<Table.Instance> {
        if (this.table) {
            await this.table.setTitle(this.buildTitle(profileNode));
            await this.table.setContent(JobTableView.cachedChildren.map((item) => this.jobPropertiesFor(item)));
        } else {
            this.table = new TableBuilder(context)
                .options({
                    pagination: true,
                    rowSelection: "multiple",
                    selectEverything: true,
                    suppressRowClickSelection: true,
                })
                .isView()
                .title(this.buildTitle(profileNode))
                .rows(...JobTableView.cachedChildren.map((item) => this.jobPropertiesFor(item)))
                .columns(
                    ...[
                        {
                            field: "jobname",
                            headerName: "Name",
                            filter: true,
                            sort: "asc",
                        } as Table.ColumnOpts,
                        {
                            field: "class",
                            headerName: "Class",
                            filter: true,
                        },
                        { field: "owner", headerName: "Owner", filter: true },
                        { field: "jobid", headerName: "ID", filter: true },
                        { field: "retcode", headerName: "Return Code", filter: true },
                        { field: "status", headerName: "Status", filter: true },
                        { field: "subsystem", headerName: "Subsystem", filter: true },
                        { field: "type", headerName: "Type", filter: true },
                        { field: "job-correlator", headerName: "Job Correlator", filter: true },
                        { field: "phase", headerName: "Phase", filter: true },
                        { field: "phase-name", headerName: "Phase Name", filter: true },
                        { field: "reason-not-running", headerName: "Error Details", filter: true },
                        { field: "actions", hide: true },
                    ]
                )
                .addContextOption("all", this.contextOptions.getJcl)
                .addContextOption("all", this.contextOptions.displayInTree)
                .addRowAction("all", this.rowActions.cancelJob)
                .addRowAction("all", this.rowActions.deleteJob)
                .addRowAction("all", this.rowActions.downloadJob)
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
    public static async handleCommand(context: ExtensionContext, node: IZoweJobTreeNode, nodeList: IZoweJobTreeNode[]): Promise<void> {
        const selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList) as IZoweJobTreeNode[];
        if (selectedNodes.length !== 1) {
            return;
        }
        if (!SharedContext.isSession(selectedNodes[0])) {
            return;
        }

        await this.cacheChildren(selectedNodes[0]);
        TableViewProvider.getInstance().setTableView(await JobTableView.generateTable(context, selectedNodes[0]));
    }

    /**
     * Helper function to obtain all renderable properties from a job node.
     * @param item The job node to get the properties from
     * @returns A subset of the `IJob` object, containing renderable properties only
     */
    private static jobPropertiesFor(item: IZoweJobTreeNode): Omit<IJob, "step-data"> {
        const { "step-data": _, ...rest } = { ...item.job };
        return rest;
    }
}
