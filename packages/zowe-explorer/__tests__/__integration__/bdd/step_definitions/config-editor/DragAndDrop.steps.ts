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

import { Given, Then, When } from "@cucumber/cucumber";
import * as fs from "fs";
import * as path from "path";

declare const browser: any;
declare const expect: any;

const testInfo = {
    sourceProfile: "zosmf1",
    targetProfile: "zosmf2",
};

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

    // Check if zosmf2 profile exists
    const targetProfile = config.profiles[testInfo.targetProfile];
    expect(targetProfile).toBeDefined();

    // Check if zosmf1 is now a child of zosmf2
    // In Zowe config, nested profiles are stored in 'profiles' property, not 'children'
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
