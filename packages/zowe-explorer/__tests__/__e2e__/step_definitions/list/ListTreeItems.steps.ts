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
import { paneDivForTree } from "../../../__common__/shared.wdio";
import { Key } from "webdriverio";
import { ViewItemAction } from "wdio-vscode-service";
import quickPick from "../../../__pageobjects__/QuickPick";
import { ProfileNode } from "../../../__pageobjects__/ProfileNode";
import { ViewItemAction } from "wdio-vscode-service";

const testInfo = {
    profileName: process.env.ZE_TEST_PROFILE_NAME,
    dsFilter: process.env.ZE_TEST_DS_FILTER,
    pds: process.env.ZE_TEST_PDS,
    ussFilter: process.env.ZE_TEST_USS_FILTER,
    ussDir: process.env.ZE_TEST_USS_DIR.replace(`${process.env.ZE_TEST_USS_FILTER}/`, ""),
};

async function setFilterForProfile(profileNode: ProfileNode, tree: string): Promise<void> {
    let profileItem = await profileNode.find();

    // if the profile item is already expanded and has children, return
    if ((await profileItem.isExpanded()) && (await profileItem.hasChildren())) {
        return;
    }

    // hover and wait for action buttons to appear
    await profileItem.elem.moveTo();
    await browser.pause(500);

    let actionButtons: ViewItemAction[] = [];
    await browser.waitUntil(
        async () => {
            try {
                profileItem = await profileNode.find();
                await profileItem.elem.moveTo();
                actionButtons = await profileItem.getActionButtons();
                return actionButtons.length > 0;
            } catch {
                return false;
            }
        },
        {
            timeout: 5000,
            timeoutMsg: `Action buttons did not appear for the given node.`,
        }
    );

    profileItem = await profileNode.find();
    await profileItem.elem.moveTo();
    actionButtons = await profileItem.getActionButtons();

    // locate and select the search button
    const searchButton = actionButtons[actionButtons.length - 1];
    const isUss = tree.toLowerCase() === "uss" || tree.toLowerCase() === "unix system services (uss)";
    const isJobs = !isUss && tree.toLowerCase() === "jobs";
    await searchButton.wait();
    await searchButton.elem.waitForClickable({ timeout: 5000 });
    await searchButton.elem.click();

    // wait for the quick pick to be displayed
    await browser.waitUntil((): Promise<boolean> => quickPick.isDisplayed());

    if (isJobs) {
        const createFilterSelector = await quickPick.findItem("$(plus) Create job search filter");
        await expect(createFilterSelector).toBeClickable();
        await createFilterSelector.click();
        const submitSelector = await quickPick.findItem("$(check) Submit this query");
        await expect(submitSelector).toBeClickable();
        await submitSelector.click();
    } else {
        // Data sets or USS
        if (await quickPick.hasOptions()) {
            // Only click the "Create a new filter" button if there are existing filters and the option is presented
            const filterLabel = isUss
                ? "$(plus) Create a new filter"
                : "$(plus) Create a new filter. For example: HLQ.*, HLQ.aaa.bbb, HLQ.ccc.ddd(member)";

            const createFilterSelector = await quickPick.findItem(filterLabel);
            await expect(createFilterSelector).toBeClickable();
            await createFilterSelector.click();
        }
        const inputBox = await $('.input[aria-describedby="quickInput_message"]');
        await expect(inputBox).toBeClickable();
        await inputBox.setValue(isUss ? testInfo.ussFilter : testInfo.dsFilter);
        await browser.keys(Key.Enter);
    }

    await profileNode.waitUntilExpanded();
}

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
    await setFilterForProfile(this.profileNode, this.tree);
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
