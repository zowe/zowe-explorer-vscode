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
// tslint:disable-next-line: prefer-const
let log: Logger;
/**
 * Refreshes treeView
 *
 * @param {DataSetTree} datasetProvider
 */
export async function refreshAll(datasetProvider: DatasetTree) {
    datasetProvider.mSessionNodes.forEach((sessNode) => {
        if (sessNode.contextValue === extension.DS_SESSION_CONTEXT) {
            utils.labelHack(sessNode);
            sessNode.children = [];
            sessNode.dirty = true;
        }
    });
    await datasetProvider.refresh();
    await Profiles.getInstance().refresh();

    const allProf = Profiles.getInstance().getProfiles();
    datasetProvider.mSessionNodes.forEach((sessNode) => {
        if (sessNode.contextValue === extension.DS_SESSION_CONTEXT) {
            for (const profNode of allProf) {
                if (sessNode.getProfileName() === profNode.name) {
                    sessNode.getProfile().profile = profNode.profile;
                    const SessionProfile = profNode.profile as ISession;
                    if (sessNode.getSession().ISession !== SessionProfile) {
                        sessNode.getSession().ISession.user = SessionProfile.user;
                        sessNode.getSession().ISession.password = SessionProfile.password;
                        sessNode.getSession().ISession.base64EncodedAuth = SessionProfile.base64EncodedAuth;
                        sessNode.getSession().ISession.hostname = SessionProfile.hostname;
                        sessNode.getSession().ISession.port = SessionProfile.port;
                        sessNode.getSession().ISession.rejectUnauthorized = SessionProfile.rejectUnauthorized;
                    }
                }
            }
        }
    });
    await datasetProvider.refresh();

}
