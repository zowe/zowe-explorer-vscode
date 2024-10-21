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

import { Disposable, FilePermission, FileType, Uri, window } from "vscode";
import { FsJobsUtils, FilterEntry, Gui, JobEntry, SpoolEntry, ZoweScheme } from "@zowe/zowe-explorer-api";
import { createIProfile } from "../../../__mocks__/mockCreators/shared";
import { createIJobFile, createIJobObject } from "../../../__mocks__/mockCreators/jobs";
import { ZoweExplorerApiRegister } from "../../../../src/extending/ZoweExplorerApiRegister";
import { JobFSProvider } from "../../../../src/trees/job/JobFSProvider";
import { MockedProperty } from "../../../__mocks__/mockUtils";

const testProfile = createIProfile();

type TestUris = Record<string, Readonly<Uri>>;
const testUris: TestUris = {
    spool: Uri.from({ scheme: ZoweScheme.Jobs, path: "/sestest/TESTJOB(JOB1234) - ACTIVE/JES2.JESMSGLG.2" }),
    job: Uri.from({ scheme: ZoweScheme.Jobs, path: "/sestest/TESTJOB(JOB1234) - ACTIVE" }),
    session: Uri.from({ scheme: ZoweScheme.Jobs, path: "/sestest" }),
};

const testEntries = {
    job: {
        ...new JobEntry("TESTJOB(JOB1234) - ACTIVE"),
        job: createIJobObject(),
        metadata: {
            profile: testProfile,
            path: "/TESTJOB(JOB1234) - ACTIVE",
        },
    } as JobEntry,
    spool: {
        ...new SpoolEntry("JES2.JESMSGLG.2"),
        data: new Uint8Array([1, 2, 3]),
        metadata: {
            profile: testProfile,
            path: "/TESTJOB(JOB1234) - ACTIVE/JES2.JESMSGLG.2",
        },
        spool: {
            id: "SOMEID",
        } as any,
    } as SpoolEntry,
    session: {
        ...new FilterEntry("sestest"),
        metadata: {
            profile: testProfile,
            path: "/",
        },
    },
};

describe("watch", () => {
    it("returns an empty Disposable object", () => {
        expect(JobFSProvider.instance.watch(testUris.job, { recursive: false, excludes: [] })).toStrictEqual(new Disposable(() => {}));
    });
});
describe("stat", () => {
    it("returns a spool entry as read-only", () => {
        const fakeSpool = new SpoolEntry(testEntries.spool.name);
        const lookupMock = jest.spyOn(JobFSProvider.instance as any, "lookup").mockReturnValueOnce(fakeSpool);
        expect(JobFSProvider.instance.stat(testUris.spool)).toStrictEqual({
            ...fakeSpool,
            permissions: FilePermission.Readonly,
        });
        lookupMock.mockRestore();
    });

    it("returns a job entry", () => {
        const lookupMock = jest.spyOn(JobFSProvider.instance as any, "lookup").mockReturnValueOnce(testEntries.job);
        expect(JobFSProvider.instance.stat(testUris.spool)).toStrictEqual({
            ...testEntries.job,
        });
        lookupMock.mockRestore();
    });
});

describe("refreshSpool", () => {
    it("returns early if the node is not a spool file", async () => {
        const statusBarMsgMock = jest.spyOn(Gui, "setStatusBarMessage").mockImplementation();
        statusBarMsgMock.mockReset();
        const node = { resourceUri: testUris.spool, contextValue: "job" } as any;
        await JobFSProvider.refreshSpool(node);
        expect(statusBarMsgMock).not.toHaveBeenCalledWith("$(sync~spin) Fetching spool file...");
        statusBarMsgMock.mockRestore();
    });

    it("calls fetchSpoolAtUri for a valid spool node", async () => {
        const node = { resourceUri: testUris.spool, contextValue: "spool" } as any;
        const editorListMock = new MockedProperty(window, "visibleTextEditors", {
            value: [{ document: { uri: testUris.spool } }],
        });
        const fetchSpoolAtUriMock = jest.spyOn(JobFSProvider.instance, "fetchSpoolAtUri").mockImplementation();
        const disposeMock = jest.fn();
        const statusBarMsgMock = jest.spyOn(Gui, "setStatusBarMessage").mockReturnValue({ dispose: disposeMock });
        await JobFSProvider.refreshSpool(node);
        expect(statusBarMsgMock).toHaveBeenCalledWith("$(sync~spin) Fetching spool file...");
        expect(fetchSpoolAtUriMock).toHaveBeenCalledWith(node.resourceUri, {
            document: { uri: { path: "/sestest/TESTJOB(JOB1234) - ACTIVE/JES2.JESMSGLG.2", scheme: "zowe-jobs" } },
        });
        expect(disposeMock).toHaveBeenCalled();
        fetchSpoolAtUriMock.mockRestore();
        statusBarMsgMock.mockRestore();
        editorListMock[Symbol.dispose]();
    });
});

describe("readDirectory", () => {
    it("calls getJobsByParameters to list jobs under a session", async () => {
        const fakeJob2 = { ...createIJobObject(), jobid: "JOB3456" };
        const mockJesApi = {
            getJobsByParameters: jest.fn().mockResolvedValueOnce([createIJobObject(), fakeJob2]),
        };
        const jesApiMock = jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValueOnce(mockJesApi as any);
        const lookupAsDirMock = jest.spyOn(JobFSProvider.instance as any, "_lookupAsDirectory").mockReturnValueOnce({
            ...testEntries.session,
            filter: { ...testEntries.session.filter, owner: "USER", prefix: "JOB*", status: "*" },
            entries: new Map(),
        } as any);
        expect(await JobFSProvider.instance.readDirectory(testUris.session)).toStrictEqual([
            ["JOB1234", FileType.Directory],
            ["JOB3456", FileType.Directory],
        ]);
        expect(lookupAsDirMock).toHaveBeenCalledWith(testUris.session, false);
        expect(mockJesApi.getJobsByParameters).toHaveBeenCalledWith({
            owner: "USER",
            prefix: "JOB*",
            status: "*",
        });
        jesApiMock.mockRestore();
    });

    it("calls getSpoolFiles to list spool files under a job", async () => {
        const fakeSpool = createIJobFile();
        const fakeSpool2 = { ...createIJobFile(), id: 102 };
        const mockJesApi = {
            getSpoolFiles: jest.fn().mockResolvedValueOnce([fakeSpool, fakeSpool2]),
        };
        const jesApiMock = jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValueOnce(mockJesApi as any);
        const fakeJob = new JobEntry(testEntries.job.name);
        fakeJob.job = testEntries.job.job;
        const lookupAsDirMock = jest.spyOn(JobFSProvider.instance as any, "_lookupAsDirectory").mockReturnValueOnce(fakeJob);
        expect(await JobFSProvider.instance.readDirectory(testUris.job)).toStrictEqual([
            [FsJobsUtils.buildUniqueSpoolName(fakeSpool), FileType.File],
            [FsJobsUtils.buildUniqueSpoolName(fakeSpool2), FileType.File],
        ]);
        expect(lookupAsDirMock).toHaveBeenCalledWith(testUris.job, false);
        expect(mockJesApi.getSpoolFiles).toHaveBeenCalledWith(testEntries.job.job?.jobname, testEntries.job.job?.jobid);
        jesApiMock.mockRestore();
    });

    it("throws error when API error occurs", async () => {
        const mockJesApi = {
            getSpoolFiles: jest.fn().mockRejectedValue(new Error("Failed to fetch spools")),
        };
        const jesApiMock = jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValueOnce(mockJesApi as any);
        const fakeJob = new JobEntry(testEntries.job.name);
        fakeJob.job = testEntries.job.job;
        const _handleErrorMock = jest.spyOn(JobFSProvider.instance as any, "_handleError").mockImplementation();
        const lookupAsDirMock = jest.spyOn(JobFSProvider.instance as any, "_lookupAsDirectory").mockReturnValueOnce(fakeJob);
        await expect(JobFSProvider.instance.readDirectory(testUris.job)).rejects.toThrow();
        expect(lookupAsDirMock).toHaveBeenCalledWith(testUris.job, false);
        expect(mockJesApi.getSpoolFiles).toHaveBeenCalledWith(testEntries.job.job?.jobname, testEntries.job.job?.jobid);
        expect(_handleErrorMock).toHaveBeenCalled();
        jesApiMock.mockRestore();
        _handleErrorMock.mockRestore();
    });
});

describe("updateFilterForUri", () => {
    it("updates the session entry with the given filter", () => {
        const sessionEntry = { ...testEntries.session };
        const newFilter = {
            owner: "TESTUSER",
            prefix: "JOB*",
            searchId: "",
            status: "ACTIVE",
        };
        const lookupAsDirMock = jest.spyOn(JobFSProvider.instance as any, "_lookupAsDirectory").mockReturnValueOnce(sessionEntry);
        JobFSProvider.instance.updateFilterForUri(testUris.session, newFilter);
        expect(sessionEntry.filter).toStrictEqual(newFilter);
        lookupAsDirMock.mockRestore();
    });
});

describe("createDirectory", () => {
    it("creates a directory for a session entry", () => {
        const fakeRoot = { ...(JobFSProvider.instance as any).root };
        const rootMock = new MockedProperty(JobFSProvider.instance, "root", undefined, fakeRoot);
        JobFSProvider.instance.createDirectory(testUris.session);
        expect(fakeRoot.entries.has("sestest")).toBe(true);
        rootMock[Symbol.dispose]();
    });

    it("creates a directory for a job entry", () => {
        const fakeSessionEntry = new FilterEntry("sestest");
        fakeSessionEntry.metadata = testEntries.session.metadata;
        jest.spyOn(JobFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(fakeSessionEntry);
        JobFSProvider.instance.createDirectory(testUris.job);
        expect(fakeSessionEntry.entries.has("TESTJOB(JOB1234) - ACTIVE")).toBe(true);
    });
});

describe("fetchSpoolAtUri", () => {
    it("fetches the spool contents for a given URI", async () => {
        const lookupAsFileMock = jest
            .spyOn(JobFSProvider.instance as any, "_lookupAsFile")
            .mockReturnValueOnce({ ...testEntries.spool, data: new Uint8Array() });
        const newData = "spool contents";
        const mockJesApi = {
            downloadSingleSpool: jest.fn((opts) => {
                opts.stream.write(newData);
            }),
        };
        const jesApiMock = jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValueOnce(mockJesApi as any);
        const entry = await JobFSProvider.instance.fetchSpoolAtUri(testUris.spool);
        expect(mockJesApi.downloadSingleSpool).toHaveBeenCalled();
        expect(entry.data.toString()).toStrictEqual(newData.toString());
        jesApiMock.mockRestore();
        lookupAsFileMock.mockRestore();
    });
});

describe("readFile", () => {
    it("returns data for the spool file", async () => {
        const spoolEntry = { ...testEntries.spool };
        const lookupAsFileMock = jest.spyOn(JobFSProvider.instance as any, "_lookupAsFile").mockReturnValueOnce(spoolEntry);
        const fetchSpoolAtUriMock = jest.spyOn(JobFSProvider.instance, "fetchSpoolAtUri").mockResolvedValueOnce(spoolEntry);
        expect(await JobFSProvider.instance.readFile(testUris.spool)).toBe(spoolEntry.data);
        expect(spoolEntry.wasAccessed).toBe(true);
        lookupAsFileMock.mockRestore();
        fetchSpoolAtUriMock.mockRestore();
    });
    it("throws error if an error occurred while fetching spool", async () => {
        const spoolEntry = { ...testEntries.spool };
        const lookupAsFileMock = jest.spyOn(JobFSProvider.instance as any, "_lookupAsFile").mockReturnValueOnce(spoolEntry);
        const _handleErrorMock = jest.spyOn(JobFSProvider.instance as any, "_handleError").mockImplementation();
        const fetchSpoolAtUriMock = jest
            .spyOn(JobFSProvider.instance, "fetchSpoolAtUri")
            .mockRejectedValueOnce(new Error("Failed to fetch contents for spool"));
        await expect(JobFSProvider.instance.readFile(testUris.spool)).rejects.toThrow();
        expect(_handleErrorMock).toHaveBeenCalled();
        _handleErrorMock.mockRestore();
        lookupAsFileMock.mockRestore();
        fetchSpoolAtUriMock.mockRestore();
    });
});

describe("writeFile", () => {
    it("adds a spool entry to the FSP", () => {
        const jobEntry = {
            ...testEntries.job,
            entries: new Map(),
            metadata: testEntries.job.metadata,
        };
        const lookupParentDirMock = jest.spyOn(JobFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(jobEntry);
        const newContents = new Uint8Array([3, 6, 9]);
        JobFSProvider.instance.writeFile(testUris.spool, newContents, { create: true, overwrite: false });

        expect(lookupParentDirMock).toHaveBeenCalledWith(testUris.spool);
        const spoolEntry = jobEntry.entries.get("JES2.JESMSGLG.2")!;
        expect(spoolEntry.data).toBe(newContents);
    });

    it("updates a spool entry in the FSP", () => {
        const jobEntry = {
            ...testEntries.job,
            entries: new Map([[testEntries.spool.name, { ...testEntries.spool }]]),
        };
        const lookupParentDirMock = jest.spyOn(JobFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(jobEntry);
        const newContents = new Uint8Array([3, 6, 9]);
        JobFSProvider.instance.writeFile(testUris.spool, newContents, { create: false, overwrite: true });

        expect(lookupParentDirMock).toHaveBeenCalledWith(testUris.spool);
        const spoolEntry = jobEntry.entries.get("JES2.JESMSGLG.2")!;
        expect(spoolEntry.data).toBe(newContents);
    });

    it("updates an empty, unaccessed spool entry in the FSP without sending data", () => {
        const jobEntry = {
            ...testEntries.job,
            entries: new Map([[testEntries.spool.name, { ...testEntries.spool, wasAccessed: false }]]),
        };
        const lookupParentDirMock = jest.spyOn(JobFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(jobEntry);
        const newContents = new Uint8Array([]);
        JobFSProvider.instance.writeFile(testUris.spool, newContents, { create: false, overwrite: true });

        expect(lookupParentDirMock).toHaveBeenCalledWith(testUris.spool);
        const spoolEntry = jobEntry.entries.get("JES2.JESMSGLG.2")!;
        expect(spoolEntry.data.length).toBe(0);
    });

    it("throws an error if entry doesn't exist and 'create' option is false", () => {
        let err;
        try {
            JobFSProvider.instance.writeFile(testUris.spool, new Uint8Array([]), { create: false, overwrite: true });
        } catch (error) {
            err = error;
            expect(err.code).toBe("FileNotFound");
        }
        expect(err).toBeDefined();
    });

    it("throws an error if the entry exists, 'create' opt is true and 'overwrite' opt is false", () => {
        const jobEntry = {
            ...testEntries.job,
            entries: new Map([[testEntries.spool.name, { ...testEntries.spool, wasAccessed: false }]]),
        };
        const lookupParentDirMock = jest.spyOn(JobFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(jobEntry);
        let err;
        try {
            JobFSProvider.instance.writeFile(testUris.spool, new Uint8Array([]), { create: true, overwrite: false });
        } catch (error) {
            err = error;
            expect(err.code).toBe("FileExists");
        }
        expect(err).toBeDefined();
        lookupParentDirMock.mockRestore();
    });
});

describe("delete", () => {
    it("deletes a job from the FSP and remote file system", async () => {
        const mockUssApi = {
            deleteJob: jest.fn(),
        };
        const ussApiMock = jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValueOnce(mockUssApi as any);
        const fakeJob = new JobEntry(testEntries.job.name);
        fakeJob.job = testEntries.job.job;
        const lookupMock = jest.spyOn(JobFSProvider.instance as any, "lookup").mockReturnValueOnce(fakeJob);
        const lookupParentDirMock = jest
            .spyOn(JobFSProvider.instance as any, "_lookupParentDirectory")
            .mockReturnValueOnce({ ...testEntries.session });
        await JobFSProvider.instance.delete(testUris.job, { recursive: true, deleteRemote: true });
        const jobInfo = testEntries.job.job;
        expect(jobInfo).not.toBeUndefined();
        expect(mockUssApi.deleteJob).toHaveBeenCalledWith(jobInfo?.jobname || "TESTJOB", jobInfo?.jobid || "JOB12345");
        ussApiMock.mockRestore();
        lookupMock.mockRestore();
        lookupParentDirMock.mockRestore();
    });
    it("throws an error if an API error occurs during deletion", async () => {
        const mockUssApi = {
            deleteJob: jest.fn().mockRejectedValue(new Error("Failed to delete job")),
        };
        const ussApiMock = jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValueOnce(mockUssApi as any);
        const fakeJob = new JobEntry(testEntries.job.name);
        fakeJob.job = testEntries.job.job;
        const lookupMock = jest.spyOn(JobFSProvider.instance as any, "lookup").mockReturnValueOnce(fakeJob);
        const lookupParentDirMock = jest
            .spyOn(JobFSProvider.instance as any, "_lookupParentDirectory")
            .mockReturnValueOnce({ ...testEntries.session });
        await expect(JobFSProvider.instance.delete(testUris.job, { recursive: true, deleteRemote: true })).rejects.toThrow();
        const jobInfo = testEntries.job.job;
        expect(jobInfo).not.toBeUndefined();
        expect(mockUssApi.deleteJob).toHaveBeenCalledWith(jobInfo?.jobname || "TESTJOB", jobInfo?.jobid || "JOB12345");
        ussApiMock.mockRestore();
        lookupMock.mockRestore();
        lookupParentDirMock.mockRestore();
    });

    it("does not delete a spool from the FSP and remote file system", async () => {
        const mockUssApi = {
            deleteJob: jest.fn(),
        };
        const ussApiMock = jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValueOnce(mockUssApi as any);
        const fakeSpool = new SpoolEntry(testEntries.spool.name);
        fakeSpool.spool = testEntries.spool.spool;
        const fakeJob = new JobEntry(testEntries.job.name);
        fakeJob.job = testEntries.job.job;
        const lookupMock = jest.spyOn(JobFSProvider.instance as any, "lookup").mockReturnValueOnce(fakeSpool);
        const lookupParentDirMock = jest.spyOn(JobFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(fakeJob);
        await JobFSProvider.instance.delete(testUris.spool, { recursive: true, deleteRemote: true });
        expect(mockUssApi.deleteJob).not.toHaveBeenCalled();
        expect(lookupParentDirMock).not.toHaveBeenCalled();
        ussApiMock.mockRestore();
        lookupMock.mockRestore();
        lookupParentDirMock.mockRestore();
    });
});

describe("rename", () => {
    it("throws an error as renaming is not supported for jobs", async () => {
        await expect(async () =>
            JobFSProvider.instance.rename(testUris.job, testUris.job.with({ path: "/sestest/TESTJOB(JOB54321) - ACTIVE" }), {
                overwrite: true,
            })
        ).rejects.toThrow("Renaming is not supported for jobs.");
    });
});

describe("_getInfoFromUri", () => {
    it("removes session segment from path", () => {
        expect((JobFSProvider.instance as any)._getInfoFromUri(testUris.job)).toStrictEqual({
            profile: null,
            path: "/TESTJOB(JOB1234) - ACTIVE",
        });
    });
});
