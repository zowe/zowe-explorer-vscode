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

import * as path from "path";
import { TreeItemCollapsibleState } from "vscode";
import { SharedContext } from "../trees/shared/SharedContext";
import { Constants } from "../configuration/Constants";
import { IconUtils } from "./IconUtils";
/**
 * Zowe Explorer VS Code Extension Icons
 */
export class Icon {
    public static document: IconUtils.IIconItem = {
        id: IconUtils.IconId.document,
        type: IconUtils.IconHierarchyType.base,
        path: Icon.getIconPathInResources("document.svg"),
        check: (node) => SharedContext.isDocument(node),
    };

    public static documentBinary: IconUtils.IIconItem = {
        id: IconUtils.IconId.documentBinary,
        type: IconUtils.IconHierarchyType.base,
        path: Icon.getIconPathInResources("document-binary.svg"),
        check: (node) => SharedContext.isBinary(node),
    };

    public static documentBinaryDownloaded: IconUtils.IIconItem = {
        id: IconUtils.IconId.documentBinaryDownloaded,
        type: IconUtils.IconHierarchyType.derived,
        path: Icon.getIconPathInResources("document-binary-downloaded.svg"),
        check: (node) => {
            const generalizedNode = node as any;
            if (typeof generalizedNode.downloaded !== "undefined") {
                const parentCheck = Icon.documentBinary.check(generalizedNode);
                return parentCheck && (generalizedNode.downloaded as boolean);
            }
            return false;
        },
    };

    public static downloadedDocument: IconUtils.IIconItem = {
        id: IconUtils.IconId.downloadedDocument,
        type: IconUtils.IconHierarchyType.derived,
        path: Icon.getIconPathInResources("document-downloaded.svg"),
        check: (node) => {
            // Here we need to do check for potentially derived class, that's why any is required
            const generalizedNode = node as any;
            if (typeof generalizedNode.downloaded !== "undefined") {
                const parentCheck = Icon.document.check(generalizedNode);
                return parentCheck && (generalizedNode.downloaded as boolean);
            }

            return false;
        },
    };

    public static fileError: IconUtils.IIconItem = {
        id: IconUtils.IconId.fileError,
        type: IconUtils.IconHierarchyType.base,
        path: Icon.getIconPathInResources("fileError.svg"),
        check: (node) => SharedContext.hasFileError(node),
    };

    public static folder: IconUtils.IIconItem = {
        id: IconUtils.IconId.folder,
        type: IconUtils.IconHierarchyType.base,
        path: Icon.getIconPathInResources("folder-closed.svg"),
        check: (node) => SharedContext.isFolder(node),
    };

    public static folderOpen: IconUtils.IIconItem = {
        id: IconUtils.IconId.folderOpen,
        type: IconUtils.IconHierarchyType.derived,
        path: Icon.getIconPathInResources("folder-open.svg"),
        check: (node) => {
            const parentCheck = Icon.folder.check(node);
            return parentCheck && node.collapsibleState === TreeItemCollapsibleState.Expanded;
        },
    };

    public static filterFolder: IconUtils.IIconItem = {
        id: IconUtils.IconId.filterFolder,
        type: IconUtils.IconHierarchyType.base,
        path: Icon.getIconPathInResources("folder-root-filtered-closed.svg"),
        check: (node) => SharedContext.isFilterFolder(node),
    };

    public static filterFolderOpen: IconUtils.IIconItem = {
        id: IconUtils.IconId.filterFolderOpen,
        type: IconUtils.IconHierarchyType.derived,
        path: Icon.getIconPathInResources("folder-root-filtered-open.svg"),
        check: (node) => {
            const parentCheck = Icon.folder.check(node);
            return parentCheck && node.collapsibleState === TreeItemCollapsibleState.Expanded;
        },
    };

    public static home: IconUtils.IIconItem = {
        id: IconUtils.IconId.home,
        type: IconUtils.IconHierarchyType.base,
        path: Icon.getIconPathInResources("home.svg"),
        check: (node) => SharedContext.isGlobalProfile(node),
    };

    public static migrated: IconUtils.IIconItem = {
        id: IconUtils.IconId.migrated,
        type: IconUtils.IconHierarchyType.base,
        path: Icon.getIconPathInResources("migrated.svg"),
        check: (node) => SharedContext.isMigrated(node),
    };

    public static pattern: IconUtils.IIconItem = {
        id: IconUtils.IconId.pattern,
        type: IconUtils.IconHierarchyType.base,
        path: Icon.getIconPathInResources("pattern.svg"),
        check: (node) => SharedContext.isFavoriteSearch(node),
    };

    public static session: IconUtils.IIconItem = {
        id: IconUtils.IconId.session,
        type: IconUtils.IconHierarchyType.base,
        path: Icon.getIconPathInResources("folder-root-unverified-closed.svg"),
        check: (node) => SharedContext.isSessionNotFav(node),
    };

    public static sessionActive: IconUtils.IIconItem = {
        id: IconUtils.IconId.sessionActive,
        type: IconUtils.IconHierarchyType.base,
        path: Icon.getIconPathInResources("folder-root-connected-closed.svg"),
        check: (node) => SharedContext.isSessionActive(node),
    };

    public static sessionActiveOpen: IconUtils.IIconItem = {
        id: IconUtils.IconId.sessionActiveOpen,
        type: IconUtils.IconHierarchyType.derived,
        path: Icon.getIconPathInResources("folder-root-connected-open.svg"),
        check: (node) => {
            const parentCheck = Icon.sessionActive.check(node);
            return parentCheck && node.collapsibleState === TreeItemCollapsibleState.Expanded && node.contextValue.includes(Constants.ACTIVE_CONTEXT);
        },
    };

    public static sessionFavorite: IconUtils.IIconItem = {
        id: IconUtils.IconId.sessionFavourite,
        type: IconUtils.IconHierarchyType.base,
        path: Icon.getIconPathInResources("folder-root-favorite-star-closed.svg"),
        check: (node) => SharedContext.isSessionFavorite(node),
    };

    public static sessionFavoriteOpen: IconUtils.IIconItem = {
        id: IconUtils.IconId.sessionFavouriteOpen,
        type: IconUtils.IconHierarchyType.derived,
        path: Icon.getIconPathInResources("folder-root-favorite-star-open.svg"),
        check: (node) => {
            const parentCheck = Icon.sessionFavorite.check(node);
            return parentCheck && node.collapsibleState === TreeItemCollapsibleState.Expanded;
        },
    };

    public static sessionInactive: IconUtils.IIconItem = {
        id: IconUtils.IconId.sessionInactive,
        type: IconUtils.IconHierarchyType.base,
        path: Icon.getIconPathInResources("folder-root-disconnected-closed.svg"),
        check: (node) => SharedContext.isSessionInactive(node),
    };

    public static sessionOpen: IconUtils.IIconItem = {
        id: IconUtils.IconId.sessionOpen,
        type: IconUtils.IconHierarchyType.derived,
        path: Icon.getIconPathInResources("folder-root-unverified-open.svg"),
        check: (node) => {
            const parentCheck = Icon.session.check(node);
            return (
                parentCheck && node.collapsibleState === TreeItemCollapsibleState.Expanded && node.contextValue.includes(Constants.UNVERIFIED_CONTEXT)
            );
        },
    };

    public static vsam: IconUtils.IIconItem = {
        id: IconUtils.IconId.vsam,
        type: IconUtils.IconHierarchyType.base,
        path: Icon.getIconPathInResources("file_type_db.svg"),
        check: (node) => SharedContext.isVsam(node),
    };

    /**
     * Retrieve array with all available icons for extension
     * @returns array of all available icons
     */
    public static getIcons(): IconUtils.IIconItem[] {
        return [
            Icon.document,
            Icon.documentBinary,
            Icon.documentBinaryDownloaded,
            Icon.downloadedDocument,
            Icon.fileError,
            Icon.filterFolder,
            Icon.filterFolderOpen,
            Icon.folder,
            Icon.folderOpen,
            Icon.home,
            Icon.migrated,
            Icon.pattern,
            Icon.session,
            Icon.sessionActive,
            Icon.sessionActiveOpen,
            Icon.sessionFavorite,
            Icon.sessionFavoriteOpen,
            Icon.sessionInactive,
            Icon.sessionOpen,
            Icon.vsam,
        ];
    }

    /**
     * Gets path to the icon, which is located in resources folder
     * @param iconFileName {string} Name of icon file with extension
     * @returns {object} Object containing path to light and dark version of icon
     */
    public static getIconPathInResources(iconFileName: string): {
        light: string;
        dark: string;
    } {
        return {
            light: path.join(Constants.ROOTPATH, "resources", "light", iconFileName),
            dark: path.join(Constants.ROOTPATH, "resources", "dark", iconFileName),
        };
    }
}
