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

import * as extension from "../extension";
import { TreeItem } from "vscode";

/**
 *
 * The contextValue is made up with the name of the node type as the first value in the sequence.
 * All subsequent attributes of the contextValue are preceded by an underscore character.
 * example:
 * pds_fav represents a pds file indicated as a favorite.
 *
 * Additional fields can be added as underscore values
 * example:
 * job_fav_rc=CC 0000
 *
 */


/**
 * Helper function which identifies if the node is a job
 * @param node
 * @return true if a job, false otherwise
 */
export function isJob(node: TreeItem): boolean {
    return new RegExp("^" + extension.JOBS_JOB_CONTEXT ).test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a binary file
 * @param node
 * @return true if a binary file, false otherwise
 */
export function isBinary(node: TreeItem): boolean {
    return new RegExp("^" + extension.DS_BINARY_FILE_CONTEXT).test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a grouping
 * @param node
 * @return true if a group, false otherwise
 */
export function isGroup(node: TreeItem): boolean {
    return new RegExp("^(" + extension.JOBS_JOB_CONTEXT + "|" + extension.USS_DIR_CONTEXT + "|"
                        + extension.DS_PDS_CONTEXT + ")").test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a session
 * @param node
 * @return true if a session, false otherwise
 */
export function isSession(node: TreeItem): boolean {
    return new RegExp("^(" + extension.JOBS_SESSION_CONTEXT + "|" + extension.USS_SESSION_CONTEXT + "|"
                        + extension.DS_SESSION_CONTEXT + ")").test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a session
 * @param node
 * @return true if a session, false otherwise
 */
export function isSessionNotFav(node: TreeItem): boolean {
    return new RegExp("^((?!.*" + extension.FAV_SUFFIX + ")(" + extension.JOBS_SESSION_CONTEXT + "|" + extension.USS_SESSION_CONTEXT + "|"
                        + extension.DS_SESSION_CONTEXT + "))").test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a session favorite
 * @param node
 * @return true if a session favorite, false otherwise
 */
export function isSessionFavorite(node: TreeItem): boolean {
   // return isSession(node) && isFavorite(node);
   return new RegExp("^(" + extension.FAVORITE_CONTEXT + ")").test(node.contextValue);
}
/**
 * Helper function which identifies if the node is a document
 * @param node
 * @return true if a document, false otherwise
 */
export function isDocument(node: TreeItem): boolean {
    return new RegExp("^(" + extension.DS_DS_CONTEXT + "|" + extension.DS_MEMBER_CONTEXT + "|"
                          + extension.DS_TEXT_FILE_CONTEXT + "|" + extension.JOBS_SPOOL_CONTEXT + "|"
                        + extension.DS_MIGRATED_FILE_CONTEXT + "|" + extension.DS_BINARY_FILE_CONTEXT + ")").test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a favorite
 * @param node
 * @return true if a favorite, false otherwise
 */
export function isFavorite(node: TreeItem): boolean {
    return new RegExp(extension.FAV_SUFFIX).test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a favorite root
 * or search
 * @param node
 * @return true if a favorite root, false otherwise
 */
export function isFavoriteSearch(node: TreeItem): boolean {
    return isSession(node) && isFavorite(node);
}
