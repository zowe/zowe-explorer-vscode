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
    DirEntry,
    DsEntry,
    DsEntryMetadata,
    MemberEntry,
    PdsEntry,
    getInfoForUri,
    isDirectoryEntry,
    isFilterEntry,
    FilterEntry,
} from "@zowe/zowe-explorer-api";
import * as path from "path";
import * as vscode from "vscode";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";

// Set up localization
import { Profiles } from "../Profiles";

export class DatasetFSProvider extends BaseProvider implements vscode.FileSystemProvider {
    public onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]>;

    private static _instance: DatasetFSProvider;
    private constructor() {
        super(Profiles.getInstance());
        this.root = new DirEntry("");
    }

    /**
     * @returns the Data Set FileSystemProvider singleton instance
     */
    public static get instance(): DatasetFSProvider {
        if (!DatasetFSProvider._instance) {
            DatasetFSProvider._instance = new DatasetFSProvider();
        }

        return DatasetFSProvider._instance;
    }

    public watch(_uri: vscode.Uri, _options: { readonly recursive: boolean; readonly excludes: readonly string[] }): vscode.Disposable {
        throw new Error("Method not implemented.");
    }

    /**
     * Returns file statistics about a given URI.
     * @param uri A URI that must exist as an entry in the provider
     * @returns A structure containing file type, time, size and other metrics
     */
    public stat(uri: vscode.Uri): vscode.FileStat | Thenable<vscode.FileStat> {
        return this._lookup(uri, false);
    }

    /**
     * Reads a directory located at the given URI.
     * @param uri A valid URI within the provider
     * @returns An array of tuples containing each entry name and type
     */
    public async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        const dsEntry = this._lookupAsDirectory(uri, false);
        const uriInfo = getInfoForUri(uri, Profiles.getInstance());

        const results: [string, vscode.FileType][] = [];

        if (isFilterEntry(dsEntry)) {
            const datasets = await ZoweExplorerApiRegister.getMvsApi(uriInfo.profile).dataSet(dsEntry.filter["pattern"]);

            for (const ds of datasets.apiResponse?.items || []) {
                let tempEntry = dsEntry.entries.get(ds.dsname);
                if (tempEntry == null) {
                    if (ds.dsorg === "PO" || ds.dsorg === "PO-E") {
                        // Entry is a PDS
                        tempEntry = new PdsEntry(ds.dsname);
                    } else {
                        // Entry is a data set (VSAM, migrated, PS)
                        if (ds.dsorg === "VS") {
                            // VSAM
                            const dsName: string = ds.dsname;
                            const endPoint = dsName.includes(".DATA") ? dsName.indexOf(".DATA") : dsName.indexOf(".INDEX");
                            tempEntry = new DsEntry(endPoint > -1 ? dsName.substring(0, endPoint) : dsName);
                        } else if (ds.migr?.toUpperCase() === "YES") {
                            // migrated
                            tempEntry = new DsEntry(ds.dsname);
                        } else {
                            // PS
                            tempEntry = new DsEntry(ds.dsname);
                        }
                    }

                    if (tempEntry == null) {
                        continue;
                    }
                    dsEntry.entries.set(ds.dsname, tempEntry);
                }
                results.push([tempEntry.name, tempEntry instanceof DsEntry ? vscode.FileType.File : vscode.FileType.Directory]);
            }
        } else if (isDirectoryEntry(dsEntry)) {
            const members = await ZoweExplorerApiRegister.getMvsApi(uriInfo.profile).allMembers(dsEntry.name);

            for (const ds of members.apiResponse?.items || []) {
                let tempEntry = dsEntry.entries.get(ds.dsname);
                if (tempEntry == null) {
                    tempEntry = new MemberEntry(ds.member);
                    dsEntry.entries.set(ds.member, tempEntry);
                }
                results.push([tempEntry.name, vscode.FileType.File]);
            }
        }

        return results;
    }

    /**
     * Creates a directory entry in the provider at the given URI.
     * @param uri The URI that represents a new directory path
     */
    public createDirectory(uri: vscode.Uri, filter?: string): void {
        const basename = path.posix.basename(uri.path);
        const parent = this._lookupParentDirectory(uri, false);
        const profInfo =
            parent !== this.root
                ? {
                      profile: parent.metadata.profile,
                      // we can strip profile name from path because its not involved in API calls
                      path: parent.metadata.path.concat(`${basename}/`),
                  }
                : this._getInfoFromUri(uri);

        if (isFilterEntry(parent)) {
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
            { type: vscode.FileChangeType.Changed, uri: uri.with({ path: path.posix.resolve(uri.path, "..") }) },
            { type: vscode.FileChangeType.Created, uri }
        );
    }

    /**
     * Fetches a data set from the remote system at the given URI.
     * @param uri The URI pointing to a valid file to fetch from the remote system
     * @param editor (optional) An editor instance to reload if the URI is already open
     */
    public async fetchDatasetAtUri(uri: vscode.Uri, editor?: vscode.TextEditor | null): Promise<void> {
        const file = (await this._lookupAsFile(uri)) as DsEntry;
        // we need to fetch the contents from the mainframe since the file hasn't been accessed yet
        const bufBuilder = new BufferBuilder();
        const metadata = file.metadata ?? this._getInfoFromUri(uri);
        const resp = await ZoweExplorerApiRegister.getMvsApi(metadata.profile).getContents(metadata.dsname, {
            returnEtag: true,
            encoding: metadata.profile.profile?.encoding,
            responseTimeout: metadata.profile.profile?.responseTimeout,
            stream: bufBuilder,
        });

        file.data = bufBuilder.read() ?? new Uint8Array();
        file.etag = resp.apiResponse.etag;
        if (editor) {
            await this._updateResourceInEditor(uri);
        }
    }

    /**
     * Reads a data set at the given URI and fetches it from the remote system (if not yet accessed).
     * @param uri The URI pointing to a valid data set on the remote system
     * @returns The data set's contents as an array of bytes
     */
    public async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        const file = await this._lookupAsFile(uri);
        const profInfo = getInfoForUri(uri, Profiles.getInstance());

        if (profInfo.profile == null) {
            throw vscode.FileSystemError.FileNotFound(vscode.l10n.t("Profile does not exist for this file."));
        }

        // we need to fetch the contents from the mainframe if the file hasn't been accessed yet
        if (!file.wasAccessed) {
            await this.fetchDatasetAtUri(uri);
            file.wasAccessed = true;
        }

        return file.data;
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
            entry = new DsEntry(basename);
            entry.data = content;
            const profInfo = parent.metadata
                ? new DsEntryMetadata({
                      profile: parent.metadata.profile,
                      path: parent.metadata.path.concat(`${basename}`),
                  })
                : this._getInfoFromUri(uri);
            entry.metadata = profInfo;
            parent.entries.set(basename, entry);
            this._fireSoon({ type: vscode.FileChangeType.Created, uri });
        } else {
            const urlQuery = new URLSearchParams(uri.query);
            const shouldForceUpload = urlQuery.has("forceUpload");

            if (urlQuery.has("inDiff")) {
                // Allow users to edit files in diff view.
                // If in diff view, we don't want to make any API calls, just keep track of latest
                // changes to data.
                entry.data = content;
                entry.mtime = Date.now();
                entry.size = content.byteLength;
                return;
            }

            const mvsApi = ZoweExplorerApiRegister.getMvsApi(parent.metadata.profile);

            if (entry.wasAccessed || content.length > 0) {
                // Entry was already accessed, this is an update to the existing file.
                // Note that we don't want to call the API when making changes to the conflict file,
                // because the conflict file serves as the "remote" point of reference at the time of conflict,
                // and provides the data when comparing local/remote versions of a file.

                // Attempt to write data to remote system, and handle any conflicts from e-tag mismatch
                try {
                    const resp = await mvsApi.uploadBufferAsDs(Buffer.from(content), entry.metadata.path, {
                        etag: shouldForceUpload ? undefined : entry.etag,
                        returnEtag: true,
                    });
                    entry.etag = resp.apiResponse.etag;
                    entry.data = content;
                } catch (err) {
                    if (!err.message.includes("Rest API failure with HTTP(S) status 412")) {
                        return;
                    }
                    entry.data = content;
                    if ((await this._handleConflict(uri, entry)) != ConflictViewSelection.Overwrite) {
                        return;
                    }
                }
            } else {
                // if the entry hasn't been accessed yet, we don't need to call the API since we are just creating the file
                entry.data = content;
            }
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
        const uriInfo = getInfoForUri(uri, Profiles.getInstance());
        return new DsEntryMetadata({
            profile: uriInfo.profile,
            path: uri.path.substring(uriInfo.slashAfterProfilePos + 1),
        });
    }

    public delete(_uri: vscode.Uri, _options: { readonly recursive: boolean }): void | Thenable<void> {
        throw new Error("Method not implemented.");
    }

    // TODO
    public rename(_oldUri: vscode.Uri, _newUri: vscode.Uri, _options: { readonly overwrite: boolean }): void | Thenable<void> {
        throw new Error("Method not implemented.");
    }
}
