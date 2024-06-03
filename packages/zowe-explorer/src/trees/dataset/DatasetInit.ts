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
import { IZoweDatasetTreeNode, ZosEncoding, ZoweScheme, imperative } from "@zowe/zowe-explorer-api";
import { DatasetTree } from "./DatasetTree";
import { DatasetFSProvider } from "./DatasetFSProvider";
import { DatasetActions } from "./DatasetActions";
import { ZoweDatasetNode } from "./ZoweDatasetNode";
import { ZoweLogger } from "../../tools/ZoweLogger";
import { SharedActions } from "../shared/SharedActions";
import { SharedContext } from "../shared/SharedContext";
import { SharedInit } from "../shared/SharedInit";
import { SharedUtils } from "../shared/SharedUtils";

export class DatasetInit {
    public static async createDatasetTree(log: imperative.Logger): Promise<DatasetTree> {
        const tree = new DatasetTree();
        await tree.initializeFavorites(log);
        await tree.addSession(undefined, undefined, tree);
        return tree;
    }

    public static async initDatasetProvider(context: vscode.ExtensionContext): Promise<DatasetTree> {
        ZoweLogger.trace("dataset.init.initDatasetProvider called.");
        context.subscriptions.push(vscode.workspace.registerFileSystemProvider(ZoweScheme.DS, DatasetFSProvider.instance, { isCaseSensitive: true }));
        const datasetProvider = await DatasetInit.createDatasetTree(ZoweLogger.log);
        if (datasetProvider == null) {
            return null;
        }

        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.all.config.init", async () => {
                await datasetProvider.createZoweSchema(datasetProvider);
            })
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.ds.addSession", async () => datasetProvider.createZoweSession(datasetProvider))
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.ds.addFavorite", async (node, nodeList) => {
                const selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList);
                for (const item of selectedNodes) {
                    await datasetProvider.addFavorite(item as IZoweDatasetTreeNode);
                }
            })
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.ds.refreshAll", async () => {
                await SharedActions.refreshAll(datasetProvider);
            })
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.ds.refreshNode", async (node, nodeList) => {
                let selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList);
                selectedNodes = selectedNodes.filter((element) => SharedContext.isDs(element) || SharedContext.isDsMember(element));
                for (const item of selectedNodes) {
                    await DatasetActions.refreshPS(item as IZoweDatasetTreeNode);
                }
            })
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.ds.refreshDataset", async (node, nodeList) => {
                let selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList);
                selectedNodes = selectedNodes.filter((element) => SharedContext.isDs(element) || SharedContext.isPdsNotFav(element));
                for (const item of selectedNodes) {
                    await DatasetActions.refreshDataset(item as IZoweDatasetTreeNode, datasetProvider);
                }
            })
        );
        context.subscriptions.push(vscode.commands.registerCommand("zowe.ds.pattern", (node) => datasetProvider.filterPrompt(node)));
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.ds.editSession", async (node) => datasetProvider.editSession(node, datasetProvider))
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.ds.createDataset", async (node) => DatasetActions.createFile(node, datasetProvider))
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.ds.createMember", async (node) => DatasetActions.createMember(node, datasetProvider))
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.ds.deleteDataset", async (node?) => DatasetActions.deleteDatasetPrompt(datasetProvider, node))
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.ds.allocateLike", async (node) => DatasetActions.allocateLike(datasetProvider, node))
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.ds.uploadDialog", async (node) => DatasetActions.uploadDialog(node, datasetProvider))
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.ds.deleteMember", async (node?) => DatasetActions.deleteDatasetPrompt(datasetProvider, node))
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.ds.editDataSet", async (node, nodeList) => {
                let selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList) as IZoweDatasetTreeNode[];
                selectedNodes = selectedNodes.filter((element) => SharedContext.isDs(element) || SharedContext.isDsMember(element));
                for (const item of selectedNodes) {
                    await vscode.commands.executeCommand(item.command.command, item.resourceUri);
                }
            })
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.ds.editMember", async (node, nodeList) => {
                let selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList) as IZoweDatasetTreeNode[];
                selectedNodes = selectedNodes.filter((element) => SharedContext.isDs(element) || SharedContext.isDsMember(element));
                for (const item of selectedNodes) {
                    await vscode.commands.executeCommand(item.command.command, item.resourceUri);
                }
            })
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.ds.removeFavorite", async (node, nodeList) => {
                const selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList);
                for (const item of selectedNodes) {
                    await datasetProvider.removeFavorite(item as IZoweDatasetTreeNode);
                }
            })
        );
        context.subscriptions.push(vscode.commands.registerCommand("zowe.ds.saveSearch", (node) => datasetProvider.addFavorite(node)));
        context.subscriptions.push(vscode.commands.registerCommand("zowe.ds.removeSavedSearch", (node) => datasetProvider.removeFavorite(node)));
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.ds.removeFavProfile", (node) => datasetProvider.removeFavProfile(node.label, true))
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.ds.submitJcl", async (file) => DatasetActions.submitJcl(datasetProvider, file))
        );
        context.subscriptions.push(vscode.commands.registerCommand("zowe.ds.submitMember", async (node) => DatasetActions.submitMember(node)));
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.ds.showAttributes", async (node, nodeList) => {
                const selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList).filter(
                    (element) => SharedContext.isDs(element) || SharedContext.isPds(element) || SharedContext.isDsMember(element)
                );
                for (const item of selectedNodes) {
                    await DatasetActions.showAttributes(item as IZoweDatasetTreeNode, datasetProvider);
                }
            })
        );
        context.subscriptions.push(vscode.commands.registerCommand("zowe.ds.renameDataSet", (node) => datasetProvider.rename(node)));
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.ds.copyDataSets", async (node, nodeList) =>
                DatasetActions.copyDataSets(node, nodeList, datasetProvider)
            )
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.ds.pasteDataSets", async (node: ZoweDatasetNode) => {
                if (!node) {
                    node = datasetProvider.getTreeView().selection[0] as ZoweDatasetNode;
                }
                await DatasetActions.pasteDataSetMembers(datasetProvider, node);
                await DatasetActions.refreshDataset(node.getParent() as IZoweDatasetTreeNode, datasetProvider);
            })
        );
        context.subscriptions.push(vscode.commands.registerCommand("zowe.ds.renameDataSetMember", (node) => datasetProvider.rename(node)));
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.ds.hMigrateDataSet", async (node, nodeList) => {
                let selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList);
                selectedNodes = selectedNodes.filter((element) => SharedContext.isDs(element) || SharedContext.isPdsNotFav(element));
                for (const item of selectedNodes) {
                    await DatasetActions.hMigrateDataSet(item as ZoweDatasetNode);
                }
            })
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.ds.hRecallDataSet", async (node, nodeList) => {
                let selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList);
                selectedNodes = selectedNodes.filter((element) => SharedContext.isMigrated(element));
                for (const item of selectedNodes) {
                    await DatasetActions.hRecallDataSet(item as ZoweDatasetNode);
                }
            })
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.ds.showFileErrorDetails", async (node, nodeList) => {
                let selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList);
                selectedNodes = selectedNodes.filter((element) => SharedContext.hasFileError(element));
                for (const item of selectedNodes) {
                    await DatasetActions.showFileErrorDetails(item as ZoweDatasetNode);
                }
            })
        );
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
            vscode.commands.registerCommand(
                "zowe.ds.openWithEncoding",
                (node: IZoweDatasetTreeNode, encoding?: ZosEncoding): Promise<void> => datasetProvider.openWithEncoding(node, encoding)
            )
        );
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(async (e) => {
                await datasetProvider.onDidChangeConfiguration(e);
            })
        );
        context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(DatasetFSProvider.onDidOpenTextDocument));
        context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(DatasetTree.onDidCloseTextDocument));

        SharedInit.initSubscribers(context, datasetProvider);
        return datasetProvider;
    }
}
