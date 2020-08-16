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

import * as globals from "../globals";
import { IZoweNodeType } from "../api/IZoweTreeNode";
import { ZoweDatasetNode } from "./ZoweDatasetNode";
import * as contextually from "../shared/context";

// tslint:disable-next-line: no-duplicate-imports

export function getProfileAndDataSetName(node: IZoweNodeType) {
    let profileName;
    let dataSetName;
    profileName = node.getParent().getLabel();
    dataSetName = node.label.trim();
    return {profileName, dataSetName};
}

export function getNodeLabels(node: IZoweNodeType) {
    if (node.contextValue.includes(globals.DS_MEMBER_CONTEXT)) {
        return { ...getProfileAndDataSetName(node.getParent()), memberName: node.getLabel()};
    } else {
        return getProfileAndDataSetName(node);
    }
}
