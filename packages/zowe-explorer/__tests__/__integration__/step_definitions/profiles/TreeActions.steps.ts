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

//
// Scenario: User wants to toggle a profile node in a tree view

import { TreeItem } from "wdio-vscode-service";
import { paneDivForTree } from "../shared.steps";
import { Then, When } from "@cucumber/cucumber";

//
// Scenario: User clicks on a profile node in a tree view
//
When(/a user clicks on the first profile in the (.*) view/, async function (tree: string) {
    const dsPane = await paneDivForTree(tree);
    const treeItems = (await dsPane.getVisibleItems()) as TreeItem[];
    await treeItems[1].select();
    this.selectedTreeItem = treeItems[1];
});
Then(/the profile node will (.*)/, async function (state: string) {
    const expandedState = await this.selectedTreeItem.elem.getAttribute("aria-expanded");
    const shouldBeExpanded = (state === "expand").toString();
    await expect(expandedState).toBe(shouldBeExpanded);
});

//
// Scenario: User clicks on a verified profile node in a tree view
//
When(/the first profile in the (.*) view is verified/, async function (_tree: string) {
    // TODO: requires a test system to validate behavior
});
Then("the profile will list its results based on the filter", async function () {
    // TODO: requires a test system to validate behavior
});
