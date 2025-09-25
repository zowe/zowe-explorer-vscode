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

import { When, Then } from "@cucumber/cucumber";
import { Key } from "webdriverio";
import * as fs from "fs";
import * as path from "path";

When("a user right clicks a configuration tab and clicks open file", async () => {
    // Target the global team config tab (zowe.config.json) specifically
    const tab = await browser.$(`[id="global:true,user:false"]`);
    await tab.waitForExist({ timeout: 1000 });
    await tab.click({ button: "right" });

    const openFile = await browser.$(`[id="tab-open-file"]`);
    await openFile.waitForExist({ timeout: 1000 });
    await openFile.click({ button: "left" });
});

When("a user right clicks a configuration tab and clicks open schema", async () => {
    // Target the global team config tab (zowe.config.json) specifically
    const tab = await browser.$(`[id="global:true,user:false"]`);
    await tab.waitForExist({ timeout: 1000 });
    await tab.click({ button: "right" });

    const openFile = await browser.$(`[id="tab-open-schema"]`);
    await openFile.waitForExist({ timeout: 1000 });
    await openFile.click({ button: "left" });
});

When("a user clicks the add configuration layer button", async () => {
    const addConfigButton = await browser.$(`[id="add-config-layer-button"]`);
    await addConfigButton.waitForExist({ timeout: 1000 });
    await addConfigButton.click({ button: "left" });
    const addGlobalUserConfig = await browser.$(`[id="global:true,user:true"]`);
    await addGlobalUserConfig.waitForExist({ timeout: 1000 });
    await addGlobalUserConfig.click({ button: "left" });
});

Then("a new file should be opened", async () => {
    const editorTabs = await browser.$$(".tab");
    await expect(editorTabs.length).toBe(2);
});
Then("close the current tab", async () => {
    await browser.pause(500);
    await browser.keys([Key.Ctrl, "w"]);
});

When("a user right clicks a configuration tab and clicks toggle autostore", async () => {
    const tab = await browser.$(`.tab`);
    await tab.waitForExist({ timeout: 1000 });
    await tab.click({ button: "right" });

    const openFile = await browser.$(`[id="tab-toggle-autostore"]`);

    await openFile.waitForExist({ timeout: 5000 });
    await openFile.click({ button: "left" });
    browser.keys(Key.Escape);
});

Then("autostore should be {string}", async (value: string) => {
    const configPath = path.join(process.cwd(), "..", "ci", "zowe.config.json");
    const configContent = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configContent);

    const expectedValue = value === "true";
    await expect(config.autoStore).toEqual(expectedValue);
});
