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
import { TreeItem } from "wdio-vscode-service";
import { Key } from "webdriverio";
import quickPick from "../../../__pageobjects__/QuickPick";

When(/the user has a (.*) profile in their (.*) tree/, async function (initialState: string, tree: string) {
    const isExpanded = initialState === "expanded";
    this.tree = tree;
    this.treePane = await paneDivForTree(tree);
    const visibleItems = ((await this.treePane.getVisibleItems()) as TreeItem[]).filter(
        async (treeItem) => (await treeItem.getLabel()) !== "Favorites"
    );
    this.profileNode = visibleItems.find(
        async (treeItem) => (await treeItem.isExpanded()) === isExpanded && (await treeItem.getLabel()) === process.env.ZE_TEST_PROFILE_NAME
    );
    await expect(this.profileNode).toBeDefined();
});

Then(/a user can (.*) a profile with a filter set/, async function (action: string) {
    if (action === "collapse") {
        await this.profileNode.collapse();
        await browser.waitUntil(async (): Promise<boolean> => !(await this.profileNode.isExpanded()));
    } else {
        await this.profileNode.expand();
        await browser.waitUntil((): Promise<boolean> => this.profileNode.isExpanded());
    }
});

Then("the user can set an existing filter on the profile", async function () {
    if (await this.profileNode.isExpanded()) {
        await this.profileNode.collapse();
    }
    await this.profileNode.elem.moveTo();

    // Locate and click on the search icon beside the profile node
    const actionButtons = await this.profileNode.getActionButtons();
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

    await browser.waitUntil((): Promise<boolean> => this.profileNode.isExpanded());
});
