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
import quickPick from "../../../../__pageobjects__/QuickPick";
import { openDsInEditor, writeDsContent } from "../../utils/datasetUtils";

After(async function () {
    try {
        const editorView = (await browser.getWorkbench()).getEditorView();
        await editorView.closeAllEditors();
    } catch {}
});

Given("a test sequential dataset has been created and populated for encoding", async function () {
    await openDsInEditor(this, process.env.ZE_TEST_PS);
    await writeDsContent(`/${process.env.ZE_TEST_PROFILE_NAME}/${process.env.ZE_TEST_PS}`, "$");

    this.encodingDs = await (await this.profileNode.find()).findChildItem(process.env.ZE_TEST_PS);
    this.encodingDsName = process.env.ZE_TEST_PS;
    await expect(this.encodingDs).toBeDefined();
});

When("the user right-clicks on the dataset and selects {string}", async function (contextMenuOption: string) {
    this.encodingDs = await (await this.profileNode.find()).findChildItem(this.encodingDsName);
    await this.encodingDs.elem.moveTo();
    await clickContextMenuItem(this.encodingDs, contextMenuOption);
});

When("the user selects {string} from the encoding picker", async function (option: string) {
    await browser.waitUntil((): Promise<boolean> => quickPick.isClickable());
    const pickerOption = await quickPick.elem.$(`.monaco-list-row[role="option"][aria-label*="${option}"]`);
    await expect(pickerOption).toBeClickable();
    await pickerOption.click();
});

When("the user enters {string} as the codepage", async function (codepage: string) {
    const inputBox = await $('.input[aria-describedby="quickInput_message"]');
    await inputBox.waitForDisplayed();
    await inputBox.setValue(codepage);
    await browser.keys(Key.Enter);
    await browser.pause(2000);
});

Then("the dataset should open in the editor with the pound sign character", async function () {
    const editorView = (await browser.getWorkbench()).getEditorView();
    await browser.waitUntil(async () => (await editorView.getOpenEditorTitles()).some((t) => t.includes(this.encodingDsName)), {
        timeout: 15000,
        timeoutMsg: `Editor for ${this.encodingDsName} did not open after selecting IBM-285 encoding`,
    });
    const content = await browser.executeWorkbench(async (vscode, dsName: string) => {
        const doc = vscode.workspace.textDocuments.find((d) => d.fileName.includes(dsName));
        return doc?.getText() ?? "";
    }, this.encodingDsName);
    await expect(content).toContain("£");
});

Given("a test PDS member has been created and populated for encoding", async function () {
    this.encodingPds = await this.profileNode.revealChildItem(process.env.ZE_TEST_PDS);
    await this.encodingPds.expand();
    this.encodingMember = await this.encodingPds.findChildItem(process.env.ZE_TEST_PDS_MEMBER);
    await this.encodingMember.select();

    const editorView = (await browser.getWorkbench()).getEditorView();
    await browser.waitUntil(async () => (await editorView.getOpenEditorTitles()).some((t) => t.includes(process.env.ZE_TEST_PDS_MEMBER)), {
        timeout: 10000,
        timeoutMsg: `Member ${process.env.ZE_TEST_PDS_MEMBER} did not open in editor`,
    });
    await editorView.closeEditor(process.env.ZE_TEST_PDS_MEMBER);

    await writeDsContent(`/${process.env.ZE_TEST_PROFILE_NAME}/${process.env.ZE_TEST_PDS}/${process.env.ZE_TEST_PDS_MEMBER}`, "$");

    this.encodingPds = await this.profileNode.revealChildItem(process.env.ZE_TEST_PDS);
    await this.encodingPds.expand();
    this.encodingMember = await this.encodingPds.findChildItem(process.env.ZE_TEST_PDS_MEMBER);
    this.encodingMemberName = process.env.ZE_TEST_PDS_MEMBER;
    await expect(this.encodingMember).toBeDefined();
});

When("the user right-clicks on the PDS member and selects {string}", async function (contextMenuOption: string) {
    this.encodingPds = await this.profileNode.revealChildItem(process.env.ZE_TEST_PDS);
    await this.encodingPds.expand();
    this.encodingMember = await this.encodingPds.findChildItem(this.encodingMemberName);
    await this.encodingMember.elem.moveTo();
    await clickContextMenuItem(this.encodingMember, contextMenuOption);
});

Then("the member should open in the editor with the pound sign character", async function () {
    const editorView = (await browser.getWorkbench()).getEditorView();
    await browser.waitUntil(async () => (await editorView.getOpenEditorTitles()).some((t) => t.includes(this.encodingMemberName)), {
        timeout: 15000,
        timeoutMsg: `Editor for ${this.encodingMemberName} did not open after selecting IBM-285 encoding`,
    });
    const content = await browser.executeWorkbench(async (vscode, memberName: string) => {
        const doc = vscode.workspace.textDocuments.find((d) => d.fileName.includes(memberName));
        return doc?.getText() ?? "";
    }, this.encodingMemberName);
    await expect(content).toContain("£");
});
