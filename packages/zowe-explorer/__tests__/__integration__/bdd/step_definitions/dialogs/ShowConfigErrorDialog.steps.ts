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

import { Then, When } from "@cucumber/cucumber";
import { getZoweExplorerContainer } from "../../../../__common__/shared.wdio";
import { Notification, Workbench } from "wdio-vscode-service";

When("a user opens Zowe Explorer", async function () {
    this.zoweExplorerPane = await getZoweExplorerContainer();
    await expect(this.zoweExplorerPane).toBeDefined();
});

Then("the Show Config dialog should appear", async function () {
    this.workbench = await browser.getWorkbench();
    await browser.waitUntil(async () => (await this.workbench.getNotifications()).length > 0);
    const notifications: Notification[] = (await this.workbench.getNotifications()).filter(async (n) =>
        (await n.getActions()).find((action) => action.getTitle() === "Show Config")
    );
    await expect(notifications.length).toBeGreaterThan(0);
    this.configErrorDialog = notifications[0];
    await expect(this.configErrorDialog).toBeDefined();
    await (this.configErrorDialog as Notification).wait();
});

When('the user clicks on the "Show Config" button', async function () {
    const button = await this.configErrorDialog.elem.$("a[role='button']");
    await expect(button).toBeClickable();
    await button.click();
});

Then("the config should appear in the editor", async function () {
    const editorView = (this.workbench as Workbench).getEditorView();
    await editorView.wait();
    await browser.waitUntil(async () => (await editorView.getOpenEditorTitles()).length > 0);
    const editorTitles = await editorView.getOpenEditorTitles();
    await expect(editorTitles.some((editorTitle) => editorTitle.includes("zowe.config.json"))).toBe(true);
});
