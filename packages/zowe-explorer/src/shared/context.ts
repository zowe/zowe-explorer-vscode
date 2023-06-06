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

import * as globals from "../globals";
import { TreeItem } from "vscode";
import { IZoweTreeNode, IZoweUSSTreeNode } from "@zowe/zowe-explorer-api";

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
 * Helper function which identifies if the node is a ds
 * @param node
 * @return true if a ds, false otherwise
 */
export function isDs(node: TreeItem): boolean {
    return new RegExp("^" + globals.DS_DS_CONTEXT).test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a job
 * @param node
 * @return true if a job, false otherwise
 */
export function isJob(node: TreeItem): boolean {
    return new RegExp("^" + globals.JOBS_JOB_CONTEXT).test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a pds or ds and a favorite
 * @param node
 * @return true if a favorite pds, ds, false otherwise
 */
export function isFavoritePsDs(node: TreeItem): boolean {
    return new RegExp("^(" + globals.DS_PDS_CONTEXT + "|" + globals.DS_DS_CONTEXT + ")(.*" + globals.FAV_SUFFIX + ")").test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a ds and a favorite
 * @param node
 * @return true if a favorite ds, false otherwise
 */
export function isFavoriteDs(node: TreeItem): boolean {
    return new RegExp("^(" + globals.DS_DS_CONTEXT + ")(.*" + globals.FAV_SUFFIX + ")").test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a job and it's a favorite
 * @param node
 * @return true if a favorite job, false otherwise
 */
export function isFavoriteJob(node: TreeItem): boolean {
    return new RegExp("^(" + globals.JOBS_JOB_CONTEXT + ")(.*" + globals.FAV_SUFFIX + ")").test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a pds and a favorite
 * @param node
 * @return true if a favorite pds, false otherwise
 */
export function isFavoritePds(node: TreeItem): boolean {
    return new RegExp("^(" + globals.DS_PDS_CONTEXT + ")(.*" + globals.FAV_SUFFIX + ")").test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a Favorite binary or text file
 * @param node
 * @return true if a Favorite binary or text file, false otherwise
 */
export function isFavoriteTextOrBinary(node: TreeItem): boolean {
    return new RegExp("^(" + globals.DS_BINARY_FILE_CONTEXT + "|" + globals.DS_TEXT_FILE_CONTEXT + ")(.*" + globals.FAV_SUFFIX + ")").test(
        node.contextValue
    );
}

/**
 * Helper function which identifies if the node is a binary file
 * @param node
 * @return true if a binary file, false otherwise
 */
export function isBinary(node: TreeItem): boolean {
    return new RegExp("^" + globals.DS_BINARY_FILE_CONTEXT).test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a text file
 * @param node
 * @return true if a text file, false otherwise
 */
export function isText(node: TreeItem): boolean {
    return new RegExp("^" + globals.DS_TEXT_FILE_CONTEXT).test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a document
 * @param node
 * @return true if a document, false otherwise
 */
export function isDocument(node: TreeItem): boolean {
    return new RegExp(
        "^(" +
            globals.DS_DS_CONTEXT +
            "|" +
            globals.DS_MEMBER_CONTEXT +
            "|" +
            globals.DS_TEXT_FILE_CONTEXT +
            "|" +
            globals.JOBS_SPOOL_CONTEXT +
            "|" +
            globals.DS_MIGRATED_FILE_CONTEXT +
            "|" +
            globals.DS_FILE_ERROR_CONTEXT +
            ")"
    ).test(node.contextValue);
}

/**
 * Helper function which identifies if the node has polling enabled
 * @param node
 * @returns true if the node has polling enabled, false otherwise
 */
export function isPolling(node: TreeItem): boolean {
    return new RegExp(globals.POLL_CONTEXT).test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a spool file
 * @param node
 * @returns true if a spool file, false otherwise
 */
export function isSpoolFile(node: TreeItem): boolean {
    return new RegExp("^(" + globals.JOBS_SPOOL_CONTEXT + ")").test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a informational only
 * @param node
 * @return true if a informational, false otherwise
 */
export function isInformation(node: TreeItem): boolean {
    return new RegExp("^(" + globals.INFORMATION_CONTEXT + ")").test(node.contextValue);
}

/**
 * Helper function which identifies if the node is migrated
 * @param node
 * @return true if a migrated dataset, false otherwise
 */
export function isMigrated(node: TreeItem): boolean {
    return new RegExp("^(" + globals.DS_MIGRATED_FILE_CONTEXT + ")").test(node.contextValue);
}

/**
 * Helper function which identifies if the node has an error
 * @param node
 * @return true if there was an error obtaining information about this dataset, false otherwise
 */
export function hasFileError(node: TreeItem): boolean {
    return new RegExp("^(" + globals.DS_FILE_ERROR_CONTEXT + ")").test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a favorite
 * @param node
 * @return true if a favorite, false otherwise
 */
export function isFavorite(node: TreeItem): boolean {
    return new RegExp(globals.FAV_SUFFIX).test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a favorited profile
 * @param node
 * @return true if a favorited profile, false otherwise
 */
export function isFavProfile(node: TreeItem): boolean {
    return new RegExp(globals.FAV_PROFILE_CONTEXT).test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a favorite root
 * or search
 * @param node
 * @return true if a favorite root, false otherwise
 */
export function isFavoriteSearch(node: TreeItem): boolean {
    return new RegExp(
        "^(" + globals.JOBS_SESSION_CONTEXT + "|" + globals.USS_SESSION_CONTEXT + "|" + globals.DS_SESSION_CONTEXT + ")(.*" + globals.FAV_SUFFIX + ")"
    ).test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a favorite context
 * @param node
 * @return true if a favorite context root, false otherwise
 */
export function isFavoriteContext(node: TreeItem): boolean {
    return new RegExp(globals.FAVORITE_CONTEXT).test(node.contextValue);
}

/**
 * Helper function to determine if node is located in the global layer.
 * Only applicable for TEAM profiles
 * @param node
 * @returns true if node is located in the global layer, false otherwise
 */
export function isHomeProfile(node: TreeItem): boolean {
    return new RegExp(
        "^(" +
            globals.JOBS_SESSION_CONTEXT +
            "|" +
            globals.USS_SESSION_CONTEXT +
            "|" +
            globals.DS_SESSION_CONTEXT +
            ")(.*" +
            globals.HOME_SUFFIX +
            ")"
    ).test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a dataset member
 * @param node
 * @return true if a dataset member, false otherwise
 */
export function isDsMember(node: TreeItem): boolean {
    return new RegExp("^(" + globals.DS_MEMBER_CONTEXT + ")").test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a dataset session
 * @param node
 * @return true if a dataset session, false otherwise
 */
export function isDsSession(node: TreeItem): boolean {
    return new RegExp("^(" + globals.DS_SESSION_CONTEXT + ")").test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a partitioned, unfavorited dataset
 * @param node
 * @return true if a partitioned and unfavorited dataset, false otherwise
 */
export function isPdsNotFav(node: TreeItem): boolean {
    return new RegExp("^(?!.*" + globals.FAV_SUFFIX + ")" + globals.DS_PDS_CONTEXT).test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a partitioned dataset
 * @param node
 * @return true if a partitioned dataset, false otherwise
 */
export function isPds(node: TreeItem): boolean {
    return new RegExp("^(" + globals.DS_PDS_CONTEXT + ")").test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a USS Directory
 * @param node
 * @return true if a USS Directory, false otherwise
 */
export function isUssDirectory(node: TreeItem): boolean {
    return new RegExp("^" + globals.USS_DIR_CONTEXT).test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a USS session
 * @param node
 * @return true if a USS session, false otherwise
 */
export function isUssSession(node: TreeItem): boolean {
    return new RegExp("^(" + globals.USS_SESSION_CONTEXT + ")").test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a grouping or folder
 * @param node
 * @return true if a folder, false otherwise
 */
export function isFolder(node: TreeItem): boolean {
    return new RegExp("^(" + globals.JOBS_JOB_CONTEXT + "|" + globals.USS_DIR_CONTEXT + "|" + globals.DS_PDS_CONTEXT + ")").test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a grouping or folder of a filter search
 * @param node
 * @return true if a folder with a filter search, false otherwise
 */
export function isFilterFolder(node: TreeItem): boolean {
    return new RegExp("^(" + globals.DS_PDS_CONTEXT + ")(" + globals.FILTER_SEARCH + ")").test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a session
 * @param node
 * @return true if a session, false otherwise
 */
export function isSession(node: TreeItem): boolean {
    return new RegExp("^(" + globals.JOBS_SESSION_CONTEXT + "|" + globals.USS_SESSION_CONTEXT + "|" + globals.DS_SESSION_CONTEXT + ")").test(
        node.contextValue
    );
}

/**
 * Helper function which identifies if the node is a session but not a favorite
 * @param node
 * @return true if a session, false otherwise
 */
export function isSessionInactive(node: TreeItem): boolean {
    return new RegExp(
        "^(" +
            globals.JOBS_SESSION_CONTEXT +
            "|" +
            globals.USS_SESSION_CONTEXT +
            "|" +
            globals.DS_SESSION_CONTEXT +
            ")(.*" +
            globals.INACTIVE_CONTEXT +
            ")"
    ).test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a session but not a favorite
 * @param node
 * @return true if a session, false otherwise
 */
export function isSessionActive(node: TreeItem): boolean {
    return new RegExp(
        "^(" +
            globals.JOBS_SESSION_CONTEXT +
            "|" +
            globals.USS_SESSION_CONTEXT +
            "|" +
            globals.DS_SESSION_CONTEXT +
            ")(.*" +
            globals.ACTIVE_CONTEXT +
            ")"
    ).test(node.contextValue);
}
/**
 * Helper function which identifies if the node is a session but not a favorite
 * @param node
 * @return true if a session, false otherwise
 */
export function isSessionNotFav(node: TreeItem): boolean {
    return new RegExp(
        "^((?!.*" +
            globals.FAV_SUFFIX +
            ")(" +
            globals.JOBS_SESSION_CONTEXT +
            "|" +
            globals.USS_SESSION_CONTEXT +
            "|" +
            globals.DS_SESSION_CONTEXT +
            "))"
    ).test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a session favorite
 * @param node
 * @return true if a session favorite, false otherwise
 */
export function isSessionFavorite(node: TreeItem): boolean {
    return new RegExp("^(" + globals.FAVORITE_CONTEXT + ")").test(node.contextValue);
}

/**
 * Helper function to determine if node is located anywhere in a Favorites section (including as a child, grandchild, etc).
 * @param node
 * @returns true if node is located in Favorites, false otherwise
 */
export function isFavoriteDescendant(node: IZoweTreeNode): boolean {
    return isFavorite(node.getSessionNode());
}

/**
 * Helper function which identifies if the node is Vsam
 * @param node
 * @return true if a vsam file, false otherwise
 */
export function isVsam(node: TreeItem): boolean {
    return new RegExp("^(" + globals.VSAM_CONTEXT + ")").test(node.contextValue);
}

/**
 * Helper function create the favorite version of a node
 * @param node
 * @return If not a favorite an extended contextValue with _fav.
 * If the value is a favorite already that contextValue is returned.
 */
export function asFavorite(node: TreeItem): string {
    return isFavorite(node) ? node.contextValue : node.contextValue + globals.FAV_SUFFIX;
}

export function withProfile(node: IZoweTreeNode): string {
    if (!node) {
        return;
    }
    const hasProfile = (n: IZoweTreeNode): boolean => n?.contextValue?.includes(".profile=") ?? false;
    if (hasProfile(node)) {
        return node.contextValue;
    }
    const nodeParent = node.getParent();
    if (hasProfile(nodeParent)) {
        const pContext = nodeParent.contextValue.split(".profile=");
        return node.contextValue + ".profile=" + pContext[1].split(".")[0] + ".";
    }
    return node.contextValue;
}

/**
 * Helper function to retrieve the base context of a node
 * @param node
 * @return The inital element of the context.
 */
export function getBaseContext(node: TreeItem): string {
    return node.contextValue.indexOf(globals.CONTEXT_PREFIX) > -1
        ? node.contextValue.substring(0, node.contextValue.indexOf(globals.CONTEXT_PREFIX))
        : node.contextValue;
}

/**
 * Helper function check if a node has validation enabled
 * @param node
 * @return true if validation is enabled, false otherwise
 */
export function isValidationEnabled(node: TreeItem): boolean {
    return new RegExp(globals.VALIDATE_SUFFIX).test(node.contextValue);
}

/**
 * Helper function which identifies if the node is a jobs session
 * @param node
 * @return true if a jobs session, false otherwise
 */
export function isJobsSession(node: TreeItem): boolean {
    return new RegExp("^(" + globals.JOBS_SESSION_CONTEXT + ")").test(node.contextValue);
}

/**
 * Helper function which identifies if the node is part of the USS tree view
 * @param node
 * @return true if part of the USS tree, false otherwise
 */
export function isTypeUssTreeNode(node): node is IZoweUSSTreeNode {
    return (node as IZoweUSSTreeNode).getUSSDocumentFilePath !== undefined;
}
