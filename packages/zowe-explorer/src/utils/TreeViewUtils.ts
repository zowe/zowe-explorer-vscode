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

import { IZoweNodeType, IZoweTree, IZoweTreeNode } from "@zowe/zowe-explorer-api";
import { ZoweLogger } from "./LoggerUtils";
import { TreeViewExpansionEvent } from "vscode";
import { getIconByNode } from "../generators/icons";
import { ZoweTreeProvider } from "../abstract/ZoweTreeProvider";

export class TreeViewUtils {
    /**
     * Temporary solution to fixing issue with VSCode multi-select bug
     * (where multi-select is still active after deleting the nodes in previous multi-selection)
     * @param treeProvider The tree provider to reset multi-selection for
     */
    public static async fixVsCodeMultiSelect<T>(treeProvider: IZoweTree<T>): Promise<void> {
        const treeView = treeProvider.getTreeView();
        await treeView.reveal(treeProvider.mFavoriteSession, { select: true });
        await treeView.reveal(treeProvider.mFavoriteSession, { select: false });
    }

    /**
     * Expand a node using the given tree provider
     * @param node the node to expand
     * @param provider the tree view provider that this node belongs to
     */
    public static async expandNode(node: IZoweTreeNode, provider: IZoweTree<IZoweNodeType>): Promise<void> {
        ZoweLogger.trace("ZoweTreeProvider.expandNode called.");
        await provider.getTreeView().reveal(node, { expand: true });
    }

    /**
     * Builds an onDidCollapseElement event listener that will refresh node icons depending on the qualifiers given.
     * If at least one node qualifier passes, it will refresh the icon for that node.
     * @param qualifiers an array of boolean functions that take a tree node as a parameter
     * @param treeProvider The tree provider that should update once the icons are changed
     * @returns An event listener built to update the node icons based on the given qualifiers
     */
    public static refreshIconOnCollapse<T extends IZoweTreeNode>(qualifiers: ((node: IZoweTreeNode) => boolean)[], treeProvider: ZoweTreeProvider) {
        return (e: TreeViewExpansionEvent<T>): any => {
            const newIcon = getIconByNode(e.element);
            if (qualifiers.some((q) => q(e.element)) && newIcon) {
                e.element.iconPath = newIcon;
                treeProvider.mOnDidChangeTreeData.fire(e.element);
            }
        };
    }
}
