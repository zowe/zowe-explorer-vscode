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
import { IZoweUSSTreeNode, imperative, ZoweScheme, FsAbstractUtils, Gui } from "@zowe/zowe-explorer-api";
import { USSTree } from "./USSTree";
import { USSActions } from "./USSActions";
import { UssFSProvider } from "./UssFSProvider";
import { ZoweLogger } from "../../tools/ZoweLogger";
import { SharedActions } from "../shared/SharedActions";
import { SharedContext } from "../shared/SharedContext";
import { SharedInit } from "../shared/SharedInit";
import { SharedUtils } from "../shared/SharedUtils";

export class USSInit {
    /**
     * Creates the USS tree that contains nodes of sessions and data sets
     *
     * @export
     */
    public static async createUSSTree(log: imperative.Logger): Promise<USSTree> {
        ZoweLogger.trace("USSInit.createUSSTree called.");
        const tree = new USSTree();
        await tree.initializeFavorites(log);
        await tree.addSession();
        return tree;
    }

    public static async initUSSProvider(context: vscode.ExtensionContext): Promise<USSTree> {
        ZoweLogger.trace("USSInit.initUSSProvider called.");

        context.subscriptions.push(vscode.workspace.registerFileSystemProvider(ZoweScheme.USS, UssFSProvider.instance, { isCaseSensitive: true }));
        const ussFileProvider: USSTree = await USSInit.createUSSTree(ZoweLogger.log);
        if (ussFileProvider == null) {
            return null;
        }

        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.uss.addSession", async () => ussFileProvider.createZoweSession(ussFileProvider))
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.uss.refreshAll", async () => {
                await SharedActions.refreshProvider(ussFileProvider);
            })
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.uss.refreshUSS", async (node, nodeList) => {
                const statusMsg = Gui.setStatusBarMessage(`$(sync~spin) ${vscode.l10n.t("Pulling from Mainframe...")}`);
                let selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList) as IZoweUSSTreeNode[];
                selectedNodes = selectedNodes.filter((x) => SharedContext.isDocument(x) || SharedContext.isBinary(node));
                for (const item of selectedNodes) {
                    if (SharedContext.isUssDirectory(item)) {
                        // just refresh item to grab latest files
                        ussFileProvider.refreshElement(item);
                    } else {
                        if (!(await FsAbstractUtils.confirmForUnsavedDoc(node.resourceUri))) {
                            return;
                        }
                        const statusMsg2 = Gui.setStatusBarMessage(`$(sync~spin) ${"Fetching USS file..."}`);
                        // need to pull content for file and apply to FS entry
                        await UssFSProvider.instance.fetchFileAtUri(item.resourceUri, {
                            editor: vscode.window.visibleTextEditors.find((v) => v.document.uri.path === item.resourceUri.path),
                        });
                        statusMsg2.dispose();
                    }
                }
                statusMsg.dispose();
            })
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.uss.refreshUSSInTree", (node: IZoweUSSTreeNode) =>
                USSActions.refreshUSSInTree(node, ussFileProvider)
            )
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.uss.refreshDirectory", async (node, nodeList) => {
                let selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList) as IZoweUSSTreeNode[];
                selectedNodes = selectedNodes.filter((x) => SharedContext.isUssDirectory(x));
                for (const item of selectedNodes) {
                    await USSActions.refreshDirectory(item, ussFileProvider);
                }
            })
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.uss.fullPath", async (node: IZoweUSSTreeNode): Promise<void> => ussFileProvider.filterPrompt(node))
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.uss.createFile", async (node: IZoweUSSTreeNode) =>
                USSActions.createUSSNode(node, ussFileProvider, "file")
            )
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.uss.createFolder", async (node: IZoweUSSTreeNode) =>
                USSActions.createUSSNode(node, ussFileProvider, "directory")
            )
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.uss.deleteNode", async (node: IZoweUSSTreeNode, nodeList: IZoweUSSTreeNode[]) => {
                await USSActions.deleteUSSFilesPrompt(node, nodeList, ussFileProvider);
            })
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.uss.renameNode", async (node: IZoweUSSTreeNode): Promise<void> => ussFileProvider.rename(node))
        );
        const uploadDialogHandler = (binary: boolean): ((node: IZoweUSSTreeNode) => Promise<void>) => {
            return async (node: IZoweUSSTreeNode): Promise<void> => {
                await USSActions.uploadDialog(node, ussFileProvider, binary);
            };
        };
        context.subscriptions.push(vscode.commands.registerCommand("zowe.uss.uploadDialog", uploadDialogHandler(false)));
        context.subscriptions.push(vscode.commands.registerCommand("zowe.uss.uploadDialogBinary", uploadDialogHandler(true)));
        context.subscriptions.push(vscode.commands.registerCommand("zowe.uss.copyPath", (node: IZoweUSSTreeNode): void => USSActions.copyPath(node)));
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.uss.editFile", async (node: IZoweUSSTreeNode): Promise<void> => {
                await node.openUSS(false, false, ussFileProvider);
            })
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.uss.editAttributes", (node: IZoweUSSTreeNode) =>
                USSActions.editAttributes(context, ussFileProvider, node)
            )
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.uss.pasteUssFile", async (node: IZoweUSSTreeNode) => {
                if (ussFileProvider.copying != null) {
                    await ussFileProvider.copying;
                }

                await USSActions.pasteUss(ussFileProvider, node);
            })
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.uss.copyUssFile", async (node: IZoweUSSTreeNode, nodeList: IZoweUSSTreeNode[]) => {
                ussFileProvider.copying = USSActions.copyUssFiles(node, nodeList, ussFileProvider);
                await ussFileProvider.copying;
            })
        );
        context.subscriptions.push(
            vscode.commands.registerCommand("zowe.uss.copyRelativePath", async (node: IZoweUSSTreeNode) => USSActions.copyRelativePath(node))
        );
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(async (e) => {
                await ussFileProvider.onDidChangeConfiguration(e);
            })
        );
        context.subscriptions.push(
            vscode.workspace.onDidOpenTextDocument((doc) => {
                if (doc.uri.scheme !== ZoweScheme.USS) {
                    return;
                }

                UssFSProvider.instance.cacheOpenedUri(doc.uri);
            })
        );
        SharedInit.initSubscribers(context, ussFileProvider);
        return ussFileProvider;
    }
}
