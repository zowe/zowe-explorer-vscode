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

// ==================== Test Configuration ====================

const testInfo = {
    profileName: process.env.ZE_TEST_PROFILE_NAME,
    dsFilter: process.env.ZE_TEST_DS_FILTER,
    pds: process.env.ZE_TEST_PDS,
    sequential: process.env.ZE_TEST_PS,
    testPattern: process.env.ZE_TEST_DS_PATTERN,
};

// ==================== Helper Functions ====================

/**
 * Gets or creates a page object instance for the current scenario.
 * Ensures consistent page object usage across steps.
 */
function getTableViewPage(world: any): DatasetTableViewPage {
    if (!world.tableViewPage) {
        world.tableViewPage = new DatasetTableViewPage(browser);
    }
    return world.tableViewPage;
}

/**
 * Opens the table view and waits for it to be ready.
 * Clears any existing column filter to ensure a clean state.
 */
async function openAndWaitForTable(world: any): Promise<DatasetTableViewPage> {
    const page = getTableViewPage(world);
    await page.open();
    await page.waitForReady();
    await page.clearColumnFilter();

    return page;
}

// ==================== Table View Setup Steps ====================

When('the user right-clicks on the dataset profile and selects "Show as Table"', async function () {
    // Reset page object state since we're opening a new/different table view
    this.tableViewPage = null;
    await clickContextMenuItem(await this.profileNode.find(), "Show as Table");
});

When('the user right-clicks on a PDS and selects "Show as Table"', async function () {
    // Reset page object state since we're opening a new/different table view
    this.tableViewPage = null;

    this.pdsNode = await (await this.profileNode.find()).findChildItem(testInfo.pds);
    await expect(this.pdsNode).toBeDefined();
    await clickContextMenuItem(this.pdsNode, "Show as Table");
});

Then("the dataset table view appears in the Zowe Resources panel", async function () {
    // Create a fresh page object to ensure we get the current webview frame
    const page = getTableViewPage(this);

    // The open() method includes verification that .table-view exists and will retry
    // until the webview is fully loaded. No additional check needed - if open() succeeds,
    // the table view is confirmed to exist.
    await page.open();
});

// ==================== Table Content Verification Steps ====================

Then("the table displays dataset information with appropriate columns", async function () {
    const page = await openAndWaitForTable(this);

    const expectedColumns = [
        { name: "Data Set Name", id: "dsname" },
        { name: "Data Set Organization", id: "dsorg" },
    ];

    for (const column of expectedColumns) {
        await page.verifyColumnExists(column.id);
    }

    const dataRows = await page.getRows();
    await expect(dataRows.length).toBeGreaterThan(0);
});

Then("the table displays PDS member names", async function () {
    await browser.pause(100); // Kind of random, but just wait for the table to be ready
    const page = await openAndWaitForTable(this);
    await page.verifyColumnExists("dsname");

    const dataRows = await page.getRows();
    await expect(dataRows.length).toBeGreaterThan(0);
});

Then("the table displays datasets matching the pattern", async function () {
    const page = await openAndWaitForTable(this);
    const dataRows = await page.getRows();
    await expect(dataRows.length).toBeGreaterThan(0);
});

Then("the table displays member-specific columns", async function () {
    const page = await openAndWaitForTable(this);
    const dataRows = await page.getRows();
    await expect(dataRows.length).toBeGreaterThan(0);
});

// ==================== Command Palette Steps ====================

When('the user opens the command palette and runs "List Data Sets" command', async function () {
    await browser.executeWorkbench((vscode) => {
        void vscode.commands.executeCommand("zowe.ds.listDataSets");
    });

    await browser.waitUntil(
        async () => {
            const quickPickItems = await browser.$$(".quick-input-list .quick-input-list-entry");
            return quickPickItems.length > 0;
        },
        { timeout: 10000, timeoutMsg: "Quick pick did not appear after running command" }
    );
});

When("enters a valid profile and dataset pattern", async function () {
    await browser.waitUntil(
        async () => {
            const quickPickItems = await browser.$$(".quick-input-list .quick-input-list-entry");
            return quickPickItems.length > 0;
        },
        { timeout: 10000, timeoutMsg: "Profile selection quick pick did not appear within timeout" }
    );

    // Select profile
    if (testInfo.profileName) {
        const profilePick = await quickPick.findItem(testInfo.profileName);
        await profilePick.waitForDisplayed();
        await profilePick.click();
    } else {
        await browser.keys([Key.Enter]);
    }

    // Wait for dataset pattern input
    let inputBox: WebdriverIO.Element;
    await browser.waitUntil(
        async () => {
            inputBox = await browser.$(".quick-input-box input");
            return inputBox.isClickable();
        },
        { timeout: 10000, timeoutMsg: "Dataset pattern input did not appear within timeout" }
    );

    // Enter pattern and submit
    const pattern = testInfo.testPattern || testInfo.dsFilter || "*.DATASET";
    await inputBox.click();
    await inputBox.setValue(pattern);
    await browser.keys([Key.Enter]);
});

// ==================== Table View State Setup (Given steps) ====================

Given("a user who has the dataset table view opened", function () {
    this.tableViewPage = new DatasetTableViewPage(browser);
});

Given("a user who has the dataset table view opened with PS datasets", async function () {
    const page = await openAndWaitForTable(this);
    // Ensure we're in dataset list view (not members view from previous scenario)
    await page.ensureDatasetListView();
    // Apply column filter to show only the target PS dataset
    if (testInfo.sequential) {
        await page.setColumnFilter(testInfo.sequential);
    }

    await page.waitForDsorgType("PS");
});

Given("a user who has the dataset table view opened with PDS datasets", async function () {
    const page = await openAndWaitForTable(this);
    // Ensure we're in dataset list view (not members view from previous scenario)
    await page.ensureDatasetListView();
    // Apply column filter to show only the target PDS dataset
    if (testInfo.pds) {
        await page.setColumnFilter(testInfo.pds);
    }

    await page.waitForDsorgType(/^PO/);
});

Given("a user who has the dataset table view opened with mixed dataset types", function () {
    this.tableViewPage = new DatasetTableViewPage(browser);
});

Given("a user who has focused on a PDS and is viewing its members", async function () {
    const page = await openAndWaitForTable(this);
    await page.waitForMembersView();
});

Given("a user who has the dataset table view opened with PDS members", async function () {
    await openAndWaitForTable(this);
});

Given("a user who has the dataset table view opened with many datasets", async function () {
    const page = await openAndWaitForTable(this);
    const paginationPanel = await page.paginationPanel;
    await paginationPanel.waitForExist();
});

// ==================== Row Selection Steps ====================

When("the user selects one or more sequential datasets", async function () {
    const page = getTableViewPage(this);
    const selected = await page.selectRow(/^PS/, testInfo.sequential);
    await expect(selected).toBe(true);
});

When("the user selects one or more rows", async function () {
    const page = await openAndWaitForTable(this);

    // Clear any existing selections first to ensure consistent state
    await page.clearSelections();

    // Wait for rows to be available
    await browser.waitUntil(
        async () => {
            const rows = await page.getRows();
            return rows.length > 0;
        },
        { timeout: 10000, timeoutMsg: "No rows available to select" }
    );

    // Select rows without retry loop - each selectRowByIndex has its own retry logic
    await page.selectRowByIndex(0);
    const rows = await page.getRows();
    if (rows.length > 1) {
        await page.selectRowByIndex(1);
    }
});

When("the user selects a PDS dataset", async function () {
    const page = getTableViewPage(this);

    // Clear filter first to show all rows, then clear selections to deselect any hidden rows
    await page.clearColumnFilter();
    await browser.pause(500); // Wait for all rows to be visible
    await page.clearSelections();

    // Reapply filter for PDS and wait for UI to settle
    if (testInfo.pds) {
        await page.setColumnFilter(testInfo.pds);
    }
    await browser.pause(300);

    const pdsSelected = await page.selectRow(/^PO/, testInfo.pds);
    await expect(pdsSelected).toBe(true);

    // Wait for Focus button to appear after selection
    await browser.waitUntil(
        async () => {
            const focusButton = await page.getButton("Focus", "secondary", 1000);
            return focusButton !== null;
        },
        { timeout: 5000, timeoutMsg: "Focus button did not appear after selection" }
    );
});

When("the user selects the pinned rows", async function () {
    const page = getTableViewPage(this);
    await page.waitForPinnedRows();

    const pinnedRows = await page.getPinnedRows();
    for (let i = 0; i < pinnedRows.length; i++) {
        const freshPinnedRows = await page.getPinnedRows();
        const checkbox = await freshPinnedRows[i].$(".ag-selection-checkbox");
        await checkbox.click();
    }
});

// ==================== Action Button Steps ====================

When('clicks the "Open" action button', async function () {
    const page = getTableViewPage(this);
    await page.clickButton("Open", "primary");
});

When('clicks the "Pin" action button', async function () {
    const page = getTableViewPage(this);
    await page.clickButton("Pin", "secondary");
});

When('clicks the "Unpin" action button', async function () {
    const page = getTableViewPage(this);
    await page.clickButton("Unpin", "secondary");
});

When('clicks the "Focus" action button', async function () {
    const page = getTableViewPage(this);
    await page.clickButton("Focus", "secondary");
    // Wait for the view to transition to members view after Focus click
    await page.waitForMembersView();
});

When('clicks the "Back" action button', async function () {
    const page = getTableViewPage(this);
    await page.clickButton("Back", "primary");
});

When('the user clicks the "Back" action button', async function () {
    const page = getTableViewPage(this);
    await page.clickButton("Back", "primary");
});

// ==================== Action Result Verification Steps ====================

Then("the selected datasets open in the editor", async function () {
    const page = getTableViewPage(this);
    await page.close();

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
    const page = getTableViewPage(this);
    await page.waitForPinnedRows();

    const pinnedRows = await page.getPinnedRows();
    await expect(pinnedRows.length).toBeGreaterThan(0);
});

Then("the selected rows are unpinned from the table", async function () {
    const page = getTableViewPage(this);
    const pinnedRows = await page.getPinnedRows();
    await expect(pinnedRows.length).toBe(0);
});

Then("the table view returns to the previous dataset list", async function () {
    const page = getTableViewPage(this);

    await browser.waitUntil(
        async () => {
            const backButton = await page.getButton("Back", "primary", 500);
            return backButton === null;
        },
        { timeout: 15000, timeoutMsg: "Did not return to previous dataset list (Back button still visible)" }
    );

    const backButton = await page.getButton("Back", "primary", 1000);
    await expect(backButton).toBe(null);
});

Then("preserves the previous table state including pinned rows", async function () {
    const page = getTableViewPage(this);
    await page.refresh();
    await page.open();
    await page.waitForReady();
    await page.waitForPinnedRows();

    const pinnedRows = await page.getPinnedRows();
    await expect(pinnedRows.length).toBeGreaterThan(0);
});

// ==================== Context Menu Steps ====================

When("the user right-clicks on a dataset row", async function () {
    const page = await openAndWaitForTable(this);
    await page.rightClickRowByDsname(testInfo.sequential);
});

When("the user right-clicks on a member row", async function () {
    const page = await openAndWaitForTable(this);

    await browser.waitUntil(
        async () => {
            try {
                const firstRow = await page.rowByIndex(0);
                if (!(await firstRow.isExisting())) return false;

                // Capture member name
                const memberNameCell = await firstRow.$("[col-id='dsname']");
                this.selectedMemberName = await memberNameCell.getText();

                // Extract PDS name from title
                const titleText = await page.getTitle();
                const pdsMatch = titleText.match(/Members of (.+?) \(/i);
                if (pdsMatch) {
                    this.selectedPdsName = pdsMatch[1];
                }

                // Re-fetch and right-click to avoid stale element
                const freshFirstRow = await page.rowByIndex(0);
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
    const page = getTableViewPage(this);
    await page.clickContextMenuItem("Display in Tree");
});

Then("the dataset is revealed and focused in the Data Sets tree", async function () {
    const page = getTableViewPage(this);
    await page.close();

    await browser.waitUntil(
        async () => {
            try {
                const dsPane = await paneDivForTree("Data Sets");
                const treeItems = (await dsPane.getVisibleItems()) as TreeItem[];
                if (treeItems.length < 2) return false;

                const profileNode = treeItems[1];
                if (!(await profileNode.isExpanded())) return false;

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
    const page = getTableViewPage(this);
    await page.close();

    const memberName = this.selectedMemberName;
    await browser.waitUntil(
        async () => {
            try {
                const dsPane = await paneDivForTree("Data Sets");
                const treeItems = (await dsPane.getVisibleItems()) as TreeItem[];
                const allLabels = await Promise.all(treeItems.map(async (item) => item.getLabel()));
                return allLabels.includes(memberName);
            } catch {
                return false;
            }
        },
        { timeout: 15000, timeoutMsg: "PDS member was not revealed in tree within timeout" }
    );

    const dsPane = await paneDivForTree("Data Sets");
    const treeItems = (await dsPane.getVisibleItems()) as TreeItem[];
    const allLabels = await Promise.all(treeItems.map(async (item) => item.getLabel()));
    await expect(allLabels.find((label) => label === this.selectedMemberName)).not.toBe(undefined);
    await ((await dsPane.findItem(testInfo.pds)) as TreeItem).collapse();
});

// ==================== Hierarchical Tree Steps ====================

When("the table loads with hierarchical tree support", async function () {
    await openAndWaitForTable(this);
});

Then("PDS datasets show expand and collapse indicators", async function () {
    const page = getTableViewPage(this);

    await browser.waitUntil(
        async () => {
            try {
                const expandIcons = await page.expandIcons;
                return expandIcons.length > 0;
            } catch {
                return false;
            }
        },
        { timeout: 10000, timeoutMsg: "No expand/collapse indicators found for PDS datasets" }
    );

    const pdsRows = await page.expandIcons;
    await expect(pdsRows.length).toBeGreaterThan(0);
});

Then("users can expand PDS nodes to view members inline", async function () {
    const page = getTableViewPage(this);
    await page.expandFirstPds();
    await page.waitForChildRows();
});

Then("the tree structure is properly displayed", async function () {
    const page = getTableViewPage(this);
    const { level0Count, level1Count } = await page.verifyTreeStructure();

    await expect(level0Count).toBeGreaterThan(0);
    await expect(level1Count).toBeGreaterThan(0);
});
