import { FileType, Uri } from "vscode";
import { JobFSProvider } from "../../../../src/job/JobFSProvider";
import { DirEntry, JobEntry, SpoolEntry } from "@zowe/zowe-explorer-api";
import { MockedProperty } from "../../../../__mocks__/mockUtils";

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
    spool: {} as SpoolEntry,
    session: {
        name: "sestest",
    } as DirEntry,
};

xdescribe("watch", () => {});
xdescribe("stat", () => {});
xdescribe("readDirectory", () => {});
xdescribe("updateFilterForUri", () => {});
xdescribe("createDirectory", () => {});
xdescribe("fetchSpoolAtUri", () => {});
xdescribe("readFile", () => {});
xdescribe("writeFile", () => {});
xdescribe("delete", () => {
    it("deletes a job from the FSP and remote file system", async () => {
        const lookupMock = jest.spyOn(JobFSProvider.prototype as any, "_lookup").mockReturnValueOnce({ ...testEntries.job });
        const lookupParentDirMock = jest
            .spyOn(JobFSProvider.prototype as any, "_lookupParentDirectory")
            .mockReturnValueOnce({ ...testEntries.session });
        await JobFSProvider.instance.delete(testUris.job, { recursive: true, deleteRemote: true });
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
