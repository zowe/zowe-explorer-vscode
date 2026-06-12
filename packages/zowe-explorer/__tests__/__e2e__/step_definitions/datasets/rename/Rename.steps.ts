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

import { After, Given, When, Then } from "@cucumber/cucumber";
import { clickContextMenuItem } from "../../../../__common__/shared.wdio";
import { Key } from "webdriverio";
import {
    filterBase,
    allocateSequentialDs,
    allocatePartitionedDs,
    createMemberInPds,
    waitForMemberInPds,
    deleteDsOrMember,
    openDsInEditor,
} from "../../utils/datasetUtils";

const renameTestPsName = `${filterBase}.ADS`;
const renamedPsName = `${filterBase}.ARNDS`;
const renameTestMemberName = "AMEM";
const renamedMemberName = "ARENMEM";

After(async function () {
    if (this.renameTestDsName) {
        await deleteDsOrMember(`/${process.env.ZE_TEST_PROFILE_NAME}/${renameTestPsName}`, `/${process.env.ZE_TEST_PROFILE_NAME}/${renamedPsName}`);
    }
    if (this.renameTestMemberName) {
        await deleteDsOrMember(
            `/${process.env.ZE_TEST_PROFILE_NAME}/${process.env.ZE_TEST_PDS}/${renameTestMemberName}`,
            `/${process.env.ZE_TEST_PROFILE_NAME}/${process.env.ZE_TEST_PDS}/${renamedMemberName}`
        );
    }
});

Given("a test sequential dataset has been created for renaming", async function () {
    await deleteDsOrMember(`/${process.env.ZE_TEST_PROFILE_NAME}/${renameTestPsName}`, `/${process.env.ZE_TEST_PROFILE_NAME}/${renamedPsName}`);
    await browser.pause(1000);

    await allocateSequentialDs(this, renameTestPsName);
    await openDsInEditor(this, renameTestPsName);

    this.renameTestDs = await (await this.profileNode.find()).findChildItem(renameTestPsName);
    this.renameTestDsName = renameTestPsName;
    await expect(this.renameTestDs).toBeDefined();
});

Given("a test partitioned dataset has been created for renaming", async function () {
    await deleteDsOrMember(`/${process.env.ZE_TEST_PROFILE_NAME}/${renameTestPsName}`, `/${process.env.ZE_TEST_PROFILE_NAME}/${renamedPsName}`);
    await browser.pause(1000);

    await allocatePartitionedDs(this, renameTestPsName);

    this.renameTestDs = await (await this.profileNode.find()).findChildItem(renameTestPsName);
    this.renameTestDsName = renameTestPsName;
    await expect(this.renameTestDs).toBeDefined();
});

Given("a test PDS member has been created for renaming", async function () {
    this.renameTestPds = await this.profileNode.revealChildItem(process.env.ZE_TEST_PDS);
    await expect(this.renameTestPds).toBeDefined();

    await browser.executeWorkbench(async (vscode, pdsPath: string) => {
        try {
            await vscode.workspace.fs.readDirectory(vscode.Uri.from({ scheme: "zowe-ds", path: pdsPath, query: "fetch=true" }));
        } catch {}
    }, `/${process.env.ZE_TEST_PROFILE_NAME}/${process.env.ZE_TEST_PDS}`);

    await deleteDsOrMember(
        `/${process.env.ZE_TEST_PROFILE_NAME}/${process.env.ZE_TEST_PDS}/${renameTestMemberName}`,
        `/${process.env.ZE_TEST_PROFILE_NAME}/${process.env.ZE_TEST_PDS}/${renamedMemberName}`
    );
    await browser.pause(1000);

    this.renameTestPds = await this.profileNode.revealChildItem(process.env.ZE_TEST_PDS);
    await createMemberInPds(this.renameTestPds, renameTestMemberName);
    await waitForMemberInPds(this, process.env.ZE_TEST_PDS, renameTestMemberName);

    this.renameTestPds = await this.profileNode.revealChildItem(process.env.ZE_TEST_PDS);
    this.renameTestMember = await this.renameTestPds.findChildItem(renameTestMemberName);
    this.renameTestMemberName = renameTestMemberName;
    await expect(this.renameTestMember).toBeDefined();
});

When("the user right-clicks on the dataset to rename and selects {string}", async function (contextMenuOption: string) {
    await this.renameTestDs.elem.moveTo();
    await clickContextMenuItem(this.renameTestDs, contextMenuOption);
});

When("enters a new valid name for the sequential dataset", async function () {
    const nameInputBox = await $('.input[aria-describedby="quickInput_message"]');
    await nameInputBox.waitForDisplayed();

    await nameInputBox.click();
    await browser.keys([process.platform === "darwin" ? "Meta" : "Control", "a"]);
    await browser.keys(renamedPsName);
    await browser.keys(Key.Enter);

    this.oldPsName = this.renameTestDsName;
    this.newPsName = renamedPsName;
    await browser.pause(2000);
});

When("enters a new valid name for the partitioned dataset", async function () {
    const nameInputBox = await $('.input[aria-describedby="quickInput_message"]');
    await nameInputBox.waitForDisplayed();

    await nameInputBox.click();
    await browser.keys([process.platform === "darwin" ? "Meta" : "Control", "a"]);
    await browser.keys(renamedPsName);
    await browser.keys(Key.Enter);

    this.oldPsName = this.renameTestDsName;
    this.newPsName = renamedPsName;
    await browser.pause(2000);
});

When("the user right-clicks on the PDS member to rename and selects {string}", async function (contextMenuOption: string) {
    await this.renameTestMember.elem.moveTo();
    await clickContextMenuItem(this.renameTestMember, contextMenuOption);
});

When("enters a new valid name for the member", async function () {
    const inputBox = await $('.input[aria-describedby="quickInput_message"]');
    await inputBox.waitForDisplayed();

    await inputBox.click();
    await browser.keys([process.platform === "darwin" ? "Meta" : "Control", "a"]);
    await browser.keys(renamedMemberName);
    await browser.keys(Key.Enter);

    this.oldMemberName = this.renameTestMemberName;
    this.newMemberName = renamedMemberName;
    await browser.pause(2000);
});

Then("the new dataset name should appear in the Data Sets list", async function () {
    await browser.waitUntil(async () => !!(await (await this.profileNode.find()).findChildItem(this.newPsName)), {
        timeout: 15000,
        timeoutMsg: `Renamed dataset ${this.newPsName} did not appear in tree after renaming`,
    });
});

Then("the old dataset name should no longer exist", async function () {
    await browser.waitUntil(async () => !(await (await this.profileNode.find()).findChildItem(this.oldPsName)), {
        timeout: 15000,
        timeoutMsg: `Old dataset ${this.oldPsName} was still found in tree after renaming`,
    });
});

Then("the new member name should be visible under the PDS node", async function () {
    await browser.waitUntil(async () => !!(await this.renameTestPds.findChildItem(this.newMemberName)), {
        timeout: 10000,
        timeoutMsg: `Renamed member ${this.newMemberName} was not found inside the PDS after renaming`,
    });
});

Then("the old member name should no longer exist under the PDS", async function () {
    await browser.waitUntil(async () => !(await this.renameTestPds.findChildItem(this.oldMemberName)), {
        timeout: 10000,
        timeoutMsg: `Old member ${this.oldMemberName} was still found in PDS after renaming`,
    });
});
