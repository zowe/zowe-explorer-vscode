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

import { After, Given, When, Then } from "@cucumber/cucumber";
import { clickContextMenuItem } from "../../../../__common__/shared.wdio";
import { Key } from "webdriverio";
import { filterBase, deleteDsOrMember, refreshDsTree } from "../../utils/datasetUtils";

const copiedPsName = `${filterBase}.ATESTPS`;
const copiedMemberName = "ATESTMEM";

const deleteCopiedMember = async (...memberPaths: string[]): Promise<void> => {
    await browser.executeWorkbench(async (vscode, pdsPath: string) => {
        try {
            await vscode.workspace.fs.readDirectory(vscode.Uri.from({ scheme: "zowe-ds", path: pdsPath, query: "fetch=true" }));
        } catch {}
    }, `/${process.env.ZE_TEST_PROFILE_NAME}/${process.env.ZE_TEST_PDS}`);
    await deleteDsOrMember(...memberPaths);
};

After(async function () {
    try {
        const editorView = (await browser.getWorkbench()).getEditorView();
        await editorView.closeAllEditors();
    } catch {}

    if (this.copyTestDsName) {
        await deleteDsOrMember(`/${process.env.ZE_TEST_PROFILE_NAME}/${copiedPsName}`).catch(() => {});
    }
    if (this.copyTestMemberName) {
        await deleteCopiedMember(`/${process.env.ZE_TEST_PROFILE_NAME}/${process.env.ZE_TEST_PDS}/${copiedMemberName}`).catch(() => {});
    }
    await browser.pause(4000);
});

Given("a test sequential dataset has been created for copying", async function () {
    await deleteDsOrMember(`/${process.env.ZE_TEST_PROFILE_NAME}/${copiedPsName}`);
    await browser.pause(1000);

    this.copyTestDs = await (await this.profileNode.find()).findChildItem(process.env.ZE_TEST_PS);
    this.copyTestDsName = process.env.ZE_TEST_PS;
    await expect(this.copyTestDs).toBeDefined();
});

When("the user right-clicks on the dataset to copy and selects {string}", async function (contextMenuOption: string) {
    this.copyTestDs = await (await this.profileNode.find()).findChildItem(this.copyTestDsName);
    await this.copyTestDs.elem.moveTo();
    await browser.pause(400);
    await clickContextMenuItem(this.copyTestDs, contextMenuOption);
});

When("the user right-clicks on the profile node to paste and selects {string}", async function (contextMenuOption: string) {
    const profileNode = await this.profileNode.find();
    await profileNode.elem.moveTo();
    await browser.pause(400);
    await clickContextMenuItem(profileNode, contextMenuOption);
});

When("enters a new name for the copied sequential dataset", async function () {
    const nameInputBox = await $('.input[aria-describedby="quickInput_message"]');
    await nameInputBox.waitForDisplayed();
    await nameInputBox.click();
    await browser.keys([process.platform === "darwin" ? "Meta" : "Control", "a"]);
    await browser.keys(copiedPsName);
    await browser.keys(Key.Enter);
    this.copiedPsName = copiedPsName;
    await browser.pause(3000);
});

Then("the copied sequential dataset should appear in the Data Sets list", async function () {
    await refreshDsTree();
    await browser.waitUntil(async () => !!(await (await this.profileNode.find()).findChildItem(this.copiedPsName)), {
        timeout: 20000,
        timeoutMsg: `Copied dataset ${this.copiedPsName} did not appear in tree after copy-paste`,
    });
});

Given("a test PDS member has been created for copying", async function () {
    await deleteCopiedMember(`/${process.env.ZE_TEST_PROFILE_NAME}/${process.env.ZE_TEST_PDS}/${copiedMemberName}`);
    await browser.pause(1000);

    await browser.waitUntil(
        async () => {
            const freshPds = await (await this.profileNode.find()).findChildItem(process.env.ZE_TEST_PDS);
            if (!freshPds) return false;
            await freshPds.expand();
            const member = await freshPds.findChildItem(process.env.ZE_TEST_PDS_MEMBER);
            if (!member) return false;
            this.copyTestPdsCopyTarget = freshPds;
            this.copyTestMember = member;
            return true;
        },
        { timeout: 15000, timeoutMsg: `${process.env.ZE_TEST_PDS_MEMBER} not found under ${process.env.ZE_TEST_PDS}` }
    );
    this.copyTestMemberName = process.env.ZE_TEST_PDS_MEMBER;
    await expect(this.copyTestMember).toBeDefined();
});

When("the user right-clicks on the member to copy and selects {string}", async function (contextMenuOption: string) {
    this.copyTestPdsCopyTarget = await (await this.profileNode.find()).findChildItem(process.env.ZE_TEST_PDS);
    this.copyTestMember = await this.copyTestPdsCopyTarget.findChildItem(this.copyTestMemberName);
    await this.copyTestMember.elem.moveTo();
    await browser.pause(400);
    await clickContextMenuItem(this.copyTestMember, contextMenuOption);
});

When("the user right-clicks on the PDS to paste and selects {string}", async function (contextMenuOption: string) {
    this.copyTestPdsCopyTarget = await (await this.profileNode.find()).findChildItem(process.env.ZE_TEST_PDS);
    await this.copyTestPdsCopyTarget.elem.moveTo();
    await browser.pause(400);
    await clickContextMenuItem(this.copyTestPdsCopyTarget, contextMenuOption);
});

When("enters a new name for the copied member", async function () {
    await browser.pause(2000);
    const inputBox = await $('.input[aria-describedby="quickInput_message"]');
    await inputBox.waitForDisplayed({ timeout: 15000 });
    await inputBox.click();
    await browser.keys([process.platform === "darwin" ? "Meta" : "Control", "a"]);
    await browser.keys(copiedMemberName);
    await browser.keys(Key.Enter);
    this.copiedMemberName = copiedMemberName;
    await browser.pause(2000);
});

Then("the copied member should appear under the PDS", async function () {
    await refreshDsTree();

    await browser.waitUntil(
        async () => {
            const freshPds = await (await this.profileNode.find()).findChildItem(process.env.ZE_TEST_PDS);
            if (!freshPds) return false;
            await freshPds.expand();
            return !!(await freshPds.findChildItem(this.copyTestMemberName));
        },
        { timeout: 15000, timeoutMsg: `Copied member ${this.copyTestMemberName} did not appear under the PDS after copy-paste` }
    );
});
