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

import * as fs from "fs";
import * as path from "path";
import * as zowe from "@zowe/cli";
import { ProfilesCache } from "../../../src/profiles/ProfilesCache";

jest.mock("fs");
jest.mock("@zowe/cli", () => {
    /* eslint-disable @typescript-eslint/no-unsafe-return */
    return {
        ...jest.requireActual("@zowe/cli"),
        getZoweDir: jest.fn().mockReturnValue("~/.zowe"),
    };
});

const fakeSchema: any = {
    properties: {
        host: { type: "string" },
        port: { type: "number" },
        user: { type: "string", secure: true },
        password: { type: "string", secure: true },
    },
};
const lpar1Profile: Required<Pick<zowe.imperative.IProfileLoaded, "name" | "type" | "profile">> = {
    name: "lpar1",
    type: "zosmf",
    profile: {
        host: "example.com",
        port: 443,
    },
};
const lpar2Profile: Required<Pick<zowe.imperative.IProfileLoaded, "name" | "type" | "profile">> = {
    name: "lpar2",
    type: "zosmf",
    profile: {
        host: "example2.com",
        port: 1443,
    },
};
const baseProfile: Required<Pick<zowe.imperative.IProfileLoaded, "name" | "type" | "profile">> = {
    name: "my_base",
    type: "base",
    profile: lpar1Profile.profile,
};
const zftpProfile: Required<Pick<zowe.imperative.IProfileLoaded, "name" | "type" | "profile">> = {
    ...lpar2Profile,
    type: "zftp",
    profile: {
        ...lpar2Profile.profile,
        port: 21,
    },
};
const lpar1ProfileWithToken = {
    ...lpar1Profile,
    profile: {
        ...lpar1Profile.profile,
        tokenType: "apimlAuthenticationToken",
        tokenValue: "zosmfToken1",
    },
};
const lpar2ProfileWithToken = {
    ...lpar2Profile,
    profile: {
        ...lpar2Profile.profile,
        tokenType: "apimlAuthenticationToken",
        tokenValue: "zosmfToken2",
    },
};
const baseProfileWithToken = {
    ...baseProfile,
    profile: {
        ...baseProfile.profile,
        tokenType: "apimlAuthenticationToken",
        tokenValue: "baseToken",
    },
};

function createProfInfoMock(profiles: Partial<zowe.imperative.IProfileLoaded>[]): any {
    return {
        getAllProfiles: (profType?: string) =>
            profiles
                .filter((prof) => !profType || prof.type === profType)
                .map((prof) => ({
                    profName: prof.name,
                    profType: prof.type,
                    profLoc: { osLoc: "fakePath" },
                    isDefaultProfile: prof.name === profiles.find((p) => p.type === profType)?.name,
                })),
        getDefaultProfile: (profType: string) => {
            const profile: any = profiles.find((prof) => prof.type === profType);
            return profile && { profName: profile.name, profType: profile.type, profLoc: { osLoc: "fakePath" } };
        },
        mergeArgsForProfile: (profAttrs: zowe.imperative.IProfAttrs) => {
            const profile: any = profiles.find((prof) => prof.name === profAttrs.profName && prof.type === profAttrs.profType);
            return {
                knownArgs: Object.entries(profile.profile).map(([k, v]) => ({ argName: k, argValue: v })),
            };
        },
    } as any;
}

describe("ProfilesCache", () => {
    const fakeLogger = { debug: jest.fn() };
    const fakeZoweDir = zowe.getZoweDir();
    const readProfilesFromDiskSpy = jest.spyOn(zowe.imperative.ProfileInfo.prototype, "readProfilesFromDisk");

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("getProfileInfo should initialize ProfileInfo API", async () => {
        const profInfo = await new ProfilesCache(fakeLogger as any, __dirname).getProfileInfo();
        expect(readProfilesFromDiskSpy).toHaveBeenCalledTimes(1);
        const teamConfig = profInfo.getTeamConfig();
        expect(teamConfig.appName).toBe("zowe");
        expect(teamConfig.paths).toEqual([
            path.join(__dirname, teamConfig.userConfigName),
            path.join(__dirname, teamConfig.configName),
            path.join(fakeZoweDir, teamConfig.userConfigName),
            path.join(fakeZoweDir, teamConfig.configName),
        ]);
    });

    it("loadNamedProfile should find profiles by name and type", () => {
        const profCache = new ProfilesCache(fakeLogger as any);
        profCache.allProfiles = [lpar1Profile as any, zftpProfile as any];
        expect(profCache.loadNamedProfile("lpar1").type).toBe("zosmf");
        expect(profCache.loadNamedProfile("lpar2", "zftp").type).toBe("zftp");
    });

    it("loadNamedProfile should fail to find non-existent profile", () => {
        const profCache = new ProfilesCache(fakeLogger as any);
        profCache.allProfiles = [lpar1Profile as any];
        let caughtError;
        try {
            profCache.loadNamedProfile("lpar2");
        } catch (error) {
            caughtError = error;
        }
        expect(caughtError.message).toContain("Could not find profile");
    });

    it("loadNamedProfile should fail to find invalid profile", () => {
        const profCache = new ProfilesCache(fakeLogger as any);
        profCache.allProfiles = [lpar1Profile as any];
        let caughtError;
        try {
            profCache.loadNamedProfile("lpar1", "zftp");
        } catch (error) {
            caughtError = error;
        }
        expect(caughtError.message).toContain("Could not find profile");
    });

    it("updateProfilesArrays should process profile properties and defaults", () => {
        const profCache = new ProfilesCache(fakeLogger as any);
        profCache.allProfiles = [lpar1Profile as any];
        (profCache as any).defaultProfileByType = new Map([["zosmf", { ...profCache.allProfiles[0] }]]);
        expect(profCache.allProfiles[0].profile).toMatchObject(lpar1Profile.profile);
        profCache.updateProfilesArrays({
            ...lpar1Profile,
            profile: lpar2Profile.profile,
        } as any);
        expect(profCache.allProfiles[0].profile).toMatchObject(lpar2Profile.profile);
        expect((profCache as any).defaultProfileByType.get("zosmf").profile).toMatchObject(lpar2Profile.profile);
    });

    it("getDefaultProfile should find default profile given type", () => {
        const profCache = new ProfilesCache(fakeLogger as any);
        (profCache as any).defaultProfileByType = new Map([["zosmf", lpar1Profile]]);
        expect(profCache.getDefaultProfile("zosmf").name).toBe("lpar1");
    });

    it("getDefaultConfigProfile should find default profile given type", () => {
        const profCache = new ProfilesCache(fakeLogger as any);
        const profAttrs = profCache.getDefaultConfigProfile(createProfInfoMock([lpar1Profile]), "zosmf");
        expect(profAttrs.profName).toBe("lpar1");
    });

    it("getProfiles should find profiles given type", () => {
        const profCache = new ProfilesCache(fakeLogger as any);
        (profCache as any).profilesByType = new Map([["zosmf", [lpar1Profile, lpar2Profile]]]);
        expect(profCache.getProfiles("zosmf").length).toBe(2);
    });

    it("registerCustomProfilesType should register new profile type", () => {
        const profCache = new ProfilesCache(fakeLogger as any);
        expect((profCache as any).allExternalTypes.size).toBe(0);
        profCache.registerCustomProfilesType("zosmf");
        expect((profCache as any).allExternalTypes.size).toBe(1);
    });

    describe("refresh", () => {
        const mockLogError = jest.fn();
        const profileTypes = ["zosmf", "zftp"];
        const fakeApiRegister = {
            registeredApiTypes: jest.fn().mockReturnValue(profileTypes),
        };

        it("should refresh profile data for multiple profile types", async () => {
            const profCache = new ProfilesCache({ ...fakeLogger, error: mockLogError } as any);
            jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([lpar1Profile, zftpProfile]));
            await profCache.refresh(fakeApiRegister as any);
            expect(profCache.allProfiles.length).toEqual(2);
            expect(profCache.allProfiles[0]).toMatchObject(lpar1Profile);
            expect(profCache.allProfiles[1]).toMatchObject(zftpProfile);
            expect(profCache.getAllTypes()).toEqual([...profileTypes, "base"]);
            expect(mockLogError).not.toHaveBeenCalled();
        });

        it("should refresh profile data for and merge tokens with base profile", async () => {
            const profCache = new ProfilesCache({ ...fakeLogger, error: mockLogError } as any);
            jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(
                createProfInfoMock([lpar1ProfileWithToken, lpar2ProfileWithToken, baseProfileWithToken])
            );
            await profCache.refresh(fakeApiRegister as any);
            expect(profCache.allProfiles.length).toEqual(3);
            expect(profCache.allProfiles[0]).toMatchObject(lpar1ProfileWithToken);
            expect(profCache.allProfiles[1]).toMatchObject(lpar2Profile); // without token
            expect(profCache.allProfiles[2]).toMatchObject(baseProfileWithToken);
            expect(profCache.getAllTypes()).toEqual([...profileTypes, "base"]);
            expect(mockLogError).not.toHaveBeenCalled();
        });

        it("should handle error when refreshing profile data", async () => {
            const fakeError = "Profile IO Error";
            const profCache = new ProfilesCache({ ...fakeLogger, error: mockLogError } as any);
            jest.spyOn(profCache, "getProfileInfo").mockImplementation(() => {
                throw fakeError;
            });
            await profCache.refresh(fakeApiRegister as any);
            expect(profCache.allProfiles.length).toEqual(0);
            expect(profCache.getAllTypes().length).toEqual(0);
            expect(mockLogError).toHaveBeenCalledWith(fakeError);
        });
    });

    describe("validateAndParseUrl", () => {
        it("should successfully parse URL with default port", () => {
            const profCache = new ProfilesCache(fakeLogger as any);
            const result = profCache.validateAndParseUrl("https://example.com:443");
            expect(result).toMatchObject({
                valid: true,
                protocol: "https",
                host: "example.com",
                port: 443,
            });
        });

        it("should successfully parse URL with custom port", () => {
            const profCache = new ProfilesCache(fakeLogger as any);
            const result = profCache.validateAndParseUrl("https://example.com:8443");
            expect(result).toMatchObject({
                valid: true,
                protocol: "https",
                host: "example.com",
                port: 8443,
            });
        });

        it("should fail to parse invalid URL", () => {
            const profCache = new ProfilesCache(fakeLogger as any);
            const result = profCache.validateAndParseUrl("invalid URL");
            expect(result).toMatchObject({
                valid: false,
                protocol: null,
                host: null,
                port: null,
            });
        });
    });

    it("getNamesForType should return array of profile names for given type", async () => {
        const profCache = new ProfilesCache(fakeLogger as any);
        jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([lpar1Profile, lpar2Profile]));
        const profileNames = await profCache.getNamesForType("zosmf");
        expect(profileNames).toEqual(["lpar1", "lpar2"]);
    });

    describe("fetchAllProfilesByType", () => {
        it("should return array of profile objects for given type", async () => {
            const profCache = new ProfilesCache(fakeLogger as any);
            jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([lpar1Profile, lpar2Profile]));
            const profiles = await profCache.fetchAllProfilesByType("zosmf");
            expect(profiles.length).toBe(2);
            expect(profiles[0]).toMatchObject(lpar1Profile);
            expect(profiles[1]).toMatchObject(lpar2Profile);
        });

        it("should remove token from service profile if base profile overrides it", async () => {
            const profCache = new ProfilesCache(fakeLogger as any);
            (profCache as any).defaultProfileByType = new Map([["base", baseProfileWithToken]]);
            jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([lpar1ProfileWithToken, lpar2ProfileWithToken]));
            const profiles = await profCache.fetchAllProfilesByType("zosmf");
            expect(profiles.length).toBe(2);
            expect(profiles[0].profile?.tokenType).toBe(lpar1ProfileWithToken.profile.tokenType);
            expect(profiles[0].profile?.tokenValue).toBe(lpar1ProfileWithToken.profile.tokenValue);
            expect(profiles[1].profile?.tokenType).toBeUndefined();
            expect(profiles[1].profile?.tokenValue).toBeUndefined();
        });

        it("should return empty array for unknown profile type", async () => {
            const profCache = new ProfilesCache(fakeLogger as any);
            jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([lpar1Profile]));
            const profiles = await profCache.fetchAllProfilesByType("zftp");
            expect(profiles.length).toBe(0);
        });
    });

    it("fetchAllProfiles should return array of profile objects for all types", async () => {
        const profCache = new ProfilesCache(fakeLogger as any);
        (profCache as any).allTypes = ["zosmf", "zftp"];
        jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([lpar1Profile, zftpProfile]));
        const profiles = await profCache.fetchAllProfiles();
        expect(profiles.length).toBe(2);
        expect(profiles[0]).toMatchObject(lpar1Profile);
        expect(profiles[1]).toMatchObject(zftpProfile);
    });

    describe("directLoad", () => {
        it("should return profile object if name and type match", async () => {
            const profCache = new ProfilesCache(fakeLogger as any);
            jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([lpar1Profile]));
            const profile = await profCache.directLoad("zosmf", "lpar1");
            expect(profile).toMatchObject(lpar1Profile);
        });

        it("should not return profile if type not found", async () => {
            const profCache = new ProfilesCache(fakeLogger as any);
            jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([lpar1Profile]));
            const profile = await profCache.directLoad("zftp", "lpar1");
            expect(profile).toBeUndefined();
        });

        it("should not return profile if name not found", async () => {
            const profCache = new ProfilesCache(fakeLogger as any);
            jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([lpar1Profile]));
            const profile = await profCache.directLoad("zosmf", "lpar2");
            expect(profile).toBeUndefined();
        });
    });

    it("getProfileFromConfig should return profile attributes for given name", async () => {
        const profCache = new ProfilesCache(fakeLogger as any);
        jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([{ name: "lpar1", type: "zosmf" }]));
        const profAttrs = await profCache.getProfileFromConfig("lpar1");
        expect(profAttrs).toMatchObject({ profName: "lpar1", profType: "zosmf" });
    });

    it("getProfileFromConfig not return profile if name not found", async () => {
        const profCache = new ProfilesCache(fakeLogger as any);
        jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([{ name: "lpar1", type: "zosmf" }]));
        const profAttrs = await profCache.getProfileFromConfig("lpar2");
        expect(profAttrs).toBeUndefined();
    });

    it("getProfileFromConfig not return profile if type not found", async () => {
        const profCache = new ProfilesCache(fakeLogger as any);
        jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([{ name: "lpar1", type: "zosmf" }]));
        const profAttrs = await profCache.getProfileFromConfig("lpar1", "zftp");
        expect(profAttrs).toBeUndefined();
    });

    it("getLoadedProfConfig should return profile object for given name", async () => {
        const profCache = new ProfilesCache(fakeLogger as any);
        jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([lpar1Profile]));
        const profile = await profCache.getLoadedProfConfig("lpar1");
        expect(profile).toMatchObject(lpar1Profile);
    });

    it("getLoadedProfConfig should not return profile if name not found", async () => {
        const profCache = new ProfilesCache(fakeLogger as any);
        jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([{ name: "lpar1", type: "zosmf" }]));
        const profile = await profCache.getLoadedProfConfig("lpar2");
        expect(profile).toBeUndefined();
    });

    it("getLoadedProfConfig should not return profile if type not found", async () => {
        const profCache = new ProfilesCache(fakeLogger as any);
        jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([{ name: "lpar1", type: "zosmf" }]));
        const profile = await profCache.getLoadedProfConfig("lpar1", "zftp");
        expect(profile).toBeUndefined();
    });

    it("getBaseProfile should find base profile if one exists", () => {
        const profCache = new ProfilesCache(fakeLogger as any);
        profCache.allProfiles = [{ name: "my_base", type: "base" } as any];
        expect(profCache.getBaseProfile()?.type).toBe("base");
    });

    it("getBaseProfile should return undefined if base profile not found", () => {
        const profCache = new ProfilesCache(fakeLogger as any);
        profCache.allProfiles = [{ name: "lpar1", type: "zosmf" } as any];
        expect(profCache.getBaseProfile()).toBeUndefined();
    });

    it("fetchBaseProfile should return base profile object", async () => {
        const profCache = new ProfilesCache(fakeLogger as any);
        jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([baseProfile]));
        const profile = await profCache.fetchBaseProfile();
        expect(profile).toMatchObject(baseProfile);
    });

    it("fetchBaseProfile should return undefined if base profile not found", async () => {
        const profCache = new ProfilesCache(fakeLogger as any);
        jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([lpar1Profile]));
        const profile = await profCache.fetchBaseProfile();
        expect(profile).toBeUndefined();
    });

    it("isCredentialsSecured should invoke ProfileInfo API", async () => {
        const isSecuredMock = jest.fn().mockReturnValue(false).mockReturnValueOnce(true);
        const profCache = new ProfilesCache(fakeLogger as any);
        jest.spyOn(profCache, "getProfileInfo").mockResolvedValue({ isSecured: isSecuredMock } as any);
        expect(await profCache.isCredentialsSecured()).toBe(true);
        expect(await profCache.isCredentialsSecured()).toBe(false);
    });

    it("isCredentialsSecured should handle errors from ProfileInfo API", async () => {
        const profCache = new ProfilesCache({ error: jest.fn() } as any);
        jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(undefined as any);
        expect(await profCache.isCredentialsSecured()).toBe(true);
        expect((profCache as any).log.error).toHaveBeenCalledTimes(1);
    });

    describe("v1 profiles", () => {
        it("getSchema should return schema properties for v1 profile", () => {
            const profCache = new ProfilesCache(fakeLogger as any);
            jest.spyOn(profCache, "getCliProfileManager").mockReturnValue({
                configurations: [
                    {
                        type: "zosmf",
                        schema: fakeSchema,
                    },
                ],
            } as any);
            const schema = profCache.getSchema("zosmf");
            expect(schema).toMatchObject(fakeSchema.properties);
        });

        it("getSchema should return empty schema for unknown profile type", () => {
            const profCache = new ProfilesCache(fakeLogger as any);
            jest.spyOn(profCache, "getCliProfileManager").mockReturnValue({
                configurations: [
                    {
                        type: "zosmf",
                        schema: fakeSchema,
                    },
                ],
            } as any);
            const schema = profCache.getSchema("zftp");
            expect(schema).toEqual({});
        });

        describe("getCliProfileManager", () => {
            const getAllProfDirsSpy = jest.spyOn(zowe.imperative.ProfileIO, "getAllProfileDirectories");
            const readMetaFileSpy = jest.spyOn(zowe.imperative.ProfileIO, "readMetaFile");
            const profCache = new ProfilesCache(fakeLogger as any);

            it("should create new v1 profile manager", () => {
                getAllProfDirsSpy.mockReturnValueOnce(["zosmf"]);
                readMetaFileSpy.mockReturnValueOnce({
                    configuration: {
                        type: "zosmf",
                        schema: { properties: {} },
                    },
                } as any);
                const profMgr = profCache.getCliProfileManager("zosmf");
                expect(profMgr).toBeInstanceOf(zowe.imperative.CliProfileManager);
                expect(getAllProfDirsSpy).toHaveBeenCalledTimes(1);
            });

            it("should reuse cached v1 profile manager", () => {
                const profMgr = profCache.getCliProfileManager("zosmf");
                expect(profMgr).toBeInstanceOf(zowe.imperative.CliProfileManager);
                expect(getAllProfDirsSpy).not.toHaveBeenCalled();
            });

            it("should return undefined if profile manager fails to initialize", () => {
                getAllProfDirsSpy.mockReturnValueOnce([]);
                const profMgr = profCache.getCliProfileManager("zftp");
                expect(profMgr).toBeUndefined();
                expect(getAllProfDirsSpy).toHaveBeenCalledTimes(1);
            });
        });

        it("deleteProfileOnDisk should invoke CliProfileManager API", async () => {
            const mockDeleteProfile = jest.fn();
            const deleteParams: zowe.imperative.IDeleteProfile = {
                name: lpar1Profile.name,
            };
            const profCache = new ProfilesCache(fakeLogger as any);
            jest.spyOn(profCache, "getCliProfileManager").mockReturnValue({
                delete: mockDeleteProfile,
            } as any);
            await (profCache as any).deleteProfileOnDisk(lpar1Profile);
            expect(mockDeleteProfile).toHaveBeenCalledTimes(1);
            expect(mockDeleteProfile.mock.calls[0][0]).toMatchObject(deleteParams);
        });

        it("saveProfile should invoke CliProfileManager API", async () => {
            const mockSaveProfile = jest.fn().mockResolvedValue({});
            const saveParams: zowe.imperative.ISaveProfile = {
                profile: lpar1Profile.profile,
                name: lpar1Profile.name,
                type: lpar1Profile.type,
            };
            const profCache = new ProfilesCache(fakeLogger as any);
            jest.spyOn(profCache, "getCliProfileManager").mockReturnValue({
                save: mockSaveProfile,
            } as any);
            await (profCache as any).saveProfile(lpar1Profile.profile, lpar1Profile.name, lpar1Profile.type);
            expect(mockSaveProfile).toHaveBeenCalledTimes(1);
            expect(mockSaveProfile.mock.calls[0][0]).toMatchObject(saveParams);
        });
    });

    describe("deprecated methods", () => {
        describe("isSecureCredentialPluginActive", () => {
            const scsPluginName = "@zowe/secure-credential-store-for-zowe-cli";
            const mockLogError = jest.fn();
            const profCache = new ProfilesCache({ error: mockLogError } as any);

            it("should handle CredentialManager in Imperative settings", () => {
                jest.spyOn(fs, "existsSync").mockReturnValueOnce(true);
                const readFileSyncSpy = jest.spyOn(fs, "readFileSync").mockReturnValue(
                    JSON.stringify({
                        overrides: {
                            CredentialManager: scsPluginName,
                        },
                    })
                );
                const isScsActive = profCache.isSecureCredentialPluginActive();
                expect(mockLogError).not.toHaveBeenCalled();
                expect(readFileSyncSpy).toHaveBeenCalledTimes(1);
                expect(isScsActive).toBe(true);
            });

            it("should handle credential-manager in Imperative settings", () => {
                jest.spyOn(fs, "existsSync").mockReturnValueOnce(true);
                const readFileSyncSpy = jest.spyOn(fs, "readFileSync").mockReturnValue(
                    JSON.stringify({
                        overrides: {
                            "credential-manager": scsPluginName,
                        },
                    })
                );
                const isScsActive = profCache.isSecureCredentialPluginActive();
                expect(mockLogError).not.toHaveBeenCalled();
                expect(readFileSyncSpy).toHaveBeenCalledTimes(1);
                expect(isScsActive).toBe(true);
            });

            it("should handle empty Imperative settings", () => {
                jest.spyOn(fs, "existsSync").mockReturnValueOnce(true);
                const readFileSyncSpy = jest.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify({}));
                const isScsActive = profCache.isSecureCredentialPluginActive();
                expect(mockLogError).not.toHaveBeenCalled();
                expect(readFileSyncSpy).toHaveBeenCalledTimes(1);
                expect(isScsActive).toBe(false);
            });

            it("should handle non-existent Imperative settings", () => {
                jest.spyOn(fs, "existsSync").mockReturnValueOnce(false);
                const readFileSyncSpy = jest.spyOn(fs, "readFileSync");
                const isScsActive = profCache.isSecureCredentialPluginActive();
                expect(mockLogError).not.toHaveBeenCalled();
                expect(readFileSyncSpy).not.toHaveBeenCalled();
                expect(isScsActive).toBe(false);
            });

            it("should handle error loading Imperative settings", () => {
                jest.spyOn(fs, "existsSync").mockReturnValueOnce(true);
                const readFileSyncSpy = jest.spyOn(fs, "readFileSync").mockReturnValueOnce("invalid json");
                const isScsActive = profCache.isSecureCredentialPluginActive();
                expect(mockLogError).toHaveBeenCalledTimes(1);
                expect(mockLogError.mock.calls[0][0].message).toContain("Unexpected token");
                expect(readFileSyncSpy).toHaveBeenCalledTimes(1);
                expect(isScsActive).toBe(false);
            });
        });
    });
});
