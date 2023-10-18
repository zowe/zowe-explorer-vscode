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

import { Utilities, imperative } from "@zowe/cli";
import { FileAttributes } from "@zowe/zowe-explorer-api";
import * as path from "path";
import * as vscode from "vscode";
import { Profiles } from "../Profiles";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { UssFileTree, UssFileType } from "./FileStructure";
import { Duplex } from "stream";

export type FileEntryMetadata = {
    profile: imperative.IProfileLoaded;
    ussPath: string;
};

export interface UssEntry {
    name: string;
    metadata: FileEntryMetadata;
    type: vscode.FileType;
    wasAccessed: boolean;
}

export class UssFile implements UssEntry, vscode.FileStat {
    public name: string;
    public metadata: FileEntryMetadata;
    public type: vscode.FileType;
    public wasAccessed: boolean;

    public ctime: number;
    public mtime: number;
    public size: number;
    public binary: boolean;
    public data?: Uint8Array;
    public etag?: string;
    public attributes: FileAttributes;

    public constructor(name: string) {
        this.type = vscode.FileType.File;
        this.ctime = Date.now();
        this.mtime = Date.now();
        this.size = 0;
        this.name = name;
        this.binary = false;
        this.wasAccessed = false;
    }
}

export class UssDirectory implements UssEntry, vscode.FileStat {
    public name: string;
    public metadata: FileEntryMetadata;
    public type: vscode.FileType;
    public wasAccessed: boolean;

    public ctime: number;
    public mtime: number;
    public size: number;
    public entries: Map<string, UssFile | UssDirectory>;

    public constructor(name: string) {
        this.type = vscode.FileType.Directory;
        this.ctime = Date.now();
        this.mtime = Date.now();
        this.size = 0;
        this.name = name;
        this.entries = new Map();
        this.wasAccessed = false;
    }
}

export type Entry = UssFile | UssDirectory;

export class UssFSProvider implements vscode.FileSystemProvider {
    public root = new UssDirectory("");
    public session: imperative.AbstractSession;

    private static inst: UssFSProvider;
    private constructor() {}

    public static get instance(): UssFSProvider {
        if (!UssFSProvider.inst) {
            UssFSProvider.inst = new UssFSProvider();
        }

        return UssFSProvider.inst;
    }

    // --- manage file metadata

    public stat(uri: vscode.Uri): vscode.FileStat {
        return this._lookup(uri, false);
    }

    private _getInfoFromUri(uri: vscode.Uri): {
        profile: imperative.IProfileLoaded;
        ussPath: string;
    } {
        const slashAfterProfile = uri.path.indexOf("/", 1);
        const isRoot = slashAfterProfile === -1;
        const startPathPos = isRoot ? uri.path.length : slashAfterProfile;
        const sessionName = uri.path.substring(1, startPathPos);
        const loadedProfile = Profiles.getInstance().loadNamedProfile(sessionName);

        return { profile: loadedProfile, ussPath: isRoot ? "/" : uri.path.substring(slashAfterProfile) };
    }

    private relocateEntry(oldUri: vscode.Uri, newUri: vscode.Uri, newUssPath: string): void {
        const entry = this._lookup(oldUri, false);
        if (!entry) {
            return;
        }

        const oldParentUri = vscode.Uri.parse(oldUri.path.substring(0, oldUri.path.lastIndexOf("/")));
        const oldParent = this._lookupAsDirectory(oldParentUri, false);

        const parentUri = vscode.Uri.parse(newUri.path.substring(0, newUri.path.lastIndexOf("/")));
        const newParent = this._lookupAsDirectory(parentUri, false);

        if (!oldParent || !newParent) {
            return;
        }

        oldParent.entries.delete(entry.name);
        entry.metadata.ussPath = newUssPath;
        newParent.entries.set(entry.name, entry);
    }

    public async move(oldUri: vscode.Uri, newUri: vscode.Uri): Promise<void> {
        const info = this._getInfoFromUri(newUri);
        const session = ZoweExplorerApiRegister.getUssApi(info.profile).getSession();
        const oldInfo = this._getInfoFromUri(oldUri);

        await Utilities.putUSSPayload(session, info.ussPath, {
            request: "move",
            from: oldInfo.ussPath,
        });
        this.relocateEntry(oldUri, newUri, info.ussPath);
    }

    /**
     * TODOs:
     * - Look into pre-fetching a directory level below the one given
     * - Should we support symlinks and can we use z/OSMF "report" option?
     */
    public async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        /*
            1. Parse URI to get directory path for API endpoint
            2. Call API endpoint to get contents of directory from mainframe
            3. Iterate over response to build entries for this level
        */
        const entry = this._lookupAsDirectory(uri, false);

        const result: [string, vscode.FileType][] = [];
        // if this entry has not been accessed before, grab its file list
        // for use in the breadcrumbs
        if (!entry.wasAccessed) {
            const response = await ZoweExplorerApiRegister.getUssApi(entry.metadata.profile).fileList(entry.metadata.ussPath);
            for (const item of response.apiResponse.items) {
                if (item.name === "." || item.name === ".." || entry.entries.has(item.name)) {
                    continue;
                }
                if (item.mode.startsWith("d")) {
                    entry.entries.set(item.name, new UssDirectory(item.name));
                } else {
                    entry.entries.set(item.name, new UssFile(item.name));
                }
            }
        }

        for (const [name, child] of entry.entries) {
            result.push([name, child.type]);
        }
        return result;
    }

    // --- manage file contents

    public async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        /*
            1. Check if data exists on file entry
            2. Call API endpoint to get contents of file path from mainframe if it does not exist
            3. Process contents of file for binary/encoding etc
        */
        const file = this._lookupAsFile(uri, false);
        const startPathPos = uri.path.indexOf("/", 1);
        const sessionName = uri.path.substring(1, startPathPos);
        const loadedProfile = Profiles.getInstance().loadNamedProfile(sessionName);
        //const session = SessionMap.instance.getSession(sessionName);

        if (loadedProfile == null) {
            // TODO: We can check to see if the session exists from the config data, so we can still
            // open `uss:/` links without having the session present in the USS tree
            throw vscode.FileSystemError.FileNotFound("Session does not exist for this file.");
        }

        if (!file.wasAccessed) {
            // we need to fetch the contents from the mainframe since the file hasn't been accessed yet

            class BufferBuilder extends Duplex {
                private chunks: Uint8Array[];

                public constructor() {
                    super();
                    this.chunks = [];
                }

                public _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error) => void): void {
                    this.chunks.push(chunk);
                    callback();
                }

                public _read(size: number): void {
                    const concatBuf = Buffer.concat(this.chunks);
                    this.push(concatBuf);
                    this.push(null);
                }
            }

            const bufBuilder = new BufferBuilder();
            const filePath = uri.path.substring(startPathPos);
            const resp = await ZoweExplorerApiRegister.getUssApi(loadedProfile).getContents(filePath, {
                returnEtag: true,
                encoding: loadedProfile.profile?.encoding,
                responseTimeout: loadedProfile.profile?.responseTimeout,
                stream: bufBuilder,
            });

            file.data = bufBuilder.read();
            file.etag = resp.apiResponse.etag;
            file.wasAccessed = true;
        }

        return file.data;
    }

    public async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean }): Promise<void> {
        /*
            1. Parse URI to get file path for API endpoint
            2. Make API call after assigning data to File object
         */
        const basename = path.posix.basename(uri.path);
        const parent = this._lookupParentDirectory(uri);
        let entry = parent.entries.get(basename);
        if (entry instanceof UssDirectory) {
            throw vscode.FileSystemError.FileIsADirectory(uri);
        }
        if (!entry && !options.create) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        if (entry && options.create && !options.overwrite) {
            throw vscode.FileSystemError.FileExists(uri);
        }
        if (!entry) {
            const profInfo = parent.metadata
                ? {
                      profile: parent.metadata.profile,
                      ussPath: parent.metadata.ussPath.concat(`${basename}`),
                  }
                : this._getInfoFromUri(uri);
            entry = new UssFile(basename);
            entry.metadata = profInfo;
            entry.data = content;
            parent.entries.set(basename, entry);
            this._fireSoon({ type: vscode.FileChangeType.Created, uri });
        } else {
            if (entry.wasAccessed) {
                // entry was already accessed, this is an update to the existing file
                // eslint-disable-next-line no-useless-catch
                try {
                    await ZoweExplorerApiRegister.getUssApi(parent.metadata.profile).uploadBufferAsFile(
                        Buffer.from(content),
                        entry.metadata.ussPath,
                        { etag: entry.etag }
                    );
                } catch (err) {
                    // TODO: conflict management
                    // if (err.message.includes("Rest API failure with HTTP(S) status 412")) {
                    //     Gui.errorMessage("There is a newer version of this file on the mainframe. Compare with remote contents or overwrite?");
                    // }
                    throw err;
                }
                entry.data = content;
            } else {
                entry.data = content;
            }
            // if the entry hasn't been accessed yet, we don't need to call the API since we are just creating the file
        }
        entry.mtime = Date.now();
        entry.size = content.byteLength;

        // call API here

        this._fireSoon({ type: vscode.FileChangeType.Changed, uri });
    }

    // --- manage files/folders

    private updateChildPaths(entry: UssDirectory): void {
        // update child entries
        for (const child of entry.entries.values()) {
            const isDir = child instanceof UssDirectory;
            child.metadata.ussPath = entry.metadata.ussPath.concat(`${child.name}${isDir ? "/" : ""}`);
            if (isDir) {
                this.updateChildPaths(child);
            }
        }
    }

    public async rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): Promise<void> {
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

        // rename entry at this level only
        const isDir = entry instanceof UssDirectory;
        const entryPath = isDir ? entry.metadata.ussPath.slice(0, -1) : entry.metadata.ussPath;
        const lastSlashInPath = entryPath.lastIndexOf("/");
        const newPath = entryPath.substring(0, lastSlashInPath + 1).concat(newName);

        try {
            await ZoweExplorerApiRegister.getUssApi(entry.metadata.profile).rename(entry.metadata.ussPath, newPath);
            entry.metadata.ussPath = newPath;
            if (entry instanceof UssDirectory) {
                this.updateChildPaths(entry);
            }
        } catch (err) {
            // todo: error handling
        }
        newParent.entries.set(newName, entry);

        this._fireSoon({ type: vscode.FileChangeType.Deleted, uri: oldUri }, { type: vscode.FileChangeType.Created, uri: newUri });
    }

    public async delete(uri: vscode.Uri): Promise<void> {
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

        // get the entry before deleting the URI
        const entryToDelete = this._lookup(uri, false);

        parent.entries.delete(basename);
        parent.mtime = Date.now();
        parent.size -= 1;

        await ZoweExplorerApiRegister.getUssApi(parent.metadata.profile).delete(
            entryToDelete.metadata.ussPath,
            entryToDelete instanceof UssDirectory
        );

        this._fireSoon({ type: vscode.FileChangeType.Changed, uri: dirname }, { uri, type: vscode.FileChangeType.Deleted });
    }

    public async copyEx(
        source: vscode.Uri,
        destination: vscode.Uri,
        options: { readonly overwrite: boolean; readonly tree: UssFileTree }
    ): Promise<void> {
        const destInfo = this._getInfoFromUri(destination);
        const sourceInfo = this._getInfoFromUri(source);
        const api = ZoweExplorerApiRegister.getUssApi(destInfo.profile);

        const hasCopyApi = api.copy != null;

        const apiResponse = await api.fileList(destInfo.ussPath);
        const fileList = apiResponse.apiResponse?.items;

        // Check root path for conflicts before pasting nodes in this path
        let fileName = path.basename(sourceInfo.ussPath);
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
            fileName = dupName;
        }
        const outputPath = `${destInfo.ussPath}/${fileName}`;

        if (hasCopyApi && sourceInfo.profile.profile === destInfo.profile.profile) {
            await api.copy(outputPath, {
                from: sourceInfo.ussPath,
                recursive: options.tree.type === UssFileType.Directory,
                overwrite: options.overwrite ?? true,
            });
        } else if (options.tree.type === UssFileType.Directory) {
            // Not all APIs respect the recursive option, so it's best to
            // recurse within this operation to avoid missing files/folders
            await api.create(outputPath, "directory");
            if (options.tree.children) {
                for (const child of options.tree.children) {
                    await this.copyEx(child.localUri, vscode.Uri.parse(`uss:${outputPath}`), { ...options, tree: child });
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

    public createDirectory(uri: vscode.Uri): void {
        /*
            1. Parse URI to get desired directory path
            2. TODO: Call API endpoint to create directory on mainframe
        */
        const basename = path.posix.basename(uri.path);
        const dirname = uri.with({ path: path.posix.dirname(uri.path) });
        const parent = this._lookupAsDirectory(dirname, false);
        const profInfo = parent.metadata
            ? {
                  profile: parent.metadata.profile,
                  // we can strip profile name from path because its not involved in API calls
                  ussPath: parent.metadata.ussPath.concat(`${basename}/`),
              }
            : this._getInfoFromUri(uri);

        const entry = new UssDirectory(basename);
        entry.metadata = profInfo;
        parent.entries.set(entry.name, entry);
        parent.mtime = Date.now();
        parent.size += 1;
        this._fireSoon({ type: vscode.FileChangeType.Changed, uri: dirname }, { type: vscode.FileChangeType.Created, uri });
    }

    // --- lookup

    private _lookup(uri: vscode.Uri, silent: false): Entry;
    private _lookup(uri: vscode.Uri, silent: boolean): Entry | undefined;
    private _lookup(uri: vscode.Uri, silent: boolean): Entry | undefined {
        const parts = uri.path.split("/");
        let entry: Entry = this.root;

        for (const part of parts) {
            if (!part) {
                continue;
            }
            let child: Entry | undefined;
            if (entry instanceof UssDirectory) {
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

    private _lookupAsDirectory(uri: vscode.Uri, silent: boolean): UssDirectory {
        const entry = this._lookup(uri, silent);
        if (entry instanceof UssDirectory) {
            return entry;
        }
        throw vscode.FileSystemError.FileNotADirectory(uri);
    }

    private _lookupAsFile(uri: vscode.Uri, silent: boolean): UssFile {
        const entry = this._lookup(uri, silent);
        if (entry instanceof UssFile) {
            return entry;
        }
        throw vscode.FileSystemError.FileIsADirectory(uri);
    }

    private _lookupParentDirectory(uri: vscode.Uri): UssDirectory {
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
