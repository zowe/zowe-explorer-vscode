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
import { Profiles } from "../Profiles";
import { IZoweTree } from "../api/IZoweTree";
import { IZoweDatasetTreeNode } from "../api/IZoweTreeNode";
import { labelRefresh, refreshTree } from "../shared/utils";
import { returnIconState, resetValidationSettings } from "../shared/actions";
import { PersistentFilters } from "../PersistentFilters";

/**
 * Refreshes treeView
 *
 * @param {DataSetTree} datasetProvider
 */
export async function refreshAll(datasetProvider: IZoweTree<IZoweDatasetTreeNode>) {
    await Profiles.getInstance().refresh();
    datasetProvider.mSessionNodes.forEach(async (sessNode) => {
        const setting = PersistentFilters.getDirectValue("Zowe-Automatic-Validation") as boolean;
        if (contextually.isSessionNotFav(sessNode)) {
            labelRefresh(sessNode);
            sessNode.children = [];
            sessNode.dirty = true;
            refreshTree(sessNode);
            resetValidationSettings(sessNode, setting);
        }
        returnIconState(sessNode);
    });
    await datasetProvider.refresh();
}
