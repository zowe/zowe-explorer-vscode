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

import { TreeItem } from "vscode";
import { imperative, IZoweTreeNode, IZoweUSSTreeNode } from "@zowe/zowe-explorer-api";
import { Constants } from "../../configuration/Constants";

export class SharedContext {
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

    public static getSessionType(node: TreeItem): string {
        if (SharedContext.isDsSession(node)) {
            return "ds";
        }
        if (SharedContext.isUssSession(node)) {
            return "uss";
        }
        if (SharedContext.isJobsSession(node)) {
            return "jobs";
        }

        throw new imperative.ImperativeError({ msg: "Session node passed in does not have a type" });
    }

    /**
     * Helper function which identifies if the node is a ds
     * @param node
     * @return true if a ds, false otherwise
     */
    public static isDs(node: TreeItem): boolean {
        return new RegExp("^" + Constants.DS_DS_CONTEXT).test(node.contextValue);
    }

    /**
     * Helper function which identifies if the node is a job
     * @param node
     * @return true if a job, false otherwise
     */
    public static isJob(node: TreeItem): boolean {
        return new RegExp("^" + Constants.JOBS_JOB_CONTEXT).test(node.contextValue);
    }

    /**
     * Helper function which identifies if the node is a pds or ds and a favorite
     * @param node
     * @return true if a favorite pds, ds, false otherwise
     */
    public static isFavoritePsDs(node: TreeItem): boolean {
        return new RegExp("^(" + Constants.DS_PDS_CONTEXT + "|" + Constants.DS_DS_CONTEXT + ")(.*" + Constants.FAV_SUFFIX + ")").test(
            node.contextValue
        );
    }

    /**
     * Helper function which identifies if the node is a ds and a favorite
     * @param node
     * @return true if a favorite ds, false otherwise
     */
    public static isFavoriteDs(node: TreeItem): boolean {
        return new RegExp("^(" + Constants.DS_DS_CONTEXT + ")(.*" + Constants.FAV_SUFFIX + ")").test(node.contextValue);
    }

    /**
     * Helper function which identifies if the node is a job and it's a favorite
     * @param node
     * @return true if a favorite job, false otherwise
     */
    public static isFavoriteJob(node: TreeItem): boolean {
        return new RegExp("^(" + Constants.JOBS_JOB_CONTEXT + ")(.*" + Constants.FAV_SUFFIX + ")").test(node.contextValue);
    }

    /**
     * Helper function which identifies if the node is a pds and a favorite
     * @param node
     * @return true if a favorite pds, false otherwise
     */
    public static isFavoritePds(node: TreeItem): boolean {
        return new RegExp("^(" + Constants.DS_PDS_CONTEXT + ")(.*" + Constants.FAV_SUFFIX + ")").test(node.contextValue);
    }

    /**
     * Helper function which identifies if the node is a Favorite binary or text file
     * @param node
     * @return true if a Favorite binary or text file, false otherwise
     */
    public static isFavoriteTextOrBinary(node: TreeItem): boolean {
        return new RegExp(
            "^(" + Constants.USS_BINARY_FILE_CONTEXT + "|" + Constants.USS_TEXT_FILE_CONTEXT + ")(.*" + Constants.FAV_SUFFIX + ")"
        ).test(node.contextValue);
    }

    /**
     * Helper function which identifies if the node is a binary file
     * @param node
     * @return true if a binary file, false otherwise
     */
    public static isBinary(node: TreeItem): boolean {
        return new RegExp(
            "^(" + Constants.USS_BINARY_FILE_CONTEXT + "|" + Constants.DS_DS_BINARY_CONTEXT + "|" + Constants.DS_MEMBER_BINARY_CONTEXT + ")"
        ).test(node.contextValue);
    }

    /**
     * Helper function which identifies if the node is a text file
     * @param node
     * @return true if a text file, false otherwise
     */
    public static isText(node: TreeItem): boolean {
        return new RegExp("^" + Constants.USS_TEXT_FILE_CONTEXT).test(node.contextValue);
    }

    /**
     * Helper function which identifies if the node is a document
     * @param node
     * @return true if a document, false otherwise
     */
    public static isDocument(node: TreeItem): boolean {
        return new RegExp(
            "^(" +
                Constants.DS_DS_CONTEXT +
                "|" +
                Constants.DS_MEMBER_CONTEXT +
                "|" +
                Constants.USS_TEXT_FILE_CONTEXT +
                "|" +
                Constants.JOBS_SPOOL_CONTEXT +
                "|" +
                Constants.DS_MIGRATED_FILE_CONTEXT +
                "|" +
                Constants.DS_FILE_ERROR_CONTEXT +
                ")"
        ).test(node.contextValue);
    }

    /**
     * Helper function which identifies if the node has polling enabled
     * @param node
     * @returns true if the node has polling enabled, false otherwise
     */
    public static isPolling(node: TreeItem): boolean {
        return new RegExp(Constants.POLL_CONTEXT).test(node.contextValue);
    }

    /**
     * Helper function which identifies if the node is a spool file
     * @param node
     * @returns true if a spool file, false otherwise
     */
    public static isSpoolFile(node: TreeItem): boolean {
        return new RegExp("^(" + Constants.JOBS_SPOOL_CONTEXT + ")").test(node.contextValue);
    }

    /**
     * Helper function which identifies if the node is a informational only
     * @param node
     * @return true if a informational, false otherwise
     */
    public static isInformation(node: TreeItem): boolean {
        return new RegExp("^(" + Constants.INFORMATION_CONTEXT + ")").test(node.contextValue);
    }

    /**
     * Helper function which identifies if the node is migrated
     * @param node
     * @return true if a migrated dataset, false otherwise
     */
    public static isMigrated(node: TreeItem): boolean {
        return new RegExp("^(" + Constants.DS_MIGRATED_FILE_CONTEXT + ")").test(node.contextValue);
    }

    /**
     * Helper function which identifies if the node has an error
     * @param node
     * @return true if there was an error obtaining information about this dataset, false otherwise
     */
    public static hasFileError(node: TreeItem): boolean {
        return new RegExp("^(" + Constants.DS_FILE_ERROR_CONTEXT + ")").test(node.contextValue);
    }

    /**
     * Helper function which identifies if the node is a favorite
     * @param node
     * @return true if a favorite, false otherwise
     */
    public static isFavorite(node: TreeItem): boolean {
        return new RegExp(Constants.FAV_SUFFIX).test(node.contextValue);
    }

    /**
     * Helper function which identifies if the node is a favorited profile
     * @param node
     * @return true if a favorited profile, false otherwise
     */
    public static isFavProfile(node: TreeItem): boolean {
        return new RegExp(Constants.FAV_PROFILE_CONTEXT).test(node.contextValue);
    }

    /**
     * Helper function which identifies if the node is a favorite root
     * or search
     * @param node
     * @return true if a favorite root, false otherwise
     */
    public static isFavoriteSearch(node: TreeItem): boolean {
        return new RegExp(
            "^(" +
                Constants.JOBS_SESSION_CONTEXT +
                "|" +
                Constants.USS_SESSION_CONTEXT +
                "|" +
                Constants.DS_SESSION_CONTEXT +
                ")(.*" +
                Constants.FAV_SUFFIX +
                ")"
        ).test(node.contextValue);
    }

    /**
     * Helper function which identifies if the node is a favorite context
     * @param node
     * @return true if a favorite context root, false otherwise
     */
    public static isFavoriteContext(node: TreeItem): boolean {
        return new RegExp(Constants.FAVORITE_CONTEXT).test(node.contextValue);
    }

    /**
     * Helper function to determine if the profile node is located in the global layer.
     * @param node
     * @returns true if profile is located in the global layer, false otherwise
     */
    public static isGlobalProfile(node: TreeItem): boolean {
        return new RegExp(Constants.HOME_SUFFIX).test(node.contextValue);
    }

    /**
     * Helper function which identifies if the node is a dataset member
     * @param node
     * @return true if a dataset member, false otherwise
     */
    public static isDsMember(node: TreeItem): boolean {
        return new RegExp("^(" + Constants.DS_MEMBER_CONTEXT + ")").test(node.contextValue);
    }

    /**
     * Helper function which identifies if the node is a dataset session
     * @param node
     * @return true if a dataset session, false otherwise
     */
    public static isDsSession(node: TreeItem): boolean {
        return new RegExp("^(" + Constants.DS_SESSION_CONTEXT + ")").test(node.contextValue);
    }

    /**
     * Helper function which identifies if the node is a partitioned, unfavorited dataset
     * @param node
     * @return true if a partitioned and unfavorited dataset, false otherwise
     */
    public static isPdsNotFav(node: TreeItem): boolean {
        return new RegExp("^(?!.*" + Constants.FAV_SUFFIX + ")" + Constants.DS_PDS_CONTEXT).test(node.contextValue);
    }

    /**
     * Helper function which identifies if the node is a partitioned dataset
     * @param node
     * @return true if a partitioned dataset, false otherwise
     */
    public static isPds(node: TreeItem): boolean {
        return new RegExp("^(" + Constants.DS_PDS_CONTEXT + ")").test(node.contextValue);
    }

    /**
     * Helper function which identifies if the node is a USS Directory
     * @param node
     * @return true if a USS Directory, false otherwise
     */
    public static isUssDirectory(node: TreeItem): boolean {
        return new RegExp("^" + Constants.USS_DIR_CONTEXT).test(node.contextValue);
    }

    /**
     * Helper function which identifies if the node is a USS session
     * @param node
     * @return true if a USS session, false otherwise
     */
    public static isUssSession(node: TreeItem): boolean {
        return new RegExp("^(" + Constants.USS_SESSION_CONTEXT + ")").test(node.contextValue);
    }

    /**
     * Helper function which identifies if the node is a grouping or folder
     * @param node
     * @return true if a folder, false otherwise
     */
    public static isFolder(node: TreeItem): boolean {
        return new RegExp("^(" + Constants.JOBS_JOB_CONTEXT + "|" + Constants.USS_DIR_CONTEXT + "|" + Constants.DS_PDS_CONTEXT + ")").test(
            node.contextValue
        );
    }

    /**
     * Helper function which identifies if the node is a grouping or folder of a filter search
     * @param node
     * @return true if a folder with a filter search, false otherwise
     */
    public static isFilterFolder(node: TreeItem): boolean {
        return new RegExp("^(" + Constants.DS_PDS_CONTEXT + ")(" + Constants.FILTER_SEARCH + ")").test(node.contextValue);
    }

    /**
     * Helper function which identifies if the node is a session
     * @param node
     * @return true if a session, false otherwise
     */
    public static isSession(node: TreeItem): boolean {
        return new RegExp(
            "^(" + Constants.JOBS_SESSION_CONTEXT + "|" + Constants.USS_SESSION_CONTEXT + "|" + Constants.DS_SESSION_CONTEXT + ")"
        ).test(node.contextValue);
    }

    /**
     * Helper function which identifies if the node is a session but not a favorite
     * @param node
     * @return true if a session, false otherwise
     */
    public static isSessionInactive(node: TreeItem): boolean {
        return new RegExp(
            "^(" +
                Constants.JOBS_SESSION_CONTEXT +
                "|" +
                Constants.USS_SESSION_CONTEXT +
                "|" +
                Constants.DS_SESSION_CONTEXT +
                ")(.*" +
                Constants.INACTIVE_CONTEXT +
                ")"
        ).test(node.contextValue);
    }

    /**
     * Helper function which identifies if the node is a session but not a favorite
     * @param node
     * @return true if a session, false otherwise
     */
    public static isSessionActive(node: TreeItem): boolean {
        return new RegExp(
            "^(" +
                Constants.JOBS_SESSION_CONTEXT +
                "|" +
                Constants.USS_SESSION_CONTEXT +
                "|" +
                Constants.DS_SESSION_CONTEXT +
                ")(.*" +
                Constants.ACTIVE_CONTEXT +
                ")"
        ).test(node.contextValue);
    }
    /**
     * Helper function which identifies if the node is a session but not a favorite
     * @param node
     * @return true if a session, false otherwise
     */
    public static isSessionNotFav(node: TreeItem): boolean {
        return new RegExp(
            "^((?!.*" +
                Constants.FAV_SUFFIX +
                ")(" +
                Constants.JOBS_SESSION_CONTEXT +
                "|" +
                Constants.USS_SESSION_CONTEXT +
                "|" +
                Constants.DS_SESSION_CONTEXT +
                "))"
        ).test(node.contextValue);
    }

    /**
     * Helper function which identifies if the node is a session favorite
     * @param node
     * @return true if a session favorite, false otherwise
     */
    public static isSessionFavorite(node: TreeItem): boolean {
        return new RegExp("^(" + Constants.FAVORITE_CONTEXT + ")").test(node.contextValue);
    }

    /**
     * Helper function to determine if node is located anywhere in a Favorites section (including as a child, grandchild, etc).
     * @param node
     * @returns true if node is located in Favorites, false otherwise
     */
    public static isFavoriteDescendant(node: IZoweTreeNode): boolean {
        return SharedContext.isFavorite(node.getSessionNode());
    }

    /**
     * Helper function which identifies if the node is Vsam
     * @param node
     * @return true if a vsam file, false otherwise
     */
    public static isVsam(node: TreeItem): boolean {
        return new RegExp("^(" + Constants.VSAM_CONTEXT + ")").test(node.contextValue);
    }

    /**
     * Helper function create the favorite version of a node
     * @param node
     * @return If not a favorite an extended contextValue with _fav.
     * If the value is a favorite already that contextValue is returned.
     */
    public static asFavorite(node: TreeItem): string {
        return SharedContext.isFavorite(node) ? node.contextValue : node.contextValue + Constants.FAV_SUFFIX;
    }

    public static withProfile(node: IZoweTreeNode): string {
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
    public static getBaseContext(node: TreeItem): string {
        return node.contextValue.indexOf(Constants.CONTEXT_PREFIX) > -1
            ? node.contextValue.substring(0, node.contextValue.indexOf(Constants.CONTEXT_PREFIX))
            : node.contextValue;
    }

    /**
     * Helper function check if a node has validation enabled
     * @param node
     * @return true if validation is enabled, false otherwise
     */
    public static isValidationEnabled(node: TreeItem): boolean {
        return new RegExp(Constants.VALIDATE_SUFFIX).test(node.contextValue);
    }

    /**
     * Helper function which identifies if the node is a jobs session
     * @param node
     * @return true if a jobs session, false otherwise
     */
    public static isJobsSession(node: TreeItem): boolean {
        return new RegExp("^(" + Constants.JOBS_SESSION_CONTEXT + ")").test(node.contextValue);
    }

    /**
     * Helper function which identifies if the node is part of the USS tree view
     * @param node
     * @return true if part of the USS tree, false otherwise
     */
    public static isTypeUssTreeNode(node): node is IZoweUSSTreeNode {
        return (node as IZoweUSSTreeNode).getUSSDocumentFilePath !== undefined;
    }
}
