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
            if (this.getParent() == null || this.getParent().label === vscode.l10n.t("Favorites")) {
                this.resourceUri = vscode.Uri.from({
                    scheme: ZoweScheme.DS,
                    path: `/${sessionLabel}/`,
                });
                DatasetFSProvider.instance.createDirectory(this.resourceUri);
            } else if (
                this.contextValue === Constants.DS_DS_CONTEXT ||
                this.contextValue === Constants.DS_PDS_CONTEXT ||
                this.contextValue === Constants.DS_MIGRATED_FILE_CONTEXT
            ) {
                this.resourceUri = vscode.Uri.from({
                    scheme: ZoweScheme.DS,
                    path: `/${sessionLabel}/${this.label as string}`,
                });
                if (this.contextValue === Constants.DS_DS_CONTEXT) {
                    this.command = {
                        command: "vscode.open",
                        title: "",
                        arguments: [this.resourceUri],
                    };
                }
            } else if (this.contextValue === Constants.DS_MEMBER_CONTEXT) {
                this.resourceUri = vscode.Uri.from({
                    scheme: ZoweScheme.DS,
                    path: `/${sessionLabel}/${this.getParent().label as string}/${this.label as string}`,
                });
                this.command = {
                    command: "vscode.open",
                    title: "",
                    arguments: [this.resourceUri],
                };
            } else {
                this.resourceUri = null;
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

    /**
     * Retrieves child nodes of this ZoweDatasetNode
     *
     * @returns {Promise<ZoweDatasetNode[]>}
     */
    public async getChildren(): Promise<ZoweDatasetNode[]> {
        ZoweLogger.trace("ZoweDatasetNode.getChildren called.");
        if (!this.pattern && SharedContext.isSessionNotFav(this)) {
            const placeholder = new ZoweDatasetNode({
                label: vscode.l10n.t("Use the search button to display data sets"),
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                parentNode: this,
                contextOverride: Constants.INFORMATION_CONTEXT,
                profile: null,
            });
            placeholder.command = {
                command: "zowe.placeholderCommand",
                title: "Placeholder",
            };
            return [placeholder];
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
        if (responses.length === 0) {
            return;
        }

        // push nodes to an object with property names to avoid duplicates
        const elementChildren: { [k: string]: ZoweDatasetNode } = {};
        for (const response of responses) {
            // Throws reject if the Zowe command does not throw an error but does not succeed
            // The dataSetsMatchingPattern API may return success=false and apiResponse=[] when no data sets found
            if (!response.success && !(Array.isArray(response.apiResponse) && response.apiResponse.length === 0)) {
                await AuthUtils.errorHandling(vscode.l10n.t("The response from Zowe CLI was not successful"));
                return;
            }

            // Loops through all the returned dataset members and creates nodes for them
            for (const item of response.apiResponse.items ?? response.apiResponse) {
                const dsEntry = item.dsname ?? item.member;
                const existing = this.children.find((element) => element.label.toString() === dsEntry);
                let temp = existing;
                if (existing) {
                    elementChildren[existing.label.toString()] = existing;
                    // Creates a ZoweDatasetNode for a PDS
                } else if (item.dsorg === "PO" || item.dsorg === "PO-E") {
                    temp = new ZoweDatasetNode({
                        label: item.dsname,
                        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                        parentNode: this,
                        profile: cachedProfile,
                    });
                    elementChildren[temp.label.toString()] = temp;
                    // Creates a ZoweDatasetNode for a dataset with imperative errors
                } else if (item.error instanceof imperative.ImperativeError) {
                    temp = new ZoweDatasetNode({
                        label: item.dsname,
                        collapsibleState: vscode.TreeItemCollapsibleState.None,
                        parentNode: this,
                        contextOverride: Constants.DS_FILE_ERROR_CONTEXT,
                        profile: cachedProfile,
                    });
                    temp.errorDetails = item.error; // Save imperative error to avoid extra z/OS requests
                    elementChildren[temp.label.toString()] = temp;
                    // Creates a ZoweDatasetNode for a migrated dataset
                } else if (item.migr && item.migr.toUpperCase() === "YES") {
                    temp = new ZoweDatasetNode({
                        label: item.dsname,
                        collapsibleState: vscode.TreeItemCollapsibleState.None,
                        parentNode: this,
                        contextOverride: Constants.DS_MIGRATED_FILE_CONTEXT,
                        profile: cachedProfile,
                    });
                    elementChildren[temp.label.toString()] = temp;
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
                    temp = new ZoweDatasetNode({
                        label: item.dsname,
                        collapsibleState: vscode.TreeItemCollapsibleState.None,
                        parentNode: this,
                        encoding: cachedEncoding,
                        profile: cachedProfile,
                    });
                    temp.command = { command: "vscode.open", title: "", arguments: [temp.resourceUri] };
                    elementChildren[temp.label.toString()] = temp;
                } else if (item.member) {
                    // Creates a ZoweDatasetNode for a PDS member
                    const memberInvalid = item.member.includes("\ufffd");
                    const cachedEncoding = this.getEncodingInMap(`${item.dsname as string}(${item.member as string})`);
                    temp = new ZoweDatasetNode({
                        label: item.member,
                        collapsibleState: vscode.TreeItemCollapsibleState.None,
                        parentNode: this,
                        contextOverride: memberInvalid ? Constants.DS_FILE_ERROR_CONTEXT : undefined,
                        encoding: cachedEncoding,
                        profile: cachedProfile,
                    });
                    if (!memberInvalid) {
                        temp.command = { command: "vscode.open", title: "", arguments: [temp.resourceUri] };
                    } else {
                        temp.errorDetails = new imperative.ImperativeError({
                            msg: vscode.l10n.t({
                                message: "Cannot access member with control characters in the name: {0}",
                                args: [item.member],
                                comment: ["Data Set member"],
                            }),
                        });
                    }

                    // get user and last modified date for sorting, if available
                    elementChildren[temp.label.toString()] = temp;
                }

                if (temp == null) {
                    continue;
                }

                if (temp.resourceUri) {
                    if (temp.collapsibleState !== vscode.TreeItemCollapsibleState.None) {
                        // Create an entry for the PDS if it doesn't exist.
                        if (!DatasetFSProvider.instance.exists(temp.resourceUri)) {
                            await vscode.workspace.fs.createDirectory(temp.resourceUri);
                        }
                    } else {
                        // Create an entry for the data set if it doesn't exist.
                        if (!DatasetFSProvider.instance.exists(temp.resourceUri)) {
                            await vscode.workspace.fs.writeFile(temp.resourceUri, new Uint8Array());
                        }
                        temp.command = {
                            command: "vscode.open",
                            title: vscode.l10n.t("Open"),
                            arguments: [temp.resourceUri],
                        };
                    }
                    temp.updateStats(item);
                }
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
            placeholder.command = {
                command: "zowe.placeholderCommand",
                title: "Placeholder",
            };
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
        }

        return this.children;
    }

    /**
     * Returns a sorting function based on the given sorting method.
     * If the nodes are not PDS members, it will simply sort by name.
     * @param method The sorting method to use
     * @returns A function that sorts 2 nodes based on the given sorting method
     */
    public static sortBy(sort: Sorting.NodeSort): (a: IZoweDatasetTreeNode, b: IZoweDatasetTreeNode) => number {
        return (a, b): number => {
            const aParent = a.getParent();
            if (aParent == null || !SharedContext.isPds(aParent)) {
                return (a.label as string) < (b.label as string) ? -1 : 1;
            }

            const sortLessThan = sort.direction == Sorting.SortDirection.Ascending ? -1 : 1;
            const sortGreaterThan = sortLessThan * -1;

            const sortByName = (nodeA: IZoweDatasetTreeNode, nodeB: IZoweDatasetTreeNode): number =>
                (nodeA.label as string) < (nodeB.label as string) ? sortLessThan : sortGreaterThan;

            const aStats = a.getStats();
            const bStats = b.getStats();

            if (!aStats && !bStats) {
                return sortByName(a, b);
            }

            function sortByDate(aDate: Date, bDate: Date): number {
                const dateA = dayjs(aDate ?? null);
                const dateB = dayjs(bDate ?? null);

                const aValid = dateA.isValid();
                const bValid = dateB.isValid();

                a.description = aValid ? dateA.format("YYYY/MM/DD") : undefined;
                b.description = bValid ? dateB.format("YYYY/MM/DD") : undefined;

                if (!aValid) {
                    return sortGreaterThan;
                }

                if (!bValid) {
                    return sortLessThan;
                }

                if (dateA.isSame(dateB, "second")) {
                    return sortByName(a, b);
                }
                return dateA.isBefore(dateB, "second") ? sortLessThan : sortGreaterThan;
            }

            switch (sort.method) {
                case Sorting.DatasetSortOpts.DateCreated: {
                    return sortByDate(aStats?.createdDate, bStats?.createdDate);
                }
                case Sorting.DatasetSortOpts.LastModified: {
                    return sortByDate(aStats?.modifiedDate, bStats?.modifiedDate);
                }
                case Sorting.DatasetSortOpts.UserId: {
                    const userA = aStats?.user ?? "";
                    const userB = bStats?.user ?? "";

                    a.description = userA;
                    b.description = userB;

                    if (userA === userB) {
                        return sortByName(a, b);
                    }
                    return userA < userB ? sortLessThan : sortGreaterThan;
                }
                default: {
                    return sortByName(a, b);
                }
            }
        };
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
        if (SharedContext.isSession(this) && this.pattern) {
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
