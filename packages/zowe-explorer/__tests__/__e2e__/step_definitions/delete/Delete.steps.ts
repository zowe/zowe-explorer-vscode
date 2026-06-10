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
import { clickContextMenuItem } from "../../../__common__/shared.wdio";
import {
    filterBase,
    allocateSequentialDs,
    openDsToPopulateCache,
    createMemberInPds,
    waitForMemberInPds,
    deleteDsOrMember,
    refreshDsTree,
} from "../utils/datasetUtils";

const deleteTestPsName = `${filterBase}.ADELPS`;
const deleteTestMemberName = "ADELMEM";

Given("a test sequential dataset has been created for deletion", async function () {
    await deleteDsOrMember(`/${process.env.ZE_TEST_PROFILE_NAME}/${deleteTestPsName}`);
    await browser.pause(1000);

    await allocateSequentialDs(this, deleteTestPsName);
    await openDsToPopulateCache(this, deleteTestPsName);

    this.deleteTestDs = await (await this.profileNode.find()).findChildItem(deleteTestPsName);
    this.deleteTestDsName = deleteTestPsName;
    this.deleteNodePath = `/${process.env.ZE_TEST_PROFILE_NAME}/${deleteTestPsName}`;
    await expect(this.deleteTestDs).toBeDefined();
});

Given("a test PDS member has been created for deletion", async function () {
    this.deleteTestPds = await this.profileNode.revealChildItem(process.env.ZE_TEST_PDS);
    await expect(this.deleteTestPds).toBeDefined();

    await browser.executeWorkbench(async (vscode, pdsPath: string) => {
        try {
            await vscode.workspace.fs.readDirectory(vscode.Uri.from({ scheme: "zowe-ds", path: pdsPath, query: "fetch=true" }));
        } catch {}
    }, `/${process.env.ZE_TEST_PROFILE_NAME}/${process.env.ZE_TEST_PDS}`);

    await deleteDsOrMember(`/${process.env.ZE_TEST_PROFILE_NAME}/${process.env.ZE_TEST_PDS}/${deleteTestMemberName}`);
    await browser.pause(1000);

    this.deleteTestPds = await this.profileNode.revealChildItem(process.env.ZE_TEST_PDS);
    await createMemberInPds(this.deleteTestPds, deleteTestMemberName);
    await waitForMemberInPds(this, process.env.ZE_TEST_PDS, deleteTestMemberName);

    this.deleteTestPds = await this.profileNode.revealChildItem(process.env.ZE_TEST_PDS);
    this.deleteTestMember = await this.deleteTestPds.findChildItem(deleteTestMemberName);
    this.deleteTestMemberName = deleteTestMemberName;
    this.deleteNodePath = `/${process.env.ZE_TEST_PROFILE_NAME}/${process.env.ZE_TEST_PDS}/${deleteTestMemberName}`;
    await expect(this.deleteTestMember).toBeDefined();
});

When("the user right-clicks on the test sequential dataset and selects {string}", async function (contextMenuOption: string) {
    await this.deleteTestDs.elem.moveTo();
    await clickContextMenuItem(this.deleteTestDs, contextMenuOption);
});

When("the user right-clicks on the test PDS member and selects {string}", async function (contextMenuOption: string) {
    await this.deleteTestMember.elem.moveTo();
    await clickContextMenuItem(this.deleteTestMember, contextMenuOption);
});

When("the user confirms the deletion", async function () {
    await deleteDsOrMember(this.deleteNodePath);
    await refreshDsTree();
    await browser.pause(3000);
});

Then("the sequential dataset should no longer appear in the Data Sets list", async function () {
    await browser.waitUntil(async () => !(await (await this.profileNode.find()).findChildItem(this.deleteTestDsName)), {
        timeout: 15000,
        timeoutMsg: `Dataset ${this.deleteTestDsName} was still found in tree after deletion`,
    });
});

Then("the PDS member should no longer appear under the PDS", async function () {
    await browser.waitUntil(async () => !(await this.deleteTestPds.findChildItem(this.deleteTestMemberName)), {
        timeout: 10000,
        timeoutMsg: `Member ${this.deleteTestMemberName} was still found in PDS after deletion`,
    });
});
