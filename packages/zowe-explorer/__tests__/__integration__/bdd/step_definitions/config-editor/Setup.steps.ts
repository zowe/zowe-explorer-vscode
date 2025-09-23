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
    // First, check if Config Editor is already open
    try {
        const workbench = await browser.getWorkbench();

        // Check if there are any webviews open (Config Editor uses webviews)
        const webviews = await workbench.getAllWebviews();
        console.log(`Found ${webviews.length} webviews`);
        if (webviews && webviews.length > 0) {
            // If there are webviews open, assume one is the Config Editor and just activate it
            try {
                await webviews[0].open();
                await browser.pause(50);
                console.log("Successfully activated existing webview");
                return; // Skip opening Command Palette
            } catch (webviewError) {
                // Continue to Command Palette if webview activation fails
                console.log("Webview activation failed, continuing to Command Palette");
            }
        }

        // Fallback: Check editor tabs
        const editorView = workbench.getEditorView();

        // Try to get the active tab first
        const activeTab = await editorView.getActiveTab();
        if (activeTab) {
            const activeTitle = await activeTab.getTitle();
            if (activeTitle === "Config Editor") {
                return; // Skip opening Command Palette
            }
        }

        // Check if Config Editor tab is already open in any tab
        const tabs = await editorView.getOpenTabs();
        if (tabs && tabs.length > 0) {
            for (const tab of tabs) {
                try {
                    const title = await tab.getTitle();
                    if (title === "Config Editor") {
                        // Config Editor is already open, just activate it
                        await editorView.openEditor("Config Editor");
                        await browser.pause(50);
                        return; // Skip opening Command Palette
                    }
                } catch (tabError) {
                    // Continue checking other tabs if one fails
                    continue;
                }
            }
        }
    } catch (error) {
        // If we can't check for existing tabs, proceed with opening Command Palette
        console.log("Error checking for existing Config Editor, proceeding to Command Palette");
    }

    // Enhanced cleanup before opening Command Palette
    try {
        // Multiple escape presses to ensure clean state
        for (let i = 0; i < 3; i++) {
            await browser.keys("Escape");
            await browser.pause(50);
        }

        // Click on workbench to ensure focus
        const workbenchElement = await browser.$(".monaco-workbench");
        if (await workbenchElement.isExisting()) {
            await workbenchElement.click();
            await browser.pause(50);
        }
    } catch (error) {
        // Ignore errors
    }

    // Open Command Palette (Ctrl+Shift+P on Linux/Windows)
    await browser.keys([Key.Ctrl, Key.Shift, "P"]);
    await browser.pause(100); // Give time for Command Palette to appear

    // Wait for quick pick to show
    await browser.waitUntil(
        async () => {
            try {
                return await quickPick.isDisplayed();
            } catch {
                // Try alternative detection
                const quickPickElement = await browser.$(".quick-input-widget");
                return await quickPickElement.isDisplayed();
            }
        },
        {
            timeout: 3000,
            timeoutMsg: "Expected Command Palette to be visible",
        }
    );

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
            timeout: 3000,
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
