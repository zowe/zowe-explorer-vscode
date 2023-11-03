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
import { BaseProvider, DirEntry, EntryMetadata, getInfoForUri } from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "../../ZoweExplorerApiRegister";
import { Profiles } from "../../Profiles";
import { isJobEntry, isSpoolEntry } from "./utils";
import * as path from "path";
import { JobEntry, SpoolEntry } from "./types";
import { TextEncoder } from "util";

export class JobFSProvider extends BaseProvider implements vscode.FileSystemProvider {
    public onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]>;
    private _textEncoder: TextEncoder;

    private static _instance: JobFSProvider;
    private constructor() {
        super();
        this.root = new DirEntry("");
        this._textEncoder = new TextEncoder();
    }

    public static get instance(): JobFSProvider {
        if (!JobFSProvider._instance) {
            JobFSProvider._instance = new JobFSProvider();
        }

        return JobFSProvider._instance;
    }

    public watch(uri: vscode.Uri, options: { readonly recursive: boolean; readonly excludes: readonly string[] }): vscode.Disposable {
        throw new Error("Method not implemented.");
    }

    public stat(uri: vscode.Uri): vscode.FileStat | Thenable<vscode.FileStat> {
        return this._lookup(uri, false);
    }
    public readDirectory(uri: vscode.Uri): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
        const uriInfo = getInfoForUri(uri, Profiles.getInstance());
        const restOfPath = uri.path.substring(uriInfo.slashAfterProfilePos + 1);
        //

        // TODO: list spool files for job at URI
        throw new Error("Method not implemented.");
    }
    public createDirectory(uri: vscode.Uri): void | Thenable<void> {
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

        const entry = new JobEntry(basename);
        entry.metadata = profInfo;
        parent.entries.set(entry.name, entry);
        parent.mtime = Date.now();
        parent.size += 1;
        this._fireSoon({ type: vscode.FileChangeType.Changed, uri: dirname }, { type: vscode.FileChangeType.Created, uri });
    }

    public async fetchSpoolAtUri(uri: vscode.Uri, editor?: vscode.TextEditor | null): Promise<void> {
        const spoolEntry = this._lookupAsFile(uri, false) as SpoolEntry;

        // get job entry so we have info from the job document
        const parentUri = uri.with({
            path: path.dirname(uri.path),
        });
        const jobEntry = this._lookupAsDirectory(parentUri, false) as JobEntry;

        const uriInfo = getInfoForUri(uri, Profiles.getInstance());
        // we need to fetch the contents from the mainframe since the file hasn't been accessed yet
        const bufBuilder = new BufferBuilder();
        const filePath = uri.path.substring(uriInfo.slashAfterProfilePos + 1);
        const metadata = spoolEntry.metadata ?? this._getInfoFromUri(uri);
        const resp = await ZoweExplorerApiRegister.getJesApi(metadata.profile).getSpoolContentById(
            jobEntry.job.jobname,
            jobEntry.job.jobid,
            spoolEntry.spool.id
        );

        spoolEntry.data = this._textEncoder.encode(resp);
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

        // we need to fetch the contents from the mainframe if the file hasn't been accessed yet
        if (!file.wasAccessed) {
            await this.fetchSpoolAtUri(uri);
            file.wasAccessed = true;
        }

        return file.data;
    }

    public writeFile(
        uri: vscode.Uri,
        content: Uint8Array,
        options: { readonly create: boolean; readonly overwrite: boolean }
    ): void | Thenable<void> {
        // TODO: Do not make API calls, just update contents for spool entry
        const basename = path.posix.basename(uri.path);
        const parent = this._lookupParentDirectory(uri);
        let entry = parent.entries.get(basename);
        if (!isSpoolEntry(entry)) {
            throw vscode.FileSystemError.FileIsADirectory(uri);
        }
        if (!entry && !options.create) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        if (entry && options.create && !options.overwrite) {
            throw vscode.FileSystemError.FileExists(uri);
        }

        if (!entry) {
            entry = new SpoolEntry(basename);
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
        } else {
            entry.data = content;
            entry.mtime = Date.now();
            entry.size = content.byteLength;
        }

        throw new Error("Method not implemented.");
    }

    private _getInfoFromUri(uri: vscode.Uri): EntryMetadata {
        const uriInfo = getInfoForUri(uri, Profiles.getInstance());
        return {
            profile: uriInfo.profile,
            path: uri.path.substring(uriInfo.slashAfterProfilePos + 1),
        };
    }

    public async delete(uri: vscode.Uri, _options: { readonly recursive: boolean }): Promise<void> {
        const entry = this._lookup(uri, false);
        if (!isJobEntry(entry)) {
            // only support deleting jobs, not spool files
            return;
        }

        const profInfo = getInfoForUri(uri, Profiles.getInstance());
        await ZoweExplorerApiRegister.getJesApi(profInfo.profile).deleteJob(entry.name, entry.job.jobid);
        throw new Error("Method not implemented.");
    }

    // unsupported
    public rename(_oldUri: vscode.Uri, _newUri: vscode.Uri, _options: { readonly overwrite: boolean }): void | Thenable<void> {
        throw new Error("Renaming is not supported for jobs.");
    }
}
