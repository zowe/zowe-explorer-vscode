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

import { execFile } from "child_process";
import { ElementWithContextMenu, ViewContent, ViewControl, ViewSection } from "wdio-vscode-service";

/* Helper functions */

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
    if (process.platform !== "darwin") {
        const ctxMenu = await treeItem.openContextMenu();
        const menuItem = await ctxMenu.getItem(cmdName);
        await (await menuItem.elem).click();
    } else {
        // Open native context menu without waiting for element to be displayed
        const contextMenuLocators = treeItem.locatorMap.ContextMenu as any;
        const workbench = browser.$((treeItem.locatorMap.Workbench as any).elem);
        const menus = await browser.$$(contextMenuLocators.contextView);
        if (menus.length < 1) {
            await treeItem.elem.click({ button: 2 });
            await browser.$(contextMenuLocators.contextView).waitForExist({ timeout: 2000 });
        } else {
            if ((await workbench.$$(contextMenuLocators.viewBlock).length) > 0) {
                await treeItem.elem.click({ button: 2 });
                await treeItem.elem.waitForDisplayed({ reverse: true, timeout: 1000 });
            }
            await treeItem.elem.click({ button: 2 });
        }
        await browser.pause(1000); // Wait for menu to load

        // AppleScript fallback: use keyboard navigation with type-ahead search
        return new Promise((resolve, reject) => {
            const keyboardScript = `
                tell application "System Events"
                    -- Jump to top of menu
                    key code 126 using {option down} -- Option+Up arrow
                    delay 0.1

                    -- Type the command name quickly for type-ahead search
                    keystroke "${cmdName}"
                    delay 0.2

                    -- Press Return/Enter to select
                    key code 36 -- Return/Enter
                    return "success"
                end tell
            `;
            execFile("osascript", ["-e", keyboardScript], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
}
