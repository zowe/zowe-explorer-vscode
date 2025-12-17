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
import { clickContextMenuItem } from "../../../__common__/shared.wdio";

When('the user right-clicks on the jobs profile and selects "Show as Table"', async function () {
    this.workbench = await browser.getWorkbench();

    await clickContextMenuItem(await this.helpers.getProfileNode(), "Show as Table");
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
