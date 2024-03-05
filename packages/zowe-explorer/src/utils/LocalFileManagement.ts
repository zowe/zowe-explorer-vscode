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
import { getDocumentFilePath, isZoweDatasetTreeNode, updateOpenFiles } from "../shared/utils";
import { IZoweDatasetTreeOpts, IZoweUssTreeOpts } from "../shared/IZoweTreeOpts";
import { TreeProviders } from "../shared/TreeProviders";

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

    public static addRecoveredFile(document: vscode.TextDocument, treeOpts: IZoweDatasetTreeOpts | IZoweUssTreeOpts): void {
        const firstLine = document.lineAt(0);
        const lastLine = document.lineAt(document.lineCount - 1);
        const textRange = new vscode.Range(firstLine.range.start, lastLine.range.end);
        const fullPath = "parentPath" in treeOpts ? `${treeOpts.parentPath}/${treeOpts.label}` : treeOpts.label;
        this.recoveryDiagnostics.set(document.uri, [
            new vscode.Diagnostic(
                textRange,
                localize("addRecoveredFile.diagnosticMessage", "File is out of sync with {0}: {1}", treeOpts.profile.name, fullPath),
                vscode.DiagnosticSeverity.Error
            ),
        ]);
        this.recoveredFileCount++;
    }

    public static removeRecoveredFile(document: vscode.TextDocument): void {
        this.recoveryDiagnostics.delete(document.uri);
        this.recoveredFileCount--;
    }

    public static loadFileInfo(node: IZoweDatasetTreeNode | IZoweUSSTreeNode, filename: string): void {
        const fileInfo = ZoweLocalStorage.getValue<Record<string, IFileInfo>>("zowe.fileInfoCache") ?? {};
        if (fileInfo[filename] != null) {
            for (const [k, v] of Object.entries(fileInfo[filename])) {
                node[k] = v;
            }
            updateOpenFiles(isZoweDatasetTreeNode(node) ? TreeProviders.ds : TreeProviders.uss, filename, node);
        }
    }

    public static storeFileInfo(node: IZoweDatasetTreeNode | IZoweUSSTreeNode, filename?: string): void {
        const fileInfo = ZoweLocalStorage.getValue<Record<string, IFileInfo>>("zowe.fileInfoCache") ?? {};
        if (filename == null) {
            filename = isZoweDatasetTreeNode(node) ? getDocumentFilePath(node.label as string, node) : node.getUSSDocumentFilePath();
        }
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
}
