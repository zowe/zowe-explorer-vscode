import { CancellationToken, WebviewView, WebviewViewProvider, WebviewViewResolveContext } from "vscode";
import { Table } from "./TableView";

export class TableViewProvider implements WebviewViewProvider {
    private view: WebviewView;
    private tableView: Table.View;

    public setTableView(tableView: Table.View): void {
        this.tableView = tableView;
        if (this.view && this.view.webview.html !== this.tableView.getHtml()) {
            this.view.webview.html = this.tableView.getHtml();
        }
    }

    public getTableView(): Table.View {
        return this.tableView;
    }

    public resolveWebviewView(
        webviewView: WebviewView,
        context: WebviewViewResolveContext<unknown>,
        token: CancellationToken
    ): void | Thenable<void> {
        this.view = webviewView;

        this.view.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.tableView.getUris().disk.build],
        };

        this.view.webview.html = this.tableView.getHtml();
        this.view.webview.onDidReceiveMessage((data) => this.tableView.onMessageReceived(data));
    }
}
