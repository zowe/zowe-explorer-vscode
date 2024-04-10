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

import * as vscode from "vscode";
import { Gui, IZoweDatasetTreeNode, IZoweTree, IZoweTreeNode, IZoweUSSTreeNode, Types, imperative } from "@zowe/zowe-explorer-api";
import { Profiles, Workspace, Constants } from "../../configuration";
import { SharedUtils, SharedContext } from "../shared";
import { FilterItem, FilterDescriptor, ProfilesUtils, TreeViewUtils } from "../../utils";
import { IconGenerator } from "../../icons";
import { ZoweLogger } from "../../tools";
import { LocalFileManagement } from "../../management";
import { ZoweExplorerApiRegister } from "../../extending";

export class SharedActions {
    /**
     * Search for matching items loaded in data set or USS tree
     *
     */
    public static async searchInAllLoadedItems(
        datasetProvider?: Types.IZoweDatasetTreeType,
        ussFileProvider?: Types.IZoweUSSTreeType
    ): Promise<void> {
        ZoweLogger.trace("shared.actions.searchInAllLoadedItems called.");
        let pattern: string;
        const items: Types.IZoweNodeType[] = [];
        const qpItems = [];
        const quickpick = Gui.createQuickPick();
        quickpick.placeholder = vscode.l10n.t("Enter a filter");
        quickpick.ignoreFocusOut = true;
        quickpick.onDidChangeValue((value) => {
            if (value) {
                quickpick.items = SharedUtils.filterTreeByString(value, qpItems);
            } else {
                quickpick.items = [...qpItems];
            }
        });

        // Get loaded items from Tree Providers
        if (datasetProvider) {
            const newItems = await datasetProvider.getAllLoadedItems();
            items.push(...newItems);
        }
        if (ussFileProvider) {
            const newItems = await ussFileProvider.getAllLoadedItems();
            items.push(...newItems);
        }

        if (items.length === 0) {
            Gui.showMessage(vscode.l10n.t("No items are loaded in the tree."));
            return;
        }

        let qpItem: vscode.QuickPickItem;
        for (const item of items) {
            if (SharedContext.isDs(item) || SharedContext.isPdsNotFav(item) || SharedContext.isVsam(item)) {
                if (SharedContext.isDsMember(item)) {
                    qpItem = new FilterItem({
                        text: `[${item.getSessionNode().label.toString()}]: ${item.getParent().label.toString()}(${item.label.toString()})`,
                        description: "Data Set Member",
                    });
                } else {
                    qpItem = new FilterItem({
                        text: `[${item.getSessionNode().label.toString()}]: ${item.label.toString()}`,
                        description: "Data Set",
                    });
                }
                qpItems.push(qpItem);
            } else if (SharedContext.isUssDirectory(item) || SharedContext.isText(item) || SharedContext.isBinary(item)) {
                const filterItem = `[${item.getProfileName().trim()}]: ${item.getParent().fullPath}/${item.label.toString()}`;
                qpItem = new FilterItem({ text: filterItem, description: "USS" });
                qpItems.push(qpItem);
            }
        }
        quickpick.items = [...qpItems];

        quickpick.show();
        const choice = await Gui.resolveQuickPick(quickpick);
        if (!choice) {
            Gui.showMessage(vscode.l10n.t("You must enter a pattern."));
            return;
        } else {
            pattern = choice.label;
        }
        quickpick.dispose();

        if (pattern) {
            // Parse pattern for item name
            let filePath: string;
            let nodeName: string;
            let memberName: string;
            const sessionName = pattern.substring(1, pattern.indexOf("]"));
            if (pattern.indexOf("(") !== -1) {
                nodeName = pattern.substring(pattern.indexOf(" ") + 1, pattern.indexOf("("));
                memberName = pattern.substring(pattern.indexOf("(") + 1, pattern.indexOf(")"));
            } else if (pattern.indexOf("/") !== -1) {
                filePath = pattern.substring(pattern.indexOf(" ") + 1);
            } else {
                nodeName = pattern.substring(pattern.indexOf(" ") + 1);
            }

            // Find & reveal nodes in tree
            if (pattern.indexOf("/") !== -1) {
                // USS nodes
                const node = items.filter((item) => item.fullPath.trim() === filePath)[0];
                ussFileProvider.setItem(ussFileProvider.getTreeView(), node);

                if (node.contextValue !== Constants.USS_DIR_CONTEXT) {
                    // If selected item is file, open it in workspace
                    ussFileProvider.addSearchHistory(node.fullPath);
                    const ussNode: IZoweUSSTreeNode = node;
                    await ussNode.openUSS(false, true, ussFileProvider);
                }
            } else {
                // Data set nodes
                const sessions = await datasetProvider.getChildren();
                const sessionNode = sessions.filter((session) => session.label.toString() === sessionName)[0];
                let children = await datasetProvider.getChildren(sessionNode);
                const node = children.filter((child) => child.label.toString() === nodeName)[0];

                if (memberName) {
                    // Members
                    children = await datasetProvider.getChildren(node);
                    const member = children.filter((child) => child.label.toString() === memberName)[0];
                    node.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
                    await datasetProvider.getTreeView().reveal(member, { select: true, focus: true, expand: false });

                    // Open in workspace
                    datasetProvider.addSearchHistory(`${nodeName}(${memberName})`);
                    await member.openDs(false, true, datasetProvider);
                } else {
                    // PDS & SDS
                    await datasetProvider.getTreeView().reveal(node, { select: true, focus: true, expand: false });

                    // If selected node was SDS, open it in workspace
                    if (SharedContext.isDs(node)) {
                        datasetProvider.addSearchHistory(nodeName);
                        await node.openDs(false, true, datasetProvider);
                    }
                }
            }
        }
    }

    public static async openRecentMemberPrompt(datasetTree: Types.IZoweDatasetTreeType, ussTree: Types.IZoweUSSTreeType): Promise<void> {
        ZoweLogger.trace("shared.actions.openRecentMemberPrompt called.");
        ZoweLogger.debug(vscode.l10n.t("Prompting the user to choose a recent member for editing"));
        let pattern: string;

        const fileHistory = [...datasetTree.getFileHistory(), ...ussTree.getFileHistory()];

        // Get user selection
        if (fileHistory.length > 0) {
            const createPick = new FilterDescriptor(vscode.l10n.t("Select a recent member to open"));
            const items: vscode.QuickPickItem[] = fileHistory.map((element) => new FilterItem({ text: element }));
            const quickpick = Gui.createQuickPick();
            quickpick.items = [createPick, ...items];
            quickpick.placeholder = vscode.l10n.t("Select a recent member to open");
            quickpick.ignoreFocusOut = true;
            quickpick.show();
            const choice = await Gui.resolveQuickPick(quickpick);
            quickpick.hide();
            if (!choice || choice === createPick) {
                Gui.showMessage(vscode.l10n.t("No selection made. Operation cancelled."));
                return;
            } else if (choice instanceof FilterDescriptor) {
                pattern = quickpick.value;
            } else {
                pattern = choice.label;
            }

            const sessionName = pattern.substring(1, pattern.indexOf("]")).trim();

            if (pattern.indexOf("/") > -1) {
                // USS file was selected
                const filePath = pattern.substring(pattern.indexOf("/"));
                const sessionNode: IZoweUSSTreeNode = ussTree.mSessionNodes.find((sessNode) => sessNode.getProfileName() === sessionName);
                await ussTree.openItemFromPath(filePath, sessionNode);
            } else {
                // Data set was selected
                const sessionNode: IZoweDatasetTreeNode = datasetTree.mSessionNodes.find(
                    (sessNode) => sessNode.label.toString().toLowerCase() === sessionName.toLowerCase()
                );
                await datasetTree.openItemFromPath(pattern, sessionNode);
            }
        } else {
            Gui.showMessage(vscode.l10n.t("No recent members found."));
            return;
        }
    }

    public static returnIconState(node: Types.IZoweNodeType): Types.IZoweNodeType {
        ZoweLogger.trace("shared.actions.returnIconState called.");
        const activePathClosed = IconGenerator.getIconById(IconGenerator.IconId.sessionActive);
        const activePathOpen = IconGenerator.getIconById(IconGenerator.IconId.sessionActiveOpen);
        const inactivePathClosed = IconGenerator.getIconById(IconGenerator.IconId.sessionInactive);
        if (node.iconPath === activePathClosed.path || node.iconPath === activePathOpen.path || node.iconPath === inactivePathClosed.path) {
            const sessionIcon = IconGenerator.getIconById(IconGenerator.IconId.session);
            if (sessionIcon) {
                node.iconPath = sessionIcon.path;
            }
        }
        return node;
    }

    public static resetValidationSettings(node: Types.IZoweNodeType, setting: boolean): Types.IZoweNodeType {
        ZoweLogger.trace("shared.actions.resetValidationSettings called.");
        if (setting) {
            Profiles.getInstance().enableValidationContext(node);
            // Ensure validation status is also reset
            node.contextValue = node.contextValue.replace(/(_Active)/g, "").replace(/(_Inactive)/g, "");
        } else {
            Profiles.getInstance().disableValidationContext(node);
        }
        return node;
    }

    public static resolveFileConflict(
        node: IZoweDatasetTreeNode | IZoweUSSTreeNode,
        profile: imperative.IProfileLoaded,
        doc: vscode.TextDocument,
        label?: string
    ): void {
        const compareBtn = vscode.l10n.t("Compare");
        const overwriteBtn = vscode.l10n.t("Overwrite");
        const infoMsg = vscode.l10n.t(
            "The content of the file is newer. Compare your version with latest or overwrite the content of the file with your changes."
        );
        ZoweLogger.info(infoMsg);
        Gui.infoMessage(infoMsg, {
            items: [compareBtn, overwriteBtn],
        }).then(async (selection) => {
            switch (selection) {
                case compareBtn: {
                    ZoweLogger.info(`${compareBtn} chosen.`);
                    await LocalFileManagement.compareSavedFileContent(doc, node, label, profile);
                    break;
                }
                case overwriteBtn: {
                    ZoweLogger.info(`${overwriteBtn} chosen.`);
                    await SharedUtils.willForceUpload(node, doc, label, profile);
                    break;
                }
                default: {
                    ZoweLogger.info("Operation cancelled, file unsaved.");
                    await Workspace.markDocumentUnsaved(doc);
                    break;
                }
            }
        });
    }

    /**
     * View (DATA SETS, JOBS, USS) refresh button
     * Refreshes treeView and profiles including their validation setting
     *
     * @param {IZoweTree} treeProvider
     */
    public static async refreshAll(treeProvider: IZoweTree<IZoweTreeNode>): Promise<void> {
        ZoweLogger.trace("refresh.refreshAll called.");
        await Profiles.getInstance().refresh(ZoweExplorerApiRegister.getInstance());
        for (const sessNode of treeProvider.mSessionNodes) {
            const profiles = await Profiles.getInstance().fetchAllProfiles();
            const found = profiles.some((prof) => prof.name === sessNode.label.toString().trim());
            if (found || sessNode.label.toString() === "Favorites") {
                if (SharedContext.isSessionNotFav(sessNode)) {
                    sessNode.dirty = true;
                    SharedActions.returnIconState(sessNode);
                    ProfilesUtils.syncSessionNode((profile) => ZoweExplorerApiRegister.getCommonApi(profile), sessNode);
                }
            } else {
                TreeViewUtils.removeSession(treeProvider, sessNode.label.toString().trim());
            }
        }
        treeProvider.refresh();
    }
}
