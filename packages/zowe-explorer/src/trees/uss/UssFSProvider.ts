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

import * as path from "path";
import * as vscode from "vscode";
import {
    BaseProvider,
    BufferBuilder,
    FsAbstractUtils,
    imperative,
    Gui,
    EntryMetadata,
    UssDirectory,
    UssFile,
    ZosEncoding,
    ZoweScheme,
    UriFsInfo,
} from "@zowe/zowe-explorer-api";
import { IZosFilesResponse } from "@zowe/zos-files-for-zowe-sdk";
import { USSFileStructure } from "./USSFileStructure";
import { Profiles } from "../../configuration/Profiles";
import { ZoweExplorerApiRegister } from "../../extending/ZoweExplorerApiRegister";
import { ZoweLogger } from "../../tools/ZoweLogger";

export class UssFSProvider extends BaseProvider implements vscode.FileSystemProvider {
    // Event objects for provider

    private static _instance: UssFSProvider;
    private constructor() {
        super();
        ZoweExplorerApiRegister.addFileSystemEvent(ZoweScheme.USS, this.onDidChangeFile);
        this.root = new UssDirectory();
    }

    public encodingMap: Record<string, ZosEncoding> = {};

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
    public async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
        ZoweLogger.trace(`[UssFSProvider] stat called with ${uri.toString()}`);
        let isFetching = false;
        if (uri.query) {
            const queryParams = new URLSearchParams(uri.query);
            if (queryParams.has("conflict")) {
                return { ...this.lookup(uri, false), permissions: vscode.FilePermission.Readonly };
            }
            isFetching = queryParams.has("fetch") && queryParams.get("fetch") === "true";
        }

        const entry = isFetching ? await this.remoteLookupForResource(uri) : this.lookup(uri, false);
        const uriInfo = FsAbstractUtils.getInfoForUri(uri, Profiles.getInstance());
        // Do not perform remote lookup for profile URIs
        if (uriInfo.isRoot) {
            return entry;
        }

        const fileResp = await this.listFiles(entry.metadata.profile, uri, true);
        if (fileResp.success) {
            // Regardless of the resource type, it will be the first item in a successful response.
            // When listing a folder, the folder's stats will be represented as the "." entry.
            const newTime = (fileResp.apiResponse?.items ?? [])?.[0]?.mtime ?? entry.mtime;

            if (entry.mtime != newTime) {
                // if the modification time has changed, invalidate the previous contents to signal to `readFile` that data needs to be fetched
                entry.wasAccessed = false;
            }
            return {
                ...entry,
                // If there isn't a valid mtime on the API response, we cannot determine whether the resource has been updated.
                // Use the last-known modification time to prevent superfluous updates.
                mtime: newTime,
            };
        }

        return entry;
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
            await Gui.errorMessage(vscode.l10n.t("The 'move' function is not implemented for this USS API."));
            return false;
        }

        const oldInfo = this._getInfoFromUri(oldUri);

        await ussApi.move(oldInfo.path, info.path);
        await this._relocateEntry(oldUri, newUri, info.path);
        return true;
    }

    public async listFiles(profile: imperative.IProfileLoaded, uri: vscode.Uri, keepRelative?: boolean): Promise<IZosFilesResponse> {
        const queryParams = new URLSearchParams(uri.query);
        const ussPath = queryParams.has("searchPath") ? queryParams.get("searchPath") : uri.path.substring(uri.path.indexOf("/", 1));
        if (ussPath.length === 0) {
            throw new imperative.ImperativeError({
                msg: vscode.l10n.t("Could not list USS files: Empty path provided in URI"),
            });
        }
        const response = await ZoweExplorerApiRegister.getUssApi(profile).fileList(ussPath);
        // If request was successful, create directories for the path if it doesn't exist
        if (!this.exists(uri)) {
            await vscode.workspace.fs.createDirectory(uri);
        }

        return {
            ...response,
            apiResponse: {
                ...response.apiResponse,
                items: (response.apiResponse.items ?? []).filter(keepRelative ? Boolean : (it): boolean => !/^\.{1,3}$/.test(it.name as string)),
            },
        };
    }

    private async fetchEntries(uri: vscode.Uri, uriInfo: UriFsInfo): Promise<UssDirectory | UssFile> {
        const entryExists = this.exists(uri);
        let resp: IZosFilesResponse;
        if (!entryExists) {
            resp = await this.listFiles(uriInfo.profile, uri);
            if (!resp.success) {
                throw vscode.FileSystemError.FileNotFound(uri);
            }
        }

        const entry = this.lookup(uri, true) as UssDirectory | UssFile;

        if (FsAbstractUtils.isFileEntry(entry)) {
            return this._lookupAsFile(uri) as UssFile;
        }

        const fileList = entryExists ? await this.listFiles(entry.metadata.profile, uri) : resp;
        for (const item of fileList.apiResponse.items) {
            const itemName = item.name as string;

            const isDirectory = item.mode?.startsWith("d") ?? false;
            const newEntryType = isDirectory ? vscode.FileType.Directory : vscode.FileType.File;
            // skip over existing entries if they are the same type
            const existingEntry = entry.entries.get(itemName);
            if (existingEntry && existingEntry.type === newEntryType) {
                continue;
            }

            // create new entries for any files/folders that aren't in the provider
            const UssType = item.mode?.startsWith("d") ? UssDirectory : UssFile;
            const newEntry = new UssType(itemName);
            newEntry.metadata = { ...entry.metadata, path: path.posix.join(entry.metadata.path, itemName) };
            entry.entries.set(itemName, newEntry);
        }

        return entry;
    }

    public async remoteLookupForResource(uri: vscode.Uri): Promise<UssDirectory | UssFile> {
        const uriInfo = FsAbstractUtils.getInfoForUri(uri, Profiles.getInstance());
        const profileUri = vscode.Uri.from({ scheme: ZoweScheme.USS, path: uriInfo.profileName });

        // Ensure that an entry exists for the given profile
        if (!this.exists(profileUri)) {
            this.createDirectory(profileUri);
        }

        if (uriInfo.isRoot) {
            // profile entry; check if "pattern" is in query.
            const urlQuery = new URLSearchParams(uri.query);
            if (!urlQuery.has("searchPath")) {
                return this._lookupAsDirectory(profileUri, false) as UssDirectory;
            }
        }

        return this.fetchEntries(uri, uriInfo);
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
        let dir: UssDirectory = null;
        try {
            dir = this._lookupAsDirectory(uri, false) as UssDirectory;
        } catch (err) {
            // Errors unrelated to the filesystem cannot be handled here
            if (!(err instanceof vscode.FileSystemError) || err.code !== "FileNotFound") {
                throw err;
            }
        }

        // check to see if contents have updated on the remote system before returning its children.
        dir = (await this.remoteLookupForResource(uri)) as UssDirectory;

        return Array.from(dir.entries.entries()).map((e: [string, UssDirectory | UssFile]) => [e[0], e[1].type]);
    }

    /**
     * Fetches a file from the remote system at the given URI.
     * @param uri The URI pointing to a valid file to fetch from the remote system
     * @param editor (optional) An editor instance to reload if the URI is already open
     */
    public async fetchFileAtUri(uri: vscode.Uri, options?: { editor?: vscode.TextEditor | null; isConflict?: boolean }): Promise<void> {
        ZoweLogger.trace(`[UssFSProvider] fetchFileAtUri called with ${uri.toString()}`);
        const file = this._lookupAsFile(uri);
        const uriInfo = FsAbstractUtils.getInfoForUri(uri, Profiles.getInstance());
        const bufBuilder = new BufferBuilder();
        const filePath = uri.path.substring(uriInfo.slashAfterProfilePos);
        const metadata = file.metadata;
        const profileEncoding = file.encoding ? null : file.metadata.profile.profile?.encoding;
        const resp = await ZoweExplorerApiRegister.getUssApi(metadata.profile).getContents(filePath, {
            binary: file.encoding?.kind === "binary",
            encoding: file.encoding?.kind === "other" ? file.encoding.codepage : profileEncoding,
            responseTimeout: metadata.profile.profile?.responseTimeout,
            returnEtag: true,
            stream: bufBuilder,
        });
        await this.autoDetectEncoding(file as UssFile);

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

        this._fireSoon({ type: vscode.FileChangeType.Changed, uri: uri });
        if (options?.editor) {
            await this._updateResourceInEditor(uri);
        }
    }

    public async autoDetectEncoding(entry: UssFile): Promise<void> {
        if (entry.encoding !== undefined) {
            return;
        }

        const ussApi = ZoweExplorerApiRegister.getUssApi(entry.metadata.profile);
        if (ussApi.getTag != null) {
            const taggedEncoding = await ussApi.getTag(entry.metadata.path);
            if (taggedEncoding === "binary" || taggedEncoding === "mixed") {
                entry.encoding = { kind: "binary" };
            } else if (taggedEncoding !== "untagged") {
                entry.encoding = { kind: "other", codepage: taggedEncoding };
            }
        } else {
            const isBinary = await ussApi.isFileTagBinOrAscii(entry.metadata.path);
            entry.encoding = isBinary ? { kind: "binary" } : undefined;
        }
    }

    public async fetchEncodingForUri(uri: vscode.Uri): Promise<ZosEncoding> {
        const file = this._lookupAsFile(uri) as UssFile;
        await this.autoDetectEncoding(file);

        return file.encoding;
    }

    /**
     * Reads a file at the given URI and fetches it from the remote system (if not yet accessed).
     * @param uri The URI pointing to a valid file on the remote system
     * @returns The file's contents as an array of bytes
     */
    public async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        const file = this._lookupAsFile(uri, { silent: false });
        const profInfo = this._getInfoFromUri(uri);

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

    private async uploadEntry(
        entry: UssFile,
        content: Uint8Array,
        options?: { forceUpload?: boolean; noStatusMsg?: boolean }
    ): Promise<IZosFilesResponse> {
        const statusMsg =
            // only show a status message if "noStatusMsg" is not specified,
            // or if the entry does not exist and the new contents are empty (new placeholder entry)
            options?.noStatusMsg || (!entry && content.byteLength === 0)
                ? new vscode.Disposable(() => {})
                : Gui.setStatusBarMessage(vscode.l10n.t("$(sync~spin) Saving USS file..."));

        let resp: IZosFilesResponse;
        try {
            const ussApi = ZoweExplorerApiRegister.getUssApi(entry.metadata.profile);
            await this.autoDetectEncoding(entry);
            const profileEncoding = entry.encoding ? null : entry.metadata.profile.profile?.encoding;

            resp = await ussApi.uploadFromBuffer(Buffer.from(content), entry.metadata.path, {
                binary: entry.encoding?.kind === "binary",
                encoding: entry.encoding?.kind === "other" ? entry.encoding.codepage : profileEncoding,
                etag: options?.forceUpload || entry.etag == null ? undefined : entry.etag,
                returnEtag: true,
            });
        } catch (err) {
            statusMsg.dispose();
            throw err;
        }

        statusMsg.dispose();
        return resp;
    }

    /**
     * Attempts to write a file at the given URI.
     * @param uri The URI pointing to a file entry that should be written
     * @param content The content to write to the file, as an array of bytes
     * @param options Options for writing the file
     * - `create` - Creates the file if it does not exist
     * - `overwrite` - Overwrites the content if the file exists
     */
    public async writeFile(
        uri: vscode.Uri,
        content: Uint8Array,
        options: { create: boolean; overwrite: boolean; noStatusMsg?: boolean }
    ): Promise<void> {
        const fileName = path.posix.basename(uri.path);
        const parentDir = this._lookupParentDirectory(uri);

        let entry = parentDir.entries.get(fileName);
        if (FsAbstractUtils.isDirectoryEntry(entry)) {
            throw vscode.FileSystemError.FileIsADirectory(uri);
        }
        if (!entry && !options.create) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        if (entry && options.create && !options.overwrite) {
            throw vscode.FileSystemError.FileExists(uri);
        }

        // Attempt to write data to remote system, and handle any conflicts from e-tag mismatch
        const urlQuery = new URLSearchParams(uri.query);
        const forceUpload = urlQuery.has("forceUpload");
        try {
            if (!entry) {
                entry = new UssFile(fileName);
                // Build the metadata for the file using the parent's metadata (if available),
                // or build it using the helper function
                entry.metadata = {
                    ...parentDir.metadata,
                    path: path.posix.join(parentDir.metadata.path, fileName),
                };

                if (content.byteLength > 0) {
                    // user is trying to edit a file that was just deleted: make the API call
                    const resp = await this.uploadEntry(entry as UssFile, content, { forceUpload });
                    entry.etag = resp.apiResponse.etag;
                }
                entry.data = content;
                parentDir.entries.set(fileName, entry);
                this._fireSoon({ type: vscode.FileChangeType.Created, uri });
            } else {
                if (entry.inDiffView || urlQuery.has("inDiff")) {
                    // Allow users to edit the local copy of a file in the diff view, but don't make any API calls.
                    entry.inDiffView = true;
                    entry.data = content;
                    entry.mtime = Date.now();
                    entry.size = content.byteLength;
                    return;
                }

                if (entry.wasAccessed || content.length > 0) {
                    const resp = await this.uploadEntry(entry as UssFile, content, { forceUpload });
                    entry.etag = resp.apiResponse.etag;
                }
                entry.data = content;
            }
        } catch (err) {
            if (!err.message.includes("Rest API failure with HTTP(S) status 412")) {
                // Some unknown error happened, don't update the entry
                throw err;
            }

            entry.data = content;
            // Prompt the user with the conflict dialog
            await this._handleConflict(uri, entry);
            return;
        }

        entry.mtime = Date.now();
        entry.size = content.byteLength;
        this._fireSoon({ type: vscode.FileChangeType.Changed, uri });
    }

    public makeEmptyFileWithEncoding(uri: vscode.Uri, encoding: ZosEncoding): void {
        const parentDir = this._lookupParentDirectory(uri);
        const fileName = path.posix.basename(uri.path);
        const entry = new UssFile(fileName);
        entry.encoding = encoding;
        entry.metadata = {
            ...parentDir.metadata,
            path: path.posix.join(parentDir.metadata.path, fileName),
        };
        entry.data = new Uint8Array();
        parentDir.entries.set(fileName, entry);
    }

    /**
     * Attempts to rename an entry from the old, source URI to the new, destination URI.
     * @param oldUri The source URI of the file/folder
     * @param newUri The destination URI of the file/folder
     * @param options Options for renaming the file/folder
     * - `overwrite` - Overwrites the file if the new URI already exists
     */
    public async rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): Promise<void> {
        const newUriEntry = this.lookup(newUri, true);
        if (!options.overwrite && newUriEntry) {
            throw vscode.FileSystemError.FileExists(
                `Rename failed: ${path.posix.basename(newUri.path)} already exists in ${path.posix.join(newUriEntry.metadata.path, "..")}`
            );
        }

        const entry = this.lookup(oldUri, false) as UssDirectory | UssFile;
        const parentDir = this._lookupParentDirectory(oldUri);

        const newName = path.posix.basename(newUri.path);

        // Build the new path using the previous path and new file/folder name.
        const newPath = path.posix.join(entry.metadata.path, "..", newName);

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

        parentDir.entries.delete(entry.name);
        entry.name = newName;

        entry.metadata.path = newPath;
        // We have to update the path for all child entries if they exist in the FileSystem
        // This way any further API requests in readFile will use the latest paths on the LPAR
        if (FsAbstractUtils.isDirectoryEntry(entry)) {
            this._updateChildPaths(entry);
        }
        parentDir.entries.set(newName, entry);
        this._fireSoon({ type: vscode.FileChangeType.Deleted, uri: oldUri }, { type: vscode.FileChangeType.Created, uri: newUri });
    }

    /**
     * Deletes a file or folder at the given URI.
     * @param uri The URI that points to the file/folder to delete
     */
    public async delete(uri: vscode.Uri, _options: { recursive: boolean }): Promise<void> {
        const { entryToDelete, parent, parentUri } = this._getDeleteInfo(uri);

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

    public async copy(source: vscode.Uri, destination: vscode.Uri, options: { readonly overwrite: boolean }): Promise<void> {
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
            const baseNameForFile = path.parse(fileName).name;
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
        options: { readonly overwrite: boolean; readonly tree: USSFileStructure.UssFileTree }
    ): Promise<void> {
        const destInfo = this._getInfoFromUri(destination);
        const sourceInfo = this._getInfoFromUri(source);
        const api = ZoweExplorerApiRegister.getUssApi(destInfo.profile);

        const hasCopyApi = api.copy != null;

        const apiResponse = await api.fileList(path.posix.join(destInfo.path, ".."));
        const fileList = apiResponse.apiResponse?.items;

        const fileName = this.buildFileName(fileList, path.basename(destInfo.path));
        const outputPath = path.posix.join(destInfo.path, "..", fileName);

        if (hasCopyApi && sourceInfo.profile.profile === destInfo.profile.profile) {
            await api.copy(outputPath, {
                from: sourceInfo.path,
                recursive: options.tree.type === USSFileStructure.UssFileType.Directory,
                overwrite: options.overwrite ?? true,
            });
        } else if (options.tree.type === USSFileStructure.UssFileType.Directory) {
            // Not all APIs respect the recursive option, so it's best to
            // create a directory and copy recursively to avoid missing any files/folders
            await api.create(outputPath, "directory");
            if (options.tree.children) {
                for (const child of options.tree.children) {
                    await this.copyTree(
                        child.localUri,
                        vscode.Uri.from({
                            scheme: ZoweScheme.USS,
                            path: path.posix.join(destInfo.profile.name, outputPath, child.baseName),
                        }),
                        { ...options, tree: child }
                    );
                }
            }
        } else {
            const fileEntry = this.lookup(source, true);
            if (fileEntry == null) {
                return;
            }

            if (!fileEntry.wasAccessed) {
                // must fetch contents of file first before pasting in new path
                await this.readFile(source);
            }
            await api.uploadFromBuffer(Buffer.from(fileEntry.data), outputPath);
        }
    }

    /**
     * Creates a directory entry in the provider at the given URI.
     * @param uri The URI that represents a new directory path
     */
    public createDirectory(uri: vscode.Uri): void {
        const uriInfo = FsAbstractUtils.getInfoForUri(uri, Profiles.getInstance());
        const basename = path.posix.basename(uri.path);
        const parent = this._lookupParentDirectory(uri, false);
        if (parent.entries.has(basename)) {
            return;
        }

        const entry = new UssDirectory(basename);
        const profInfo = !uriInfo.isRoot
            ? {
                  profile: uriInfo.profile,
                  // we can strip profile name from path because its not involved in API calls
                  path: path.posix.join(parent.metadata.path, basename),
              }
            : this._getInfoFromUri(uri);
        entry.metadata = profInfo;

        parent.entries.set(entry.name, entry);
        parent.mtime = Date.now();
        parent.size += 1;
        this._fireSoon(
            { type: vscode.FileChangeType.Changed, uri: uri.with({ path: path.posix.join(uri.path, "..") }) },
            { type: vscode.FileChangeType.Created, uri }
        );
    }

    public watch(_resource: vscode.Uri, _options?: { readonly recursive: boolean; readonly excludes: readonly string[] }): vscode.Disposable {
        // ignore, fires for all changes...
        return new vscode.Disposable(() => {});
    }

    /**
     * Returns metadata about the file entry from the context of z/OS.
     * @param uri A URI with a path in the format `zowe-*:/{lpar_name}/{full_path}?`
     * @returns Metadata for the URI that contains the profile instance and path
     */
    private _getInfoFromUri(uri: vscode.Uri): EntryMetadata {
        const uriInfo = FsAbstractUtils.getInfoForUri(uri, Profiles.getInstance());
        return { profile: uriInfo.profile, path: uriInfo.isRoot ? "/" : uri.path.substring(uriInfo.slashAfterProfilePos) };
    }
}
