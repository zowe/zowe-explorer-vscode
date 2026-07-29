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
    await expect(editorTitle.includes("Config Editor")).toBe(true);
    await editorView.closeEditor(editorTitle);
});

//
// Scenario: User wants to edit existing Team Configuration file
//
When("a user selects 'Edit in Zowe Configuration Editor'", async function () {
    const editTeamConfigEntry = await quickPick.findItem("✏ Edit Team Configuration File in Zowe Configuration Editor");
    await expect(editTeamConfigEntry).toBeClickable();
    await editTeamConfigEntry.click();
});

//
// Scenario: User wants to add a profile to a tree
//

/**
 * Returns the first profile entry in the quick pick, skipping the three fixed
 * header items: (0) Create config, (1) Edit config in ZCE, (2) Edit config via JSON.
 * Using the explicit index avoids picking a header if the list hasn't fully rendered.
 */
async function findFirstProfileEntry(): Promise<ChainablePromiseElement> {
    // The quick-pick list always starts with three fixed control items at indices 0–2.
    // The first selectable profile is at index 3.
    const entry = await quickPick.findItemByIndex(3);
    await entry.waitForExist({ timeout: 10000 });
    return entry;
}

When("a user selects the first profile in the list", async function () {
    const firstProfileEntry = await findFirstProfileEntry();
    await expect(firstProfileEntry).toBeClickable();
    const profileLabelAttr = await firstProfileEntry.getAttribute("aria-label");
    // strip off any extra details added to the label of the profile node
    this.profileName = profileLabelAttr.substring(profileLabelAttr.lastIndexOf(" ")).trim();
    // Focus + JS click + Enter for maximum selection reliability in CI:
    // The JS click alone can be swallowed when VS Code re-renders the virtual list;
    // sending Enter afterwards commits the selection through the keyboard path.
    await browser.execute((el: HTMLElement) => (el as HTMLElement).focus(), firstProfileEntry);
    await browser.execute((el: HTMLElement) => el.click(), firstProfileEntry);
    await browser.keys(Key.Enter);
});
Then("it will prompt the user to add the profile to one or all trees", async function () {
    // Wait for the initial quick pick to close before looking for the Yes/No picker.
    // Tolerate the case where VS Code re-renders the same widget in-place (catch swallows
    // the timeout so the test can still proceed if the picker never fully disappears).
    await browser
        .waitUntil(async () => quickPick.isNotInViewport(), {
            timeout: 5000,
            timeoutMsg: "Initial quick pick did not close after selecting a profile",
        })
        .catch(() => {
            // Picker may re-render in place rather than close — continue regardless.
        });

    const waitForYesNo = (timeoutMs = 30000): Promise<boolean> =>
        browser.waitUntil(
            async () => {
                const yesOpt = await quickPick.findItem("Yes, Apply to all trees");
                const noOpt = await quickPick.findItem("No, Apply to current tree selected");
                return (await yesOpt.isExisting()) || (await noOpt.isExisting());
            },
            { timeout: timeoutMs, timeoutMsg: "Yes/No quick pick did not appear after selecting a profile" }
        );

    // First attempt: wait up to 30 s for the Yes/No items to appear.
    let seen = await waitForYesNo().catch(() => false);

    if (!seen) {
        // The profile selection may not have been committed — re-open the quick pick
        // and retry with focus + click + Enter before giving up.
        const dsPane = await paneDivForTree("data sets");
        const plusIcon = await dsPane.getAction(`Add Profile to Data Sets View`);
        await dsPane.elem.moveTo();
        await plusIcon.elem.click();
        await browser.waitUntil(() => quickPick.isDisplayed(), { timeout: 10000 });

        const retryEntry = await findFirstProfileEntry();
        const profileLabelAttr = await retryEntry.getAttribute("aria-label");
        this.profileName = profileLabelAttr.substring(profileLabelAttr.lastIndexOf(" ")).trim();
        await browser.execute((el: HTMLElement) => (el as HTMLElement).focus(), retryEntry);
        await browser.execute((el: HTMLElement) => el.click(), retryEntry);
        await browser.keys(Key.Enter);

        await browser.waitUntil(async () => quickPick.isNotInViewport(), { timeout: 5000 }).catch(() => {});

        seen = await waitForYesNo(15000).catch(() => false);
    }

    if (!seen) {
        throw new Error("Yes/No quick pick did not appear after selecting a profile (after retry)");
    }

    this.yesOpt = await quickPick.findItem("Yes, Apply to all trees");
    this.noOpt = await quickPick.findItem("No, Apply to current tree selected");
    await expect(this.yesOpt).toExist();
    await expect(this.noOpt).toExist();
});
When(/a user selects (.*) to apply to all trees/, async function (choice: string) {
    this.userSelectedYes = choice === "Yes";
    // The Then step above already confirmed the quick pick is open and the items exist.
    // Re-query fresh — stored references go stale as the quick pick can re-render.
    // Use JS click: VS Code's virtual list marks offscreen rows as non-clickable.
    const label = this.userSelectedYes ? "Yes, Apply to all trees" : "No, Apply to current tree selected";
    const opt = await quickPick.findItem(label);
    await opt.waitForExist({ timeout: 10000 });
    await browser.execute((el: HTMLElement) => el.click(), opt);
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
