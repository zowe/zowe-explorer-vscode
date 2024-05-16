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

import { Given, Then, When } from "@cucumber/cucumber";
import { paneDivForTree } from "../../shared.steps";
import { Key } from "webdriverio";

// Given
Given("a user who is looking at the Add Config quick pick", async function () {
    // use the data sets pane for the sake of testing
    const dsPane = await paneDivForTree("data sets");
    const plusIcon = await dsPane.getAction(`Add Profile to Data Sets View`);
    await expect(plusIcon).toBeDefined();
    await dsPane.elem.moveTo();
    await plusIcon.elem.click();

    this.addConfigQuickPick = await $(".quick-input-widget");
    await expect(this.addConfigQuickPick).toBeDisplayedInViewport();
});

//
// Scenario: User wants to create a new Team Configuration file
//
When('a user selects "Create a new Team Configuration file"', async function () {
    //const wb = await browser.getWorkbench();
    const createTeamConfigEntry = await $('.monaco-list-row[aria-label="＋ Create a New Team Configuration File"]');
    await createTeamConfigEntry.waitForClickable();
    await createTeamConfigEntry.click();
});

Then("it will ask the user for the desired config location", async function () {
    this.globalCfgOpt = await $('.monaco-list-row[aria-label="Global: in the Zowe home directory"]');
    await expect(this.globalCfgOpt).toBeDisplayedInViewport();

    this.projectCfgOpt = await $('.monaco-list-row[aria-label="Project: in the current working directory"]');
    await expect(this.projectCfgOpt).toBeDisplayedInViewport();
});

Then("the user can dismiss the dialog", async function () {
    await browser.keys(Key.Escape);
    await expect(this.addConfigQuickPick).not.toBeDisplayedInViewport();
});

//
// Scenario: User creates a global Team Configuration
//
When("the user selects the global option", async function () {
    await this.globalCfgOpt.waitForClickable();
    await this.globalCfgOpt.click();
});
Then("it will open the config in the editor", async function () {
    const editorView = (await browser.getWorkbench()).getEditorView();
    await editorView.wait();
    const activeEditor = await editorView.getActiveTab();
    const editorTitle = await activeEditor.getTitle();

    // ensure that an editor was opened with the new Zowe config
    await expect(editorTitle.includes("zowe.config.json")).toBe(true);
    await editorView.closeEditor(editorTitle);
});

//
// Scenario: User wants to edit existing Team Configuration file
//
When('a user selects "Edit Team Configuration File"', async function () {
    const editTeamConfigEntry = await $('.monaco-list-row[aria-label="✏ Edit Team Configuration File"]');
    await editTeamConfigEntry.waitForClickable();
    await editTeamConfigEntry.click();
});
