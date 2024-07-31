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
import { DirEntry, FileEntry, IFileSystemEntry, FS_PROVIDER_DELAY, ConflictViewSelection, DeleteMetadata } from "./types";
import * as path from "path";
import { FsAbstractUtils } from "./utils";
import { Gui } from "../globals/Gui";
import { ZosEncoding } from "../tree";

export class BaseProvider {
    // eslint-disable-next-line no-magic-numbers
    private readonly FS_PROVIDER_UI_TIMEOUT = 4000;

    protected _onDidChangeFileEmitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    protected _bufferedEvents: vscode.FileChangeEvent[] = [];
    protected _fireSoonHandle?: NodeJS.Timeout;

    public onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._onDidChangeFileEmitter.event;
    protected root: DirEntry;
    public openedUris: vscode.Uri[] = [];

    protected constructor() {}

    /**
     * Compares the data for 2 Uint8Arrays, byte by byte.
     * @param a The first Uint8Array to compare
     * @param b The second Uint8Array to compare
     * @returns `true` if the arrays are equal, `false` otherwise
     */
    public static areContentsEqual(a: Uint8Array, b: Uint8Array): boolean {
        return a.byteLength === b.byteLength && a.every((byte, i) => byte === b[i]);
    }

    /**
     * Action for overwriting the remote contents with local data from the provider.
     * @param remoteUri The "remote conflict" URI shown in the diff view
     */
    public async diffOverwrite(uri: vscode.Uri): Promise<void> {
        const fsEntry = this._lookupAsFile(uri);
        if (fsEntry == null) {
            return;
        }
        await vscode.workspace.fs.writeFile(uri.with({ query: "forceUpload=true" }), fsEntry.data);
        Gui.setStatusBarMessage(
            vscode.l10n.t({
                message: "$(check) Overwrite applied for {0}",
                args: [fsEntry.name],
                comment: "File name",
            }),
            this.FS_PROVIDER_UI_TIMEOUT
        );
        fsEntry.conflictData = null;
        vscode.commands.executeCommand("workbench.action.closeActiveEditor");
    }

    /**
     * Action for replacing the local data in the provider with remote contents.
     * @param localUri The local URI shown in the diff view
     */
    public async diffUseRemote(uri: vscode.Uri): Promise<void> {
        const fsEntry = this._lookupAsFile(uri);
        if (fsEntry == null) {
            return;
        }

        // If the data in the diff is different from the conflict data, we need to make another API request to push those changes.
        // If the data is equal, we can just assign the data in the FileSystem and avoid making an API request.
        const isDataEqual = BaseProvider.areContentsEqual(fsEntry.data, fsEntry.conflictData.contents);
        if (!isDataEqual) {
            await vscode.workspace.fs.writeFile(uri.with({ query: "forceUpload=true" }), fsEntry.conflictData.contents);
        }
        Gui.setStatusBarMessage(
            vscode.l10n.t({
                message: "$(discard) Used remote content for {0}",
                args: [fsEntry.name],
                comment: "File name",
            }),
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
    public removeEntry(uri: vscode.Uri): boolean {
        const parentEntry = this._lookupParentDirectory(uri, true);
        if (parentEntry == null) {
            return false;
        }

        const entryName = path.posix.basename(uri.path);
        if (!parentEntry.entries.has(entryName)) {
            return false;
        }

        parentEntry.entries.delete(entryName);
        this._fireSoon({ type: vscode.FileChangeType.Deleted, uri: uri });
        return true;
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
    public invalidateFileAtUri(uri: vscode.Uri): boolean {
        const entry = this._lookup(uri, true);
        if (!FsAbstractUtils.isFileEntry(entry)) {
            return false;
        }

        entry.data = null;
        entry.wasAccessed = false;
        this.openedUris = this.openedUris.filter((u) => u !== uri);
        return true;
    }

    /**
     * Invalidates the data for a directory entry at a given URI.
     * Also removes the URI from the opened URI cache.
     * @param uri the URI whose data should be invalidated
     */
    public invalidateDirAtUri(uri: vscode.Uri): boolean {
        const entry = this._lookup(uri, true);
        if (!FsAbstractUtils.isDirectoryEntry(entry)) {
            return false;
        }

        entry.entries.clear();
        this._lookupParentDirectory(uri).entries.delete(entry.name);
        return true;
    }

    /**
     * Returns the encoding for a file entry matching the given URI.
     * @param uri The URI that corresponds to an existing file entry
     * @returns The encoding for the file
     */
    public getEncodingForFile(uri: vscode.Uri): ZosEncoding {
        const entry = this._lookup(uri, false) as FileEntry | DirEntry;
        if (FsAbstractUtils.isDirectoryEntry(entry)) {
            return undefined;
        }

        return entry.encoding;
    }

    /**
     * Sets the encoding for a file entry matching the given URI.
     * @param uri The URI that corresponds to an existing file entry
     * @param encoding The new encoding for the file entry
     */
    public setEncodingForFile(uri: vscode.Uri, encoding: ZosEncoding): void {
        const fileEntry = this._lookupAsFile(uri);
        fileEntry.encoding = encoding;
    }

    /**
     * Triggers an update for the resource at the given URI to show its latest changes in the editor.
     * @param uri The URI that is open in an editor tab
     */
    protected async _updateResourceInEditor(uri: vscode.Uri): Promise<void> {
        const entry = this._lookup(uri, true);
        if (!FsAbstractUtils.isFileEntry(entry)) {
            return;
        }
        // NOTE: This does not work for editors that aren't the active one, so...
        // Make VS Code switch to this editor, and then "revert the file" to show the latest contents
        await vscode.commands.executeCommand("vscode.open", uri);
        await BaseProvider.revertFileInEditor();
    }

    /**
     * This function is used to revert changes in the active editor.
     * It can also be used to update an editor with the newest contents of a resource.
     *
     * https://github.com/microsoft/vscode/issues/110493#issuecomment-726542367
     */
    public static async revertFileInEditor(): Promise<void> {
        await vscode.commands.executeCommand("workbench.action.files.revert");
    }

    /**
     * Update the child path metadata in the provider with the parent's updated entry (recursively).
     * @param entry The parent directory whose children need updated
     */
    protected _updateChildPaths(entry: DirEntry): void {
        // update child entries
        for (const child of entry.entries.values()) {
            child.metadata.path = path.posix.join(entry.metadata.path, child.name);
            if (FsAbstractUtils.isDirectoryEntry(child)) {
                this._updateChildPaths(child);
            }
        }
    }

    private async _reopenEditorForRelocatedUri(oldUri: vscode.Uri, newUri: vscode.Uri): Promise<void> {
        const tabGroups = vscode.window.tabGroups.all;
        const allTabs = tabGroups.reduce((acc: vscode.Tab[], group) => acc.concat(group.tabs), []);
        const tabWithOldUri = allTabs.find((t) => (t.input as any).uri.path === oldUri.path);
        if (tabWithOldUri) {
            const parent = tabGroups.find((g) => g.tabs.find((t) => t === tabWithOldUri));
            const editorCol = parent.viewColumn;
            // close old uri and reopen new uri
            await vscode.window.tabGroups.close(tabWithOldUri);
            await vscode.commands.executeCommand("vscode.openWith", newUri, "default", editorCol);
        }
    }

    /**
     * Relocates an entry in the provider from `oldUri` to `newUri`.
     * @param oldUri The old, source URI in the provider that needs moved
     * @param newUri The new, destination URI for the file or folder
     * @param newUssPath The new path for this entry in USS
     */
    protected async _relocateEntry(oldUri: vscode.Uri, newUri: vscode.Uri, newUssPath: string): Promise<void> {
        const entry = this._lookup(oldUri, true);
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
        const isFile = FsAbstractUtils.isFileEntry(entry);
        // write new entry in FS
        if (isFile) {
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
        if (isFile) {
            return this._reopenEditorForRelocatedUri(oldUri, newUri);
        }
    }

    protected _getDeleteInfo(uri: vscode.Uri): DeleteMetadata {
        const basename = path.posix.basename(uri.path);
        const parent = this._lookupParentDirectory(uri, false);

        // Throw an error if the entry does not exist
        if (!parent.entries.has(basename)) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }

        // get the entry data before deleting the URI
        const entryToDelete = this._lookup(uri, false);

        return {
            entryToDelete,
            parent,
            parentUri: uri.with({ path: path.posix.join(uri.path, "..") }),
        };
    }

    // This event removes the "diff view" flag from the local file,
    // so that API calls can continue after the conflict dialog is closed.
    private static onCloseEvent(provider: BaseProvider, e: vscode.TextDocument): void {
        if (e.uri.query && e.uri.scheme.startsWith("zowe-")) {
            const queryParams = new URLSearchParams(e.uri.query);
            if (queryParams.has("conflict")) {
                const fsEntry = provider._lookupAsFile(e.uri, { silent: true });
                if (fsEntry) {
                    fsEntry.inDiffView = false;
                }
            }
        }
    }

    /**
     * Utility functions for conflict management:
     */

    /**
     * Handles the conflict that occurred while trying to write to a file.
     * @param api The API to use during compare/overwrite - must support `getContents` and `uploadFromBuffer` functions
     * @param conflictData The required data for conflict handling
     * @returns The user's action/selection as an enum value
     */
    protected async _handleConflict(uri: vscode.Uri, entry: FileEntry): Promise<ConflictViewSelection> {
        const conflictOptions = [vscode.l10n.t("Compare"), vscode.l10n.t("Overwrite")];
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
            vscode.workspace.onDidCloseTextDocument(BaseProvider.onCloseEvent.bind(this));
            await vscode.commands.executeCommand(
                "vscode.diff",
                uri.with({ query: "conflict=true" }),
                uri.with({ query: "inDiff=true" }),
                `${entry.name} (Remote) ↔ ${entry.name}`
            );
            return ConflictViewSelection.Compare;
        }

        // User selected "Overwrite"
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
            this._onDidChangeFileEmitter.fire(this._bufferedEvents);
            this._bufferedEvents.length = 0;
        }, FS_PROVIDER_DELAY);
    }

    /**
     * VScode utility functions for entries in the provider:
     */

    protected _lookup(uri: vscode.Uri, silent: boolean = false): IFileSystemEntry | undefined {
        if (uri.path === "/") {
            return this.root;
        }

        const parts = uri.path.split("/").filter(Boolean);
        let entry: IFileSystemEntry = this.root;

        for (const part of parts) {
            if (!part) {
                continue;
            }
            let child: IFileSystemEntry | undefined;
            if (FsAbstractUtils.isDirectoryEntry(entry)) {
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
        if (!FsAbstractUtils.isDirectoryEntry(entry)) {
            throw vscode.FileSystemError.FileNotADirectory(uri);
        }

        return entry;
    }

    protected _createFile(uri: vscode.Uri, options?: { overwrite: boolean }): FileEntry {
        const basename = path.posix.basename(uri.path);
        const parent = this._lookupParentDirectory(uri);
        let entry = parent.entries.get(basename);
        if (FsAbstractUtils.isDirectoryEntry(entry)) {
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
        const profInfo = { ...parent.metadata, path: filePath };
        entry.metadata = profInfo;
        parent.entries.set(basename, entry);
        this._fireSoon({ type: vscode.FileChangeType.Created, uri });
        return entry;
    }

    protected _lookupAsFile(uri: vscode.Uri, opts?: { silent?: boolean }): FileEntry {
        const entry = this._lookup(uri, opts?.silent ?? false);
        if (FsAbstractUtils.isFileEntry(entry)) {
            return entry;
        }
        throw vscode.FileSystemError.FileIsADirectory(uri);
    }

    protected _lookupParentDirectory(uri: vscode.Uri, silent?: boolean): DirEntry {
        return this._lookupAsDirectory(
            uri.with({
                path: path.posix.join(uri.path, ".."),
            }),
            silent ?? false
        );
    }
}
