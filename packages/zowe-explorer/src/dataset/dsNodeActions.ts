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

import * as contextually from "../shared/context";
import { Profiles, IZoweTree, IZoweDatasetTreeNode } from "@zowe/zowe-explorer-api";
import { labelRefresh, refreshTree } from "../shared/utils";
import { returnIconState } from "../shared/actions";

/**
 * Refreshes treeView
 *
 * @param {DataSetTree} datasetProvider
 */
export async function refreshAll(datasetProvider: IZoweTree<IZoweDatasetTreeNode>) {
    await Profiles.getInstance().refresh();
    datasetProvider.mSessionNodes.forEach((sessNode) => {
        if (contextually.isSessionNotFav(sessNode)) {
            labelRefresh(sessNode);
            sessNode.children = [];
            sessNode.dirty = true;
            refreshTree(sessNode);
        }
        returnIconState(sessNode);
    });
    await datasetProvider.refresh();
}
