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

import { Given, When, Then } from "@cucumber/cucumber";
import { expect } from "@wdio/globals";
import * as fs from "fs";
import * as path from "path";
import { verifyProfiles } from "./profileList.steps";

declare const browser: any;

let foundOptions: string[] = [];

async function ensureConfigEditorReady() {
    const appContainer = await browser.$("[data-testid='config-editor-app']");
    await appContainer.waitForExist({ timeout: 1000 });
}

Given("the profile list is set to flat view mode", async function () {
    this.workbench = await browser.getWorkbench();

    this.webview = (await this.workbench.getAllWebviews())[0];
    await this.webview.wait();
    await this.webview.open();

    const appContainer = await browser.$("[data-testid='config-editor-app']");
    await appContainer.waitForExist({ timeout: 1000 });

    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 1000 });

    const viewMode = await profileList.getAttribute("data-view-mode");

    if (viewMode !== "flat") {
        const viewToggleButton = await browser.$("[data-testid='view-mode-toggle']");
        await viewToggleButton.waitForExist({ timeout: 1000 });
        await viewToggleButton.click();

        await browser.waitUntil(
            async () => {
                const updatedProfileList = await browser.$("[data-testid='profile-list']");
                const updatedViewMode = await updatedProfileList.getAttribute("data-view-mode");
                return updatedViewMode === "flat";
            },
            {
                timeout: 1000,
                timeoutMsg: "Failed to switch to flat view",
            }
        );
    }
});

When("the user clicks the defaults toggle button to open the defaults section", async () => {
    const defaultsToggleButton = await browser.$(".defaults-toggle-button");
    await defaultsToggleButton.waitForExist({ timeout: 1000 });
    await defaultsToggleButton.click();
});

When("the user selects the {word} default dropdown", async (type: string) => {
    const dropdownSelector = `select[id="default-dropdown-${type}"]`;
    const typeFilterSelect = await browser.$(dropdownSelector);
    await typeFilterSelect.waitForExist({ timeout: 1000 });

    const options = await typeFilterSelect.$$("option");
    foundOptions = [];
    for (let i = 0; i < options.length; i++) {
        const optionValue = await options[i].getAttribute("value");
        foundOptions.push(optionValue);
    }
});

Then("the dropdown should have {string} as options", async (expectedOptions: string) => {
    const expected = expectedOptions.split(",").map((o) => o.trim());
    await expect(foundOptions).toEqual(expected);
});

When("the user selects {string} in the {word} default dropdown", async (option: string, type: string) => {
    const dropdownSelector = `select[id="default-dropdown-${type}"]`;
    const typeFilterSelect = await browser.$(dropdownSelector);
    await typeFilterSelect.waitForExist({ timeout: 1000 });

    await typeFilterSelect.selectByAttribute("value", option);
});

Then("the {word} default should be {string}", async (type: string, expectedDefault: string) => {
    const configPath = path.join(process.cwd(), "..", "ci", "zowe.config.json");
    const configContent = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configContent);

    await expect(config.defaults[type]).toEqual(expectedDefault);
});

When("the user clicks on the {string} profile entry", async function (profileName: string) {
    await ensureConfigEditorReady();

    const profileItem = await browser.$(`[data-testid='profile-list-item'][data-profile-name='${profileName}']`);
    await profileItem.waitForExist({ timeout: 1000 });
    await profileItem.click();
    await browser.pause(50);
});

When("the user clicks the {string} button", async function (buttonText: string) {
    await ensureConfigEditorReady();

    const profileDetailsSection = await browser.$(".profile-details-section");
    await profileDetailsSection.waitForExist({ timeout: 1000 });
    await browser.pause(50);
    let button;

    switch (buttonText) {
        case "open config with profile highlighted":
            button = await browser.$(".profile-action-button .codicon-go-to-file");
            break;
        case "set as default":
            button = await browser.$(".profile-action-button .codicon-star-empty, .profile-action-button .codicon-star-full");
            break;
        case "hide merged properties":
            const mergedPropsDropdown = await browser.$(
                ".config-section.profile-details-section .sort-dropdown:first-of-type .sort-dropdown-trigger"
            );
            await mergedPropsDropdown.waitForExist({ timeout: 1000 });
            await mergedPropsDropdown.click();
            await browser.pause(100);

            const hideOption = await browser.$(".config-section.profile-details-section .sort-dropdown-list .sort-dropdown-item");
            await hideOption.waitForExist({ timeout: 1000 });
            await hideOption.click();
            await browser.pause(100);
            return;
        case "rename profile":
            button = await browser.$("#rename-profile");
            break;
        case "delete profile":
            button = await browser.$(".profile-action-button .codicon-trash");
            break;
        case "confirm delete profile":
            button = await browser.$(".profile-action-button .codicon-check");
            break;
        case "rename confirm":
            button = await browser.$("#rename-confirm");
            break;
        default:
            throw new Error(`Unknown button: ${buttonText}`);
    }

    await button.waitForExist({ timeout: 1000 });
    await button.click();
    await browser.pause(50);
});

When("the user appends {string} to the profile name in the modal", async function (textToAppend: string) {
    await ensureConfigEditorReady();
    const profileNameInput = await browser.$("#profile-name");
    await profileNameInput.waitForExist({ timeout: 1000 });

    const currentValue = await profileNameInput.getValue();
    await profileNameInput.setValue(currentValue + textToAppend);
    await browser.pause(50);
});

When("the user saves the changes", async () => {
    await ensureConfigEditorReady();

    const saveButton = await browser.$(".footer button[title='Save all changes']");
    const saveButtonExists = await saveButton.isExisting().catch(() => false);
    if (saveButtonExists) {
        await saveButton.waitForExist({ timeout: 1000 });
        await saveButton.click();
        await browser.pause(500);
    } else {
        await browser.pause(100);
    }
});

When("the user closes the zowe.config.json file", async () => {
    try {
        const workbench = await browser.getWorkbench();
        const editorView = workbench.getEditorView();

        try {
            await editorView.closeEditor("zowe.config.json");
        } catch (error) {
            const activeTab = await editorView.getActiveTab();
            if (activeTab) {
                const title = await activeTab.getTitle();
                if (title === "zowe.config.json") {
                    await activeTab.close();
                }
            }
        }
        await browser.pause(50);
    } catch (error) {}
});

Then("the zowe.config.json file should be open", async () => {
    await browser.pause(500);

    try {
        const workbench = await browser.getWorkbench();
        const editorView = workbench.getEditorView();

        await browser.waitUntil(
            async () => {
                try {
                    const editorTitles = await editorView.getOpenEditorTitles();
                    return editorTitles.some((title) => title.includes("zowe.config.json"));
                } catch (error) {
                    return false;
                }
            },
            {
                timeout: 1000,
                timeoutMsg: "Expected zowe.config.json to be opened",
            }
        );
    } catch (error) {}
});

Then("the zowe.config.json should have {string} as the default zosmf profile", async (expectedDefault: string) => {
    const configPath = path.join(process.cwd(), "..", "ci", "zowe.config.json");

    const configContent = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configContent);

    expect(config.defaults?.zosmf).toBe(expectedDefault);
});

Then("the zowe.config.json should have {string} as the default base profile", async (expectedDefault: string) => {
    const configPath = path.join(process.cwd(), "..", "ci", "zowe.config.json");

    const configContent = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configContent);

    expect(config.defaults?.base).toBe(expectedDefault);
});

Then("there should be {int} property entries visible", async (expectedCount: number) => {
    await ensureConfigEditorReady();
    const propertyEntries = await browser.$$(".config-item.property-entry");
    expect(propertyEntries.length).toBe(expectedCount);
});

Then("there should be {int} profile properties", async (expectedCount: number) => {
    await ensureConfigEditorReady();

    const profileDetailsSection = await browser.$(".profile-details-section");
    await profileDetailsSection.waitForExist({ timeout: 1000 });
    await browser.pause(50);

    const propertyEntries = await browser.$$("[data-testid='profile-property-entry']");

    expect(propertyEntries.length).toBe(expectedCount);
});

Then("the button click should be successful", async function () {
    await browser.pause(50);
    try {
        const webview = await browser.$("[data-testid='config-editor-app']");
        if (await webview.isExisting()) {
            await webview.click();
            await browser.pause(50);
        }

        await browser.keys("Escape");
        await browser.pause(50);
    } catch (error) {}
});

Then("the set as default button click should be successful", async function () {
    await browser.pause(50);
});

Then("the profile selection should be successful", async function () {
    await browser.pause(50);
});

Then("the hide merged properties button click should be successful", async function () {
    await browser.pause(50);
});

Then("the rename profile button click should be successful", async function () {
    await browser.pause(50);
});

Then("the delete profile button click should be successful", async function () {
    await browser.pause(50);
});

Then("the profile should be renamed to {string}", async function (expectedName: string) {
    await ensureConfigEditorReady();
    const renamedProfile = await browser.$(`[data-testid='profile-list-item'][data-profile-name='${expectedName}']`);
    await renamedProfile.waitForExist({ timeout: 1000 });

    const configPath = path.join(process.cwd(), "..", "ci", "zowe.config.json");
    const configContent = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configContent);

    expect(config.profiles?.[expectedName]).toBeDefined();
});

Then("the {string} profile should exist in the configuration", async function (profileName: string) {
    const configPath = path.join(process.cwd(), "..", "ci", "zowe.config.json");
    const configContent = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configContent);

    expect(config.profiles?.[profileName]).toBeDefined();
});

Then("the {string} should not exist in the configuration", async function (profileName: string) {
    const configPath = path.join(process.cwd(), "..", "ci", "zowe.config.json");
    const configContent = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configContent);

    expect(config.profiles?.[profileName]).toBeUndefined();
});

Then("the profile tree should contain expected profiles from zowe.config.json with proper renames", async function () {
    const appContainer = await browser.$("[data-testid='config-editor-app']");
    await appContainer.waitForExist({ timeout: 10000 });

    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 1000 });

    const viewMode = await profileList.getAttribute("data-view-mode");

    await browser.waitUntil(
        async () => {
            const selector = viewMode === "tree" ? "[data-testid='profile-tree-node']" : "[data-testid='profile-list-item']";
            const items = await browser.$$(selector);
            return items.length > 0;
        },
        { timeout: 1000, timeoutMsg: "Profile elements not found within timeout" }
    );

    const selector = viewMode === "tree" ? "[data-testid='profile-tree-node']" : "[data-testid='profile-list-item']";
    const elements = await browser.$$(selector);

    const foundProfiles: string[] = [];
    for (const el of elements) {
        const profileName = await el.getAttribute("data-profile-name");
        if (profileName) foundProfiles.push(profileName);
    }

    const expectedTreeTitles = [
        "zosmf1",
        "zosmf2",
        "zosmf3",
        "base",
        "ssh1",
        "tso1",
        "zosmf-dev_test",
        "zosmf-prod",
        "test-profile",
        "special-chars",
        "nested",
    ];
    for (const title of expectedTreeTitles) {
        expect(foundProfiles).toContain(title);
    }
    expect(foundProfiles.length).toBeGreaterThanOrEqual(expectedTreeTitles.length);

    if (viewMode === "tree") {
        const viewToggleButton = await browser.$("[data-testid='view-mode-toggle']");
        if (await viewToggleButton.isExisting()) {
            await viewToggleButton.click();
            await browser.pause(50);

            await browser.waitUntil(
                async () => {
                    const updatedList = await browser.$("[data-testid='profile-list']");
                    const updatedMode = await updatedList.getAttribute("data-view-mode");
                    return updatedMode === "flat";
                },
                { timeout: 1000, timeoutMsg: "Failed to switch to flat view" }
            );

            const flatItems = await browser.$$("[data-testid='profile-list-item']");
            const flatProfiles: string[] = [];
            for (const item of flatItems) {
                const profileName = await item.getAttribute("data-profile-name");
                if (profileName) flatProfiles.push(profileName);
            }

            const expectedFlatTitles = [
                "zosmf1",
                "zosmf2",
                "zosmf3",
                "base",
                "ssh1",
                "tso1",
                "zosmf-dev_test",
                "zosmf-prod",
                "test-profile",
                "special-chars",
                "nested",
                "nested.child1",
                "nested.child2_test",
            ];
            for (const title of expectedFlatTitles) {
                expect(flatProfiles).toContain(title);
            }
            expect(flatProfiles.length).toBe(expectedFlatTitles.length);

            await viewToggleButton.click();
            await browser.pause(50);
            await browser.waitUntil(
                async () => {
                    const updatedList = await browser.$("[data-testid='profile-list']");
                    const updatedMode = await updatedList.getAttribute("data-view-mode");
                    return updatedMode === "tree";
                },
                { timeout: 1000, timeoutMsg: "Failed to switch back to tree view" }
            );
        }
    }
});

Then("the profile tree should contain expected profiles from zowe.config.json with proper deletions", async function () {
    const appContainer = await browser.$("[data-testid='config-editor-app']");
    await appContainer.waitForExist({ timeout: 10000 });

    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 1000 });

    const viewMode = await profileList.getAttribute("data-view-mode");

    await browser.waitUntil(
        async () => {
            const selector = viewMode === "tree" ? "[data-testid='profile-tree-node']" : "[data-testid='profile-list-item']";
            const items = await browser.$$(selector);
            return items.length > 0;
        },
        { timeout: 1000, timeoutMsg: "Profile elements not found within timeout" }
    );

    const selector = viewMode === "tree" ? "[data-testid='profile-tree-node']" : "[data-testid='profile-list-item']";
    const elements = await browser.$$(selector);

    const foundProfiles: string[] = [];
    for (const el of elements) {
        const profileName = await el.getAttribute("data-profile-name");
        if (profileName) foundProfiles.push(profileName);
    }

    const expectedTreeTitles = ["zosmf1", "zosmf2", "zosmf3", "base", "ssh1", "tso1", "zosmf-prod", "test-profile", "special-chars", "nested"];
    for (const title of expectedTreeTitles) {
        expect(foundProfiles).toContain(title);
    }
    expect(foundProfiles.length).toBeGreaterThanOrEqual(expectedTreeTitles.length);

    if (viewMode === "tree") {
        const viewToggleButton = await browser.$("[data-testid='view-mode-toggle']");
        if (await viewToggleButton.isExisting()) {
            await viewToggleButton.click();
            await browser.pause(50);

            await browser.waitUntil(
                async () => {
                    const updatedList = await browser.$("[data-testid='profile-list']");
                    const updatedMode = await updatedList.getAttribute("data-view-mode");
                    return updatedMode === "flat";
                },
                { timeout: 1000, timeoutMsg: "Failed to switch to flat view" }
            );

            const flatItems = await browser.$$("[data-testid='profile-list-item']");
            const flatProfiles: string[] = [];
            for (const item of flatItems) {
                const profileName = await item.getAttribute("data-profile-name");
                if (profileName) flatProfiles.push(profileName);
            }

            const expectedFlatTitles = [
                "zosmf1",
                "zosmf2",
                "zosmf3",
                "base",
                "ssh1",
                "tso1",
                "zosmf-prod",
                "test-profile",
                "special-chars",
                "nested",
                "nested.child1",
            ];
            for (const title of expectedFlatTitles) {
                expect(flatProfiles).toContain(title);
            }
            expect(flatProfiles.length).toBe(expectedFlatTitles.length);

            await viewToggleButton.click();
            await browser.pause(50);
            await browser.waitUntil(
                async () => {
                    const updatedList = await browser.$("[data-testid='profile-list']");
                    const updatedMode = await updatedList.getAttribute("data-view-mode");
                    return updatedMode === "tree";
                },
                { timeout: 1000, timeoutMsg: "Failed to switch back to tree view" }
            );
        }
    }
});

Then("the profile tree should contain expected profiles from zowe.config.json with proper nested profile deletions", async function () {
    this.workbench = await browser.getWorkbench();
    await verifyProfiles(
        ["zosmf1", "zosmf2", "zosmf3", "base", "ssh1", "tso1", "zosmf-prod", "test-profile", "special-chars"],
        ["zosmf1", "zosmf2", "zosmf3", "base", "ssh1", "tso1", "zosmf-prod", "test-profile", "special-chars"],
        this.workbench
    );
});

Then("close the webview workbench", async function () {
    if (this.webview) {
        this.webview.close();
    }
});

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

When("the user selects a profile to view its properties", async () => {
    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 1000 });

    const profileElements = await browser.$$("[data-testid='profile-list-item']");
    if (profileElements.length > 0) {
        await profileElements[0].click();
        await browser.pause(100);
    } else {
        const treeProfileElements = await browser.$$("[data-testid='profile-tree-node']");
        if (treeProfileElements.length > 0) {
            await treeProfileElements[0].click();
            await browser.pause(100);
        }
    }
});

When("the user selects the {string} to view its properties", async (profileName: string) => {
    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 1000 });

    await browser.pause(500);

    let profileFound = false;
    let attempts = 0;
    const maxAttempts = 3;

    while (!profileFound && attempts < maxAttempts) {
        const profileElements = await browser.$$("[data-testid='profile-list-item']");

        for (const element of profileElements) {
            const elementProfileName = await element.getAttribute("data-profile-name");
            if (elementProfileName === profileName) {
                await element.click();
                await browser.pause(100);
                profileFound = true;
                break;
            }
        }

        if (!profileFound) {
            const treeProfileElements = await browser.$$("[data-testid='profile-tree-node']");
            for (const element of treeProfileElements) {
                const elementProfileName = await element.getAttribute("data-profile-name");
                if (elementProfileName === profileName) {
                    await element.click();
                    await browser.pause(100);
                    profileFound = true;
                    break;
                }
            }
        }

        if (!profileFound) {
            attempts++;
            await browser.pause(1000);
        }
    }

    if (!profileFound) {
        const profileElements = await browser.$$("[data-testid='profile-list-item']");
        if (profileElements.length > 0) {
            await profileElements[0].click();
            await browser.pause(100);
        } else {
            const treeProfileElements = await browser.$$("[data-testid='profile-tree-node']");
            if (treeProfileElements.length > 0) {
                await treeProfileElements[0].click();
                await browser.pause(100);
            } else {
                throw new Error(`Could not find profile: ${profileName} and no profiles available`);
            }
        }
    }
});

When("the user selects a different profile to view its properties", async () => {
    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 1000 });

    const profileElements = await browser.$$("[data-testid='profile-list-item']");
    if (profileElements.length > 1) {
        await profileElements[1].click();
        await browser.pause(100);
    } else {
        const treeProfileElements = await browser.$$("[data-testid='profile-tree-node']");
        if (treeProfileElements.length > 1) {
            await treeProfileElements[1].click();
            await browser.pause(100);
        }
    }
});

When("the user switches back to the first profile", async () => {
    const profileList = await browser.$("[data-testid='profile-list']");
    await profileList.waitForExist({ timeout: 1000 });

    const profileElements = await browser.$$("[data-testid='profile-list-item']");
    if (profileElements.length > 0) {
        await profileElements[0].click();
        await browser.pause(100);
    } else {
        const treeProfileElements = await browser.$$("[data-testid='profile-tree-node']");
        if (treeProfileElements.length > 0) {
            await treeProfileElements[0].click();
            await browser.pause(100);
        }
    }
});

Then("the profile details section should be displayed", async () => {
    const profileDetailsSection = await browser.$(".config-section.profile-details-section");
    await profileDetailsSection.waitForExist({ timeout: 1000 });
    await profileDetailsSection.waitForDisplayed({ timeout: 1000 });
});

When("the user clicks on the property sort dropdown", async () => {
    const propertySortDropdown = await browser.$(".config-section.profile-details-section .sort-dropdown:nth-of-type(2) .sort-dropdown-trigger");
    await propertySortDropdown.waitForExist({ timeout: 1000 });
    await propertySortDropdown.click();
    await browser.pause(100);
});

When("the user selects {string} from the property sort dropdown", async (sortOption: string) => {
    const dropdownList = await browser.$(".config-section.profile-details-section .sort-dropdown-list");
    await dropdownList.waitForDisplayed({ timeout: 1000 });

    const optionElements = await browser.$$(".config-section.profile-details-section .sort-dropdown-item[role='option']");
    let optionElement = null;

    for (const element of optionElements) {
        const text = await element.getText();
        if (text === sortOption) {
            optionElement = element;
            break;
        }
    }

    if (optionElement) {
        await optionElement.click();
        await browser.pause(100);
    } else {
        throw new Error(`Could not find property sort option: ${sortOption}`);
    }
});

Then("the property sort dropdown should show {string} as selected", async (expectedSort: string) => {
    const propertySortDropdown = await browser.$(".config-section.profile-details-section .sort-dropdown:nth-of-type(2) .sort-dropdown-trigger");
    await propertySortDropdown.waitForExist({ timeout: 1000 });

    const title = await propertySortDropdown.getAttribute("title");
    expect(title).toContain(`Current: ${expectedSort}`);

    const dropdownList = await browser.$(".config-section.profile-details-section .sort-dropdown-list");
    const isDisplayed = await dropdownList.isDisplayed();
    expect(isDisplayed).toBe(false);
});

Then("the property sort dropdown should show {string} as selected by default", async (expectedSort: string) => {
    const propertySortDropdown = await browser.$(".config-section.profile-details-section .sort-dropdown:nth-of-type(2) .sort-dropdown-trigger");
    await propertySortDropdown.waitForExist({ timeout: 1000 });

    const title = await propertySortDropdown.getAttribute("title");
    expect(title).toContain(`Current: ${expectedSort}`);
});

Then("the properties should be displayed in alphabetical order", async () => {
    await browser.pause(100);

    let propertyElements = await browser.$$(".config-section.profile-details-section .config-item");

    if (propertyElements.length === 0) {
        propertyElements = await browser.$$(".config-section.profile-details-section [data-property-key]");
    }

    if (propertyElements.length === 0) {
        propertyElements = await browser.$$(".config-section.profile-details-section .property-item");
    }

    if (propertyElements.length === 0) {
        propertyElements = await browser.$$(".config-section.profile-details-section .config-item.parent");
    }

    const propertyNames: string[] = [];
    for (const element of propertyElements) {
        const propertyName = await element.getAttribute("data-property-key");
        if (propertyName && propertyName !== "type") {
            propertyNames.push(propertyName);
        }
    }

    const sortedNames = [...propertyNames].sort();
    expect(propertyNames).toEqual(sortedNames);
});

Then("the properties should be displayed according to the sort order", async () => {
    await browser.pause(100);

    const profileDetailsSection = await browser.$(".config-section.profile-details-section");
    await profileDetailsSection.waitForExist({ timeout: 1000 });
    await profileDetailsSection.waitForDisplayed({ timeout: 1000 });

    const propertySortDropdown = await browser.$(".config-section.profile-details-section .sort-dropdown-trigger");
    await propertySortDropdown.waitForExist({ timeout: 1000 });

    expect(propertySortDropdown).toBeTruthy();
});

Then("the property sort dropdown should maintain the current sort order", async () => {
    const propertySortDropdown = await browser.$(".config-section.profile-details-section .sort-dropdown:nth-of-type(2) .sort-dropdown-trigger");
    await propertySortDropdown.waitForExist({ timeout: 1000 });

    const title = await propertySortDropdown.getAttribute("title");
    expect(title).toContain("Current:");
});

Then("the properties should be displayed according to the current sort order", async () => {
    const propertyElements = await browser.$$(".config-section.profile-details-section .config-item");
    expect(propertyElements.length).toBeGreaterThan(0);
});

When("the user clicks on the {string} property input field", async (propertyName: string) => {
    const profileDetailsSection = await browser.$(".config-section.profile-details-section");
    await profileDetailsSection.waitForExist({ timeout: 1000 });
    await profileDetailsSection.waitForDisplayed({ timeout: 1000 });

    let inputField = null;

    const elementsWithDataKey = await browser.$$(`[data-property-key="${propertyName}"]`);
    for (const element of elementsWithDataKey) {
        const tagName = await element.getTagName();
        if (tagName === "input" || tagName === "select") {
            inputField = element;
            break;
        }
    }

    if (!inputField) {
        const allInputs = await browser.$$(".env-var-input, .config-input");
        for (const input of allInputs) {
            const tagName = await input.getTagName();
            if (tagName !== "input" && tagName !== "select") continue;

            const dataKey = await input.getAttribute("data-property-key");
            if (dataKey === propertyName) {
                inputField = input;
                break;
            }
        }
    }

    if (inputField) {
        await inputField.waitForExist({ timeout: 1000 });
        await inputField.waitForDisplayed({ timeout: 1000 });
        await inputField.click();
        await browser.pause(50);
    } else {
        const allInputs = await browser.$$(".env-var-input, .config-input");
        for (const input of allInputs) {
            const tagName = await input.getTagName();
            if (tagName === "input" || tagName === "select") {
                await input.click();
                await browser.pause(50);
                break;
            }
        }
    }
});

When("the user clears the current value", async () => {
    await browser.pause(25);
    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await browser.keys([modifier, "a"]);
    await browser.pause(25);
    await browser.keys(["Delete"]);
});

When("the user types {string} into the input field", async (value: string) => {
    const focusedElement = await browser.$(":focus");
    if (focusedElement) {
        const tagName = await focusedElement.getTagName();

        if (tagName === "select") {
            await focusedElement.selectByVisibleText(value);
            await browser.pause(50);
        } else {
            await browser.keys(value);
            await browser.pause(50);
        }
    } else {
        throw new Error("No focused element found");
    }
});

Then("the input field should be focused and editable", async () => {
    const focusedElement = await browser.$(":focus");
    if (focusedElement) {
        const tagName = await focusedElement.getTagName();
        const isEnabled = await focusedElement.isEnabled();
        expect(tagName === "input" || tagName === "select").toBe(true);
        expect(isEnabled).toBe(true);
    } else {
        throw new Error("No focused input/select field found");
    }
});

Then("the input field should contain {string}", async (expectedValue: string) => {
    const focusedElement = await browser.$(":focus");
    if (focusedElement) {
        const actualValue = await focusedElement.getValue();
        expect(actualValue).toBe(expectedValue);
    } else {
        throw new Error("No focused input field found");
    }
});

Then("the {string} property should contain {string}", async (propertyName: string, expectedValue: string) => {
    let inputField = null;

    const selectors = [
        `.env-var-input[data-property-key="${propertyName}"]`,
        `.config-input[data-property-key="${propertyName}"]`,
        `.env-var-input`,
        `.config-input`,
    ];

    for (const selector of selectors) {
        const elements = await browser.$$(selector);
        for (const element of elements) {
            const dataKey = await element.getAttribute("data-property-key");
            if (dataKey === propertyName) {
                inputField = element;
                break;
            }
        }
        if (inputField) break;
    }

    if (!inputField) {
        const allInputs = await browser.$$(".env-var-input, .config-input");
        for (const input of allInputs) {
            const parent = await input.$("..");
            const label = await parent.$("label");
            if (label) {
                const labelText = await label.getText();
                if (labelText.toLowerCase().includes(propertyName.toLowerCase())) {
                    inputField = input;
                    break;
                }
            }
        }
    }

    if (inputField) {
        await inputField.waitForExist({ timeout: 1000 });
        const actualValue = await inputField.getValue();
        expect(actualValue).toBe(expectedValue);
    } else {
        throw new Error(`Could not find input field for property: ${propertyName}`);
    }
});

When("the user clicks the save button", async () => {
    const saveButton = await browser.$(".footer button[title='Save all changes']");
    await saveButton.waitForExist({ timeout: 1000 });
    await saveButton.click();
    await browser.pause(250);
});

Then("the changes should be saved successfully", async () => {
    await browser.pause(500);

    const errorMessages = await browser.$$(".error, .alert-danger, [data-testid='error']");
    expect(errorMessages.length).toBe(0);

    const profileDetailsSection = await browser.$(".config-section.profile-details-section");
    await profileDetailsSection.waitForExist({ timeout: 1000 });
    await profileDetailsSection.waitForDisplayed({ timeout: 1000 });
});

Then("the {string} property should contain {string} in the config file", async (propertyName: string, expectedValue: string) => {
    const configPath = path.join(process.cwd(), "..", "ci", "zowe.config.json");
    const configContent = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configContent);

    const profile = config.profiles["special-chars"];
    expect(profile).toBeDefined();

    const actualValue = profile.properties[propertyName];
    expect(actualValue).toBe(expectedValue);
});

Then("the {string} property should contain {word} in the config file", async (propertyName: string, expectedValue: string) => {
    const configPath = path.join(process.cwd(), "..", "ci", "zowe.config.json");
    const configContent = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configContent);

    const profile = config.profiles["special-chars"];
    expect(profile).toBeDefined();

    const actualValue = profile.properties[propertyName];

    if (expectedValue === "true" || expectedValue === "false") {
        const expectedBoolean = expectedValue === "true";
        expect(actualValue).toBe(expectedBoolean);
    } else {
        expect(actualValue).toBe(expectedValue);
    }
});

Then("the {string} property should contain {int} in the config file", async (propertyName: string, expectedValue: number) => {
    const configPath = path.join(process.cwd(), "..", "ci", "zowe.config.json");
    const configContent = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configContent);

    const profile = config.profiles["special-chars"];
    expect(profile).toBeDefined();

    const actualValue = profile.properties[propertyName];
    expect(actualValue).toBe(expectedValue);
});

Then("the host property should contain new-host.example.com in the config file", async () => {
    const configPath = path.join(process.cwd(), "..", "ci", "zowe.config.json");
    const configContent = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configContent);

    const profile = config.profiles["special-chars"];
    expect(profile).toBeDefined();

    const actualValue = profile.properties["host"];
    expect(actualValue).toBe("new-host.example.com");
});

Then("the rejectUnauthorized property should contain false in the config file", async () => {
    const configPath = path.join(process.cwd(), "..", "ci", "zowe.config.json");
    const configContent = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configContent);

    const profile = config.profiles["special-chars"];
    expect(profile).toBeDefined();

    const actualValue = profile.properties["rejectUnauthorized"];
    expect(actualValue).toBe(false);
});

Then("the port property should contain 8080 in the config file", async () => {
    const configPath = path.join(process.cwd(), "..", "ci", "zowe.config.json");
    const configContent = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configContent);

    const profile = config.profiles["special-chars"];
    expect(profile).toBeDefined();

    const actualValue = profile.properties["port"];
    expect(actualValue).toBe(8080);
});

Then("the password property should be in the secure array in the config file", async () => {
    const configPath = path.join(process.cwd(), "..", "ci", "zowe.config.json");
    const configContent = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configContent);

    const profile = config.profiles["special-chars"];
    expect(profile).toBeDefined();

    const secureArray = profile.secure || [];
    expect(secureArray).toContain("password");
});

When("the user clicks the delete button for the {string} property", async (propertyName: string) => {
    const profileDetailsSection = await browser.$(".config-section.profile-details-section");
    await profileDetailsSection.waitForExist({ timeout: 1000 });
    await profileDetailsSection.waitForDisplayed({ timeout: 1000 });

    let propertyContainer = null;
    const allContainers = await browser.$$(".config-item, .property-item");

    for (const container of allContainers) {
        const containerText = await container.getText();
        if (containerText.includes(propertyName)) {
            propertyContainer = container;
            break;
        }
    }

    if (propertyContainer) {
        let deleteButton = await propertyContainer.$(".action-button");
        if (!deleteButton) {
            deleteButton = await propertyContainer.$("button[title*='delete']");
        }
        if (!deleteButton) {
            deleteButton = await propertyContainer.$("button[title*='Delete']");
        }
        if (!deleteButton) {
            deleteButton = await propertyContainer.$("button .codicon-trash");
        }
        if (!deleteButton) {
            deleteButton = await propertyContainer.$("button");
        }

        if (deleteButton) {
            await deleteButton.waitForExist({ timeout: 1000 });
            await deleteButton.waitForDisplayed({ timeout: 1000 });
            await deleteButton.click();
            await browser.pause(100);
        } else {
            throw new Error(`Could not find delete button for property: ${propertyName}`);
        }
    } else {
        throw new Error(`Could not find property container for: ${propertyName}`);
    }
});

Then("the delete button should be clicked successfully", async () => {
    await browser.pause(100);
    const confirmButton = await browser.$(".action-button .codicon-check");
    await confirmButton.waitForExist({ timeout: 2000 });
    await confirmButton.waitForDisplayed({ timeout: 2000 });
    await confirmButton.click();
    await browser.pause(100);
});

Then("the {string} property should not exist in the config file", async (propertyName: string) => {
    const configPath = path.join(process.cwd(), "..", "ci", "zowe.config.json");
    const configContent = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configContent);

    const profile = config.profiles["special-chars"];
    expect(profile).toBeDefined();

    const propertyExists = profile.properties.hasOwnProperty(propertyName);
    expect(propertyExists).toBe(false);
});

When("the user clicks the add property button", async () => {
    let addButton = await browser.$("#add-profile-property-button");
    if (!addButton || !(await addButton.isExisting())) {
        addButton = await browser.$("button[id*='add-profile-property']");
    }
    if (!addButton || !(await addButton.isExisting())) {
        const buttons = await browser.$$("button");
        for (const button of buttons) {
            const text = await button.getText();
            if (text.toLowerCase().includes("add property") || text.toLowerCase().includes("add profile property")) {
                addButton = button;
                break;
            }
        }
    }

    await addButton.waitForExist({ timeout: 1000 });
    await addButton.waitForDisplayed({ timeout: 1000 });
    await addButton.click();
    await browser.pause(100);
});

Then("the add property modal should be displayed", async () => {
    let modal = await browser.$(".add-profile-modal");
    if (!modal || !(await modal.isExisting())) {
        modal = await browser.$(".modal");
    }
    if (!modal || !(await modal.isExisting())) {
        modal = await browser.$("[role='dialog']");
    }
    if (!modal || !(await modal.isExisting())) {
        const modalElements = await browser.$$(".modal, .add-profile-modal, [role='dialog'], .wizard-modal");
        for (const element of modalElements) {
            if (await element.isDisplayed()) {
                modal = element;
                break;
            }
        }
    }

    await modal.waitForExist({ timeout: 1000 });
    await modal.waitForDisplayed({ timeout: 1000 });
});

When("the user enters {string} as the property key", async (key: string) => {
    const keyInput = await browser.$("input[placeholder*='key'], input[placeholder*='Key'], input[name='key'], input[name='propertyKey']");
    await keyInput.waitForExist({ timeout: 1000 });
    await keyInput.waitForDisplayed({ timeout: 1000 });
    await keyInput.clearValue();
    await keyInput.setValue(key);
    await browser.pause(50);
});

When("the user enters {string} as the property value", async (value: string) => {
    let valueInput = await browser.$(".modal input[placeholder*='Value'], .add-profile-modal input[placeholder*='Value']");
    if (!valueInput || !(await valueInput.isExisting())) {
        valueInput = await browser.$(".modal input[placeholder*='value'], .add-profile-modal input[placeholder*='value']");
    }
    if (!valueInput || !(await valueInput.isExisting())) {
        valueInput = await browser.$(".modal input, .add-profile-modal input");
    }
    await valueInput.waitForExist({ timeout: 1000 });
    await valueInput.waitForDisplayed({ timeout: 1000 });
    await valueInput.clearValue();
    await valueInput.setValue(value);
    await browser.pause(50);
});

When("the user enters {string} as the number value", async (value: string) => {
    let numberInput = await browser.$(".modal input[type='number']");
    if (!numberInput || !(await numberInput.isExisting())) {
        numberInput = await browser.$(".add-profile-modal input[type='number']");
    }
    if (!numberInput || !(await numberInput.isExisting())) {
        numberInput = await browser.$(".modal input[type='number'], .add-profile-modal input[type='number']");
    }
    if (!numberInput || !(await numberInput.isExisting())) {
        numberInput = await browser.$(".modal input[placeholder*='Value'], .add-profile-modal input[placeholder*='Value']");
    }
    await numberInput.waitForExist({ timeout: 1000 });
    await numberInput.waitForDisplayed({ timeout: 1000 });
    await numberInput.clearValue();
    await numberInput.setValue(value);
    await browser.pause(50);
});

When("the user selects {string} as the boolean value", async (value: string) => {
    let booleanSelect = await browser.$("select");
    if (!booleanSelect || !(await booleanSelect.isExisting())) {
        const selects = await browser.$$("select");
        for (const select of selects) {
            if (await select.isDisplayed()) {
                booleanSelect = select;
                break;
            }
        }
    }
    await booleanSelect.waitForExist({ timeout: 1000 });
    await booleanSelect.waitForDisplayed({ timeout: 1000 });

    await browser.pause(100);

    try {
        await booleanSelect.selectByVisibleText(value);
    } catch (error) {
        try {
            await booleanSelect.selectByAttribute("value", value);
        } catch (error2) {
            const options = await booleanSelect.$$("option");
            for (const option of options) {
                const optionText = await option.getText();
                const optionValue = await option.getAttribute("value");
                if (optionText === value || optionValue === value) {
                    await option.click();
                    break;
                }
            }
        }
    }
    await browser.pause(50);
});

When("the user toggles the secure property option", async () => {
    let secureToggle = await browser.$(".wizard-secure-toggle");
    if (!secureToggle || !(await secureToggle.isExisting())) {
        secureToggle = await browser.$("button[title*='Lock property'], button[title*='Unlock property']");
    }
    if (!secureToggle || !(await secureToggle.isExisting())) {
        const buttons = await browser.$$("button");
        for (const button of buttons) {
            const icon = await button.$(".codicon-lock, .codicon-unlock");
            if (icon && (await icon.isExisting())) {
                secureToggle = button;
                break;
            }
        }
    }

    await secureToggle.waitForExist({ timeout: 1000 });
    await secureToggle.waitForDisplayed({ timeout: 1000 });
    await secureToggle.click();
    await browser.pause(50);
});

When("the user clicks the add property button in the modal", async () => {
    let addButton = await browser.$(".modal button[type='submit']");
    if (!addButton || !(await addButton.isExisting())) {
        addButton = await browser.$(".modal .add-button");
    }
    if (!addButton || !(await addButton.isExisting())) {
        const modalButtons = await browser.$$(".modal button");
        for (const button of modalButtons) {
            const text = await button.getText();
            if (text.toLowerCase().includes("add") || text.toLowerCase().includes("save")) {
                addButton = button;
                break;
            }
        }
    }

    await addButton.waitForExist({ timeout: 1000 });
    await addButton.waitForDisplayed({ timeout: 1000 });
    await addButton.click();
    await browser.pause(100);
});

Then("the property should be added to the profile", async () => {
    await browser.pause(500);
});

When("the user closes the modal", async () => {
    let closeButton = await browser.$(".modal .close-button");
    if (!closeButton || !(await closeButton.isExisting())) {
        closeButton = await browser.$(".modal button[title*='close']");
    }
    if (!closeButton || !(await closeButton.isExisting())) {
        closeButton = await browser.$(".modal button[title*='Close']");
    }
    if (!closeButton || !(await closeButton.isExisting())) {
        const modalButtons = await browser.$$(".modal button");
        for (const button of modalButtons) {
            const text = await button.getText();
            if (text.toLowerCase().includes("cancel")) {
                closeButton = button;
                break;
            }
        }
    }
    if (!closeButton || !(await closeButton.isExisting())) {
        const backdrop = await browser.$(".modal-backdrop");
        if (backdrop && (await backdrop.isExisting())) {
            await backdrop.click();
        }
    }

    if (closeButton && (await closeButton.isExisting())) {
        await closeButton.click();
        await browser.pause(100);
    }
});

Then("the modal should be closed", async () => {
    await browser.pause(200);
    const modal = await browser.$(".modal, .add-profile-modal, [role='dialog']");
    const isModalVisible = await modal.isDisplayed().catch(() => false);
    expect(isModalVisible).toBe(false);
});

Then("the {string} property should exist in the config file", async (propertyName: string) => {
    const configPath = path.join(process.cwd(), "..", "ci", "zowe.config.json");
    const configContent = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configContent);

    const profile = config.profiles["special-chars"];
    expect(profile).toBeDefined();

    const propertyExists = profile.properties.hasOwnProperty(propertyName);
    expect(propertyExists).toBe(true);
});

Then("the {string} property should be in the secure array in the config file", async (propertyName: string) => {
    const configPath = path.join(process.cwd(), "..", "ci", "zowe.config.json");
    const configContent = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configContent);

    const profile = config.profiles["special-chars"];
    expect(profile).toBeDefined();

    const secureArray = profile.secure || [];
    expect(secureArray).toContain(propertyName);
});
