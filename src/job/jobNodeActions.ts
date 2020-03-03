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


import * as utils from "../utils";
import * as nls from "vscode-nls";

const localize = nls.config({messageFormat: nls.MessageFormat.file})();
import * as extension from "../../src/extension";
import { Profiles } from "../Profiles";
import { IZoweTree } from "../api/IZoweTree";
import { IZoweUSSTreeNode, IZoweJobTreeNode } from "../api/IZoweTreeNode";
import { ISession } from "@zowe/imperative";

export async function refreshAllJobs(jobsProvider: IZoweTree<IZoweJobTreeNode>) {
    await Profiles.getInstance().refresh();
    jobsProvider.mSessionNodes.forEach((jobNode) => {
        if (jobNode.contextValue === extension.JOBS_SESSION_CONTEXT) {
            utils.labelHack(jobNode);
            jobNode.children = [];
            jobNode.dirty = true;
            utils.refreshTree(jobNode);
        }
    });
    await jobsProvider.refresh();
}
