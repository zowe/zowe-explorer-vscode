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

import * as zosjobs from "@zowe/zos-jobs-for-zowe-sdk";
import type { IZoweJobTreeNode } from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "../extending/ZoweExplorerApiRegister";
import { ZoweLogger } from "../tools/ZoweLogger";
import { ZoweSpoolNode } from "../trees/job/ZoweJobNode";

export class SpoolUtils {
    /**
     * Gather all spool files for a given job
     * @param node Selected node for which to extract all spool files
     * @returns Array of spool files
     */
    public static async getSpoolFiles(node: IZoweJobTreeNode): Promise<zosjobs.IJobFile[]> {
        ZoweLogger.trace("SpoolUtils.getSpoolFiles called.");
        if (node.job == null) {
            return [];
        }
        let spools: zosjobs.IJobFile[] = [];
        spools = await ZoweExplorerApiRegister.getJesApi(node.getProfile()).getSpoolFiles(node.job.jobname, node.job.jobid);
        spools = spools
            // filter out all the objects which do not seem to be correct Job File Document types
            // see an issue #845 for the details
            .filter((item) => !(item.id === undefined && item.ddname === undefined && item.stepname === undefined));
        return spools;
    }

    /**
     * Determine whether or not a spool file matches a selected node
     *
     * @param spool Individual spool file to match the node with
     * @param node Selected node
     * @returns true if the selected node matches the spool file, false otherwise
     */
    public static matchSpool(spool: zosjobs.IJobFile, node: IZoweJobTreeNode): boolean {
        const nodeSpool = (node as ZoweSpoolNode).spool;
        return nodeSpool != null && spool.jobid === nodeSpool.jobid && spool.id === nodeSpool.id;
    }
}
