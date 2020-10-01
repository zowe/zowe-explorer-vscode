/*
* This program and the accompanying materials are made available under the terms of the *
* Eclipse Public License v2.0 which accompanies this distribution, and is available at *
* https://www.eclipse.org/legal/epl-v20.html                                      *
*                                                                                 *
* SPDX-License-Identifier: EPL-2.0                                                *
*                                                                                 *
* Copyright Contributors to the Zowe Project.                                     *
*                                                                                 *
*/

import * as vscode from "vscode";
import * as zowe from "@zowe/cli";
import * as fs from "fs";
import * as globals from "../globals";
import * as path from "path";
import { ZoweUSSNode } from "./ZoweUSSNode";
import { labelRefresh, concatChildNodes, willForceUpload, uploadContent, refreshTree } from "../shared/utils";
import { errorHandling } from "../utils";
import { Profiles, ValidProfileEnum } from "../Profiles";
import { IZoweTree } from "../api/IZoweTree";
import { IZoweUSSTreeNode } from "../api/IZoweTreeNode";
import { ZoweExplorerApiRegister } from "../api/ZoweExplorerApiRegister";
import { isBinaryFileSync } from "isbinaryfile";
import { Session } from "@zowe/imperative";
import * as contextually from "../shared/context";
import { setFileSaved } from "../utils/workspace";
import * as nls from "vscode-nls";
import * as shared from "../shared/actions";
import { PersistentFilters } from "../PersistentFilters";

// Set up localization
nls.config({ messageFormat: nls.MessageFormat.bundle, bundleFormat: nls.BundleFormat.standalone })();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

/**
 * Prompts the user for a path, and populates the [TreeView]{@link vscode.TreeView} based on the path
 *
 * @param {ZoweUSSNode} node - The session node
 * @param {ussTree} ussFileProvider - Current ussTree used to populate the TreeView
 * @returns {Promise<void>}
 */
export async function createUSSNode(node: IZoweUSSTreeNode, ussFileProvider: IZoweTree<IZoweUSSTreeNode>, nodeType: string, isTopLevel?: boolean) {
    const name = await vscode.window.showInputBox({
        placeHolder:
            localize("createUSSNode.name", "Name of file or directory")
    });
    if (name) {
        try {
            const filePath = `${node.fullPath}/${name}`;
            await ZoweExplorerApiRegister.getUssApi(node.getProfile()).create(filePath, nodeType);

            if (isTopLevel) {
                refreshAllUSS(ussFileProvider);
            } else {
                ussFileProvider.refreshElement(node);
            }
        } catch (err) {
            errorHandling(err, node.mProfileName, localize("createUSSNode.error.create", "Unable to create node: ") + err.message);
            throw (err);
        }
        ussFileProvider.refresh();
    }
}

export async function refreshUSSInTree(node: IZoweUSSTreeNode, ussFileProvider: IZoweTree<IZoweUSSTreeNode>) {
    await ussFileProvider.refreshElement(node);
}

export async function createUSSNodeDialog(node: IZoweUSSTreeNode, ussFileProvider: IZoweTree<IZoweUSSTreeNode>) {
    await ussFileProvider.checkCurrentProfile(node);
    if ((Profiles.getInstance().validProfile === ValidProfileEnum.VALID) ||
    (Profiles.getInstance().validProfile === ValidProfileEnum.UNVERIFIED)) {
        const quickPickOptions: vscode.QuickPickOptions = {
            placeHolder: `What would you like to create at ${node.fullPath}?`,
            ignoreFocusOut: true,
            canPickMany: false
        };
        const type = await vscode.window.showQuickPick([globals.USS_DIR_CONTEXT, "File"], quickPickOptions);
        const isTopLevel = true;
        return createUSSNode(node, ussFileProvider, type, isTopLevel);
    }
}

/**
 * Refreshes treeView
 *
 * @param {USSTree} ussFileProvider
 */
export async function refreshAllUSS(ussFileProvider: IZoweTree<IZoweUSSTreeNode>) {
    await Profiles.getInstance().refresh();
    const setting = await PersistentFilters.getDirectValue("Zowe-Automatic-Validation") as boolean;
    ussFileProvider.mSessionNodes.forEach(async (sessNode) => {
        if (contextually.isSession(sessNode)) {
            labelRefresh(sessNode);
            sessNode.children = [];
            sessNode.dirty = true;
            refreshTree(sessNode);
            shared.resetValidationSettings(sessNode, setting);
            shared.returnIconState(sessNode);
        }
    });
    await ussFileProvider.refresh();
}

/**
 * Process for renaming a USS Node. This could be a Favorite Node
 *
 * @param {IZoweTreeNode} originalNode
 * @param {USSTree} ussFileProvider
 * @param {string} filePath
 */
export async function renameUSSNode(originalNode: IZoweUSSTreeNode, ussFileProvider: IZoweTree<IZoweUSSTreeNode>, filePath: string) {
    // Could be a favorite or regular entry always deal with the regular entry
    const isFav = originalNode.contextValue.endsWith(globals.FAV_SUFFIX);
    const oldLabel = originalNode.label;
    const parentPath = originalNode.fullPath.substr(0, originalNode.fullPath.indexOf(oldLabel));
    // Check if an old favorite exists for this node
    const oldFavorite: IZoweUSSTreeNode = isFav ? originalNode : ussFileProvider.mFavorites.find((temp: ZoweUSSNode) =>
        (temp.shortLabel === oldLabel) && (temp.fullPath.substr(0, temp.fullPath.indexOf(oldLabel)) === parentPath)
    );
    const newName = await vscode.window.showInputBox({ value: oldLabel });
    if (newName && newName !== oldLabel) {
        try {
            let newNamePath = path.join(parentPath + newName);
            newNamePath = newNamePath.replace(/\\/g, "/"); // Added to cover Windows backslash issue
            const oldNamePath = originalNode.fullPath;

            const hasClosedTab = await originalNode.rename(newNamePath);
            await ZoweExplorerApiRegister.getUssApi(
                originalNode.getProfile()).rename(oldNamePath, newNamePath);
            await deleteFromDisk(originalNode, filePath);
            await originalNode.refreshAndReopen(hasClosedTab);

            if (oldFavorite) {
                ussFileProvider.removeFavorite(oldFavorite);
                await oldFavorite.rename(newNamePath);
                ussFileProvider.addFavorite(oldFavorite);
            }
        } catch (err) {
            errorHandling(err, originalNode.mProfileName, localize("renameUSSNode.error", "Unable to rename node: ") + err.message);
            throw (err);
        }
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
    }
        // tslint:disable-next-line: no-empty
    catch (err) {
    }
}

export async function uploadDialog(node: IZoweUSSTreeNode, ussFileProvider: IZoweTree<IZoweUSSTreeNode>) {
    const fileOpenOptions = {
        canSelectFiles: true,
        openLabel: "Upload Files",
        canSelectMany: true
    };

    const value = await vscode.window.showOpenDialog(fileOpenOptions);

    await Promise.all(
        value.map(async (item) => {
                const isBinary = isBinaryFileSync(item.fsPath);

                if (isBinary) {
                    await uploadBinaryFile(node, item.fsPath);
                } else {
                    const doc = await vscode.workspace.openTextDocument(item);
                    await uploadFile(node, doc);
                }
            }
        ));
    ussFileProvider.refresh();
}

export async function uploadBinaryFile(node: IZoweUSSTreeNode, filePath: string) {
    try {
        const localFileName = path.parse(filePath).base;
        const ussName = `${node.fullPath}/${localFileName}`;
        await ZoweExplorerApiRegister.getUssApi(node.getProfile()).putContents(filePath, ussName, true);
    } catch (e) {
        errorHandling(e, node.mProfileName, e.message);
    }
}

export async function uploadFile(node: IZoweUSSTreeNode, doc: vscode.TextDocument) {
    try {
        const localFileName = path.parse(doc.fileName).base;
        const ussName = `${node.fullPath}/${localFileName}`;
        const prof = node.getProfile();

        // if new api method exists, use it
        if (ZoweExplorerApiRegister.getUssApi(prof).putContent) {
            await ZoweExplorerApiRegister.getUssApi(prof).putContent(doc.fileName, ussName, {
                encoding: prof.profile.encoding
            });
        } else {
            await ZoweExplorerApiRegister.getUssApi(prof).putContents(doc.fileName, ussName);
        }

    } catch (e) {
        errorHandling(e, node.mProfileName, e.message);
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
        vscode.window.showInformationMessage(localize("copyPath.infoMessage", "Copy Path is not yet supported in Theia."));
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
export async function saveUSSFile(doc: vscode.TextDocument, ussFileProvider: IZoweTree<IZoweUSSTreeNode>) {
    globals.LOG.debug(localize("saveUSSFile.log.debug.saveRequest", "save requested for USS file ") + doc.fileName);
    const start = path.join(globals.USS_DIR + path.sep).length;
    const ending = doc.fileName.substring(start);
    const sesName = ending.substring(0, ending.indexOf(path.sep));
    const remote = ending.substring(sesName.length).replace(/\\/g, "/");

    // get session from session name
    let documentSession: Session;
    let binary;
    let node: IZoweUSSTreeNode;

    const sesNode: IZoweUSSTreeNode = (ussFileProvider.mSessionNodes.find((child) =>
                                child.getProfileName() && child.getProfileName() === sesName.trim()));
    if (sesNode) {
        documentSession = sesNode.getSession();
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
            return (zNode.fullPath.trim() === remote);
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
            binary = binary || await ZoweExplorerApiRegister.getUssApi(sesNode.getProfile()).isFileTagBinOrAscii(remote);
        }
        const uploadResponse: zowe.IZosFilesResponse = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: localize("saveUSSFile.response.title", "Saving file...")
        }, () => {
            return uploadContent(sesNode, doc, remote, sesNode.getProfile(), binary, etagToUpload, returnEtag);
        });
        if (uploadResponse.success) {
            vscode.window.showInformationMessage(uploadResponse.commandResponse);
            // set local etag with the new etag from the updated file on mainframe
            if (node) {
                node.setEtag(uploadResponse.apiResponse.etag);
            }
            setFileSaved(true);
            // this part never runs! zowe.Upload.fileToUSSFile doesn't return success: false, it just throws the error which is caught below!!!!!
        } else {
            vscode.window.showErrorMessage(uploadResponse.commandResponse);
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
                const downloadResponse = await ZoweExplorerApiRegister.getUssApi(prof).getContents(
                    node.fullPath, {
                    file: node.getUSSDocumentFilePath(),
                    binary,
                    returnEtag: true,
                    encoding: prof.profile.encoding
                });
                // re-assign etag, so that it can be used with subsequent requests
                const downloadEtag = downloadResponse.apiResponse.etag;
                if (downloadEtag !== etagToUpload) {
                    node.setEtag(downloadEtag);
                }
                this.downloaded = true;

                vscode.window.showWarningMessage(localize("saveFile.error.etagMismatch",
                    "Remote file has been modified in the meantime.\nSelect 'Compare' to resolve the conflict."));
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
            await errorHandling(err, sesName, err.message);
        }
    }
}
