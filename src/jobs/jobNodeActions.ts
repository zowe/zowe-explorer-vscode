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
import { DeleteJobs } from "@brightside/core";
import * as nls from "vscode-nls";
import { Job } from "../ZoweJobNode";
const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

export async function deleteJob(node: Job) {
    try {
        await DeleteJobs.deleteJob(node.getSession(), node.job.jobname, node.job.jobid); 
        vscode.window.showInformationMessage(localize("deleteJob.job", "Job ") + node.job.jobname + "(" + node.job.jobid + ")" +
        localize("deleteJob.delete", " deleted"));
    } catch (error) {
        vscode.window.showErrorMessage(error.message);
    }
}

