// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { ProfilesTreeProvider } from "./ProfilesTreeProvider";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    const treeDataProvider = new ProfilesTreeProvider();
    vscode.window.createTreeView("tree-view-sample.profiles", { treeDataProvider, showCollapseAll: true });

    const disposable = vscode.commands.registerCommand("tree-view-sample.refresh", () => {
        treeDataProvider.refresh();
    });
    context.subscriptions.push(disposable);
}
