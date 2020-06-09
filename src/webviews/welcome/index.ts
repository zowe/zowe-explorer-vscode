import * as vscode from "vscode";
import { getContentForWebView, unifyContentOfHTML } from "../../utils/webView";
import * as path from "path";
import * as globals from "../../globals";

class WelcomeWebView {
    private panel: vscode.WebviewPanel;
    private readonly content: { html: string; js: string; css: string; };

    constructor() {
        this.content = getContentForWebView(path.resolve(globals.EXT_PATH, "webviews", "welcome"));
    }

    public initialize(title: string) {
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
        console.log(this.panel.webview.html)
    }
}

let instance = null as WelcomeWebView;

export function generateInstance(title: string) {
    if (!instance) {
        instance = new WelcomeWebView();
    }

    if (instance) {
        instance.initialize(title);
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
