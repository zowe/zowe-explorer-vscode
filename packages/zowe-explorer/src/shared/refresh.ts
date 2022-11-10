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

import { IZoweTree, IZoweTreeNode, PersistenceSchemaEnum } from "@zowe/zowe-explorer-api";
import { PersistentFilters } from "../PersistentFilters";
import { Profiles } from "../Profiles";
import { syncSessionNode } from "../utils/ProfilesUtils";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { resetValidationSettings, returnIconState } from "./actions";
import { labelRefresh } from "./utils";
import * as contextually from "../shared/context";
import * as globals from "../globals";
import * as vscode from "vscode";

/**
 * View (DATA SETS, JOBS, USS) refresh button
 * Refreshes treeView and profiles including their validation setting
 *
 * @param {IZoweTree} treeProvider
 */
export async function refreshAll(treeProvider: IZoweTree<IZoweTreeNode>) {
    await Profiles.getInstance().refresh(ZoweExplorerApiRegister.getInstance());
    treeProvider.mSessionNodes.forEach(async (sessNode) => {
        const profiles = await Profiles.getInstance().fetchAllProfiles();
        const found = profiles.some((prof) => prof.name === sessNode.label.toString().trim());
        if (found || sessNode.label.toString() === "Favorites") {
            const setting = (await PersistentFilters.getDirectValue(
                globals.SETTINGS_AUTOMATIC_PROFILE_VALIDATION
            )) as boolean;
            if (contextually.isSessionNotFav(sessNode)) {
                labelRefresh(sessNode);
                sessNode.children = [];
                sessNode.dirty = true;
                if (sessNode.label.toString() !== "Favorites") {
                    resetValidationSettings(sessNode, setting);
                }
                returnIconState(sessNode);
                await syncSessionNode(Profiles.getInstance())((profileValue) =>
                    ZoweExplorerApiRegister.getCommonApi(profileValue).getSession()
                )(sessNode);
            }
            treeProvider.refresh();
        } else {
            await removeSession(treeProvider, sessNode.label.toString().trim());
        }
    });
}

export async function removeSession(treeProvider: IZoweTree<IZoweTreeNode>, profileName: string): Promise<void> {
    const treeType = treeProvider.getTreeType();
    let schema;
    switch (treeType) {
        case PersistenceSchemaEnum.Dataset:
            schema = globals.SETTINGS_DS_HISTORY;
            break;
        case PersistenceSchemaEnum.USS:
            schema = globals.SETTINGS_USS_HISTORY;
            break;
        case PersistenceSchemaEnum.Job:
            schema = globals.SETTINGS_JOBS_HISTORY;
            break;
    }
    if (treeType !== globals.SETTINGS_JOBS_HISTORY) {
        // Delete from file history
        const fileHistory: string[] = treeProvider.getFileHistory();
        fileHistory
            .slice()
            .reverse()
            .filter((item) => item.substring(1, item.indexOf("]")).trim() === profileName.toUpperCase())
            .forEach((file) => {
                treeProvider.removeFileHistory(file);
            });
    }
    // Delete from Favorites
    treeProvider.removeFavProfile(profileName, false);
    // Delete from Tree
    treeProvider.mSessionNodes.forEach((sessNode) => {
        if (sessNode.getProfileName() === profileName) {
            treeProvider.deleteSession(sessNode);
            sessNode.dirty = true;
            treeProvider.refresh();
        }
    });
    // Delete from Sessions list
    const setting: any = {
        ...vscode.workspace.getConfiguration().get(schema),
    };
    let sess: string[] = setting.sessions;
    let fave: string[] = setting.favorites;
    sess = sess.filter((value) => {
        return value.trim() !== profileName;
    });
    fave = fave.filter((element) => {
        return element.substring(1, element.indexOf("]")).trim() !== profileName;
    });
    setting.sessions = sess;
    setting.favorites = fave;
    await vscode.workspace.getConfiguration().update(schema, setting, vscode.ConfigurationTarget.Global);
}
