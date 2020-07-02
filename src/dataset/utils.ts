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
import * as zowe from "@zowe/cli";
import * as vscode from "vscode";

// tslint:disable-next-line: no-duplicate-imports

export function getProfileAndDataSetName(node: IZoweNodeType) {
    let profileName;
    let dataSetName;
    if (node.contextValue.includes(globals.FAV_SUFFIX)) {
        profileName = node.label.substring(1, node.label.indexOf("]"));
        dataSetName = node.label.substring(node.label.indexOf(":") + 2);
    } else {
        profileName = node.getParent().getLabel();
        dataSetName = node.label.trim();
    }

    return {profileName, dataSetName};
}

export function getNodeLabels(node: IZoweNodeType) {
    if (node.contextValue.includes(globals.DS_MEMBER_CONTEXT)) {
        return { ...getProfileAndDataSetName(node.getParent()), memberName: node.getLabel()};
    } else {
        return getProfileAndDataSetName(node);
    }
}

export function getDatasetLabel(node: ZoweDatasetNode) {
    if (node.getParent() && contextually.isFavoriteContext(node.getParent())) {
        const profileEnd = "]: ";
        const profileIndex = node.label.indexOf(profileEnd);
        return node.label.substr(profileIndex + profileEnd.length, node.label.length);
    }
    return node.label;
}

export function getTypeEnumAndOptionsFromString(typeString) {
    // Decide the settings of the data set based on the user's selection
    let typeEnum;
    let createOptions;
    switch (typeString) {
        case `Data Set Binary`:
            typeEnum = zowe.CreateDataSetTypeEnum.DATA_SET_BINARY;
            createOptions = vscode.workspace.getConfiguration("Zowe-Default-Datasets-Binary");
            break;
        case `Data Set C`:
            typeEnum = zowe.CreateDataSetTypeEnum.DATA_SET_C;
            createOptions = vscode.workspace.getConfiguration("Zowe-Default-Datasets-C");
            break;
        case `Data Set Classic`:
            typeEnum = zowe.CreateDataSetTypeEnum.DATA_SET_CLASSIC;
            createOptions = vscode.workspace.getConfiguration("Zowe-Default-Datasets-Classic");
            break;
        case `Data Set Partitioned`:
            typeEnum = zowe.CreateDataSetTypeEnum.DATA_SET_PARTITIONED;
            createOptions = vscode.workspace.getConfiguration("Zowe-Default-Datasets-PDS");
            break;
        case `Data Set Sequential`:
            typeEnum = zowe.CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL;
            createOptions = vscode.workspace.getConfiguration("Zowe-Default-Datasets-PS");
            break;
    }
    return {type: typeEnum, options: createOptions};
}

export function getStringFromTypeEnum(typeEnum): string {
    let typeString;
    switch (typeEnum) {
        case zowe.CreateDataSetTypeEnum.DATA_SET_BINARY:
            typeString = `Data Set Binary`;
            break;
        case zowe.CreateDataSetTypeEnum.DATA_SET_C:
            typeString = `Data Set C`;
            break;
        case zowe.CreateDataSetTypeEnum.DATA_SET_CLASSIC:
            typeString = `Data Set Classic`;
            break;
        case zowe.CreateDataSetTypeEnum.DATA_SET_PARTITIONED:
            typeString = `Data Set Partitioned`;
            break;
        case zowe.CreateDataSetTypeEnum.DATA_SET_SEQUENTIAL:
            typeString = `Data Set Sequential`;
            break;
    }
    return typeString;
}
