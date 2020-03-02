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

import * as utils from "../utils";
import * as nls from "vscode-nls";

const localize = nls.config({messageFormat: nls.MessageFormat.file})();
import * as extension from "../extension";
import { Profiles } from "../Profiles";
import { ISession, Logger } from "@zowe/imperative";
import { DatasetTree } from "../DatasetTree";
import { IZoweTree } from "../api/IZoweTree";
import { IZoweDatasetTreeNode } from "../api/IZoweTreeNode";
// tslint:disable-next-line: prefer-const
let log: Logger;
/**
 * Refreshes treeView
 *
 * @param {DataSetTree} datasetProvider
 */
export async function refreshAll(datasetProvider: IZoweTree<IZoweDatasetTreeNode>) {
    await Profiles.getInstance().refresh();
    datasetProvider.mSessionNodes.forEach((sessNode) => {
        if (sessNode.contextValue === extension.DS_SESSION_CONTEXT) {
            utils.labelHack(sessNode);
            sessNode.children = [];
            sessNode.dirty = true;
            utils.refreshTree(sessNode);
        }
    });
    await datasetProvider.refresh();
}
