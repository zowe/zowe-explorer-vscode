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
import * as nls from "vscode-nls";
import { Profiles } from "../Profiles";
import { ZoweLogger } from "../utils/LoggerUtils";
import * as dayjs from "dayjs";

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
    public errorDetails: zowe.imperative.ImperativeError;
    public ongoingActions: Record<NodeAction | string, Promise<any>> = {};
    public wasDoubleClicked: boolean = false;
    public stats: DatasetStats;
    public sort?: NodeSort;
    public filter?: DatasetFilter;

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

    /**
     * Retrieves child nodes of this ZoweDatasetNode
     *
     * @returns {Promise<ZoweDatasetNode[]>}
     */
    public async getChildren(): Promise<ZoweDatasetNode[]> {
        ZoweLogger.trace("ZoweDatasetNode.getChildren called.");
        if (!this.pattern && contextually.isSessionNotFav(this)) {
            return [
                new ZoweDatasetNode(
                    localize("getChildren.search", "Use the search button to display data sets"),
                    vscode.TreeItemCollapsibleState.None,
                    this,
                    null,
                    globals.INFORMATION_CONTEXT
                ),
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
                const existing = this.children.find((element) => element.label.toString() === item.dsname);
                if (existing) {
                    elementChildren[existing.label.toString()] = existing;
                    // Creates a ZoweDatasetNode for a PDS
                } else if (item.dsorg === "PO" || item.dsorg === "PO-E") {
                    const temp = new ZoweDatasetNode(
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
                    const temp = new ZoweDatasetNode(
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
                    const temp = new ZoweDatasetNode(
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
                        elementChildren[altLabel] = new ZoweDatasetNode(
                            altLabel,
                            vscode.TreeItemCollapsibleState.None,
                            this,
                            null,
                            globals.VSAM_CONTEXT,
                            undefined,
                            this.getProfile()
                        );
                    }
                } else if (contextually.isSessionNotFav(this)) {
                    // Creates a ZoweDatasetNode for a PS
                    const temp = new ZoweDatasetNode(
                        item.dsname,
                        vscode.TreeItemCollapsibleState.None,
                        this,
                        null,
                        undefined,
                        undefined,
                        this.getProfile()
                    );
                    temp.command = { command: "zowe.ds.ZoweNode.openPS", title: "", arguments: [temp] };
                    elementChildren[temp.label.toString()] = temp;
                } else {
                    // Creates a ZoweDatasetNode for a PDS member
                    const memberInvalid = item.member?.includes("\ufffd");
                    const temp = new ZoweDatasetNode(
                        item.member,
                        vscode.TreeItemCollapsibleState.None,
                        this,
                        null,
                        memberInvalid ? globals.DS_FILE_ERROR_CONTEXT : undefined,
                        undefined,
                        this.getProfile()
                    );
                    if (!memberInvalid) {
                        temp.command = { command: "zowe.ds.ZoweNode.openPS", title: "", arguments: [temp] };
                    } else {
                        temp.errorDetails = new zowe.imperative.ImperativeError({
                            msg: localize("getChildren.invalidMember", "Cannot access member with control characters in the name: {0}", item.member),
                        });
                    }

                    // get user and last modified date for sorting, if available
                    if ("m4date" in item) {
                        const { m4date, mtime, msec }: { m4date: string; mtime: string; msec: string } = item;
                        temp.stats = {
                            user: item.user,
                            modifiedDate: dayjs(`${m4date} ${mtime}:${msec}`).toDate(),
                        };
                    } else if ("id" in item || "changed" in item) {
                        // missing keys from API response; check for FTP keys
                        temp.stats = {
                            user: item.id,
                            modifiedDate: item.changed ? dayjs(item.changed).toDate() : null,
                        };
                    }
                    elementChildren[temp.label.toString()] = temp;
                }
            }
        }

        this.dirty = false;
        if (Object.keys(elementChildren).length === 0) {
            this.children = [
                new ZoweDatasetNode(
                    localize("getChildren.noDataset", "No data sets found"),
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

            switch (sort.method) {
                case DatasetSortOpts.LastModified:
                    return a.stats?.modifiedDate < b.stats?.modifiedDate ? sortLessThan : sortGreaterThan;
                case DatasetSortOpts.UserId:
                    return a.stats?.user < b.stats?.user ? sortLessThan : sortGreaterThan;
                case DatasetSortOpts.Name:
                default:
                    return (a.label as string) < (b.label as string) ? sortLessThan : sortGreaterThan;
            }
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
}
