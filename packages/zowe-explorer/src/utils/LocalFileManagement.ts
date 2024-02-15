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
import { IZoweTreeNode } from "@zowe/zowe-explorer-api";
import { ZoweLogger } from "./LoggerUtils";

export class LocalFileManagement {
    public static filesToCompare: IZoweTreeNode[] = [];
    public static fileSelectedToCompare: boolean = false;

    public static getDefaultUri(): vscode.Uri {
        return vscode.workspace.workspaceFolders?.[0]?.uri ?? vscode.Uri.file(os.homedir());
    }

    public static setCompareSelection(val: boolean): void {
        LocalFileManagement.fileSelectedToCompare = val;
        vscode.commands.executeCommand("setContext", "zowe.compareFileStarted", val);
    }

    public static reset() {
        LocalFileManagement.filesToCompare = [];
        LocalFileManagement.setCompareSelection(false);
    }

    public static selectFileForCompare(node: IZoweTreeNode): void {
        if (LocalFileManagement.filesToCompare.length > 0) {
            LocalFileManagement.reset();
        }
        LocalFileManagement.filesToCompare.push(node);
        LocalFileManagement.setCompareSelection(true);
        ZoweLogger.trace(`${String(LocalFileManagement.filesToCompare[0].label)} selected for compare.`);
    }

    /**
     * Function that triggers compare of the 2 files selected for compare in the active editor
     * @returns {Promise<void>}
     */
    public static async compareChosenFileContent(node: IZoweTreeNode, readOnly = false): Promise<void> {
        LocalFileManagement.filesToCompare.push(node);
        const docUriArray: vscode.Uri[] = LocalFileManagement.filesToCompare.map((n) => n.resourceUri);
        LocalFileManagement.reset();
        if (docUriArray.length === 2) {
            await vscode.commands.executeCommand("vscode.diff", docUriArray[0], docUriArray[1]);
            if (readOnly) {
                this.readOnlyFile();
            }
        }
    }

    private static readOnlyFile(): void {
        vscode.commands.executeCommand("workbench.action.files.setActiveEditorReadonlyInSession");
    }
}
