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
    DirEntry,
    DsEntry,
    DsEntryMetadata,
    PdsEntry,
    FsAbstractUtils,
    FsDatasetsUtils,
    FilterEntry,
    Gui,
    ZosEncoding,
    ZoweScheme,
    UriFsInfo,
    FileEntry,
} from "@zowe/zowe-explorer-api";
import { IZosFilesResponse } from "@zowe/zos-files-for-zowe-sdk";
import { DatasetUtils } from "./DatasetUtils";
import { Profiles } from "../../configuration/Profiles";
import { ZoweExplorerApiRegister } from "../../extending/ZoweExplorerApiRegister";
import { ZoweLogger } from "../../tools/ZoweLogger";
import * as dayjs from "dayjs";

export class DatasetFSProvider extends BaseProvider implements vscode.FileSystemProvider {
    private static _instance: DatasetFSProvider;
    private constructor() {
        super();
        ZoweExplorerApiRegister.addFileSystemEvent(ZoweScheme.DS, this.onDidChangeFile);
        this.root = new DirEntry("");
    }

    public encodingMap: Record<string, ZosEncoding> = {};

    /**
     * @returns the Data Set FileSystemProvider singleton instance
     */
    public static get instance(): DatasetFSProvider {
        if (!DatasetFSProvider._instance) {
            DatasetFSProvider._instance = new DatasetFSProvider();
        }

        return DatasetFSProvider._instance;
    }

    /**
     * onDidOpenTextDocument event listener for the dataset provider.
     * Updates the opened document with the correct language ID.
     * @param doc The document received from the onDidOpenTextDocument event.
     */
    public static async onDidOpenTextDocument(this: void, doc: vscode.TextDocument): Promise<void> {
        if (doc.uri.scheme !== ZoweScheme.DS) {
            return;
        }

        const parentPath = path.posix.basename(path.posix.join(doc.uri.path, ".."));
        const languageId = DatasetUtils.getLanguageId(parentPath);
        if (languageId == null) {
            return;
        }

        try {
            await vscode.languages.setTextDocumentLanguage(doc, languageId);
        } catch (err) {
            ZoweLogger.warn(`Could not set document language for ${doc.fileName} - tried languageId '${languageId}'`);
        }
    }

    public watch(_uri: vscode.Uri, _options: { readonly recursive: boolean; readonly excludes: readonly string[] }): vscode.Disposable {
        // ignore, fires for all changes...
        return new vscode.Disposable(() => {});
    }

    /**
     * Returns file statistics about a given URI.
     * @param uri A URI that must exist as an entry in the provider
     * @returns A structure containing file type, time, size and other metrics
     */
    public async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
        ZoweLogger.trace(`[DatasetFSProvider] stat called with ${uri.toString()}`);
        if (uri.query) {
            const queryParams = new URLSearchParams(uri.query);
            if (queryParams.has("conflict")) {
                return { ...this._lookup(uri, false), permissions: vscode.FilePermission.Readonly };
            }
        }

        const uriInfo = FsAbstractUtils.getInfoForUri(uri, Profiles.getInstance());
        const entry = this._lookup(uri, false);
        // Return the entry for profiles as there is no remote info to fetch
        if (uriInfo.isRoot) {
            return entry;
        }

        if (!FsDatasetsUtils.isPdsEntry(entry) && (entry as DsEntry).isMember) {
            // PDS member
            const pds = this._lookupParentDirectory(uri);
            const resp = await ZoweExplorerApiRegister.getMvsApi(uriInfo.profile).allMembers(pds.name, { attributes: true });
            if (resp.success) {
                const pdsMember = (resp.apiResponse?.items ?? []).find((i) => i.member === entry.name);
                if (pdsMember != null && "m4date" in pdsMember) {
                    entry.wasAccessed = false;
                    const { m4date, mtime, msec }: { m4date: string; mtime: string; msec: string } = pdsMember;
                    const statInfo = {
                        type: entry.type,
                        ctime: 0,
                        mtime: dayjs(`${m4date} ${mtime}:${msec}`).unix(),
                        size: entry.size,
                    };
                    return statInfo;
                }
            }
        } else {
            // PDS or Data Set
            const resp = await ZoweExplorerApiRegister.getMvsApi(uriInfo.profile).dataSet(path.posix.basename(uri.path), { attributes: true });
            if (resp.success) {
                const pds = (resp.apiResponse?.items ?? [])?.[0];
                if (pds != null && "m4date" in pds) {
                    entry.wasAccessed = false;
                    const { m4date, mtime, msec }: { m4date: string; mtime: string; msec: string } = pds;
                    const statInfo = {
                        type: entry.type,
                        ctime: 0,
                        mtime: dayjs(`${m4date} ${mtime}:${msec}`).unix(),
                        size: entry.size,
                    };
                    return statInfo;
                }
            }
        }

        return this._lookup(uri, false);
    }

    private async fetchEntriesForProfile(uri: vscode.Uri, uriInfo: UriFsInfo, pattern: string): Promise<FilterEntry> {
        const profileEntry = this._lookupAsDirectory(uri, false) as FilterEntry;

        const mvsApi = ZoweExplorerApiRegister.getMvsApi(uriInfo.profile);
        const datasetResponses: IZosFilesResponse[] = [];
        const dsPatterns = [
            ...new Set(
                pattern
                    .toUpperCase()
                    .split(",")
                    .map((p: string) => p.trim())
            ),
        ];

        if (mvsApi.dataSetsMatchingPattern) {
            datasetResponses.push(await mvsApi.dataSetsMatchingPattern(dsPatterns));
        } else {
            for (const dsp of dsPatterns) {
                datasetResponses.push(await mvsApi.dataSet(dsp));
            }
        }

        for (const resp of datasetResponses) {
            for (const ds of resp.apiResponse?.items ?? resp.apiResponse ?? []) {
                let tempEntry = profileEntry.entries.get(ds.dsname);
                if (tempEntry == null) {
                    if (ds.dsorg === "PO" || ds.dsorg === "PO-E") {
                        // Entry is a PDS
                        tempEntry = new PdsEntry(ds.dsname);
                    } else if (ds.dsorg === "VS") {
                        // TODO: Add VSAM and ZFS support in Zowe Explorer
                        continue;
                    } else if (ds.migr?.toUpperCase() === "YES") {
                        // migrated
                        tempEntry = new DsEntry(ds.dsname, false);
                    } else {
                        // PS
                        tempEntry = new DsEntry(ds.dsname, false);
                    }
                    tempEntry.metadata = new DsEntryMetadata({
                        ...profileEntry.metadata,
                        path: path.posix.join(profileEntry.metadata.path, ds.dsname),
                    });
                    profileEntry.entries.set(ds.dsname, tempEntry);
                }
            }
        }

        return profileEntry;
    }

    private async fetchEntriesForDataset(entry: PdsEntry, uri: vscode.Uri, uriInfo: UriFsInfo): Promise<void> {
        const members = await ZoweExplorerApiRegister.getMvsApi(uriInfo.profile).allMembers(path.posix.basename(uri.path));

        for (const ds of members.apiResponse?.items || []) {
            let tempEntry = entry.entries.get(ds.member);
            if (tempEntry == null) {
                tempEntry = new DsEntry(ds.member, true);
                tempEntry.metadata = new DsEntryMetadata({ ...entry.metadata, path: path.posix.join(entry.metadata.path, ds.member) });
                entry.entries.set(ds.member, tempEntry);
            }
        }
    }

    private async fetchDataset(uri: vscode.Uri, uriInfo: UriFsInfo): Promise<PdsEntry | DsEntry> {
        let entry: PdsEntry | DsEntry;
        try {
            entry = this._lookupAsDirectory(uri, false) as PdsEntry;
        } catch (err) {
            if (!(err instanceof vscode.FileSystemError)) {
                throw err;
            }

            if (err.code !== "FileNotFound") {
                throw err;
            }
        }

        const entryExists = entry != null;
        let entryIsDir = false;
        if (!entryExists) {
            const resp = await ZoweExplorerApiRegister.getMvsApi(uriInfo.profile).dataSet(path.posix.basename(uri.path), { attributes: true });
            if (resp.success) {
                const dsorg: string = resp.apiResponse?.items?.[0]?.dsorg;
                entryIsDir = dsorg?.startsWith("PO") ?? false;
            } else {
                throw vscode.FileSystemError.FileNotFound(uri);
            }
        }

        if (entryIsDir) {
            if (!entryExists) {
                this.createDirectory(uri);
                entry = this._lookupAsDirectory(uri, false) as PdsEntry;
            }
            await this.fetchEntriesForDataset(entry as PdsEntry, uri, uriInfo);
        } else {
            if (!entryExists) {
                await this.writeFile(uri, new Uint8Array(), { create: true, overwrite: false });
                entry = this._lookupAsFile(uri) as DsEntry;
            }
        }

        return entry;
    }

    public async remoteLookupForResource(uri: vscode.Uri): Promise<DirEntry | DsEntry> {
        const uriInfo = FsAbstractUtils.getInfoForUri(uri, Profiles.getInstance());
        const profileUri = vscode.Uri.from({ scheme: ZoweScheme.DS, path: uriInfo.profileName });

        // Ensure that an entry exists for the given profile
        if (!this.exists(profileUri)) {
            this.createDirectory(profileUri);
        }

        if (uriInfo.isRoot) {
            // profile entry; check if "pattern" filter is in query.

            const urlQuery = new URLSearchParams(uri.query);
            if (!urlQuery.has("pattern")) {
                return this._lookupAsDirectory(profileUri, false);
            }

            return this.fetchEntriesForProfile(uri, uriInfo, urlQuery.get("pattern"));
        } else {
            // data set or one of its members
            return this.fetchDataset(uri, uriInfo);
        }
    }

    /**
     * Reads a directory located at the given URI.
     * @param uri A valid URI within the provider
     * @returns An array of tuples containing each entry name and type
     */
    public async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        let dsEntry: DirEntry | DsEntry = null;
        try {
            dsEntry = this._lookupAsDirectory(uri, false);
        } catch (err) {
            // Errors unrelated to the filesystem cannot be handled here
            if (!(err instanceof vscode.FileSystemError)) {
                throw err;
            }

            if (err.code === "FileNotFound") {
                // if the entry doesn't exist in the local file system, first check to see if it exists on the remote before throwing an error.
                dsEntry = await this.remoteLookupForResource(uri);
            }
        }

        if (dsEntry == null || FsDatasetsUtils.isDsEntry(dsEntry)) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }

        // Check the remote file system to see if anything has changed since the last time the directory was read.
        await this.remoteLookupForResource(uri);
        return Array.from(dsEntry.entries.entries()).map((value: [string, DirEntry | FileEntry]) => [value[0], value[1].type]);
    }

    /**
     * Creates a directory entry in the provider at the given URI.
     * @param uri The URI that represents a new directory path
     */
    public createDirectory(uri: vscode.Uri, filter?: string): void {
        const basename = path.posix.basename(uri.path);
        const parent = this._lookupParentDirectory(uri, false);
        if (parent.entries.has(basename)) {
            return;
        }
        const profInfo =
            parent !== this.root
                ? new DsEntryMetadata({
                      profile: parent.metadata.profile,
                      // we can strip profile name from path because its not involved in API calls
                      path: path.posix.join(parent.metadata.path, basename),
                  })
                : this._getInfoFromUri(uri);

        if (FsAbstractUtils.isFilterEntry(parent)) {
            const entry = new PdsEntry(basename);
            entry.metadata = profInfo;
            parent.entries.set(entry.name, entry);
        } else {
            const entry = new FilterEntry(basename);
            entry.filter["pattern"] = filter;
            entry.metadata = profInfo;
            parent.entries.set(entry.name, entry);
        }

        parent.mtime = Date.now();
        parent.size += 1;
        this._fireSoon(
            { type: vscode.FileChangeType.Changed, uri: uri.with({ path: path.posix.join(uri.path, "..") }) },
            { type: vscode.FileChangeType.Created, uri }
        );
    }

    /**
     * Fetches a data set from the remote system at the given URI.
     * @param uri The URI pointing to a valid file to fetch from the remote system
     * @param editor (optional) An editor instance to reload if the URI is already open
     */
    public async fetchDatasetAtUri(uri: vscode.Uri, options?: { editor?: vscode.TextEditor | null; isConflict?: boolean }): Promise<void> {
        ZoweLogger.trace(`[DatasetFSProvider] fetchDatasetAtUri called with ${uri.toString()}`);
        const file = this._lookupAsFile(uri) as DsEntry;
        // we need to fetch the contents from the mainframe since the file hasn't been accessed yet
        const bufBuilder = new BufferBuilder();
        const metadata = file.metadata ?? this._getInfoFromUri(uri);
        const profileEncoding = file.encoding ? null : file.metadata.profile.profile?.encoding;
        const resp = await ZoweExplorerApiRegister.getMvsApi(metadata.profile).getContents(metadata.dsName, {
            binary: file.encoding?.kind === "binary",
            encoding: file.encoding?.kind === "other" ? file.encoding.codepage : profileEncoding,
            responseTimeout: metadata.profile.profile?.responseTimeout,
            returnEtag: true,
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
            file.mtime = Date.now();
        }

        ZoweLogger.trace(`[DatasetFSProvider] fetchDatasetAtUri fired a change event for ${uri.toString()}`);
        this._fireSoon({ type: vscode.FileChangeType.Changed, uri });

        if (options?.editor) {
            await this._updateResourceInEditor(uri);
        }
    }

    /**
     * Reads a data set at the given URI and fetches it from the remote system (if not yet accessed).
     * @param uri The URI pointing to a valid data set on the remote system
     * @returns The data set's contents as an array of bytes
     */
    public async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        const file = this._lookupAsFile(uri);
        const profInfo = this._getInfoFromUri(uri);

        if (profInfo.profile == null) {
            throw vscode.FileSystemError.FileNotFound(vscode.l10n.t("Profile does not exist for this file."));
        }

        const urlQuery = new URLSearchParams(uri.query);
        const isConflict = urlQuery.has("conflict");

        // we need to fetch the contents from the mainframe if the file hasn't been accessed yet
        if (!file.wasAccessed || isConflict) {
            await this.fetchDatasetAtUri(uri, { isConflict });
            if (!isConflict) {
                file.wasAccessed = true;
            }
        }

        return isConflict ? file.conflictData.contents : file.data;
    }

    public makeEmptyDsWithEncoding(uri: vscode.Uri, encoding: ZosEncoding, isMember?: boolean): void {
        const parentDir = this._lookupParentDirectory(uri);
        const fileName = path.posix.basename(uri.path);
        const entry = new DsEntry(fileName, isMember);
        entry.encoding = encoding;
        entry.metadata = new DsEntryMetadata({
            ...parentDir.metadata,
            path: path.posix.join(parentDir.metadata.path, fileName),
        });
        entry.data = new Uint8Array();
        parentDir.entries.set(fileName, entry);
    }

    private async uploadEntry(parent: DirEntry, entry: DsEntry, content: Uint8Array, forceUpload?: boolean): Promise<IZosFilesResponse> {
        const statusMsg = Gui.setStatusBarMessage(vscode.l10n.t("$(sync~spin) Saving data set..."));
        const isPdsMember = FsDatasetsUtils.isPdsEntry(parent) && !FsAbstractUtils.isFilterEntry(parent);
        const fullName = isPdsMember ? `${parent.name}(${entry.name})` : entry.name;
        let resp: IZosFilesResponse;
        try {
            const mvsApi = ZoweExplorerApiRegister.getMvsApi(entry.metadata.profile);
            const profileEncoding = entry.encoding ? null : entry.metadata.profile.profile?.encoding;
            resp = await mvsApi.uploadFromBuffer(Buffer.from(content), fullName, {
                binary: entry.encoding?.kind === "binary",
                encoding: entry.encoding?.kind === "other" ? entry.encoding.codepage : profileEncoding,
                etag: forceUpload ? undefined : entry.etag,
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
     * Attempts to write a data set at the given URI.
     * @param uri The URI pointing to a data set entry that should be written
     * @param content The content to write to the data set, as an array of bytes
     * @param options Options for writing the data set
     * - `create` - Creates the data set if it does not exist
     * - `overwrite` - Overwrites the content if the data set exists
     */
    public async writeFile(uri: vscode.Uri, content: Uint8Array, options: { readonly create: boolean; readonly overwrite: boolean }): Promise<void> {
        const basename = path.posix.basename(uri.path);
        const parent = this._lookupParentDirectory(uri);
        let entry = parent.entries.get(basename);
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
        // Attempt to write data to remote system, and handle any conflicts from e-tag mismatch

        try {
            if (!entry) {
                entry = new DsEntry(basename, FsDatasetsUtils.isPdsEntry(parent));
                entry.data = content;
                const profInfo = parent.metadata
                    ? new DsEntryMetadata({
                          profile: parent.metadata.profile,
                          path: path.posix.join(parent.metadata.path, basename),
                      })
                    : this._getInfoFromUri(uri);
                entry.metadata = profInfo;

                if (content.byteLength > 0) {
                    // Update e-tag if write was successful.
                    const resp = await this.uploadEntry(parent, entry as DsEntry, content, forceUpload);
                    entry.etag = resp.apiResponse.etag;
                    entry.data = content;
                }
                parent.entries.set(basename, entry);
                this._fireSoon({ type: vscode.FileChangeType.Created, uri });
            } else {
                if (urlQuery.has("inDiff")) {
                    // Allow users to edit files in diff view.
                    // If in diff view, we don't want to make any API calls, just keep track of latest
                    // changes to data.
                    entry.data = content;
                    entry.mtime = Date.now();
                    entry.size = content.byteLength;
                    entry.inDiffView = true;
                    return;
                }

                if (entry.wasAccessed || content.length > 0) {
                    const resp = await this.uploadEntry(parent, entry as DsEntry, content, forceUpload);
                    entry.etag = resp.apiResponse.etag;
                }
                entry.data = content;
            }
        } catch (err) {
            if (!err.message.includes("Rest API failure with HTTP(S) status 412")) {
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

    /**
     * Returns metadata about the data set entry from the context of z/OS.
     * @param uri A URI with a path in the format `zowe-*:/{lpar_name}/{full_path}?`
     * @returns Metadata for the URI that contains the profile instance and path
     */
    private _getInfoFromUri(uri: vscode.Uri): DsEntryMetadata {
        const uriInfo = FsAbstractUtils.getInfoForUri(uri, Profiles.getInstance());
        return new DsEntryMetadata({
            profile: uriInfo.profile,
            path: uri.path.substring(uriInfo.slashAfterProfilePos),
        });
    }

    public async delete(uri: vscode.Uri, _options: { readonly recursive: boolean }): Promise<void> {
        const entry = this._lookup(uri, false);
        const parent = this._lookupParentDirectory(uri);
        let fullName: string = "";
        if (FsDatasetsUtils.isPdsEntry(parent)) {
            fullName = `${parent.name}(${entry.name})`;
        } else {
            fullName = entry.name;
        }

        try {
            await ZoweExplorerApiRegister.getMvsApi(entry.metadata.profile).deleteDataSet(fullName, {
                responseTimeout: entry.metadata.profile.profile?.responseTimeout,
            });
        } catch (err) {
            await Gui.errorMessage(
                vscode.l10n.t({
                    message: "Deleting {0} failed due to API error: {1}",
                    args: [entry.metadata.path, err.message],
                    comment: ["File path", "Error message"],
                })
            );
            return;
        }

        parent.entries.delete(entry.name);
        parent.size -= 1;

        this._fireSoon({ type: vscode.FileChangeType.Deleted, uri });
    }

    public async rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { readonly overwrite: boolean }): Promise<void> {
        const newUriEntry = this._lookup(newUri, true);
        if (!options.overwrite && newUriEntry) {
            throw vscode.FileSystemError.FileExists(`Rename failed: ${path.posix.basename(newUri.path)} already exists`);
        }

        const entry = this._lookup(oldUri, false) as PdsEntry | DsEntry;
        const parentDir = this._lookupParentDirectory(oldUri);

        const oldName = entry.name;
        const newName = path.posix.basename(newUri.path);

        try {
            if (FsDatasetsUtils.isPdsEntry(entry)) {
                await ZoweExplorerApiRegister.getMvsApi(entry.metadata.profile).renameDataSet(oldName, newName);
            } else {
                const pdsName = path.basename(path.posix.join(entry.metadata.path, ".."));
                await ZoweExplorerApiRegister.getMvsApi(entry.metadata.profile).renameDataSetMember(pdsName, oldName, newName);
            }
        } catch (err) {
            await Gui.errorMessage(
                vscode.l10n.t({
                    message: "Renaming {0} failed due to API error: {1}",
                    args: [oldName, err.message],
                    comment: ["File name", "Error message"],
                })
            );
            return;
        }

        parentDir.entries.delete(entry.name);
        entry.name = newName;

        // Build the new path using the previous path and new file/folder name.
        const newPath = path.posix.join(entry.metadata.path, "..", newName);

        entry.metadata.path = newPath;
        parentDir.entries.set(newName, entry);

        this._fireSoon({ type: vscode.FileChangeType.Deleted, uri: oldUri }, { type: vscode.FileChangeType.Created, uri: newUri });
    }
}
