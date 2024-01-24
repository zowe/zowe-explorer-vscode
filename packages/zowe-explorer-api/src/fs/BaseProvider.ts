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
    FileEntry,
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
import { getInfoForUri, isDirectoryEntry, isFileEntry } from "./utils";
import { Gui } from "../globals/Gui";
import * as nls from "vscode-nls";
import { ZoweVsCodeExtension } from "../vscode";
import { ProfilesCache } from "../profiles";

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

    protected _profilesCache: ProfilesCache;

    public readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;
    protected root: DirEntry;
    public openedUris: vscode.Uri[] = [];

    protected constructor(profilesCache?: ProfilesCache) {
        this._profilesCache = profilesCache ?? ZoweVsCodeExtension.profilesCache;
    }

    /**
     * Action for overwriting the remote contents with local data from the provider.
     * @param remoteUri The "remote conflict" URI shown in the diff view
     */
    public async diffOverwrite(uri: vscode.Uri): Promise<void> {
        const fsEntry = await this._lookupAsFile(uri);
        await vscode.workspace.fs.writeFile(uri.with({ query: "forceUpload=true" }), fsEntry.localData ?? fsEntry.data);
        Gui.setStatusBarMessage(localize("diff.overwritten", "$(check) Overwrite applied for {0}", fsEntry.name), this.FS_PROVIDER_UI_TIMEOUT);
        fsEntry.conflictData = null;
    }

    /**
     * Action for replacing the local data in the provider with remote contents.
     * @param localUri The local URI shown in the diff view
     */
    public async diffUseRemote(uri: vscode.Uri): Promise<void> {
        const fsEntry = await this._lookupAsFile(uri);

        // If the data in the diff is different from the conflict data, we need to make another API request to push those changes.
        // If the data is equal, we can just assign the data in the FileSystem and avoid making an API request.
        const isDataEqual = isEqual(fsEntry.data, fsEntry.conflictData.contents);
        if (!isDataEqual) {
            await vscode.workspace.fs.writeFile(uri.with({ query: "forceUpload=true" }), fsEntry.conflictData.contents);
        }
        Gui.setStatusBarMessage(
            localize("diff.usedRemoteContent", "$(discard) Used remote content for {0}", fsEntry.name),
            this.FS_PROVIDER_UI_TIMEOUT
        );
        fsEntry.conflictData = null;
        vscode.commands.executeCommand("workbench.action.closeActiveEditor");
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
        if (!isFileEntry(entry)) {
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
            const newEntry = await this._lookupAsFile(newUri);
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
            parentUri: uri.with({ path: path.posix.resolve(uri.path, "..") }),
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
    protected async _handleConflict(uri: vscode.Uri, entry: FileEntry): Promise<ConflictViewSelection> {
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
            // Add this file to the conflict map so we can quickly leverage the data
            // when the "action buttons" are clicked in the diff view.

            const onCloseEvent = async (provider: BaseProvider, e: vscode.TextDocument): Promise<void> => {
                if (e.uri.query && e.uri.scheme.startsWith("zowe-")) {
                    const queryParams = new URLSearchParams(e.uri.query);
                    if (queryParams.has("conflict")) {
                        const fsEntry = await provider._lookupAsFile(e.uri, { silent: true });
                        if (fsEntry) {
                            fsEntry.inDiffView = false;
                        }
                    }
                }
            };
            vscode.workspace.onDidCloseTextDocument(onCloseEvent.bind(this));
            vscode.commands.executeCommand(
                "vscode.diff",
                uri.with({ query: "conflict=true" }),
                uri.with({ query: "inDiff=true" }),
                `${entry.name} (Remote) ↔ ${entry.name}`
            );
            return ConflictViewSelection.Compare;
        }

        await this.diffOverwrite(uri);
        return ConflictViewSelection.Overwrite;
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

    protected _createFile(uri: vscode.Uri, options?: { overwrite: boolean }): FileEntry {
        const basename = path.posix.basename(uri.path);
        const parent = this._lookupParentDirectory(uri);
        let entry = parent.entries.get(basename);
        if (isDirectoryEntry(entry)) {
            throw vscode.FileSystemError.FileIsADirectory(uri);
        }
        if (entry) {
            if (options.overwrite ?? false) {
                throw vscode.FileSystemError.FileExists(uri);
            } else {
                return entry;
            }
        }

        entry = new FileEntry(basename);
        entry.data = new Uint8Array();
        const filePath = parent.metadata.path.concat(basename);
        const profInfo = parent.metadata
            ? { ...parent.metadata, path: filePath }
            : { profile: getInfoForUri(uri, this._profilesCache).profile, path: filePath };
        entry.metadata = profInfo;
        parent.entries.set(basename, entry);
        this._fireSoon({ type: vscode.FileChangeType.Created, uri });
        return entry;
    }

    private async buildTreeForUri(uri: vscode.Uri): Promise<void> {
        const segments = uri.path.split("/");
        let currentNode: DirEntry | FileEntry = this.root;

        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            if (segment.length == 0) {
                continue;
            }

            if (isFileEntry(currentNode)) {
                // we've reached the file entry and its valid, can stop here
                return;
            }

            const currentPath = path.posix.join("/", ...segments.slice(0, i + 1));
            const currentUri = uri.with({ path: currentPath });

            if (!currentNode.entries.has(segment)) {
                if (i == segments.length - 1) {
                    // File segment
                    this._createFile(currentUri);
                    return;
                } else {
                    // Folder
                    await vscode.workspace.fs.createDirectory(currentUri);
                }
            }

            currentNode = currentNode.entries.get(segment);
        }
    }

    protected async _lookupAsFile(uri: vscode.Uri, opts?: { silent?: boolean; buildFullPath?: boolean }): Promise<FileEntry> {
        let entry: IFileSystemEntry;
        try {
            entry = this._lookup(uri, opts?.silent ?? false);
        } catch (err) {
            if (opts?.buildFullPath) {
                // At this point we need to create the whole path structure in the FSP.
                await this.buildTreeForUri(uri);
                // After the entry has been created, then we can check for its existence on the remote system.
                entry = this._lookup(uri, opts?.silent ?? false);
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
                path: path.posix.resolve(uri.path, ".."),
            }),
            silent ?? false
        );
    }
}
