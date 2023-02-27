/*
 * This program and the accompanying materials are made available under the terms of the *
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at *
 * https://www.eclipse.org/legal/epl-v20.html                                      *
 *                                                                                 *
 * SPDX-License-Identifier: EPL-2.0                                                *
 *                                                                                 *
 * Copyright Contributors to the Zowe Project.                                     *
 *                                                                                 *
 */

import * as zowe from "@zowe/cli";
import { ZoweExplorerApi } from "../../../src/profiles/ZoweExplorerApi";
import { ZosmfCommandApi, ZosmfJesApi, ZosmfMvsApi, ZosmfUssApi } from "../../../src/profiles/ZoweExplorerZosmfApi";

type ITestApi<T> = {
    [K in keyof T]: {
        name: K;
        spy: jest.SpyInstance;
        args: jest.ArgsType<T[K]>;
        transform?: (args: jest.ArgsType<T[K]>) => any[];
    };
}[keyof T];

const fakeProfile: { [key: string]: string | number | boolean } = {
    host: "example.com",
    port: 443,
    basePath: "/api/v1",
    rejectUnauthorized: true,
    user: "admin",
    password: "123456",
};
const fakeSession = zowe.imperative.Session.createFromUrl(new URL("https://example.com"));

async function expectApiWithSession<T>({ name, spy, args, transform }: ITestApi<T>, apiInstance: ZoweExplorerApi.ICommon): Promise<void> {
    spy.mockClear().mockResolvedValue(undefined);
    const getSessionSpy = jest.spyOn(apiInstance, "getSession").mockReturnValue(fakeSession);
    await (apiInstance as any)[name](...args);
    expect(getSessionSpy).toHaveBeenCalledTimes(1);
    const params = transform ? transform(args) : args;
    expect(spy).toHaveBeenCalledWith(fakeSession, ...params);
}

describe("ZosmfUssApi", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("constants should be unchanged", () => {
        const zosmfApi = new ZosmfUssApi();
        expect(zosmfApi.getProfileTypeName()).toMatchSnapshot();
        expect(zosmfApi.getTokenTypeName()).toMatchSnapshot();
    });

    it("getSessionFromCommandArgument should build session from arguments", () => {
        const zosmfApi = new ZosmfUssApi();
        const session = zosmfApi.getSessionFromCommandArgument(fakeProfile as any);
        expect(session).toBeDefined();
        const sessCfg: any = {
            ...fakeProfile,
            hostname: fakeProfile.host,
            type: zowe.imperative.SessConstants.AUTH_TYPE_BASIC,
        };
        delete sessCfg.host;
        expect(session.ISession).toMatchObject(sessCfg);
    });

    it("getSession should build session from profile with user and password", () => {
        const zosmfApi = new ZosmfUssApi({
            profile: fakeProfile,
        } as any);
        const session = zosmfApi.getSession();
        expect(session).toBeDefined();
        const sessCfg: any = {
            ...fakeProfile,
            hostname: fakeProfile.host,
            type: zowe.imperative.SessConstants.AUTH_TYPE_BASIC,
        };
        delete sessCfg.host;
        expect(session.ISession).toMatchObject(sessCfg);
    });

    it("getSession should build session from profile with token", () => {
        const fakeProfileWithToken: any = {
            ...fakeProfile,
            tokenType: zowe.imperative.SessConstants.TOKEN_TYPE_JWT,
            tokenValue: "fakeToken",
        };
        delete fakeProfileWithToken.user;
        delete fakeProfileWithToken.password;
        const zosmfApi = new ZosmfUssApi({
            profile: fakeProfileWithToken,
        } as any);
        const session = zosmfApi.getSession();
        expect(session).toBeDefined();
        const sessCfg: any = {
            ...fakeProfileWithToken,
            hostname: fakeProfileWithToken.host,
            type: zowe.imperative.SessConstants.AUTH_TYPE_TOKEN,
        };
        delete sessCfg.host;
        expect(session.ISession).toMatchObject(sessCfg);
    });

    it("getSession should log error when it fails", () => {
        const zosmfApi = new ZosmfUssApi({} as any);
        const loggerSpy = jest.spyOn(zowe.imperative.Logger.prototype, "error").mockReturnValue(undefined);
        const session = zosmfApi.getSession();
        expect(session).toBeUndefined();
        expect(loggerSpy).toHaveBeenCalledTimes(1);
    });

    it("getStatus should validate active profile", async () => {
        const zosmfApi = new ZosmfUssApi();
        const checkStatusSpy = jest.spyOn(zowe.CheckStatus, "getZosmfInfo").mockResolvedValue({});
        const status = await zosmfApi.getStatus({ profile: fakeProfile } as any, "zosmf");
        expect(status).toBe("active");
        expect(checkStatusSpy).toHaveBeenCalledTimes(1);
    });

    it("getStatus should validate inactive profile", async () => {
        const zosmfApi = new ZosmfUssApi();
        const checkStatusSpy = jest.spyOn(zowe.CheckStatus, "getZosmfInfo").mockResolvedValue(undefined);
        const status = await zosmfApi.getStatus({ profile: fakeProfile } as any, "zosmf");
        expect(status).toBe("inactive");
        expect(checkStatusSpy).toHaveBeenCalledTimes(1);
    });

    it("getStatus should validate unverified profile", async () => {
        const zosmfApi = new ZosmfUssApi();
        const status = await zosmfApi.getStatus({ profile: fakeProfile } as any, "sample");
        expect(status).toBe("unverified");
    });

    it("login and logout should call APIML endpoints", async () => {
        const zosmfApi = new ZosmfUssApi();
        const loginSpy = jest.spyOn(zowe.Login, "apimlLogin").mockResolvedValue(undefined);
        const logoutSpy = jest.spyOn(zowe.Logout, "apimlLogout").mockResolvedValue(undefined);

        await zosmfApi.login(fakeSession);
        expect(loginSpy).toHaveBeenCalledWith(fakeSession);

        await zosmfApi.logout(fakeSession);
        expect(logoutSpy).toHaveBeenCalledWith(fakeSession);
    });

    const ussApis: ITestApi<ZosmfUssApi>[] = [
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
        it(`${ussApi.name} should inject session into Zowe API`, async () => {
            await expectApiWithSession(ussApi, new ZosmfUssApi());
        });
    });
});

describe("ZosmfMvsApi", () => {
    const mvsApis: ITestApi<ZosmfMvsApi>[] = [
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
        it(`${mvsApi.name} should inject session into Zowe API`, async () => {
            await expectApiWithSession(mvsApi, new ZosmfMvsApi());
        });
    });
});

describe("ZosmfJesApi", () => {
    const jesApis: ITestApi<ZosmfJesApi>[] = [
        {
            name: "getJobsByParameters",
            spy: jest.spyOn(zowe.GetJobs, "getJobsByParameters"),
            args: [{}],
        },
        {
            name: "getJobsByOwnerAndPrefix",
            spy: jest.spyOn(zowe.GetJobs, "getJobsByOwnerAndPrefix"),
            args: ["owner", "prefix"],
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
        it(`${jesApi.name} should inject session into Zowe API`, async () => {
            await expectApiWithSession(jesApi, new ZosmfJesApi());
        });
    });
});

describe("ZosmfCommandApi", () => {
    const commandApis: ITestApi<ZosmfCommandApi>[] = [
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
        it(`${commandApi.name} should inject session into Zowe API`, async () => {
            await expectApiWithSession(commandApi, new ZosmfCommandApi());
        });
    });
});
