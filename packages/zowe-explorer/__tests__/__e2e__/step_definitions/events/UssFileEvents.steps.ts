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
import { clickContextMenuItem, fillInputBox } from "../../../__common__/shared.wdio";
import { RecordedFileEvent, startRecordingFileEvents, stopRecordingFileEvents, waitForFileEvent } from "../../../__common__/fileEvents.wdio";
import { assertRecorded } from "../utils/fileEventAssertions";
import { createUssFileOutsideZowe, deleteUssFileOutsideZowe, uniqueUssFileName } from "../utils/remoteChangeUtils";
import { readUssDirectory, refreshUssTree, ussTestDirPath } from "../utils/ussUtils";

const USS_SCHEME = "zowe-uss";

/** Path of the USS directory under test within the `zowe-uss` file system. */
const ussDirPath = `/${process.env.ZE_TEST_PROFILE_NAME}${ussTestDirPath}`;

After(async function () {
    if (this.newUssFileName) {
        await deleteUssFileOutsideZowe(`${ussTestDirPath}/${this.newUssFileName as string}`);
        this.newUssFileName = undefined;
    }
    await stopRecordingFileEvents();
});

/** Lists the USS directory the same way expanding or refreshing its node does. */
async function refreshUssDirectory(): Promise<void> {
    await refreshUssTree();
    // Refreshing the tree only re-lists the directory if the tree view re-queries its children, which
    // it does on its own schedule. Listing it directly guarantees the provider compares listings
    // before the assertions run.
    await readUssDirectory(ussDirPath);
}

Given("Zowe Explorer is recording USS file system events", async () => {
    // Recording starts after the Background listed the directory, so the provider already has an
    // entry list to compare the refreshed listing against.
    await startRecordingFileEvents(USS_SCHEME);
});

Given("a USS file created outside of Zowe Explorer that Zowe Explorer has already listed", async function () {
    this.newUssFileName = uniqueUssFileName();
    await createUssFileOutsideZowe(`${ussTestDirPath}/${this.newUssFileName as string}`);
    // Listed before recording begins, so only the later deletion shows up in the event log.
    await refreshUssDirectory();
});

When("a USS file is created outside of Zowe Explorer", async function () {
    this.newUssFileName = uniqueUssFileName();
    await createUssFileOutsideZowe(`${ussTestDirPath}/${this.newUssFileName as string}`);
});

When("the USS file is deleted outside of Zowe Explorer", async function () {
    await deleteUssFileOutsideZowe(`${ussTestDirPath}/${this.newUssFileName as string}`);
});

When("the user creates a new USS file using the Create File action", async function () {
    this.newUssFileName = uniqueUssFileName();
    await this.ussDir.elem.moveTo();
    await clickContextMenuItem(this.ussDir, "Create File");
    await fillInputBox(this.newUssFileName as string);
});

When("a user refreshes the USS directory", async () => {
    await refreshUssDirectory();
});

Then("a Created event is emitted for the new USS file", async function () {
    const filePath = `${ussDirPath}/${this.newUssFileName as string}`;
    const isFileCreated = (event: RecordedFileEvent): boolean => event.type === "created" && event.path === filePath;

    assertRecorded(await waitForFileEvent(isFileCreated), isFileCreated, `a Created event for ${filePath}`);
});

Then("a Deleted event is emitted for the USS file", async function () {
    const filePath = `${ussDirPath}/${this.newUssFileName as string}`;
    const isFileDeleted = (event: RecordedFileEvent): boolean => event.type === "deleted" && event.path === filePath;

    assertRecorded(await waitForFileEvent(isFileDeleted), isFileDeleted, `a Deleted event for ${filePath}`);
});

Then("a Changed event is emitted for the parent directory", async () => {
    const isDirChanged = (event: RecordedFileEvent): boolean => event.type === "changed" && event.path === ussDirPath;

    assertRecorded(await waitForFileEvent(isDirChanged), isDirChanged, `a Changed event for ${ussDirPath}`);
});
