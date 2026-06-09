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
import { clickContextMenuItem } from "../../../__common__/shared.wdio";
import { Key } from "webdriverio";
import quickPick from "../../../__pageobjects__/QuickPick";

const filterBase = (process.env.ZE_TEST_DS_FILTER ?? "TEST*").replace(/\.\*?$|\*$/, "").replace(/\.$/, "");
// Names start with 'A' so they sort to the top of the virtual list, guaranteeing they are
// rendered in the DOM viewport and findable by findChildItem regardless of other test data.
const renameTestPsName = `${filterBase}.ARNPS`;
const renamedPsName = `${filterBase}.ARNMD`;
const renameTestMemberName = "ABMEM";
const renamedMemberName = "ABRENM";

After(async function () {
    // Only clean up if this scenario created rename-specific test data
    if (this.renameTestDsName) {
        for (const psName of [renameTestPsName, renamedPsName]) {
            try {
                await browser.executeWorkbench(async (vscode, nodePath: string) => {
                    const uri = vscode.Uri.from({ scheme: "zowe-ds", path: nodePath });
                    await vscode.workspace.fs.delete(uri, { recursive: false });
                }, `/${process.env.ZE_TEST_PROFILE_NAME}/${psName}`);
            } catch {
                // Dataset may not exist; ignore
            }
        }
    }
    if (this.renameTestMemberName) {
        for (const memberName of [renameTestMemberName, renamedMemberName]) {
            try {
                await browser.executeWorkbench(async (vscode, nodePath: string) => {
                    const uri = vscode.Uri.from({ scheme: "zowe-ds", path: nodePath });
                    await vscode.workspace.fs.delete(uri, { recursive: false });
                }, `/${process.env.ZE_TEST_PROFILE_NAME}/${process.env.ZE_TEST_PDS}/${memberName}`);
            } catch {
                // Member may not exist; ignore
            }
        }
    }
});

Given("a test sequential dataset has been created for renaming", async function () {
    for (const psName of [renameTestPsName, renamedPsName]) {
        try {
            await browser.executeWorkbench(async (vscode, nodePath: string) => {
                const uri = vscode.Uri.from({ scheme: "zowe-ds", path: nodePath });
                await vscode.workspace.fs.stat(uri); // populate cache; throws if not found
                await vscode.workspace.fs.delete(uri, { recursive: false });
            }, `/${process.env.ZE_TEST_PROFILE_NAME}/${psName}`);
        } catch {}
    }
    await browser.pause(1000);

    const profileNode = await this.profileNode.find();
    await profileNode.elem.moveTo();
    await clickContextMenuItem(profileNode, "Create New Data Set");

    const nameInputBox = await $('.input[aria-describedby="quickInput_message"]');
    await nameInputBox.waitForDisplayed();
    await nameInputBox.setValue(renameTestPsName);
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
    await browser.waitUntil(async () => !!(await (await this.profileNode.find()).findChildItem(renameTestPsName)), {
        timeout: 15000,
        timeoutMsg: `Test dataset ${renameTestPsName} did not appear in tree after creation`,
    });

    // Open the PS to populate ZE's in-memory filesystem cache, then close the editor
    const dsNode = await (await this.profileNode.find()).findChildItem(renameTestPsName);
    await dsNode.select();
    const editorView = (await browser.getWorkbench()).getEditorView();
    await browser.waitUntil(async () => (await editorView.getOpenEditorTitles()).includes(renameTestPsName), {
        timeout: 10000,
        timeoutMsg: `Editor for ${renameTestPsName} did not open after clicking the tree node`,
    });
    await editorView.closeEditor(renameTestPsName);

    this.renameTestDs = await (await this.profileNode.find()).findChildItem(renameTestPsName);
    this.renameTestDsName = renameTestPsName;
    await expect(this.renameTestDs).toBeDefined();
});

Given("a test partitioned dataset has been created for renaming", async function () {
    for (const psName of [renameTestPsName, renamedPsName]) {
        try {
            await browser.executeWorkbench(async (vscode, nodePath: string) => {
                const uri = vscode.Uri.from({ scheme: "zowe-ds", path: nodePath });
                await vscode.workspace.fs.stat(uri); // populate cache; throws if not found
                await vscode.workspace.fs.delete(uri, { recursive: false });
            }, `/${process.env.ZE_TEST_PROFILE_NAME}/${psName}`);
        } catch {}
    }
    await browser.pause(1000);

    const profileNode = await this.profileNode.find();
    await profileNode.elem.moveTo();
    await clickContextMenuItem(profileNode, "Create New Data Set");

    const nameInputBox = await $('.input[aria-describedby="quickInput_message"]');
    await nameInputBox.waitForDisplayed();
    await nameInputBox.setValue(renameTestPsName);
    await browser.keys(Key.Enter);

    await browser.waitUntil((): Promise<boolean> => quickPick.isClickable());
    const typeOption = await quickPick.findItem("Partitioned Data Set: Default");
    await expect(typeOption).toBeClickable();
    await typeOption.click();

    await browser.waitUntil((): Promise<boolean> => quickPick.isClickable());
    const allocateOption = await quickPick.findItem("+ Allocate Data Set");
    await expect(allocateOption).toBeClickable();
    await allocateOption.click();

    await browser.pause(3000);
    await browser.waitUntil(async () => !!(await (await this.profileNode.find()).findChildItem(renameTestPsName)), {
        timeout: 15000,
        timeoutMsg: `Test dataset ${renameTestPsName} did not appear in tree after creation`,
    });

    // Open the PS to populate ZE's in-memory filesystem cache, then close the editor
    const dsNode = await (await this.profileNode.find()).findChildItem(renameTestPsName);
    await dsNode.select();
    const editorView = (await browser.getWorkbench()).getEditorView();
    await browser.waitUntil(async () => (await editorView.getOpenEditorTitles()).includes(renameTestPsName), {
        timeout: 10000,
        timeoutMsg: `Editor for ${renameTestPsName} did not open after clicking the tree node`,
    });
    await editorView.closeEditor(renameTestPsName);

    this.renameTestDs = await (await this.profileNode.find()).findChildItem(renameTestPsName);
    this.renameTestDsName = renameTestPsName;
    await expect(this.renameTestDs).toBeDefined();
});

Given("a test PDS member has been created for renaming", async function () {
    this.renameTestPds = await this.profileNode.revealChildItem(process.env.ZE_TEST_PDS);
    await expect(this.renameTestPds).toBeDefined();
    await browser.executeWorkbench(async (vscode, pdsPath: string) => {
        try {
            await vscode.workspace.fs.readDirectory(vscode.Uri.from({ scheme: "zowe-ds", path: pdsPath }));
        } catch {}
    }, `/${process.env.ZE_TEST_PROFILE_NAME}/${process.env.ZE_TEST_PDS}`);

    // Pre-clean any leftover members from a previous run, now that they are in the FS cache.
    for (const memberName of [renameTestMemberName, renamedMemberName]) {
        try {
            await browser.executeWorkbench(async (vscode, nodePath: string) => {
                const uri = vscode.Uri.from({ scheme: "zowe-ds", path: nodePath });
                await vscode.workspace.fs.delete(uri, { recursive: false });
            }, `/${process.env.ZE_TEST_PROFILE_NAME}/${process.env.ZE_TEST_PDS}/${memberName}`);
        } catch {
            // Member didn't exist; nothing to clean up
        }
    }
    await browser.pause(1000);

    // Re-fetch the PDS node after cleanup so subsequent findChildItem calls have a fresh DOM ref.
    this.renameTestPds = await this.profileNode.revealChildItem(process.env.ZE_TEST_PDS);

    await this.renameTestPds.elem.moveTo();
    await clickContextMenuItem(this.renameTestPds, "Create New Member");

    const inputBox = await $('.input[aria-describedby="quickInput_message"]');
    await inputBox.waitForDisplayed();
    await inputBox.setValue(renameTestMemberName);
    await browser.keys(Key.Enter);

    // ZE auto-opens the new member in an editor; close it so the tree stays accessible
    const editorView = (await browser.getWorkbench()).getEditorView();
    await browser.waitUntil(async () => (await editorView.getOpenEditorTitles()).includes(renameTestMemberName), {
        timeout: 10000,
        timeoutMsg: `Editor for new member ${renameTestMemberName} did not open`,
    });
    await editorView.closeEditor(renameTestMemberName);

    await browser.waitUntil(
        async () => {
            const profileNode = await this.profileNode.find();
            const pds = await profileNode.findChildItem(process.env.ZE_TEST_PDS);
            if (!pds) return false;
            return !!(await pds.findChildItem(renameTestMemberName));
        },
        {
            timeout: 15000,
            timeoutMsg: `Member ${renameTestMemberName} did not appear in PDS after creation`,
        }
    );
    this.renameTestPds = await this.profileNode.revealChildItem(process.env.ZE_TEST_PDS);
    this.renameTestMember = await this.renameTestPds.findChildItem(renameTestMemberName);
    this.renameTestMemberName = renameTestMemberName;
    await expect(this.renameTestMember).toBeDefined();
});

When("the user right-clicks on the dataset to rename and selects {string}", async function (contextMenuOption: string) {
    await this.renameTestDs.elem.moveTo();
    await clickContextMenuItem(this.renameTestDs, contextMenuOption);
});

When("enters a new valid name for the sequential dataset", async function () {
    const nameInputBox = await $('.input[aria-describedby="quickInput_message"]');
    await nameInputBox.waitForDisplayed();

    await nameInputBox.click();
    await browser.keys([process.platform === "darwin" ? "Meta" : "Control", "a"]);
    await browser.keys(renamedPsName);
    await browser.keys(Key.Enter);

    this.oldPsName = this.renameTestDsName;
    this.newPsName = renamedPsName;
    await browser.pause(2000);
});

When("the user right-clicks on the PDS member to rename and selects {string}", async function (contextMenuOption: string) {
    await this.renameTestMember.elem.moveTo();
    await clickContextMenuItem(this.renameTestMember, contextMenuOption);
});

When("enters a new valid name for the member", async function () {
    const inputBox = await $('.input[aria-describedby="quickInput_message"]');
    await inputBox.waitForDisplayed();

    await inputBox.click();
    await browser.keys([process.platform === "darwin" ? "Meta" : "Control", "a"]);
    await browser.keys(renamedMemberName);
    await browser.keys(Key.Enter);

    this.oldMemberName = this.renameTestMemberName;
    this.newMemberName = renamedMemberName;
    await browser.pause(2000);
});

Then("the new dataset name should appear in the Data Sets list", async function () {
    await browser.waitUntil(async () => !!(await (await this.profileNode.find()).findChildItem(this.newPsName)), {
        timeout: 15000,
        timeoutMsg: `Renamed dataset ${this.newPsName} did not appear in tree after renaming`,
    });
});

Then("the old dataset name should no longer exist", async function () {
    await browser.waitUntil(async () => !(await (await this.profileNode.find()).findChildItem(this.oldPsName)), {
        timeout: 15000,
        timeoutMsg: `Old dataset ${this.oldPsName} was still found in tree after renaming`,
    });
});

Then("the new member name should be visible under the PDS node", async function () {
    await browser.waitUntil(async () => !!(await this.renameTestPds.findChildItem(this.newMemberName)), {
        timeout: 10000,
        timeoutMsg: `Renamed member ${this.newMemberName} was not found inside the PDS after renaming`,
    });
});

Then("the old member name should no longer exist under the PDS", async function () {
    await browser.waitUntil(async () => !(await this.renameTestPds.findChildItem(this.oldMemberName)), {
        timeout: 10000,
        timeoutMsg: `Old member ${this.oldMemberName} was still found in PDS after renaming`,
    });
});
