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

import { Disposable, FilePermission, FileSystemError, FileType, Uri } from "vscode";
import { JobFSProvider } from "../../../../src/job/JobFSProvider";
import { FilterEntry, JobEntry, SpoolEntry } from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "../../../../src/ZoweExplorerApiRegister";
import { createIProfile } from "../../../../__mocks__/mockCreators/shared";

const testProfile = createIProfile();

type TestUris = Record<string, Readonly<Uri>>;
const testUris: TestUris = {
    spool: Uri.from({ scheme: "zowe-jobs", path: "/sestest/TESTJOB(JOB12345) - ACTIVE/JES2.JESMSGLG.2" }),
    job: Uri.from({ scheme: "zowe-jobs", path: "/sestest/TESTJOB(JOB12345) - ACTIVE" }),
    session: Uri.from({ scheme: "zowe-jobs", path: "/sestest" }),
};

const testEntries = {
    job: {
        name: "TESTJOB(JOB12345) - ACTIVE",
        job: {
            jobid: "JOB12345",
            jobname: "TESTJOB",
        },
        type: FileType.Directory,
    } as JobEntry,
    spool: {
        data: new Uint8Array([1, 2, 3]),
        name: "JES2.JESMSGLG.2",
        wasAccessed: false,
        metadata: {
            profile: testProfile,
        },
        spool: {
            id: "SOMEID",
        } as any,
    } as SpoolEntry,
    session: {
        name: "sestest",
        filter: {
            searchId: "",
            owner: "",
            status: "",
            prefix: "",
        },
    } as unknown as FilterEntry,
};

describe("watch", () => {
    it("returns an empty Disposable object", () => {
        expect(JobFSProvider.instance.watch(testUris.job, { recursive: false, excludes: [] })).toStrictEqual(new Disposable(() => {}));
    });
});
describe("stat", () => {
    it("returns a spool entry as read-only", () => {
        const lookupMock = jest.spyOn(JobFSProvider.instance as any, "_lookup").mockReturnValueOnce(testEntries.spool);
        expect(JobFSProvider.instance.stat(testUris.spool)).toStrictEqual({
            ...testEntries.spool,
            permissions: FilePermission.Readonly,
        });
    });

    it("returns a job entry", () => {
        const lookupMock = jest.spyOn(JobFSProvider.instance as any, "_lookup").mockReturnValueOnce(testEntries.job);
        expect(JobFSProvider.instance.stat(testUris.spool)).toStrictEqual({
            ...testEntries.job,
        });
    });
});
xdescribe("readDirectory", () => {});
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
    });
});

xdescribe("createDirectory", () => {});
describe("fetchSpoolAtUri", () => {
    it("fetches the spool contents for a given URI", async () => {
        const lookupAsFileMock = jest
            .spyOn(JobFSProvider.instance as any, "_lookupAsFile")
            .mockResolvedValueOnce({ ...testEntries.spool, data: new Uint8Array() });
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
    });
});

describe("readFile", () => {
    it("returns data for the spool file", async () => {
        const spoolEntry = { ...testEntries.spool };
        const lookupAsFileMock = jest.spyOn(JobFSProvider.instance as any, "_lookupAsFile").mockResolvedValueOnce(spoolEntry);
        const fetchSpoolAtUriMock = jest.spyOn(JobFSProvider.instance, "fetchSpoolAtUri").mockResolvedValueOnce(spoolEntry);
        expect(await JobFSProvider.instance.readFile(testUris.spool)).toBe(spoolEntry.data);
        expect(spoolEntry.wasAccessed).toBe(true);
        lookupAsFileMock.mockRestore();
        fetchSpoolAtUriMock.mockRestore();
    });
});

describe("writeFile", () => {
    it("updates a spool entry in the FSP", async () => {
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

    it("updates an empty, unaccessed spool entry in the FSP without sending data", async () => {
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
        try {
            JobFSProvider.instance.writeFile(testUris.spool, new Uint8Array([]), { create: false, overwrite: true });
            fail("writeFile should throw when the entry doesn't exist and 'create' option is false");
        } catch (err) {
            expect(err).toBeInstanceOf(FileSystemError);
            expect(err.message).toBe("file not found");
        }
    });

    it("throws an error if the entry exists, 'create' opt is true and 'overwrite' opt is false", () => {
        const jobEntry = {
            ...testEntries.job,
            entries: new Map([[testEntries.spool.name, { ...testEntries.spool, wasAccessed: false }]]),
        };
        const lookupParentDirMock = jest.spyOn(JobFSProvider.instance as any, "_lookupParentDirectory").mockReturnValueOnce(jobEntry);
        try {
            JobFSProvider.instance.writeFile(testUris.spool, new Uint8Array([]), { create: true, overwrite: false });
            fail("writeFile should throw when the entry exists, 'create' opt is true and 'overwrite' opt is false");
        } catch (err) {
            expect(err).toBeInstanceOf(FileSystemError);
            expect(err.message).toBe("file exists");
        }
        lookupParentDirMock.mockRestore();
    });
});

describe("delete", () => {
    it("deletes a job from the FSP and remote file system", async () => {
        const mockUssApi = {
            deleteJob: jest.fn(),
        };
        const ussApiMock = jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValueOnce(mockUssApi as any);
        const lookupMock = jest.spyOn(JobFSProvider.prototype as any, "_lookup").mockReturnValueOnce({ ...testEntries.job });
        const lookupParentDirMock = jest
            .spyOn(JobFSProvider.prototype as any, "_lookupParentDirectory")
            .mockReturnValueOnce({ ...testEntries.session });
        await JobFSProvider.instance.delete(testUris.job, { recursive: true, deleteRemote: true });
        expect(mockUssApi.deleteJob).toHaveBeenCalledWith(testEntries.job.job!.jobname, testEntries.job.job!.jobid);
        ussApiMock.mockRestore();
        lookupMock.mockRestore();
        lookupParentDirMock.mockRestore();
    });

    it("does not delete a spool from the FSP and remote file system", async () => {
        const mockUssApi = {
            deleteJob: jest.fn(),
        };
        const ussApiMock = jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValueOnce(mockUssApi as any);
        const lookupMock = jest.spyOn(JobFSProvider.prototype as any, "_lookup").mockReturnValueOnce({ ...testEntries.spool });
        const lookupParentDirMock = jest.spyOn(JobFSProvider.prototype as any, "_lookupParentDirectory").mockReturnValueOnce({ ...testEntries.job });
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
        try {
            await JobFSProvider.instance.rename(testUris.job, testUris.job.with({ path: "/sestest/TESTJOB(JOB54321) - ACTIVE" }), {
                overwrite: true,
            });
            fail("rename should throw an error as it is not supported for jobs");
        } catch (err) {
            expect(err.message).toBe("Renaming is not supported for jobs.");
        }
    });
});

describe("_getInfoFromUri", () => {
    it("removes session segment from path", () => {
        expect((JobFSProvider.instance as any)._getInfoFromUri(testUris.job)).toStrictEqual({
            profile: null,
            path: "/TESTJOB(JOB12345) - ACTIVE",
        });
    });
});
