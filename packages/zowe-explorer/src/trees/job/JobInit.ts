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
import { IZoweJobTreeNode, IZoweTreeNode, imperative } from "@zowe/zowe-explorer-api";
import { Profiles, Constants } from "../../configuration";
import { JobTree, JobActions, ZoweJobNode } from "../job";
import { SharedActions, SharedUtils, SharedContext, SharedInit } from "../shared";
import { ZoweLogger } from "../../tools";

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
        await tree.addSession(undefined, undefined, tree);
        return tree;
    }

    public static async initJobsProvider(context: vscode.ExtensionContext): Promise<JobTree> {
        ZoweLogger.trace("job.init.initJobsProvider called.");
        const jobsProvider = await JobInit.createJobsTree(Constants.LOG);
        if (jobsProvider == null) {
            return null;
        }

        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.jobs.zosJobsOpenspool", (session, spoolNode) => JobActions.getSpoolContent(session, spoolNode))
        );
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
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.jobs.refreshJobsServer", async (job) => JobActions.refreshJobsServer(job, jobsProvider))
        );
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
                await JobActions.getSpoolContentFromMainframe(node);
                JobActions.refreshJob(node.mParent.mParent, jobsProvider);
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
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.jobs.removeSession", (job, jobList, hideFromAllTrees) => {
                let selectedNodes = SharedUtils.getSelectedNodeList(job, jobList);
                selectedNodes = selectedNodes.filter((element) => SharedContext.isJobsSession(element));
                for (const item of selectedNodes) {
                    jobsProvider.deleteSession(item, hideFromAllTrees);
                }
            })
        );

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
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.jobs.editSession", async (node): Promise<void> => jobsProvider.editSession(node, jobsProvider))
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.jobs.addFavorite", async (node, nodeList) => {
                const selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList) as IZoweJobTreeNode[];
                for (const item of selectedNodes) {
                    await jobsProvider.addFavorite(item);
                }
            })
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.jobs.removeFavorite", async (node, nodeList) => {
                const selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList) as IZoweJobTreeNode[];
                for (const item of selectedNodes) {
                    await jobsProvider.removeFavorite(item);
                }
            })
        );
        context.subscriptions.push(vscode.commands.registerCommand("zowe.jobs.saveSearch", (node): void => jobsProvider.saveSearch(node)));
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.jobs.removeSearchFavorite", async (node): Promise<void> => jobsProvider.removeFavorite(node))
        );
        context.subscriptions.push(
            vscode.commands.registerCommand(
                "zowe.jobs.removeFavProfile",
                async (node): Promise<void> => jobsProvider.removeFavProfile(node.label, true)
            )
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.jobs.disableValidation", (node) => {
                Profiles.getInstance().disableValidation(node);
                jobsProvider.refreshElement(node);
            })
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.jobs.enableValidation", (node) => {
                Profiles.getInstance().enableValidation(node);
                jobsProvider.refreshElement(node);
            })
        );
        context.subscriptions.push(vscode.commands.registerCommand("zowe.jobs.ssoLogin", async (node): Promise<void> => jobsProvider.ssoLogin(node)));
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.jobs.ssoLogout", async (node): Promise<void> => jobsProvider.ssoLogout(node))
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

        context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(JobTree.onDidCloseTextDocument));

        SharedInit.initSubscribers(context, jobsProvider);
        return jobsProvider;
    }
}
