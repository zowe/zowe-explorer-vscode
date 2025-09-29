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

import { When, Then } from "@cucumber/cucumber";
import * as fs from "fs";
import * as path from "path";

declare const browser: any;
declare const expect: any;

async function ensureConfigEditorReady() {
    const appContainer = await browser.$("[data-testid='config-editor-app']");
    await appContainer.waitForExist({ timeout: 1000 });
}

When("the user opens the Profile Wizard modal", async function () {
    await ensureConfigEditorReady();

    let wizardModal = null;

    const createProfileButton = await browser.$(
        "[data-testid='create-profile-button'], .create-profile-button, [title*='Create Profile'], [title*='Add Profile']"
    );
    if (await createProfileButton.isExisting()) {
        await createProfileButton.click();
        await browser.pause(500);
        wizardModal = await browser.$("#profile-wizard-modal");
    }

    if (!wizardModal || !(await wizardModal.isExisting())) {
        const addButton = await browser.$("[data-testid='add-profile-button'], .add-profile-button, [title*='Add Profile'], .add-button");
        if (await addButton.isExisting()) {
            await addButton.click();
            await browser.pause(500);
            wizardModal = await browser.$("#profile-wizard-modal");
        }
    }

    if (!wizardModal || !(await wizardModal.isExisting())) {
        const wizardButton = await browser.$("button[title*='Wizard'], button[title*='Create'], button[title*='New Profile']");
        if (await wizardButton.isExisting()) {
            await wizardButton.click();
            await browser.pause(500);
            wizardModal = await browser.$("#profile-wizard-modal");
        }
    }

    if (!wizardModal || !(await wizardModal.isExisting())) {
        const profileList = await browser.$("[data-testid='profile-list']");
        if (await profileList.isExisting()) {
            await profileList.click({ button: "right" });
            await browser.pause(200);

            const contextMenu = await browser.$(".context-menu, .dropdown-menu");
            if (await contextMenu.isExisting()) {
                const createOption = await browser.$(
                    ".context-menu-item[title*='Create'], .context-menu-item[title*='New'], .context-menu-item[title*='Wizard']"
                );
                if (await createOption.isExisting()) {
                    await createOption.click();
                    await browser.pause(500);
                    wizardModal = await browser.$("#profile-wizard-modal");
                }
            }
        }
    }

    if (!wizardModal || !(await wizardModal.isExisting())) {
        const allButtons = await browser.$$("button");
        const buttonTitles = [];
        for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
            try {
                const title = await allButtons[i].getAttribute("title");
                if (title) buttonTitles.push(title);
            } catch (e) {}
        }

        throw new Error(`Could not find Profile Wizard modal. Available button titles: ${buttonTitles.join(", ")}`);
    }

    await wizardModal.waitForExist({ timeout: 2000 });
    await browser.pause(100);
});

When("the user types {string} as the profile name", async function (profileName: string) {
    await ensureConfigEditorReady();

    const profileNameInput = await browser.$("#profile-name-input");
    await profileNameInput.waitForExist({ timeout: 1000 });
    await profileNameInput.clearValue();
    await profileNameInput.setValue(profileName);
    await browser.pause(100);
});

When("the user selects {string} as the profile type", async function (profileType: string) {
    await ensureConfigEditorReady();

    const profileTypeSelect = await browser.$("#profile-type-select");
    await profileTypeSelect.waitForExist({ timeout: 1000 });
    await profileTypeSelect.selectByVisibleText(profileType);
    await browser.pause(100);
});

When("the user clicks the populate defaults button", async function () {
    await ensureConfigEditorReady();

    const button = await browser.$("#populate-defaults-button");
    await button.waitForExist({ timeout: 1000 });
    await button.click();
    await browser.pause(200);
});

When("the user presses Enter to submit the profile", async function () {
    await ensureConfigEditorReady();

    await browser.keys("Enter");
    await browser.pause(1000);

    // Verify the wizard modal is closed
    const wizardModal = await browser.$("#profile-wizard-modal");
    const isModalOpen = await wizardModal.isDisplayed();
    if (isModalOpen) {
        throw new Error("Profile Wizard modal is still open - profile creation may have failed");
    }

    await browser.pause(500);
});

Then("the profile {string} should exist in the configuration", async function (profileName: string) {
    const configPath = path.join(process.cwd(), "..", "ci", "zowe.config.json");
    const configContent = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configContent);
    expect(config.profiles?.[profileName]).toBeDefined();
});

Then("the profile {string} should have TSO properties", async function (profileName: string) {
    const configPath = path.join(process.cwd(), "..", "ci", "zowe.config.json");
    const configContent = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configContent);

    const profile = config.profiles?.[profileName];
    expect(profile).toBeDefined();
    expect(profile.type).toBe("tso");

    const expectedProperties = ["account", "logonProcedure", "characterSet", "codePage"];
    const hasExpectedProperties = expectedProperties.some((prop) => profile.properties?.[prop] !== undefined);

    expect(hasExpectedProperties).toBe(true);
});

Then("the profile {string} should have ZOSMF properties", async function (profileName: string) {
    const configPath = path.join(process.cwd(), "..", "ci", "zowe.config.json");
    const configContent = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configContent);

    const profile = config.profiles?.[profileName];
    expect(profile).toBeDefined();
    expect(profile.type).toBe("zosmf");

    const expectedProperties = ["host", "port", "rejectUnauthorized", "protocol"];
    const hasExpectedProperties = expectedProperties.some((prop) => profile.properties?.[prop] !== undefined);

    expect(hasExpectedProperties).toBe(true);
});
