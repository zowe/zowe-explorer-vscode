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
import { ZoweExplorerApi } from "../../../src/api/ZoweExplorerApi";
import { ZoweExplorerApiRegister } from "../../../src/api/ZoweExplorerApiRegister";
import { ZosmfUssApi, ZosmfJesApi, ZosmfMvsApi } from "../../../src/api/ZoweExplorerZosmfApi";
import { Profiles } from "../../../src/Profiles";

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
        inputFilePath: string, ussFilePath: string, binary?: boolean,
        localEncoding?: string, etag?: string, returnEtag?: boolean): Promise<zowe.IZosFilesResponse> {
        throw new Error("Method not implemented.");
    }
    public uploadDirectory(inputDirectoryPath: string, ussDirectoryPath: string, options: zowe.IUploadOptions): Promise<zowe.IZosFilesResponse> {
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
        inputFilePath: string, ussFilePath: string, binary?: boolean,
        localEncoding?: string, etag?: string, returnEtag?: boolean): Promise<zowe.IZosFilesResponse> {
        throw new Error("Method not implemented.");
    }
    public uploadDirectory(inputDirectoryPath: string, ussDirectoryPath: string, options: zowe.IUploadOptions): Promise<zowe.IZosFilesResponse> {
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
}

describe("ZoweExplorerApiRegister unit testing", () => {

    const log = Logger.getAppLogger();
    let profiles: Profiles;
    beforeEach(async () => {
        profiles = await Profiles.createInstance(log);
    });

    const registry = ZoweExplorerApiRegister.getInstance();

    it("registers an API only once per profile type", async () => {
        const defaultProfile = profiles.getDefaultProfile();

        const defaultUssApi = registry.getUssApi(defaultProfile);
        registry.registerUssApi(new ZosmfUssApi());
        const anotherUssApiInstance = registry.getUssApi(defaultProfile);
        expect(anotherUssApiInstance).toEqual(defaultUssApi);

        const defaultMvsApi = registry.getMvsApi(defaultProfile);
        registry.registerMvsApi(new ZosmfMvsApi());
        const anotherMvsApiInstance = registry.getMvsApi(defaultProfile);
        expect(anotherMvsApiInstance).toEqual(defaultMvsApi);

        const defaultJesApi = registry.getJesApi(defaultProfile);
        registry.registerJesApi(new ZosmfJesApi());
        const anotherJesApiInstance = registry.getJesApi(defaultProfile);
        expect(anotherJesApiInstance).toEqual(defaultJesApi);
    });

    it("registers multiple API instances in parallel", async () => {
        const mockRefresh = jest.fn(async (): Promise<void> => {return;});
        const profilesForValidation = {status: "active", name: "fake"};
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    refresh: mockRefresh,
                    checkCurrentProfile: jest.fn(() => {
                        return profilesForValidation;
                    }),
                    validateProfiles: jest.fn(),
                };
            })
        });

        const api1 = new MockUssApi1();
        const api2 = new MockUssApi2();

        registry.registerUssApi(api1);
        registry.getExplorerExtenderApi().reloadProfiles();
        registry.registerUssApi(api2);
        await registry.getExplorerExtenderApi().reloadProfiles();

        expect(mockRefresh.mock.calls.length).toBe(2);
    });

    it("throws errors when registering invalid APIs", () => {
        const api1 = new MockUssApi1();
        const mockGetProfileTypeName = jest.fn(() => undefined);
        api1.getProfileTypeName = mockGetProfileTypeName;
        expect(() => {registry.registerUssApi(api1);}).toThrow();
        expect(() => {registry.registerUssApi(undefined);}).toThrow();

        const mvsApi = new ZosmfMvsApi();
        mvsApi.getProfileTypeName = mockGetProfileTypeName;
        expect(() => {registry.registerMvsApi(mvsApi);}).toThrow();
        expect(() => {registry.registerMvsApi(undefined);}).toThrow();

        const jesApi = new ZosmfJesApi();
        jesApi.getProfileTypeName = mockGetProfileTypeName;
        expect(() => {registry.registerJesApi(jesApi);}).toThrow();
        expect(() => {registry.registerJesApi(undefined);}).toThrow();
    });

    it("throws errors when invalid APIs requested", () => {
        expect(() => {registry.getUssApi(undefined);}).toThrow();
        expect(() => {registry.getMvsApi(undefined);}).toThrow();
        expect(() => {registry.getJesApi(undefined);}).toThrow();
    });

    it("provides access to the common api for a profile registered to any api regsitry", () => {
        const defaultProfile = profiles.getDefaultProfile();
        const ussApi = ZoweExplorerApiRegister.getUssApi(defaultProfile);
        const profileUnused: IProfileLoaded = {
            name: "profileUnused",
            profile: {
                user: undefined,
                password: undefined
            },
            type: "zftp",
            message: "",
            failNotFound: false
        };

        expect(ZoweExplorerApiRegister.getCommonApi(defaultProfile)).toEqual(ussApi);
        expect(ZoweExplorerApiRegister.getCommonApi(defaultProfile).getProfileTypeName()).toEqual(defaultProfile.type);
        expect(() => {ZoweExplorerApiRegister.getCommonApi(profileUnused);}).toThrow();
    });
});
