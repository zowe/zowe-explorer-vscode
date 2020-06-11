import * as vscode from "vscode";
import { getContentForWebView, unifyContentOfHTML } from "../../utils/webView";
import * as path from "path";
import * as globals from "../../globals";

class WelcomeWebView {
    private panel: vscode.WebviewPanel;
    private content: { html: string; js: string; css: string; };

    public async initialize(title: string) {
        if (!this.content) {
            this.content = await getContentForWebView(path.resolve(globals.EXT_PATH, "webviews", "welcome"));
        }

        this.initView(title);
        this.initHTMLContent();
    }

    private initView(title: string) {
        if (this.panel) {
            this.panel.dispose();
        }

        this.panel = vscode.window.createWebviewPanel(
            "welcomeWebView",
            title,
            vscode.ViewColumn.One,
            {
                enableScripts: true
            }
        );
    }

    private initHTMLContent() {
        this.panel.webview.html = unifyContentOfHTML(this.content);
    }
}

let instance = null as WelcomeWebView;

export async function generateInstance(title: string) {
    if (!instance) {
        instance = new WelcomeWebView();
    }

    if (instance) {
        await instance.initialize(title);
    }

    return instance;
}

export function getInstance() {
    if (instance) {
        return instance;
    } else {
        throw new Error("Please, first initialize an instance with corresponding function.");
    }
}
