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

import { Then, When } from "@cucumber/cucumber";

When(/a user selects (.*) from the command palette/, async function (command: string) {
    this.input = await (await browser.getWorkbench()).executeQuickPick(`Zowe Explorer: ${command}`);
    this.openedCommand = command;
});
Then("a quick pick appears to select a profile", async function () {
    await expect(this.input.elem).toBeDisplayedInViewport();
});
When("a user selects a profile", async function () {
    await expect(this.input).toBeDefined();
    let qpItems = await this.input.getQuickPicks();
    await qpItems.at(0).select();
    await expect(this.input.elem).toBeDisplayedInViewport();

    // Issue TSO command has an extra quick pick to select from
    if (this.openedCommand === "Issue TSO Command") {
        qpItems = await this.input.getQuickPicks();
        await qpItems.at(0).select();
    }
});

// TODO: Handle profiles that do not yet have credentials stored or are unverified
Then(/a user can enter in (.*) as the command and submit it/, async function (command: string) {
    if (this.openedCommand === "Issue TSO Command") {
        await this.input.setText("IZUACCT");
        await this.input.confirm();
    }
    await this.input.setText(command);
    await this.input.confirm();
});
