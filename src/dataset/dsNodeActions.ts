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

import * as globals from "../globals";
import { Profiles } from "../Profiles";
import { IZoweTree } from "../api/IZoweTree";
import { IZoweDatasetTreeNode } from "../api/IZoweTreeNode";
import { labelHack, refreshTree } from "../shared/utils";

/**
 * Refreshes treeView
 *
 * @param {DataSetTree} datasetProvider
 */
export async function refreshAll(datasetProvider: IZoweTree<IZoweDatasetTreeNode>) {
    await Profiles.getInstance().refresh();
    datasetProvider.mSessionNodes.forEach((sessNode) => {
        if (sessNode.contextValue === globals.DS_SESSION_CONTEXT) {
            labelHack(sessNode);
            sessNode.children = [];
            sessNode.dirty = true;
            refreshTree(sessNode);
        }
    });
    await datasetProvider.refresh();
}
