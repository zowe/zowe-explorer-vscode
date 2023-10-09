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

export class File implements vscode.FileStat {
    public type: vscode.FileType;
    public ctime: number;
    public mtime: number;
    public size: number;

    public name: string;
    public data?: Uint8Array;

    public constructor(name: string) {
        this.type = vscode.FileType.File;
        this.ctime = Date.now();
        this.mtime = Date.now();
        this.size = 0;
        this.name = name;
    }
}

export class Directory implements vscode.FileStat {
    public type: vscode.FileType;
    public ctime: number;
    public mtime: number;
    public size: number;

    public name: string;
    public entries: Map<string, File | Directory>;

    public constructor(name: string) {
        this.type = vscode.FileType.Directory;
        this.ctime = Date.now();
        this.mtime = Date.now();
        this.size = 0;
        this.name = name;
        this.entries = new Map();
    }
}

export type Entry = File | Directory;

export class UssFSProvider implements vscode.FileSystemProvider {
    public root = new Directory("");

    // --- manage file metadata

    public stat(uri: vscode.Uri): vscode.FileStat {
        return this._lookup(uri, false);
    }

    /**
     * TODOs:
     * - Look into pre-fetching a directory level below the one given
     * - Should we support symlinks and can we use z/OSMF "report" option?
     */
    public readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
        /*
            1. Parse URI to get directory path for API endpoint
            2. Call API endpoint to get contents of directory from mainframe
            3. Iterate over response to build entries for this level
        */
        const entry = this._lookupAsDirectory(uri, false);
        const result: [string, vscode.FileType][] = [];
        for (const [name, child] of entry.entries) {
            result.push([name, child.type]);
        }
        return result;
    }

    // --- manage file contents

    public readFile(uri: vscode.Uri): Uint8Array {
        /*
            1. Parse URI to get file path for API endpoint
            2. Call API endpoint to get contents of file path from mainframe
            3. Process contents of file for binary/encoding etc
        */
        const data = this._lookupAsFile(uri, false).data;
        if (data) {
            return data;
        }
        throw vscode.FileSystemError.FileNotFound();
    }

    public writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean }): void {
        /*
            1. Parse URI to get file path for API endpoint
            2. Make API call after assigning data to File object
         */
        const basename = path.posix.basename(uri.path);
        const parent = this._lookupParentDirectory(uri);
        let entry = parent.entries.get(basename);
        if (entry instanceof Directory) {
            throw vscode.FileSystemError.FileIsADirectory(uri);
        }
        if (!entry && !options.create) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        if (entry && options.create && !options.overwrite) {
            throw vscode.FileSystemError.FileExists(uri);
        }
        if (!entry) {
            entry = new File(basename);
            parent.entries.set(basename, entry);
            this._fireSoon({ type: vscode.FileChangeType.Created, uri });
        }
        entry.mtime = Date.now();
        entry.size = content.byteLength;
        // TODO: we might want to use a callback or promise that returns data rather than saving the full contents in memory
        entry.data = content;

        // call API here

        this._fireSoon({ type: vscode.FileChangeType.Changed, uri });
    }

    // --- manage files/folders

    public rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): void {
        /*
            1. Build old path based on given URI
            2. Call API here with old path and new name for file/directory
        */
        if (!options.overwrite && this._lookup(newUri, true)) {
            throw vscode.FileSystemError.FileExists(newUri);
        }

        const entry = this._lookup(oldUri, false);
        const oldParent = this._lookupParentDirectory(oldUri);

        const newParent = this._lookupParentDirectory(newUri);
        const newName = path.posix.basename(newUri.path);

        oldParent.entries.delete(entry.name);
        entry.name = newName;
        newParent.entries.set(newName, entry);

        this._fireSoon({ type: vscode.FileChangeType.Deleted, uri: oldUri }, { type: vscode.FileChangeType.Created, uri: newUri });
    }

    public delete(uri: vscode.Uri): void {
        /*
            1. Determine path to delete based on given URI
            2. Call API to remove file/directory from mainframe
        */
        const dirname = uri.with({ path: path.posix.dirname(uri.path) });
        const basename = path.posix.basename(uri.path);
        const parent = this._lookupAsDirectory(dirname, false);
        if (!parent.entries.has(basename)) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        parent.entries.delete(basename);
        parent.mtime = Date.now();
        parent.size -= 1;
        this._fireSoon({ type: vscode.FileChangeType.Changed, uri: dirname }, { uri, type: vscode.FileChangeType.Deleted });
    }

    public createDirectory(uri: vscode.Uri): void {
        /*
            1. Parse URI to get desired directory path
            2. Call API endpoint to create directory on mainframe
        */
        const basename = path.posix.basename(uri.path);
        const dirname = uri.with({ path: path.posix.dirname(uri.path) });
        const parent = this._lookupAsDirectory(dirname, false);

        const entry = new Directory(basename);
        parent.entries.set(entry.name, entry);
        parent.mtime = Date.now();
        parent.size += 1;
        this._fireSoon({ type: vscode.FileChangeType.Changed, uri: dirname }, { type: vscode.FileChangeType.Created, uri });
    }

    // --- lookup

    private _lookup(uri: vscode.Uri, silent: false): Entry;
    private _lookup(uri: vscode.Uri, silent: boolean): Entry | undefined;
    private _lookup(uri: vscode.Uri, silent: boolean): Entry | undefined {
        /*
            1. Calls the API to get a list of files/folders at the level of the given URI
            2.
        */
        const parts = uri.path.split("/");
        let entry: Entry = this.root;
        for (const part of parts) {
            if (!part) {
                continue;
            }
            let child: Entry | undefined;
            if (entry instanceof Directory) {
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

    private _lookupAsDirectory(uri: vscode.Uri, silent: boolean): Directory {
        const entry = this._lookup(uri, silent);
        if (entry instanceof Directory) {
            return entry;
        }
        throw vscode.FileSystemError.FileNotADirectory(uri);
    }

    private _lookupAsFile(uri: vscode.Uri, silent: boolean): File {
        const entry = this._lookup(uri, silent);
        if (entry instanceof File) {
            return entry;
        }
        throw vscode.FileSystemError.FileIsADirectory(uri);
    }

    private _lookupParentDirectory(uri: vscode.Uri): Directory {
        const dirname = uri.with({ path: path.posix.dirname(uri.path) });
        return this._lookupAsDirectory(dirname, false);
    }

    // --- manage file events

    private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    private _bufferedEvents: vscode.FileChangeEvent[] = [];
    private _fireSoonHandle?: NodeJS.Timer;

    public readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

    public watch(_resource: vscode.Uri): vscode.Disposable {
        // ignore, fires for all changes...
        return new vscode.Disposable(() => {});
    }

    private _fireSoon(...events: vscode.FileChangeEvent[]): void {
        this._bufferedEvents.push(...events);

        if (this._fireSoonHandle) {
            clearTimeout(this._fireSoonHandle);
        }

        this._fireSoonHandle = setTimeout(() => {
            this._emitter.fire(this._bufferedEvents);
            this._bufferedEvents.length = 0;
        }, 5);
    }
}
