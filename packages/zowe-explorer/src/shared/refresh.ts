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

import { IZoweTree, IZoweTreeNode, ProfilesCache } from "@zowe/zowe-explorer-api";
import { PersistentFilters } from "../PersistentFilters";
import { Profiles } from "../Profiles";
import { syncSessionNode, getProfileInfo, getZoweDir } from "../utils/ProfilesUtils";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { resetValidationSettings, returnIconState } from "./actions";
import { labelRefresh } from "./utils";
import * as contextually from "../shared/context";
import * as globals from "../globals";
import * as vscode from "vscode";
import * as fs from "fs";

/**
 * View (DATA SETS, JOBS, USS) refresh button
 * Refreshes treeView and profiles including their validation setting
 *
 * @param {IZoweTree} treeProvider
 */
export async function refreshAll(treeProvider: IZoweTree<IZoweTreeNode>) {
    const mProfileInfo = await getProfileInfo(globals.ISTHEIA);
    if (mProfileInfo.usingTeamConfig) {
        if (vscode.workspace.workspaceFolders) {
            const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
            await mProfileInfo.readProfilesFromDisk({ projectDir: fs.realpathSync(rootPath) });
        } else {
            await mProfileInfo.readProfilesFromDisk({ homeDir: getZoweDir() });
        }
        await getProfileInfo(globals.ISTHEIA);
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
    treeProvider.refresh();
}
