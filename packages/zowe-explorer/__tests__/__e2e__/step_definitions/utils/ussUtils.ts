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

/**
 * Absolute USS path of the directory the tests operate in. `ZE_TEST_USS_DIR` may be given either
 * relative to `ZE_TEST_USS_FILTER` or as a full path, so the filter prefix is stripped before the
 * two are joined.
 */
export const ussTestDirPath = `${process.env.ZE_TEST_USS_FILTER}/${(process.env.ZE_TEST_USS_DIR ?? "").replace(
    `${process.env.ZE_TEST_USS_FILTER}/`,
    ""
)}`;

/**
 * Lists a USS directory through the file system provider, which is the same request Zowe Explorer
 * makes when a directory node is expanded or refreshed.
 *
 * @param nodePath Path of the directory within the `zowe-uss` file system, e.g. `/myProfile/u/users/me/test`
 */
export async function readUssDirectory(nodePath: string): Promise<void> {
    await browser.executeWorkbench(async (vscode, path: string) => {
        await vscode.workspace.fs.readDirectory(vscode.Uri.from({ scheme: "zowe-uss", path }));
    }, nodePath);
}

export async function refreshUssTree(): Promise<void> {
    await browser.executeWorkbench(async (vscode) => {
        await vscode.commands.executeCommand("zowe.uss.refreshAll");
    });
}
