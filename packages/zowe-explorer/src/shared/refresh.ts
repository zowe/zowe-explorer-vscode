/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 */

import { IZoweTree, IZoweTreeNode } from "@zowe/zowe-explorer-api";
import { Profiles } from "../Profiles";
import { syncSessionNode } from "../utils/ProfilesUtils";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { returnIconState } from "./actions";
import * as contextually from "../shared/context";
import { removeSession } from "../utils/SessionUtils";
import { ZoweLogger } from "../utils/LoggerUtils";
import { TreeProviders } from "./TreeProviders";
import { TreeViewUtils } from "../utils/TreeViewUtils";
import { ZoweExplorerExtender } from "../ZoweExplorerExtender";

/**
 * View (DATA SETS, JOBS, USS) refresh button
 * Refreshes treeView and profiles including their validation setting
 *
 * @param {IZoweTree} treeProvider
 */
export async function refreshAll(treeProvider?: IZoweTree<IZoweTreeNode>): Promise<void> {
    ZoweLogger.trace("refresh.refreshAll called.");
    if (treeProvider == null) {
        for (const provider of Object.values(TreeProviders.providers)) {
            await this.refreshAll(provider);
        }
        return;
    }
    try {
        await Profiles.getInstance().refresh(ZoweExplorerApiRegister.getInstance());
    } catch (err) {
        ZoweLogger.error(err);
        ZoweExplorerExtender.showZoweConfigError(err.message);
        return;
    }
    for (const sessNode of treeProvider.mSessionNodes) {
        const profiles = await Profiles.getInstance().fetchAllProfiles();
        const found = profiles.some((prof) => prof.name === sessNode.label.toString().trim());
        if (found || sessNode.label.toString() === "Favorites") {
            if (contextually.isSessionNotFav(sessNode)) {
                sessNode.dirty = true;
                returnIconState(sessNode);
                syncSessionNode((profileValue) => ZoweExplorerApiRegister.getCommonApi(profileValue), sessNode);
            }
        } else {
            await removeSession(treeProvider, sessNode.label.toString().trim());
        }
    }
    for (const profType of ZoweExplorerApiRegister.getInstance().registeredApiTypes()) {
        await TreeViewUtils.addDefaultSession(treeProvider, profType);
    }
    treeProvider.refresh();
}
