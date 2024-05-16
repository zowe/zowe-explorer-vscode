import { Then, When } from "@cucumber/cucumber";

//
// Scenario: User can locate Zowe Explorer settings
//
When("a user navigates to VS Code Settings", async function () {
    const wb = await browser.getWorkbench();
    this.settingsEditor = await wb.openSettings();
});
Then("the user can access the Zowe Explorer settings section", async function () {
    const zeSettings = await this.settingsEditor.findSetting("Secure Credentials Enabled", "Zowe", "Security");
    await expect(zeSettings).toBeDefined();
});
