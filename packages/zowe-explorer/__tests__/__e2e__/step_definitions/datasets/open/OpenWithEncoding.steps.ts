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

Then("the dataset should open in the editor containing the text {string}", async function (text: string) {
    const editorView = (await browser.getWorkbench()).getEditorView();
    await browser.waitUntil(async () => (await editorView.getOpenEditorTitles()).some((t) => t.includes(this.encodingDsName)), {
        timeout: 15000,
        timeoutMsg: `Editor for ${this.encodingDsName} did not open after selecting IBM-285 encoding`,
    });
    const content = await browser.executeWorkbench(async (vscode, dsName: string) => {
        const doc = vscode.workspace.textDocuments.find((d) => d.fileName.includes(dsName));
        return doc?.getText() ?? "";
    }, this.encodingDsName);
    await expect(content).toContain(text);
});

Given("a test PDS member has been created and populated for encoding", async function () {
    const memberName = process.env.ZE_TEST_PDS_MEMBER;
    const pdsName = process.env.ZE_TEST_PDS;

    await browser.executeWorkbench(async (vscode, pdsPath: string) => {
        await vscode.workspace.fs.readDirectory(vscode.Uri.from({ scheme: "zowe-ds", path: pdsPath, query: "fetch=true" }));
    }, `/${process.env.ZE_TEST_PROFILE_NAME}/${pdsName}`);

    await browser.waitUntil(async () => !!(await (await this.profileNode.find()).findChildItem(pdsName)), {
        timeout: 15000,
        timeoutMsg: `${pdsName} not found in filtered tree`,
    });
    const pdsNode = await (await this.profileNode.find()).findChildItem(pdsName);
    await pdsNode.expand();

    const memberNode = await browser.waitUntil(
        async () => {
            const freshPds = await (await this.profileNode.find()).findChildItem(pdsName);
            if (!freshPds) return undefined;
            return (await freshPds.findChildItem(memberName)) ?? undefined;
        },
        { timeout: 15000, timeoutMsg: `Member ${memberName} not found after PDS expansion` }
    );
    await memberNode.select();

    const editorView = (await browser.getWorkbench()).getEditorView();
    const matchesTitle = (t: string): boolean =>
        t.toUpperCase() === memberName.toUpperCase() || t.toUpperCase().startsWith(`${memberName.toUpperCase()}.`);
    await browser.waitUntil(async () => (await editorView.getOpenEditorTitles()).some(matchesTitle), {
        timeout: 10000,
        timeoutMsg: `Member ${memberName} did not open in editor`,
    });
    const actualTitle = (await editorView.getOpenEditorTitles()).find(matchesTitle);
    await editorView.closeEditor(actualTitle);

    await writeDsContent(`/${process.env.ZE_TEST_PROFILE_NAME}/${pdsName}/${memberName}`, "$");

    await browser.waitUntil(
        async () => {
            this.encodingPds = await (await this.profileNode.find()).findChildItem(pdsName);
            if (!this.encodingPds) return false;
            this.encodingMember = await this.encodingPds.findChildItem(memberName);
            return !!this.encodingMember;
        },
        { timeout: 15000, timeoutMsg: `Member ${memberName} did not appear in tree after PDS expansion` }
    );
    this.encodingMemberName = memberName;
});

When("the user right-clicks on the PDS member and selects {string}", async function (contextMenuOption: string) {
    await browser.waitUntil(
        async () => {
            this.encodingPds = await (await this.profileNode.find()).findChildItem(process.env.ZE_TEST_PDS);
            if (!this.encodingPds) return false;
            this.encodingMember = await this.encodingPds.findChildItem(this.encodingMemberName);
            return !!this.encodingMember;
        },
        { timeout: 10000, timeoutMsg: `Member ${this.encodingMemberName} not found in tree for right-click` }
    );
    await this.encodingMember.elem.moveTo();
    await browser.pause(400);
    await clickContextMenuItem(this.encodingMember, contextMenuOption);
});

Then("the member should open in the editor containing the text {string}", async function (text: string) {
    const editorView = (await browser.getWorkbench()).getEditorView();
    await browser.waitUntil(async () => (await editorView.getOpenEditorTitles()).some((t) => t.includes(this.encodingMemberName)), {
        timeout: 15000,
        timeoutMsg: `Editor for ${this.encodingMemberName} did not open after selecting IBM-285 encoding`,
    });
    const content = await browser.executeWorkbench(async (vscode) => {
        return vscode.window.activeTextEditor?.document.getText() ?? "";
    });
    await expect(content).toContain(text);
});
