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
import * as globals from "../globals";
import { openPS } from "../dataset/actions";
import { Gui, IZoweDatasetTreeNode, IZoweUSSTreeNode, IZoweNodeType, IZoweTree } from "@zowe/zowe-explorer-api";
import { Profiles } from "../Profiles";
import { filterTreeByString } from "../shared/utils";
import { FilterItem, FilterDescriptor } from "../utils/ProfilesUtils";
import * as contextually from "../shared/context";
import * as nls from "vscode-nls";
import { getIconById, IconId } from "../generators/icons";
import { ZoweLogger } from "../utils/LoggerUtils";

// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

/**
 * Search for matching items loaded in data set or USS tree
 *
 */
export async function searchInAllLoadedItems(
    datasetProvider?: IZoweTree<IZoweDatasetTreeNode>,
    ussFileProvider?: IZoweTree<IZoweUSSTreeNode>
): Promise<void> {
    ZoweLogger.trace("shared.actions.searchInAllLoadedItems called.");
    let pattern: string;
    const items: IZoweNodeType[] = [];
    const qpItems = [];
    const quickpick = Gui.createQuickPick();
    quickpick.placeholder = localize("searchHistory.options.prompt", "Enter a filter");
    quickpick.ignoreFocusOut = true;
    quickpick.onDidChangeValue((value) => {
        if (value) {
            quickpick.items = filterTreeByString(value, qpItems);
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
        Gui.showMessage(localize("searchInAllLoadedItems.noneLoaded", "No items are loaded in the tree."));
        return;
    }

    let qpItem: vscode.QuickPickItem;
    for (const item of items) {
        if (contextually.isDs(item) || contextually.isPdsNotFav(item) || contextually.isVsam(item)) {
            if (contextually.isDsMember(item)) {
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
        } else if (contextually.isUssDirectory(item) || contextually.isText(item) || contextually.isBinary(item)) {
            const filterItem = `[${item.getProfileName().trim()}]: ${item.getParent().fullPath}/${item.label.toString()}`;
            qpItem = new FilterItem({ text: filterItem, description: "USS" });
            qpItems.push(qpItem);
        }
    }
    quickpick.items = [...qpItems];

    quickpick.show();
    const choice = await Gui.resolveQuickPick(quickpick);
    if (!choice) {
        Gui.showMessage(localize("searchInAllLoadedItems.enterPattern", "You must enter a pattern."));
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

            if (node.contextValue !== globals.USS_DIR_CONTEXT) {
                // If selected item is file, open it in workspace
                ussFileProvider.addSearchHistory(node.fullPath);
                const ussNode: IZoweUSSTreeNode = node;
                ussNode.openUSS(false, true, ussFileProvider);
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
                await openPS(member, true, datasetProvider);
            } else {
                // PDS & SDS
                await datasetProvider.getTreeView().reveal(node, { select: true, focus: true, expand: false });

                // If selected node was SDS, open it in workspace
                if (contextually.isDs(node)) {
                    datasetProvider.addSearchHistory(nodeName);
                    await openPS(node, true, datasetProvider);
                }
            }
        }
    }
}

export async function openRecentMemberPrompt(datasetTree: IZoweTree<IZoweDatasetTreeNode>, ussTree: IZoweTree<IZoweUSSTreeNode>): Promise<void> {
    ZoweLogger.trace("shared.actions.openRecentMemberPrompt called.");
    if (globals.LOG) {
        ZoweLogger.debug(localize("enterPattern.log.debug.prompt", "Prompting the user to choose a recent member for editing"));
    }
    let pattern: string;

    const fileHistory = [...datasetTree.getFileHistory(), ...ussTree.getFileHistory()];

    // Get user selection
    if (fileHistory.length > 0) {
        const createPick = new FilterDescriptor(localize("memberHistory.option.prompt.open", "Select a recent member to open"));
        const items: vscode.QuickPickItem[] = fileHistory.map((element) => new FilterItem({ text: element }));
        if (globals.ISTHEIA) {
            const options1: vscode.QuickPickOptions = {
                placeHolder: localize("memberHistory.options.prompt", "Select a recent member to open"),
            };

            const choice = await Gui.showQuickPick([createPick, ...items], options1);
            if (!choice) {
                Gui.showMessage(localize("enterPattern.pattern", "No selection made. Operation cancelled."));
                return;
            }
            pattern = choice === createPick ? "" : choice.label;
        } else {
            const quickpick = Gui.createQuickPick();
            quickpick.items = [createPick, ...items];
            quickpick.placeholder = localize("memberHistory.options.prompt", "Select a recent member to open");
            quickpick.ignoreFocusOut = true;
            quickpick.show();
            const choice = await Gui.resolveQuickPick(quickpick);
            quickpick.hide();
            if (!choice || choice === createPick) {
                Gui.showMessage(localize("enterPattern.pattern", "No selection made. Operation cancelled."));
                return;
            } else if (choice instanceof FilterDescriptor) {
                pattern = quickpick.value;
            } else {
                pattern = choice.label;
            }
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
        Gui.showMessage(localize("getRecentMembers.empty", "No recent members found."));
        return;
    }
}

export function returnIconState(node: IZoweNodeType): IZoweNodeType {
    ZoweLogger.trace("shared.actions.returnIconState called.");
    const activePathClosed = getIconById(IconId.sessionActive);
    const activePathOpen = getIconById(IconId.sessionActiveOpen);
    const inactivePathClosed = getIconById(IconId.sessionInactive); // So far, we only ever reference the closed inactive icon, not the open one
    if (node.iconPath === activePathClosed.path || node.iconPath === activePathOpen.path || node.iconPath === inactivePathClosed.path) {
        const sessionIcon = getIconById(IconId.session);
        if (sessionIcon) {
            node.iconPath = sessionIcon.path;
        }
    }
    return node;
}

export function resetValidationSettings(node: IZoweNodeType, setting: boolean): IZoweNodeType {
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
