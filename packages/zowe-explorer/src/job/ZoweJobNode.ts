// @ts-nocheck
/*
 * This program and the accompanying materials are made available under the terms of the *
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at *
 * https://www.eclipse.org/legal/epl-v20.html                                      *
 *                                                                                 *
 * SPDX-License-Identifier: EPL-2.0                                                *
 *                                                                                 *
 * Copyright Contributors to the Zowe Project.                                     *
 *                                                                                 *
 */

import * as vscode from "vscode";
import * as zowe from "@zowe/cli";
import * as globals from "../globals";
import { IZoweJobTreeNode, ZoweTreeNode } from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "../ZoweExplorerApiRegister";
import { errorHandling, syncSessionNode } from "../utils/ProfilesUtils";
import { getIconByNode } from "../generators/icons";
import * as contextually from "../shared/context";

import * as nls from "vscode-nls";
import { Profiles } from "../Profiles";
// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

export class Job extends ZoweTreeNode implements IZoweJobTreeNode {
    public static readonly JobId = "JobId:";
    public static readonly Owner = "Owner:";
    public static readonly Prefix = "Prefix:";
    public static readonly Status = "Status:";

    public children: IZoweJobTreeNode[] = [];
    public dirty = true;
    private _owner: string;
    private _prefix: string;
    private _searchId: string;
    // tslint:disable-next-line: variable-name
    private _jobStatus: string;
    // tslint:disable-next-line: variable-name
    private _tooltip: string;

    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        mParent: IZoweJobTreeNode,
        session: zowe.imperative.Session,
        public job: zowe.IJob,
        profile: zowe.imperative.IProfileLoaded
    ) {
        super(label, collapsibleState, mParent, session, profile);
        this._prefix = "*";
        this._searchId = "";
        this._jobStatus = "*";

        if (session) {
            this._owner = "*";
            if (session.ISession.user) {
                this._owner = session.ISession.user;
            }
        }

        const icon = getIconByNode(this);
        if (icon) {
            this.iconPath = icon.path;
        }
    }

    /**
     * Retrieves child nodes of this IZoweJobTreeNode
     *
     * @returns {Promise<IZoweJobTreeNode[]>}
     */
    public async getChildren(): Promise<IZoweJobTreeNode[]> {
        if (!this._owner && contextually.isSession(this)) {
            return [
                new Job(
                    localize("getChildren.search", "Use the search button to display jobs"),
                    vscode.TreeItemCollapsibleState.None,
                    this,
                    null,
                    null,
                    null
                ),
            ];
        }
        if (this.dirty) {
            let spools: zowe.IJobFile[] = [];
            const elementChildren = [];
            if (contextually.isJob(this)) {
                spools = await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: localize("ZoweJobNode.getJobs.spoolfiles", "Get Job Spool files command submitted."),
                    },
                    () => {
                        const cachedProfile = Profiles.getInstance().loadNamedProfile(this.getProfileName());
                        return ZoweExplorerApiRegister.getJesApi(cachedProfile).getSpoolFiles(
                            this.job.jobname,
                            this.job.jobid
                        );
                    }
                );
                spools = spools
                    // filter out all the objects which do not seem to be correct Job File Document types
                    // see an issue #845 for the details
                    .filter(
                        (item) => !(item.id === undefined && item.ddname === undefined && item.stepname === undefined)
                    );
                if (!spools.length) {
                    const noSpoolNode = new Spool(
                        localize("getChildren.noSpoolFiles", "There are no JES spool messages to display"),
                        vscode.TreeItemCollapsibleState.None,
                        this,
                        null,
                        null,
                        null,
                        this
                    );
                    noSpoolNode.iconPath = null;
                    return [noSpoolNode];
                }
                const refreshTimestamp = Date.now();
                spools.forEach((spool) => {
                    let prefix = spool.stepname;
                    if (prefix === undefined) {
                        prefix = spool.procstep;
                    }
                    const sessionName = this.getProfileName();
                    const procstep = spool.procstep ? spool.procstep : undefined;
                    let newLabel: string;
                    if (procstep) {
                        newLabel = `${spool.stepname}:${spool.ddname} - ${procstep}`;
                    } else {
                        newLabel = `${spool.stepname}:${spool.ddname} - ${spool["record-count"]}`;
                    }
                    const spoolNode = new Spool(
                        newLabel,
                        vscode.TreeItemCollapsibleState.None,
                        this,
                        this.session,
                        spool,
                        this.job,
                        this
                    );
                    const icon = getIconByNode(spoolNode);
                    if (icon) {
                        spoolNode.iconPath = icon.path;
                    }
                    const arr = [];
                    Object.keys(spool).map((key) => {
                        if (key !== "records-url") {
                            arr.push({ [key]: spool[key] });
                        }
                    });
                    let newTooltip = "";
                    arr.forEach((item) => {
                        newTooltip += `${JSON.stringify(item).replace(/({|})/g, "")}\n`;
                    });
                    spoolNode.tooltip = newTooltip;
                    spoolNode.command = {
                        command: "zowe.jobs.zosJobsOpenspool",
                        title: "",
                        arguments: [sessionName, spool, refreshTimestamp],
                    };
                    elementChildren.push(spoolNode);
                });
            } else {
                const jobs = await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: localize("ZoweJobNode.getJobs.jobs", "Get Jobs command submitted."),
                    },
                    () => {
                        return this.getJobs(this._owner, this._prefix, this._searchId, this._jobStatus); // change here
                    }
                );
                jobs.forEach((job) => {
                    let nodeTitle: string;
                    if (job.retcode) {
                        nodeTitle = `${job.jobname}(${job.jobid}) - ${job.retcode}`;
                    } else {
                        nodeTitle = `${job.jobname}(${job.jobid}) - ${job.status}`;
                    }
                    const existing = this.children.find((element) => element.label.trim() === nodeTitle);
                    if (existing) {
                        elementChildren.push(existing);
                    } else {
                        const jobNode = new Job(
                            nodeTitle,
                            vscode.TreeItemCollapsibleState.Collapsed,
                            this,
                            this.session,
                            job,
                            this.getProfile()
                        );
                        jobNode.command = { command: "zowe.zosJobsSelectjob", title: "", arguments: [jobNode] };
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
                        elementChildren.push(jobNode);
                    }
                });
            }
            elementChildren.sort((a, b) => {
                if (a.job.jobid > b.job.jobid) {
                    return 1;
                }
                if (a.job.jobid < b.job.jobid) {
                    return -1;
                }
                return 0;
            });
            this.children = elementChildren;
        }
        this.dirty = false;
        return this.children;
    }

    public getSessionNode(): IZoweJobTreeNode {
        return this.getParent() ? this.getParent().getSessionNode() : this;
    }

    set tooltip(newTooltip: string) {
        if (newTooltip) {
            this._tooltip = newTooltip;
        }
    }

    get tooltip(): string {
        if (this._tooltip) {
            return this._tooltip;
        }
        if (this.job !== null) {
            if (this.job.retcode) {
                return `${this.job.jobname}(${this.job.jobid}) - ${this.job.retcode}`;
            } else {
                return `${this.job.jobname}(${this.job.jobid})`;
            }
        } else if (this.searchId.length > 0) {
            return `${this.label} - job id: ${this.searchId}`;
        } else {
            return `${this.label} - owner: ${this.owner} prefix: ${this.prefix}`;
        }
    }

    set owner(newOwner: string) {
        if (newOwner !== undefined) {
            if (newOwner.length === 0) {
                this._owner = this.session.ISession.user;
            } else {
                this._owner = newOwner;
            }
        }
    }

    get owner() {
        return this._owner;
    }

    set status(newStatus: string) {
        if (newStatus) {
            this._jobStatus = newStatus;
        }
    }

    get status() {
        return this._jobStatus;
    }

    set prefix(newPrefix: string) {
        if (newPrefix !== undefined) {
            if (newPrefix.length === 0) {
                this._prefix = "*";
            } else {
                this._prefix = newPrefix;
            }
        }
    }

    get prefix() {
        return this._prefix;
    }

    public set searchId(newId: string) {
        if (newId !== undefined) {
            this._searchId = newId;
        }
    }

    public get searchId() {
        return this._searchId;
    }

    private statusNotSupportedMsg(status: string) {
        if (status !== "*") {
            vscode.window.showWarningMessage(
                localize(
                    "getJobs.status.not.supported",
                    "Filtering by job status is not yet supported with this profile type. Will show jobs with all statuses."
                )
            );
        }
    }

    private async getJobs(owner: string, prefix: string, searchId: string, status: string): Promise<zowe.IJob[]> {
        let jobsInternal: zowe.IJob[] = [];
        const sessNode = this.getSessionNode();
        const cachedProfile = Profiles.getInstance().loadNamedProfile(this.getProfileName());
        if (this.searchId.length > 0) {
            jobsInternal.push(await ZoweExplorerApiRegister.getJesApi(cachedProfile).getJob(searchId));
        } else {
            try {
                if (ZoweExplorerApiRegister.getJesApi(cachedProfile).getJobsByParameters) {
                    jobsInternal = await ZoweExplorerApiRegister.getJesApi(cachedProfile).getJobsByParameters({
                        owner,
                        prefix,
                        status,
                    });
                } else {
                    this.statusNotSupportedMsg(status);
                    jobsInternal = await ZoweExplorerApiRegister.getJesApi(cachedProfile).getJobsByOwnerAndPrefix(
                        owner,
                        prefix
                    );
                }

                /**
                 *    Note: Temporary fix
                 *    This current fix is necessary since in certain instances the Zowe
                 *    Explorer JES API returns duplicate jobs. The following reduce function
                 *    filters only the unique jobs present by comparing the ids of these returned
                 *    jobs.
                 */
                jobsInternal = jobsInternal.reduce((acc, current) => {
                    const duplicateJobExists = acc.find((job) => job.jobid === current.jobid);
                    if (!duplicateJobExists) {
                        return acc.concat([current]);
                    } else {
                        return acc;
                    }
                }, []);
            } catch (error) {
                await errorHandling(
                    error,
                    this.label,
                    localize("getChildren.error.response", "Retrieving response from ") + `zowe.GetJobs`
                );
                await syncSessionNode(Profiles.getInstance())((profileValue) =>
                    ZoweExplorerApiRegister.getJesApi(profileValue).getSession()
                )(sessNode);
            }
        }
        return jobsInternal;
    }
}

export class Spool extends Job {
    constructor(
        label: string,
        mCollapsibleState: vscode.TreeItemCollapsibleState,
        mParent: IZoweJobTreeNode,
        session: zowe.imperative.Session,
        spool: zowe.IJobFile,
        job: zowe.IJob,
        parent: IZoweJobTreeNode
    ) {
        super(label, mCollapsibleState, mParent, session, job, parent.getProfile());
        this.contextValue = globals.JOBS_SPOOL_CONTEXT;
        const icon = getIconByNode(this);
        if (icon) {
            this.iconPath = icon.path;
        }
    }
}
