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
import { getDatasetExtension } from "../utils/datasetExtensions";
import { ProfileNode } from "../../../__pageobjects__/ProfileNode";

Then("the user should be able to save it successfully", async function () {
    await this.editorForFile.save();
    // Give time for the LPAR to finish handling the save
    await browser.pause(3000);
    // Wait for the editor to remove "dirty" (unsaved) flag to verify successful save operation
    await browser.waitUntil(async () => !(await this.editorForFile.isDirty()));
    await this.editorView.closeEditor(await this.editorForFile.getTitle());
});
Then("the user can right-click on the child node and add it as a favorite", async function () {
    // Determine which action button to use to add the child node to favorites
    let addToFavsBtn;
    if (this.tree.toLowerCase() === "data sets") {
        this.pds = await (await this.profileNode.find()).findChildItem(process.env.ZE_TEST_PDS);
        const pdsMember: TreeItem = await this.pds.findChildItem(process.env.ZE_TEST_PDS_MEMBER);
        await pdsMember.elem.moveTo();
        addToFavsBtn = (await pdsMember.getActionButtons())[0];
    } else {
        this.ussDir = await (await this.profileNode.find()).findChildItem(process.env.ZE_TEST_USS_DIR);
        const ussFile: TreeItem = await this.ussDir.findChildItem(process.env.ZE_TEST_USS_FILE);
        await expect(ussFile).toBeDefined();
        await ussFile.elem.moveTo();
        addToFavsBtn = (await ussFile.getActionButtons())[0];
    }
    await addToFavsBtn.elem.click();
});
When("the user finds the child node in Favorites", async function () {
    this.profileNode = new ProfileNode(browser, this.treePane, process.env.ZE_TEST_PROFILE_NAME, true);
    await (await this.profileNode.find()).expand();
    await this.profileNode.waitUntilExpanded();
    if (this.tree.toLowerCase() === "data sets") {
        // PDS member
        await this.pds.collapse();
        await this.profileNode.waitUntilHasChildren();
        this.pds = await this.profileNode.revealChildItem(process.env.ZE_TEST_PDS);
        this.pdsMember = await this.pds.findChildItem(process.env.ZE_TEST_PDS_MEMBER);
        await expect(this.pdsMember).toBeDefined();
    } else {
        // USS file
        await this.ussDir.collapse();
        this.ussFile = await (await this.profileNode.find()).findChildItem(process.env.ZE_TEST_USS_FILE);
        await expect(this.ussFile).toBeDefined();
    }
});
Then("the user can select the favorite in the list and open it", async function () {
    this.editingFavorite = true;
    this.editorView = (await browser.getWorkbench()).getEditorView();
    if (this.tree.toLowerCase() === "data sets") {
        const pdsName = process.env.ZE_TEST_PDS as string;
        const pdsMemberName = process.env.ZE_TEST_PDS_MEMBER as string;
        const pdsExtension = getDatasetExtension(pdsName);
        const memberEditorTitle = `${pdsMemberName}${pdsExtension ?? ""}`;
        await expect(this.pdsMember).toBeDefined();
        await this.pdsMember.select();
        await browser.waitUntil(async () => (await this.editorView.getTabByTitle(memberEditorTitle)) !== undefined);
        this.editorForFile = await this.editorView.openEditor(memberEditorTitle);
    } else {
        await expect(this.ussFile).toBeDefined();
        await this.ussFile.select();
        await browser.waitUntil(async () => (await this.editorView.getTabByTitle(process.env.ZE_TEST_USS_FILE)) !== undefined);
        this.editorForFile = await this.editorView.openEditor(process.env.ZE_TEST_USS_FILE);
    }
});
