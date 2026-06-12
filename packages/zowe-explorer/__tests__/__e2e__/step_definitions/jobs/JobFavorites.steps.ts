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
import { Key } from "webdriverio";
import { TextEditor, TreeItem } from "wdio-vscode-service";

const testInfo = {
    profileName: process.env.ZE_TEST_PROFILE_NAME,
    jclPds: process.env.ZE_TEST_JCL_PDS,
    jclMember: process.env.ZE_TEST_JCL_MEMBER,
};

const SLEEP_JCL = [
    `//E2ESLEEP JOB (),'E2E SLEEP',CLASS=A,MSGCLASS=A,NOTIFY=&SYSUID`,
    `//STEP1    EXEC PGM=IEBGENER`,
    `//SYSIN    DD DUMMY`,
    `//SYSPRINT DD SYSOUT=*`,
    `//SYSUT1   DD *,DLM=ZZ`,
    `/* REXX */`,
    `call syscalls 'ON'`,
    `address syscall "sleep 300"`,
    `ZZ`,
    `//SYSUT2   DD DSN=&&REXX(SLEEP),DISP=(,PASS),`,
    `//            SPACE=(TRK,(1,1,1)),UNIT=SYSALLDA,`,
    `//            DCB=(RECFM=FB,LRECL=80,DSORG=PO)`,
    `//*`,
    `//STEP2    EXEC PGM=IRXJCL,PARM='SLEEP'`,
    `//SYSEXEC  DD DSN=&&REXX,DISP=(OLD,DELETE)`,
    `//SYSTSPRT DD SYSOUT=*`,
    `//SYSTSIN  DD DUMMY`,
].join("\n");

/**
 * Returns the search filter node (Owner: ... | Prefix: * | ...) that is the direct
 * child of the favorited profile node. Jobs live one level below this node.
 */
async function findFavSearchFilterNode(favProfileNode: ProfileNode): Promise<TreeItem | undefined> {
    const profileItem = await favProfileNode.find();
    const children = await profileItem.getChildren();
    for (const child of children) {
        const label = await child.getLabel();
        if (label.includes("Owner:") || label.includes("Prefix:") || label.includes("JobId:")) {
            return child as TreeItem;
        }
    }
    return children.length > 0 ? (children[0] as TreeItem) : undefined;
}

/**
 * Finds the first job child under the favorited profile. Tree structure:
 *   Favorites > <profile> > <search filter node> > <jobs>
 */
async function findJobUnderFavProfile(favProfileNode: ProfileNode): Promise<TreeItem | undefined> {
    const filterNode = await findFavSearchFilterNode(favProfileNode);
    if (!filterNode) {
        return undefined;
    }
    // Click once to initialize the collapsible state before expand() will work
    await filterNode.elem.click();
    await browser.waitUntil(async () => (await filterNode.isExpanded()) !== undefined);
    if (!(await filterNode.isExpanded())) {
        await filterNode.expand();
    }
    await browser.waitUntil(async () => filterNode.hasChildren());
    const jobs = await filterNode.getChildren();
    return jobs.length > 0 ? (jobs[0] as TreeItem) : undefined;
}

/**
 * Ensures the favorited profile node exists under Favorites, adding it if needed,
 * and expands through the search filter node so jobs are accessible.
 * Sets this.favProfileNode and this.favSearchFilterNode.
 */
async function ensureFavoritedProfileNode(world: any): Promise<void> {
    const treePane = await paneDivForTree("Jobs");
    world.favProfileNode = new ProfileNode(browser, treePane, testInfo.profileName, /* isFavorite */ true);

    if (!(await world.favProfileNode.exists())) {
        if (!world.profileNode) {
            world.treePane = treePane;
            world.profileNode = new ProfileNode(browser, treePane, testInfo.profileName);
        }
        const profileItem = await world.profileNode.find();
        await expect(profileItem).toBeDefined();
        await clickContextMenuItem(profileItem, "Add to Favorites");
        await browser.waitUntil((): Promise<boolean> => world.favProfileNode.exists(), {
            timeout: 10000,
            timeoutMsg: `Profile "${testInfo.profileName}" was not added to Favorites in time`,
        });
    }

    // Expand the favorited profile so the search filter child is visible
    const favProfileItem = await world.favProfileNode.find();
    if (!(await favProfileItem.isExpanded())) {
        await favProfileItem.expand();
    }
    await world.favProfileNode.waitUntilExpanded();

    // Click the search filter node once to initialize its collapsible state, then expand it
    const filterNode = await findFavSearchFilterNode(world.favProfileNode);
    await expect(filterNode).toBeDefined();
    await filterNode.elem.click();
    await browser.waitUntil(async () => (await filterNode.isExpanded()) !== undefined);
    if (!(await filterNode.isExpanded())) {
        await filterNode.expand();
    }
    await browser.waitUntil(async () => filterNode.hasChildren(), {
        timeout: 15000,
        timeoutMsg: "Favorited job search filter node did not load jobs",
    });
    world.favSearchFilterNode = filterNode;
}

// ---------------------------------------------------------------------------
// Add to Favorites
// ---------------------------------------------------------------------------

When("the user right-clicks on the profile node and selects {string}", async function (menuItem: string) {
    const profileItem = await this.profileNode.find();
    await expect(profileItem).toBeDefined();
    await clickContextMenuItem(profileItem, menuItem);
});

Then("the profile appears as a favorited node under the Favorites section in the Jobs tree", async function () {
    const treePane = await paneDivForTree("Jobs");
    const favoritesNode = (await treePane.findItem("Favorites")) as TreeItem;
    await expect(favoritesNode).toBeDefined();
    await favoritesNode.expand();
    await browser.waitUntil(async () => favoritesNode.isExpanded());

    await browser.waitUntil(
        async () => {
            const children = await favoritesNode.getChildren();
            for (const child of children) {
                const label = await child.getLabel();
                if (label.includes(testInfo.profileName)) {
                    return true;
                }
            }
            return false;
        },
        { timeout: 10000, timeoutMsg: `Favorited profile "${testInfo.profileName}" not found under Favorites` }
    );
});

// ---------------------------------------------------------------------------
// Given: favorited profile node (jobs accessible under filter node)
// ---------------------------------------------------------------------------

Given("the Jobs tree has a favorited profile node", async function () {
    await ensureFavoritedProfileNode(this);
});

// ---------------------------------------------------------------------------
// Viewing and opening spool files from a favorited job
// ---------------------------------------------------------------------------

When("the user expands a job under the favorited profile", async function () {
    this.favJobNode = await findJobUnderFavProfile(this.favProfileNode);
    await expect(this.favJobNode).toBeDefined();
    await this.favJobNode.expand();
    await browser.waitUntil(async () => this.favJobNode.hasChildren());
    this.favJobChildren = await this.favJobNode.getChildren();
    // Alias to shared names used by "the job node will expand and list its spool files"
    this.jobNode = this.favJobNode;
    this.children = this.favJobChildren;
});

When("the user selects the first spool file under the favorited job", async function () {
    this.favSpoolFileNode = this.favJobChildren[0];
    await expect(this.favSpoolFileNode).toBeDefined();
    await this.favSpoolFileNode.select();
});

// ---------------------------------------------------------------------------
// Get JCL from a favorited job
// ---------------------------------------------------------------------------

When('the user right-clicks on a job under the favorited profile and selects "Get JCL"', async function () {
    this.favJobNode = await findJobUnderFavProfile(this.favProfileNode);
    await expect(this.favJobNode).toBeDefined();
    await clickContextMenuItem(this.favJobNode, "Get JCL");
});

// ---------------------------------------------------------------------------
// Open spool file with encoding from a favorited job
// ---------------------------------------------------------------------------

Given("a job under the favorited profile is expanded", async function () {
    if (!this.favJobChildren) {
        this.favJobNode = await findJobUnderFavProfile(this.favProfileNode);
        await expect(this.favJobNode).toBeDefined();
        await this.favJobNode.expand();
        await browser.waitUntil(async () => this.favJobNode.hasChildren());
        this.favJobChildren = await this.favJobNode.getChildren();
        this.jobNode = this.favJobNode;
        this.children = this.favJobChildren;
    }
});

When('the user right-clicks on the first spool file under the favorited job and selects "Open with Encoding"', async function () {
    this.favSpoolFileNode = this.favJobChildren[0];
    await expect(this.favSpoolFileNode).toBeDefined();
    await clickContextMenuItem(this.favSpoolFileNode, "Open with Encoding");
});

// ---------------------------------------------------------------------------
// Given: favorited job search filter node (generic - existing filter)
// ---------------------------------------------------------------------------

Given("the Jobs tree has a favorited job search filter node", async function () {
    await ensureFavoritedProfileNode(this);
});

// ---------------------------------------------------------------------------
// Submit sleep job + favorite the resulting job-ID filter for polling
// ---------------------------------------------------------------------------

Given("a sleep job has been submitted for polling", async function () {
    // Open the Data Sets tree and ensure a filter is set so the PDS is visible
    const dsPane = await paneDivForTree("Data Sets");
    const dsProfileNode = new ProfileNode(browser, dsPane, testInfo.profileName);

    if (!(await (await dsProfileNode.find()).isExpanded())) {
        await (await dsProfileNode.find()).elem.moveTo();
        const actionButtons = await (await dsProfileNode.find()).getActionButtons();
        const searchButton = actionButtons[actionButtons.length - 1];
        await searchButton.wait();
        await searchButton.elem.click();

        await browser.waitUntil((): Promise<boolean> => quickPick.isClickable());
        if (await quickPick.hasOptions()) {
            const createFilter = await quickPick.findItem(
                "$(plus) Create a new filter. For example: HLQ.*, HLQ.aaa.bbb, HLQ.ccc.ddd(member)"
            );
            await expect(createFilter).toBeClickable();
            await createFilter.click();
        }
        const inputBox = await $('.input[aria-describedby="quickInput_message"]');
        await expect(inputBox).toBeClickable();
        await inputBox.setValue(process.env.ZE_TEST_DS_FILTER);
        await browser.keys(Key.Enter);
        await dsProfileNode.waitUntilExpanded();
    }

    // Expand the PDS
    const pdsNode = await dsProfileNode.revealChildItem(testInfo.jclPds);
    await expect(pdsNode).toBeDefined();

    // Open the JCL member
    const memberNode = await pdsNode.findChildItem(testInfo.jclMember);
    await expect(memberNode).toBeDefined();
    await memberNode.select();

    const editorView = (await browser.getWorkbench()).getEditorView();
    const editorTitle = `${testInfo.jclMember}.jcl`;
    const editor = (await editorView.openEditor(editorTitle)) as TextEditor;
    await expect(editor).toBeDefined();

    // Write and save the sleep JCL
    await editor.clearText();
    await editor.setText(SLEEP_JCL);
    await browser.executeWorkbench(async (vscode) => {
        await vscode.commands.executeCommand("workbench.action.files.save");
    });
    await browser.pause(2000);

    // Submit the job
    await clickContextMenuItem(memberNode, "Submit Job");

    // Capture the submitted job ID from the notification
    const workbench = await browser.getWorkbench();
    await browser.waitUntil(
        async () => {
            const notifications = await workbench.getNotifications();
            for (const notification of notifications) {
                const text = await notification.getMessage();
                if (text.includes("submitted")) {
                    const match = text.match(/(JOB|STC|TSU)\d+/);
                    if (match) {
                        this.activeJobId = match[0];
                        return true;
                    }
                }
            }
            return false;
        },
        { timeout: 15000, timeoutMsg: "Job submission notification did not appear" }
    );
});

Given("the Jobs tree has a favorited job search filter for the active job", async function () {
    const treePane = await paneDivForTree("Jobs");
    const regularProfileNode = new ProfileNode(browser, treePane, testInfo.profileName);

    // Collapse any existing favorited filter to avoid viewport/ambiguity issues
    this.favProfileNode = new ProfileNode(browser, treePane, testInfo.profileName, /* isFavorite */ true);
    if (await this.favProfileNode.exists()) {
        const existingFavItem = await this.favProfileNode.find();
        if (await existingFavItem.isExpanded()) {
            await existingFavItem.collapse();
        }
    }

    // Set an Owner=<user> | Prefix=* filter on the regular profile (default query covers all user jobs)
    await (await regularProfileNode.find()).elem.moveTo();
    const actionButtons = await (await regularProfileNode.find()).getActionButtons();
    const searchButton = actionButtons[actionButtons.length - 1];
    await searchButton.wait();
    await searchButton.elem.click();

    await browser.waitUntil((): Promise<boolean> => quickPick.isClickable());
    const createFilterOption = await quickPick.findItem("$(plus) Create job search filter");
    await expect(createFilterOption).toBeClickable();
    await createFilterOption.click();

    // Submit the default owner+wildcard query without changing status
    const submitOption = await quickPick.findItem("$(check) Submit this query");
    await expect(submitOption).toBeClickable();
    await submitOption.click();
    await regularProfileNode.waitUntilExpanded();

    // Refresh so the newly submitted job is visible
    await browser.executeWorkbench((vscode) => vscode.commands.executeCommand("zowe.jobs.refreshAll"));
    await browser.pause(2000);

    // Favorite the search filter node (child of the regular profile)
    const profileItem = await regularProfileNode.find();
    const filterChildren = await profileItem.getChildren();
    const searchFilterNode = filterChildren.length > 0 ? (filterChildren[0] as TreeItem) : undefined;
    await expect(searchFilterNode).toBeDefined();
    await clickContextMenuItem(searchFilterNode, "Add to Favorites");

    // Wait for the favorited profile to appear under Favorites
    await browser.waitUntil((): Promise<boolean> => this.favProfileNode.exists(), {
        timeout: 10000,
        timeoutMsg: "Favorited profile did not appear under Favorites after adding active jobs filter",
    });

    // Expand Favorites > profile, then click+expand the newly added filter node
    const favProfileItem = await this.favProfileNode.find();
    if (!(await favProfileItem.isExpanded())) {
        await favProfileItem.expand();
    }
    await this.favProfileNode.waitUntilExpanded();

    // The newly added filter is the last child under the favorited profile
    const favProfileChildren = await (await this.favProfileNode.find()).getChildren();
    const activeFilterNode = favProfileChildren.length > 0
        ? (favProfileChildren[favProfileChildren.length - 1] as TreeItem)
        : undefined;
    await expect(activeFilterNode).toBeDefined();

    // Click once to initialize collapsible state, then expand
    await activeFilterNode.elem.click();
    await browser.waitUntil(async () => (await activeFilterNode.isExpanded()) !== undefined);
    if (!(await activeFilterNode.isExpanded())) {
        await activeFilterNode.expand();
    }
    await browser.waitUntil(async () => activeFilterNode.hasChildren(), {
        timeout: 15000,
        timeoutMsg: "Favorited active jobs filter did not show any jobs",
    });
    this.favSearchFilterNode = activeFilterNode;
});

// ---------------------------------------------------------------------------
// Remove Favorite (search filter node)
// ---------------------------------------------------------------------------

When('the user right-clicks on the favorited job search filter and selects "Remove Favorite"', async function () {
    await clickContextMenuItem(this.favSearchFilterNode, "Remove Favorite");
});

Then("the favorited job search filter is no longer present under Favorites in the Jobs tree", async function () {
    await browser.waitUntil(
        async () => {
            try {
                const node = await findFavSearchFilterNode(this.favProfileNode);
                if (!node) {
                    return true;
                }
                const label = await node.getLabel();
                return !label.includes("Owner:") && !label.includes("Prefix:") && !label.includes("JobId:");
            } catch {
                return true;
            }
        },
        { timeout: 10000, timeoutMsg: "Favorited job search filter was not removed from Favorites" }
    );
});
