import * as vscode from "vscode";
import { WebView } from "@zowe/zowe-explorer-api";

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "helloworld-sample" is now active!');

    const disposable = vscode.commands.registerCommand("extension.helloWorld", () => {
        const webview = new WebView("Sample Webview", "vue-sample", context, (message: Record<string, any>) => {
            vscode.window.showInformationMessage(message.text);
        });
    });

    context.subscriptions.push(disposable);
}
