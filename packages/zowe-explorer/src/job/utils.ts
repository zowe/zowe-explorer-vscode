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

import { Sorting } from "@zowe/zowe-explorer-api";
import { ZoweLogger } from "../utils/LoggerUtils";
import { FilterItem } from "../utils/ProfilesUtils";
import { IJob } from "@zowe/zos-jobs-for-zowe-sdk";
import * as vscode from "vscode";

export const JOB_SORT_OPTS = [
    vscode.l10n.t("$(list-ordered) Job ID (default)"),
    vscode.l10n.t("$(calendar) Date Submitted"),
    vscode.l10n.t("$(case-sensitive) Job Name"),
    vscode.l10n.t("$(symbol-numeric) Return Code"),
    vscode.l10n.t("$(fold) Sort Direction"),
];

export const JOB_SORT_KEYS: Record<Sorting.JobSortOpts, keyof (IJob & { "exec-submitted": string })> = {
    [Sorting.JobSortOpts.Id]: "jobid",
    [Sorting.JobSortOpts.DateSubmitted]: "exec-submitted",
    [Sorting.JobSortOpts.Name]: "jobname",
    [Sorting.JobSortOpts.ReturnCode]: "retcode",
};

export const JOB_FILTER_OPTS = [vscode.l10n.t("Go to Local Filtering"), vscode.l10n.t("$(clear-all) Clear filter for profile")];

export async function resolveQuickPickHelper(quickpick): Promise<FilterItem | undefined> {
    ZoweLogger.trace("job.utils.resolveQuickPickHelper called.");
    return new Promise<FilterItem | undefined>((c) => {
        quickpick.onDidAccept(() => c(quickpick.activeItems[0]));
        quickpick.onDidHide(() => c(undefined));
    });
}
