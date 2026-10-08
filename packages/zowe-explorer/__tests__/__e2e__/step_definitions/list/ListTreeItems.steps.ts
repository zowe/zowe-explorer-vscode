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
import { paneDivForTree, setFilterForProfile } from "../../../__common__/shared.wdio";
import quickPick from "../../../__pageobjects__/QuickPick";
import { ProfileNode } from "../../../__pageobjects__/ProfileNode";

const testInfo = {
    profileName: process.env.ZE_TEST_PROFILE_NAME,
    dsFilter: process.env.ZE_TEST_DS_FILTER,
    pds: process.env.ZE_TEST_PDS,
    ussFilter: process.env.ZE_TEST_USS_FILTER,
    ussDir: process.env.ZE_TEST_USS_DIR.replace(`${process.env.ZE_TEST_USS_FILTER}/`, ""),
};

Given(/the user has a profile in their (.*) tree/, async function (tree: string) {
    this.tree = tree;
    this.treePane = await paneDivForTree(tree);

    // Wait for tree to be fully loaded and try to find the profile
    await browser.waitUntil(
        async () => {
            try {
                const items = await this.treePane.getVisibleItems();
                return items.length > 0;
            } catch {
                return false;
            }
        },
        {
            timeout: 5000,
            timeoutMsg: `${tree} tree did not load within timeout`,
        }
    );

    // Try to find the profile with retries
    this.profileNode = new ProfileNode(browser, this.treePane, testInfo.profileName);
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        if (await this.profileNode.exists()) {
            break;
        }
        attempts++;
        if (attempts < maxAttempts) {
            await browser.pause(1000); // Wait before retrying
        }
    }

    // Only add profile if it really doesn't exist after all attempts
    if (attempts === maxAttempts) {
        // add profile via quick pick
        await this.treePane.elem.moveTo();
        const plusIcon = await this.treePane.getAction(`Add Profile to ${tree} View`);
        await expect(plusIcon).toBeDefined();
        await plusIcon.elem.click();
        await browser.waitUntil((): Promise<boolean> => quickPick.isClickable());
        const profileEntry = await quickPick.findItem(`$(home) ${testInfo.profileName}`);
        await expect(profileEntry).toBeClickable();
        await profileEntry.click();
        this.yesOpt = await quickPick.findItem("Yes, Apply to all trees");
        await expect(this.yesOpt).toBeClickable();
        await this.yesOpt.click();

        // Wait for the profile to be added and then find it
        await browser.waitUntil((): Promise<boolean> => this.profileNode.exists(), {
            timeout: 5000,
            timeoutMsg: `Profile ${testInfo.profileName} was not found after adding to ${tree} tree`,
        });
    }
});

When("a user sets a filter search on the profile", async function () {
    await expect(await this.profileNode.find()).toBeDefined();
    const isUss = this.tree.toLowerCase() === "uss" || this.tree.toLowerCase() === "unix system services (uss)";
    await setFilterForProfile(this.profileNode, this.tree, isUss ? testInfo.ussFilter : testInfo.dsFilter);
});
Then("the profile node will list results of the filter search", async function () {
    await expect(await (await this.profileNode.find()).isExpanded()).toBe(true);
    await this.profileNode.waitUntilHasChildren();
});
When("a user expands a PDS in the list", async function () {
    await browser.waitUntil(
        async () => {
            const pds = await (await this.profileNode.find()).findChildItem(testInfo.pds);
            if (!pds) return false;
            await pds.expand();
            const freshPds = await (await this.profileNode.find()).findChildItem(testInfo.pds);
            if (!freshPds) return false;
            const children = await freshPds.getChildren();
            if (children.length === 0) return false;
            this.pds = freshPds;
            this.children = children;
            return true;
        },
        { timeout: 5000, timeoutMsg: `${testInfo.pds} did not expand with children` }
    );
});
When("a user expands a USS directory in the list", async function () {
    await browser.waitUntil(
        async () => {
            const ussDir = await (await this.profileNode.find()).findChildItem(testInfo.ussDir);
            if (!ussDir) return false;
            await ussDir.expand();
            const freshUssDir = await (await this.profileNode.find()).findChildItem(testInfo.ussDir);
            if (!freshUssDir) return false;
            const children = await freshUssDir.getChildren();
            if (children.length === 0) return false;
            this.ussDir = freshUssDir;
            this.children = children;
            return true;
        },
        { timeout: 5000, timeoutMsg: `${testInfo.ussDir} did not expand with children` }
    );
});
When("a user expands a Job in the list", async function () {
    const profileItem = await this.profileNode.find();
    const jobs = await profileItem.getChildren();
    await expect(jobs.length).toBeGreaterThan(0);
    this.jobNode = jobs[0];
    await this.jobNode.expand();
    await browser.waitUntil(async () => await this.jobNode.hasChildren());
    this.children = await this.jobNode.getChildren();
});
Then("the node will expand and list its children", async function () {
    if (this.pds) {
        const freshPds = await (await this.profileNode.find()).findChildItem(testInfo.pds);
        expect(freshPds).toBeDefined();
        await expect(await freshPds!.isExpanded()).toBe(true);
        this.pds = freshPds!;
    } else if (this.ussDir) {
        const freshUssDir = await (await this.profileNode.find()).findChildItem(testInfo.ussDir);
        expect(freshUssDir).toBeDefined();
        await expect(await freshUssDir!.isExpanded()).toBe(true);
        this.ussDir = freshUssDir!;
    } else {
        await expect(await this.jobNode.isExpanded()).toBe(true);
    }
});
Then("the user can select a child in the list and open it", async function () {
    await expect(this.children.length).not.toBe(0);
    await this.children[0].select();
});
