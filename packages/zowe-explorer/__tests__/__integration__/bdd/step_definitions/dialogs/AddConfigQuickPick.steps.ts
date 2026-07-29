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
    await expect(firstProfileEntry).toBeClickable();
    const profileLabelAttr = await firstProfileEntry.getAttribute("aria-label");
    // strip off any extra details added to the label of the profile node
    this.profileName = profileLabelAttr.substring(profileLabelAttr.lastIndexOf(" ")).trim();
    // Focus + JS click + Enter for maximum selection reliability in CI:
    // The JS click alone can be swallowed when VS Code re-renders the virtual list;
    // sending Enter afterwards commits the selection through the keyboard path.
    await browser.execute((el: HTMLElement) => el.focus(), firstProfileEntry);
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
        await browser.execute((el: HTMLElement) => el.focus(), retryEntry);
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

    // Monaco virtual-list rows are not interactable via WebDriver click in headless
    // Linux. Pure keyboard navigation is the only reliable approach, but browser.keys()
    // sends to whatever element currently has focus — which may have drifted to the
    // editor/sidebar after the async tree refresh that opens this picker.
    // Explicitly JS-focus the quick pick's <input> first to anchor keyboard events
    // to the correct widget. The <input> is a real DOM element and accepts JS focus
    // without any interactability check.
    const qpInput = await browser.$(".quick-input-widget input");
    await qpInput.waitForExist({ timeout: 5000 });
    await browser.execute((el: HTMLElement) => el.focus(), qpInput);

    // "Yes" (index 0) is already the active item (qp.activeItems = [qp.items[0]]).
    // For "No" (index 1): move focus one step down with ArrowDown, then commit.
    if (!this.userSelectedYes) {
        await browser.keys(Key.ArrowDown);
    }
    await browser.keys(Key.Enter);

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
        // Wait briefly for any in-flight tree refresh to settle, then assert absence.
        // ViewSection.findItem always returns a CustomTreeItem object (never undefined),
        // so we must check DOM existence via .elem.isExisting() instead of toBeUndefined().
        await browser.pause(500);
        const ussItem = await ussPane.findItem(this.profileName);
        expect(await ussItem.elem.isExisting()).toBe(false);
    }
});
