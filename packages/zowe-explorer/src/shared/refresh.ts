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
import { resetValidationSettings, returnIconState } from "./actions";
import { labelRefresh } from "./utils";
import * as contextually from "../shared/context";
import * as globals from "../globals";
import { removeSession } from "../utils/SessionUtils";
import { SettingsConfig } from "../utils/SettingsConfig";
import { ZoweLogger } from "../utils/LoggerUtils";

/**
 * View (DATA SETS, JOBS, USS) refresh button
 * Refreshes treeView and profiles including their validation setting
 *
 * @param {IZoweTree} treeProvider
 */
export async function refreshAll(treeProvider: IZoweTree<IZoweTreeNode>): Promise<void> {
    ZoweLogger.trace("refresh.refreshAll called.");
    await Profiles.getInstance().refresh(ZoweExplorerApiRegister.getInstance());
    for (const sessNode of treeProvider.mSessionNodes) {
        const profiles = await Profiles.getInstance().fetchAllProfiles();
        const found = profiles.some((prof) => prof.name === sessNode.label.toString().trim());
        if (found || sessNode.label.toString() === "Favorites") {
            const setting: boolean = await SettingsConfig.getDirectValue(globals.SETTINGS_AUTOMATIC_PROFILE_VALIDATION);
            if (contextually.isSessionNotFav(sessNode)) {
                labelRefresh(sessNode);
                sessNode.children = [];
                sessNode.dirty = true;
                if (sessNode.label.toString() !== "Favorites") {
                    resetValidationSettings(sessNode, setting);
                }
                returnIconState(sessNode);
                syncSessionNode(Profiles.getInstance())((profileValue) => ZoweExplorerApiRegister.getCommonApi(profileValue).getSession())(sessNode);
            }
            treeProvider.refresh();
        } else {
            await removeSession(treeProvider, sessNode.label.toString().trim());
        }
    }
}
