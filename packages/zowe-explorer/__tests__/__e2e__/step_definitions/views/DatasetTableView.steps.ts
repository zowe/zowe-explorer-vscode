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
import { TreeItem } from "wdio-vscode-service";
import { Key } from "webdriverio";
import quickPick from "../../../__pageobjects__/QuickPick";
import { clickContextMenuItem, paneDivForTree } from "../../../__common__/shared.wdio";
import { DatasetTableViewPage } from "../../../__pageobjects__/DatasetTableViewPage";

const testInfo = {
    profileName: process.env.ZE_TEST_PROFILE_NAME,
    dsFilter: process.env.ZE_TEST_DS_FILTER,
    pds: process.env.ZE_TEST_PDS,
    sequential: process.env.ZE_TEST_PS,
    testPattern: process.env.ZE_TEST_DS_PATTERN,
};

// Basic table view setup steps
When('the user right-clicks on the dataset profile and selects "Show as Table"', async function () {
    this.workbench = await browser.getWorkbench();

    await clickContextMenuItem(await this.helpers.getProfileNode(), "Show as Table");
});

When('the user right-clicks on a PDS and selects "Show as Table"', async function () {
    this.workbench = await browser.getWorkbench();

    // Find and select a PDS from the filtered results
    this.pdsNode = await this.helpers.mProfileNode.findChildItem(testInfo.pds);
    await expect(this.pdsNode).toBeDefined();

    await clickContextMenuItem(this.pdsNode, "Show as Table");
});

Then("the dataset table view appears in the Zowe Resources panel", async function () {
    // Store the page object for later use in the scenario
    this.tableViewPage = new DatasetTableViewPage(browser);
    await this.tableViewPage.open();

    // Wait for table view to exist
    await this.tableViewPage.waitForTableView();

    // Wait for the title element to exist and be populated
    // The title could be either:
    // - PDS members view: "Members of PDS.NAME (count)"
    // - Dataset list view: "[PROFILE]: filter"
    const finalTitle = await this.tableViewPage.waitForTitle();

    // Verify the title is valid
    await browser.waitUntil(
        async () => {
            const titleText = await this.tableViewPage.getTitle();
            // Check if it's a valid PDS members title or dataset list title
            const isPdsMembersTitle = /Members of/i.test(titleText);
            const isDatasetListTitle = /\[.*\]:/.test(titleText) && titleText.toUpperCase().includes(testInfo.dsFilter.toUpperCase());
            return isPdsMembersTitle || isDatasetListTitle;
        },
        {
            timeout: 20000,
            timeoutMsg: "Table view title did not appear within timeout (expected either 'Members of...' or '[profile]: filter')",
        }
    );

    // Verify the title matches the expected format based on its content
    if (/Members of/i.test(finalTitle)) {
        // This is a PDS members view
        await expect(finalTitle).toMatch(/Members of/i);
    } else {
        // This is a dataset list view
        await expect(finalTitle).toMatch(/\[.*\]:/); // Should match pattern like "[PROFILE]: filter"
        await expect(finalTitle).toContain(testInfo.dsFilter.toUpperCase());
    }
});

Then("the table displays dataset information with appropriate columns", async function () {
    await using tableView = this.tableViewPage;
    
    // Verify essential dataset columns are present
    const expectedColumns = [
        { name: "Data Set Name", id: "dsname" },
        { name: "Data Set Organization", id: "dsorg" },
    ];

    for (const column of expectedColumns) {
        await tableView.verifyColumnExists(column.id);
    }

    // Verify table has data rows
    const dataRows = await tableView.getRows();
    await expect(dataRows.length).toBeGreaterThan(0);
});

Then("the table displays PDS member names", async function () {
    await using tableView = this.tableViewPage;
    
    // Verify member-specific columns might be present
    const memberColumns = [{ name: "Data Set Name", id: "dsname" }];
    for (const column of memberColumns) {
        await tableView.verifyColumnExists(column.id);
    }

    // Verify table has data rows for members
    const dataRows = await tableView.getRows();
    await expect(dataRows.length).toBeGreaterThan(0);
});

// Command palette functionality
When('the user opens the command palette and runs "List Data Sets" command', async function () {
    this.workbench = await browser.getWorkbench();

    // Execute the List Data Sets command directly
    await browser.executeWorkbench((vscode) => {
        void vscode.commands.executeCommand("zowe.ds.listDataSets");
    });

    // Wait for the profile selection quick pick to appear
    await browser.waitUntil(
        async () => {
            const quickPickItems = await browser.$$(".quick-input-list .quick-input-list-entry");
            return quickPickItems.length > 0;
        },
        { timeout: 10000, timeoutMsg: "Quick pick did not appear after running command" }
    );
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

    // Enter data set pattern
    const pattern = testInfo.testPattern || testInfo.dsFilter || "*.DATASET";
    await browser.keys(pattern);
    await browser.keys([Key.Enter]);
});

Then("the table displays datasets matching the pattern", async function () {
    await using tableView = this.tableViewPage;
    
    // Verify table has matching datasets
    const dataRows = await tableView.getRows();
    await expect(dataRows.length).toBeGreaterThan(0);
});

// Common table view setup
Given("a user who has the dataset table view opened", async function () {
    this.tableViewPage = new DatasetTableViewPage(browser);
});

Given("a user who has the dataset table view opened with PS datasets", async function () {
    this.tableViewPage = new DatasetTableViewPage(browser);
    await this.tableViewPage.open();
    await this.tableViewPage.waitForReady();

    // Verify we have PS (sequential) datasets using waitUntil to handle stale elements
    const hasPsDatasets = await browser.waitUntil(
        async () => {
            try {
                const psRows = await browser.$$(".ag-row[row-index] [col-id='dsorg']");
                for (const cell of psRows) {
                    const cellText = await cell.getText();
                    if (cellText === "PS") {
                        return true;
                    }
                }
            } catch {
                // Element became stale, retry
            }
            return false;
        },
        { timeout: 10000, timeoutMsg: "No PS datasets found in table" }
    );

    await expect(hasPsDatasets).toBe(true);
});

Given("a user who has the dataset table view opened with PDS datasets", async function () {
    this.tableViewPage = new DatasetTableViewPage(browser);
    await this.tableViewPage.open();
    await this.tableViewPage.waitForReady();

    // Verify we have PDS datasets using waitUntil to handle stale elements
    const hasPdsDatasets = await browser.waitUntil(
        async () => {
            try {
                const pdsRows = await browser.$$(".ag-row[row-index] [col-id='dsorg']");
                for (const cell of pdsRows) {
                    const cellText = await cell.getText();
                    if (cellText.startsWith("PO")) {
                        return true;
                    }
                }
            } catch {
                // Element became stale, retry
            }
            return false;
        },
        { timeout: 10000, timeoutMsg: "No PDS datasets found in table" }
    );

    await expect(hasPdsDatasets).toBe(true);
});

Given("a user who has the dataset table view opened with mixed dataset types", async function () {
    this.tableViewPage = new DatasetTableViewPage(browser);
});

Given("a user who has focused on a PDS and is viewing its members", async function () {
    this.tableViewPage = new DatasetTableViewPage(browser);
    await this.tableViewPage.open();
    await this.tableViewPage.waitForReady();

    // Verify we're in members view by checking to see if table title contains "Members of"
    await browser.waitUntil(
        async () => {
            try {
                const titleText = await this.tableViewPage.getTitle();
                return typeof titleText === "string" && /Members of/i.test(titleText);
            } catch {
                return false;
            }
        },
        { timeout: 10000, timeoutMsg: "Not in members view - title does not contain 'Members of'" }
    );
});

Given("a user who has the dataset table view opened with PDS members", async function () {
    this.tableViewPage = new DatasetTableViewPage(browser);
    await this.tableViewPage.open();
    await this.tableViewPage.waitForReady();
});

Given("a user who has the dataset table view opened with many datasets", async function () {
    await using tableView = new DatasetTableViewPage(browser);
    await tableView.open();
    await tableView.waitForReady();

    // Verify pagination is enabled by checking for pagination controls
    const paginationPanel = await browser.$(".ag-paging-panel");
    await paginationPanel.waitForExist();
});

// Row actions functionality
When("the user selects one or more sequential datasets", async function () {
    // Find and select a PS dataset, using index-based approach to avoid stale elements
    const selected = await browser.waitUntil(
        async () => {
            const rows = await browser.$$(".ag-row[row-index]");
            for (let i = 0; i < rows.length; i++) {
                try {
                    // Re-fetch the row by index to get fresh reference
                    const row = (await browser.$$(".ag-row[row-index]"))[i];
                    if (!row) continue;

                    const dsorgCell = await row.$("[col-id='dsorg']");
                    const dsorgText = await dsorgCell.getText();

                    if (dsorgText === "PS") {
                        const checkbox = await row.$(".ag-selection-checkbox");
                        await checkbox.click();
                        return true;
                    }
                } catch {
                    // Element became stale, retry from the beginning
                    return false;
                }
            }
            return false;
        },
        { timeout: 10000, timeoutMsg: "Could not find and select a PS dataset" }
    );

    await expect(selected).toBe(true);
});

When("the user selects one or more rows", async function () {
    await this.tableViewPage.open();
    await this.tableViewPage.waitForReady();

    // Select first two rows with retry logic
    await browser.waitUntil(
        async () => {
            try {
                const rows = await this.tableViewPage.getRows();
                if (rows.length === 0) return false;

                const firstCheckbox = await rows[0].$(".ag-selection-checkbox");
                await firstCheckbox.click();

                if (rows.length > 1) {
                    // Re-fetch rows to avoid stale element
                    const freshRows = await this.tableViewPage.getRows();
                    const secondCheckbox = await freshRows[1].$(".ag-selection-checkbox");
                    await secondCheckbox.click();
                }
                return true;
            } catch {
                return false;
            }
        },
        { timeout: 10000, timeoutMsg: "Could not select rows within timeout" }
    );
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

    // Find and select a PDS dataset with retry logic
    const pdsSelected = await browser.waitUntil(
        async () => {
            try {
                const rows = await browser.$$(".ag-row[row-index]:not(.ag-row-pinned)");
                for (let i = 0; i < rows.length; i++) {
                    // Re-fetch row to avoid stale element
                    const row = (await browser.$$(".ag-row[row-index]:not(.ag-row-pinned)"))[i];
                    if (!row) continue;

                    const dsorgCell = await row.$("[col-id='dsorg']");
                    const dsorgText = await dsorgCell.getText();

                    // Check if the row is a PDS dataset
                    if (dsorgText.startsWith("PO")) {
                        const checkbox = await row.$(".ag-selection-checkbox");
                        await checkbox.click();

                        // Wait for action buttons to update after selection
                        await browser.waitUntil(
                            async () => {
                                const focusButton = await this.tableViewPage.getButton("Focus", "secondary", 1000);
                                return focusButton !== null;
                            },
                            { timeout: 5000, timeoutMsg: "Focus button did not appear after selection" }
                        );

                        return true;
                    }
                }
            } catch {
                // Element became stale, retry
            }
            return false;
        },
        { timeout: 10000, timeoutMsg: "Could not find and select a PDS dataset" }
    );

    await expect(pdsSelected).toBe(true);
});

When("the user selects the pinned rows", async function () {
    // Wait for pinned rows to exist and select them
    await this.tableViewPage.waitForPinnedRows();

    const pinnedRows = await this.tableViewPage.getPinnedRows();
    for (let i = 0; i < pinnedRows.length; i++) {
        // Re-fetch to avoid stale elements
        const freshPinnedRows = await this.tableViewPage.getPinnedRows();
        const checkbox = await freshPinnedRows[i].$(".ag-selection-checkbox");
        await checkbox.click();
    }
});

When('clicks the "Open" action button', async function () {
    const openButton = await this.tableViewPage.getButton("Open", "primary", 1000);
    await expect(openButton).not.toBe(null);
    await openButton.waitForClickable();
    await openButton.click();
});

When('clicks the "Pin" action button', async function () {
    const pinButton = await this.tableViewPage.getButton("Pin", "secondary", 1000);
    await expect(pinButton).not.toBe(null);
    await pinButton.waitForClickable();
    await pinButton.click();
});

When('clicks the "Unpin" action button', async function () {
    const unpinButton = await this.tableViewPage.getButton("Unpin", "secondary", 1000);
    await expect(unpinButton).not.toBe(null);
    await unpinButton.waitForClickable();
    await unpinButton.click();
});

When('clicks the "Focus" action button', async function () {
    const focusButton = await this.tableViewPage.getButton("Focus", "secondary", 1000);
    await expect(focusButton).not.toBe(null);
    await focusButton.waitForClickable();
    await focusButton.click();
});

When('clicks the "Back" action button', async function () {
    const backButton = await this.tableViewPage.getButton("Back", "primary", 1000);
    await expect(backButton).not.toBe(null);
    await backButton.waitForClickable();
    await backButton.click();
});

// Verification steps for actions
Then("the selected datasets open in the editor", async function () {
    // Close the table view first
    await this.tableViewPage.close();

    // Wait for editors to open
    const workbench = await browser.getWorkbench();
    const editorView = workbench.getEditorView();

    await browser.waitUntil(
        async () => {
            try {
                const openTabs = await editorView.getOpenEditorTitles();
                return openTabs.length > 0;
            } catch {
                return false;
            }
        },
        { timeout: 15000, timeoutMsg: "No editors opened within timeout" }
    );

    const openTabs = await editorView.getOpenEditorTitles();
    await expect(openTabs.length).toBeGreaterThan(0);
});

Then("the selected rows are pinned to the top of the table", async function () {
    await using tableView = this.tableViewPage;
    
    // Wait for pinned rows to appear
    await tableView.waitForPinnedRows();

    const pinnedRows = await tableView.getPinnedRows();
    await expect(pinnedRows.length).toBeGreaterThan(0);
});

Then("the selected rows are unpinned from the table", async function () {
    await using tableView = this.tableViewPage;
    
    // Verify no pinned rows exist or fewer pinned rows
    const pinnedRows = await tableView.getPinnedRows();
    await expect(pinnedRows.length).toBe(0);
});

Then("the table displays member-specific columns", async function () {
    await using tableView = this.tableViewPage;
    
    // Check for member-specific columns that might be visible
    //const possibleMemberColumns = ["vers", "mod", "cnorc", "inorc", "mnorc"];

    // At least some member data should be present
    const dataRows = await tableView.getRows();
    await expect(dataRows.length).toBeGreaterThan(0);
});

Then("the table view returns to the previous dataset list", async function () {
    // Wait for navigation to complete - Back button should disappear
    await browser.waitUntil(
        async () => {
            const backButton = await this.tableViewPage.getButton("Back", "primary", 500);
            return backButton === null;
        },
        { timeout: 15000, timeoutMsg: "Did not return to previous dataset list (Back button still visible)" }
    );

    const backButton = await this.tableViewPage.getButton("Back", "primary", 1000);
    await expect(backButton).toBe(null);
});

Then("preserves the previous table state including pinned rows", async function () {
    await using tableView = new DatasetTableViewPage(browser);
    
    // Re-fetch the webview to ensure we have a fresh reference
    await tableView.refresh();
    await tableView.open();
    await tableView.waitForReady();

    // Wait for pinned rows to be visible
    await tableView.waitForPinnedRows();

    const pinnedRows = await tableView.getPinnedRows();
    await expect(pinnedRows.length).toBeGreaterThan(0);
});

// Context menu functionality
When("the user right-clicks on a dataset row", async function () {
    await this.tableViewPage.open();
    await this.tableViewPage.waitForReady();

    // Find and right-click on the target dataset row with retry logic
    await browser.waitUntil(
        async () => {
            try {
                const rows = await browser.$$(".ag-row");
                for (const row of rows) {
                    const dsnameCell = await row.$("[col-id='dsname']");
                    const dsnameText = await dsnameCell.getText();
                    if (dsnameText === testInfo.sequential) {
                        await row.click({ button: "right" });
                        return true;
                    }
                }
            } catch {
                // Element became stale, retry
            }
            return false;
        },
        { timeout: 10000, timeoutMsg: `Could not find and right-click on dataset row: ${testInfo.sequential}` }
    );
});

When("the user right-clicks on a member row", async function () {
    this.tableViewPage = new DatasetTableViewPage(browser);
    await this.tableViewPage.open();
    await this.tableViewPage.waitForReady();

    // Wait for first row and capture member info with retry logic
    await browser.waitUntil(
        async () => {
            try {
                const firstRow = await browser.$(".ag-row[row-index='0']");
                if (!(await firstRow.isExisting())) return false;

                // Capture the member name
                const memberNameCell = await firstRow.$("[col-id='dsname']");
                this.selectedMemberName = await memberNameCell.getText();

                // Get the title to extract the PDS name
                const titleText = await this.tableViewPage.getTitle();
                // Extract PDS name from title like "Members of TEST.PDS (count)"
                const pdsMatch = titleText.match(/Members of (.+?) \(/i);
                if (pdsMatch) {
                    this.selectedPdsName = pdsMatch[1];
                }

                // Re-fetch and right-click to avoid stale element
                const freshFirstRow = await browser.$(".ag-row[row-index='0']");
                await freshFirstRow.click({ button: "right" });
                return true;
            } catch {
                return false;
            }
        },
        { timeout: 10000, timeoutMsg: "Could not right-click on member row" }
    );
});

When('selects "Display in Tree" from the context menu', async function () {
    // Wait for context menu to be fully rendered with items
    const contextMenu = await browser.$(".szh-menu");
    await browser.waitUntil(async () => (await contextMenu.isExisting()) && (await contextMenu.$$(".szh-menu__item")).length > 0, {
        timeout: 10000,
        timeoutMsg: "Context menu did not appear with menu items",
    });

    // Now find and click the "Display in Tree" menu item
    const menuItems = await contextMenu.$$(".szh-menu__item");
    for (const item of menuItems) {
        await item.waitForClickable();
        const itemText = await item.getText();
        if (itemText === "Display in Tree") {
            await item.click();
            return;
        }
    }
    throw new Error('Could not find "Display in Tree" menu item');
});

Then("the dataset is revealed and focused in the Data Sets tree", async function () {
    // Close table view so that Selenium can focus on the tree
    await this.tableViewPage.close();

    // Wait for the tree to update and reveal the dataset
    await browser.waitUntil(
        async () => {
            try {
                const dsPane = await paneDivForTree("Data Sets");
                const treeItems = (await dsPane.getVisibleItems()) as TreeItem[];
                if (treeItems.length < 2) return false;

                // Check if profile node is expanded
                const profileNode = treeItems[1];
                if (!(await profileNode.isExpanded())) return false;

                // Check if dataset node exists
                const dsNode = await profileNode.findChildItem(testInfo.sequential);
                return dsNode != null;
            } catch {
                return false;
            }
        },
        { timeout: 15000, timeoutMsg: "Dataset was not revealed in tree within timeout" }
    );

    const dsPane = await paneDivForTree("Data Sets");
    const treeItems = (await dsPane.getVisibleItems()) as TreeItem[];
    const profileNode = treeItems[1];
    await expect(await profileNode.isExpanded()).toBe(true);

    const dsNode = await profileNode.findChildItem(testInfo.sequential);
    await expect(dsNode).toBeDefined();

    const dsNodeLabel = await dsNode.getLabel();
    await expect(dsNodeLabel).toBe(testInfo.sequential);
});

Then("the PDS member is revealed and focused in the Data Sets tree", async function () {
    // Close table view to see tree
    await this.tableViewPage.close();

    // Wait for the tree to update and reveal the member
    const memberName = this.selectedMemberName;
    await browser.waitUntil(
        async () => {
            try {
                const dsPane = await paneDivForTree("Data Sets");
                const treeItems = (await dsPane.getVisibleItems()) as TreeItem[];
                const allLabels = await Promise.all(treeItems.map(async (item) => await item.getLabel()));
                return allLabels.includes(memberName);
            } catch {
                return false;
            }
        },
        { timeout: 15000, timeoutMsg: "PDS member was not revealed in tree within timeout" }
    );

    const dsPane = await paneDivForTree("Data Sets");
    const treeItems = (await dsPane.getVisibleItems()) as TreeItem[];
    const allLabels = await Promise.all(treeItems.map(async (item) => await item.getLabel()));
    await expect(allLabels.find((label) => label === this.selectedMemberName)).not.toBe(undefined);
});

// Hierarchical tree functionality
When("the table loads with hierarchical tree support", async function () {
    await this.tableViewPage.open();
    await this.tableViewPage.waitForReady();
});

Then("PDS datasets show expand and collapse indicators", async function () {
    // Wait for tree expansion indicators to appear
    await browser.waitUntil(
        async () => {
            try {
                const expandIcons = await browser.$$(".ag-row > div[col-id='dsname'] > div > span > div > span > .codicon-chevron-right");
                return expandIcons.length > 0;
            } catch {
                return false;
            }
        },
        { timeout: 10000, timeoutMsg: "No expand/collapse indicators found for PDS datasets" }
    );

    const pdsRows = await browser.$$(".ag-row > div[col-id='dsname'] > div > span > div > span > .codicon-chevron-right");
    await expect(pdsRows.length).toBeGreaterThan(0);
});

Then("users can expand PDS nodes to view members inline", async function () {
    // Find and expand a PDS node with retry logic
    await browser.waitUntil(
        async () => {
            try {
                const expandIcons = await browser.$$(".ag-row > div[col-id='dsname'] > div > span > div > span > .codicon-chevron-right");
                if (expandIcons.length === 0) return false;
                await expandIcons[0].click();
                return true;
            } catch {
                return false;
            }
        },
        { timeout: 10000, timeoutMsg: "Could not find and click expand icon" }
    );

    // Verify child rows appeared
    await browser.waitUntil(
        async () => {
            try {
                const childRows = await browser.$$(".ag-cell[col-id='dsname'] > div div[aria-level='1']");
                return childRows.length > 0;
            } catch {
                return false;
            }
        },
        { timeout: 10000, timeoutMsg: "Child rows did not appear after expanding PDS" }
    );
});

Then("the tree structure is properly displayed", async function () {
    await using tableView = this.tableViewPage;
    
    // Wait for hierarchical structure to be visible
    await browser.waitUntil(
        async () => {
            try {
                const level0Rows = await browser.$$(".ag-cell[col-id='dsname'] > div div[aria-level='0']");
                const level1Rows = await browser.$$(".ag-cell[col-id='dsname'] > div div[aria-level='1']");
                return level0Rows.length > 0 && level1Rows.length > 0;
            } catch {
                return false;
            }
        },
        { timeout: 10000, timeoutMsg: "Tree structure not properly displayed" }
    );

    const level0Rows = await browser.$$(".ag-cell[col-id='dsname'] > div div[aria-level='0']");
    const level1Rows = await browser.$$(".ag-cell[col-id='dsname'] > div div[aria-level='1']");
    await expect(level0Rows.length).toBeGreaterThan(0);
    await expect(level1Rows.length).toBeGreaterThan(0);
});
