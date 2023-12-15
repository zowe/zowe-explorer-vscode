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

import * as fs from "fs";
import * as vscode from "vscode";
import * as path from "path";
import * as globals from "../globals";
import * as os from "os";
import {
    Gui,
    IZoweTreeNode,
    IZoweNodeType,
    IZoweDatasetTreeNode,
    IZoweUSSTreeNode,
    IZoweJobTreeNode,
    IZoweTree,
    ZosEncoding,
} from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import * as nls from "vscode-nls";
import { IZosFilesResponse, imperative } from "@zowe/cli";
import { IUploadOptions } from "@zowe/zos-files-for-zowe-sdk";
import { ZoweLogger } from "../utils/LoggerUtils";
import { isTypeUssTreeNode } from "./context";
import { markDocumentUnsaved } from "../utils/workspace";
import { errorHandling } from "../utils/ProfilesUtils";
import { ZoweLocalStorage } from "../utils/ZoweLocalStorage";

// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

export enum JobSubmitDialogOpts {
    Disabled,
    YourJobs,
    OtherUserJobs,
    AllJobs,
}
export const JOB_SUBMIT_DIALOG_OPTS = [
    localize("zowe.jobs.confirmSubmission.disabled", "Disabled"),
    localize("zowe.jobs.confirmSubmission.yourJobs", "Your jobs"),
    localize("zowe.jobs.confirmSubmission.otherUserJobs", "Other user jobs"),
    localize("zowe.jobs.confirmSubmission.allJobs", "All jobs"),
];

export const SORT_DIRS: string[] = [localize("sort.asc", "Ascending"), localize("sort.desc", "Descending")];

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
export function concatChildNodes(nodes: IZoweNodeType[]): IZoweNodeType[] {
    ZoweLogger.trace("shared.utils.concatChildNodes called.");
    let allNodes = new Array<IZoweNodeType>();

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
export function getAppName(isTheia: boolean): "Theia" | "VS Code" {
    return isTheia ? "Theia" : "VS Code";
}

/**
 * Returns the file path for the IZoweTreeNode
 *
 * @export
 * @param {string} label - If node is a member, label includes the name of the PDS
 * @param {IZoweTreeNode} node
 */
export function getDocumentFilePath(label: string, node: IZoweTreeNode): string {
    const dsDir = globals.DS_DIR;
    const profName = node.getProfileName();
    const suffix = appendSuffix(label);
    return path.join(dsDir, profName || "", suffix);
}

/**
 * Append a suffix on a ds file so it can be interpretted with syntax highlighter
 *
 * Rules of mapping:
 *  1. Start with LLQ and work backwards as it is at this end usually
 *   the language is specified
 *  2. Dont do this for the top level HLQ
 */
function appendSuffix(label: string): string {
    const limit = 5;
    const bracket = label.indexOf("(");
    const split = bracket > -1 ? label.substr(0, bracket).split(".", limit) : label.split(".", limit);
    for (let i = split.length - 1; i > 0; i--) {
        if (["JCL", "JCLLIB", "CNTL", "PROC", "PROCLIB"].includes(split[i])) {
            return label.concat(".jcl");
        }
        if (["COBOL", "CBL", "COB", "SCBL"].includes(split[i])) {
            return label.concat(".cbl");
        }
        if (["COPYBOOK", "COPY", "CPY", "COBCOPY"].includes(split[i])) {
            return label.concat(".cpy");
        }
        if (["INC", "INCLUDE", "PLINC"].includes(split[i])) {
            return label.concat(".inc");
        }
        if (["PLI", "PL1", "PLX", "PCX"].includes(split[i])) {
            return label.concat(".pli");
        }
        if (["SH", "SHELL"].includes(split[i])) {
            return label.concat(".sh");
        }
        if (["REXX", "REXEC", "EXEC"].includes(split[i])) {
            return label.concat(".rexx");
        }
        if (split[i] === "XML") {
            return label.concat(".xml");
        }
        if (split[i] === "ASM" || split[i].indexOf("ASSEMBL") > -1) {
            return label.concat(".asm");
        }
        if (split[i] === "LOG" || split[i].indexOf("SPFLOG") > -1) {
            return label.concat(".log");
        }
    }
    return label;
}

export function checkForAddedSuffix(filename: string): boolean {
    // identify how close to the end of the string the last . is
    const dotPos = filename.length - (1 + filename.lastIndexOf("."));
    return (
        dotPos >= 2 &&
        dotPos <= 4 && // if the last characters are 2 to 4 long and lower case it has been added
        filename.substring(filename.length - dotPos) === filename.substring(filename.length - dotPos).toLowerCase()
    );
}

export function checkIfChildPath(parentPath: string, childPath: string): boolean {
    const relativePath = path.relative(parentPath, childPath);
    return relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

/**
 * Function that rewrites the document in the active editor thus marking it dirty
 * @param {vscode.TextDocument} doc - document to rewrite
 * @returns void
 */

export function markFileAsDirty(doc: vscode.TextDocument): void {
    const docText = doc.getText();
    const startPosition = new vscode.Position(0, 0);
    const endPosition = new vscode.Position(doc.lineCount, 0);
    const deleteRange = new vscode.Range(startPosition, endPosition);
    vscode.window.activeTextEditor.edit((editBuilder) => {
        editBuilder.delete(deleteRange);
        editBuilder.insert(startPosition, docText);
    });
}

export async function uploadContent(
    node: IZoweDatasetTreeNode | IZoweUSSTreeNode,
    doc: vscode.TextDocument,
    remotePath: string,
    profile?: imperative.IProfileLoaded,
    etagToUpload?: string,
    returnEtag?: boolean
): Promise<IZosFilesResponse> {
    const uploadOptions: IUploadOptions = {
        etag: etagToUpload,
        returnEtag: true,
        binary: node.binary,
        encoding: node.encoding ?? profile.profile?.encoding,
        responseTimeout: profile.profile?.responseTimeout,
    };
    if (isZoweDatasetTreeNode(node)) {
        return ZoweExplorerApiRegister.getMvsApi(profile).putContents(doc.fileName, remotePath, uploadOptions);
    } else {
        // if new api method exists, use it
        if (ZoweExplorerApiRegister.getUssApi(profile).putContent) {
            const task: imperative.ITaskWithStatus = {
                percentComplete: 0,
                statusMessage: localize("uploadContent.putContents", "Uploading USS file"),
                stageName: 0, // TaskStage.IN_PROGRESS - https://github.com/kulshekhar/ts-jest/issues/281
            };
            const result = ZoweExplorerApiRegister.getUssApi(profile).putContent(doc.fileName, remotePath, {
                task,
                ...uploadOptions,
            });
            return result;
        } else {
            return ZoweExplorerApiRegister.getUssApi(profile).putContents(doc.fileName, remotePath, node.binary, null, etagToUpload, returnEtag);
        }
    }
}

/**
 * Function that will forcefully upload a file and won't check for matching Etag
 */
export function willForceUpload(
    node: IZoweDatasetTreeNode | IZoweUSSTreeNode,
    doc: vscode.TextDocument,
    remotePath: string,
    profile?: imperative.IProfileLoaded
): Thenable<void> {
    // setup to handle both cases (dataset & USS)
    let title: string;
    if (isZoweDatasetTreeNode(node)) {
        title = localize("saveFile.response.save.title", "Saving data set...");
    } else {
        title = localize("saveUSSFile.response.title", "Saving file...");
    }
    if (globals.ISTHEIA) {
        Gui.warningMessage(
            localize(
                "saveFile.error.theiaDetected",
                "A merge conflict has been detected. Since you are running inside Theia editor, a merge conflict resolution is not available yet."
            )
        );
    }
    // Don't wait for prompt to return since this would block the save queue
    return Gui.infoMessage(localize("saveFile.info.confirmUpload", "Would you like to overwrite the remote file?"), {
        items: [localize("saveFile.overwriteConfirmation.yes", "Yes"), localize("saveFile.overwriteConfirmation.no", "No")],
    }).then(async (selection) => {
        if (selection === localize("saveFile.overwriteConfirmation.yes", "Yes")) {
            try {
                const uploadResponse = await Gui.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title,
                    },
                    () => {
                        return uploadContent(node, doc, remotePath, profile, null, true);
                    }
                );
                if (uploadResponse.success) {
                    Gui.showMessage(uploadResponse.commandResponse);
                    if (node) {
                        // Upload API returns a singleton array for data sets and an object for USS files
                        node.setEtag(uploadResponse.apiResponse[0]?.etag ?? uploadResponse.apiResponse.etag);
                    }
                } else {
                    await markDocumentUnsaved(doc);
                    Gui.errorMessage(uploadResponse.commandResponse);
                }
            } catch (err) {
                await markDocumentUnsaved(doc);
                await errorHandling(err, profile.name);
            }
        } else {
            Gui.showMessage(localize("uploadContent.cancelled", "Upload cancelled."));
            markFileAsDirty(doc);
        }
    });
}

// Type guarding for current IZoweNodeType.
// Makes it possible to have multiple types in a function signature, but still be able to use type specific code inside the function definition
export function isZoweDatasetTreeNode(node: IZoweNodeType): node is IZoweDatasetTreeNode {
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
            return text.length > globals.JOBS_MAX_PREFIX ? localize("searchJobs.owner.invalid", "Invalid job owner") : null;
        case "prefix":
        default:
            return text.length > globals.JOBS_MAX_PREFIX ? localize("searchJobs.prefix.invalid", "Invalid job prefix") : null;
    }
}

export function getDefaultUri(): vscode.Uri {
    return vscode.workspace.workspaceFolders?.[0]?.uri ?? vscode.Uri.file(os.homedir());
}

/**
 * Function that triggers compare of the old and new document in the active editor
 * @param {vscode.TextDocument} doc - document to update and compare with previous content
 * @param {IZoweDatasetTreeNode | IZoweUSSTreeNode} node - IZoweTreeNode
 * @param {string} label - {optional} used by IZoweDatasetTreeNode to getContents of file
 * @param {boolean} binary - {optional} used by IZoweUSSTreeNode to getContents of file
 * @param {imperative.IProfileLoaded} profile - {optional}
 * @returns {Promise<void>}
 */
export async function compareFileContent(
    doc: vscode.TextDocument,
    node: IZoweDatasetTreeNode | IZoweUSSTreeNode,
    label?: string,
    profile?: imperative.IProfileLoaded
): Promise<void> {
    await markDocumentUnsaved(doc);
    const prof = node ? node.getProfile() : profile;
    let downloadResponse;

    if (isTypeUssTreeNode(node)) {
        downloadResponse = await ZoweExplorerApiRegister.getUssApi(prof).getContents(node.fullPath, {
            file: node.getUSSDocumentFilePath(),
            binary: node.binary,
            returnEtag: true,
            encoding: node.encoding ?? prof.profile?.encoding,
            responseTimeout: prof.profile?.responseTimeout,
        });
    } else {
        downloadResponse = await ZoweExplorerApiRegister.getMvsApi(prof).getContents(label, {
            file: doc.fileName,
            binary: node.binary,
            returnEtag: true,
            encoding: node.encoding ?? prof.profile?.encoding,
            responseTimeout: prof.profile?.responseTimeout,
        });
    }

    // If local and remote file size are the same, then VS Code won't detect
    // there is a conflict and remote changes may get overwritten. To work
    // around this limitation of VS Code, when the sizes are identical we
    // temporarily add a trailing newline byte to the local copy which forces
    // the file size to be different. This is a terrible hack but it works.
    // See https://github.com/microsoft/vscode/issues/119002
    const oldSize = doc.getText().length;
    const newSize = fs.statSync(doc.fileName).size;
    if (newSize === oldSize) {
        const edits = new vscode.WorkspaceEdit();
        edits.insert(doc.uri, doc.positionAt(oldSize), doc.eol.toString());
        await vscode.workspace.applyEdit(edits);
    }
    ZoweLogger.warn(localize("saveFile.etagMismatch.log.warning", "Remote file has changed. Presenting with way to resolve file."));
    await vscode.commands.executeCommand("workbench.files.action.compareWithSaved");
    if (newSize === oldSize) {
        const edits2 = new vscode.WorkspaceEdit();
        edits2.delete(doc.uri, new vscode.Range(doc.positionAt(oldSize), doc.positionAt(oldSize + doc.eol.toString().length)));
        await vscode.workspace.applyEdit(edits2);
    }
    // re-assign etag, so that it can be used with subsequent requests
    const downloadEtag = downloadResponse?.apiResponse?.etag;
    if (node && downloadEtag !== node.getEtag()) {
        node.setEtag(downloadEtag);
    }
}

export function updateOpenFiles<T extends IZoweTreeNode>(treeProvider: IZoweTree<T>, docPath: string, value: T | null): void {
    if (treeProvider.openFiles) {
        treeProvider.openFiles[docPath] = value;
    }
}

export function getCachedEncoding(node: IZoweTreeNode): ZosEncoding {
    if (isZoweUSSTreeNode(node)) {
        return (node.getSessionNode() as IZoweUSSTreeNode).encodingMap[node.fullPath];
    } else {
        const isMemberNode = node.contextValue.startsWith(globals.DS_MEMBER_CONTEXT);
        const dsKey = isMemberNode ? `${node.getParent().label as string}(${node.label as string})` : (node.label as string);
        return (node.getSessionNode() as IZoweDatasetTreeNode).encodingMap[dsKey];
    }
}

export async function promptForEncoding(node: IZoweDatasetTreeNode | IZoweUSSTreeNode, taggedEncoding?: string): Promise<ZosEncoding | undefined> {
    const ebcdicItem: vscode.QuickPickItem = {
        label: localize("zowe.shared.utils.promptForEncoding.ebcdic.label", "EBCDIC"),
        description: localize("zowe.shared.utils.promptForEncoding.ebcdic.description", "z/OS default codepage"),
    };
    const binaryItem: vscode.QuickPickItem = {
        label: localize("zowe.shared.utils.promptForEncoding.binary.label", "Binary"),
        description: localize("zowe.shared.utils.promptForEncoding.binary.description", "Raw data representation"),
    };
    const otherItem: vscode.QuickPickItem = {
        label: localize("zowe.shared.utils.promptForEncoding.other.label", "Other"),
        description: localize("zowe.shared.utils.promptForEncoding.other.description", "Specify another codepage"),
    };
    const items: vscode.QuickPickItem[] = [ebcdicItem, binaryItem, otherItem, globals.SEPARATORS.RECENT];
    const profile = node.getProfile();
    if (profile.profile?.encoding != null) {
        items.splice(0, 0, {
            label: profile.profile?.encoding,
            description: localize("zowe.shared.utils.promptForEncoding.profile.description", "From profile {0}", profile.name),
        });
    }
    if (taggedEncoding != null) {
        items.splice(0, 0, {
            label: taggedEncoding,
            description: localize("zowe.shared.utils.promptForEncoding.tagged.description", "USS file tag"),
        });
    }

    let currentEncoding = node.encoding ?? getCachedEncoding(node);
    if (node.binary || (typeof currentEncoding !== "string" && currentEncoding?.kind === "binary")) {
        currentEncoding = binaryItem.label;
    } else if (node.encoding === null || (typeof currentEncoding !== "string" && currentEncoding?.kind === "text")) {
        currentEncoding = ebcdicItem.label;
    } else if (typeof currentEncoding !== "string" && currentEncoding?.kind === "other") {
        currentEncoding = currentEncoding.codepage;
    }
    const encodingHistory = ZoweLocalStorage.getValue<string[]>("encodingHistory") ?? [];
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
            title: localize("zowe.shared.utils.promptForEncoding.qp.title", "Choose encoding for {0}", node.label as string),
            placeHolder:
                currentEncoding && localize("zowe.shared.utils.promptForEncoding.qp.placeHolder", "Current encoding is {0}", currentEncoding),
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
                title: localize("zowe.shared.utils.promptForEncoding.qp.title", "Choose encoding for {0}", node.label as string),
                placeHolder: localize("zowe.shared.utils.promptForEncoding.input.placeHolder", "Enter a codepage (e.g., 1047, IBM-1047)"),
            });
            if (response != null) {
                encoding = { kind: "other", codepage: response };
                encodingHistory.push(encoding.codepage);
                ZoweLocalStorage.setValue("encodingHistory", encodingHistory.slice(0, globals.MAX_FILE_HISTORY));
            }
            break;
    }
    return encoding;
}
