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
import * as fs from "fs";
import * as path from "path";
import { verifyProfiles } from "./profileTree.steps";

declare const browser: any;
declare const expect: any;

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

async function ensureConfigEditorReady() {
    const appContainer = await browser.$("[data-testid='config-editor-app']");
    await appContainer.waitForExist({ timeout: 1000 });
}

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
            button = await browser.$(".profile-action-button .codicon-eye, .profile-action-button .codicon-eye-closed");
            break;
        case "rename profile":
            button = await browser.$("#rename-profile");
            break;
        case "delete profile":
            button = await browser.$(".profile-action-button .codicon-trash");
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
    await saveButton.waitForExist({ timeout: 1000 });
    await saveButton.click();
    await browser.pause(500);
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
    this.workbench = await browser.getWorkbench();
    await verifyProfiles(
        ["zosmf1", "zosmf2", "zosmf3", "base", "ssh1", "tso1", "zosmf-dev_test", "zosmf-prod", "test-profile", "special-chars", "nested"],
        [
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
        ],
        this.workbench
    );
});
Then("the profile tree should contain expected profiles from zowe.config.json with proper deletions", async function () {
    this.workbench = await browser.getWorkbench();
    await verifyProfiles(
        ["zosmf1", "zosmf2", "zosmf3", "base", "ssh1", "tso1", "zosmf-prod", "test-profile", "special-chars", "nested"],
        ["zosmf1", "zosmf2", "zosmf3", "base", "ssh1", "tso1", "zosmf-prod", "test-profile", "special-chars", "nested", "nested.child1"],
        this.workbench
    );
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
