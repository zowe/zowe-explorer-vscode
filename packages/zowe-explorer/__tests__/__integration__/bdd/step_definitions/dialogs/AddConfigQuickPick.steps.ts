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
import quickPick from "../../../../__pageobjects__/QuickPick";

Given("a user who is looking at the Add Config quick pick", async function () {
    // use the data sets pane for the sake of testing
    const dsPane = await paneDivForTree("data sets");
    const plusIcon = await dsPane.getAction(`Add Profile to Data Sets View`);
    await expect(plusIcon).toBeDefined();
    await dsPane.elem.moveTo();
    await expect(plusIcon.elem).toBeClickable();
    await plusIcon.elem.click();

    await browser.waitUntil(() => quickPick.isDisplayed());
});

//
// Scenario: User wants to create a new Team Configuration file
//
When("a user selects 'Create a new Team Configuration file'", async function () {
    const createTeamConfigEntry = await quickPick.findItem("＋ Create a New Team Configuration File");
    await expect(createTeamConfigEntry).toBeClickable();
    await createTeamConfigEntry.click();
});

Then("it will ask the user for the desired config location", async function () {
    this.globalCfgOpt = await quickPick.findItem("Global: in the Zowe home directory");
    await expect(this.globalCfgOpt).toBeDisplayedInViewport();

    this.projectCfgOpt = await quickPick.findItem("Project: in the current working directory");
    await expect(this.projectCfgOpt).toBeDisplayedInViewport();
});

Then("the user can dismiss the dialog", async function () {
    await browser.keys(Key.Escape);
    await browser.waitUntil((): Promise<boolean> => quickPick.isNotInViewport());
});

//
// Scenario: User creates a global Team Configuration
//
When("the user selects the global option", async function () {
    await expect(this.globalCfgOpt).toBeClickable();
    await this.globalCfgOpt.click();
});
Then("it will open the config in the editor", async function () {
    const editorView = (await browser.getWorkbench()).getEditorView();
    await expect(editorView).toBeDefined();
    await expect(editorView.elem).toBeDisplayedInViewport();
    const activeEditor = await editorView.getActiveTab();
    const editorTitle = await activeEditor.getTitle();

    // ensure that an editor was opened with the new Zowe config
    await expect(editorTitle.includes("zowe.config.json")).toBe(true);
    await editorView.closeEditor(editorTitle);
});

//
// Scenario: User wants to edit existing Team Configuration file
//
When("a user selects 'Edit Team Configuration File'", async function () {
    const editTeamConfigEntry = await quickPick.findItem("✏ Edit Team Configuration File");
    await expect(editTeamConfigEntry).toBeClickable();
    await editTeamConfigEntry.click();
});

//
// Scenario: User wants to add a profile to a tree
//
When("a user selects the first profile in the list", async function () {
    const firstProfileEntry = await quickPick.findItemByIndex(2);
    await expect(firstProfileEntry).toBeClickable();
    const profileLabelAttr = await firstProfileEntry.getAttribute("aria-label");
    // strip off any extra details added to the label of the profile node
    this.profileName = profileLabelAttr.substring(profileLabelAttr.lastIndexOf(" ")).trim();
    await firstProfileEntry.click();
});
Then("it will prompt the user to add the profile to one or all trees", async function () {
    this.yesOpt = await quickPick.findItem("Yes, Apply to all trees");
    await expect(this.yesOpt).toBeDefined();
    this.noOpt = await quickPick.findItem("No, Apply to current tree selected");
    await expect(this.noOpt).toBeDefined();
});
When(/a user selects (.*) to apply to all trees/, async function (choice: string) {
    this.userSelectedYes = choice === "Yes";
    if (this.userSelectedYes) {
        await expect(this.yesOpt).toBeClickable();
        await this.yesOpt.click();
    } else {
        await expect(this.noOpt).toBeClickable();
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
