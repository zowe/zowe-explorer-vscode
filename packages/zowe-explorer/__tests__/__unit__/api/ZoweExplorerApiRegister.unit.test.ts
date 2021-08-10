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

// tslint:disable: max-classes-per-file

jest.mock("@zowe/imperative");
import * as zowe from "@zowe/cli";
import { Logger, IProfileLoaded, Session } from "@zowe/imperative";
import { ZoweExplorerApi, ZosmfUssApi, ZosmfJesApi, ZosmfMvsApi, ProfilesCache } from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "../../../src/ZoweExplorerApiRegister";
import { Profiles } from "../../../src/Profiles";
import { createInstanceOfProfile, createValidIProfile } from "../../../__mocks__/mockCreators/shared";

class MockUssApi1 implements ZoweExplorerApi.IUss {
    public profile?: IProfileLoaded;
    public getProfileTypeName(): string {
        return "api1typename";
    }
    public fileList(ussFilePath: string): Promise<zowe.IZosFilesResponse> {
        throw new Error("Method not implemented.");
    }
    public isFileTagBinOrAscii(ussFilePath: string): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
    public getContents(ussFilePath: string, options: zowe.IDownloadOptions): Promise<zowe.IZosFilesResponse> {
        throw new Error("Method not implemented.");
    }
    public putContents(
        inputFilePath: string,
        ussFilePath: string,
        binary?: boolean,
        localEncoding?: string,
        etag?: string,
        returnEtag?: boolean
    ): Promise<zowe.IZosFilesResponse> {
        throw new Error("Method not implemented.");
    }
    public putContent(
        inputFilePath: string,
        ussFilePath: string,
        options: zowe.IUploadOptions
    ): Promise<zowe.IZosFilesResponse> {
        throw new Error("Method not implemented.");
    }
    public uploadDirectory(
        inputDirectoryPath: string,
        ussDirectoryPath: string,
        options: zowe.IUploadOptions
    ): Promise<zowe.IZosFilesResponse> {
        throw new Error("Method not implemented.");
    }
    public create(ussPath: string, type: string, mode?: string): Promise<zowe.IZosFilesResponse> {
        throw new Error("Method not implemented.");
    }
    public delete(ussPath: string, recursive?: boolean): Promise<zowe.IZosFilesResponse> {
        throw new Error("Method not implemented.");
    }
    public rename(currentUssPath: string, newUssPath: string): Promise<zowe.IZosFilesResponse> {
        throw new Error("Method not implemented.");
    }
    public getSession(profile?: IProfileLoaded): Session {
        throw new Error("Method not implemented.");
    }
    public getStatus?(profile?: IProfileLoaded): Promise<string> {
        throw new Error("Method not implemented.");
    }
    public getTokenTypeName?(): string {
        throw new Error("Method not implemented.");
    }
    public login?(session: Session): Promise<string> {
        throw new Error("Method not implemented.");
    }
    public logout?(session: Session): Promise<string> {
        throw new Error("Method not implemented.");
    }
}

class MockUssApi2 implements ZoweExplorerApi.IUss {
    public profile?: IProfileLoaded;
    public getProfileTypeName(): string {
        return "api2typename";
    }
    public fileList(ussFilePath: string): Promise<zowe.IZosFilesResponse> {
        throw new Error("Method not implemented.");
    }
    public isFileTagBinOrAscii(ussFilePath: string): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
    public getContents(ussFilePath: string, options: zowe.IDownloadOptions): Promise<zowe.IZosFilesResponse> {
        throw new Error("Method not implemented.");
    }
    public putContents(
        inputFilePath: string,
        ussFilePath: string,
        binary?: boolean,
        localEncoding?: string,
        etag?: string,
        returnEtag?: boolean
    ): Promise<zowe.IZosFilesResponse> {
        throw new Error("Method not implemented.");
    }
    public putContent(
        inputFilePath: string,
        ussFilePath: string,
        options: zowe.IUploadOptions
    ): Promise<zowe.IZosFilesResponse> {
        throw new Error("Method not implemented.");
    }
    public uploadDirectory(
        inputDirectoryPath: string,
        ussDirectoryPath: string,
        options: zowe.IUploadOptions
    ): Promise<zowe.IZosFilesResponse> {
        throw new Error("Method not implemented.");
    }
    public create(ussPath: string, type: string, mode?: string): Promise<zowe.IZosFilesResponse> {
        throw new Error("Method not implemented.");
    }
    public delete(ussPath: string, recursive?: boolean): Promise<zowe.IZosFilesResponse> {
        throw new Error("Method not implemented.");
    }
    public rename(currentUssPath: string, newUssPath: string): Promise<zowe.IZosFilesResponse> {
        throw new Error("Method not implemented.");
    }
    public getSession(profile?: IProfileLoaded): Session {
        throw new Error("Method not implemented.");
    }
    public getStatus?(profile?: IProfileLoaded): Promise<string> {
        throw new Error("Method not implemented.");
    }
    public getTokenTypeName?(): string {
        throw new Error("Method not implemented.");
    }
    public login?(session: Session): Promise<string> {
        throw new Error("Method not implemented.");
    }
    public logout?(session: Session): Promise<string> {
        throw new Error("Method not implemented.");
    }
}

describe("ZoweExplorerApiRegister unit testing", () => {
    async function createBlockMocks() {
        const newMocks = {
            log: Logger.getAppLogger(),
            testProfile: createValidIProfile(),
            registry: ZoweExplorerApiRegister.getInstance(),
        };

        const mockProfileInstance = jest.fn();
        mockProfileInstance.mockReturnValue(createInstanceOfProfile(newMocks.testProfile));

        Object.defineProperty(ProfilesCache, "getConfigInstance", {
            value: jest.fn(() => {
                return {
                    usingTeamConfig: false,
                    getAllProfiles: jest.fn(),
                    mergeArgsForProfile: jest.fn(),
                };
            }),
            configurable: true,
        });

        return newMocks;
    }

    beforeEach(async () => {
        jest.fn().mockReset;
    });

    it("registers an API only once per profile type", async () => {
        const blockMocks = await createBlockMocks();

        const defaultUssApi = blockMocks.registry.getUssApi(blockMocks.testProfile);
        blockMocks.registry.registerUssApi(new ZosmfUssApi());
        const anotherUssApiInstance = blockMocks.registry.getUssApi(blockMocks.testProfile);
        expect(anotherUssApiInstance).toEqual(defaultUssApi);

        const defaultMvsApi = blockMocks.registry.getMvsApi(blockMocks.testProfile);
        blockMocks.registry.registerMvsApi(new ZosmfMvsApi());
        const anotherMvsApiInstance = blockMocks.registry.getMvsApi(blockMocks.testProfile);
        expect(anotherMvsApiInstance).toEqual(defaultMvsApi);

        const defaultJesApi = blockMocks.registry.getJesApi(blockMocks.testProfile);
        blockMocks.registry.registerJesApi(new ZosmfJesApi());
        const anotherJesApiInstance = blockMocks.registry.getJesApi(blockMocks.testProfile);
        expect(anotherJesApiInstance).toEqual(defaultJesApi);
    });

    it("registers multiple API instances in parallel", async () => {
        const blockMocks = await createBlockMocks();
        const mockRefresh = jest.fn(
            async (): Promise<void> => {
                return;
            }
        );
        const profilesForValidation = { status: "active", name: "fake" };
        Object.defineProperty(Profiles, "getInstance", {
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

        blockMocks.registry.registerUssApi(api1);
        blockMocks.registry.getExplorerExtenderApi().reloadProfiles();
        blockMocks.registry.registerUssApi(api2);
        await blockMocks.registry.getExplorerExtenderApi().reloadProfiles();

        expect(mockRefresh.mock.calls.length).toBe(2);
    });

    it("throws errors when registering invalid APIs", async () => {
        const blockMocks = await createBlockMocks();
        const api1 = new MockUssApi1();
        const mockGetProfileTypeName = jest.fn(() => undefined);
        api1.getProfileTypeName = mockGetProfileTypeName;
        expect(() => {
            blockMocks.registry.registerUssApi(api1);
        }).toThrow();
        expect(() => {
            blockMocks.registry.registerUssApi(undefined);
        }).toThrow();

        const mvsApi = new ZosmfMvsApi();
        mvsApi.getProfileTypeName = mockGetProfileTypeName;
        expect(() => {
            blockMocks.registry.registerMvsApi(mvsApi);
        }).toThrow();
        expect(() => {
            blockMocks.registry.registerMvsApi(undefined);
        }).toThrow();

        const jesApi = new ZosmfJesApi();
        jesApi.getProfileTypeName = mockGetProfileTypeName;
        expect(() => {
            blockMocks.registry.registerJesApi(jesApi);
        }).toThrow();
        expect(() => {
            blockMocks.registry.registerJesApi(undefined);
        }).toThrow();
    });

    it("throws errors when invalid APIs requested", async () => {
        const blockMocks = await createBlockMocks();
        expect(() => {
            blockMocks.registry.getUssApi(undefined);
        }).toThrow();
        expect(() => {
            blockMocks.registry.getMvsApi(undefined);
        }).toThrow();
        expect(() => {
            blockMocks.registry.getJesApi(undefined);
        }).toThrow();
    });

    it("provides access to the common api for a profile registered to any api regsitry", async () => {
        const blockMocks = await createBlockMocks();
        const ussApi = ZoweExplorerApiRegister.getUssApi(blockMocks.testProfile);
        const profileUnused: IProfileLoaded = {
            name: "profileUnused",
            profile: {
                user: undefined,
                password: undefined,
            },
            type: "zftp",
            message: "",
            failNotFound: false,
        };

        expect(ZoweExplorerApiRegister.getCommonApi(blockMocks.testProfile)).toEqual(ussApi);
        expect(ZoweExplorerApiRegister.getCommonApi(blockMocks.testProfile).getProfileTypeName()).toEqual(
            blockMocks.testProfile.type
        );
        expect(() => {
            ZoweExplorerApiRegister.getCommonApi(profileUnused);
        }).toThrow();
    });
});
