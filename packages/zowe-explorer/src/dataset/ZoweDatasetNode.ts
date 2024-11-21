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

import * as zowe from "@zowe/cli";
import * as vscode from "vscode";
import * as globals from "../globals";
import { errorHandling } from "../utils/ProfilesUtils";
import {
    DatasetFilter,
    DatasetFilterOpts,
    DatasetSortOpts,
    DatasetStats,
    Gui,
    NodeAction,
    IZoweDatasetTreeNode,
    ZoweTreeNode,
    SortDirection,
    NodeSort,
    ZosEncoding,
    IZoweTree,
    ValidProfileEnum,
    imperative,
} from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { getIconByNode } from "../generators/icons";
import * as contextually from "../shared/context";
import * as nls from "vscode-nls";
import { Profiles } from "../Profiles";
import { ZoweLogger } from "../utils/LoggerUtils";
import * as dayjs from "dayjs";
import * as fs from "fs";
import { promiseStatus, PromiseStatuses } from "promise-status-async";
import { getDocumentFilePath, initializeFileOpening, updateOpenFiles } from "../shared/utils";
import { IZoweDatasetTreeOpts } from "../shared/IZoweTreeOpts";
import { LocalFileManagement } from "../utils/LocalFileManagement";

// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

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
    public binary = false;
    public encoding?: string;
    public encodingMap = {};
    public errorDetails: zowe.imperative.ImperativeError;
    public ongoingActions: Record<NodeAction | string, Promise<any>> = {};
    public wasDoubleClicked: boolean = false;
    public stats: DatasetStats;
    public sort?: NodeSort;
    public filter?: DatasetFilter;
    private etag?: string;

    /**
     * Creates an instance of ZoweDatasetNode
     *
     * @param {IZoweTreeOpts} opts
     */
    public constructor(opts: IZoweDatasetTreeOpts) {
        super(opts.label, opts.collapsibleState, opts.parentNode, opts.session, opts.profile);
        this.binary = opts.encoding?.kind === "binary";
        if (!this.binary && opts.encoding != null) {
            this.encoding = opts.encoding.kind === "other" ? opts.encoding.codepage : null;
        }
        this.etag = opts.etag;
        if (opts.contextOverride) {
            this.contextValue = opts.contextOverride;
        } else if (opts.collapsibleState !== vscode.TreeItemCollapsibleState.None) {
            this.contextValue = globals.DS_PDS_CONTEXT;
        } else if (opts.parentNode && opts.parentNode.getParent()) {
            this.contextValue = this.binary ? globals.DS_MEMBER_BINARY_CONTEXT : globals.DS_MEMBER_CONTEXT;
        } else {
            this.contextValue = this.binary ? globals.DS_DS_BINARY_CONTEXT : globals.DS_DS_CONTEXT;
        }
        this.tooltip = this.label as string;
        const icon = getIconByNode(this);
        if (icon) {
            this.iconPath = icon.path;
        }

        if (this.getParent() == null || contextually.isFavorite(this.getParent())) {
            // set default sort options for session nodes
            this.sort = {
                method: DatasetSortOpts.Name,
                direction: SortDirection.Ascending,
            };
        }

        if (!globals.ISTHEIA && contextually.isSession(this)) {
            this.id = this.label as string;
        }
    }

    public updateStats(item: any): void {
        if ("c4date" in item && "m4date" in item) {
            const { m4date, mtime, msec }: { m4date: string; mtime: string; msec: string } = item;
            this.stats = {
                user: item.user,
                createdDate: dayjs(item.c4date).toDate(),
                modifiedDate: dayjs(`${m4date} ${mtime}:${msec}`).toDate(),
            };
        } else if ("id" in item || "changed" in item) {
            // missing keys from API response; check for FTP keys
            this.stats = {
                user: item.id,
                createdDate: item.created ? dayjs(item.created).toDate() : undefined,
                modifiedDate: item.changed ? dayjs(item.changed).toDate() : undefined,
            };
        }
    }

    /**
     * Updates an existing data set node that was recalled so it can be interacted with.
     * @param isPds Whether the data set is a PDS
     */
    private datasetRecalled(isPds: boolean): void {
        // Change context value to match dsorg, update collapsible state
        // Preserve favorite context and any additional context values
        this.contextValue = this.contextValue.replace(globals.DS_MIGRATED_FILE_CONTEXT, isPds ? globals.DS_PDS_CONTEXT : globals.DS_DS_CONTEXT);
        this.collapsibleState = isPds ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;

        // For sequential data sets, re-apply the command so that they can be opened
        if (!isPds) {
            this.command = { command: "zowe.ds.ZoweNode.openPS", title: "", arguments: [this] };
        }

        // Replace icon on existing node with new one
        const icon = getIconByNode(this);
        if (icon) {
            this.setIcon(icon.path);
        }
    }

    /**
     * Updates a data set node so it is marked as migrated.
     */
    public datasetMigrated(): void {
        // Change the context value and collapsible state to represent a migrated data set
        // Preserve favorite context and any additional context values
        const isBinary = contextually.isBinary(this);
        const isPds = this.collapsibleState !== vscode.TreeItemCollapsibleState.None;
        let previousContext = isBinary ? globals.DS_DS_BINARY_CONTEXT : globals.DS_DS_CONTEXT;
        if (isPds) {
            previousContext = globals.DS_PDS_CONTEXT;
        }
        this.contextValue = this.contextValue.replace(previousContext, globals.DS_MIGRATED_FILE_CONTEXT);
        this.collapsibleState = vscode.TreeItemCollapsibleState.None;

        // Remove the node's command
        this.command = undefined;

        // Assign migrated icon to the data set node
        const icon = getIconByNode(this);
        if (icon) {
            this.setIcon(icon.path);
        }
    }

    /**
     * Retrieves child nodes of this ZoweDatasetNode
     *
     * @returns {Promise<ZoweDatasetNode[]>}
     */
    public async getChildren(): Promise<ZoweDatasetNode[]> {
        ZoweLogger.trace("ZoweDatasetNode.getChildren called.");
        if (!this.pattern && contextually.isSessionNotFav(this)) {
            return [
                new ZoweDatasetNode({
                    label: localize("getChildren.search", "Use the search button to display data sets"),
                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                    parentNode: this,
                    contextOverride: globals.INFORMATION_CONTEXT,
                }),
            ];
        }
        if (contextually.isDocument(this) || contextually.isInformation(this)) {
            return [];
        }

        if (!this.dirty || this.label === "Favorites") {
            return this.children;
        }

        if (!this.label) {
            Gui.errorMessage(localize("getChildren.error.invalidNode", "Invalid node"));
            throw Error(localize("getChildren.error.invalidNode", "Invalid node"));
        }

        // Gets the datasets from the pattern or members of the dataset and displays any thrown errors
        const responses = await this.getDatasets();
        if (responses.length === 0) {
            return;
        }

        // push nodes to an object with property names to avoid duplicates
        const elementChildren: { [k: string]: ZoweDatasetNode } = {};
        for (const response of responses) {
            // Throws reject if the Zowe command does not throw an error but does not succeed
            // The dataSetsMatchingPattern API may return success=false and apiResponse=[] when no data sets found
            if (!response.success && !(Array.isArray(response.apiResponse) && response.apiResponse.length === 0)) {
                await errorHandling(localize("getChildren.responses.error", "The response from Zowe CLI was not successful"));
                return;
            }

            // Loops through all the returned dataset members and creates nodes for them
            for (const item of response.apiResponse.items ?? response.apiResponse) {
                const dsEntry = item.dsname ?? item.member;
                const existing = this.children.find((element) => element.label.toString() === dsEntry);
                if (existing) {
                    if (contextually.isMigrated(existing) && item.migr?.toUpperCase() !== "YES") {
                        existing.datasetRecalled(item.dsorg === "PO" || item.dsorg === "PO-E");
                    } else if (!contextually.isMigrated(existing) && item.migr?.toUpperCase() === "YES") {
                        existing.datasetMigrated();
                    }
                    existing.updateStats(item);
                    elementChildren[existing.label.toString()] = existing;
                } else if (item.migr && item.migr.toUpperCase() === "YES") {
                    // Creates a ZoweDatasetNode for a migrated dataset
                    const temp = new ZoweDatasetNode({
                        label: item.dsname,
                        collapsibleState: vscode.TreeItemCollapsibleState.None,
                        parentNode: this,
                        contextOverride: globals.DS_MIGRATED_FILE_CONTEXT,
                        profile: this.getProfile(),
                    });
                    elementChildren[temp.label.toString()] = temp;
                } else if (item.dsorg === "PO" || item.dsorg === "PO-E") {
                    // Creates a ZoweDatasetNode for a PDS
                    const temp = new ZoweDatasetNode({
                        label: item.dsname,
                        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                        parentNode: this,
                        profile: this.getProfile(),
                    });
                    elementChildren[temp.label.toString()] = temp;
                } else if (item.error instanceof zowe.imperative.ImperativeError) {
                    // Creates a ZoweDatasetNode for a dataset with imperative errors
                    const temp = new ZoweDatasetNode({
                        label: item.dsname,
                        collapsibleState: vscode.TreeItemCollapsibleState.None,
                        parentNode: this,
                        contextOverride: globals.DS_FILE_ERROR_CONTEXT,
                        profile: this.getProfile(),
                    });
                    temp.command = { command: "zowe.placeholderCommand", title: "" };
                    temp.errorDetails = item.error; // Save imperative error to avoid extra z/OS requests
                    elementChildren[temp.label.toString()] = temp;
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
                            contextOverride: globals.VSAM_CONTEXT,
                            profile: this.getProfile(),
                        });
                    }
                } else if (contextually.isSessionNotFav(this)) {
                    // Creates a ZoweDatasetNode for a PS
                    const cachedEncoding = this.getSessionNode().encodingMap[item.dsname];
                    const temp = new ZoweDatasetNode({
                        label: item.dsname,
                        collapsibleState: vscode.TreeItemCollapsibleState.None,
                        parentNode: this,
                        encoding: cachedEncoding,
                        profile: this.getProfile(),
                    });
                    temp.command = { command: "zowe.ds.ZoweNode.openPS", title: "", arguments: [temp] };
                    elementChildren[temp.label.toString()] = temp;
                } else {
                    // Creates a ZoweDatasetNode for a PDS member
                    const cachedEncoding = this.getSessionNode().encodingMap[`${item.dsname as string}(${item.member as string})`];
                    const temp = new ZoweDatasetNode({
                        label: item.member,
                        collapsibleState: vscode.TreeItemCollapsibleState.None,
                        parentNode: this,
                        encoding: cachedEncoding,
                        profile: this.getProfile(),
                    });
                    temp.command = { command: "zowe.ds.ZoweNode.openPS", title: "", arguments: [temp] };

                    // get user and last modified date for sorting, if available
                    temp.updateStats(item);
                    elementChildren[temp.label.toString()] = temp;
                }
            }

            if (
                response.apiResponse.items &&
                response.apiResponse.returnedRows &&
                response.apiResponse.items.length < response.apiResponse.returnedRows
            ) {
                const invalidMemberCount = response.apiResponse.returnedRows - response.apiResponse.items.length;
                const temp = new ZoweDatasetNode({
                    label: `${invalidMemberCount} members with errors`,
                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                    parentNode: this,
                    contextOverride: globals.DS_FILE_ERROR_MEMBER_CONTEXT,
                    profile: this.getProfile(),
                });
                temp.command = { command: "zowe.placeholderCommand", title: "" };
                temp.errorDetails = new zowe.imperative.ImperativeError({
                    msg: localize(
                        "getChildren.invalidMember",
                        "{0} members failed to load due to invalid name errors for {1}",
                        invalidMemberCount,
                        this.label as string
                    ),
                });
                elementChildren[temp.label.toString()] = temp;
            }
        }

        this.dirty = false;
        if (Object.keys(elementChildren).length === 0) {
            this.children = [
                new ZoweDatasetNode({
                    label: localize("getChildren.noDataset", "No data sets found"),
                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                    parentNode: this,
                    contextOverride: globals.INFORMATION_CONTEXT,
                }),
            ];
        } else {
            const newChildren = Object.keys(elementChildren)
                .filter((label) => this.children.find((c) => (c.label as string) === label) == null)
                .map((label) => elementChildren[label]);

            // get sort settings for session
            const sessionSort = contextually.isSession(this) ? this.sort : this.getSessionNode().sort;

            // use the PDS sort settings if defined; otherwise, use session sort method
            const sortOpts = this.sort ?? sessionSort;

            // use the PDS filter if one is set, otherwise try using the session filter
            const sessionFilter = contextually.isSession(this) ? this.filter : this.getSessionNode().filter;
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
    public static sortBy(sort: NodeSort): (a: ZoweDatasetNode, b: ZoweDatasetNode) => number {
        return (a, b): number => {
            const aParent = a.getParent();
            if (aParent == null || !contextually.isPds(aParent)) {
                return (a.label as string) < (b.label as string) ? -1 : 1;
            } else if (a.contextValue === globals.DS_FILE_ERROR_MEMBER_CONTEXT || b.contextValue === globals.DS_FILE_ERROR_MEMBER_CONTEXT) {
                // Keep invalid member node at bottom ("N members with errors")
                return a.contextValue === globals.DS_FILE_ERROR_MEMBER_CONTEXT ? 1 : -1;
            }

            const sortDirection = sort.direction == SortDirection.Ascending ? 1 : -1;
            if (!a.stats && !b.stats) {
                return a.compareByName(b, sortDirection);
            }

            switch (sort.method) {
                case DatasetSortOpts.DateCreated:
                    return a.compareByDateStat(b, "createdDate", sortDirection);
                case DatasetSortOpts.LastModified:
                    return a.compareByDateStat(b, "modifiedDate", sortDirection);
                case DatasetSortOpts.UserId:
                    return a.compareByStat(b, "user", sortDirection);
                default:
                    return a.compareByName(b, sortDirection);
            }
        };
    }

    private compareByName(otherNode: IZoweDatasetTreeNode, sortDirection = 1): number {
        return (this.label as string).localeCompare(otherNode.label as string) * sortDirection;
    }

    private compareByStat(otherNode: IZoweDatasetTreeNode, statName: keyof DatasetStats, sortDirection = 1): number {
        const valueA = (this.stats?.[statName] as string) ?? "";
        const valueB = (otherNode.stats?.[statName] as string) ?? "";

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
        const dateA = dayjs(this.stats?.[statName] ?? null);
        const dateB = dayjs(otherNode.stats?.[statName] ?? null);

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
    public static filterBy(filter: DatasetFilter): (node: IZoweDatasetTreeNode) => boolean {
        const isDateFilter = (f: string): boolean => {
            return dayjs(f).isValid();
        };

        return (node): boolean => {
            const aParent = node.getParent();
            if (aParent == null || !contextually.isPds(aParent)) {
                return true;
            }

            switch (filter.method) {
                case DatasetFilterOpts.LastModified:
                    if (!isDateFilter(filter.value)) {
                        return true;
                    }

                    return dayjs(node.stats?.modifiedDate).isSame(filter.value, "day");
                case DatasetFilterOpts.UserId:
                    return node.stats?.user === filter.value;
            }
        };
    }

    public getSessionNode(): IZoweDatasetTreeNode {
        ZoweLogger.trace("ZoweDatasetNode.getSessionNode called.");
        return this.session ? this : this.getParent()?.getSessionNode() ?? this;
    }
    /**
     * Returns the [etag] for this node
     *
     * @returns {string}
     */
    public getEtag(): string {
        ZoweLogger.trace("ZoweDatasetNode.getEtag called.");
        return this.etag;
    }

    /**
     * Returns the imperative.IProfileLoaded profile for this node
     *
     * @returns {imperative.IProfileLoaded}
     */
    public getProfile(): imperative.IProfileLoaded {
        ZoweLogger.trace("ZoweDatasetNode.getProfile called.");
        const prof = this.profile ?? this.getParent()?.getProfile();
        return prof?.name ? Profiles.getInstance().loadNamedProfile(prof.name) : undefined; // this returns the profile with newer token
    }

    /**
     * Set the [etag] for this node
     *
     * @returns {void}
     */
    public setEtag(etagValue): void {
        ZoweLogger.trace("ZoweDatasetNode.setEtag called.");
        this.etag = etagValue;
        LocalFileManagement.storeFileInfo(this);
    }

    private async getDatasets(): Promise<zowe.IZosFilesResponse[]> {
        ZoweLogger.trace("ZoweDatasetNode.getDatasets called.");
        const responses: zowe.IZosFilesResponse[] = [];
        const cachedProfile = Profiles.getInstance().loadNamedProfile(this.getProfileName());
        const options: zowe.IListOptions = {
            attributes: true,
            responseTimeout: cachedProfile.profile.responseTimeout,
        };
        if (contextually.isSessionNotFav(this)) {
            const dsPatterns = [
                ...new Set(
                    this.pattern
                        .toUpperCase()
                        .split(",")
                        .map((p) => p.trim())
                ),
            ];
            const mvsApi = ZoweExplorerApiRegister.getMvsApi(cachedProfile);
            if (!mvsApi.getSession(cachedProfile)) {
                throw new zowe.imperative.ImperativeError({
                    msg: localize("getDataSets.error.sessionMissing", "Profile auth error"),
                    additionalDetails: localize("getDataSets.error.additionalDetails", "Profile is not authenticated, please log in to continue"),
                    errorCode: `${zowe.imperative.RestConstants.HTTP_STATUS_401}`,
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
                responses.push(await ZoweExplorerApiRegister.getMvsApi(cachedProfile).allMembers(this.label as string, options));
            }
        } else {
            responses.push(await ZoweExplorerApiRegister.getMvsApi(cachedProfile).allMembers(this.label as string, options));
        }
        return responses;
    }

    public async openDs(forceDownload: boolean, previewMember: boolean, datasetProvider: IZoweTree<IZoweDatasetTreeNode>): Promise<void> {
        ZoweLogger.trace("ZoweDatasetNode.openDs called.");
        await datasetProvider.checkCurrentProfile(this);

        // Status of last "open action" promise
        // If the node doesn't support pending actions, assume last action was resolved to pull new contents
        const lastActionStatus =
            this.ongoingActions?.[NodeAction.Download] != null
                ? await promiseStatus(this.ongoingActions[NodeAction.Download])
                : PromiseStatuses.PROMISE_RESOLVED;

        // Cache status of double click if the node has the "wasDoubleClicked" property:
        // allows subsequent clicks to register as double-click if node is not done fetching contents
        const doubleClicked = Gui.utils.wasDoubleClicked(this, datasetProvider);
        const shouldPreview = doubleClicked ? false : previewMember;
        if (this.wasDoubleClicked != null) {
            this.wasDoubleClicked = doubleClicked;
        }

        // Prevent future "open actions" until last action is completed
        if (lastActionStatus == PromiseStatuses.PROMISE_PENDING) {
            return;
        }

        if (Profiles.getInstance().validProfile !== ValidProfileEnum.INVALID) {
            const statusMsg = Gui.setStatusBarMessage(localize("dataSet.opening", "$(sync~spin) Opening data set..."));
            try {
                let label: string;
                const defaultMessage = localize("openDs.error", "Invalid data set or member.");
                switch (true) {
                    // For favorited or non-favorited sequential DS:
                    case contextually.isFavorite(this):
                    case contextually.isSessionNotFav(this.getParent()):
                        label = this.label as string;
                        break;
                    // For favorited or non-favorited data set members:
                    case contextually.isFavoritePds(this.getParent()):
                    case contextually.isPdsNotFav(this.getParent()):
                        label = this.getParent().getLabel().toString() + "(" + this.getLabel().toString() + ")";
                        break;
                    default:
                        Gui.errorMessage(defaultMessage);
                        throw Error(defaultMessage);
                }

                const documentFilePath = getDocumentFilePath(label, this);
                let responsePromise = this.ongoingActions ? this.ongoingActions[NodeAction.Download] : null;
                // If there is no ongoing action and the local copy does not exist, fetch contents
                if (forceDownload || (responsePromise == null && !fs.existsSync(documentFilePath))) {
                    const prof = this.getProfile();
                    ZoweLogger.info(localize("openDs.openDataSet", "Opening {0}", label));
                    if (this.ongoingActions) {
                        this.ongoingActions[NodeAction.Download] = ZoweExplorerApiRegister.getMvsApi(prof).getContents(label, {
                            file: documentFilePath,
                            returnEtag: true,
                            binary: this.binary,
                            encoding: this.encoding !== undefined ? this.encoding : prof.profile?.encoding,
                            responseTimeout: prof.profile?.responseTimeout,
                        });
                        responsePromise = this.ongoingActions[NodeAction.Download];
                    } else {
                        responsePromise = ZoweExplorerApiRegister.getMvsApi(prof).getContents(label, {
                            file: documentFilePath,
                            returnEtag: true,
                            binary: this.binary,
                            encoding: this.encoding !== undefined ? this.encoding : prof.profile?.encoding,
                            responseTimeout: prof.profile?.responseTimeout,
                        });
                    }
                }

                if (responsePromise != null) {
                    const response = await responsePromise;
                    this.setEtag(response.apiResponse.etag);
                }
                statusMsg.dispose();
                updateOpenFiles(datasetProvider, documentFilePath, this);
                await initializeFileOpening(this, documentFilePath, this.wasDoubleClicked != null ? !this.wasDoubleClicked : shouldPreview);
                // discard ongoing action to allow new requests on this node
                if (this.ongoingActions) {
                    this.ongoingActions[NodeAction.Download] = null;
                }
                datasetProvider.addFileHistory(`[${this.getProfileName()}]: ${label}`);
            } catch (err) {
                statusMsg.dispose();
                await errorHandling(err, this.getProfileName());
                throw err;
            }
        }
    }

    public setEncoding(encoding: ZosEncoding): void {
        ZoweLogger.trace("ZoweDatasetNode.setEncoding called.");
        if (!(this.contextValue.startsWith(globals.DS_DS_CONTEXT) || this.contextValue.startsWith(globals.DS_MEMBER_CONTEXT))) {
            throw new Error(`Cannot set encoding for node with context ${this.contextValue}`);
        }
        const isMemberNode = this.contextValue.startsWith(globals.DS_MEMBER_CONTEXT);
        if (encoding?.kind === "binary") {
            this.contextValue = isMemberNode ? globals.DS_MEMBER_BINARY_CONTEXT : globals.DS_DS_BINARY_CONTEXT;
            this.binary = true;
            this.encoding = undefined;
        } else {
            this.contextValue = isMemberNode ? globals.DS_MEMBER_CONTEXT : globals.DS_DS_CONTEXT;
            this.binary = false;
            this.encoding = encoding?.kind === "text" ? null : encoding?.codepage;
        }
        const fullPath = isMemberNode ? `${this.getParent().label as string}(${this.label as string})` : (this.label as string);
        if (encoding != null) {
            this.getSessionNode().encodingMap[fullPath] = encoding;
        } else {
            delete this.getSessionNode().encodingMap[fullPath];
        }
        if (this.getParent() && this.getParent().contextValue === globals.FAV_PROFILE_CONTEXT) {
            this.contextValue += globals.FAV_SUFFIX;
        }

        const icon = getIconByNode(this);
        if (icon) {
            this.setIcon(icon.path);
        }

        LocalFileManagement.storeFileInfo(this);
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

    /**
     * Returns the local file path for the ZoweDatasetNode
     *
     */
    public getDsDocumentFilePath(): string {
        ZoweLogger.trace("ZoweDatasetNode.getDsDocumentFilePath called.");
        if (contextually.isDsMember(this)) {
            return getDocumentFilePath(`${this.getParent().label as string}(${this.label as string})`, this);
        }
        return getDocumentFilePath(this.label as string, this);
    }
}
