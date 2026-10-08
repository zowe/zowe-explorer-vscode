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
import { paneDivForTree } from "../../../../__common__/shared.wdio";
import { ProfileNode } from "../../../../__pageobjects__/ProfileNode";
import { Key } from "webdriverio";

When(/a user clicks the filter search button on the '(.*)' profile in the '(.*)' tree/, async function (profileName: string, tree: string) {
    // Try to find the profile with retries
    this.tree = tree;
    this.treePane = await paneDivForTree(tree);
    this.profileNode = new ProfileNode(browser, this.treePane, profileName);
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        if (await this.profileNode.exists()) {
            break;
        }
        attempts++;
        if (attempts < maxAttempts) {
            await browser.pause(1000); // Wait before retrying
        }
    }
    await expect(await this.profileNode.find()).toBeDefined();
    let profileItem = await this.profileNode.find();
    // hover and wait for action buttons to appear
    await profileItem.elem.moveTo();
    await browser.pause(500);

    let actionButtons: ViewItemAction[] = [];
    await browser.waitUntil(
        async () => {
            try {
                profileItem = await this.profileNode.find();
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

    profileItem = await this.profileNode.find();
    await profileItem.elem.moveTo();
    actionButtons = await profileItem.getActionButtons();

    // locate and select the search button
    const searchButton = actionButtons[actionButtons.length - 1];
    await searchButton.wait();
    await searchButton.elem.waitForClickable({ timeout: 5000 });
    await searchButton.elem.click();
});

Then("the basic auth input should appear", async function () {
    const inputBox = await $('.input[placeholder="User Name"]');
    await expect(inputBox).toBeClickable();
    await browser.keys(Key.Escape);
});

Then(/the certificate wizard should appear with title '(.*)'/, async function (title: string) {
    const freshWorkbench = await browser.getWorkbench();
    const webviews = await freshWorkbench.getAllWebviews();
    expect(webviews.length).toBeGreaterThan(0);
    const certView = webviews[0];
    await certView.wait();
    await certView.open();

    const certInstructionsLabel = await browser.$('h3.=Select a certificate and certificate key in PEM format:');
    await certInstructionsLabel.waitForExist();
    const certWizardTitle = await browser.$(`h1.=${title}`);
    await certWizardTitle.waitForExist();
    const cancelButton = await browser.$(`#cancelButton`);
    await cancelButton.waitForExist();
    await cancelButton.click();
    await browser.switchFrame(null); // exit out of webview
});

