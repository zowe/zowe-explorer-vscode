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
    IFileSystemEntry,
    FeatureFlags,
} from "@zowe/zowe-explorer-api";
import { IZosFilesResponse } from "@zowe/zos-files-for-zowe-sdk";
import { Profiles } from "../../configuration/Profiles";
import { ZoweExplorerApiRegister } from "../../extending/ZoweExplorerApiRegister";
import { ZoweLogger } from "../../tools/ZoweLogger";
import * as dayjs from "dayjs";
import { DatasetUtils } from "./DatasetUtils";
import { AuthUtils } from "../../utils/AuthUtils";
import { ProfilesUtils } from "../../utils/ProfilesUtils";

const EXPECTED_MEMBER_LENGTH = 2; // /DATA.SET/MEMBER

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

    protected async lookupWithCache(uri: vscode.Uri): Promise<DirEntry | DsEntry | IFileSystemEntry> {
        try {
            // Check cache for resource
            const localLookup = this.lookup(uri);
            //TODO Remove
            console.log("fetch: false");
            if (localLookup) return localLookup;
        } catch {}
        // If resource not found, remote lookup
        //TODO Remove
        console.log("fetch: true");
        return this.remoteLookupForResource(uri);
    }

    /**
     * Executes the core logic for the stat operation on a given URI.
     * This is separated to facilitate caching and testing.
     * @param uri The URI of the resource to stat.
     * @returns A promise that resolves to a vscode.FileStat object.
     * @throws vscode.FileSystemError on failures like FileNotFound or profile unavailability.
     */
    private async statImplementation(uri: vscode.Uri): Promise<vscode.FileStat> {
        ZoweLogger.trace(`[DatasetFSProvider] statImplementation called with ${uri.toString()}`);
        this.validatePath(uri);
        let isFetching = false;

        const queryParams = new URLSearchParams(uri.query);
        if (queryParams.has("conflict")) {
            return { ...this.lookup(uri, false), permissions: vscode.FilePermission.Readonly };
        } else if (queryParams.has("inDiff")) {
            return this.lookup(uri, false);
        }

        const fetchByDefault: boolean = FeatureFlags.get("fetchByDefault");

        isFetching = queryParams?.has("fetch") && queryParams?.get("fetch") === "true";

        const uriInfo = FsAbstractUtils.getInfoForUri(uri, Profiles.getInstance());

        const apiRegister = ZoweExplorerApiRegister.getInstance();

        const commonApi = FsAbstractUtils.getApiOrThrowUnavailable(uriInfo.profile, () => apiRegister.getCommonApi(uriInfo.profile), {
            apiName: vscode.l10n.t("Common API"),
            registeredTypes: apiRegister.registeredApiTypes(),
        });
        const session = commonApi.getSession(uriInfo.profile);
        if (
            (isFetching && ProfilesUtils.hasNoAuthType(session.ISession, uriInfo.profile)) ||
            (session.ISession.type === imperative.SessConstants.AUTH_TYPE_TOKEN && !uriInfo.profile.profile.tokenValue)
        ) {
            throw vscode.FileSystemError.Unavailable("Profile is using token type but missing a token");
        }

        const entry = isFetching
            ? await this.remoteLookupForResource(uri)
            : fetchByDefault
            ? await this.lookupWithCache(uri)
            : this.lookup(uri, false);
        // Do not perform remote lookup for profile or directory URIs; the code below is for change detection on PS or PDS members only
        if (uriInfo.isRoot || FsAbstractUtils.isDirectoryEntry(entry)) {
            return entry;
        }

        ZoweLogger.trace(`[DatasetFSProvider] stat is locating resource ${uri.toString()}`);

        // Locate the resource using the profile in the given URI.
        let resp;
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
            resp = await ZoweExplorerApiRegister.getMvsApi(uriInfo.profile).dataSet(path.posix.basename(dsPath), {
                attributes: true,
            });
        });

        if (resp.success) {
            const items = resp.apiResponse?.items ?? [];
            const ds = items?.[0];
            if (ds != null && "m4date" in ds) {
                const { m4date, mtime, msec } = ds;
                const newTime = dayjs(`${m4date} ${mtime}:${msec}`).valueOf();
                if (entry.mtime != newTime) {
                    entry.mtime = newTime;
                    entry.wasAccessed = false;
                }
            }
            return entry;
        }

        return entry;
    }

    /**
     * Returns file statistics about a given URI.
     * @param uri A URI that must exist as an entry in the provider
     * @returns A structure containing file type, time, size and other metrics
     */
    public async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
        const segments = uri.path.split("/").filter((s) => s.length > 0);
        const isMemberRequest = segments.length === 3;

        if (isMemberRequest) {
            const memberName = segments[2];
            const parentPath = segments.slice(0, 2).join("/");
            const parentUri = uri.with({ path: `/${parentPath}` });

            const pdsEntry = await this.executeWithReuse<DirEntry>(parentUri, {
                keyGenerator: (u) => "list" + this.getQueryKey(u) + "_" + u.toString().replace(/\/$/, ""),
                checkLocal: () => !!this._lookupAsDirectory(parentUri, true),
                execute: () => this.readDirectoryImplementation(parentUri),
            });

            if (pdsEntry && pdsEntry.entries) {
                const memberStat = pdsEntry.entries.get(memberName);
                if (memberStat) {
                    return memberStat;
                }
            }
            throw vscode.FileSystemError.FileNotFound(uri);
        }

        return this.executeWithReuse<vscode.FileStat>(uri, {
            keyGenerator: (u) => "list" + this.getQueryKey(u) + "_" + u.toString().split("/").slice(0, 3).join("/"),
            checkLocal: () => !!this.lookup(uri, true),
            execute: () => this.statImplementation(uri),
        });
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
            try {
                const mvsApi = ZoweExplorerApiRegister.getMvsApi(profile);
                members = await mvsApi.allMembers(path.posix.basename(uri.path));
            } catch (err) {
                if (err.message.toLocaleLowerCase().includes("status 500")) {
                    ZoweLogger.warn(err.message);
                } else {
                    throw err;
                }
            }
        });

        const pdsExtension = DatasetUtils.getExtension(entry.name);

        for (const ds of members?.apiResponse?.items || []) {
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

        const apiRegister = ZoweExplorerApiRegister.getInstance();
        const commonApi = FsAbstractUtils.getApiOrThrowUnavailable(uriInfo.profile, () => apiRegister.getCommonApi(uriInfo.profile), {
            apiName: vscode.l10n.t("Common API"),
            registeredTypes: apiRegister.registeredApiTypes(),
        });
        const session = commonApi.getSession(uriInfo.profile);

        if (
            ProfilesUtils.hasNoAuthType(session.ISession, uriInfo.profile) ||
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
            uriPath = uri.path
                .substring(uriInfo.slashAfterProfilePos + 1)
                .split("/")
                .filter(Boolean);
            pdsMember = uriPath.length === EXPECTED_MEMBER_LENGTH;

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
        //TODO Remove
        console.log("remoteLookupCalled: " + uri);
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

    public async readDirectoryImplementation(uri: vscode.Uri): Promise<DirEntry> {
        let dsEntry: DirEntry | DsEntry = null;
        const query = new URLSearchParams(uri.query);
        const shouldFetch = query.get("fetch") === "true" || query.has("pattern");

        try {
            dsEntry = shouldFetch ? await this.remoteLookupForResource(uri) : this._lookupAsDirectory(uri, false);
        } catch (err) {
            if (!(err instanceof vscode.FileSystemError)) {
                throw err;
            }

            //TODO Feature Flag
            if (err.code === "FileNotFound" && FeatureFlags.get("fetchByDefault") && !shouldFetch) {
                dsEntry = await this.remoteLookupForResource(uri);
            }
        }

        this.validatePath(uri);

        if (dsEntry == null || FsDatasetsUtils.isDsEntry(dsEntry)) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }

        return dsEntry;
    }

    /**
     * Reads a directory located at the given URI.
     * @param uri A valid URI within the provider
     * @returns An array of tuples containing each entry name and type
     */
    public async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        const dirEntry = await this.executeWithReuse<DirEntry>(uri, {
            keyGenerator: (u) => "list" + this.getQueryKey(u) + "_" + u.toString().replace(/\/$/, ""),
            checkLocal: () => !!this._lookupAsDirectory(uri, true),
            execute: () => this.readDirectoryImplementation(uri),
        });

        return Array.from(dirEntry.entries.entries()).map(
            (value: [string, DirEntry | FileEntry]) => [value[0], value[1].type] as [string, vscode.FileType]
        );
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
                    const uriPath = uri.path
                        .substring(uriInfo.slashAfterProfilePos + 1)
                        .split("/")
                        .filter(Boolean);
                    const pdsMember = uriPath.length === EXPECTED_MEMBER_LENGTH;
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

    public async readFileImplementation(uri: vscode.Uri): Promise<Uint8Array> {
        let ds: DsEntry | DirEntry;
        const urlQuery = new URLSearchParams(uri.query);
        const isConflict = urlQuery.has("conflict");

        this.validatePath(uri);

        // Check if the profile for URI is not zosmf, if it is not, create a deferred promise for the profile.
        // If the extenderProfileReady map does not contain the profile, create a deferred promise for the profile.
        const uriInfo = FsAbstractUtils.getInfoForUri(uri, Profiles.getInstance());
        await ProfilesUtils.awaitExtenderType(uriInfo.profileName, Profiles.getInstance());

        const apiRegister = ZoweExplorerApiRegister.getInstance();
        const commonApi = FsAbstractUtils.getApiOrThrowUnavailable(uriInfo.profile, () => apiRegister.getCommonApi(uriInfo.profile), {
            apiName: vscode.l10n.t("Common API"),
            registeredTypes: apiRegister.registeredApiTypes(),
        });
        const session = commonApi.getSession(uriInfo.profile);
        if (
            ProfilesUtils.hasNoAuthType(session.ISession, uriInfo.profile) ||
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

        // not found on remote, throw error
        if (ds == null) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }

        return isConflict ? ds.conflictData.contents : ds.data;
    }

    /**
     * Reads a data set at the given URI and fetches it from the remote system (if not yet accessed).
     * @param uri The URI pointing to a valid data set on the remote system
     * @returns The data set's contents as an array of bytes
     */
    public async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        return this.executeWithReuse<Uint8Array>(uri, {
            keyGenerator: (u) => "readFile" + this.getQueryKey(u) + "_" + u.toString().replace(/\/$/, ""),
            checkLocal: () => {
                try {
                    const entry = this._lookupAsFile(uri, { silent: true }) as DsEntry;
                    return entry && entry.wasAccessed;
                } catch {
                    return false;
                }
            },
            execute: () => this.readFileImplementation(uri),
        });
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

        const uriPath = uri.path
            .substring(uriInfo.slashAfterProfilePos + 1)
            .split("/")
            .filter(Boolean);
        const isPdsMember = uriPath.length === EXPECTED_MEMBER_LENGTH;
        const targetPath = isPdsMember ? path.posix.dirname(uri.path) : uri.path;

        let dsStats: Types.DatasetStats = isPdsMember ? (this.lookupParentDirectory(uri) as PdsEntry).stats : entry.stats;
        if (dsStats == null) {
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
                    let limit = Number(dsStats.lrecl) || Number(dsStats.blksz);
                    if (dsStats.recfm?.toUpperCase().startsWith("V")) {
                        limit -= 4;
                    }
                    if (document.lineAt(i).text.length > limit) {
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
                const groupedLines: { start: number; end: number; text: string }[] = [];

                const sortedEntries = Object.entries(err.causeErrors).sort((a, b) => Number(a[0]) - Number(b[0]));

                for (const [lineStr, text] of sortedEntries) {
                    const line = Number(lineStr);
                    const lastGroup = groupedLines[groupedLines.length - 1];

                    if (lastGroup && line === lastGroup.end + 1) {
                        lastGroup.end = line;
                        lastGroup.text += "\n" + text;
                    } else {
                        groupedLines.push({ start: line, end: line, text: text as string });
                    }
                }
                const rangeStrings = groupedLines.map((g) => (g.start === g.end ? `${g.start}` : `${g.start}-${g.end}`));
                const maxRanges = 5;
                const linesToReview = rangeStrings.length > maxRanges ? rangeStrings.slice(0, maxRanges).join(", ") + "..." : rangeStrings.join(", ");
                const dataLossMsg = vscode.l10n.t("This upload operation may result in data loss.");
                const shortMsg = vscode.l10n.t("Please review the following lines:");
                const newErr = new Error(`${dataLossMsg} ${shortMsg} ${linesToReview}`);
                newErr.stack = shortMsg + "\n";
                for (const group of groupedLines) {
                    const lineLabel = group.start === group.end ? `Line: ${group.start}` : `Lines: ${group.start}-${group.end}`;

                    newErr.stack += `\n${lineLabel}\n${group.text}\n`;
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

    private validatePath(uri: vscode.Uri): void {
        const cleanedPath = uri.path.replace(/\/$/, "");
        const pathComponents = cleanedPath.split("/");
        // When the URI includes an additional VS Code-specific segment, the member/data-set
        // name is the second-to-last path component instead of the last one.
        const INVALID_URI_EXPECTED_LENGTH = 5;

        const segmentIndex = pathComponents.length === INVALID_URI_EXPECTED_LENGTH ? pathComponents.length - 2 : pathComponents.length - 1;
        const segmentToCheck = pathComponents[segmentIndex] ?? "";
        if (!segmentToCheck) {
            return;
        }
        if (segmentToCheck.startsWith(".")) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
    }

    private async executeWithReuse<T>(
        uri: vscode.Uri,
        options: {
            keyGenerator: (uri: vscode.Uri) => string;
            checkLocal: () => boolean;
            execute: () => Promise<T>;
        }
    ): Promise<T> {
        const queryParams = new URLSearchParams(uri.query);
        const isExplicitFetch = queryParams.get("fetch") === "true";
        const hasConflictOrDiff = queryParams.has("conflict") || queryParams.has("inDiff");
        const fetchByDefault = FeatureFlags.get("fetchByDefault");

        // Generate fetch key
        const fetchQueryParams = new URLSearchParams(uri.query);
        fetchQueryParams.set("fetch", "true");
        const fetchUri = uri.with({ query: fetchQueryParams.toString() });
        const fetchKey = options.keyGenerator(fetchUri);

        // Generate fetch key with no fetch param
        const actualQueryParams = new URLSearchParams(uri.query);
        actualQueryParams.delete("fetch");
        const actualUri = uri.with({ query: actualQueryParams.toString() });
        const actualKey = options.keyGenerator(actualUri);

        // Check local entry to see if it will fallback to a remote lookup
        let localEntryFound = false;
        if (!isExplicitFetch && !hasConflictOrDiff && fetchByDefault) {
            try {
                if (options.checkLocal()) {
                    localEntryFound = true;
                }
            } catch (error) {}
        }

        const needNetwork = isExplicitFetch || (fetchByDefault && !hasConflictOrDiff && !localEntryFound);

        if (needNetwork && this.requestCache.has(fetchKey)) {
            //TODO: Remove
            console.log(`[Reuse] Reusing explicit fetch for request: ${fetchKey}`);
            return (await this.requestCache.get(fetchKey)) as T;
        }

        const keyToUse = needNetwork ? fetchKey : actualKey;

        if (this.requestCache.has(keyToUse)) {
            //TODO: Remove
            console.log(`[Reuse] Request reuse for: ${keyToUse}`);
            return (await this.requestCache.get(keyToUse)) as T;
        }

        const requestPromise = (async () => {
            try {
                return await options.execute();
            } finally {
                if (this.requestCache.get(keyToUse) === requestPromise) {
                    this.requestCache.delete(keyToUse);
                }
            }
        })();

        this.requestCache.set(keyToUse, requestPromise);

        return requestPromise;
    }
}
