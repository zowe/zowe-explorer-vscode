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

import { Uri } from "vscode";
import { ZoweFsWatcher, ZoweScheme } from "../../../src/fs";

type TestUris = Record<string, Readonly<Uri>>;
const testUris: TestUris = {
    ds: Uri.from({ scheme: ZoweScheme.DS, path: "/session.zosmf/SOME.DS.ENTRY" }),
    jobs: Uri.from({ scheme: ZoweScheme.Jobs, path: "/session.zosmf/JOB1234/SPOOL.FILE" }),
    uss: Uri.from({ scheme: ZoweScheme.USS, path: "/session.zosmf/u/users/TESTUSER/file.txt" }),
};

describe("registerWatchers", () => {
    it("successfully initializes watcher object using createFileSystemWatcher", () => {
        expect((ZoweFsWatcher as any).watchers).toBeUndefined();
        ZoweFsWatcher.registerWatchers();
        expect((ZoweFsWatcher as any).watchers).not.toBeUndefined();
        expect(Object.keys((ZoweFsWatcher as any).watchers).length).toBe(3);
    });
});

describe("validateWatchers", () => {
    it("returns gracefully if watchers are registered", () => {
        ZoweFsWatcher.registerWatchers();
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
        ZoweFsWatcher.registerWatchers();
        const onDidChangeDsSpy = jest.spyOn((ZoweFsWatcher as any).watchers.ds, "onDidChange");
        const listenerFn = (uri) => {};

        ZoweFsWatcher.onFileChanged(testUris.ds, listenerFn);
        expect(onDidChangeDsSpy).toHaveBeenCalledWith(listenerFn);

        const onDidChangeUssSpy = jest.spyOn((ZoweFsWatcher as any).watchers.uss, "onDidChange");
        ZoweFsWatcher.onFileChanged(testUris.uss, listenerFn);
        expect(onDidChangeUssSpy).toHaveBeenCalledWith(listenerFn);

        const onDidChangeJobsSpy = jest.spyOn((ZoweFsWatcher as any).watchers.jobs, "onDidChange");
        ZoweFsWatcher.onFileChanged(testUris.jobs, listenerFn);
        expect(onDidChangeJobsSpy).toHaveBeenCalledWith(listenerFn);
    });

    it("throws an error if the URI is not a Zowe scheme", () => {
        ZoweFsWatcher.registerWatchers();
        const callbackMock = jest.fn();
        expect(() => ZoweFsWatcher.onFileChanged(Uri.from({ scheme: "file", path: "/a/b/c.txt" }), () => callbackMock())).toThrow(
            "FsWatcher only supports core schemes: zowe-ds, zowe-jobs, zowe-uss"
        );
    });
});

describe("onFileDeleted", () => {
    it("registers an event listener to the correct watcher", () => {
        ZoweFsWatcher.registerWatchers();
        const onDidDeleteDsSpy = jest.spyOn((ZoweFsWatcher as any).watchers.ds, "onDidDelete");
        const listenerFn = (uri): void => {};

        ZoweFsWatcher.onFileDeleted(testUris.ds, listenerFn);
        expect(onDidDeleteDsSpy).toHaveBeenCalledWith(listenerFn);

        const onDidDeleteUssSpy = jest.spyOn((ZoweFsWatcher as any).watchers.uss, "onDidDelete");
        ZoweFsWatcher.onFileDeleted(testUris.uss, listenerFn);
        expect(onDidDeleteUssSpy).toHaveBeenCalledWith(listenerFn);

        const onDidDeleteJobsSpy = jest.spyOn((ZoweFsWatcher as any).watchers.jobs, "onDidDelete");
        ZoweFsWatcher.onFileDeleted(testUris.jobs, listenerFn);
        expect(onDidDeleteJobsSpy).toHaveBeenCalledWith(listenerFn);
    });

    it("throws an error if the URI is not a Zowe scheme", () => {
        ZoweFsWatcher.registerWatchers();
        const callbackMock = jest.fn();
        expect(() => ZoweFsWatcher.onFileDeleted(Uri.from({ scheme: "file", path: "/a/b/c.txt" }), () => callbackMock())).toThrow(
            "FsWatcher only supports core schemes: zowe-ds, zowe-jobs, zowe-uss"
        );
    });
});

describe("onFileCreated", () => {
    it("registers an event listener to the correct watcher", () => {
        ZoweFsWatcher.registerWatchers();
        const onDidCreateDsSpy = jest.spyOn((ZoweFsWatcher as any).watchers.ds, "onDidCreate");
        const listenerFn = (uri) => {};

        ZoweFsWatcher.onFileCreated(testUris.ds, listenerFn);
        expect(onDidCreateDsSpy).toHaveBeenCalledWith(listenerFn);

        const onDidCreateUssSpy = jest.spyOn((ZoweFsWatcher as any).watchers.uss, "onDidCreate");
        ZoweFsWatcher.onFileCreated(testUris.uss, listenerFn);
        expect(onDidCreateUssSpy).toHaveBeenCalledWith(listenerFn);

        const onDidCreateJobsSpy = jest.spyOn((ZoweFsWatcher as any).watchers.jobs, "onDidCreate");
        ZoweFsWatcher.onFileCreated(testUris.jobs, listenerFn);
        expect(onDidCreateJobsSpy).toHaveBeenCalledWith(listenerFn);
    });

    it("throws an error if the URI is not a Zowe scheme", () => {
        ZoweFsWatcher.registerWatchers();
        const callbackMock = jest.fn();
        expect(() => ZoweFsWatcher.onFileCreated(Uri.from({ scheme: "file", path: "/a/b/c.txt" }), () => callbackMock())).toThrow(
            "FsWatcher only supports core schemes: zowe-ds, zowe-jobs, zowe-uss"
        );
    });
});
