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
import { filterBase, allocateSequentialDs, allocatePartitionedDs, createMemberInPds, deleteDsOrMember } from "../../utils/datasetUtils";

const testPsName = `${filterBase}.ANEWPS`;
const testPdsName = `${filterBase}.ANEWPDS`;
const testMemberName = process.env.ZE_TEST_PDS_MEMBER;

After(async function () {
    if (this.newPsName) {
        await deleteDsOrMember(`/${process.env.ZE_TEST_PROFILE_NAME}/${testPsName}`);
    }
    if (this.newPdsName) {
        await deleteDsOrMember(`/${process.env.ZE_TEST_PROFILE_NAME}/${testPdsName}`);
    }
    await browser.pause(4000);
});

Given("a user enters a new valid sequential dataset name", async function () {
    this.newPsName = testPsName;
    await allocateSequentialDs(this, testPsName);
});

Then("the new sequential dataset should be created successfully", async function () {
    this.newPsNode = await (await this.profileNode.find()).findChildItem(this.newPsName);
    await expect(this.newPsNode).toBeDefined();
});

Then("the new dataset should appear in the Data Sets list", async function () {
    this.newPsNode = await (await this.profileNode.find()).findChildItem(this.newPsName);
    await expect(this.newPsNode).toBeDefined();
});

Given("a user enters a new valid partitioned dataset name", async function () {
    this.newPdsName = testPdsName;
    await allocatePartitionedDs(this, testPdsName);
});

Then("the new partitioned dataset should be created successfully", async function () {
    this.newPdsNode = await (await this.profileNode.find()).findChildItem(this.newPdsName);
    await expect(this.newPdsNode).toBeDefined();
});

When("the user right-clicks on the newly created PDS and selects {string}", async function (_contextMenuOption: string) {
    this.newPdsNode = await (await this.profileNode.find()).findChildItem(testPdsName);
    await expect(this.newPdsNode).toBeDefined();
});

When("enters a valid member name", async function () {
    this.newMemberName = testMemberName;
    await createMemberInPds(this.newPdsNode, testMemberName);
});

Then("the new member should be created successfully", async function () {
    await browser.waitUntil(
        async () => {
            const pdsNode = await (await this.profileNode.find()).findChildItem(testPdsName);
            if (!pdsNode) return false;
            return !!(await pdsNode.findChildItem(this.newMemberName));
        },
        { timeout: 15000, timeoutMsg: `Member ${this.newMemberName} did not appear in PDS after creation` }
    );
});

Then("the new member should be visible under the PDS node", async function () {
    const pdsNode = await (await this.profileNode.find()).findChildItem(testPdsName);
    const memberNode = await pdsNode?.findChildItem(this.newMemberName);
    await expect(memberNode).toBeDefined();
});
