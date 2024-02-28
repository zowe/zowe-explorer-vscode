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

import * as zowe from "@zowe/cli";
import { IZosmfInfoResponse } from "@zowe/cli";
import { ZoweExplorerZosmf } from "../../../src/profiles/ZoweExplorerZosmfApi";
import { FileManagement } from "../../../src/utils/FileManagement";
import { MainframeInteraction } from "../../../src/extend";

type ITestApi<T> = {
    [K in keyof T]: {
        name: K;
        spy: jest.SpyInstance;
        args: jest.ArgsType<T[K]>;
        transform?: (args: jest.ArgsType<T[K]>) => any[];
    };
}[keyof T];

type ITestProfile = {
    host: string;
    port: number;
    basePath: string;
    rejectUnauthorized: boolean;
    user?: string;
    password?: string;
};

const fakeProfile: ITestProfile = {
    host: "example.com",
    port: 443,
    basePath: "/api/v1",
    rejectUnauthorized: true,
    user: "admin",
    password: "123456",
};
const fakeSession = zowe.imperative.Session.createFromUrl(new URL("https://example.com"));

const mISshSession: zowe.ISshSession = {
    hostname: "example.com",
    port: 22,
};

async function expectUnixCommandApiWithSshSession<T>(
    { name, spy, args }: ITestApi<T>,
    apiInstance: MainframeInteraction.ICommon,
    sshobj: zowe.SshSession
): Promise<void> {
    spy.mockClear().mockResolvedValue(undefined);
    spy.mockImplementation((sshobject: zowe.SshSession, command: string, cwd: string, callback: (data: string) => void) => {
        let r = "";
        callback("test");
        r += "test";
    });
    const spywhenpathnotspecified = jest.spyOn(zowe.Shell, "executeSsh");
    spywhenpathnotspecified.mockImplementation((sshobject: zowe.SshSession, command: string, callback: (data: string) => void) => {
        let r = "";
        callback("test");
        r += "test";
    });
    await apiInstance[name as string](sshobj, ...args, true, () => {});
    await apiInstance[name as string](sshobj, ...args, false, () => {});
    expect(spy).toHaveBeenCalled();
}
async function expectApiWithSession<T>({ name, spy, args, transform }: ITestApi<T>, apiInstance: MainframeInteraction.ICommon): Promise<void> {
    spy.mockClear().mockResolvedValue(undefined);
    const getSessionSpy = jest.spyOn(apiInstance, "getSession").mockReturnValue(fakeSession);
    await apiInstance[name as string](...args);
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
            },
        } as zowe.imperative.IProfileLoaded;

        it("should include profile properties in the built session object", () => {
            const api = new ZoweExplorerZosmf.UssApi();

            const transformedProps = { ...exampleProfile.profile, hostname: exampleProfile.profile?.host };
            delete transformedProps["host"];
            expect((api as any)._getSession(exampleProfile).mISession).toMatchObject(transformedProps);
        });
    });

    describe("updateAttributes", () => {
        const ussApi = new ZoweExplorerZosmf.UssApi();
        const getSessionMock = jest.spyOn(ussApi, "getSession").mockReturnValue(fakeSession);
        const putUSSPayload = jest.spyOn(zowe.Utilities, "putUSSPayload").mockResolvedValue(Buffer.from("test"));

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

    it("uploads a file from buffer", async () => {
        const uploadFileSpy = jest.spyOn(zowe.Upload, "bufferToUssFile").mockImplementation();
        const zosmfApi = new ZoweExplorerZosmf.UssApi();
        const buf = Buffer.from("123abc");
        await zosmfApi.uploadFromBuffer(buf, "/some/uss/path");
        expect(uploadFileSpy).toHaveBeenCalledWith(zosmfApi.getSession(), "/some/uss/path", buf, undefined);
    });

    it("constants should be unchanged", () => {
        const zosmfApi = new ZoweExplorerZosmf.UssApi();
        expect(zosmfApi.getProfileTypeName()).toMatchSnapshot();
        expect(zosmfApi.getTokenTypeName()).toMatchSnapshot();
    });

    it("getSessionFromCommandArgument should build session from arguments", () => {
        const zosmfApi = new ZoweExplorerZosmf.UssApi();
        const session = zosmfApi.getSessionFromCommandArgument(fakeProfile as unknown as zowe.imperative.ICommandArguments);
        expect(session).toBeDefined();
        const sessCfg: zowe.imperative.ISession = {
            ...fakeProfile,
            hostname: fakeProfile.host,
            type: zowe.imperative.SessConstants.AUTH_TYPE_BASIC,
        };
        delete sessCfg["host"];
        expect(session.ISession).toMatchObject(sessCfg);
    });

    it("getSession should build session from profile with user and password", () => {
        const zosmfApi = new ZoweExplorerZosmf.UssApi({
            profile: fakeProfile,
        } as unknown as zowe.imperative.IProfileLoaded);
        const session = zosmfApi.getSession();
        expect(session).toBeDefined();
        const sessCfg: Partial<ITestProfile> & { hostname: string; type: string } = {
            ...fakeProfile,
            hostname: fakeProfile.host,
            type: zowe.imperative.SessConstants.AUTH_TYPE_BASIC,
        };
        delete sessCfg.host;
        expect(session.ISession).toMatchObject(sessCfg);
    });

    it("getSession should build session from profile with token", () => {
        const fakeProfileWithToken = {
            ...fakeProfile,
            tokenType: zowe.imperative.SessConstants.TOKEN_TYPE_JWT,
            tokenValue: "fakeToken",
        };
        delete fakeProfileWithToken.user;
        delete fakeProfileWithToken.password;
        const zosmfApi = new ZoweExplorerZosmf.UssApi({
            profile: fakeProfileWithToken,
        } as unknown as zowe.imperative.IProfileLoaded);
        const session = zosmfApi.getSession();
        expect(session).toBeDefined();
        const sessCfg: Partial<ITestProfile> & { hostname: string; type: string } = {
            ...fakeProfileWithToken,
            hostname: fakeProfileWithToken.host,
            type: zowe.imperative.SessConstants.AUTH_TYPE_TOKEN,
        };
        delete sessCfg.host;
        expect(session.ISession).toMatchObject(sessCfg);
    });

    it("getSession should log error when it fails", () => {
        const zosmfApi = new ZoweExplorerZosmf.UssApi({} as unknown as zowe.imperative.IProfileLoaded);
        const loggerSpy = jest.spyOn(zowe.imperative.Logger.prototype, "error").mockReturnValue("");
        const session = zosmfApi.getSession();
        expect(session).toBeUndefined();
        expect(loggerSpy).toHaveBeenCalledTimes(1);
    });

    it("getStatus should validate active profile", async () => {
        const zosmfApi = new ZoweExplorerZosmf.UssApi();
        const checkStatusSpy = jest.spyOn(zowe.CheckStatus, "getZosmfInfo").mockResolvedValue({});
        const status = await zosmfApi.getStatus({ profile: fakeProfile } as unknown as zowe.imperative.IProfileLoaded, "zosmf");
        expect(status).toBe("active");
        expect(checkStatusSpy).toHaveBeenCalledTimes(1);
    });

    it("getStatus should validate inactive profile", async () => {
        const zosmfApi = new ZoweExplorerZosmf.UssApi();
        const checkStatusSpy = jest.spyOn(zowe.CheckStatus, "getZosmfInfo").mockResolvedValue(undefined as unknown as IZosmfInfoResponse);
        const status = await zosmfApi.getStatus({ profile: fakeProfile } as unknown as zowe.imperative.IProfileLoaded, "zosmf");
        expect(status).toBe("inactive");
        expect(checkStatusSpy).toHaveBeenCalledTimes(1);
    });

    it("should test that copy calls zowe.Utilities.putUSSPayload", async () => {
        const api = new ZoweExplorerZosmf.UssApi();
        api.getSession = jest.fn();
        const response = Buffer.from("hello world!");

        Object.defineProperty(zowe.Utilities, "putUSSPayload", {
            value: jest.fn().mockResolvedValue(response),
            configurable: true,
        });

        await expect(api.copy("/")).resolves.toEqual(response);
    });

    it("getStatus should validate unverified profile", async () => {
        const zosmfApi = new ZoweExplorerZosmf.UssApi();
        const status = await zosmfApi.getStatus({ profile: fakeProfile } as unknown as zowe.imperative.IProfileLoaded, "sample");
        expect(status).toBe("unverified");
    });

    it("login and logout should call APIML endpoints", async () => {
        const zosmfApi = new ZoweExplorerZosmf.UssApi();
        const loginSpy = jest.spyOn(zowe.Login, "apimlLogin").mockResolvedValue("");
        const logoutSpy = jest.spyOn(zowe.Logout, "apimlLogout").mockResolvedValue();

        await zosmfApi.login(fakeSession);
        expect(loginSpy).toHaveBeenCalledWith(fakeSession);

        await zosmfApi.logout(fakeSession);
        expect(logoutSpy).toHaveBeenCalledWith(fakeSession);
    });

    it("should retrieve the tag of a file", async () => {
        const zosmfApi = new ZoweExplorerZosmf.UssApi();
        jest.spyOn(JSON, "parse").mockReturnValue({
            stdout: ["-t UTF-8 tesfile.txt"],
        });

        Object.defineProperty(zowe.Utilities, "putUSSPayload", {
            value: () => Buffer.from(""),
            configurable: true,
        });
        await expect(zosmfApi.getTag("testfile.txt")).resolves.toEqual("UTF-8");
    });

    it("should update the tag attribute when passed in", async () => {
        const zosmfApi = new ZoweExplorerZosmf.UssApi();
        const changeTagSpy = jest.fn();
        Object.defineProperty(zowe.Utilities, "putUSSPayload", {
            value: changeTagSpy,
            configurable: true,
        });
        await expect(zosmfApi.updateAttributes("/test/path", { tag: "utf-8" })).resolves.not.toThrow();
        expect(changeTagSpy).toHaveBeenCalledTimes(1);
    });

    const ussApis: ITestApi<ZoweExplorerZosmf.UssApi>[] = [
        {
            name: "isFileTagBinOrAscii",
            spy: jest.spyOn(zowe.Utilities, "isFileTagBinOrAscii"),
            args: ["ussPath"],
        },
        {
            name: "fileList",
            spy: jest.spyOn(zowe.List, "fileList"),
            args: ["ussPath"],
        },
        {
            name: "isFileTagBinOrAscii",
            spy: jest.spyOn(zowe.Utilities, "isFileTagBinOrAscii"),
            args: ["ussPath"],
        },
        {
            name: "getContents",
            spy: jest.spyOn(zowe.Download, "ussFile"),
            args: ["ussPath", {}],
        },
        {
            name: "putContent",
            spy: jest.spyOn(zowe.Upload, "fileToUssFile"),
            args: ["localPath", "ussPath", {}],
        },
        {
            name: "uploadDirectory",
            spy: jest.spyOn(zowe.Upload, "dirToUSSDirRecursive"),
            args: ["localPath", "ussPath", {}],
        },
        {
            name: "create",
            spy: jest.spyOn(zowe.Create, "uss"),
            args: ["ussPath", "file", "777"],
        },
        {
            name: "delete",
            spy: jest.spyOn(zowe.Delete, "ussFile"),
            args: ["/ussPath", false],
            transform: (args) => [args[0].slice(1), args[1]],
        },
        {
            name: "delete",
            spy: jest.spyOn(zowe.Delete, "ussFile"),
            args: ["ussPath", false],
        },
        {
            name: "rename",
            spy: jest.spyOn(zowe.Utilities, "renameUSSFile"),
            args: ["ussPath1", "ussPath2"],
        },
    ];
    ussApis.forEach((ussApi) => {
        it(`${ussApi?.name} should inject session into Zowe API`, async () => {
            await expectApiWithSession(ussApi, new ZoweExplorerZosmf.UssApi());
        });
    });
});

describe("ZosmfMvsApi", () => {
    const mvsApis: ITestApi<ZoweExplorerZosmf.MvsApi>[] = [
        {
            name: "dataSet",
            spy: jest.spyOn(zowe.List, "dataSet"),
            args: ["dsname", {}],
        },
        {
            name: "allMembers",
            spy: jest.spyOn(zowe.List, "allMembers"),
            args: ["dsname", {}],
        },
        {
            name: "getContents",
            spy: jest.spyOn(zowe.Download, "dataSet"),
            args: ["dsname", {}],
        },
        {
            name: "putContents",
            spy: jest.spyOn(zowe.Upload, "pathToDataSet"),
            args: ["localPath", "dsname", {}],
        },
        {
            name: "createDataSet",
            spy: jest.spyOn(zowe.Create, "dataSet"),
            args: [0, "dsname", {}],
        },
        {
            name: "createDataSetMember",
            spy: jest.spyOn(zowe.Upload, "bufferToDataSet"),
            args: ["dsname", {}],
            transform: (args) => [Buffer.from(""), ...args],
        },
        {
            name: "allocateLikeDataSet",
            spy: jest.spyOn(zowe.Create, "dataSetLike"),
            args: ["dsname1", "dsname2"],
        },
        {
            name: "copyDataSetMember",
            spy: jest.spyOn(zowe.Copy, "dataSet"),
            args: [
                { dsn: "dsname1", member: "member1" },
                { dsn: "dsname2", member: "member2" },
                { "from-dataset": { dsn: "dsname1", member: "member1" } },
            ],
            transform: (args) => [args[1], args[2]],
        },
        {
            name: "copyDataSetMember",
            spy: jest.spyOn(zowe.Copy, "dataSet"),
            args: [{ dsn: "dsname1", member: "member1" }, { dsn: "dsname2", member: "member2" }, {} as any],
            transform: (args) => [args[1], { "from-dataset": args[0] }],
        },
        {
            name: "copyDataSetMember",
            spy: jest.spyOn(zowe.Copy, "dataSet"),
            args: [
                { dsn: "dsname1", member: "member1" },
                { dsn: "dsname2", member: "member2" },
            ],
            transform: (args) => [args[1], { "from-dataset": args[0] }],
        },
        {
            name: "renameDataSet",
            spy: jest.spyOn(zowe.Rename, "dataSet"),
            args: ["dsname1", "dsname2"],
        },
        {
            name: "renameDataSetMember",
            spy: jest.spyOn(zowe.Rename, "dataSetMember"),
            args: ["dsname", "member1", "member2"],
        },
        {
            name: "hMigrateDataSet",
            spy: jest.spyOn(zowe.HMigrate, "dataSet"),
            args: ["dsname"],
        },
        {
            name: "hRecallDataSet",
            spy: jest.spyOn(zowe.HRecall, "dataSet"),
            args: ["dsname"],
        },
        {
            name: "deleteDataSet",
            spy: jest.spyOn(zowe.Delete, "dataSet"),
            args: ["dsname", {}],
        },
    ];
    mvsApis.forEach((mvsApi) => {
        it(`${mvsApi?.name} should inject session into Zowe API`, async () => {
            await expectApiWithSession(mvsApi, new ZoweExplorerZosmf.MvsApi());
        });
    });

    it("uploads a data set from buffer", async () => {
        const uploadFileSpy = jest.spyOn(zowe.Upload, "bufferToDataSet").mockImplementation();
        const zosmfApi = new ZoweExplorerZosmf.MvsApi();
        const buf = Buffer.from("123abc");
        await zosmfApi.uploadFromBuffer(buf, "SOME.DS(MEMB)");
        expect(uploadFileSpy).toHaveBeenCalledWith(zosmfApi.getSession(), buf, "SOME.DS(MEMB)", undefined);
    });
});

describe("ZosmfJesApi", () => {
    const jesApis: ITestApi<ZoweExplorerZosmf.JesApi>[] = [
        {
            name: "getJobsByParameters",
            spy: jest.spyOn(zowe.GetJobs, "getJobsByParameters"),
            args: [{}],
        },
        {
            name: "getJob",
            spy: jest.spyOn(zowe.GetJobs, "getJob"),
            args: ["jobid"],
        },
        {
            name: "getSpoolFiles",
            spy: jest.spyOn(zowe.GetJobs, "getSpoolFiles"),
            args: ["jobname", "jobid"],
        },
        {
            name: "downloadSpoolContent",
            spy: jest.spyOn(zowe.DownloadJobs, "downloadAllSpoolContentCommon"),
            args: [{ jobname: "jobname", jobid: "jobid" }],
        },
        {
            name: "downloadSingleSpool",
            spy: jest.spyOn(zowe.DownloadJobs, "downloadSpoolContentCommon"),
            args: [{ jobname: "jobname", jobid: "jobid" }],
        },
        {
            name: "getSpoolContentById",
            spy: jest.spyOn(zowe.GetJobs, "getSpoolContentById"),
            args: ["jobname", "jobid", 100],
        },
        {
            name: "getJclForJob",
            spy: jest.spyOn(zowe.GetJobs, "getJclForJob"),
            args: [{} as any],
        },
        {
            name: "submitJcl",
            spy: jest.spyOn(zowe.SubmitJobs, "submitJcl"),
            args: ["jcl", "FB", "80"],
        },
        {
            name: "submitJob",
            spy: jest.spyOn(zowe.SubmitJobs, "submitJob"),
            args: ["dsname"],
        },
        {
            name: "deleteJob",
            spy: jest.spyOn(zowe.DeleteJobs, "deleteJob"),
            args: ["jobname", "jobid"],
        },
        {
            name: "deleteJobWithInfo",
            spy: jest.spyOn(zowe.DeleteJobs, "deleteJob"),
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
            Object.defineProperty(zowe.CancelJobs, "cancelJobForJob", { value: cancelJobForJob });
        });

        it("returns true if the job was cancelled", async () => {
            cancelJobForJob.mockResolvedValue({
                status: "0",
            });
            expect(
                await api.cancelJob({
                    retcode: "ACTIVE",
                } as zowe.IJob)
            ).toBe(true);
        });

        it("returns false if the job did not cancel", async () => {
            cancelJobForJob.mockResolvedValue({
                status: "0222",
            });
            expect(
                await api.cancelJob({
                    retcode: "ACTIVE",
                } as zowe.IJob)
            ).toBe(false);
        });
    });
});

describe("ZosmfCommandApi", () => {
    const SshSessionobj = new zowe.SshSession(mISshSession);
    const commandApis: ITestApi<ZoweExplorerZosmf.JesApi>[] = [
        {
            name: "issueTsoCommandWithParms",
            spy: jest.spyOn(zowe.IssueTso, "issueTsoCommand"),
            args: ["command", { account: "ACCT#" }],
            transform: (args) => [args[1].account, ...args],
        },
        {
            name: "issueMvsCommand",
            spy: jest.spyOn(zowe.IssueCommand, "issueSimple"),
            args: ["command"],
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
            spy: jest.spyOn(zowe.Shell, "executeSshCwd"),
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
