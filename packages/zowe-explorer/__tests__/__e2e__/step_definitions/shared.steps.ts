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
import { getZoweExplorerContainer } from "../../__common__/shared.wdio";

Given("a user who is looking at the Zowe Explorer tree views", async () => {
    const zeContainer = await getZoweExplorerContainer();
    const zeView = await zeContainer.openView();
    await expect(zeView).toBeDefined();
    await expect(zeView.elem).toBeDisplayedInViewport();
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
    this.colSelectorMenu.waitForExist();
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
