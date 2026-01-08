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

/**
 * Page Object for the Dataset Table View (webview)
 *
 * Uses WebDriverIO's getter-based selector pattern for lazy evaluation and auto-waiting.
 * Selectors are evaluated fresh each time they're accessed, avoiding stale element issues.
 */
export class DatasetTableViewPage {
    constructor(private browser: WebdriverIO.Browser) {}

    // ==================== Selectors (getter-based for lazy evaluation) ====================

    /** The main table view container */
    get tableViewContainer() {
        return this.browser.$(".table-view");
    }

    /** The table title element */
    get title() {
        return this.browser.$(".table-view > div > h3");
    }

    /** All data rows in the table (excludes pinned rows) */
    get rows() {
        return this.browser.$$(".ag-row[row-index]:not(.ag-row-pinned)");
    }

    /** All pinned rows at the top of the table */
    get pinnedRows() {
        return this.browser.$$(".ag-floating-top .ag-row");
    }

    /** The "select all" checkbox in the header */
    get selectAllCheckbox() {
        return this.browser.$(".ag-header-select-all");
    }

    /** Pagination panel (if present) */
    get paginationPanel() {
        return this.browser.$(".ag-paging-panel");
    }

    /** Context menu container */
    get contextMenu() {
        return this.browser.$(".szh-menu");
    }

    /** Context menu items */
    get contextMenuItems() {
        return this.browser.$$(".szh-menu .szh-menu__item");
    }

    /** Expand/collapse icons for PDS datasets */
    get expandIcons() {
        return this.browser.$$(".ag-row > div[col-id='dsname'] > div > span > div > span > .codicon-chevron-right");
    }

    /** Level 0 (parent) rows in hierarchical view */
    get level0Rows() {
        return this.browser.$$(".ag-cell[col-id='dsname'] > div div[aria-level='0']");
    }

    /** Level 1 (child) rows in hierarchical view */
    get level1Rows() {
        return this.browser.$$(".ag-cell[col-id='dsname'] > div div[aria-level='1']");
    }

    // ==================== Dynamic Selectors ====================

    /** Get a column header by its ID */
    columnHeader(columnId: string) {
        return this.browser.$(`[col-id="${columnId}"]`);
    }

    /** Get a row by its index */
    rowByIndex(index: number) {
        return this.browser.$(`.ag-row[row-index='${index}']`);
    }

    /** Get a cell by column ID within a row */
    cellInRow(row: WebdriverIO.Element, columnId: string) {
        return row.$(`[col-id='${columnId}']`);
    }

    /** Get a button by title and appearance */
    buttonSelector(title: string, appearance: string = "primary") {
        return this.browser.$$(`vscode-button[appearance='${appearance}']`);
    }

    // ==================== Webview Management ====================

    /**
     * Ensures we're in the main frame context (not inside a webview).
     * Safe to call multiple times.
     */
    public async ensureMainFrame(): Promise<void> {
        try {
            await this.browser.switchToFrame(null);
        } catch {
            // Already in main frame or frame switch failed, continue
        }
    }

    /**
     * Opens the webview and switches to its frame context.
     * Call this before interacting with any table elements.
     *
     * NOTE: This always re-enters the webview frame because the frame context
     * can be lost between steps (e.g., when switching back to main frame for tree operations).
     */
    public async open(): Promise<void> {
        // Always start from the main frame and re-enter the webview frame
        await this.ensureMainFrame();

        // Open the webview with retry logic that verifies content is actually loaded
        await this.browser.waitUntil(
            async () => {
                try {
                    // Always re-fetch workbench and webviews to avoid stale references
                    const freshWorkbench = await this.browser.getWorkbench();
                    const webviews = await freshWorkbench.getAllWebviews();
                    if (webviews.length === 0) return false;

                    let tableView = null;
                    for (const webview of webviews) {
                        try {
                            const title = await webview.getTitle();
                            if (title === "Table View") {
                                tableView = webview;
                                break;
                            }
                        } catch {
                            continue;
                        }
                    }

                    // Fall back to first webview if no title match
                    if (!tableView) {
                        tableView = webviews[0];
                    }

                    await tableView.wait();
                    await tableView.open();

                    // Verify we're actually inside the webview by checking for the table-view container
                    // This catches cases where the frame switch succeeded but content isn't rendered
                    const container = await this.browser.$(".table-view");
                    return await container.isExisting();
                } catch {
                    // Stale element, frame switch failed, or content not ready - retry from main frame
                    await this.ensureMainFrame();
                    return false;
                }
            },
            { timeout: 30000, timeoutMsg: "Could not open webview or .table-view container not found within timeout" }
        );
    }

    /**
     * Closes the webview and switches back to the main frame.
     * Always safe to call, even if webview is not open.
     */
    public async close(): Promise<void> {
        try {
            await this.ensureMainFrame();
            const workbench = await this.browser.getWorkbench();
            const webviews = await workbench.getAllWebviews();
            if (webviews.length > 0) {
                await webviews[0].close();
            }
        } catch {
            // Ignore errors during cleanup - webview may already be closed
        }

        // Ensure we're back in main frame after closing
        await this.ensureMainFrame();
    }

    /**
     * Refreshes the webview reference (useful after navigation).
     */
    public async refresh(): Promise<void> {
        await this.ensureMainFrame();
        await this.open();
    }

    // ==================== Wait Methods ====================

    /**
     * Waits for the table view container to exist and have data rows.
     */
    public async waitForReady(): Promise<void> {
        await this.browser.waitUntil(
            async () => {
                try {
                    const container = await this.tableViewContainer;
                    if (!(await container.isExisting())) return false;
                    const dataRows = await this.rows;
                    return dataRows.length > 0;
                } catch {
                    return false;
                }
            },
            { timeout: 60000, timeoutMsg: "Table did not become ready within timeout" }
        );
    }

    /**
     * Waits for the title to appear and returns its text.
     */
    public async waitForTitle(): Promise<string> {
        let titleText = "";
        await this.browser.waitUntil(
            async () => {
                try {
                    const titleElement = await this.title;
                    if (!(await titleElement.isExisting())) return false;
                    titleText = await titleElement.getText();
                    return titleText && titleText.trim().length > 0;
                } catch {
                    return false;
                }
            },
            { timeout: 20000, timeoutMsg: "Table view title did not appear within timeout" }
        );
        return titleText;
    }

    /**
     * Waits for pinned rows to appear.
     */
    public async waitForPinnedRows(): Promise<void> {
        await this.browser.waitUntil(
            async () => {
                try {
                    const pinned = await this.pinnedRows;
                    return pinned.length > 0;
                } catch {
                    return false;
                }
            },
            { timeout: 10000, timeoutMsg: "Pinned rows did not appear within timeout" }
        );
    }

    // ==================== Query Methods ====================

    /**
     * Gets the current title text.
     */
    public async getTitle(): Promise<string> {
        const titleElement = await this.title;
        return titleElement.getText();
    }

    /**
     * Gets all data rows (fresh query each time).
     */
    public async getRows(): Promise<WebdriverIO.ElementArray> {
        return this.rows;
    }

    /**
     * Gets all pinned rows (fresh query each time).
     */
    public async getPinnedRows(): Promise<WebdriverIO.ElementArray> {
        return this.pinnedRows;
    }

    /**
     * Checks if the table view container exists.
     */
    public async exists(): Promise<boolean> {
        const container = await this.tableViewContainer;
        return container.isExisting();
    }

    // ==================== Action Methods ====================

    /**
     * Verifies a column exists by its ID.
     */
    public async verifyColumnExists(columnId: string): Promise<void> {
        const header = this.columnHeader(columnId);
        await header.waitForExist({ timeout: 30000 });
    }

    /**
     * Selects a row by clicking its checkbox.
     */
    public async selectRowByIndex(rowIndex: number): Promise<void> {
        await this.browser.waitUntil(
            async () => {
                try {
                    const dataRows = await this.rows;
                    if (rowIndex >= dataRows.length) return false;
                    const checkbox = await dataRows[rowIndex].$(".ag-selection-checkbox");
                    await checkbox.click();
                    return true;
                } catch {
                    return false;
                }
            },
            { timeout: 10000, timeoutMsg: `Could not select row at index ${rowIndex}` }
        );
    }

    /**
     * Clears all row selections using the "select all" checkbox.
     */
    public async clearSelections(): Promise<void> {
        const checkbox = await this.selectAllCheckbox;
        await checkbox.waitForClickable();
        await checkbox.click(); // Select all
        await checkbox.click(); // Deselect all
    }

    /**
     * Finds and returns a button by title, or null if not found within timeout.
     */
    public async getButton(title: string, appearance: string = "primary", timeout: number = 5000): Promise<WebdriverIO.Element | null> {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            try {
                const buttons = await this.buttonSelector(title, appearance);
                for (const button of buttons) {
                    const buttonText = await button.getText();
                    if (buttonText === title) {
                        return button;
                    }
                }
            } catch {
                // Element became stale, retry
            }
            await this.browser.pause(100);
        }
        return null;
    }

    /**
     * Clicks a button by title. Throws if button not found.
     */
    public async clickButton(title: string, appearance: string = "primary"): Promise<void> {
        const button = await this.getButton(title, appearance);
        if (!button) {
            throw new Error(`Button "${title}" with appearance "${appearance}" not found`);
        }
        await button.waitForClickable();
        await button.click();
    }

    /**
     * Finds and selects a row by dataset organization type (PS, PO, etc.).
     * Returns true if a matching row was found and selected.
     */
    public async selectRow(dsorgPattern: string | RegExp, dsnamePattern?: string | RegExp): Promise<boolean> {
        return this.browser.waitUntil(
            async () => {
                try {
                    const dataRows = await this.rows;
                    for (let i = 0; i < dataRows.length; i++) {
                        // Re-fetch row to avoid stale element
                        const freshRows = await this.rows;
                        if (i >= freshRows.length) continue;

                        const dsnameCell = await freshRows[i].$("[col-id='dsname']");
                        const dsnameText = await dsnameCell.getText();
                        const dsorgCell = await freshRows[i].$("[col-id='dsorg']");
                        const dsorgText = await dsorgCell.getText();

                        const patternMatches = typeof dsorgPattern === "string" ? dsorgText === dsorgPattern : dsorgPattern.test(dsorgText);
                        const nameMatches = dsnamePattern
                            ? typeof dsnamePattern === "string"
                                ? dsnameText === dsnamePattern
                                : dsnamePattern.test(dsnameText)
                            : true;
                        if (patternMatches && nameMatches) {
                            const checkbox = await freshRows[i].$(".ag-selection-checkbox");
                            await checkbox.click();
                            return true;
                        }
                    }
                } catch {
                    // Element became stale, retry
                }
                return false;
            },
            { timeout: 10000, timeoutMsg: `Could not find and select a row with dsorg matching ${dsorgPattern}` }
        );
    }

    /**
     * Finds and right-clicks a row by dataset name.
     */
    public async rightClickRowByDsname(dsname: string): Promise<void> {
        await this.browser.waitUntil(
            async () => {
                try {
                    const dataRows = await this.rows;
                    for (const row of dataRows) {
                        const dsnameCell = await row.$("[col-id='dsname']");
                        const dsnameText = await dsnameCell.getText();
                        if (dsnameText === dsname) {
                            await row.click({ button: "right" });
                            return true;
                        }
                    }
                } catch {
                    // Element became stale, retry
                }
                return false;
            },
            { timeout: 10000, timeoutMsg: `Could not find and right-click on dataset row: ${dsname}` }
        );
    }

    /**
     * Clicks a context menu item by text.
     */
    public async clickContextMenuItem(itemText: string): Promise<void> {
        // Wait for context menu to appear with items
        await this.browser.waitUntil(
            async () => {
                try {
                    const menu = await this.contextMenu;
                    if (!(await menu.isExisting())) return false;
                    const items = await this.contextMenuItems;
                    return items.length > 0;
                } catch {
                    return false;
                }
            },
            { timeout: 10000, timeoutMsg: "Context menu did not appear with menu items" }
        );

        // Find and click the menu item
        const items = await this.contextMenuItems;
        for (const item of items) {
            await item.waitForClickable();
            const text = await item.getText();
            if (text === itemText) {
                await item.click();
                return;
            }
        }
        throw new Error(`Could not find context menu item: "${itemText}"`);
    }

    /**
     * Checks if a dataset type exists in the table.
     */
    public async hasDsorgType(dsorgPattern: string | RegExp): Promise<boolean> {
        try {
            const dsorgCells = await this.browser.$$(".ag-row[row-index] [col-id='dsorg']");
            for (const cell of dsorgCells) {
                const cellText = await cell.getText();
                const matches = typeof dsorgPattern === "string" ? cellText === dsorgPattern : dsorgPattern.test(cellText);
                if (matches) return true;
            }
        } catch {
            // Element became stale
        }
        return false;
    }

    /**
     * Waits for a specific dataset type to appear in the table.
     */
    public async waitForDsorgType(dsorgPattern: string | RegExp, timeout: number = 10000): Promise<void> {
        await this.browser.waitUntil(async () => this.hasDsorgType(dsorgPattern), {
            timeout,
            timeoutMsg: `No datasets with dsorg matching ${dsorgPattern} found in table`,
        });
    }

    /**
     * Applies a filter to the dsname column using AG Grid's column filter UI.
     * This shows only rows where the dataset name contains the filter text.
     *
     * @param filterText The text to filter by (e.g., exact dataset name)
     */
    public async setColumnFilter(filterText: string): Promise<void> {
        // Click on the dsname column header's filter icon to open the filter popup
        const filterIcon = await this.browser.$("[col-id='dsname'] .ag-header-cell-menu-button");
        await filterIcon.waitForClickable({ timeout: 5000 });
        await filterIcon.click();

        // Wait for filter popup to appear and enter the filter text
        const filterInput = await this.browser.$(".ag-filter-body input[type='text'], .ag-text-field-input");
        await filterInput.waitForDisplayed({ timeout: 5000 });
        await filterInput.setValue(filterText);

        // Press Enter to apply the filter and close the popup
        await this.browser.keys(["Enter"]);

        // Wait for filter to be applied by checking that at least one row exists
        await this.browser.waitUntil(
            async () => {
                const dataRows = await this.rows;
                return dataRows.length > 0;
            },
            { timeout: 10000, timeoutMsg: "No rows appeared after applying filter" }
        );
    }

    /**
     * Clears any applied column filter from the dsname column.
     */
    public async clearColumnFilter(): Promise<void> {
        // Click on the dsname column header's filter icon
        const filterIcon = await this.browser.$("[col-id='dsname'] .ag-header-cell-menu-button");

        // Check if filter icon exists (column may not have filtering enabled)
        if (!(await filterIcon.isExisting())) {
            return;
        }

        await filterIcon.waitForClickable({ timeout: 5000 });
        await filterIcon.click();

        // Wait for filter popup to appear
        const filterInput = await this.browser.$(".ag-filter-body input[type='text'], .ag-text-field-input");
        await filterInput.waitForDisplayed({ timeout: 5000 });

        // Clear the input and apply
        await filterInput.clearValue();
        await this.browser.keys(["Enter"]);

        // Wait for rows to be displayed after clearing filter
        await this.browser.waitUntil(
            async () => {
                const dataRows = await this.rows;
                return dataRows.length > 0;
            },
            { timeout: 10000, timeoutMsg: "No rows appeared after clearing filter" }
        );
    }

    /**
     * Checks if currently viewing PDS members (title contains "Members of").
     */
    public async isInMembersView(): Promise<boolean> {
        try {
            const titleText = await this.getTitle();
            return /Members of/i.test(titleText);
        } catch {
            return false;
        }
    }

    /**
     * Ensures we're in the dataset list view (not members view).
     * If currently in members view, clicks "Back" to return to dataset list.
     */
    public async ensureDatasetListView(): Promise<void> {
        // Check if we're in members view and need to go back
        if (await this.isInMembersView()) {
            // Click the Back button to return to dataset list
            await this.clickButton("Back", "primary");

            // Wait for the view to switch back to dataset list with frame re-entry
            // (webview frame can become stale when navigating between PDS focus and DS list views)
            await this.browser.waitUntil(
                async () => {
                    try {
                        // Re-enter the webview frame to get fresh references
                        await this.ensureMainFrame();
                        await this.open();

                        const inMembers = await this.isInMembersView();
                        if (inMembers) {
                            return false;
                        }

                        const dataRows = await this.rows;
                        return dataRows.length > 0;
                    } catch {
                        return false;
                    }
                },
                { timeout: 30000, timeoutMsg: "Could not return to dataset list view" }
            );
        }
    }

    /**
     * Waits until the view is showing PDS members.
     */
    public async waitForMembersView(): Promise<void> {
        await this.browser.waitUntil(
            async () => {
                try {
                    // Re-open the webview frame to get fresh content after Focus click
                    await this.open();
                    return await this.isInMembersView();
                } catch {
                    return false;
                }
            },
            {
                timeout: 15000,
                timeoutMsg: "Not in members view - title does not contain 'Members of'",
            }
        );
    }

    /**
     * Expands the first PDS node to view members inline.
     */
    public async expandFirstPds(): Promise<void> {
        await this.browser.waitUntil(
            async () => {
                try {
                    const icons = await this.expandIcons;
                    if (icons.length === 0) return false;
                    await icons[0].click();
                    return true;
                } catch {
                    return false;
                }
            },
            { timeout: 10000, timeoutMsg: "Could not find and click expand icon" }
        );
    }

    /**
     * Waits for child rows to appear after expanding a PDS.
     */
    public async waitForChildRows(): Promise<void> {
        await this.browser.waitUntil(
            async () => {
                try {
                    const children = await this.level1Rows;
                    return children.length > 0;
                } catch {
                    return false;
                }
            },
            { timeout: 10000, timeoutMsg: "Child rows did not appear after expanding PDS" }
        );
    }

    /**
     * Verifies the hierarchical tree structure is displayed.
     */
    public async verifyTreeStructure(): Promise<{ level0Count: number; level1Count: number }> {
        await this.browser.waitUntil(
            async () => {
                try {
                    const l0 = await this.level0Rows;
                    const l1 = await this.level1Rows;
                    return l0.length > 0 && l1.length > 0;
                } catch {
                    return false;
                }
            },
            { timeout: 10000, timeoutMsg: "Tree structure not properly displayed" }
        );

        const level0 = await this.level0Rows;
        const level1 = await this.level1Rows;
        return { level0Count: level0.length, level1Count: level1.length };
    }
}
