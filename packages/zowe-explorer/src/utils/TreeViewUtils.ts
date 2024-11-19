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

import { Types, IZoweTree, IZoweTreeNode, PersistenceSchemaEnum, Gui } from "@zowe/zowe-explorer-api";
import { l10n, TextDocument, TreeViewExpansionEvent, workspace } from "vscode";
import { IconGenerator } from "../icons/IconGenerator";
import type { ZoweTreeProvider } from "../trees/ZoweTreeProvider";
import { ZoweLocalStorage } from "../tools/ZoweLocalStorage";
import { ZoweLogger } from "../tools/ZoweLogger";
import { Profiles } from "../configuration/Profiles";
import { SharedUtils } from "../trees/shared/SharedUtils";
import { SharedContext } from "../trees/shared/SharedContext";

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
    public static async expandNode(node: IZoweTreeNode, provider: IZoweTree<Types.IZoweNodeType>): Promise<void> {
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
    public static refreshIconOnCollapse<T extends IZoweTreeNode>(
        qualifiers: ((node: IZoweTreeNode) => boolean)[],
        treeProvider: ZoweTreeProvider<T>
    ): (e: TreeViewExpansionEvent<T>) => any {
        return (e: TreeViewExpansionEvent<T>): any => {
            const newIcon = IconGenerator.getIconByNode(e.element);
            if (qualifiers.some((q) => q(e.element)) && newIcon) {
                e.element.iconPath = newIcon;
                treeProvider.mOnDidChangeTreeData.fire(e.element);
            }
        };
    }

    public static async removeSession(treeProvider: IZoweTree<IZoweTreeNode>, profileName: string): Promise<void> {
        ZoweLogger.trace("SessionUtils.removeSession called.");
        const treeType = treeProvider.getTreeType();
        if (treeType !== PersistenceSchemaEnum.Job) {
            // Delete from file history
            const fileHistory: string[] = treeProvider.getFileHistory();
            fileHistory
                .slice()
                .reverse()
                .filter((item) => item.substring(1, item.indexOf("]")).trim() === profileName.toUpperCase())
                .forEach((file) => {
                    treeProvider.removeFileHistory(file);
                });
        }
        // Delete from Favorites
        await treeProvider.removeFavProfile(profileName, false);
        // Delete from Tree
        treeProvider.mSessionNodes.forEach((sessNode) => {
            if (sessNode.getProfileName() === profileName) {
                treeProvider.deleteSession(sessNode);
                sessNode.dirty = true;
                treeProvider.refresh();
            }
        });
        // Delete from Sessions list
        const setting: any = ZoweLocalStorage.getValue(treeType);
        let sess: string[] = setting.sessions;
        let fave: string[] = setting.favorites;
        sess = sess?.filter((value) => {
            return value.trim() !== profileName;
        });
        fave = fave?.filter((element) => {
            return element.substring(1, element.indexOf("]")).trim() !== profileName;
        });
        setting.sessions = sess;
        setting.favorites = fave;
        ZoweLocalStorage.setValue(treeType, setting);
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
     * Prompts the user when a file/data set is unsaved in the editor.
     * @param node The USS file or data set to check for in the editor. Also checks child paths for the node (for PDS members and inner USS files).
     * @returns Whether a child or the resource itself is open with unsaved changes in the editor
     */
    public static async errorForUnsavedResource(node: IZoweTreeNode, action = l10n.t("rename")): Promise<boolean> {
        const currentFilePath = node.resourceUri.fsPath; // The user's complete local file path for the node
        await Profiles.getInstance().checkCurrentProfile(node.getProfile());
        const openedTextDocuments: readonly TextDocument[] = workspace.textDocuments; // Array of all documents open in VS Code

        const isUss = SharedContext.isUssNode(node);
        let nodeType: string;
        if (isUss) {
            nodeType = SharedContext.isUssDirectory(node) ? "directory" : "file";
        } else {
            nodeType = "data set";
        }

        for (const doc of openedTextDocuments) {
            if ((doc.fileName === currentFilePath || SharedUtils.checkIfChildPath(currentFilePath, doc.fileName)) && doc.isDirty) {
                Gui.errorMessage(
                    l10n.t({
                        message: "Unable to {0} {1} because you have unsaved changes in this {2}. " + "Please save your work and try again.",
                        args: [action, node.label, nodeType],
                        comment: ["User action", "Node path", "Node type (directory, file or data set)"],
                    }),
                    { vsCodeOpts: { modal: true } }
                );
                return true;
            }
        }

        return false;
    }
}
