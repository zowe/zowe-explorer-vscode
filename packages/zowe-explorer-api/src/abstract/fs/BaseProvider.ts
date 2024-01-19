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

import * as vscode from "vscode";
import {
    DirEntry,
    IFileEntry,
    IFileSystemEntry,
    FS_PROVIDER_DELAY,
    ConflictViewSelection,
    BufferBuilder,
    LocalConflict,
    Conflictable,
    DeleteMetadata,
} from "./types";
import * as path from "path";
import { isEqual } from "lodash";
import { isDirectoryEntry, isFileEntry } from "./utils";
import { Gui } from "../../globals/Gui";
import * as nls from "vscode-nls";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

export class BaseProvider {
    // eslint-disable-next-line no-magic-numbers
    private readonly FS_PROVIDER_UI_TIMEOUT = 4000;

    protected _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    protected _bufferedEvents: vscode.FileChangeEvent[] = [];
    protected _fireSoonHandle?: NodeJS.Timeout;

    public readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

    // map remote conflict URIs to local URIs
    protected _conflictMap: Record<string, vscode.Uri> = {};
    protected root: DirEntry;
    public openedUris: vscode.Uri[] = [];

    protected constructor() {}

    /**
     * Deletes the conflict URI from the provider and closes the diff view.
     * @param remoteUri The conflict URI to remove from the provider
     */
    private _removeConflictAndCloseDiff(remoteUri: vscode.Uri): void {
        delete this._conflictMap[remoteUri.path];
        vscode.workspace.fs.delete(remoteUri);
        vscode.commands.executeCommand("workbench.action.closeActiveEditor");
    }

    /**
     * Action for overwriting the remote contents with local data from the provider.
     * @param remoteUri The "remote conflict" URI shown in the diff view
     */
    public async diffOverwrite(localUri: vscode.Uri): Promise<void> {
        // check for local URI in conflictMap

        if (!(localUri.path in this._conflictMap)) {
            return;
        }

        const remoteUri = this._conflictMap[localUri.path];
        const localEntry = this._lookupAsFile(localUri);
        localEntry.inDiffView = false;
        localEntry.forceUpload = true;
        await vscode.workspace.fs.writeFile(localUri, localEntry.conflictData);
        Gui.setStatusBarMessage(localize("diff.overwritten", "$(check) Overwrite applied for {0}", localEntry.name), this.FS_PROVIDER_UI_TIMEOUT);
        localEntry.conflictData = null;
        this._removeConflictAndCloseDiff(remoteUri);
    }

    /**
     * Action for replacing the local data in the provider with remote contents.
     * @param localUri The local URI shown in the diff view
     */
    public async diffUseRemote(localUri: vscode.Uri): Promise<void> {
        // check for local URI in conflictMap

        if (!(localUri.path in this._conflictMap)) {
            return;
        }
        const remoteUri = this._conflictMap[localUri.path];
        const localEntry = this._lookupAsFile(localUri);
        const remoteEntry = this._lookupAsFile(remoteUri);

        // If the data in the diff is different from the conflict data, we need to make another API request to push those changes.
        // If the data is equal, we can just assign the data in the FileSystem and avoid making an API request.
        localEntry.wasAccessed = remoteEntry.data.length === remoteEntry.conflictData.length && isEqual(remoteEntry.data, remoteEntry.conflictData);
        localEntry.inDiffView = false;
        await vscode.workspace.fs.writeFile(localUri, localEntry.conflictData);
        Gui.setStatusBarMessage(
            localize("diff.usedRemoteContent", "$(discard) Used remote content for {0}", localEntry.name),
            this.FS_PROVIDER_UI_TIMEOUT
        );
        localEntry.conflictData = null;
        this._removeConflictAndCloseDiff(remoteUri);
        // this will refresh the active editor with the remote content that was saved to the file
        vscode.commands.executeCommand("workbench.action.files.revert");
    }

    public exists(uri: vscode.Uri): boolean {
        const entry = this._lookup(uri, true);
        return entry != null;
    }

    /**
     * Removes a local entry from the FS provider if it exists, without making any API requests.
     * @param uri The URI pointing to a local entry in the FS provider
     */
    public removeEntryIfExists(uri: vscode.Uri): void {
        const parentEntry = this._lookupParentDirectory(uri, true);
        if (parentEntry == null) {
            return;
        }

        parentEntry.entries.delete(path.basename(uri.path));
        this._fireSoon({ type: vscode.FileChangeType.Deleted, uri: uri });
    }

    /**
     * Adds an opened URI to the cache so we can see if it has been closed.
     * @param uri the opened URI to keep track of
     */
    public cacheOpenedUri(uri: vscode.Uri): void {
        this.openedUris.push(uri);
    }

    /**
     * Invalidates the data for a file entry at a given URI.
     * Also removes the URI from the opened URI cache.
     * @param uri the URI whose data should be invalidated
     */
    public invalidateDataForUri(uri: vscode.Uri): void {
        const entry = this._lookup(uri, true);
        if (entry == null || !isFileEntry(entry)) {
            return;
        }

        entry.data = null;
        entry.wasAccessed = false;
        this.openedUris = this.openedUris.filter((u) => u !== uri);
    }

    /**
     * Triggers an update for the resource at the given URI to show its latest changes in the editor.
     * @param uri The URI that is open in an editor tab
     */
    protected async _updateResourceInEditor(uri: vscode.Uri): Promise<void> {
        // This is a hacky method and does not work for editors that aren't the active one,
        // so we can make VSCode switch the active document to that tab and then "revert the file" to show latest contents
        await vscode.commands.executeCommand("vscode.open", uri);
        // Note that the command only affects files that are not dirty
        // TODO: find a better method to reload editor tab with new contents
        vscode.commands.executeCommand("workbench.action.files.revert");
    }

    /**
     * Update the child entries in the provider with the parent's updated entry.
     * @param entry The parent directory whose children need updated
     */
    protected _updateChildPaths(entry: DirEntry): void {
        // update child entries
        for (const child of entry.entries.values()) {
            const isDir = isDirectoryEntry(child);
            child.metadata.path = entry.metadata.path.concat(`${child.name}${isDir ? "/" : ""}`);
            if (isDir) {
                this._updateChildPaths(child);
            }
        }
    }

    /**
     * Relocates an entry in the provider from `oldUri` to `newUri`.
     * @param oldUri The old, source URI in the provider that needs moved
     * @param newUri The new, destination URI for the file or folder
     * @param newUssPath The new path for this entry in USS
     */
    protected async _relocateEntry(oldUri: vscode.Uri, newUri: vscode.Uri, newUssPath: string): Promise<void> {
        const entry = this._lookup(oldUri, false);
        if (!entry) {
            return;
        }

        const oldParentUri = vscode.Uri.parse(oldUri.path.substring(0, oldUri.path.lastIndexOf("/")));
        const oldParent = this._lookupAsDirectory(oldParentUri, false);

        const parentUri = vscode.Uri.parse(newUri.path.substring(0, newUri.path.lastIndexOf("/")));
        const newParent = this._lookupAsDirectory(parentUri, false);

        // both parent paths must be valid in order to perform a relocation
        if (!oldParent || !newParent) {
            return;
        }

        entry.metadata.path = newUssPath;
        // write new entry in FS
        if (isFileEntry(entry)) {
            // put new contents in relocated file
            await vscode.workspace.fs.writeFile(newUri, entry.data);
            const newEntry = this._lookupAsFile(newUri);
            newEntry.etag = entry.etag;
        } else {
            // create directory in FS; when expanded in the tree, it will fetch any files
            vscode.workspace.fs.createDirectory(newUri);
        }
        // delete entry from old parent
        oldParent.entries.delete(entry.name);
        this._fireSoon({ type: vscode.FileChangeType.Deleted, uri: oldUri });
        const tabGroups = vscode.window.tabGroups.all;
        const allTabs = tabGroups.reduce((acc: vscode.Tab[], group) => acc.concat(group.tabs), []);
        const tabWithOldUri = allTabs.find((t) => (t.input as any).uri.path === oldUri.path);
        if (tabWithOldUri) {
            const parent = tabGroups.find((g) => g.tabs.find((t) => t === tabWithOldUri));
            const editorCol = parent.viewColumn;
            // close old uri and reopen new uri
            // TODO: not sure if we can get around this...
            await vscode.window.tabGroups.close(tabWithOldUri);
            vscode.commands.executeCommand("vscode.openWith", newUri, "default", editorCol);
        }
    }

    protected _deleteEntry(uri: vscode.Uri, _options: { recursive: boolean }): DeleteMetadata {
        const basename = path.posix.basename(uri.path);
        const parent = this._lookupParentDirectory(uri, false);

        // Throw an error if the entry does not exist
        if (!parent.entries.has(basename)) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }

        // get the entry data before deleting the URI
        const entryToDelete = this._lookup(uri, false);

        parent.entries.delete(basename);
        parent.mtime = Date.now();
        parent.size -= 1;

        return {
            entryToDelete,
            parent,
            parentUri: uri.with({ path: path.resolve(uri.path, "..") }),
        };
    }

    /**
     * Utility functions for conflict management:
     */

    /**
     * Handles the conflict that occurred while trying to write to a file.
     * @param api The API to use during compare/overwrite - must support `getContents` and `uploadBufferAsFile` functions
     * @param conflictData The required data for conflict handling
     * @returns The user's action/selection as an enum value
     */
    protected async _handleConflict<T extends Conflictable>(api: T, conflictData: LocalConflict): Promise<ConflictViewSelection> {
        const conflictOptions = [localize("conflict.compareFiles", "Compare"), localize("conflict.overwrite", "Overwrite")];
        const userSelection = await Gui.errorMessage(
            "There is a newer version of this file on the mainframe. Compare with remote contents or overwrite?",
            {
                items: conflictOptions,
            }
        );
        if (userSelection == null) {
            return ConflictViewSelection.UserDismissed;
        }

        // User selected "Compare", show diff with local contents and LPAR contents
        if (userSelection === conflictOptions[0]) {
            // Fetch the file contents on the LPAR and stream the data into an array
            const bufBuilder = new BufferBuilder();
            const resp = await api.getContents(conflictData.fsEntry.metadata.path, {
                returnEtag: true,
                encoding: conflictData.fsEntry.metadata.profile?.profile?.encoding,
                responseTimeout: conflictData.fsEntry.metadata.profile?.profile?.responseTimeout,
                stream: bufBuilder,
            });

            const mainframeBuf = bufBuilder.read();
            const conflictUri = await this._buildConflictUri(conflictData);

            // Add this conflict file to the conflict map so we can leverage the data
            // when the "action buttons" are clicked in the diff view.
            this._conflictMap[conflictData.uri.path] = conflictUri;

            // Build a "fake file" that represents the content on the mainframe,
            // for use with vscode.diff
            await vscode.workspace.fs.writeFile(conflictUri, mainframeBuf);

            const conflictEntry = this._lookupAsFile(conflictUri);
            conflictEntry.isConflictFile = true;
            conflictEntry.inDiffView = true;
            conflictEntry.conflictData = conflictEntry.data;
            conflictEntry.permissions = vscode.FilePermission.Readonly;

            // assign newer data from local conflict for use during compare/overwrite
            conflictData.fsEntry.conflictData = conflictData.content;
            conflictData.fsEntry.inDiffView = true;
            // Set etag to latest so that latest changes are applied, regardless of its contents
            conflictData.fsEntry.etag = resp.apiResponse.etag;

            vscode.commands.executeCommand(
                "vscode.diff",
                conflictUri,
                conflictData.uri,
                `${conflictData.fsEntry.name} (Remote) ↔ ${conflictEntry.name}`
            );
            return ConflictViewSelection.Compare;
        }

        // User selected "Overwrite", overwrite LPAR contents w/ local contents
        conflictData.fsEntry.data = conflictData.content;
        await api.uploadBufferAsFile(Buffer.from(conflictData.content), conflictData.fsEntry.metadata.path);
        const newData = await api.getContents(conflictData.fsEntry.metadata.path, {
            returnEtag: true,
        });
        conflictData.fsEntry.etag = newData.apiResponse.etag;
        return ConflictViewSelection.Overwrite;
    }

    /**
     * Builds a URI representing a remote conflict.
     * @param entry A valid file entry in the provider to make a remote conflict for
     * @returns A valid URI created in the provider for the remote conflict
     */
    private async _buildConflictUri(conflictData: LocalConflict): Promise<vscode.Uri> {
        // create a temporary directory structure that points to conflicts
        // this should help with replacing contents/overwriting quickly
        const entryMetadata = conflictData.fsEntry.metadata;

        const conflictRootUri = vscode.Uri.parse(`${conflictData.uri.scheme}:/${entryMetadata.profile.name}$conflicts`);
        const conflictUri = conflictRootUri.with({
            path: path.posix.join(conflictRootUri.path, entryMetadata.path),
        });

        // ignore root slash when building split path
        const conflictDirs = conflictUri.path.substring(1).split("/");

        // remove file name and "conflict root" folder name from split path
        conflictDirs.shift();
        conflictDirs.pop();

        const rootDirEntry = this._lookup(conflictRootUri, true);
        if (rootDirEntry == null) {
            this._createDirNoMetadata(conflictRootUri);
        }

        // build dirs to match path in remote FS
        conflictDirs.reduce((parentPath, dirPart) => {
            const fullPath = path.posix.join(parentPath, dirPart);
            const subUri = conflictRootUri.with({ path: fullPath });
            const subDir = this._lookup(subUri, true);
            if (subDir == null) {
                this._createDirNoMetadata(subUri);
            }
            return fullPath;
        }, conflictRootUri.path);

        await vscode.workspace.fs.writeFile(conflictUri, new Uint8Array());
        const fileEntry = this._lookupAsFile(conflictUri);
        fileEntry.isConflictFile = true;

        return conflictUri;
    }

    /**
     * Internal VSCode function for the FileSystemProvider to fire events from the event queue
     */
    protected _fireSoon(...events: vscode.FileChangeEvent[]): void {
        this._bufferedEvents.push(...events);

        if (this._fireSoonHandle) {
            clearTimeout(this._fireSoonHandle);
        }

        this._fireSoonHandle = setTimeout(() => {
            this._emitter.fire(this._bufferedEvents);
            this._bufferedEvents.length = 0;
        }, FS_PROVIDER_DELAY);
    }

    /**
     * VScode utility functions for entries in the provider:
     */

    /**
     * Creates a directory in the provider without any metadata (profile/path).
     * @param uri The URI to create a directory for
     */
    protected _createDirNoMetadata(uri: vscode.Uri): void {
        const basename = path.posix.basename(uri.path);
        const parent = this._lookupParentDirectory(uri, false);
        const entry = new DirEntry(basename);

        parent.entries.set(entry.name, entry);
        parent.mtime = Date.now();
        parent.size += 1;
        this._fireSoon(
            { type: vscode.FileChangeType.Changed, uri: uri.with({ path: path.dirname(uri.path) }) },
            { type: vscode.FileChangeType.Created, uri }
        );
    }

    protected _lookup(uri: vscode.Uri, silent: false): IFileSystemEntry;
    protected _lookup(uri: vscode.Uri, silent: boolean): IFileSystemEntry | undefined;
    protected _lookup(uri: vscode.Uri, silent: boolean): IFileSystemEntry | undefined {
        const parts = uri.path.split("/");
        let entry: IFileSystemEntry = this.root;

        for (const part of parts) {
            if (!part) {
                continue;
            }
            let child: IFileSystemEntry | undefined;
            if (isDirectoryEntry(entry)) {
                child = entry.entries.get(part);
            }
            if (!child) {
                if (!silent) {
                    throw vscode.FileSystemError.FileNotFound(uri);
                } else {
                    return undefined;
                }
            }
            entry = child;
        }
        return entry;
    }

    protected _lookupAsDirectory(uri: vscode.Uri, silent: boolean): DirEntry {
        const entry = this._lookup(uri, silent);
        if (isDirectoryEntry(entry)) {
            return entry;
        }
        throw vscode.FileSystemError.FileNotADirectory(uri);
    }

    private createFullUriPath(uri: vscode.Uri): void {
        const segments = uri.path.split("/");
    }

    protected _lookupAsFile(uri: vscode.Uri, opts?: { silent?: boolean; buildFullPath?: boolean }): IFileEntry {
        let entry: IFileEntry;
        try {
            entry = this._lookup(uri, opts?.silent ?? false);
        } catch (err) {
            if (opts?.buildFullPath) {
                if (this._lookupParentDirectory(uri, true) == null) {
                    this.createFullUriPath(uri);
                    // At this point we need to create the whole path structure in the FSP.
                    // After the entry has been created, then we can check for its existence on the remote system.
                }
            }
        }
        if (isFileEntry(entry)) {
            return entry;
        }
        throw vscode.FileSystemError.FileIsADirectory(uri);
    }

    protected _lookupParentDirectory(uri: vscode.Uri, silent?: boolean): DirEntry {
        return this._lookupAsDirectory(
            uri.with({
                path: path.resolve(uri.path, ".."),
            }),
            silent ?? false
        );
    }
}
