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

import { Given, Then, When, IWorld } from "@cucumber/cucumber";
import { paneDivForTree } from "../shared.steps";
import { TreeItem } from "wdio-vscode-service";
import { Key } from "webdriverio";

const testInfo = {
    profileName: process.env.ZE_TEST_PROFILE_NAME,
    dsFilter: process.env.ZE_TEST_DS_FILTER,
    pds: process.env.ZE_TEST_PDS,
    ussFilter: process.env.ZE_TEST_USS_FILTER,
    ussDir: process.env.ZE_TEST_USS_DIR.replace(`${process.env.ZE_TEST_USS_FILTER}/`, ""),
};

async function setFilterForProfile(world: IWorld, profileNode: TreeItem, tree: string): Promise<void> {
    await profileNode.elem.moveTo();
    const actionButtons = await profileNode.getActionButtons();

    // Locate and select the search button on the profile node
    const searchButton = actionButtons[actionButtons.length - 1];
    const isUss = tree.toLowerCase() === "uss" || tree.toLowerCase() === "unix system services (uss)";
    const isJobs = !isUss && tree.toLowerCase() === "jobs";
    await searchButton.elem.waitForClickable();
    await searchButton.elem.click();
    world.filterQuickPick = await $(".quick-input-widget");
    await world.filterQuickPick.waitForClickable();

    if (isJobs) {
        // Jobs
        const createFilterSelector = await $(`.monaco-list-row[aria-label="plus  Create job search filter"]`);
        await createFilterSelector.waitForClickable();
        await createFilterSelector.click();
        const submitSelector = await $(`.monaco-list-row[aria-label="check  Submit this query"]`);
        await expect(submitSelector).toBeDefined();
        await submitSelector.click();
    } else {
        // Data sets or USS
        const filterLabel = isUss ? "plus  Create a new filter" : "plus  Create a new filter. For example: HLQ.*, HLQ.aaa.bbb, HLQ.ccc.ddd(member)";
        const createFilterSelector = (await $$(`.monaco-list-row[aria-label="${filterLabel}"]`))?.[0];
        if (createFilterSelector != undefined) {
            await createFilterSelector.waitForClickable();
            await createFilterSelector.click();
        }
        const inputBox = await $('.input[aria-describedby="quickInput_message"]');
        await expect(inputBox).toBeClickable();
        await inputBox.addValue(isUss ? testInfo.ussFilter : testInfo.dsFilter);
        await browser.keys(Key.Enter);
    }

    await browser.waitUntil(async () => profileNode.isExpanded());
}

Given(/the user has a profile in their (.*) tree/, async function (tree: string) {
    this.tree = tree;
    this.treePane = await paneDivForTree(tree);
    this.profileNode = (await this.treePane.findItem(testInfo.profileName)) as TreeItem;
    if (this.profileNode == undefined) {
        // add profile via quick pick
        await this.treePane.elem.moveTo();
        const plusIcon = await this.treePane.getAction(`Add Profile to ${tree} View`);
        await expect(plusIcon).toBeDefined();
        await plusIcon.elem.click();
        this.addConfigQuickPick = await $(".quick-input-widget");
        await this.addConfigQuickPick.waitForClickable();
        const firstProfileEntry = await this.addConfigQuickPick.$('.monaco-list-row[data-index="2"]');
        await firstProfileEntry.waitForClickable();
        await firstProfileEntry.click();
        this.yesOpt = await $('.monaco-list-row[aria-label="Yes, Apply to all trees"]');
        await expect(this.yesOpt).toBeDefined();
        await this.yesOpt.click();
        this.profileNode = (await this.treePane.findItem(testInfo.profileName)) as TreeItem;
    }
});

When("a user sets a filter search on the profile", async function () {
    await expect(this.profileNode).toBeDefined();
    await setFilterForProfile(this, this.profileNode, this.tree);
});
Then("the profile node will list results of the filter search", async function () {
    await expect(await this.profileNode.isExpanded()).toBe(true);
    await browser.waitUntil(async () => (await this.profileNode.getChildren()).length > 0);
});
When("a user expands a PDS in the list", async function () {
    this.pds = await this.profileNode.findChildItem(testInfo.pds);
    await expect(this.pds).toBeDefined();
    await this.pds.expand();
    await browser.waitUntil(async () => (await this.pds.getChildren()).length > 0);
    this.children = await this.pds.getChildren();
});
When("a user expands a USS directory in the list", async function () {
    this.ussDir = await this.profileNode.findChildItem(testInfo.ussDir);
    await expect(this.ussDir).toBeDefined();
    await this.ussDir.expand();
    await browser.waitUntil(async () => (await this.ussDir.getChildren()).length > 0);
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
