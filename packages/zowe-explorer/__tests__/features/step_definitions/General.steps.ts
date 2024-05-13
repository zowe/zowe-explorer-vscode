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
import { TreeItem, ViewSection } from "wdio-vscode-service";
import { Key } from "webdriverio";

//
// Scenario: User clicks on the "Zowe Explorer" icon in the Activity Bar
//
When("a user locates the Zowe Explorer icon in the side bar", async () => {
    const activityBar = (await browser.getWorkbench()).getActivityBar();
    const zeContainer = activityBar.getViewControl("Zowe Explorer");
    expect(zeContainer).toExist();
});
Then("the user can click on the Zowe Explorer icon", async () => {
    const activityBar = (await browser.getWorkbench()).getActivityBar();
    const zeContainer = await activityBar.getViewControl("Zowe Explorer");
    await zeContainer.openView();
});

//
// Scenario: User expands the Favorites node for each tree view
//
Given("a user who is looking at the Zowe Explorer tree views", async () => {
    const activityBar = (await browser.getWorkbench()).getActivityBar();
    await activityBar.wait();
    const zeContainer = await activityBar.getViewControl("Zowe Explorer");
    await zeContainer.wait();
    const zeView = await zeContainer.openView();
    await zeView.wait();
});

/* Helper functions */
async function paneDivForTree(tree: string): Promise<ViewSection> {
    const activityBar = (await browser.getWorkbench()).getActivityBar();
    await activityBar.wait();
    const zeContainer = await activityBar.getViewControl("Zowe Explorer");
    await zeContainer.wait();
    const sidebarContent = (await zeContainer.openView()).getContent();
    switch (tree.toLowerCase()) {
        case "data sets":
            return sidebarContent.getSection("DATA SETS");
        case "uss":
            return sidebarContent.getSection("UNIX SYSTEM SERVICES (USS)");
        case "jobs":
        default:
            return sidebarContent.getSection("JOBS");
    }
}

//
// Scenario: User collapses/expands the Favorites node
//
When(/a user collapses the Favorites node in the (.*) view/, async (tree: string) => {
    const pane = await paneDivForTree(tree);
    if (!pane.isExpanded()) {
        await pane.expand();
    }

    const favoritesItem = (await pane.findItem("Favorites")) as TreeItem;
    await favoritesItem.collapse();
});

When(/a user expands the Favorites node in the (.*) view/, async (tree: string) => {
    const pane = await paneDivForTree(tree);
    if (!pane.isExpanded()) {
        await pane.expand();
    }

    const favoritesItem = (await pane.findItem("Favorites")) as TreeItem;
    await favoritesItem.expand();
});

Then(/the Favorites node (.*) successfully in the (.*) view/, async (state: string, tree: string) => {
    const expandedState = state !== "collapses";

    const pane = await paneDivForTree(tree);
    const favoritesItem = (await pane.findItem("Favorites")) as TreeItem;
    await favoritesItem.wait();
    expect(await favoritesItem.isExpanded()).toBe(expandedState);
});

//
// Scenario: User clicks on the plus button to open the "Add Config/Profile" quick pick
//
When(/a user clicks the plus button in the (.*) view/, async (tree) => {
    const pane = await paneDivForTree(tree);
    if (!pane.isExpanded()) {
        await pane.expand();
    }

    const fullTreeName = tree === "USS" ? "Unix System Services (USS)" : tree;

    const plusIcon = await pane.getAction(`Add Profile to ${fullTreeName} View`);
    expect(plusIcon).toExist();
    (await pane.elem).moveTo();
    await browser.waitUntil(() => plusIcon.elem.isClickable());
    await plusIcon.elem.click();
});

Then("the Add Config quick pick menu appears", async () => {
    const elem = await $(await browser.findElement("css selector", ".quick-input-widget"));
    expect(elem).toExist();
    expect(elem).toBeDisplayedInViewport();
    await elem.click();

    // dismiss the quick pick after verifying that it is visible
    await browser.keys(Key.Escape);
});
