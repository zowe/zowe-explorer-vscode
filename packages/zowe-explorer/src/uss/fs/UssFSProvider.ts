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

import { Gui } from "@zowe/zowe-explorer-api";
import * as path from "path";
import * as vscode from "vscode";
import { ZoweExplorerApiRegister } from "../../ZoweExplorerApiRegister";
import { UssFileTree, UssFileType } from "../FileStructure";
import { getInfoForUri, isDirectoryEntry } from "../../abstract/fs/utils";
import * as nls from "vscode-nls";

// Set up localization
import { UssDirectory, UssFile } from "./types";
import { BufferBuilder, ConflictViewSelection, EntryMetadata } from "../../abstract/fs/types";
import { BaseProvider } from "../../abstract/fs/BaseProvider";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

export type Entry = UssFile | UssDirectory;

export class UssFSProvider extends BaseProvider implements vscode.FileSystemProvider {
    // Event objects for provider

    private static inst: UssFSProvider;
    private constructor() {
        super();
        this.root = new UssDirectory("");
    }

    /**
     * @returns the USS FileSystemProvider singleton instance
     */
    public static get instance(): UssFSProvider {
        if (!UssFSProvider.inst) {
            UssFSProvider.inst = new UssFSProvider();
        }

        return UssFSProvider.inst;
    }

    /* Public functions: File operations */

    /**
     * Returns file statistics about a given URI.
     * @param uri A URI that must exist as an entry in the provider
     * @returns A structure containing file type, time, size and other metrics
     */
    public stat(uri: vscode.Uri): vscode.FileStat {
        return this._lookup(uri, false);
    }

    /**
     * Moves an entry in the file system, both remotely and within the provider.
     * @param oldUri The old, source URI pointing to an entry that needs moved
     * @param newUri The new, destination URI for the file or folder
     * @returns Whether the move operation was successful
     */
    public async move(oldUri: vscode.Uri, newUri: vscode.Uri): Promise<boolean> {
        const info = this._getInfoFromUri(newUri);
        const ussApi = ZoweExplorerApiRegister.getUssApi(info.profile);
        const oldInfo = this._getInfoFromUri(oldUri);

        if (!ussApi.move) {
            Gui.errorMessage(localize("uss.unsupported.move", "The 'move' function is not implemented for this USS API."));
            return false;
        }

        await ussApi.move(oldInfo.path, info.path);
        await this._relocateEntry(oldUri, newUri, info.path);
        return true;
    }

    /**
     * Removes a local entry from the FS provider if it exists, without making any API requests.
     * @param uri The URI pointing to a local entry in the FS provider
     */
    public removeEntryIfExists(uri: vscode.Uri): void {
        const parentPath = path.posix.resolve(uri.path, "..");
        const parentEntry = this._lookupAsDirectory(
            uri.with({
                path: parentPath,
            }),
            true
        );
        if (parentEntry == null) {
            return;
        }

        parentEntry.entries.delete(path.posix.basename(uri.path));
        this._fireSoon({ type: vscode.FileChangeType.Deleted, uri: uri });
    }

    /**
     * Reads a directory located at the given URI.
     * @param uri A valid URI within the provider
     * @returns An array of tuples containing each entry name and type
     */
    public async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        /**
         * TODOs:
         * - Look into pre-fetching a directory level below the one given
         * - Should we support symlinks and can we use z/OSMF "report" option?
         */
        const entry = this._lookupAsDirectory(uri, false);

        const result: [string, vscode.FileType][] = [];
        if (!entry.wasAccessed && entry !== this.root) {
            // if this entry has not been accessed before, grab its file list
            const response = await ZoweExplorerApiRegister.getUssApi(entry.metadata.profile).fileList(entry.metadata.path);
            for (const item of response.apiResponse.items) {
                if (item.name === "." || item.name === "..") {
                    continue;
                }

                const isDirectory = item.mode.startsWith("d");
                const newEntryType = isDirectory ? vscode.FileType.Directory : vscode.FileType.File;
                const entryExists = entry.entries.get(item.name);
                // skip over entries that are of the same type
                if (entryExists && entryExists.type === newEntryType) {
                    continue;
                }

                // create new entries for any files/folders not in the provider
                if (item.mode.startsWith("d")) {
                    entry.entries.set(item.name, new UssDirectory(item.name));
                } else {
                    entry.entries.set(item.name, new UssFile(item.name));
                }
            }
        }

        for (const [name, child] of entry.entries) {
            result.push([name, child.type]);
        }
        return result;
    }

    /**
     * Fetches a file from the remote system at the given URI.
     * @param uri The URI pointing to a valid file to fetch from the remote system
     * @param editor (optional) An editor instance to reload if the URI is already open
     */
    public async fetchFileAtUri(uri: vscode.Uri, editor?: vscode.TextEditor | null): Promise<void> {
        const file = this._lookupAsFile(uri, false);
        const uriInfo = getInfoForUri(uri);
        // we need to fetch the contents from the mainframe since the file hasn't been accessed yet
        const bufBuilder = new BufferBuilder();
        const filePath = uri.path.substring(uriInfo.slashAfterProfilePos + 1);
        const metadata = file.metadata ?? this._getInfoFromUri(uri);
        const resp = await ZoweExplorerApiRegister.getUssApi(metadata.profile).getContents(filePath, {
            returnEtag: true,
            encoding: metadata.profile.profile?.encoding,
            responseTimeout: metadata.profile.profile?.responseTimeout,
            stream: bufBuilder,
        });

        file.data = bufBuilder.read() ?? new Uint8Array();
        file.etag = resp.apiResponse.etag;
        if (editor) {
            // This is a hacky method and does not work for editors that aren't the active one,
            // so we can make VSCode switch the active document to that tab and then "revert the file" to show latest contents
            await vscode.commands.executeCommand("vscode.open", uri);
            // Note that the command only affects files that are not dirty
            // TODO: find a better method to reload editor tab with new contents
            vscode.commands.executeCommand("workbench.action.files.revert");
        }
    }

    /**
     * Reads a file at the given URI and fetches it from the remote system (if not yet accessed).
     * @param uri The URI pointing to a valid file on the remote system
     * @returns The file's contents as an array of bytes
     */
    public async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        const file = this._lookupAsFile(uri, false);
        const profInfo = getInfoForUri(uri);

        if (!file.isConflictFile && profInfo.profile == null) {
            // TODO: We might be able to support opening these links outside of Zowe Explorer,
            // but at the moment, the session must be initialized first within the USS tree
            throw vscode.FileSystemError.FileNotFound(localize("localize.uss.profileNotFound", "Profile does not exist for this file."));
        }

        // we need to fetch the contents from the mainframe if the file hasn't been accessed yet
        if (!file.wasAccessed) {
            await this.fetchFileAtUri(uri);
            file.wasAccessed = true;
        }

        return file.data;
    }

    public exists(uri: vscode.Uri): boolean {
        const entry = this._lookup(uri, true);
        return entry != null;
    }

    /**
     * Attempts to write a file at the given URI.
     * @param uri The URI pointing to a file entry that should be written
     * @param content The content to write to the file, as an array of bytes
     * @param options Options for writing the file
     * - `create` - Creates the file if it does not exist
     * - `overwrite` - Overwrites the content if the file exists
     * - `forceUpload` - (optional) Forces an upload to the remote system even if the e-tag is out of date
     * - `isConflict` - (optional) Whether the file to write is considered a "remote conflict" entry
     * @returns
     */
    public async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean }): Promise<void> {
        const basename = path.posix.basename(uri.path);
        const parent = this._lookupParentDirectory(uri);
        let entry = parent.entries.get(basename);
        if (isDirectoryEntry(entry)) {
            throw vscode.FileSystemError.FileIsADirectory(uri);
        }
        if (!entry && !options.create) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        if (entry && options.create && !options.overwrite) {
            throw vscode.FileSystemError.FileExists(uri);
        }

        if (!entry) {
            entry = new UssFile(basename);
            entry.data = content;
            const profInfo = parent.metadata
                ? {
                      profile: parent.metadata.profile,
                      path: parent.metadata.path.concat(`${basename}`),
                  }
                : this._getInfoFromUri(uri);
            entry.metadata = profInfo;
            parent.entries.set(basename, entry);
            this._fireSoon({ type: vscode.FileChangeType.Created, uri });
        } else if (entry.isConflictFile) {
            entry.data = content;
        } else {
            if (entry.inDiffView) {
                // Allow users to edit files in diff view.
                // If in diff view, we don't want to make any API calls, just keep track of latest
                // changes to data.
                entry.conflictData = content;
                return;
            }
            const ussApi = ZoweExplorerApiRegister.getUssApi(parent.metadata.profile);

            if (entry.wasAccessed || content.length > 0) {
                // Entry was already accessed, this is an update to the existing file.
                // Note that we don't want to call the API when making changes to the conflict file,
                // because the conflict file serves as the "remote" point of reference at the time of conflict,
                // and provides the data when comparing local/remote versions of a file.

                // Attempt to write data to remote system, and handle any conflicts from e-tag mismatch
                try {
                    await ussApi.uploadBufferAsFile(Buffer.from(content), entry.metadata.path, {
                        etag: entry.forceUpload ? undefined : entry.etag,
                        returnEtag: true,
                    });

                    // Update e-tag if write was successful
                    // TODO: This call below can be removed once zowe.Upload.bufferToUssFile returns response headers.
                    // This is necessary at the moment on z/OSMF to fetch the new e-tag.
                    const newData = await ussApi.getContents(entry.metadata.path, {
                        returnEtag: true,
                    });
                    entry.etag = newData.apiResponse.etag;
                } catch (err) {
                    if (err.message.includes("Rest API failure with HTTP(S) status 412")) {
                        if (
                            (await this._handleConflict(ussApi, {
                                content: content,
                                fsEntry: entry,
                                uri: uri,
                            })) != ConflictViewSelection.Overwrite
                        ) {
                            return;
                        }
                    } else {
                        return;
                    }
                }

                entry.data = content;
            } else {
                entry.data = content;
            }
            // if the entry hasn't been accessed yet, we don't need to call the API since we are just creating the file
        }

        entry.mtime = Date.now();
        entry.size = content.byteLength;
        this._fireSoon({ type: vscode.FileChangeType.Changed, uri });
    }

    /**
     * Attempts to rename an entry from the old, source URI to the new, destination URI.
     * @param oldUri The source URI of the file/folder
     * @param newUri The destination URI of the file/folder
     * @param options Options for renaming the file/folder
     * - `overwrite` - Overwrites the file if the new URI already exists
     */
    public async rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): Promise<void> {
        if (!options.overwrite && this._lookup(newUri, true)) {
            throw vscode.FileSystemError.FileExists(newUri);
        }

        const entry = this._lookup(oldUri, false);
        const oldParent = this._lookupParentDirectory(oldUri);

        const newParent = this._lookupParentDirectory(newUri);
        const newName = path.posix.basename(newUri.path);

        oldParent.entries.delete(entry.name);
        entry.name = newName;

        // Build the new path using the previous path and new file/folder name.
        const isDir = entry instanceof UssDirectory;
        const entryPath = isDir ? entry.metadata.path.slice(0, -1) : entry.metadata.path;
        const lastSlashInPath = entryPath.lastIndexOf("/");
        const newPath = entryPath.substring(0, lastSlashInPath + 1).concat(newName);

        try {
            await ZoweExplorerApiRegister.getUssApi(entry.metadata.profile).rename(entry.metadata.path, newPath);
            entry.metadata.path = newPath;
            // We have to update the path for all child entries if they exist in the FileSystem
            // This way any further API requests in readFile will use the latest paths on the LPAR
            if (entry instanceof UssDirectory) {
                this._updateChildPaths(entry);
            }
        } catch (err) {
            // TODO: error handling
        }
        newParent.entries.set(newName, entry);

        this._fireSoon({ type: vscode.FileChangeType.Deleted, uri: oldUri }, { type: vscode.FileChangeType.Created, uri: newUri });
    }

    /**
     * Deletes a file or folder at the given URI.
     * @param uri The URI that points to the file/folder to delete
     */
    public async delete(uri: vscode.Uri, _options: { recursive: boolean }): Promise<void> {
        const dirname = uri.with({ path: path.posix.dirname(uri.path) });
        const basename = path.posix.basename(uri.path);
        const parent = this._lookupAsDirectory(dirname, false);

        // Throw an error if the entry does not exist
        if (!parent.entries.has(basename)) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }

        // get the entry data before deleting the URI
        const entryToDelete = this._lookup(uri, false);

        parent.entries.delete(basename);
        parent.mtime = Date.now();
        parent.size -= 1;

        // don't send API request when the deleted entry is a conflict
        if (entryToDelete instanceof UssFile && entryToDelete.isConflictFile) {
            this._fireSoon({ type: vscode.FileChangeType.Changed, uri: dirname }, { uri, type: vscode.FileChangeType.Deleted });
            return;
        }

        await ZoweExplorerApiRegister.getUssApi(parent.metadata.profile).delete(entryToDelete.metadata.path, entryToDelete instanceof UssDirectory);

        this._fireSoon({ type: vscode.FileChangeType.Changed, uri: dirname }, { uri, type: vscode.FileChangeType.Deleted });
    }

    // public copy(source: vscode.Uri, destination: vscode.Uri, options: { readonly overwrite: boolean; }): void | Thenable<void> {
    //     return this.copyEx(source, destination, options);
    // }

    /**
     * Copy a file/folder from a source URI to destination URI.
     * @param source The source URI for the file/folder to copy
     * @param destination The new, destination URI for the file/folder
     * @param options Options for copying the file/folder
     * - `overwrite` - Overwrites the entry at the destination URI if it exists
     * - `tree` - A tree representation of the file structure to copy
     * @returns
     */
    public async copyEx(
        source: vscode.Uri,
        destination: vscode.Uri,
        options: { readonly overwrite: boolean; readonly tree: UssFileTree }
    ): Promise<void> {
        const destInfo = this._getInfoFromUri(destination);
        const sourceInfo = this._getInfoFromUri(source);
        const api = ZoweExplorerApiRegister.getUssApi(destInfo.profile);

        const hasCopyApi = api.copy != null;

        const apiResponse = await api.fileList(destInfo.path);
        const fileList = apiResponse.apiResponse?.items;

        // Check root path for conflicts before pasting nodes in this path
        let fileName = path.basename(sourceInfo.path);
        if (fileList?.find((file) => file.name === fileName) != null) {
            // If file names match, build the copy suffix
            let dupCount = 1;
            const extension = path.extname(fileName);
            const baseNameForFile = path.parse(fileName)?.name;
            let dupName = `${baseNameForFile} (${dupCount})${extension}`;
            while (fileList.find((file) => file.name === dupName) != null) {
                dupCount++;
                dupName = `${baseNameForFile} (${dupCount})${extension}`;
            }
            fileName = dupName;
        }
        const outputPath = `${destInfo.path}/${fileName}`;

        if (hasCopyApi && sourceInfo.profile.profile === destInfo.profile.profile) {
            await api.copy(outputPath, {
                from: sourceInfo.path,
                recursive: options.tree.type === UssFileType.Directory,
                overwrite: options.overwrite ?? true,
            });
        } else if (options.tree.type === UssFileType.Directory) {
            // Not all APIs respect the recursive option, so it's best to
            // recurse within this operation to avoid missing files/folders
            await api.create(outputPath, "directory");
            if (options.tree.children) {
                for (const child of options.tree.children) {
                    await this.copyEx(child.localUri, vscode.Uri.parse(`zowe-uss:${outputPath}`), { ...options, tree: child });
                }
            }
        } else {
            const fileEntry = this._lookup(source, true);
            if (fileEntry == null) {
                return;
            }

            if (!fileEntry.wasAccessed) {
                // must fetch contents of file first before pasting in new path
                const fileContents = await vscode.workspace.fs.readFile(source);
                await api.uploadBufferAsFile(Buffer.from(fileContents), outputPath);
            }
        }
    }

    /**
     * Creates a directory entry in the provider at the given URI.
     * @param uri The URI that represents a new directory path
     */
    public createDirectory(uri: vscode.Uri): void {
        const basename = path.posix.basename(uri.path);
        const dirname = uri.with({ path: path.posix.dirname(uri.path) });
        const parent = this._lookupAsDirectory(dirname, false);
        const profInfo = parent.metadata
            ? {
                  profile: parent.metadata.profile,
                  // we can strip profile name from path because its not involved in API calls
                  path: parent.metadata.path.concat(`${basename}/`),
              }
            : this._getInfoFromUri(uri);

        const entry = new UssDirectory(basename);
        entry.metadata = profInfo;
        parent.entries.set(entry.name, entry);
        parent.mtime = Date.now();
        parent.size += 1;
        this._fireSoon({ type: vscode.FileChangeType.Changed, uri: dirname }, { type: vscode.FileChangeType.Created, uri });
    }

    public watch(_resource: vscode.Uri, options: { readonly recursive: boolean; readonly excludes: readonly string[] }): vscode.Disposable {
        // ignore, fires for all changes...
        return new vscode.Disposable(() => {});
    }

    /* Begin private functions */

    /**
     * Returns metadata about the file entry from the context of z/OS.
     * @param uri A URI with a path in the format `zowe-uss:/{lpar_name}/{full_path}?`
     * @returns Metadata for the URI that contains the profile instance and USS path
     */
    private _getInfoFromUri(uri: vscode.Uri): EntryMetadata {
        const uriInfo = getInfoForUri(uri);
        return { profile: uriInfo.profile, path: uriInfo.isRoot ? "/" : uri.path.substring(uriInfo.slashAfterProfilePos) };
    }

    /**
     * Relocates an entry in the provider from `oldUri` to `newUri`.
     * @param oldUri The old, source URI in the provider that needs moved
     * @param newUri The new, destination URI for the file or folder
     * @param newUssPath The new path for this entry in USS
     */
    private async _relocateEntry(oldUri: vscode.Uri, newUri: vscode.Uri, newUssPath: string): Promise<void> {
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
        if (entry instanceof UssFile) {
            // put new contents in relocated file
            await this.writeFile(newUri, entry.data, { create: true, overwrite: true });
            const newEntry = this._lookupAsFile(newUri, false);
            newEntry.etag = entry.etag;
        } else {
            // create directory in FS; when expanded in the tree, it will fetch any files
            this.createDirectory(newUri);
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

    /* end conflict management utils */

    /**
     * Update the child entries in the provider with the parent's updated entry.
     * @param entry The parent directory whose children need updated
     */
    private _updateChildPaths(entry: UssDirectory): void {
        // update child entries
        for (const child of entry.entries.values()) {
            const isDir = child instanceof UssDirectory;
            child.metadata.path = entry.metadata.path.concat(`${child.name}${isDir ? "/" : ""}`);
            if (isDir) {
                this._updateChildPaths(child);
            }
        }
    }
}
