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
import * as globals from "../globals";
import { errorHandling, getSessionLabel } from "../utils/ProfilesUtils";
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
} from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { getIconByNode } from "../generators/icons";
import * as contextually from "../shared/context";
import { Profiles } from "../Profiles";
import { ZoweLogger } from "../utils/ZoweLogger";
import * as dayjs from "dayjs";
import { IZoweDatasetTreeOpts } from "../shared/IZoweTreeOpts";
import { DatasetFSProvider } from "./DatasetFSProvider";

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
    public errorDetails: imperative.ImperativeError;
    public ongoingActions: Record<ZoweTreeNodeActions.Interactions | string, Promise<any>> = {};
    public wasDoubleClicked: boolean = false;
    public stats: Types.DatasetStats;
    public sort?: Sorting.NodeSort;
    public filter?: Sorting.DatasetFilter;
    public resourceUri?: vscode.Uri;

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

        if (this.getParent() == null) {
            // set default sort options for session nodes
            this.sort = {
                method: Sorting.DatasetSortOpts.Name,
                direction: Sorting.SortDirection.Ascending,
            };
        }

        if (contextually.isSession(this)) {
            this.id = this.label as string;
        }

        if (this.label !== vscode.l10n.t("Favorites")) {
            const sessionLabel = getSessionLabel(this);
            if (this.getParent() == null) {
                this.resourceUri = vscode.Uri.from({
                    scheme: "zowe-ds",
                    path: `/${sessionLabel}/`,
                });
                DatasetFSProvider.instance.createDirectory(this.resourceUri, this.pattern);
            } else if (
                this.contextValue === globals.DS_DS_CONTEXT ||
                this.contextValue === globals.DS_PDS_CONTEXT ||
                this.contextValue === globals.DS_MIGRATED_FILE_CONTEXT
            ) {
                this.resourceUri = vscode.Uri.from({
                    scheme: "zowe-ds",
                    path: `/${sessionLabel}/${this.label as string}`,
                });
                if (this.contextValue === globals.DS_DS_CONTEXT) {
                    this.command = {
                        command: "vscode.open",
                        title: "",
                        arguments: [this.resourceUri],
                    };
                }
            } else if (this.contextValue === globals.DS_MEMBER_CONTEXT) {
                this.resourceUri = vscode.Uri.from({
                    scheme: "zowe-ds",
                    path: `/${sessionLabel}/${this.getParent().label as string}/${this.label as string}`,
                });
                this.command = {
                    command: "vscode.open",
                    title: "",
                    arguments: [this.resourceUri],
                };
            } else {
                this.resourceUri = null;
                this.command = {
                    command: "zowe.placeholderCommand",
                    title: "Placeholder",
                };
            }
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
     * Retrieves child nodes of this ZoweDatasetNode
     *
     * @returns {Promise<ZoweDatasetNode[]>}
     */
    public async getChildren(): Promise<ZoweDatasetNode[]> {
        ZoweLogger.trace("ZoweDatasetNode.getChildren called.");
        if (!this.pattern && contextually.isSessionNotFav(this)) {
            const placeholder = new ZoweDatasetNode({
                label: vscode.l10n.t("Use the search button to display data sets"),
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                parentNode: this,
                contextOverride: globals.INFORMATION_CONTEXT,
                profile: null,
            });
            placeholder.command = {
                command: "zowe.placeholderCommand",
                title: "Placeholder",
            };
            return [placeholder];
        }
        if (contextually.isDocument(this) || contextually.isInformation(this)) {
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
                await errorHandling(vscode.l10n.t("The response from Zowe CLI was not successful"));
                return;
            }

            // Loops through all the returned dataset members and creates nodes for them
            for (const item of response.apiResponse.items ?? response.apiResponse) {
                const dsEntry = item.dsname ?? item.member;
                const existing = this.children.find((element) => element.label.toString() === dsEntry);
                let temp = existing;
                if (existing) {
                    existing.updateStats(item);
                    elementChildren[existing.label.toString()] = existing;
                    // Creates a ZoweDatasetNode for a PDS
                } else if (item.dsorg === "PO" || item.dsorg === "PO-E") {
                    temp = new ZoweDatasetNode({
                        label: item.dsname,
                        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                        parentNode: this,
                        profile: this.getProfile(),
                    });
                    elementChildren[temp.label.toString()] = temp;
                    // Creates a ZoweDatasetNode for a dataset with imperative errors
                } else if (item.error instanceof imperative.ImperativeError) {
                    temp = new ZoweDatasetNode({
                        label: item.dsname,
                        collapsibleState: vscode.TreeItemCollapsibleState.None,
                        parentNode: this,
                        contextOverride: globals.DS_FILE_ERROR_CONTEXT,
                        profile: this.getProfile(),
                    });
                    temp.errorDetails = item.error; // Save imperative error to avoid extra z/OS requests
                    elementChildren[temp.label.toString()] = temp;
                    // Creates a ZoweDatasetNode for a migrated dataset
                } else if (item.migr && item.migr.toUpperCase() === "YES") {
                    temp = new ZoweDatasetNode({
                        label: item.dsname,
                        collapsibleState: vscode.TreeItemCollapsibleState.None,
                        parentNode: this,
                        contextOverride: globals.DS_MIGRATED_FILE_CONTEXT,
                        profile: this.getProfile(),
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
                            contextOverride: globals.VSAM_CONTEXT,
                            profile: this.getProfile(),
                        });
                    }
                } else if (contextually.isSessionNotFav(this)) {
                    // Creates a ZoweDatasetNode for a PS
                    const cachedEncoding = this.getSessionNode().encodingMap[item.dsname];
                    temp = new ZoweDatasetNode({
                        label: item.dsname,
                        collapsibleState: vscode.TreeItemCollapsibleState.None,
                        parentNode: this,
                        encoding: cachedEncoding,
                        profile: this.getProfile(),
                    });
                    temp.command = { command: "vscode.open", title: "", arguments: [temp.resourceUri] };
                    elementChildren[temp.label.toString()] = temp;
                } else {
                    // Creates a ZoweDatasetNode for a PDS member
                    const memberInvalid = item.member?.includes("\ufffd");
                    const cachedEncoding = this.getSessionNode().encodingMap[`${item.dsname as string}(${item.member as string})`];
                    temp = new ZoweDatasetNode({
                        label: item.member,
                        collapsibleState: vscode.TreeItemCollapsibleState.None,
                        parentNode: this,
                        contextOverride: memberInvalid ? globals.DS_FILE_ERROR_CONTEXT : undefined,
                        encoding: cachedEncoding,
                        profile: this.getProfile(),
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
                    temp.updateStats(item);
                    elementChildren[temp.label.toString()] = temp;
                }

                if (temp == null) {
                    continue;
                }

                if (temp.resourceUri) {
                    if (temp.collapsibleState !== vscode.TreeItemCollapsibleState.None) {
                        // Create an entry for the PDS if it doesn't exist.
                        if (!DatasetFSProvider.instance.exists(temp.resourceUri)) {
                            vscode.workspace.fs.createDirectory(temp.resourceUri);
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
                }
            }
        }

        this.dirty = false;
        if (Object.keys(elementChildren).length === 0) {
            const placeholder = new ZoweDatasetNode({
                label: vscode.l10n.t("No data sets found"),
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                parentNode: this,
                contextOverride: globals.INFORMATION_CONTEXT,
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
    public static sortBy(sort: Sorting.NodeSort): (a: IZoweDatasetTreeNode, b: IZoweDatasetTreeNode) => number {
        return (a, b): number => {
            const aParent = a.getParent();
            if (aParent == null || !contextually.isPds(aParent)) {
                return (a.label as string) < (b.label as string) ? -1 : 1;
            }

            const sortLessThan = sort.direction == Sorting.SortDirection.Ascending ? -1 : 1;
            const sortGreaterThan = sortLessThan * -1;

            const sortByName = (nodeA: IZoweDatasetTreeNode, nodeB: IZoweDatasetTreeNode): number =>
                (nodeA.label as string) < (nodeB.label as string) ? sortLessThan : sortGreaterThan;

            if (!a.stats && !b.stats) {
                return sortByName(a, b);
            }

            function sortByDate(aDate: Date, bDate: Date): number {
                const dateA = dayjs(aDate ?? null);
                const dateB = dayjs(bDate ?? null);

                const aVaild = dateA.isValid();
                const bValid = dateB.isValid();

                a.description = aVaild ? dateA.format("YYYY/MM/DD") : undefined;
                b.description = bValid ? dateB.format("YYYY/MM/DD") : undefined;

                if (!aVaild) {
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
                    return sortByDate(a.stats?.createdDate, b.stats?.createdDate);
                }
                case Sorting.DatasetSortOpts.LastModified: {
                    return sortByDate(a.stats?.modifiedDate, b.stats?.modifiedDate);
                }
                case Sorting.DatasetSortOpts.UserId: {
                    const userA = a.stats?.user ?? "";
                    const userB = b.stats?.user ?? "";

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
            if (aParent == null || !contextually.isPds(aParent)) {
                return true;
            }

            switch (filter.method) {
                case Sorting.DatasetFilterOpts.LastModified:
                    if (!isDateFilter(filter.value)) {
                        return true;
                    }

                    return dayjs(node.stats?.modifiedDate).isSame(filter.value, "day");
                case Sorting.DatasetFilterOpts.UserId:
                    return node.stats?.user === filter.value;
            }
        };
    }

    public getSessionNode(): IZoweDatasetTreeNode {
        ZoweLogger.trace("ZoweDatasetNode.getSessionNode called.");
        return this.getParent() ? this.getParent().getSessionNode() : this;
    }
    /**
     * Returns the [etag] for this node
     *
     * @returns {string}
     */
    public getEtag(): string {
        ZoweLogger.trace("ZoweDatasetNode.getEtag called.");
        const fileEntry = DatasetFSProvider.instance.stat(this.resourceUri) as DsEntry;
        return fileEntry.etag;
    }

    /**
     * Set the [etag] for this node
     *
     * @returns {void}
     */
    public setEtag(etagValue): void {
        ZoweLogger.trace("ZoweDatasetNode.setEtag called.");
        // TODO: We don't use this function anymore because of the FSP. Remove?
    }

    private async getDatasets(): Promise<zosfiles.IZosFilesResponse[]> {
        ZoweLogger.trace("ZoweDatasetNode.getDatasets called.");
        const responses: zosfiles.IZosFilesResponse[] = [];
        const cachedProfile = Profiles.getInstance().loadNamedProfile(this.getProfileName());
        const options: zosfiles.IListOptions = {
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
                responses.push(await ZoweExplorerApiRegister.getMvsApi(cachedProfile).allMembers(this.label as string, options));
            }
        } else {
            responses.push(await ZoweExplorerApiRegister.getMvsApi(cachedProfile).allMembers(this.label as string, options));
        }
        return responses;
    }

    public async openDs(_forceDownload: boolean, _previewMember: boolean, datasetProvider: Types.IZoweDatasetTreeType): Promise<void> {
        ZoweLogger.trace("ZoweDatasetNode.openDs called.");
        await datasetProvider.checkCurrentProfile(this);
        const invalidItem = vscode.l10n.t("Cannot download, item invalid.");
        switch (true) {
            case contextually.isFavorite(this):
            case contextually.isSessionNotFav(this.getParent()):
                break;
            case contextually.isFavoritePds(this.getParent()):
            case contextually.isPdsNotFav(this.getParent()):
                break;
            default:
                ZoweLogger.error("ZoweDatasetNode.openDs: " + invalidItem);
                Gui.errorMessage(invalidItem);
                throw Error(invalidItem);
        }

        if (Profiles.getInstance().validProfile !== Validation.ValidationType.INVALID) {
            try {
                await vscode.commands.executeCommand("vscode.open", this.resourceUri);
                if (datasetProvider) {
                    datasetProvider.addFileHistory(`[${this.getProfileName()}]: ${this.label as string}`);
                }
            } catch (err) {
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
