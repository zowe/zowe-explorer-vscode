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

import "disposablestack/auto";

/**
 * Page Object for the Dataset Table View (webview)
 * Implements AsyncDisposable to support automatic cleanup with the 'using' keyword
 */
export class DatasetTableViewPage implements AsyncDisposable {
    private webview: any;
    private workbench: any;

    constructor(private browser: WebdriverIO.Browser) {}

    /**
     * Safely gets the webview with retry logic to avoid stale elements
     */
    private async getWebviewSafely(): Promise<any> {
        await this.browser.switchToFrame(null);
        this.workbench = await this.browser.getWorkbench();

        // Wait for webview to be available
        await this.browser.waitUntil(
            async () => {
                try {
                    const webviews = await this.workbench.getAllWebviews();
                    return webviews.length > 0;
                } catch {
                    return false;
                }
            },
            { timeout: 15000, timeoutMsg: "No webviews found within timeout" }
        );

        let tableView = (await this.workbench.getAllWebviews())[0];
        await tableView.wait();

        // Re-fetch to avoid stale element
        return (await this.workbench.getAllWebviews())[0];
    }

    /**
     * Opens the webview and waits for it to be ready
     */
    public async open(): Promise<void> {
        this.webview = await this.getWebviewSafely();
        await this.webview.open();
    }

    /**
     * Closes the webview
     */
    public async close(): Promise<void> {
        if (this.webview) {
            try {
                await this.webview.close();
            } catch (error) {
                // Ignore errors during cleanup
            }
        }
    }

    /**
     * AsyncDisposable implementation - automatically closes the webview
     */
    async [Symbol.asyncDispose](): Promise<void> {
        await this.close();
    }

    /**
     * Waits for the table to be ready with data
     */
    public async waitForReady(): Promise<void> {
        await this.browser.waitUntil(
            async () => {
                try {
                    const tableViewDiv = await this.browser.$(".table-view");
                    if (!(await tableViewDiv.isExisting())) return false;
                    const rows = await this.browser.$$(".ag-row[row-index]");
                    return rows.length > 0;
                } catch {
                    return false;
                }
            },
            { timeout: 15000, timeoutMsg: "Table did not become ready within timeout" }
        );
    }

    /**
     * Gets a webview button by title with retry logic
     */
    public async getButton(title: string, appearance: string = "primary", timeout: number = 5000): Promise<WebdriverIO.Element | null> {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            try {
                const buttons = await this.browser.$$(`vscode-button[appearance='${appearance}']`);
                for (const button of buttons) {
                    const buttonText = await button.getText();
                    if (buttonText === title) {
                        return button;
                    }
                }
            } catch {
                // Element became stale, retry
            }
            await this.browser.pause(100); // Small pause between retries
        }
        return null;
    }

    /**
     * Gets the table title text
     */
    public async getTitle(): Promise<string> {
        const titleElement = await this.browser.$(".table-view > div > h3");
        return await titleElement.getText();
    }

    /**
     * Waits for the title to appear and be populated
     */
    public async waitForTitle(expectedPattern?: RegExp): Promise<string> {
        let finalTitle = "";
        await this.browser.waitUntil(
            async () => {
                try {
                    const titleElement = await this.browser.$(".table-view > div > h3");
                    if (!(await titleElement.isExisting())) {
                        return false;
                    }
                    const titleText = await titleElement.getText();
                    if (!titleText || typeof titleText !== "string" || titleText.trim().length === 0) {
                        return false;
                    }
                    finalTitle = titleText;
                    return true;
                } catch {
                    return false;
                }
            },
            {
                timeout: 20000,
                timeoutMsg: "Table view title did not appear within timeout",
            }
        );
        return finalTitle;
    }

    /**
     * Gets all data rows in the table
     */
    public async getRows(): Promise<WebdriverIO.ElementArray> {
        return await this.browser.$$(".ag-row[row-index]");
    }

    /**
     * Verifies a column header exists
     */
    public async verifyColumnExists(columnId: string): Promise<void> {
        const columnHeader = await this.browser.$(`[col-id="${columnId}"]`);
        await columnHeader.waitForExist();
    }

    /**
     * Checks if the table view div exists
     */
    public async tableViewExists(): Promise<boolean> {
        const tableViewDiv = await this.browser.$(".table-view");
        return await tableViewDiv.isExisting();
    }

    /**
     * Waits for the table view to exist
     */
    public async waitForTableView(): Promise<void> {
        await this.browser.waitUntil(
            async () => {
                try {
                    const tableViewDiv = await this.browser.$(".table-view");
                    return await tableViewDiv.isExisting();
                } catch {
                    return false;
                }
            },
            { timeout: 15000, timeoutMsg: "Table view div did not appear within timeout" }
        );
    }

    /**
     * Selects a row by clicking its checkbox
     */
    public async selectRow(rowIndex: number): Promise<void> {
        const rows = await this.browser.$$(".ag-row[row-index]");
        const checkbox = await rows[rowIndex].$(".ag-selection-checkbox");
        await checkbox.click();
    }

    /**
     * Gets pinned rows
     */
    public async getPinnedRows(): Promise<WebdriverIO.ElementArray> {
        return await this.browser.$$(".ag-floating-top .ag-row");
    }

    /**
     * Waits for pinned rows to appear
     */
    public async waitForPinnedRows(): Promise<void> {
        await this.browser.waitUntil(
            async () => {
                try {
                    const pinnedRows = await this.browser.$$(".ag-floating-top .ag-row");
                    return pinnedRows.length > 0;
                } catch {
                    return false;
                }
            },
            { timeout: 10000, timeoutMsg: "Pinned rows did not appear within timeout" }
        );
    }

    /**
     * Re-fetches the webview to get a fresh reference (useful after navigation)
     */
    public async refresh(): Promise<void> {
        this.webview = await this.getWebviewSafely();
    }
}
