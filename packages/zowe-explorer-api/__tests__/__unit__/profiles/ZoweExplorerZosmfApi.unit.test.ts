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
import { MockInstance } from "vitest";

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
import { VscSettings } from "../../../src/vscode/doc/VscSettings";

type ParametersWithProfileArgs<F> = F extends (...args: infer P) => any ? [...Parameters<F>, profileProperties?: object] : never;

type ITestApi<T> = {
    [K in keyof T]: {
        name: K;
        spy: MockInstance;
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

// `vi.spyOn` on the same object property multiple times produces *nested*
// wrappers under Vitest (unlike Jest, which detects and reuses the existing
// spy). Several tables below intentionally list the same SDK method more
// than once with different arg variants — this helper guarantees a single
// shared spy per method so impl overrides made by `expectApiWithSession`
// take effect on the outermost wrapper.
const sharedSpyCache = new WeakMap<object, Map<PropertyKey, MockInstance>>();
function sharedSpyOn<T extends object, K extends keyof T>(target: T, method: K): MockInstance {
    let perTarget = sharedSpyCache.get(target);
    if (!perTarget) {
        perTarget = new Map<PropertyKey, MockInstance>();
        sharedSpyCache.set(target, perTarget);
    }
    const existing = perTarget.get(method as PropertyKey);
    if (existing) {
        return existing;
    }
    const spy = vi.spyOn(target, method as any);
    perTarget.set(method as PropertyKey, spy);
    return spy;
}

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
    const spywhenpathnotspecified = vi.spyOn(zosuss.Shell, "executeSsh");
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
    spy.mockClear();
    spy.mockReset();
    spy.mockResolvedValue(undefined);
    // Some test entries spy on the same SDK function multiple times at module
    // load. Under Vitest those redundant `vi.spyOn` calls can yield distinct
    // wrappers; pin the implementation through a direct `mockImplementation`
    // call as well so the actual SDK method is never invoked.
    spy.mockImplementation((() => Promise.resolve(undefined)) as any);
    const getSessionSpy = vi.spyOn(apiInstance, "getSession").mockReturnValue(fakeSession);
    await apiInstance[name as string](...Object.values(args));
    expect(getSessionSpy).toHaveBeenCalledTimes(1);
    const params: unknown[] = transform ? transform(args) : args;
    expect(spy).toHaveBeenCalledWith(fakeSession, ...params);
}

describe("CommonApi", () => {
    describe("getSession", () => {
        it("returns undefined and does not throw error if the session was not created", () => {
            const api = new ZoweExplorerZosmf.CommonApi();
            let session: imperative.Session;
            expect(() => (session = api.getSession())).not.toThrow();
            expect(session).toBe(undefined);
        });
        it("returns a built session from _getSession and does not throw error", () => {
            const api = new ZoweExplorerZosmf.CommonApi(loadedProfile);
            let session: imperative.Session;
            const _getSessionSpy = vi.spyOn(api as any, "_getSession");
            expect(() => (session = api.getSession())).not.toThrow();
            expect(_getSessionSpy).toHaveBeenCalledTimes(1);
            expect(session).not.toBeUndefined();
        });
    });
});

describe("ZosmfUssApi", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("_getSession", () => {
        const exampleSession = Object.assign(Object.create(Object.getPrototypeOf(fakeSession)), fakeSession);
        exampleSession.ISession.password = loadedProfile.profile?.password;
        exampleSession.ISession.user = loadedProfile.profile?.user;
        vi.spyOn(ProfilesCache, "getProfileSessionWithVscProxy").mockReturnValueOnce(exampleSession);

        it("should include profile properties in the built session object", () => {
            const api = new ZoweExplorerZosmf.UssApi(loadedProfile);

            const transformedProps: Record<string, any> = { ...loadedProfile.profile, hostname: loadedProfile.profile?.host, ...fakeProperties };
            delete transformedProps["host"];
            delete transformedProps["responseTimeout"];
            expect((api as any)._getSession(loadedProfile).mISession).toMatchObject(transformedProps);
        });
    });

    describe("updateAttributes", () => {
        const ussApi = new ZoweExplorerZosmf.UssApi(loadedProfile);
        const getSessionMock = vi.spyOn(ussApi, "getSession").mockReturnValue(fakeSession);
        const putUSSPayload = vi.spyOn(zosfiles.Utilities, "putUSSPayload").mockResolvedValue(Buffer.from("test"));

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
        const getProfileSessionWithVscProxySpy = vi.spyOn(ProfilesCache, "getProfileSessionWithVscProxy").mockImplementation((session) => {
            session.ISession.user = fakeProfile.user;
            session.ISession.password = fakeProfile.password;
            session.ISession.basePath = fakeProfile.basePath;
            return session;
        });
        let getDirectValueSpy: MockInstance;

        afterAll(() => {
            getProfileSessionWithVscProxySpy.mockRestore();
            getDirectValueSpy.mockRestore();
        });

        it("uploads a file from buffer", async () => {
            const uploadFileSpy = vi.spyOn(zosfiles.Upload, "bufferToUssFile").mockImplementation((() => undefined) as any);
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

        it("getSessionFromCommandArgument should build session from arguments and modify the session socket connection timeout", () => {
            const zosmfApi = new ZoweExplorerZosmf.UssApi(loadedProfile);
            getDirectValueSpy = vi.spyOn(VscSettings, "getDirectValue").mockReturnValueOnce(30000);
            const session = zosmfApi.getSessionFromCommandArgument(fakeProfile as unknown as imperative.ICommandArguments);
            expect(session).toBeDefined();
            const sessCfg: imperative.ISession = {
                ...fakeProfile,
                hostname: fakeProfile.host,
                type: imperative.SessConstants.AUTH_TYPE_BASIC,
                socketConnectTimeout: 30000,
            };
            delete sessCfg["host"];
            delete sessCfg["responseTimeout"];
            expect(session.ISession).toMatchObject(sessCfg);
            expect(getDirectValueSpy).toHaveBeenCalledTimes(2);
        });

        it("getSessionFromCommandArgument should build session from arguments and modify the session request connection timeout", () => {
            const zosmfApi = new ZoweExplorerZosmf.UssApi(loadedProfile);
            getDirectValueSpy = vi.spyOn(VscSettings, "getDirectValue").mockReturnValueOnce(undefined).mockReturnValueOnce(30000);
            const session = zosmfApi.getSessionFromCommandArgument(fakeProfile as unknown as imperative.ICommandArguments);
            expect(session).toBeDefined();
            const sessCfg: imperative.ISession = {
                ...fakeProfile,
                hostname: fakeProfile.host,
                type: imperative.SessConstants.AUTH_TYPE_BASIC,
                requestCompletionTimeout: 30000,
            };
            delete sessCfg["host"];
            delete sessCfg["responseTimeout"];
            expect(session.ISession).toMatchObject(sessCfg);
            expect(getDirectValueSpy).toHaveBeenCalledTimes(2);
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
            // Use clearAllMocks instead of resetAllMocks: under Vitest, resetAllMocks
            // also restores spies created at module load time, which would un-stub
            // the Zowe SDK entry points used by later tests in this file.
            vi.clearAllMocks();
            const zosmfApi = new ZoweExplorerZosmf.UssApi({} as unknown as imperative.IProfileLoaded);
            const loggerSpy = vi.spyOn(imperative.Logger.prototype, "error").mockReturnValue("");
            const session = zosmfApi.getSession();
            expect(session).toBeUndefined();
            expect(loggerSpy).toHaveBeenCalledTimes(1);
        });

        it("getStatus should validate active profile", async () => {
            const zosmfApi = new ZoweExplorerZosmf.UssApi(loadedProfile);
            const checkStatusSpy = vi.spyOn(zosmf.CheckStatus, "getZosmfInfo").mockResolvedValue({});
            const status = await zosmfApi.getStatus({ profile: fakeProfile } as unknown as imperative.IProfileLoaded, "zosmf");
            expect(status).toBe("active");
            expect(checkStatusSpy).toHaveBeenCalledTimes(1);
        });

        it("getStatus should validate inactive profile", async () => {
            const zosmfApi = new ZoweExplorerZosmf.UssApi(loadedProfile);
            const checkStatusSpy = vi.spyOn(zosmf.CheckStatus, "getZosmfInfo").mockResolvedValue(undefined as unknown as zosmf.IZosmfInfoResponse);
            const status = await zosmfApi.getStatus({ profile: fakeProfile } as unknown as imperative.IProfileLoaded, "zosmf");
            expect(status).toBe("inactive");
            expect(checkStatusSpy).toHaveBeenCalledTimes(1);
        });

        it("should test that copy calls zowe.Utilities.putUSSPayload", async () => {
            const api = new ZoweExplorerZosmf.UssApi(loadedProfile);
            api.getSession = vi.fn();
            const response = Buffer.from("hello world!");

            Object.defineProperty(zosfiles.Utilities, "putUSSPayload", {
                value: vi.fn().mockResolvedValue(response),
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
            const loginSpy = vi.spyOn(Login, "apimlLogin").mockResolvedValue("");
            const logoutSpy = vi.spyOn(Logout, "apimlLogout").mockResolvedValue();

            await zosmfApi.login(fakeSession);
            expect(loginSpy).toHaveBeenCalledWith(fakeSession);

            await zosmfApi.logout(fakeSession);
            expect(logoutSpy).toHaveBeenCalledWith(fakeSession);
        });

        it("should retrieve the tag of a file", async () => {
            const zosmfApi = new ZoweExplorerZosmf.UssApi(loadedProfile);
            vi.spyOn(JSON, "parse").mockReturnValue({
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
            const changeTagSpy = vi.fn();
            Object.defineProperty(zosfiles.Utilities, "putUSSPayload", {
                value: changeTagSpy,
                configurable: true,
            });
            await expect(zosmfApi.updateAttributes("/test/path", { tag: "utf-8" })).resolves.not.toThrow();
            expect(changeTagSpy).toHaveBeenCalledTimes(1);
        });

        it("calls putUSSPayload to move a directory from old path to new path", async () => {
            const api = new ZoweExplorerZosmf.UssApi(loadedProfile);
            const putUssPayloadSpy = vi.fn();
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
            spy: sharedSpyOn(zosfiles.Utilities, "isFileTagBinOrAscii"),
            args: ["ussPath"],
        },
        {
            name: "fileList",
            spy: sharedSpyOn(zosfiles.List, "fileList"),
            args: ["ussPath", fakeProperties],
        },
        {
            name: "isFileTagBinOrAscii",
            spy: sharedSpyOn(zosfiles.Utilities, "isFileTagBinOrAscii"),
            args: ["ussPath"],
        },
        {
            name: "getContents",
            spy: sharedSpyOn(zosfiles.Download, "ussFile"),
            args: ["ussPath", fakeProperties],
        },
        {
            name: "downloadDirectory",
            spy: sharedSpyOn(zosfiles.Download, "ussDir"),
            args: ["ussDirectoryPath", fakeProperties, undefined],
            transform: (args) => [args[0], fakeProperties, args[2]],
        },
        {
            name: "putContent",
            spy: sharedSpyOn(zosfiles.Upload, "fileToUssFile"),
            args: ["localPath", "ussPath", fakeProperties],
        },
        {
            name: "uploadDirectory",
            spy: sharedSpyOn(zosfiles.Upload, "dirToUSSDirRecursive"),
            args: ["localPath", "ussPath", fakeProperties],
        },
        {
            name: "create",
            spy: sharedSpyOn(zosfiles.Create, "uss"),
            args: ["ussPath", "file", "777", fakeProperties],
        },
        {
            name: "delete",
            spy: sharedSpyOn(zosfiles.Delete, "ussFile"),
            args: ["/ussPath", false, fakeProperties],
            transform: (args) => [args[0].slice(1), args[1], fakeProperties],
        },
        {
            name: "delete",
            spy: sharedSpyOn(zosfiles.Delete, "ussFile"),
            args: ["ussPath", false, fakeProperties],
        },
        {
            name: "rename",
            spy: sharedSpyOn(zosfiles.Utilities, "renameUSSFile"),
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
            spy: sharedSpyOn(zosfiles.List, "dataSet"),
            args: ["dsname", fakeProperties],
        },
        {
            name: "allMembers",
            spy: sharedSpyOn(zosfiles.List, "allMembers"),
            args: ["dsname", fakeProperties],
        },
        {
            name: "getContents",
            spy: sharedSpyOn(zosfiles.Download, "dataSet"),
            args: ["dsname", fakeProperties],
        },
        {
            name: "downloadAllMembers",
            spy: sharedSpyOn(zosfiles.Download, "allMembers"),
            args: ["dsname", fakeProperties],
        },
        {
            name: "putContents",
            spy: sharedSpyOn(zosfiles.Upload, "pathToDataSet"),
            args: ["localPath", "dsname", fakeProperties],
        },
        {
            name: "createDataSet",
            spy: sharedSpyOn(zosfiles.Create, "dataSet"),
            args: [0, "dsname", fakeProperties],
        },
        {
            name: "createDataSetMember",
            spy: sharedSpyOn(zosfiles.Upload, "bufferToDataSet"),
            args: ["dsname", fakeProperties],
            transform: (args) => [Buffer.from(""), ...args],
        },
        {
            name: "allocateLikeDataSet",
            spy: sharedSpyOn(zosfiles.Create, "dataSetLike"),
            args: ["dsname1", "dsname2", fakeProperties],
        },
        {
            name: "copyDataSetMember",
            spy: sharedSpyOn(zosfiles.Copy, "dataSet"),
            args: [
                { dsn: "dsname1", member: "member1" },
                { dsn: "dsname2", member: "member2" },
                { "from-dataset": { dsn: "dsname1", member: "member1" }, ...fakeProperties },
            ],
            transform: (args) => [args[1], args[2]],
        },
        {
            name: "copyDataSetMember",
            spy: sharedSpyOn(zosfiles.Copy, "dataSet"),
            args: [
                { dsn: "dsname1", member: "member1" },
                { dsn: "dsname2", member: "member2" },
            ],
            transform: (args) => [args[1], { "from-dataset": args[0], ...fakeProperties }],
        },
        {
            name: "copyDataSetMember",
            spy: sharedSpyOn(zosfiles.Copy, "dataSet"),
            args: [
                { dsn: "dsname1", member: "member1" },
                { dsn: "dsname2", member: "member2" },
            ],
            transform: (args) => [args[1], { "from-dataset": args[0], ...fakeProperties }],
        },
        {
            name: "renameDataSet",
            spy: sharedSpyOn(zosfiles.Rename, "dataSet"),
            args: ["dsname1", "dsname2", fakeProperties],
        },
        {
            name: "renameDataSetMember",
            spy: sharedSpyOn(zosfiles.Rename, "dataSetMember"),
            args: ["dsname", "member1", "member2", fakeProperties],
        },
        {
            name: "hMigrateDataSet",
            spy: sharedSpyOn(zosfiles.HMigrate, "dataSet"),
            args: ["dsname", fakeProperties],
        },
        {
            name: "hRecallDataSet",
            spy: sharedSpyOn(zosfiles.HRecall, "dataSet"),
            args: ["dsname", fakeProperties],
        },
        {
            name: "deleteDataSet",
            spy: sharedSpyOn(zosfiles.Delete, "dataSet"),
            args: ["dsname", fakeProperties],
        },
        {
            name: "deleteDataSet",
            spy: sharedSpyOn(zosfiles.Delete, "vsam"),
            args: ["dsname", { volume: "*VSAM*", ...fakeProperties }],
        },
        {
            name: "dataSetsMatchingPattern",
            spy: sharedSpyOn(zosfiles.List, "dataSetsMatchingPattern"),
            args: [["SAMPLE.A*", "SAMPLE.B*"], fakeProperties],
        },
        {
            name: "searchDataSets",
            spy: sharedSpyOn(zosfiles.Search, "dataSets"),
            args: [{ pattern: "SAMPLE.A*", searchString: "test", listOptions: { ...fakeProperties }, getOptions: { ...fakeProperties } }],
        },
        {
            name: "copyDataSet",
            spy: sharedSpyOn(zosfiles.Copy, "dataSet"),
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
        const uploadFileSpy = vi.spyOn(zosfiles.Upload, "bufferToDataSet").mockImplementation((() => undefined) as any);
        const zosmfApi = new ZoweExplorerZosmf.MvsApi(loadedProfile);
        const buf = Buffer.from("123abc");
        await zosmfApi.uploadFromBuffer(buf, "SOME.DS(MEMB)");
        expect(uploadFileSpy).toHaveBeenCalledWith(zosmfApi.getSession(), buf, "SOME.DS(MEMB)", fakeProperties);
    });

    it("Test copyDataSetCrossLpar()", async () => {
        const copySpy = vi.spyOn(zosfiles.Copy, "dataSetCrossLPAR").mockImplementation((() => undefined) as any);
        const zosmfApi = new ZoweExplorerZosmf.MvsApi(loadedProfile);
        await zosmfApi.copyDataSetCrossLpar("TO.NAME", "TO.MEMBER", undefined as any, loadedProfile);
        expect(copySpy).toHaveBeenCalled();
    });

    describe("deleteDataSet with undefined options", () => {
        it("should call Delete.dataSet and not throw TypeError when options is undefined", () => {
            const mvsApi = new ZoweExplorerZosmf.MvsApi(loadedProfile);
            const deleteDataSetSpy = vi.spyOn(zosfiles.Delete, "dataSet").mockResolvedValue({ success: true });
            const deleteVsamSpy = vi.spyOn(zosfiles.Delete, "vsam").mockResolvedValue({ success: true });

            deleteDataSetSpy.mockClear();
            deleteVsamSpy.mockClear();

            expect(async () => {
                await mvsApi.deleteDataSet("DATASET.NAME", undefined);
            }).not.toThrow();

            expect(deleteDataSetSpy).toHaveBeenCalled();
            expect(deleteVsamSpy).not.toHaveBeenCalled();
            expect(deleteDataSetSpy).toHaveBeenCalledWith(
                expect.any(Object), // session
                "DATASET.NAME",
                expect.objectContaining({ responseTimeout: 60 })
            );
        });
    });

    describe("MvsApi.getCount", () => {
        let mvsApi: ZoweExplorerZosmf.MvsApi;
        let dataSetsMatchingPatternSpy: MockInstance;
        const patterns = ["SAMPLE.A*", "SAMPLE.B*"];
        beforeEach(() => {
            vi.clearAllMocks();
            mvsApi = new ZoweExplorerZosmf.MvsApi(loadedProfile);
            dataSetsMatchingPatternSpy = vi.spyOn(zosfiles.List, "dataSetsMatchingPattern");
        });
        test("returns correct count when successful and response is array", async () => {
            const mockResponse = {
                success: true,
                apiResponse: [{ dsname: "DATASET1" }, { dsname: "DATASET2" }],
            };
            dataSetsMatchingPatternSpy.mockResolvedValueOnce(mockResponse);
            const result = await mvsApi.getCount(patterns);
            expect(result).toStrictEqual({ count: 2, lastItem: "DATASET2" });
            expect(dataSetsMatchingPatternSpy).toHaveBeenCalledWith(
                expect.any(Object), // session
                patterns,
                expect.objectContaining({ attributes: false }) // options
            );
        });
        test("returns 0 when response is not successful", async () => {
            const mockResponse = {
                success: false,
                apiResponse: [],
            };
            dataSetsMatchingPatternSpy.mockResolvedValueOnce(mockResponse);
            const result = await mvsApi.getCount(patterns);
            expect(result).toStrictEqual({ count: 0, lastItem: undefined });
        });
        test("returns 0 when apiResponse is empty or undefined", async () => {
            const mockResponse = {
                success: true,
                apiResponse: undefined,
            };
            dataSetsMatchingPatternSpy.mockResolvedValueOnce(mockResponse);
            const result = await mvsApi.getCount(patterns);
            expect(result).toStrictEqual({ count: 0, lastItem: undefined });
        });
        test("handles mixed format: array and items fallback", async () => {
            const mockResponse = {
                success: true,
                apiResponse: {
                    items: [{ dsname: "DS1" }, { dsname: "DS2" }, { dsname: "DS3" }, { dsname: "DS4" }], // 4 items
                },
            };
            dataSetsMatchingPatternSpy.mockResolvedValueOnce(mockResponse);
            const result = await mvsApi.getCount(patterns);
            expect(result).toStrictEqual({ count: 4, lastItem: "DS4" });
        });
    });
});

describe("ZosmfJesApi", () => {
    const jesApis: ITestApi<ZoweExplorerZosmf.JesApi>[] = [
        {
            name: "getJobsByParameters",
            spy: sharedSpyOn(zosjobs.GetJobs, "getJobsByParameters"),
            args: [{}],
        },
        {
            name: "getJob",
            spy: sharedSpyOn(zosjobs.GetJobs, "getJob"),
            args: ["jobid"],
        },
        {
            name: "getSpoolFiles",
            spy: sharedSpyOn(zosjobs.GetJobs, "getSpoolFiles"),
            args: ["jobname", "jobid"],
        },
        {
            name: "downloadSpoolContent",
            spy: sharedSpyOn(zosjobs.DownloadJobs, "downloadAllSpoolContentCommon"),
            args: [{ jobname: "jobname", jobid: "jobid" }],
        },
        {
            name: "downloadSingleSpool",
            spy: sharedSpyOn(zosjobs.DownloadJobs, "downloadSpoolContentCommon"),
            args: [{ jobname: "jobname", jobid: "jobid" }],
        },
        {
            name: "getSpoolContentById",
            spy: sharedSpyOn(zosjobs.GetJobs, "getSpoolContentById"),
            args: ["jobname", "jobid", 100, undefined],
        },
        {
            name: "getJclForJob",
            spy: sharedSpyOn(zosjobs.GetJobs, "getJclCommon"),
            args: [{} as any],
        },
        {
            name: "submitJcl",
            spy: sharedSpyOn(zosjobs.SubmitJobs, "submitJcl"),
            args: ["jcl", "FB", "80", undefined],
        },
        {
            name: "submitJob",
            spy: sharedSpyOn(zosjobs.SubmitJobs, "submitJob"),
            args: ["dsname"],
        },
        {
            name: "deleteJob",
            spy: sharedSpyOn(zosjobs.DeleteJobs, "deleteJob"),
            args: ["jobname", "jobid"],
        },
        {
            name: "deleteJobWithInfo",
            spy: sharedSpyOn(zosjobs.DeleteJobs, "deleteJob"),
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
        const cancelJobForJob = vi.fn();

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

    describe("submitJcl", () => {
        it("uses job encoding if specified in profile", async () => {
            const api = new ZoweExplorerZosmf.JesApi();
            api.profile = {
                profile: {
                    jobEncoding: "IBM-1147",
                },
            } as unknown as imperative.IProfileLoaded;
            const submitJclSpy = vi.spyOn(zosjobs.SubmitJobs, "submitJcl");
            await api.submitJcl("iefbr14");
            expect(submitJclSpy).toHaveBeenLastCalledWith(undefined, "iefbr14", undefined, undefined, "IBM-1147");
        });
    });

    describe("submitJob", () => {
        it("uses encoding if specified in profile", async () => {
            const api = new ZoweExplorerZosmf.JesApi();
            api.profile = {
                profile: {
                    encoding: "IBM-1047",
                    jobEncoding: "IBM-1147",
                },
            } as unknown as imperative.IProfileLoaded;
            const getDatasetSpy = vi.spyOn(zosfiles.Get, "dataSet").mockResolvedValue(Buffer.from("fakeJcl"));
            const submitJclSpy = vi.spyOn(zosjobs.SubmitJobs, "submitJcl");
            await api.submitJob("IBMUSER.JCL(IEFBR14)");
            expect(getDatasetSpy).toHaveBeenLastCalledWith(undefined, "IBMUSER.JCL(IEFBR14)", { encoding: "IBM-1047" });
            expect(submitJclSpy).toHaveBeenLastCalledWith(undefined, "fakeJcl", undefined, undefined, "IBM-1147");
        });
    });
});

describe("ZosmfCommandApi", () => {
    const SshSessionobj = new zosuss.SshSession(mISshSession);
    const commandApis: ITestApi<ZoweExplorerZosmf.CommandApi>[] = [
        {
            name: "issueTsoCommandWithParms",
            spy: sharedSpyOn(zostso.IssueTso, "issueTsoCommand"),
            args: ["command", { account: "ACCT#" }],
            transform: (args) => [args[1].account, ...args],
        },
        {
            name: "issueTsoCommandWithParms",
            spy: sharedSpyOn(zostso.IssueTso, "issueTsoCmd"),
            args: ["command", { account: "ACCT#" }, true],
            transform: () => ["command", { addressSpaceOptions: { account: "ACCT#" } }],
        },
        {
            name: "issueMvsCommand",
            spy: sharedSpyOn(zosconsole.IssueCommand, "issue"),
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
            spy: sharedSpyOn(zosuss.Shell, "executeSshCwd"),
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
