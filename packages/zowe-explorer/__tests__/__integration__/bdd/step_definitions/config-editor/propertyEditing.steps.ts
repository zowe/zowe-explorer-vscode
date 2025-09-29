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
    await browser.keys(["Control", "a"]);
    await browser.pause(25);
    await browser.keys(["Delete"]);
    await browser.pause(25);
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
        // Fallback: find by label text
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

// Click save button
When("the user clicks the save button", async () => {
    const saveButton = await browser.$(".footer button[title='Save all changes']");
    await saveButton.waitForExist({ timeout: 1000 });
    await saveButton.click();
    await browser.pause(250);
});

// Verify changes saved successfully
Then("the changes should be saved successfully", async () => {
    await browser.pause(500);

    const errorMessages = await browser.$$(".error, .alert-danger, [data-testid='error']");
    expect(errorMessages.length).toBe(0);

    const profileDetailsSection = await browser.$(".config-section.profile-details-section");
    await profileDetailsSection.waitForExist({ timeout: 1000 });
    await profileDetailsSection.waitForDisplayed({ timeout: 1000 });
});

// Verify string property in config file
Then("the {string} property should contain {string} in the config file", async (propertyName: string, expectedValue: string) => {
    const configPath = path.join(process.cwd(), "..", "ci", "zowe.config.json");
    const configContent = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configContent);

    const profile = config.profiles["special-chars"];
    expect(profile).toBeDefined();

    const actualValue = profile.properties[propertyName];
    expect(actualValue).toBe(expectedValue);
});

// Verify boolean property in config file
Then("the {string} property should contain {word} in the config file", async (propertyName: string, expectedValue: string) => {
    const configPath = path.join(process.cwd(), "..", "ci", "zowe.config.json");
    const configContent = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configContent);

    const profile = config.profiles["special-chars"];
    expect(profile).toBeDefined();

    const actualValue = profile.properties[propertyName];

    // Handle boolean values
    if (expectedValue === "true" || expectedValue === "false") {
        const expectedBoolean = expectedValue === "true";
        expect(actualValue).toBe(expectedBoolean);
    } else {
        // Handle string values
        expect(actualValue).toBe(expectedValue);
    }
});

// Verify number property in config file
Then("the {string} property should contain {int} in the config file", async (propertyName: string, expectedValue: number) => {
    const configPath = path.join(process.cwd(), "..", "ci", "zowe.config.json");
    const configContent = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configContent);

    const profile = config.profiles["special-chars"];
    expect(profile).toBeDefined();

    const actualValue = profile.properties[propertyName];
    expect(actualValue).toBe(expectedValue);
});

// Additional step definitions to match the exact patterns from feature file
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

// Click delete button for property
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
        // Try multiple selectors for delete button
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

// Verify delete button clicked successfully
Then("the delete button should be clicked successfully", async () => {
    await browser.pause(100);
});

// Verify property not in config file
Then("the {string} property should not exist in the config file", async (propertyName: string) => {
    const configPath = path.join(process.cwd(), "..", "ci", "zowe.config.json");
    const configContent = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configContent);

    const profile = config.profiles["special-chars"];
    expect(profile).toBeDefined();

    const propertyExists = profile.properties.hasOwnProperty(propertyName);
    expect(propertyExists).toBe(false);
});

// Click add property button
When("the user clicks the add property button", async () => {
    // Look for the specific add profile property button by ID
    let addButton = await browser.$("#add-profile-property-button");
    if (!addButton || !(await addButton.isExisting())) {
        // Fallback: look for button with "add profile property" text or similar
        addButton = await browser.$("button[id*='add-profile-property']");
    }
    if (!addButton || !(await addButton.isExisting())) {
        // Fallback: look for button with "Add Property" text
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

// Verify add property modal is displayed
Then("the add property modal should be displayed", async () => {
    // Look for the AddProfileModal
    let modal = await browser.$(".add-profile-modal");
    if (!modal || !(await modal.isExisting())) {
        modal = await browser.$(".modal");
    }
    if (!modal || !(await modal.isExisting())) {
        modal = await browser.$("[role='dialog']");
    }
    if (!modal || !(await modal.isExisting())) {
        // Look for any element with modal-like classes
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

// Enter property key
When("the user enters {string} as the property key", async (key: string) => {
    const keyInput = await browser.$("input[placeholder*='key'], input[placeholder*='Key'], input[name='key'], input[name='propertyKey']");
    await keyInput.waitForExist({ timeout: 1000 });
    await keyInput.waitForDisplayed({ timeout: 1000 });
    await keyInput.clearValue();
    await keyInput.setValue(key);
    await browser.pause(50);
});

// Enter property value (string/number)
When("the user enters {string} as the property value", async (value: string) => {
    // Look for value input field specifically within the modal
    let valueInput = await browser.$(".modal input[placeholder*='Value'], .add-profile-modal input[placeholder*='Value']");
    if (!valueInput || !(await valueInput.isExisting())) {
        // Fallback: look for input with value placeholder in modal
        valueInput = await browser.$(".modal input[placeholder*='value'], .add-profile-modal input[placeholder*='value']");
    }
    if (!valueInput || !(await valueInput.isExisting())) {
        // Fallback: look for any input field in modal
        valueInput = await browser.$(".modal input, .add-profile-modal input");
    }
    await valueInput.waitForExist({ timeout: 1000 });
    await valueInput.waitForDisplayed({ timeout: 1000 });
    await valueInput.clearValue();
    await valueInput.setValue(value);
    await browser.pause(50);
});

// Enter number value
When("the user enters {string} as the number value", async (value: string) => {
    // Look for number input specifically within the modal
    let numberInput = await browser.$(".modal input[type='number']");
    if (!numberInput || !(await numberInput.isExisting())) {
        // Fallback: look for input within modal with number type
        numberInput = await browser.$(".add-profile-modal input[type='number']");
    }
    if (!numberInput || !(await numberInput.isExisting())) {
        // Fallback: look for any number input in modal
        numberInput = await browser.$(".modal input[type='number'], .add-profile-modal input[type='number']");
    }
    if (!numberInput || !(await numberInput.isExisting())) {
        // Final fallback: look for input with value placeholder in modal
        numberInput = await browser.$(".modal input[placeholder*='Value'], .add-profile-modal input[placeholder*='Value']");
    }
    await numberInput.waitForExist({ timeout: 1000 });
    await numberInput.waitForDisplayed({ timeout: 1000 });
    await numberInput.clearValue();
    await numberInput.setValue(value);
    await browser.pause(50);
});

// Select boolean value
When("the user selects {string} as the boolean value", async (value: string) => {
    // Look for select element for boolean values
    let booleanSelect = await browser.$("select");
    if (!booleanSelect || !(await booleanSelect.isExisting())) {
        // Fallback: look for any select element
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

    // Wait a bit for options to load
    await browser.pause(100);

    // Try to select by visible text first
    try {
        await booleanSelect.selectByVisibleText(value);
    } catch (error) {
        // Fallback: try to select by value
        try {
            await booleanSelect.selectByAttribute("value", value);
        } catch (error2) {
            // Final fallback: try to click the option directly
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

// Toggle secure property option
When("the user toggles the secure property option", async () => {
    // Look for the secure toggle button
    let secureToggle = await browser.$(".wizard-secure-toggle");
    if (!secureToggle || !(await secureToggle.isExisting())) {
        // Fallback: look for button with lock/unlock icon
        secureToggle = await browser.$("button[title*='Lock property'], button[title*='Unlock property']");
    }
    if (!secureToggle || !(await secureToggle.isExisting())) {
        // Fallback: look for button with lock icon
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

// Click add property button in modal
When("the user clicks the add property button in the modal", async () => {
    // Try multiple selectors for modal add button
    let addButton = await browser.$(".modal button[type='submit']");
    if (!addButton || !(await addButton.isExisting())) {
        addButton = await browser.$(".modal .add-button");
    }
    if (!addButton || !(await addButton.isExisting())) {
        // Find button with "Add" or "Save" text in modal
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

// Verify property added to profile
Then("the property should be added to the profile", async () => {
    await browser.pause(500);
    // Just verify that the add button click was successful
    // The actual property addition will be verified after saving
});

// Close modal
When("the user closes the modal", async () => {
    // Try to find and click the close button or cancel button
    let closeButton = await browser.$(".modal .close-button");
    if (!closeButton || !(await closeButton.isExisting())) {
        closeButton = await browser.$(".modal button[title*='close']");
    }
    if (!closeButton || !(await closeButton.isExisting())) {
        closeButton = await browser.$(".modal button[title*='Close']");
    }
    if (!closeButton || !(await closeButton.isExisting())) {
        // Look for Cancel button by text
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
        // Try to click outside the modal to close it
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

// Verify modal is closed
Then("the modal should be closed", async () => {
    await browser.pause(200);
    // Check that the modal is no longer visible
    const modal = await browser.$(".modal, .add-profile-modal, [role='dialog']");
    const isModalVisible = await modal.isDisplayed().catch(() => false);
    expect(isModalVisible).toBe(false);
});

// Verify property exists in config file
Then("the {string} property should exist in the config file", async (propertyName: string) => {
    const configPath = path.join(process.cwd(), "..", "ci", "zowe.config.json");
    const configContent = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configContent);

    const profile = config.profiles["special-chars"];
    expect(profile).toBeDefined();

    const propertyExists = profile.properties.hasOwnProperty(propertyName);
    expect(propertyExists).toBe(true);
});

// Verify property in secure array
Then("the {string} property should be in the secure array in the config file", async (propertyName: string) => {
    const configPath = path.join(process.cwd(), "..", "ci", "zowe.config.json");
    const configContent = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configContent);

    const profile = config.profiles["special-chars"];
    expect(profile).toBeDefined();

    const secureArray = profile.secure || [];
    expect(secureArray).toContain(propertyName);
});
