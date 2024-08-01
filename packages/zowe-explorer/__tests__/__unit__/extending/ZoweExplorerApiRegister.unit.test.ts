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

import * as zosfiles from "@zowe/zos-files-for-zowe-sdk";
import { imperative, MainframeInteraction, ZoweExplorerZosmf, ZoweScheme } from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "../../../src/extending/ZoweExplorerApiRegister";
import { createInstanceOfProfile, createValidIProfile } from "../../__mocks__/mockCreators/shared";
import { ZoweExplorerExtender } from "../../../src/extending/ZoweExplorerExtender";
import { DatasetFSProvider } from "../../../src/trees/dataset/DatasetFSProvider";
import { JobFSProvider } from "../../../src/trees/job/JobFSProvider";
import { UssFSProvider } from "../../../src/trees/uss/UssFSProvider";

class MockUssApi1 implements MainframeInteraction.IUss {
    public profile?: imperative.IProfileLoaded;
    public getProfileTypeName(): string {
        return "api1typename";
    }
    public fileList(_ussFilePath: string): Promise<zosfiles.IZosFilesResponse> {
        throw new Error("Method not implemented.");
    }
    public copy(_outputPath: string, _options?: Omit<object, "request">): Promise<Buffer> {
        throw new Error("Method not implemented.");
    }
    public isFileTagBinOrAscii(_ussFilePath: string): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
    public getContents(_ussFilePath: string, _options: zosfiles.IDownloadOptions): Promise<zosfiles.IZosFilesResponse> {
        throw new Error("Method not implemented.");
    }
    public putContents(
        _inputFilePath: string,
        _ussFilePath: string,
        _binary?: boolean,
        _localEncoding?: string,
        _etag?: string,
        _returnEtag?: boolean
    ): Promise<zosfiles.IZosFilesResponse> {
        throw new Error("Method not implemented.");
    }
    public putContent(_inputFilePath: string, _ussFilePath: string, _options: zosfiles.IUploadOptions): Promise<zosfiles.IZosFilesResponse> {
        throw new Error("Method not implemented.");
    }
    public uploadDirectory(
        _inputDirectoryPath: string,
        _ussDirectoryPath: string,
        _options: zosfiles.IUploadOptions
    ): Promise<zosfiles.IZosFilesResponse> {
        throw new Error("Method not implemented.");
    }
    public create(_ussPath: string, _type: string, _mode?: string): Promise<zosfiles.IZosFilesResponse> {
        throw new Error("Method not implemented.");
    }
    public delete(_ussPath: string, _recursive?: boolean): Promise<zosfiles.IZosFilesResponse> {
        throw new Error("Method not implemented.");
    }
    public rename(_currentUssPath: string, _newUssPath: string): Promise<zosfiles.IZosFilesResponse> {
        throw new Error("Method not implemented.");
    }
    public getSession(_profile?: imperative.IProfileLoaded): imperative.Session {
        throw new Error("Method not implemented.");
    }
    public getStatus?(_profile?: imperative.IProfileLoaded): Promise<string> {
        throw new Error("Method not implemented.");
    }
    public getTokenTypeName?(): string {
        throw new Error("Method not implemented.");
    }
    public login?(_session: imperative.Session): Promise<string> {
        throw new Error("Method not implemented.");
    }
    public logout?(_session: imperative.Session): Promise<string> {
        throw new Error("Method not implemented.");
    }
}

class MockUssApi2 extends MockUssApi1 {}

function createGlobalMocks() {
    const newMocks = {
        registry: ZoweExplorerApiRegister.getInstance(),
        testProfile: createValidIProfile(),
        mockGetInstance: jest.fn(),
        profiles: null,
    };
    newMocks.profiles = createInstanceOfProfile(newMocks.testProfile);
    newMocks.profiles.getDefaultProfile.mockReturnValue({
        name: "sestest",
        profile: {
            host: "host.com",
            user: "fake",
            password: "fake",
            rejectUnauthorized: true,
            protocol: "https",
        },
        type: "zosmf",
        message: "",
        failNotFound: false,
    });

    return newMocks;
}
afterEach(() => {
    jest.resetAllMocks();
});

describe("ZoweExplorerApiRegister unit testing", () => {
    it("registers an API only once per profile type", () => {
        const globalMocks = createGlobalMocks();
        const defaultProfile = globalMocks.profiles.getDefaultProfile();

        const defaultUssApi = globalMocks.registry.getUssApi(defaultProfile);
        globalMocks.registry.registerUssApi(new ZoweExplorerZosmf.UssApi());
        const anotherUssApiInstance = globalMocks.registry.getUssApi(defaultProfile);
        expect(anotherUssApiInstance).toEqual(defaultUssApi);

        const defaultMvsApi = globalMocks.registry.getMvsApi(defaultProfile);
        globalMocks.registry.registerMvsApi(new ZoweExplorerZosmf.MvsApi());
        const anotherMvsApiInstance = globalMocks.registry.getMvsApi(defaultProfile);
        expect(anotherMvsApiInstance).toEqual(defaultMvsApi);

        const defaultJesApi = globalMocks.registry.getJesApi(defaultProfile);
        globalMocks.registry.registerJesApi(new ZoweExplorerZosmf.JesApi());
        const anotherJesApiInstance = globalMocks.registry.getJesApi(defaultProfile);
        expect(anotherJesApiInstance).toEqual(defaultJesApi);
    });

    it("registers multiple API instances in parallel", async () => {
        const globalMocks = createGlobalMocks();
        const mockRefresh = jest.fn((): Promise<void> => {
            return new Promise((resolve) => resolve());
        });
        const profilesForValidation = { status: "active", name: "fake" };
        Object.defineProperty(ZoweExplorerExtender.prototype, "getProfilesCache", {
            value: jest.fn(() => {
                return {
                    refresh: mockRefresh,
                    checkCurrentProfile: jest.fn(() => {
                        return profilesForValidation;
                    }),
                    validateProfiles: jest.fn(),
                };
            }),
        });

        const api1 = new MockUssApi1();
        const api2 = new MockUssApi2();

        globalMocks.registry.registerUssApi(api1);
        await globalMocks.registry.getExplorerExtenderApi().reloadProfiles();
        globalMocks.registry.registerUssApi(api2);
        await globalMocks.registry.getExplorerExtenderApi().reloadProfiles();

        expect(mockRefresh.mock.calls.length).toBe(2);
    });

    it("throws errors when registering invalid APIs", () => {
        const globalMocks = createGlobalMocks();
        const api1 = new MockUssApi1();
        const mockGetProfileTypeName = jest.fn(() => undefined);
        api1.getProfileTypeName = mockGetProfileTypeName;
        expect(() => {
            globalMocks.registry.registerUssApi(api1);
        }).toThrow();
        expect(() => {
            globalMocks.registry.registerUssApi(undefined);
        }).toThrow();

        const mvsApi = new ZoweExplorerZosmf.MvsApi();
        mvsApi.getProfileTypeName = mockGetProfileTypeName;
        expect(() => {
            globalMocks.registry.registerMvsApi(mvsApi);
        }).toThrow();
        expect(() => {
            globalMocks.registry.registerMvsApi(undefined);
        }).toThrow();

        const jesApi = new ZoweExplorerZosmf.JesApi();
        jesApi.getProfileTypeName = mockGetProfileTypeName;
        expect(() => {
            globalMocks.registry.registerJesApi(jesApi);
        }).toThrow();
        expect(() => {
            globalMocks.registry.registerJesApi(undefined);
        }).toThrow();
    });

    it("throws errors when invalid APIs requested", () => {
        const globalMocks = createGlobalMocks();
        const invalidProfile = {
            type: "invalid_profile_type",
        } as imperative.IProfileLoaded;
        expect(() => {
            globalMocks.registry.getUssApi(undefined);
        }).toThrow();
        expect(() => {
            globalMocks.registry.getMvsApi(undefined);
        }).toThrow();
        expect(() => {
            globalMocks.registry.getJesApi(undefined);
        }).toThrow();
        expect(() => {
            ZoweExplorerApiRegister.getCommonApi(invalidProfile);
        }).toThrow("Internal error: Tried to call a non-existing Common API in API register: invalid_profile_type");
        expect(() => {
            ZoweExplorerApiRegister.getCommandApi(invalidProfile);
        }).toThrow("Internal error: Tried to call a non-existing Command API in API register: invalid_profile_type");
    });

    it("returns an API extender instance for getExplorerExtenderApi()", () => {
        const explorerExtenderApiSpy = jest.spyOn(ZoweExplorerApiRegister.getInstance(), "getExplorerExtenderApi");
        ZoweExplorerApiRegister.getExplorerExtenderApi();
        expect(explorerExtenderApiSpy).toHaveBeenCalled();
    });

    it("provides access to the common api for a profile registered to any api regsitry", () => {
        const globalMocks = createGlobalMocks();
        const defaultProfile = globalMocks.profiles.getDefaultProfile();
        const ussApi = ZoweExplorerApiRegister.getUssApi(defaultProfile);
        const profileUnused: imperative.IProfileLoaded = {
            name: "profileUnused",
            profile: {
                user: undefined,
                password: undefined,
            },
            type: "zftp",
            message: "",
            failNotFound: false,
        };

        expect(ZoweExplorerApiRegister.getCommonApi(defaultProfile)).toEqual(ussApi);
        expect(ZoweExplorerApiRegister.getCommonApi(defaultProfile).getProfileTypeName()).toEqual(defaultProfile.type);
        expect(() => {
            ZoweExplorerApiRegister.getCommonApi(profileUnused);
        }).toThrow();
    });

    it("provides access to the callback defined by the extender if available", () => {
        Object.defineProperty(ZoweExplorerApiRegister.getInstance().onProfilesUpdateEmitter, "event", {
            value: {},
            configurable: true,
        });
        expect(ZoweExplorerApiRegister.getInstance().onProfilesUpdate).toEqual({});
    });

    it("provides access to the onVaultUpdate callback defined by the extender if available", () => {
        Object.defineProperty(ZoweExplorerApiRegister.getInstance().onVaultUpdateEmitter, "event", {
            value: {},
            configurable: true,
        });
        expect(ZoweExplorerApiRegister.getInstance().onVaultUpdate).toEqual({});
    });

    it("provides access to the onCredMgrUpdate callback defined by the extender if available", () => {
        Object.defineProperty(ZoweExplorerApiRegister.getInstance().onCredMgrUpdateEmitter, "event", {
            value: {},
            configurable: true,
        });
        expect(ZoweExplorerApiRegister.getInstance().onCredMgrUpdate).toEqual({});
    });

    it("provides access to the callback defined by the extender if available", () => {
        Object.defineProperty(ZoweExplorerApiRegister.getInstance().onProfilesUpdateEmitter, "event", {
            value: {},
            configurable: true,
        });
        expect(ZoweExplorerApiRegister.getInstance().onProfilesUpdate).toEqual({});
    });

    it("provides access to the appropriate event for onResourceChanged", () => {
        expect(ZoweExplorerApiRegister.onResourceChanged(ZoweScheme.DS)).toBe(DatasetFSProvider.instance.onDidChangeFile);
    });

    it("provides access to the onUssChanged event", () => {
        expect(ZoweExplorerApiRegister.onResourceChanged(ZoweScheme.USS)).toBe(UssFSProvider.instance.onDidChangeFile);
    });

    it("provides access to the onJobChanged event", () => {
        expect(ZoweExplorerApiRegister.onResourceChanged(ZoweScheme.Jobs)).toBe(JobFSProvider.instance.onDidChangeFile);
    });
});
