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
import * as globals from "../globals";
import * as os from "os";
import { IZoweDatasetTreeNode, IZoweTreeNode, IZoweUSSTreeNode, imperative } from "@zowe/zowe-explorer-api";
import { markDocumentUnsaved } from "./workspace";
import { isTypeUssTreeNode } from "../shared/context";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { ZoweLogger } from "./LoggerUtils";
import { LocalFileInfo, isZoweDatasetTreeNode, isZoweUSSTreeNode } from "../shared/utils";
import { downloadPs } from "../dataset/actions";
import { downloadUnixFile } from "../uss/actions";

export class LocalFileManagement {
    public static getDefaultUri(): vscode.Uri {
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
    public static async compareSavedFileContent(
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
                encoding: node.encoding !== undefined ? node.encoding : prof.profile?.encoding,
                responseTimeout: prof.profile?.responseTimeout,
            });
        } else {
            downloadResponse = await ZoweExplorerApiRegister.getMvsApi(prof).getContents(label, {
                file: doc.fileName,
                binary: node.binary,
                returnEtag: true,
                encoding: node.encoding !== undefined ? node.encoding : prof.profile?.encoding,
                responseTimeout: prof.profile?.responseTimeout,
            });
        }
        ZoweLogger.warn(vscode.l10n.t("Remote file has changed. Presenting with way to resolve file."));
        vscode.commands.executeCommand("workbench.files.action.compareWithSaved");
        // re-assign etag, so that it can be used with subsequent requests
        const downloadEtag = downloadResponse?.apiResponse?.etag;
        if (node && downloadEtag !== node.getEtag()) {
            node.setEtag(downloadEtag);
        }
    }

    public static selectFileForCompare(node: IZoweTreeNode): void {
        if (globals.filesToCompare.length > 0) {
            globals.resetCompareChoices();
        }
        globals.filesToCompare.push(node);
        globals.setCompareSelection(true);
        ZoweLogger.trace(`${String(globals.filesToCompare[0].label)} selected for compare.`);
    }

    /**
     * Function that triggers compare of the 2 files selected for compare in the active editor
     * @returns {Promise<void>}
     */
    public static async compareChosenFileContent(node: IZoweTreeNode, readOnly = false): Promise<void> {
        globals.filesToCompare.push(node);
        const docUriArray: vscode.Uri[] = [];
        for (const file of globals.filesToCompare) {
            const fileInfo = await this.getCompareFilePaths(file);
            if (fileInfo.path) {
                docUriArray.push(vscode.Uri.file(fileInfo.path));
            } else {
                return;
            }
        }
        globals.resetCompareChoices();
        if (docUriArray.length === 2) {
            vscode.commands.executeCommand("vscode.diff", docUriArray[0], docUriArray[1]);
            if (readOnly) {
                this.readOnlyFile();
            }
        }
    }

    private static async getCompareFilePaths(node: IZoweTreeNode): Promise<LocalFileInfo> {
        ZoweLogger.info(`Getting files ${String(globals.filesToCompare[0].label)} and ${String(globals.filesToCompare[1].label)} for comparison.`);
        let fileInfo = {} as LocalFileInfo;
        switch (true) {
            case isZoweDatasetTreeNode(node): {
                fileInfo = await downloadPs(node);
                break;
            }
            case isZoweUSSTreeNode(node): {
                fileInfo = await downloadUnixFile(node, true);
                break;
            }
            default: {
                ZoweLogger.warn(vscode.l10n.t("Something went wrong with compare of files."));
            }
        }
        return fileInfo;
    }

    private static readOnlyFile(): void {
        vscode.commands.executeCommand("workbench.action.files.setActiveEditorReadonlyInSession");
    }
}
