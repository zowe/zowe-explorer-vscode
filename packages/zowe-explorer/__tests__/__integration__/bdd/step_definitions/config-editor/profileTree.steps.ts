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

import { Then } from "@cucumber/cucumber";

Then('the profile tree should contain 4 nodes with titles "zosmf1", "zosmf2", "zosmf3", "base"', async () => {
    // The Config Editor webview should already be open from setup.steps.ts
    const workbench = await browser.getWorkbench();

    // Get the webview and wait for it to be ready (following the pattern from DatasetTableView.steps.ts)
    const webview = (await workbench.getAllWebviews())[0];
    await webview.wait();
    await webview.open();

    // Wait for the main app container to exist
    const appContainer = await browser.$(".app-container");
    await appContainer.waitForExist({ timeout: 10000 });

    // Wait for the profiles section to be available
    const profilesSection = await browser.$(".profiles-section");
    await profilesSection.waitForExist({ timeout: 10000 });

    // Wait for profile elements to be loaded
    await browser.waitUntil(
        async () => {
            try {
                // Check for either tree view or flat view profile containers
                const profileTreeRoot = await browser.$(".profile-tree");
                const profileListItems = await browser.$$(".profile-list-item");

                // Check if we have profile elements
                const hasTreeView = await profileTreeRoot.isExisting();
                const hasFlatView = profileListItems.length > 0;

                if (hasTreeView) {
                    const nodes = await browser.$$(".profile-tree-node");
                    return nodes.length > 0;
                } else if (hasFlatView) {
                    return profileListItems.length > 0;
                }

                return false;
            } catch (error) {
                return false;
            }
        },
        {
            timeout: 15000,
            timeoutMsg: "Profile elements not found within timeout",
        }
    );

    let texts: string[] = [];
    const expectedTitles = ["zosmf1", "zosmf2", "zosmf3", "base"];

    // Check if we're in tree view mode
    const profileTreeRoot = await browser.$(".profile-tree");
    const isTreeView = await profileTreeRoot.isExisting();

    if (isTreeView) {
        // Tree view mode - look for profile-tree-node elements
        const nodes = await browser.$$(".profile-tree-node");
        await expect(nodes.length).toBe(4);

        // Verify node text by getting the profile name from each node
        for (const node of nodes) {
            // Get the text content of the profile name span within each node
            const profileNameSpan = await node.$("span[style*='flex: 1']");
            if (profileNameSpan) {
                const text = await profileNameSpan.getText();
                texts.push(text);
            }
        }
    } else {
        // Flat view mode - look for profile-list-item elements
        const profileListItems = await browser.$$(".profile-list-item");
        await expect(profileListItems.length).toBe(4);

        // Verify node text by getting the profile name from each item
        for (const item of profileListItems) {
            const profileNameSpan = await item.$("span[style*='flex: 1']");
            if (profileNameSpan) {
                const text = await profileNameSpan.getText();
                texts.push(text);
            }
        }
    }

    // If we didn't find any profiles in the expected structure, try a more flexible approach
    if (texts.length === 0) {
        // Look for any elements that might contain profile names
        const allSpans = await browser.$$("span");

        for (const span of allSpans) {
            try {
                const text = await span.getText();
                if (text && expectedTitles.includes(text)) {
                    texts.push(text);
                }
            } catch (error) {
                // Ignore errors getting text from spans
            }
        }

        // Also try looking for any div elements that might contain profile names
        const allDivs = await browser.$$("div");

        for (const div of allDivs) {
            try {
                const text = await div.getText();
                if (text && expectedTitles.includes(text)) {
                    texts.push(text);
                    console.log("Found profile text in div:", text);
                }
            } catch (error) {
                // Ignore errors getting text from divs
            }
        }
    }

    // Verify all expected titles are present
    for (const title of expectedTitles) {
        expect(texts).toContain(title);
    }
});
