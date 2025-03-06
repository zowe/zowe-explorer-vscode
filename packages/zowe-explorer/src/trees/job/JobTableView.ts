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
import { IJob } from "@zowe/zos-jobs-for-zowe-sdk";

export class JobTableView {
    private static cachedChildren: IZoweJobTreeNode[];
    private static contextOptions: Record<string, Table.ContextMenuOpts> = {
        getJcl: {
            title: l10n.t("Get JCL"),
            command: "get-jcl",
            callback: {
                fn: JobTableView.getJcl,
                typ: "single-row",
            },
        },
        displayInTree: {
            title: l10n.t("Display in Tree"),
            command: "display-in-tree",
            callback: {
                fn: JobTableView.displayInTree,
                typ: "single-row",
            },
        },
    };
    private static rowActions: Record<string, Table.ActionOpts> = {
        cancelJob: {
            title: l10n.t("Cancel"),
            command: "cancel-job",
            callback: {
                fn: JobTableView.cancelJobs,
                typ: "multi-row",
            },
            type: "secondary",
            condition: (data: Table.RowData[]): boolean => data.every((row) => row["status"] === "ACTIVE"),
        },
        deleteJob: {
            title: l10n.t("Delete"),
            command: "delete-job",
            callback: {
                fn: JobTableView.deleteJobs,
                typ: "multi-row",
            },
            type: "secondary",
        },
        downloadJob: {
            title: l10n.t("Download"),
            command: "download-job",
            callback: {
                fn: JobTableView.downloadJobs,
                typ: "multi-row",
            },
            type: "primary",
        },
    };
    // These fields are typically included in job metadata.
    private static expectedFields = [
        {
            field: "jobname",
            headerName: l10n.t("Name"),
            initialSort: "asc",
        } as Table.ColumnOpts,
        {
            field: "class",
            headerName: l10n.t("Class"),
        },
        { field: "owner", headerName: l10n.t("Owner") },
        { field: "jobid", headerName: l10n.t("ID") },
        { field: "retcode", headerName: l10n.t("Return Code") },
        { field: "status", headerName: l10n.t("Status") },
        { field: "subsystem", headerName: l10n.t("Subsystem") },
        { field: "type", headerName: l10n.t("Type") },
        { field: "job-correlator", headerName: l10n.t("Job Correlator") },
        { field: "phase", headerName: l10n.t("Phase") },
        { field: "phase-name", headerName: l10n.t("Phase Name") },
        { field: "exec-started", headerName: l10n.t("Time Started") },
        { field: "exec-submitted", headerName: l10n.t("Time Submitted") },
        { field: "exec-ended", headerName: l10n.t("Time Ended") },
        { field: "reason-not-running", headerName: l10n.t("Error Details") },
    ];

    private static table: Table.Instance;

    private static buildTitle(profileNode: IZoweJobTreeNode): string {
        if (profileNode.searchId) {
            return l10n.t({
                message: `Jobs with ID: {0}`,
                args: [profileNode.searchId],
                comment: ["Job Search ID"],
            });
        }

        if (profileNode.owner && profileNode.prefix && profileNode.status) {
            return l10n.t({
                message: `Jobs: {0} | {1} | {2}`,
                args: [profileNode.owner, profileNode.prefix, profileNode.status],
                comment: ["Job Owner", "Job Prefix", "Job Status"],
            });
        }

        return l10n.t("Jobs");
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
                    autoSizeStrategy: { type: "fitCellContents" },
                    pagination: true,
                    rowSelection: "multiple",
                    selectEverything: true,
                    suppressRowClickSelection: true,
                })
                .isView()
                .title(this.buildTitle(profileNode))
                .rows(...JobTableView.cachedChildren.map((item) => this.jobPropertiesFor(item)))
                .columns(...[...this.expectedFields.map((field) => ({ filter: true, ...field })), { field: "actions", hide: true }])
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
        await TableViewProvider.getInstance().setTableView(await JobTableView.generateTable(context, selectedNodes[0]));
    }

    /**
     * Helper function to obtain all renderable properties from a job node.
     * @param item The job node to get the properties from
     * @returns A subset of the `IJob` object, containing renderable properties only
     */
    private static jobPropertiesFor(item: IZoweJobTreeNode): Omit<IJob, "step-data"> {
        return item.job;
    }
}
