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
    await zeContainer.openView();
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

Then(/the Favorites node will (.*) successfully in the (.*) view/, async (state: string, tree: string) => {
    const expandedState = state !== "collapse";

    const pane = await paneDivForTree(tree);
    const favoritesItem = (await pane.findItem("Favorites")) as TreeItem;
    await favoritesItem.wait();
    expect(await favoritesItem.isExpanded()).toBe(expandedState);
});
