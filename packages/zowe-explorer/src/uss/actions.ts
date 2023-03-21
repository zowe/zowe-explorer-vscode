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
import { imperative, IZosFilesResponse } from "@zowe/cli";
import * as fs from "fs";
import * as globals from "../globals";
import * as path from "path";
import { concatChildNodes, willForceUpload, uploadContent, getSelectedNodeList } from "../shared/utils";
import { errorHandling } from "../utils/ProfilesUtils";
import { Gui, ValidProfileEnum, IZoweTree, IZoweUSSTreeNode } from "@zowe/zowe-explorer-api";
import { Profiles } from "../Profiles";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { isBinaryFileSync } from "isbinaryfile";
import * as contextually from "../shared/context";
import { markDocumentUnsaved, setFileSaved } from "../utils/workspace";
import * as nls from "vscode-nls";
import { refreshAll } from "../shared/refresh";
import { IUploadOptions } from "@zowe/zos-files-for-zowe-sdk";
import { fileExistsCaseSensitveSync } from "./utils";
import { UssFileTree, UssFileType } from "./FileStructure";

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
export async function createUSSNode(node: IZoweUSSTreeNode, ussFileProvider: IZoweTree<IZoweUSSTreeNode>, nodeType: string, isTopLevel?: boolean) {
    await ussFileProvider.checkCurrentProfile(node);
    let filePath;
    if (contextually.isSession(node)) {
        const filePathOptions: vscode.InputBoxOptions = {
            placeHolder: localize("createUSSNode.inputBox.placeholder", "{0} location", nodeType),
            prompt: localize("createUSSNode.inputBox.prompt", "Choose a location to create the {0}", nodeType),
            value: node.tooltip as string,
        };
        filePath = await Gui.showInputBox(filePathOptions);
    } else {
        filePath = node.fullPath;
    }
    const nameOptions: vscode.InputBoxOptions = {
        placeHolder: localize("createUSSNode.name", "Name of file or directory"),
    };
    const name = await Gui.showInputBox(nameOptions);
    if (name && filePath) {
        try {
            filePath = `${filePath}/${name}`;
            await ZoweExplorerApiRegister.getUssApi(node.getProfile()).create(filePath, nodeType);
            if (isTopLevel) {
                refreshAll(ussFileProvider);
            } else {
                ussFileProvider.refreshElement(node);
            }
            const newNode = await node.getChildren().then((children) => children.find((child) => child.label === name));
            await ussFileProvider.getTreeView().reveal(node, { select: true, focus: true });
            ussFileProvider.getTreeView().reveal(newNode, { select: true, focus: true });
            const localPath = `${node.getUSSDocumentFilePath()}/${name}`;
            const fileExists = fs.existsSync(localPath);
            if (fileExists && !fileExistsCaseSensitveSync(localPath)) {
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
            await errorHandling(err, node.mProfileName, localize("createUSSNode.error.create", "Unable to create node: ") + err.message);
            throw err;
        }
    }
}

export async function refreshUSSInTree(node: IZoweUSSTreeNode, ussFileProvider: IZoweTree<IZoweUSSTreeNode>) {
    await ussFileProvider.refreshElement(node);
}

export async function refreshDirectory(node: IZoweUSSTreeNode, ussFileProvider: IZoweTree<IZoweUSSTreeNode>) {
    try {
        await node.getChildren();
        ussFileProvider.refreshElement(node);
    } catch (err) {
        await errorHandling(err, node.getProfileName(), err.message);
    }
}

export async function createUSSNodeDialog(node: IZoweUSSTreeNode, ussFileProvider: IZoweTree<IZoweUSSTreeNode>) {
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
export async function deleteFromDisk(node: IZoweUSSTreeNode, filePath: string) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (err) {
        globals.LOG.warn(err);
    }
}

export async function uploadDialog(node: IZoweUSSTreeNode, ussFileProvider: IZoweTree<IZoweUSSTreeNode>) {
    const fileOpenOptions = {
        canSelectFiles: true,
        openLabel: "Upload Files",
        canSelectMany: true,
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
    ussFileProvider.refresh();
}

export async function uploadBinaryFile(node: IZoweUSSTreeNode, filePath: string) {
    try {
        const localFileName = path.parse(filePath).base;
        const ussName = `${node.fullPath}/${localFileName}`;
        await ZoweExplorerApiRegister.getUssApi(node.getProfile()).putContents(filePath, ussName, true);
    } catch (e) {
        await errorHandling(e, node.mProfileName, e.message);
    }
}

export async function uploadFile(node: IZoweUSSTreeNode, doc: vscode.TextDocument) {
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
        await errorHandling(e, node.mProfileName, e.message);
    }
}

/**
 * Copies full path for the selected Zowe USS node
 *
 * @param {ZoweUSSNode} node
 */
export async function copyPath(node: IZoweUSSTreeNode) {
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
export async function changeFileType(node: IZoweUSSTreeNode, binary: boolean, ussFileProvider: IZoweTree<IZoweUSSTreeNode>) {
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
    globals.LOG.debug(localize("saveUSSFile.log.debug.saveRequest", "save requested for USS file ") + doc.fileName);
    const start = path.join(globals.USS_DIR + path.sep).length;
    const ending = doc.fileName.substring(start);
    const sesName = ending.substring(0, ending.indexOf(path.sep));
    const remote = ending.substring(sesName.length).replace(/\\/g, "/");

    // get session from session name
    let binary;
    let node: IZoweUSSTreeNode;

    const sesNode: IZoweUSSTreeNode = ussFileProvider.mSessionNodes.find(
        (child) => child.getProfileName() && child.getProfileName() === sesName.trim()
    );
    if (sesNode) {
        binary = Object.keys(sesNode.binaryFiles).find((child) => child === remote) !== undefined;
    }
    // Get specific node based on label and parent tree (session / favorites)
    let nodes: IZoweUSSTreeNode[];
    if (!sesNode || sesNode.children.length === 0) {
        // saving from favorites
        nodes = concatChildNodes(ussFileProvider.mFavorites);
    } else {
        // saving from session
        nodes = concatChildNodes([sesNode]);
    }
    node = nodes.find((zNode) => {
        if (contextually.isText(zNode)) {
            return zNode.fullPath.trim() === remote;
        } else {
            return false;
        }
    });

    // define upload options
    let etagToUpload: string;
    let returnEtag: boolean;
    if (node) {
        etagToUpload = node.getEtag();
        if (etagToUpload) {
            returnEtag = true;
        }
    }

    try {
        if (sesNode) {
            binary = binary || (await ZoweExplorerApiRegister.getUssApi(sesNode.getProfile()).isFileTagBinOrAscii(remote));
        }
        const uploadResponse: IZosFilesResponse = await Gui.withProgress(
            {
                location: vscode.ProgressLocation.Window,
                title: localize("saveUSSFile.response.title", "Saving file..."),
            },
            () => {
                return uploadContent(sesNode, doc, remote, sesNode.getProfile(), binary, etagToUpload, returnEtag);
            }
        );
        if (uploadResponse.success) {
            Gui.setStatusBarMessage(uploadResponse.commandResponse, globals.STATUS_BAR_TIMEOUT_MS);
            // set local etag with the new etag from the updated file on mainframe
            if (node) {
                node.setEtag(uploadResponse.apiResponse.etag);
            }
            setFileSaved(true);
            // this part never runs! zowe.Upload.fileToUSSFile doesn't return success: false, it just throws the error which is caught below!!!!!
        } else {
            await markDocumentUnsaved(doc);
            Gui.errorMessage(uploadResponse.commandResponse);
        }
    } catch (err) {
        // TODO: error handling must not be zosmf specific
        if (err.message.includes(localize("saveFile.error.ZosmfEtagMismatchError", "Rest API failure with HTTP(S) status 412"))) {
            if (globals.ISTHEIA) {
                await willForceUpload(node, doc, remote, node.getProfile(), binary, returnEtag);
            } else {
                // Store old document text in a separate variable, to be used on merge conflict
                const oldDocText = doc.getText();
                const oldDocLineCount = doc.lineCount;
                const prof = node.getProfile();
                const downloadResponse = await ZoweExplorerApiRegister.getUssApi(prof).getContents(node.fullPath, {
                    file: node.getUSSDocumentFilePath(),
                    binary,
                    returnEtag: true,
                    encoding: prof.profile?.encoding,
                    responseTimeout: prof.profile?.responseTimeout,
                });
                // re-assign etag, so that it can be used with subsequent requests
                const downloadEtag = downloadResponse.apiResponse.etag;
                if (downloadEtag !== etagToUpload) {
                    node.setEtag(downloadEtag);
                }

                globals.LOG.warn(err);
                Gui.warningMessage(
                    localize(
                        "saveFile.error.etagMismatch",
                        "Remote file has been modified in the meantime.\nSelect 'Compare' to resolve the conflict."
                    )
                );
                if (vscode.window.activeTextEditor) {
                    const startPosition = new vscode.Position(0, 0);
                    const endPosition = new vscode.Position(oldDocLineCount, 0);
                    const deleteRange = new vscode.Range(startPosition, endPosition);
                    await vscode.window.activeTextEditor.edit((editBuilder) => {
                        // re-write the old content in the editor view
                        editBuilder.delete(deleteRange);
                        editBuilder.insert(startPosition, oldDocText);
                    });
                    await vscode.window.activeTextEditor.document.save();
                }
            }
        } else {
            globals.LOG.error(localize("saveUSSFile.log.error.save", "Error encountered when saving USS file: ") + JSON.stringify(err));
            await markDocumentUnsaved(doc);
            await errorHandling(err, sesName, err.message);
        }
    }
}

export async function deleteUSSFilesPrompt(nodes: IZoweUSSTreeNode[]): Promise<boolean> {
    const fileNames = nodes.reduce((label, currentVal) => {
        return label + currentVal.label + "\n";
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
            globals.LOG.debug(localize("deleteUssPrompt.confirmation.cancel.log.debug", "Delete action was canceled."));
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
    if (contextually.isUssDirectory(node)) {
        let directory: UssFileTree = {
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
    let rootStructure: UssFileTree = {
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
export async function copyUssFilesToClipboard(selectedNodes: IZoweUSSTreeNode[]) {
    const filePaths = await ussFileStructure(selectedNodes);
    vscode.env.clipboard.writeText(JSON.stringify(filePaths));
}

export async function copyUssFiles(node: IZoweUSSTreeNode, nodeList: IZoweUSSTreeNode[], ussFileProvider: IZoweTree<IZoweUSSTreeNode>) {
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

export async function refreshChildNodesDirectory(node: IZoweUSSTreeNode) {
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
export async function pasteUssFile(ussFileProvider: IZoweTree<IZoweUSSTreeNode>, node: IZoweUSSTreeNode) {
    pasteUss(ussFileProvider, node);
}

/**
 * Paste copied USS nodes into the selected node.
 * @param ussFileProvider File provider for USS tree
 * @param node The node to paste within
 */
export async function pasteUss(ussFileProvider: IZoweTree<IZoweUSSTreeNode>, node: IZoweUSSTreeNode) {
    const a = ussFileProvider.getTreeView().selection as IZoweUSSTreeNode[];
    let selectedNode = node;
    if (!selectedNode) {
        selectedNode = a.length > 0 ? a[0] : (a as unknown as IZoweUSSTreeNode);
    }

    await Gui.withProgress(
        {
            location: vscode.ProgressLocation.Window,
            title: localize("ZoweUssNode.copyUpload.progress", "Pasting files..."),
        },
        () => {
            return selectedNode.pasteUssTree ? selectedNode.pasteUssTree() : selectedNode.copyUssFile();
        }
    );
    const nodeToRefresh = node?.contextValue != null && contextually.isUssSession(node) ? selectedNode : selectedNode.getParent();
    ussFileProvider.refreshElement(nodeToRefresh);
}
