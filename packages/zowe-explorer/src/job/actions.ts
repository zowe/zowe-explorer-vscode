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
import * as zosjobs from "@zowe/zos-jobs-for-zowe-sdk";
import { errorHandling } from "../utils/ProfilesUtils";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { Gui, IZoweJobTreeNode, Sorting, Types } from "@zowe/zowe-explorer-api";
import { ZoweJobNode } from "./ZoweJobNode";
import { getSpoolFiles, matchSpool } from "../SpoolProvider";
import { ZoweLogger } from "../utils/ZoweLogger";
import { LocalFileManagement } from "../utils/LocalFileManagement";
import { SORT_DIRS } from "../shared/utils";
import { ZosJobsProvider } from "./ZosJobsProvider";
import { JOB_SORT_OPTS } from "./utils";
import * as globals from "../globals";
import { JobFSProvider } from "./JobFSProvider";

/**
 * Download all the spool content for the specified job.
 *
 * @param job The job to download the spool content from
 */
export async function downloadSpool(jobs: IZoweJobTreeNode[], binary?: boolean): Promise<void> {
    ZoweLogger.trace("job.actions.downloadSpool called.");
    try {
        const dirUri = await Gui.showOpenDialog({
            openLabel: vscode.l10n.t("Select"),
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
            defaultUri: LocalFileManagement.getDefaultUri(),
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
            throw Error(vscode.l10n.t("Download Single Spool operation not implemented by extender. Please contact the extension developer(s)."));
        }
        const dirUri = await Gui.showOpenDialog({
            openLabel: vscode.l10n.t("Select"),
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
            defaultUri: LocalFileManagement.getDefaultUri(),
        });
        if (dirUri !== undefined) {
            for (const node of nodes) {
                const spools = (await getSpoolFiles(node)).filter((spool: zosjobs.IJobFile) => matchSpool(spool, node));
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
 * Triggers a refresh for a spool file w/ the provided text document.
 * @param doc The document to update, associated with the spool file
 */
export async function spoolFilePollEvent(doc: vscode.TextDocument): Promise<void> {
    const statusMsg = Gui.setStatusBarMessage(
        vscode.l10n.t({
            message: `$(sync~spin) Polling: {0}...`,
            args: [doc.fileName],
            comment: ["Document file name"],
        })
    );
    await JobFSProvider.instance.fetchSpoolAtUri(doc.uri);
    statusMsg.dispose();
}

/**
 * Refresh a node in the job tree
 *
 * @param node The node to refresh
 * @param jobsProvider The tree to which the refreshed node belongs
 */
export async function refreshJobsServer(node: IZoweJobTreeNode, jobsProvider: Types.IZoweJobTreeType): Promise<void> {
    ZoweLogger.trace("job.actions.refreshJobsServer called.");
    await jobsProvider.refreshElement(node);
}

/**
 * Refresh a job node information and spool files in the job tree
 *
 * @param job The job node to refresh
 * @param jobsProvider The tree to which the refreshed node belongs
 */
export function refreshJob(job: ZoweJobNode, jobsProvider: Types.IZoweJobTreeType): void {
    ZoweLogger.trace("job.actions.refreshJob called.");
    jobsProvider.refreshElement(job);
}

/**
 * Download the JCL content for the specified job.
 *
 * @param job The job to download the JCL content from
 */
export async function downloadJcl(job: ZoweJobNode): Promise<void> {
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
export const focusOnJob = async (jobsProvider: Types.IZoweJobTreeType, sessionName: string, jobId: string): Promise<void> => {
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
export async function modifyCommand(job: ZoweJobNode): Promise<void> {
    ZoweLogger.trace("job.actions.modifyCommand called.");
    try {
        const options: vscode.InputBoxOptions = {
            prompt: vscode.l10n.t("Modify Command"),
        };
        const command = await Gui.showInputBox(options);
        if (command !== undefined) {
            const commandApi = ZoweExplorerApiRegister.getInstance().getCommandApi(job.getProfile());
            if (commandApi) {
                const response = await ZoweExplorerApiRegister.getCommandApi(job.getProfile()).issueMvsCommand(`f ${job.job.jobname},${command}`);
                Gui.showMessage(
                    vscode.l10n.t({
                        message: "Command response: {0}",
                        args: [response.commandResponse],
                        comment: ["Command response"],
                    })
                );
            }
        }
    } catch (error) {
        if (error.toString().includes("non-existing")) {
            ZoweLogger.error(error);
            Gui.errorMessage(
                vscode.l10n.t("jobActions.modifyCommand.apiNonExisting", "Not implemented yet for profile of type: ") + job.getProfile().type
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
export async function stopCommand(job: ZoweJobNode): Promise<void> {
    ZoweLogger.trace("job.actions.stopCommand called.");
    try {
        const commandApi = ZoweExplorerApiRegister.getInstance().getCommandApi(job.getProfile());
        if (commandApi) {
            const response = await ZoweExplorerApiRegister.getCommandApi(job.getProfile()).issueMvsCommand(`p ${job.job.jobname}`);
            Gui.showMessage(
                vscode.l10n.t({
                    message: "Command response: {0}",
                    args: [response.commandResponse],
                    comment: ["Command response"],
                })
            );
        }
    } catch (error) {
        if (error.toString().includes("non-existing")) {
            ZoweLogger.error(error);
            Gui.errorMessage(
                vscode.l10n.t({
                    message: "Not implemented yet for profile of type: {0}",
                    args: [job.getProfile().type],
                    comment: ["Job profile type"],
                })
            );
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
export async function setOwner(job: IZoweJobTreeNode, jobsProvider: Types.IZoweJobTreeType): Promise<void> {
    ZoweLogger.trace("job.actions.setOwner called.");
    const options: vscode.InputBoxOptions = {
        prompt: vscode.l10n.t("Owner"),
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
export async function setPrefix(job: IZoweJobTreeNode, jobsProvider: Types.IZoweJobTreeType): Promise<void> {
    ZoweLogger.trace("job.actions.setPrefix called.");
    const options: vscode.InputBoxOptions = {
        prompt: vscode.l10n.t("Prefix"),
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
export async function deleteCommand(jobsProvider: Types.IZoweJobTreeType, job?: IZoweJobTreeNode, jobs?: IZoweJobTreeNode[]): Promise<void> {
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

async function deleteSingleJob(job: IZoweJobTreeNode, jobsProvider: Types.IZoweJobTreeType): Promise<void> {
    ZoweLogger.trace("job.actions.deleteSingleJob called.");
    const jobName = `${job.job.jobname}(${job.job.jobid})`;
    const message = vscode.l10n.t({
        message: "Are you sure you want to delete the following item?\nThis will permanently remove the following job from your system.\n\n{0}",
        args: [jobName.replace(/(,)/g, "\n")],
        comment: ["Job name"],
    });
    const deleteButton = vscode.l10n.t("Delete");
    const result = await Gui.warningMessage(message, {
        items: [deleteButton],
        vsCodeOpts: { modal: true },
    });
    if (!result || result === "Cancel") {
        ZoweLogger.debug(vscode.l10n.t("Delete action was canceled."));
        Gui.showMessage(vscode.l10n.t("Delete action was cancelled."));
        return;
    }

    try {
        await jobsProvider.delete(job);
        Gui.infoMessage(
            vscode.l10n.t({
                message: "Job {0} was deleted.",
                args: [jobName],
                comment: ["Job name"],
            })
        );
    } catch (error) {
        await errorHandling(error, job.getProfile().name);
    }
}

async function deleteMultipleJobs(jobs: ReadonlyArray<IZoweJobTreeNode>, jobsProvider: Types.IZoweJobTreeType): Promise<void> {
    ZoweLogger.trace("job.actions.deleteMultipleJobs called.");
    const deleteButton = vscode.l10n.t("Delete");
    const toJobname = (jobNode: IZoweJobTreeNode): string => `${jobNode.job.jobname}(${jobNode.job.jobid})`;
    const message = vscode.l10n.t({
        message: "Are you sure you want to delete the following {0} items?\nThis will permanently remove the following jobs from your system.\n\n{1}",
        args: [jobs.length, jobs.map(toJobname).toString().replace(/(,)/g, "\n")],
        comment: ["Jobs length", "Job names"],
    });
    const deleteChoice = await Gui.warningMessage(message, {
        items: [deleteButton],
        vsCodeOpts: { modal: true },
    });
    if (!deleteChoice || deleteChoice === "Cancel") {
        ZoweLogger.debug(vscode.l10n.t("Delete action was canceled."));
        Gui.showMessage(vscode.l10n.t("Delete action was cancelled."));
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
            vscode.l10n.t({
                message: "The following jobs were deleted: {0}",
                args: [deletedJobs.map(toJobname).toString().replace(/(,)/g, ", ")],
                comment: ["Deleted jobs"],
            })
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

export async function cancelJobs(jobsProvider: Types.IZoweJobTreeType, nodes: IZoweJobTreeNode[]): Promise<void> {
    if (!nodes.length) {
        return;
    }

    // Filter out nodes that have already been cancelled
    const filteredNodes = nodes.filter(
        (n) => n.job == null || n.job.retcode == null || !(n.job.retcode.includes("CANCEL") || n.job.retcode?.includes("ABEND"))
    );
    if (!filteredNodes.length) {
        await Gui.showMessage(vscode.l10n.t("The selected jobs were already cancelled."));
        return;
    }

    const jesApis = {};

    const failedJobs: { job: zosjobs.IJob; error: string }[] = [];
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
                error: vscode.l10n.t("The cancel function is not implemented in this API."),
            });
            continue;
        }

        try {
            const cancelled = await jesApis[sesLabel].cancelJob(jobNode.job);
            if (!cancelled) {
                failedJobs.push({ job: jobNode.job, error: vscode.l10n.t("The job was not cancelled.") });
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
            vscode.l10n.t({
                message: "One or more jobs failed to cancel: {0}",
                args: [failedJobs.reduce((prev, j) => prev.concat(`\n${j.job.jobname}(${j.job.jobid}): ${j.error}`), "\n")],
                comment: ["Failed to cancel jobs"],
            }),
            {
                vsCodeOpts: { modal: true },
            }
        );
    } else {
        await Gui.showMessage(vscode.l10n.t("Cancelled selected jobs successfully."));
    }
}
export async function sortJobs(session: IZoweJobTreeNode, jobsProvider: ZosJobsProvider): Promise<void> {
    const selection = await Gui.showQuickPick(
        JOB_SORT_OPTS.map((sortOpt, i) => ({
            label: i === session.sort.method ? `${sortOpt} $(check)` : sortOpt,
            description: i === JOB_SORT_OPTS.length - 1 ? SORT_DIRS[session.sort.direction] : null,
        })),
        {
            placeHolder: vscode.l10n.t({
                message: "Select a sorting option for jobs in {0}",
                args: [session.label as string],
                comment: ["Session label"],
            }),
        }
    );
    if (selection == null) {
        return;
    }
    if (selection.label === vscode.l10n.t("$(fold) Sort Direction")) {
        const dir = await Gui.showQuickPick(SORT_DIRS, {
            placeHolder: vscode.l10n.t("Select a sorting direction"),
        });
        if (dir != null) {
            session.sort = {
                ...(session.sort ?? { method: Sorting.JobSortOpts.Id }),
                direction: SORT_DIRS.indexOf(dir),
            };
        }
        await sortJobs(session, jobsProvider);
        return;
    }

    session.sort.method = JOB_SORT_OPTS.indexOf(selection.label.replace(" $(check)", ""));
    jobsProvider.sortBy(session);
    Gui.setStatusBarMessage(
        vscode.l10n.t({
            message: "$(check) Sorting updated for {0}",
            args: [session.label as string],
            comment: ["Session label"],
        }),
        globals.MS_PER_SEC * 4
    );
}
