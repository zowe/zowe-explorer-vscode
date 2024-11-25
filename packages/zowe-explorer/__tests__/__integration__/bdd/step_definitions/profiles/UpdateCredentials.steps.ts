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
import { paneDivForTree } from "../../../../__common__/shared.wdio";
import quickPick from "../../../../__pageobjects__/QuickPick";
import { Key } from "webdriverio";
import { TreeItem } from "wdio-vscode-service";

When(/the user has a (.*) profile in their Data Sets tree/, async function (authType: string) {
    this.authType = authType;
    // add profile via quick pick
    this.treePane = await paneDivForTree("Data Sets");
    await this.treePane.elem.moveTo();
    const plusIcon = await this.treePane.getAction(`Add Profile to Data Sets View`);
    await expect(plusIcon).toBeDefined();
    await plusIcon.elem.click();
    await browser.waitUntil((): Promise<boolean> => quickPick.isClickable());
    const testProfileEntry = await quickPick.findItem(`$(home) zosmf_${this.authType as string}`);
    await expect(testProfileEntry).toBeClickable();
    await testProfileEntry.click();
    this.yesOpt = await quickPick.findItem("Yes, Apply to all trees");
    await expect(this.yesOpt).toBeClickable();
    await this.yesOpt.click();
    this.profileNode = (await this.treePane.findItem(`zosmf_${this.authType as string}`)) as TreeItem;
});
When("a user clicks search button for the profile", async function () {
    await this.profileNode.elem.moveTo();
    const actionButtons = await this.profileNode.getActionButtons();

    // Locate and select the search button on the profile node
    const searchButton = actionButtons[actionButtons.length - 1];
    await searchButton.wait();
    await expect(searchButton.elem).toBeDefined();
    await searchButton.elem.click();
});
Then(/the user will be prompted for (.*) credentials/, async function (authType: string) {
    if (authType === "basic") {
        const inputBox = await $('.input[aria-describedby="quickInput_message"]');
        await expect(inputBox).toBeClickable();
    } else if (authType === "token") {
        await browser.waitUntil((): Promise<boolean> => quickPick.isClickable());
        const userPasswordItem = await quickPick.findItemByIndex(0);
        await expect(userPasswordItem).toBeClickable();
    }
    await browser.keys(Key.Escape);
});
Then("the profile node icon will be marked as inactive", async function () {
    const iconElement = await this.profileNode.elem.$(".custom-view-tree-node-item-icon");
    const iconPath = (await iconElement.getCSSProperty("background-image")).value;
    await expect(iconPath).toContain("folder-root-disconnected-closed.svg");
});
