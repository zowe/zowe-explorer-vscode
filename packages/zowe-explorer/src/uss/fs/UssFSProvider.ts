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

import {
    BaseProvider,
    BufferBuilder,
    ConflictViewSelection,
    getInfoForUri,
    isDirectoryEntry,
    Gui,
    EntryMetadata,
    UriFsInfo,
} from "@zowe/zowe-explorer-api";
import * as path from "path";
import * as vscode from "vscode";
import { ZoweExplorerApiRegister } from "../../ZoweExplorerApiRegister";
import { UssFileTree, UssFileType } from "../FileStructure";
import * as nls from "vscode-nls";

// Set up localization
import { UssDirectory, UssFile } from "./types";
import { Profiles } from "../../Profiles";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

export type Entry = UssFile | UssDirectory;

export class UssFSProvider extends BaseProvider implements vscode.FileSystemProvider {
    // Event objects for provider

    private static _instance: UssFSProvider;
    private constructor() {
        super();
        this.root = new UssDirectory("");
    }

    /**
     * @returns the USS FileSystemProvider singleton instance
     */
    public static get instance(): UssFSProvider {
        if (!UssFSProvider._instance) {
            UssFSProvider._instance = new UssFSProvider();
        }

        return UssFSProvider._instance;
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
                const itemName = item.name as string;
                if (itemName.match(/^\.{1,3}$/)) {
                    continue;
                }

                const isDirectory = item.mode.startsWith("d");
                const newEntryType = isDirectory ? vscode.FileType.Directory : vscode.FileType.File;
                const entryExists = entry.entries.get(itemName);
                // skip over entries that are of the same type
                if (entryExists && entryExists.type === newEntryType) {
                    continue;
                }

                // create new entries for any files/folders not in the provider
                if (item.mode.startsWith("d")) {
                    entry.entries.set(itemName, new UssDirectory(itemName));
                } else {
                    entry.entries.set(itemName, new UssFile(itemName));
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
        const uriInfo = getInfoForUri(uri, Profiles.getInstance());
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
        const profInfo = getInfoForUri(uri, Profiles.getInstance());

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
    public async delete(uri: vscode.Uri, options: { recursive: boolean }): Promise<void> {
        const { entryToDelete, parent, parentUri } = this._deleteEntry(uri, options);

        // don't send API request when the deleted entry is a conflict
        if (entryToDelete instanceof UssFile && entryToDelete.isConflictFile) {
            this._fireSoon({ type: vscode.FileChangeType.Changed, uri: parentUri }, { uri, type: vscode.FileChangeType.Deleted });
            return;
        }

        await ZoweExplorerApiRegister.getUssApi(parent.metadata.profile).delete(entryToDelete.metadata.path, entryToDelete instanceof UssDirectory);

        this._fireSoon({ type: vscode.FileChangeType.Changed, uri: parentUri }, { uri, type: vscode.FileChangeType.Deleted });
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

    public watch(_resource: vscode.Uri, _options: { readonly recursive: boolean; readonly excludes: readonly string[] }): vscode.Disposable {
        // ignore, fires for all changes...
        return new vscode.Disposable(() => {});
    }

    /**
     * Returns metadata about the file entry from the context of z/OS.
     * @param uri A URI with a path in the format `zowe-*:/{lpar_name}/{full_path}?`
     * @returns Metadata for the URI that contains the profile instance and path
     */
    private _getInfoFromUri(uri: vscode.Uri): EntryMetadata {
        const uriInfo = getInfoForUri(uri, Profiles.getInstance());
        return { profile: uriInfo.profile, path: uriInfo.isRoot ? "/" : uri.path.substring(uriInfo.slashAfterProfilePos) };
    }
}
