import * as vscode from "vscode";
import { FsEntry, DirEntry, SpoolEntry } from "./types";
import { getInfoForUri } from "../../abstract/fs/utils";
import { ZoweExplorerApiRegister } from "../../ZoweExplorerApiRegister";

class JobFSProvider implements vscode.FileSystemProvider {
    private root = new DirEntry("");
    public onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]>;

    private static _instance: JobFSProvider;
    private constructor() {}

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
        // TODO: list spool files for job at URI
        throw new Error("Method not implemented.");
    }
    public createDirectory(uri: vscode.Uri): void | Thenable<void> {
        // TODO: Create entry that represents job with given URI
        throw new Error("Method not implemented.");
    }
    public readFile(uri: vscode.Uri): Uint8Array | Thenable<Uint8Array> {
        // TODO: Fetch contents of spool file and return
        throw new Error("Method not implemented.");
    }

    public writeFile(
        uri: vscode.Uri,
        content: Uint8Array,
        options: { readonly create: boolean; readonly overwrite: boolean }
    ): void | Thenable<void> {
        // TODO: Do not make API calls, just update contents for spool entry
        throw new Error("Method not implemented.");
    }

    public async delete(uri: vscode.Uri, options: { readonly recursive: boolean }): Promise<void> {
        const entry = this._lookup(uri, false);
        if (!(entry instanceof DirEntry) || entry.job == null) {
            // only support deleting jobs, not spool files
            return;
        }

        const profInfo = getInfoForUri(uri);
        await ZoweExplorerApiRegister.getJesApi(profInfo.profile).deleteJob(entry.name, entry.job.jobid);
        throw new Error("Method not implemented.");
    }

    // unsupported
    public rename(_oldUri: vscode.Uri, _newUri: vscode.Uri, _options: { readonly overwrite: boolean }): void | Thenable<void> {
        throw new Error("Renaming is not supported for jobs.");
    }

    private _lookup(uri: vscode.Uri, silent: false): FsEntry;
    private _lookup(uri: vscode.Uri, silent: boolean): FsEntry | undefined;
    private _lookup(uri: vscode.Uri, silent: boolean): FsEntry | undefined {
        const parts = uri.path.split("/");
        let entry: FsEntry = this.root;

        for (const part of parts) {
            if (!part) {
                continue;
            }
            let child: DirEntry | SpoolEntry | undefined;
            if (entry instanceof DirEntry) {
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
}
