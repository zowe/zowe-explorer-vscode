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

import { Disposable as VSDisposable, FileSystemWatcher, Uri, workspace } from "vscode";

interface CoreWatchers {
    ds: FileSystemWatcher;
    jobs: FileSystemWatcher;
    uss: FileSystemWatcher;
}

export enum ZoweScheme {
    DS = "zowe-ds",
    Jobs = "zowe-jobs",
    USS = "zowe-uss",
}

export class ZoweFsWatcher {
    private static watchers: CoreWatchers;

    /**
     * This function is called by ZoweExplorerExtender during extender registration.
     *
     * Extenders do **not** need to invoke this function again to leverage the FsWatcher functions.
     */
    public static registerWatchers(): void {
        this.watchers = {
            ds: workspace.createFileSystemWatcher(`${ZoweScheme.DS}:/**`),
            jobs: workspace.createFileSystemWatcher(`${ZoweScheme.Jobs}:/**`),
            uss: workspace.createFileSystemWatcher(`${ZoweScheme.USS}:/**`),
        };
    }

    private static validateWatchers(): void {
        if (this.watchers == null) {
            throw new Error("ZoweFsWatcher.registerWatchers must be called first before registering an event listener.");
        }
    }

    public static onFileChanged(uri: Uri, listener: (e: Uri) => any): VSDisposable {
        this.validateWatchers();
        switch (uri.scheme) {
            case ZoweScheme.DS:
                return this.watchers.ds.onDidChange(listener);
            case ZoweScheme.Jobs:
                return this.watchers.jobs.onDidChange(listener);
            case ZoweScheme.USS:
                return this.watchers.uss.onDidChange(listener);
            default:
                throw new Error(`FsWatcher only supports core schemes: ${ZoweScheme.DS}, ${ZoweScheme.Jobs}, ${ZoweScheme.USS}`);
        }
    }

    public static onFileCreated(uri: Uri, listener: (e: Uri) => any): VSDisposable {
        this.validateWatchers();
        switch (uri.scheme) {
            case ZoweScheme.DS:
                return this.watchers.ds.onDidCreate(listener);
            case ZoweScheme.Jobs:
                return this.watchers.jobs.onDidCreate(listener);
            case ZoweScheme.USS:
                return this.watchers.uss.onDidCreate(listener);
            default:
                throw new Error(`FsWatcher only supports core schemes: ${ZoweScheme.DS}, ${ZoweScheme.Jobs}, ${ZoweScheme.USS}`);
        }
    }

    public static onFileDeleted(uri: Uri, listener: (e: Uri) => any): VSDisposable {
        this.validateWatchers();
        switch (uri.scheme) {
            case ZoweScheme.DS:
                return this.watchers.ds.onDidDelete(listener);
            case ZoweScheme.Jobs:
                return this.watchers.jobs.onDidDelete(listener);
            case ZoweScheme.USS:
                return this.watchers.uss.onDidDelete(listener);
            default:
                throw new Error(`FsWatcher only supports core schemes: ${ZoweScheme.DS}, ${ZoweScheme.Jobs}, ${ZoweScheme.USS}`);
        }
    }
}
