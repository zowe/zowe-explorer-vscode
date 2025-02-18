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

import { CancellationToken, commands, WebviewView, WebviewViewProvider, WebviewViewResolveContext } from "vscode";
import { Table } from "./TableView";

/**
 * View provider class for rendering table views in the "Zowe Resources" panel.
 * Registered during initialization of Zowe Explorer.
 *
 * @remarks
 * ## Usage
 *
 * ### Setting the current table view
 *
 * Use the {@link setTableView} function to set a table view for the "Zowe Resources" panel.
 * _Note_ that setting another table view on the view provider will dispose of the last table instance that was provided.
 *
 * ### Getting the current table view
 *
 * Use the {@link getTableView} function to get the current table view in the "Zowe Resources" panel.
 *
 * ### resolveWebviewView
 *
 * VS Code uses this function to resolve the instance of the table view to render. **Please do not use this function directly** -
 * use {@link setTableView} instead to provide the table view.
 *
 * Calling the function directly will interfere with the intended behavior of
 * the "Zowe Resources" panel and is therefore not supported.
 */
export class TableViewProvider implements WebviewViewProvider {
    protected view?: WebviewView;
    protected tableView: Table.Instance = null;

    protected static instance: TableViewProvider;

    /**
     * Retrieve the singleton instance of the TableViewProvider.
     * @returns the TableViewProvider instance used by Zowe Explorer
     */
    public static getInstance(): TableViewProvider {
        if (!this.instance) {
            this.instance = new TableViewProvider();
        }

        return this.instance;
    }

    /**
     * Provide a table view to display in the "Zowe Resources" view.
     * @param tableView The table view to prepare for rendering
     */
    public async setTableView(tableView: Table.Instance | null): Promise<void> {
        if (this.tableView != null) {
            this.tableView.dispose();
        }
        this.tableView = tableView;

        if (tableView == null) {
            if (this.view != null) {
                this.view.webview.html = "";
            }
            await commands.executeCommand("setContext", "zowe.vscode-extension-for-zowe.showZoweResources", false);
            return;
        }

        await commands.executeCommand("setContext", "zowe.vscode-extension-for-zowe.showZoweResources", true);

        if (this.view) {
            this.tableView.resolveForView(this.view);
        } else {
            await commands.executeCommand("workbench.view.extension.zowe-panel");
        }
    }

    /**
     * Retrieve the current table view for the "Zowe Resources" panel, if one exists.
     */
    public getTableView(): Table.View {
        return this.tableView;
    }

    /**
     * VS Code internal function used to resolve the webview view from the view provider.
     * @param webviewView The webview view object for the panel
     * @param context Additional context for the webview view
     * @param token (unused) cancellation token for the webview view resolution process
     */
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
