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
import { toUniqueJobFileUri } from "../SpoolProvider";
import { IProfileLoaded } from "@zowe/imperative";
import * as globals from "../globals";

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
 * @param refreshTimestamp The timestamp of the last job node refresh
 */
export async function getSpoolContent(session: string, spool: zowe.IJobFile, refreshTimestamp: number) {
    const profiles = Profiles.getInstance();
    let zosmfProfile: IProfileLoaded;
    try {
        zosmfProfile = profiles.loadNamedProfile(session);
    } catch (error) {
        await errorHandling(error, session, error.message);
        return;
    }
    await profiles.checkCurrentProfile(zosmfProfile);
    if (profiles.validProfile === ValidProfileEnum.VALID || profiles.validProfile === ValidProfileEnum.UNVERIFIED) {
        const uri = toUniqueJobFileUri(session, spool)(refreshTimestamp.toString());
        try {
            await vscode.window.showTextDocument(uri);
        } catch (error) {
            await errorHandling(error, session, error.message);
            return;
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
 * Refresh a job node information and spool files in the job tree
 *
 * @param job The job node to refresh
 * @param jobsProvider The tree to which the refreshed node belongs
 */
export function refreshJob(job: Job, jobsProvider: IZoweTree<IZoweJobTreeNode>) {
    jobsProvider.refreshElement(job);
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
 * Focus of the specified job in the tree
 * @param jobsProvider is a jobs tree
 * @param sessionName is a profile name to use in the jobs tree
 * @param jobId is a job to focus on
 */
export const focusOnJob = async (jobsProvider: IZoweTree<IZoweJobTreeNode>, sessionName: string, jobId: string) => {
    let sessionNode: IZoweJobTreeNode | undefined = jobsProvider.mSessionNodes.find(
        (jobNode) => jobNode.label.trim() === sessionName.trim()
    );
    if (!sessionNode) {
        try {
            await jobsProvider.addSession(sessionName);
        } catch (error) {
            await errorHandling(error, null, error.message);
            return;
        }
        sessionNode = jobsProvider.mSessionNodes.find((jobNode) => jobNode.label === sessionName);
    }
    try {
        jobsProvider.refreshElement(sessionNode);
    } catch (error) {
        await errorHandling(error, null, error.message);
        return;
    }
    sessionNode.searchId = jobId;
    const jobs: IZoweJobTreeNode[] = await sessionNode.getChildren();
    const job = jobs.find((jobNode) => jobNode.job.jobid === jobId);
    if (job) {
        jobsProvider.setItem(jobsProvider.getTreeView(), job);
    }
};

/**
 * Modify a job command
 *
 * @param job The job on which to modify a command
 */
export async function modifyCommand(job: Job) {
    try {
        const command = await vscode.window.showInputBox({
            prompt: localize("jobActions.modifyCommand.command.prompt", "Modify Command"),
            validateInput: (value) => null,
        });
        if (command !== undefined) {
            const commandApi = ZoweExplorerApiRegister.getInstance().getCommandApi(job.getProfile());
            if (commandApi) {
                const response = await ZoweExplorerApiRegister.getCommandApi(job.getProfile()).issueMvsCommand(
                    `f ${job.job.jobname},${command}`
                );
                vscode.window.showInformationMessage(
                    localize("jobActions.modifyCommand.response", "Command response: ") + response.commandResponse
                );
            }
        }
    } catch (error) {
        if (error.toString().includes("non-existing")) {
            vscode.window.showErrorMessage(
                localize("jobActions.modifyCommand.apiNonExisting", "Not implemented yet for profile of type: ") +
                    job.getProfile().type
            );
        } else {
            await errorHandling(error.toString(), job.getProfile().name, error.message.toString());
        }
    }
}

/**
 * Stop a job command
 *
 * @param job The job on which to stop a command
 */
export async function stopCommand(job: Job) {
    try {
        const commandApi = ZoweExplorerApiRegister.getInstance().getCommandApi(job.getProfile());
        if (commandApi) {
            const response = await ZoweExplorerApiRegister.getCommandApi(job.getProfile()).issueMvsCommand(
                `p ${job.job.jobname}`
            );
            vscode.window.showInformationMessage(
                localize("jobActions.stopCommand.response", "Command response: ") + response.commandResponse
            );
        }
    } catch (error) {
        if (error.toString().includes("non-existing")) {
            vscode.window.showErrorMessage(
                localize("jobActions.stopCommand.apiNonExisting", "Not implemented yet for profile of type: ") +
                    job.getProfile().type
            );
        } else {
            await errorHandling(error.toString(), job.getProfile().name, error.message.toString());
        }
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
    const newOwner = await vscode.window.showInputBox({
        prompt: localize("setOwner.newOwner.prompt.owner", "Owner"),
        validateInput: (value) => null,
    });
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
        validateInput: (value) => null,
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
    const nodesToDelete: string[] = [];
    const deletedNodes: string[] = [];
    const selectedNodes: IZoweJobTreeNode[] = jobsProvider.getTreeView().selection;
    const nodes: IZoweJobTreeNode[] = selectedNodes.filter(
        (jobNode) => jobNode.job !== undefined && jobNode.job !== null
    );

    if (nodes.length > 0) {
        for (const node of nodes) {
            nodesToDelete.push(`${node.job.jobname}(${node.job.jobid})`);
        }
    } else if (job) {
        nodesToDelete.push(`${job.job.jobname}(${job.job.jobid})`);
    }
    // confirmation message for deletion
    const deleteButton = localize("deleteJobPrompt.confirmation.delete", "Delete");
    const message = localize(
        "deleteJobPrompt.confirmation.message",
        "Are you sure you want to delete the following {0} item(s)?\nThis will permanently remove the following job(s) from your system.\n\n{1}",
        nodesToDelete.length,
        nodesToDelete.toString().replace(/(,)/g, "\n")
    );
    let cancelled = false;
    await vscode.window.showWarningMessage(message, { modal: true }, ...[deleteButton]).then((selection) => {
        if (!selection || selection === "Cancel") {
            globals.LOG.debug(localize("deleteJobPrompt.confirmation.cancel.log.debug", "Delete action was canceled."));
            cancelled = true;
        }
    });
    if (cancelled) {
        vscode.window.showInformationMessage(
            localize("deleteJobPrompt.deleteCancelled", "Delete action was cancelled.")
        );
        return;
    }

    // delete selected nodes
    if (nodes.length > 0) {
        for (const node of nodes) {
            await jobsProvider.delete(node);
            deletedNodes.push(`${node.job.jobname}(${node.job.jobid})`);
        }
        vscode.window.showInformationMessage(
            localize(
                "deleteCommand.multipleJobs",
                "The following jobs were deleted: {0}",
                deletedNodes.toString().replace(/(,)/g, ", ")
            )
        );
    }
    // Delete a single job node
    if (job && nodes.length <= 0) {
        jobsProvider.delete(job);
        vscode.window.showInformationMessage(
            localize("deleteCommand.job", "Job {0} deleted.", `${job.job.jobname}(${job.job.jobid})`)
        );
    }
    await vscode.commands.executeCommand("zowe.jobs.refreshAllJobs");
}
