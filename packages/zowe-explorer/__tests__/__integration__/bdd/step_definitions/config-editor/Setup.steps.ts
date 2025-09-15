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
import quickPick from "../../../../__pageobjects__/QuickPick";

//
// Scenario: User opens the Zowe Config Editor via Command Palette
//
When("a user opens the Zowe Config Editor from the Command Palette", async () => {
    // Open Command Palette (Ctrl+Shift+P on Linux/Windows)
    await browser.keys([Key.Ctrl, Key.Shift, "P"]);

    // Wait for quick pick to show
    await browser.waitUntil(() => quickPick.isDisplayed(), {
        timeout: 1000,
        timeoutMsg: "Expected Command Palette to be visible",
    });

    // Type the command
    await browser.keys("Zowe Explorer: Edit Zowe Config Files");

    // Hit Enter
    await browser.keys(Key.Enter);
});

Then("the Zowe Config Editor webview should be opened", async () => {
    const workbench = await browser.getWorkbench();
    const editorView = workbench.getEditorView();

    // Wait until we can open the editor by title
    await browser.waitUntil(
        async () => {
            try {
                const editor = await editorView.openEditor("Config Editor");
                return (await editor.getTitle()) === "Config Editor";
            } catch {
                return false;
            }
        },
        {
            timeout: 5000,
            timeoutMsg: "Expected Zowe Config Editor to be opened",
        }
    );

    const activeTab = await editorView.getActiveTab();
    const title = await activeTab?.getTitle();
    await expect(title).toEqual("Config Editor");
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// In your step definition
Then("I wait for {int} seconds", async function (seconds) {
    await sleep(seconds * 1000);
});
