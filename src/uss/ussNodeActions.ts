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

import { USSTree } from "../USSTree";
import { ZoweUSSNode } from "../ZoweUSSNode";
import * as vscode from "vscode";
import * as zowe from "@brightside/core";
import * as fs from "fs";
import * as utils from "../utils";
import * as nls from "vscode-nls";

const localize = nls.config({messageFormat: nls.MessageFormat.file})();
import * as extension from "../../src/extension";
import * as path from "path";
import { ISTHEIA } from "../extension";
import { Profiles } from "../Profiles";
import { ZoweExplorerApiRegister } from "../api/ZoweExplorerApiRegister";
import { isBinaryFileSync } from "isbinaryfile";

/**
 * Prompts the user for a path, and populates the [TreeView]{@link vscode.TreeView} based on the path
 *
 * @param {ZoweUSSNode} node - The session node
 * @param {ussTree} ussFileProvider - Current ussTree used to populate the TreeView
 * @returns {Promise<void>}
 */
export async function createUSSNode(node: ZoweUSSNode, ussFileProvider: USSTree, nodeType: string, isTopLevel?: boolean) {
    const name = await vscode.window.showInputBox({
        placeHolder:
            localize("createUSSNode.name", "Name of file or directory")
    });
    if (name) {
        try {
            const filePath = `${node.fullPath}/${name}`;
            await ZoweExplorerApiRegister.getUssApi(node.profile).create(filePath, nodeType);
            if (isTopLevel) {
                refreshAllUSS(ussFileProvider);
            } else {
                ussFileProvider.refreshElement(node);
            }
        } catch (err) {
            utils.errorHandling(err, node.mProfileName, localize("createUSSNode.error.create", "Unable to create node: ") + err.message);
            throw (err);
        }
        ussFileProvider.refresh();
    }
}

export async function createUSSNodeDialog(node: ZoweUSSNode, ussFileProvider: USSTree) {
    let usrNme: string;
    let passWrd: string;
    let baseEncd: string;
    let validProfile: number = -1;
    if ((!node.getSession().ISession.user.trim()) || (!node.getSession().ISession.password.trim())) {
        try {
            const values = await Profiles.getInstance().promptCredentials(node.mProfileName);
            if (values !== undefined) {
                usrNme = values[0];
                passWrd = values[1];
                baseEncd = values[2];
            }
        } catch (error) {
            utils.errorHandling(error, node.mProfileName, localize("ussNodeActions.error", "Error encountered in ") + `createUSSNodeDialog.optionalProfiles!`);
            return;
        }
        if (usrNme !== undefined && passWrd !== undefined && baseEncd !== undefined) {
            node.getSession().ISession.user = usrNme;
            node.getSession().ISession.password = passWrd;
            node.getSession().ISession.base64EncodedAuth = baseEncd;
            validProfile = 0;
        } else {
            return;
        }
        await ussFileProvider.refreshElement(node);
        await ussFileProvider.refresh();
    } else {
        validProfile = 0;
    }
    if (validProfile === 0) {
        const quickPickOptions: vscode.QuickPickOptions = {
            placeHolder: `What would you like to create at ${node.fullPath}?`,
            ignoreFocusOut: true,
            canPickMany: false
        };
        const type = await vscode.window.showQuickPick([extension.USS_DIR_CONTEXT, "File"], quickPickOptions);
        const isTopLevel = true;
        return createUSSNode(node, ussFileProvider, type, isTopLevel);
    }
}

export async function deleteUSSNode(node: ZoweUSSNode, ussFileProvider: USSTree, filePath: string) {
    const quickPickOptions: vscode.QuickPickOptions = {
        placeHolder: localize("deleteUSSNode.quickPickOption", "Are you sure you want to delete ") + node.label,
        ignoreFocusOut: true,
        canPickMany: false
    };
    if (await vscode.window.showQuickPick([localize("deleteUSSNode.showQuickPick.yes", "Yes"),
            localize("deleteUSSNode.showQuickPick.no", "No")],
        quickPickOptions) !== localize("deleteUSSNode.showQuickPick.yes", "Yes")) {
        return;
    }
    try {
        const isRecursive = node.contextValue === extension.USS_DIR_CONTEXT ? true : false;
        await ZoweExplorerApiRegister.getUssApi(node.profile).delete(node.fullPath, isRecursive);
        node.mParent.dirty = true;
        deleteFromDisk(node, filePath);
    } catch (err) {
        const errMessage: string = localize("deleteUSSNode.error.node", "Unable to delete node: ") + err.message;
        utils.errorHandling(err, node.mProfileName, errMessage);
        throw (err);
    }

    // Remove node from the USS Favorites tree
    ussFileProvider.removeUSSFavorite(node);
    ussFileProvider.refresh();
}

/**
 * Refreshes treeView
 *
 * @param {USSTree} ussFileProvider
 */
export async function refreshAllUSS(ussFileProvider: USSTree) {
    ussFileProvider.mSessionNodes.forEach((sessNode) => {
        if (sessNode.contextValue === extension.USS_SESSION_CONTEXT) {
            utils.labelHack(sessNode);
            sessNode.children = [];
            sessNode.dirty = true;
        }
    });
    ussFileProvider.refresh();
    return Profiles.getInstance().refresh();
}

/**
 * Process for renaming a USS Node. This could be a Favorite Node
 *
 * @param {ZoweUSSNode} originalNode
 * @param {USSTree} ussFileProvider
 * @param {string} filePath
 */
export async function renameUSSNode(originalNode: ZoweUSSNode, ussFileProvider: USSTree, filePath: string) {
    // Could be a favorite or regular entry always deal with the regular entry
    const isFav = originalNode.contextValue.endsWith(extension.FAV_SUFFIX);
    const oldLabel = isFav ? originalNode.shortLabel : originalNode.label;
    const parentPath = originalNode.fullPath.substr(0, originalNode.fullPath.indexOf(oldLabel));
    // Check if an old favorite exists for this node
    const oldFavorite = isFav ? originalNode : ussFileProvider.mFavorites.find((temp: ZoweUSSNode) =>
        (temp.shortLabel === oldLabel) && (temp.fullPath.substr(0, temp.fullPath.indexOf(oldLabel)) === parentPath)
    );
    const newName = await vscode.window.showInputBox({value: oldLabel});
    if (newName && newName !== oldLabel) {
        try {
            const newNamePath = path.join(parentPath + newName);
            await ZoweExplorerApiRegister.getUssApi(
                originalNode.profile).rename(originalNode.fullPath, newNamePath);
            originalNode.rename(newNamePath);

            if (oldFavorite) {
                ussFileProvider.removeUSSFavorite(oldFavorite);
                oldFavorite.rename(newNamePath);
                ussFileProvider.addUSSFavorite(oldFavorite);
            }
        } catch (err) {
            utils.errorHandling(err, originalNode.mProfileName, localize("renameUSSNode.error", "Unable to rename node: ") + err.message);
            throw (err);
        }
    }
}

/**
 * Marks file as deleted from disk
 *
 * @param {ZoweUSSNode} node
 */
export async function deleteFromDisk(node: ZoweUSSNode, filePath: string) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
        // tslint:disable-next-line: no-empty
    catch (err) {
    }
}

export async function uploadDialog(node: ZoweUSSNode, ussFileProvider: USSTree) {
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

export async function uploadBinaryFile(node: ZoweUSSNode, filePath: string) {
    try {
        const localFileName = path.parse(filePath).base;
        const ussName = `${node.fullPath}/${localFileName}`;
        await zowe.Upload.fileToUSSFile(node.getSession(), filePath, ussName, true);
    } catch (e) {
        utils.errorHandling(e, node.mProfileName, e.message);
    }
}

export async function uploadFile(node: ZoweUSSNode, doc: vscode.TextDocument) {
    try {
        const localFileName = path.parse(doc.fileName).base;
        const ussName = `${node.fullPath}/${localFileName}`;
        await ZoweExplorerApiRegister.getUssApi(node.profile).putContents(doc.fileName, ussName);
    } catch (e) {
        utils.errorHandling(e, node.mProfileName, e.message);
    }
}

/**
 * Copies full path for the selected Zowe USS node
 *
 * @param {ZoweUSSNode} node
 */
export async function copyPath(node: ZoweUSSNode) {
    if (extension.ISTHEIA) {
        // Remove when Theia supports VS Code API for accessing system clipboard
        vscode.window.showInformationMessage(localize("copyPath.infoMessage", "Copy Path is not yet supported in Theia."));
        return;
    }
    vscode.env.clipboard.writeText(node.fullPath);
}
