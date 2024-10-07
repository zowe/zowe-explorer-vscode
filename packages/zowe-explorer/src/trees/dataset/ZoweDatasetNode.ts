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

import * as zosfiles from "@zowe/zos-files-for-zowe-sdk";
import * as vscode from "vscode";
import * as dayjs from "dayjs";
import {
    Sorting,
    Types,
    Gui,
    imperative,
    ZoweTreeNodeActions,
    IZoweDatasetTreeNode,
    ZoweTreeNode,
    ZosEncoding,
    Validation,
    DsEntry,
    ZoweScheme,
    PdsEntry,
    FsDatasetsUtils,
} from "@zowe/zowe-explorer-api";
import { DatasetFSProvider } from "./DatasetFSProvider";
import { SharedUtils } from "../shared/SharedUtils";
import { Constants } from "../../configuration/Constants";
import { Profiles } from "../../configuration/Profiles";
import { ZoweExplorerApiRegister } from "../../extending/ZoweExplorerApiRegister";
import { IconGenerator } from "../../icons/IconGenerator";
import { ZoweLogger } from "../../tools/ZoweLogger";
import { SharedContext } from "../shared/SharedContext";
import { AuthUtils } from "../../utils/AuthUtils";
import type { Definitions } from "../../configuration/Definitions";
import type { DatasetTree } from "./DatasetTree";
import { SharedTreeProviders } from "../shared/SharedTreeProviders";
import { DatasetUtils } from "./DatasetUtils";

/**
 * A type of TreeItem used to represent sessions and data sets
 *
 * @export
 * @class ZoweDatasetNode
 * @extends {vscode.TreeItem}
 */
export class ZoweDatasetNode extends ZoweTreeNode implements IZoweDatasetTreeNode {
    public command: vscode.Command;
    public pattern = "";
    public memberPattern = "";
    public patternMatches = [];
    public dirty = true;
    public children: ZoweDatasetNode[] = [];
    public errorDetails: imperative.ImperativeError;
    public ongoingActions: Record<ZoweTreeNodeActions.Interactions | string, Promise<any>> = {};
    public wasDoubleClicked: boolean = false;
    public sort?: Sorting.NodeSort;
    public filter?: Sorting.DatasetFilter;
    public resourceUri?: vscode.Uri;

    /**
     * Creates an instance of ZoweDatasetNode
     *
     * @param {IZoweTreeOpts} opts
     */
    public constructor(opts: Definitions.IZoweDatasetTreeOpts) {
        super(opts.label, opts.collapsibleState, opts.parentNode, opts.session, opts.profile);
        if (opts.encoding != null) {
            this.setEncoding(opts.encoding);
        }
        const isBinary = opts.encoding?.kind === "binary";
        if (opts.contextOverride) {
            this.contextValue = opts.contextOverride;
        } else if (opts.collapsibleState !== vscode.TreeItemCollapsibleState.None) {
            this.contextValue = Constants.DS_PDS_CONTEXT;
        } else if (opts.parentNode && opts.parentNode.getParent()) {
            this.contextValue = isBinary ? Constants.DS_MEMBER_BINARY_CONTEXT : Constants.DS_MEMBER_CONTEXT;
        } else {
            this.contextValue = isBinary ? Constants.DS_DS_BINARY_CONTEXT : Constants.DS_DS_CONTEXT;
        }
        this.tooltip = this.label as string;
        const icon = IconGenerator.getIconByNode(this);
        if (icon) {
            this.iconPath = icon.path;
        }

        if (this.getParent() == null || this.getParent().label === vscode.l10n.t("Favorites")) {
            // set default sort options for session nodes
            this.sort = {
                method: Sorting.DatasetSortOpts.Name,
                direction: Sorting.SortDirection.Ascending,
            };
        }

        if (SharedContext.isSession(this) && this.getParent() == null) {
            this.id = this.label as string;
        }

        if (this.label !== vscode.l10n.t("Favorites")) {
            const sessionLabel = opts.profile?.name ?? SharedUtils.getSessionLabel(this);
            if (
                this.contextValue === Constants.DS_DS_CONTEXT ||
                this.contextValue === Constants.DS_PDS_CONTEXT ||
                this.contextValue === Constants.DS_MIGRATED_FILE_CONTEXT
            ) {
                this.resourceUri = vscode.Uri.from({
                    scheme: ZoweScheme.DS,
                    path: `/${sessionLabel}/${this.label as string}`,
                });
                if (this.contextValue === Constants.DS_DS_CONTEXT) {
                    const extension = DatasetUtils.getExtension(this.label as string);
                    this.resourceUri = this.resourceUri.with({ path: `${this.resourceUri.path}${extension ?? ""}` });
                    this.command = { command: "vscode.open", title: "", arguments: [this.resourceUri] };
                }
            } else if (this.contextValue === Constants.DS_MEMBER_CONTEXT) {
                const extension = DatasetUtils.getExtension(this.getParent().label as string);
                this.resourceUri = vscode.Uri.from({
                    scheme: ZoweScheme.DS,
                    path: `/${sessionLabel}/${this.getParent().label as string}/${this.label as string}${extension ?? ""}`,
                });
                this.command = { command: "vscode.open", title: "", arguments: [this.resourceUri] };
            } else {
                this.resourceUri = vscode.Uri.from({
                    scheme: ZoweScheme.DS,
                    path: `/${sessionLabel}/`,
                });
                if (this.getParent() == null || this.getParent().label === vscode.l10n.t("Favorites")) {
                    DatasetFSProvider.instance.createDirectory(this.resourceUri);
                } else if (this.contextValue === Constants.INFORMATION_CONTEXT) {
                    this.command = { command: "zowe.placeholderCommand", title: "Placeholder" };
                }
            }

            if (opts.encoding != null) {
                DatasetFSProvider.instance.makeEmptyDsWithEncoding(this.resourceUri, opts.encoding);
            }
        }
    }

    public updateStats(item: any): void {
        if ("c4date" in item && "m4date" in item) {
            const { m4date, mtime, msec }: { m4date: string; mtime: string; msec: string } = item;
            this.setStats({
                user: item.user,
                createdDate: dayjs(item.c4date).toDate(),
                modifiedDate: dayjs(`${m4date} ${mtime}:${msec}`).toDate(),
            });
        } else if ("id" in item || "changed" in item) {
            // missing keys from API response; check for FTP keys
            this.setStats({
                user: item.id,
                createdDate: item.created ? dayjs(item.created).toDate() : undefined,
                modifiedDate: item.changed ? dayjs(item.changed).toDate() : undefined,
            });
        }
    }

    public getEncodingInMap(uriPath: string): ZosEncoding {
        return DatasetFSProvider.instance.encodingMap[uriPath];
    }
    public updateEncodingInMap(uriPath: string, encoding: ZosEncoding): void {
        DatasetFSProvider.instance.encodingMap[uriPath] = encoding;
    }

    public setEtag(etag: string): void {
        const dsEntry = DatasetFSProvider.instance.lookup(this.resourceUri, true) as DsEntry | PdsEntry;
        if (dsEntry == null || FsDatasetsUtils.isPdsEntry(dsEntry)) {
            return;
        }

        dsEntry.etag = etag;
    }

    public setStats(stats: Partial<Types.DatasetStats>): void {
        const dsEntry = DatasetFSProvider.instance.lookup(this.resourceUri, true) as DsEntry | PdsEntry;
        if (dsEntry == null || FsDatasetsUtils.isPdsEntry(dsEntry)) {
            return;
        }

        dsEntry.stats = { ...dsEntry.stats, ...stats };
    }

    public getStats(): Types.DatasetStats {
        const dsEntry = DatasetFSProvider.instance.lookup(this.resourceUri, true) as DsEntry | PdsEntry;
        if (dsEntry == null || FsDatasetsUtils.isPdsEntry(dsEntry)) {
            return;
        }

        return dsEntry.stats;
    }

    public setProfileToChoice(profile: imperative.IProfileLoaded): void {
        super.setProfileToChoice(profile, DatasetFSProvider.instance);
    }

    /**
     * Retrieves child nodes of this ZoweDatasetNode
     *
     * @returns {Promise<ZoweDatasetNode[]>}
     */
    public async getChildren(): Promise<ZoweDatasetNode[]> {
        ZoweLogger.trace(`ZoweDatasetNode.getChildren called for ${this.label as string}.`);
        if (!this.pattern && SharedContext.isSessionNotFav(this)) {
            const placeholder = new ZoweDatasetNode({
                label: vscode.l10n.t("Use the search button to display data sets"),
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                parentNode: this,
                contextOverride: Constants.INFORMATION_CONTEXT,
            });
            return (this.children = [placeholder]);
        }
        if (SharedContext.isDocument(this) || SharedContext.isInformation(this)) {
            return [];
        }

        if (!this.dirty || this.label === "Favorites") {
            return this.children;
        }

        if (!this.label) {
            Gui.errorMessage(vscode.l10n.t("Invalid node"));
            throw Error(vscode.l10n.t("Invalid node"));
        }

        // Gets the datasets from the pattern or members of the dataset and displays any thrown errors
        const cachedProfile = Profiles.getInstance().loadNamedProfile(this.getProfileName());
        const responses = await this.getDatasets(cachedProfile);

        // push nodes to an object with property names to avoid duplicates
        const elementChildren: { [k: string]: ZoweDatasetNode } = {};
        for (const response of responses) {
            // Throws reject if the Zowe command does not throw an error but does not succeed
            // The dataSetsMatchingPattern API may return success=false and apiResponse=[] when no data sets found
            if (!response.success && !(Array.isArray(response.apiResponse) && response.apiResponse.length === 0)) {
                await AuthUtils.errorHandling(vscode.l10n.t("The response from Zowe CLI was not successful"));
                return [];
            }

            // Loops through all the returned dataset members and creates nodes for them
            const existingItems: Record<string, ZoweDatasetNode> = {};
            for (const element of this.children) {
                existingItems[element.label.toString()] = element;
            }
            for (const item of response.apiResponse.items ?? response.apiResponse) {
                let dsNode = existingItems[item.dsname ?? item.member];
                if (dsNode != null) {
                    elementChildren[dsNode.label.toString()] = dsNode;
                    // Creates a ZoweDatasetNode for a PDS
                } else if (item.dsorg === "PO" || item.dsorg === "PO-E") {
                    dsNode = new ZoweDatasetNode({
                        label: item.dsname,
                        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                        parentNode: this,
                        profile: cachedProfile,
                    });
                    elementChildren[dsNode.label.toString()] = dsNode;
                    // Creates a ZoweDatasetNode for a dataset with imperative errors
                } else if (item.error instanceof imperative.ImperativeError) {
                    dsNode = new ZoweDatasetNode({
                        label: item.dsname,
                        collapsibleState: vscode.TreeItemCollapsibleState.None,
                        parentNode: this,
                        contextOverride: Constants.DS_FILE_ERROR_CONTEXT,
                        profile: cachedProfile,
                    });
                    dsNode.command = { command: "zowe.placeholderCommand", title: "" };
                    dsNode.errorDetails = item.error; // Save imperative error to avoid extra z/OS requests
                    elementChildren[dsNode.label.toString()] = dsNode;
                    // Creates a ZoweDatasetNode for a migrated dataset
                } else if (item.migr && item.migr.toUpperCase() === "YES") {
                    dsNode = new ZoweDatasetNode({
                        label: item.dsname,
                        collapsibleState: vscode.TreeItemCollapsibleState.None,
                        parentNode: this,
                        contextOverride: Constants.DS_MIGRATED_FILE_CONTEXT,
                        profile: cachedProfile,
                    });
                    elementChildren[dsNode.label.toString()] = dsNode;
                    // Creates a ZoweDatasetNode for a VSAM file
                } else if (item.dsorg === "VS") {
                    let altLabel = item.dsname;
                    let endPoint = altLabel.indexOf(".DATA");
                    if (endPoint === -1) {
                        endPoint = altLabel.indexOf(".INDEX");
                    }
                    if (endPoint > -1) {
                        altLabel = altLabel.substring(0, endPoint);
                    }
                    if (!elementChildren[altLabel]) {
                        elementChildren[altLabel] = new ZoweDatasetNode({
                            label: altLabel,
                            collapsibleState: vscode.TreeItemCollapsibleState.None,
                            parentNode: this,
                            contextOverride: Constants.VSAM_CONTEXT,
                            profile: cachedProfile,
                        });
                    }
                } else if (SharedContext.isSession(this)) {
                    // Creates a ZoweDatasetNode for a PS
                    const cachedEncoding = this.getEncodingInMap(item.dsname);
                    dsNode = new ZoweDatasetNode({
                        label: item.dsname,
                        collapsibleState: vscode.TreeItemCollapsibleState.None,
                        parentNode: this,
                        encoding: cachedEncoding,
                        profile: cachedProfile,
                        contextOverride: cachedEncoding?.kind === "binary" ? Constants.DS_DS_BINARY_CONTEXT : Constants.DS_DS_CONTEXT,
                    });
                    elementChildren[dsNode.label.toString()] = dsNode;
                } else if (item.member) {
                    // Creates a ZoweDatasetNode for a PDS member
                    const cachedEncoding = this.getEncodingInMap(`${item.dsname as string}(${item.member as string})`);
                    dsNode = new ZoweDatasetNode({
                        label: item.member,
                        collapsibleState: vscode.TreeItemCollapsibleState.None,
                        parentNode: this,
                        encoding: cachedEncoding,
                        profile: cachedProfile,
                    });

                    // get user and last modified date for sorting, if available
                    elementChildren[dsNode.label.toString()] = dsNode;
                }

                if (dsNode?.resourceUri != null) {
                    if (dsNode.collapsibleState !== vscode.TreeItemCollapsibleState.None) {
                        // Create an entry for the PDS if it doesn't exist.
                        if (!DatasetFSProvider.instance.exists(dsNode.resourceUri)) {
                            await vscode.workspace.fs.createDirectory(dsNode.resourceUri);
                        }
                    } else {
                        // Create an entry for the data set if it doesn't exist.
                        if (!DatasetFSProvider.instance.exists(dsNode.resourceUri)) {
                            await vscode.workspace.fs.writeFile(dsNode.resourceUri, new Uint8Array());
                        }
                    }
                    dsNode.updateStats(item);
                }
            }

            if (
                response.apiResponse.items &&
                response.apiResponse.returnedRows &&
                response.apiResponse.items.length < response.apiResponse.returnedRows
            ) {
                const invalidMemberCount = response.apiResponse.returnedRows - response.apiResponse.items.length;
                const dsNode = new ZoweDatasetNode({
                    label: `${invalidMemberCount} members with errors`,
                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                    parentNode: this,
                    contextOverride: Constants.DS_FILE_ERROR_MEMBER_CONTEXT,
                    profile: this.getProfile(),
                });
                dsNode.command = { command: "zowe.placeholderCommand", title: "" };
                dsNode.errorDetails = new imperative.ImperativeError({
                    msg: vscode.l10n.t("{0} members failed to load due to invalid name errors for {1}", invalidMemberCount, this.label as string),
                });
                elementChildren[dsNode.label.toString()] = dsNode;
            }
        }

        this.dirty = false;
        if (Object.keys(elementChildren).length === 0) {
            const placeholder = new ZoweDatasetNode({
                label: vscode.l10n.t("No data sets found"),
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                parentNode: this,
                contextOverride: Constants.INFORMATION_CONTEXT,
            });
            this.children = [placeholder];
        } else {
            const newChildren = Object.keys(elementChildren)
                .filter((label) => this.children.find((c) => (c.label as string) === label) == null)
                .map((label) => elementChildren[label]);

            // get sort settings for session
            const sessionSort = SharedContext.isSession(this) ? this.sort : this.getSessionNode().sort;

            // use the PDS sort settings if defined; otherwise, use session sort method
            const sortOpts = this.sort ?? sessionSort;

            // use the PDS filter if one is set, otherwise try using the session filter
            const sessionFilter = SharedContext.isSession(this) ? this.filter : this.getSessionNode().filter;
            const filter = this.filter ?? sessionFilter;

            this.children = this.children
                .concat(newChildren)
                .filter((c) => (c.label as string) in elementChildren)
                .filter(filter ? ZoweDatasetNode.filterBy(filter) : (_c): boolean => true)
                .sort(ZoweDatasetNode.sortBy(sortOpts));

            if (SharedContext.isSession(this)) {
                const dsTree = SharedTreeProviders.ds as DatasetTree;
                // set new search patterns for each child of getChildren
                dsTree.applyPatternsToChildren(this.children, this.patternMatches, this);
            }
        }

        return this.children;
    }

    /**
     * Returns a sorting function based on the given sorting method.
     * If the nodes are not PDS members, it will simply sort by name.
     * @param method The sorting method to use
     * @returns A function that sorts 2 nodes based on the given sorting method
     */
    public static sortBy(sort: Sorting.NodeSort): (a: ZoweDatasetNode, b: ZoweDatasetNode) => number {
        return (a, b): number => {
            const aParent = a.getParent();
            if (aParent == null || !SharedContext.isPds(aParent)) {
                return a.compareByName(b);
            } else if (a.contextValue === Constants.DS_FILE_ERROR_MEMBER_CONTEXT || b.contextValue === Constants.DS_FILE_ERROR_MEMBER_CONTEXT) {
                // Keep invalid member node at bottom ("N members with errors")
                return a.contextValue === Constants.DS_FILE_ERROR_MEMBER_CONTEXT ? 1 : -1;
            }

            const sortDirection = sort.direction == Sorting.SortDirection.Ascending ? 1 : -1;
            if (!a.getStats() && !b.getStats()) {
                return a.compareByName(b, sortDirection);
            }

            switch (sort.method) {
                case Sorting.DatasetSortOpts.DateCreated:
                    return a.compareByDateStat(b, "createdDate", sortDirection);
                case Sorting.DatasetSortOpts.LastModified:
                    return a.compareByDateStat(b, "modifiedDate", sortDirection);
                case Sorting.DatasetSortOpts.UserId:
                    return a.compareByStat(b, "user", sortDirection);
                default:
                    return a.compareByName(b, sortDirection);
            }
        };
    }

    private compareByName(otherNode: IZoweDatasetTreeNode, sortDirection = 1): number {
        return (this.label as string).localeCompare(otherNode.label as string) * sortDirection;
    }

    private compareByStat(otherNode: IZoweDatasetTreeNode, statName: keyof Types.DatasetStats, sortDirection = 1): number {
        const valueA = (this.getStats()?.[statName] as string) ?? "";
        const valueB = (otherNode.getStats()?.[statName] as string) ?? "";

        this.description = valueA;
        otherNode.description = valueB;

        if (!valueA && !valueB) {
            return this.compareByName(otherNode, sortDirection);
        } else if (!valueA) {
            return 1;
        } else if (!valueB) {
            return -1;
        }

        return (valueA.localeCompare(valueB) || this.compareByName(otherNode)) * sortDirection;
    }

    private compareByDateStat(otherNode: IZoweDatasetTreeNode, statName: "createdDate" | "modifiedDate", sortDirection = 1): number {
        const dateA = dayjs(this.getStats()?.[statName] ?? null);
        const dateB = dayjs(otherNode.getStats()?.[statName] ?? null);

        const aValid = dateA.isValid();
        const bValid = dateB.isValid();

        this.description = aValid ? dateA.format("YYYY/MM/DD") : undefined;
        otherNode.description = bValid ? dateB.format("YYYY/MM/DD") : undefined;

        if (!aValid && !bValid) {
            return this.compareByName(otherNode, sortDirection);
        } else if (!aValid) {
            return 1;
        } else if (!bValid) {
            return -1;
        }

        if (dateA.isSame(dateB, "second")) {
            return this.compareByName(otherNode, sortDirection);
        }

        return dateA.isBefore(dateB, "second") ? -sortDirection : sortDirection;
    }

    /**
     * Returns a filter function based on the given method.
     * If the nodes are not PDS members, it will not filter those nodes.
     * @param method The sorting method to use
     * @returns A function that sorts 2 nodes based on the given sorting method
     */
    public static filterBy(filter: Sorting.DatasetFilter): (node: IZoweDatasetTreeNode) => boolean {
        const isDateFilter = (f: string): boolean => {
            return dayjs(f).isValid();
        };

        return (node): boolean => {
            const aParent = node.getParent();
            if (aParent == null || !SharedContext.isPds(aParent)) {
                return true;
            }

            switch (filter.method) {
                case Sorting.DatasetFilterOpts.LastModified:
                    if (!isDateFilter(filter.value)) {
                        return true;
                    }

                    return dayjs(node.getStats()?.modifiedDate).isSame(filter.value, "day");
                case Sorting.DatasetFilterOpts.UserId:
                    return node.getStats()?.user === filter.value;
            }
        };
    }

    public getSessionNode(): IZoweDatasetTreeNode {
        ZoweLogger.trace("ZoweDatasetNode.getSessionNode called.");
        return this.session ? this : (this.getParent()?.getSessionNode() as IZoweDatasetTreeNode) ?? this;
    }
    /**
     * Returns the [etag] for this node
     *
     * @returns {string}
     */
    public getEtag(): string {
        ZoweLogger.trace("ZoweDatasetNode.getEtag called.");
        const fileEntry = DatasetFSProvider.instance.lookup(this.resourceUri, true) as DsEntry;
        return fileEntry?.etag;
    }

    private async getDatasets(profile: imperative.IProfileLoaded): Promise<zosfiles.IZosFilesResponse[]> {
        ZoweLogger.trace("ZoweDatasetNode.getDatasets called.");
        const responses: zosfiles.IZosFilesResponse[] = [];
        const options: zosfiles.IListOptions = {
            attributes: true,
            responseTimeout: profile.profile.responseTimeout,
        };
        const isSession = SharedContext.isSession(this) || SharedContext.isFavoriteSearch(this);
        if (isSession) {
            const fullPattern = SharedContext.isFavoriteSearch(this) ? (this.label as string) : this.pattern;
            const dsTree = SharedTreeProviders.ds as DatasetTree;
            this.patternMatches = dsTree.extractPatterns(fullPattern);
            const dsPattern = dsTree.buildFinalPattern(this.patternMatches);
            if (dsPattern.length != 0) {
                if (dsPattern !== this.pattern) {
                    // reset and remove previous search patterns if pattern has changed
                    dsTree.resetFilterForChildren(this.children);
                }
                this.tooltip = this.pattern = dsPattern.toUpperCase();
            }
        }

        try {
            if (isSession) {
                const dsPatterns = [
                    ...new Set(
                        this.pattern
                            .toUpperCase()
                            .split(",")
                            .map((p) => p.trim())
                    ),
                ];
                const mvsApi = ZoweExplorerApiRegister.getMvsApi(profile);
                if (!mvsApi.getSession(profile)) {
                    throw new imperative.ImperativeError({
                        msg: vscode.l10n.t("Profile auth error"),
                        additionalDetails: vscode.l10n.t("Profile is not authenticated, please log in to continue"),
                        errorCode: `${imperative.RestConstants.HTTP_STATUS_401}`,
                    });
                }
                if (mvsApi.dataSetsMatchingPattern) {
                    responses.push(await mvsApi.dataSetsMatchingPattern(dsPatterns));
                } else {
                    for (const dsp of dsPatterns) {
                        responses.push(await mvsApi.dataSet(dsp));
                    }
                }
            } else if (this.memberPattern) {
                this.memberPattern = this.memberPattern.toUpperCase();
                for (const memPattern of this.memberPattern.split(",")) {
                    options.pattern = memPattern;
                    responses.push(await ZoweExplorerApiRegister.getMvsApi(profile).allMembers(this.label as string, options));
                }
            } else {
                responses.push(await ZoweExplorerApiRegister.getMvsApi(profile).allMembers(this.label as string, options));
            }
        } catch (error) {
            const updated = await AuthUtils.errorHandling(error, this.getProfileName(), vscode.l10n.t("Retrieving response from MVS list API"));
            AuthUtils.syncSessionNode((prof) => ZoweExplorerApiRegister.getMvsApi(prof), this.getSessionNode(), updated && this);
        }
        return responses;
    }

    public async openDs(forceDownload: boolean, _previewMember: boolean, datasetProvider: Types.IZoweDatasetTreeType): Promise<void> {
        ZoweLogger.trace("ZoweDatasetNode.openDs called.");
        await datasetProvider.checkCurrentProfile(this);
        const invalidItem = vscode.l10n.t("Cannot download, item invalid.");
        switch (true) {
            case SharedContext.isFavorite(this):
            case SharedContext.isSessionNotFav(this.getParent()):
                break;
            case SharedContext.isFavoritePds(this.getParent()):
            case SharedContext.isPdsNotFav(this.getParent()):
                break;
            default:
                ZoweLogger.error("ZoweDatasetNode.openDs: " + invalidItem);
                Gui.errorMessage(invalidItem);
                throw Error(invalidItem);
        }

        if (Profiles.getInstance().validProfile !== Validation.ValidationType.INVALID) {
            try {
                if (forceDownload) {
                    // if the encoding has changed, fetch the contents with the new encoding
                    await DatasetFSProvider.instance.fetchDatasetAtUri(this.resourceUri);
                    await vscode.commands.executeCommand("vscode.open", this.resourceUri);
                    await DatasetFSProvider.revertFileInEditor();
                } else {
                    await vscode.commands.executeCommand("vscode.open", this.resourceUri);
                }
                if (datasetProvider) {
                    datasetProvider.addFileHistory(`[${this.getProfileName()}]: ${this.label as string}`);
                }
            } catch (err) {
                await AuthUtils.errorHandling(err, this.getProfileName());
                throw err;
            }
        }
    }

    public getEncoding(): ZosEncoding {
        return DatasetFSProvider.instance.getEncodingForFile(this.resourceUri);
    }

    public setEncoding(encoding: ZosEncoding): void {
        ZoweLogger.trace("ZoweDatasetNode.setEncoding called.");
        if (!(this.contextValue.startsWith(Constants.DS_DS_CONTEXT) || this.contextValue.startsWith(Constants.DS_MEMBER_CONTEXT))) {
            throw new Error(`Cannot set encoding for node with context ${this.contextValue}`);
        }
        const isMemberNode = this.contextValue.startsWith(Constants.DS_MEMBER_CONTEXT);
        if (encoding?.kind === "binary") {
            this.contextValue = isMemberNode ? Constants.DS_MEMBER_BINARY_CONTEXT : Constants.DS_DS_BINARY_CONTEXT;
        } else {
            this.contextValue = isMemberNode ? Constants.DS_MEMBER_CONTEXT : Constants.DS_DS_CONTEXT;
        }
        DatasetFSProvider.instance.setEncodingForFile(this.resourceUri, encoding);
        const fullPath = isMemberNode ? `${this.getParent().label as string}(${this.label as string})` : (this.label as string);
        if (encoding != null) {
            this.updateEncodingInMap(fullPath, encoding);
        } else {
            delete DatasetFSProvider.instance.encodingMap[fullPath];
        }
        if (this.getParent() && this.getParent().contextValue === Constants.FAV_PROFILE_CONTEXT) {
            this.contextValue += Constants.FAV_SUFFIX;
        }

        const icon = IconGenerator.getIconByNode(this);
        if (icon) {
            this.setIcon(icon.path);
        }

        this.dirty = true;
    }

    /**
     * Helper method which sets an icon of node and initiates reloading of tree
     * @param iconPath
     */
    public setIcon(iconPath: { light: string; dark: string }): void {
        ZoweLogger.trace("ZoweDatasetNode.setIcon called.");
        this.iconPath = iconPath;
        vscode.commands.executeCommand("zowe.ds.refreshDataset", this);
    }
}
