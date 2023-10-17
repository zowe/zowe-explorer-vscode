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
import { Gui, IZoweTree, IZoweJobTreeNode, JobSortOpts } from "@zowe/zowe-explorer-api";
import { Job, Spool } from "./ZoweJobNode";
import * as nls from "vscode-nls";
import SpoolProvider, { encodeJobFile, getSpoolFiles, matchSpool } from "../SpoolProvider";
import { ZoweLogger } from "../utils/LoggerUtils";
import { SORT_DIRS, getDefaultUri } from "../shared/utils";
import { ZosJobsProvider } from "./ZosJobsProvider";
import { JOB_SORT_OPTS } from "./utils";
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
export async function downloadSpool(jobs: IZoweJobTreeNode[], binary?: boolean): Promise<void> {
    ZoweLogger.trace("job.actions.downloadSpool called.");
    try {
        const dirUri = await Gui.showOpenDialog({
            openLabel: localize("downloadSpool.select", "Select"),
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
            defaultUri: getDefaultUri(),
        });
        if (dirUri !== undefined) {
            for (const job of jobs) {
                await ZoweExplorerApiRegister.getJesApi(job.getProfile()).downloadSpoolContent({
                    jobid: job.job.jobid,
                    jobname: job.job.jobname,
                    outDir: dirUri[0].fsPath,
                    binary,
                });
            }
        }
    } catch (error) {
        await errorHandling(error);
    }
}

/**
 * Download all the spool content for the specified job.
 *
 * @param job The job to download the spool content from
 */
export async function downloadSingleSpool(nodes: IZoweJobTreeNode[], binary?: boolean): Promise<void> {
    ZoweLogger.trace("job.actions.downloadSingleSpool called.");
    try {
        if (ZoweExplorerApiRegister.getJesApi(nodes[0].getProfile()).downloadSingleSpool == null) {
            throw Error(
                localize(
                    "downloadSingleSpool.error",
                    "Download Single Spool operation not implemented by extender. Please contact the extension developer(s)."
                )
            );
        }
        const dirUri = await Gui.showOpenDialog({
            openLabel: localize("downloadSpool.select", "Select"),
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
            defaultUri: getDefaultUri(),
        });
        if (dirUri !== undefined) {
            for (const node of nodes) {
                const spools = (await getSpoolFiles(node)).filter((spool: zowe.IJobFile) => matchSpool(spool, node));
                for (const spool of spools) {
                    await ZoweExplorerApiRegister.getJesApi(nodes[0].getProfile()).downloadSingleSpool({
                        jobFile: spool,
                        binary,
                        outDir: dirUri[0].fsPath,
                    });
                }
            }
        }
    } catch (error) {
        await errorHandling(error);
    }
}

/**
 * Download the spool content for the specified job
 *
 * @param session The session to which the job belongs
 * @param spool The IJobFile to get the spool content for
 * @param refreshTimestamp The timestamp of the last job node refresh
 */
export async function getSpoolContent(session: string, spool: zowe.IJobFile, refreshTimestamp: number): Promise<void> {
    ZoweLogger.trace("job.actions.getSpoolContent called.");
    const profiles = Profiles.getInstance();
    let zosmfProfile: zowe.imperative.IProfileLoaded;
    try {
        zosmfProfile = profiles.loadNamedProfile(session);
    } catch (error) {
        await errorHandling(error, session);
        return;
    }

    const statusMsg = Gui.setStatusBarMessage(localize("jobActions.openSpoolFile", "$(sync~spin) Opening spool file...", this.label as string));
    const uri = encodeJobFile(session, spool);
    try {
        const spoolFile = SpoolProvider.files[uri.path];
        if (spoolFile) {
            // Fetch any changes to the spool file if it exists in the SpoolProvider
            await spoolFile.fetchContent();
        }
        await Gui.showTextDocument(uri, { preview: false });
    } catch (error) {
        const isTextDocActive =
            vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri?.path === `${spool.jobname}.${spool.jobid}.${spool.ddname}`;

        statusMsg.dispose();
        if (isTextDocActive && String(error.message).includes("Failed to show text document")) {
            return;
        }
        await errorHandling(error, session);
        return;
    }
    statusMsg.dispose();
}

/**
 * Triggers a refresh for a spool file w/ the provided text document.
 * @param doc The document to update, associated with the spool file
 */
export async function spoolFilePollEvent(doc: vscode.TextDocument): Promise<void> {
    const statusMsg = Gui.setStatusBarMessage(localize("zowe.polling.statusBar", `$(sync~spin) Polling: {0}...`, doc.fileName));
    await SpoolProvider.files[doc.uri.path].fetchContent();
    setTimeout(() => {
        statusMsg.dispose();
    }, 250);
}

export async function getSpoolContentFromMainframe(node: IZoweJobTreeNode): Promise<void> {
    ZoweLogger.trace("job.actions.getSpoolContentFromMainframe called.");
    const statusMsg = await Gui.setStatusBarMessage(localize("jobActions.fetchSpoolFile", "$(sync~spin) Fetching spool files..."));
    const spools = await getSpoolFiles(node);
    for (const spool of spools) {
        if (matchSpool(spool, node)) {
            let prefix = spool.stepname;
            if (prefix === undefined) {
                prefix = spool.procstep;
            }

            const newLabel = `${spool.stepname}:${spool.ddname} - ${spool.procstep ?? spool["record-count"]}`;

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
        }
    }
    statusMsg.dispose();
}

/**
 * Refresh a node in the job tree
 *
 * @param node The node to refresh
 * @param jobsProvider The tree to which the refreshed node belongs
 */
export async function refreshJobsServer(node: IZoweJobTreeNode, jobsProvider: IZoweTree<IZoweJobTreeNode>): Promise<void> {
    ZoweLogger.trace("job.actions.refreshJobsServer called.");
    await jobsProvider.refreshElement(node);
}

/**
 * Refresh a job node information and spool files in the job tree
 *
 * @param job The job node to refresh
 * @param jobsProvider The tree to which the refreshed node belongs
 */
export function refreshJob(job: Job, jobsProvider: IZoweTree<IZoweJobTreeNode>): void {
    ZoweLogger.trace("job.actions.refreshJob called.");
    jobsProvider.refreshElement(job);
}

/**
 * Download the JCL content for the specified job.
 *
 * @param job The job to download the JCL content from
 */
export async function downloadJcl(job: Job): Promise<void> {
    ZoweLogger.trace("job.actions.downloadJcl called.");
    try {
        const jobJcl = await ZoweExplorerApiRegister.getJesApi(job.getProfile()).getJclForJob(job.job);
        const jclDoc = await vscode.workspace.openTextDocument({ language: "jcl", content: jobJcl });
        await Gui.showTextDocument(jclDoc, { preview: false });
    } catch (error) {
        await errorHandling(error);
    }
}

/**
 * Focus of the specified job in the tree
 * @param jobsProvider is a jobs tree
 * @param sessionName is a profile name to use in the jobs tree
 * @param jobId is a job to focus on
 */
export const focusOnJob = async (jobsProvider: IZoweTree<IZoweJobTreeNode>, sessionName: string, jobId: string): Promise<void> => {
    ZoweLogger.trace("job.actions.focusOnJob called.");
    let sessionNode: IZoweJobTreeNode | undefined = jobsProvider.mSessionNodes.find((jobNode) => jobNode.label.toString() === sessionName.trim());
    if (!sessionNode) {
        try {
            await jobsProvider.addSession(sessionName.trim());
        } catch (error) {
            await errorHandling(error);
            return;
        }
        sessionNode = jobsProvider.mSessionNodes.find((jobNode) => jobNode.label.toString().trim() === sessionName.trim());
    }
    try {
        jobsProvider.refreshElement(sessionNode);
    } catch (error) {
        await errorHandling(error);
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
export async function modifyCommand(job: Job): Promise<void> {
    ZoweLogger.trace("job.actions.modifyCommand called.");
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
            ZoweLogger.error(error);
            Gui.errorMessage(
                localize("jobActions.modifyCommand.apiNonExisting", "Not implemented yet for profile of type: ") + job.getProfile().type
            );
        } else {
            await errorHandling(error, job.getProfile().name);
        }
    }
}

/**
 * Stop a job command
 *
 * @param job The job on which to stop a command
 */
export async function stopCommand(job: Job): Promise<void> {
    ZoweLogger.trace("job.actions.stopCommand called.");
    try {
        const commandApi = ZoweExplorerApiRegister.getInstance().getCommandApi(job.getProfile());
        if (commandApi) {
            const response = await ZoweExplorerApiRegister.getCommandApi(job.getProfile()).issueMvsCommand(`p ${job.job.jobname}`);
            Gui.showMessage(localize("jobActions.stopCommand.response", "Command response: ") + response.commandResponse);
        }
    } catch (error) {
        if (error.toString().includes("non-existing")) {
            ZoweLogger.error(error);
            Gui.errorMessage(localize("jobActions.stopCommand.apiNonExisting", "Not implemented yet for profile of type: ") + job.getProfile().type);
        } else {
            await errorHandling(error, job.getProfile().name);
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
export async function setOwner(job: IZoweJobTreeNode, jobsProvider: IZoweTree<IZoweJobTreeNode>): Promise<void> {
    ZoweLogger.trace("job.actions.setOwner called.");
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
export async function setPrefix(job: IZoweJobTreeNode, jobsProvider: IZoweTree<IZoweJobTreeNode>): Promise<void> {
    ZoweLogger.trace("job.actions.setPrefix called.");
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
export async function deleteCommand(jobsProvider: IZoweTree<IZoweJobTreeNode>, job?: IZoweJobTreeNode, jobs?: IZoweJobTreeNode[]): Promise<void> {
    ZoweLogger.trace("job.actions.deleteCommand called.");
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
    ZoweLogger.trace("job.actions.deleteSingleJob called.");
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
        ZoweLogger.debug(localize("deleteJobPrompt.confirmation.cancel.log.debug", "Delete action was canceled."));
        Gui.showMessage(localize("deleteJobPrompt.deleteCancelled", "Delete action was cancelled."));
        return;
    }

    try {
        await jobsProvider.delete(job);
        Gui.infoMessage(localize("deleteCommand.job", "Job {0} was deleted.", jobName));
    } catch (error) {
        await errorHandling(error, job.getProfile().name);
    }

    Gui.showMessage(localize("deleteCommand.job", "Job {0} was deleted.", jobName));
}

async function deleteMultipleJobs(jobs: ReadonlyArray<IZoweJobTreeNode>, jobsProvider: IZoweTree<IZoweJobTreeNode>): Promise<void> {
    ZoweLogger.trace("job.actions.deleteMultipleJobs called.");
    const deleteButton = localize("deleteJobPrompt.confirmation.delete", "Delete");
    const toJobname = (jobNode: IZoweJobTreeNode): string => `${jobNode.job.jobname}(${jobNode.job.jobid})`;
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
        ZoweLogger.debug(localize("deleteJobPrompt.confirmation.cancel.log.debug", "Delete action was canceled."));
        Gui.showMessage(localize("deleteJobPrompt.deleteCancelled", "Delete action was cancelled."));
        return;
    }
    const deletionResult: ReadonlyArray<IZoweJobTreeNode | Error> = await Promise.all(
        jobs.map(async (job) => {
            try {
                await jobsProvider.delete(job);
                return job;
            } catch (error) {
                ZoweLogger.error(error);
                if (error instanceof Error) {
                    return error;
                }
            }

            return undefined;
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

export async function cancelJobs(jobsProvider: IZoweTree<IZoweJobTreeNode>, nodes: IZoweJobTreeNode[]): Promise<void> {
    if (!nodes.length) {
        return;
    }

    // Filter out nodes that have already been cancelled
    const filteredNodes = nodes.filter(
        (n) => n.job == null || n.job.retcode == null || !(n.job.retcode.includes("CANCEL") || n.job.retcode?.includes("ABEND"))
    );
    if (!filteredNodes.length) {
        await Gui.showMessage(localize("cancelJobs.alreadyCancelled", "The selected jobs were already cancelled."));
        return;
    }

    const jesApis = {};

    const failedJobs: { job: zowe.IJob; error: string }[] = [];
    // Build list of common sessions from node selection
    const sessionNodes = [];
    for (const jobNode of nodes) {
        if (!jobNode.job) {
            continue;
        }
        const sesNode = jobNode.getSessionNode();
        const sesLabel = sesNode.label as string;
        if (!(sesLabel in jesApis)) {
            jesApis[sesLabel] = ZoweExplorerApiRegister.getJesApi(sesNode.getProfile());
        }

        if (!jesApis[sesLabel].cancelJob) {
            failedJobs.push({
                job: jobNode.job,
                error: localize("cancelJobs.notImplemented", "The cancel function is not implemented in this API."),
            });
            continue;
        }

        try {
            const cancelled = await jesApis[sesLabel].cancelJob(jobNode.job);
            if (!cancelled) {
                failedJobs.push({ job: jobNode.job, error: localize("cancelJobs.notCancelled", "The job was not cancelled.") });
            } else if (!sessionNodes.includes(sesNode)) {
                setImmediate(() => {
                    jobsProvider.refreshElement(sesNode);
                });
                sessionNodes.push(sesNode);
            }
        } catch (err) {
            if (err instanceof Error) {
                failedJobs.push({ job: jobNode.job, error: err.message });
            }
        }
    }

    if (failedJobs.length > 0) {
        // Display any errors from the API
        await Gui.warningMessage(
            localize(
                "cancelJobs.failed",
                "One or more jobs failed to cancel: {0}",
                failedJobs.reduce((prev, j) => prev.concat(`\n${j.job.jobname}(${j.job.jobid}): ${j.error}`), "\n")
            ),
            {
                vsCodeOpts: { modal: true },
            }
        );
    } else {
        await Gui.showMessage(localize("cancelJobs.succeeded", "Cancelled selected jobs successfully."));
    }
}
export async function sortJobs(session: IZoweJobTreeNode, jobsProvider: ZosJobsProvider): Promise<void> {
    const selection = await Gui.showQuickPick(
        JOB_SORT_OPTS.map((sortOpt, i) => ({
            label: i === session.sort.method ? `${sortOpt} $(check)` : sortOpt,
            description: i === JOB_SORT_OPTS.length - 1 ? SORT_DIRS[session.sort.direction] : null,
        })),
        {
            placeHolder: localize("jobs.selectSortOpt", "Select a sorting option for jobs in {0}", session.label as string),
        }
    );
    if (selection == null) {
        return;
    }
    if (selection.label === localize("setSortDirection", "$(fold) Sort Direction")) {
        const dir = await Gui.showQuickPick(SORT_DIRS, {
            placeHolder: localize("sort.selectDirection", "Select a sorting direction"),
        });
        if (dir != null) {
            session.sort = {
                ...(session.sort ?? { method: JobSortOpts.Id }),
                direction: SORT_DIRS.indexOf(dir),
            };
        }
        await sortJobs(session, jobsProvider);
        return;
    }

    session.sort.method = JOB_SORT_OPTS.indexOf(selection.label.replace(" $(check)", ""));
    jobsProvider.sortBy(session);
    Gui.setStatusBarMessage(localize("sort.updated", "$(check) Sorting updated for {0}", session.label as string), globals.MS_PER_SEC * 4);
}
