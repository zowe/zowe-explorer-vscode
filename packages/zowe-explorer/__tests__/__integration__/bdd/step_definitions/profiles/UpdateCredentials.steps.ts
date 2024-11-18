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

import * as fs from "fs";
import * as path from "path";
import { AfterAll, Then, When } from "@cucumber/cucumber";
import { paneDivForTree } from "../../../../__common__/shared.wdio";
import quickPick from "../../../../__pageobjects__/QuickPick";
import { Key } from "webdriverio";
import { TreeItem } from "wdio-vscode-service";

const USER_CONFIG_FILE = path.join(process.env.ZOWE_CLI_HOME, "zowe.config.user.json");

AfterAll(() => {
    fs.rmSync(USER_CONFIG_FILE, { force: true });
});
When(/a user who has profile with (.*) auth in team config/, function (authType: string) {
    // TODO: We need to copy from Global Config until Imperative API is fixed
    // See https://github.com/zowe/zowe-cli/issues/2273
    this.authType = authType;
    const testConfig = JSON.parse(fs.readFileSync(USER_CONFIG_FILE.replace(".user", ""), "utf-8"));
    testConfig.profile[`zosmf_${authType}`] = {
        type: "zosmf",
        properties: {},
        secure: authType === "basic" ? ["user", "password"] : ["tokenValue"],
    };
    fs.writeFileSync(USER_CONFIG_FILE, JSON.stringify(testConfig, null, 2));
});
When("the user has a profile in their Data Sets tree", async function () {
    // add profile via quick pick
    this.treePane = await paneDivForTree("Data Sets");
    await this.treePane.elem.moveTo();
    const plusIcon = await this.treePane.getAction(`Add Profile to Data Sets View`);
    await expect(plusIcon).toBeDefined();
    await plusIcon.elem.click();
    await browser.waitUntil((): Promise<boolean> => quickPick.isClickable());
    const firstProfileEntry = await quickPick.findItemByIndex(2);
    await expect(firstProfileEntry).toBeClickable();
    await firstProfileEntry.click();
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
