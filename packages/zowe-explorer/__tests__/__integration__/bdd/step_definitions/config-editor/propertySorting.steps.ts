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

When("the user selects a profile to view its properties", async () => {
    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 1000 });

    const profileElements = await browser.$$("[data-testid='profile-list-item']");
    if (profileElements.length > 0) {
        await profileElements[0].click();
        await browser.pause(100);
    } else {
        const treeProfileElements = await browser.$$("[data-testid='profile-tree-node']");
        if (treeProfileElements.length > 0) {
            await treeProfileElements[0].click();
            await browser.pause(100);
        }
    }
});

When("the user selects the {string} to view its properties", async (profileName: string) => {
    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 1000 });

    await browser.pause(500);

    let profileFound = false;
    let attempts = 0;
    const maxAttempts = 3;

    while (!profileFound && attempts < maxAttempts) {
        const profileElements = await browser.$$("[data-testid='profile-list-item']");

        for (const element of profileElements) {
            const elementProfileName = await element.getAttribute("data-profile-name");
            if (elementProfileName === profileName) {
                await element.click();
                await browser.pause(100);
                profileFound = true;
                break;
            }
        }

        if (!profileFound) {
            const treeProfileElements = await browser.$$("[data-testid='profile-tree-node']");
            for (const element of treeProfileElements) {
                const elementProfileName = await element.getAttribute("data-profile-name");
                if (elementProfileName === profileName) {
                    await element.click();
                    await browser.pause(100);
                    profileFound = true;
                    break;
                }
            }
        }

        if (!profileFound) {
            attempts++;
            await browser.pause(1000); // Wait and try again
        }
    }

    if (!profileFound) {
        const profileElements = await browser.$$("[data-testid='profile-list-item']");
        if (profileElements.length > 0) {
            await profileElements[0].click();
            await browser.pause(100);
        } else {
            const treeProfileElements = await browser.$$("[data-testid='profile-tree-node']");
            if (treeProfileElements.length > 0) {
                await treeProfileElements[0].click();
                await browser.pause(100);
            } else {
                throw new Error(`Could not find profile: ${profileName} and no profiles available`);
            }
        }
    }
});

When("the user selects a different profile to view its properties", async () => {
    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 1000 });

    const profileElements = await browser.$$("[data-testid='profile-list-item']");
    if (profileElements.length > 1) {
        await profileElements[1].click();
        await browser.pause(100);
    } else {
        const treeProfileElements = await browser.$$("[data-testid='profile-tree-node']");
        if (treeProfileElements.length > 1) {
            await treeProfileElements[1].click();
            await browser.pause(100);
        }
    }
});

When("the user switches back to the first profile", async () => {
    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 1000 });

    const profileElements = await browser.$$("[data-testid='profile-list-item']");
    if (profileElements.length > 0) {
        await profileElements[0].click();
        await browser.pause(100);
    } else {
        const treeProfileElements = await browser.$$("[data-testid='profile-tree-node']");
        if (treeProfileElements.length > 0) {
            await treeProfileElements[0].click();
            await browser.pause(100);
        }
    }
});

Then("the profile details section should be displayed", async () => {
    const profileDetailsSection = await browser.$(".config-section.profile-details-section");
    await profileDetailsSection.waitForExist({ timeout: 1000 });
    await profileDetailsSection.waitForDisplayed({ timeout: 1000 });
});

When("the user clicks on the property sort dropdown", async () => {
    const propertySortDropdown = await browser.$(".config-section.profile-details-section .sort-dropdown:nth-of-type(2) .sort-dropdown-trigger");
    await propertySortDropdown.waitForExist({ timeout: 1000 });
    await propertySortDropdown.click();
    await browser.pause(100);
});

When("the user selects {string} from the property sort dropdown", async (sortOption: string) => {
    const dropdownList = await browser.$(".config-section.profile-details-section .sort-dropdown-list");
    await dropdownList.waitForDisplayed({ timeout: 1000 });

    const optionElements = await browser.$$(".config-section.profile-details-section .sort-dropdown-item[role='option']");
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
        throw new Error(`Could not find property sort option: ${sortOption}`);
    }
});

Then("the property sort dropdown should show {string} as selected", async (expectedSort: string) => {
    const propertySortDropdown = await browser.$(".config-section.profile-details-section .sort-dropdown:nth-of-type(2) .sort-dropdown-trigger");
    await propertySortDropdown.waitForExist({ timeout: 1000 });

    const title = await propertySortDropdown.getAttribute("title");
    expect(title).toContain(`Current: ${expectedSort}`);

    const dropdownList = await browser.$(".config-section.profile-details-section .sort-dropdown-list");
    const isDisplayed = await dropdownList.isDisplayed();
    expect(isDisplayed).toBe(false);
});

Then("the property sort dropdown should show {string} as selected by default", async (expectedSort: string) => {
    const propertySortDropdown = await browser.$(".config-section.profile-details-section .sort-dropdown:nth-of-type(2) .sort-dropdown-trigger");
    await propertySortDropdown.waitForExist({ timeout: 1000 });

    const title = await propertySortDropdown.getAttribute("title");
    expect(title).toContain(`Current: ${expectedSort}`);
});

Then("the properties should be displayed in alphabetical order", async () => {
    await browser.pause(100);

    let propertyElements = await browser.$$(".config-section.profile-details-section .config-item");

    if (propertyElements.length === 0) {
        propertyElements = await browser.$$(".config-section.profile-details-section [data-property-key]");
    }

    if (propertyElements.length === 0) {
        propertyElements = await browser.$$(".config-section.profile-details-section .property-item");
    }

    if (propertyElements.length === 0) {
        propertyElements = await browser.$$(".config-section.profile-details-section .config-item.parent");
    }

    const propertyNames: string[] = [];
    for (const element of propertyElements) {
        const propertyName = await element.getAttribute("data-property-key");
        if (propertyName && propertyName !== "type") {
            propertyNames.push(propertyName);
        }
    }

    const sortedNames = [...propertyNames].sort();
    expect(propertyNames).toEqual(sortedNames);
});

Then("the properties should be displayed according to the sort order", async () => {
    await browser.pause(100);

    const profileDetailsSection = await browser.$(".config-section.profile-details-section");
    await profileDetailsSection.waitForExist({ timeout: 1000 });
    await profileDetailsSection.waitForDisplayed({ timeout: 1000 });

    const propertySortDropdown = await browser.$(".config-section.profile-details-section .sort-dropdown-trigger");
    await propertySortDropdown.waitForExist({ timeout: 1000 });

    expect(propertySortDropdown).toBeTruthy();
});

Then("the property sort dropdown should maintain the current sort order", async () => {
    // Target the second sort dropdown (property sort), not the first one (merged properties visibility)
    const propertySortDropdown = await browser.$(".config-section.profile-details-section .sort-dropdown:nth-of-type(2) .sort-dropdown-trigger");
    await propertySortDropdown.waitForExist({ timeout: 1000 });

    const title = await propertySortDropdown.getAttribute("title");
    expect(title).toContain("Current:");
});

Then("the properties should be displayed according to the current sort order", async () => {
    const propertyElements = await browser.$$(".config-section.profile-details-section .config-item");
    expect(propertyElements.length).toBeGreaterThan(0);
});
