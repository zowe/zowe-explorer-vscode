import * as vscode from "vscode";
import { DirEntry, FileEntry, FsEntry, FS_PROVIDER_DELAY, ConflictViewSelection, BufferBuilder, LocalConflict, Conflictable } from "./types";
import * as path from "path";
import { isEqual } from "lodash";
import { isDirectoryEntry, isFileEntry } from "./utils";
import { Gui } from "@zowe/zowe-explorer-api";
import * as globals from "../../globals";
import * as nls from "vscode-nls";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

export class BaseProvider {
    protected _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    protected _bufferedEvents: vscode.FileChangeEvent[] = [];
    protected _fireSoonHandle?: NodeJS.Timeout;

    public readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

    // map remote conflict URIs to local URIs
    protected _conflictMap: Record<string, vscode.Uri> = {};
    protected root: DirEntry;

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
        const localEntry = this._lookupAsFile(localUri, false);
        localEntry.inDiffView = false;
        localEntry.forceUpload = true;
        await vscode.workspace.fs.writeFile(localUri, localEntry.conflictData);
        Gui.setStatusBarMessage(localize("uss.overwritten", "$(check) Overwrite applied for {0}", localEntry.name), globals.MS_PER_SEC * 4);
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
        const localEntry = this._lookupAsFile(localUri, false);
        const remoteEntry = this._lookupAsFile(remoteUri, false);

        // If the data in the diff is different from the conflict data, we need to make another API request to push those changes.
        // If the data is equal, we can just assign the data in the FileSystem and avoid making an API request.
        localEntry.wasAccessed = remoteEntry.data.length === remoteEntry.conflictData.length && isEqual(remoteEntry.data, remoteEntry.conflictData);
        localEntry.inDiffView = false;
        await vscode.workspace.fs.writeFile(localUri, localEntry.conflictData);
        Gui.setStatusBarMessage(localize("uss.usedRemoteContent", "$(discard) Used remote content for {0}", localEntry.name), globals.MS_PER_SEC * 4);
        localEntry.conflictData = null;
        this._removeConflictAndCloseDiff(remoteUri);
        // this will refresh the active editor with the remote content that was saved to the file
        vscode.commands.executeCommand("workbench.action.files.revert");
    }

    /**
     * Utility functions for conflict management:
     */

    /**
     * Handles the conflict that occurred while trying to write to a USS file.
     * @param ussApi The USS API to use during compare/overwrite
     * @param conflictData The required data for conflict handling
     * @returns The user's action/selection as an enum value
     */
    protected async _handleConflict<T extends Conflictable>(api: T, conflictData: LocalConflict): Promise<ConflictViewSelection> {
        const conflictOptions = [localize("compare.file", "Compare"), localize("compare.overwrite", "Overwrite")];
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
            const conflictUri = await this._buildConflictUri(conflictData.fsEntry);

            // Add this conflict file to the conflict map so we can leverage the data
            // when the "action buttons" are clicked in the diff view.
            this._conflictMap[conflictData.uri.path] = conflictUri;

            // Build a "fake file" that represents the content on the mainframe,
            // for use with vscode.diff
            await vscode.workspace.fs.writeFile(conflictUri, mainframeBuf);

            const conflictEntry = this._lookupAsFile(conflictUri, false);
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
    private async _buildConflictUri(entry: FileEntry): Promise<vscode.Uri> {
        // create a temporary directory structure that points to conflicts
        // this should help with replacing contents/overwriting quickly
        const conflictRootUri = vscode.Uri.parse(`zowe-uss:/${entry.metadata.profile.name}$conflicts`);
        const conflictUri = conflictRootUri.with({
            path: path.posix.join(conflictRootUri.path, entry.metadata.path),
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
        const fileEntry = this._lookupAsFile(conflictUri, false);
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
     * Creates a directory in the provider without any metadata (profile/USS path).
     * @param uri The URI to create a directory for
     */
    protected _createDirNoMetadata(uri: vscode.Uri): void {
        const basename = path.posix.basename(uri.path);
        const dirname = uri.with({ path: path.posix.dirname(uri.path) });
        const parent = this._lookupAsDirectory(dirname, false);
        const entry = new DirEntry(basename);

        parent.entries.set(entry.name, entry);
        parent.mtime = Date.now();
        parent.size += 1;
        this._fireSoon({ type: vscode.FileChangeType.Changed, uri: dirname }, { type: vscode.FileChangeType.Created, uri });
    }

    protected _lookup(uri: vscode.Uri, silent: false): FsEntry;
    protected _lookup(uri: vscode.Uri, silent: boolean): FsEntry | undefined;
    protected _lookup(uri: vscode.Uri, silent: boolean): FsEntry | undefined {
        const parts = uri.path.split("/");
        let entry: FsEntry = this.root;

        for (const part of parts) {
            if (!part) {
                continue;
            }
            let child: FsEntry | undefined;
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

    protected _lookupAsFile(uri: vscode.Uri, silent: boolean): FileEntry {
        const entry = this._lookup(uri, silent);
        if (isFileEntry(entry)) {
            return entry;
        }
        throw vscode.FileSystemError.FileIsADirectory(uri);
    }

    protected _lookupParentDirectory(uri: vscode.Uri): DirEntry {
        const dirname = uri.with({ path: path.posix.dirname(uri.path) });
        return this._lookupAsDirectory(dirname, false);
    }
}
