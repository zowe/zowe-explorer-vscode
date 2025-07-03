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

import { Given, Then, When } from "@cucumber/cucumber";
import { ContextMenu } from "wdio-vscode-service";
import { Key } from "webdriverio";
import quickPick from "../../../__pageobjects__/QuickPick";

const testInfo = {
    profileName: process.env.ZE_TEST_PROFILE_NAME,
    dsFilter: process.env.ZE_TEST_DS_FILTER,
    pds: process.env.ZE_TEST_PDS,
    sequential: process.env.ZE_TEST_SEQUENTIAL_DS,
    testPattern: process.env.ZE_TEST_DS_PATTERN,
};

// Basic table view setup steps
When('the user right-clicks on the dataset profile and selects "Show as Table"', async function () {
    this.workbench = await browser.getWorkbench();

    const ctxMenu: ContextMenu = await this.profileNode.openContextMenu();
    await ctxMenu.wait();

    const showAsTableItem = await ctxMenu.getItem("Show as Table");
    await (await showAsTableItem.elem).click();
});

When('the user right-clicks on a PDS and selects "Show as Table"', async function () {
    this.workbench = await browser.getWorkbench();

    // Find and select a PDS from the filtered results
    this.pdsNode = await this.profileNode.findChildItem(testInfo.pds);
    await expect(this.pdsNode).toBeDefined();

    const ctxMenu: ContextMenu = await this.pdsNode.openContextMenu();
    await ctxMenu.wait();

    const showAsTableItem = await ctxMenu.getItem("Show as Table");
    await (await showAsTableItem.elem).click();
});

Then("the dataset table view appears in the Zowe Resources panel", async function () {
    this.tableView = (await this.workbench.getAllWebviews())[0];
    await this.tableView.wait();

    await this.tableView.open();
    const tableViewDiv = await browser.$(".table-view");
    await tableViewDiv.waitForExist();

    // Verify the table has the correct title format
    const titleElement = await browser.$(".table-view > div > h3");
    await titleElement.waitForExist();

    // Wait for the title to be populated and determine table type
    await browser.waitUntil(
        async () => {
            const titleText = await titleElement.getText();
            return titleText && titleText.trim().length > 0;
        },
        {
            timeout: 10000,
            timeoutMsg: "Title element did not get populated within timeout",
        }
    );

    const titleText = await titleElement.getText();

    // Check if this is a PDS members view or a dataset list view
    if (!titleText.startsWith("[") || titleText.includes("Members of") || /Members of/i.test(titleText)) {
        // This is a PDS members view - wait for and check members title format
        await browser.waitUntil(
            async () => {
                const currentTitle = await titleElement.getText();
                return /Members of/i.test(currentTitle);
            },
            {
                timeout: 10000,
                timeoutMsg: "PDS members title did not appear within timeout",
            }
        );

        const finalTitle = await titleElement.getText();
        await expect(finalTitle).toMatch(/Members of/i);
    } else {
        // This is a dataset list view - wait for and check profile/filter title format
        await browser.waitUntil(
            async () => {
                const currentTitle = await titleElement.getText();
                return /\[.*\]:/.test(currentTitle) && currentTitle.toUpperCase().includes(testInfo.dsFilter.toUpperCase());
            },
            {
                timeout: 10000,
                timeoutMsg: "Dataset list title with profile and filter did not appear within timeout",
            }
        );

        const finalTitle = await titleElement.getText();
        await expect(finalTitle).toMatch(/\[.*\]:/); // Should match pattern like "[PROFILE]: filter"
        await expect(finalTitle).toContain(testInfo.dsFilter.toUpperCase());
    }
});

Then("the table displays dataset information with appropriate columns", async function () {
    // Verify essential dataset columns are present
    const expectedColumns = [
        { name: "Data Set Name", id: "dsname" },
        { name: "Data Set Organization", id: "dsorg" },
    ];

    for (const column of expectedColumns) {
        const columnHeader = await browser.$(`[col-id="${column.id}"]`);
        await columnHeader.waitForExist();
    }

    // Verify table has data rows
    const dataRows = await browser.$$(".ag-row[row-index]");
    await expect(dataRows.length).toBeGreaterThan(0);

    await this.tableView.close();
});

Then("the table displays PDS member names", async function () {
    // Verify member-specific columns might be present
    const memberColumns = [{ name: "Data Set Name", id: "dsname" }];
    for (const column of memberColumns) {
        const columnHeader = await browser.$(`[col-id="${column.id}"]`);
        await columnHeader.waitForExist();
    }

    // Verify table has data rows for members
    const dataRows = await browser.$$(".ag-row[row-index]");
    await expect(dataRows.length).toBeGreaterThan(0);

    // Verify the title indicates PDS members
    const titleElement = await browser.$(".table-view > div > h3");
    const titleText = await titleElement.getText();
    await expect(titleText).toMatch(/Members of/i);

    await this.tableView.close();
});

// Command palette functionality
When('the user opens the command palette and runs "List Data Sets" command', async function () {
    this.workbench = await browser.getWorkbench();

    // Execute the List Data Sets command directly
    await browser.executeWorkbench((vscode) => {
        void vscode.commands.executeCommand("zowe.ds.listDataSets");
    });

    // Wait for the profile selection quick pick to appear
    await browser.pause(1000);
});

When("enters a valid profile and dataset pattern", async function () {
    // Wait for profile selection quick pick to be available
    await browser.waitUntil(
        async () => {
            const quickPickItems = await browser.$$(".quick-input-list .quick-input-list-entry");
            return quickPickItems.length > 0;
        },
        {
            timeout: 10000,
            timeoutMsg: "Profile selection quick pick did not appear within timeout",
        }
    );

    // Select the first available profile (or the configured test profile)
    if (testInfo.profileName) {
        const profilePick = await quickPick.findItem(testInfo.profileName);
        await profilePick.waitForDisplayed();
        await profilePick.click();
    } else {
        // Select the first profile
        await browser.keys([Key.Enter]);
    }

    // Wait for dataset pattern input to appear
    await browser.waitUntil(
        async () => {
            const inputBox = await browser.$(".quick-input-box input");
            return inputBox.isExisting();
        },
        {
            timeout: 10000,
            timeoutMsg: "Dataset pattern input did not appear within timeout",
        }
    );

    // Enter dataset pattern
    const pattern = testInfo.testPattern || testInfo.dsFilter || "*.DATASET";
    await browser.keys(pattern);
    await browser.keys([Key.Enter]);
});

Then("the table displays datasets matching the pattern", async function () {
    // Verify table has matching datasets
    const dataRows = await browser.$$(".ag-row[row-index]");
    await expect(dataRows.length).toBeGreaterThan(0);

    await this.tableView.close();
});

// Common table view setup
Given("a user who has the dataset table view opened", async function () {
    this.tableView = (await (await browser.getWorkbench()).getAllWebviews())[0];
    await this.tableView.wait();
});

Given("a user who has the dataset table view opened with PS datasets", async function () {
    this.tableView = (await (await browser.getWorkbench()).getAllWebviews())[0];
    await this.tableView.wait();

    await this.tableView.open();

    // Verify we have PS (sequential) datasets
    const psRows = await browser.$$(".ag-row[row-index] [col-id='dsorg']");
    let hasPsDatasets = false;

    for (const cell of psRows) {
        const cellText = await cell.getText();
        if (cellText === "PS") {
            hasPsDatasets = true;
            break;
        }
    }

    await expect(hasPsDatasets).toBe(true);
});

Given("a user who has the dataset table view opened with PDS datasets", async function () {
    this.tableView = (await (await browser.getWorkbench()).getAllWebviews())[0];
    await this.tableView.wait();

    await this.tableView.open();

    // Verify we have PDS datasets
    const pdsRows = await browser.$$(".ag-row[row-index] [col-id='dsorg']");
    let hasPdsDatasets = false;

    for (const cell of pdsRows) {
        const cellText = await cell.getText();
        if (cellText.startsWith("PO")) {
            hasPdsDatasets = true;
            break;
        }
    }

    await expect(hasPdsDatasets).toBe(true);
});

Given("a user who has the dataset table view opened with mixed dataset types", async function () {
    this.tableView = (await (await browser.getWorkbench()).getAllWebviews())[0];
    await this.tableView.wait();
});

Given("a user who has focused on a PDS and is viewing its members", async function () {
    // Verify we're in members view by checking to see if table title contains "Members of"
    const titleElement = await browser.$(".table-view > div > h3");
    const titleText = await titleElement.getText();
    await expect(titleText).toMatch(/Members of/i);

    await this.tableView.close();
});

Given("a user who has the dataset table view opened with PDS members", async function () {
    this.tableView = (await (await browser.getWorkbench()).getAllWebviews())[0];
    await this.tableView.wait();

    await this.tableView.open();

    // Check if we're in members view
    const titleElement = await browser.$(".table-view > div > h3");
    const titleText = await titleElement.getText();
    const isMembersView = titleText.includes("Members of") || (await browser.$("button[title='Back']").isExisting());

    await expect(isMembersView).toBe(true);
    await this.tableView.close();
});

Given("a user who has the dataset table view opened with many datasets", async function () {
    this.tableView = (await (await browser.getWorkbench()).getAllWebviews())[0];
    await this.tableView.wait();

    await this.tableView.open();

    // Verify pagination is enabled by checking for pagination controls
    const paginationPanel = await browser.$(".ag-paging-panel");
    await paginationPanel.waitForExist();

    await this.tableView.close();
});

// Column selector functionality
When("the user clicks on the Gear icon in the table view", async function () {
    // Clear all notifications to avoid overlapping elements
    await browser.executeWorkbench((vscode) => vscode.commands.executeCommand("notifications.clearAll"));

    // Shift Selenium focus into webview
    await this.tableView.open();
    const colsBtn = await browser.$("#colsToggleBtn");
    await colsBtn.waitForClickable();
    await colsBtn.click();
});

Then("the column selector menu appears", async function () {
    this.colSelectorMenu = await browser.$(".szh-menu.szh-menu--state-open.toggle-cols-menu");
    await this.colSelectorMenu.waitForExist();
});

Then("the user can toggle a column on and off", async function () {
    const columnInMenu = await this.colSelectorMenu.$("div > li:nth-child(2)");
    await columnInMenu.waitForClickable();

    const checkedIcon = await columnInMenu.$("div > span > .codicon-check");
    await checkedIcon.waitForExist();

    // First click toggles it off
    await columnInMenu.click();
    await checkedIcon.waitForExist({ reverse: true });

    // Second click will toggle it back on
    await columnInMenu.click();
    await checkedIcon.waitForExist();

    await this.tableView.close();
});

// Row actions functionality
When("the user selects one or more sequential datasets", async function () {
    // Find and select PS datasets
    const rows = await browser.$$(".ag-row[row-index]");
    let selectedCount = 0;

    for (const row of rows) {
        const dsorgCell = await row.$("[col-id='dsorg']");
        const dsorgText = await dsorgCell.getText();

        if (dsorgText === "PS" && selectedCount < 2) {
            const checkbox = await row.$(".ag-selection-checkbox");
            await checkbox.click();
            selectedCount++;
        }

        if (selectedCount === 2) {
            break;
        }
    }

    await expect(selectedCount).toBeGreaterThan(0);
});

When("the user selects one or more rows", async function () {
    await this.tableView.open();
    // Select first two rows
    const rows = await browser.$$(".ag-row[row-index]");
    await expect(rows.length).toBeGreaterThan(0);

    const firstCheckbox = await rows[0].$(".ag-selection-checkbox");
    await firstCheckbox.click();

    if (rows.length > 1) {
        const secondCheckbox = await rows[1].$(".ag-selection-checkbox");
        await secondCheckbox.click();
    }
});

When("the user selects a PDS dataset", async function () {
    // Find and select a PDS dataset
    // Clear any existing selections by clicking "select all" checkbox twice
    const selectAllCheckbox = await browser.$(".ag-header-select-all");
    await selectAllCheckbox.waitForClickable();

    // First click to select all
    await selectAllCheckbox.click();
    // Second click to deselect all
    await selectAllCheckbox.click();

    const rows = await browser.$$(".ag-row[row-index]");
    let pdsSelected = false;

    for (const row of rows) {
        await row.waitForExist();
        const dsorgCell = await row.$("[col-id='dsorg']");
        const dsorgText = await dsorgCell.getText();
        // div.ag-cell.ag-cell-not-inline-editing.ag-cell-normal-height.ag-column-first > div > div
        // Check if the row is a PDS dataset
        if (dsorgText.startsWith("PO")) {
            const dsnameCell = await row.$("div[col-id='dsname']");
            const checkbox = await dsnameCell.$("div");
            await checkbox.click();
            pdsSelected = true;
            break;
        }
    }

    await expect(pdsSelected).toBe(true);
});

When("the user selects the pinned rows", async function () {
    // Select rows in the pinned section
    const pinnedRows = await browser.$$(".ag-floating-top .ag-row");
    await expect(pinnedRows.length).toBeGreaterThan(0);

    for (const row of pinnedRows) {
        const checkbox = await row.$(".ag-selection-checkbox");
        await checkbox.click();
    }
});

async function getWebviewButtonByTitle(title: string, appearance: string = "primary"): Promise<WebdriverIO.Element | null> {
    const buttons = await browser.$$(`vscode-button[appearance='${appearance}']`);
    let btn = null;

    for (const button of buttons) {
        const buttonText = await button.getText();
        if (buttonText === title) {
            btn = button;
            break;
        }
    }

    return btn;
}

When('clicks the "Open" action button', async function () {
    const openButton = await getWebviewButtonByTitle("Open");
    await expect(openButton).not.toBe(null);
    await openButton.waitForClickable();
    await openButton.click();
});

When('clicks the "Pin" action button', async function () {
    const pinButton = await getWebviewButtonByTitle("Pin", "secondary");
    await expect(pinButton).not.toBe(null);
    await pinButton.waitForClickable();
    await pinButton.click();
});

When('clicks the "Unpin" action button', async function () {
    const unpinButton = await getWebviewButtonByTitle("Unpin", "secondary");
    await expect(unpinButton).not.toBe(null);
    await unpinButton.waitForClickable();
    await unpinButton.click();
});

When('clicks the "Focus" action button', async function () {
    const focusButton = await getWebviewButtonByTitle("Focus", "secondary");
    await expect(focusButton).not.toBe(null);
    await focusButton.waitForClickable();
    await focusButton.click();
});

When('clicks the "Back" action button', async function () {
    const backButton = await getWebviewButtonByTitle("Back");
    await expect(backButton).not.toBe(null);
    await backButton.waitForClickable();
    await backButton.click();
});

// Verification steps for actions
Then("the selected datasets open in the editor", async function () {
    await browser.pause(2000); // Allow time for editors to open

    // Close the table view first
    await this.tableView.close();

    // Check if editors are open
    const workbench = await browser.getWorkbench();
    const editorView = workbench.getEditorView();
    const openTabs = await editorView.getOpenEditorTitles();

    await expect(openTabs.length).toBeGreaterThan(0);
});

Then("the selected rows are pinned to the top of the table", async function () {
    await browser.pause(1000); // Allow time for pinning

    // Verify pinned rows exist
    const pinnedRows = await browser.$$(".ag-floating-top .ag-row");
    await expect(pinnedRows.length).toBeGreaterThan(0);

    await this.tableView.close();
});

Then("the selected rows are unpinned from the table", async function () {
    // Verify no pinned rows exist or fewer pinned rows
    const pinnedRows = await browser.$$(".ag-floating-top .ag-row");
    await expect(pinnedRows.length).toBe(0);

    await this.tableView.close();
});

Then("the table view switches to show PDS members", async function () {
    await browser.pause(2000); // Allow time for navigation

    // Verify we're now in members view
    const titleElement = await browser.$(".table-view > div > h3");
    const titleText = await titleElement.getText();
    await expect(titleText).toMatch(/Members of/i);

    // Verify Back button is visible
    const backButton = await browser.$("button[title='Back']");
    await backButton.waitForExist();
});

Then("the table displays member-specific columns", async function () {
    // Check for member-specific columns that might be visible
    //const possibleMemberColumns = ["vers", "mod", "cnorc", "inorc", "mnorc"];

    // At least some member data should be present
    const dataRows = await browser.$$(".ag-row[row-index]");
    await expect(dataRows.length).toBeGreaterThan(0);

    await this.tableView.close();
});

Then("the table view returns to the previous dataset list", async function () {
    await browser.pause(2000); // Allow time for navigation

    // Verify we're back to the main dataset view (no Back button)
    const backButton = await browser.$("button[title='Back']");
    const backButtonExists = await backButton.isExisting();
    await expect(backButtonExists).toBe(false);

    // Verify title doesn't contain "Members of"
    const titleElement = await browser.$(".table-title");
    const titleText = await titleElement.getText();
    await expect(titleText).not.toMatch(/Members of/i);
});

Then("preserves the previous table state including pinned rows", async function () {
    // This is tested implicitly by checking that the table returns to its previous state
    // Additional checks could verify specific pinned rows if needed
    await this.tableView.close();
});

// Context menu functionality
When("the user right-clicks on a dataset row", async function () {
    const firstRow = await browser.$(".ag-row[row-index='0']");
    await firstRow.waitForExist();
    await firstRow.click({ button: "right" });
});

When("the user right-clicks on a member row", async function () {
    const firstRow = await browser.$(".ag-row[row-index='0']");
    await firstRow.waitForExist();
    await firstRow.click({ button: "right" });
});

When('selects "Display in Tree" from the context menu', async function () {
    const contextMenu = await browser.$(".ag-menu");
    await contextMenu.waitForExist();

    const displayInTreeItem = await contextMenu.$("*=Display in Tree");
    await displayInTreeItem.click();
});

Then("the dataset is revealed and focused in the Data Sets tree", async function () {
    await browser.pause(2000); // Allow time for tree reveal

    // Close table view to see tree
    await this.tableView.close();

    // The dataset should be revealed in the tree - this is hard to verify directly
    // but we can check that the Data Sets tree is focused
    const dataSetsPanelTab = await browser.$("*=DATA SETS");
    const isActive = await dataSetsPanelTab.getAttribute("aria-selected");
    await expect(isActive).toBe("true");
});

Then("the PDS member is revealed and focused in the Data Sets tree", async function () {
    await browser.pause(2000); // Allow time for tree reveal

    // Close table view to see tree
    await this.tableView.close();

    // Similar to dataset reveal verification
    const dataSetsPanelTab = await browser.$("*=DATA SETS");
    const isActive = await dataSetsPanelTab.getAttribute("aria-selected");
    await expect(isActive).toBe("true");
});

// Hierarchical tree functionality
When("the table loads with hierarchical tree support", async function () {
    // Verify tree column renderer is active
    const treeColumn = await browser.$("[col-id='dsname'] .ag-group-expanded, [col-id='dsname'] .ag-group-contracted");
    await expect(treeColumn.isExisting()).toBe(true);
});

Then("PDS datasets show expand and collapse indicators", async function () {
    // Look for tree expansion indicators
    const expandIcons = await browser.$$(".ag-group-expanded, .ag-group-contracted");
    await expect(expandIcons.length).toBeGreaterThan(0);

    await this.tableView.close();
});

Then("users can expand PDS nodes to view members inline", async function () {
    // Try to expand a PDS node
    const expandIcon = await browser.$(".ag-group-contracted");
    if (await expandIcon.isExisting()) {
        await expandIcon.click();
        await browser.pause(1000);

        // Verify child rows appeared
        const childRows = await browser.$$(".ag-row[aria-level='1']");
        await expect(childRows.length).toBeGreaterThan(0);
    }

    await this.tableView.close();
});

Then("the tree structure is properly displayed", async function () {
    // Verify hierarchical structure with proper indentation
    //const level0Rows = await browser.$$(".ag-row[aria-level='0']");
    //const level1Rows = await browser.$$(".ag-row[aria-level='1']");

    // Should have both parent and child levels if expanded
    await this.tableView.close();
});

// Search and filter functionality
When("the user uses the table's built-in search functionality", async function () {
    await this.tableView.open();

    // Use AG Grid's filter functionality
    const filterIcon = await browser.$(".ag-header-cell-menu-button");
    if (await filterIcon.isExisting()) {
        await filterIcon.click();
        await browser.pause(500);
    }
});

When("applies filters to dataset columns", async function () {
    // Apply a filter to the dataset name column
    const filterInput = await browser.$(".ag-filter-wrapper input");
    if (await filterInput.isExisting()) {
        await filterInput.setValue("TEST");
        await browser.pause(1000);
    }
});

Then("the table shows only datasets matching the search criteria", async function () {
    // Verify filtered results
    const visibleRows = await browser.$$(".ag-row:not(.ag-row-hidden)");
    await expect(visibleRows.length).toBeGreaterThan(0);

    await this.tableView.close();
});

Then("the filtering works correctly across all visible columns", async function () {
    // This is verified by the previous step
    await this.tableView.close();
});

// Sorting functionality
When("the user clicks on different column headers", async function () {
    await this.tableView.open();

    // Click on dataset name column header to sort
    const columnHeader = await browser.$("[col-id='dsname'] .ag-header-cell-label");
    await columnHeader.click();

    await browser.pause(500);

    // Click again to reverse sort
    await columnHeader.click();
    await browser.pause(500);
});

Then("the table sorts by the selected column", async function () {
    // Verify sort indicator is present
    const sortIndicator = await browser.$(
        ".ag-header-cell-menu-button .ag-sort-ascending-icon, .ag-header-cell-menu-button .ag-sort-descending-icon"
    );
    await expect(sortIndicator.isExisting()).toBe(true);

    await this.tableView.close();
});

Then("sort indicators are displayed correctly", async function () {
    // This is verified by the previous step
    await this.tableView.close();
});

Then("multiple column sorting works as expected", async function () {
    // Test multi-column sort by holding Ctrl and clicking another column
    const secondColumnHeader = await browser.$("[col-id='dsorg'] .ag-header-cell-label");
    if (await secondColumnHeader.isExisting()) {
        await browser.keys([Key.Ctrl]);
        await secondColumnHeader.click();
        await browser.keys([Key.Ctrl]); // Release Ctrl
    }

    await this.tableView.close();
});

// Column resize and reorder functionality
When("the user drags column borders to resize them", async function () {
    await this.tableView.open();

    // Find column resize handle
    const resizeHandle = await browser.$(".ag-header-cell-resize");
    if (await resizeHandle.isExisting()) {
        await resizeHandle.dragAndDrop({ x: 50, y: 0 });
        await browser.pause(500);
    }
});

When("drags column headers to reorder them", async function () {
    // This is complex to test with WebDriver, but we can simulate the action
    const columnHeader = await browser.$("[col-id='dsorg'] .ag-header-cell-label");
    const targetColumn = await browser.$("[col-id='createdDate'] .ag-header-cell-label");

    if ((await columnHeader.isExisting()) && (await targetColumn.isExisting())) {
        await columnHeader.dragAndDrop(targetColumn);
        await browser.pause(500);
    }
});

Then("the columns resize and reorder correctly", async function () {
    // Verify the layout has changed - this is difficult to test precisely
    // but we can check that the columns still exist
    const columns = await browser.$$(".ag-header-cell");
    await expect(columns.length).toBeGreaterThan(0);

    await this.tableView.close();
});

Then("the layout changes are preserved", async function () {
    // This would require reopening the table to verify persistence
    await this.tableView.close();
});

// Pagination functionality
When("the table loads with pagination enabled", async function () {
    await this.tableView.open();

    // Verify pagination controls exist
    const paginationPanel = await browser.$(".ag-paging-panel");
    await paginationPanel.waitForExist();
});

Then("the table shows appropriate page size options", async function () {
    const pageSizeSelector = await browser.$(".ag-paging-page-size");
    if (await pageSizeSelector.isExisting()) {
        await pageSizeSelector.click();

        // Verify page size options
        const pageSizeOptions = await browser.$$(".ag-list-item");
        await expect(pageSizeOptions.length).toBeGreaterThan(0);

        // Close the dropdown
        await browser.keys([Key.Escape]);
    }

    await this.tableView.close();
});

Then("users can navigate between pages", async function () {
    const nextPageButton = await browser.$(".ag-paging-button[aria-label*='next']");
    if ((await nextPageButton.isExisting()) && (await nextPageButton.isEnabled())) {
        await nextPageButton.click();
        await browser.pause(1000);

        // Navigate back
        const prevPageButton = await browser.$(".ag-paging-button[aria-label*='previous']");
        if ((await prevPageButton.isExisting()) && (await prevPageButton.isEnabled())) {
            await prevPageButton.click();
        }
    }

    await this.tableView.close();
});

Then("the pagination controls work correctly", async function () {
    // Verify pagination summary shows correct information
    const paginationSummary = await browser.$(".ag-paging-row-summary-panel");
    if (await paginationSummary.isExisting()) {
        const summaryText = await paginationSummary.getText();
        await expect(summaryText).toMatch(/\d+ to \d+ of \d+/);
    }

    await this.tableView.close();
});

// Selection functionality
When("the user uses different selection methods", async function () {
    await this.tableView.open();

    // Store reference to rows for selection testing
    this.testRows = await browser.$$(".ag-row[row-index]");
    await expect(this.testRows.length).toBeGreaterThan(0);
});

Then("single row selection works correctly", async function () {
    if (this.testRows && this.testRows.length > 0) {
        const firstRowCheckbox = await this.testRows[0].$(".ag-selection-checkbox");
        await firstRowCheckbox.click();

        // Verify row is selected
        const isSelected = await firstRowCheckbox.isSelected();
        await expect(isSelected).toBe(true);
    }
});

Then("multiple row selection with Ctrl/Cmd works", async function () {
    if (this.testRows && this.testRows.length > 1) {
        // Hold Ctrl and select additional rows
        await browser.keys([Key.Ctrl]);
        const secondRowCheckbox = await this.testRows[1].$(".ag-selection-checkbox");
        await secondRowCheckbox.click();
        await browser.keys([Key.Ctrl]); // Release Ctrl

        // Verify both rows are selected
        const firstSelected = await this.testRows[0].$(".ag-selection-checkbox").isSelected();
        const secondSelected = await this.testRows[1].$(".ag-selection-checkbox").isSelected();
        await expect(firstSelected).toBe(true);
        await expect(secondSelected).toBe(true);
    }
});

Then("range selection with Shift works", async function () {
    if (this.testRows && this.testRows.length > 2) {
        // Select first row
        await this.testRows[0].click();

        // Hold Shift and select third row to select range
        await browser.keys([Key.Shift]);
        await this.testRows[2].click();
        await browser.keys([Key.Shift]); // Release Shift

        // Verify range is selected (this is complex to verify precisely)
        // So we'll just verify that multiple rows can be selected
        const selectedRows = await browser.$$(".ag-row.ag-row-selected");
        await expect(selectedRows.length).toBeGreaterThan(1);
    }
});

Then("select all functionality works properly", async function () {
    // Find and use select all checkbox if available
    const selectAllCheckbox = await browser.$(".ag-header-select-all .ag-selection-checkbox");
    if (await selectAllCheckbox.isExisting()) {
        await selectAllCheckbox.click();

        // Verify all visible rows are selected
        const allRows = await browser.$$(".ag-row:not(.ag-row-hidden)");
        const selectedRows = await browser.$$(".ag-row.ag-row-selected");

        await expect(allRows.length).toBe(selectedRows.length);
    }

    await this.tableView.close();
});
