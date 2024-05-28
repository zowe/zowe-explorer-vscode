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
import { paneDivForTree } from "../../../../__common__/shared.wdio";
import { Key } from "webdriverio";

Given("a user who is looking at the Add Config quick pick", async function () {
    // use the data sets pane for the sake of testing
    const dsPane = await paneDivForTree("data sets");
    const plusIcon = await dsPane.getAction(`Add Profile to Data Sets View`);
    await expect(plusIcon).toBeDefined();
    await dsPane.elem.moveTo();
    await plusIcon?.elem.click();

    this.addConfigQuickPick = await $(".quick-input-widget");
    await this.addConfigQuickPick.waitForClickable();
});

//
// Scenario: User wants to create a new Team Configuration file
//
When('a user selects "Create a new Team Configuration file"', async function () {
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

//
// Scenario: User wants to add a profile to a tree
//
When("a user selects the first profile in the list", async function () {
    const firstProfileEntry = await this.addConfigQuickPick.$('.monaco-list-row[data-index="2"]');
    await firstProfileEntry.waitForClickable();
    const profileLabelAttr = await firstProfileEntry.getAttribute("aria-label");
    // strip off any extra details added to the label of the profile node
    this.profileName = profileLabelAttr.substring(profileLabelAttr.lastIndexOf(" ")).trim();
    await firstProfileEntry.click();
});
Then("it will prompt the user to add the profile to one or all trees", async function () {
    this.quickPickTreeSelection = await $(".quick-input-widget");
    this.yesOpt = await $('.monaco-list-row[aria-label="Yes, Apply to all trees"]');
    await expect(this.yesOpt).toBeDefined();
    this.noOpt = await $('.monaco-list-row[aria-label="No, Apply to current tree selected"]');
    await expect(this.noOpt).toBeDefined();
});
When(/a user selects (.*) to apply to all trees/, async function (choice: string) {
    this.userSelectedYes = choice === "Yes";
    if (this.userSelectedYes) {
        await this.yesOpt.waitForClickable();
        await this.yesOpt.click();
    } else {
        await this.noOpt.waitForClickable();
        await this.noOpt.click();
    }
});
Then("it will add a tree item for the profile to the correct trees", async function () {
    const dsPane = await paneDivForTree("data sets");
    const ussPane = await paneDivForTree("uss");

    await expect(await dsPane.findItem(this.profileName)).toBeDefined();
    if (this.userSelectedYes) {
        await expect(await ussPane.findItem(this.profileName)).toBeDefined();
    } else {
        await expect(await ussPane.findItem(this.profileName)).toBeUndefined();
    }
});
