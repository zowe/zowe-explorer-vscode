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
import { ZoweDatasetNode } from "../ZoweDatasetNode";
import { DatasetTree } from "../DatasetTree";
import * as extension from "../../src/extension";
import * as utils from "../utils";
import { ZoweExplorerApiRegister } from "../api/ZoweExplorerApiRegister";
import { IZoweTree } from "../api/IZoweTree";
import { IZoweDatasetTreeNode } from "../api/IZoweTreeNode";

export async function uploadDialog(node: ZoweDatasetNode, datasetProvider: IZoweTree<IZoweDatasetTreeNode>) {
    const fileOpenOptions = {
       canSelectFiles: true,
       openLabel: "Upload File",
       canSelectMany: true
    };

    const value = await vscode.window.showOpenDialog(fileOpenOptions);

    await Promise.all(
        value.map(async (item) => {
            // Convert to vscode.TextDocument
            const doc = await vscode.workspace.openTextDocument(item);
            await uploadFile(node, doc);
        }
    ));

    // refresh Tree View & favorites
    datasetProvider.refreshElement(node);
    if (node.contextValue.includes(extension.FAV_SUFFIX) || node.getParent().contextValue === extension.FAVORITE_CONTEXT) {
        const nonFavNode = datasetProvider.findNonFavoritedNode(node);
        if (nonFavNode) { datasetProvider.refreshElement(nonFavNode); }
    } else {
        const favNode = datasetProvider.findFavoritedNode(node);
        if (favNode) { datasetProvider.refreshElement(favNode); }
    }
}

export function getDatasetLabel(node: ZoweDatasetNode) {
    if (node.getParent() && node.getParent().contextValue === extension.FAVORITE_CONTEXT) {
        const profileEnd = "]: ";
        const profileIndex = node.label.indexOf(profileEnd);
        return node.label.substr(profileIndex + profileEnd.length, node.label.length);
    }
    return node.label;
}

export async function uploadFile(node: ZoweDatasetNode, doc: vscode.TextDocument) {
    try {
        const datasetName = getDatasetLabel(node);
        await ZoweExplorerApiRegister.getMvsApi(node.getProfile()).putContents(doc.fileName, datasetName);
    } catch (e) {
        await utils.errorHandling(e, node.getProfileName(), e.message);
    }
}
