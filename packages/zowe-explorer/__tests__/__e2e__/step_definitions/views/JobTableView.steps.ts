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

When('the user right-clicks on the jobs profile and selects "Show as Table"', async function () {
    this.workbench = await browser.getWorkbench();

    const ctxMenu: ContextMenu = await this.profileNode.openContextMenu();
    await ctxMenu.wait();

    const showAsTableItem = await ctxMenu.getItem("Show as Table");
    await (await showAsTableItem.elem).click();
});

Then("the table view appears in the Zowe Resources panel", async function () {
    this.tableView = (await this.workbench.getAllWebviews())[0];
    await this.tableView.wait();

    await this.tableView.open();
    const tableViewDiv = await browser.$(".table-view");
    await tableViewDiv.waitForExist();
    await this.tableView.close();
});

Given("a user who has the jobs table view opened", async function () {
    this.tableView = (await (await browser.getWorkbench()).getAllWebviews())[0];
    await this.tableView.wait();
});

When("the user clicks on the Gear icon in the table view", async function () {
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
