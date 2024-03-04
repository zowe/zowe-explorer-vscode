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

import * as globals from "../globals";
import * as vscode from "vscode";
import { Types } from "@zowe/zowe-explorer-api";
import { ZoweLogger } from "../utils/ZoweLogger";

export const DATASET_SORT_OPTS = [
    vscode.l10n.t("$(case-sensitive) Name (default)"),
    vscode.l10n.t("$(calendar) Date Created"),
    vscode.l10n.t("$(calendar) Date Modified"),
    vscode.l10n.t("$(account) User ID"),
    vscode.l10n.t("$(fold) Sort Direction"),
];

export const DATASET_FILTER_OPTS = [vscode.l10n.t("$(calendar) Date Modified"), vscode.l10n.t("$(account) User ID")];

export function getProfileAndDataSetName(node: Types.IZoweNodeType): {
    profileName: string;
    dataSetName: string;
} {
    ZoweLogger.trace("dataset.utils.getProfileAndDataSetName called.");
    return { profileName: node.getParent().getLabel() as string, dataSetName: node.label as string };
}

export function getNodeLabels(node: Types.IZoweNodeType): {
    memberName: string;
    contextValue: string;
    profileName: string;
    dataSetName: string;
} {
    ZoweLogger.trace("dataset.utils.getNodeLabels called.");
    if (node.contextValue.includes(globals.DS_MEMBER_CONTEXT)) {
        return {
            ...getProfileAndDataSetName(node.getParent()),
            memberName: node.getLabel() as string,
            contextValue: node.contextValue,
        };
    } else {
        return { ...getProfileAndDataSetName(node), memberName: undefined, contextValue: node.contextValue };
    }
}
export function validateDataSetName(dsName: string): boolean {
    ZoweLogger.trace("dataset.utils.validateDataSetName called.");
    if (dsName.length > globals.MAX_DATASET_LENGTH) {
        return false;
    }
    return globals.DS_NAME_REGEX_CHECK.test(dsName);
}

export function validateMemberName(member: string): boolean {
    ZoweLogger.trace("dataset.utils.validateMemberName called.");
    if (member.length > globals.MAX_MEMBER_LENGTH) {
        return false;
    }
    return globals.MEMBER_NAME_REGEX_CHECK.test(member);
}
