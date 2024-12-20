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

import { IFileSystemEntry, ZoweScheme } from "../fs";
import { IZoweTreeNode } from "../tree";
import { window, workspace } from "vscode";

export * from "./DeferredPromise";
export * from "./ErrorCorrelator";
export * from "./Poller";
export * from "./FileManagement";

/**
 * Getter to check dirty flag for nodes opened in the editor.
 *
 * NOTE: Only works for nodes that use resource URIs (see the `resourceUri` variable in IZoweTreeNode)
 * @returns {boolean} whether the URI is open in the editor and unsaved
 */
export function isNodeInEditor(node: IZoweTreeNode): boolean {
    return workspace.textDocuments.some(({ uri, isDirty }) => uri.path === node.resourceUri?.path && isDirty);
}

export async function reloadActiveEditorForProfile(profileName: string): Promise<void> {
    if (
        (Object.values(ZoweScheme) as string[]).includes(window.activeTextEditor.document.uri.scheme) &&
        window.activeTextEditor.document.uri.path.startsWith(`/${profileName}/`) &&
        !window.activeTextEditor.document.isDirty
    ) {
        const fsEntry = (await workspace.fs.stat(window.activeTextEditor.document.uri)) as IFileSystemEntry;
        fsEntry.wasAccessed = false;
        await workspace.fs.readFile(window.activeTextEditor.document.uri);
    }
}

export async function reloadWorkspacesForProfile(profileName: string): Promise<void> {
    const foldersWithProfile = (workspace.workspaceFolders ?? []).filter(
        (f) => (f.uri.scheme === ZoweScheme.DS || f.uri.scheme === ZoweScheme.USS) && f.uri.path.startsWith(`/${profileName}/`)
    );
    for (const folder of foldersWithProfile) {
        try {
            await workspace.fs.stat(folder.uri.with({ query: "fetch=true" }));
        } catch (err) {}
    }
}
