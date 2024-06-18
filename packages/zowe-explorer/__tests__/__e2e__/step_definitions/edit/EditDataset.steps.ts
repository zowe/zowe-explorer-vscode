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
import { paneDivForTree } from "../../../__common__/shared.wdio";

Then("the user can select a PDS member in the list and open it", async function () {
    await expect(this.children.length).not.toBe(0);
    this.pdsMember = await this.pds.findChildItem(process.env.ZE_TEST_PDS_MEMBER);
    await this.pdsMember.select();

    // Wait for editor object to become available before editing/saving
    this.editorView = (await browser.getWorkbench()).getEditorView();
    this.editorForFile = await this.editorView.openEditor(process.env.ZE_TEST_PDS_MEMBER);
    await expect(this.editorForFile).toBeDefined();
});
Then("the user can select a PS in the list and open it", async function () {
    const dsPane = await paneDivForTree("data sets");

    // collapse remaining trees to make room for tree items to render in DOM
    const jobsPane = await paneDivForTree("jobs");
    await jobsPane.collapse();
    const ussPane = await paneDivForTree("uss");
    await ussPane.collapse();

    this.ps = await dsPane.findItem(process.env.ZE_TEST_PS);
    await this.ps.select();

    // Wait for editor object to become available before editing/saving
    this.editorView = (await browser.getWorkbench()).getEditorView();
    this.editorForFile = await this.editorView.openEditor(process.env.ZE_TEST_PS);
    await this.editorForFile.wait();
});
When("the user edits the PDS member", async function () {
    await this.editorForFile.clearText();
    await this.editorForFile.setText(`Hello from a Data Set test for a ${this.editingFavorite ? "favorited " : ""}PDS member!`);
});
When("the user edits the PS", async function () {
    await this.editorForFile.clearText();
    await this.editorForFile.setText("Hello from a Data Set test for a PS!");
});
