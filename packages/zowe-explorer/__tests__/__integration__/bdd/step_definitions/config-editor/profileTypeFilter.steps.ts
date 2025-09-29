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
    expect(viewMode).toBe("tree"); // Ensure we're in tree view

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
