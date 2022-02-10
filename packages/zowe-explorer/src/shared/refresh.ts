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

import { IZoweTree, IZoweTreeNode } from "@zowe/zowe-explorer-api";
import { PersistentFilters } from "../PersistentFilters";
import { Profiles } from "../Profiles";
import { readConfigFromDisk, syncSessionNode } from "../utils/ProfilesUtils";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { resetValidationSettings, returnIconState } from "./actions";
import { labelRefresh } from "./utils";
import * as contextually from "../shared/context";
import * as globals from "../globals";
import { createDatasetTree } from "../dataset/DatasetTree";
import { createUSSTree } from "../uss/USSTree";
import { createJobsTree } from "../job/ZosJobsProvider";

/**
 * View (DATA SETS, JOBS, USS) refresh button
 * Refreshes treeView and profiles including their validation setting
 *
 * @param {IZoweTree} treeProvider
 */
export async function refreshAll(treeProvider: IZoweTree<IZoweTreeNode>) {
    await readConfigFromDisk();
    await Profiles.getInstance().refresh(ZoweExplorerApiRegister.getInstance());
    let repaintTree = true;
    if (treeProvider.mSessionNodes) {
        treeProvider.mSessionNodes.forEach(async (node) => {
            const allProfiles = await Profiles.getInstance().allProfiles;
            if (allProfiles) {
                allProfiles.forEach(async (profile) => {
                    if (node.getLabel().toString() === profile.name) {
                        repaintTree = false;
                    }
                });
            }
        });
        if (repaintTree) {
            // Initialize dataset provider
            await createDatasetTree(globals.LOG);
            // Initialize uss provider
            await createUSSTree(globals.LOG);
            // Initialize Jobs provider with the created session and the selected pattern
            await createJobsTree(globals.LOG);
        }
        treeProvider.mSessionNodes.forEach(async (sessNode) => {
            const setting = (await PersistentFilters.getDirectValue(
                globals.SETTINGS_AUTOMATIC_PROFILE_VALIDATION
            )) as boolean;
            if (contextually.isSessionNotFav(sessNode)) {
                labelRefresh(sessNode);
                sessNode.children = [];
                sessNode.dirty = true;
                resetValidationSettings(sessNode, setting);
                returnIconState(sessNode);
                await syncSessionNode(Profiles.getInstance())((profileValue) =>
                    ZoweExplorerApiRegister.getCommonApi(profileValue).getSession()
                )(sessNode);
            }
        });
    }
    treeProvider.refresh();
}
