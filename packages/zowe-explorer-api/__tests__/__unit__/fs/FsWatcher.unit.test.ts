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

import { Event, FileChangeEvent, Uri } from "vscode";
import { BaseProvider, ZoweFsWatcher, ZoweScheme } from "../../../src/fs";

type TestUris = Record<string, Readonly<Uri>>;
const testUris: TestUris = {
    ds: Uri.from({ scheme: ZoweScheme.DS, path: "/session.zosmf/SOME.DS.ENTRY" }),
    jobs: Uri.from({ scheme: ZoweScheme.Jobs, path: "/session.zosmf/JOB1234/SPOOL.FILE" }),
    uss: Uri.from({ scheme: ZoweScheme.USS, path: "/session.zosmf/u/users/TESTUSER/file.txt" }),
};

describe("registerEventForScheme", () => {
    it("successfully adds onDidChangeFile event", () => {
        expect((ZoweFsWatcher as any).watchers).toBeUndefined();
        ZoweFsWatcher.registerEventForScheme(ZoweScheme.USS, {} as any);
        expect((ZoweFsWatcher as any).watchers).not.toBeUndefined();
    });
});

describe("validateWatchers", () => {
    it("returns gracefully if watchers are registered", () => {
        (ZoweFsWatcher as any).watchers = {
            ds: {} as Event<FileChangeEvent[]>,
        };
        expect((ZoweFsWatcher as any).validateWatchers()).toBe(undefined);
    });

    it("throws an error if watchers aren't registered", () => {
        (ZoweFsWatcher as any).watchers = undefined;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        expect(() => (ZoweFsWatcher as any).validateWatchers()).toThrow(
            "ZoweFsWatcher.registerWatchers must be called first before registering an event listener"
        );
    });
});

describe("onFileChanged", () => {
    it("registers an event listener to the correct watcher", () => {
        const prov = new (BaseProvider as any)();
        ZoweFsWatcher.registerEventForScheme(ZoweScheme.DS, prov.onDidChangeFile);
        const listenerFn = (uri) => {};

        expect(() => ZoweFsWatcher.onFileChanged(testUris.ds, listenerFn)).not.toThrow();
    });

    it("throws an error if the URI is not a Zowe scheme", () => {
        const callbackMock = jest.fn();
        expect(() => ZoweFsWatcher.onFileChanged(Uri.from({ scheme: "file", path: "/a/b/c.txt" }), () => callbackMock())).toThrow(
            "FsWatcher only supports core schemes: zowe-ds, zowe-jobs, zowe-uss"
        );
    });
});
