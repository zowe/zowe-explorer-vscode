import { When, Then } from "@cucumber/cucumber";

When("a user right clicks a configuration tab and clicks open file", async () => {
    const tab = await browser.$(`[id="global:true,user:false"]`);
    await tab.click({ button: "right" });

    const openFile = await browser.$(`[id="tab-open-file"]`);
    await openFile.click({ button: "left" });
});

Then("{string} should be the opened editor", async (expectedFile: string) => {
    // Check tabs
});
