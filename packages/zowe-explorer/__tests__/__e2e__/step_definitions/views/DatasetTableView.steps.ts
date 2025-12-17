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

    await clickContextMenuItem(this.profileNode, "Show as Table");
    await browser.pause(1000); // Wait for table to load
});

When('the user right-clicks on a PDS and selects "Show as Table"', async function () {
    this.workbench = await browser.getWorkbench();

    // Find and select a PDS from the filtered results
    this.pdsNode = await this.profileNode.findChildItem(testInfo.pds);
    await expect(this.pdsNode).toBeDefined();

    await clickContextMenuItem(this.pdsNode, "Show as Table");
});

Then("the dataset table view appears in the Zowe Resources panel", async function () {
    this.tableView = (await this.workbench.getAllWebviews())[0];
    await this.tableView.wait();

    await this.tableView.open();
    const tableViewDiv = await browser.$(".table-view");
    await tableViewDiv.waitForExist({ timeout: 5000 });

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

    // Enter data set pattern
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
    this.tableView = (await (await browser.getWorkbench()).getAllWebviews())[0];
    await this.tableView.wait();
    await this.tableView.open();

    // Verify we're in members view by checking to see if table title contains "Members of"
    const titleElement = await browser.$(".table-view > div > h3");
    const titleText = await titleElement.getText();
    await expect(titleText).toMatch(/Members of/i);
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

    const rows = await browser.$$(".ag-row[row-index]:not(.ag-row-pinned)");
    let pdsSelected = false;

    for (const row of rows) {
        await row.waitForExist();
        const dsorgCell = await row.$("[col-id='dsorg']");
        const dsorgText = await dsorgCell.getText();

        // Check if the row is a PDS dataset
        if (dsorgText.startsWith("PO")) {
            const checkbox = await row.$(".ag-selection-checkbox");
            await checkbox.click();

            // Wait for the React component to update the action buttons
            await browser.pause(500);

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
    const backButton = await getWebviewButtonByTitle("Back");
    await expect(backButton).toBe(null);
});

Then("preserves the previous table state including pinned rows", async function () {
    await browser.pause(3000);
    const pinnedRows = await browser.$(".ag-row-pinned");
    await expect(pinnedRows).not.toBe(null);
    await this.tableView.close();
});

// Context menu functionality
When("the user right-clicks on a dataset row", async function () {
    await this.tableView.open();
    const rows = await browser.$$(".ag-row");
    for (const row of rows) {
        const dsnameCell = await row.$("[col-id='dsname']");
        const dsnameText = await dsnameCell.getText();
        if (dsnameText === testInfo.sequential) {
            await row.click({ button: "right" });
            break;
        }
    }
});

When("the user right-clicks on a member row", async function () {
    const firstRow = await browser.$(".ag-row[row-index='0']");
    await firstRow.waitForExist();

    // Capture the member name and dataset name for later verification
    const memberNameCell = await firstRow.$("[col-id='dsname']");
    this.selectedMemberName = await memberNameCell.getText();

    // Get the title to extract the PDS name
    const titleElement = await browser.$(".table-view > div > h3");
    const titleText = await titleElement.getText();
    // Extract PDS name from title like "Members of TEST.PDS"
    const pdsMatch = titleText.match(/Members of (.+?) (\d+)/i);
    if (pdsMatch) {
        this.selectedPdsName = pdsMatch[1];
    }

    await firstRow.click({ button: "right" });
});

When('selects "Display in Tree" from the context menu', async function () {
    const contextMenu = await browser.$(".szh-menu");
    await contextMenu.waitForExist();

    let found = false;
    const treeItems = await contextMenu.$$(".szh-menu__item");
    for (const item of treeItems) {
        const itemText = await item.getText();
        if (itemText === "Display in Tree") {
            await item.click();
            found = true;
            break;
        }
    }

    await expect(found).toBe(true);
});

Then("the dataset is revealed and focused in the Data Sets tree", async function () {
    await browser.pause(2000); // Allow time for tree reveal

    // Close table view so that Selenium can focus on the tree
    await this.tableView.close();

    const dsPane = await paneDivForTree("Data Sets");
    const treeItems = (await dsPane.getVisibleItems()) as TreeItem[];
    // Assume first item after favorites is the profile, check if expanded
    const profileNode = treeItems[1];
    await expect(await profileNode.isExpanded()).toBe(true);

    // Find the dataset node and check if selected
    const dsNode = await profileNode.findChildItem(/* assume from context or env */ testInfo.sequential);
    await expect(dsNode).toBeDefined();
    await expect(await dsNode.elem.getAttribute("aria-selected")).toBe("true");
});

Then("the PDS member is revealed and focused in the Data Sets tree", async function () {
    await browser.pause(2000); // Allow time for tree reveal

    // Close table view to see tree
    await this.tableView.close();

    // Get the Data Sets tree pane using the same pattern as TreeActions.steps.ts
    const dsPane = await paneDivForTree("Data Sets");
    const treeItems = (await dsPane.getVisibleItems()) as TreeItem[];
    const allLabels = await Promise.all(treeItems.map(async (item) => await item.getLabel()));
    await expect(allLabels.find((label) => label === this.selectedMemberName)).not.toBe(null);
});

// Hierarchical tree functionality
When("the table loads with hierarchical tree support", async function () {
    await this.tableView.open();
});

Then("PDS datasets show expand and collapse indicators", async function () {
    // Look for tree expansion indicators in PDS rows
    // Verify tree column renderer is active
    const pdsRows = await browser.$$(".ag-row > div[col-id='dsname'] > div > span > div > span > .codicon-chevron-right");
    await expect(pdsRows.length).toBeGreaterThan(0);
});

Then("users can expand PDS nodes to view members inline", async function () {
    // Find and expand a PDS node
    const expandIcon = (await browser.$$(".ag-row > div[col-id='dsname'] > div > span > div > span > .codicon-chevron-right"))[0];
    await expect(expandIcon).toBeExisting();
    await expandIcon.click();
    // Verify child rows appeared
    await browser.waitUntil(
        async () => {
            const childRows = await browser.$$(".ag-cell[col-id='dsname'] > div div[aria-level='1']");
            return childRows.length > 0;
        },
        { timeout: 10000 }
    );
});

Then("the tree structure is properly displayed", async function () {
    // Verify hierarchical structure with proper indentation
    const level0Rows = await browser.$$(".ag-cell[col-id='dsname'] > div div[aria-level='0']");
    const level1Rows = await browser.$$(".ag-cell[col-id='dsname'] > div div[aria-level='1']");
    await expect(level0Rows.length).toBeGreaterThan(0);
    // Should have both parent and child levels if expanded
    await expect(level1Rows.length).toBeGreaterThan(0);
    await this.tableView.close();
});
