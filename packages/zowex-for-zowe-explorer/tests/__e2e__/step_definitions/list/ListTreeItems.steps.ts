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
import quickPick from "../../../__pageobjects__/QuickPick";
import { ProfileNode } from "../../../__pageobjects__/ProfileNode";

const testInfo = {
    profileName: process.env.ZE_TEST_PROFILE_NAME,
    dsFilter: process.env.ZE_TEST_DS_FILTER,
    pds: process.env.ZE_TEST_PDS,
    ussFilter: process.env.ZE_TEST_USS_FILTER,
    ussDir: process.env.ZE_TEST_USS_DIR.replace(`${process.env.ZE_TEST_USS_FILTER}/`, ""),
};

async function setFilterForProfile(profileNode: ProfileNode, tree: string): Promise<void> {
    await (await profileNode.find()).elem.moveTo();
    const actionButtons = await (await profileNode.find()).getActionButtons();

    // Locate and select the search button on the profile node
    const searchButton = actionButtons[actionButtons.length - 1];
    const isUss = tree.toLowerCase() === "uss" || tree.toLowerCase() === "unix system services (uss)";
    const isJobs = !isUss && tree.toLowerCase() === "jobs";
    await searchButton.wait();
    await searchButton.elem.click();

    await browser.waitUntil((): Promise<boolean> => quickPick.isClickable());

    if (isJobs) {
        // Jobs
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
            timeout: 10000,
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
        const firstProfileEntry = await quickPick.findItemByIndex(2);
        await expect(firstProfileEntry).toBeClickable();
        await firstProfileEntry.click();
        this.yesOpt = await quickPick.findItem("Yes, Apply to all trees");
        await expect(this.yesOpt).toBeClickable();
        await this.yesOpt.click();

        // Wait for the profile to be added and then find it
        await browser.waitUntil((): Promise<boolean> => this.profileNode.exists(), {
            timeout: 10000,
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
    this.pds = await (await this.profileNode.find()).findChildItem(testInfo.pds);
    await expect(this.pds).toBeDefined();
    this.pds = await this.profileNode.revealChildItem(testInfo.pds);
    this.children = await this.pds.getChildren();
});
When("a user expands a USS directory in the list", async function () {
    this.ussDir = await (await this.profileNode.find()).findChildItem(testInfo.ussDir);
    await expect(this.ussDir).toBeDefined();
    this.ussDir = await this.profileNode.revealChildItem(testInfo.ussDir);
    this.children = await this.ussDir.getChildren();
});
Then("the node will expand and list its children", async function () {
    if (this.pds) {
        await expect(await this.pds.isExpanded()).toBe(true);
    } else {
        await expect(await this.ussDir.isExpanded()).toBe(true);
    }
});
Then("the user can select a child in the list and open it", async function () {
    await expect(this.children.length).not.toBe(0);
    await this.children[0].select();
});
