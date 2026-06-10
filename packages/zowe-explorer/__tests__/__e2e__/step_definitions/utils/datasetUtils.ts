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

import { clickContextMenuItem } from "../../../__common__/shared.wdio";
import { Key } from "webdriverio";
import quickPick from "../../../__pageobjects__/QuickPick";

export const filterBase = (process.env.ZE_TEST_DS_FILTER ?? "TEST*").replace(/\.\*?$|\*$/, "").replace(/\.$/, "");

export async function allocateSequentialDs(world: any, dsName: string): Promise<void> {
    await allocateDs(world, dsName, "Sequential Data Set");
}

export async function allocatePartitionedDs(world: any, dsName: string): Promise<void> {
    await allocateDs(world, dsName, "Partitioned Data Set: Default");
}

async function allocateDs(world: any, dsName: string, dsType: string): Promise<void> {
    const profileNode = await world.profileNode.find();
    await profileNode.elem.moveTo();
    await clickContextMenuItem(profileNode, "Create New Data Set");

    const nameInputBox = await $('.input[aria-describedby="quickInput_message"]');
    await nameInputBox.waitForDisplayed();
    await nameInputBox.setValue(dsName);
    await browser.keys(Key.Enter);

    await browser.waitUntil((): Promise<boolean> => quickPick.isClickable());
    const typeOption = await quickPick.findItem(dsType);
    await expect(typeOption).toBeClickable();
    await typeOption.click();

    await browser.waitUntil((): Promise<boolean> => quickPick.isClickable());
    const allocateOption = await quickPick.findItem("+ Allocate Data Set");
    await expect(allocateOption).toBeClickable();
    await allocateOption.click();

    await browser.pause(3000);
    await browser.waitUntil(async () => !!(await (await world.profileNode.find()).findChildItem(dsName)), {
        timeout: 15000,
        timeoutMsg: `Dataset ${dsName} did not appear in tree after creation`,
    });
}

/**
 * Opens a PS dataset in the editor (triggering DatasetFSProvider.readFileImplementation so ZE
 * populates its in-memory FS cache), then closes the editor.  This is required before calling
 * deleteDsOrMember on a PS that has not been opened yet.
 */
export async function openDsToPopulateCache(world: any, dsName: string): Promise<void> {
    const dsNode = await (await world.profileNode.find()).findChildItem(dsName);
    await dsNode.select();
    const editorView = (await browser.getWorkbench()).getEditorView();
    await browser.waitUntil(async () => (await editorView.getOpenEditorTitles()).includes(dsName), {
        timeout: 10000,
        timeoutMsg: `Editor for ${dsName} did not open after clicking the tree node`,
    });
    await editorView.closeEditor(dsName);
}

/**
 * Creates a PDS member via the ZE "Create New Member" context menu entry, waits for ZE to open
 * the new member's editor (which populates the FS cache), then closes the editor.
 */
export async function createMemberInPds(pdsNode: any, memberName: string): Promise<void> {
    await pdsNode.elem.moveTo();
    await clickContextMenuItem(pdsNode, "Create New Member");

    const inputBox = await $('.input[aria-describedby="quickInput_message"]');
    await inputBox.waitForDisplayed();
    await inputBox.setValue(memberName);
    await browser.keys(Key.Enter);

    const editorView = (await browser.getWorkbench()).getEditorView();
    await browser.waitUntil(async () => (await editorView.getOpenEditorTitles()).includes(memberName), {
        timeout: 10000,
        timeoutMsg: `Editor for new member ${memberName} did not open`,
    });
    await editorView.closeEditor(memberName);
}

/**
 * Polls the tree by re-deriving the profile → PDS chain on each tick (avoids stale DOM
 * references caused by ZE re-rendering the PDS node after member creation), then returns once
 * the member is visible.
 */
export async function waitForMemberInPds(world: any, pdsName: string, memberName: string): Promise<void> {
    await browser.waitUntil(
        async () => {
            const profileNode = await world.profileNode.find();
            const pds = await profileNode.findChildItem(pdsName);
            if (!pds) return false;
            return !!(await pds.findChildItem(memberName));
        },
        {
            timeout: 15000,
            timeoutMsg: `Member ${memberName} did not appear in PDS after creation`,
        }
    );
}

/**
 * Deletes one or more datasets or members from the LPAR via ZE's DatasetFSProvider.
 * Entries must already exist in ZE's in-memory FS cache (use openDsToPopulateCache or
 * readDirectory first).  Silently ignores paths that are not in the cache.
 */
export async function deleteDsOrMember(...nodePaths: string[]): Promise<void> {
    for (const nodePath of nodePaths) {
        try {
            await browser.executeWorkbench(async (vscode, path: string) => {
                const uri = vscode.Uri.from({ scheme: "zowe-ds", path });
                await vscode.workspace.fs.delete(uri, { recursive: false });
            }, nodePath);
        } catch {}
    }
}

/**
 * Fires zowe.ds.refreshAll, which sets dirty=true on all session nodes and emits
 * onDidChangeTreeData so VS Code re-fetches the node list from the LPAR.
 */
export async function refreshDsTree(): Promise<void> {
    await browser.executeWorkbench(async (vscode) => {
        await vscode.commands.executeCommand("zowe.ds.refreshAll");
    });
}
