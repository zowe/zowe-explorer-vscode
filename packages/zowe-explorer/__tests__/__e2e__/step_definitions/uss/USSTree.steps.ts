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
import { TreeItem } from "wdio-vscode-service";
import { clickContextMenuItem, fillInputBox } from "../../../__common__/shared.wdio";
import quickPick from "../../../__pageobjects__/QuickPick";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Waits for a VS Code modal confirmation dialog and clicks the button
 * matching the supplied label.
 */
async function clickModalButton(buttonLabel: string): Promise<void> {
    await browser.waitUntil(
        async () => {
            try {
                const buttons = await browser.$$(".dialog-buttons-container .monaco-button, .dialog-buttons .monaco-button");
                for (const btn of buttons) {
                    if ((await btn.getText()).trim() === buttonLabel) return true;
                }
                return false;
            } catch {
                return false;
            }
        },
        { timeout: 15000, timeoutMsg: `Modal button "${buttonLabel}" did not appear` }
    );
    const buttons = await browser.$$(".dialog-buttons-container .monaco-button, .dialog-buttons .monaco-button");
    for (const btn of buttons) {
        if ((await btn.getText()).trim() === buttonLabel) {
            await btn.click();
            return;
        }
    }
}

// ─── Step: listing files ─────────────────────────────────────────────────────

Then("the USS directory has files listed under it", async function () {
    await expect(this.children.length).toBeGreaterThan(0);
});

// ─── Steps: create/delete file ───────────────────────────────────────────────

When("the user creates a new USS file in the directory", async function () {
    await this.ussDir.elem.moveTo();
    await clickContextMenuItem(this.ussDir, "Create File");
    await fillInputBox(process.env.ZE_TEST_USS_NEW_FILE);
    // Allow time for the remote create to complete and tree to refresh
    await browser.pause(3000);
});

Then("the new USS file appears in the directory listing", async function () {
    this.newFile = null;
    await browser.waitUntil(
        async () => {
            this.newFile = await this.ussDir.findChildItem(process.env.ZE_TEST_USS_NEW_FILE);
            return this.newFile != null;
        },
        { timeout: 30000, timeoutMsg: `New file "${process.env.ZE_TEST_USS_NEW_FILE}" did not appear in directory listing` }
    );
    await expect(this.newFile).toBeDefined();
});

When("the user deletes the new USS file from the directory", async function () {
    const fileNode = (await this.ussDir.findChildItem(process.env.ZE_TEST_USS_NEW_FILE)) as TreeItem;
    await expect(fileNode).toBeDefined();
    await fileNode.elem.moveTo();
    await clickContextMenuItem(fileNode, "Delete");
    await clickModalButton("Delete");
    await browser.pause(3000);
});

Then("the USS file no longer appears in the directory listing", async function () {
    await browser.waitUntil(
        async () => (await this.ussDir.findChildItem(process.env.ZE_TEST_USS_NEW_FILE)) == null,
        { timeout: 30000, timeoutMsg: `File "${process.env.ZE_TEST_USS_NEW_FILE}" is still visible after delete` }
    );
});

// ─── Steps: create/delete directory ─────────────────────────────────────────

When("the user creates a new USS directory inside the parent", async function () {
    await this.ussDir.elem.moveTo();
    await clickContextMenuItem(this.ussDir, "Create Directory");
    await fillInputBox(process.env.ZE_TEST_USS_NEW_DIR);
    await browser.pause(3000);
});

Then("the new USS directory appears in the parent listing", async function () {
    this.newDir = null;
    await browser.waitUntil(
        async () => {
            this.newDir = await this.ussDir.findChildItem(process.env.ZE_TEST_USS_NEW_DIR);
            return this.newDir != null;
        },
        { timeout: 30000, timeoutMsg: `New directory "${process.env.ZE_TEST_USS_NEW_DIR}" did not appear in parent listing` }
    );
    await expect(this.newDir).toBeDefined();
});

When("the user deletes the new USS directory from the parent", async function () {
    const dirNode = (await this.ussDir.findChildItem(process.env.ZE_TEST_USS_NEW_DIR)) as TreeItem;
    await expect(dirNode).toBeDefined();
    await dirNode.elem.moveTo();
    await clickContextMenuItem(dirNode, "Delete");
    await clickModalButton("Delete");
    await browser.pause(3000);
});

Then("the USS directory no longer appears in the parent listing", async function () {
    await browser.waitUntil(
        async () => (await this.ussDir.findChildItem(process.env.ZE_TEST_USS_NEW_DIR)) == null,
        { timeout: 30000, timeoutMsg: `Directory "${process.env.ZE_TEST_USS_NEW_DIR}" is still visible after delete` }
    );
});

// ─── Steps: rename file ──────────────────────────────────────────────────────

When("the user renames the new USS file to the renamed file name", async function () {
    const fileNode = (await this.ussDir.findChildItem(process.env.ZE_TEST_USS_NEW_FILE)) as TreeItem;
    await expect(fileNode).toBeDefined();
    await fileNode.elem.moveTo();
    await clickContextMenuItem(fileNode, "Rename");
    await fillInputBox(process.env.ZE_TEST_USS_RENAMED_FILE);
    await browser.pause(3000);
});

Then("the renamed USS file appears in the directory listing", async function () {
    this.renamedFile = null;
    await browser.waitUntil(
        async () => {
            this.renamedFile = await this.ussDir.findChildItem(process.env.ZE_TEST_USS_RENAMED_FILE);
            return this.renamedFile != null;
        },
        { timeout: 30000, timeoutMsg: `Renamed file "${process.env.ZE_TEST_USS_RENAMED_FILE}" did not appear in directory listing` }
    );
    await expect(this.renamedFile).toBeDefined();
});

Then("the original USS file name no longer appears in the directory listing", async function () {
    await browser.waitUntil(
        async () => (await this.ussDir.findChildItem(process.env.ZE_TEST_USS_NEW_FILE)) == null,
        { timeout: 15000, timeoutMsg: `Original file "${process.env.ZE_TEST_USS_NEW_FILE}" still visible after rename` }
    );
});

When("the user deletes the renamed USS file from the directory", async function () {
    const fileNode = (await this.ussDir.findChildItem(process.env.ZE_TEST_USS_RENAMED_FILE)) as TreeItem;
    await expect(fileNode).toBeDefined();
    await fileNode.elem.moveTo();
    await clickContextMenuItem(fileNode, "Delete");
    await clickModalButton("Delete");
    await browser.pause(3000);
});

// ─── Steps: rename directory ─────────────────────────────────────────────────

When("the user renames the new USS directory to the renamed directory name", async function () {
    const dirNode = (await this.ussDir.findChildItem(process.env.ZE_TEST_USS_NEW_DIR)) as TreeItem;
    await expect(dirNode).toBeDefined();
    await dirNode.elem.moveTo();
    await clickContextMenuItem(dirNode, "Rename");
    await fillInputBox(process.env.ZE_TEST_USS_RENAMED_DIR);
    await browser.pause(3000);
});

Then("the renamed USS directory appears in the parent listing", async function () {
    this.renamedDir = null;
    await browser.waitUntil(
        async () => {
            this.renamedDir = await this.ussDir.findChildItem(process.env.ZE_TEST_USS_RENAMED_DIR);
            return this.renamedDir != null;
        },
        { timeout: 30000, timeoutMsg: `Renamed directory "${process.env.ZE_TEST_USS_RENAMED_DIR}" did not appear in parent listing` }
    );
    await expect(this.renamedDir).toBeDefined();
});

Then("the original USS directory name no longer appears in the parent listing", async function () {
    await browser.waitUntil(
        async () => (await this.ussDir.findChildItem(process.env.ZE_TEST_USS_NEW_DIR)) == null,
        { timeout: 15000, timeoutMsg: `Original directory "${process.env.ZE_TEST_USS_NEW_DIR}" still visible after rename` }
    );
});

When("the user deletes the renamed USS directory from the parent", async function () {
    const dirNode = (await this.ussDir.findChildItem(process.env.ZE_TEST_USS_RENAMED_DIR)) as TreeItem;
    await expect(dirNode).toBeDefined();
    await dirNode.elem.moveTo();
    await clickContextMenuItem(dirNode, "Delete");
    await clickModalButton("Delete");
    await browser.pause(3000);
});

// ─── Steps: open with encoding ───────────────────────────────────────────────

When("the user opens the USS file with a specific encoding", async function () {
    const ussFile = (await this.ussDir.findChildItem(process.env.ZE_TEST_USS_FILE)) as TreeItem;
    await expect(ussFile).toBeDefined();
    await ussFile.elem.moveTo();
    await clickContextMenuItem(ussFile, "Open with Encoding");
    await quickPick.selectItemByLabel(process.env.ZE_TEST_USS_ENCODING);
    await browser.pause(2000);
});

Then("the USS file opens in the editor with the specified encoding", async function () {
    const editorView = (await browser.getWorkbench()).getEditorView();
    this.editorForFile = await editorView.openEditor(process.env.ZE_TEST_USS_FILE);
    await expect(this.editorForFile).toBeDefined();
    await this.editorForFile.wait();
    await editorView.closeEditor(await this.editorForFile.getTitle());
});

// ─── Steps: copy/paste file ───────────────────────────────────────────────────

When("the user copies the USS test file", async function () {
    const ussFile = (await this.ussDir.findChildItem(process.env.ZE_TEST_USS_FILE)) as TreeItem;
    await expect(ussFile).toBeDefined();
    await ussFile.elem.moveTo();
    await clickContextMenuItem(ussFile, "Copy");
    this.copiedFileName = process.env.ZE_TEST_USS_FILE;
});

When("the user pastes the USS file into the copy destination directory", async function () {
    // ZE_TEST_USS_COPY_DST_DIR is a directory at the same level as ZE_TEST_USS_DIR.
    // Use findChildItem + expand directly — revealChildItem waits for children which
    // would time out when the destination directory starts empty.
    const dstDirName = process.env.ZE_TEST_USS_COPY_DST_DIR.replace(`${process.env.ZE_TEST_USS_FILTER}/`, "");
    const profileNode = await this.profileNode.find();
    this.copyDstDir = (await profileNode.findChildItem(dstDirName)) as TreeItem;
    await expect(this.copyDstDir).toBeDefined();
    await this.copyDstDir.expand();
    await this.copyDstDir.elem.moveTo();
    await clickContextMenuItem(this.copyDstDir, "Paste");
    await browser.pause(5000);
});

Then("the copied USS file appears in the destination directory listing", async function () {
    // Re-expand the destination so the tree reflects the newly pasted file
    await this.copyDstDir.expand();
    await browser.waitUntil(
        async () => (await this.copyDstDir.findChildItem(this.copiedFileName)) != null,
        { timeout: 30000, timeoutMsg: `Copied file "${this.copiedFileName}" did not appear in destination directory` }
    );
    const copiedFile = await this.copyDstDir.findChildItem(this.copiedFileName);
    await expect(copiedFile).toBeDefined();
});

When("the user deletes the copied USS file from the destination directory", async function () {
    const copiedFile = (await this.copyDstDir.findChildItem(this.copiedFileName)) as TreeItem;
    await expect(copiedFile).toBeDefined();
    await copiedFile.elem.moveTo();
    await clickContextMenuItem(copiedFile, "Delete");
    await clickModalButton("Delete");
    await browser.pause(3000);
});
