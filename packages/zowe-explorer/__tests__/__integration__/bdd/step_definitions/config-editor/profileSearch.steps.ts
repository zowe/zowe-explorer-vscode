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

declare const browser: any;
declare const expect: any;

Then("the profile list should be in tree view mode", async () => {
    const workbench = await browser.getWorkbench();
    const webview = (await workbench.getAllWebviews())[0];
    await webview.wait();
    await webview.open();

    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 10000 });

    const viewMode = await profileList.getAttribute("data-view-mode");
    expect(viewMode).toBe("tree");
});

When("the user switches to flat view mode", async () => {
    const viewToggleButton = await browser.$("[data-testid='view-mode-toggle']");
    await viewToggleButton.waitForExist({ timeout: 5000 });
    await viewToggleButton.click();
    await browser.pause(50);

    await browser.waitUntil(
        async () => {
            const profileList = await browser.$("[data-testid='profile-list']");
            const viewMode = await profileList.getAttribute("data-view-mode");
            return viewMode === "flat";
        },
        {
            timeout: 5000,
            timeoutMsg: "Failed to switch to flat view",
        }
    );
});

When("the user clicks on the search input field", async () => {
    const searchInput = await browser.$("input[placeholder='Search...']");
    await searchInput.waitForExist({ timeout: 5000 });
    await searchInput.click();
    await browser.pause(50);
});

When("the user types {string} in the search field", async (searchTerm: string) => {
    const searchInput = await browser.$("input[placeholder='Search...']");
    await searchInput.waitForExist({ timeout: 5000 });

    await searchInput.clearValue();

    await searchInput.setValue(searchTerm);

    await browser.pause(50);
});

When("the user clicks the clear search button", async () => {
    const clearButton = await browser.$("button[title='Clear search']");
    await clearButton.waitForExist({ timeout: 5000 });
    await clearButton.click();
    await browser.pause(300); // Wait for search to clear
});

Then("the profile list should show only profiles containing {string}", async (searchTerm: string) => {
    await browser.pause(500);

    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 5000 });

    const viewMode = await profileList.getAttribute("data-view-mode");

    let profileElements;
    if (viewMode === "tree") {
        profileElements = await browser.$$("[data-testid='profile-tree-node']");
    } else {
        profileElements = await browser.$$("[data-testid='profile-list-item']");
    }

    for (const element of profileElements) {
        const profileName = await element.getAttribute("data-profile-name");
        if (profileName) {
            expect(profileName.toLowerCase()).toContain(searchTerm.toLowerCase());
        }
    }
});

Then("the profile list should show all profiles", async () => {
    await browser.pause(500);

    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 5000 });

    const totalProfiles = await profileList.getAttribute("data-total-profiles");
    const visibleProfiles = await profileList.getAttribute("data-profile-count");

    expect(parseInt(visibleProfiles)).toBe(parseInt(totalProfiles));
});

Then("all expected profiles should be visible", async () => {
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

    const profileList = await browser.$("[data-testid='profile-list']");
    const viewMode = await profileList.getAttribute("data-view-mode");

    let profileElements;
    if (viewMode === "tree") {
        profileElements = await browser.$$("[data-testid='profile-tree-node']");
    } else {
        profileElements = await browser.$$("[data-testid='profile-list-item']");
    }

    const actualProfiles: string[] = [];
    for (const element of profileElements) {
        const profileName = await element.getAttribute("data-profile-name");
        if (profileName) {
            actualProfiles.push(profileName);
        }
    }

    expect(actualProfiles.length).toBeGreaterThanOrEqual(expectedTitles.length);

    for (const title of expectedTitles) {
        expect(actualProfiles).toContain(title);
    }
});

Then("the profile list should show no profiles", async () => {
    await browser.pause(50);

    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 5000 });

    const viewMode = await profileList.getAttribute("data-view-mode");

    let profileElements;
    if (viewMode === "tree") {
        profileElements = await browser.$$("[data-testid='profile-tree-node']");
    } else {
        profileElements = await browser.$$("[data-testid='profile-list-item']");
    }

    expect(profileElements.length).toBe(0);
});

Then("the profile count should be {int}", async (expectedCount: number) => {
    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 5000 });

    const actualCount = await profileList.getAttribute("data-profile-count");
    expect(parseInt(actualCount)).toBe(expectedCount);
});

Then("the profile list should show the nested profile and its children", async () => {
    await browser.pause(50);

    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 5000 });

    const viewMode = await profileList.getAttribute("data-view-mode");

    let profileElements;
    if (viewMode === "tree") {
        profileElements = await browser.$$("[data-testid='profile-tree-node']");
    } else {
        profileElements = await browser.$$("[data-testid='profile-list-item']");
    }

    const actualProfiles: string[] = [];
    for (const element of profileElements) {
        const profileName = await element.getAttribute("data-profile-name");
        if (profileName) {
            actualProfiles.push(profileName);
        }
    }
    expect(actualProfiles).toContain("nested");
    expect(actualProfiles).toContain("child1");
    expect(actualProfiles).toContain("child2");

    expect(actualProfiles.length).toBeGreaterThanOrEqual(3);
});
