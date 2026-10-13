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

import { browser } from "@wdio/globals";
import { dismissTutorialOverlay, waitForSaveOverlayGone } from "../__integration__/bdd/step_definitions/config-editor/profileListHelpers";

export type ConfigEditorLayer = "Global Team" | "Global User";

const LAYER_IDS: Record<ConfigEditorLayer, string> = {
    "Global Team": "global:true,user:false",
    "Global User": "global:true,user:true",
};
const TIMEOUT = 10000;

/** Tree context menus and configuration tabs inside the Config Editor webview. */
export class ConfigEditorContextMenu {
    private nodeSelector(profileKey: string): string {
        return `[data-testid="profile-tree-node"][data-profile-key=${JSON.stringify(profileKey)}]`;
    }

    private layerSelector(layer: ConfigEditorLayer): string {
        return `.tabs .tab[id="${LAYER_IDS[layer]}"]`;
    }

    public async closeTutorial(): Promise<void> {
        if (!(await (await browser.$("[data-testid='config-editor-app']")).isExisting())) {
            const workbench = await browser.getWorkbench();
            const webview = (await workbench.getAllWebviews())[0];
            if (!webview) throw new Error("Config Editor webview is not open");
            await webview.wait();
            await webview.open();
        }
        // CONFIGURATIONS also opens the first-run tutorial, so wait for its UI before dismissing it.
        await (await browser.$(".tabs .tab.active")).waitForExist({ timeout: TIMEOUT });
        await dismissTutorialOverlay();
    }

    public async selectLayer(layer: ConfigEditorLayer): Promise<void> {
        await waitForSaveOverlayGone();
        await this.closeTutorial();
        const tab = await browser.$(this.layerSelector(layer));
        await tab.waitForDisplayed({ timeout: TIMEOUT });
        await tab.click();
        await browser.waitUntil(async () => (await tab.getAttribute("class")).split(" ").includes("active"), {
            timeout: TIMEOUT,
            timeoutMsg: `${layer} configuration was not selected`,
        });
    }

    public async createGlobalUserLayer(): Promise<void> {
        await this.closeTutorial();
        await (await browser.$("#add-config-layer-button")).click();
        const option = await browser.$('.config-editor-modal-panel--add-config [id="global:true,user:true"]');
        await option.waitForDisplayed({ timeout: TIMEOUT });
        if (!(await option.isEnabled())) throw new Error("Global User configuration already exists in the context-menu test fixture");
        await option.click();
        await (await browser.$(this.layerSelector("Global User"))).waitForExist({ timeout: TIMEOUT });
        await this.selectLayer("Global User");
    }

    public async revealNode(profileKey: string): Promise<WebdriverIO.Element> {
        await this.closeTutorial();
        const parts = profileKey.split(".");
        for (let depth = 1; depth < parts.length; depth++) {
            const parent = await browser.$(this.nodeSelector(parts.slice(0, depth).join(".")));
            await parent.waitForExist({ timeout: TIMEOUT });
            const chevron = await parent.$(":scope > .profile-tree-item .profile-tree-chevron.codicon-chevron-right");
            if (await chevron.isExisting()) await chevron.click();
        }
        const node = await browser.$(this.nodeSelector(profileKey));
        await node.waitForDisplayed({ timeout: TIMEOUT });
        return node.getElement();
    }

    public async openOnNode(profileKey: string): Promise<void> {
        await waitForSaveOverlayGone();
        await dismissTutorialOverlay();
        const node = await this.revealNode(profileKey);
        const row = await node.$(".profile-tree-item");
        // Avoid WDIO's CDP scroll fallback, which is unsupported by some VS Code versions.
        await browser.execute((element: HTMLElement) => element.scrollIntoView({ block: "center" }), row);
        await row.click({ button: "right" });
        await (await browser.$(".tab-context-menu")).waitForDisplayed({ timeout: TIMEOUT });
    }

    public async getOptions(): Promise<{ option: string; state: string }[]> {
        const menu = await browser.$(".tab-context-menu");
        await menu.waitForDisplayed({ timeout: TIMEOUT });
        const options: { option: string; state: string }[] = [];
        for (const item of await menu.$$(".tab-context-menu-item")) {
            options.push({
                option: (await item.getText()).trim(),
                state: (await item.getAttribute("class")).split(" ").includes("disabled") ? "disabled" : "enabled",
            });
        }
        return options;
    }

    public async choose(option: string): Promise<void> {
        const menu = await browser.$(".tab-context-menu");
        await menu.waitForDisplayed({ timeout: TIMEOUT });
        for (const item of await menu.$$(".tab-context-menu-item")) {
            if ((await item.getText()).trim() !== option) continue;
            if ((await item.getAttribute("class")).split(" ").includes("disabled")) throw new Error(`Context menu option ${option} is disabled`);
            await item.click();
            await menu.waitForExist({ timeout: TIMEOUT, reverse: true });
            return;
        }
        throw new Error(`Context menu option ${option} was not found`);
    }

    public async dismiss(): Promise<void> {
        await browser.keys("Escape");
        await (await browser.$(".tab-context-menu")).waitForExist({ timeout: TIMEOUT, reverse: true });
    }

    public async waitForNode(profileKey: string, present: boolean): Promise<void> {
        if (present) await this.revealNode(profileKey);
        else await (await browser.$(this.nodeSelector(profileKey))).waitForExist({ timeout: TIMEOUT, reverse: true });
    }

    public async waitForCut(profileKey: string): Promise<void> {
        const node = await this.revealNode(profileKey);
        await (await node.$(":scope > .profile-tree-item.is-cut")).waitForExist({ timeout: TIMEOUT });
    }

    public async expandDefaults(): Promise<void> {
        await this.closeTutorial();
        const content = await browser.$(".panel.active .defaults-content");
        if (!(await content.isExisting()) || !(await content.isDisplayed())) {
            await (await browser.$(".panel.active .defaults-toggle-button")).click();
        }
        await content.waitForDisplayed({ timeout: TIMEOUT });
    }

    public async waitForUnsavedLayer(layer: ConfigEditorLayer): Promise<void> {
        const tab = await browser.$(this.layerSelector(layer));
        await (await tab.$(".tab-unsaved-indicator")).waitForExist({ timeout: TIMEOUT });
    }
}

export default new ConfigEditorContextMenu();
