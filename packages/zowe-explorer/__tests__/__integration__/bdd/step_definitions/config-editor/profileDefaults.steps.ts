import { When, Then } from "@cucumber/cucumber";
import { expect } from "@wdio/globals";
import * as fs from "fs";
import * as path from "path";

let foundOptions: string[] = [];

// Check dropdown contents
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
