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
} from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { getIconByNode } from "../generators/icons";
import * as contextually from "../shared/context";
import { Profiles } from "../Profiles";
import { ZoweLogger } from "../utils/LoggerUtils";
import * as dayjs from "dayjs";
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
    public errorDetails: zowe.imperative.ImperativeError;
    public ongoingActions: Record<NodeAction | string, Promise<any>> = {};
    public wasDoubleClicked: boolean = false;
    public stats: DatasetStats;
    public sort?: NodeSort;
    public filter?: DatasetFilter;
    public resourceUri?: vscode.Uri;

    /**
     * Creates an instance of ZoweDatasetNode
     *
     * @param {string} label - Displayed in the [TreeView]
     * @param {vscode.TreeItemCollapsibleState} mCollapsibleState - file/folder
     * @param {ZoweDatasetNode} mParent
     * @param {Session} session
     */
    public constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        mParent: IZoweDatasetTreeNode,
        session: zowe.imperative.Session,
        contextOverride?: string,
        private etag?: string,
        profile?: zowe.imperative.IProfileLoaded
    ) {
        super(label, collapsibleState, mParent, session, profile);

        if (contextOverride) {
            this.contextValue = contextOverride;
        } else if (collapsibleState !== vscode.TreeItemCollapsibleState.None) {
            this.contextValue = globals.DS_PDS_CONTEXT;
        } else if (mParent && mParent.getParent()) {
            this.contextValue = globals.DS_MEMBER_CONTEXT;
        } else {
            this.contextValue = globals.DS_DS_CONTEXT;
        }
        this.tooltip = this.label as string;
        const icon = getIconByNode(this);
        if (icon) {
            this.iconPath = icon.path;
        }

        if (this.getParent() == null) {
            // set default sort options for session nodes
            this.sort = {
                method: DatasetSortOpts.Name,
                direction: SortDirection.Ascending,
            };
        }

        if (!globals.ISTHEIA && contextually.isSession(this)) {
            this.id = this.label as string;
        }
        if (label !== vscode.l10n.t("Favorites")) {
            if (mParent == null) {
                this.resourceUri = vscode.Uri.parse(`zowe-ds:/${this.profile.name}/`);
                DatasetFSProvider.instance.createDirectory(this.resourceUri, this.pattern);
            } else if (this.contextValue === globals.DS_MEMBER_CONTEXT) {
                this.resourceUri = vscode.Uri.parse(`zowe-ds:/${this.profile.name}/${mParent.label as string}/${this.label as string}`);
            } else if (
                this.contextValue === globals.DS_DS_CONTEXT ||
                this.contextValue === globals.DS_PDS_CONTEXT ||
                this.contextValue === globals.DS_MIGRATED_FILE_CONTEXT
            ) {
                this.resourceUri = vscode.Uri.parse(`zowe-ds:/${this.profile.name}/${this.label as string}`);
            }
        }
    }

    /**
     * Implements access to profile name
     * for {IZoweDatasetTreeNode}.
     *
     * @returns {string}
     */
    public getProfileName(): string {
        ZoweLogger.trace("ZoweDatasetNode.getProfileName called.");
        return this.getProfile() ? this.getProfile().name : undefined;
    }

    public updateStats(item: any): void {
        if ("m4date" in item) {
            const { m4date, mtime, msec }: { m4date: string; mtime: string; msec: string } = item;
            this.stats = {
                user: item.user,
                modifiedDate: dayjs(`${m4date} ${mtime}:${msec}`).toDate(),
            };
        } else if ("id" in item || "changed" in item) {
            // missing keys from API response; check for FTP keys
            this.stats = {
                user: item.id,
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
            const placeholder = new ZoweDatasetNode(
                vscode.l10n.t("Use the search button to display data sets"),
                vscode.TreeItemCollapsibleState.None,
                this,
                null,
                globals.INFORMATION_CONTEXT
            );
            placeholder.command = {
                command: "zowe.placeholderCommand",
                title: "Placeholder"
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
                    temp = new ZoweDatasetNode(
                        item.dsname,
                        vscode.TreeItemCollapsibleState.Collapsed,
                        this,
                        null,
                        undefined,
                        undefined,
                        this.getProfile()
                    );
                    elementChildren[temp.label.toString()] = temp;
                    // Creates a ZoweDatasetNode for a dataset with imperative errors
                } else if (item.error instanceof zowe.imperative.ImperativeError) {
                    temp = new ZoweDatasetNode(
                        item.dsname,
                        vscode.TreeItemCollapsibleState.None,
                        this,
                        null,
                        globals.DS_FILE_ERROR_CONTEXT,
                        undefined,
                        this.getProfile()
                    );
                    temp.errorDetails = item.error; // Save imperative error to avoid extra z/OS requests
                    elementChildren[temp.label.toString()] = temp;
                    // Creates a ZoweDatasetNode for a migrated dataset
                } else if (item.migr && item.migr.toUpperCase() === "YES") {
                    temp = new ZoweDatasetNode(
                        item.dsname,
                        vscode.TreeItemCollapsibleState.None,
                        this,
                        null,
                        globals.DS_MIGRATED_FILE_CONTEXT,
                        undefined,
                        this.getProfile()
                    );
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
                        temp = new ZoweDatasetNode(
                            altLabel,
                            vscode.TreeItemCollapsibleState.None,
                            this,
                            null,
                            globals.VSAM_CONTEXT,
                            undefined,
                            this.getProfile()
                        );
                        elementChildren[temp.label.toString()] = temp;
                    }
                } else if (contextually.isSessionNotFav(this)) {
                    // Creates a ZoweDatasetNode for a PS
                    temp = new ZoweDatasetNode(
                        item.dsname,
                        vscode.TreeItemCollapsibleState.None,
                        this,
                        null,
                        undefined,
                        undefined,
                        this.getProfile()
                    );
                    temp.command = { command: "vscode.open", title: "", arguments: [temp.resourceUri] };
                    elementChildren[temp.label.toString()] = temp;
                } else {
                    // Creates a ZoweDatasetNode for a PDS member
                    const memberInvalid = item.member?.includes("\ufffd");
                    temp = new ZoweDatasetNode(
                        item.member,
                        vscode.TreeItemCollapsibleState.None,
                        this,
                        null,
                        memberInvalid ? globals.DS_FILE_ERROR_CONTEXT : undefined,
                        undefined,
                        this.getProfile()
                    );
                    if (!memberInvalid) {
                        temp.command = { command: "vscode.open", title: "", arguments: [temp.resourceUri] };
                    } else {
                        temp.errorDetails = new zowe.imperative.ImperativeError({
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

        this.dirty = false;
        if (Object.keys(elementChildren).length === 0) {
            this.children = [
                new ZoweDatasetNode(
                    vscode.l10n.t("No data sets found"),
                    vscode.TreeItemCollapsibleState.None,
                    this,
                    null,
                    globals.INFORMATION_CONTEXT
                ),
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
    public static sortBy(sort: NodeSort): (a: IZoweDatasetTreeNode, b: IZoweDatasetTreeNode) => number {
        return (a, b): number => {
            const aParent = a.getParent();
            if (aParent == null || !contextually.isPds(aParent)) {
                return (a.label as string) < (b.label as string) ? -1 : 1;
            }

            const sortLessThan = sort.direction == SortDirection.Ascending ? -1 : 1;
            const sortGreaterThan = sortLessThan * -1;

            const sortByName = (nodeA: IZoweDatasetTreeNode, nodeB: IZoweDatasetTreeNode): number =>
                (nodeA.label as string) < (nodeB.label as string) ? sortLessThan : sortGreaterThan;

            if (!a.stats && !b.stats) {
                return sortByName(a, b);
            }

            if (sort.method === DatasetSortOpts.LastModified) {
                const dateA = dayjs(a.stats?.modifiedDate ?? null);
                const dateB = dayjs(b.stats?.modifiedDate ?? null);

                const aValid = dateA.isValid();
                const bValid = dateB.isValid();

                a.description = aValid ? dateA.format("YYYY/MM/DD HH:mm:ss") : undefined;
                b.description = bValid ? dateB.format("YYYY/MM/DD HH:mm:ss") : undefined;

                if (!aValid) {
                    return sortGreaterThan;
                }

                if (!bValid) {
                    return sortLessThan;
                }

                // for dates that are equal down to the second, fallback to sorting by name
                if (dateA.isSame(dateB, "second")) {
                    return sortByName(a, b);
                }

                return dateA.isBefore(dateB, "second") ? sortLessThan : sortGreaterThan;
            } else if (sort.method === DatasetSortOpts.UserId) {
                const userA = a.stats?.user ?? "";
                const userB = b.stats?.user ?? "";

                a.description = userA;
                b.description = userB;

                if (userA === userB) {
                    return sortByName(a, b);
                }

                return userA < userB ? sortLessThan : sortGreaterThan;
            }

            return sortByName(a, b);
        };
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
        return this.getParent() ? this.getParent().getSessionNode() : this;
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
     * Set the [etag] for this node
     *
     * @returns {void}
     */
    public setEtag(etagValue): void {
        ZoweLogger.trace("ZoweDatasetNode.setEtag called.");
        this.etag = etagValue;
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
                    msg: vscode.l10n.t("Profile auth error"),
                    additionalDetails: vscode.l10n.t("Profile is not authenticated, please log in to continue"),
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
}
