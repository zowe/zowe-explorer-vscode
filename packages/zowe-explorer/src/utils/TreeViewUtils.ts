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

import { Gui, IZoweDatasetTreeNode, IZoweNodeType, IZoweTree, IZoweTreeNode, IZoweUSSTreeNode } from "@zowe/zowe-explorer-api";
import { ZoweLogger } from "./LoggerUtils";
import { TextDocument, TreeViewExpansionEvent, workspace } from "vscode";
import { getIconByNode } from "../generators/icons";
import { ZoweTreeProvider } from "../abstract/ZoweTreeProvider";
import { Profiles } from "../Profiles";
import { checkIfChildPath, isZoweDatasetTreeNode } from "../shared/utils";
import * as path from "path";

import * as nls from "vscode-nls";
import { isUssDirectory } from "../shared/context";
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

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

    public static async addDefaultSession(treeProvider: IZoweTree<IZoweTreeNode>, profileType: string): Promise<void> {
        if (treeProvider.mSessionNodes.length === 1) {
            try {
                await treeProvider.addSingleSession(Profiles.getInstance().getDefaultProfile(profileType));
            } catch (error) {
                ZoweLogger.warn(error);
            }
        }
    }

    /**
     * Shows a modal error message to the user when a file/data set is detected as unsaved in the editor.
     * @param node The USS file or data set to check for in the editor. Also checks child paths for the node (for PDS members and inner USS files).
     * @returns Whether a child or the resource itself is open with unsaved changes in the editor
     */
    public static async errorForUnsavedResource(
        node: IZoweDatasetTreeNode | IZoweUSSTreeNode,
        action: string = localize("uss.renameNode", "Rename").toLocaleLowerCase()
    ): Promise<boolean> {
        const isDataset = isZoweDatasetTreeNode(node);
        // The user's complete local file path for the node
        const currentFilePath = isDataset ? node.getDsDocumentFilePath() : node.getUSSDocumentFilePath();
        await Profiles.getInstance().checkCurrentProfile(node.getProfile());
        const openedTextDocuments: readonly TextDocument[] = workspace.textDocuments; // Array of all documents open in VS Code

        let nodeType: string;
        if (isDataset) {
            nodeType = "data set";
        } else {
            nodeType = isUssDirectory(node) ? "directory" : "file";
        }

        for (const doc of openedTextDocuments) {
            if (
                (doc.fileName === currentFilePath ||
                    // check for USS child paths
                    checkIfChildPath(currentFilePath, doc.fileName) ||
                    // check if doc is a PDS member - basename starts with `${PDS name}(`
                    (path.dirname(doc.fileName) === path.dirname(currentFilePath) &&
                        path.basename(doc.fileName).startsWith(`${node.label as string}(`))) &&
                doc.isDirty
            ) {
                ZoweLogger.error(
                    `TreeViewUtils.errorForUnsavedResource: detected unsaved changes in ${doc.fileName},` +
                        `trying to ${action} node: ${node.label as string}`
                );
                Gui.errorMessage(
                    localize(
                        "unsavedChanges.errorMsg",
                        "Unable to {0} {1} because you have unsaved changes in this {2}. Please save your work and try again.",
                        action,
                        node.label as string,
                        nodeType
                    ),
                    { vsCodeOpts: { modal: true } }
                );
                return true;
            }
        }

        return false;
    }
}
