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
/**
 * Prompts the user for a path, and populates the [TreeView]{@link vscode.TreeView} based on the path
 *
 * @param {ZoweUSSNode} node - The session node
 * @param {ussTree} ussFileProvider - Current ussTree used to populate the TreeView
 * @returns {Promise<void>}
 */
export async function createUSSNode(node: ZoweUSSNode, ussFileProvider: USSTree, nodeType: string) {
    const name = await vscode.window.showInputBox({placeHolder: "Name of file or directory"});
    if (name) {
        try {
            const filePath = `${node.fullPath}/${name}`;
            await zowe.Create.uss(node.getSession(), filePath, nodeType);
            ussFileProvider.refresh();
        } catch (err) {
            vscode.window.showErrorMessage(`Unable to create node: ${err.message}`);
            throw (err);
        }
    }
}

export async function deleteUSSNode(node: ZoweUSSNode, ussFileProvider: USSTree, filePath: string) {
    // handle zosmf api issue with file paths
    const nodePath = node.fullPath.startsWith("/") ?  node.fullPath.substring(1) :  node.fullPath;
    const quickPickOptions: vscode.QuickPickOptions = {
        placeHolder: `Are you sure you want to delete ${node.label}`,
        ignoreFocusOut: true,
        canPickMany: false
    };
    if (await vscode.window.showQuickPick(["Yes", "No"], quickPickOptions) === "No") {
        return;
    }
    try {
        const isRecursive = node.contextValue === "directory" ? true : false;
        await zowe.Delete.ussFile(node.getSession(), nodePath, isRecursive);
        ussFileProvider.refresh();
        deleteFromDisk(node, filePath);
    } catch (err) {
        vscode.window.showErrorMessage(`Unable to delete node: ${err.message}`);
        throw (err);
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
        catch (err) {}
}

export async function initializeUSSFavorites(ussFileProvider: USSTree) {
    const lines: string[] = vscode.workspace.getConfiguration("Zowe-USS-Persistent-Favorites").get("favorites");
    lines.forEach(async line => {
        const profileName = line.substring(1, line.lastIndexOf("]"));
        const nodeName = (line.substring(line.indexOf(":") + 1, line.indexOf("{"))).trim();
        const session = await utils.getSession(profileName);
        let node: ZoweUSSNode;
        if (line.substring(line.indexOf("{") + 1, line.lastIndexOf("}")) === "directory") {
        node = new ZoweUSSNode(
            nodeName,
            vscode.TreeItemCollapsibleState.Collapsed,
            ussFileProvider.mFavoriteSession,
            session,
            "",
            false,
            profileName
        );
        } else {
            node = new ZoweUSSNode(
                nodeName,
                vscode.TreeItemCollapsibleState.None,
                ussFileProvider.mFavoriteSession,
                session,
                "",
                false,
                profileName
            );
            node.command = {command: "zowe.uss.ZoweUSSNode.open", title: "Open", arguments: [node]};
        }
        node.contextValue += "f";
        ussFileProvider.mFavorites.push(node);
    });
}