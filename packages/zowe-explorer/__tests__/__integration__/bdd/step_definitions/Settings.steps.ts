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
import { SettingsEditor } from "wdio-vscode-service";

//
// Scenario: User can locate Zowe Explorer settings
//
When("a user navigates to VS Code Settings", async function () {
    const wb = await browser.getWorkbench();
    this.settingsEditor = await wb.openSettings();
    await this.settingsEditor.wait();
});
Then("the user can access the Zowe Explorer settings section", async function () {
    const settingsEditor = (await this.settingsEditor) as SettingsEditor;
    const settingsTableOfContents = await (await settingsEditor.elem).$("div[aria-label='Settings'][role='navigation']");

    const extensionsGroup = await settingsTableOfContents.$("div[aria-label='Extensions, group']");
    await extensionsGroup.click();
    // Scroll to the end of the list to find Zowe Explorer group in Extensions section
    await browser.keys("End");

    let zeGroup: WebdriverIO.Element;
    // Wait for the list to update
    await browser.waitUntil(
        async () => {
            zeGroup = await settingsTableOfContents.$(
                ".monaco-list > .monaco-scrollable-element > .monaco-list-rows > div[aria-label='Zowe Explorer, group']"
            );
            return await zeGroup.isExisting();
        },
        { timeout: 10000 }
    );
    await expect(zeGroup).toBeClickable();
    await zeGroup.click();
});
