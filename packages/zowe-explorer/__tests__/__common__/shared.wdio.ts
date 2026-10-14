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
import { ElementWithContextMenu, ViewContent, ViewControl, ViewSection } from "wdio-vscode-service";

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
