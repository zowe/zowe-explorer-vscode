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

import { IZoweTree, IZoweTreeNode, PersistenceSchemaEnum } from "@zowe/zowe-explorer-api";
import * as globals from "../globals";
import { ZoweLogger } from "./LoggerUtils";
import { SettingsConfig } from "./SettingsConfig";

export async function removeSession(treeProvider: IZoweTree<IZoweTreeNode>, profileName: string): Promise<void> {
    ZoweLogger.trace("SessionUtils.removeSession called.");
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
        ...SettingsConfig.getDirectValue(schema),
    };
    let sess: string[] = setting.sessions;
    let fave: string[] = setting.favorites;
    sess = sess?.filter((value) => {
        return value.trim() !== profileName;
    });
    fave = fave?.filter((element) => {
        return element.substring(1, element.indexOf("]")).trim() !== profileName;
    });
    setting.sessions = sess;
    setting.favorites = fave;
    await SettingsConfig.setDirectValue(schema, setting);
}
