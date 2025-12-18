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

import { Then, When } from "@cucumber/cucumber";
import { paneDivForTree, TreeHelpers } from "../../../__common__/shared.wdio";
import { Key } from "webdriverio";
import quickPick from "../../../__pageobjects__/QuickPick";

When(/the user has a (.*) profile in their (.*) tree/, async function (initialState: string, tree: string) {
    const isExpanded = initialState === "expanded";
    this.tree = tree;
    this.treePane = await paneDivForTree(tree);
    this.helpers = new TreeHelpers(this.treePane, process.env.ZE_TEST_PROFILE_NAME);
    await expect(await this.helpers.getProfileNode()).toBeDefined();
    await expect(await this.helpers.mProfileNode.isExpanded()).toBe(isExpanded);
});

Then(/a user can (.*) a profile with a filter set/, async function (action: string) {
    if (action === "collapse") {
        await this.helpers.mProfileNode.collapse();
        await browser.waitUntil(async (): Promise<boolean> => !(await (await this.helpers.getProfileNode()).isExpanded()));
    } else {
        await this.helpers.mProfileNode.expand();
        await browser.waitUntil(async (): Promise<boolean> => (await this.helpers.getProfileNode()).isExpanded());
    }
});

Then("the user can set an existing filter on the profile", async function () {
    if (await this.helpers.mProfileNode.isExpanded()) {
        await this.helpers.mProfileNode.collapse();
    }
    await this.helpers.mProfileNode.elem.moveTo();

    // Locate and click on the search icon beside the profile node
    const actionButtons = await this.helpers.mProfileNode.getActionButtons();
    const searchButton = actionButtons[actionButtons.length - 1];
    await searchButton.elem.click();

    await browser.waitUntil((): Promise<boolean> => quickPick.isClickable());

    // Simple arrow function to build the filter used in quick pick
    const getFilter = (tree: string): string => {
        switch (tree) {
            case "data sets":
                return process.env.ZE_TEST_DS_FILTER;
            case "uss":
                return process.env.ZE_TEST_USS_FILTER;
            case "jobs":
                return `Owner: ${process.env.ZE_TEST_PROFILE_USER} | Prefix: * | Status: *`;
        }
    };

    const treeLowercased = this.tree.toLowerCase();
    // Add ", Recent Filters" suffix to label as it is added by VS Code in DOM
    const existingFilterSelector = await quickPick.findItem(`${getFilter(treeLowercased)}, Recent Filters`);
    await expect(existingFilterSelector).toBeClickable();
    await existingFilterSelector.click();
    if (treeLowercased === "jobs") {
        // For the Jobs tree, the "Submit this query" entry will need selected after entering filter
        const submitEntry = await quickPick.findItemByIndex(0);
        await expect(submitEntry).toBeClickable();
        await submitEntry.click();
    } else {
        await browser.keys(Key.Enter);
    }

    await browser.waitUntil(async (): Promise<boolean> => (await this.helpers.getProfileNode()).isExpanded());
});
