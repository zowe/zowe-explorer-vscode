import { Then, When } from "@cucumber/cucumber";
import { paneDivForTree, setFilterForProfile } from "../../../../__common__/shared.wdio";
import { ProfileNode } from "../../../../__pageobjects__/ProfileNode";
import { sleep } from "wdio-vscode-service";

When(/a user sets a filter search on the '(.*)' profile in the '(.*)' tree/, async function (profileName: string, tree: string) {
    // Try to find the profile with retries
    this.tree = tree;
    this.treePane = await paneDivForTree(tree);
    this.profileNode = new ProfileNode(browser, this.treePane, profileName);
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        if (await this.profileNode.exists()) {
            break;
        }
        attempts++;
        if (attempts < maxAttempts) {
            await browser.pause(1000); // Wait before retrying
        }
    }
    await expect(await this.profileNode.find()).toBeDefined();

    await setFilterForProfile(this.profileNode, this.tree, "TEST.INT", false);
});

Then("the basic auth input should appear", async function () {
    // todo seems to skip username
    const inputBox = await $('.input[placeholder="Password"]');
    await expect(inputBox).toBeClickable();
});

Then("the certificate wizard should appear", async function () {
    await sleep(1000);
    // todo
});