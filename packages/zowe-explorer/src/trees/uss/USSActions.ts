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
import * as fs from "fs";
import * as path from "path";
import * as zosfiles from "@zowe/zos-files-for-zowe-sdk";
import { Gui, imperative, IZoweUSSTreeNode, Types, ZoweExplorerApiType } from "@zowe/zowe-explorer-api";
import { isBinaryFileSync } from "isbinaryfile";
import { USSAttributeView } from "./USSAttributeView";
import { USSFileStructure } from "./USSFileStructure";
import { ZoweUSSNode } from "./ZoweUSSNode";
import { Constants } from "../../configuration/Constants";
import { ZoweExplorerApiRegister } from "../../extending/ZoweExplorerApiRegister";
import { LocalFileManagement } from "../../management/LocalFileManagement";
import { ZoweLogger } from "../../tools/ZoweLogger";
import { SharedActions } from "../shared/SharedActions";
import { SharedContext } from "../shared/SharedContext";
import { SharedUtils } from "../shared/SharedUtils";
import { AuthUtils } from "../../utils/AuthUtils";

export class USSActions {
    /**
     * Prompts the user for a path, and populates the [TreeView]{@link vscode.TreeView} based on the path
     *
     * @param {ZoweUSSNode} node - The session or directory node that serves as the parent
     * @param {ussTree} ussFileProvider - Current ussTree used to populate the TreeView
     * @returns {Promise<void>}
     */
    public static async createUSSNode(node: IZoweUSSTreeNode, ussFileProvider: Types.IZoweUSSTreeType, nodeType: string): Promise<void> {
        ZoweLogger.trace("uss.actions.createUSSNode called.");
        await ussFileProvider.checkCurrentProfile(node);
        let filePath = "";
        const isTopLevel = SharedContext.isSession(node);
        if (isTopLevel && node.fullPath?.length === 0) {
            const filePathOptions: vscode.InputBoxOptions = {
                placeHolder: vscode.l10n.t({
                    message: "{0} location",
                    args: [nodeType],
                    comment: ["Node type"],
                }),
                prompt: vscode.l10n.t({
                    message: "Choose a location to create the {0}",
                    args: [nodeType],
                    comment: ["Node type"],
                }),
                value: node.tooltip as string,
            };
            filePath = await Gui.showInputBox(filePathOptions);
            node.fullPath = filePath;
        } else {
            filePath = node.fullPath;
        }

        if (filePath == null || filePath.length === 0) {
            return;
        }

        const nameOptions: vscode.InputBoxOptions = {
            placeHolder: vscode.l10n.t("Name of file or directory"),
        };
        const name = await Gui.showInputBox(nameOptions);
        if (name && filePath) {
            try {
                filePath = path.posix.join(filePath, name);
                const uri = node.resourceUri.with({
                    path: isTopLevel ? path.posix.join(node.resourceUri.path, filePath) : path.posix.join(node.resourceUri.path, name),
                });
                await ZoweExplorerApiRegister.getUssApi(node.getProfile()).create(filePath, nodeType);
                if (nodeType === "file") {
                    await vscode.workspace.fs.writeFile(uri, new Uint8Array());
                } else {
                    await vscode.workspace.fs.createDirectory(uri);
                }
                if (isTopLevel) {
                    await SharedActions.refreshAll(ussFileProvider);
                } else {
                    ussFileProvider.refreshElement(node);
                }

                const newNode = await node.getChildren().then((children) => children.find((child) => child.label === name) as ZoweUSSNode);
                await ussFileProvider.getTreeView().reveal(node, { select: true, focus: true });
                ussFileProvider.getTreeView().reveal(newNode, { select: true, focus: true });

                const equivalentNodeParent = ussFileProvider.findEquivalentNode(
                    node,
                    SharedContext.isFavorite(node) || SharedContext.isFavoriteDescendant(node)
                );
                if (equivalentNodeParent != null) {
                    ussFileProvider.refreshElement(equivalentNodeParent);
                }
            } catch (err) {
                if (err instanceof Error) {
                    await AuthUtils.errorHandling(err, {
                        apiType: ZoweExplorerApiType.Uss,
                        profile: node.getProfile(),
                        scenario: vscode.l10n.t("Unable to create node:"),
                    });
                }
                throw err;
            }
        }
    }

    public static async refreshUSSInTree(node: IZoweUSSTreeNode, ussFileProvider: Types.IZoweUSSTreeType): Promise<void> {
        ZoweLogger.trace("uss.actions.refreshUSSInTree called.");
        await ussFileProvider.refreshElement(node);
    }

    public static async refreshDirectory(node: IZoweUSSTreeNode, ussFileProvider: Types.IZoweUSSTreeType): Promise<void> {
        ZoweLogger.trace("uss.actions.refreshDirectory called.");
        try {
            await node.getChildren();
            ussFileProvider.refreshElement(node);
        } catch (err) {
            await AuthUtils.errorHandling(err, { apiType: ZoweExplorerApiType.Uss, profile: node.getProfile() });
        }
    }

    /**
     * Marks file as deleted from disk
     *
     * @param {ZoweUSSNode} node
     */
    public static deleteFromDisk(node: IZoweUSSTreeNode, filePath: string): void {
        ZoweLogger.trace("uss.actions.deleteFromDisk called.");
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (err) {
            ZoweLogger.warn(err);
        }
    }

    public static async uploadDialog(node: IZoweUSSTreeNode, ussFileProvider: Types.IZoweUSSTreeType, isBinary?: boolean): Promise<void> {
        ZoweLogger.trace("uss.actions.uploadDialog called.");
        const fileOpenOptions = {
            canSelectFiles: true,
            openLabel: "Upload Files",
            canSelectMany: true,
            defaultUri: LocalFileManagement.getDefaultUri(),
        };

        const value = await Gui.showOpenDialog(fileOpenOptions);

        if (value?.length > 0) {
            await Gui.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: vscode.l10n.t("Uploading file to USS tree"),
                    cancellable: true,
                },
                async (progress, token) => {
                    let index = 0;
                    for (const item of value) {
                        if (token.isCancellationRequested) {
                            Gui.showMessage(vscode.l10n.t("Upload action was cancelled."));
                            break;
                        }
                        Gui.reportProgress(progress, value.length, index, "Uploading");
                        const binaryFile = isBinaryFileSync(item.fsPath);
                        if (isBinary || binaryFile) {
                            await USSActions.uploadBinaryFile(node, item.fsPath);
                        } else {
                            const doc = await vscode.workspace.openTextDocument(item);
                            await USSActions.uploadFile(node, doc);
                        }
                    }
                    index++;
                }
            );
            ussFileProvider.refreshElement(node);
            ussFileProvider.getTreeView().reveal(node, { expand: true, focus: true });
        } else {
            Gui.showMessage(vscode.l10n.t("Operation cancelled"));
        }
    }

    public static async uploadBinaryFile(node: IZoweUSSTreeNode, filePath: string): Promise<void> {
        ZoweLogger.trace("uss.actions.uploadBinaryFile called.");
        try {
            const localFileName = path.parse(filePath).base;
            const ussName = `${node.fullPath}/${localFileName}`;
            await ZoweExplorerApiRegister.getUssApi(node.getProfile()).putContent(filePath, ussName, { binary: true });
        } catch (e) {
            await AuthUtils.errorHandling(e, { apiType: ZoweExplorerApiType.Uss, profile: node.getProfile() });
        }
    }

    public static async uploadFile(node: IZoweUSSTreeNode, doc: vscode.TextDocument): Promise<void> {
        ZoweLogger.trace("uss.actions.uploadFile called.");
        try {
            const localFileName = path.parse(doc.fileName).base;
            const ussName = `${node.fullPath}/${localFileName}`;
            const prof = node.getProfile();

            const task: imperative.ITaskWithStatus = {
                percentComplete: 0,
                statusMessage: vscode.l10n.t("Uploading USS file"),
                stageName: 0, // TaskStage.IN_PROGRESS - https://github.com/kulshekhar/ts-jest/issues/281
            };
            const options: zosfiles.IUploadOptions = {
                task,
                responseTimeout: prof.profile?.responseTimeout,
            };
            if (prof.profile.encoding) {
                options.encoding = prof.profile.encoding;
            }
            await ZoweExplorerApiRegister.getUssApi(prof).putContent(doc.fileName, ussName, options);
        } catch (e) {
            await AuthUtils.errorHandling(e, { apiType: ZoweExplorerApiType.Uss, profile: node.getProfile() });
        }
    }

    public static editAttributes(context: vscode.ExtensionContext, fileProvider: Types.IZoweUSSTreeType, node: IZoweUSSTreeNode): USSAttributeView {
        return new USSAttributeView(context, fileProvider, node);
    }

    /**
     * Copies full path for the selected Zowe USS node
     *
     * @param {ZoweUSSNode} node
     */
    public static copyPath(node: IZoweUSSTreeNode): void {
        ZoweLogger.trace("uss.actions.copyPath called.");
        vscode.env.clipboard.writeText(node.fullPath);
    }

    public static async deleteUSSFilesPrompt(
        node: IZoweUSSTreeNode,
        nodeList: IZoweUSSTreeNode[],
        ussFileProvider: Types.IZoweUSSTreeType
    ): Promise<void> {
        ZoweLogger.trace("uss.actions.deleteUSSFilesPrompt called.");
        let selectedNodes;
        if (node || nodeList) {
            selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList) as IZoweUSSTreeNode[];
        } else {
            selectedNodes = ussFileProvider.getTreeView().selection;
        }
        selectedNodes = selectedNodes.filter((x) => SharedContext.isDocument(x) || SharedContext.isUssDirectory(x) || SharedContext.isBinary(x));
        const fileNames = selectedNodes.map(({ label }) => label.toString());
        const displayedFileNames = fileNames.slice(0, Constants.MAX_DISPLAYED_DELETE_NAMES).join("\n");
        const additionalFilesCount = fileNames.length - Constants.MAX_DISPLAYED_DELETE_NAMES;
        const message = vscode.l10n.t({
            message:
                "Are you sure you want to delete the following item?\n" +
                "This will permanently remove the following file or folder from your system.\n\n{0}{1}",
            args: [displayedFileNames, additionalFilesCount > 0 ? `\n...and ${additionalFilesCount} more` : ""],
            comment: ["File names", "Additional files count"],
        });
        const deleteButton = vscode.l10n.t("Delete");
        let cancelled = false;
        await Gui.warningMessage(message, {
            items: [deleteButton],
            vsCodeOpts: { modal: true },
        }).then((selection) => {
            if (!selection || selection === "Cancel") {
                ZoweLogger.debug(vscode.l10n.t("Delete action was canceled."));
                cancelled = true;
            }
        });
        for (const item of selectedNodes) {
            await item.deleteUSSNode(ussFileProvider, "", cancelled);
        }
    }

    /**
     * Builds a file/directory structure that can be traversed from root to the innermost children.
     *
     * @param node Build a tree structure starting at this node
     * @returns A tree structure containing all files/directories within this node
     */
    public static async buildFileStructure(node: IZoweUSSTreeNode): Promise<USSFileStructure.UssFileTree> {
        ZoweLogger.trace("uss.actions.buildFileStructure called.");
        if (SharedContext.isUssDirectory(node)) {
            const directory: USSFileStructure.UssFileTree = {
                localUri: node.resourceUri,
                ussPath: node.fullPath,
                baseName: node.getLabel() as string,
                sessionName: node.getSessionNode().getLabel() as string,
                type: USSFileStructure.UssFileType.Directory,
                children: [],
            };

            const children = await node.getChildren();
            if (children != null && children.length > 0) {
                for (const child of children) {
                    // This node is either another directory or a file
                    const subnode = await USSActions.buildFileStructure(child);
                    directory.children.push(subnode);
                }
            }

            return directory;
        }

        return {
            binary: (await node.getEncoding())?.kind === "binary",
            localUri: node.resourceUri,
            ussPath: node.fullPath,
            baseName: node.getLabel() as string,
            sessionName: node.getSessionNode().getLabel() as string,
            type: USSFileStructure.UssFileType.File,
        };
    }

    /**
     * Collects USS file info and builds a tree used for copying and pasting files/folders.
     *
     * @param selectedNodes The list of USS tree nodes that were selected for copying.
     * @returns A file tree containing the USS file/directory paths to be pasted.
     */
    public static async ussFileStructure(selectedNodes: IZoweUSSTreeNode[]): Promise<USSFileStructure.UssFileTree> {
        ZoweLogger.trace("uss.actions.ussFileStructure called.");
        const rootStructure: USSFileStructure.UssFileTree = {
            ussPath: "",
            type: USSFileStructure.UssFileType.Directory,
            children: [],
        };

        for (const node of selectedNodes) {
            rootStructure.children.push(await USSActions.buildFileStructure(node));
        }

        return rootStructure;
    }

    /**
     * Helper function for `copyUssFiles` that will copy the USS file structure to a JSON
     * object, saving it into a clipboard for future use.
     *
     * @param selectedNodes The list of USS tree nodes that were selected for copying.
     */
    public static async copyUssFilesToClipboard(selectedNodes: IZoweUSSTreeNode[]): Promise<void> {
        ZoweLogger.trace("uss.actions.copyUssFilesToClipboard called.");
        const filePaths = await USSActions.ussFileStructure(selectedNodes);
        vscode.env.clipboard.writeText(JSON.stringify(filePaths));
    }

    public static async copyUssFiles(node: IZoweUSSTreeNode, nodeList: IZoweUSSTreeNode[], ussFileProvider: Types.IZoweUSSTreeType): Promise<void> {
        ZoweLogger.trace("uss.actions.copyUssFiles called.");
        let selectedNodes;
        if (node || nodeList) {
            selectedNodes = SharedUtils.getSelectedNodeList(node, nodeList) as IZoweUSSTreeNode[];
        } else {
            selectedNodes = ussFileProvider.getTreeView().selection;
        }
        await Gui.withProgress(
            {
                location: vscode.ProgressLocation.Window,
                title: vscode.l10n.t("Copying file structure..."),
            },
            () => {
                return USSActions.copyUssFilesToClipboard(selectedNodes);
            }
        );
    }

    public static async refreshChildNodesDirectory(node: IZoweUSSTreeNode): Promise<void> {
        ZoweLogger.trace("uss.actions.refreshChildNodesDirectory called.");
        const childNodes = await node.getChildren();
        if (childNodes != null && childNodes.length > 0) {
            for (const child of childNodes) {
                await USSActions.refreshChildNodesDirectory(child);
            }
        } else {
            if (node.contextValue !== Constants.USS_DIR_CONTEXT) {
                await node.refreshUSS();
            }
        }
    }

    /**
     * Paste copied USS nodes into the selected node.
     * @param ussFileProvider File provider for USS tree
     * @param node The node to paste within
     */
    public static async pasteUss(ussFileProvider: Types.IZoweUSSTreeType, node: IZoweUSSTreeNode): Promise<void> {
        ZoweLogger.trace("uss.actions.pasteUss called.");
        if (node.pasteUssTree == null) {
            await Gui.infoMessage(vscode.l10n.t("The paste operation is not supported for this node."));
            return;
        }
        await Gui.withProgress(
            {
                location: vscode.ProgressLocation.Window,
                title: vscode.l10n.t("Pasting files..."),
            },
            async () => {
                await node.pasteUssTree();
            }
        );
        ussFileProvider.refreshElement(node);
    }

    public static async copyRelativePath(node: IZoweUSSTreeNode): Promise<void> {
        const sesNode = node.getSessionNode();
        if (!node.fullPath) {
            ZoweLogger.warn(
                vscode.l10n.t({
                    message: "copyName was called on USS node {0}, but its fullPath is invalid.",
                    args: [node.label as string],
                    comment: "USS node label",
                })
            );
            return;
        }

        if (sesNode != null && !SharedContext.isFavorite(sesNode)) {
            let relPath = node.fullPath.replace(sesNode.fullPath, "");
            if (relPath.startsWith("/")) {
                relPath = relPath.slice(1);
            }
            await vscode.env.clipboard.writeText(relPath);
        } else {
            await vscode.env.clipboard.writeText(node.fullPath);
        }
    }
}
