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

// Generic utility functions related to all node types. See ./src/utils.ts for other utility functions.

import * as vscode from "vscode";
import * as path from "path";
import * as globals from "../globals";
import { IZoweTreeNode, IZoweNodeType, IZoweDatasetTreeNode, IZoweUSSTreeNode, IZoweJobTreeNode } from "../api/IZoweTreeNode";
import { Profiles } from "../Profiles";
import { ISession, IProfileLoaded } from "@zowe/imperative";
import * as nls from "vscode-nls";
import { ZoweExplorerApiRegister } from "../api/ZoweExplorerApiRegister";
import { IUploadOptions, IZosFilesResponse } from "@zowe/cli";

// Set up localization
nls.config({ messageFormat: nls.MessageFormat.bundle, bundleFormat: nls.BundleFormat.standalone })();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

export function filterTreeByString(value: string, treeItems: vscode.QuickPickItem[]): vscode.QuickPickItem[] {
    const filteredArray = [];
    value = value.toUpperCase().replace(".", "\.").replace(/\*/g, "(.*)");
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
export function getIconPathInResources(iconFileName: string) {
    return {
        light: path.join(globals.ROOTPATH, "resources", "light", iconFileName),
        dark: path.join(globals.ROOTPATH, "resources", "dark", iconFileName)
    };
}

/*************************************************************************************************************
* Returns array of all subnodes of given node
*************************************************************************************************************/
export function concatChildNodes(nodes: IZoweNodeType[]) {
    let allNodes = new Array<IZoweNodeType>();

    for (const node of nodes) {
        allNodes = allNodes.concat(concatChildNodes(node.children));
        allNodes.push(node);
    }
    return allNodes;
}

/**
 * For no obvious reason a label change is often required to make a node repaint.
 * This function does this by adding or removing a blank.
 * @param {TreeItem} node - the node element
 */
export function labelRefresh( node: vscode.TreeItem ): void {
    node.label = node.label.endsWith(" ") ? node.label.substring(0, node.label.length -1 ) : node.label+ " ";
}

/*************************************************************************************************************
 * Refresh Profile and Session
 * @param {sessNode} IZoweTreeNode
 * @param {profile} IProfileLoaded
 *************************************************************************************************************/
export function refreshTree(sessNode: IZoweTreeNode) {
    const allProf = Profiles.getInstance().getProfiles();
    for (const profNode of allProf) {
        if (sessNode.getProfileName() === profNode.name) {
            sessNode.getProfile().profile = profNode.profile;
            const SessionProfile = profNode.profile as ISession;
            if (sessNode.getSession().ISession !== SessionProfile) {
                sessNode.getSession().ISession.user = SessionProfile.user;
                sessNode.getSession().ISession.password = SessionProfile.password;
                sessNode.getSession().ISession.base64EncodedAuth = SessionProfile.base64EncodedAuth;
                sessNode.getSession().ISession.hostname = SessionProfile.hostname;
                sessNode.getSession().ISession.port = SessionProfile.port;
                sessNode.getSession().ISession.rejectUnauthorized = SessionProfile.rejectUnauthorized;
            }
        }
    }
    sessNode.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
}

export function sortTreeItems(favorites: vscode.TreeItem[], specificContext ) {
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

/*************************************************************************************************************
 * Determine IDE name to display based on app environment
 *************************************************************************************************************/
export function getAppName(isTheia: boolean) {
    return isTheia ? "Theia" : "VS Code";
}

/**
 * Returns the file path for the IZoweTreeNode
 *
 * @export
 * @param {string} label - If node is a member, label includes the name of the PDS
 * @param {IZoweTreeNode} node
 */
export function getDocumentFilePath(label: string, node: IZoweTreeNode) {
    return path.join(globals.DS_DIR, "/" + node.getProfileName() + "/" + appendSuffix(label) );
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
    const split = (bracket > -1) ? label.substr(0, bracket).split(".", limit) : label.split(".", limit);
    for (let i = split.length - 1; i > 0; i--) {
        if (["JCL", "CNTL"].includes(split[i])) {
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
    // tslint:disable-next-line: no-magic-numbers
    return ((dotPos >= 2 && dotPos <= 4) && // if the last characters are 2 to 4 long and lower case it has been added
        ((filename.substring(filename.length - dotPos) === filename.substring(filename.length - dotPos).toLowerCase())));
}

/**
 * Function that rewrites the document in the active editor thus marking it dirty
 * @param {vscode.TextDocument} doc - document to rewrite
 * @returns void
 */

export async function markFileAsDirty(doc: vscode.TextDocument): Promise<void> {
    const docText = doc.getText();
    const startPosition = new vscode.Position(0, 0);
    const endPosition = new vscode.Position(doc.lineCount, 0);
    const deleteRange = new vscode.Range(startPosition, endPosition);
    vscode.window.activeTextEditor.edit((editBuilder) => {
        editBuilder.delete(deleteRange);
        editBuilder.insert(startPosition, docText);
    });
}

export async function uploadContent(node: IZoweDatasetTreeNode | IZoweUSSTreeNode,
                                    doc: vscode.TextDocument,
                                    remotePath: string,
                                    profile?: IProfileLoaded,
                                    binary?: boolean,
                                    etagToUpload?: string,
                                    returnEtag?: boolean): Promise<IZosFilesResponse> {

    if (isZoweDatasetTreeNode(node)) {
        // Upload without passing the etag to force upload
        const uploadOptions: IUploadOptions = {
            returnEtag: true
        };
        const prof = node.getProfile();
        if (prof.profile.encoding) {
            uploadOptions.encoding = prof.profile.encoding;
        }
        return ZoweExplorerApiRegister.getMvsApi(prof).putContents(doc.fileName,
            remotePath,
            uploadOptions);
    } else {

        // if new api method exists, use it
        if (ZoweExplorerApiRegister.getUssApi(profile).putContent) {
            return ZoweExplorerApiRegister.getUssApi(profile).putContent(
                doc.fileName, remotePath,
                {
                    binary,
                    localEncoding: null,
                    etag: etagToUpload,
                    returnEtag,
                    encoding: profile.profile.encoding
                });
        } else {
            return ZoweExplorerApiRegister.getUssApi(profile).putContents(
                doc.fileName, remotePath, binary, null, etagToUpload, returnEtag);
        }
    }
}

/**
 * Function that will forcefully upload a file and won't check for matching Etag
 */
export async function willForceUpload(node: IZoweDatasetTreeNode | IZoweUSSTreeNode,
                                      doc: vscode.TextDocument,
                                      remotePath: string,
                                      profile?: IProfileLoaded,
                                      binary?: boolean,
                                      returnEtag?: boolean): Promise<void> {


    // setup to handle both cases (dataset & USS)
    let title: string;
    if (isZoweDatasetTreeNode(node)) {
        title = localize("saveFile.response.save.title", "Saving data set...");
    } else {
        title = localize("saveUSSFile.response.title", "Saving file...");
    }
    if (globals.ISTHEIA) {
        vscode.window.showWarningMessage(localize("saveFile.error.theiaDetected", "A merge conflict has been detected. Since you are running inside Theia editor, a merge conflict resolution is not available yet."));
    }
    vscode.window.showInformationMessage(localize("saveFile.info.confirmUpload","Would you like to overwrite the remote file?"),
    localize("saveFile.overwriteConfirmation.yes", "Yes"),
    localize("saveFile.overwriteConfirmation.no", "No"))
    .then(async (selection) => {
        if (selection === localize("saveFile.overwriteConfirmation.yes", "Yes")) {
            const uploadResponse = vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title
            }, () => {
                return uploadContent(node, doc, remotePath, profile, binary, null, returnEtag);
            });
            uploadResponse.then((response) => {
                if (response.success) {
                    vscode.window.showInformationMessage(response.commandResponse);
                    if (node) {
                        node.setEtag(response.apiResponse[0].etag);
                    }
                }
            });
        } else {
            vscode.window.showInformationMessage("Upload cancelled.");
            await markFileAsDirty(doc);
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

