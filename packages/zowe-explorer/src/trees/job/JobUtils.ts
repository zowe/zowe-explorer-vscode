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
import { Sorting } from "@zowe/zowe-explorer-api";

export class JobUtils {
    public static JOB_SORT_OPTS = [
        `$(list-ordered) ${vscode.l10n.t("Job ID")}`,
        `$(calendar) ${vscode.l10n.t("Date Submitted")}`,
        `$(calendar) ${vscode.l10n.t("Date Completed")}`,
        `$(case-sensitive) ${vscode.l10n.t("Job Name")}`,
        `$(symbol-numeric) ${vscode.l10n.t("Return Code")}`,
        `$(fold) ${vscode.l10n.t("Sort Direction")}`,
    ];

    public static readonly JOB_SORT_KEYS: Record<Sorting.JobSortOpts, keyof (zosjobs.IJob & { "exec-submitted": string; "exec-ended": string })> = {
        [Sorting.JobSortOpts.Id]: "jobid",
        [Sorting.JobSortOpts.DateSubmitted]: "exec-submitted",
        [Sorting.JobSortOpts.DateCompleted]: "exec-ended",
        [Sorting.JobSortOpts.Name]: "jobname",
        [Sorting.JobSortOpts.ReturnCode]: "retcode",
    };

    public static readonly JOB_FILTER_OPTS = [vscode.l10n.t("Go to Local Filtering"), `$(clear-all) ${vscode.l10n.t("Clear filter for profile")}`];
}
