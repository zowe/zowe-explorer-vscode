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
import { DirEntry } from "./types";
import { BaseProvider, getInfoForUri } from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "../../ZoweExplorerApiRegister";
import { Profiles } from "../../Profiles";

class JobFSProvider extends BaseProvider implements vscode.FileSystemProvider {
    public onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]>;

    private static _instance: JobFSProvider;
    private constructor() {
        super();
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

        const profInfo = getInfoForUri(uri, Profiles.getInstance());
        await ZoweExplorerApiRegister.getJesApi(profInfo.profile).deleteJob(entry.name, entry.job.jobid);
        throw new Error("Method not implemented.");
    }

    // unsupported
    public rename(_oldUri: vscode.Uri, _newUri: vscode.Uri, _options: { readonly overwrite: boolean }): void | Thenable<void> {
        throw new Error("Renaming is not supported for jobs.");
    }
}
