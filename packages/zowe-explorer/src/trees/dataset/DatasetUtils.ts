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
import { DS_EXTENSION_MAP, IZoweDatasetTreeNode, Types } from "@zowe/zowe-explorer-api";
import { Constants } from "../../configuration/Constants";
import { ZoweLogger } from "../../tools/ZoweLogger";
export class DatasetUtils {
    public static readonly DATASET_SORT_OPTS = [
        `$(case-sensitive) ${vscode.l10n.t("Name (default)")}`,
        `$(calendar) ${vscode.l10n.t("Date Created")}`,
        `$(calendar) ${vscode.l10n.t("Date Modified")}`,
        `$(account) ${vscode.l10n.t("User ID")}`,
        `$(fold) ${vscode.l10n.t("Sort Direction")}`,
    ];

    // eslint-disable-next-line no-magic-numbers
    public static readonly DATASET_FILTER_OPTS = [this.DATASET_SORT_OPTS[2], this.DATASET_SORT_OPTS[3]];

    public static getProfileAndDataSetName(node: Types.IZoweNodeType): {
        profileName: string;
        dataSetName: string;
    } {
        ZoweLogger.trace("dataset.utils.getProfileAndDataSetName called.");
        return { profileName: node.getParent().getLabel() as string, dataSetName: node.label as string };
    }

    public static async getNodeLabels(node: Types.IZoweNodeType): Promise<
        Array<{
            memberName: string;
            contextValue: string;
            profileName: string;
            dataSetName: string;
        }>
    > {
        ZoweLogger.trace("dataset.utils.getNodeLabels called.");
        if (node.contextValue.includes(Constants.DS_MEMBER_CONTEXT)) {
            return [
                {
                    ...DatasetUtils.getProfileAndDataSetName(node.getParent()),
                    memberName: node.getLabel() as string,
                    contextValue: node.contextValue,
                },
            ];
        } else if (node.contextValue.includes(Constants.DS_PDS_CONTEXT)) {
            const arr: Array<{
                memberName: string;
                contextValue: string;
                profileName: string;
                dataSetName: string;
            }> = [];
            const children = await node.getChildren();
            for (const item of children) {
                arr.push({
                    profileName: node.getParent().label as string,
                    dataSetName: node.label as string,
                    memberName: item.getLabel() as string,
                    contextValue: node.contextValue,
                });
            }
            return arr;
        } else {
            return [{ ...DatasetUtils.getProfileAndDataSetName(node), memberName: undefined, contextValue: node.contextValue }];
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
                if (matches.some((match) => (match instanceof RegExp ? match.test(split[i]) : match === split[i]))) {
                    return ext;
                }
            }
        }
        return null;
    }

    /**
     * Gets a map of file extensions for all members of a PDS to be used for IDownloadOptions.
     */
    public static async getExtensionMap(node: IZoweDatasetTreeNode): Promise<{ [key: string]: string }> {
        ZoweLogger.trace("dataset.utils.getExtensionMap called.");
        const extensionMap: { [key: string]: string } = {};
        const children = await node.getChildren();

        for (const child of children) {
            let extension;
            for (const [ext, matches] of DS_EXTENSION_MAP.entries()) {
                if (matches.some((match) => (match instanceof RegExp ? match.test(child.label as string) : match === (child.label as string)))) {
                    extension = ext;
                    break;
                }
            }

            if (extension) {
                extensionMap[child.label as string] = extension;
            } else {
                const parentExtension = DatasetUtils.getExtension(node.label as string);
                if (parentExtension) {
                    extensionMap[child.label as string] = parentExtension;
                }
            }
        }

        return extensionMap;
    }
}
