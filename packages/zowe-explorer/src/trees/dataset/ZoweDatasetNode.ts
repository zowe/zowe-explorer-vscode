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

import { IZosmfListResponse, IZosFilesResponse } from "@zowe/zos-files-for-zowe-sdk";
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
    ZoweExplorerApiType,
    Paginator,
    IFetchResult,
    NavigationTreeItem,
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
import { SettingsConfig } from "../../configuration/SettingsConfig";

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
    public prevPattern = "";
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

    private paginator?: Paginator<IZosFilesResponse>;
    private paginatorData?: {
        totalItems?: number;
        lastItemName?: string;
    };
    private itemsPerPage?: number;

    /**
     * Creates an instance of ZoweDatasetNode
     *
     * @param {IZoweTreeOpts} opts
     */

    public constructor(opts: Definitions.IZoweDatasetTreeOpts) {
        super(opts.label, opts.collapsibleState, opts.parentNode, opts.session, opts.profile);
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
        if (opts.contextOverride?.includes(Constants.DS_SESSION_CONTEXT)) {
            const toolTipList: string[] = [];
            toolTipList.push(`${vscode.l10n.t("Profile: ")}${opts.label}`);
            toolTipList.push(`${vscode.l10n.t("Profile Type: ")}${opts.profile.type}`);
            this.tooltip = toolTipList.join("\n");
        } else {
            this.tooltip = this.label as string;
        }
        const icon = IconGenerator.getIconByNode(this);
        if (icon) {
            this.iconPath = icon.path;
        }

        if (this.getParent() == null || this.getParent().label === vscode.l10n.t("Favorites")) {
            // read sort options from settings file
            const sortSetting = SharedUtils.getDefaultSortOptions(
                DatasetUtils.DATASET_SORT_OPTS,
                Constants.SETTINGS_DS_DEFAULT_SORT,
                Sorting.DatasetSortOpts
            );
            this.sort = {
                method: sortSetting.method,
                direction: sortSetting.direction,
            };
        }

        if (SharedContext.isSession(this) && this.getParent() == null) {
            this.id = this.label as string;
        }

        if (this.label !== vscode.l10n.t("Favorites") && this.contextValue !== Constants.DS_MIGRATED_FILE_CONTEXT) {
            const sessionLabel = opts.profile?.name ?? SharedUtils.getSessionLabel(this);
            if (
                this.contextValue === Constants.DS_DS_CONTEXT ||
                this.contextValue === Constants.DS_FAV_CONTEXT ||
                this.contextValue === Constants.DS_PDS_CONTEXT ||
                this.contextValue === Constants.PDS_FAV_CONTEXT
            ) {
                this.resourceUri = vscode.Uri.from({
                    scheme: ZoweScheme.DS,
                    path: `/${sessionLabel}/${this.label as string}`,
                });
                if (this.contextValue === Constants.DS_DS_CONTEXT || this.contextValue === Constants.DS_FAV_CONTEXT) {
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
                if (this.getParent() == null || this.getParent()?.label === vscode.l10n.t("Favorites")) {
                    // session nodes
                    DatasetFSProvider.instance.createDirectory(this.resourceUri);
                } else if (this.contextValue === Constants.INFORMATION_CONTEXT) {
                    this.command = { command: "zowe.placeholderCommand", title: "Placeholder" };
                }
            }

            if (opts.encoding != null) {
                this.setEncoding(opts.encoding);
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

    /**
     * Updates this node so the recalled data set can be interacted with.
     * @param isPds Whether the data set is a PDS
     */
    private async datasetRecalled(isPds: boolean): Promise<void> {
        // Change context value to match dsorg, update collapsible state and assign resource URI
        // Preserve favorite context and any additional context values
        this.contextValue = this.contextValue.replace(Constants.DS_MIGRATED_FILE_CONTEXT, isPds ? Constants.DS_PDS_CONTEXT : Constants.DS_DS_CONTEXT);
        this.collapsibleState = isPds ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
        this.resourceUri = vscode.Uri.from({
            scheme: ZoweScheme.DS,
            path: `/${SharedUtils.getSessionLabel(this)}/${this.label as string}`,
        });

        // Replace icon on existing node with new one
        const icon = IconGenerator.getIconByNode(this);
        if (icon) {
            this.setIcon(icon.path);
        }

        // Create entry in the filesystem to represent the recalled data set
        if (isPds) {
            await vscode.workspace.fs.createDirectory(this.resourceUri);
        } else {
            this.command = { command: "vscode.open", title: "", arguments: [this.resourceUri] };
            if (!DatasetFSProvider.instance.exists(this.resourceUri)) {
                await vscode.workspace.fs.writeFile(this.resourceUri, new Uint8Array());
            }
        }
    }

    /**
     * Updates this data set node so it is marked as migrated.
     */
    public datasetMigrated(): void {
        // Change the context value and collapsible state to represent a migrated data set
        // Preserve favorite context and any additional context values
        const isBinary = SharedContext.isBinary(this);
        const isPds = this.collapsibleState !== vscode.TreeItemCollapsibleState.None;
        let previousContext = isBinary ? Constants.DS_DS_BINARY_CONTEXT : Constants.DS_DS_CONTEXT;
        if (isPds) {
            previousContext = Constants.DS_PDS_CONTEXT;
        }
        this.contextValue = this.contextValue.replace(previousContext, Constants.DS_MIGRATED_FILE_CONTEXT);
        this.collapsibleState = vscode.TreeItemCollapsibleState.None;

        // Remove the entry from the file system
        DatasetFSProvider.instance.removeEntry(this.resourceUri);

        // Remove the node's resource URI and command
        this.resourceUri = this.command = undefined;

        // Assign migrated icon to the data set node
        const icon = IconGenerator.getIconByNode(this);
        if (icon) {
            this.setIcon(icon.path);
        }
    }

    /**
     * Retrieves child nodes of this ZoweDatasetNode
     *
     * @returns {Promise<ZoweDatasetNode[]>}
     */
    public async getChildren(paginate?: boolean): Promise<ZoweDatasetNode[]> {
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

        if ((!this.dirty && !paginate) || this.label === "Favorites") {
            return this.children;
        }

        if (!this.label) {
            Gui.errorMessage(vscode.l10n.t("Invalid node"));
            throw Error(vscode.l10n.t("Invalid node"));
        }

        // Gets the datasets from the pattern or members of the dataset and displays any thrown errors
        const cachedProfile = Profiles.getInstance().loadNamedProfile(this.getProfileName());
        const responses = await this.getDatasets(cachedProfile, paginate);
        if (responses == null) {
            return [];
        }

        // push nodes to an object with property names to avoid duplicates
        const elementChildren: { [k: string]: ZoweDatasetNode } = {};
        for (const response of responses) {
            // Throws reject if the Zowe command does not throw an error but does not succeed
            // The dataSetsMatchingPattern API may return success=false and apiResponse=[] when no data sets found
            if (!response.success && !(Array.isArray(response.apiResponse) && response.apiResponse.length === 0)) {
                await AuthUtils.errorHandling(new imperative.ImperativeError({ msg: response.commandResponse }), {
                    apiType: ZoweExplorerApiType.Mvs,
                    profile: cachedProfile,
                    scenario: vscode.l10n.t("The response from Zowe CLI was not successful"),
                });
                return [];
            }

            // Loops through all the returned dataset members and creates nodes for them
            const existingItems: Record<string, ZoweDatasetNode> = {};
            for (const element of this.children) {
                existingItems[element.label.toString()] = element;
            }
            for (const item of (response.apiResponse.items ?? response.apiResponse) as IZosmfListResponse[]) {
                let dsNode = existingItems[item.dsname ?? item.member];
                if (dsNode != null) {
                    elementChildren[dsNode.label.toString()] = dsNode;
                    if (item.migr) {
                        const migrationStatus = item.migr.toUpperCase();
                        if (SharedContext.isMigrated(dsNode) && migrationStatus !== "YES") {
                            await dsNode.datasetRecalled(item.dsorg?.startsWith("PO"));
                        } else if (!SharedContext.isMigrated(dsNode) && migrationStatus === "YES") {
                            dsNode.datasetMigrated();
                        }
                    }
                } else if (item.migr && item.migr.toUpperCase() === "YES") {
                    // Creates a ZoweDatasetNode for a migrated dataset
                    dsNode = new ZoweDatasetNode({
                        label: item.dsname,
                        collapsibleState: vscode.TreeItemCollapsibleState.None,
                        parentNode: this,
                        contextOverride: Constants.DS_MIGRATED_FILE_CONTEXT,
                        profile: cachedProfile,
                    });
                    elementChildren[dsNode.label.toString()] = dsNode;
                } else if (item.dsorg?.startsWith("PO")) {
                    // Creates a ZoweDatasetNode for a PDS
                    dsNode = new ZoweDatasetNode({
                        label: item.dsname,
                        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                        parentNode: this,
                        profile: cachedProfile,
                    });
                    elementChildren[dsNode.label.toString()] = dsNode;
                } else if ((item as any).error instanceof imperative.ImperativeError) {
                    // Creates a ZoweDatasetNode for a dataset with imperative errors
                    dsNode = new ZoweDatasetNode({
                        label: item.dsname,
                        collapsibleState: vscode.TreeItemCollapsibleState.None,
                        parentNode: this,
                        contextOverride: Constants.DS_FILE_ERROR_CONTEXT,
                        profile: cachedProfile,
                    });
                    dsNode.command = { command: "zowe.placeholderCommand", title: "" };
                    dsNode.errorDetails = (item as any).error; // Save imperative error to avoid extra z/OS requests
                    elementChildren[dsNode.label.toString()] = dsNode;
                } else if (item.dsorg === "VS") {
                    // Creates a ZoweDatasetNode for a VSAM file
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
                    const cachedEncoding = this.getEncodingInMap(`${item.dsname}(${item.member})`);
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
                // Reset and remove previous search patterns in case pattern has changed
                dsTree.resetFilterForChildren(this.children);
                // set new search patterns for each child of getChildren
                dsTree.applyPatternsToChildren(this.children, this.patternMatches);
            }
        }

        const canNavigate = this.paginator && (this.paginator.canGoPrevious() || this.paginator.canGoNext());

        if (
            paginate &&
            canNavigate &&
            (SharedContext.isSession(this) || SharedContext.isPds(this)) &&
            this.paginatorData.totalItems > this.paginator.getMaxItemsPerPage()
        ) {
            const prevPage = new NavigationTreeItem(
                vscode.l10n.t("Previous page"),
                "arrow-small-left",
                !this.paginator.canGoPrevious(),
                "zowe.executeNavCallback",
                () =>
                    Gui.withProgress(
                        {
                            location: { viewId: "zowe.ds.explorer" },
                        },
                        async () => {
                            await this.paginator.fetchPreviousPage();
                            SharedTreeProviders.ds.nodeDataChanged?.(this);
                        }
                    )
            );
            const pageNum = this.paginator.getCurrentPageIndex() + 1;
            if (!prevPage.disabled) {
                prevPage.description = `${pageNum - 1}/${this.paginator.getPageCount()}`;
            }

            const nextPage = new NavigationTreeItem(
                vscode.l10n.t("Next page"),
                "arrow-small-right",
                !this.paginator.canGoNext(),
                "zowe.executeNavCallback",
                () =>
                    Gui.withProgress(
                        {
                            location: { viewId: "zowe.ds.explorer" },
                        },
                        async () => {
                            await this.paginator.fetchNextPage();
                            SharedTreeProviders.ds.nodeDataChanged?.(this);
                        }
                    )
            );
            if (!nextPage.disabled) {
                nextPage.description = `${pageNum + 1}/${this.paginator.getPageCount()}`;
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return [prevPage as any, ...this.children, nextPage as any];
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

    private async listDatasetsInRange(start?: string, limit?: number): Promise<IFetchResult<IZosFilesResponse, string>> {
        let totalItems = this.paginatorData?.totalItems;
        let lastDatasetName = this.paginatorData?.lastItemName;
        let allDatasets: IZosmfListResponse[] = [];
        const responses: IZosFilesResponse[] = [];

        try {
            if (this.dirty || totalItems == null || lastDatasetName == null) {
                const basicResponses: IZosFilesResponse[] = [];
                await this.listDatasets(basicResponses, { attributes: false });

                allDatasets = basicResponses
                    .filter((r) => r.success)
                    .reduce((arr: IZosmfListResponse[], r) => {
                        const responseItems: IZosmfListResponse[] = Array.isArray(r.apiResponse) ? r.apiResponse : r.apiResponse?.items;
                        return responseItems ? [...arr, ...responseItems] : arr;
                    }, []);

                this.paginatorData = {
                    totalItems: allDatasets.length,
                    lastItemName: allDatasets.at(-1)?.dsname,
                };
                totalItems = this.paginatorData.totalItems;
                lastDatasetName = this.paginatorData.lastItemName;
            } else {
                // Using cached data from the refresh to handle the page change
            }
            await this.listDatasets(responses, { attributes: true, start, maxLength: start ? limit + 1 : limit });
        } catch (err) {
            const updated = await AuthUtils.errorHandling(err, {
                apiType: ZoweExplorerApiType.Mvs,
                profile: this.getProfile(),
                scenario: vscode.l10n.t("Retrieving response from MVS list API"),
            });
            AuthUtils.syncSessionNode((prof) => ZoweExplorerApiRegister.getMvsApi(prof), this.getSessionNode(), updated && this);
            return;
        }

        const successfulResponses = responses
            .filter((response) => response.success)
            .map((resp) => {
                if (start == null || (resp.apiResponse?.items ?? resp.apiResponse)?.find((it: IZosmfListResponse) => it.dsname === start) == null) {
                    return resp;
                }

                // Assuming apiResponse is IZosmfListResponse[] or { items: IZosmfListResponse[] } (dataSetsMatchingPattern, dataSet)
                const items = Array.isArray(resp.apiResponse) ? resp.apiResponse : resp.apiResponse?.items;
                const filteredItems = items?.filter((it) => it.dsname !== start);

                return {
                    ...resp,
                    // Reconstruct apiResponse based on its original structure
                    apiResponse: Array.isArray(resp.apiResponse) ? filteredItems : { ...(resp.apiResponse ?? {}), items: filteredItems },
                };
            });

        const items: IZosmfListResponse[] = successfulResponses.reduce((prev: IZosmfListResponse[], resp): IZosmfListResponse[] => {
            const responseItems: IZosmfListResponse[] = Array.isArray(resp.apiResponse) ? resp.apiResponse : resp.apiResponse?.items;
            return responseItems ? [...prev, ...responseItems] : prev;
        }, []);

        const lastItem = items.length > 0 ? items.at(-1) : undefined;

        const nextPageCursor = limit && items.length === limit && lastItem && lastDatasetName !== lastItem.dsname ? lastItem.dsname : undefined;

        return {
            items: successfulResponses,
            nextPageCursor,
            totalItems,
        };
    }

    public async listDatasets(responses: IZosFilesResponse[], options?: Definitions.DatasetListOpts): Promise<void> {
        const dsPatterns = [
            ...new Set(
                this.pattern
                    .toUpperCase()
                    .split(",")
                    .map((p) => p.trim())
            ),
        ];
        const profile = options?.profile ?? Profiles.getInstance().loadNamedProfile(this.getProfile().name);
        const mvsApi = ZoweExplorerApiRegister.getMvsApi(profile);
        if (!mvsApi.getSession(profile)) {
            ZoweLogger.warn("[ZoweDatasetNode.listDatasets] Session undefined for profile " + profile.name);
            return;
        }
        if (mvsApi.dataSetsMatchingPattern) {
            responses.push(await mvsApi.dataSetsMatchingPattern(dsPatterns, options));
        } else {
            for (const dsp of dsPatterns) {
                responses.push(await mvsApi.dataSet(dsp, options));
            }
        }
    }

    private async listMembersInRange(start?: string, limit?: number): Promise<IFetchResult<IZosFilesResponse, string>> {
        let totalItems = this.paginatorData?.totalItems;
        let lastMemberName = this.paginatorData?.lastItemName;
        let allMembers: IZosmfListResponse[] = [];
        const responses: IZosFilesResponse[] = [];

        try {
            if (this.dirty || totalItems == null || lastMemberName == null) {
                const basicResponses: IZosFilesResponse[] = [];
                await this.listMembers(basicResponses, { attributes: false });

                totalItems = 0;
                allMembers = basicResponses
                    .filter((r) => r.success)
                    .reduce((arr: IZosmfListResponse[], r) => {
                        const items: IZosmfListResponse[] = r.apiResponse?.items;
                        totalItems += items.length;
                        return items ? [...arr, ...items] : arr;
                    }, []);

                this.paginatorData = {
                    totalItems,
                    lastItemName: allMembers.at(-1)?.member,
                };
                lastMemberName = this.paginatorData.lastItemName;
            } else {
                // Using cached data from the refresh to handle the page change
            }

            await this.listMembers(responses, { attributes: true, start, maxLength: start ? limit + 1 : limit });
        } catch (err) {
            const updated = await AuthUtils.errorHandling(err, {
                apiType: ZoweExplorerApiType.Mvs,
                profile: this.getProfile(),
                scenario: vscode.l10n.t("Retrieving response from MVS list API"),
            });
            AuthUtils.syncSessionNode((prof) => ZoweExplorerApiRegister.getMvsApi(prof), this.getSessionNode(), updated && this);
            return;
        }

        const successfulResponses = responses
            .filter((response) => response.success)
            .map((resp) => {
                const items = resp.apiResponse?.items;
                if (start == null || items == null || items.find((it: IZosmfListResponse) => it.member === start) == null) {
                    return resp;
                }

                // Remove the cursor item from the list as its already known/present in the page
                const filteredItems = items.filter((it) => it.member !== start);

                return {
                    ...resp,
                    apiResponse: Array.isArray(resp.apiResponse)
                        ? filteredItems
                        : {
                              ...(resp.apiResponse ?? {}),
                              items: filteredItems,
                              // Update returnedRows to reflect the list without the cursor item
                              // (difference between array length of `items` and `filteredItems`)
                              returnedRows: resp.apiResponse.returnedRows - (items.length - filteredItems.length),
                          },
                };
            });

        const items: IZosmfListResponse[] = successfulResponses.reduce((prev: IZosmfListResponse[], resp): IZosmfListResponse[] => {
            const responseItems: IZosmfListResponse[] = Array.isArray(resp.apiResponse) ? resp.apiResponse : resp.apiResponse?.items;
            return responseItems ? [...prev, ...responseItems] : prev;
        }, []);

        // The last item in the page is the cursor for the next page
        const lastItem = items.length > 0 ? items.at(-1) : undefined;

        // Use member name for cursor
        const nextPageCursor = limit && items.length === limit && lastItem && lastMemberName !== lastItem.member ? lastItem.member : undefined;

        return {
            items: successfulResponses,
            nextPageCursor,
            totalItems,
        };
    }

    public async listMembers(responses: IZosFilesResponse[], options?: Definitions.DatasetListOpts): Promise<void> {
        const profile = options?.profile ?? Profiles.getInstance().loadNamedProfile(this.getProfile().name);
        const mvsApi = ZoweExplorerApiRegister.getMvsApi(profile);
        if (!mvsApi.getSession(profile)) {
            ZoweLogger.warn("[ZoweDatasetNode.listMembers] Session undefined for profile " + profile.name);
            return;
        }

        const baseOptions = {
            attributes: true,
            responseTimeout: profile.profile.responseTimeout,
            ...options,
        };

        if (this.memberPattern) {
            // Fetching members for this PDS w/ matching member pattern(s)
            this.memberPattern = this.memberPattern.toUpperCase();
            for (const memPattern of this.memberPattern.split(",")) {
                baseOptions.pattern = memPattern.trim();
                responses.push(await mvsApi.allMembers(this.label as string, baseOptions));
            }
        } else {
            // Fetching members for this PDS
            responses.push(await mvsApi.allMembers(this.label as string, baseOptions));
        }
    }

    private async getDatasets(profile: imperative.IProfileLoaded, paginate?: boolean): Promise<IZosFilesResponse[] | undefined> {
        ZoweLogger.trace("ZoweDatasetNode.getDatasets called.");

        const responses: IZosFilesResponse[] = [];
        const isSession = SharedContext.isSession(this) || SharedContext.isFavoriteSearch(this);

        if (!isSession && !SharedContext.isPds(this)) {
            return;
        }

        let patternChanged = false;
        if (isSession) {
            const fullPattern = SharedContext.isFavoriteSearch(this) ? (this.label as string) : this.pattern;
            const dsTree = SharedTreeProviders.ds as DatasetTree;
            let finalPattern = fullPattern;
            if (fullPattern.length != 0 && SharedContext.isFavoriteSearch(this)) {
                this.patternMatches = dsTree.extractPatterns(fullPattern);
                finalPattern = dsTree.buildFinalPattern(this.patternMatches).toUpperCase();
            }
            if (finalPattern !== this.pattern) {
                // Force paginator and data to be re-initialized
                this.paginator = this.paginatorData = undefined;
            }
            patternChanged = this.prevPattern !== finalPattern || this.pattern !== finalPattern;
            this.pattern = this.prevPattern = finalPattern;
        }

        try {
            // Lazy initialization or re-initialization of paginator if needed
            const fetchFunction = isSession ? this.listDatasetsInRange.bind(this) : this.listMembersInRange.bind(this);
            this.itemsPerPage = SettingsConfig.getDirectValue<number>("zowe.ds.paginate.datasetsPerPage") ?? Constants.DEFAULT_ITEMS_PER_PAGE;

            if (isSession && patternChanged) {
                // Check if pattern changed for session
                this.paginator = this.paginatorData = undefined;
            }

            if (!this.paginator || this.paginator.getMaxItemsPerPage() !== this.itemsPerPage) {
                // Force paginator and data to be re-initialized if fetch function or page size changes, or if pattern changes
                this.paginator = new Paginator(this.itemsPerPage, fetchFunction);
            }

            // If node is dirty and pagination is enabled, refetch the current page's data
            // to reflect potential changes without changing the page itself.

            // If the page fetch fails, reset the paginator data to take the user back to the first page.
            if (this.dirty && paginate) {
                try {
                    await this.paginator.refetchCurrentPage();
                } catch (error) {
                    if (error instanceof Error) {
                        ZoweLogger.error(`[ZoweDatasetNode.getDatasets]: Error refetching current page: ${error.message}`);
                    }
                    if (
                        (error instanceof imperative.ImperativeError &&
                            Number(error.mDetails.errorCode) === imperative.RestConstants.HTTP_STATUS_401) ||
                        error.message.includes("All configured authentication methods failed")
                    ) {
                        throw error;
                    }
                    this.paginatorData = undefined;
                }
            }

            if (paginate && this.paginator) {
                // Ensure paginator is initialized if it hasn't been (first load or invalidated cache)
                if (!this.paginator.isInitialized() || this.paginatorData == null) {
                    await this.paginator.initialize();
                }
                responses.push(...this.paginator.getCurrentPageItems());
            } else {
                // Fetch all data sets or members when paginate is false
                if (isSession) {
                    await this.listDatasets(responses, { attributes: true, profile });
                } else {
                    await this.listMembers(responses, { attributes: true, profile });
                }
            }
        } catch (error) {
            const updated = await AuthUtils.errorHandling(error, {
                apiType: ZoweExplorerApiType.Mvs,
                profile: this.getProfile(),
                scenario: vscode.l10n.t("Retrieving response from MVS list API"),
            });
            AuthUtils.syncSessionNode((prof) => ZoweExplorerApiRegister.getMvsApi(prof), this.getSessionNode(), updated && this);
            return;
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
                    let criteria = `[${this.getProfileName()}]: `;
                    if (SharedContext.isDsMember(this)) {
                        criteria = `${criteria}${this.getParent().label as string}(${this.label as string})`;
                    } else {
                        criteria = `${criteria}${this.label as string}`;
                    }
                    datasetProvider.addFileHistory(criteria);
                }
            } catch (err) {
                await AuthUtils.errorHandling(err, { apiType: ZoweExplorerApiType.Mvs, profile: this.getProfile() });
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
        if (DatasetFSProvider.instance.exists(this.resourceUri)) {
            DatasetFSProvider.instance.setEncodingForFile(this.resourceUri, encoding);
        } else {
            DatasetFSProvider.instance.makeEmptyDsWithEncoding(this.resourceUri, encoding);
        }
        if (encoding != null) {
            this.updateEncodingInMap(this.resourceUri.path, encoding);
        } else {
            delete DatasetFSProvider.instance.encodingMap[this.resourceUri.path];
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
