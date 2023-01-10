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
import { IZoweNodeType } from "@zowe/zowe-explorer-api";

export function getProfileAndDataSetName(node: IZoweNodeType) {
    let profileName;
    let dataSetName;
    profileName = node.getParent().getLabel();
    dataSetName = node.label as string;
    return { profileName, dataSetName };
}

export function getNodeLabels(node: IZoweNodeType) {
    if (node.contextValue.includes(globals.DS_MEMBER_CONTEXT)) {
        return {
            ...getProfileAndDataSetName(node.getParent()),
            memberName: node.getLabel(),
            contextValue: node.contextValue,
        };
    } else {
        return { ...getProfileAndDataSetName(node), memberName: undefined, contextValue: node.contextValue };
    }
}
export function validateDataSetName(dsName: string): boolean {
    if (dsName.length > globals.MAX_DATASET_LENGTH) {
        return false;
    }
    return globals.DS_NAME_REGEX_CHECK.test(dsName);
}

export function validateMemberName(member: string): boolean {
    if (member.length > globals.MAX_MEMBER_LENGTH) {
        return false;
    }
    return globals.MEMBER_NAME_REGEX_CHECK.test(member);
}
