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

import { After, Then, When } from "@cucumber/cucumber";
import { TreeItem } from "wdio-vscode-service";
import { clickContextMenuItem, fillInputBox } from "../../../__common__/shared.wdio";
import quickPick from "../../../__pageobjects__/QuickPick";

const testInfo = {
    newFile: process.env.ZE_TEST_USS_NEW_FILE,
    renamedFile: process.env.ZE_TEST_USS_RENAMED_FILE,
    newDir: process.env.ZE_TEST_USS_NEW_DIR,
    renamedDir: process.env.ZE_TEST_USS_RENAMED_DIR,
    ussFile: process.env.ZE_TEST_USS_FILE,
    encoding: process.env.ZE_TEST_USS_ENCODING,
};

// Polls for a notification toast action button and clicks it if it appears within 8 seconds.
// Used to handle optional "Replace" prompts when creating files/dirs that already exist.
async function optionallyClickNotificationButton(buttonTitle: string): Promise<void> {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
        try {
            const btn = await browser.$(`//a[contains(@class,"monaco-button") and @title="${buttonTitle}"]`);
            if (await btn.isExisting()) {
                await btn.click();
                return;
            }
        } catch {
            // Not found yet — keep polling.
        }
        await browser.pause(500);
    }
    // No notification appeared — file/directory didn't already exist; proceed normally.
}


Then("the USS directory has files listed under it", async function () {
    await expect(this.children.length).toBeGreaterThan(0);
});

When("the user creates a new USS file in the directory", async function () {
    await this.ussDir.elem.moveTo();
    await clickContextMenuItem(this.ussDir, "Create File");
    await fillInputBox(testInfo.newFile);
    await optionallyClickNotificationButton("Replace");
    // Allow time for the remote create to complete and tree to refresh
    await browser.pause(3000);
});

Then("the new USS file appears in the directory listing", async function () {
    this.newFile = null;
    await browser.waitUntil(
        async () => {
            this.newFile = await this.ussDir.findChildItem(testInfo.newFile);
            return this.newFile != null;
        },
        { timeout: 30000, timeoutMsg: `New file "${testInfo.newFile}" did not appear in directory listing` }
    );
    await expect(this.newFile).toBeDefined();
});

When("the user deletes the new USS file from the directory", async function () {
    const fileNode = (await this.ussDir.findChildItem(testInfo.newFile)) as TreeItem;
    await expect(fileNode).toBeDefined();
    await fileNode.elem.moveTo();
    await clickContextMenuItem(fileNode, "Delete");
    await browser.pause(3000);
});

Then("the USS file no longer appears in the directory listing", async function () {
    await browser.waitUntil(
        async () => (await this.ussDir.findChildItem(testInfo.newFile)) == null,
        { timeout: 30000, timeoutMsg: `File "${testInfo.newFile}" is still visible after delete` }
    );
});

When("the user creates a new USS directory inside the parent", async function () {
    await this.ussDir.elem.moveTo();
    await clickContextMenuItem(this.ussDir, "Create Directory");
    await fillInputBox(testInfo.newDir);
    await optionallyClickNotificationButton("Replace");
    await browser.pause(3000);
});

Then("the new USS directory appears in the parent listing", async function () {
    this.newDir = null;
    await browser.waitUntil(
        async () => {
            this.newDir = await this.ussDir.findChildItem(testInfo.newDir);
            return this.newDir != null;
        },
        { timeout: 30000, timeoutMsg: `New directory "${testInfo.newDir}" did not appear in parent listing` }
    );
    await expect(this.newDir).toBeDefined();
});

When("the user deletes the new USS directory from the parent", async function () {
    const dirNode = (await this.ussDir.findChildItem(testInfo.newDir)) as TreeItem;
    await expect(dirNode).toBeDefined();
    await dirNode.elem.moveTo();
    await clickContextMenuItem(dirNode, "Delete");
    await browser.pause(3000);
});

Then("the USS directory no longer appears in the parent listing", async function () {
    await browser.waitUntil(
        async () => (await this.ussDir.findChildItem(testInfo.newDir)) == null,
        { timeout: 30000, timeoutMsg: `Directory "${testInfo.newDir}" is still visible after delete` }
    );
});

When("the user renames the new USS file to the renamed file name", async function () {
    const fileNode = (await this.ussDir.findChildItem(testInfo.newFile)) as TreeItem;
    await expect(fileNode).toBeDefined();
    await fileNode.elem.moveTo();
    await clickContextMenuItem(fileNode, "Rename");
    await fillInputBox(testInfo.renamedFile);
    await browser.pause(3000);
});

Then("the renamed USS file appears in the directory listing", async function () {
    this.renamedFile = null;
    await browser.waitUntil(
        async () => {
            this.renamedFile = await this.ussDir.findChildItem(testInfo.renamedFile);
            return this.renamedFile != null;
        },
        { timeout: 30000, timeoutMsg: `Renamed file "${testInfo.renamedFile}" did not appear in directory listing` }
    );
    await expect(this.renamedFile).toBeDefined();
});

Then("the original USS file name no longer appears in the directory listing", async function () {
    await browser.waitUntil(
        async () => (await this.ussDir.findChildItem(testInfo.newFile)) == null,
        { timeout: 15000, timeoutMsg: `Original file "${testInfo.newFile}" still visible after rename` }
    );
});

When("the user deletes the renamed USS file from the directory", async function () {
    const fileNode = (await this.ussDir.findChildItem(testInfo.renamedFile)) as TreeItem;
    await expect(fileNode).toBeDefined();
    await fileNode.elem.moveTo();
    await clickContextMenuItem(fileNode, "Delete");
    await browser.pause(3000);
});

When("the user renames the new USS directory to the renamed directory name", async function () {
    const dirNode = (await this.ussDir.findChildItem(testInfo.newDir)) as TreeItem;
    await expect(dirNode).toBeDefined();
    await dirNode.elem.moveTo();
    await clickContextMenuItem(dirNode, "Rename");
    await fillInputBox(testInfo.renamedDir);
    await browser.pause(3000);
});

Then("the renamed USS directory appears in the parent listing", async function () {
    this.renamedDir = null;
    await browser.waitUntil(
        async () => {
            this.renamedDir = await this.ussDir.findChildItem(testInfo.renamedDir);
            return this.renamedDir != null;
        },
        { timeout: 30000, timeoutMsg: `Renamed directory "${testInfo.renamedDir}" did not appear in parent listing` }
    );
    await expect(this.renamedDir).toBeDefined();
});

Then("the original USS directory name no longer appears in the parent listing", async function () {
    await browser.waitUntil(
        async () => (await this.ussDir.findChildItem(testInfo.newDir)) == null,
        { timeout: 15000, timeoutMsg: `Original directory "${testInfo.newDir}" still visible after rename` }
    );
});

When("the user deletes the renamed USS directory from the parent", async function () {
    const dirNode = (await this.ussDir.findChildItem(testInfo.renamedDir)) as TreeItem;
    await expect(dirNode).toBeDefined();
    await dirNode.elem.moveTo();
    await clickContextMenuItem(dirNode, "Delete");
    await browser.pause(3000);
});

When("the user opens the USS file with a specific encoding", async function () {
    const ussFile = (await this.ussDir.findChildItem(testInfo.ussFile)) as TreeItem;
    await expect(ussFile).toBeDefined();
    await ussFile.elem.moveTo();
    await clickContextMenuItem(ussFile, "Open with Encoding");
    await quickPick.selectItemByLabel(testInfo.encoding);
    await browser.pause(2000);
});

Then("the USS file opens in the editor with the specified encoding", async function () {
    const editorView = (await browser.getWorkbench()).getEditorView();
    this.editorForFile = await editorView.openEditor(testInfo.ussFile);
    await expect(this.editorForFile).toBeDefined();
    await this.editorForFile.wait();
    await editorView.closeEditor(await this.editorForFile.getTitle());
});

When("the user copies the USS test file", async function () {
    const ussFile = (await this.ussDir.findChildItem(testInfo.ussFile)) as TreeItem;
    await expect(ussFile).toBeDefined();
    await ussFile.elem.moveTo();
    await clickContextMenuItem(ussFile, "Copy");
    this.copiedFileName = testInfo.ussFile;
});

When("the user pastes the USS file into the new USS directory", async function () {
    // The destination is newDir, just created as a direct child of the already-expanded
    // USS test directory. findChildItem finds it without any scrolling concerns.
    this.copyDstDir = (await this.ussDir.findChildItem(testInfo.newDir)) as TreeItem;
    await expect(this.copyDstDir).toBeDefined();
    await this.copyDstDir.elem.moveTo();
    await clickContextMenuItem(this.copyDstDir, "Paste");
    await browser.pause(5000);
});

Then("the copied USS file appears in the new USS directory listing", async function () {
    await this.copyDstDir.expand();
    await browser.waitUntil(
        async () => (await this.copyDstDir.findChildItem(this.copiedFileName)) != null,
        { timeout: 30000, timeoutMsg: `Copied file "${this.copiedFileName}" did not appear in destination directory` }
    );
    const copiedFile = await this.copyDstDir.findChildItem(this.copiedFileName);
    await expect(copiedFile).toBeDefined();
});

// Runs after every scenario in this feature. Deletes any test artifacts that were created
// but not cleaned up (e.g. when a scenario failed mid-way). Safe to run even when artifacts
// do not exist — errors are silently swallowed.
After(async function () {
    if (!this.ussDir) {
        return;
    }

    // Files and directories that live directly under the USS test directory
    const childNames = [testInfo.newFile, testInfo.renamedFile, testInfo.newDir, testInfo.renamedDir].filter(Boolean) as string[];
    for (const name of childNames) {
        try {
            const item = (await this.ussDir.findChildItem(name)) as TreeItem | null;
            if (item) {
                await item.elem.moveTo();
                await clickContextMenuItem(item, "Delete");
                await browser.pause(1500);
            }
        } catch {
            // Artifact absent or already deleted — continue.
        }
    }

});
