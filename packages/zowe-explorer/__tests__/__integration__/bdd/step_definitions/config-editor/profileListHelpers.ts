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

import { Workbench } from "wdio-vscode-service";

declare const browser: any;

/**
 * Dismiss the tutorial overlay backdrop if it is currently blocking the UI.
 * The backdrop's onClick handler calls the tutorial's skip/close callback, so
 * a DOM-level click on it is all that is needed.
 */
export async function dismissTutorialOverlay(): Promise<void> {
    await browser.execute(() => {
        const backdrop = document.querySelector(".tutorial-overlay-backdrop") as HTMLElement | null;
        if (backdrop) {
            backdrop.click();
        }
    });
}

/**
 * Robust click helper for webview elements in CI.
 * Dismisses the tutorial overlay if present, then uses DOM-level scrollIntoView
 * (avoids Actions API / CDP commands that fail with
 * "unknown command: Browser.getWindowForTarget") and retries both a native
 * WebDriver click and a DOM-level fallback up to `attempts` times.
 */
export async function robustClick(element: any, attempts = 6, waitMsBetween = 300): Promise<void> {
    await dismissTutorialOverlay();
    await element.waitForExist({ timeout: 15000 });
    await element.waitForDisplayed({ timeout: 15000 });
    await browser.execute((el: HTMLElement) => el.scrollIntoView({ block: "center" }), element);

    let lastError: any = null;
    for (let i = 0; i < attempts; i++) {
        try {
            await element.click();
            return;
        } catch (err) {
            lastError = err;
            try {
                await browser.execute((el: HTMLElement) => el.click(), element);
                return;
            } catch (err2) {
                lastError = err2;
            }
        }
        await browser.pause(waitMsBetween);
    }
    throw lastError;
}

/**
 * Verify that profiles match expected titles in both tree and flat view modes.
 */
export async function verifyProfiles(
    expectedTreeTitles: string[],
    expectedFlatTitles: string[],
    workbench: Workbench
) {
    const profileList = await browser.$("[data-testid='profile-list']");
    const viewToggleButton = await browser.$("[data-testid='view-mode-toggle']");

    // Get tree view profiles
    const treeItems = await browser.$$("[data-testid='profile-tree-node']");
    const treeProfiles: string[] = [];
    for (const item of treeItems) {
        const profileName = await item.getAttribute("data-profile-name");
        if (profileName) treeProfiles.push(profileName);
    }

    for (const title of expectedTreeTitles) {
        expect(treeProfiles).toContain(title);
    }

    if (viewToggleButton) {
        const currentMode = await profileList.getAttribute("data-view-mode");
        if (currentMode === "tree") {
            await robustClick(viewToggleButton);
            await browser.waitUntil(
                async () => {
                    const updatedList = await browser.$("[data-testid='profile-list']");
                    const updatedMode = await updatedList.getAttribute("data-view-mode");
                    return updatedMode === "flat";
                },
                { timeout: 20000, timeoutMsg: "Failed to switch to flat view" }
            );

            // Get flat view profiles
            const flatItems = await browser.$$("[data-testid='profile-list-item']");
            const flatProfiles: string[] = [];
            for (const item of flatItems) {
                const profileName = await item.getAttribute("data-profile-name");
                if (profileName) flatProfiles.push(profileName);
            }

            const expectedFlatTitlesDefault = [
                "zosmf1",
                "zosmf2",
                "zosmf3",
                "base",
                "ssh1",
                "tso1",
                "zosmf-dev",
                "zosmf-prod",
                "test-profile",
                "special-chars",
                "nested",
                "nested.child1",
                "nested.child2",
            ];
            for (const title of expectedFlatTitlesDefault) {
                expect(flatProfiles).toContain(title);
            }
            expect(flatProfiles.length).toBe(expectedFlatTitlesDefault.length);

            await robustClick(viewToggleButton);
            await browser.waitUntil(
                async () => {
                    const updatedList = await browser.$("[data-testid='profile-list']");
                    const updatedMode = await updatedList.getAttribute("data-view-mode");
                    return updatedMode === "tree";
                },
                { timeout: 20000, timeoutMsg: "Failed to switch back to tree view" }
            );
        }
    }
}
