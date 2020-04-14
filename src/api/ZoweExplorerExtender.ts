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

import { IProfileLoaded } from "@zowe/imperative";
import { getProfile, getLinkedProfile } from "../utils/links";
import { IZoweTreeNode } from "./IZoweTreeNode";

/**
 * The Zowe Explorer API Register singleton that gets exposed to other VS Code
 * extensions to contribute their implementations.
 * @export
 */
export class ZoweExplorerExtender {

    /**
     * Access the singleton instance.
     * @static
     * @returns {ZoweExplorerExtender} the ZoweExplorerExtender singleton instance
     */
    public static getInstance(): ZoweExplorerExtender {
        return ZoweExplorerExtender.instance;
    }

    /**
     * This object represents a collection of the APIs that get exposed to other VS Code
     * extensions that want to contribute alternative implementations such as alternative ways
     * of retrieving files and data from z/OS.
     */
    private static instance: ZoweExplorerExtender = new ZoweExplorerExtender();

    /**
     * This method can be used by other VS Code Extensions to access the primary profile.
     *
     * @param primaryNode represents the Tree item that is being used
     * @return The requested profile
     *
     */
    public getProfile(primaryNode: IZoweTreeNode): Promise<IProfileLoaded>  {
        return getProfile(primaryNode);
    }

    /**
     * This method can be used by other VS Code Extensions to access an alternative
     * profile types that can be employed in conjunction with the primary profile to provide
     * alternative support.
     *
     * @param primaryNode represents the Tree item that is being used
     * @return The requested profile
     */
    public getRelatedProfile(primaryNode: IZoweTreeNode, type: string): Promise<IProfileLoaded> {
        return getLinkedProfile(primaryNode, type);
    }

}
