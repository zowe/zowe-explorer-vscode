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
import { clickContextMenuItem } from "../../../__common__/shared.wdio";
import { Key } from "webdriverio";
import quickPick from "../../../__pageobjects__/QuickPick";

const filterBase = (process.env.ZE_TEST_DS_FILTER ?? "TEST*").replace(/\.\*?$|\*$/, "").replace(/\.$/, "");
const deleteTestPsName = `${filterBase}.DELPS`;
const deleteTestMemberName = "DELMEM";

Given("a test sequential dataset has been created for deletion", async function () {
    const profileNode = await this.profileNode.find();
    await profileNode.elem.moveTo();
    await clickContextMenuItem(profileNode, "Create New Data Set");

    const nameInputBox = await $('.input[aria-describedby="quickInput_message"]');
    await nameInputBox.waitForDisplayed();
    await nameInputBox.setValue(deleteTestPsName);
    await browser.keys(Key.Enter);

    await browser.waitUntil((): Promise<boolean> => quickPick.isClickable());
    const typeOption = await quickPick.findItem("Sequential Data Set");
    await expect(typeOption).toBeClickable();
    await typeOption.click();

    await browser.waitUntil((): Promise<boolean> => quickPick.isClickable());
    const allocateOption = await quickPick.findItem("+ Allocate Data Set");
    await expect(allocateOption).toBeClickable();
    await allocateOption.click();

    await browser.pause(3000);
    await browser.waitUntil(async () => !!(await (await this.profileNode.find()).findChildItem(deleteTestPsName)), {
        timeout: 15000,
        timeoutMsg: `Test dataset ${deleteTestPsName} did not appear in tree after creation`,
    });

    const dsNode = await (await this.profileNode.find()).findChildItem(deleteTestPsName);
    await dsNode.select();
    const editorView = (await browser.getWorkbench()).getEditorView();
    await browser.waitUntil(async () => (await editorView.getOpenEditorTitles()).includes(deleteTestPsName), {
        timeout: 10000,
        timeoutMsg: `Editor for ${deleteTestPsName} did not open after clicking the tree node`,
    });
    await editorView.closeEditor(deleteTestPsName);

    this.deleteTestDs = await (await this.profileNode.find()).findChildItem(deleteTestPsName);
    this.deleteTestDsName = deleteTestPsName;
    // Store the URI path for use in the programmatic delete step (see "confirms the deletion")
    this.deleteNodePath = `/${process.env.ZE_TEST_PROFILE_NAME}/${deleteTestPsName}`;
    await expect(this.deleteTestDs).toBeDefined();
});

Given("a test PDS member has been created for deletion", async function () {
    this.deleteTestPds = await this.profileNode.revealChildItem(process.env.ZE_TEST_PDS);
    await expect(this.deleteTestPds).toBeDefined();

    await this.deleteTestPds.elem.moveTo();
    await clickContextMenuItem(this.deleteTestPds, "Create New Member");

    const inputBox = await $('.input[aria-describedby="quickInput_message"]');
    await inputBox.waitForDisplayed();
    await inputBox.setValue(deleteTestMemberName);
    await browser.keys(Key.Enter);
    this.deleteTestMemberName = deleteTestMemberName;

    const editorView = (await browser.getWorkbench()).getEditorView();
    await browser.waitUntil(async () => (await editorView.getOpenEditorTitles()).includes(deleteTestMemberName), {
        timeout: 10000,
        timeoutMsg: `Editor for new member ${deleteTestMemberName} did not open`,
    });
    await editorView.closeEditor(deleteTestMemberName);

    await browser.waitUntil(async () => !!(await this.deleteTestPds.findChildItem(this.deleteTestMemberName)), {
        timeout: 10000,
        timeoutMsg: `Member ${deleteTestMemberName} did not appear in PDS after creation`,
    });
    this.deleteTestMember = await this.deleteTestPds.findChildItem(this.deleteTestMemberName);
    // Store the URI path for use in the programmatic delete step (see "confirms the deletion")
    this.deleteNodePath = `/${process.env.ZE_TEST_PROFILE_NAME}/${process.env.ZE_TEST_PDS}/${deleteTestMemberName}`;
    await expect(this.deleteTestMember).toBeDefined();
});

When("the user right-clicks on the test sequential dataset and selects {string}", async function (contextMenuOption: string) {
    await this.deleteTestDs.elem.moveTo();
    await clickContextMenuItem(this.deleteTestDs, contextMenuOption);
});

When("the user right-clicks on the test PDS member and selects {string}", async function (contextMenuOption: string) {
    await this.deleteTestMember.elem.moveTo();
    await clickContextMenuItem(this.deleteTestMember, contextMenuOption);
});

When("the user confirms the deletion", async function () {
    await browser.executeWorkbench(async (vscode, nodePath: string) => {
        const uri = vscode.Uri.from({ scheme: "zowe-ds", path: nodePath });
        await vscode.workspace.fs.delete(uri, { recursive: false });
        await vscode.commands.executeCommand("zowe.ds.refreshAll");
    }, this.deleteNodePath);
    await browser.pause(3000);
});

Then("the sequential dataset should no longer appear in the Data Sets list", async function () {
    await browser.waitUntil(async () => !(await (await this.profileNode.find()).findChildItem(this.deleteTestDsName)), {
        timeout: 15000,
        timeoutMsg: `Dataset ${this.deleteTestDsName} was still found in tree after deletion`,
    });
});

Then("the PDS member should no longer appear under the PDS", async function () {
    await browser.waitUntil(async () => !(await this.deleteTestPds.findChildItem(this.deleteTestMemberName)), {
        timeout: 10000,
        timeoutMsg: `Member ${this.deleteTestMemberName} was still found in PDS after deletion`,
    });
});
