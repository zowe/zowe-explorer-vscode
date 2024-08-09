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
                fn: async (view: Table.View, data: Table.RowInfo) => {
                    const child = JobTableView.cachedChildren.find((c) => data.row.id === c.job?.jobid);
                    if (child != null) {
                        await JobActions.downloadJcl(child as ZoweJobNode);
                    }
                },
                typ: "single-row",
            },
        },
        revealInTree: {
            title: "Reveal in tree",
            command: "edit",
            callback: {
                fn: async (view: Table.View, data: Table.RowInfo) => {
                    const child = JobTableView.cachedChildren.find((c) => data.row.id === c.job?.jobid);
                    if (child) {
                        await SharedTreeProviders.job.getTreeView().reveal(child, { expand: true });
                    }
                },
                typ: "single-row",
            },
        },
    };

    private static rowActions: Record<string, Table.ActionOpts> = {
        cancelJob: {
            title: "Cancel",
            command: "cancel-job",
            callback: {
                fn: async (view: Table.View, data: Record<number, Table.RowData>): Promise<void> => {
                    const childrenToCancel = Object.values(data)
                        .map((row) => JobTableView.cachedChildren.find((c) => row.id === c.job?.jobid))
                        .filter((child) => child);
                    if (childrenToCancel.length > 0) {
                        await JobActions.cancelJobs(SharedTreeProviders.job, childrenToCancel);
                        const profNode = childrenToCancel[0].getSessionNode() as ZoweJobNode;
                        await view.setContent(
                            (
                                await profNode.getChildren()
                            ).map((item) => ({
                                name: item.job.jobname,
                                class: item.job.class,
                                owner: item.job.owner,
                                id: item.job.jobid,
                                retcode: item.job.retcode,
                                status: item.job.status,
                            }))
                        );
                    }
                },
                typ: "multi-row",
            },
            condition: (data: Table.RowData): boolean => data["status"] === "ACTIVE",
        },
        deleteJob: {
            title: "Delete",
            command: "delete-job",
            callback: {
                fn: async (view: Table.View, data: Record<number, Table.RowData>): Promise<void> => {
                    const childrenToDelete = Object.values(data)
                        .map((row) => JobTableView.cachedChildren.find((c) => row.id === c.job?.jobid))
                        .filter((child) => child);
                    if (childrenToDelete.length > 0) {
                        await JobActions.deleteCommand(SharedTreeProviders.job, undefined, childrenToDelete);
                        const newData = view.getContent();
                        for (const index of Object.keys(data).map(Number)) {
                            newData.splice(index, 1);
                        }
                        await view.setContent(newData);
                    }
                },
                typ: "multi-row",
            },
        },
    };

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
        TableViewProvider.getInstance().setTableView(await JobTableView.generateTable(context, this.cachedChildren, profileNode));
    }

    public static async generateTable(
        context: ExtensionContext,
        children: IZoweJobTreeNode[],
        profileNode: IZoweJobTreeNode
    ): Promise<Table.Instance> {
        if (this.table) {
            await this.table.setTitle(`Jobs view: ${profileNode.owner} | ${profileNode.prefix} | ${profileNode.status}`);
            await this.table.setContent(
                children
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
                    rowSelection: "multiple",
                })
                .isView()
                .title(`Jobs view: ${profileNode.owner} | ${profileNode.prefix} | ${profileNode.status}`)
                .rows(
                    ...children
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
                        { field: "name", checkboxSelection: true, filter: true, sort: "asc" } as Table.ColumnOpts,
                        {
                            field: "class",
                            filter: true,
                        },
                        { field: "owner", filter: true },
                        { field: "id", headerName: "ID", filter: true },
                        { field: "retcode", headerName: "Return Code", filter: true },
                        { field: "status", filter: true },
                        { field: "actions", hide: true },
                    ]
                )
                .addContextOption("all", this.contextOptions.getJcl)
                .addContextOption("all", this.contextOptions.revealInTree)
                .addRowAction("all", this.rowActions.cancelJob)
                .addRowAction("all", this.rowActions.deleteJob)
                .build();
        }

        return this.table;
    }
}
