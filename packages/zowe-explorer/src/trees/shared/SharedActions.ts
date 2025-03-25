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
import { Gui, IZoweTree, IZoweTreeNode, IZoweUSSTreeNode, Types } from "@zowe/zowe-explorer-api";
import { Profiles } from "../../configuration/Profiles";
import { Constants } from "../../configuration/Constants";
import { SharedUtils } from "./SharedUtils";
import { SharedContext } from "./SharedContext";
import { ZoweExplorerApiRegister } from "../../extending/ZoweExplorerApiRegister";
import { IconGenerator } from "../../icons/IconGenerator";
import { ZoweLogger } from "../../tools/ZoweLogger";
import { TreeViewUtils } from "../../utils/TreeViewUtils";
import { FilterItem, FilterDescriptor } from "../../management/FilterManagement";
import { IconUtils } from "../../icons/IconUtils";
import { AuthUtils } from "../../utils/AuthUtils";
import { SharedTreeProviders } from "./SharedTreeProviders";
import { ZoweExplorerExtender } from "../../extending/ZoweExplorerExtender";

export class SharedActions {
    private static refreshInProgress = false;

    /**
     * Returns true if a profile refresh is currently in progress
     */
    public static isRefreshInProgress(): boolean {
        return SharedActions.refreshInProgress;
    }

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
                    const ussNode = node as IZoweUSSTreeNode;
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
                    await vscode.commands.executeCommand(member.command.command, member.resourceUri);
                } else {
                    // PDS & SDS
                    await datasetProvider.getTreeView().reveal(node, { select: true, focus: true, expand: false });

                    // If selected node was SDS, open it in workspace
                    if (SharedContext.isDs(node)) {
                        datasetProvider.addSearchHistory(nodeName);
                        await vscode.commands.executeCommand(node.command.command, node.resourceUri);
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
                const sessionNode = ussTree.mSessionNodes.find((sessNode) => sessNode.label.toString().toLowerCase() === sessionName.toLowerCase());
                if (!sessionNode) {
                    Gui.showMessage(vscode.l10n.t("Profile not found."));
                    return;
                }
                await ussTree.openItemFromPath(filePath, sessionNode);
            } else {
                // Data set was selected
                const sessionNode = datasetTree.mSessionNodes.find(
                    (sessNode) => sessNode.label.toString().toLowerCase() === sessionName.toLowerCase()
                );
                if (!sessionNode) {
                    Gui.showMessage(vscode.l10n.t("Profile not found."));
                    return;
                }
                await datasetTree.openItemFromPath(pattern, sessionNode);
            }
        } else {
            Gui.showMessage(vscode.l10n.t("No recent members found."));
        }
    }

    /**
     * Updates the icon state for a profile/session node to reflect the validation status after a refresh operation.
     * @param node The node whose icon needs updated
     * @returns The node after the changes are made (or with no changes if the profile has not been validated)
     */
    public static returnIconState(node: Types.IZoweNodeType): void {
        ZoweLogger.trace("shared.actions.returnIconState called.");

        const validationStatus = Profiles.getInstance().profilesForValidation.find((profile) => profile.name === node.getLabel());
        if (validationStatus == null) {
            // Don't change the node's icon if it hasn't been validated
            return;
        }

        let iconId: string;
        switch (validationStatus.status) {
            case "unverified":
                iconId =
                    node.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed ? IconUtils.IconId.session : IconUtils.IconId.sessionOpen;
                break;
            case "active":
                iconId =
                    node.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed
                        ? IconUtils.IconId.sessionActive
                        : IconUtils.IconId.sessionActiveOpen;
                break;
            case "inactive":
                // Collapse profiles that failed to validate to prevent requests from the node's `getChildren` function
                if (node.collapsibleState === vscode.TreeItemCollapsibleState.Expanded) {
                    node.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
                }
                iconId = IconUtils.IconId.sessionInactive;
                break;
            default:
                return;
        }

        // Only apply the new icon if it doesn't match current node icon
        const iconById = IconGenerator.getIconById(iconId as IconUtils.IconId)?.path;
        if (iconById && node.iconPath !== iconById) {
            node.iconPath = iconById;
        }
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

    public static async refreshProfiles(): Promise<void> {
        // Refresh profiles before anything else to ensure we have the latest state
        try {
            await Profiles.getInstance().refresh(ZoweExplorerApiRegister.getInstance());
        } catch (err) {
            if (err instanceof Error) {
                ZoweLogger.error(err.message);
                ZoweExplorerExtender.showZoweConfigError(err.message);
            }
        }
    }

    public static async refreshProvider(treeProvider: IZoweTree<IZoweTreeNode>, refreshProfiles?: boolean): Promise<void> {
        if (refreshProfiles) {
            await SharedActions.refreshProfiles();
        }

        for (const sessNode of treeProvider.mSessionNodes) {
            const profiles = await Profiles.getInstance().fetchAllProfiles();
            const found = profiles.some((prof) => prof.name === sessNode.label.toString().trim());
            if (found || sessNode.label.toString() === vscode.l10n.t("Favorites")) {
                if (SharedContext.isSessionNotFav(sessNode)) {
                    sessNode.dirty = true;
                    SharedActions.returnIconState(sessNode);
                    AuthUtils.syncSessionNode((profile) => ZoweExplorerApiRegister.getCommonApi(profile), sessNode);
                    treeProvider.refreshElement(sessNode);
                }
            } else {
                await TreeViewUtils.removeSession(treeProvider, sessNode.label.toString().trim());
            }
        }
        for (const profType of ZoweExplorerApiRegister.getInstance().registeredApiTypes()) {
            await TreeViewUtils.addDefaultSession(treeProvider, profType);
        }
        treeProvider.refresh();
    }

    /**
     * Refreshes profiles and tree providers.
     */
    public static async refreshAll(): Promise<void> {
        ZoweLogger.trace("refresh.refreshAll called.");

        if (SharedActions.refreshInProgress) {
            // Discard duplicate calls to `refreshAll` when a tree provider isn't specified
            ZoweLogger.debug("Profile refresh already in progress, skipping");
            return;
        }
        SharedActions.refreshInProgress = true;

        await SharedActions.refreshProfiles();

        for (const provider of Object.values(SharedTreeProviders.providers)) {
            await SharedActions.refreshProvider(provider);
        }

        SharedActions.refreshInProgress = false;
    }
}
