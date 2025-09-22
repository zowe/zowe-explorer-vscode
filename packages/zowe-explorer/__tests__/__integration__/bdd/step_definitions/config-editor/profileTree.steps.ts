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

Then("the profile tree should contain expected profiles from zowe.config.json", async () => {
    // The Config Editor webview should already be open from setup.steps.ts
    const workbench = await browser.getWorkbench();

    // Get the webview and wait for it to be ready
    const webview = (await workbench.getAllWebviews())[0];
    await webview.wait();
    await webview.open();

    // Wait for the main app container to exist using the new data-testid
    const appContainer = await browser.$("[data-testid='config-editor-app']");
    await appContainer.waitForExist({ timeout: 10000 });

    // Wait for the profile list to be available using the new data-testid
    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 1000 });

    // Get the view mode from data attributes
    const viewMode = await profileList.getAttribute("data-view-mode");

    // Wait for profile elements to be loaded using the new data-testids
    await browser.waitUntil(
        async () => {
            try {
                if (viewMode === "tree") {
                    const nodes = await browser.$$("[data-testid='profile-tree-node']");
                    return nodes.length > 0;
                } else {
                    const items = await browser.$$("[data-testid='profile-list-item']");
                    return items.length > 0;
                }
            } catch (error) {
                return false;
            }
        },
        {
            timeout: 5000,
            timeoutMsg: "Profile elements not found within timeout",
        }
    );

    // Expected profiles from zowe.config.json
    const expectedTitles = [
        "zosmf1",
        "zosmf2",
        "zosmf3",
        "base",
        "ssh1",
        "tso1",
        "zosmf-dev",
        "zosmf-prod",
        "test-profile",
        "special-chars",
        "nested",
    ];
    let foundProfiles: string[] = [];

    if (viewMode === "tree") {
        // Tree view mode - use the new data-testid selectors
        const nodes = await browser.$$("[data-testid='profile-tree-node']");

        // Get profile names from data attributes
        for (const node of nodes) {
            const profileName = await node.getAttribute("data-profile-name");
            if (profileName && expectedTitles.includes(profileName)) {
                foundProfiles.push(profileName);
            }
        }
    } else {
        // Flat view mode - use the new data-testid selectors
        const items = await browser.$$("[data-testid='profile-list-item']");

        // Get profile names from data attributes
        for (const item of items) {
            const profileName = await item.getAttribute("data-profile-name");
            if (profileName && expectedTitles.includes(profileName)) {
                foundProfiles.push(profileName);
            }
        }
    }

    // Fallback: if we didn't find profiles using data attributes, try the profile name spans
    if (foundProfiles.length === 0) {
        const profileNameSpans = await browser.$$("[data-testid='profile-name']");

        for (const span of profileNameSpans) {
            const text = await span.getText();
            if (text && expectedTitles.includes(text)) {
                foundProfiles.push(text);
            }
        }
    }

    // Verify we found the expected number of profiles
    expect(foundProfiles.length).toBeGreaterThanOrEqual(expectedTitles.length);

    // Verify all expected titles are present
    for (const title of expectedTitles) {
        expect(foundProfiles).toContain(title);
    }

    // Additional validation: check for nested profiles if in tree view
    if (viewMode === "tree") {
        // Now switch to flat view and verify profiles there

        // Look for the view mode toggle button
        const viewToggleButton = await browser.$("[data-testid='view-mode-toggle']");
        if (await viewToggleButton.isExisting()) {
            await viewToggleButton.click();
            await browser.pause(500); // Wait for view to switch

            // Wait for flat view to be active
            await browser.waitUntil(
                async () => {
                    const updatedProfileList = await browser.$("[data-testid='profile-list']");
                    const updatedViewMode = await updatedProfileList.getAttribute("data-view-mode");
                    return updatedViewMode === "flat";
                },
                {
                    timeout: 5000,
                    timeoutMsg: "Failed to switch to flat view",
                }
            );

            // Now verify profiles in flat view
            const flatViewItems = await browser.$$("[data-testid='profile-list-item']");
            let flatViewProfiles: string[] = [];

            // Get profile names from flat view items
            for (const item of flatViewItems) {
                const profileName = await item.getAttribute("data-profile-name");
                if (profileName) {
                    flatViewProfiles.push(profileName);
                }
            }

            // In flat view, we should see all profiles including nested children as separate items
            // The flat view shows all profiles in a flat list, including nested children
            const flatViewExpectedTitles = [
                "zosmf1",
                "zosmf2",
                "zosmf3",
                "base",
                "ssh1",
                "tso1",
                "zosmf-dev",
                "zosmf-prod",
                "test-profile",
                "special-chars",
                "nested",
                "nested.child1",
                "nested.child2",
            ];

            // Verify all expected profiles are present in flat view (including nested children)
            for (const title of flatViewExpectedTitles) {
                expect(flatViewProfiles).toContain(title);
            }

            // Verify we have the expected number of profiles in flat view (11 main + 2 nested = 13 total)
            expect(flatViewProfiles.length).toBe(13);
        }
    }
});
