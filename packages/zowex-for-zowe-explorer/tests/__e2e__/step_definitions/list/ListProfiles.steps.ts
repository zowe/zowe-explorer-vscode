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
import { paneDivForTree } from "../../../__common__/shared.wdio";
import { Key } from "webdriverio";
import quickPick from "../../../__pageobjects__/QuickPick";
import { ProfileNode } from "../../../__pageobjects__/ProfileNode";

When(/the user has a (.*) profile in their (.*) tree/, async function (initialState: string, tree: string) {
    const isExpanded = initialState === "expanded";
    this.tree = tree;
    this.treePane = await paneDivForTree(tree);
    this.profileNode = new ProfileNode(browser, this.treePane, process.env.ZE_TEST_PROFILE_NAME);
    await expect(await this.profileNode.find()).toBeDefined();
    await expect(await (await this.profileNode.find()).isExpanded()).toBe(isExpanded);
});

Then(/a user can (.*) a profile with a filter set/, async function (action: string) {
    if (action === "collapse") {
        await (await this.profileNode.find()).collapse();
    } else {
        await (await this.profileNode.find()).expand();
    }
    await this.profileNode.waitUntilExpanded(action === "expand");
});

Then("the user can set an existing filter on the profile", async function () {
    if (await (await this.profileNode.find()).isExpanded()) {
        await (await this.profileNode.find()).collapse();
    }
    await (await this.profileNode.find()).elem.moveTo();

    // Locate and click on the search icon beside the profile node
    const actionButtons = await (await this.profileNode.find()).getActionButtons();
    const searchButton = actionButtons[actionButtons.length - 1];
    await searchButton.wait();
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
    await browser.waitUntil((): Promise<boolean> => existingFilterSelector.isClickable());
    await existingFilterSelector.click();
    if (treeLowercased === "jobs") {
        // For the Jobs tree, the "Submit this query" entry will need selected after entering filter
        const submitEntry = await quickPick.findItem("$(check) Submit this query");
        await expect(submitEntry).toBeClickable();
        await submitEntry.click();
    } else {
        const inputBox = await $('.input[aria-describedby="quickInput_message"]');
        await expect(inputBox).toBeClickable();
        await browser.keys(Key.Enter);
    }

    await this.profileNode.waitUntilExpanded();
});
