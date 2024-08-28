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

import * as path from "path";
import * as fs from "fs";
import * as imperative from "@zowe/imperative";
import { ProfilesCache } from "../../../src/profiles/ProfilesCache";
import { FileManagement, Types } from "../../../src";
import { mocked } from "../../../__mocks__/mockUtils";

jest.mock("fs");

const lpar1Profile: Required<Pick<imperative.IProfileLoaded, "name" | "type" | "profile">> = {
    name: "lpar1",
    type: "zosmf",
    profile: {
        host: "example.com",
        port: 443,
    },
};
const lpar2Profile: Required<Pick<imperative.IProfileLoaded, "name" | "type" | "profile">> = {
    name: "lpar2",
    type: "zosmf",
    profile: {
        host: "example2.com",
        port: 1443,
    },
};
const baseProfile: Required<Pick<imperative.IProfileLoaded, "name" | "type" | "profile">> = {
    name: "my_base",
    type: "base",
    profile: lpar1Profile.profile,
};
const zftpProfile: Required<Pick<imperative.IProfileLoaded, "name" | "type" | "profile">> = {
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
const profileMetadata: imperative.ICommandProfileTypeConfiguration[] = [
    {
        type: "acme",
        schema: {
            type: "object",
            title: "acme profile1",
            description: "A profile to execute commands",
            properties: {},
        },
    },
];

function createProfInfoMock(profiles: Partial<imperative.IProfileLoaded>[]): imperative.ProfileInfo {
    const teamConfigApi: Partial<imperative.Config> = {
        api: {
            profiles: {
                get: jest.fn(),
                getProfilePathFromName: jest.fn().mockImplementation((x) => x),
            },
            secure: {
                secureFields: jest.fn().mockReturnValue([]),
                securePropsForProfile: jest.fn().mockReturnValue([]),
            },
        } as any,
        exists: true,
    };
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
            const profile: Partial<imperative.IProfileLoaded> | undefined = profiles.find((prof) => prof.type === profType);
            if (!profile) {
                return undefined;
            }

            return { profName: profile.name, profType: profile.type, profLoc: { osLoc: "fakePath" } };
        },
        mergeArgsForProfile: (profAttrs: imperative.IProfAttrs) => {
            const profile: Partial<imperative.IProfileLoaded> | undefined = profiles.find(
                (prof) => prof.name === profAttrs.profName && prof.type === profAttrs.profType
            );
            if (profile === undefined) {
                return { knownArgs: [] };
            }

            return {
                knownArgs: Object.entries(profile.profile as object).map(([k, v]) => ({ argName: k, argValue: v as unknown })),
            };
        },
        getTeamConfig: () => teamConfigApi,
        updateProperty: jest.fn(),
        updateKnownProperty: jest.fn(),
        isSecured: jest.fn(),
        getZoweDir: jest.fn().mockReturnValue("~/.zowe"),
    } as any;
}

describe("ProfilesCache", () => {
    const fakeLogger = { debug: jest.fn() };
    const fakeZoweDir = "~/.zowe";
    const readProfilesFromDiskSpy = jest.spyOn(imperative.ProfileInfo.prototype, "readProfilesFromDisk");
    const defaultCredMgrWithKeytarSpy = jest.spyOn(imperative.ProfileCredentials, "defaultCredMgrWithKeytar");

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("getProfileInfo should initialize ProfileInfo API", async () => {
        const existsSync = jest.spyOn(fs, "existsSync").mockImplementation();
        jest.spyOn(FileManagement, "getZoweDir").mockReturnValue(fakeZoweDir);
        const profInfo = await new ProfilesCache(fakeLogger as unknown as imperative.Logger, __dirname).getProfileInfo();
        expect(readProfilesFromDiskSpy).toHaveBeenCalledTimes(1);
        expect(defaultCredMgrWithKeytarSpy).toHaveBeenCalledTimes(1);
        expect(defaultCredMgrWithKeytarSpy).toHaveBeenCalledWith(ProfilesCache.requireKeyring);
        const teamConfig = profInfo.getTeamConfig();
        expect(teamConfig.appName).toBe("zowe");
        expect(teamConfig.paths).toEqual([
            path.join(__dirname, teamConfig.userConfigName),
            path.join(__dirname, teamConfig.configName),
            path.join(fakeZoweDir, teamConfig.userConfigName),
            path.join(fakeZoweDir, teamConfig.configName),
        ]);
        existsSync.mockRestore();
    });

    it("requireKeyring returns keyring module from Secrets SDK", () => {
        const keyring = ProfilesCache.requireKeyring();
        expect(keyring).toBeDefined();
        expect(Object.keys(keyring).length).toBe(5);
    });

    it("addToConfigArray should set the profileTypeConfigurations array", () => {
        const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
        profileMetadata.push(profileMetadata[0]);
        profCache.addToConfigArray(profileMetadata);
        expect(profCache.profileTypeConfigurations).toEqual(profileMetadata.filter((a, index) => index == 0));
    });

    it("getConfigArray should return the data of profileTypeConfigurations Array", () => {
        const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
        profCache.profileTypeConfigurations = profileMetadata;
        const res = profCache.getConfigArray();
        expect(res).toEqual(profileMetadata);
    });

    it("loadNamedProfile should find profiles by name and type", () => {
        const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
        profCache.allProfiles = [lpar1Profile as imperative.IProfileLoaded, zftpProfile as imperative.IProfileLoaded];
        expect(profCache.loadNamedProfile("lpar1").type).toBe("zosmf");
        expect(profCache.loadNamedProfile("lpar2", "zftp").type).toBe("zftp");
    });

    it("loadNamedProfile should fail to find non-existent profile", () => {
        const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
        profCache.allProfiles = [lpar1Profile as imperative.IProfileLoaded];
        try {
            profCache.loadNamedProfile("lpar2");
            fail('loadNamedProfile("lpar2") should have thrown an exception here.');
        } catch (error) {
            expect(error).toBeDefined();
            if (error instanceof Error) {
                expect(error.message).toContain("Could not find profile");
            }
        }
    });

    it("loadNamedProfile should fail to find invalid profile", () => {
        const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
        profCache.allProfiles = [lpar1Profile as imperative.IProfileLoaded];

        try {
            profCache.loadNamedProfile("lpar1", "zftp");
            fail('loadNamedProfile("lpar1", "zftp") should have thrown an exception here.');
        } catch (error) {
            expect(error).toBeDefined();
            if (error instanceof Error) {
                expect(error.message).toContain("Could not find profile");
            }
        }
    });

    it("updateProfilesArrays should process profile properties and defaults", () => {
        const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
        profCache.allProfiles = [lpar1Profile as imperative.IProfileLoaded];
        (profCache as any).defaultProfileByType = new Map([["zosmf", { ...profCache.allProfiles[0] }]]);
        expect(profCache.allProfiles[0].profile).toMatchObject(lpar1Profile.profile);
        profCache.updateProfilesArrays({
            ...lpar1Profile,
            profile: lpar2Profile.profile,
        } as imperative.IProfileLoaded);
        expect(profCache.allProfiles[0].profile).toMatchObject(lpar2Profile.profile);
        expect((profCache as any).defaultProfileByType.get("zosmf").profile).toMatchObject(lpar2Profile.profile);
    });

    it("getDefaultProfile should find default profile given type", () => {
        const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
        (profCache as any).defaultProfileByType = new Map([["zosmf", lpar1Profile]]);
        expect(profCache.getDefaultProfile("zosmf").name).toBe("lpar1");
    });

    it("getDefaultConfigProfile should find default profile given type", () => {
        const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
        const profAttrs = profCache.getDefaultConfigProfile(createProfInfoMock([lpar1Profile]), "zosmf");
        expect(profAttrs.profName).toBe("lpar1");
    });

    it("getProfiles should find profiles given type", () => {
        const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
        (profCache as any).profilesByType = new Map([["zosmf", [lpar1Profile, lpar2Profile]]]);
        expect(profCache.getProfiles("zosmf").length).toBe(2);
    });

    it("registerCustomProfilesType should register new profile type", () => {
        const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
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
            const profCache = new ProfilesCache({ ...fakeLogger, error: mockLogError } as unknown as imperative.Logger);
            jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([lpar1Profile, zftpProfile]));
            await profCache.refresh(fakeApiRegister as unknown as Types.IApiRegisterClient);
            expect(profCache.allProfiles.length).toEqual(2);
            expect(profCache.allProfiles[0]).toMatchObject(lpar1Profile);
            expect(profCache.allProfiles[1]).toMatchObject(zftpProfile);
            expect(profCache.getAllTypes()).toEqual([...profileTypes, "base"]);
            expect(mockLogError).not.toHaveBeenCalled();
        });

        it("should refresh profile data for and merge tokens with base profile", async () => {
            const profCache = new ProfilesCache({ ...fakeLogger, error: mockLogError } as unknown as imperative.Logger);
            jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(
                createProfInfoMock([lpar1ProfileWithToken, lpar2ProfileWithToken, baseProfileWithToken])
            );
            await profCache.refresh(fakeApiRegister as unknown as Types.IApiRegisterClient);
            expect(profCache.allProfiles.length).toEqual(3);
            expect(profCache.allProfiles[0]).toMatchObject(lpar1ProfileWithToken);
            expect(profCache.allProfiles[1]).toMatchObject(lpar2Profile); // without token
            expect(profCache.allProfiles[2]).toMatchObject(baseProfileWithToken);
            expect(profCache.getAllTypes()).toEqual([...profileTypes, "base"]);
            expect(mockLogError).not.toHaveBeenCalled();
        });

        it("should handle error when refreshing profile data", async () => {
            const fakeError = "Profile IO Error";
            const profCache = new ProfilesCache({ ...fakeLogger, error: mockLogError } as unknown as imperative.Logger);
            jest.spyOn(profCache, "getProfileInfo").mockImplementation(() => {
                throw fakeError;
            });
            await profCache.refresh(fakeApiRegister as unknown as Types.IApiRegisterClient);
            expect(profCache.allProfiles.length).toEqual(0);
            expect(profCache.getAllTypes().length).toEqual(0);
            expect(mockLogError).toHaveBeenCalledWith(fakeError);
        });

        it("should remove old types from profilesByType and defaultProfileByType maps when reloading profiles", async () => {
            const profCache = new ProfilesCache({ ...fakeLogger, error: mockLogError } as unknown as imperative.Logger);
            jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([]));
            (profCache as any).profilesByType.set("base", { name: "someProf" as any });
            (profCache as any).defaultProfileByType.set("base", { name: "someProf" as any });
            const promise = profCache.refresh();
            expect((profCache as any).profilesByType.size).toBe(1);
            expect((profCache as any).defaultProfileByType.size).toBe(1);
            await promise;
            expect((profCache as any).profilesByType.size).toBe(0);
            expect((profCache as any).defaultProfileByType.size).toBe(0);
            expect((profCache as any).allProfiles.length).toBe(0);
            expect((profCache as any).allTypes).toEqual(["base"]);
            expect(mockLogError).not.toHaveBeenCalled();
        });
    });

    describe("validateAndParseUrl", () => {
        it("should successfully parse URL with default port", () => {
            const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
            const result = profCache.validateAndParseUrl("https://example.com:443");
            expect(result).toMatchObject({
                valid: true,
                protocol: "https",
                host: "example.com",
                port: 443,
            });
        });

        it("should successfully parse URL with custom port", () => {
            const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
            const result = profCache.validateAndParseUrl("https://example.com:8443");
            expect(result).toMatchObject({
                valid: true,
                protocol: "https",
                host: "example.com",
                port: 8443,
            });
        });

        it("should fail to parse invalid URL", () => {
            const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
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
        const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
        jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([lpar1Profile, lpar2Profile]));
        const profileNames = await profCache.getNamesForType("zosmf");
        expect(profileNames).toEqual(["lpar1", "lpar2"]);
    });

    describe("updateBaseProfileFile Login/Logout", () => {
        const updProfile = { tokenType: "apimlAuthenticationToken", tokenValue: "tokenValue" };

        it("should update the base profile on login", async () => {
            const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
            const mockProfInfo = createProfInfoMock([lpar1Profile, lpar2Profile]);
            jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(mockProfInfo);
            await profCache.updateBaseProfileFileLogin(lpar1Profile as any, updProfile);

            expect(mockProfInfo.updateProperty).toHaveBeenCalledTimes(2);
        });
        it("should update the base profile on login", async () => {
            const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
            const mockProfInfo = createProfInfoMock([lpar1Profile, lpar2Profile]);
            jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(mockProfInfo);
            await profCache.updateBaseProfileFileLogout(lpar1Profile as any);

            expect(mockProfInfo.updateKnownProperty).toHaveBeenCalledTimes(2);
        });
    });

    describe("fetchAllProfilesByType", () => {
        it("should return array of profile objects for given type", async () => {
            const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
            jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([lpar1Profile, lpar2Profile]));
            const profiles = await profCache.fetchAllProfilesByType("zosmf");
            expect(profiles.length).toBe(2);
            expect(profiles[0]).toMatchObject(lpar1Profile);
            expect(profiles[1]).toMatchObject(lpar2Profile);
        });

        it("should remove token from service profile if base profile overrides it", async () => {
            const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
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
            const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
            jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([lpar1Profile]));
            const profiles = await profCache.fetchAllProfilesByType("zftp");
            expect(profiles.length).toBe(0);
        });
    });

    it("fetchAllProfiles should return array of profile objects for all types", async () => {
        const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
        (profCache as any).allTypes = ["zosmf", "zftp"];
        jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([lpar1Profile, zftpProfile]));
        const profiles = await profCache.fetchAllProfiles();
        expect(profiles.length).toBe(2);
        expect(profiles[0]).toMatchObject(lpar1Profile);
        expect(profiles[1]).toMatchObject(zftpProfile);
    });

    describe("directLoad", () => {
        it("should return profile object if name and type match", async () => {
            const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
            jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([lpar1Profile]));
            const profile = await profCache.directLoad("zosmf", "lpar1");
            expect(profile).toMatchObject(lpar1Profile);
        });

        it("should not return profile if type not found", async () => {
            const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
            jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([lpar1Profile]));
            const profile = await profCache.directLoad("zftp", "lpar1");
            expect(profile).toBeUndefined();
        });

        it("should not return profile if name not found", async () => {
            const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
            jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([lpar1Profile]));
            const profile = await profCache.directLoad("zosmf", "lpar2");
            expect(profile).toBeUndefined();
        });
    });

    describe("convertV1ProfToConfig", () => {
        it("Should convert v1 profiles to config file", async () => {
            const profInfo = createProfInfoMock([lpar1Profile]);
            jest.spyOn(imperative.ConvertV1Profiles, "convert").mockImplementationOnce(() => {
                return {
                    profilesConverted: { zosmf: ["profile1"] },
                    profilesFailed: {},
                    config: {},
                } as any;
            });
            await expect(ProfilesCache.convertV1ProfToConfig(profInfo)).resolves.not.toThrow();
        });
        it("Should convert v1 profiles to config file with profilesFailed", async () => {
            const profInfo = createProfInfoMock([lpar1Profile]);
            jest.spyOn(imperative.ConvertV1Profiles, "convert").mockImplementationOnce(() => {
                return {
                    profilesConverted: {},
                    profilesFailed: [{ name: ["profile2"], types: "zosmf", error: "Error converting" }],
                    config: {},
                } as any;
            });
            await expect(ProfilesCache.convertV1ProfToConfig(profInfo)).resolves.not.toThrow();
        });
        it("Should convert v1 profiles to config even if rename of profiles directory fails", async () => {
            jest.spyOn(fs, "renameSync").mockImplementationOnce(() => {
                throw new Error("Error renaming file");
            });
            const profInfo = createProfInfoMock([lpar1Profile]);
            jest.spyOn(imperative.ConvertV1Profiles, "convert").mockImplementationOnce(() => {
                return {
                    profilesConverted: {},
                    profilesFailed: [{ name: ["profile2"], types: "zosmf", error: "Error converting" }],
                    config: {},
                } as any;
            });
            await expect(ProfilesCache.convertV1ProfToConfig(profInfo)).resolves.not.toThrow();
        });
        it("Should reject if error thrown other than renaming profiles directory", async () => {
            const profInfo = createProfInfoMock([lpar1Profile]);
            jest.spyOn(imperative.ConvertV1Profiles, "convert").mockImplementationOnce(() => {
                throw new Error("Error converting config");
            });
            await expect(ProfilesCache.convertV1ProfToConfig(profInfo)).rejects.toThrow("Error converting config");
        });
    });

    it("getProfileFromConfig should return profile attributes for given name", async () => {
        const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
        jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([{ name: "lpar1", type: "zosmf" }]));
        const profAttrs = await profCache.getProfileFromConfig("lpar1");
        expect(profAttrs).toMatchObject({ profName: "lpar1", profType: "zosmf" });
    });

    it("getProfileFromConfig not return profile if name not found", async () => {
        const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
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
        const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
        jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([lpar1Profile]));
        const profile = await profCache.getLoadedProfConfig("lpar1");
        expect(profile).toMatchObject(lpar1Profile);
    });

    it("getLoadedProfConfig should not return profile if name not found", async () => {
        const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
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
        const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
        profCache.allProfiles = [{ name: "my_base", type: "base" } as imperative.IProfileLoaded];
        expect(profCache.getBaseProfile()?.type).toBe("base");
    });

    it("getBaseProfile should return undefined if base profile not found", () => {
        const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
        profCache.allProfiles = [{ name: "lpar1", type: "zosmf" } as imperative.IProfileLoaded];
        expect(profCache.getBaseProfile()).toBeUndefined();
    });

    it("fetchBaseProfile should return base profile object", async () => {
        const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
        jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([baseProfile]));
        const profile = await profCache.fetchBaseProfile();
        expect(profile).toMatchObject(baseProfile);
    });

    it("fetchBaseProfile should return typeless profile if base profile not found", async () => {
        const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
        jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([]));
        const profile = await profCache.fetchBaseProfile("lpar1.zosmf");
        expect(profile).toMatchObject({ name: "lpar1", type: "base" });
    });

    it("fetchBaseProfile should return typeless profile if base profile does not contain token type", async () => {
        const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
        jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([baseProfile]));
        const profile = await profCache.fetchBaseProfile("lpar1.zosmf");
        expect(profile).toMatchObject({ name: "lpar1", type: "base" });
    });

    it("fetchBaseProfile should return base profile if it contains token value", async () => {
        const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
        const profInfoMock = createProfInfoMock([baseProfile]);
        jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(profInfoMock);
        mocked(profInfoMock.getTeamConfig().api.secure.securePropsForProfile).mockReturnValue(["tokenValue"]);
        const profile = await profCache.fetchBaseProfile("lpar1.zosmf");
        expect(profile).toMatchObject(baseProfile);
    });

    it("fetchBaseProfile should return typeless profile up one level if it contains token value", async () => {
        const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
        const profInfoMock = createProfInfoMock([]);
        jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(profInfoMock);
        mocked(profInfoMock.getTeamConfig().api.secure.secureFields).mockReturnValue(["sysplex1.properties.tokenValue"]);
        const profile = await profCache.fetchBaseProfile("sysplex1.lpar1.zosmf");
        expect(profile).toMatchObject({ name: "sysplex1", type: "base" });
    });

    it("fetchBaseProfile should return undefined if base profile not found", async () => {
        const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
        jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([lpar1Profile]));
        const profile = await profCache.fetchBaseProfile();
        expect(profile).toBeUndefined();
    });

    it("isCredentialsSecured should invoke ProfileInfo API", async () => {
        const isSecuredMock = jest.fn().mockReturnValue(false).mockReturnValueOnce(true);
        const profCache = new ProfilesCache(fakeLogger as unknown as imperative.Logger);
        jest.spyOn(profCache, "getProfileInfo").mockResolvedValue({ isSecured: isSecuredMock } as unknown as imperative.ProfileInfo);
        expect(await profCache.isCredentialsSecured()).toBe(true);
        expect(await profCache.isCredentialsSecured()).toBe(false);
    });

    it("isCredentialsSecured should handle errors from ProfileInfo API", async () => {
        const profCache = new ProfilesCache({ error: jest.fn() } as unknown as imperative.Logger);
        jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(undefined as unknown as imperative.ProfileInfo);
        expect(await profCache.isCredentialsSecured()).toBe(true);
        expect((profCache as any).log.error).toHaveBeenCalledTimes(1);
    });
});
