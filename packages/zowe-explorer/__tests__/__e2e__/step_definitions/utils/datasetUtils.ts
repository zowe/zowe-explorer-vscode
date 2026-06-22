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
    await browser.pause(4000);
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

export async function openDsInEditor(world: any, dsName: string): Promise<void> {
    const dsNode = await (await world.profileNode.find()).findChildItem(dsName);
    await dsNode.select();
    const editorView = (await browser.getWorkbench()).getEditorView();
    await browser.waitUntil(async () => (await editorView.getOpenEditorTitles()).includes(dsName), {
        timeout: 10000,
        timeoutMsg: `Editor for ${dsName} did not open after clicking the tree node`,
    });
    await editorView.closeEditor(dsName);
}

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
export async function writeDsContent(nodePath: string, content: string): Promise<void> {
    await browser.executeWorkbench(async (vscode, path: string, text: string) => {
        const uri = vscode.Uri.from({ scheme: "zowe-ds", path });
        await vscode.workspace.fs.writeFile(uri, Buffer.from(text, "utf8") as Uint8Array);
    }, nodePath, content);
}

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

export async function refreshDsTree(): Promise<void> {
    await browser.executeWorkbench(async (vscode) => {
        await vscode.commands.executeCommand("zowe.ds.refreshAll");
    });
}
