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

import { JobSortOpts } from "@zowe/zowe-explorer-api";
import { ZoweLogger } from "../utils/LoggerUtils";
import { FilterItem } from "../utils/ProfilesUtils";
import * as nls from "vscode-nls";
import { IJob } from "@zowe/cli";

// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

export const JOB_SORT_OPTS = [
    localize("jobs.sortById", "$(list-ordered) Job ID (default)"),
    localize("jobs.sortByDateSubmitted", "$(calendar) Date Submitted"),
    localize("jobs.sortByName", "$(case-sensitive) Job Name"),
    localize("jobs.sortByReturnCode", "$(symbol-numeric) Return Code"),
    localize("setSortDirection", "$(fold) Sort Direction"),
];

export const JOB_SORT_KEYS: Record<JobSortOpts, keyof (IJob & { "exec-submitted": string })> = {
    [JobSortOpts.Id]: "jobid",
    [JobSortOpts.DateSubmitted]: "exec-submitted",
    [JobSortOpts.Name]: "jobname",
    [JobSortOpts.ReturnCode]: "retcode",
};

export async function resolveQuickPickHelper(quickpick): Promise<FilterItem | undefined> {
    ZoweLogger.trace("job.utils.resolveQuickPickHelper called.");
    return new Promise<FilterItem | undefined>((c) => {
        quickpick.onDidAccept(() => c(quickpick.activeItems[0]));
        quickpick.onDidHide(() => c(undefined));
    });
}
