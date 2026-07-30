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

Then("the user can dismiss the dialog", async function () {
    await browser.keys(Key.Escape);
    await browser.waitUntil((): Promise<boolean> => quickPick.isNotInViewport());
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
    // Read the profile name from the aria-label before clicking
    // (aria-label = codicon-text + profile name, e.g. "home   zosmf1")
    const profileLabelAttr = await firstProfileEntry.getAttribute("aria-label");
    // strip any leading icon text — the actual profile name is the last whitespace-separated token
    this.profileName = profileLabelAttr.substring(profileLabelAttr.lastIndexOf(" ")).trim();

    // Use a native WebDriver click — the same pattern used in UpdateCredentials.steps.ts.
    // The item at index 3 is always visible in a standard-height quick pick, so it is
    // interactable and a plain .click() is reliable.
    await firstProfileEntry.waitForClickable({ timeout: 10000 });
    await firstProfileEntry.click();
});

Then("it will prompt the user to add the profile to one or all trees", async function () {
    // After the profile entry is clicked, VS Code closes the profile picker and
    // opens the Yes/No "apply to all trees" quick pick.
    // Wait for the initial quick pick to close / transition to the new one.
    await browser
        .waitUntil(async () => quickPick.isNotInViewport(), {
            timeout: 5000,
            timeoutMsg: "Initial quick pick did not close after selecting a profile",
        })
        .catch(() => {
            // Picker may re-render in place rather than fully unmount — continue regardless.
        });

    // Wait for the Yes/No items to appear in the (possibly re-rendered) quick pick.
    await browser.waitUntil(
        async () => {
            const yesOpt = await quickPick.findItem("Yes, Apply to all trees");
            const noOpt = await quickPick.findItem("No, Apply to current tree selected");
            return (await yesOpt.isExisting()) || (await noOpt.isExisting());
        },
        { timeout: 30000, timeoutMsg: "Yes/No quick pick did not appear after selecting a profile" }
    );

    this.yesOpt = await quickPick.findItem("Yes, Apply to all trees");
    this.noOpt = await quickPick.findItem("No, Apply to current tree selected");
    await expect(this.yesOpt).toExist();
    await expect(this.noOpt).toExist();
});

When(/a user selects (.*) to apply to all trees/, async function (choice: string) {
    this.userSelectedYes = choice === "Yes";

    // Re-query the Yes/No options fresh to avoid stale element references.
    const yesOpt = await quickPick.findItem("Yes, Apply to all trees");
    const noOpt = await quickPick.findItem("No, Apply to current tree selected");

    // Use native clicks — UpdateCredentials.steps.ts uses this same pattern
    // and it passes reliably in CI.
    if (this.userSelectedYes) {
        await yesOpt.waitForClickable({ timeout: 10000 });
        await yesOpt.click();
    } else {
        await noOpt.waitForClickable({ timeout: 10000 });
        await noOpt.click();
    }

    // Wait for the Yes/No quick pick to close before asserting tree state.
    await browser
        .waitUntil(async () => quickPick.isNotInViewport(), {
            timeout: 10000,
            timeoutMsg: "Yes/No quick pick did not close after selecting an option",
        })
        .catch(() => {
            // Tolerate re-render in-place; the selection was still sent.
        });
});

Then("it will add a tree item for the profile to the correct trees", async function () {
    const dsPane = await paneDivForTree("data sets");
    const ussPane = await paneDivForTree("uss");

    // Wait until the profile node actually appears in the DS tree DOM.
    // ViewSection.findItem returns a CustomTreeItem wrapper (never undefined);
    // .elem is the underlying WebdriverIO element for DOM existence checks.
    await browser.waitUntil(
        async () => {
            const item = await dsPane.findItem(this.profileName);
            return item != null && (await item.elem.isExisting());
        },
        { timeout: 10000, timeoutMsg: `Profile "${this.profileName}" did not appear in Data Sets tree` }
    );

    if (this.userSelectedYes) {
        // "Yes" path: profile must appear in USS tree too.
        await browser.waitUntil(
            async () => {
                const item = await ussPane.findItem(this.profileName);
                return item != null && (await item.elem.isExisting());
            },
            { timeout: 10000, timeoutMsg: `Profile "${this.profileName}" did not appear in USS tree` }
        );
    } else {
        // "No" path: profile must NOT be in USS tree.
        // Wait until the USS pane either doesn't have the node or its DOM node is absent.
        await browser.waitUntil(
            async () => {
                const item = await ussPane.findItem(this.profileName);
                if (!item) {
                    // Not present at all => success (absent)
                    return true;
                }
                // Item wrapper exists; check whether its DOM element exists
                return !(await item.elem.isExisting());
            },
            {
                timeout: 10000,
                timeoutMsg: `Profile "${this.profileName}" unexpectedly appeared in USS tree`,
            }
        );
    }
});
