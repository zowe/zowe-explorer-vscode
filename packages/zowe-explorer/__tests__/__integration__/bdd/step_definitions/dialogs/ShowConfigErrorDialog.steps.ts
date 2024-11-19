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

    let configNotification: Notification;
    const notificationCenter = await (this.workbench as Workbench).openNotificationsCenter();
    await browser.waitUntil(async () => {
        // Notification may be visible or hidden, handle both cases
        const notifications = [
            ...(await (this.workbench as Workbench).getNotifications()),
            ...(await notificationCenter.getNotifications("error" as any)),
        ];
        for (const n of notifications) {
            const msg = await n.getMessage();
            if (msg.startsWith("Error encountered when loading your Zowe config.")) {
                configNotification = n;
                return true;
            }
        }
        return false;
    });

    await expect(configNotification).toBeDefined();
    this.configErrorDialog = configNotification;
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
