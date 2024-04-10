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
import { IconGenerator } from "../icons";
import { SharedContext } from "../trees/shared";
import { Constants } from "../configuration";

/**
 * Zowe Explorer VS Code Extension Icons
 */
export class Icon {
    public static document: IconGenerator.IIconItem = {
        id: IconGenerator.IconId.document,
        type: IconGenerator.IconHierarchyType.base,
        path: Icon.getIconPathInResources("document.svg"),
        check: (node) => SharedContext.isDocument(node),
    };

    public static documentBinary: IconGenerator.IIconItem = {
        id: IconGenerator.IconId.documentBinary,
        type: IconGenerator.IconHierarchyType.base,
        path: Icon.getIconPathInResources("document-binary.svg"),
        check: (node) => SharedContext.isBinary(node),
    };

    public static documentBinaryDownloaded: IconGenerator.IIconItem = {
        id: IconGenerator.IconId.documentBinaryDownloaded,
        type: IconGenerator.IconHierarchyType.derived,
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

    public static downloadedDocument: IconGenerator.IIconItem = {
        id: IconGenerator.IconId.downloadedDocument,
        type: IconGenerator.IconHierarchyType.derived,
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

    public static fileError: IconGenerator.IIconItem = {
        id: IconGenerator.IconId.fileError,
        type: IconGenerator.IconHierarchyType.base,
        path: Icon.getIconPathInResources("fileError.svg"),
        check: (node) => SharedContext.hasFileError(node),
    };

    public static folder: IconGenerator.IIconItem = {
        id: IconGenerator.IconId.folder,
        type: IconGenerator.IconHierarchyType.base,
        path: Icon.getIconPathInResources("folder-closed.svg"),
        check: (node) => SharedContext.isFolder(node),
    };

    public static folderOpen: IconGenerator.IIconItem = {
        id: IconGenerator.IconId.folderOpen,
        type: IconGenerator.IconHierarchyType.derived,
        path: Icon.getIconPathInResources("folder-open.svg"),
        check: (node) => {
            const parentCheck = Icon.folder.check(node);
            return parentCheck && node.collapsibleState === TreeItemCollapsibleState.Expanded;
        },
    };

    public static filterFolder: IconGenerator.IIconItem = {
        id: IconGenerator.IconId.filterFolder,
        type: IconGenerator.IconHierarchyType.base,
        path: Icon.getIconPathInResources("folder-root-filtered-closed.svg"),
        check: (node) => SharedContext.isFilterFolder(node),
    };

    public static filterFolderOpen: IconGenerator.IIconItem = {
        id: IconGenerator.IconId.filterFolderOpen,
        type: IconGenerator.IconHierarchyType.derived,
        path: Icon.getIconPathInResources("folder-root-filtered-open.svg"),
        check: (node) => {
            const parentCheck = Icon.folder.check(node);
            return parentCheck && node.collapsibleState === TreeItemCollapsibleState.Expanded;
        },
    };

    public static home: IconGenerator.IIconItem = {
        id: IconGenerator.IconId.home,
        type: IconGenerator.IconHierarchyType.base,
        path: Icon.getIconPathInResources("home.svg"),
        check: (node) => SharedContext.isHomeProfile(node),
    };

    public static migrated: IconGenerator.IIconItem = {
        id: IconGenerator.IconId.migrated,
        type: IconGenerator.IconHierarchyType.base,
        path: Icon.getIconPathInResources("migrated.svg"),
        check: (node) => SharedContext.isMigrated(node),
    };

    public static pattern: IconGenerator.IIconItem = {
        id: IconGenerator.IconId.pattern,
        type: IconGenerator.IconHierarchyType.base,
        path: Icon.getIconPathInResources("pattern.svg"),
        check: (node) => SharedContext.isFavoriteSearch(node),
    };

    public static session: IconGenerator.IIconItem = {
        id: IconGenerator.IconId.session,
        type: IconGenerator.IconHierarchyType.base,
        path: Icon.getIconPathInResources("folder-root-unverified-closed.svg"),
        check: (node) => SharedContext.isSessionNotFav(node),
    };

    public static sessionActive: IconGenerator.IIconItem = {
        id: IconGenerator.IconId.sessionActive,
        type: IconGenerator.IconHierarchyType.base,
        path: Icon.getIconPathInResources("folder-root-connected-closed.svg"),
        check: (node) => SharedContext.isSessionActive(node),
    };

    public static sessionActiveOpen: IconGenerator.IIconItem = {
        id: IconGenerator.IconId.sessionActiveOpen,
        type: IconGenerator.IconHierarchyType.derived,
        path: Icon.getIconPathInResources("folder-root-connected-open.svg"),
        check: (node) => {
            const parentCheck = Icon.sessionActive.check(node);
            return parentCheck && node.collapsibleState === TreeItemCollapsibleState.Expanded && node.contextValue.includes(Constants.ACTIVE_CONTEXT);
        },
    };

    public static sessionFavorite: IconGenerator.IIconItem = {
        id: IconGenerator.IconId.sessionFavourite,
        type: IconGenerator.IconHierarchyType.base,
        path: Icon.getIconPathInResources("folder-root-favorite-star-closed.svg"),
        check: (node) => SharedContext.isSessionFavorite(node),
    };

    public static sessionFavoriteOpen: IconGenerator.IIconItem = {
        id: IconGenerator.IconId.sessionFavouriteOpen,
        type: IconGenerator.IconHierarchyType.derived,
        path: Icon.getIconPathInResources("folder-root-favorite-star-open.svg"),
        check: (node) => {
            const parentCheck = Icon.sessionFavorite.check(node);
            return parentCheck && node.collapsibleState === TreeItemCollapsibleState.Expanded;
        },
    };

    public static sessionInactive: IconGenerator.IIconItem = {
        id: IconGenerator.IconId.sessionInactive,
        type: IconGenerator.IconHierarchyType.base,
        path: Icon.getIconPathInResources("folder-root-disconnected-closed.svg"),
        check: (node) => SharedContext.isSessionInactive(node),
    };

    public static sessionOpen: IconGenerator.IIconItem = {
        id: IconGenerator.IconId.sessionOpen,
        type: IconGenerator.IconHierarchyType.derived,
        path: Icon.getIconPathInResources("folder-root-unverified-open.svg"),
        check: (node) => {
            const parentCheck = Icon.session.check(node);
            return (
                parentCheck && node.collapsibleState === TreeItemCollapsibleState.Expanded && node.contextValue.includes(Constants.UNVERIFIED_CONTEXT)
            );
        },
    };

    public static vsam: IconGenerator.IIconItem = {
        id: IconGenerator.IconId.vsam,
        type: IconGenerator.IconHierarchyType.base,
        path: Icon.getIconPathInResources("file_type_db.svg"),
        check: (node) => SharedContext.isVsam(node),
    };

    /**
     * Retrieve array with all available icons for extension
     * @returns array of all available icons
     */
    public static getIcons(): IconGenerator.IIconItem[] {
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
