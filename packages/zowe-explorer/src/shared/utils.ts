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

// Generic utility functions related to all node types. See ./src/utils.ts for other utility functions.

import * as vscode from "vscode";
import * as path from "path";
import * as globals from "../globals";
import { Gui, IZoweTreeNode, IZoweDatasetTreeNode, IZoweUSSTreeNode, IZoweJobTreeNode, IZoweTree, Types, ZosEncoding } from "@zowe/zowe-explorer-api";
import { ZoweLogger } from "../utils/ZoweLogger";
import { LocalStorageKey, ZoweLocalStorage } from "../utils/ZoweLocalStorage";
import { zosEncodingToString } from "../uss/utils";
import { UssFSProvider } from "../uss/UssFSProvider";

export enum JobSubmitDialogOpts {
    Disabled,
    YourJobs,
    OtherUserJobs,
    AllJobs,
}
export const JOB_SUBMIT_DIALOG_OPTS = [
    vscode.l10n.t("Disabled"),
    vscode.l10n.t("Your jobs"),
    vscode.l10n.t("Other user jobs"),
    vscode.l10n.t("All jobs"),
];

export const SORT_DIRS: string[] = [vscode.l10n.t("Ascending"), vscode.l10n.t("Descending")];

export type LocalFileInfo = {
    name: string;
    path: string;
};

export function filterTreeByString(value: string, treeItems: vscode.QuickPickItem[]): vscode.QuickPickItem[] {
    ZoweLogger.trace("shared.utils.filterTreeByString called.");
    const filteredArray: vscode.QuickPickItem[] = [];
    value = value.toUpperCase().replace(/\*/g, "(.*)");
    const regex = new RegExp(value);
    treeItems.forEach((item) => {
        if (item.label.toUpperCase().match(regex)) {
            filteredArray.push(item);
        }
    });
    return filteredArray;
}

/**
 * Gets path to the icon, which is located in resources folder
 * @param iconFileName {string} Name of icon file with extension
 * @returns {object}
 */
export function getIconPathInResources(iconFileName: string): {
    light: string;
    dark: string;
} {
    return {
        light: path.join(globals.ROOTPATH, "resources", "light", iconFileName),
        dark: path.join(globals.ROOTPATH, "resources", "dark", iconFileName),
    };
}

/*************************************************************************************************************
 * Returns array of all subnodes of given node
 *************************************************************************************************************/
export function concatChildNodes(nodes: Types.IZoweNodeType[]): Types.IZoweNodeType[] {
    ZoweLogger.trace("shared.utils.concatChildNodes called.");
    let allNodes = new Array<Types.IZoweNodeType>();

    for (const node of nodes) {
        allNodes = allNodes.concat(concatChildNodes(node.children));
        allNodes.push(node);
    }
    return allNodes;
}

export function sortTreeItems(favorites: vscode.TreeItem[], specificContext): void {
    favorites.sort((a, b) => {
        if (a.contextValue === specificContext) {
            if (b.contextValue === specificContext) {
                return a.label.toString().toUpperCase() > b.label.toString().toUpperCase() ? 1 : -1;
            }

            return -1;
        }

        if (b.contextValue === specificContext) {
            return 1;
        }

        return a.label.toString().toUpperCase() > b.label.toString().toUpperCase() ? 1 : -1;
    });
}

/*************************************************************************************************************
 * Determine IDE name to display based on app environment
 *************************************************************************************************************/
export function getAppName(): "VS Code" {
    return "VS Code";
}

/**
 * Append a suffix on a ds file so it can be interpretted with syntax highlighter
 *
 * Rules of mapping:
 *  1. Start with LLQ and work backwards as it is at this end usually
 *   the language is specified
 *  2. Dont do this for the top level HLQ
 */
export function getLanguageId(label: string): string | null {
    const limit = 5;
    const bracket = label.indexOf("(");
    const split = bracket > -1 ? label.substr(0, bracket).split(".", limit) : label.split(".", limit);
    for (let i = split.length - 1; i > 0; i--) {
        if (split[i] === "C") {
            return "c";
        }
        if (["JCL", "JCLLIB", "CNTL", "PROC", "PROCLIB"].includes(split[i])) {
            return "jcl";
        }
        if (["COBOL", "CBL", "COB", "SCBL"].includes(split[i])) {
            return "cobol";
        }
        if (["COPYBOOK", "COPY", "CPY", "COBCOPY"].includes(split[i])) {
            return "copybook";
        }
        if (["INC", "INCLUDE", "PLINC"].includes(split[i])) {
            return "inc";
        }
        if (["PLI", "PL1", "PLX", "PCX"].includes(split[i])) {
            return "pli";
        }
        if (["SH", "SHELL"].includes(split[i])) {
            return "shellscript";
        }
        if (["REXX", "REXEC", "EXEC"].includes(split[i])) {
            return "rexx";
        }
        if (split[i] === "XML") {
            return "xml";
        }
        if (split[i] === "ASM" || split[i].indexOf("ASSEMBL") > -1) {
            return "asm";
        }
        if (split[i] === "LOG" || split[i].indexOf("SPFLOG") > -1) {
            return "log";
        }
    }
    return null;
}

export function checkIfChildPath(parentPath: string, childPath: string): boolean {
    const relativePath = path.relative(parentPath, childPath);
    return relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

// Type guarding for current IZoweNodeType.
// Makes it possible to have multiple types in a function signature, but still be able to use type specific code inside the function definition
export function isZoweDatasetTreeNode(node: Types.IZoweNodeType): node is IZoweDatasetTreeNode {
    return (node as IZoweDatasetTreeNode).pattern !== undefined;
}

export function isZoweUSSTreeNode(node: IZoweDatasetTreeNode | IZoweUSSTreeNode | IZoweJobTreeNode): node is IZoweUSSTreeNode {
    return (node as IZoweUSSTreeNode).openUSS !== undefined;
}

export function isZoweJobTreeNode(node: IZoweDatasetTreeNode | IZoweUSSTreeNode | IZoweJobTreeNode): node is IZoweJobTreeNode {
    return (node as IZoweJobTreeNode).job !== undefined;
}

export function getSelectedNodeList(node: IZoweTreeNode, nodeList: IZoweTreeNode[]): IZoweTreeNode[] {
    let resultNodeList: IZoweTreeNode[] = [];
    if (!nodeList) {
        resultNodeList.push(node);
    } else {
        resultNodeList = nodeList;
    }
    return resultNodeList;
}

/**
 * Function that validates job prefix
 * @param {string} text - prefix text
 * @returns undefined | string
 */
export function jobStringValidator(text: string, localizedParam: "owner" | "prefix"): string | null {
    switch (localizedParam) {
        case "owner":
            return text.length > globals.JOBS_MAX_PREFIX ? vscode.l10n.t("Invalid job owner") : null;
        case "prefix":
        default:
            return text.length > globals.JOBS_MAX_PREFIX ? vscode.l10n.t("Invalid job prefix") : null;
    }
}

export function updateOpenFiles<T extends IZoweTreeNode>(treeProvider: IZoweTree<T>, docPath: string, value: T | null): void {
    if (treeProvider.openFiles) {
        treeProvider.openFiles[docPath] = value;
    }
}

export function getCachedEncoding(node: IZoweTreeNode): string | undefined {
    let cachedEncoding: ZosEncoding;
    if (isZoweUSSTreeNode(node)) {
        cachedEncoding = (node.getSessionNode() as IZoweUSSTreeNode).encodingMap[node.fullPath];
    } else {
        const isMemberNode = node.contextValue.startsWith(globals.DS_MEMBER_CONTEXT);
        const dsKey = isMemberNode ? `${node.getParent().label as string}(${node.label as string})` : (node.label as string);
        cachedEncoding = (node.getSessionNode() as IZoweDatasetTreeNode).encodingMap[dsKey];
    }
    return cachedEncoding?.kind === "other" ? cachedEncoding.codepage : cachedEncoding?.kind;
}

export async function promptForEncoding(node: IZoweDatasetTreeNode | IZoweUSSTreeNode, taggedEncoding?: string): Promise<ZosEncoding | undefined> {
    const ebcdicItem: vscode.QuickPickItem = {
        label: vscode.l10n.t("EBCDIC"),
        description: vscode.l10n.t("z/OS default codepage"),
    };
    const binaryItem: vscode.QuickPickItem = {
        label: vscode.l10n.t("Binary"),
        description: vscode.l10n.t("Raw data representation"),
    };
    const otherItem: vscode.QuickPickItem = {
        label: vscode.l10n.t("Other"),
        description: vscode.l10n.t("Specify another codepage"),
    };
    const items: vscode.QuickPickItem[] = [ebcdicItem, binaryItem, otherItem, globals.SEPARATORS.RECENT];
    const profile = node.getProfile();
    if (profile.profile?.encoding != null) {
        items.splice(0, 0, {
            label: profile.profile?.encoding,
            description: vscode.l10n.t({
                message: "From profile {0}",
                args: [profile.name],
                comment: ["Profile name"],
            }),
        });
    }
    if (taggedEncoding != null) {
        items.splice(0, 0, {
            label: taggedEncoding,
            description: vscode.l10n.t("USS file tag"),
        });
    }

    let zosEncoding = node.getEncoding();
    if (zosEncoding === undefined && isZoweUSSTreeNode(node)) {
        zosEncoding = await UssFSProvider.instance.fetchEncodingForUri(node.resourceUri);
    }
    let currentEncoding = zosEncoding ? zosEncodingToString(zosEncoding) : getCachedEncoding(node);
    if (zosEncoding?.kind === "binary") {
        currentEncoding = binaryItem.label;
    } else if (zosEncoding === null || zosEncoding?.kind === "text" || currentEncoding === null || currentEncoding === "text") {
        currentEncoding = ebcdicItem.label;
    }
    const encodingHistory = ZoweLocalStorage.getValue<string[]>(LocalStorageKey.ENCODING_HISTORY) ?? [];
    if (encodingHistory.length > 0) {
        for (const encoding of encodingHistory) {
            items.push({ label: encoding });
        }
    } else {
        // Pre-populate recent list with some common encodings
        items.push({ label: "IBM-1047" }, { label: "ISO8859-1" });
    }

    let response = (
        await Gui.showQuickPick(items, {
            title: vscode.l10n.t({
                message: "Choose encoding for {0}",
                args: [node.label as string],
                comment: ["Node label"],
            }),
            placeHolder:
                currentEncoding &&
                vscode.l10n.t({
                    message: "Current encoding is {0}",
                    args: [currentEncoding],
                    comment: ["Encoding name"],
                }),
        })
    )?.label;
    let encoding: ZosEncoding;
    switch (response) {
        case ebcdicItem.label:
            encoding = { kind: "text" };
            break;
        case binaryItem.label:
            encoding = { kind: "binary" };
            break;
        case otherItem.label:
            response = await Gui.showInputBox({
                title: vscode.l10n.t({
                    message: "Choose encoding for {0}",
                    args: [node.label as string],
                    comment: ["Node label"],
                }),
                placeHolder: vscode.l10n.t("Enter a codepage (e.g., 1047, IBM-1047)"),
            });
            if (response != null) {
                encoding = { kind: "other", codepage: response };
                encodingHistory.push(encoding.codepage);
                ZoweLocalStorage.setValue(LocalStorageKey.ENCODING_HISTORY, encodingHistory.slice(0, globals.MAX_FILE_HISTORY));
            }
            break;
        default:
            if (response != null) {
                encoding = { kind: "other", codepage: response };
            }
            break;
    }
    return encoding;
}
