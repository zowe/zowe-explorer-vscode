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

import { Given, When, Then } from "@cucumber/cucumber";
import { Workbench } from "wdio-vscode-service";
import { expect } from "@wdio/globals";
import * as fs from "fs";
import * as path from "path";

declare const browser: any;

const testInfo = {
    sourceProfile: "zosmf1",
    targetProfile: "zosmf2",
};

export async function verifyProfiles(expectedTreeTitles: string[], expectedFlatTitles: string[], workbench: Workbench) {
    const webview = (await workbench.getAllWebviews())[0];
    await webview.wait();
    await webview.open();

    const appContainer = await browser.$("[data-testid='config-editor-app']");
    await appContainer.waitForExist({ timeout: 10000 });

    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 1000 });

    const viewMode = await profileList.getAttribute("data-view-mode");

    await browser.waitUntil(
        async () => {
            const selector = viewMode === "tree" ? "[data-testid='profile-tree-node']" : "[data-testid='profile-list-item']";
            const items = await browser.$$(selector);
            return items.length > 0;
        },
        { timeout: 1000, timeoutMsg: "Profile elements not found within timeout" }
    );

    const selector = viewMode === "tree" ? "[data-testid='profile-tree-node']" : "[data-testid='profile-list-item']";
    const elements = await browser.$$(selector);

    const foundProfiles: string[] = [];
    for (const el of elements) {
        const profileName = await el.getAttribute("data-profile-name");
        if (profileName) foundProfiles.push(profileName);
    }

    for (const title of expectedTreeTitles) {
        expect(foundProfiles).toContain(title);
    }
    expect(foundProfiles.length).toBeGreaterThanOrEqual(expectedTreeTitles.length);

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
    const appContainer = await browser.$("[data-testid='config-editor-app']");
    await appContainer.waitForExist({ timeout: 10000 });

    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 1000 });

    const viewMode = await profileList.getAttribute("data-view-mode");

    await browser.waitUntil(
        async () => {
            const selector = viewMode === "tree" ? "[data-testid='profile-tree-node']" : "[data-testid='profile-list-item']";
            const items = await browser.$$(selector);
            return items.length > 0;
        },
        { timeout: 1000, timeoutMsg: "Profile elements not found within timeout" }
    );

    const selector = viewMode === "tree" ? "[data-testid='profile-tree-node']" : "[data-testid='profile-list-item']";
    const elements = await browser.$$(selector);

    const foundProfiles: string[] = [];
    for (const el of elements) {
        const profileName = await el.getAttribute("data-profile-name");
        if (profileName) foundProfiles.push(profileName);
    }

    const expectedTreeTitles = [
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
    for (const title of expectedTreeTitles) {
        expect(foundProfiles).toContain(title);
    }
    expect(foundProfiles.length).toBeGreaterThanOrEqual(expectedTreeTitles.length);

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

            const expectedFlatTitles = [
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
            for (const title of expectedFlatTitles) {
                expect(flatProfiles).toContain(title);
            }
            expect(flatProfiles.length).toBe(expectedFlatTitles.length);

            await viewToggleButton.click();
            await browser.pause(50);
            await browser.waitUntil(
                async () => {
                    const updatedList = await browser.$("[data-testid='profile-list']");
                    const updatedMode = await updatedList.getAttribute("data-view-mode");
                    return updatedMode === "tree";
                },
                { timeout: 1000, timeoutMsg: "Failed to switch back to tree view" }
            );
        }
    }
});

Then("the profile list should be in tree view mode", async () => {
    const workbench = await browser.getWorkbench();
    const webview = (await workbench.getAllWebviews())[0];
    await webview.wait();
    await webview.open();

    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 1000 });

    const viewMode = await profileList.getAttribute("data-view-mode");
    expect(viewMode).toBe("tree");
});

When("the user switches to flat view mode", async function () {
    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 1000 });
    const currentMode = await profileList.getAttribute("data-view-mode");

    if (currentMode !== "flat") {
        const viewToggleButton = await browser.$("[data-testid='view-mode-toggle']");
        await viewToggleButton.waitForExist({ timeout: 1000 });
        await viewToggleButton.click();
        await browser.pause(50);

        await browser.waitUntil(
            async () => {
                const profileList = await browser.$("[data-testid='profile-list']");
                const viewMode = await profileList.getAttribute("data-view-mode");
                return viewMode === "flat";
            },
            {
                timeout: 1000,
                timeoutMsg: "Failed to switch to flat view",
            }
        );
    }
});

When("the user switches to tree view mode", async function () {
    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 1000 });
    const currentMode = await profileList.getAttribute("data-view-mode");

    if (currentMode !== "tree") {
        const viewToggleButton = await browser.$("[data-testid='view-mode-toggle']");
        await viewToggleButton.waitForExist({ timeout: 1000 });
        await viewToggleButton.click();
        await browser.pause(50);

        await browser.waitUntil(
            async () => {
                const profileList = await browser.$("[data-testid='profile-list']");
                const viewMode = await profileList.getAttribute("data-view-mode");
                return viewMode === "tree";
            },
            {
                timeout: 1000,
                timeoutMsg: "Failed to switch to tree view",
            }
        );
    }
});

When("the user clicks on the search input field", async () => {
    const searchInput = await browser.$("input[placeholder='Search...']");
    await searchInput.waitForExist({ timeout: 1000 });
    await searchInput.click();
    await browser.pause(50);
});

When("the user types {string} in the search field", async (searchTerm: string) => {
    const searchInput = await browser.$("input[placeholder='Search...']");
    await searchInput.waitForExist({ timeout: 1000 });
    await searchInput.clearValue();
    await searchInput.setValue(searchTerm);
    await browser.pause(50);
});

When("the user clicks the clear search button", async () => {
    const clearButton = await browser.$("button[title='Clear search']");
    await clearButton.waitForExist({ timeout: 1000 });
    await clearButton.click();
    await browser.pause(50);
});

Then("the profile list should show only profiles containing {string}", async (searchTerm: string) => {
    await browser.pause(50);

    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 1000 });

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
    await browser.pause(50);

    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 100 });

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
    await profileList.waitForExist({ timeout: 1000 });

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
    await profileList.waitForExist({ timeout: 1000 });

    const actualCount = await profileList.getAttribute("data-profile-count");
    expect(parseInt(actualCount)).toBe(expectedCount);
});

Then("the profile list should show the nested profile and its children", async () => {
    await browser.pause(50);

    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 1000 });

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

When("the user selects {string} from the type filter dropdown", async (filterType: string) => {
    const typeFilterSelect = await browser.$("select");
    await typeFilterSelect.waitForExist({ timeout: 1000 });
    await typeFilterSelect.selectByVisibleText(filterType);
    await browser.pause(50);
});

Then("the profile list should show only profiles of type {string}", async (expectedType: string) => {
    await browser.pause(50);

    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 1000 });

    const viewMode = await profileList.getAttribute("data-view-mode");

    let profileElements;
    if (viewMode === "tree") {
        profileElements = await browser.$$("[data-testid='profile-tree-node']");
    } else {
        profileElements = await browser.$$("[data-testid='profile-list-item']");
    }

    if (viewMode === "flat") {
        for (const element of profileElements) {
            const profileType = await element.getAttribute("data-profile-type");
            if (profileType) {
                expect(profileType).toBe(expectedType);
            }
        }
    }

    expect(profileElements.length).toBeGreaterThan(0);
});

Then("the profile list should show profiles of type {string} and their parents in tree view", async (expectedType: string) => {
    await browser.pause(50);

    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 1000 });

    const viewMode = await profileList.getAttribute("data-view-mode");
    expect(viewMode).toBe("tree");

    const profileElements = await browser.$$("[data-testid='profile-tree-node']");

    let matchingCount = 0;
    for (const element of profileElements) {
        const profileType = await element.getAttribute("data-profile-type");
        if (profileType === expectedType) {
            matchingCount++;
        }
    }
    expect(matchingCount).toBeGreaterThan(0);

    expect(profileElements.length).toBeGreaterThan(0);
});

Then("the profile list should show only profiles containing {string} and of type {string}", async (searchTerm: string, expectedType: string) => {
    await browser.pause(50);

    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 1000 });

    const viewMode = await profileList.getAttribute("data-view-mode");

    let profileElements;
    if (viewMode === "tree") {
        profileElements = await browser.$$("[data-testid='profile-tree-node']");
    } else {
        profileElements = await browser.$$("[data-testid='profile-list-item']");
    }

    for (const element of profileElements) {
        const profileName = await element.getAttribute("data-profile-name");
        const profileType = await element.getAttribute("data-profile-type");

        if (profileName && profileType) {
            expect(profileName.toLowerCase()).toContain(searchTerm.toLowerCase());
            expect(profileType).toBe(expectedType);
        }
    }

    expect(profileElements.length).toBeGreaterThan(0);
});

When("the user clicks on the profile sort dropdown", async () => {
    const sortDropdownTrigger = await browser.$(".sort-dropdown-trigger");
    await sortDropdownTrigger.waitForExist({ timeout: 1000 });
    await sortDropdownTrigger.click();
    await browser.pause(100);
});

When("the user selects {string} from the sort dropdown", async (sortOption: string) => {
    const dropdownList = await browser.$(".sort-dropdown-list");
    await dropdownList.waitForDisplayed({ timeout: 1000 });

    const optionElements = await browser.$$(".sort-dropdown-item[role='option']");
    let optionElement = null;

    for (const element of optionElements) {
        const text = await element.getText();
        if (text === sortOption) {
            optionElement = element;
            break;
        }
    }

    if (optionElement) {
        await optionElement.click();
        await browser.pause(100);
    } else {
        throw new Error(`Could not find sort option: ${sortOption}`);
    }
});

Then("the profile sort dropdown should show {string} as selected", async (expectedSort: string) => {
    const sortDropdownTrigger = await browser.$(".sort-dropdown-trigger");
    await sortDropdownTrigger.waitForExist({ timeout: 1000 });

    const title = await sortDropdownTrigger.getAttribute("title");
    expect(title).toContain(`Current: ${expectedSort}`);

    const dropdownList = await browser.$(".sort-dropdown-list");
    const isDisplayed = await dropdownList.isDisplayed();
    expect(isDisplayed).toBe(false);
});

Then("the profiles should be displayed in natural order", async () => {
    await browser.pause(100);

    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 1000 });

    const viewMode = await profileList.getAttribute("data-view-mode");

    let profileElements;
    if (viewMode === "tree") {
        profileElements = await browser.$$("[data-testid='profile-tree-node']");
    } else {
        profileElements = await browser.$$("[data-testid='profile-list-item']");
    }

    expect(profileElements.length).toBeGreaterThan(0);
});

Then("the profiles should be displayed in alphabetical order", async () => {
    await browser.pause(100);

    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 1000 });

    const viewMode = await profileList.getAttribute("data-view-mode");

    let profileElements;
    if (viewMode === "tree") {
        profileElements = await browser.$$("[data-testid='profile-tree-node']");
    } else {
        profileElements = await browser.$$("[data-testid='profile-list-item']");
    }

    const profileNames: string[] = [];
    for (const element of profileElements) {
        const profileName = await element.getAttribute("data-profile-name");
        if (profileName) {
            profileNames.push(profileName);
        }
    }

    const sortedNames = [...profileNames].sort();
    expect(profileNames).toEqual(sortedNames);
});

Then("the profiles should be displayed in reverse alphabetical order", async () => {
    await browser.pause(100);

    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 1000 });

    const viewMode = await profileList.getAttribute("data-view-mode");

    let profileElements;
    if (viewMode === "tree") {
        profileElements = await browser.$$("[data-testid='profile-tree-node']");
    } else {
        profileElements = await browser.$$("[data-testid='profile-list-item']");
    }

    const profileNames: string[] = [];
    for (const element of profileElements) {
        const profileName = await element.getAttribute("data-profile-name");
        if (profileName) {
            profileNames.push(profileName);
        }
    }

    const sortedNames = [...profileNames].sort().reverse();
    expect(profileNames).toEqual(sortedNames);
});

Then("the profiles should be displayed in alphabetical order in flat view", async () => {
    await browser.pause(100);

    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 1000 });

    const viewMode = await profileList.getAttribute("data-view-mode");
    expect(viewMode).toBe("flat");

    const profileElements = await browser.$$("[data-testid='profile-list-item']");

    const profileNames: string[] = [];
    for (const element of profileElements) {
        const profileName = await element.getAttribute("data-profile-name");
        if (profileName) {
            profileNames.push(profileName);
        }
    }

    const sortedNames = [...profileNames].sort();
    expect(profileNames).toEqual(sortedNames);
});

Then("the profiles should be displayed in reverse alphabetical order in flat view", async () => {
    await browser.pause(100);

    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 1000 });

    const viewMode = await profileList.getAttribute("data-view-mode");
    expect(viewMode).toBe("flat");

    const profileElements = await browser.$$("[data-testid='profile-list-item']");

    const profileNames: string[] = [];
    for (const element of profileElements) {
        const profileName = await element.getAttribute("data-profile-name");
        if (profileName) {
            profileNames.push(profileName);
        }
    }

    const nonNestedProfiles = profileNames.filter((name) => !name.includes("."));
    const sortedNonNested = [...nonNestedProfiles].sort().reverse();

    expect(nonNestedProfiles).toEqual(sortedNonNested);
    expect(profileNames.length).toBeGreaterThan(0);
});

Given("the zosmf1 profile exists in the tree", async function () {
    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 1000 });

    const viewMode = await profileList.getAttribute("data-view-mode");
    if (viewMode !== "tree") {
        const viewToggleButton = await browser.$("[data-testid='view-mode-toggle']");
        await viewToggleButton.waitForExist({ timeout: 1000 });
        await viewToggleButton.click();
        await browser.pause(100);

        await browser.waitUntil(
            async () => {
                const updatedProfileList = await browser.$("[data-testid='profile-list']");
                const updatedViewMode = await updatedProfileList.getAttribute("data-view-mode");
                return updatedViewMode === "tree";
            },
            { timeout: 1000, timeoutMsg: "Failed to switch to tree view" }
        );
    }

    await browser.waitUntil(
        async () => {
            const profileNodes = await browser.$$("[data-testid='profile-tree-node']");
            return profileNodes.length > 0;
        },
        { timeout: 10000, timeoutMsg: "Profile tree not loaded within timeout" }
    );

    this.sourceProfile = await browser.$(`[data-testid='profile-tree-node'][data-profile-name='${testInfo.sourceProfile}']`);
    await this.sourceProfile.waitForExist({ timeout: 1000 });
    await this.sourceProfile.waitForDisplayed({ timeout: 1000 });
});

When("the user clicks and holds on the zosmf1 profile", async function () {
    await this.sourceProfile.waitForExist({ timeout: 1000 });
    await this.sourceProfile.waitForDisplayed({ timeout: 1000 });

    await this.sourceProfile.click();
    await browser.pause(200);

    this.sourceElement = this.sourceProfile;
    this.isDragging = true;
});

When("the user hovers over the zosmf2 location", async function () {
    this.targetProfile = await browser.$(`[data-testid='profile-tree-node'][data-profile-name='${testInfo.targetProfile}']`);
    await this.targetProfile.waitForExist({ timeout: 1000 });
    await this.targetProfile.waitForDisplayed({ timeout: 1000 });

    this.targetElement = this.targetProfile;
});

When("the user releases the left click", async function () {
    await this.sourceElement.waitForDisplayed({ timeout: 5000 });
    await this.targetElement.waitForDisplayed({ timeout: 5000 });
    await this.sourceElement.dragAndDrop(this.targetElement);
    await browser.pause(500);

    this.isDragging = false;
});

Then("the zosmf1 profile should be moved to the zosmf2 location in the config file", async function () {
    const configPath = path.join(process.cwd(), "..", "ci", "zowe.config.json");
    const configContent = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configContent);

    const targetProfile = config.profiles[testInfo.targetProfile];
    expect(targetProfile).toBeDefined();

    const targetChildren = targetProfile.profiles || targetProfile.children || {};
    const sourceProfileInTarget = targetChildren[testInfo.sourceProfile];
    expect(sourceProfileInTarget).toBeDefined();
});

Then("the profile should be visible in its new location", async function () {
    const targetChildren = await browser.$$(
        `[data-testid='profile-tree-node'][data-profile-name='${testInfo.targetProfile}'] [data-testid='profile-tree-node']`
    );

    let sourceInTarget = null;
    for (const child of targetChildren) {
        const profileName = await child.getAttribute("data-profile-name");
        if (profileName === testInfo.sourceProfile) {
            sourceInTarget = child;
            break;
        }
    }

    await expect(sourceInTarget).toBeDefined();
    await sourceInTarget.waitForDisplayed({ timeout: 1000 });
});
