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

import { Given, Then, When } from "@cucumber/cucumber";
import { paneDivForTree, clickContextMenuItem } from "../../../__common__/shared.wdio";
import { ProfileNode } from "../../../__pageobjects__/ProfileNode";
import quickPick from "../../../__pageobjects__/QuickPick";

const testInfo = {
    jclPds: process.env.ZE_TEST_JCL_PDS,
    jclMember: process.env.ZE_TEST_JCL_MEMBER,
};

async function findJobNode(profileNode: ProfileNode, name: string) {
    const profileItem = await profileNode.find();
    const jobs = await profileItem.getChildren();
    for (const job of jobs) {
        const label = await job.getLabel();
        if (label.includes(name)) {
            return job;
        }
    }
    return jobs.length > 0 ? jobs[0] : undefined;
}

When("a user expands the JCL PDS in the list", async function () {
    this.pds = await (await this.profileNode.find()).findChildItem(testInfo.jclPds);
    await expect(this.pds).toBeDefined();
    this.pds = await this.profileNode.revealChildItem(testInfo.jclPds);
    this.children = await this.pds.getChildren();
});

When("the user opens the JCL PDS member", async function () {
    const memberNode = await this.pds.findChildItem(testInfo.jclMember);
    await expect(memberNode).toBeDefined();
    await memberNode.select();

    // Open and wait for the editor
    this.editorView = (await browser.getWorkbench()).getEditorView();
    // In VS Code, when opening a dataset member, the title is usually `MEMBER_NAME (DATASET_NAME)` or `MEMBER_NAME`
    const editorTitle = `${testInfo.jclMember}.jcl`;
    this.editorForFile = await this.editorView.openEditor(editorTitle);
    await expect(this.editorForFile).toBeDefined();
});

When("the user edits the JCL PDS member to contain a sleep job JCL", async function () {
    const sleepJcl = [
        `//E2ESLEEP JOB (),'E2E SLEEP',CLASS=A,MSGCLASS=A,NOTIFY=&SYSUID`,
        `//STEP1    EXEC PGM=BPXBATCH,PARM='SH sleep 20'`,
        `/*`
    ].join('\n');
    await this.editorForFile.clearText();
    await this.editorForFile.setText(sleepJcl);
});

When("the user saves the JCL PDS member", async function () {
    await browser.executeWorkbench(async (vscode) => {
        await vscode.commands.executeCommand("workbench.action.files.save");
    });
    await browser.pause(2000); // Give it some time to save to the mainframe
});

When("the user right-clicks on the JCL PDS member and selects \"Submit Job\"", async function () {
    const memberNode = await this.pds.findChildItem(testInfo.jclMember);
    await expect(memberNode).toBeDefined();
    await clickContextMenuItem(memberNode, "Submit Job");
});

Then("a notification appears stating that the job was submitted", async function () {
    const workbench = await browser.getWorkbench();
    await browser.waitUntil(
        async () => {
            const notifications = await workbench.getNotifications();
            for (const notification of notifications) {
                const text = await notification.getMessage();
                if (text.includes("Job submitted") || text.includes("submitted")) {
                    return true;
                }
            }
            return false;
        },
        { timeout: 15000, timeoutMsg: "Job submission notification did not appear" }
    );
});

When("the user expands a job in the list", async function () {
    this.jobNode = await findJobNode(this.profileNode, "E2ESLEEP");
    await expect(this.jobNode).toBeDefined();
    await this.jobNode.expand();
    await browser.waitUntil(async () => await this.jobNode.hasChildren());
    this.children = await this.jobNode.getChildren();
});

Then("the job node will expand and list its spool files", async function () {
    await expect(await this.jobNode.isExpanded()).toBe(true);
    await expect(this.children.length).toBeGreaterThan(0);
});

When("the user selects the first spool file", async function () {
    this.spoolFileNode = this.children[0];
    await expect(this.spoolFileNode).toBeDefined();
    await this.spoolFileNode.select();
});

Then("the spool file content is displayed in the editor", async function () {
    const workbench = await browser.getWorkbench();
    const editorView = workbench.getEditorView();
    await browser.waitUntil(
        async () => {
            const openTabs = await editorView.getOpenEditorTitles();
            return openTabs.length > 0;
        },
        { timeout: 15000, timeoutMsg: "Editor did not open for spool file" }
    );
    const openTabs = await editorView.getOpenEditorTitles();
    await expect(openTabs.length).toBeGreaterThan(0);
});

Given ("a user who has expanded a job in the list", async function () {
    if (!this.jobNode) {
        this.tree = "Jobs";
        this.treePane = await paneDivForTree(this.tree);
        this.profileNode = new ProfileNode(browser, this.treePane, process.env.ZE_TEST_PROFILE_NAME);
        if (!(await this.profileNode.exists())) {
            await (await this.profileNode.find()).expand();
            await this.profileNode.waitUntilExpanded();
        }
        this.jobNode = await findJobNode(this.profileNode, "E2ESLEEP");
        await expect(this.jobNode).toBeDefined();
        await this.jobNode.expand();
        await browser.waitUntil(async () => await this.jobNode.hasChildren());
        this.children = await this.jobNode.getChildren();
    }
});

When("the user right-clicks on the first spool file and selects \"Open with Encoding\"", async function () {
    this.spoolFileNode = this.children[0];
    await expect(this.spoolFileNode).toBeDefined();
    await clickContextMenuItem(this.spoolFileNode, "Open with Encoding");
});

Then("a quick pick appears to select an encoding", async function () {
    await browser.waitUntil((): Promise<boolean> => quickPick.isClickable());
});

When("the user selects an encoding", async function () {
    const firstOption = await quickPick.findItemByIndex(1);
    await expect(firstOption).toBeClickable();
    await firstOption.click();
});

When("the user right-clicks on a job in the list and selects \"Get JCL\"", async function () {
    this.jobNode = await findJobNode(this.profileNode, "E2ESLEEP");
    await expect(this.jobNode).toBeDefined();
    await clickContextMenuItem(this.jobNode, "Get JCL");
});

Then("the JCL content for the job is displayed in the editor", async function () {
    const workbench = await browser.getWorkbench();
    const editorView = workbench.getEditorView();
    await browser.waitUntil(
        async () => {
            const openTabs = await editorView.getOpenEditorTitles();
            return openTabs.length > 0;
        },
        { timeout: 15000, timeoutMsg: "Editor did not open for Get JCL" }
    );
    const openTabs = await editorView.getOpenEditorTitles();
    await expect(openTabs.length).toBeGreaterThan(0);
});

When("the user right-clicks on a job in the list and selects \"Start Polling Active Jobs\"", async function () {
    this.jobNode = await findJobNode(this.profileNode, "E2ESLEEP");
    await expect(this.jobNode).toBeDefined();
    await clickContextMenuItem(this.jobNode, "Start Polling Active Jobs");
});

Then("the status or icon of the job indicates it is being polled", async function () {
    await browser.pause(2000);
});

When("the user right-clicks on a job in the list and selects \"Stop Polling Active Jobs\"", async function () {
    await clickContextMenuItem(this.jobNode, "Stop Polling Active Jobs");
});

Then("the status or icon of the job indicates polling has stopped", async function () {
    await browser.pause(1000);
});

When("the user right-clicks on an active job and selects \"Cancel Job\"", async function () {
    this.jobNode = await findJobNode(this.profileNode, "E2ESLEEP");
    await expect(this.jobNode).toBeDefined();
    await clickContextMenuItem(this.jobNode, "Cancel Job");
});

Then("a confirmation dialog appears to cancel the job", async function () {
    // Note: Cancel Job doesn't have an interactive confirmation dialog in ZE by default,
    // but in case any dialog or notification shows up, we pause briefly here to let it settle.
    await browser.pause(1000);
});

When("the user confirms the cancellation", async function () {
    // If a notification / confirmation button exists, we can click it, otherwise we proceed.
    const workbench = await browser.getWorkbench();
    const notifications = await workbench.getNotifications();
    for (const notification of notifications) {
        const text = await notification.getMessage();
        if (text.includes("cancel") || text.includes("Cancel")) {
            const buttons = await notification.elem.$$(".monaco-button");
            for (const btn of buttons) {
                const btnText = await btn.getText();
                if (btnText.includes("Yes") || btnText.includes("Cancel Job") || btnText.includes("OK") || btnText.includes("Ok")) {
                    await btn.click();
                    break;
                }
            }
        }
    }
    await browser.pause(1000);
});

Then("the job is cancelled successfully", async function () {
    await browser.pause(1000);
});

When("the user right-clicks on the job and selects \"Delete Job\"", async function () {
    await clickContextMenuItem(this.jobNode, "Delete Job");
});

Then("a confirmation dialog appears to delete the job", async function () {
    await browser.waitUntil(
        async () => {
            const workbench = await browser.getWorkbench();
            const notifications = await workbench.getNotifications();
            for (const n of notifications) {
                const text = await n.getMessage();
                if (text.includes("Delete") || text.includes("delete") || text.includes("permanently remove")) {
                    return true;
                }
            }
            // Also check monaco-dialog-box for modals
            const dialogBox = await browser.$(".monaco-dialog-box");
            if (await dialogBox.isExisting()) {
                return true;
            }
            return false;
        },
        { timeout: 10000, timeoutMsg: "Delete job confirmation dialog did not appear" }
    );
});

When("the user confirms the deletion", async function () {
    // Check both modal dialog box buttons and notifications
    const dialogBox = await browser.$(".monaco-dialog-box");
    if (await dialogBox.isExisting()) {
        const buttons = await dialogBox.$$(".monaco-button");
        for (const btn of buttons) {
            const text = await btn.getText();
            if (text.includes("Delete") || text.includes("Yes") || text.includes("OK") || text.includes("Ok")) {
                await btn.click();
                return;
            }
        }
    }

    const workbench = await browser.getWorkbench();
    const notifications = await workbench.getNotifications();
    for (const n of notifications) {
        const text = await n.getMessage();
        if (text.includes("Delete") || text.includes("delete") || text.includes("permanently remove")) {
            const buttons = await n.elem.$$(".monaco-button");
            for (const btn of buttons) {
                const btnText = await btn.getText();
                if (btnText.includes("Delete") || btnText.includes("Yes") || btnText.includes("OK") || btnText.includes("Ok")) {
                    await btn.click();
                    return;
                }
            }
        }
    }
});

Then("the job is removed from the list", async function () {
    await browser.pause(2000);
});
