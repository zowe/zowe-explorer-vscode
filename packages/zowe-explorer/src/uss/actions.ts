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
import { imperative } from "@zowe/cli";
import * as fs from "fs";
import * as globals from "../globals";
import * as path from "path";
import { getSelectedNodeList, LocalFileInfo } from "../shared/utils";
import { errorHandling } from "../utils/ProfilesUtils";
import { Gui, ValidProfileEnum, IZoweTree, IZoweUSSTreeNode } from "@zowe/zowe-explorer-api";
import { Profiles } from "../Profiles";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { isBinaryFileSync } from "isbinaryfile";
import * as contextually from "../shared/context";
import { refreshAll } from "../shared/refresh";
import { IUploadOptions } from "@zowe/zos-files-for-zowe-sdk";
import { fileExistsCaseSensitveSync } from "./utils";
import { UssFileTree, UssFileType } from "./FileStructure";
import { ZoweLogger } from "../utils/LoggerUtils";
import { AttributeView } from "./AttributeView";
import { LocalFileManagement } from "../utils/LocalFileManagement";

/**
 * Prompts the user for a path, and populates the [TreeView]{@link vscode.TreeView} based on the path
 *
 * @param {ZoweUSSNode} node - The session node
 * @param {ussTree} ussFileProvider - Current ussTree used to populate the TreeView
 * @returns {Promise<void>}
 */
export async function createUSSNode(
    node: IZoweUSSTreeNode,
    ussFileProvider: IZoweTree<IZoweUSSTreeNode>,
    nodeType: string,
    isTopLevel?: boolean
): Promise<void> {
    ZoweLogger.trace("uss.actions.createUSSNode called.");
    await ussFileProvider.checkCurrentProfile(node);
    let filePath = "";
    if (contextually.isSession(node)) {
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
    } else {
        filePath = node.fullPath;
    }
    const nameOptions: vscode.InputBoxOptions = {
        placeHolder: vscode.l10n.t("Name of file or directory"),
    };
    const name = await Gui.showInputBox(nameOptions);
    if (name && filePath) {
        try {
            filePath = `${filePath}/${name}`;
            const uri = node.resourceUri.with({ path: path.posix.join(node.resourceUri.path, name) });
            await ZoweExplorerApiRegister.getUssApi(node.getProfile()).create(filePath, nodeType);
            if (nodeType === "file") {
                await vscode.workspace.fs.writeFile(uri, new Uint8Array());
            } else {
                await vscode.workspace.fs.createDirectory(uri);
            }
            if (isTopLevel) {
                await refreshAll(ussFileProvider);
            } else {
                ussFileProvider.refreshElement(node);
            }
            const newNode = await node.getChildren().then((children) => children.find((child) => child.label === name));
            await ussFileProvider.getTreeView().reveal(node, { select: true, focus: true });
            ussFileProvider.getTreeView().reveal(newNode, { select: true, focus: true });
        } catch (err) {
            if (err instanceof Error) {
                await errorHandling(err, node.mProfileName, vscode.l10n.t("Unable to create node:"));
            }
            throw err;
        }
    }
}

export async function refreshUSSInTree(node: IZoweUSSTreeNode, ussFileProvider: IZoweTree<IZoweUSSTreeNode>): Promise<void> {
    ZoweLogger.trace("uss.actions.refreshUSSInTree called.");
    await ussFileProvider.refreshElement(node);
}

export async function refreshDirectory(node: IZoweUSSTreeNode, ussFileProvider: IZoweTree<IZoweUSSTreeNode>): Promise<void> {
    ZoweLogger.trace("uss.actions.refreshDirectory called.");
    try {
        await node.getChildren();
        ussFileProvider.refreshElement(node);
    } catch (err) {
        await errorHandling(err, node.getProfileName());
    }
}

export async function createUSSNodeDialog(node: IZoweUSSTreeNode, ussFileProvider: IZoweTree<IZoweUSSTreeNode>): Promise<void> {
    ZoweLogger.trace("uss.actions.createUSSNodeDialog called.");
    await ussFileProvider.checkCurrentProfile(node);
    if (Profiles.getInstance().validProfile === ValidProfileEnum.VALID || Profiles.getInstance().validProfile === ValidProfileEnum.UNVERIFIED) {
        const quickPickOptions: vscode.QuickPickOptions = {
            placeHolder: `What would you like to create at ${node.fullPath}?`,
            ignoreFocusOut: true,
            canPickMany: false,
        };
        const type = await Gui.showQuickPick([globals.USS_DIR_CONTEXT, "File"], quickPickOptions);
        const isTopLevel = true;
        return createUSSNode(node, ussFileProvider, type, isTopLevel);
    }
}

/**
 * Marks file as deleted from disk
 *
 * @param {ZoweUSSNode} node
 */
export function deleteFromDisk(node: IZoweUSSTreeNode, filePath: string): void {
    ZoweLogger.trace("uss.actions.deleteFromDisk called.");
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (err) {
        ZoweLogger.warn(err);
    }
}

export async function uploadDialog(node: IZoweUSSTreeNode, ussFileProvider: IZoweTree<IZoweUSSTreeNode>): Promise<void> {
    ZoweLogger.trace("uss.actions.uploadDialog called.");
    const fileOpenOptions = {
        canSelectFiles: true,
        openLabel: "Upload Files",
        canSelectMany: true,
        defaultUri: LocalFileManagement.getDefaultUri(),
    };

    const value = await Gui.showOpenDialog(fileOpenOptions);

    await Promise.all(
        value.map(async (item) => {
            const isBinary = isBinaryFileSync(item.fsPath);

            if (isBinary) {
                await uploadBinaryFile(node, item.fsPath);
            } else {
                const doc = await vscode.workspace.openTextDocument(item);
                await uploadFile(node, doc);
            }
        })
    );
    ussFileProvider.refreshElement(node);
}

export async function uploadBinaryFile(node: IZoweUSSTreeNode, filePath: string): Promise<void> {
    ZoweLogger.trace("uss.actions.uploadBinaryFile called.");
    try {
        const localFileName = path.parse(filePath).base;
        const ussName = `${node.fullPath}/${localFileName}`;
        await ZoweExplorerApiRegister.getUssApi(node.getProfile()).putContent(filePath, ussName, { binary: true });
    } catch (e) {
        await errorHandling(e, node.mProfileName);
    }
}

export async function uploadFile(node: IZoweUSSTreeNode, doc: vscode.TextDocument): Promise<void> {
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
        const options: IUploadOptions = {
            task,
            responseTimeout: prof.profile?.responseTimeout,
        };
        if (prof.profile.encoding) {
            options.encoding = prof.profile.encoding;
        }
        await ZoweExplorerApiRegister.getUssApi(prof).putContent(doc.fileName, ussName, options);
    } catch (e) {
        await errorHandling(e, node.mProfileName);
    }
}

export function editAttributes(context: vscode.ExtensionContext, fileProvider: IZoweTree<IZoweUSSTreeNode>, node: IZoweUSSTreeNode): AttributeView {
    return new AttributeView(context, fileProvider, node);
}

/**
 * Copies full path for the selected Zowe USS node
 *
 * @param {ZoweUSSNode} node
 */
export function copyPath(node: IZoweUSSTreeNode): void {
    ZoweLogger.trace("uss.actions.copyPath called.");
    if (globals.ISTHEIA) {
        // Remove when Theia supports VS Code API for accessing system clipboard
        Gui.showMessage(vscode.l10n.t("Copy Path is not yet supported in Theia."));
        return;
    }
    vscode.env.clipboard.writeText(node.fullPath);
}

/**
 * Switch the download type and redownload the file.
 *
 * @param node The file that is going to be downloaded
 * @param binary Whether the file should be downloaded as binary or not
 * @param ussFileProvider Our USSTree object
 */
export async function changeFileType(node: IZoweUSSTreeNode, binary: boolean, ussFileProvider: IZoweTree<IZoweUSSTreeNode>): Promise<void> {
    ZoweLogger.trace("uss.actions.changeFileType called.");
    node.setBinary(binary);
    await node.openUSS(true, true, ussFileProvider);
    ussFileProvider.refresh();
}

export async function deleteUSSFilesPrompt(nodes: IZoweUSSTreeNode[]): Promise<boolean> {
    ZoweLogger.trace("uss.actions.deleteUSSFilesPrompt called.");
    const fileNames = nodes.reduce((label, currentVal) => {
        return label + currentVal.label.toString() + "\n";
    }, "");

    const deleteButton = vscode.l10n.t("Delete");
    const message = vscode.l10n.t({
        message:
            "Are you sure you want to delete the following item?\nThis will permanently remove the following file or folder from your system.\n\n{0}",
        args: [fileNames.toString()],
        comment: ["File names"],
    });
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
    return cancelled;
}

/**
 * Builds a file/directory structure that can be traversed from root to the innermost children.
 *
 * @param node Build a tree structure starting at this node
 * @returns A tree structure containing all files/directories within this node
 */
export async function buildFileStructure(node: IZoweUSSTreeNode): Promise<UssFileTree> {
    ZoweLogger.trace("uss.actions.buildFileStructure called.");
    if (contextually.isUssDirectory(node)) {
        const directory: UssFileTree = {
            localUri: node.resourceUri,
            ussPath: node.fullPath,
            baseName: node.getLabel() as string,
            sessionName: node.getSessionNode().getLabel() as string,
            type: UssFileType.Directory,
            children: [],
        };

        const children = await node.getChildren();
        if (children != null && children.length > 0) {
            for (const child of children) {
                // This node is either another directory or a file
                const subnode = await buildFileStructure(child);
                directory.children.push(subnode);
            }
        }

        return directory;
    }

    return {
        children: [],
        binary: node.binary,
        localUri: node.resourceUri,
        ussPath: node.fullPath,
        baseName: node.getLabel() as string,
        sessionName: node.getSessionNode().getLabel() as string,
        type: UssFileType.File,
    };
}

/**
 * Collects USS file info and builds a tree used for copying and pasting files/folders.
 *
 * @param selectedNodes The list of USS tree nodes that were selected for copying.
 * @returns A file tree containing the USS file/directory paths to be pasted.
 */
export async function ussFileStructure(selectedNodes: IZoweUSSTreeNode[]): Promise<UssFileTree> {
    ZoweLogger.trace("uss.actions.ussFileStructure called.");
    const rootStructure: UssFileTree = {
        ussPath: "",
        type: UssFileType.Directory,
        children: [],
    };

    for (const node of selectedNodes) {
        rootStructure.children.push(await buildFileStructure(node));
    }

    return rootStructure;
}

/**
 * Helper function for `copyUssFiles` that will copy the USS file structure to a JSON
 * object, saving it into a clipboard for future use.
 *
 * @param selectedNodes The list of USS tree nodes that were selected for copying.
 */
export async function copyUssFilesToClipboard(selectedNodes: IZoweUSSTreeNode[]): Promise<void> {
    ZoweLogger.trace("uss.actions.copyUssFilesToClipboard called.");
    const filePaths = await ussFileStructure(selectedNodes);
    vscode.env.clipboard.writeText(JSON.stringify(filePaths));
}

export async function copyUssFiles(
    node: IZoweUSSTreeNode,
    nodeList: IZoweUSSTreeNode[],
    ussFileProvider: IZoweTree<IZoweUSSTreeNode>
): Promise<void> {
    ZoweLogger.trace("uss.actions.copyUssFiles called.");
    let selectedNodes;
    if (node || nodeList) {
        selectedNodes = getSelectedNodeList(node, nodeList) as IZoweUSSTreeNode[];
    } else {
        selectedNodes = ussFileProvider.getTreeView().selection;
    }
    await Gui.withProgress(
        {
            location: vscode.ProgressLocation.Window,
            title: vscode.l10n.t("Copying file structure..."),
        },
        () => {
            return copyUssFilesToClipboard(selectedNodes);
        }
    );
}

export async function refreshChildNodesDirectory(node: IZoweUSSTreeNode): Promise<void> {
    ZoweLogger.trace("uss.actions.refreshChildNodesDirectory called.");
    const childNodes = await node.getChildren();
    if (childNodes != null && childNodes.length > 0) {
        for (const child of childNodes) {
            await refreshChildNodesDirectory(child);
        }
    } else {
        if (node.contextValue !== globals.USS_DIR_CONTEXT) {
            await node.refreshUSS();
        }
    }
}

/**
 * @deprecated use `pasteUss`
 * @param ussFileProvider File provider for USS tree
 * @param node The node to paste within
 */
export async function pasteUssFile(ussFileProvider: IZoweTree<IZoweUSSTreeNode>, node: IZoweUSSTreeNode): Promise<void> {
    ZoweLogger.trace("uss.actions.pasteUssFile called.");
    return pasteUss(ussFileProvider, node);
}

/**
 * Paste copied USS nodes into the selected node.
 * @param ussFileProvider File provider for USS tree
 * @param node The node to paste within
 */
export async function pasteUss(ussFileProvider: IZoweTree<IZoweUSSTreeNode>, node: IZoweUSSTreeNode): Promise<void> {
    ZoweLogger.trace("uss.actions.pasteUss called.");
    if (node.pasteUssTree == null && node.copyUssFile == null) {
        await Gui.infoMessage(vscode.l10n.t("The paste operation is not supported for this node."));
        return;
    }
    await Gui.withProgress(
        {
            location: vscode.ProgressLocation.Window,
            title: vscode.l10n.t("Pasting files..."),
        },
        async () => {
            await (node.pasteUssTree ? node.pasteUssTree() : node.copyUssFile());
        }
    );
    ussFileProvider.refreshElement(node);
}

export async function downloadUnixFile(node: IZoweUSSTreeNode, download: boolean): Promise<LocalFileInfo> {
    const fileInfo = {} as LocalFileInfo;
    const errorMsg = vscode.l10n.t("open() called from invalid node.");
    switch (true) {
        // For opening favorited and non-favorited files
        case node.getParent().contextValue === globals.FAV_PROFILE_CONTEXT:
            break;
        case contextually.isUssSession(node.getParent()):
            break;
        // Handle file path for files in directories and favorited directories
        case contextually.isUssDirectory(node.getParent()):
            break;
        default:
            Gui.errorMessage(errorMsg);
            throw Error(errorMsg);
    }

    fileInfo.path = node.getUSSDocumentFilePath();
    fileInfo.name = String(node.label);
    // check if some other file is already created with the same name avoid opening file warn user
    const fileExists = fs.existsSync(fileInfo.path);
    if (fileExists && !fileExistsCaseSensitveSync(fileInfo.path)) {
        Gui.showMessage(
            vscode.l10n.t(
                `There is already a file with the same name. 
                Please change your OS file system settings if you want to give case sensitive file names`
            )
        );
        return;
    }
    // if local copy exists, open that instead of pulling from mainframe
    if (download || !fileExists) {
        try {
            const cachedProfile = Profiles.getInstance().loadNamedProfile(node.getProfileName());
            const fullPath = node.fullPath;
            const chooseBinary = node.binary || (await ZoweExplorerApiRegister.getUssApi(cachedProfile).isFileTagBinOrAscii(fullPath));

            const statusMsg = Gui.setStatusBarMessage(vscode.l10n.t("$(sync~spin) Downloading USS file..."));
            const response = await ZoweExplorerApiRegister.getUssApi(cachedProfile).getContents(fullPath, {
                file: fileInfo.path,
                binary: chooseBinary,
                returnEtag: true,
                encoding: cachedProfile.profile?.encoding,
                responseTimeout: cachedProfile.profile?.responseTimeout,
            });
            statusMsg.dispose();
            node.setEtag(response.apiResponse.etag);
            return fileInfo;
        } catch (err) {
            await errorHandling(err, this.mProfileName);
            throw err;
        }
    }
}
