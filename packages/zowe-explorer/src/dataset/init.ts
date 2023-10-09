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
import * as dsActions from "./actions";
import * as refreshActions from "../shared/refresh";
import { IZoweDatasetTreeNode, IZoweTreeNode, IZoweTree } from "@zowe/zowe-explorer-api";
import { Profiles } from "../Profiles";
import { createDatasetTree } from "./DatasetTree";
import { ZoweDatasetNode } from "./ZoweDatasetNode";
import * as contextuals from "../shared/context";
import { getSelectedNodeList } from "../shared/utils";
import { initSubscribers } from "../shared/init";
import { ZoweLogger } from "../utils/LoggerUtils";
import { TreeViewUtils } from "../utils/TreeViewUtils";

export async function initDatasetProvider(context: vscode.ExtensionContext): Promise<IZoweTree<IZoweDatasetTreeNode>> {
    ZoweLogger.trace("dataset.init.initDatasetProvider called.");
    const datasetProvider = await createDatasetTree(globals.LOG);
    if (datasetProvider == null) {
        return null;
    }

    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.all.config.init", async () => {
            await datasetProvider.createZoweSchema(datasetProvider);
        })
    );
    context.subscriptions.push(vscode.commands.registerCommand("zowe.ds.addSession", async () => datasetProvider.createZoweSession(datasetProvider)));
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.addFavorite", async (node, nodeList) => {
            const selectedNodes = getSelectedNodeList(node, nodeList);
            for (const item of selectedNodes) {
                await datasetProvider.addFavorite(item);
            }
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.refreshAll", async () => {
            await refreshActions.refreshAll(datasetProvider);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.refreshNode", async (node, nodeList) => {
            let selectedNodes = getSelectedNodeList(node, nodeList);
            selectedNodes = selectedNodes.filter((element) => contextuals.isDs(element) || contextuals.isDsMember(element));
            for (const item of selectedNodes) {
                await dsActions.refreshPS(item);
            }
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.refreshDataset", async (node, nodeList) => {
            let selectedNodes = getSelectedNodeList(node, nodeList);
            selectedNodes = selectedNodes.filter((element) => contextuals.isDs(element) || contextuals.isPdsNotFav(element));
            for (const item of selectedNodes) {
                await dsActions.refreshDataset(item, datasetProvider);
            }
        })
    );
    context.subscriptions.push(vscode.commands.registerCommand("zowe.ds.pattern", (node) => datasetProvider.filterPrompt(node)));
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.editSession", async (node) => datasetProvider.editSession(node, datasetProvider))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.ZoweNode.openPS", async (node) => dsActions.openPS(node, true, datasetProvider))
    );
    context.subscriptions.push(vscode.commands.registerCommand("zowe.ds.createDataset", async (node) => dsActions.createFile(node, datasetProvider)));
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.createMember", async (node) => dsActions.createMember(node, datasetProvider))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.deleteDataset", async (node?) => dsActions.deleteDatasetPrompt(datasetProvider, node))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.allocateLike", async (node) => dsActions.allocateLike(datasetProvider, node))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.uploadDialog", async (node) => dsActions.uploadDialog(node, datasetProvider))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.deleteMember", async (node?) => dsActions.deleteDatasetPrompt(datasetProvider, node))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.editDataSet", async (node, nodeList) => {
            let selectedNodes = getSelectedNodeList(node, nodeList);
            selectedNodes = selectedNodes.filter((element) => contextuals.isDs(element) || contextuals.isDsMember(element));
            for (const item of selectedNodes) {
                await dsActions.openPS(item, false, datasetProvider);
            }
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.editMember", async (node, nodeList) => {
            let selectedNodes = getSelectedNodeList(node, nodeList);
            selectedNodes = selectedNodes.filter((element) => contextuals.isDs(element) || contextuals.isDsMember(element));
            for (const item of selectedNodes) {
                await dsActions.openPS(item, false, datasetProvider);
            }
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.removeSession", async (node: IZoweDatasetTreeNode, nodeList: IZoweDatasetTreeNode[]) => {
            let selectedNodes = getSelectedNodeList(node, nodeList);
            selectedNodes = selectedNodes.filter((sNode) => contextuals.isDsSession(sNode));
            for (const select of selectedNodes) {
                datasetProvider.deleteSession(select);
            }
            await TreeViewUtils.fixVsCodeMultiSelect(datasetProvider);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.removeFavorite", async (node, nodeList) => {
            const selectedNodes = getSelectedNodeList(node, nodeList);
            for (const item of selectedNodes) {
                await datasetProvider.removeFavorite(item);
            }
        })
    );
    context.subscriptions.push(vscode.commands.registerCommand("zowe.ds.saveSearch", (node) => datasetProvider.addFavorite(node)));
    context.subscriptions.push(vscode.commands.registerCommand("zowe.ds.removeSavedSearch", (node) => datasetProvider.removeFavorite(node)));
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.removeFavProfile", (node) => datasetProvider.removeFavProfile(node.label, true))
    );
    context.subscriptions.push(vscode.commands.registerCommand("zowe.ds.submitJcl", async () => dsActions.submitJcl(datasetProvider)));
    context.subscriptions.push(vscode.commands.registerCommand("zowe.ds.submitMember", async (node) => dsActions.submitMember(node)));
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.showAttributes", async (node, nodeList) => {
            const selectedNodes = getSelectedNodeList(node, nodeList).filter(
                (element) => contextuals.isDs(element) || contextuals.isPds(element) || contextuals.isDsMember(element)
            );
            for (const item of selectedNodes) {
                await dsActions.showAttributes(item, datasetProvider);
            }
        })
    );
    context.subscriptions.push(vscode.commands.registerCommand("zowe.ds.renameDataSet", (node) => datasetProvider.rename(node)));
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.copyDataSets", async (node, nodeList) => dsActions.copyDataSets(node, nodeList, datasetProvider))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.pasteDataSets", async (node: ZoweDatasetNode) => {
            if (!node) {
                node = datasetProvider.getTreeView().selection[0] as ZoweDatasetNode;
            }
            await dsActions.pasteDataSetMembers(datasetProvider, node);
            await dsActions.refreshDataset(node.getParent(), datasetProvider);
        })
    );
    context.subscriptions.push(vscode.commands.registerCommand("zowe.ds.renameDataSetMember", (node) => datasetProvider.rename(node)));
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.hMigrateDataSet", async (node, nodeList) => {
            let selectedNodes = getSelectedNodeList(node, nodeList);
            selectedNodes = selectedNodes.filter((element) => contextuals.isDs(element) || contextuals.isPdsNotFav(element));
            for (const item of selectedNodes) {
                await dsActions.hMigrateDataSet(item as ZoweDatasetNode);
            }
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.hRecallDataSet", async (node, nodeList) => {
            let selectedNodes = getSelectedNodeList(node, nodeList);
            selectedNodes = selectedNodes.filter((element) => contextuals.isMigrated(element));
            for (const item of selectedNodes) {
                await dsActions.hRecallDataSet(item as ZoweDatasetNode);
            }
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.showFileErrorDetails", async (node, nodeList) => {
            let selectedNodes = getSelectedNodeList(node, nodeList);
            selectedNodes = selectedNodes.filter((element) => contextuals.hasFileError(element));
            for (const item of selectedNodes) {
                await dsActions.showFileErrorDetails(item as ZoweDatasetNode);
            }
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.disableValidation", (node) => {
            Profiles.getInstance().disableValidation(node);
            datasetProvider.refreshElement(node);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.enableValidation", (node) => {
            Profiles.getInstance().enableValidation(node);
            datasetProvider.refreshElement(node);
        })
    );
    context.subscriptions.push(vscode.commands.registerCommand("zowe.ds.ssoLogin", (node: IZoweTreeNode) => datasetProvider.ssoLogin(node)));
    context.subscriptions.push(vscode.commands.registerCommand("zowe.ds.ssoLogout", (node: IZoweTreeNode) => datasetProvider.ssoLogout(node)));
    context.subscriptions.push(
        vscode.commands.registerCommand("zowe.ds.sortBy", async (node: IZoweDatasetTreeNode) => datasetProvider.sortPdsMembersDialog(node))
    );
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "zowe.ds.filterBy",
            async (node: IZoweDatasetTreeNode): Promise<void> => datasetProvider.filterPdsMembersDialog(node)
        )
    );
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async (e) => {
            await datasetProvider.onDidChangeConfiguration(e);
        })
    );

    initSubscribers(context, datasetProvider);
    return datasetProvider;
}
