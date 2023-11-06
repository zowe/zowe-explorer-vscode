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

import { BaseProvider, BufferBuilder, ConflictViewSelection, DirEntry, getInfoForUri, isDirectoryEntry, FilterEntry } from "@zowe/zowe-explorer-api";
import * as path from "path";
import * as vscode from "vscode";
import { ZoweExplorerApiRegister } from "../../ZoweExplorerApiRegister";
import * as nls from "vscode-nls";

// Set up localization
import { DsEntry, DsEntryMetadata, MemberEntry, PdsEntry } from "./types";
import { Profiles } from "../../Profiles";
import { isFilterEntry } from "./utils";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

export class DatasetFSProvider extends BaseProvider implements vscode.FileSystemProvider {
    public onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]>;

    private static _instance: DatasetFSProvider;
    private constructor() {
        super();
        this.root = new DirEntry("");
    }

    /**
     * @returns the USS FileSystemProvider singleton instance
     */
    public static get instance(): DatasetFSProvider {
        if (!DatasetFSProvider._instance) {
            DatasetFSProvider._instance = new DatasetFSProvider();
        }

        return DatasetFSProvider._instance;
    }

    public watch(uri: vscode.Uri, options: { readonly recursive: boolean; readonly excludes: readonly string[] }): vscode.Disposable {
        throw new Error("Method not implemented.");
    }

    public stat(uri: vscode.Uri): vscode.FileStat | Thenable<vscode.FileStat> {
        return this._lookup(uri, false);
    }

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
                        tempEntry = new PdsEntry(ds.dsname);
                    } else {
                        tempEntry = new DsEntry(ds.dsname);
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

    public createDirectory(uri: vscode.Uri, filter?: string): void {
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
        this._fireSoon({ type: vscode.FileChangeType.Changed, uri: dirname }, { type: vscode.FileChangeType.Created, uri });
    }

    public async fetchDatasetAtUri(uri: vscode.Uri, editor?: vscode.TextEditor | null): Promise<void> {
        const file = this._lookupAsFile(uri, false) as DsEntry;
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
            // This is a hacky method and does not work for editors that aren't the active one,
            // so we can make VSCode switch the active document to that tab and then "revert the file" to show latest contents
            await vscode.commands.executeCommand("vscode.open", uri);
            // Note that the command only affects files that are not dirty
            // TODO: find a better method to reload editor tab with new contents
            vscode.commands.executeCommand("workbench.action.files.revert");
        }
    }

    public async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        // TODO: Fetch contents of spool file and return
        const file = this._lookupAsFile(uri, false);
        const profInfo = getInfoForUri(uri, Profiles.getInstance());

        if (!file.isConflictFile && profInfo.profile == null) {
            // TODO: We might be able to support opening these links outside of Zowe Explorer,
            // but at the moment, the session must be initialized first within the USS tree
            throw vscode.FileSystemError.FileNotFound(localize("localize.uss.profileNotFound", "Profile does not exist for this file."));
        }

        // we need to fetch the contents from the mainframe if the file hasn't been accessed yet
        if (!file.wasAccessed) {
            await this.fetchDatasetAtUri(uri);
            file.wasAccessed = true;
        }

        return file.data;
    }

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
            const mvsApi = ZoweExplorerApiRegister.getMvsApi(parent.metadata.profile);

            if (entry.wasAccessed || content.length > 0) {
                // Entry was already accessed, this is an update to the existing file.
                // Note that we don't want to call the API when making changes to the conflict file,
                // because the conflict file serves as the "remote" point of reference at the time of conflict,
                // and provides the data when comparing local/remote versions of a file.

                // Attempt to write data to remote system, and handle any conflicts from e-tag mismatch
                try {
                    const resp = await mvsApi.uploadBufferAsDs(Buffer.from(content), entry.metadata.path, {
                        etag: entry.forceUpload ? undefined : entry.etag,
                        returnEtag: true,
                    });
                    entry.etag = resp.apiResponse.etag;
                } catch (err) {
                    if (err.message.includes("Rest API failure with HTTP(S) status 412")) {
                        if (
                            (await this._handleConflict(mvsApi, {
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

    // unsupported
    public rename(_oldUri: vscode.Uri, _newUri: vscode.Uri, _options: { readonly overwrite: boolean }): void | Thenable<void> {
        throw new Error("Method not implemented.");
    }
}
