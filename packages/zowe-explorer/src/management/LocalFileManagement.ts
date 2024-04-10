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
import * as os from "os";
import { IZoweDatasetTreeNode, IZoweTreeNode, IZoweUSSTreeNode, imperative } from "@zowe/zowe-explorer-api";
import { Workspace, Constants } from "../configuration";
import { SharedContext, SharedUtils } from "../trees/shared";
import { ZoweExplorerApiRegister } from "../extending";
import { ZoweLogger } from "../tools";
import { ZoweDatasetNode } from "../trees/dataset";
import { ZoweUSSNode } from "../trees/uss/ZoweUSSNode";

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
        await Workspace.markDocumentUnsaved(doc);
        const prof = node ? node.getProfile() : profile;
        let downloadResponse;

        if (SharedContext.isTypeUssTreeNode(node)) {
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
        if (Constants.filesToCompare.length > 0) {
            Constants.resetCompareChoices();
        }
        Constants.filesToCompare.push(node);
        Constants.setCompareSelection(true);
        ZoweLogger.trace(`${String(Constants.filesToCompare[0].label)} selected for compare.`);
    }

    /**
     * Function that triggers compare of the 2 files selected for compare in the active editor
     * @returns {Promise<void>}
     */
    public static async compareChosenFileContent(node: IZoweTreeNode, readOnly = false): Promise<void> {
        Constants.filesToCompare.push(node);
        const docUriArray: vscode.Uri[] = [];
        for (const file of Constants.filesToCompare) {
            const fileInfo = await this.getCompareFilePaths(file);
            if (fileInfo.path) {
                docUriArray.push(vscode.Uri.file(fileInfo.path));
            } else {
                return;
            }
        }
        Constants.resetCompareChoices();
        if (docUriArray.length === 2) {
            vscode.commands.executeCommand("vscode.diff", docUriArray[0], docUriArray[1]);
            if (readOnly) {
                this.readOnlyFile();
            }
        }
    }

    private static async getCompareFilePaths(node: IZoweTreeNode): Promise<SharedUtils.LocalFileInfo> {
        ZoweLogger.info(
            `Getting files ${String(Constants.filesToCompare[0].label)} and ${String(Constants.filesToCompare[1].label)} for comparison.`
        );
        let fileInfo = {} as SharedUtils.LocalFileInfo;
        switch (true) {
            case SharedUtils.isZoweDatasetTreeNode(node): {
                fileInfo = await (node as ZoweDatasetNode).downloadDs(true);
                break;
            }
            case SharedUtils.isZoweUSSTreeNode(node): {
                fileInfo = await (node as ZoweUSSNode).downloadUSS(true);
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
