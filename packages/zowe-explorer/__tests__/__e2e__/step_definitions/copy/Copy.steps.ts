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

const copyTestPsName = `${filterBase}.ACPPS`;
const copiedPsName = `${filterBase}.ACPCP`;

const copyTestPdsMemberName = "ACPPDM";
const copiedPdsName = `${filterBase}.ACPPDS`;
const copyTestMemberName = "ACPMEM";
const copiedMemberName = "ACPCOP";

After(async function () {
    if (this.copyTestDsName) {
        for (const psName of [copyTestPsName, copiedPsName]) {
            try {
                await browser.executeWorkbench(async (vscode, nodePath: string) => {
                    const uri = vscode.Uri.from({ scheme: "zowe-ds", path: nodePath });
                    await vscode.workspace.fs.stat(uri); // populate FS cache before delete
                    await vscode.workspace.fs.delete(uri, { recursive: false });
                }, `/${process.env.ZE_TEST_PROFILE_NAME}/${psName}`);
            } catch {
                // Dataset may not exist; ignore
            }
        }
    }
    // PDS scenario cleanup: remove the temp member added to ZE_TEST_PDS
    if (this.copyTestPdsMemberCreated) {
        await browser.executeWorkbench(async (vscode, pdsPath: string) => {
            try {
                await vscode.workspace.fs.readDirectory(vscode.Uri.from({ scheme: "zowe-ds", path: pdsPath }));
            } catch {}
        }, `/${process.env.ZE_TEST_PROFILE_NAME}/${process.env.ZE_TEST_PDS}`);
        try {
            await browser.executeWorkbench(async (vscode, nodePath: string) => {
                const uri = vscode.Uri.from({ scheme: "zowe-ds", path: nodePath });
                await vscode.workspace.fs.delete(uri, { recursive: false });
            }, `/${process.env.ZE_TEST_PROFILE_NAME}/${process.env.ZE_TEST_PDS}/${copyTestPdsMemberName}`);
        } catch {}
    }
    // PDS scenario cleanup: delete the copied PDS itself
    if (this.copyTestPdsCopied) {
        try {
            await browser.executeWorkbench(async (vscode, nodePath: string) => {
                const uri = vscode.Uri.from({ scheme: "zowe-ds", path: nodePath });
                await vscode.workspace.fs.stat(uri);
                await vscode.workspace.fs.delete(uri, { recursive: false });
            }, `/${process.env.ZE_TEST_PROFILE_NAME}/${copiedPdsName}`);
        } catch {}
    }
    // Member scenario cleanup
    if (this.copyTestMemberName) {
        // workspace.fs.readDirectory populates all current members into the FS cache so
        // the subsequent delete calls can find ACPMEM and ACPCOP regardless of tree state.
        await browser.executeWorkbench(async (vscode, pdsPath: string) => {
            try {
                await vscode.workspace.fs.readDirectory(vscode.Uri.from({ scheme: "zowe-ds", path: pdsPath }));
            } catch {}
        }, `/${process.env.ZE_TEST_PROFILE_NAME}/${process.env.ZE_TEST_PDS}`);
        for (const memberName of [copyTestMemberName, copiedMemberName]) {
            try {
                await browser.executeWorkbench(async (vscode, nodePath: string) => {
                    const uri = vscode.Uri.from({ scheme: "zowe-ds", path: nodePath });
                    await vscode.workspace.fs.delete(uri, { recursive: false });
                }, `/${process.env.ZE_TEST_PROFILE_NAME}/${process.env.ZE_TEST_PDS}/${memberName}`);
            } catch {}
        }
    }
});

Given("a test sequential dataset has been created for copying", async function () {
    // Pre-clean any datasets left over from a previous run.
    // stat() → fetchDataset() populates the FS cache so the delete can look up the entry.
    for (const psName of [copyTestPsName, copiedPsName]) {
        try {
            await browser.executeWorkbench(async (vscode, nodePath: string) => {
                const uri = vscode.Uri.from({ scheme: "zowe-ds", path: nodePath });
                await vscode.workspace.fs.stat(uri);
                await vscode.workspace.fs.delete(uri, { recursive: false });
            }, `/${process.env.ZE_TEST_PROFILE_NAME}/${psName}`);
        } catch {
            // Dataset didn't exist; nothing to clean up
        }
    }
    await browser.pause(1000);

    const profileNode = await this.profileNode.find();
    await profileNode.elem.moveTo();
    await clickContextMenuItem(profileNode, "Create New Data Set");

    const nameInputBox = await $('.input[aria-describedby="quickInput_message"]');
    await nameInputBox.waitForDisplayed();
    await nameInputBox.setValue(copyTestPsName);
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
    await browser.waitUntil(async () => !!(await (await this.profileNode.find()).findChildItem(copyTestPsName)), {
        timeout: 15000,
        timeoutMsg: `Test dataset ${copyTestPsName} did not appear in tree after creation`,
    });

    // Open the PS in an editor: this triggers DatasetFSProvider.readFileImplementation which
    // populates ZE's FS cache — required so the After hook's executeWorkbench delete works.
    const dsNode = await (await this.profileNode.find()).findChildItem(copyTestPsName);
    await dsNode.select();
    const editorView = (await browser.getWorkbench()).getEditorView();
    await browser.waitUntil(async () => (await editorView.getOpenEditorTitles()).includes(copyTestPsName), {
        timeout: 10000,
        timeoutMsg: `Editor for ${copyTestPsName} did not open after clicking the tree node`,
    });
    await editorView.closeEditor(copyTestPsName);

    this.copyTestDs = await (await this.profileNode.find()).findChildItem(copyTestPsName);
    this.copyTestDsName = copyTestPsName;
    await expect(this.copyTestDs).toBeDefined();
});

Given("a test member exists in the PDS for the copy test", async function () {
    // Expand the PDS to make it accessible and populate the FS cache for pre-cleanup.
    this.copyTestPds = await this.profileNode.revealChildItem(process.env.ZE_TEST_PDS);
    await expect(this.copyTestPds).toBeDefined();

    // Populate the full member list in the FS cache via readDirectory, then pre-clean any
    // leftovers: the temp member ACPPDM from a previous run and the previously-copied ACPPDS.
    await browser.executeWorkbench(async (vscode, pdsPath: string) => {
        try {
            await vscode.workspace.fs.readDirectory(vscode.Uri.from({ scheme: "zowe-ds", path: pdsPath }));
        } catch {}
    }, `/${process.env.ZE_TEST_PROFILE_NAME}/${process.env.ZE_TEST_PDS}`);

    try {
        await browser.executeWorkbench(async (vscode, nodePath: string) => {
            const uri = vscode.Uri.from({ scheme: "zowe-ds", path: nodePath });
            await vscode.workspace.fs.delete(uri, { recursive: false });
        }, `/${process.env.ZE_TEST_PROFILE_NAME}/${process.env.ZE_TEST_PDS}/${copyTestPdsMemberName}`);
    } catch {}

    try {
        await browser.executeWorkbench(async (vscode, nodePath: string) => {
            const uri = vscode.Uri.from({ scheme: "zowe-ds", path: nodePath });
            await vscode.workspace.fs.stat(uri);
            await vscode.workspace.fs.delete(uri, { recursive: false });
        }, `/${process.env.ZE_TEST_PROFILE_NAME}/${copiedPdsName}`);
    } catch {}

    await browser.pause(1000);

    // Re-fetch after pre-cleanup so the tree reference stays fresh.
    this.copyTestPds = await this.profileNode.revealChildItem(process.env.ZE_TEST_PDS);

    // Create ACPPDM so the PDS is non-empty before the copy.
    await this.copyTestPds.elem.moveTo();
    await clickContextMenuItem(this.copyTestPds, "Create New Member");

    const inputBox = await $('.input[aria-describedby="quickInput_message"]');
    await inputBox.waitForDisplayed();
    await inputBox.setValue(copyTestPdsMemberName);
    await browser.keys(Key.Enter);

    const editorView = (await browser.getWorkbench()).getEditorView();
    await browser.waitUntil(async () => (await editorView.getOpenEditorTitles()).includes(copyTestPdsMemberName), {
        timeout: 10000,
        timeoutMsg: `Editor for ${copyTestPdsMemberName} did not open after creation`,
    });
    await editorView.closeEditor(copyTestPdsMemberName);

    // Re-fetch after editor close: closing triggers a tree re-render which invalidates old refs.
    this.copyTestPds = await this.profileNode.revealChildItem(process.env.ZE_TEST_PDS);
    await browser.waitUntil(async () => !!(await this.copyTestPds.findChildItem(copyTestPdsMemberName)), {
        timeout: 10000,
        timeoutMsg: `Member ${copyTestPdsMemberName} did not appear in PDS after creation`,
    });
    this.copyTestPdsMemberCreated = true;
    await expect(this.copyTestPds).toBeDefined();
});

Given("a test PDS member has been created for copying", async function () {
    // Expand the PDS and fully populate its member list in the FS cache via readDirectory,
    // then pre-clean any leftover ACPMEM/ACPCOP from a previous run before creating ACPMEM.
    this.copyTestPdsCopyTarget = await this.profileNode.revealChildItem(process.env.ZE_TEST_PDS);
    await expect(this.copyTestPdsCopyTarget).toBeDefined();

    await browser.executeWorkbench(async (vscode, pdsPath: string) => {
        try {
            await vscode.workspace.fs.readDirectory(vscode.Uri.from({ scheme: "zowe-ds", path: pdsPath }));
        } catch {}
    }, `/${process.env.ZE_TEST_PROFILE_NAME}/${process.env.ZE_TEST_PDS}`);

    for (const memberName of [copyTestMemberName, copiedMemberName]) {
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

    this.copyTestPdsCopyTarget = await this.profileNode.revealChildItem(process.env.ZE_TEST_PDS);

    await this.copyTestPdsCopyTarget.elem.moveTo();
    await clickContextMenuItem(this.copyTestPdsCopyTarget, "Create New Member");

    const inputBox = await $('.input[aria-describedby="quickInput_message"]');
    await inputBox.waitForDisplayed();
    await inputBox.setValue(copyTestMemberName);
    await browser.keys(Key.Enter);

    const editorView = (await browser.getWorkbench()).getEditorView();
    await browser.waitUntil(async () => (await editorView.getOpenEditorTitles()).includes(copyTestMemberName), {
        timeout: 10000,
        timeoutMsg: `Editor for ${copyTestMemberName} did not open after creation`,
    });
    await editorView.closeEditor(copyTestMemberName);

    this.copyTestPdsCopyTarget = await this.profileNode.revealChildItem(process.env.ZE_TEST_PDS);
    await browser.waitUntil(async () => !!(await this.copyTestPdsCopyTarget.findChildItem(copyTestMemberName)), {
        timeout: 10000,
        timeoutMsg: `Member ${copyTestMemberName} did not appear in PDS after creation`,
    });
    this.copyTestMember = await this.copyTestPdsCopyTarget.findChildItem(copyTestMemberName);
    this.copyTestMemberName = copyTestMemberName;
    await expect(this.copyTestMember).toBeDefined();
});

When("the user right-clicks on the dataset to copy and selects {string}", async function (contextMenuOption: string) {
    await this.copyTestDs.elem.moveTo();
    await clickContextMenuItem(this.copyTestDs, contextMenuOption);
});

When("the user right-clicks on the PDS to copy and selects {string}", async function (contextMenuOption: string) {
    await this.copyTestPds.elem.moveTo();
    await clickContextMenuItem(this.copyTestPds, contextMenuOption);
});

When("the user right-clicks on the profile node to paste and selects {string}", async function (contextMenuOption: string) {
    const profileNode = await this.profileNode.find();
    await profileNode.elem.moveTo();
    await clickContextMenuItem(profileNode, contextMenuOption);
});

When("the user right-clicks on the member to copy and selects {string}", async function (contextMenuOption: string) {
    await this.copyTestMember.elem.moveTo();
    await clickContextMenuItem(this.copyTestMember, contextMenuOption);
});

When("the user right-clicks on the PDS to paste and selects {string}", async function (contextMenuOption: string) {
    await this.copyTestPdsCopyTarget.elem.moveTo();
    await clickContextMenuItem(this.copyTestPdsCopyTarget, contextMenuOption);
});

When("enters a new name for the copied sequential dataset", async function () {
    const nameInputBox = await $('.input[aria-describedby="quickInput_message"]');
    await nameInputBox.waitForDisplayed();
    // The input is pre-filled with the source DS name. Use select-all + type to replace it
    // via real keyboard events (React-controlled; setValue/clearValue won't update ZE's state).
    // Cmd+A is select-all on macOS; Ctrl+A on other platforms.
    await nameInputBox.click();
    await browser.keys([process.platform === "darwin" ? "Meta" : "Control", "a"]);
    await browser.keys(copiedPsName);
    await browser.keys(Key.Enter);
    this.copiedPsName = copiedPsName;
    await browser.pause(3000);
});

When("enters a new name for the copied PDS", async function () {
    const nameInputBox = await $('.input[aria-describedby="quickInput_message"]');
    await nameInputBox.waitForDisplayed();
    // Same React-controlled input handling as the dataset rename steps.
    await nameInputBox.click();
    await browser.keys([process.platform === "darwin" ? "Meta" : "Control", "a"]);
    await browser.keys(copiedPdsName);
    await browser.keys(Key.Enter);
    this.copiedPdsName = copiedPdsName;
    // Signal the After hook that the PDS copy completed so it can clean up ACPPDS.
    this.copyTestPdsCopied = true;
    await browser.pause(3000);
});

When("enters a new name for the copied member", async function () {
    const inputBox = await $('.input[aria-describedby="quickInput_message"]');
    await inputBox.waitForDisplayed();
    await inputBox.click();
    await browser.keys([process.platform === "darwin" ? "Meta" : "Control", "a"]);
    await browser.keys(copiedMemberName);
    await browser.keys(Key.Enter);
    this.copiedMemberName = copiedMemberName;
    await browser.pause(2000);
});

Then("the copied sequential dataset should appear in the Data Sets list", async function () {
    await browser.waitUntil(async () => !!(await (await this.profileNode.find()).findChildItem(this.copiedPsName)), {
        timeout: 15000,
        timeoutMsg: `Copied dataset ${this.copiedPsName} did not appear in tree after copy-paste`,
    });
});

Then("the copied PDS should appear in the Data Sets list", async function () {
    await browser.waitUntil(async () => !!(await (await this.profileNode.find()).findChildItem(this.copiedPdsName)), {
        timeout: 15000,
        timeoutMsg: `Copied PDS ${this.copiedPdsName} did not appear in tree after copy-paste`,
    });
});

Then("the copied member should appear under the PDS", async function () {
    await browser.waitUntil(async () => !!(await this.copyTestPdsCopyTarget.findChildItem(this.copiedMemberName)), {
        timeout: 10000,
        timeoutMsg: `Copied member ${this.copiedMemberName} did not appear under the PDS after copy-paste`,
    });
});
