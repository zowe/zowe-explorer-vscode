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

import { CancellationToken, WebviewView, WebviewViewProvider, WebviewViewResolveContext } from "vscode";
import { Table } from "./TableView";

export class TableViewProvider implements WebviewViewProvider {
    private view?: WebviewView;
    private tableView: Table.Instance = null;

    private static instance: TableViewProvider;

    private constructor() {}

    public static getInstance(): TableViewProvider {
        if (!this.instance) {
            this.instance = new TableViewProvider();
        }

        return this.instance;
    }

    public setTableView(tableView: Table.Instance | null): void {
        if (this.tableView != null) {
            this.tableView.dispose();
        }
        this.tableView = tableView;

        if (tableView == null) {
            if (this.view != null) {
                this.view.webview.html = "";
            }
            return;
        }

        if (this.view) {
            this.tableView.resolveForView(this.view);
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

        if (this.tableView != null) {
            this.tableView.resolveForView(this.view);
        }
    }
}
