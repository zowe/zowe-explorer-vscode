import * as zowe from "@zowe/cli";
import { PROFILE_TYPE_ZOSMF, ZosmfCommandApi, ZosmfJesApi, ZosmfMvsApi, ZosmfUssApi } from "../../../src/profiles/ZoweExplorerZosmfApi";

interface ITestApi<T> {
    name: keyof T,
    spy: jest.SpyInstance,
    args: any[]  // eslint-disable-line @typescript-eslint/no-explicit-any
}

const fakeSession = zowe.imperative.Session.createFromUrl(new URL("https://example.com"));
const expectApiWithSession = async ({ name, spy, args }: ITestApi<T>): Promise<void> => {
    spy.mockResolvedValue(undefined).mockClear();
    const api = new T();
    const getSessionSpy = jest.spyOn(api, "getSession").mockReturnValue(fakeSession);
    await (api as any)[name](...args);
    expect(getSessionSpy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(fakeSession, ...args);
}

describe("ZosmfUssApi", () => {
    it("getProfileTypeName should get profile type name", () => {
        const zosmfApi = new ZosmfUssApi();
        expect(zosmfApi.getProfileTypeName()).toBe(PROFILE_TYPE_ZOSMF);
    });

    const ussApis: ITestApi<ZosmfUssApi>[] = [
        {
            name: "fileList",
            spy: jest.spyOn(zowe.List, "fileList"),
            args: ["ussPath"]
        },
        {
            name: "isFileTagBinOrAscii",
            spy: jest.spyOn(zowe.Utilities, "isFileTagBinOrAscii"),
            args: ["ussPath"]
        },
        {
            name: "getContents",
            spy: jest.spyOn(zowe.Download, "ussFile"),
            args: ["ussPath", {}]
        },
        {
            name: "putContent",
            spy: jest.spyOn(zowe.Upload, "fileToUssFile"),
            args: ["localPath", "ussPath", {}]
        },
        {
            name: "uploadDirectory",
            spy: jest.spyOn(zowe.Upload, "dirToUSSDirRecursive"),
            args: ["localPath", "ussPath", {}]
        },
        {
            name: "create",
            spy: jest.spyOn(zowe.Create, "uss"),
            args: ["ussPath", "file", "777"]
        },
        {
            name: "delete",
            spy: jest.spyOn(zowe.Delete, "ussFile"),
            args: ["ussPath", false]
        },
        {
            name: "rename",
            spy: jest.spyOn(zowe.Utilities, "renameUSSFile"),
            args: ["ussPath1", "ussPath2"]
        }
    ];
    ussApis.forEach(({ name, spy, args }) => {
        it(`${name} should inject session into Zowe API`, async () => {
            spy.mockResolvedValue(undefined).mockClear();
            const zosmfApi = new ZosmfUssApi();
            const getSessionSpy = jest.spyOn(zosmfApi, "getSession").mockReturnValue(fakeSession);
            await (zosmfApi as any)[name](...args);
            expect(getSessionSpy).toHaveBeenCalledTimes(1);
            expect(spy).toHaveBeenCalledWith(fakeSession, ...args);
        });
    });
});

describe("ZosmfMvsApi", () => {
    it("getProfileTypeName should get profile type name", () => {
        const zosmfApi = new ZosmfMvsApi();
        expect(zosmfApi.getProfileTypeName()).toBe(PROFILE_TYPE_ZOSMF);
    });

    const mvsApis: ITestApi<ZosmfMvsApi>[] = [
        {
            name: "dataSet",
            spy: jest.spyOn(zowe.List, "dataSet"),
            args: ["dsname", {}]
        },
        {
            name: "allMembers",
            spy: jest.spyOn(zowe.List, "allMembers"),
            args: ["dsname", {}]
        },
        {
            name: "getContents",
            spy: jest.spyOn(zowe.Download, "dataSet"),
            args: ["dsname", {}]
        },
        {
            name: "putContents",
            spy: jest.spyOn(zowe.Upload, "pathToDataSet"),
            args: ["localPath", "dsname", {}]
        },
        {
            name: "createDataSet",
            spy: jest.spyOn(zowe.Create, "dataSet"),
            args: ["dstype", "dsname", {}]
        },
        {
            name: "createDataSetMember",
            spy: jest.spyOn(zowe.Upload, "bufferToDataSet"),
            args: ["dsname", {}]
        },
        {
            name: "allocateLikeDataSet",
            spy: jest.spyOn(zowe.Create, "dataSetLike"),
            args: ["dsname", {}]
        },
        {
            name: "copyDataSetMember",
            spy: jest.spyOn(zowe.Copy, "dataSet"),
            args: [
                { dsn: "dsname1", member: "member1" },
                { dsn: "dsname2", member: "member2" }
            ]
        },
        {
            name: "renameDataSet",
            spy: jest.spyOn(zowe.Rename, "dataSet"),
            args: ["dsname1", "dsname2"]
        },
        {
            name: "renameDataSetMember",
            spy: jest.spyOn(zowe.Rename, "dataSetMember"),
            args: ["dsname", "member1", "member2"]
        },
        {
            name: "hMigrateDataSet",
            spy: jest.spyOn(zowe.HMigrate, "dataSet"),
            args: ["dsname"]
        },
        {
            name: "hRecallDataSet",
            spy: jest.spyOn(zowe.HRecall, "dataSet"),
            args: ["dsname"]
        },
        {
            name: "deleteDataSet",
            spy: jest.spyOn(zowe.Delete, "dataSet"),
            args: ["dsname", {}]
        }
    ];
    mvsApis.forEach(({ name, spy, args }) => {
        it(`${name} should inject session into Zowe API`, async () => {
            spy.mockResolvedValue(undefined).mockClear();
            const zosmfApi = new ZosmfMvsApi();
            const getSessionSpy = jest.spyOn(zosmfApi, "getSession").mockReturnValue(fakeSession);
            await (zosmfApi as any)[name](...args);
            expect(getSessionSpy).toHaveBeenCalledTimes(1);
            expect(spy).toHaveBeenCalledWith(fakeSession, ...args);
        });
    });
});

describe("ZosmfJesApi", () => {
    it("getProfileTypeName should get profile type name", () => {
        const zosmfApi = new ZosmfJesApi();
        expect(zosmfApi.getProfileTypeName()).toBe(PROFILE_TYPE_ZOSMF);
    });

    const jesApis: ITestApi<ZosmfJesApi>[] = [
        {
            name: "getJobsByParameters",
            spy: jest.spyOn(zowe.GetJobs, "getJobsByParameters"),
            args: [{}]
        },
        {
            name: "getJobsByOwnerAndPrefix",
            spy: jest.spyOn(zowe.GetJobs, "getJobsByOwnerAndPrefix"),
            args: ["owner", "prefix"]
        },
        {
            name: "getJob",
            spy: jest.spyOn(zowe.GetJobs, "getJob"),
            args: ["jobid"]
        },
        {
            name: "getSpoolFiles",
            spy: jest.spyOn(zowe.GetJobs, "getSpoolFiles"),
            args: ["jobname", "jobid"]
        },
        {
            name: "downloadSpoolContent",
            spy: jest.spyOn(zowe.DownloadJobs, "downloadAllSpoolContentCommon"),
            args: [{}]
        },
        {
            name: "getSpoolContentById",
            spy: jest.spyOn(zowe.GetJobs, "getSpoolContentById"),
            args: ["jobname", "jobid", 100]
        },
        {
            name: "getJclForJob",
            spy: jest.spyOn(zowe.GetJobs, "getJclForJob"),
            args: [{}]
        },
        {
            name: "submitJcl",
            spy: jest.spyOn(zowe.SubmitJobs, "submitJcl"),
            args: ["jcl", "FB", 80]
        },
        {
            name: "submitJob",
            spy: jest.spyOn(zowe.SubmitJobs, "submitJob"),
            args: ["dsname"]
        },
        {
            name: "deleteJob",
            spy: jest.spyOn(zowe.DeleteJobs, "deleteJob"),
            args: ["jobname", "jobid"]
        },
        {
            name: "deleteJobWithInfo",
            spy: jest.spyOn(zowe.DeleteJobs, "deleteJob"),
            args: ["jobname", "jobid"]
        }
    ];
    jesApis.forEach(({ name, spy, args }) => {
        it(`${name} should inject session into Zowe API`, async () => {
            spy.mockResolvedValue(undefined).mockClear();
            const zosmfApi = new ZosmfJesApi();
            const getSessionSpy = jest.spyOn(zosmfApi, "getSession").mockReturnValue(fakeSession);
            await (zosmfApi as any)[name](...args);
            expect(getSessionSpy).toHaveBeenCalledTimes(1);
            expect(spy).toHaveBeenCalledWith(fakeSession, ...args);
        });
    });
});

describe("ZosmfCommandApi", () => {
    it("getProfileTypeName should get profile type name", () => {
        const zosmfApi = new ZosmfCommandApi();
        expect(zosmfApi.getProfileTypeName()).toBe(PROFILE_TYPE_ZOSMF);
    });

    const commandApis: ITestApi<ZosmfCommandApi>[] = [
        {
            name: "issueTsoCommand",
            spy: jest.spyOn(zowe.IssueTso, "issueTsoCommand"),
            args: ["ACCT#", "command"]
        },
        {
            name: "issueTsoCommandWithParms",
            spy: jest.spyOn(zowe.IssueTso, "issueTsoCommand"),
            args: ["ACCT#", "command", {}]
        },
        {
            name: "issueMvsCommand",
            spy: jest.spyOn(zowe.IssueCommand, "issueSimple"),
            args: ["command"]
        }
    ];
    commandApis.forEach(({ name, spy, args }) => {
        it(`${name} should inject session into Zowe API`, async () => {
            spy.mockResolvedValue(undefined).mockClear();
            const zosmfApi = new ZosmfCommandApi();
            const getSessionSpy = jest.spyOn(zosmfApi, "getSession").mockReturnValue(fakeSession);
            await (zosmfApi as any)[name](...args);
            expect(getSessionSpy).toHaveBeenCalledTimes(1);
            expect(spy).toHaveBeenCalledWith(fakeSession, ...args);
        });
    });
});
