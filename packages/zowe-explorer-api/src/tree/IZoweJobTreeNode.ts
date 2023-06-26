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

import { IJob } from "@zowe/cli";
import { IZoweTreeNode } from "./IZoweTreeNode";

/**
 * Extended interface for Zowe Job tree nodes.
 *
 * @export
 * @interface export interface IZoweJobTreeNode extends IZoweTreeNode {
 */
export interface IZoweJobTreeNode extends IZoweTreeNode {
    /**
     * Use Job-specific tree node for children.
     */
    children?: IZoweJobTreeNode[];
    /**
     * Standard job response document
     * Represents the attributes and status of a z/OS batch job
     * @interface IJob
     */
    job?: IJob;
    /**
     * Search criteria for a Job search
     */
    searchId?: string;
    /**
     * Job Prefix i.e "MYJOB"
     * Attribute of Job query
     */
    prefix?: string;
    /**
     * Job Owner i.e "MYID"
     * Attribute of Job query
     */
    owner?: string;
    /**
     * Job Status i.e "ACTIVE"
     * Attribute of Job query
     */
    status?: string;
    /**
     * Returns whether the job node is a filtered search
     */
    filtered?: boolean;
    /**
     * Retrieves child nodes of this IZoweJobTreeNode
     *
     * @returns {Promise<IZoweJobTreeNode[]>}
     */
    getChildren(): Promise<IZoweJobTreeNode[]>;
}
