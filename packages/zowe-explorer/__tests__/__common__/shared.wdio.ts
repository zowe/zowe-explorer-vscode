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

import { Key } from "webdriverio";
import { ElementWithContextMenu, ViewContent, ViewControl, ViewItemAction, ViewSection } from "wdio-vscode-service";
import quickPick from "../__pageobjects__/QuickPick";

/* Helper functions */

/**
 * Fills the active VS Code quick-input box with {@link value} and confirms with Enter.
 */
export async function fillInputBox(value: string): Promise<void> {
    const inputBox = await browser.$('.input[aria-describedby="quickInput_message"]');
    await inputBox.waitForClickable({ timeout: 10000 });
    await inputBox.clearValue();
    await inputBox.setValue(value);
    await browser.keys(Key.Enter);
}

export async function getZoweExplorerContainer(): Promise<ViewControl> {
    const activityBar = (await browser.getWorkbench()).getActivityBar();
    const zeContainer = await activityBar.getViewControl("Zowe Explorer");
    await expect(zeContainer).toBeDefined();

    return zeContainer;
}

export async function paneDivForTree(tree: string): Promise<ViewSection> {
    const zeContainer = await getZoweExplorerContainer();
    // specifying type here as eslint fails to deduce return type
    const sidebarContent: ViewContent = (await zeContainer.openView()).getContent();
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

export async function clickContextMenuItem(treeItem: ElementWithContextMenu<any>, cmdName: string): Promise<void> {
    const ctxMenu = await treeItem.openContextMenu();
    const menuItem = await ctxMenu.getItem(cmdName);
    if (!menuItem) {
        await ctxMenu.close();
        throw new Error(`No context menu item with label '${cmdName}' found`);
    }
    await menuItem.elem.waitForClickable();
    await menuItem.elem.click();
}

export async function setFilterForProfile(profileNode: ProfileNode, tree: string, filter: string): Promise<void> {
    let profileItem = await profileNode.find();

    // if the profile item is already expanded and has children, return
    if ((await profileItem.isExpanded()) && (await profileItem.hasChildren())) {
        return;
    }

    // hover and wait for action buttons to appear
    await profileItem.elem.moveTo();
    await browser.pause(500);

    let actionButtons: ViewItemAction[] = [];
    await browser.waitUntil(
        async () => {
            try {
                profileItem = await profileNode.find();
                await profileItem.elem.moveTo();
                actionButtons = await profileItem.getActionButtons();
                return actionButtons.length > 0;
            } catch {
                return false;
            }
        },
        {
            timeout: 5000,
            timeoutMsg: `Action buttons did not appear for the given node.`,
        }
    );

    profileItem = await profileNode.find();
    await profileItem.elem.moveTo();
    actionButtons = await profileItem.getActionButtons();

    // locate and select the search button
    const searchButton = actionButtons[actionButtons.length - 1];
    const isUss = tree.toLowerCase() === "uss" || tree.toLowerCase() === "unix system services (uss)";
    const isJobs = !isUss && tree.toLowerCase() === "jobs";
    await searchButton.wait();
    await searchButton.elem.waitForClickable({ timeout: 5000 });
    await searchButton.elem.click();

    // wait for the quick pick to be displayed
    await browser.waitUntil((): Promise<boolean> => quickPick.isDisplayed());

    if (isJobs) {
        const createFilterSelector = await quickPick.findItem("$(plus) Create job search filter");
        await expect(createFilterSelector).toBeClickable();
        await createFilterSelector.click();
        const submitSelector = await quickPick.findItem("$(check) Submit this query");
        await expect(submitSelector).toBeClickable();
        await submitSelector.click();
    } else {
        // Data sets or USS
        if (await quickPick.hasOptions()) {
            // Only click the "Create a new filter" button if there are existing filters and the option is presented
            const filterLabel = isUss
                ? "$(plus) Create a new filter"
                : "$(plus) Create a new filter. For example: HLQ.*, HLQ.aaa.bbb, HLQ.ccc.ddd(member)";

            const createFilterSelector = await quickPick.findItem(filterLabel);
            await expect(createFilterSelector).toBeClickable();
            await createFilterSelector.click();
        }
        const inputBox = await $('.input[aria-describedby="quickInput_message"]');
        await expect(inputBox).toBeClickable();
        await inputBox.setValue(filter);
        await browser.keys(Key.Enter);
    }

    await profileNode.waitUntilExpanded();
}
