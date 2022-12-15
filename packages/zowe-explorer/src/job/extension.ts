/*
 * This program and the accompanying materials are made available under the terms of the *
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at *
 * https://www.eclipse.org/legal/epl-v20.html                                      *
 *                                                                                 *
 * SPDX-License-Identifier: EPL-2.0                                                *
 *                                                                                 *
 * Copyright Contributors to the Zowe Project.                                     *
 *                                                                                 *
 */

import * as globals from "../globals";
import * as vscode from "vscode";
import * as jobActions from "./actions";
import * as refreshActions from "../shared/refresh";
import { IZoweJobTreeNode, IZoweTreeNode, IZoweTree } from "@zowe/zowe-explorer-api";
import { Profiles } from "../Profiles";
import { createJobsTree } from "./ZosJobsProvider";
import * as contextuals from "../../src/shared/context";
import { Job } from "./ZoweJobNode";
import { getSelectedNodeList } from "../shared/utils";
import { initSubscribers } from "../shared/extension";

export async function initJobsProvider(context: vscode.ExtensionContext) {
    const jobsProvider: IZoweTree<IZoweJobTreeNode> = await createJobsTree(globals.LOG);
    if (jobsProvider == null) return null;

    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.zosJobsOpenspool", (session, spool, refreshTimestamp) =>
            jobActions.getSpoolContent(session, spool, refreshTimestamp)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.deleteJob", async (job, jobs) => {
            await jobActions.deleteCommand(jobsProvider, job, jobs);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.runModifyCommand", (job) => jobActions.modifyCommand(job))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.runStopCommand", async (node, nodeList) => {
            const selectedNodes = getSelectedNodeList(node, nodeList) as IZoweJobTreeNode[];
            for (const item of selectedNodes) {
                await jobActions.stopCommand(item as Job);
            }
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.refreshJobsServer", async (job) =>
            jobActions.refreshJobsServer(job, jobsProvider)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.refreshAllJobs", async () => {
            await refreshActions.refreshAll(jobsProvider);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.refreshJob", async (job) => {
            jobActions.refreshJob(job.mParent, jobsProvider);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.refreshSpool", async (node) => {
            await jobActions.getSpoolContentFromMainframe(node);
            jobActions.refreshJob(node.mParent.mParent, jobsProvider);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.addJobsSession", () => jobsProvider.createZoweSession(jobsProvider))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.setOwner", (job) => jobActions.setOwner(job, jobsProvider))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.setPrefix", (job) => jobActions.setPrefix(job, jobsProvider))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.removeJobsSession", (job, jobList) => {
            let selectedNodes = getSelectedNodeList(job, jobList);
            selectedNodes = selectedNodes.filter((element) => contextuals.isJobsSession(element));
            for (const item of selectedNodes) {
                jobsProvider.deleteSession(item);
            }
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.downloadSpool", async (node, nodeList) => {
            const selectedNodes = getSelectedNodeList(node, nodeList) as IZoweJobTreeNode[];
            await jobActions.downloadSpool(selectedNodes);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.getJobJcl", async (node, nodeList) => {
            let selectedNodes = getSelectedNodeList(node, nodeList) as IZoweJobTreeNode[];
            selectedNodes = selectedNodes.filter((x) => contextuals.isJob(x));
            for (const job of selectedNodes) {
                await jobActions.downloadJcl(job as Job);
            }
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.setJobSpool", async (session, jobId) =>
            jobActions.focusOnJob(jobsProvider, session, jobId)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.search", (node) => jobsProvider.filterPrompt(node))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.editSession", async (node) =>
            jobsProvider.editSession(node, jobsProvider)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.addFavorite", async (node, nodeList) => {
            const selectedNodes = getSelectedNodeList(node, nodeList) as IZoweJobTreeNode[];
            for (const item of selectedNodes) {
                await jobsProvider.addFavorite(item);
            }
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.removeFavorite", async (node, nodeList) => {
            const selectedNodes = getSelectedNodeList(node, nodeList) as IZoweJobTreeNode[];
            for (const item of selectedNodes) {
                await jobsProvider.removeFavorite(item);
            }
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.saveSearch", async (node) => jobsProvider.saveSearch(node))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.removeSearchFavorite", async (node) =>
            jobsProvider.removeFavorite(node)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.removeFavProfile", async (node) =>
            jobsProvider.removeFavProfile(node.label, true)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.disableValidation", async (node) =>
            Profiles.getInstance().disableValidation(node)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.enableValidation", async (node) =>
            Profiles.getInstance().enableValidation(node)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.ssoLogin", async (node: IZoweTreeNode) =>
            jobsProvider.ssoLogin(node)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.jobs.ssoLogout", async (node: IZoweTreeNode) =>
            jobsProvider.ssoLogout(node)
        )
    );
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            jobsProvider.onDidChangeConfiguration(e);
        })
    );

    initSubscribers(context, jobsProvider);
    return jobsProvider;
}
