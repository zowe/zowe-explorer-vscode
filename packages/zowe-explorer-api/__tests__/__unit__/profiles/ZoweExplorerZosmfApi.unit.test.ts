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

import { Login, Logout } from "@zowe/core-for-zowe-sdk";
import * as imperative from "@zowe/imperative";
import * as zosconsole from "@zowe/zos-console-for-zowe-sdk";
import * as zosfiles from "@zowe/zos-files-for-zowe-sdk";
import * as zosjobs from "@zowe/zos-jobs-for-zowe-sdk";
import * as zostso from "@zowe/zos-tso-for-zowe-sdk";
import * as zosuss from "@zowe/zos-uss-for-zowe-sdk";
import * as zosmf from "@zowe/zosmf-for-zowe-sdk";
import { ZoweExplorerZosmf } from "../../../src/profiles/ZoweExplorerZosmfApi";
import { FileManagement } from "../../../src/utils/FileManagement";
import { MainframeInteraction } from "../../../src/extend";
import { ProfilesCache } from "../../../src/profiles/ProfilesCache";

type ParametersWithProfileArgs<F> = F extends (...args: infer P) => any ? [...Parameters<F>, profileProperties?: object] : never;

type ITestApi<T> = {
    [K in keyof T]: {
        name: K;
        spy: jest.SpyInstance;
        args: ParametersWithProfileArgs<T[K]>;
        transform?: (args: ParametersWithProfileArgs<T[K]>) => any[];
    };
}[keyof T];

const fakeProperties = {
    responseTimeout: 60,
};

const fakeProfile: imperative.IProfile = {
    host: "example.com",
    port: 443,
    basePath: "/api/v1",
    rejectUnauthorized: true,
    user: "admin",
    password: "123456",
    ...fakeProperties,
};
const loadedProfile: imperative.IProfileLoaded = {
    profile: fakeProfile,
    message: "",
    type: "zosmf",
    failNotFound: false,
};

const fakeSession = imperative.Session.createFromUrl(new URL("https://example.com"));

const mISshSession: zosuss.ISshSession = {
    hostname: "example.com",
    port: 22,
};

async function expectUnixCommandApiWithSshSession<T>(
    { name, spy, args }: ITestApi<T>,
    apiInstance: MainframeInteraction.ICommon,
    sshobj: zosuss.SshSession
): Promise<void> {
    spy.mockClear().mockResolvedValue(undefined);
    spy.mockImplementation(
        (_sshobject: zosuss.SshSession, _command: string, _cwd: string, callback: (data: string) => void, _cleanStdout?: boolean) => {
            callback("test");
        }
    );
    const spywhenpathnotspecified = jest.spyOn(zosuss.Shell, "executeSsh");
    spywhenpathnotspecified.mockImplementation(
        (_sshobject: zosuss.SshSession, _command: string, callback: (data: string) => void, _cleanStdout?: boolean) => {
            callback("test");
        }
    );
    await apiInstance[name as string](sshobj, ...args, true, () => {});
    await apiInstance[name as string](sshobj, ...args, false, () => {});
    expect(spy).toHaveBeenCalled();
}
async function expectApiWithSession<T>({ name, spy, args, transform }: ITestApi<T>, apiInstance: MainframeInteraction.ICommon): Promise<void> {
    spy.mockClear().mockResolvedValue(undefined);
    const getSessionSpy = jest.spyOn(apiInstance, "getSession").mockReturnValue(fakeSession);
    await apiInstance[name as string](...Object.values(args));
    expect(getSessionSpy).toHaveBeenCalledTimes(1);
    const params: unknown[] = transform ? transform(args) : args;
    expect(spy).toHaveBeenCalledWith(fakeSession, ...params);
}

describe("ZosmfUssApi", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("_getSession", () => {
        const exampleProfile = {
            message: "",
            type: "zosmf",
            failNotFound: false,
            name: "test.zosmf",
            profile: {
                host: "localhost",
                password: "password",
                protocol: "http",
                user: "aZosmfUser",
                ...fakeProperties,
            },
        } as imperative.IProfileLoaded;
        const exampleSession = imperative.Session.createFromUrl(new URL("http://localhost"));
        exampleSession.ISession.password = exampleProfile.profile?.password;
        exampleSession.ISession.user = exampleProfile.profile?.user;
        jest.spyOn(ProfilesCache, "getProfileSessionWithVscProxy").mockReturnValueOnce(exampleSession as any);

        it("should include profile properties in the built session object", () => {
            const api = new ZoweExplorerZosmf.UssApi(loadedProfile);

            const transformedProps: Record<string, any> = { ...exampleProfile.profile, hostname: exampleProfile.profile?.host, ...fakeProperties };
            delete transformedProps["host"];
            delete transformedProps["responseTimeout"];
            expect((api as any)._getSession(exampleProfile).mISession).toMatchObject(transformedProps);
        });
    });

    describe("updateAttributes", () => {
        const ussApi = new ZoweExplorerZosmf.UssApi(loadedProfile);
        const getSessionMock = jest.spyOn(ussApi, "getSession").mockReturnValue(fakeSession);
        const putUSSPayload = jest.spyOn(zosfiles.Utilities, "putUSSPayload").mockResolvedValue(Buffer.from("test"));

        it("updates group and owner if provided", async () => {
            const resp = await ussApi.updateAttributes("/some/path", {
                group: "usergroup",
                owner: "admin",
            });

            expect(putUSSPayload).toHaveBeenCalledWith(fakeSession, "/some/path", {
                request: "chown",
                owner: "admin",
                group: "usergroup",
                recursive: true,
            });
            expect(resp.success).toBe(true);
        });

        it("updates GID and UID if provided", async () => {
            const resp = await ussApi.updateAttributes("/some/path", {
                gid: 100001,
                uid: 123,
            });

            expect(putUSSPayload).toHaveBeenCalledWith(fakeSession, "/some/path", {
                request: "chown",
                owner: "123",
                group: "100001",
                recursive: true,
            });
            expect(resp.success).toBe(true);
        });

        it("only updates owner if provided", async () => {
            const resp = await ussApi.updateAttributes("/some/path", {
                owner: "admin",
            });

            expect(putUSSPayload).toHaveBeenCalledWith(fakeSession, "/some/path", {
                request: "chown",
                owner: "admin",
                recursive: true,
            });
            expect(resp.success).toBe(true);
        });

        it("updates permissions", async () => {
            const resp = await ussApi.updateAttributes("/some/path", {
                perms: "-r-xr-xr-x",
            });

            expect(putUSSPayload).toHaveBeenCalledWith(fakeSession, "/some/path", {
                request: "chmod",
                mode: FileManagement.permStringToOctal("-r-xr-xr-x").toString(),
            });
            expect(resp.success).toBe(true);
        });

        it("handles error in putUSSPayload", async () => {
            putUSSPayload.mockRejectedValueOnce(new Error("Error when sending USS payload"));
            const resp = await ussApi.updateAttributes("/some/path", {
                perms: "-r-xr-xr-x",
            });

            expect(putUSSPayload).toHaveBeenCalledWith(fakeSession, "/some/path", {
                request: "chmod",
                mode: FileManagement.permStringToOctal("-r-xr-xr-x").toString(),
            });
            expect(resp.success).toBe(false);
            expect(resp.errorMessage).toBe("Error: Error when sending USS payload");
        });

        it("handles undefined error in putUSSPayload", async () => {
            putUSSPayload.mockRejectedValueOnce(undefined);
            const resp = await ussApi.updateAttributes("/some/path", {
                perms: "-r-xr-xr-x",
            });

            expect(putUSSPayload).toHaveBeenCalledWith(fakeSession, "/some/path", {
                request: "chmod",
                mode: FileManagement.permStringToOctal("-r-xr-xr-x").toString(),
            });
            expect(resp.success).toBe(false);
            expect(resp.errorMessage).toBe("N/A");
        });

        afterAll(() => {
            getSessionMock.mockRestore();
        });
    });

    describe("misc", () => {
        fakeSession.ISession.user = fakeProfile.user;
        fakeSession.ISession.password = fakeProfile.password;
        fakeSession.ISession.basePath = fakeProfile.basePath;
        jest.spyOn(ProfilesCache, "getProfileSessionWithVscProxy").mockReturnValue(fakeSession as any);

        it("uploads a file from buffer", async () => {
            const uploadFileSpy = jest.spyOn(zosfiles.Upload, "bufferToUssFile").mockImplementation();
            const zosmfApi = new ZoweExplorerZosmf.UssApi(loadedProfile);
            const buf = Buffer.from("123abc");
            await zosmfApi.uploadFromBuffer(buf, "/some/uss/path");
            expect(uploadFileSpy).toHaveBeenCalledWith(zosmfApi.getSession(), "/some/uss/path", buf, fakeProperties);
        });

        it("constants should be unchanged", () => {
            const zosmfApi = new ZoweExplorerZosmf.UssApi(loadedProfile);
            expect(zosmfApi.getProfileTypeName()).toMatchSnapshot();
            expect(zosmfApi.getTokenTypeName()).toMatchSnapshot();
        });

        it("getSessionFromCommandArgument should build session from arguments", () => {
            const zosmfApi = new ZoweExplorerZosmf.UssApi(loadedProfile);
            const session = zosmfApi.getSessionFromCommandArgument(fakeProfile as unknown as imperative.ICommandArguments);
            expect(session).toBeDefined();
            const sessCfg: imperative.ISession = {
                ...fakeProfile,
                hostname: fakeProfile.host,
                type: imperative.SessConstants.AUTH_TYPE_BASIC,
            };
            delete sessCfg["host"];
            delete sessCfg["responseTimeout"];
            expect(session.ISession).toMatchObject(sessCfg);
        });

        it("getSession should build session from profile with user and password", () => {
            const zosmfApi = new ZoweExplorerZosmf.UssApi({
                profile: fakeProfile,
            } as unknown as imperative.IProfileLoaded);
            const session = zosmfApi.getSession();
            expect(session).toBeDefined();
            const sessCfg: Partial<imperative.IProfile> & { hostname: string; type: string } = {
                ...fakeProfile,
                hostname: fakeProfile.host,
                type: imperative.SessConstants.AUTH_TYPE_BASIC,
            };
            delete sessCfg.host;
            delete sessCfg["responseTimeout"];
            expect(session.ISession).toMatchObject(sessCfg);
        });

        it("getSession should build session from profile with token", () => {
            const fakeProfileWithToken: imperative.IProfile = {
                ...fakeProfile,
                tokenType: imperative.SessConstants.TOKEN_TYPE_JWT,
                tokenValue: "fakeToken",
            };
            delete fakeProfileWithToken.user;
            delete fakeProfileWithToken.password;
            fakeSession.ISession.tokenType = imperative.SessConstants.TOKEN_TYPE_JWT;
            fakeSession.ISession.tokenValue = "fakeToken";
            fakeSession.ISession.type = "token";
            delete fakeSession.ISession.user;
            delete fakeSession.ISession.password;
            const zosmfApi = new ZoweExplorerZosmf.UssApi({
                profile: fakeProfileWithToken,
            } as unknown as imperative.IProfileLoaded);
            const session = zosmfApi.getSession();
            expect(session).toBeDefined();
            const sessCfg: Partial<imperative.IProfile> & { hostname: string; type: string } = {
                ...fakeProfileWithToken,
                hostname: fakeProfileWithToken.host,
                type: imperative.SessConstants.AUTH_TYPE_TOKEN,
            };
            delete sessCfg.host;
            delete sessCfg["responseTimeout"];
            expect(session.ISession).toMatchObject(sessCfg);
        });

        it("getSession should log error when it fails", () => {
            jest.resetAllMocks();
            const zosmfApi = new ZoweExplorerZosmf.UssApi({} as unknown as imperative.IProfileLoaded);
            const loggerSpy = jest.spyOn(imperative.Logger.prototype, "error").mockReturnValue("");
            const session = zosmfApi.getSession();
            expect(session).toBeUndefined();
            expect(loggerSpy).toHaveBeenCalledTimes(1);
        });

        it("getStatus should validate active profile", async () => {
            const zosmfApi = new ZoweExplorerZosmf.UssApi(loadedProfile);
            const checkStatusSpy = jest.spyOn(zosmf.CheckStatus, "getZosmfInfo").mockResolvedValue({});
            const status = await zosmfApi.getStatus({ profile: fakeProfile } as unknown as imperative.IProfileLoaded, "zosmf");
            expect(status).toBe("active");
            expect(checkStatusSpy).toHaveBeenCalledTimes(1);
        });

        it("getStatus should validate inactive profile", async () => {
            const zosmfApi = new ZoweExplorerZosmf.UssApi(loadedProfile);
            const checkStatusSpy = jest.spyOn(zosmf.CheckStatus, "getZosmfInfo").mockResolvedValue(undefined as unknown as zosmf.IZosmfInfoResponse);
            const status = await zosmfApi.getStatus({ profile: fakeProfile } as unknown as imperative.IProfileLoaded, "zosmf");
            expect(status).toBe("inactive");
            expect(checkStatusSpy).toHaveBeenCalledTimes(1);
        });

        it("should test that copy calls zowe.Utilities.putUSSPayload", async () => {
            const api = new ZoweExplorerZosmf.UssApi(loadedProfile);
            api.getSession = jest.fn();
            const response = Buffer.from("hello world!");

            Object.defineProperty(zosfiles.Utilities, "putUSSPayload", {
                value: jest.fn().mockResolvedValue(response),
                configurable: true,
            });

            await expect(api.copy("/")).resolves.toEqual(response);
        });

        it("getStatus should validate unverified profile", async () => {
            const zosmfApi = new ZoweExplorerZosmf.UssApi(loadedProfile);
            const status = await zosmfApi.getStatus({ profile: fakeProfile } as unknown as imperative.IProfileLoaded, "sample");
            expect(status).toBe("unverified");
        });

        it("login and logout should call APIML endpoints", async () => {
            const zosmfApi = new ZoweExplorerZosmf.UssApi(loadedProfile);
            const loginSpy = jest.spyOn(Login, "apimlLogin").mockResolvedValue("");
            const logoutSpy = jest.spyOn(Logout, "apimlLogout").mockResolvedValue();

            await zosmfApi.login(fakeSession);
            expect(loginSpy).toHaveBeenCalledWith(fakeSession);

            await zosmfApi.logout(fakeSession);
            expect(logoutSpy).toHaveBeenCalledWith(fakeSession);
        });

        it("should retrieve the tag of a file", async () => {
            const zosmfApi = new ZoweExplorerZosmf.UssApi(loadedProfile);
            jest.spyOn(JSON, "parse").mockReturnValue({
                stdout: ["-t UTF-8 tesfile.txt"],
            });

            Object.defineProperty(zosfiles.Utilities, "putUSSPayload", {
                value: () => Buffer.from(""),
                configurable: true,
            });
            await expect(zosmfApi.getTag("testfile.txt")).resolves.toEqual("UTF-8");
        });

        it("should update the tag attribute when passed in", async () => {
            const zosmfApi = new ZoweExplorerZosmf.UssApi(loadedProfile);
            const changeTagSpy = jest.fn();
            Object.defineProperty(zosfiles.Utilities, "putUSSPayload", {
                value: changeTagSpy,
                configurable: true,
            });
            await expect(zosmfApi.updateAttributes("/test/path", { tag: "utf-8" })).resolves.not.toThrow();
            expect(changeTagSpy).toHaveBeenCalledTimes(1);
        });

        it("calls putUSSPayload to move a directory from old path to new path", async () => {
            const api = new ZoweExplorerZosmf.UssApi(loadedProfile);
            const putUssPayloadSpy = jest.fn();
            Object.defineProperty(zosfiles.Utilities, "putUSSPayload", {
                value: putUssPayloadSpy,
                configurable: true,
            });
            await expect(api.move("/old/path", "/new/path")).resolves.not.toThrow();
            expect(putUssPayloadSpy).toHaveBeenCalledWith(api.getSession(), "/new/path", { request: "move", from: "/old/path" });
        });
    });

    const ussApis: ITestApi<ZoweExplorerZosmf.UssApi>[] = [
        {
            name: "isFileTagBinOrAscii",
            spy: jest.spyOn(zosfiles.Utilities, "isFileTagBinOrAscii"),
            args: ["ussPath"],
        },
        {
            name: "fileList",
            spy: jest.spyOn(zosfiles.List, "fileList"),
            args: ["ussPath", fakeProperties],
        },
        {
            name: "isFileTagBinOrAscii",
            spy: jest.spyOn(zosfiles.Utilities, "isFileTagBinOrAscii"),
            args: ["ussPath"],
        },
        {
            name: "getContents",
            spy: jest.spyOn(zosfiles.Download, "ussFile"),
            args: ["ussPath", fakeProperties],
        },
        {
            name: "putContent",
            spy: jest.spyOn(zosfiles.Upload, "fileToUssFile"),
            args: ["localPath", "ussPath", fakeProperties],
        },
        {
            name: "uploadDirectory",
            spy: jest.spyOn(zosfiles.Upload, "dirToUSSDirRecursive"),
            args: ["localPath", "ussPath", fakeProperties],
        },
        {
            name: "create",
            spy: jest.spyOn(zosfiles.Create, "uss"),
            args: ["ussPath", "file", "777", fakeProperties],
        },
        {
            name: "delete",
            spy: jest.spyOn(zosfiles.Delete, "ussFile"),
            args: ["/ussPath", false, fakeProperties],
            transform: (args) => [args[0].slice(1), args[1], fakeProperties],
        },
        {
            name: "delete",
            spy: jest.spyOn(zosfiles.Delete, "ussFile"),
            args: ["ussPath", false, fakeProperties],
        },
        {
            name: "rename",
            spy: jest.spyOn(zosfiles.Utilities, "renameUSSFile"),
            args: ["ussPath1", "ussPath2"],
        },
    ];
    ussApis.forEach((ussApi) => {
        it(`${ussApi?.name} should inject session into Zowe API`, async () => {
            await expectApiWithSession(ussApi, new ZoweExplorerZosmf.UssApi(loadedProfile));
        });
    });
});

describe("ZosmfMvsApi", () => {
    const mvsApis: ITestApi<ZoweExplorerZosmf.MvsApi>[] = [
        {
            name: "dataSet",
            spy: jest.spyOn(zosfiles.List, "dataSet"),
            args: ["dsname", fakeProperties],
        },
        {
            name: "allMembers",
            spy: jest.spyOn(zosfiles.List, "allMembers"),
            args: ["dsname", fakeProperties],
        },
        {
            name: "getContents",
            spy: jest.spyOn(zosfiles.Download, "dataSet"),
            args: ["dsname", fakeProperties],
        },
        {
            name: "putContents",
            spy: jest.spyOn(zosfiles.Upload, "pathToDataSet"),
            args: ["localPath", "dsname", fakeProperties],
        },
        {
            name: "createDataSet",
            spy: jest.spyOn(zosfiles.Create, "dataSet"),
            args: [0, "dsname", fakeProperties],
        },
        {
            name: "createDataSetMember",
            spy: jest.spyOn(zosfiles.Upload, "bufferToDataSet"),
            args: ["dsname", fakeProperties],
            transform: (args) => [Buffer.from(""), ...args],
        },
        {
            name: "allocateLikeDataSet",
            spy: jest.spyOn(zosfiles.Create, "dataSetLike"),
            args: ["dsname1", "dsname2", fakeProperties],
        },
        {
            name: "copyDataSetMember",
            spy: jest.spyOn(zosfiles.Copy, "dataSet"),
            args: [
                { dsn: "dsname1", member: "member1" },
                { dsn: "dsname2", member: "member2" },
                { "from-dataset": { dsn: "dsname1", member: "member1" }, ...fakeProperties },
            ],
            transform: (args) => [args[1], args[2]],
        },
        {
            name: "copyDataSetMember",
            spy: jest.spyOn(zosfiles.Copy, "dataSet"),
            args: [
                { dsn: "dsname1", member: "member1" },
                { dsn: "dsname2", member: "member2" },
            ],
            transform: (args) => [args[1], { "from-dataset": args[0], ...fakeProperties }],
        },
        {
            name: "copyDataSetMember",
            spy: jest.spyOn(zosfiles.Copy, "dataSet"),
            args: [
                { dsn: "dsname1", member: "member1" },
                { dsn: "dsname2", member: "member2" },
            ],
            transform: (args) => [args[1], { "from-dataset": args[0], ...fakeProperties }],
        },
        {
            name: "renameDataSet",
            spy: jest.spyOn(zosfiles.Rename, "dataSet"),
            args: ["dsname1", "dsname2", fakeProperties],
        },
        {
            name: "renameDataSetMember",
            spy: jest.spyOn(zosfiles.Rename, "dataSetMember"),
            args: ["dsname", "member1", "member2", fakeProperties],
        },
        {
            name: "hMigrateDataSet",
            spy: jest.spyOn(zosfiles.HMigrate, "dataSet"),
            args: ["dsname", fakeProperties],
        },
        {
            name: "hRecallDataSet",
            spy: jest.spyOn(zosfiles.HRecall, "dataSet"),
            args: ["dsname", fakeProperties],
        },
        {
            name: "deleteDataSet",
            spy: jest.spyOn(zosfiles.Delete, "dataSet"),
            args: ["dsname", fakeProperties],
        },
        {
            name: "dataSetsMatchingPattern",
            spy: jest.spyOn(zosfiles.List, "dataSetsMatchingPattern"),
            args: [["SAMPLE.A*", "SAMPLE.B*"], fakeProperties],
        },
        {
            name: "searchDataSets",
            spy: jest.spyOn(zosfiles.Search, "dataSets"),
            args: [{ pattern: "SAMPLE.A*", searchString: "test", listOptions: { ...fakeProperties }, getOptions: { ...fakeProperties } }],
        },
        {
            name: "copyDataSet",
            spy: jest.spyOn(zosfiles.Copy, "dataSet"),
            args: ["FROM.NAME", "TO.NAME", undefined, undefined, fakeProperties],
            transform: (args) => [{ dsn: args[1] }, { enq: undefined, "from-dataset": { dsn: args[0] }, replace: undefined, ...fakeProperties }],
        },
    ];
    mvsApis.forEach((mvsApi) => {
        it(`${mvsApi?.name} should inject session into Zowe API`, async () => {
            await expectApiWithSession(mvsApi, new ZoweExplorerZosmf.MvsApi(loadedProfile));
        });
    });

    it("uploads a data set from buffer", async () => {
        const uploadFileSpy = jest.spyOn(zosfiles.Upload, "bufferToDataSet").mockImplementation();
        const zosmfApi = new ZoweExplorerZosmf.MvsApi(loadedProfile);
        const buf = Buffer.from("123abc");
        await zosmfApi.uploadFromBuffer(buf, "SOME.DS(MEMB)");
        expect(uploadFileSpy).toHaveBeenCalledWith(zosmfApi.getSession(), buf, "SOME.DS(MEMB)", fakeProperties);
    });
});

describe("ZosmfJesApi", () => {
    const jesApis: ITestApi<ZoweExplorerZosmf.JesApi>[] = [
        {
            name: "getJobsByParameters",
            spy: jest.spyOn(zosjobs.GetJobs, "getJobsByParameters"),
            args: [{}],
        },
        {
            name: "getJob",
            spy: jest.spyOn(zosjobs.GetJobs, "getJob"),
            args: ["jobid"],
        },
        {
            name: "getSpoolFiles",
            spy: jest.spyOn(zosjobs.GetJobs, "getSpoolFiles"),
            args: ["jobname", "jobid"],
        },
        {
            name: "downloadSpoolContent",
            spy: jest.spyOn(zosjobs.DownloadJobs, "downloadAllSpoolContentCommon"),
            args: [{ jobname: "jobname", jobid: "jobid" }],
        },
        {
            name: "downloadSingleSpool",
            spy: jest.spyOn(zosjobs.DownloadJobs, "downloadSpoolContentCommon"),
            args: [{ jobname: "jobname", jobid: "jobid" }],
        },
        {
            name: "getSpoolContentById",
            spy: jest.spyOn(zosjobs.GetJobs, "getSpoolContentById"),
            args: ["jobname", "jobid", 100],
        },
        {
            name: "getJclForJob",
            spy: jest.spyOn(zosjobs.GetJobs, "getJclForJob"),
            args: [{} as any],
        },
        {
            name: "submitJcl",
            spy: jest.spyOn(zosjobs.SubmitJobs, "submitJcl"),
            args: ["jcl", "FB", "80"],
        },
        {
            name: "submitJob",
            spy: jest.spyOn(zosjobs.SubmitJobs, "submitJob"),
            args: ["dsname"],
        },
        {
            name: "deleteJob",
            spy: jest.spyOn(zosjobs.DeleteJobs, "deleteJob"),
            args: ["jobname", "jobid"],
        },
        {
            name: "deleteJobWithInfo",
            spy: jest.spyOn(zosjobs.DeleteJobs, "deleteJob"),
            args: ["jobname", "jobid"],
        },
    ];
    jesApis.forEach((jesApi) => {
        it(`${jesApi?.name} should inject session into Zowe API`, async () => {
            await expectApiWithSession(jesApi, new ZoweExplorerZosmf.JesApi());
        });
    });

    describe("cancelJob", () => {
        const api = new ZoweExplorerZosmf.JesApi();
        const cancelJobForJob = jest.fn();

        beforeAll(() => {
            Object.defineProperty(zosjobs.CancelJobs, "cancelJobForJob", { value: cancelJobForJob });
        });

        it("returns true if the job was cancelled", async () => {
            cancelJobForJob.mockResolvedValue({
                status: "0",
            });
            expect(
                await api.cancelJob({
                    retcode: "ACTIVE",
                } as zosjobs.IJob)
            ).toBe(true);
        });

        it("returns false if the job did not cancel", async () => {
            cancelJobForJob.mockResolvedValue({
                status: "0222",
            });
            expect(
                await api.cancelJob({
                    retcode: "ACTIVE",
                } as zosjobs.IJob)
            ).toBe(false);
        });
    });
});

describe("ZosmfCommandApi", () => {
    const SshSessionobj = new zosuss.SshSession(mISshSession);
    const commandApis: ITestApi<ZoweExplorerZosmf.CommandApi>[] = [
        {
            name: "issueTsoCommandWithParms",
            spy: jest.spyOn(zostso.IssueTso, "issueTsoCommand"),
            args: ["command", { account: "ACCT#" }],
            transform: (args) => [args[1].account, ...args],
        },
        {
            name: "issueTsoCmdWithParms",
            spy: jest.spyOn(zostso.IssueTso, "issueTsoCmd"),
            args: ["command"],
            transform: (args) => [...args, { addressSpaceOptions: undefined }],
        },
        {
            name: "issueMvsCommand",
            spy: jest.spyOn(zosconsole.IssueCommand, "issue"),
            args: ["command", "defcn"],
            transform: (args) => [{ command: args[0], consoleName: args[1], processResponses: true }],
        },
    ];
    commandApis.forEach((commandApi) => {
        it(`${commandApi?.name} should inject session into Zowe API`, async () => {
            await expectApiWithSession(commandApi, new ZoweExplorerZosmf.CommandApi());
        });
    });
    const UnixcommandApiwithsshSession: ITestApi<ZoweExplorerZosmf.CommandApi>[] = [
        {
            name: "issueUnixCommand",
            spy: jest.spyOn(zosuss.Shell, "executeSshCwd"),
            args: ["command", "cwd"],
        },
    ];
    UnixcommandApiwithsshSession.forEach((cmdApi) => {
        it(`${cmdApi?.name} should inject session into Zowe API`, async () => {
            await expectUnixCommandApiWithSshSession(cmdApi, new ZoweExplorerZosmf.CommandApi(), SshSessionobj);
        });
    });
    it("check whether sshProfileNeeded", () => {
        const obj = new ZoweExplorerZosmf.CommandApi();
        expect(obj.sshProfileRequired?.()).toBe(true);
    });
});
