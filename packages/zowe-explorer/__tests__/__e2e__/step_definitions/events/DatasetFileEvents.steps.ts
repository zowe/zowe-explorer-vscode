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

import { After, Given, Then, When } from "@cucumber/cucumber";
import { RecordedFileEvent, startRecordingFileEvents, stopRecordingFileEvents, waitForFileEvent } from "../../../__common__/fileEvents.wdio";
import { createMemberInPds, readDsDirectory, refreshDsTree } from "../utils/datasetUtils";
import { assertRecorded } from "../utils/fileEventAssertions";
import { createPdsMemberOutsideZowe, deletePdsMemberOutsideZowe, uniqueMemberName } from "../utils/remoteChangeUtils";

const DS_SCHEME = "zowe-ds";
const testInfo = {
    profileName: process.env.ZE_TEST_PROFILE_NAME,
    pds: process.env.ZE_TEST_PDS,
};

/** Path of the PDS under test within the `zowe-ds` file system. */
const pdsPath = `/${testInfo.profileName}/${testInfo.pds}`;

// Scoped to the tag so unrelated scenarios do not pay for a round trip to the extension host.
After({ tags: "@fileEvents" }, async function () {
    if (this.newMemberName) {
        await deletePdsMemberOutsideZowe(testInfo.pds, this.newMemberName as string);
        this.newMemberName = undefined;
    }
    await stopRecordingFileEvents();
});

Given("Zowe Explorer is recording data set file system events", async () => {
    // Recording starts after the Background listed the PDS, so the provider already has a member
    // list to compare the refreshed listing against.
    await startRecordingFileEvents(DS_SCHEME);
});

When("a PDS member is created outside of Zowe Explorer", async function () {
    this.newMemberName = uniqueMemberName();
    await createPdsMemberOutsideZowe(testInfo.pds, this.newMemberName as string);
});

When("a user refreshes the Data Sets view", async () => {
    await refreshDsTree();
    // Refreshing the tree only re-lists the PDS if the tree view re-queries its children, which it
    // does on its own schedule. Listing the PDS directly is the same request expanding or refreshing
    // its node makes, and guarantees the provider compares listings before the assertions run.
    await readDsDirectory(pdsPath);
});

When("the user creates a new member in the PDS using the Create New Member action", async function () {
    // Re-find the PDS node rather than reusing the one the Background captured, since refreshing the
    // tree in between can leave the earlier element handle stale.
    const pdsNode = await (await this.profileNode.find()).findChildItem(testInfo.pds);
    await expect(pdsNode).toBeDefined();

    this.newMemberName = uniqueMemberName();
    await createMemberInPds(pdsNode, this.newMemberName as string);
});

Then("a Created event is emitted for the new PDS member", async function () {
    // Matched by prefix, since the provider appends a language extension to members of some data set names.
    const memberPath = `${pdsPath}/${this.newMemberName as string}`;
    const isMemberCreated = (event: RecordedFileEvent): boolean => event.type === "created" && event.path.startsWith(memberPath);

    assertRecorded(await waitForFileEvent(isMemberCreated), isMemberCreated, `a Created event for ${memberPath}`);
});

Then("a Changed event is emitted for the parent PDS", async () => {
    const isPdsChanged = (event: RecordedFileEvent): boolean => event.type === "changed" && event.path === pdsPath;

    assertRecorded(await waitForFileEvent(isPdsChanged), isPdsChanged, `a Changed event for ${pdsPath}`);
});
