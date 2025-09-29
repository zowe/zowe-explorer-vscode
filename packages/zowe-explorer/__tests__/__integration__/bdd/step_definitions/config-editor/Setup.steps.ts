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
import { restoreZoweConfig } from "../../features/config-editor/utils";

When("a user opens the Zowe Config Editor from the Command Palette", async () => {
    restoreZoweConfig();
    try {
        const workbench = await browser.getWorkbench();

        // Check if there are any webviews open
        const webviews = await workbench.getAllWebviews();
        if (webviews && webviews.length > 0) {
            try {
                await webviews[0].open();
                await browser.pause(50);
                return;
            } catch (webviewError) {}
        }

        const editorView = workbench.getEditorView();

        const activeTab = await editorView.getActiveTab();
        if (activeTab) {
            const activeTitle = await activeTab.getTitle();
            if (activeTitle === "Config Editor") {
                return;
            }
        }

        const tabs = await editorView.getOpenTabs();
        if (tabs && tabs.length > 0) {
            for (const tab of tabs) {
                try {
                    const title = await tab.getTitle();
                    if (title === "Config Editor") {
                        await editorView.openEditor("Config Editor");
                        await browser.pause(50);
                        return;
                    }
                } catch (tabError) {
                    continue;
                }
            }
        }
        try {
            const webviews = await workbench.getAllWebviews();
            for (const webview of webviews) {
                await webview.close();
            }
        } catch (error) {}
    } catch (error) {
        console.log("Error checking for existing Config Editor, proceeding to Command Palette");
    }

    try {
        for (let i = 0; i < 3; i++) {
            await browser.keys("Escape");
            await browser.pause(50);
        }

        const workbenchElement = await browser.$(".monaco-workbench");
        if (await workbenchElement.isExisting()) {
            await workbenchElement.click();
            await browser.pause(50);
        }
    } catch (error) {}

    await browser.keys([Key.Ctrl, Key.Shift, "P"]);
    await browser.pause(50);

    await browser.waitUntil(
        async () => {
            try {
                return await quickPick.isDisplayed();
            } catch {
                const quickPickElement = await browser.$(".quick-input-widget");
                return await quickPickElement.isDisplayed();
            }
        },
        {
            timeout: 1000,
            timeoutMsg: "Expected Command Palette to be visible",
        }
    );

    await browser.keys("Zowe Explorer: Edit Zowe Config Files");

    await browser.keys(Key.Enter);
});

Then("the Zowe Config Editor webview should be opened", async function () {
    const workbench = await browser.getWorkbench();
    const editorView = workbench.getEditorView();

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
            timeout: 1000,
            timeoutMsg: "Expected Zowe Config Editor to be opened",
        }
    );

    const activeTab = await editorView.getActiveTab();
    const title = await activeTab?.getTitle();
    await expect(title).toEqual("Config Editor");
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

Then("I wait for {int} seconds", async function (seconds) {
    await sleep(seconds * 1000);
});
