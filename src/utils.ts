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

import * as vscode from "vscode";
import * as globals from "./globals";
import * as os from "os";
import * as path from "path";
import { Profiles } from "./Profiles";
import { ImperativeConfig, IProfileLoaded } from "@zowe/imperative";

import * as nls from "vscode-nls";
import { IZoweDatasetTreeNode, IZoweUSSTreeNode, IZoweJobTreeNode, IZoweNodeType } from "./api/IZoweTreeNode";
import { ZoweExplorerApiRegister } from "./api/ZoweExplorerApiRegister";
import { IUploadOptions } from "@zowe/cli";

const localize = nls.config({messageFormat: nls.MessageFormat.file})();

/*************************************************************************************************************
 * Error Handling
 * @param {errorDetails} error.mDetails
 * @param {label} - additional information such as profile name, credentials, messageID etc
 * @param {moreInfo} - additional/customized error messages
 *************************************************************************************************************/
export function errorHandling(errorDetails: any, label?: string, moreInfo?: string) {
    let httpErrCode = null;
    const errMsg = localize("errorHandling.invalid.credentials", "Invalid Credentials. Please ensure the username and password for ") +
        `\n${label}\n` + localize("errorHandling.invalid.credentials2"," are valid or this may lead to a lock-out.");

    if (errorDetails.mDetails !== undefined) {
        httpErrCode = errorDetails.mDetails.errorCode;
    }

    switch(httpErrCode) {
        // tslint:disable-next-line: no-magic-numbers
        case 401:
            if (label.includes("[")) {
                label = label.substring(0, label.indexOf(" ["));
            }

            if (globals.ISTHEIA) {
                vscode.window.showErrorMessage(errMsg);
                Profiles.getInstance().promptCredentials(label.trim());
            } else {
                vscode.window.showErrorMessage(errMsg, "Check Credentials").then((selection) => {
                    if (selection) {
                        Profiles.getInstance().promptCredentials(label.trim(), true);
                    }
                });
            }
            break;
        default:
            vscode.window.showErrorMessage(moreInfo + " " +  errorDetails);
            break;
    }
    return;
}

export async function resolveQuickPickHelper(quickpick: vscode.QuickPick<vscode.QuickPickItem>): Promise<vscode.QuickPickItem | undefined> {
    return new Promise<vscode.QuickPickItem | undefined>(
        (c) => quickpick.onDidAccept(() => c(quickpick.activeItems[0])));
}

// tslint:disable-next-line: max-classes-per-file
export class FilterItem implements vscode.QuickPickItem {
    constructor(private text: string, private desc?: string) { }
    get label(): string { return this.text; }
    get description(): string { if (this.desc) { return this.desc; } else { return ""; } }
    get alwaysShow(): boolean { return false; }
}

// tslint:disable-next-line: max-classes-per-file
export class FilterDescriptor implements vscode.QuickPickItem {
    constructor(private text: string) { }
    get label(): string { return this.text; }
    get description(): string { return ""; }
    get alwaysShow(): boolean { return true; }
}

/**
 * Function to retrieve the home directory. In the situation Imperative has
 * not initialized it we mock a default value.
 */
export function getZoweDir(): string {
    ImperativeConfig.instance.loadedConfig = {
        defaultHome: path.join(os.homedir(), ".zowe"),
        envVariablePrefix: "ZOWE"
    };
    return ImperativeConfig.instance.cliHome;
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


/**
 * Function that will forcefully upload a file and won't check for matching Etag
 */
export async function willForceUpload(node: IZoweDatasetTreeNode | IZoweUSSTreeNode,
                                      doc: vscode.TextDocument,
                                      remotePath: string,
                                      profile?: IProfileLoaded,
                                      binary?: boolean,
                                      returnEtag?: boolean): Promise<void> {
        // Upload without passing the etag to force upload
        const uploadOptions: IUploadOptions = {
            returnEtag: true
        };

        // setup to handle both cases (dataset & USS)
        let title: string;
        if (isZoweDatasetTreeNode(node)) {
            title = localize("saveFile.response.save.title", "Saving data set...");
        } else {
            title = localize("saveUSSFile.response.title", "Saving file...");
        }

        vscode.window.showWarningMessage(localize("saveFile.error.theiaDetected", "A merge conflict has been detected. Since you are running inside Theia editor, a merge conflict resolution is not available yet."));
        vscode.window.showInformationMessage(localize("saveFile.info.confirmUpload","Would you like to overwrite the remote file?"),
        localize("saveFile.overwriteConfirmation.yes", "Yes"),
        localize("saveFile.overwriteConfirmation.no", "No"))
        .then(async (selection) => {
            if (selection === localize("saveFile.overwriteConfirmation.yes", "Yes")) {
                const uploadResponse = vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title
                }, () => {
                    if (isZoweDatasetTreeNode(node)) {
                        return ZoweExplorerApiRegister.getMvsApi(node ? node.getProfile(): profile).putContents(doc.fileName,
                            remotePath,
                            uploadOptions);
                        } else {
                            return ZoweExplorerApiRegister.getUssApi(profile).putContents(
                                doc.fileName, remotePath, binary, null, null, returnEtag);
                            }
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
function isZoweDatasetTreeNode(node: IZoweNodeType): node is IZoweDatasetTreeNode {
    return (node as IZoweDatasetTreeNode).pattern !== undefined;
}

function isZoweUSSTreeNode(node: IZoweDatasetTreeNode | IZoweUSSTreeNode | IZoweJobTreeNode): node is IZoweUSSTreeNode {
    return (node as IZoweUSSTreeNode).shortLabel !== undefined;
}

function isZoweJobTreeNode(node: IZoweDatasetTreeNode | IZoweUSSTreeNode | IZoweJobTreeNode): node is IZoweJobTreeNode {
    return (node as IZoweJobTreeNode).job !== undefined;
}
