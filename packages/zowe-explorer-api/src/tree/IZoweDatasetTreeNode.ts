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

import { IZoweTreeNode } from "./IZoweTreeNode";

/**
 * Extended interface for Zowe Dataset tree nodes.
 *
 * @export
 * @interface export interface IZoweDatasetTreeNode extends IZoweTreeNode {
 */
export interface IZoweDatasetTreeNode extends IZoweTreeNode {
    /**
     * Search criteria for a Dataset search
     */
    pattern?: string;
    /**
     * Search criteria for a Dataset member search
     */
    memberPattern?: string;

    /**
     * Retrieves child nodes of this IZoweDatasetTreeNode
     *
     * @returns {Promise<IZoweDatasetTreeNode[]>}
     */
    getChildren(): Promise<IZoweDatasetTreeNode[]>;
    /**
     * Retrieves the etag value for the file
     *
     * @returns {string}
     */
    getEtag?(): string;
    /**
     * Sets the etag value for the file
     *
     * @param {string}
     */
    setEtag?(etag: string);
}
