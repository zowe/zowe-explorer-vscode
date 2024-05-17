import { Then, When } from "@cucumber/cucumber";

When(/a user selects (.*) from the command palette/, async function (command: string) {
    this.input = await (await browser.getWorkbench()).executeQuickPick(`Zowe Explorer: ${command}`);
    this.openedCommand = command;
});
Then("a quick pick appears to select a profile", async function () {
    await expect(this.input.elem).toBeDisplayedInViewport();
});
When("a user selects a profile", async function () {
    let qpItems = await this.input.getQuickPicks();
    await qpItems.at(0).select();
    await this.input.wait();
    if (this.openedCommand === "Issue TSO Command") {
        qpItems = await this.input.getQuickPicks();
        await qpItems.at(0).select();
    }
});
Then(/a user can enter in (.*) as the command and submit it/, async function (command: string) {
    // TODO: Handle profiles that do not yet have credentials stored
    if (this.openedCommand === "Issue TSO Command") {
        await this.input.setText("IZUACCT");
        await this.input.confirm();
    }
    await this.input.setText(command);
    await this.input.confirm();
});
