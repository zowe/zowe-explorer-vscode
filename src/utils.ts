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

import * as path from "path";
import { TreeItem, QuickPickItem, QuickPick, window } from "vscode";
import * as extension from "../src/extension";
import * as nls from "vscode-nls";
import { ZoweUSSNode } from "./ZoweUSSNode";
import { ZoweNode } from "./ZoweNode";
const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

/*
 * Created this file to be a place where commonly used functions will be defined.
 * I noticed we have a lot of repetition of some common
 * functionality in many places.
 */
export function applyIcons(node: TreeItem, state?: string ): any {
    let light: string;
    let dark: string;

    if ([extension.DS_PDS_CONTEXT, extension.DS_PDS_CONTEXT + extension.FAV_SUFFIX,
            extension.USS_DIR_CONTEXT,
            extension.USS_DIR_CONTEXT + extension.FAV_SUFFIX,
            extension.JOBS_JOB_CONTEXT,
            extension.JOBS_JOB_CONTEXT + extension.FAV_SUFFIX].includes(node.contextValue)) {
        if (state === extension.ICON_STATE_OPEN) {
            light = path.join(__dirname, "..", "..", "resources", "light", "folder-open.svg");
            dark = path.join(__dirname, "..", "..", "resources", "dark", "folder-open.svg");
        } else {
            light = path.join(__dirname, "..", "..", "resources", "light", "folder-closed.svg");
            dark = path.join(__dirname, "..", "..", "resources", "dark", "folder-closed.svg");
        }
    } else if ([extension.FAVORITE_CONTEXT].includes(node.contextValue)) {
        if (state === extension.ICON_STATE_OPEN) {
            light = path.join(__dirname, "..", "..", "resources", "light", "folder-root-favorite-open.svg");
            dark = path.join(__dirname, "..", "..", "resources", "dark", "folder-root-favorite-open.svg");
        } else {
            light = path.join(__dirname, "..", "..", "resources", "light", "folder-root-favorite-closed.svg");
            dark = path.join(__dirname, "..", "..", "resources", "dark", "folder-root-favorite-closed.svg");
        }
    } else if ([extension.DS_SESSION_CONTEXT, extension.USS_SESSION_CONTEXT,
                extension.JOBS_SESSION_CONTEXT].includes(node.contextValue)) {
        if (state === extension.ICON_STATE_OPEN) {
            light = path.join(__dirname, "..", "..", "resources", "light", "folder-root-default-open.svg");
            dark = path.join(__dirname, "..", "..", "resources", "dark", "folder-root-default-open.svg");
        } else {
            light = path.join(__dirname, "..", "..", "resources", "light", "folder-root-default-closed.svg");
            dark = path.join(__dirname, "..", "..", "resources", "dark", "folder-root-default-closed.svg");
        }
    } else if ([extension.DS_SESSION_CONTEXT + extension.FAV_SUFFIX,
                extension.JOBS_SESSION_CONTEXT + extension.FAV_SUFFIX,
                extension.USS_SESSION_CONTEXT + extension.FAV_SUFFIX].includes(node.contextValue)) {
        light = path.join(__dirname, "..", "..", "resources", "light", "pattern.svg");
        dark = path.join(__dirname, "..", "..", "resources", "dark", "pattern.svg");
    } else if ([extension.DS_DS_CONTEXT,
                extension.DS_DS_CONTEXT + extension.FAV_SUFFIX,
                extension.DS_MEMBER_CONTEXT, extension.DS_TEXT_FILE_CONTEXT,
                extension.DS_TEXT_FILE_CONTEXT + extension.FAV_SUFFIX,
                extension.JOBS_SPOOL_CONTEXT].includes(node.contextValue)) {
        light = path.join(__dirname, "..", "..", "resources", "light", "document.svg");
        dark = path.join(__dirname, "..", "..", "resources", "dark", "document.svg");
    } else if ([extension.DS_MIGRATED_FILE_CONTEXT,
                extension.DS_MIGRATED_FILE_CONTEXT + extension.FAV_SUFFIX].includes(node.contextValue)) {
        light = path.join(__dirname, "..", "..", "resources", "dark", "document.svg");
        dark = path.join(__dirname, "..", "..", "resources", "light", "document.svg");
    } else if ([extension.DS_BINARY_FILE_CONTEXT,
                extension.DS_BINARY_FILE_CONTEXT + extension.FAV_SUFFIX].includes(node.contextValue)) {
        light = path.join(__dirname, "..", "..", "resources", "light", "document.svg");
        dark = path.join(__dirname, "..", "..", "resources", "dark", "document.svg");
    } else {
        return undefined;
    }
    node.iconPath = { light, dark };
    return { light, dark };
}

export function sortTreeItems(favorites: TreeItem[], specificContext ) {
    favorites.sort((a, b) => {
        if (a.contextValue === specificContext) {
            if (b.contextValue === specificContext) {
                return a.label.toUpperCase() > b.label.toUpperCase() ? 1 : -1;
            } else {
                return -1;
            }
        } else if (b.contextValue === specificContext) {
            return 1;
        }
        return a.label.toUpperCase() > b.label.toUpperCase() ? 1 : -1;
    });
}

/**
 * For no obvious reason a label change is often required to make a node repaint.
 * This function does this by adding or removing a blank.
 * @param {TreeItem} node - the node element
 */
export function labelHack( node: TreeItem ): void {
    node.label = node.label.endsWith(" ") ? node.label.substring(0, node.label.length -1 ) : node.label+ " ";
}

export async function resolveQuickPickHelper(quickpick: QuickPick<QuickPickItem>): Promise<QuickPickItem | undefined> {
    return new Promise<QuickPickItem | undefined>(
        (c) => quickpick.onDidAccept(() => c(quickpick.activeItems[0])));
}

// tslint:disable-next-line: max-classes-per-file
export class FilterItem implements QuickPickItem {
    constructor(private text: string) { }
    get label(): string { return this.text; }
    get description(): string { return ""; }
    get alwaysShow(): boolean { return false; }
}

// tslint:disable-next-line: max-classes-per-file
export class FilterDescriptor implements QuickPickItem {
    constructor(private text: string) { }
    get label(): string { return this.text; }
    get description(): string { return ""; }
    get alwaysShow(): boolean { return true; }
}

// tslint:disable-next-line: max-classes-per-file
export class OwnerFilterDescriptor extends FilterDescriptor {
    constructor() {
        super("\uFF0B " + localize("zosJobsProvider.option.prompt.createOwner",
        "Owner/Prefix Job Search"));
    }
}
// tslint:disable-next-line: max-classes-per-file
export class JobIdFilterDescriptor extends FilterDescriptor {
    constructor() {
        super("\uFF0B " + localize("zosJobsProvider.option.prompt.createId",
        "Job Id search"));
    }
}

/*************************************************************************************************************
 * Returns array of all subnodes of given node
 *************************************************************************************************************/
export function concatUSSChildNodes(nodes: ZoweUSSNode[]) {
    let allNodes = new Array<ZoweUSSNode>();

    for (const node of nodes) {
        allNodes = allNodes.concat(concatUSSChildNodes(node.children));
        allNodes.push(node);
    }

    return allNodes;
}

/*************************************************************************************************************
 * Returns array of all subnodes of given node
 *************************************************************************************************************/
export function concatChildNodes(nodes: ZoweNode[]) {
    let allNodes = new Array<ZoweNode>();

    for (const node of nodes) {
        allNodes = allNodes.concat(concatChildNodes(node.children));
        allNodes.push(node);
    }

    return allNodes;
}

/*************************************************************************************************************
 * Determine IDE name to display based on app environment
 *************************************************************************************************************/
export function getAppName(isTheia: boolean) {
    return isTheia? "Theia" : "VS Code";
}

/*************************************************************************************************************
 * Error Hanndling
 * @param {errorDetails} error.mDetails
 * @param {label} - additional information such as profile name, credentials, messageID etc
 * @param {moreInfo} - additional/customized error messages
 *************************************************************************************************************/
export function errorHandling(errorDetails: any, label?: string, moreInfo?: string) {
    let httpErrCode = null;

    if (errorDetails.mDetails !== undefined) {
        httpErrCode = errorDetails.mDetails.errorCode;
    }

    switch(httpErrCode) {
        // tslint:disable-next-line: no-magic-numbers
        case 401 : {
            window.showErrorMessage(localize("errorHandling.invalid.credentials", "Invalid Credentials. ") +
                localize("errorHandling.invalid.credentials2","Please ensure the username and password for ") +
                `\n${label}\n` +
                localize("errorHandling.invalid.credentials3", " are valid or this may lead to a lock-out."));
            break;
        }
        default: {
            window.showErrorMessage(moreInfo);
            break;
        }
    }
    return;
}
