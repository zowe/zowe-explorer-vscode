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
import { Workbench } from "wdio-vscode-service";

export async function verifyProfiles(expectedTreeTitles: string[], expectedFlatTitles: string[], workbench: Workbench) {
    // Get the webview and wait for it to be ready
    const webview = (await workbench.getAllWebviews())[0];
    await webview.wait();
    await webview.open();

    // Wait for the main app container
    const appContainer = await browser.$("[data-testid='config-editor-app']");
    await appContainer.waitForExist({ timeout: 10000 });

    // Wait for the profile list
    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 1000 });

    // Detect current view mode
    const viewMode = await profileList.getAttribute("data-view-mode");

    // Wait until profiles are loaded
    await browser.waitUntil(
        async () => {
            const selector = viewMode === "tree" ? "[data-testid='profile-tree-node']" : "[data-testid='profile-list-item']";
            const items = await browser.$$(selector);
            return items.length > 0;
        },
        { timeout: 1000, timeoutMsg: "Profile elements not found within timeout" }
    );

    // Collect found profiles
    const selector = viewMode === "tree" ? "[data-testid='profile-tree-node']" : "[data-testid='profile-list-item']";
    const elements = await browser.$$(selector);

    const foundProfiles: string[] = [];
    for (const el of elements) {
        const profileName = await el.getAttribute("data-profile-name");
        if (profileName) foundProfiles.push(profileName);
    }

    // Validate tree mode
    for (const title of expectedTreeTitles) {
        expect(foundProfiles).toContain(title);
    }
    expect(foundProfiles.length).toBeGreaterThanOrEqual(expectedTreeTitles.length);

    // If in tree mode, toggle and check flat mode
    if (viewMode === "tree") {
        const viewToggleButton = await browser.$("[data-testid='view-mode-toggle']");
        if (await viewToggleButton.isExisting()) {
            await viewToggleButton.click();
            await browser.pause(50);

            await browser.waitUntil(
                async () => {
                    const updatedList = await browser.$("[data-testid='profile-list']");
                    const updatedMode = await updatedList.getAttribute("data-view-mode");
                    return updatedMode === "flat";
                },
                { timeout: 1000, timeoutMsg: "Failed to switch to flat view" }
            );

            const flatItems = await browser.$$("[data-testid='profile-list-item']");
            const flatProfiles: string[] = [];
            for (const item of flatItems) {
                const profileName = await item.getAttribute("data-profile-name");
                if (profileName) flatProfiles.push(profileName);
            }

            for (const title of expectedFlatTitles) {
                expect(flatProfiles).toContain(title);
            }
            expect(flatProfiles.length).toBe(expectedFlatTitles.length);
        }
    }
}

Then("the profile tree should contain expected profiles from zowe.config.json", async function () {
    this.workbench = await browser.getWorkbench();
    await verifyProfiles(
        ["zosmf1", "zosmf2", "zosmf3", "base", "ssh1", "tso1", "zosmf-dev", "zosmf-prod", "test-profile", "special-chars", "nested"],
        [
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
        ],
        this.workbench
    );
});
