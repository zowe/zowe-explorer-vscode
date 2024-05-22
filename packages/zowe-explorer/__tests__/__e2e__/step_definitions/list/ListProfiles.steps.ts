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
import { paneDivForTree } from "../shared.steps";
import { TreeItem } from "wdio-vscode-service";
import { Key } from "webdriverio";

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
        await browser.waitUntil(async () => !(await this.profileNode.isExpanded()));
    } else {
        await this.profileNode.expand();
        await browser.waitUntil(async () => await this.profileNode.isExpanded());
    }
});

Then("the user can set an existing filter on the profile", async function () {
    if (await this.profileNode.isExpanded()) {
        await this.profileNode.collapse();
    }
    await this.profileNode.elem.moveTo();
    const actionButtons = await this.profileNode.getActionButtons();
    const searchButton = actionButtons[actionButtons.length - 1];
    await searchButton.elem.click();
    const quickInput = await $(".quick-input-widget");
    await quickInput.waitForClickable();

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
    const existingFilterSelector = await $(`.monaco-list-row[role="option"][aria-label="${getFilter(treeLowercased)}, Recent Filters"]`);
    await expect(existingFilterSelector).toBeClickable();
    await existingFilterSelector.click();
    if (treeLowercased === "jobs") {
        const submitEntry = await $(`.monaco-list-row[role="option"][data-index="0"]`);
        await expect(submitEntry).toBeClickable();
        await submitEntry.click();
    } else {
        await browser.keys(Key.Enter);
    }

    await browser.waitUntil(async () => await this.profileNode.isExpanded());
});
