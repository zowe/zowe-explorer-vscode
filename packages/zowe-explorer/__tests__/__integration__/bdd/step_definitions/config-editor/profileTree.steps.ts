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

import { Then } from "@cucumber/cucumber";

Then('the profile tree should contain 3 nodes with titles "test1", "test2", "test3"', async () => {
    // The Config Editor webview should already be open from setup.steps.ts
    const workbench = await browser.getWorkbench();
    const editorView = workbench.getEditorView();
    const editor = await editorView.openEditor("Config Editor");

    console.log(editor);
    // The profile tree container inside the webview
    const profileTreeRoot = await editor.elem.$(".profile-tree");
    await expect(profileTreeRoot).toBeDisplayed();

    // Get all nodes
    const nodes = await profileTreeRoot.$$(".profile-tree-node");
    await expect(nodes.length).toBe(4);

    // Verify node text
    const texts: string[] = [];
    for (const node of nodes) {
        texts.push(await node.getText());
    }

    const expectedTitles = ["zosmf1", "zosmf2", "zosmf3", "base"];
    for (const title of expectedTitles) {
        expect(texts).toContain(title);
    }
});
