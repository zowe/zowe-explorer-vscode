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

//
// Scenario: User clicks on the "Zowe Explorer" icon in the Activity Bar
//
When("a user locates the Zowe Explorer icon in the side bar", async () => {
    (await browser.getWorkbench()).getSideBar();
    expect($('.action-item > a[aria-label="Zowe Explorer"]')).toExist();
});
Then("the user can click on the Zowe Explorer icon", () => {
    $('.action-item > a[aria-label="Zowe Explorer"]').click();
});

//
// Scenario: User expands the Favorites node for each tree view
//
Given("a user who is looking at the Zowe Explorer tree views", async () => {
    (await browser.getWorkbench()).getActivityBar();
    (await $('.action-item > a[aria-label="Zowe Explorer"]')).click();
});

/* Helper functions */
async function paneDivForTree(tree: string): Promise<ChainablePromiseElement> {
    switch (tree.toLowerCase()) {
        case "data sets":
            return $('div[aria-label="Data Sets Section"]');
        case "uss":
            return $('div[aria-label="Unix System Services (USS) Section"]');
        case "jobs":
        default:
            return $('div[aria-label="Jobs Section"]');
    }
}
async function favoritesDivInPane(pane: WebdriverIO.Element): Promise<ChainablePromiseElement> {
    return pane.parent.$('div[role="treeitem"][aria-label="Favorites"]');
}

When(/a user collapses the Favorites node in the (.*) view/, async (tree: string) => {
    const pane = await paneDivForTree(tree);
    if ((await pane.getAttribute("aria-expanded")) === "false") {
        await pane.click();
    }

    const favoritesNode = await favoritesDivInPane(pane);
    // once to expand...
    await favoritesNode.click();
    // once to collapse
    await favoritesNode.click();
});

When(/a user expands the Favorites node in the (.*) view/, async (tree: string) => {
    const pane = await paneDivForTree(tree);
    if ((await pane.getAttribute("aria-expanded")) === "false") {
        await pane.click();
    }

    const favoritesNode = await favoritesDivInPane(pane);
    await favoritesNode.click();
});

Then(/the Favorites node will (.*) successfully in the (.*) view/, async (state: string, tree: string) => {
    const expandedState = state !== "collapse" ? "true" : "false";

    const pane = await paneDivForTree(tree);
    const favoritesNode = await favoritesDivInPane(pane);
    expect(favoritesNode).toExist();
    expect(await favoritesNode.getAttribute("aria-expanded")).toBe(expandedState);
});
