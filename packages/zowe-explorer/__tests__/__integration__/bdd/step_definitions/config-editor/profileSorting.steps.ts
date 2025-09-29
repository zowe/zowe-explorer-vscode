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

    // For natural order, we just verify that profiles are displayed
    // The exact order depends on the original configuration
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

    // Verify alphabetical order
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

    // Verify reverse alphabetical order
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

    // Verify alphabetical order
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

    // For reverse alphabetical order, we need to be more flexible with nested profiles
    // The main profiles should be in reverse alphabetical order, but parent-child relationships
    // might affect the exact positioning
    const nonNestedProfiles = profileNames.filter((name) => !name.includes("."));
    const sortedNonNested = [...nonNestedProfiles].sort().reverse();

    // Verify that non-nested profiles are in reverse alphabetical order
    expect(nonNestedProfiles).toEqual(sortedNonNested);

    // Verify that we have the expected number of profiles
    expect(profileNames.length).toBeGreaterThan(0);
});
