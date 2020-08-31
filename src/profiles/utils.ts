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


import * as vscode from "vscode";
import { Profiles } from "../Profiles";
import { ISession } from "@zowe/imperative";
import { setProfile, setSession } from "../utils";
import { IZoweTreeNode } from "../api/IZoweTreeNode";

/*************************************************************************************************************
 * Refresh Profile and Session
 * @param {sessNode} IZoweTreeNode
 *************************************************************************************************************/
export function refreshTree(sessNode: IZoweTreeNode) {
    const allProf = Profiles.getInstance().getProfiles();
    for (const profNode of allProf) {
        if (sessNode.getProfileName() === profNode.name) {
            setProfile(sessNode, profNode.profile);
            const SessionProfile = profNode.profile as ISession;
            if (sessNode.getSession().ISession !== SessionProfile) {
                setSession(sessNode, SessionProfile);
            }
        }
    }
    sessNode.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
}
