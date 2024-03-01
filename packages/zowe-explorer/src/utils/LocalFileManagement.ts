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
import * as nls from "vscode-nls";

// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

export class LocalFileManagement {
    private static recoveredFiles: vscode.TextDocument[] = [];
    private static recoveryDiagnostics: vscode.DiagnosticCollection = vscode.languages.createDiagnosticCollection("zowe-explorer");

    public static addRecoveredFile(document: vscode.TextDocument, fileInfo: { profile: string; filename: string }): void {
        this.recoveredFiles.push(document);
        const firstLine = document.lineAt(0);
        const lastLine = document.lineAt(document.lineCount - 1);
        const textRange = new vscode.Range(firstLine.range.start, lastLine.range.end);
        this.recoveryDiagnostics.set(document.uri, [
            new vscode.Diagnostic(
                textRange,
                localize("addRecoveredFile.diagnosticMessage", "File is out of sync with {0}: {1}", fileInfo.profile, fileInfo.filename),
                vscode.DiagnosticSeverity.Error
            ),
        ]);
    }

    public static findRecoveredFile(filePath: string): vscode.TextDocument | undefined {
        return this.recoveredFiles.find((document) => document.fileName == filePath);
    }

    public static removeRecoveredFile(document: vscode.TextDocument): void {
        this.recoveredFiles = this.recoveredFiles.filter((doc) => doc != document);
        this.recoveryDiagnostics.delete(document.uri);
    }
}
