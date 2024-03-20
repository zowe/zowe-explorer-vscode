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
import {
    BaseProvider,
    BufferBuilder,
    buildUniqueSpoolName,
    DirEntry,
    EntryMetadata,
    FilterEntry,
    getInfoForUri,
    Gui,
    isFilterEntry,
    isJobEntry,
    isSpoolEntry,
    IZoweJobTreeNode,
    JobEntry,
    JobFilter,
    SpoolEntry,
} from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { Profiles } from "../Profiles";
import * as path from "path";
import { IJob, IJobFile } from "@zowe/zos-jobs-for-zowe-sdk";
import * as contextually from "../shared/context";

export class JobFSProvider extends BaseProvider implements vscode.FileSystemProvider {
    private static _instance: JobFSProvider;
    private constructor() {
        super(Profiles.getInstance());
        this.root = new DirEntry("");
    }

    public static get instance(): JobFSProvider {
        if (!JobFSProvider._instance) {
            JobFSProvider._instance = new JobFSProvider();
        }

        return JobFSProvider._instance;
    }

    public watch(uri: vscode.Uri, options: { readonly recursive: boolean; readonly excludes: readonly string[] }): vscode.Disposable {
        // ignore, fires for all changes...
        return new vscode.Disposable(() => {});
    }

    public static async refreshSpool(node: IZoweJobTreeNode): Promise<void> {
        if (!contextually.isSpoolFile(node)) {
            return;
        }
        const statusBarMsg = Gui.setStatusBarMessage(vscode.l10n.t("$(sync~spin) Fetching spool file..."));
        await JobFSProvider.instance.fetchSpoolAtUri(node.resourceUri);
        statusBarMsg.dispose();
    }

    /**
     * Returns file statistics about a given URI.
     * @param uri A URI that must exist as an entry in the provider
     * @returns A structure containing file type, time, size and other metrics
     */
    public stat(uri: vscode.Uri): vscode.FileStat | Thenable<vscode.FileStat> {
        const entry = this._lookup(uri, false);
        if (isSpoolEntry(entry)) {
            return { ...entry, permissions: vscode.FilePermission.Readonly };
        }

        return entry;
    }

    /**
     * Reads a directory located at the given URI.
     * @param uri A valid URI within the provider
     * @returns An array of tuples containing each entry name and type
     */
    public async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        const fsEntry = this._lookupAsDirectory(uri, false) as FilterEntry | JobEntry;
        const uriInfo = getInfoForUri(uri, Profiles.getInstance());
        const results: [string, vscode.FileType][] = [];

        const jesApi = ZoweExplorerApiRegister.getJesApi(uriInfo.profile);
        if (isFilterEntry(fsEntry)) {
            if (!jesApi.getJobsByParameters) {
                throw new Error(vscode.l10n.t("Failed to fetch jobs: getJobsByParameters is not implemented for this session's JES API."));
            }

            const jobFiles = await jesApi.getJobsByParameters({
                owner: fsEntry.filter["owner"] ?? "*",
                status: fsEntry.filter["status"] ?? "*",
                prefix: fsEntry.filter["prefix"] ?? "*",
            });
            for (const job of jobFiles) {
                if (!fsEntry.entries.has(job.jobid)) {
                    const newJob = new JobEntry(job.jobid);
                    newJob.job = job;
                    fsEntry.entries.set(job.jobid, newJob);
                }
            }
        } else if (isJobEntry(fsEntry)) {
            const spoolFiles = await jesApi.getSpoolFiles(fsEntry.job.jobname, fsEntry.job.jobid);
            for (const spool of spoolFiles) {
                const spoolName = buildUniqueSpoolName(spool);
                if (!fsEntry.entries.has(spoolName)) {
                    const newSpool = new SpoolEntry(spoolName);
                    newSpool.spool = spool;
                    fsEntry.entries.set(spoolName, newSpool);
                }
            }
        }

        for (const entry of fsEntry.entries) {
            results.push([entry[0], entry[1].type]);
        }

        return results;
    }

    /**
     * Updates a filter entry in the FileSystem with the given job filter.
     * @param uri The URI associated with the filter entry to update
     * @param filter The filter info to assign to the filter entry (owner, status, prefix)
     */
    public updateFilterForUri(uri: vscode.Uri, filter: JobFilter): void {
        const filterEntry = this._lookupAsDirectory(uri, false);
        if (!isFilterEntry(filterEntry)) {
            return;
        }

        filterEntry.filter = {
            ...filter,
        };
    }

    /**
     * Creates a directory entry (for jobs/profiles) in the provider at the given URI.
     * @param uri The URI that represents a new directory path
     * @param options Options for creating the directory
     * - `isFilter` - (optional) Whether the directory entry is considered a "filter entry" (profile level) in the FileSystem
     * - `job` - (optional) The job document associated with the "job entry" in the FileSystem
     */
    public createDirectory(uri: vscode.Uri, options?: { isFilter?: boolean; job?: IJob }): void {
        const basename = path.posix.basename(uri.path);
        const parent = this._lookupParentDirectory(uri, false);

        const EntryType = options?.isFilter ? FilterEntry : JobEntry;
        const entry = new EntryType(basename);
        if (isJobEntry(entry) && options?.job) {
            entry.job = options.job;
        }

        const profInfo =
            parent !== this.root
                ? {
                      profile: parent.metadata.profile,
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

    /**
     * Fetches a file from the remote system at the given URI.
     * @param uri The URI pointing to a valid file to fetch from the remote system
     * @param editor (optional) An editor instance to reload if the URI is already open
     */
    public async fetchSpoolAtUri(uri: vscode.Uri, editor?: vscode.TextEditor | null): Promise<SpoolEntry> {
        const spoolEntry = this._lookupAsFile(uri) as SpoolEntry;

        // we need to fetch the contents from the mainframe since the file hasn't been accessed yet
        const bufBuilder = new BufferBuilder();

        await ZoweExplorerApiRegister.getJesApi(spoolEntry.metadata.profile).downloadSingleSpool({
            jobFile: spoolEntry.spool,
            stream: bufBuilder,
        });

        this._fireSoon({ type: vscode.FileChangeType.Changed, uri });
        spoolEntry.data = bufBuilder.read();
        if (editor) {
            await this._updateResourceInEditor(uri);
        }

        return spoolEntry;
    }

    /**
     * Reads a spool file at the given URI and fetches it from the remote system (if not yet accessed).
     * @param uri The URI pointing to a valid spool file to fetch from the remote system
     * @returns The spool file's contents as an array of bytes
     */
    public async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        const spoolEntry = this._lookupAsFile(uri) as SpoolEntry;
        if (!spoolEntry.wasAccessed) {
            await this.fetchSpoolAtUri(uri);
            spoolEntry.wasAccessed = true;
        }

        return spoolEntry.data;
    }

    /**
     * Attempts to write a file at the given URI.
     * @param uri The URI pointing to a file entry that should be written
     * @param content The content to write to the file, as an array of bytes
     * @param options Options for writing the file
     * - `create` - Creates the file if it does not exist
     * - `overwrite` - Overwrites the content if the file exists
     * - `name` - (optional) Provide a name for the file to write in the FileSystem
     * - `spool` - (optional) The "spool document" containing data from the API
     */
    public writeFile(
        uri: vscode.Uri,
        content: Uint8Array,
        options: { readonly create: boolean; readonly overwrite: boolean; readonly name?: string; readonly spool?: IJobFile }
    ): void {
        const basename = path.posix.basename(uri.path);
        const spoolName = options.name ?? basename;
        const parent = this._lookupParentDirectory(uri);
        let entry = parent.entries.get(spoolName) as JobEntry | SpoolEntry;
        if (isJobEntry(entry)) {
            throw vscode.FileSystemError.FileIsADirectory(uri);
        }
        if (!entry && !options.create) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        if (entry && options.create && !options.overwrite) {
            throw vscode.FileSystemError.FileExists(uri);
        }

        if (!entry) {
            entry = new SpoolEntry(spoolName);
            entry.spool = options.spool;
            entry.data = content;
            entry.metadata = {
                ...parent.metadata,
                path: path.posix.join(parent.metadata.path, basename),
            };
            parent.entries.set(spoolName, entry);
            this._fireSoon({ type: vscode.FileChangeType.Created, uri });
        } else {
            entry.data = content;
            entry.mtime = Date.now();
            entry.size = content.byteLength;
        }
    }

    /**
     * Deletes a spool file or job at the given URI.
     * @param uri The URI that points to the file/folder to delete
     * @param options Options for deleting the spool file or job
     * - `deleteRemote` - Deletes the job from the remote system if set to true.
     */
    public async delete(uri: vscode.Uri, options: { readonly recursive: boolean; readonly deleteRemote: boolean }): Promise<void> {
        const entry = this._lookup(uri, false);
        const isJob = isJobEntry(entry);
        if (!isJob) {
            return;
        }

        const parent = this._lookupParentDirectory(uri, false);

        const profInfo = getInfoForUri(uri, Profiles.getInstance());

        if (options.deleteRemote) {
            await ZoweExplorerApiRegister.getJesApi(profInfo.profile).deleteJob(entry.job.jobname, entry.job.jobid);
        }
        parent.entries.delete(entry.name);
        this._fireSoon({ type: vscode.FileChangeType.Deleted, uri });
    }

    // unsupported
    public rename(_oldUri: vscode.Uri, _newUri: vscode.Uri, _options: { readonly overwrite: boolean }): void | Thenable<void> {
        throw new Error("Renaming is not supported for jobs.");
    }

    /**
     * Returns metadata about the spool file or job entry from the context of z/OS.
     * @param uri A URI with a path in the format `zowe-*:/{lpar_name}/{full_path}?`
     * @returns Metadata for the URI that contains the profile instance and resource path
     */
    private _getInfoFromUri(uri: vscode.Uri): EntryMetadata {
        const uriInfo = getInfoForUri(uri, Profiles.getInstance());
        return {
            profile: uriInfo.profile,
            path: uriInfo.isRoot ? "/" : uri.path.substring(uriInfo.slashAfterProfilePos),
        };
    }
}
