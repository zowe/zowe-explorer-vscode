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

import * as vscode from "vscode";
import * as zowe from "@zowe/cli";
import { errorHandling } from "../utils/ProfilesUtils";
import { Profiles } from "../Profiles";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { ValidProfileEnum, IZoweTree, IZoweJobTreeNode } from "@zowe/zowe-explorer-api";
import { Job } from "./ZoweJobNode";
import * as nls from "vscode-nls";
import { encodeJobFile } from "../SpoolProvider";

// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

/**
 * Download all the spool content for the specified job.
 *
 * @param job The job to download the spool content from
 */
export async function downloadSpool(job: IZoweJobTreeNode) {
    try {
        const dirUri = await vscode.window.showOpenDialog({
            openLabel: localize("downloadSpool.select", "Select"),
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
        });
        if (dirUri !== undefined) {
            ZoweExplorerApiRegister.getJesApi(job.getProfile()).downloadSpoolContent({
                jobid: job.job.jobid,
                jobname: job.job.jobname,
                outDir: dirUri[0].fsPath,
            });
        }
    } catch (error) {
        await errorHandling(error, null, error.message);
    }
}

/**
 * Download the spool content for the specified job
 *
 * @param session The session to which the job belongs
 * @param spool The IJobFile to get the spool content for
 */
export async function getSpoolContent(
    jobsProvider: IZoweTree<IZoweJobTreeNode>,
    session: string,
    spool: zowe.IJobFile
) {
    const zosmfProfile = Profiles.getInstance().loadNamedProfile(session);
    // This has a direct access to Profiles checkcurrentProfile() because I am able to get the profile now.
    await Profiles.getInstance().checkCurrentProfile(zosmfProfile);
    if (
        Profiles.getInstance().validProfile === ValidProfileEnum.VALID ||
        Profiles.getInstance().validProfile === ValidProfileEnum.UNVERIFIED
    ) {
        try {
            const uri = encodeJobFile(session, spool);
            const document = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(document);
        } catch (error) {
            await errorHandling(error, session, error.message);
        }
    }
}

/**
 * Refresh a node in the job tree
 *
 * @param node The node to refresh
 * @param jobsProvider The tree to which the refreshed node belongs
 */
export async function refreshJobsServer(node: IZoweJobTreeNode, jobsProvider: IZoweTree<IZoweJobTreeNode>) {
    jobsProvider.checkCurrentProfile(node);
    if (
        Profiles.getInstance().validProfile === ValidProfileEnum.VALID ||
        Profiles.getInstance().validProfile === ValidProfileEnum.UNVERIFIED
    ) {
        await jobsProvider.refreshElement(node);
    }
}

/**
 * Download the JCL content for the specified job.
 *
 * @param job The job to download the JCL content from
 */
export async function downloadJcl(job: Job) {
    try {
        const jobJcl = await ZoweExplorerApiRegister.getJesApi(job.getProfile()).getJclForJob(job.job);
        const jclDoc = await vscode.workspace.openTextDocument({ language: "jcl", content: jobJcl });
        await vscode.window.showTextDocument(jclDoc);
    } catch (error) {
        await errorHandling(error, null, error.message);
    }
}

/**
 * Modify a job command
 *
 * @param job The job on which to modify a command
 */
export async function modifyCommand(job: Job) {
    try {
        const command = await vscode.window.showInputBox({
            prompt: localize("modifyCommand.command.prompt", "Modify Command"),
        });
        if (command !== undefined) {
            const response = await zowe.IssueCommand.issueSimple(job.getSession(), `f ${job.job.jobname},${command}`);
            vscode.window.showInformationMessage(
                localize("modifyCommand.response", "Command response: ") + response.commandResponse
            );
        }
    } catch (error) {
        await errorHandling(error, null, error.message);
    }
}

/**
 * Stop a job command
 *
 * @param job The job on which to stop a command
 */
export async function stopCommand(job: Job) {
    try {
        const response = await zowe.IssueCommand.issueSimple(job.getSession(), `p ${job.job.jobname}`);
        vscode.window.showInformationMessage(
            localize("stopCommand.response", "Command response: ") + response.commandResponse
        );
    } catch (error) {
        await errorHandling(error, null, error.message);
    }
}

/**
 * Set the owner of a job
 *
 * @param job The job to set the owner of
 * @param jobsProvider The tree to which the updated node belongs
 */
// Is this redundant with the setter in the Job class (ZoweJobNode.ts)?
export async function setOwner(job: IZoweJobTreeNode, jobsProvider: IZoweTree<IZoweJobTreeNode>) {
    const newOwner = await vscode.window.showInputBox({ prompt: localize("setOwner.newOwner.prompt.owner", "Owner") });
    job.owner = newOwner;
    jobsProvider.refreshElement(job);
}

/**
 * Set the prefix of a job
 *
 * @param job The job to set the prefix of
 * @param jobsProvider The tree to which the updated node belongs
 */
export async function setPrefix(job: IZoweJobTreeNode, jobsProvider: IZoweTree<IZoweJobTreeNode>) {
    const newPrefix = await vscode.window.showInputBox({
        prompt: localize("setOwner.newOwner.prompt.prefix", "Prefix"),
    });
    job.prefix = newPrefix;
    jobsProvider.refreshElement(job);
}

/**
 * Delete the selected jobs command
 *
 * @param jobsProvider The tree to which the node belongs
 */
export async function deleteCommand(job: IZoweJobTreeNode, jobsProvider: IZoweTree<IZoweJobTreeNode>) {
    const deletedNodes: string[] = [" "];
    const selectedNodes: IZoweJobTreeNode[] = jobsProvider.getTreeView().selection;
    const nodes: IZoweJobTreeNode[] = selectedNodes.filter(
        (jobNode) => jobNode.job !== undefined && jobNode.job !== null
    );
    if (nodes.length > 0) {
        for (const node of nodes) {
            await jobsProvider.delete(node);
            deletedNodes.unshift(" " + node.job.jobname + "(" + node.job.jobid + ")");
        }
        deletedNodes.pop();
        vscode.window.showInformationMessage(
            localize("deleteMulti.job", "The following jobs were deleted:") + deletedNodes
        );
    }
    // Delete a single job node
    if (job && !(nodes.length > 0)) {
        jobsProvider.delete(job);
        vscode.window.showInformationMessage(
            localize("deleteCommand.job", "Job ") +
                job.job.jobname +
                "(" +
                job.job.jobid +
                ")" +
                localize("deleteCommand.delete", " deleted")
        );
    }
    await vscode.commands.executeCommand("zowe.refreshAllJobs");
}
