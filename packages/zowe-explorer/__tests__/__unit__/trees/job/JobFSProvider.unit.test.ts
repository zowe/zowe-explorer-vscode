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
import {
    FsJobsUtils,
    FilterEntry,
    Gui,
    JobEntry,
    SpoolEntry,
    ZoweScheme,
    AuthHandler,
    FsAbstractUtils,
    imperative,
    MainframeInteraction,
} from "@zowe/zowe-explorer-api";
import { createIProfile } from "../../../__mocks__/mockCreators/shared";
import { createIJobFile, createIJobObject } from "../../../__mocks__/mockCreators/jobs";
import { ZoweExplorerApiRegister } from "../../../../src/extending/ZoweExplorerApiRegister";
import { JobFSProvider } from "../../../../src/trees/job/JobFSProvider";
import { MockedProperty } from "../../../__mocks__/mockUtils";
import { AuthUtils } from "../../../../src/utils/AuthUtils";
import { Profiles } from "../../../../src/configuration/Profiles";
import * as vscode from "vscode";
import { SettingsConfig } from "../../../../src/configuration/SettingsConfig";

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
        spool: createIJobFile(),
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
        expect(JobFSProvider.instance.watch(testUris.job, { recursive: false, excludes: [] })).toBeInstanceOf(Disposable);
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
        const reauthenticateIfCancelledMock = jest.spyOn(AuthUtils, "reauthenticateIfCancelled").mockResolvedValueOnce(undefined);
        const waitForUnlockMock = jest.spyOn(AuthHandler, "waitForUnlock").mockResolvedValueOnce(undefined);
        const getInfoForUriMock = jest.spyOn(FsAbstractUtils, "getInfoForUri").mockReturnValueOnce({
            profile: testProfile,
            isRoot: false,
            slashAfterProfilePos: testUris.session.path.indexOf("/", 1),
            profileName: "sestest",
        });
        const jesApiMock = jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValueOnce(mockJesApi as any);
        const filterEntry: FilterEntry = { ...testEntries.session };
        filterEntry.filter["owner"] = "USER";
        filterEntry.filter["prefix"] = "JOB*";
        filterEntry.filter["status"] = "*";
        const lookupAsDirMock = jest.spyOn(JobFSProvider.instance as any, "_lookupAsDirectory").mockReturnValueOnce(filterEntry);
        expect(await JobFSProvider.instance.readDirectory(testUris.session)).toStrictEqual([
            ["JOB1234", FileType.Directory],
            ["JOB3456", FileType.Directory],
        ]);
        expect(lookupAsDirMock).toHaveBeenCalledWith(testUris.session, false);
        expect(getInfoForUriMock.mock.calls[0][0]).toBe(testUris.session);
        expect(reauthenticateIfCancelledMock).toHaveBeenCalledTimes(1);
        expect(reauthenticateIfCancelledMock).toHaveBeenCalledWith(testProfile);
        expect(waitForUnlockMock).toHaveBeenCalledTimes(1);
        expect(waitForUnlockMock).toHaveBeenCalledWith(testProfile, false);
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
        const reauthenticateIfCancelledMock = jest.spyOn(AuthUtils, "reauthenticateIfCancelled").mockClear().mockResolvedValueOnce(undefined);
        const waitForUnlockMock = jest.spyOn(AuthHandler, "waitForUnlock").mockClear().mockResolvedValueOnce(undefined);
        const jesApiMock = jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValueOnce(mockJesApi as any);
        const fakeJob = new JobEntry(testEntries.job.name);
        fakeJob.job = testEntries.job.job;
        fakeJob.metadata = {
            profile: testProfile,
            path: testEntries.job.metadata.path,
        };
        const getInfoForUriMock = jest
            .spyOn(FsAbstractUtils, "getInfoForUri")
            .mockReset()
            .mockReturnValueOnce({
                profile: testProfile,
                isRoot: false,
                slashAfterProfilePos: testUris.job.path.indexOf("/", 1),
                profileName: "sestest",
            });
        const lookupAsDirMock = jest.spyOn(JobFSProvider.instance as any, "_lookupAsDirectory").mockReturnValueOnce(fakeJob);
        expect(await JobFSProvider.instance.readDirectory(testUris.job)).toStrictEqual([
            [FsJobsUtils.buildUniqueSpoolName(fakeSpool), FileType.File],
            [FsJobsUtils.buildUniqueSpoolName(fakeSpool2), FileType.File],
        ]);
        expect(getInfoForUriMock.mock.calls[0][0]).toBe(testUris.job);
        expect(lookupAsDirMock).toHaveBeenCalledWith(testUris.job, false);
        expect(reauthenticateIfCancelledMock).toHaveBeenCalledTimes(1);
        expect(reauthenticateIfCancelledMock).toHaveBeenCalledWith(testProfile);
        expect(waitForUnlockMock).toHaveBeenCalledTimes(1);
        expect(waitForUnlockMock).toHaveBeenCalledWith(testProfile, false);
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
        const getInfoForUriMock = jest.spyOn(FsAbstractUtils, "getInfoForUri").mockReturnValueOnce({
            profile: testProfile,
            isRoot: false,
            slashAfterProfilePos: testUris.job.path.indexOf("/", 1),
            profileName: "sestest",
        });
        const lookupAsDirMock = jest.spyOn(JobFSProvider.instance as any, "_lookupAsDirectory").mockReturnValueOnce(fakeJob);
        const reauthenticateIfCancelledMock = jest.spyOn(AuthUtils, "reauthenticateIfCancelled").mockClear().mockResolvedValueOnce(undefined);
        const waitForUnlockMock = jest.spyOn(AuthHandler, "waitForUnlock").mockClear().mockResolvedValueOnce(undefined);
        await expect(JobFSProvider.instance.readDirectory(testUris.job)).rejects.toThrow();
        expect(lookupAsDirMock).toHaveBeenCalledWith(testUris.job, false);
        expect(mockJesApi.getSpoolFiles).toHaveBeenCalledWith(testEntries.job.job?.jobname, testEntries.job.job?.jobid);
        expect(_handleErrorMock).toHaveBeenCalled();
        expect(reauthenticateIfCancelledMock).toHaveBeenCalledTimes(1);
        expect(reauthenticateIfCancelledMock).toHaveBeenCalledWith(testProfile);
        expect(getInfoForUriMock.mock.calls[0][0]).toBe(testUris.job);
        expect(waitForUnlockMock).toHaveBeenCalledTimes(1);
        expect(waitForUnlockMock).toHaveBeenCalledWith(testProfile, false);
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
        const getInfoForUriMock = jest
            .spyOn(FsAbstractUtils, "getInfoForUri")
            .mockClear()
            .mockReturnValueOnce({
                profile: testProfile,
                isRoot: false,
                slashAfterProfilePos: testUris.session.path.indexOf("/", 1),
                profileName: "sestest",
            });
        JobFSProvider.instance.createDirectory(testUris.session);
        expect(fakeRoot.entries.has("sestest")).toBe(true);
        expect(getInfoForUriMock.mock.calls[0][0]).toBe(testUris.session);
        rootMock[Symbol.dispose]();
    });

    it("creates a directory for a job entry", () => {
        const fakeSessionEntry = new FilterEntry("sestest");
        fakeSessionEntry.metadata = testEntries.session.metadata;
        jest.spyOn(JobFSProvider.instance as any, "lookupParentDirectory").mockReturnValueOnce(fakeSessionEntry);
        JobFSProvider.instance.createDirectory(testUris.job);
        expect(fakeSessionEntry.entries.has("TESTJOB(JOB1234) - ACTIVE")).toBe(true);
    });
});

describe("JobFSProvider.supportSpoolPagination", () => {
    const mockDoc = {
        uri: vscode.Uri.parse("zowe://test"),
    } as vscode.TextDocument;

    const profInfo = { profile: testProfile };

    beforeEach(() => {
        jest.restoreAllMocks();
    });

    it("should return true when supportSpoolPagination is true", () => {
        jest.spyOn(JobFSProvider.instance as any, "_getInfoFromUri").mockReturnValueOnce(profInfo);

        jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValue({
            supportSpoolPagination: () => true,
        } as any);
        jest.spyOn(SettingsConfig, "getDirectValue").mockImplementation((key) => {
            if (key === "zowe.jobs.paginate.enabled") {
                return true;
            }
            if (key === "zowe.settings.maxRequestRetry") {
                return 1;
            }
        });

        const result = JobFSProvider.instance.supportSpoolPagination(mockDoc);
        expect(result).toBe(true);
    });

    it("should return false when supportSpoolPagination is false", () => {
        jest.spyOn(JobFSProvider.instance as any, "_getInfoFromUri").mockReturnValueOnce(profInfo);

        jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValue({
            supportSpoolPagination: () => false,
        } as any);
        jest.spyOn(SettingsConfig, "getDirectValue").mockImplementation((key) => {
            if (key === "zowe.jobs.paginate.enabled") {
                return false;
            }
            if (key === "zowe.settings.maxRequestRetry") {
                return 1;
            }
        });

        const result = JobFSProvider.instance.supportSpoolPagination(mockDoc);
        expect(result).toBe(false);
    });
    it("should return false when supportSpoolPagination is undefined", () => {
        jest.spyOn(JobFSProvider.instance as any, "_getInfoFromUri").mockReturnValueOnce(profInfo);

        jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValue({} as any);

        const result = JobFSProvider.instance.supportSpoolPagination(mockDoc);
        expect(result).toBe(undefined);
    });
    it("should return false when getJesApi throws an error", () => {
        jest.spyOn(JobFSProvider.instance as any, "_getInfoFromUri").mockReturnValueOnce(profInfo);

        jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockImplementation(() => {
            throw new Error("Failed to get JES API");
        });

        const result = JobFSProvider.instance.supportSpoolPagination(mockDoc);
        expect(result).toBe(false);
    });
});

describe("fetchSpoolAtUri", () => {
    const loadNamedProfileMock = jest.fn().mockReturnValue(testProfile);
    beforeEach(() => {
        jest.spyOn(Profiles, "getInstance").mockReturnValue({ loadNamedProfile: loadNamedProfileMock } as any);
    });
    afterAll(() => {
        jest.restoreAllMocks();
    });

    it("fetches spool contents and correctly applies recordRange parameters", async () => {
        const lookupAsFileMock = jest
            .spyOn(JobFSProvider.instance as any, "_lookupAsFile")
            .mockReturnValueOnce({ ...testEntries.spool, data: new Uint8Array() });

        const newData = "spool contents";

        jest.spyOn(SettingsConfig, "getDirectValue").mockImplementation((key) => {
            if (key === "zowe.jobs.paginate.enabled") {
                return true;
            }
            if (key === "zowe.settings.maxRequestRetry") {
                return 1;
            }
            return false;
        });
        const mockJesApi = {
            supportSpoolPagination: () => true,
            downloadSingleSpool: jest.fn((opts) => {
                expect(SettingsConfig.getDirectValue("zowe.jobs.paginate.enabled")).toBe(true);
                expect(opts.recordRange).toBe("10-50");
                opts.stream.write(newData);
            }),
        };

        const jesApiMock = jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValueOnce(mockJesApi as any);

        const uriWithQuery = vscode.Uri.parse(testUris.spool.toString() + "?startLine=10&endLine=50");

        const entry = await JobFSProvider.instance.fetchSpoolAtUri(uriWithQuery);

        expect(mockJesApi.downloadSingleSpool).toHaveBeenCalled();
        expect(entry.data.toString()).toStrictEqual(newData.toString());

        jesApiMock.mockRestore();
        lookupAsFileMock.mockRestore();
    });

    it("fetches spool contents and correctly applies recordRange parameters", async () => {
        const lookupAsFileMock = jest
            .spyOn(JobFSProvider.instance as any, "_lookupAsFile")
            .mockReturnValueOnce({ ...testEntries.spool, data: new Uint8Array() });

        const newData = "spool contents";

        jest.spyOn(SettingsConfig, "getDirectValue").mockImplementation((key) => {
            if (key === "zowe.jobs.paginate.enabled") {
                return true;
            }
            if (key === "zowe.jobs.paginate.recordsToFetch") {
                return 20;
            }
            if (key === "zowe.settings.maxRequestRetry") {
                return 1;
            }
        });
        const mockJesApi = {
            supportSpoolPagination: () => true,
            downloadSingleSpool: jest.fn((opts) => {
                expect(SettingsConfig.getDirectValue("zowe.jobs.paginate.enabled")).toBe(true);
                expect(opts.recordRange).toBe("19-38");
                opts.stream.write(newData);
            }),
        };

        const jesApiMock = jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValueOnce(mockJesApi as any);

        const uriWithQuery = vscode.Uri.parse(testUris.spool.toString() + "?startLine=19");

        const entry = await JobFSProvider.instance.fetchSpoolAtUri(uriWithQuery);

        expect(mockJesApi.downloadSingleSpool).toHaveBeenCalled();
        expect(entry.data.toString()).toStrictEqual(newData.toString());

        jesApiMock.mockRestore();
        lookupAsFileMock.mockRestore();
    });

    it("fetches spool contents when recordRange parameters is not supported", async () => {
        const lookupAsFileMock = jest
            .spyOn(JobFSProvider.instance as any, "_lookupAsFile")
            .mockReturnValueOnce({ ...testEntries.spool, data: new Uint8Array() });

        const newData = "spool contents";

        jest.spyOn(SettingsConfig, "getDirectValue").mockImplementation((key) => {
            if (key === "zowe.jobs.paginate.enabled") {
                return false;
            }
            return true;
        });
        const mockJesApi = {
            supportSpoolPagination: () => false,
            downloadSingleSpool: jest.fn((opts) => {
                expect(SettingsConfig.getDirectValue("zowe.jobs.paginate.enabled")).toBe(false);
                expect(opts.recordRange).toBeUndefined();
                opts.stream.write(newData);
            }),
        };

        const jesApiMock = jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValueOnce(mockJesApi as any);

        const uriWithQuery = vscode.Uri.parse(testUris.spool.toString() + "?startLine=10&endLine=50");

        const entry = await JobFSProvider.instance.fetchSpoolAtUri(uriWithQuery);

        expect(mockJesApi.downloadSingleSpool).toHaveBeenCalled();
        expect(entry.data.toString()).toStrictEqual(newData.toString());

        jesApiMock.mockRestore();
        lookupAsFileMock.mockRestore();
    });

    it("fetches default when recordRange parameters is not provided", async () => {
        const defaultFetchSetting = 100;

        const lookupAsFileMock = jest
            .spyOn(JobFSProvider.instance as any, "_lookupAsFile")
            .mockReturnValueOnce({ ...testEntries.spool, dsata: new Uint8Array() });

        jest.spyOn(SettingsConfig, "getDirectValue").mockImplementation((key) => {
            if (key === "zowe.jobs.paginate.recordsToFetch") {
                return defaultFetchSetting;
            }
            if (key === "zowe.jobs.paginate.enabled") {
                return true;
            }
            if (key === "zowe.settings.maxRequestRetry") {
                return 1;
            }
        });

        const downloadMock = jest.fn((opts) => {
            expect(SettingsConfig.getDirectValue("zowe.jobs.paginate.enabled")).toBe(true);
            expect(opts.recordRange).toBe(`0-${defaultFetchSetting - 1}`);
            opts.stream.write("test data");
        });
        const mockJesApi = {
            downloadSingleSpool: downloadMock,
            supportSpoolPagination: () => true,
        };

        const jesApiMock = jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValueOnce(mockJesApi as any);

        const uriWithQuery = vscode.Uri.parse(testUris.spool.toString());

        const entry = await JobFSProvider.instance.fetchSpoolAtUri(uriWithQuery);
        expect(downloadMock).toHaveBeenCalled();
        expect(mockJesApi.downloadSingleSpool).toHaveBeenCalled();
        expect(entry.data.toString()).toBe("test data");

        jesApiMock.mockRestore();
        lookupAsFileMock.mockRestore();
    });

    it("fetches the spool contents for a given URI - downloadSingleSpool", async () => {
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

    it("fetches the spool contents for a given URI - downloadSingleSpool w/ binary encoding", async () => {
        const lookupAsFileMock = jest
            .spyOn(JobFSProvider.instance as any, "_lookupAsFile")
            .mockReturnValueOnce({ ...testEntries.spool, data: new Uint8Array(), encoding: { kind: "binary" } });
        const newData = "spool contents";
        const mockJesApi = {
            downloadSingleSpool: jest.fn((opts) => {
                opts.stream.write(newData);
            }),
        };
        const jesApiMock = jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValueOnce(mockJesApi as any);
        const entry = await JobFSProvider.instance.fetchSpoolAtUri(testUris.spool);
        expect(mockJesApi.downloadSingleSpool).toHaveBeenCalledWith(expect.objectContaining({ jobFile: testEntries.spool.spool, binary: true }));
        expect(entry.data.toString()).toStrictEqual(newData.toString());
        jesApiMock.mockRestore();
        lookupAsFileMock.mockRestore();
    });

    it("fetches the spool contents for a given URI - downloadSingleSpool w/ other encoding", async () => {
        const lookupAsFileMock = jest
            .spyOn(JobFSProvider.instance as any, "_lookupAsFile")
            .mockReturnValueOnce({ ...testEntries.spool, data: new Uint8Array(), encoding: { kind: "other", codepage: "IBM-1147" } });
        const newData = "spool contents";
        const mockJesApi = {
            downloadSingleSpool: jest.fn((opts) => {
                opts.stream.write(newData);
            }),
        };
        const jesApiMock = jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValueOnce(mockJesApi as any);
        const entry = await JobFSProvider.instance.fetchSpoolAtUri(testUris.spool);
        expect(mockJesApi.downloadSingleSpool).toHaveBeenCalledWith(
            expect.objectContaining({ jobFile: testEntries.spool.spool, encoding: "IBM-1147", binary: false })
        );
        expect(entry.data.toString()).toStrictEqual(newData.toString());
        jesApiMock.mockRestore();
        lookupAsFileMock.mockRestore();
    });

    it("fetches the spool contents for a given URI - downloadSingleSpool w/ profile encoding", async () => {
        const lookupAsFileMock = jest
            .spyOn(JobFSProvider.instance as any, "_lookupAsFile")
            .mockReturnValueOnce({ ...testEntries.spool, data: new Uint8Array() });
        loadNamedProfileMock.mockReturnValueOnce({ ...testProfile, profile: { ...testProfile.profile, encoding: "IBM-1147" } });
        const newData = "spool contents";
        const mockJesApi = {
            downloadSingleSpool: jest.fn((opts) => {
                opts.stream.write(newData);
            }),
        };
        const jesApiMock = jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValueOnce(mockJesApi as any);
        const entry = await JobFSProvider.instance.fetchSpoolAtUri(testUris.spool);
        expect(mockJesApi.downloadSingleSpool).toHaveBeenCalledWith(
            expect.objectContaining({ jobFile: testEntries.spool.spool, encoding: "IBM-1147", binary: false })
        );
        expect(entry.data.toString()).toStrictEqual(newData.toString());
        jesApiMock.mockRestore();
        lookupAsFileMock.mockRestore();
    });

    it("fetches the spool contents for a given URI - getSpoolContentById", async () => {
        const lookupAsFileMock = jest
            .spyOn(JobFSProvider.instance as any, "_lookupAsFile")
            .mockReturnValueOnce({ ...testEntries.spool, data: new Uint8Array() });
        const lookupParentDirMock = jest.spyOn(JobFSProvider.instance as any, "lookupParentDirectory").mockReturnValueOnce({ ...testEntries.job });
        const mockJesApi = {
            getSpoolContentById: jest.fn((opts) => {
                return "spool contents";
            }),
        };
        const jesApiMock = jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValueOnce(mockJesApi as any);
        const entry = await JobFSProvider.instance.fetchSpoolAtUri(testUris.spool);
        expect(lookupAsFileMock).toHaveBeenCalledWith(testUris.spool);
        expect(lookupParentDirMock).toHaveBeenCalledWith(testUris.spool);
        expect(mockJesApi.getSpoolContentById).toHaveBeenCalled();
        expect(entry.data.toString()).toStrictEqual("spool contents");
        jesApiMock.mockRestore();
        lookupAsFileMock.mockRestore();
    });

    it("fetches the spool contents for a given URI - getSpoolContentById w/ encoding", async () => {
        const lookupAsFileMock = jest
            .spyOn(JobFSProvider.instance as any, "_lookupAsFile")
            .mockReturnValueOnce({ ...testEntries.spool, data: new Uint8Array(), encoding: { kind: "other", codepage: "IBM-1147" } });
        const lookupParentDirMock = jest.spyOn(JobFSProvider.instance as any, "lookupParentDirectory").mockReturnValueOnce({ ...testEntries.job });
        const mockJesApi = {
            getSpoolContentById: jest.fn((opts) => {
                return "spool contents";
            }),
        };
        const jesApiMock = jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValueOnce(mockJesApi as any);
        const entry = await JobFSProvider.instance.fetchSpoolAtUri(testUris.spool);
        expect(lookupAsFileMock).toHaveBeenCalledWith(testUris.spool);
        expect(lookupParentDirMock).toHaveBeenCalledWith(testUris.spool);
        expect(mockJesApi.getSpoolContentById).toHaveBeenCalled();
        expect(mockJesApi.getSpoolContentById.mock.calls[0][3]).toBe("IBM-1147");
        expect(entry.data.toString()).toStrictEqual("spool contents");
        jesApiMock.mockRestore();
        lookupAsFileMock.mockRestore();
    });

    it("calls AuthUtils.promptForAuthError when an error occurs", async () => {
        const lookupAsFileMock = jest
            .spyOn(JobFSProvider.instance as any, "_lookupAsFile")
            .mockReturnValueOnce({ ...testEntries.spool, data: new Uint8Array() });
        const mockJesApi = {
            downloadSingleSpool: jest.fn((opts) => {
                throw new imperative.ImperativeError({
                    msg: "All configured authentication methods failed",
                });
            }),
        };
        const promptForAuthErrorMock = jest.spyOn(AuthUtils, "handleProfileAuthOnError").mockImplementation();
        const jesApiMock = jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValueOnce(mockJesApi as any);
        await expect(JobFSProvider.instance.fetchSpoolAtUri(testUris.spool)).rejects.toThrow();
        expect(promptForAuthErrorMock).toHaveBeenCalled();
        expect(lookupAsFileMock).toHaveBeenCalledWith(testUris.spool);
        expect(mockJesApi.downloadSingleSpool).toHaveBeenCalled();
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
        const fetchSpoolAtUriMock = jest
            .spyOn(JobFSProvider.instance, "fetchSpoolAtUri")
            .mockRejectedValueOnce(new Error("Failed to fetch contents for spool"));
        await expect(JobFSProvider.instance.readFile(testUris.spool)).rejects.toThrow();
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
        const lookupParentDirMock = jest.spyOn(JobFSProvider.instance as any, "lookupParentDirectory").mockReturnValueOnce(jobEntry);
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
        const lookupParentDirMock = jest.spyOn(JobFSProvider.instance as any, "lookupParentDirectory").mockReturnValueOnce(jobEntry);
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
        const lookupParentDirMock = jest.spyOn(JobFSProvider.instance as any, "lookupParentDirectory").mockReturnValueOnce(jobEntry);
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
        const lookupParentDirMock = jest.spyOn(JobFSProvider.instance as any, "lookupParentDirectory").mockReturnValueOnce(jobEntry);
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
    beforeAll(() => {
        AuthHandler.unlockAllProfiles();
    });

    it("deletes a job from the FSP and remote file system", async () => {
        const mockJesApi = {
            deleteJob: jest.fn(),
        };
        const ussApiMock = jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValueOnce(mockJesApi as any);
        const reauthenticateIfCancelledMock = jest.spyOn(AuthUtils, "reauthenticateIfCancelled").mockClear().mockResolvedValueOnce(undefined);
        const waitForUnlockMock = jest.spyOn(AuthHandler, "waitForUnlock").mockClear().mockResolvedValueOnce(undefined);
        const fakeJob = new JobEntry(testEntries.job.name);
        fakeJob.job = testEntries.job.job;
        fakeJob.metadata = {
            profile: testProfile,
            path: testEntries.job.metadata.path,
        };
        const lookupMock = jest.spyOn(JobFSProvider.instance as any, "lookup").mockReturnValueOnce(fakeJob);
        const lookupParentDirMock = jest
            .spyOn(JobFSProvider.instance as any, "lookupParentDirectory")
            .mockReturnValueOnce({ ...testEntries.session });
        const getInfoForUriMock = jest
            .spyOn(FsAbstractUtils, "getInfoForUri")
            .mockClear()
            .mockReturnValueOnce({
                profile: testProfile,
                isRoot: false,
                slashAfterProfilePos: testUris.job.path.indexOf("/", 1),
                profileName: "sestest",
            });
        await JobFSProvider.instance.delete(testUris.job, { recursive: true });
        const jobInfo = testEntries.job.job;
        expect(jobInfo).not.toBeUndefined();
        expect(mockJesApi.deleteJob).toHaveBeenCalledWith(jobInfo?.jobname || "TESTJOB", jobInfo?.jobid || "JOB12345");
        expect(reauthenticateIfCancelledMock).toHaveBeenCalledTimes(1);
        expect(reauthenticateIfCancelledMock).toHaveBeenCalledWith(testProfile);
        expect(waitForUnlockMock).toHaveBeenCalledTimes(1);
        expect(waitForUnlockMock).toHaveBeenCalledWith(testProfile, false);
        expect(getInfoForUriMock.mock.calls[0][0]).toBe(testUris.job);
        ussApiMock.mockRestore();
        lookupMock.mockRestore();
        lookupParentDirMock.mockRestore();
    });
    it("throws an error if an API error occurs during deletion", async () => {
        const mockJesApi = {
            deleteJob: jest.fn().mockRejectedValue(new Error("Failed to delete job")),
        };
        const jesApiMock = jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValueOnce(mockJesApi as unknown as MainframeInteraction.IJes);
        const fakeJob = new JobEntry(testEntries.job.name);
        fakeJob.job = testEntries.job.job;
        fakeJob.metadata = {
            profile: testProfile,
            path: testEntries.job.metadata.path,
        };
        const lookupMock = jest.spyOn(JobFSProvider.instance as any, "lookup").mockReturnValueOnce(fakeJob);
        const lookupParentDirMock = jest
            .spyOn(JobFSProvider.instance as any, "lookupParentDirectory")
            .mockReturnValueOnce({ ...testEntries.session });
        const getInfoForUriMock = jest
            .spyOn(FsAbstractUtils, "getInfoForUri")
            .mockClear()
            .mockReturnValueOnce({
                profile: testProfile,
                isRoot: false,
                slashAfterProfilePos: testUris.job.path.indexOf("/", 1),
                profileName: "sestest",
            });
        await expect(JobFSProvider.instance.delete(testUris.job, { recursive: true })).rejects.toThrow();
        const jobInfo = testEntries.job.job;
        expect(jobInfo).not.toBeUndefined();
        expect(mockJesApi.deleteJob).toHaveBeenCalledWith(jobInfo?.jobname || "TESTJOB", jobInfo?.jobid || "JOB12345");
        expect(getInfoForUriMock.mock.calls[0][0]).toBe(testUris.job);
        jesApiMock.mockRestore();
        lookupMock.mockRestore();
        lookupParentDirMock.mockRestore();
    });

    it("does not delete a spool from the FSP and remote file system", async () => {
        const mockJesApi = {
            deleteJob: jest.fn(),
        };
        const ussApiMock = jest.spyOn(ZoweExplorerApiRegister, "getJesApi").mockReturnValueOnce(mockJesApi as any);
        const fakeSpool = new SpoolEntry(testEntries.spool.name);
        fakeSpool.spool = testEntries.spool.spool;
        const fakeJob = new JobEntry(testEntries.job.name);
        fakeJob.job = testEntries.job.job;
        const lookupMock = jest.spyOn(JobFSProvider.instance as any, "lookup").mockReturnValueOnce(fakeSpool);
        const lookupParentDirMock = jest
            .spyOn(JobFSProvider.instance as any, "lookupParentDirectory")
            .mockClear()
            .mockReturnValueOnce(fakeJob);
        await JobFSProvider.instance.delete(testUris.spool, { recursive: true });
        expect(mockJesApi.deleteJob).not.toHaveBeenCalled();
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
