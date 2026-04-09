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

import { Given, When, Then } from "@cucumber/cucumber";
import { expect } from "@wdio/globals";
import * as fs from "fs";
import * as path from "path";
import { restoreZoweConfig } from "../../features/config-editor/utils";

declare const browser: any;

function getConfigFilePath(): string {
    return path.join(process.cwd(), "..", "ci", "zowe.config.json");
}

function getNestedProfiles(holder: Record<string, unknown> | undefined): Record<string, unknown> {
    if (!holder || typeof holder !== "object") {
        return {};
    }
    const h = holder as { profiles?: Record<string, unknown>; children?: Record<string, unknown> };
    return (h.profiles || h.children || {}) as Record<string, unknown>;
}

/** Resolve a dotted profile path (e.g. zosmf2.zosmf1, nested.child1) in team config JSON. */
function getProfileAtDottedPath(config: { profiles?: Record<string, unknown> }, dottedKey: string): unknown {
    const top = config.profiles?.[dottedKey];
    if (top !== undefined) {
        return top;
    }
    const parts = dottedKey.split(".");
    if (!config.profiles?.[parts[0]]) {
        return undefined;
    }
    let cur: unknown = config.profiles[parts[0]];
    for (let i = 1; i < parts.length; i++) {
        const kids = getNestedProfiles(cur as Record<string, unknown>);
        cur = kids[parts[i]];
        if (cur === undefined) {
            return undefined;
        }
    }
    return cur;
}

Given("the zowe team config file is restored from backup", async () => {
    await restoreZoweConfig();
});

When("the user refreshes the Config Editor from disk", async () => {
    const refreshBtn = await browser.$(".footer > button");
    await refreshBtn.waitForExist({ timeout: 10000 });
    await refreshBtn.click();
    await browser.pause(800);
});

Then("the Config Editor profile list is in tree view mode after reload", async () => {
    /* Stay in webview context — do not call getWorkbench() (it waits on .monaco-workbench and fails here). */
    await browser.pause(400);
    const app = await browser.$("[data-testid='config-editor-app']");
    await app.waitForExist({ timeout: 20000 });
    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 5000 });
    const viewMode = await profileList.getAttribute("data-view-mode");
    if (viewMode !== "tree") {
        const viewToggleButton = await browser.$("[data-testid='view-mode-toggle']");
        await viewToggleButton.waitForExist({ timeout: 1000 });
        await viewToggleButton.click();
        await browser.pause(50);
        await browser.waitUntil(
            async () => (await (await browser.$("[data-testid='profile-list']")).getAttribute("data-view-mode")) === "tree",
            { timeout: 2000, timeoutMsg: "Failed to switch to tree view after reload" }
        );
    }
    expect(await profileList.getAttribute("data-view-mode")).toBe("tree");
});

async function ensureTreeView(): Promise<void> {
    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 1000 });
    const viewMode = await profileList.getAttribute("data-view-mode");
    if (viewMode !== "tree") {
        const viewToggleButton = await browser.$("[data-testid='view-mode-toggle']");
        await viewToggleButton.waitForExist({ timeout: 1000 });
        await viewToggleButton.click();
        await browser.pause(100);
        await browser.waitUntil(
            async () => {
                const updated = await browser.$("[data-testid='profile-list']");
                return (await updated.getAttribute("data-view-mode")) === "tree";
            },
            { timeout: 1000, timeoutMsg: "Failed to switch to tree view" }
        );
    }
    await browser.waitUntil(
        async () => (await browser.$$("[data-testid='profile-tree-node']")).length > 0,
        { timeout: 10000, timeoutMsg: "Profile tree not loaded within timeout" }
    );
}

async function getTreeNodeByProfileKey(profileKey: string) {
    const el = await browser.$(`[data-testid='profile-tree-node'][data-profile-key='${profileKey}']`);
    await el.waitForExist({ timeout: 1000 });
    await el.waitForDisplayed({ timeout: 1000 });
    return el;
}

/** Root-level row only — needed when the same profile name could appear at multiple depths after pending renames. */
async function getTreeNodeByProfileKeyAtRootLevel(profileKey: string) {
    const el = await browser.$(
        `[data-testid='profile-tree-node'][data-profile-key='${profileKey}'][data-profile-level='0']`
    );
    await el.waitForExist({ timeout: 3000 });
    await el.waitForDisplayed({ timeout: 3000 });
    return el;
}

function profileTreeNodeSelector(profileKey: string, rootOnly: boolean): string {
    if (rootOnly) {
        return `[data-testid='profile-tree-node'][data-profile-key='${profileKey}'][data-profile-level='0']`;
    }
    return `[data-testid='profile-tree-node'][data-profile-key='${profileKey}']`;
}

/** Avoid `Element.scrollIntoView()` — WDIO tries CDP `Browser.getWindowForTarget`, which 404s in this harness before falling back. */
async function scrollProfileTreeNodeIntoView(profileKey: string, rootOnly: boolean): Promise<void> {
    const sel = profileTreeNodeSelector(profileKey, rootOnly);
    await browser.execute((s: string) => {
        document.querySelector(s)?.scrollIntoView({ block: "center", inline: "nearest" });
    }, sel);
}

/**
 * WebdriverIO dragAndDrop does not reliably fire HTML5 drag on the profile row twice in one session;
 * dispatch dragstart → (delay for React state) → dragover/drop/dragend in the webview document.
 */
async function performProfileTreeHtml5DragDrop(sourceSelector: string, targetSelector: string): Promise<void> {
    const err = await browser.executeAsync(
        function (sourceSel: string, targetSel: string, done: (e: string | null) => void) {
            const src = document.querySelector(sourceSel);
            const tgt = document.querySelector(targetSel);
            if (!src || !tgt) {
                done(`missing element: src=${Boolean(src)} tgt=${Boolean(tgt)}`);
                return;
            }
            const srcItem = src.querySelector(".profile-tree-item");
            const tgtItem = tgt.querySelector(".profile-tree-item");
            if (!srcItem || !tgtItem) {
                done("missing .profile-tree-item");
                return;
            }
            src.scrollIntoView({ block: "center", inline: "nearest" });
            tgt.scrollIntoView({ block: "center", inline: "nearest" });
            const dt = new DataTransfer();
            srcItem.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
            setTimeout(() => {
                tgtItem.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
                tgtItem.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
                srcItem.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer: dt }));
                done(null);
            }, 150);
        },
        sourceSelector,
        targetSelector
    );
    if (err) {
        throw new Error(String(err));
    }
    await browser.pause(500);
}

Given("the user expands the profile tree node {string}", async (profileKey: string) => {
    await ensureTreeView();
    const node = await getTreeNodeByProfileKey(profileKey);
    const expandChevron = await node.$(".profile-tree-chevron.codicon-chevron-right");
    if (await expandChevron.isExisting()) {
        await expandChevron.click();
        await browser.pause(150);
    }
});

Given("the drag drop source is profile key {string}", async function (profileKey: string) {
    await ensureTreeView();
    this.dragSourceKey = profileKey;
    this.dragSourceRootOnly = false;
    this.sourceProfile = await getTreeNodeByProfileKey(profileKey);
});

Given("the drag drop source is profile key {string} at root level in the tree", async function (profileKey: string) {
    await ensureTreeView();
    this.dragSourceKey = profileKey;
    this.dragSourceRootOnly = true;
    this.sourceProfile = await getTreeNodeByProfileKeyAtRootLevel(profileKey);
});

When("the user starts dragging the prepared profile key source", async function () {
    await this.sourceProfile.waitForExist({ timeout: 1000 });
    await this.sourceProfile.waitForDisplayed({ timeout: 1000 });
    await scrollProfileTreeNodeIntoView(this.dragSourceKey as string, Boolean(this.dragSourceRootOnly));
    this.sourceElement = this.sourceProfile;
});

When("the user drops the drag on profile key {string}", async function (targetProfileKey: string) {
    this.dragTargetKey = targetProfileKey;
    this.targetProfile = await getTreeNodeByProfileKey(targetProfileKey);
    this.targetElement = this.targetProfile;
    await this.sourceElement.waitForDisplayed({ timeout: 5000 });
    await this.targetElement.waitForDisplayed({ timeout: 5000 });
    const sourceSel = profileTreeNodeSelector(this.dragSourceKey as string, Boolean(this.dragSourceRootOnly));
    const targetSel = profileTreeNodeSelector(targetProfileKey, false);
    await performProfileTreeHtml5DragDrop(sourceSel, targetSel);
});

When("the user drops the drag on profile key {string} at root level in the tree", async function (targetProfileKey: string) {
    this.dragTargetKey = targetProfileKey;
    this.targetProfile = await getTreeNodeByProfileKeyAtRootLevel(targetProfileKey);
    this.targetElement = this.targetProfile;
    await this.sourceElement.waitForDisplayed({ timeout: 5000 });
    await this.targetElement.waitForDisplayed({ timeout: 5000 });
    const sourceSel = profileTreeNodeSelector(this.dragSourceKey as string, Boolean(this.dragSourceRootOnly));
    const targetSel = profileTreeNodeSelector(targetProfileKey, true);
    await performProfileTreeHtml5DragDrop(sourceSel, targetSel);
});

Then("the profile at dotted path {string} should exist in the config file", async (dottedPath: string) => {
    const configContent = fs.readFileSync(getConfigFilePath(), "utf8");
    const config = JSON.parse(configContent);
    const profile = getProfileAtDottedPath(config, dottedPath);
    expect(profile).toBeDefined();
});

Then("the chained zosmf profile zosmf1 under zosmf2 under zosmf3 should exist in the config file", async () => {
    const configContent = fs.readFileSync(getConfigFilePath(), "utf8");
    const config = JSON.parse(configContent);
    const zosmf2Under3 = getProfileAtDottedPath(config, "zosmf3.zosmf2");
    expect(zosmf2Under3).toBeDefined();
    const leaf = getNestedProfiles(zosmf2Under3 as Record<string, unknown>).zosmf1;
    expect(leaf).toBeDefined();
});

Then("the profile at dotted path {string} should not exist in the config file", async (dottedPath: string) => {
    const configContent = fs.readFileSync(getConfigFilePath(), "utf8");
    const config = JSON.parse(configContent);
    const profile = getProfileAtDottedPath(config, dottedPath);
    expect(profile).toBeUndefined();
});

Then("the profile {string} should still be a root profile in the config file", async (rootName: string) => {
    const configContent = fs.readFileSync(getConfigFilePath(), "utf8");
    const config = JSON.parse(configContent);
    expect(config.profiles?.[rootName]).toBeDefined();
});

Then("profile key {string} should appear under profile key {string} in the tree", async (childKey: string, parentKey: string) => {
    const shortName = childKey.split(".").pop() || childKey;
    const targetChildren = await browser.$$(`[data-testid='profile-tree-node'][data-profile-key='${parentKey}'] [data-testid='profile-tree-node']`);
    let found = null;
    for (const child of targetChildren) {
        const pk = await child.getAttribute("data-profile-key");
        const name = await child.getAttribute("data-profile-name");
        if (pk === childKey || name === shortName) {
            found = child;
            break;
        }
    }
    await expect(found).toBeDefined();
    await found!.waitForDisplayed({ timeout: 1000 });
});
