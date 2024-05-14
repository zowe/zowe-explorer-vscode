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
import * as zosjobs from "@zowe/zos-jobs-for-zowe-sdk";
import * as path from "path";
import { FsJobsUtils, imperative, IZoweJobTreeNode, Sorting, ZoweScheme, ZoweTreeNode } from "@zowe/zowe-explorer-api";
import { JobFSProvider } from "./JobFSProvider";
import { JobUtils } from "./JobUtils";
import { Constants } from "../../configuration/Constants";
import { Profiles } from "../../configuration/Profiles";
import { ZoweExplorerApiRegister } from "../../extending/ZoweExplorerApiRegister";
import { IconGenerator } from "../../icons/IconGenerator";
import { ZoweLogger } from "../../tools/ZoweLogger";
import { SharedContext } from "../shared/SharedContext";
import { SharedUtils } from "../shared/SharedUtils";
import { AuthUtils } from "../../utils/AuthUtils";

export class ZoweJobNode extends ZoweTreeNode implements IZoweJobTreeNode {
    public children: IZoweJobTreeNode[] = [];
    public dirty = true;
    public resourceUri?: vscode.Uri;
    public sort: Sorting.NodeSort;
    private _owner: string;
    private _prefix: string;
    private _searchId: string;
    private _jobStatus: string;
    public job: zosjobs.IJob;
    public filtered = false;
    public filter?: string;

    public constructor(opts: SharedUtils.IZoweJobTreeOpts) {
        let finalLabel = opts.label;
        // If the node has a parent and the parent is favorited, it is a saved query
        if (opts.parentNode != null && SharedContext.isFavProfile(opts.parentNode) && !opts.label.includes("|")) {
            finalLabel = "";
            // Convert old format to new format
            const labelOpts = opts.label.split(" ");
            for (let i = 0; i < labelOpts.length; i++) {
                const opt = labelOpts[i];
                const [key, val] = opt.split(":");
                finalLabel += `${key}: ${val}`;
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

        const isFavoritesNode = opts.label === vscode.l10n.t("Favorites");
        const sessionLabel = opts.profile?.name ?? SharedUtils.getSessionLabel(this);

        if (!isFavoritesNode && this.job == null) {
            // non-favorited, session node
            if (!SharedContext.isFavorite(this)) {
                this.contextValue = Constants.JOBS_SESSION_CONTEXT;
            }
            this.resourceUri = vscode.Uri.from({
                scheme: ZoweScheme.Jobs,
                path: `/${sessionLabel}/`,
            });
            JobFSProvider.instance.createDirectory(this.resourceUri, { isFilter: true });
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

        const icon = IconGenerator.getIconByNode(this);
        if (icon) {
            this.iconPath = icon.path;
        }

        if (SharedContext.isSession(this)) {
            this.sort = {
                method: Sorting.JobSortOpts.Id,
                direction: Sorting.SortDirection.Ascending,
            };
            if (this.getParent()?.label !== vscode.l10n.t("Favorites") && !SharedContext.isFavorite(this)) {
                this.id = this.label as string;
            }
        } else if (this.job != null) {
            this.resourceUri = vscode.Uri.from({
                scheme: ZoweScheme.Jobs,
                path: `/${sessionLabel}/${this.job.jobid}`,
            });
        }
    }

    /**
     * Retrieves child nodes of this IZoweJobTreeNode
     *
     * @returns {Promise<IZoweJobTreeNode[]>}
     */
    public async getChildren(): Promise<IZoweJobTreeNode[]> {
        const thisSessionNode = this.getSessionNode();
        ZoweLogger.trace(`ZoweJobNode.getChildren called for ${String(thisSessionNode.label)}.`);
        if (this?.filter !== undefined) {
            return this.children;
        }
        if (SharedContext.isSession(this) && !this.filtered && !SharedContext.isFavorite(this)) {
            const placeholder = new ZoweJobNode({
                label: vscode.l10n.t("Use the search button to display jobs"),
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                parentNode: this,
                profile: thisSessionNode.getProfile(),
                contextOverride: Constants.INFORMATION_CONTEXT,
            });
            placeholder.command = {
                command: "zowe.placeholderCommand",
                title: "Placeholder",
            };
            return [placeholder];
        }

        if (!this.dirty) {
            return this.children;
        }

        const elementChildren: Record<string, IZoweJobTreeNode> = {};
        if (SharedContext.isJob(this)) {
            // Fetch spool files under job node
            const cachedProfile = Profiles.getInstance().loadNamedProfile(this.getProfileName());
            const spools: zosjobs.IJobFile[] = (
                (await ZoweExplorerApiRegister.getJesApi(cachedProfile).getSpoolFiles(this.job.jobname, this.job.jobid)) ?? []
            )
                // filter out all the objects which do not seem to be correct Job File Document types
                // see an issue #845 for the details
                .filter((item) => !(item.id === undefined && item.ddname === undefined && item.stepname === undefined));
            if (!spools.length) {
                const noSpoolNode = new ZoweSpoolNode({
                    label: vscode.l10n.t("There are no JES spool messages to display"),
                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                    parentNode: this,
                    profile: this.getProfile(),
                });
                noSpoolNode.iconPath = undefined;
                return [noSpoolNode];
            }
            spools.forEach((spool) => {
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
                    JobFSProvider.instance.writeFile(spoolNode.resourceUri, new Uint8Array(), {
                        create: true,
                        overwrite: true,
                        name: spoolNode.uniqueName,
                        spool,
                    });
                    const icon = IconGenerator.getIconByNode(spoolNode);
                    if (icon) {
                        spoolNode.iconPath = icon.path;
                    }
                    spoolNode.command = {
                        command: "vscode.open",
                        title: "",
                        arguments: [spoolNode.resourceUri],
                    };
                    elementChildren[newLabel] = spoolNode;
                }
            });
        } else {
            // Fetch jobs under session node
            const jobs = await this.getJobs(this._owner, this._prefix, this._searchId, this._jobStatus);
            if (jobs.length === 0) {
                const noJobsNode = new ZoweJobNode({
                    label: vscode.l10n.t("No jobs found"),
                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                    parentNode: this,
                    profile: this.getProfile(),
                });
                noJobsNode.contextValue = Constants.INFORMATION_CONTEXT;
                noJobsNode.iconPath = undefined;
                noJobsNode.command = {
                    command: "zowe.placeholderCommand",
                    title: "Placeholder",
                };
                return [noJobsNode];
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
                    JobFSProvider.instance.createDirectory(jobNode.resourceUri, { job });

                    jobNode.contextValue = Constants.JOBS_JOB_CONTEXT;
                    if (job.retcode) {
                        jobNode.contextValue += Constants.RC_SUFFIX + job.retcode;
                    }
                    if (!jobNode.iconPath) {
                        const icon = IconGenerator.getIconByNode(jobNode);
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

        const sortMethod = SharedContext.isSession(this) ? this.sort : { method: Sorting.JobSortOpts.Id, direction: Sorting.SortDirection.Ascending };
        // Remove any children that are no longer present in the built record
        this.children = SharedContext.isSession(this)
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

    public static sortJobs(sortOpts: Sorting.NodeSort): (x: IZoweJobTreeNode, y: IZoweJobTreeNode) => number {
        return (x, y) => {
            const sortLessThan = sortOpts.direction == Sorting.SortDirection.Ascending ? -1 : 1;
            const sortGreaterThan = sortLessThan * -1;

            const keyToSortBy = JobUtils.JOB_SORT_KEYS[sortOpts.method];
            let xCompare, yCompare;
            if (keyToSortBy === "retcode") {
                // some jobs (such as active ones) will have a null retcode
                // in this case, use status as the key to compare for that node only
                xCompare = x.job["retcode"] ?? x.job["status"];
                yCompare = y.job["retcode"] ?? y.job["status"];
            } else {
                xCompare = x.job[keyToSortBy];
                yCompare = y.job[keyToSortBy];
            }

            if (xCompare === yCompare) {
                return x.job["jobid"] > y.job["jobid"] ? sortGreaterThan : sortLessThan;
            }

            return xCompare > yCompare ? sortGreaterThan : sortLessThan;
        };
    }

    public getSessionNode(): IZoweJobTreeNode {
        ZoweLogger.trace("ZoweJobNode.getSessionNode called.");
        return this.getParent() ? this.getParent().getSessionNode() : this;
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

    private async getJobs(owner: string, prefix: string, searchId: string, status: string): Promise<zosjobs.IJob[]> {
        ZoweLogger.trace("ZoweJobNode.getJobs called.");
        let jobsInternal: zosjobs.IJob[] = [];
        const cachedProfile = Profiles.getInstance().loadNamedProfile(this.getProfileName());
        try {
            if (this.searchId.length > 0) {
                jobsInternal.push(await ZoweExplorerApiRegister.getJesApi(cachedProfile).getJob(searchId));
            } else {
                if (!ZoweExplorerApiRegister.getJesApi(cachedProfile).getSession(cachedProfile)) {
                    throw new imperative.ImperativeError({
                        msg: vscode.l10n.t("Profile auth error"),
                        additionalDetails: vscode.l10n.t("Profile is not authenticated, please log in to continue"),
                        errorCode: `${imperative.RestConstants.HTTP_STATUS_401}`,
                    });
                }
                jobsInternal = await ZoweExplorerApiRegister.getJesApi(cachedProfile).getJobsByParameters({
                    owner,
                    prefix,
                    status,
                    execData: true,
                });

                /**
                 *    Note: Temporary fix
                 *    This current fix is necessary since in certain instances the Zowe
                 *    Explorer JES API returns duplicate jobs. The following reduce function
                 *    filters only the unique jobs present by comparing the ids of these returned
                 *    jobs.
                 */
                jobsInternal = jobsInternal.reduce((acc: zosjobs.IJob[], current) => {
                    const duplicateJobExists = acc.find((job) => job.jobid === current.jobid);
                    if (!duplicateJobExists) {
                        return acc.concat([current]);
                    } else {
                        return acc;
                    }
                }, []);
            }
        } catch (error) {
            ZoweLogger.trace("Error getting jobs from Rest API.");
            await AuthUtils.errorHandling(error, cachedProfile.name, vscode.l10n.t("Retrieving response from zowe.GetJobs"));
            AuthUtils.syncSessionNode((profile) => ZoweExplorerApiRegister.getJesApi(profile), this.getSessionNode());
        }
        return jobsInternal;
    }
}

export class ZoweSpoolNode extends ZoweJobNode {
    public uniqueName: string;
    public spool: zosjobs.IJobFile;

    public constructor(opts: SharedUtils.IZoweJobTreeOpts & { spool?: zosjobs.IJobFile }) {
        super(opts);
        this.uniqueName = opts.spool ? FsJobsUtils.buildUniqueSpoolName(opts.spool).replace("/", "") : "<unknown-spool-id>";
        this.resourceUri = opts.parentNode?.resourceUri.with({
            path: path.posix.join(opts.parentNode.resourceUri.path, this.uniqueName),
        });
        this.contextValue = Constants.JOBS_SPOOL_CONTEXT;
        this.spool = opts.spool;
        const icon = IconGenerator.getIconByNode(this);

        if (icon) {
            this.iconPath = icon.path;
        }
    }
}