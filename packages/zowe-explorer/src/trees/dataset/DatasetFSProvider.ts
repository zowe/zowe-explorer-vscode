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
    ZoweExplorerApiType,
    AuthHandler,
    Types,
    imperative,
} from "@zowe/zowe-explorer-api";
import { IZosFilesResponse } from "@zowe/zos-files-for-zowe-sdk";
import { Profiles } from "../../configuration/Profiles";
import { ZoweExplorerApiRegister } from "../../extending/ZoweExplorerApiRegister";
import { ZoweLogger } from "../../tools/ZoweLogger";
import * as dayjs from "dayjs";
import { DatasetUtils } from "./DatasetUtils";
import { AuthUtils } from "../../utils/AuthUtils";
import { ProfilesUtils } from "../../utils/ProfilesUtils";

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
        let isFetching = false;

        if (uri.path.includes("/.vscode/")) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }

        if (uri.query) {
            const queryParams = new URLSearchParams(uri.query);
            if (queryParams.has("conflict")) {
                return { ...this.lookup(uri, false), permissions: vscode.FilePermission.Readonly };
            } else if (queryParams.has("inDiff")) {
                return this.lookup(uri, false);
            }
            isFetching = queryParams.has("fetch") && queryParams.get("fetch") === "true";
        }

        const uriInfo = FsAbstractUtils.getInfoForUri(uri, Profiles.getInstance());

        const session = ZoweExplorerApiRegister.getInstance().getCommonApi(uriInfo.profile).getSession(uriInfo.profile);
        if (
            isFetching &&
            (session.ISession.type === imperative.SessConstants.AUTH_TYPE_NONE ||
                (session.ISession.type === imperative.SessConstants.AUTH_TYPE_TOKEN && !uriInfo.profile.profile.tokenValue))
        ) {
            throw vscode.FileSystemError.Unavailable("Profile is using token type but missing a token");
        }

        const entry = isFetching ? await this.remoteLookupForResource(uri) : this.lookup(uri, false);

        // Do not perform remote lookup for profile or directory URIs; the code below is for change detection on PS or PDS members only
        if (uriInfo.isRoot || FsAbstractUtils.isDirectoryEntry(entry)) {
            return entry;
        }

        ZoweLogger.trace(`[DatasetFSProvider] stat is locating resource ${uri.toString()}`);

        // Locate the resource using the profile in the given URI.
        let resp;
        const isPdsMember = !FsDatasetsUtils.isPdsEntry(entry) && (entry as DsEntry).isMember;
        const dsPath = (entry.metadata as DsEntryMetadata).extensionRemovedFromPath();

        // Wait for any ongoing authentication process to complete
        await AuthUtils.ensureAuthNotCancelled(uriInfo.profile);
        await AuthHandler.waitForUnlock(uriInfo.profile);

        // Check if the profile is locked (indicating an auth error is being handled)
        // If it's locked, we should wait and not make additional requests
        if (AuthHandler.isProfileLocked(uriInfo.profile)) {
            ZoweLogger.warn(`[DatasetFSProvider] Profile ${uriInfo.profile.name} is locked, waiting for authentication`);
            return entry;
        }

        await AuthUtils.retryRequest(uriInfo.profile, async () => {
            if (isPdsMember) {
                const pds = this.lookupParentDirectory(uri);
                resp = await ZoweExplorerApiRegister.getMvsApi(uriInfo.profile).allMembers(pds.name, { attributes: true });
            } else {
                resp = await ZoweExplorerApiRegister.getMvsApi(uriInfo.profile).dataSet(path.posix.basename(dsPath), {
                    attributes: true,
                });
            }
        });

        // Attempt to parse a successful API response and update the data set's cached stats.
        if (resp.success) {
            const items = resp.apiResponse?.items ?? [];
            const ds = isPdsMember ? items.find((it) => it.member === path.posix.basename(dsPath)) : items?.[0];
            if (ds != null && "m4date" in ds) {
                const { m4date, mtime, msec }: { m4date: string; mtime: string; msec: string } = ds;
                const newTime = dayjs(`${m4date} ${mtime}:${msec}`).valueOf();
                if (entry.mtime != newTime) {
                    entry.mtime = newTime;
                    // if the modification time has changed, invalidate the previous contents to signal to `readFile` that data needs to be fetched
                    entry.wasAccessed = false;
                }
            }
        }

        return entry;
    }

    private async fetchEntriesForProfile(uri: vscode.Uri, uriInfo: UriFsInfo, pattern: string): Promise<FilterEntry> {
        const profileEntry = this._lookupAsDirectory(uri, false) as FilterEntry;

        // Wait for any ongoing authentication process to complete
        await AuthUtils.ensureAuthNotCancelled(uriInfo.profile);
        await AuthHandler.waitForUnlock(uriInfo.profile);

        // Check if the profile is locked (indicating an auth error is being handled)
        // If it's locked, we should wait and not make additional requests
        if (AuthHandler.isProfileLocked(uriInfo.profile)) {
            ZoweLogger.warn(`[DatasetFSProvider] Profile ${uriInfo.profile.name} is locked, waiting for authentication`);
            return profileEntry;
        }

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
        try {
            await AuthUtils.retryRequest(uriInfo.profile, async () => {
                if (mvsApi.dataSetsMatchingPattern) {
                    datasetResponses.push(await mvsApi.dataSetsMatchingPattern(dsPatterns));
                } else {
                    for (const dsp of dsPatterns) {
                        datasetResponses.push(await mvsApi.dataSet(dsp));
                    }
                }
            });
        } catch (err) {
            this._handleError(err, {
                additionalContext: vscode.l10n.t("Failed to list datasets"),
                retry: {
                    fn: this.fetchEntriesForProfile.bind(this),
                    args: [uri, uriInfo, pattern],
                },
                apiType: ZoweExplorerApiType.Mvs,
                profileType: uriInfo.profile.type,
                templateArgs: { profileName: uriInfo.profileName },
            });
        }

        for (const resp of datasetResponses) {
            for (const ds of resp.apiResponse?.items ?? resp.apiResponse ?? []) {
                let tempEntry = profileEntry.entries.get(ds.dsname);
                if (tempEntry == null) {
                    let name = ds.dsname;
                    if (ds.dsorg?.startsWith("PO")) {
                        // Entry is a PDS
                        tempEntry = new PdsEntry(ds.dsname);
                    } else if (ds.dsorg === "VS") {
                        // TODO: Add VSAM and ZFS support in Zowe Explorer
                        continue;
                    } else {
                        // PS or migrated
                        const extension = DatasetUtils.getExtension(ds.dsname);
                        name = extension ? (ds.dsname as string).concat(extension) : ds.dsname;
                        tempEntry = new DsEntry(name, false);
                    }
                    tempEntry.metadata = new DsEntryMetadata({
                        ...profileEntry.metadata,
                        path: path.posix.join(profileEntry.metadata.path, name),
                    });
                    profileEntry.entries.set(name, tempEntry);
                }
            }
        }

        return profileEntry;
    }

    private async fetchEntriesForDataset(entry: PdsEntry, uri: vscode.Uri, uriInfo: UriFsInfo): Promise<void> {
        let members: IZosFilesResponse;
        const profile = Profiles.getInstance().loadNamedProfile(entry.metadata.profile.name);
        // Wait for any ongoing authentication process to complete
        await AuthUtils.ensureAuthNotCancelled(profile);

        await AuthHandler.waitForUnlock(entry.metadata.profile);

        // Check if the profile is locked (indicating an auth error is being handled)
        // If it's locked, we should wait and not make additional requests
        if (AuthHandler.isProfileLocked(entry.metadata.profile)) {
            ZoweLogger.warn(`[DatasetFSProvider] Profile ${entry.metadata.profile.name} is locked, waiting for authentication`);
            return;
        }

        await AuthUtils.retryRequest(uriInfo.profile, async () => {
            const mvsApi = ZoweExplorerApiRegister.getMvsApi(profile);
            members = await mvsApi.allMembers(path.posix.basename(uri.path));
        });

        const pdsExtension = DatasetUtils.getExtension(entry.name);

        for (const ds of members.apiResponse?.items || []) {
            const fullMemberName = `${ds.member as string}${pdsExtension ?? ""}`;
            let tempEntry = entry.entries.get(fullMemberName);
            if (tempEntry == null) {
                tempEntry = new DsEntry(fullMemberName, true);
                tempEntry.metadata = new DsEntryMetadata({ ...entry.metadata, path: path.posix.join(entry.metadata.path, fullMemberName) });
                entry.entries.set(fullMemberName, tempEntry);
            }
        }
    }

    private async fetchDataset(uri: vscode.Uri, uriInfo: UriFsInfo, forceFetch?: boolean): Promise<PdsEntry | DsEntry> {
        let entry: PdsEntry | DsEntry;
        let entryStats: Partial<Types.DatasetStats>;
        let entryIsDir: boolean;
        let entryExists: boolean;
        let pdsMember: boolean;
        let uriPath: string[];

        const session = ZoweExplorerApiRegister.getInstance().getCommonApi(uriInfo.profile).getSession(uriInfo.profile);

        if (
            session.ISession.type === imperative.SessConstants.AUTH_TYPE_NONE ||
            (session.ISession.type === imperative.SessConstants.AUTH_TYPE_TOKEN && !uriInfo.profile.profile.tokenValue)
        ) {
            throw vscode.FileSystemError.Unavailable("Profile is using token type but missing a token");
        }

        await AuthUtils.retryRequest(uriInfo.profile, async () => {
            try {
                entry = this.lookup(uri, false) as PdsEntry | DsEntry;
            } catch (err) {
                if (!(err instanceof vscode.FileSystemError) || err.code !== "FileNotFound") {
                    throw err;
                }
            }

            entryExists = entry != null;
            entryIsDir = entry != null ? entry.type === vscode.FileType.Directory : false;
            // /DATA.SET/MEMBER
            uriPath = uri.path.substring(uriInfo.slashAfterProfilePos + 1).split("/");
            pdsMember = uriPath.length === 2;

            // Wait for any ongoing authentication process to complete
            await AuthUtils.ensureAuthNotCancelled(uriInfo.profile);

            await AuthHandler.waitForUnlock(uriInfo.profile);

            // Check if the profile is locked (indicating an auth error is being handled)
            // If it's locked, we should wait and not make additional requests
            if (AuthHandler.isProfileLocked(uriInfo.profile)) {
                ZoweLogger.warn(`[DatasetFSProvider] Profile ${uriInfo.profile.name} is locked, waiting for authentication`);
                if (entryExists) {
                    return;
                }
                throw vscode.FileSystemError.FileNotFound(uri);
            }

            if (!entryExists || forceFetch) {
                if (pdsMember) {
                    const resp = await ZoweExplorerApiRegister.getMvsApi(uriInfo.profile).allMembers(uriPath[0]);
                    entryIsDir = false;
                    const memberName = path.parse(uriPath[1]).name;
                    if (
                        !resp.success ||
                        resp.apiResponse?.items?.length < 1 ||
                        !resp.apiResponse.items.find((respItem) => respItem.member === memberName)
                    ) {
                        throw vscode.FileSystemError.FileNotFound(uri);
                    }
                } else {
                    const resp = await ZoweExplorerApiRegister.getMvsApi(uriInfo.profile).dataSet(uriPath[0], {
                        attributes: true,
                    });
                    if (resp.success && resp.apiResponse?.items?.length > 0) {
                        entryIsDir = resp.apiResponse.items[0].dsorg?.startsWith("PO");
                        entryStats = DatasetUtils.getDataSetStats(resp.apiResponse.items[0]);
                    } else {
                        throw vscode.FileSystemError.FileNotFound(uri);
                    }
                }
            }
        });

        if (entryIsDir) {
            if (!entryExists) {
                this.createDirectory(uri);
                entry = this._lookupAsDirectory(uri, false) as PdsEntry;
            }
            await this.fetchEntriesForDataset(entry as PdsEntry, uri, uriInfo);
        } else if (!entryExists) {
            this.createDirectory(uri.with({ path: path.posix.join(uri.path, "..") }));
            const parentDir = this.lookupParentDirectory(uri);
            const dsname = uriPath[Number(pdsMember)];
            const ds = new DsEntry(dsname, pdsMember);
            ds.metadata = new DsEntryMetadata({ path: path.posix.join(parentDir.metadata.path, dsname), profile: parentDir.metadata.profile });
            parentDir.entries.set(dsname, ds);
            entry = parentDir.entries.get(dsname) as DsEntry;
        }

        if (entryStats) {
            entry.stats = { ...entry.stats, ...entryStats };
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

        if (uri.path.includes("/.vscode/")) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }

        if (dsEntry == null || FsDatasetsUtils.isDsEntry(dsEntry)) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }

        // Check the remote file system to see if anything has changed since the last time the directory was read.
        dsEntry = (await this.remoteLookupForResource(uri)) as DirEntry;
        return Array.from(dsEntry.entries.entries()).map((value: [string, DirEntry | FileEntry]) => [value[0], value[1].type]);
    }

    /**
     * Creates a local directory entry in the provider at the given URI.
     * @param uri The URI that represents a new directory path
     */
    public createDirectory(uri: vscode.Uri): void {
        const basename = path.posix.basename(uri.path);
        const parent = this.lookupParentDirectory(uri, false);
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
    public async fetchDatasetAtUri(
        uri: vscode.Uri,
        options?: { editor?: vscode.TextEditor | null; isConflict?: boolean }
    ): Promise<FileEntry | null> {
        ZoweLogger.trace(`[DatasetFSProvider] fetchDatasetAtUri called with ${uri.toString()}`);
        let dsEntry = this._lookupAsFile(uri, { silent: true }) as DsEntry | undefined;
        const bufBuilder = new BufferBuilder();
        const metadata = dsEntry?.metadata ?? this._getInfoFromUri(uri);
        const profile = Profiles.getInstance().loadNamedProfile(metadata.profile.name);
        const profileEncoding = dsEntry?.encoding ? null : profile.profile?.encoding; // use profile encoding rather than metadata encoding

        try {
            // Wait for any ongoing authentication process to complete
            await AuthUtils.ensureAuthNotCancelled(profile);

            await AuthHandler.waitForUnlock(metadata.profile);

            // Check if the profile is locked (indicating an auth error is being handled)
            // If it's locked, we should wait and not make additional requests
            if (AuthHandler.isProfileLocked(metadata.profile)) {
                ZoweLogger.warn(`[DatasetFSProvider] Profile ${metadata.profile.name} is locked, waiting for authentication`);
                return null;
            }

            let resp;

            await AuthUtils.retryRequest(metadata.profile, async () => {
                resp = await ZoweExplorerApiRegister.getMvsApi(profile).getContents(metadata.dsName, {
                    binary: dsEntry?.encoding?.kind === "binary",
                    encoding: dsEntry?.encoding?.kind === "other" ? dsEntry?.encoding.codepage : profileEncoding,
                    responseTimeout: profile.profile?.responseTimeout,
                    returnEtag: true,
                    stream: bufBuilder,
                });

                const data: Uint8Array = bufBuilder.read() ?? new Uint8Array();
                //if an entry does not exist for the dataset, create it
                if (!dsEntry) {
                    const uriInfo = FsAbstractUtils.getInfoForUri(uri, Profiles.getInstance());
                    const uriPath = uri.path.substring(uriInfo.slashAfterProfilePos + 1).split("/");
                    const pdsMember = uriPath.length === 2;
                    this.createDirectory(uri.with({ path: path.posix.join(uri.path, "..") }));
                    const parentDir = this.lookupParentDirectory(uri);
                    const dsname = uriPath[Number(pdsMember)];
                    const ds = new DsEntry(dsname, pdsMember);
                    ds.metadata = new DsEntryMetadata({
                        path: path.posix.join(parentDir.metadata.path, dsname),
                        profile: parentDir.metadata.profile,
                    });
                    parentDir.entries.set(dsname, ds);
                    dsEntry = parentDir.entries.get(dsname) as DsEntry;
                }

                if (options?.isConflict) {
                    dsEntry.conflictData = {
                        contents: data,
                        etag: resp.apiResponse.etag,
                        size: data.byteLength,
                    };
                } else {
                    dsEntry.data = data;
                    dsEntry.etag = resp.apiResponse.etag;
                    dsEntry.size = dsEntry.data.byteLength;
                    dsEntry.mtime = Date.now();
                }
            });
            ZoweLogger.trace(`[DatasetFSProvider] fetchDatasetAtUri fired a change event for ${uri.toString()}`);
            this._fireSoon({ type: vscode.FileChangeType.Changed, uri });

            if (options?.editor) {
                await this._updateResourceInEditor(uri);
            }
            return dsEntry;
        } catch (error) {
            return null;
        }
    }

    /**
     * Reads a data set at the given URI and fetches it from the remote system (if not yet accessed).
     * @param uri The URI pointing to a valid data set on the remote system
     * @returns The data set's contents as an array of bytes
     */
    public async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        let ds: DsEntry | DirEntry;
        const urlQuery = new URLSearchParams(uri.query);
        const isConflict = urlQuery.has("conflict");

        if (uri.path.includes("/.vscode/")) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }

        // Check if the profile for URI is not zosmf, if it is not, create a deferred promise for the profile.
        // If the extenderProfileReady map does not contain the profile, create a deferred promise for the profile.
        const uriInfo = FsAbstractUtils.getInfoForUri(uri, Profiles.getInstance());
        await ProfilesUtils.awaitExtenderType(uriInfo.profileName, Profiles.getInstance());

        const session = ZoweExplorerApiRegister.getInstance().getCommonApi(uriInfo.profile).getSession(uriInfo.profile);
        if (
            session.ISession.type === imperative.SessConstants.AUTH_TYPE_NONE ||
            (session.ISession.type === imperative.SessConstants.AUTH_TYPE_TOKEN && !uriInfo.profile.profile.tokenValue)
        ) {
            throw vscode.FileSystemError.Unavailable("Profile is using token type but missing a token");
        }

        try {
            ds = this._lookupAsFile(uri) as DsEntry;
        } catch (err) {
            if (!(err instanceof vscode.FileSystemError) || err.code !== "FileNotFound") {
                const metadata = this._getInfoFromUri(uri);
                this._handleError(err, {
                    additionalContext: vscode.l10n.t({
                        message: "Failed to read {0}",
                        args: [uri.path],
                        comment: ["File path"],
                    }),
                    apiType: ZoweExplorerApiType.Mvs,
                    profileType: metadata.profile?.type,
                    retry: {
                        fn: this.readFile.bind(this),
                        args: [uri],
                    },
                    templateArgs: { profileName: metadata.profile?.name ?? "" },
                });
                throw err;
            }
        }

        if (ds && ds.metadata?.profile == null) {
            throw vscode.FileSystemError.FileNotFound(vscode.l10n.t("Profile does not exist for this file."));
        }

        // we need to fetch the contents from the mainframe if the file hasn't been accessed yet
        if (!ds || (!ds.wasAccessed && !urlQuery.has("inDiff")) || isConflict) {
            //try and fetch its contents from remote
            ds = (await this.fetchDatasetAtUri(uri, { isConflict })) as DsEntry;
            if (!isConflict && ds) {
                ds.wasAccessed = true;
            }
        }

        if (FsAbstractUtils.isDirectoryEntry(ds)) {
            throw vscode.FileSystemError.FileIsADirectory(uri);
        }

        //not found on remote, throw error
        if (ds == null) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }

        return isConflict ? ds.conflictData.contents : ds.data;
    }

    public makeEmptyDsWithEncoding(uri: vscode.Uri, encoding: ZosEncoding, isMember?: boolean): void {
        const parentDir = this.lookupParentDirectory(uri);
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

    private async uploadEntry(
        entry: DsEntry,
        content: Uint8Array,
        uri: vscode.Uri,
        forceUpload?: boolean,
        encoding?: string
    ): Promise<IZosFilesResponse> {
        const uriInfo = FsAbstractUtils.getInfoForUri(uri, Profiles.getInstance());
        // /DATA.SET/MEMBER
        const uriPath = uri.path.substring(uriInfo.slashAfterProfilePos + 1).split("/");
        const isPdsMember = uriPath.length === 2;

        let dsStats: Types.DatasetStats = entry.stats;
        if (dsStats == null) {
            const targetPath = isPdsMember ? path.posix.dirname(uri.path) : uri.path;
            const tempEntry = await this.fetchDataset(uri.with({ path: targetPath }), uriInfo, true);
            dsStats = tempEntry.stats;
            if (isPdsMember) {
                entry.stats = tempEntry.stats;
            } else {
                entry = tempEntry as DsEntry;
            }
        }
        if (dsStats?.lrecl || dsStats?.blksz) {
            const longLines = {};
            try {
                const document = await vscode.workspace.openTextDocument(uri);
                for (let i = 0; i < document.lineCount; i++) {
                    if (document.lineAt(i).text.length > (Number(dsStats.lrecl) || Number(dsStats.blksz))) {
                        longLines[i + 1] = document.lineAt(i).text;
                    }
                }
            } catch (err) {
                // do nothing since we may be trying to create an entry in the FS that doesn't exist yet
            }
            if (Object.keys(longLines).length > 0) {
                // internal error code to indicate unsafe upload
                throw new imperative.ImperativeError({
                    msg: "Zowe Explorer: Unsafe upload",
                    causeErrors: longLines,
                });
            }
        }
        const statusMsg = Gui.setStatusBarMessage(`$(sync~spin) ${vscode.l10n.t("Saving data set...")}`);
        let resp: IZosFilesResponse;
        const profile = Profiles.getInstance().loadNamedProfile(entry.metadata.profile.name);

        await AuthUtils.ensureAuthNotCancelled(profile);

        await AuthHandler.waitForUnlock(entry.metadata.profile);

        try {
            const mvsApi = ZoweExplorerApiRegister.getMvsApi(entry.metadata.profile);
            const profile = Profiles.getInstance().loadNamedProfile(entry.metadata.profile.name);
            const profileEncoding = entry.encoding ? null : profile.profile?.encoding;

            const binary = encoding === "binary" || entry.encoding?.kind === "binary";

            resp = await mvsApi.uploadFromBuffer(Buffer.from(content), entry.metadata.dsName, {
                binary,
                encoding: encoding ?? (entry.encoding?.kind === "other" ? entry.encoding.codepage : profileEncoding),
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
        const parent = this.lookupParentDirectory(uri);
        const isPdsMember = FsDatasetsUtils.isPdsEntry(parent);
        let entry: FileEntry = parent.entries.get(basename);
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
        const encodingParam = urlQuery.get("encoding") || undefined;

        // Attempt to write data to remote system, and handle any conflicts from e-tag mismatch

        try {
            if (!entry) {
                entry = new DsEntry(basename, isPdsMember);
                entry.data = content;
                const profInfo = parent.metadata
                    ? new DsEntryMetadata({
                          profile: parent.metadata.profile,
                          path: path.posix.join(parent.metadata.path, basename),
                      })
                    : this._getInfoFromUri(uri);
                entry.metadata = profInfo;

                if (content.byteLength > 0) {
                    // Pass encodingParam and e-tag if write was successful.
                    const resp = await this.uploadEntry(entry as DsEntry, content, uri, forceUpload, encodingParam);
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
                    const resp = await this.uploadEntry(entry as DsEntry, content, uri, forceUpload, encodingParam);
                    entry.etag = resp.apiResponse.etag;
                }
                entry.data = content;
            }
        } catch (err) {
            if (err.message.includes("Rest API failure with HTTP(S) status 412")) {
                entry.data = content;
                // Prompt the user with the conflict dialog
                await this._handleConflict(uri, entry);
                return;
            }
            if (err instanceof imperative.ImperativeError && err.message.includes("Zowe Explorer: Unsafe upload")) {
                const longLines = Object.keys(err.causeErrors);
                const dataLossMsg = vscode.l10n.t("This upload operation may result in data loss.");
                const linesToReview = longLines.length > 5 ? longLines.slice(0, 5).join(", ") + "..." : longLines.join(", ");
                const shortMsg = vscode.l10n.t("Please review the following lines:");
                const newErr = new Error(`${dataLossMsg} ${shortMsg} ${linesToReview}`);
                newErr.stack = shortMsg + "\n";
                // group consecutive lines that are next to each other
                const groupedLines: { lines: number[]; text: string }[] = [];
                for (const [line, text] of Object.entries(err.causeErrors)) {
                    if (groupedLines.length > 0) {
                        const poppedLine = groupedLines.pop();
                        if (poppedLine && Number(line) - 1 === Number(poppedLine.lines[poppedLine.lines.length - 1])) {
                            poppedLine.lines.push(Number(line));
                            poppedLine.text += ("\n" + text) as string;
                            groupedLines.push(poppedLine);
                        } else {
                            groupedLines.push(poppedLine);
                            groupedLines.push({ lines: [Number(line)], text: text as string });
                        }
                    } else {
                        groupedLines.push({ lines: [Number(line)], text: text as string });
                    }
                }
                for (const lines of groupedLines) {
                    let lineRange = "";
                    if (lines.lines.length > 1) {
                        lineRange = `Lines: ${lines.lines[0]}-${lines.lines[lines.lines.length - 1]}`;
                    } else {
                        lineRange = `Line: ${lines.lines[0]}`;
                    }
                    newErr.stack += `\n${lineRange}\n${lines.text}\n`;
                }
                this._handleError(newErr);
                throw newErr;
            }
            this._handleError(err, {
                additionalContext: vscode.l10n.t({
                    message: "Failed to save {0}",
                    args: [(entry.metadata as DsEntryMetadata).dsName],
                    comment: ["Data set name"],
                }),
                apiType: ZoweExplorerApiType.Mvs,
                profileType: entry.metadata.profile?.type,
                retry: {
                    fn: this.writeFile.bind(this),
                    args: [uri, content, options],
                },
                templateArgs: { profileName: entry.metadata.profile?.name ?? "" },
            });
            throw err;
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
        const entry = this.lookup(uri, false) as DsEntry | PdsEntry;
        const parent = this.lookupParentDirectory(uri);
        let fullName: string = "";
        if (FsDatasetsUtils.isPdsEntry(parent)) {
            // PDS member
            fullName = (entry as DsEntry).metadata.dsName;
        } else if (FsDatasetsUtils.isPdsEntry(entry)) {
            fullName = entry.name;
        } else {
            fullName = entry.metadata.dsName;
        }

        try {
            const profile = Profiles.getInstance().loadNamedProfile(entry.metadata.profile.name);
            await AuthUtils.ensureAuthNotCancelled(profile);
            await AuthHandler.waitForUnlock(entry.metadata.profile);
            await ZoweExplorerApiRegister.getMvsApi(entry.metadata.profile).deleteDataSet(fullName, {
                volume: entry.stats?.["vol"],
                responseTimeout: entry.metadata.profile.profile?.responseTimeout,
            });
        } catch (err) {
            this._handleError(err, {
                additionalContext: vscode.l10n.t({
                    message: "Failed to delete {0}",
                    args: [entry.metadata.path],
                    comment: ["File path"],
                }),
                apiType: ZoweExplorerApiType.Mvs,
                profileType: entry.metadata.profile?.type,
                retry: {
                    fn: this.delete.bind(this),
                    args: [uri, _options],
                },
                templateArgs: { profileName: entry.metadata.profile?.name ?? "" },
            });
            throw err;
        }

        parent.entries.delete(entry.name);
        parent.size -= 1;

        this._fireSoon({ type: vscode.FileChangeType.Deleted, uri });
    }

    public async rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { readonly overwrite: boolean }): Promise<void> {
        const newUriEntry = this.lookup(newUri, true);
        if (!options.overwrite && newUriEntry) {
            throw vscode.FileSystemError.FileExists(`Rename failed: ${path.posix.basename(newUri.path)} already exists`);
        }

        const entry = this.lookup(oldUri, false) as PdsEntry | DsEntry;
        const parentDir = this.lookupParentDirectory(oldUri);

        const oldName = entry.name;
        const newName = path.posix.basename(newUri.path);

        try {
            const profile = Profiles.getInstance().loadNamedProfile(entry.metadata.profile.name);
            await AuthUtils.ensureAuthNotCancelled(profile);
            await AuthHandler.waitForUnlock(entry.metadata.profile);
            if (FsDatasetsUtils.isPdsEntry(entry) || !entry.isMember) {
                await ZoweExplorerApiRegister.getMvsApi(entry.metadata.profile).renameDataSet(oldName, newName);
            } else {
                const pdsName = path.basename(path.posix.join(entry.metadata.path, ".."));
                await ZoweExplorerApiRegister.getMvsApi(entry.metadata.profile).renameDataSetMember(
                    pdsName,
                    path.parse(oldName).name,
                    path.parse(newName).name
                );
            }
        } catch (err) {
            this._handleError(err, {
                additionalContext: vscode.l10n.t({
                    message: "Failed to rename {0}",
                    args: [oldName],
                    comment: ["Data set name"],
                }),
                apiType: ZoweExplorerApiType.Mvs,
                profileType: entry.metadata.profile?.type,
                retry: {
                    fn: this.rename.bind(this),
                    args: [oldUri, newUri, options],
                },
                templateArgs: { profileName: entry.metadata.profile?.name ?? "" },
            });
            throw err;
        }

        parentDir.entries.delete(entry.name);
        entry.name = newName;

        // Build the new path using the previous path and new file/folder name.
        const newPath = path.posix.join(entry.metadata.path, "..", newName);

        entry.metadata.path = newPath;
        parentDir.entries.set(newName, entry);

        if (FsDatasetsUtils.isPdsEntry(entry)) {
            for (const [_, member] of entry.entries) {
                member.metadata.path = path.posix.join(
                    entry.metadata.path,
                    member.metadata.path.substring(member.metadata.path.lastIndexOf("/") + 1)
                );
            }
        }

        this._fireSoon({ type: vscode.FileChangeType.Deleted, uri: oldUri }, { type: vscode.FileChangeType.Created, uri: newUri });
    }
}
