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

import { IZoweDatasetTreeNode, IZoweUSSTreeNode } from "@zowe/zowe-explorer-api";
import * as vscode from "vscode";
import * as nls from "vscode-nls";
import { ZoweLocalStorage } from "./ZoweLocalStorage";
import { getDocumentFilePath, updateOpenFiles } from "../shared/utils";
import { ZoweDatasetNode } from "../dataset/ZoweDatasetNode";
import { Profiles } from "../Profiles";
import { TreeProviders } from "../shared/TreeProviders";
import { ZoweUSSNode } from "../uss/ZoweUSSNode";

// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

interface IFileInfo {
    binary?: boolean;
    encoding?: string;
    etag?: string;
}

export class LocalFileManagement {
    public static recoveredFileCount: number = 0;
    private static recoveryDiagnostics: vscode.DiagnosticCollection = vscode.languages.createDiagnosticCollection("zowe-explorer");

    public static addRecoveredDs(document: vscode.TextDocument, fileInfo: { profile: string; label: string }): void {
        LocalFileManagement.addRecoveredFile(document, fileInfo);
        const cachedFileInfo = LocalFileManagement.getFileInfo(document.uri.fsPath);
        if (cachedFileInfo == null) {
            return;
        }
        const dsNode = new ZoweDatasetNode({
            label: fileInfo.label,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            profile: Profiles.getInstance().loadNamedProfile(fileInfo.profile),
        });
        for (const [k, v] of Object.entries(cachedFileInfo)) {
            dsNode[k] = v;
        }
        updateOpenFiles(TreeProviders.ds, document.uri.fsPath, dsNode);
    }

    public static addRecoveredUss(document: vscode.TextDocument, fileInfo: { profile: string; label: string }): void {
        LocalFileManagement.addRecoveredFile(document, fileInfo);
        const cachedFileInfo = LocalFileManagement.getFileInfo(document.uri.fsPath);
        if (cachedFileInfo == null) {
            return;
        }
        const ussNode = new ZoweUSSNode({
            label: fileInfo.label,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            profile: Profiles.getInstance().loadNamedProfile(fileInfo.profile),
        });
        for (const [k, v] of Object.entries(cachedFileInfo)) {
            ussNode[k] = v;
        }
        updateOpenFiles(TreeProviders.uss, document.uri.fsPath, ussNode);
    }

    public static removeRecoveredFile(document: vscode.TextDocument): void {
        this.recoveryDiagnostics.delete(document.uri);
        this.recoveredFileCount--;
    }

    public static updateFileInfo(node: IZoweDatasetTreeNode | IZoweUSSTreeNode, filename?: string): void {
        const fileInfo = ZoweLocalStorage.getValue<Record<string, IFileInfo>>("zowe.fileInfoCache") ?? {};
        filename = filename ?? getDocumentFilePath(node.label as string, node);
        fileInfo[filename] = {
            binary: node.binary,
            encoding: node.encoding,
            etag: node.getEtag(),
        };
        ZoweLocalStorage.setValue("zowe.fileInfoCache", fileInfo);
    }

    public static deleteFileInfo(filename: string): void {
        const fileInfo = ZoweLocalStorage.getValue<Record<string, IFileInfo>>("zowe.fileInfoCache") ?? {};
        delete fileInfo[filename];
        ZoweLocalStorage.setValue("zowe.fileInfoCache", fileInfo);
    }

    private static addRecoveredFile(document: vscode.TextDocument, fileInfo: { profile: string; label: string }): void {
        const firstLine = document.lineAt(0);
        const lastLine = document.lineAt(document.lineCount - 1);
        const textRange = new vscode.Range(firstLine.range.start, lastLine.range.end);
        this.recoveryDiagnostics.set(document.uri, [
            new vscode.Diagnostic(
                textRange,
                localize("addRecoveredFile.diagnosticMessage", "File is out of sync with {0}: {1}", fileInfo.profile, fileInfo.label),
                vscode.DiagnosticSeverity.Error
            ),
        ]);
        this.recoveredFileCount++;
    }

    private static getFileInfo(filename: string): IFileInfo | undefined {
        const fileInfo = ZoweLocalStorage.getValue<Record<string, IFileInfo>>("zowe.fileInfoCache") ?? {};
        return fileInfo[filename];
    }
}
