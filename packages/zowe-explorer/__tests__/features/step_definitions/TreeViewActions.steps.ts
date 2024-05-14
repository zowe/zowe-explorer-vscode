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
        case "unix system services (uss)":
            return sidebarContent.getSection("UNIX SYSTEM SERVICES (USS)");
        case "jobs":
        default:
            return sidebarContent.getSection("JOBS");
    }
}

//
// Scenario: User collapses/expands the Favorites node
//
Given("a user who is looking at the Zowe Explorer tree views", async () => {
    const activityBar = (await browser.getWorkbench()).getActivityBar();
    await activityBar.wait();
    const zeContainer = await activityBar.getViewControl("Zowe Explorer");
    await zeContainer.wait();
    const zeView = await zeContainer.openView();
    await zeView.wait();
});
When(/a user (.*) the Favorites node in the (.*) view/, async (state: string, tree: string) => {
    const pane = await paneDivForTree(tree);
    const shouldExpand = state == "expands";

    if (!(await pane.isExpanded()) && shouldExpand) {
        await pane.expand();
    }

    const favoritesItem = (await pane.findItem("Favorites")) as TreeItem;
    if (shouldExpand) {
        await favoritesItem.expand();
    } else {
        await favoritesItem.collapse();
    }
});
Then(/the Favorites node (.*) successfully in the (.*) view/, async (state: string, tree: string) => {
    const expandedState = (state !== "collapses").toString();

    const pane = await paneDivForTree(tree);
    const favoritesItem = (await pane.findItem("Favorites")) as TreeItem;
    const expandedAttr = await (await favoritesItem.elem).getAttribute("aria-expanded");
    expect(expandedAttr).toBe(expandedState);
});

//
// Scenario: User clicks on the plus button to open the "Add Config/Profile" quick pick
//
When(/a user clicks the plus button in the (.*) view/, async (tree) => {
    const pane = await paneDivForTree(tree);
    if (!(await pane.isExpanded())) {
        await pane.expand();
    }

    const plusIcon = await pane.getAction(`Add Profile to ${tree} View`);
    expect(plusIcon).toExist();
    await (await pane.elem).moveTo();
    await plusIcon.elem.click();
});
Then("the Add Config quick pick menu appears", async () => {
    const elem = await $(".quick-input-widget");
    expect(elem).toBeDisplayedInViewport();

    // dismiss the quick pick after verifying that it is visible
    await browser.keys(Key.Escape);
    await elem.waitForDisplayed({ reverse: true });
});

//
// Scenario: User clicks on the context menu and hides a tree view
//
When(/a user hides the (.*) view using the context menu/, async (tree: string) => {
    const activityBar = (await browser.getWorkbench()).getActivityBar();
    const zeContainer = await activityBar.getViewControl("Zowe Explorer");
    const zeView = await zeContainer.openView();
    const zeTitlePart = zeView.getTitlePart();
    const ctxMenu = await zeTitlePart.openContextMenu();
    const menuItem = await ctxMenu.getItem(tree);
    await (await menuItem.elem).click();
});
Then(/the (.*) view is no longer displayed/, async (tree: string) => {
    const activityBar = (await browser.getWorkbench()).getActivityBar();
    const zeContainer = await activityBar.getViewControl("Zowe Explorer");
    const zeView = await zeContainer.openView();
    const sidebarContent = zeView.getContent();
    const visibleSections = await sidebarContent.getSections();
    expect(visibleSections.find(async (s) => (await s.getTitle()) === tree)).not.toBeDisplayedInViewport();

    // re-enable the view for the next scenario
    const zeTitlePart = zeView.getTitlePart();
    const ctxMenu = await zeTitlePart.openContextMenu();
    const menuItem = await ctxMenu.getItem(tree);
    await (await menuItem.elem).click();
    await ctxMenu.close();
});
