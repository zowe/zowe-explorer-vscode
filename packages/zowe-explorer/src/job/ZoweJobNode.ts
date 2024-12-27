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

import * as vscode from "vscode";
import * as zowe from "@zowe/cli";
import * as globals from "../globals";
import { Gui, IZoweJobTreeNode, JobSortOpts, NodeSort, SortDirection, ZoweTreeNode } from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { errorHandling, syncSessionNode } from "../utils/ProfilesUtils";
import { getIconByNode } from "../generators/icons";
import * as contextually from "../shared/context";
import { JOB_SORT_KEYS } from "./utils";

import * as nls from "vscode-nls";
import { Profiles } from "../Profiles";
import { ZoweLogger } from "../utils/LoggerUtils";
import { encodeJobFile } from "../SpoolProvider";
import { IZoweJobTreeOpts } from "../shared/IZoweTreeOpts";
// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

export class ZoweJobNode extends ZoweTreeNode implements IZoweJobTreeNode {
    public children: IZoweJobTreeNode[] = [];
    public dirty = true;
    public sort: NodeSort = { method: JobSortOpts.Id, direction: SortDirection.Ascending };
    private _owner: string;
    private _prefix: string;
    private _searchId: string;
    private _jobStatus: string;
    public job: zowe.IJob;
    public filtered = false;
    public filter?: string;

    public constructor(opts: IZoweJobTreeOpts) {
        let finalLabel = opts.label;
        // If the node has a parent and the parent is favorited, it is a saved query
        if (opts.parentNode != null && contextually.isFavProfile(opts.parentNode) && !opts.label.includes("|")) {
            finalLabel = "";
            // Convert old format to new format
            const labelOpts = opts.label.split(" ");
            for (let i = 0; i < labelOpts.length; i++) {
                const opt = labelOpts[i];
                const [key, val] = opt.split(":");
                finalLabel += `${key}`;
                if (val !== undefined) {
                    finalLabel += `: ${val}`;
                }
                if (i != labelOpts.length - 1) {
                    finalLabel += " | ";
                }
            }
        }
        super(finalLabel, opts.collapsibleState, opts.parentNode, opts.session, opts.profile);
        this._prefix = "*";
        this._searchId = "";
        this._jobStatus = "*";
        this.tooltip = opts.label;
        this.job = opts.job ?? null; // null instead of undefined to satisfy isZoweJobTreeNode

        if (opts.parentNode == null && opts.label !== "Favorites") {
            this.contextValue = globals.JOBS_SESSION_CONTEXT;
        }

        if (opts.session) {
            this._owner = "*";
            if (opts.session.ISession?.user) {
                this._owner = opts.session.ISession.user;
            }
        }

        if (opts.contextOverride) {
            this.contextValue = opts.contextOverride;
        }

        const icon = getIconByNode(this);
        if (icon) {
            this.iconPath = icon.path;
        }

        if (contextually.isSession(this)) {
            this.sort = {
                method: JobSortOpts.Id,
                direction: SortDirection.Ascending,
            };
            if (!globals.ISTHEIA) {
                this.id = this.label as string;
            }
        } else if (this.contextValue === globals.INFORMATION_CONTEXT) {
            this.command = { command: "zowe.placeholderCommand", title: "Placeholder" };
        }
    }

    /**
     * Retrieves child nodes of this IZoweJobTreeNode
     *
     * @returns {Promise<IZoweJobTreeNode[]>}
     */
    public async getChildren(): Promise<IZoweJobTreeNode[]> {
        ZoweLogger.trace(`ZoweJobNode.getChildren called for ${this.label as string}.`);
        if (contextually.isSession(this) && !this.filtered && !contextually.isFavorite(this)) {
            return [
                new ZoweJobNode({
                    label: localize("getChildren.search", "Use the search button to display jobs"),
                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                    parentNode: this,
                    contextOverride: globals.INFORMATION_CONTEXT,
                }),
            ];
        }

        if (!this.dirty || this.filter !== undefined) {
            return this.children;
        }

        const elementChildren: Record<string, IZoweJobTreeNode> = {};
        if (contextually.isJob(this)) {
            // Fetch spool files under job node
            const spools = await this.getSpoolFiles(this.job);
            if (spools == null) {
                return [];
            } else if (!spools.length) {
                const noSpoolNode = new ZoweSpoolNode({
                    label: localize("getChildren.noSpoolFiles", "No spool files found"),
                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                    parentNode: this,
                    contextOverride: globals.INFORMATION_CONTEXT,
                });
                return (this.children = [noSpoolNode]);
            }
            spools.forEach((spool) => {
                const sessionName = this.getProfileName();
                const procstep = spool.procstep ? spool.procstep : undefined;
                let newLabel: string;
                if (procstep) {
                    newLabel = `${spool.stepname}:${spool.ddname}(${spool.id}) - ${procstep}`;
                } else {
                    newLabel = `${spool.stepname}:${spool.ddname}(${spool.id})`;
                }

                // Only look for existing node w/ procstep if spool file has a procstep,
                // otherwise look for only stepname:ddname to update the record count in the label
                const spoolSuffix = procstep ? ` - ${procstep}` : "";
                const existing = this.children.find((element) =>
                    (element.label as string)?.includes(`${spool.stepname}:${spool.ddname}${spoolSuffix}`)
                );
                if (existing) {
                    existing.tooltip = existing.label = newLabel;
                    elementChildren[newLabel] = existing;
                } else {
                    const spoolNode = new ZoweSpoolNode({
                        label: newLabel,
                        collapsibleState: vscode.TreeItemCollapsibleState.None,
                        parentNode: this,
                        session: this.session,
                        profile: this.profile,
                        job: this.job,
                        spool,
                    });
                    const icon = getIconByNode(spoolNode);
                    if (icon) {
                        spoolNode.iconPath = icon.path;
                    }
                    spoolNode.command = {
                        command: "zowe.jobs.zosJobsOpenspool",
                        title: "",
                        arguments: [sessionName, spoolNode],
                    };
                    elementChildren[newLabel] = spoolNode;
                }
            });
        } else {
            // Fetch jobs under session node
            const jobs = await this.getJobs(this._owner, this._prefix, this._searchId, this._jobStatus);
            if (jobs == null) {
                return [];
            } else if (jobs.length === 0) {
                const noJobsNode = new ZoweJobNode({
                    label: localize("getChildren.noJobs", "No jobs found"),
                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                    parentNode: this,
                    contextOverride: globals.INFORMATION_CONTEXT,
                });
                return (this.children = [noJobsNode]);
            }
            jobs.forEach((job) => {
                let nodeTitle: string;
                if (job.retcode) {
                    nodeTitle =
                        job["exec-member"] !== undefined && job["exec-member"] !== ""
                            ? `${job.jobname}(${job.jobid}) - ${job["exec-member"] as string} - ${job.retcode}`
                            : `${job.jobname}(${job.jobid}) - ${job.retcode}`;
                } else {
                    nodeTitle = `${job.jobname}(${job.jobid}) - ${job.status}`;
                }
                // Do not look for status code as it might have changed from previous refresh
                const existing = this.children.find((element) => (element.label as string)?.startsWith(`${job.jobname}(${job.jobid})`));
                if (existing) {
                    // If matched, update the label to reflect latest retcode/status
                    existing.tooltip = existing.label = nodeTitle;
                    elementChildren[nodeTitle] = existing;
                } else {
                    const jobNode = new ZoweJobNode({
                        label: nodeTitle,
                        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                        parentNode: this,
                        session: this.session,
                        profile: this.getProfile(),
                        job,
                    });
                    jobNode.contextValue = globals.JOBS_JOB_CONTEXT;
                    if (job.retcode) {
                        jobNode.contextValue += globals.RC_SUFFIX + job.retcode;
                    }
                    if (!jobNode.iconPath) {
                        const icon = getIconByNode(jobNode);
                        if (icon) {
                            jobNode.iconPath = icon.path;
                        }
                    }
                    elementChildren[nodeTitle] = jobNode;
                }
            });
        }

        // Only add new children that are not in the list of existing child nodes
        const newChildren = Object.values(elementChildren).filter((c) => this.children.find((ch) => ch.label === c.label) == null);

        const sortMethod = contextually.isSession(this) ? this.sort : { method: JobSortOpts.Id, direction: SortDirection.Ascending };
        // Remove any children that are no longer present in the built record
        this.children = contextually.isSession(this)
            ? this.children
                  .concat(newChildren)
                  .filter((ch) => Object.values(elementChildren).find((recordCh) => recordCh.label === ch.label) != null)
                  .sort(ZoweJobNode.sortJobs(sortMethod))
            : this.children
                  .concat(newChildren)
                  .filter((ch) => Object.values(elementChildren).find((recordCh) => recordCh.label === ch.label) != null);
        this.dirty = false;
        return this.children;
    }

    public static sortJobs(sortOpts: NodeSort): (x: IZoweJobTreeNode, y: IZoweJobTreeNode) => number {
        return (x, y) => {
            const sortLessThan = sortOpts.direction == SortDirection.Ascending ? -1 : 1;
            const sortGreaterThan = sortLessThan * -1;
            let keyToSortBy = JOB_SORT_KEYS[sortOpts.method];
            let xCompare, yCompare;
            if (!x.job[keyToSortBy] && !y.job[keyToSortBy]) {
                keyToSortBy = JOB_SORT_KEYS[3];
            } else if (!x.job[keyToSortBy]) {
                return 1;
            } else if (!y.job[keyToSortBy]) {
                return -1;
            }
            if (keyToSortBy === "retcode") {
                // some jobs (such as active ones) will have a null retcode
                // in this case, use status as the key to compare for that node only
                xCompare = x.job["retcode"] ?? x.job["status"];
                yCompare = y.job["retcode"] ?? y.job["status"];
            } else {
                xCompare = x.job[keyToSortBy];
                yCompare = y.job[keyToSortBy];
            }

            if (keyToSortBy === "exec-ended") {
                x.description = x.job["exec-ended"];
                y.description = y.job["exec-ended"];
            } else {
                x.description = "";
                y.description = "";
            }
            if (xCompare === yCompare) {
                return x.job["jobid"] > y.job["jobid"] ? sortGreaterThan : sortLessThan;
            }
            return xCompare > yCompare ? sortGreaterThan : sortLessThan;
        };
    }

    public getSessionNode(): IZoweJobTreeNode {
        ZoweLogger.trace("ZoweJobNode.getSessionNode called.");
        return this.session ? this : this.getParent()?.getSessionNode() ?? this;
    }

    public set owner(newOwner: string) {
        if (newOwner !== undefined) {
            if (newOwner.length === 0) {
                this._owner = this.session.ISession.user;
            } else {
                this._owner = newOwner;
            }
        }
    }

    public get owner(): string {
        return this._owner;
    }

    public set status(newStatus: string) {
        if (newStatus) {
            this._jobStatus = newStatus;
        }
    }

    public get status(): string {
        return this._jobStatus;
    }

    public set prefix(newPrefix: string) {
        if (newPrefix !== undefined) {
            if (newPrefix.length === 0) {
                this._prefix = "*";
            } else {
                this._prefix = newPrefix;
            }
        }
    }

    public get prefix(): string {
        return this._prefix;
    }

    public set searchId(newId: string) {
        if (newId !== undefined) {
            this._searchId = newId;
        }
    }

    public get searchId(): string {
        return this._searchId;
    }

    private statusNotSupportedMsg(status: string): void {
        ZoweLogger.trace("ZoweJobNode.statusNotSupportedMsg called.");
        if (status !== "*") {
            Gui.warningMessage(
                localize(
                    "getJobs.status.not.supported",
                    "Filtering by job status is not yet supported with this profile type. Will show jobs with all statuses."
                )
            );
        }
    }

    private async getJobs(owner: string, prefix: string, searchId: string, status: string): Promise<zowe.IJob[] | undefined> {
        ZoweLogger.trace("ZoweJobNode.getJobs called.");
        const cachedProfile = Profiles.getInstance().loadNamedProfile(this.getProfileName());
        let jobsInternal: zowe.IJob[] = [];
        try {
            if (this.searchId.length > 0) {
                jobsInternal.push(await ZoweExplorerApiRegister.getJesApi(cachedProfile).getJob(searchId));
            } else {
                if (!ZoweExplorerApiRegister.getJesApi(cachedProfile).getSession(cachedProfile)) {
                    throw new zowe.imperative.ImperativeError({
                        msg: localize("getJobs.error.sessionMissing", "Profile auth error"),
                        additionalDetails: localize("getJobs.error.additionalDetails", "Profile is not authenticated, please log in to continue"),
                        errorCode: `${zowe.imperative.RestConstants.HTTP_STATUS_401}`,
                    });
                }
                if (ZoweExplorerApiRegister.getJesApi(cachedProfile).getJobsByParameters) {
                    jobsInternal = await ZoweExplorerApiRegister.getJesApi(cachedProfile).getJobsByParameters({
                        owner,
                        prefix,
                        status,
                        execData: true,
                    });
                } else {
                    this.statusNotSupportedMsg(status);
                    jobsInternal = await ZoweExplorerApiRegister.getJesApi(cachedProfile).getJobsByOwnerAndPrefix(owner, prefix);
                }

                /**
                 *    Note: Temporary fix
                 *    This current fix is necessary since in certain instances the Zowe
                 *    Explorer JES API returns duplicate jobs. The following reduce function
                 *    filters only the unique jobs present by comparing the ids of these returned
                 *    jobs.
                 */
                jobsInternal = jobsInternal.reduce((acc: zowe.IJob[], current) => {
                    const duplicateJobExists = acc.find((job) => job.jobid === current.jobid);
                    if (!duplicateJobExists) {
                        return acc.concat([current]);
                    } else {
                        return acc;
                    }
                }, []);
            }
        } catch (error) {
            const updated = await errorHandling(error, this.getProfileName(), localize("getJobs.error", "Retrieving response from JES list API"));
            syncSessionNode((profile) => ZoweExplorerApiRegister.getJesApi(profile), this.getSessionNode(), updated && this);
            return;
        }
        return jobsInternal;
    }

    private async getSpoolFiles(job: zowe.IJob = this.job): Promise<zowe.IJobFile[] | undefined> {
        ZoweLogger.trace("ZoweJobNode.getSpoolFiles called.");
        const cachedProfile = Profiles.getInstance().loadNamedProfile(this.getProfileName());
        let spools: zowe.IJobFile[] = [];
        try {
            spools = (await ZoweExplorerApiRegister.getJesApi(cachedProfile).getSpoolFiles(this.job.jobname, this.job.jobid)) ?? [];
            // filter out all the objects which do not seem to be correct Job File Document types
            // see an issue #845 for the details
            spools = spools.filter((item) => !(item.id === undefined && item.ddname === undefined && item.stepname === undefined));
        } catch (error) {
            const updated = await errorHandling(
                error,
                this.getProfileName(),
                localize("getSpoolFiles.error", "Retrieving response from JES list API")
            );
            syncSessionNode((profile) => ZoweExplorerApiRegister.getJesApi(profile), this.getSessionNode(), updated && this);
            return;
        }
        return spools;
    }
}

export class ZoweSpoolNode extends ZoweJobNode {
    public spool: zowe.IJobFile;

    public constructor(opts: IZoweJobTreeOpts & { spool?: zowe.IJobFile }) {
        super(opts);
        this.contextValue = globals.JOBS_SPOOL_CONTEXT;
        this.spool = opts.spool;
        const icon = getIconByNode(this);

        // parent of parent should be the session; tie resourceUri with TreeItem for file decorator
        if (opts.spool && opts.parentNode && opts.parentNode.getParent()) {
            this.resourceUri = encodeJobFile(opts.parentNode.getParent().label as string, opts.spool);
        }
        if (icon) {
            this.iconPath = icon.path;
        }
    }
}
