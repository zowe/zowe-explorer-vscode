// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { ZosUssProfile } from "@zowe/cli";
import { ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";
import { SshUssApi } from "./SshUssApi";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
    const zoweExplorerApi = ZoweVsCodeExtension.getZoweExplorerApi();
    if (zoweExplorerApi != null) {
        zoweExplorerApi.registerUssApi(new SshUssApi());
        await zoweExplorerApi.getExplorerExtenderApi().initForZowe("ssh", [ZosUssProfile]);
        await zoweExplorerApi.getExplorerExtenderApi().reloadProfiles("ssh");
    } else {
        vscode.window.showErrorMessage("Could not access Zowe Explorer API. Please check that the latest version of Zowe Explorer is installed.");
    }
}
