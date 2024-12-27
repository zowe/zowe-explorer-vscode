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
import { IZoweJobTreeNode, IZoweTreeNode, ZoweScheme, imperative, Gui } from "@zowe/zowe-explorer-api";
import { JobTree } from "./JobTree";
import { JobActions } from "./JobActions";
import { ZoweJobNode } from "./ZoweJobNode";
import { ZoweLogger } from "../../tools/ZoweLogger";
import { SharedActions } from "../shared/SharedActions";
import { SharedContext } from "../shared/SharedContext";
import { SharedInit } from "../shared/SharedInit";
import { LoadMoreCodeLens, SharedUtils } from "../shared/SharedUtils";
import { JobFSProvider } from "./JobFSProvider";
import { PollProvider } from "./JobPollProvider";
import { JobTableView } from "./JobTableView";

export class JobInit {
    /**
     * Creates the Job tree that contains nodes of sessions, jobs and spool items
     *
     * @export
     * @class ZosJobsProvider
     * @implements {vscode.TreeDataProvider}
     */
    public static async createJobsTree(log: imperative.Logger): Promise<JobTree> {
        ZoweLogger.trace("JobInit.createJobsTree called.");
        const tree = new JobTree();
        await tree.initializeJobsTree(log);
        await tree.addSession();
        return tree;
    }

    public static async initJobsProvider(context: vscode.ExtensionContext): Promise<JobTree> {
        ZoweLogger.trace("JobInit.initJobsProvider called.");
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
                const statusMsg = Gui.setStatusBarMessage(`$(sync~spin) ${vscode.l10n.t("Pulling from Mainframe...")}`);
                await JobFSProvider.refreshSpool(node);
                statusMsg.dispose();
            })
        );

        const downloadSingleSpoolHandler = (binary: boolean): ((node: IZoweTreeNode, nodeList: IZoweTreeNode[]) => Promise<void>) => {
            return async (node: IZoweTreeNode, nodeList: IZoweTreeNode[]): Promise<void> => {
                const selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList) as IZoweJobTreeNode[];
                await JobActions.downloadSingleSpool(selectedNodes, binary);
            };
        };
        context.subscriptions.push(vscode.commands.registerCommand("zowe.jobs.downloadSingleSpool", downloadSingleSpoolHandler(false)));
        context.subscriptions.push(vscode.commands.registerCommand("zowe.jobs.downloadSingleSpoolBinary", downloadSingleSpoolHandler(true)));

        context.subscriptions.push(vscode.commands.registerCommand("zowe.jobs.addJobsSession", () => jobsProvider.createZoweSession(jobsProvider)));
        context.subscriptions.push(vscode.commands.registerCommand("zowe.jobs.setOwner", (job) => JobActions.setOwner(job, jobsProvider)));
        context.subscriptions.push(vscode.commands.registerCommand("zowe.jobs.setPrefix", (job) => JobActions.setPrefix(job, jobsProvider)));

        const downloadSpoolHandler = (binary: boolean): ((node: IZoweTreeNode, nodeList: IZoweTreeNode[]) => Promise<void>) => {
            return async (node: IZoweTreeNode, nodeList: IZoweTreeNode[]) => {
                const selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList) as IZoweJobTreeNode[];
                await JobActions.downloadSpool(selectedNodes, binary);
            };
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
        const spoolFileTogglePoll = (startPolling: boolean): ((node: IZoweTreeNode, nodeList: IZoweTreeNode[]) => Promise<void>) => {
            return async (node: IZoweTreeNode, nodeList: IZoweTreeNode[]): Promise<void> => {
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
            vscode.commands.registerCommand("zowe.jobs.tableView", async (node, nodeList) => JobTableView.handleCommand(context, node, nodeList))
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.jobs.loadMoreRecords", async (document: vscode.TextDocument) => {
                await JobFSProvider.instance.fetchSpoolAtUri(
                    document.uri.with({ query: `?startRecord=${document.lineCount - 1}` }),
                    vscode.window.activeTextEditor
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
        context.subscriptions.push(
            vscode.languages.registerCodeLensProvider({ scheme: ZoweScheme.Jobs }, new LoadMoreCodeLens("zowe.jobs.loadMoreRecords"))
        );

        SharedInit.initSubscribers(context, jobsProvider);
        return jobsProvider;
    }
}
