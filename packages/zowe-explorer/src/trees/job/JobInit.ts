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

import * as vscode from "vscode";
import { IZoweJobTreeNode, IZoweTreeNode, ZoweScheme, imperative, Gui, TableBuilder, Table, TableViewProvider } from "@zowe/zowe-explorer-api";
import { JobTree } from "./JobTree";
import { JobActions } from "./JobActions";
import { ZoweJobNode } from "./ZoweJobNode";
import { ZoweLogger } from "../../tools/ZoweLogger";
import { SharedActions } from "../shared/SharedActions";
import { SharedContext } from "../shared/SharedContext";
import { SharedInit } from "../shared/SharedInit";
import { SharedUtils } from "../shared/SharedUtils";
import { JobFSProvider } from "./JobFSProvider";
import { PollProvider } from "./JobPollProvider";
import { SharedTreeProviders } from "../shared/SharedTreeProviders";
export class JobInit {
    /**
     * Creates the Job tree that contains nodes of sessions, jobs and spool items
     *
     * @export
     * @class ZosJobsProvider
     * @implements {vscode.TreeDataProvider}
     */
    public static async createJobsTree(log: imperative.Logger): Promise<JobTree> {
        ZoweLogger.trace("ZosJobsProvider.createJobsTree called.");
        const tree = new JobTree();
        await tree.initializeJobsTree(log);
        await tree.addSession();
        return tree;
    }

    public static async initJobsProvider(context: vscode.ExtensionContext): Promise<JobTree> {
        ZoweLogger.trace("job.init.initJobsProvider called.");
        context.subscriptions.push(vscode.workspace.registerFileSystemProvider(ZoweScheme.Jobs, JobFSProvider.instance, { isCaseSensitive: false }));
        const jobsProvider = await JobInit.createJobsTree(ZoweLogger.log);
        if (jobsProvider == null) {
            return null;
        }
        PollProvider.register();
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.jobs.deleteJob", async (job, jobs) => {
                await JobActions.deleteCommand(jobsProvider, job, jobs);
            })
        );
        context.subscriptions.push(vscode.commands.registerCommand("zowe.jobs.runModifyCommand", (job) => JobActions.modifyCommand(job)));
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.jobs.runStopCommand", async (node, nodeList) => {
                const selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList) as IZoweJobTreeNode[];
                for (const item of selectedNodes) {
                    await JobActions.stopCommand(item as ZoweJobNode);
                }
            })
        );
        context.subscriptions.push(vscode.commands.registerCommand("zowe.jobs.refreshJobsServer", (job) => JobActions.refreshJob(job, jobsProvider)));
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.jobs.refreshAllJobs", async () => {
                await SharedActions.refreshAll(jobsProvider);
            })
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.jobs.refreshJob", (job) => JobActions.refreshJob(job.mParent, jobsProvider))
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.jobs.refreshSpool", async (node) => {
                const statusMsg = Gui.setStatusBarMessage(vscode.l10n.t("$(sync~spin) Pulling from Mainframe..."));
                await JobFSProvider.refreshSpool(node);
                statusMsg.dispose();
            })
        );

        const downloadSingleSpoolHandler = (binary: boolean) => async (node, nodeList) => {
            const selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList) as IZoweJobTreeNode[];
            await JobActions.downloadSingleSpool(selectedNodes, binary);
        };
        context.subscriptions.push(vscode.commands.registerCommand("zowe.jobs.downloadSingleSpool", downloadSingleSpoolHandler(false)));
        context.subscriptions.push(vscode.commands.registerCommand("zowe.jobs.downloadSingleSpoolBinary", downloadSingleSpoolHandler(true)));

        context.subscriptions.push(vscode.commands.registerCommand("zowe.jobs.addJobsSession", () => jobsProvider.createZoweSession(jobsProvider)));
        context.subscriptions.push(vscode.commands.registerCommand("zowe.jobs.setOwner", (job) => JobActions.setOwner(job, jobsProvider)));
        context.subscriptions.push(vscode.commands.registerCommand("zowe.jobs.setPrefix", (job) => JobActions.setPrefix(job, jobsProvider)));

        const downloadSpoolHandler = (binary: boolean) => async (node, nodeList) => {
            const selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList) as IZoweJobTreeNode[];
            await JobActions.downloadSpool(selectedNodes, binary);
        };
        context.subscriptions.push(vscode.commands.registerCommand("zowe.jobs.downloadSpool", downloadSpoolHandler(false)));
        context.subscriptions.push(vscode.commands.registerCommand("zowe.jobs.downloadSpoolBinary", downloadSpoolHandler(true)));

        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.jobs.getJobJcl", async (node, nodeList) => {
                let selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList) as IZoweJobTreeNode[];
                selectedNodes = selectedNodes.filter((x) => SharedContext.isJob(x));
                for (const job of selectedNodes) {
                    await JobActions.downloadJcl(job as ZoweJobNode);
                }
            })
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.jobs.setJobSpool", async (session, jobId) => JobActions.focusOnJob(jobsProvider, session, jobId))
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.jobs.search", async (node): Promise<void> => jobsProvider.filterPrompt(node))
        );
        const spoolFileTogglePoll =
            (startPolling: boolean) =>
            async (node: IZoweTreeNode, nodeList: IZoweTreeNode[]): Promise<void> => {
                const selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList);
                const isMultipleSelection = selectedNodes.length > 1;
                for (const n of selectedNodes) {
                    if (isMultipleSelection) {
                        if (startPolling != SharedContext.isPolling(n)) {
                            await jobsProvider.pollData(n);
                        }
                    } else {
                        await jobsProvider.pollData(n);
                    }
                }
            };
        context.subscriptions.push(vscode.commands.registerCommand("zowe.jobs.startPolling", spoolFileTogglePoll(true)));
        context.subscriptions.push(vscode.commands.registerCommand("zowe.jobs.stopPolling", spoolFileTogglePoll(false)));
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(async (e) => {
                await jobsProvider.onDidChangeConfiguration(e);
            })
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.jobs.cancelJob", async (node, nodeList) => {
                await JobActions.cancelJobs(jobsProvider, SharedUtils.getSelectedNodeList(node, nodeList));
            })
        );
        context.subscriptions.push(vscode.commands.registerCommand("zowe.jobs.sortBy", async (job) => JobActions.sortJobs(job, jobsProvider)));
        context.subscriptions.push(
            vscode.commands.registerCommand(
                "zowe.jobs.filterJobs",
                async (job: IZoweJobTreeNode): Promise<vscode.InputBox> => jobsProvider.filterJobsDialog(job)
            )
        );
        context.subscriptions.push(vscode.commands.registerCommand("zowe.jobs.copyName", async (job: IZoweJobTreeNode) => JobActions.copyName(job)));
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.jobs.tabularView", async (node, nodeList) => {
                const selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList) as IZoweJobTreeNode[];
                if (selectedNodes.length !== 1) {
                    return;
                }

                const profileNode = selectedNodes[0];
                const children = await profileNode.getChildren();

                TableViewProvider.getInstance().setTableView(
                    new TableBuilder(context)
                        .options({
                            autoSizeStrategy: { type: "fitCellContents", colIds: ["name", "class", "owner", "id", "retcode", "status"] },
                            rowSelection: "multiple",
                        })
                        .isView()
                        .title(`Jobs view: ${profileNode.owner} | ${profileNode.prefix} | ${profileNode.status}`)
                        .rows(
                            ...children.map((item) => ({
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
                            ]
                        )
                        .addRowAction("all", {
                            title: "Get JCL",
                            command: "get-jcl",
                            callback: {
                                fn: async (view: Table.View, data: Table.RowInfo) => {
                                    const child = children.find((c) => data.row.id === c.job?.jobid);
                                    if (child != null) {
                                        await JobActions.downloadJcl(child as ZoweJobNode);
                                    }
                                },
                                typ: "single-row",
                            },
                        })
                        .addRowAction("all", {
                            title: "Reveal in tree",
                            type: "primary",
                            command: "edit",
                            callback: {
                                fn: async (view: Table.View, data: Table.RowInfo) => {
                                    const child = children.find((c) => data.row.id === c.job?.jobid);
                                    if (child) {
                                        await jobsProvider.getTreeView().reveal(child, { expand: true });
                                    }
                                },
                                typ: "single-row",
                            },
                        })
                        .addContextOption("all", {
                            title: "Cancel job",
                            command: "cancel-job",
                            callback: {
                                fn: async (view: Table.View, data: Record<number, Table.RowData>) => {
                                    const childrenToCancel = Object.values(data)
                                        .map((row) => children.find((c) => row.id === c.job?.jobid))
                                        .filter((child) => child);
                                    if (childrenToCancel.length > 0) {
                                        await JobActions.cancelJobs(SharedTreeProviders.job, childrenToCancel);
                                        const profNode = childrenToCancel[0].getSessionNode() as ZoweJobNode;
                                        await view.setContent(
                                            profNode.children.map((item) => ({
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
                            condition: (data: Table.RowData) => data["status"] === "ACTIVE",
                        })
                        .addContextOption("all", {
                            title: "Delete job",
                            command: "delete-job",
                            callback: {
                                fn: async (view: Table.View, data: Record<number, Table.RowData>) => {
                                    const childrenToDelete = Object.values(data)
                                        .map((row) => children.find((c) => row.id === c.job?.jobid))
                                        .filter((child) => child);
                                    if (childrenToDelete.length > 0) {
                                        await JobActions.deleteCommand(jobsProvider, undefined, childrenToDelete);
                                        const newData = view.getContent();
                                        for (const index of Object.keys(data).map(Number)) {
                                            newData.splice(index, 1);
                                        }
                                        await view.setContent(newData);
                                    }
                                },
                                typ: "multi-row",
                            },
                        })
                        .build()
                );
            })
        );
        context.subscriptions.push(
            vscode.workspace.onDidOpenTextDocument((doc) => {
                if (doc.uri.scheme !== ZoweScheme.Jobs) {
                    return;
                }

                JobFSProvider.instance.cacheOpenedUri(doc.uri);
            })
        );

        SharedInit.initSubscribers(context, jobsProvider);
        return jobsProvider;
    }
}
