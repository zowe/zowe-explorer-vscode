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
import * as zowe from "@zowe/cli";
import { errorHandling } from "../utils/ProfilesUtils";
import { Profiles } from "../Profiles";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { Gui, ValidProfileEnum, IZoweTree, IZoweJobTreeNode } from "@zowe/zowe-explorer-api";
import { Job, Spool } from "./ZoweJobNode";
import * as nls from "vscode-nls";
import { toUniqueJobFileUri } from "../SpoolProvider";
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
export async function downloadSpool(jobs: IZoweJobTreeNode[]) {
    try {
        const dirUri = await Gui.showOpenDialog({
            openLabel: localize("downloadSpool.select", "Select"),
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
        });
        if (dirUri !== undefined) {
            for (const job of jobs) {
                await ZoweExplorerApiRegister.getJesApi(job.getProfile()).downloadSpoolContent({
                    jobid: job.job.jobid,
                    jobname: job.job.jobname,
                    outDir: dirUri[0].fsPath,
                });
            }
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
    let zosmfProfile: zowe.imperative.IProfileLoaded;
    try {
        zosmfProfile = profiles.loadNamedProfile(session);
    } catch (error) {
        await errorHandling(error, session, error.message);
        return;
    }

    const statusMsg = Gui.setStatusBarMessage(localize("jobActions.openSpoolFile", "$(sync~spin) Opening spool file...", this.label as string));
    await profiles.checkCurrentProfile(zosmfProfile);
    if (profiles.validProfile !== ValidProfileEnum.INVALID) {
        const uri = toUniqueJobFileUri(session, spool)(refreshTimestamp.toString());
        try {
            await Gui.showTextDocument(uri, { preview: false });
        } catch (error) {
            const isTextDocActive =
                vscode.window.activeTextEditor &&
                vscode.window.activeTextEditor.document.uri?.path === `${spool.jobname}.${spool.jobid}.${spool.ddname}`;

            statusMsg.dispose();
            if (isTextDocActive && String(error.message).includes("Failed to show text document")) {
                return;
            }
            await errorHandling(error, session, error.message);
            return;
        }
    }
    statusMsg.dispose();
}

export async function getSpoolContentFromMainframe(node: IZoweJobTreeNode) {
    let spools: zowe.IJobFile[] = [];
    spools = await ZoweExplorerApiRegister.getJesApi(node.getProfile()).getSpoolFiles(node.job?.jobname, node.job?.jobid);
    spools = spools
        // filter out all the objects which do not seem to be correct Job File Document types
        // see an issue #845 for the details
        .filter((item) => !(item.id === undefined && item.ddname === undefined && item.stepname === undefined));
    spools.forEach(async (spool) => {
        if (
            `${spool.stepname}:${spool.ddname} - ${spool["record-count"]}` === node.label.toString() ||
            `${spool.stepname}:${spool.ddname} - ${spool.procstep}` === node.label.toString()
        ) {
            let prefix = spool.stepname;
            if (prefix === undefined) {
                prefix = spool.procstep;
            }

            const procstep = spool.procstep ? spool.procstep : undefined;
            let newLabel: string;
            if (procstep) {
                newLabel = `${spool.stepname}:${spool.ddname} - ${procstep}`;
            } else {
                newLabel = `${spool.stepname}:${spool.ddname} - ${spool["record-count"]}`;
            }

            const spoolNode = new Spool(
                newLabel,
                vscode.TreeItemCollapsibleState.None,
                node.getParent(),
                node.getSession(),
                spool,
                node.job,
                node.getParent()
            );
            node = spoolNode;
            await getSpoolContent(node.getProfile().name, spool, Date.now());
        }
    });
}

/**
 * Refresh a node in the job tree
 *
 * @param node The node to refresh
 * @param jobsProvider The tree to which the refreshed node belongs
 */
export async function refreshJobsServer(node: IZoweJobTreeNode, jobsProvider: IZoweTree<IZoweJobTreeNode>) {
    jobsProvider.checkCurrentProfile(node);
    if (Profiles.getInstance().validProfile === ValidProfileEnum.VALID || Profiles.getInstance().validProfile === ValidProfileEnum.UNVERIFIED) {
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
        await Gui.showTextDocument(jclDoc, { preview: false });
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
    let sessionNode: IZoweJobTreeNode | undefined = jobsProvider.mSessionNodes.find((jobNode) => jobNode.label.toString() === sessionName.trim());
    if (!sessionNode) {
        try {
            await jobsProvider.addSession(sessionName.trim());
        } catch (error) {
            await errorHandling(error, null, error.message);
            return;
        }
        sessionNode = jobsProvider.mSessionNodes.find((jobNode) => jobNode.label.toString().trim() === sessionName.trim());
    }
    try {
        jobsProvider.refreshElement(sessionNode);
    } catch (error) {
        await errorHandling(error, null, error.message);
        return;
    }
    sessionNode.searchId = jobId;
    sessionNode.filtered = true;
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
        const options: vscode.InputBoxOptions = {
            prompt: localize("modifyCommand.inputBox.prompt", "Modify Command"),
        };
        const command = await Gui.showInputBox(options);
        if (command !== undefined) {
            const commandApi = ZoweExplorerApiRegister.getInstance().getCommandApi(job.getProfile());
            if (commandApi) {
                const response = await ZoweExplorerApiRegister.getCommandApi(job.getProfile()).issueMvsCommand(`f ${job.job.jobname},${command}`);
                Gui.showMessage(localize("jobActions.modifyCommand.response", "Command response: ") + response.commandResponse);
            }
        }
    } catch (error) {
        if (error.toString().includes("non-existing")) {
            globals.LOG.error(error);
            Gui.errorMessage(
                localize("jobActions.modifyCommand.apiNonExisting", "Not implemented yet for profile of type: ") + job.getProfile().type
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
            const response = await ZoweExplorerApiRegister.getCommandApi(job.getProfile()).issueMvsCommand(`p ${job.job.jobname}`);
            Gui.showMessage(localize("jobActions.stopCommand.response", "Command response: ") + response.commandResponse);
        }
    } catch (error) {
        if (error.toString().includes("non-existing")) {
            globals.LOG.error(error);
            Gui.errorMessage(localize("jobActions.stopCommand.apiNonExisting", "Not implemented yet for profile of type: ") + job.getProfile().type);
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
    const options: vscode.InputBoxOptions = {
        prompt: localize("setOwner.inputBox.prompt", "Owner"),
    };
    const newOwner = await Gui.showInputBox(options);
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
    const options: vscode.InputBoxOptions = {
        prompt: localize("setPrefix.inputBox.prompt", "Prefix"),
    };
    const newPrefix = await Gui.showInputBox(options);
    job.prefix = newPrefix;
    jobsProvider.refreshElement(job);
}

/**
 * Delete the selected jobs command
 *
 * @param jobsProvider The tree to which the node belongs
 */
export async function deleteCommand(jobsProvider: IZoweTree<IZoweJobTreeNode>, job?: IZoweJobTreeNode, jobs?: IZoweJobTreeNode[]) {
    if (jobs && jobs.length) {
        await deleteMultipleJobs(
            jobs.filter((jobNode) => jobNode.job !== undefined && jobNode.job !== null),
            jobsProvider
        );
        return;
    } else if (job) {
        await deleteSingleJob(job, jobsProvider);
        return;
    } else {
        const treeView = jobsProvider.getTreeView();
        const selectedNodes = treeView.selection;
        if (selectedNodes) {
            await deleteMultipleJobs(selectedNodes, jobsProvider);
        }
    }
}

async function deleteSingleJob(job: IZoweJobTreeNode, jobsProvider: IZoweTree<IZoweJobTreeNode>): Promise<void> {
    const jobName = `${job.job.jobname}(${job.job.jobid})`;
    const message = localize(
        "deleteJobPrompt.confirmation.message",
        "Are you sure you want to delete the following item?\nThis will permanently remove the following job from your system.\n\n{0}",
        jobName.replace(/(,)/g, "\n")
    );
    const deleteButton = localize("deleteJobPrompt.confirmation.delete", "Delete");
    const result = await Gui.warningMessage(message, {
        items: [deleteButton],
        vsCodeOpts: { modal: true },
    });
    if (!result || result === "Cancel") {
        globals.LOG.debug(localize("deleteJobPrompt.confirmation.cancel.log.debug", "Delete action was canceled."));
        Gui.showMessage(localize("deleteJobPrompt.deleteCancelled", "Delete action was cancelled."));
        return;
    }

    try {
        await jobsProvider.delete(job);
        Gui.infoMessage(localize("deleteCommand.job", "Job {0} was deleted.", jobName));
    } catch (error) {
        await errorHandling(error.toString(), job.getProfile().name, error.message.toString());
    }

    Gui.showMessage(localize("deleteCommand.job", "Job {0} was deleted.", jobName));
}

async function deleteMultipleJobs(jobs: ReadonlyArray<IZoweJobTreeNode>, jobsProvider: IZoweTree<IZoweJobTreeNode>): Promise<void> {
    const deleteButton = localize("deleteJobPrompt.confirmation.delete", "Delete");
    const toJobname = (jobNode: IZoweJobTreeNode) => `${jobNode.job.jobname}(${jobNode.job.jobid})`;
    const message = localize(
        "deleteJobPrompt.confirmation.message",
        "Are you sure you want to delete the following {0} items?\nThis will permanently remove the following jobs from your system.\n\n{1}",
        jobs.length,
        jobs.map(toJobname).toString().replace(/(,)/g, "\n")
    );
    const deleteChoice = await Gui.warningMessage(message, {
        items: [deleteButton],
        vsCodeOpts: { modal: true },
    });
    if (!deleteChoice || deleteChoice === "Cancel") {
        globals.LOG.debug(localize("deleteJobPrompt.confirmation.cancel.log.debug", "Delete action was canceled."));
        Gui.showMessage(localize("deleteJobPrompt.deleteCancelled", "Delete action was cancelled."));
        return;
    }
    const deletionResult: ReadonlyArray<IZoweJobTreeNode | Error> = await Promise.all(
        jobs.map(async (job) => {
            try {
                await jobsProvider.delete(job);
                return job;
            } catch (error) {
                globals.LOG.error(error);
                return error;
            }
        })
    );
    const deletedJobs: ReadonlyArray<IZoweJobTreeNode> = deletionResult
        .map((result) => {
            if (result instanceof Error) {
                return undefined;
            }
            return result;
        })
        .filter((result) => result !== undefined);
    if (deletedJobs.length) {
        Gui.showMessage(
            localize(
                "deleteCommand.multipleJobs",
                "The following jobs were deleted: {0}",
                deletedJobs.map(toJobname).toString().replace(/(,)/g, ", ")
            )
        );
    }
    const deletionErrors: ReadonlyArray<Error> = deletionResult
        .map((result) => {
            if (result instanceof Error) {
                const error = result;
                return error;
            }
            return undefined;
        })
        .filter((result) => result !== undefined);
    if (deletionErrors.length) {
        const errorMessages = deletionErrors.map((error) => error.message).join(", ");
        const userMessage = `There were errors during jobs deletion: ${errorMessages}`;
        await errorHandling(userMessage);
    }
}
