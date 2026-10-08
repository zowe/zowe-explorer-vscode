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
import { paneDivForTree } from "../../../../__common__/shared.wdio";
import { Then, When } from "@cucumber/cucumber";

//
// Scenario: User clicks on a profile node in a tree view
//
When(/a user clicks on the first profile in the (.*) view/, async function (tree: string) {
    const dsPane = await paneDivForTree(tree);
    // Wait for tree to be fully loaded and try to find the profile
    await browser.waitUntil(
        async () => {
            try {
                const items = await dsPane.getVisibleItems();
                return items.length > 0;
            } catch {
                return false;
            }
        },
        {
            timeout: 5000,
            timeoutMsg: `${tree} tree did not load within timeout`,
        }
    );
    const treeItems = (await dsPane.getVisibleItems()) as TreeItem[];
    // index is "1" because Favorites is the first node in the array
    await treeItems[1].select();
    this.selectedTreeItem = treeItems[1];
});
Then(/the profile node will (.*)/, async function (state: string) {
    const expandedState = await this.selectedTreeItem.elem.getAttribute("aria-expanded");
    const shouldBeExpanded = (state === "expand").toString();
    await expect(expandedState).toBe(shouldBeExpanded);
});
