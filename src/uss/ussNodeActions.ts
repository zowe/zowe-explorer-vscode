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
import * as utils from "../utils";
import * as nls from "vscode-nls";
import * as extension from "../../src/extension";
import * as path from "path";
import { Profiles } from "../Profiles";
import { IZoweTree } from "../api/IZoweTree";
import { IZoweUSSTreeNode } from "../api/IZoweTreeNode";
import { ZoweExplorerApiRegister } from "../api/ZoweExplorerApiRegister";
import { isBinaryFileSync } from "isbinaryfile";

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
            utils.errorHandling(err, node.mProfileName, localize("createUSSNode.error.create", "Unable to create node: ") + err.message);
            throw (err);
        }
        ussFileProvider.refresh();
    }
}

export async function createUSSNodeDialog(node: IZoweUSSTreeNode, ussFileProvider: IZoweTree<IZoweUSSTreeNode>) {
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
            utils.errorHandling(error, node.mProfileName,
                localize("ussNodeActions.error", "Error encountered in ") + `createUSSNodeDialog.optionalProfiles!`);
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

/**
 * Refreshes treeView
 *
 * @param {USSTree} ussFileProvider
 */
export async function refreshAllUSS(ussFileProvider: IZoweTree<IZoweUSSTreeNode>) {
    await Profiles.getInstance().refresh();
    ussFileProvider.mSessionNodes.forEach((sessNode) => {
        if (sessNode.contextValue === extension.USS_SESSION_CONTEXT) {
            utils.labelHack(sessNode);
            sessNode.children = [];
            sessNode.dirty = true;
            utils.refreshTree(sessNode);
        }
    });
    await ussFileProvider.refresh();
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
        utils.errorHandling(e, node.mProfileName, e.message);
    }
}

export async function uploadFile(node: IZoweUSSTreeNode, doc: vscode.TextDocument) {
    try {
        const localFileName = path.parse(doc.fileName).base;
        const ussName = `${node.fullPath}/${localFileName}`;
        await ZoweExplorerApiRegister.getUssApi(node.getProfile()).putContents(doc.fileName, ussName);
    } catch (e) {
        utils.errorHandling(e, node.mProfileName, e.message);
    }
}

/**
 * Copies full path for the selected Zowe USS node
 *
 * @param {ZoweUSSNode} node
 */
export async function copyPath(node: IZoweUSSTreeNode) {
    if (extension.ISTHEIA) {
        // Remove when Theia supports VS Code API for accessing system clipboard
        vscode.window.showInformationMessage(localize("copyPath.infoMessage", "Copy Path is not yet supported in Theia."));
        return;
    }
    vscode.env.clipboard.writeText(node.fullPath);
}
