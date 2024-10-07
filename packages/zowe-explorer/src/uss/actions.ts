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
import { imperative, IZosFilesResponse, IUploadOptions } from "@zowe/cli";
import * as fs from "fs";
import * as globals from "../globals";
import * as path from "path";
import { concatChildNodes, uploadContent, getSelectedNodeList, getDefaultUri } from "../shared/utils";
import { errorHandling } from "../utils/ProfilesUtils";
import { Gui, IZoweTree, IZoweUSSTreeNode } from "@zowe/zowe-explorer-api";
import { Profiles } from "../Profiles";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { isBinaryFileSync } from "isbinaryfile";
import * as contextually from "../shared/context";
import { markDocumentUnsaved, setFileSaved } from "../utils/workspace";
import * as nls from "vscode-nls";
import { refreshAll } from "../shared/refresh";
import { autoDetectEncoding, fileExistsCaseSensitiveSync } from "./utils";
import { UssFileTree, UssFileType } from "./FileStructure";
import { ZoweLogger } from "../utils/LoggerUtils";
import { AttributeView } from "./AttributeView";
import { resolveFileConflict } from "../shared/actions";
import { LocalFileManagement } from "../utils/LocalFileManagement";

// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

/**
 * Prompts the user for a path, and populates the [TreeView]{@link vscode.TreeView} based on the path
 *
 * @param {ZoweUSSNode} node - The session node
 * @param {ussTree} ussFileProvider - Current ussTree used to populate the TreeView
 * @returns {Promise<void>}
 */
export async function createUSSNode(node: IZoweUSSTreeNode, ussFileProvider: IZoweTree<IZoweUSSTreeNode>, nodeType: string): Promise<void> {
    ZoweLogger.trace("uss.actions.createUSSNode called.");
    await ussFileProvider.checkCurrentProfile(node);
    let filePath = "";
    const isTopLevel = contextually.isSession(node);
    if (isTopLevel && node.fullPath?.length === 0) {
        const filePathOptions: vscode.InputBoxOptions = {
            placeHolder: localize("createUSSNode.inputBox.placeholder", "{0} location", nodeType),
            prompt: localize("createUSSNode.inputBox.prompt", "Choose a location to create the {0}", nodeType),
            value: node.tooltip as string,
        };
        filePath = await Gui.showInputBox(filePathOptions);
    } else {
        filePath = node.fullPath;
    }

    if (filePath == null || filePath.length === 0) {
        return;
    }

    const nameOptions: vscode.InputBoxOptions = {
        placeHolder: localize("createUSSNode.name", "Name of file or directory"),
    };
    const name = await Gui.showInputBox(nameOptions);
    if (name && filePath) {
        try {
            filePath = path.posix.join(filePath, name);
            await ZoweExplorerApiRegister.getUssApi(node.getProfile()).create(filePath, nodeType);
            if (isTopLevel) {
                await refreshAll(ussFileProvider);
            } else {
                ussFileProvider.refreshElement(node);
            }
            const newNode = await node.getChildren().then((children) => children.find((child) => child.label === name));
            await ussFileProvider.getTreeView().reveal(node, { select: true, focus: true });
            ussFileProvider.getTreeView().reveal(newNode, { select: true, focus: true });
            const localPath = `${node.getUSSDocumentFilePath()}/${name}`;
            const fileExists = fs.existsSync(localPath);
            if (fileExists && !fileExistsCaseSensitiveSync(localPath)) {
                Gui.showMessage(
                    localize(
                        "createUSSNode.name.exists",
                        // eslint-disable-next-line max-len
                        "There is already a file with the same name. Please change your OS file system settings if you want to give case sensitive file names."
                    )
                );
                ussFileProvider.refreshElement(node);
            }
        } catch (err) {
            if (err instanceof Error) {
                await errorHandling(err, node.getProfileName(), localize("createUSSNode.error.create", "Unable to create node:"));
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

export async function uploadDialog(node: IZoweUSSTreeNode, ussFileProvider: IZoweTree<IZoweUSSTreeNode>, isBinary?: boolean): Promise<void> {
    ZoweLogger.trace("uss.actions.uploadDialog called.");
    const fileOpenOptions = {
        canSelectFiles: true,
        openLabel: "Upload Files",
        canSelectMany: true,
        defaultUri: getDefaultUri(),
    };

    const value = await Gui.showOpenDialog(fileOpenOptions);
    if (value?.length > 0) {
        await Gui.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: localize("uploadFile.response.upload.title", "Uploading file to USS tree"),
                cancellable: true,
            },
            async (progress, token) => {
                let index = 0;
                for (const item of value) {
                    if (token.isCancellationRequested) {
                        Gui.showMessage(localize("uploadFile.uploadCancelled", "Upload action was cancelled."));
                        break;
                    }
                    Gui.reportProgress(progress, value.length, index, "Uploading");
                    const binaryFile = isBinaryFileSync(item.fsPath);
                    if (isBinary || binaryFile) {
                        await uploadBinaryFile(node, item.fsPath);
                    } else {
                        const doc = await vscode.workspace.openTextDocument(item);
                        await uploadFile(node, doc);
                    }
                }
                index++;
            }
        );
        ussFileProvider.refreshElement(node);
        ussFileProvider.getTreeView().reveal(node, { expand: true, focus: true });
    } else {
        Gui.showMessage(localize("uploadFile.operationCancelled", "Operation Cancelled"));
    }
}

export async function uploadBinaryFile(node: IZoweUSSTreeNode, filePath: string): Promise<void> {
    ZoweLogger.trace("uss.actions.uploadBinaryFile called.");
    try {
        const localFileName = path.parse(filePath).base;
        const ussName = `${node.fullPath}/${localFileName}`;
        await ZoweExplorerApiRegister.getUssApi(node.getProfile()).putContents(filePath, ussName, true);
    } catch (e) {
        await errorHandling(e, node.getProfileName());
    }
}

export async function uploadFile(node: IZoweUSSTreeNode, doc: vscode.TextDocument): Promise<void> {
    ZoweLogger.trace("uss.actions.uploadFile called.");
    try {
        const localFileName = path.parse(doc.fileName).base;
        const ussName = `${node.fullPath}/${localFileName}`;
        const prof = node.getProfile();

        // if new api method exists, use it
        if (ZoweExplorerApiRegister.getUssApi(prof).putContent) {
            const task: imperative.ITaskWithStatus = {
                percentComplete: 0,
                statusMessage: localize("uploadFile.putContents", "Uploading USS file"),
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
        } else {
            await ZoweExplorerApiRegister.getUssApi(prof).putContents(doc.fileName, ussName);
        }
    } catch (e) {
        await errorHandling(e, node.getProfileName());
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
        Gui.showMessage(localize("copyPath.infoMessage", "Copy Path is not yet supported in Theia."));
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

/**
 * Uploads the file to the mainframe
 *
 * @export
 * @param {Session} session - Desired session
 * @param {vscode.TextDocument} doc - TextDocument that is being saved
 */
export async function saveUSSFile(doc: vscode.TextDocument, ussFileProvider: IZoweTree<IZoweUSSTreeNode>): Promise<void> {
    ZoweLogger.trace("uss.actions.saveUSSFile called.");
    ZoweLogger.debug(localize("saveUSSFile.log.debug.saveRequest", "save requested for USS file ") + doc.fileName);
    const start = path.join(globals.USS_DIR + path.sep).length;
    const ending = doc.fileName.substring(start);
    const sesName = ending.substring(0, ending.indexOf(path.sep));
    const profile = Profiles.getInstance().loadNamedProfile(sesName);
    if (!profile) {
        const sessionError = localize("saveUSSFile.session.error", "Could not locate session when saving USS file.");
        ZoweLogger.error(sessionError);
        await Gui.errorMessage(sessionError);
        return;
    }

    // TODO Handle case where same USS file is open as both favorite and non-favorite to prevent desync between equivalent nodes
    const isFavorite =
        ussFileProvider.openFiles?.[doc.uri.fsPath] != null && contextually.isFavoriteDescendant(ussFileProvider.openFiles[doc.uri.fsPath]);
    const sesNode = (isFavorite ? ussFileProvider.mFavorites : ussFileProvider.mSessionNodes).find(
        (child) => child.label.toString().trim() === sesName
    );
    if (!sesNode) {
        // if saving from favorites, a session might not exist for this node
        ZoweLogger.debug(localize("saveUSSFile.missingSessionNode", "Could not find session node"));
    }

    const remote = ending.substring(sesName.length).replace(/\\/g, "/");
    // Get specific node based on label and parent tree (session / favorites)
    const nodes: IZoweUSSTreeNode[] = concatChildNodes(sesNode ? [sesNode] : ussFileProvider.mSessionNodes);
    const node: IZoweUSSTreeNode =
        nodes.find((zNode) => {
            if (contextually.isText(zNode) || contextually.isBinary(zNode)) {
                return zNode.fullPath.trim() === remote;
            } else {
                return false;
            }
        }) ?? ussFileProvider.openFiles?.[doc.uri.fsPath];

    // define upload options
    const etagToUpload = node?.getEtag();
    const returnEtag = etagToUpload != null;

    const prof = node?.getProfile() ?? profile;
    try {
        await autoDetectEncoding(node, prof);

        const uploadResponse: IZosFilesResponse = await Gui.withProgress(
            {
                location: vscode.ProgressLocation.Window,
                title: localize("saveUSSFile.response.title", "Saving file..."),
            },
            () => {
                return uploadContent(node, doc, remote, prof, etagToUpload, returnEtag);
            }
        );
        if (uploadResponse.success) {
            Gui.setStatusBarMessage(uploadResponse.commandResponse, globals.STATUS_BAR_TIMEOUT_MS);
            // set local etag with the new etag from the updated file on mainframe
            node?.setEtag(uploadResponse.apiResponse.etag);
            setFileSaved(true);
            LocalFileManagement.removeRecoveredFile(doc);
            // this part never runs! zowe.Upload.fileToUSSFile doesn't return success: false, it just throws the error which is caught below!!!!!
        } else {
            await markDocumentUnsaved(doc);
            Gui.errorMessage(uploadResponse.commandResponse);
        }
    } catch (err) {
        // TODO: error handling must not be zosmf specific
        const errorMessage = err ? err.message : err.toString();
        if (errorMessage.includes("Rest API failure with HTTP(S) status 412")) {
            resolveFileConflict(node, prof, doc, remote);
        } else {
            await markDocumentUnsaved(doc);
            await errorHandling(err, sesName);
        }
    }
}

export async function deleteUSSFilesPrompt(nodes: IZoweUSSTreeNode[]): Promise<boolean> {
    ZoweLogger.trace("uss.actions.deleteUSSFilesPrompt called.");
    const fileNames = nodes.reduce((label, currentVal) => {
        return label + currentVal.label.toString() + "\n";
    }, "");

    const deleteButton = localize("deleteUssPrompt.confirmation.delete", "Delete");
    const message = localize(
        "deleteUssPrompt.confirmation.message",
        "Are you sure you want to delete the following item?\nThis will permanently remove the following file or folder from your system.\n\n{0}",
        fileNames.toString()
    );
    let cancelled = false;
    await Gui.warningMessage(message, {
        items: [deleteButton],
        vsCodeOpts: { modal: true },
    }).then((selection) => {
        if (!selection || selection === "Cancel") {
            ZoweLogger.debug(localize("deleteUssPrompt.confirmation.cancel.log.debug", "Delete action was canceled."));
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
            localPath: node.getUSSDocumentFilePath(),
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
        localPath: node.getUSSDocumentFilePath(),
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
            title: localize("ZoweUssNode.copyDownload.progress", "Copying file structure..."),
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
        await Gui.infoMessage(localize("uss.paste.apiNotAvailable", "The paste operation is not supported for this node."));
        return;
    }
    await Gui.withProgress(
        {
            location: vscode.ProgressLocation.Window,
            title: localize("ZoweUssNode.copyUpload.progress", "Pasting files..."),
        },
        async () => {
            await (node.pasteUssTree ? node.pasteUssTree() : node.copyUssFile());
        }
    );
    ussFileProvider.refreshElement(node);
}

export async function copyRelativePath(node: IZoweUSSTreeNode): Promise<void> {
    const sesNode = node.getSessionNode();
    if (!node.fullPath) {
        await vscode.env.clipboard.writeText(node.label as string);
        return;
    }

    if (sesNode != null && !contextually.isFavorite(sesNode)) {
        let relPath = node.fullPath.replace(sesNode.fullPath, "");
        if (relPath.startsWith("/")) {
            relPath = relPath.slice(1);
        }
        await vscode.env.clipboard.writeText(relPath);
    } else {
        await vscode.env.clipboard.writeText(node.fullPath);
    }
}
