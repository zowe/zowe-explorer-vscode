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

import { IZoweTree, IZoweTreeNode, ProfilesConfig } from "@zowe/zowe-explorer-api";
import { PersistentFilters } from "../PersistentFilters";
import { Profiles } from "../Profiles";
import { syncSessionNode } from "../utils/ProfilesUtils";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { resetValidationSettings, returnIconState } from "./actions";
import { labelRefresh } from "./utils";
import * as contextually from "../shared/context";

/**
 * View (DATA SETS, JOBS, USS) refresh button
 * Refreshes treeView and profiles including their validation setting
 *
 * @param {IZoweTree} treeProvider
 */
export async function refreshAll(treeProvider: IZoweTree<IZoweTreeNode>) {
    if (ProfilesConfig.getInstance().usingTeamConfig) {
        await Profiles.getInstance().refreshConfig(ZoweExplorerApiRegister.getInstance());
    } else {
        await Profiles.getInstance().refresh(ZoweExplorerApiRegister.getInstance());
    }
    treeProvider.mSessionNodes.forEach(async (sessNode) => {
        const setting = (await PersistentFilters.getDirectValue("zowe.automaticProfileValidation")) as boolean;
        if (contextually.isSessionNotFav(sessNode)) {
            labelRefresh(sessNode);
            sessNode.children = [];
            sessNode.dirty = true;
            await syncSessionNode(Profiles.getInstance())((profileValue) =>
                ZoweExplorerApiRegister.getCommonApi(profileValue).getSession()
            )(sessNode);
            resetValidationSettings(sessNode, setting);
            returnIconState(sessNode);
        }
    });
    treeProvider.refresh();
}
