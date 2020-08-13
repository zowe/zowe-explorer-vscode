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
import { ZoweDatasetNode } from "../dataset/ZoweDatasetNode";
import * as utils from "@zowe/zowe-explorer-api/lib/Utils";
import {
    ZoweExplorerApiRegister,
    IZoweTree,
    IZoweDatasetTreeNode,
} from "@zowe/zowe-explorer-api";
import * as nls from "vscode-nls";
import * as contextually from "../shared/context";

// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

export async function uploadDialog(
    node: ZoweDatasetNode,
    datasetProvider: IZoweTree<IZoweDatasetTreeNode>
) {
    const fileOpenOptions = {
        canSelectFiles: true,
        openLabel: "Upload File",
        canSelectMany: true,
    };

    const value = await vscode.window.showOpenDialog(fileOpenOptions);

    if (value && value.length) {
        await Promise.all(
            value.map(async (item) => {
                // Convert to vscode.TextDocument
                const doc = await vscode.workspace.openTextDocument(item);
                await uploadFile(node, doc);
            })
        );

        // refresh Tree View & favorites
        datasetProvider.refreshElement(node);
        if (
            contextually.isFavorite(node) ||
            contextually.isFavoriteContext(node.getParent())
        ) {
            const nonFavNode = datasetProvider.findNonFavoritedNode(node);
            if (nonFavNode) {
                datasetProvider.refreshElement(nonFavNode);
            }
        } else {
            const favNode = datasetProvider.findFavoritedNode(node);
            if (favNode) {
                datasetProvider.refreshElement(favNode);
            }
        }
    } else {
        vscode.window.showInformationMessage(
            localize("enterPattern.pattern", "No selection made.")
        );
    }
}

export function getDatasetLabel(node: ZoweDatasetNode) {
    if (node.getParent() && contextually.isFavoriteContext(node.getParent())) {
        const profileEnd = "]: ";
        const profileIndex = node.label.indexOf(profileEnd);
        return node.label.substr(
            profileIndex + profileEnd.length,
            node.label.length
        );
    }
    return node.label;
}

export async function uploadFile(node: ZoweDatasetNode, doc: vscode.TextDocument) {
    try {
        const datasetName = getDatasetLabel(node);
        const prof = node.getProfile();
        await ZoweExplorerApiRegister.getMvsApi(prof).putContents(
            doc.fileName,
            datasetName,
            {
                encoding: prof.profile.encoding,
            }
        );
    } catch (e) {
        await utils.errorHandling(e, node.getProfileName(), e.message);
    }
}
