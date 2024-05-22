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

Then("the user can select a USS file in the list and open it", async function () {
    await expect(this.children.length).not.toBe(0);
    this.ussFile = await this.ussDir.findChildItem(process.env.ZE_TEST_USS_FILE);
    await this.ussFile.select();
    this.editorView = (await browser.getWorkbench()).getEditorView();
    this.editorForFile = await this.editorView.openEditor(process.env.ZE_TEST_USS_FILE);
    await expect(this.editorForFile).toBeDefined();
});
When("the user edits the USS file", async function () {
    await this.editorForFile.setText("Hello from a USS test!");
});
