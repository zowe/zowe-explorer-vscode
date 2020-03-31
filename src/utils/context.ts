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
 * Helper function which identifies if the node is a pds or ds and a favorite
 * @param node
 * @return true if a favorite pds, ds, false otherwise
 */
export function isFavoritePsDs(node: TreeItem): boolean {
    return new RegExp("^(" + extension.DS_PDS_CONTEXT + "|" +
                    extension.DS_DS_CONTEXT + ")(.*" + extension.FAV_SUFFIX + ")").test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a ds and a favorite
 * @param node
 * @return true if a favorite ds, false otherwise
 */
export function isFavoriteDs(node: TreeItem): boolean {
    return new RegExp("^(" + extension.DS_DS_CONTEXT + ")(.*" + extension.FAV_SUFFIX + ")").test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a job and it's a favorite
 * @param node
 * @return true if a favorite job, false otherwise
 */
export function isFavoriteJob(node: TreeItem): boolean {
    return new RegExp("^(" + extension.JOBS_JOB_CONTEXT + ")(.*" + extension.FAV_SUFFIX + ")").test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a pds and a favorite
 * @param node
 * @return true if a favorite pds, false otherwise
 */
export function isFavoritePds(node: TreeItem): boolean {
    return new RegExp("^(" + extension.DS_PDS_CONTEXT + ")(.*" + extension.FAV_SUFFIX + ")").test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a Favorite binary or text file
 * @param node
 * @return true if a Favorite binary or text file, false otherwise
 */
export function isFavoriteTextorBinary(node: TreeItem): boolean {
    return new RegExp("^("+ extension.DS_BINARY_FILE_CONTEXT + "|" +
                    extension.DS_TEXT_FILE_CONTEXT + ")(.*" + extension.FAV_SUFFIX + ")").test(node.contextValue);
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
    return new RegExp("^(" + extension.JOBS_SESSION_CONTEXT + "|" + extension.USS_SESSION_CONTEXT + "|"
                        + extension.DS_SESSION_CONTEXT + ")(.*" + extension.FAV_SUFFIX + ")").test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a favorite context
 * @param node
 * @return true if a favorite context root, false otherwise
 */
export function isFavoriteContext(node: TreeItem): boolean {
    return new RegExp(extension.FAVORITE_CONTEXT).test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a dataset member
 * @param node
 * @return true if a dataset member, false otherwise
 */
export function isDsMember(node: TreeItem): boolean {
    return new RegExp("^(" + extension.DS_MEMBER_CONTEXT + ")").test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a dataset session
 * @param node
 * @return true if a dataset session, false otherwise
 */
export function isDsSession(node: TreeItem): boolean {
    return new RegExp("^(" + extension.DS_SESSION_CONTEXT + ")").test(node.contextValue);
}


/**
 * Helper function which identifies if the node is a partitioned dataset
 * @param node
 * @return true if a partitioned dataset, false otherwise
 */
export function isPds(node: TreeItem): boolean {
    return new RegExp("^(" + extension.DS_PDS_CONTEXT + ")").test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a USS Directory
 * @param node
 * @return true if a USS Directory, false otherwise
 */
export function isUssDirectory(node: TreeItem): boolean {
    return new RegExp("^" + extension.USS_DIR_CONTEXT).test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a USS session
 * @param node
 * @return true if a USS session, false otherwise
 */
export function isUssSession(node: TreeItem): boolean {
    return new RegExp("^(" + extension.USS_SESSION_CONTEXT + ")").test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a grouping or folder
 * @param node
 * @return true if a folder, false otherwise
 */
export function isFolder(node: TreeItem): boolean {
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
 * Helper function which identifies if the node is a session but not a favorite
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
 * Helper function create the favorite version of a node
 * @param node
 * @return If not a favorite an extended contextValue with _fav.
 * If the value is a favorite already that contextValue is returned.
 */
export function deriveFavorite(node: TreeItem): string {
    return isFavorite(node) ? node.contextValue : node.contextValue + extension.FAV_SUFFIX;
}

/**
 * Helper function to retrieve the base context of a node
 * @param node
 * @return The inital element of the context.
 */
export function getBaseContext(node: TreeItem): string {
    return node.contextValue.indexOf(extension.CONTEXT_PREFIX) > -1 ?
        node.contextValue.substring(0, node.contextValue.indexOf(extension.CONTEXT_PREFIX)) :
        node.contextValue;
}
