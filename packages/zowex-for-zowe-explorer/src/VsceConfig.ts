import * as vscode from "vscode";
export const EXTENSION_NAME = "zowe";
export function getVsceConfig(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(EXTENSION_NAME);
}
