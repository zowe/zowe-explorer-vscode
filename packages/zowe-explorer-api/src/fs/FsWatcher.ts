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

import { Disposable as VSDisposable, Event, Uri, FileChangeEvent } from "vscode";

export enum ZoweScheme {
    DS = "zowe-ds",
    Jobs = "zowe-jobs",
    USS = "zowe-uss",
}
type CoreWatchers = Record<ZoweScheme, Event<FileChangeEvent[]>>;

export class ZoweFsWatcher {
    private static watchers: CoreWatchers = {
        [ZoweScheme.DS]: null,
        [ZoweScheme.Jobs]: null,
        [ZoweScheme.USS]: null,
    };

    public static registerEventForScheme(scheme: ZoweScheme, event: Event<FileChangeEvent[]>): void {
        this.watchers[scheme] = event;
    }

    private static validateWatchers(): void {
        if (this.watchers == null) {
            throw new Error("ZoweFsWatcher.registerWatchers must be called first before registering an event listener.");
        }
    }

    public static onFileChanged(uri: Uri, listener: (e: FileChangeEvent[]) => any): VSDisposable {
        this.validateWatchers();
        if (!(uri.scheme in this.watchers)) {
            throw new Error(`FsWatcher only supports core schemes: ${ZoweScheme.DS}, ${ZoweScheme.Jobs}, ${ZoweScheme.USS}`);
        }

        return this.watchers[uri.scheme](listener) as VSDisposable;
    }
}
