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

import * as vscode from "vscode";
import { DS_EXTENSION_MAP, Types } from "@zowe/zowe-explorer-api";
import { Constants } from "../../configuration/Constants";
import { ZoweLogger } from "../../tools/ZoweLogger";

export class DatasetUtils {
    public static DATASET_SORT_OPTS = [
        vscode.l10n.t("$(case-sensitive) Name (default)"),
        vscode.l10n.t("$(calendar) Date Created"),
        vscode.l10n.t("$(calendar) Date Modified"),
        vscode.l10n.t("$(account) User ID"),
        vscode.l10n.t("$(fold) Sort Direction"),
    ];

    public static DATASET_FILTER_OPTS = [vscode.l10n.t("$(calendar) Date Modified"), vscode.l10n.t("$(account) User ID")];

    public static getProfileAndDataSetName(node: Types.IZoweNodeType): {
        profileName: string;
        dataSetName: string;
    } {
        ZoweLogger.trace("dataset.utils.getProfileAndDataSetName called.");
        return { profileName: node.getParent().getLabel() as string, dataSetName: node.label as string };
    }

    public static getNodeLabels(node: Types.IZoweNodeType): {
        memberName: string;
        contextValue: string;
        profileName: string;
        dataSetName: string;
    } {
        ZoweLogger.trace("dataset.utils.getNodeLabels called.");
        if (node.contextValue.includes(Constants.DS_MEMBER_CONTEXT)) {
            return {
                ...DatasetUtils.getProfileAndDataSetName(node.getParent()),
                memberName: node.getLabel() as string,
                contextValue: node.contextValue,
            };
        } else {
            return { ...DatasetUtils.getProfileAndDataSetName(node), memberName: undefined, contextValue: node.contextValue };
        }
    }
    public static validateDataSetName(dsName: string): boolean {
        ZoweLogger.trace("dataset.utils.validateDataSetName called.");
        if (dsName.length > Constants.MAX_DATASET_LENGTH) {
            return false;
        }
        return Constants.DS_NAME_REGEX_CHECK.test(dsName);
    }

    public static validateMemberName(member: string): boolean {
        ZoweLogger.trace("dataset.utils.validateMemberName called.");
        if (member.length > Constants.MAX_MEMBER_LENGTH) {
            return false;
        }
        return Constants.MEMBER_NAME_REGEX_CHECK.test(member);
    }

    /**
     * Get the file extension for a Data Set (or data set member) based on its name or its PDS name.
     */
    public static getExtension(label: string): string | null {
        const limit = 5;
        const bracket = label.indexOf("(");
        const split = bracket > -1 ? label.substring(0, bracket).split(".", limit) : label.split(".", limit);
        for (let i = split.length - 1; i > 0; i--) {
            for (const [ext, matches] of DS_EXTENSION_MAP.entries()) {
                switch (ext) {
                    case ".asm":
                        if (split[i] === matches[0] || split[i].indexOf("ASSEMBL") > -1) {
                            return ext;
                        }
                        break;
                    case ".log":
                        if (split[i] === matches[0] || split[i].indexOf("SPFLOG") > -1) {
                            return ext;
                        }
                        break;
                    default:
                        if (matches.includes(split[i])) {
                            return ext;
                        }
                        break;
                }
            }
        }
        return null;
    }
}
