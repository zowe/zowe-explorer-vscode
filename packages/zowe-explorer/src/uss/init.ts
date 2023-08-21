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

import * as globals from "../globals";
import * as vscode from "vscode";
import * as ussActions from "./actions";
import * as refreshActions from "../shared/refresh";
import { IZoweUSSTreeNode, IZoweTreeNode, IZoweTree } from "@zowe/zowe-explorer-api";
import { Profiles } from "../Profiles";
import * as contextuals from "../shared/context";
import { getSelectedNodeList } from "../shared/utils";
import { createUSSTree } from "./USSTree";
import { initSubscribers } from "../shared/init";
import { ZoweLogger } from "../utils/LoggerUtils";
import { TreeViewUtils } from "../utils/TreeViewUtils";

export async function initUSSProvider(context: vscode.ExtensionContext): Promise<IZoweTree<IZoweUSSTreeNode>> {
    ZoweLogger.trace("init.initUSSProvider called.");
    const ussFileProvider: IZoweTree<IZoweUSSTreeNode> = await createUSSTree(globals.LOG);
    if (ussFileProvider == null) {
        return null;
    }

    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.addFavorite", async (node, nodeList) => {
            const selectedNodes = getSelectedNodeList(node, nodeList);
            for (const item of selectedNodes) {
                await ussFileProvider.addFavorite(item);
            }
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.removeFavorite", async (node, nodeList) => {
            const selectedNodes = getSelectedNodeList(node, nodeList);
            for (const item of selectedNodes) {
                await ussFileProvider.removeFavorite(item);
            }
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.addSession", async () => ussFileProvider.createZoweSession(ussFileProvider))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.refreshAll", async () => {
            await refreshActions.refreshAll(ussFileProvider);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.refreshUSS", async (node, nodeList) => {
            let selectedNodes = getSelectedNodeList(node, nodeList) as IZoweUSSTreeNode[];
            selectedNodes = selectedNodes.filter((x) => contextuals.isDocument(x));
            for (const item of selectedNodes) {
                await item.refreshUSS();
            }
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.refreshUSSInTree", (node: IZoweUSSTreeNode) => ussActions.refreshUSSInTree(node, ussFileProvider))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.refreshDirectory", async (node, nodeList) => {
            let selectedNodes = getSelectedNodeList(node, nodeList) as IZoweUSSTreeNode[];
            selectedNodes = selectedNodes.filter((x) => contextuals.isUssDirectory(x));
            for (const item of selectedNodes) {
                await ussActions.refreshDirectory(item, ussFileProvider);
            }
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.fullPath", (node: IZoweUSSTreeNode): void => ussFileProvider.filterPrompt(node))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.editSession", async (node) => ussFileProvider.editSession(node, ussFileProvider))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.ZoweUSSNode.open", (node: IZoweUSSTreeNode): void => node.openUSS(false, true, ussFileProvider))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.removeSession", async (node: IZoweUSSTreeNode, nodeList) => {
            let selectedNodes = getSelectedNodeList(node, nodeList);
            selectedNodes = selectedNodes.filter((element) => contextuals.isUssSession(element));
            for (const item of selectedNodes) {
                ussFileProvider.deleteSession(item);
            }
            await TreeViewUtils.fixVsCodeMultiSelect(ussFileProvider);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.createFile", async (node: IZoweUSSTreeNode) =>
            ussActions.createUSSNode(node, ussFileProvider, "file")
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.createFolder", async (node: IZoweUSSTreeNode) =>
            ussActions.createUSSNode(node, ussFileProvider, "directory")
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.deleteNode", async (node, nodeList) => {
            let selectedNodes = getSelectedNodeList(node, nodeList) as IZoweUSSTreeNode[];
            selectedNodes = selectedNodes.filter((x) => contextuals.isDocument(x) || contextuals.isUssDirectory(x));
            const cancelled = await ussActions.deleteUSSFilesPrompt(selectedNodes);
            for (const item of selectedNodes) {
                await item.deleteUSSNode(ussFileProvider, item.getUSSDocumentFilePath(), cancelled);
            }
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.binary", async (node, nodeList) => {
            let selectedNodes = getSelectedNodeList(node, nodeList) as IZoweUSSTreeNode[];
            selectedNodes = selectedNodes.filter((x) => contextuals.isText(x));
            for (const item of selectedNodes) {
                await ussActions.changeFileType(item, true, ussFileProvider);
            }
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.text", async (node, nodeList) => {
            let selectedNodes = getSelectedNodeList(node, nodeList) as IZoweUSSTreeNode[];
            selectedNodes = selectedNodes.filter((x) => contextuals.isBinary(x));
            for (const item of selectedNodes) {
                await ussActions.changeFileType(item, false, ussFileProvider);
            }
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.renameNode", (node: IZoweUSSTreeNode): void => ussFileProvider.rename(node))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.uploadDialog", async (node: IZoweUSSTreeNode) => ussActions.uploadDialog(node, ussFileProvider))
    );
    context.subscriptions.push(vscode.commands.registerCommand("zowe.uss.copyPath", (node: IZoweUSSTreeNode): void => ussActions.copyPath(node)));
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.editFile", (node: IZoweUSSTreeNode): void => node.openUSS(false, false, ussFileProvider))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.editAttributes", (node: IZoweUSSTreeNode) =>
            ussActions.editAttributes(context, ussFileProvider, node)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.saveSearch", (node: IZoweUSSTreeNode): void => ussFileProvider.saveSearch(node))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.removeSavedSearch", (node: IZoweUSSTreeNode): void => ussFileProvider.removeFavorite(node))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.removeFavProfile", (node): void => ussFileProvider.removeFavProfile(node.label, true))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.disableValidation", (node) => {
            Profiles.getInstance().disableValidation(node);
            ussFileProvider.refreshElement(node);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.enableValidation", (node) => {
            Profiles.getInstance().enableValidation(node);
            ussFileProvider.refreshElement(node);
        })
    );
    context.subscriptions.push(vscode.commands.registerCommand("zowe.uss.ssoLogin", (node: IZoweTreeNode): void => ussFileProvider.ssoLogin(node)));
    context.subscriptions.push(vscode.commands.registerCommand("zowe.uss.ssoLogout", (node: IZoweTreeNode): void => ussFileProvider.ssoLogout(node)));
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.pasteUssFile", async (node: IZoweUSSTreeNode) => {
            if (ussFileProvider.copying != null) {
                await ussFileProvider.copying;
            }

            await ussActions.pasteUss(ussFileProvider, node);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.uss.copyUssFile", async (node: IZoweUSSTreeNode, nodeList: IZoweUSSTreeNode[]) => {
            ussFileProvider.copying = ussActions.copyUssFiles(node, nodeList, ussFileProvider);
            await ussFileProvider.copying;
        })
    );
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            ussFileProvider.onDidChangeConfiguration(e);
        })
    );

    initSubscribers(context, ussFileProvider);
    return ussFileProvider;
}
