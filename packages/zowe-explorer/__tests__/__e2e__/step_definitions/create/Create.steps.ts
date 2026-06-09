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

import { When, Then } from "@cucumber/cucumber";
import { clickContextMenuItem } from "../../../__common__/shared.wdio";
import { Key } from "webdriverio";
import quickPick from "../../../__pageobjects__/QuickPick";

const filterBase = (process.env.ZE_TEST_DS_FILTER ?? "TEST*").replace(/\.\*?$|\*$/, "").replace(/\.$/, "");
const testPsName = `${filterBase}.NEWPS`;
const testPdsName = `${filterBase}.NEWPDS`;
const testMemberName = "NEWMEM";

When("the user right-clicks on the dataset profile and selects {string}", async function (contextMenuOption: string) {
    const profileNode = await this.profileNode.find();
    await profileNode.elem.moveTo();
    await clickContextMenuItem(profileNode, contextMenuOption);
});

When("enters a new valid sequential dataset name", async function () {
    // ZE createFile wizard — Step 1: enter the dataset name
    const nameInputBox = await $('.input[aria-describedby="quickInput_message"]');
    await nameInputBox.waitForDisplayed();
    this.newPsName = testPsName;
    await nameInputBox.setValue(testPsName);
    await browser.keys(Key.Enter);

    // Step 2: select dataset type
    await browser.waitUntil((): Promise<boolean> => quickPick.isClickable());
    const typeOption = await quickPick.findItem("Sequential Data Set");
    await expect(typeOption).toBeClickable();
    await typeOption.click();

    // Step 3: allocate immediately with default attributes (skip "Edit Attributes")
    await browser.waitUntil((): Promise<boolean> => quickPick.isClickable());
    const allocateOption = await quickPick.findItem("+ Allocate Data Set");
    await expect(allocateOption).toBeClickable();
    await allocateOption.click();
});

Then("the new sequential dataset should be created successfully", async function () {
    await browser.pause(3000);
});

Then("the new dataset should appear in the Data Sets list", async function () {
    await browser.waitUntil(async () => !!(await (await this.profileNode.find()).findChildItem(this.newPsName)), {
        timeout: 15000,
        timeoutMsg: `Dataset ${this.newPsName} did not appear in the tree after creation`,
    });
    this.newPsNode = await (await this.profileNode.find()).findChildItem(this.newPsName);
    await expect(this.newPsNode).toBeDefined();
});

When("enters a new valid partitioned dataset name", async function () {
    // ZE createFile wizard — same three steps as sequential but with a different type
    const nameInputBox = await $('.input[aria-describedby="quickInput_message"]');
    await nameInputBox.waitForDisplayed();
    this.newPdsName = testPdsName;
    await nameInputBox.setValue(testPdsName);
    await browser.keys(Key.Enter);

    await browser.waitUntil((): Promise<boolean> => quickPick.isClickable());
    const typeOption = await quickPick.findItem("Partitioned Data Set: Default");
    await expect(typeOption).toBeClickable();
    await typeOption.click();

    await browser.waitUntil((): Promise<boolean> => quickPick.isClickable());
    const allocateOption = await quickPick.findItem("+ Allocate Data Set");
    await expect(allocateOption).toBeClickable();
    await allocateOption.click();
});

Then("the new partitioned dataset should be created successfully", async function () {
    // Wait for allocation and locate the PDS in the tree so the next step can right-click it
    await browser.pause(3000);
    await browser.waitUntil(async () => !!(await (await this.profileNode.find()).findChildItem(this.newPdsName)), {
        timeout: 15000,
        timeoutMsg: `PDS ${this.newPdsName} did not appear in the tree after creation`,
    });
    this.newPdsNode = await (await this.profileNode.find()).findChildItem(this.newPdsName);
    await expect(this.newPdsNode).toBeDefined();
});

When("the user right-clicks on the newly created PDS and selects {string}", async function (contextMenuOption: string) {
    // this.newPdsNode is set by the previous "created successfully" step
    await this.newPdsNode.elem.moveTo();
    await clickContextMenuItem(this.newPdsNode, contextMenuOption);
});

When("enters a valid member name", async function () {
    const inputBox = await $('.input[aria-describedby="quickInput_message"]');
    await inputBox.waitForDisplayed();
    await inputBox.setValue(testMemberName);
    await browser.keys(Key.Enter);
    this.newMemberName = testMemberName;

    // ZE auto-opens the new member in an editor after creation — close it so tree stays accessible
    const editorView = (await browser.getWorkbench()).getEditorView();
    await browser.waitUntil(async () => (await editorView.getOpenEditorTitles()).includes(testMemberName), {
        timeout: 10000,
        timeoutMsg: `Editor for new member ${testMemberName} did not open after creation`,
    });
    await editorView.closeEditor(testMemberName);
});

Then("the new member should be created successfully", async function () {
    await browser.waitUntil(async () => !!(await this.newPdsNode.findChildItem(this.newMemberName)), {
        timeout: 10000,
        timeoutMsg: `Member ${this.newMemberName} did not appear in PDS after creation`,
    });
});

Then("the new member should be visible under the PDS node", async function () {
    const memberNode = await this.newPdsNode.findChildItem(this.newMemberName);
    await expect(memberNode).toBeDefined();
});
