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

import { BaseProvider, BufferBuilder, getInfoForUri, isDirectoryEntry, Gui, EntryMetadata, UssDirectory, UssFile } from "@zowe/zowe-explorer-api";
import * as path from "path";
import * as vscode from "vscode";

import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { UssFileTree, UssFileType } from "./FileStructure";
import { Profiles } from "../Profiles";
import * as zowe from "@zowe/cli";
export type Entry = UssFile | UssDirectory;

export class UssFSProvider extends BaseProvider implements vscode.FileSystemProvider {
    // Event objects for provider

    private static _instance: UssFSProvider;
    private constructor() {
        super(Profiles.getInstance());
        this.root = new UssDirectory();
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
        if (uri.query) {
            const queryParams = new URLSearchParams(uri.query);
            if (queryParams.has("conflict")) {
                return { ...this._lookup(uri, false), permissions: vscode.FilePermission.Readonly };
            }
        }
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

        if (!ussApi.move) {
            Gui.errorMessage(vscode.l10n.t("The 'move' function is not implemented for this USS API."));
            return false;
        }

        const oldInfo = this._getInfoFromUri(oldUri);

        await ussApi.move(oldInfo.path, info.path);
        await this._relocateEntry(oldUri, newUri, info.path);
        return true;
    }

    public async listFiles(profile: zowe.imperative.IProfileLoaded, uri: vscode.Uri): Promise<zowe.IZosFilesResponse> {
        const ussPath = uri.path.substring(uri.path.indexOf("/", 1));
        const response = await ZoweExplorerApiRegister.getUssApi(profile).fileList(ussPath);
        return {
            ...response,
            apiResponse: {
                ...response.apiResponse,
                items: (response.apiResponse.items ?? []).filter((it) => !(it.name as string).match(/^\.{1,3}$/)),
            },
        };
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
        const dir = this._lookupAsDirectory(uri, false);

        const result: [string, vscode.FileType][] = [];
        if (!dir.wasAccessed && dir !== this.root) {
            const fileList = await this.listFiles(dir.metadata.profile, uri);
            for (const item of fileList.apiResponse.items) {
                const itemName = item.name as string;

                const isDirectory = item.mode.startsWith("d");
                const newEntryType = isDirectory ? vscode.FileType.Directory : vscode.FileType.File;
                // skip over existing entries if they are the same type
                const entry = dir.entries.get(itemName);
                if (entry && entry.type === newEntryType) {
                    continue;
                }

                // create new entries for any files/folders that aren't in the provider
                const UssType = item.mode.startsWith("d") ? UssDirectory : UssFile;
                dir.entries.set(itemName, new UssType(itemName));
            }
        }

        for (const [name, child] of dir.entries) {
            result.push([name, child.type]);
        }
        return result;
    }

    /**
     * Fetches a file from the remote system at the given URI.
     * @param uri The URI pointing to a valid file to fetch from the remote system
     * @param editor (optional) An editor instance to reload if the URI is already open
     */
    public async fetchFileAtUri(uri: vscode.Uri, options?: { editor?: vscode.TextEditor | null; isConflict?: boolean }): Promise<void> {
        const file = await this._lookupAsFile(uri);
        const uriInfo = getInfoForUri(uri, Profiles.getInstance());
        const bufBuilder = new BufferBuilder();
        const filePath = uri.path.substring(uriInfo.slashAfterProfilePos);
        const metadata = file.metadata;
        const resp = await ZoweExplorerApiRegister.getUssApi(metadata.profile).getContents(filePath, {
            returnEtag: true,
            encoding: metadata.profile.profile?.encoding,
            responseTimeout: metadata.profile.profile?.responseTimeout,
            stream: bufBuilder,
        });

        const data: Uint8Array = bufBuilder.read() ?? new Uint8Array();
        if (options?.isConflict) {
            file.conflictData = {
                contents: data,
                etag: resp.apiResponse.etag,
                size: data.byteLength,
            };
        } else {
            file.data = data;
            file.etag = resp.apiResponse.etag;
            file.size = file.data.byteLength;
        }

        if (options?.editor) {
            await this._updateResourceInEditor(uri);
        }
    }

    /**
     * Reads a file at the given URI and fetches it from the remote system (if not yet accessed).
     * @param uri The URI pointing to a valid file on the remote system
     * @returns The file's contents as an array of bytes
     */
    public async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        const file = await this._lookupAsFile(uri, { silent: false });
        const profInfo = getInfoForUri(uri, Profiles.getInstance());

        if (profInfo.profile == null) {
            throw vscode.FileSystemError.FileNotFound(vscode.l10n.t("Profile does not exist for this file."));
        }

        const urlQuery = new URLSearchParams(uri.query);
        const isConflict = urlQuery.has("conflict");

        // Fetch contents from the mainframe if:
        // - the file hasn't been accessed yet
        // - fetching a conflict from the remote FS
        if (!file.wasAccessed || isConflict) {
            await this.fetchFileAtUri(uri, { isConflict });
            if (!isConflict) {
                file.wasAccessed = true;
            }
        }

        return isConflict ? file.conflictData.contents : file.data;
    }

    /**
     * Attempts to write a file at the given URI.
     * @param uri The URI pointing to a file entry that should be written
     * @param content The content to write to the file, as an array of bytes
     * @param options Options for writing the file
     * - `create` - Creates the file if it does not exist
     * - `overwrite` - Overwrites the content if the file exists
     */
    public async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean }): Promise<void> {
        const fileName = path.posix.basename(uri.path);
        const parentDir = this._lookupParentDirectory(uri);

        let entry = parentDir.entries.get(fileName);
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
            entry = new UssFile(fileName);
            // Build the metadata for the file using the parent's metadata (if available),
            // or build it using the helper function
            entry.metadata = {
                ...parentDir.metadata,
                path: parentDir.metadata.path.concat(`${fileName}`),
            };

            if (content.byteLength > 0) {
                const statusMsg = Gui.setStatusBarMessage(vscode.l10n.t("$(sync~spin) Saving USS file..."));
                // user is trying to edit a file that was just deleted: make the API call
                const ussApi = ZoweExplorerApiRegister.getUssApi(parentDir.metadata.profile);
                await ussApi.uploadBufferAsFile(Buffer.from(content), entry.metadata.path, {
                    etag: undefined,
                    returnEtag: true,
                });

                // Update e-tag if write was successful.
                // TODO: This call below can be removed once zowe.Upload.bufferToUssFile returns response headers.
                // This is necessary at the moment on z/OSMF to fetch the new e-tag.
                const newData = await ussApi.getContents(entry.metadata.path, {
                    returnEtag: true,
                });
                entry.etag = newData.apiResponse.etag;
                statusMsg.dispose();
            }
            entry.data = content;
            parentDir.entries.set(fileName, entry);
            this._fireSoon({ type: vscode.FileChangeType.Created, uri });
        } else {
            const urlQuery = new URLSearchParams(uri.query);
            const shouldForceUpload = urlQuery.has("forceUpload");

            if (entry.inDiffView || urlQuery.has("inDiff")) {
                // Allow users to edit the local copy of a file in the diff view, but don't make any API calls.
                entry.inDiffView = true;
                entry.data = content;
                entry.mtime = Date.now();
                entry.size = content.byteLength;
                return;
            }

            const ussApi = ZoweExplorerApiRegister.getUssApi(parentDir.metadata.profile);

            if (entry.wasAccessed || content.length > 0) {
                // Entry was already accessed previously, this is an update to the existing file.
                const statusMsg = Gui.setStatusBarMessage(vscode.l10n.t("$(sync~spin) Saving USS file..."));
                try {
                    // Attempt to write data to remote system, and handle any conflicts from e-tag mismatch
                    await ussApi.uploadBufferAsFile(Buffer.from(content), entry.metadata.path, {
                        etag: shouldForceUpload || entry.etag == null ? undefined : entry.etag,
                        returnEtag: true,
                    });

                    // Update e-tag if write was successful.
                    // TODO: This call below can be removed once zowe.Upload.bufferToUssFile returns response headers.
                    // This is necessary at the moment on z/OSMF to fetch the new e-tag.
                    const newData = await ussApi.getContents(entry.metadata.path, {
                        returnEtag: true,
                    });
                    entry.etag = newData.apiResponse.etag;
                    entry.data = content;
                    statusMsg.dispose();
                } catch (err) {
                    statusMsg.dispose();
                    if (!err.message.includes("Rest API failure with HTTP(S) status 412")) {
                        // Some unknown error happened, don't update the entry
                        throw err;
                    }

                    // Prompt the user with the conflict dialog
                    await this._handleConflict(uri, entry);
                    return;
                }
            } else {
                // The entry hasn't been accessed yet, this call is to setup a placeholder entry.
                entry.data = content;
            }
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
        const newUriEntry = this._lookup(newUri, true);
        if (!options.overwrite && newUriEntry) {
            throw vscode.FileSystemError.FileExists(
                `Rename failed: ${path.posix.basename(newUri.path)} already exists in ${path.posix.resolve(newUriEntry.metadata.path, "..")}`
            );
        }

        const entry = this._lookup(oldUri, false) as UssDirectory | UssFile;
        const isDir = entry instanceof UssDirectory;
        const parentDir = this._lookupParentDirectory(oldUri);

        const newName = path.posix.basename(newUri.path);

        parentDir.entries.delete(entry.name);
        entry.name = newName;

        // Build the new path using the previous path and new file/folder name.
        let newPath = path.posix.resolve(entry.metadata.path, "..", newName);
        if (isDir) {
            newPath += "/";
        }

        try {
            await ZoweExplorerApiRegister.getUssApi(entry.metadata.profile).rename(entry.metadata.path, newPath);
        } catch (err) {
            await Gui.errorMessage(
                vscode.l10n.t({
                    message: "Renaming {0} failed due to API error: {1}",
                    args: [entry.metadata.path, err.message],
                    comment: ["File path", "Error message"],
                })
            );
            return;
        }

        entry.metadata.path = newPath;
        // We have to update the path for all child entries if they exist in the FileSystem
        // This way any further API requests in readFile will use the latest paths on the LPAR
        if (entry instanceof UssDirectory) {
            this._updateChildPaths(entry);
        }
        parentDir.entries.set(newName, entry);
        this._fireSoon({ type: vscode.FileChangeType.Deleted, uri: oldUri }, { type: vscode.FileChangeType.Created, uri: newUri });
    }

    /**
     * Deletes a file or folder at the given URI.
     * @param uri The URI that points to the file/folder to delete
     */
    public async delete(uri: vscode.Uri, options: { recursive: boolean }): Promise<void> {
        const { entryToDelete, parent, parentUri } = this._getDeleteInfo(uri, options);

        try {
            await ZoweExplorerApiRegister.getUssApi(parent.metadata.profile).delete(
                entryToDelete.metadata.path,
                entryToDelete instanceof UssDirectory
            );
        } catch (err) {
            await Gui.errorMessage(
                vscode.l10n.t({
                    message: "Deleting {0} failed due to API error: {1}",
                    args: [entryToDelete.metadata.path, err.message],
                    comment: ["File name", "Error message"],
                })
            );
            return;
        }

        parent.entries.delete(entryToDelete.name);
        parent.mtime = Date.now();
        parent.size -= 1;

        this._fireSoon({ type: vscode.FileChangeType.Changed, uri: parentUri }, { uri, type: vscode.FileChangeType.Deleted });
    }

    public copy(source: vscode.Uri, destination: vscode.Uri, options: { readonly overwrite: boolean }): void | Thenable<void> {
        const uriQuery = new URLSearchParams(source.query);
        if (!uriQuery.has("tree")) {
            return;
        }

        const sourceTree = JSON.parse(decodeURIComponent(uriQuery.get("tree")));
        return this.copyTree(source, destination, { ...options, tree: sourceTree });
    }

    private buildFileName(fileList: any[], fileName: string): string {
        // Check root path for conflicts
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
            return dupName;
        }

        return fileName;
    }

    /**
     * Copy a file/folder from a source URI to destination URI.
     * @param source The source URI for the file/folder to copy
     * @param destination The new, destination URI for the file/folder
     * @param options Options for copying the file/folder
     * - `overwrite` - Overwrites the entry at the destination URI if it exists
     * - `tree` - A tree representation of the file structure to copy
     * @returns
     */
    private async copyTree(
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

        const fileName = this.buildFileName(fileList, path.basename(sourceInfo.path));
        const outputPath = `${destInfo.path}/${fileName}`;

        if (hasCopyApi && sourceInfo.profile.profile === destInfo.profile.profile) {
            await api.copy(outputPath, {
                from: sourceInfo.path,
                recursive: options.tree.type === UssFileType.Directory,
                overwrite: options.overwrite ?? true,
            });
        } else if (options.tree.type === UssFileType.Directory) {
            // Not all APIs respect the recursive option, so it's best to
            // create a directory and copy recursively to avoid missing any files/folders
            await api.create(outputPath, "directory");
            if (options.tree.children) {
                for (const child of options.tree.children) {
                    await this.copyTree(child.localUri, vscode.Uri.parse(`zowe-uss:${outputPath}`), { ...options, tree: child });
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
        const parent = this._lookupParentDirectory(uri, false);

        const entry = new UssDirectory(basename);
        const profInfo =
            parent !== this.root
                ? {
                      profile: parent.metadata.profile,
                      // we can strip profile name from path because its not involved in API calls
                      path: parent.metadata.path.concat(`${basename}/`),
                  }
                : this._getInfoFromUri(uri);
        entry.metadata = profInfo;

        parent.entries.set(entry.name, entry);
        parent.mtime = Date.now();
        parent.size += 1;
        this._fireSoon(
            { type: vscode.FileChangeType.Changed, uri: uri.with({ path: path.posix.resolve(uri.path, "..") }) },
            { type: vscode.FileChangeType.Created, uri }
        );
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
