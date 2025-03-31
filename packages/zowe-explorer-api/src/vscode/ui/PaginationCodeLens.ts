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

import * as vscode from 'vscode';

export class LoadMoreCodeLens implements vscode.CodeLensProvider {
    public constructor(private commandId: string) {}
    public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {
        const lineCount = document.lineCount;
        const lastLine = lineCount - 1;
        const lastLineRange = new vscode.Range(lastLine, 0, lastLine, 0);

        const codelens = new vscode.CodeLens(lastLineRange, {
            title: vscode.l10n.t("$(chevron-down) Load more..."),
            command: this.commandId,
            arguments: [document],
        });

        return [codelens];
    }
}
