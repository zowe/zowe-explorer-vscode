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
import { l10n, TextDocument, TreeItemCollapsibleState, workspace } from "vscode";
import { IconGenerator } from "../icons/IconGenerator";
import type { ZoweTreeProvider } from "../trees/ZoweTreeProvider";
import { ZoweLocalStorage } from "../tools/ZoweLocalStorage";
import { ZoweLogger } from "../tools/ZoweLogger";
import { Profiles } from "../configuration/Profiles";
import { SharedUtils } from "../trees/shared/SharedUtils";
import { SharedContext } from "../trees/shared/SharedContext";
import { IconUtils } from "../icons/IconUtils";

export class TreeViewUtils {
    /**
     * Temporary solution to fixing issue with VSCode multi-select bug
     * (where multi-select is still active after deleting the nodes in previous multi-selection)
     * @param treeProvider The tree provider to reset multi-selection for
     */
    public static async fixVsCodeMultiSelect<T>(treeProvider: IZoweTree<T>, nodeToRefresh?: IZoweTreeNode): Promise<void> {
        const treeView = treeProvider.getTreeView();
        await treeView.reveal(nodeToRefresh ?? treeProvider.mFavoriteSession, { select: true });
        await treeView.reveal(nodeToRefresh ?? treeProvider.mFavoriteSession, { select: false });
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

    public static getIconForValidationStatus(node: IZoweTreeNode, status: string): IconUtils.IconId | undefined {
        switch (status) {
            case "unverified":
                return node.collapsibleState !== TreeItemCollapsibleState.Expanded ? IconUtils.IconId.session : IconUtils.IconId.sessionOpen;
            case "active":
                return node.collapsibleState !== TreeItemCollapsibleState.Expanded
                    ? IconUtils.IconId.sessionActive
                    : IconUtils.IconId.sessionActiveOpen;
            case "inactive":
                return IconUtils.IconId.sessionInactive;
            default:
                return;
        }
    }

    /**
     * Updates the icon for the given tree node
     * @param node The node that should have its icon updated
     * @param treeProvider The tree provider that the node belongs to
     * @param newCollapsibleState New collapsible state for the node. The current collapsible state on the node is used if not provided.
     */
    public static updateNodeIcon<T extends IZoweTreeNode>(
        node: T,
        treeProvider: ZoweTreeProvider<T>,
        newCollapsibleState?: TreeItemCollapsibleState
    ): void {
        const newIcon = SharedContext.isSession(node)
            ? IconGenerator.getIconById(
                  TreeViewUtils.getIconForValidationStatus(
                      node,
                      Profiles.getInstance().profilesForValidation.find((p) => p.name === node.label)?.status
                  )
              )
            : IconGenerator.getIconByNode(newCollapsibleState ? { ...node, collapsibleState: newCollapsibleState } : node);
        if (!newIcon) {
            return;
        }
        node.iconPath = newIcon.path;
        treeProvider.mOnDidChangeTreeData.fire(node);
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
                ZoweLogger.error(
                    `TreeViewUtils.errorForUnsavedResource: detected unsaved changes in ${doc.fileName},` +
                        `trying to ${action} node: ${node.label as string}`
                );
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
