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

function createProfInfoMock(profiles: Partial<zowe.imperative.IProfileLoaded>[]): any {
    return {
        getAllProfiles: (profType?: string) =>
            profiles
                .filter((prof) => !profType || prof.type === profType)
                .map((prof) => ({ profName: prof.name, profType: prof.type, profLoc: { osLoc: "fakePath" } })),
        mergeArgsForProfile: (profAttrs: zowe.imperative.IProfAttrs) => {
            const profile: any = profiles.find((prof) => prof.name === profAttrs.profName && prof.type === profAttrs.profType);
            return {
                knownArgs: Object.entries(profile.profile).map(([k, v]) => ({ argName: k, argValue: v })),
            };
        },
    } as any;
}

describe("ProfilesCache", () => {
    const fakeLogger = {
        debug: jest.fn(),
    };
    const fakeSchema: any = {
        properties: {
            host: { type: "string" },
            port: { type: "number" },
            user: { type: "string", secure: true },
            password: { type: "string", secure: true },
        },
    };
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
        profCache.allProfiles = [{ name: "lpar1", type: "zosmf" } as any, { name: "lpar2", type: "zftp" } as any];
        expect(profCache.loadNamedProfile("lpar1").type).toBe("zosmf");
        expect(profCache.loadNamedProfile("lpar2", "zftp").type).toBe("zftp");
    });

    it("loadNamedProfile should fail to find non-existent profile", () => {
        const profCache = new ProfilesCache(fakeLogger as any);
        profCache.allProfiles = [{ name: "lpar1", type: "zosmf" } as any];
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
        profCache.allProfiles = [{ name: "lpar1", type: "zosmf" } as any];
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
        profCache.allProfiles = [{ name: "lpar1", type: "zosmf" } as any];
        (profCache as any).defaultProfileByType = new Map([["zosmf", { ...profCache.allProfiles[0] }]]);
        profCache.updateProfilesArrays({
            name: "lpar1",
            type: "zosmf",
            profile: { host: "example.com" },
        } as any);
        expect(profCache.allProfiles[0].profile).toBeDefined();
        expect((profCache as any).defaultProfileByType.get("zosmf").profile).toBeDefined();
    });

    it("getDefaultProfile should find default profile given type", () => {
        const profCache = new ProfilesCache(fakeLogger as any);
        (profCache as any).defaultProfileByType = new Map([["zosmf", { name: "lpar1", type: "zosmf" }]]);
        expect(profCache.getDefaultProfile("zosmf").name).toBe("lpar1");
    });

    it("getDefaultConfigProfile should find default profile given type", () => {
        const profCache = new ProfilesCache(fakeLogger as any);
        const getDefaultProfileMock = jest.fn().mockReturnValue({ profName: "lpar1", profType: "zosmf" });
        expect(
            profCache.getDefaultConfigProfile(
                {
                    getDefaultProfile: getDefaultProfileMock,
                } as any,
                "zosmf"
            ).profName
        ).toBe("lpar1");
    });

    it("getProfiles should find profiles given type", () => {
        const profCache = new ProfilesCache(fakeLogger as any);
        (profCache as any).profilesByType = new Map([
            [
                "zosmf",
                [
                    { name: "lpar1", type: "zosmf" },
                    { name: "lpar2", type: "zosmf" },
                ],
            ],
        ]);
        expect(profCache.getProfiles("zosmf").length).toBe(2);
    });

    it("registerCustomProfilesType should register new profile type", () => {
        const profCache = new ProfilesCache(fakeLogger as any);
        expect((profCache as any).allExternalTypes.size).toBe(0);
        profCache.registerCustomProfilesType("zosmf");
        expect((profCache as any).allExternalTypes.size).toBe(1);
    });

    // TODO Test getAllTypes here too
    // describe("refresh", () => {});

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

    it("getNamesForType should return array of profile names for given type", async () => {
        const profCache = new ProfilesCache(fakeLogger as any);
        jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(
            createProfInfoMock([
                { name: "lpar1", type: "zosmf" },
                { name: "lpar2", type: "zosmf" },
            ])
        );
        const profileNames = await profCache.getNamesForType("zosmf");
        expect(profileNames).toEqual(["lpar1", "lpar2"]);
    });

    it("fetchAllProfilesByType should return array of profile objects for given type", async () => {
        const lpar1Profile: Partial<zowe.imperative.IProfileLoaded> = {
            name: "lpar1",
            type: "zosmf",
            profile: {
                host: "example.com",
                port: 443,
            },
        };
        const lpar2Profile: Partial<zowe.imperative.IProfileLoaded> = {
            name: "lpar2",
            type: "zosmf",
            profile: {
                host: "example2.com",
                port: 1443,
            },
        };
        const profCache = new ProfilesCache(fakeLogger as any);
        jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([lpar1Profile, lpar2Profile]));
        const profiles = await profCache.fetchAllProfilesByType("zosmf");
        expect(profiles.length).toBe(2);
        expect(profiles[0]).toMatchObject(lpar1Profile);
        expect(profiles[1]).toMatchObject(lpar2Profile);
    });

    it("fetchAllProfilesByType should return empty array for unknown profile type", async () => {
        const lpar1Profile: Partial<zowe.imperative.IProfileLoaded> = {
            name: "lpar1",
            type: "zosmf",
            profile: {
                host: "example.com",
                port: 443,
            },
        };
        const profCache = new ProfilesCache(fakeLogger as any);
        jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([lpar1Profile]));
        const profiles = await profCache.fetchAllProfilesByType("zftp");
        expect(profiles.length).toBe(0);
    });

    it("fetchAllProfiles should return array of profile objects for all types", async () => {
        const lpar1Profile: Partial<zowe.imperative.IProfileLoaded> = {
            name: "lpar1",
            type: "zosmf",
            profile: {
                host: "example.com",
                port: 443,
            },
        };
        const lpar2Profile: Partial<zowe.imperative.IProfileLoaded> = {
            name: "lpar2",
            type: "zftp",
            profile: {
                host: "example2.com",
                port: 21,
            },
        };
        const profCache = new ProfilesCache(fakeLogger as any);
        (profCache as any).allTypes = ["zosmf", "zftp"];
        jest.spyOn(profCache, "getProfileInfo").mockResolvedValue(createProfInfoMock([lpar1Profile, lpar2Profile]));
        const profiles = await profCache.fetchAllProfiles();
        expect(profiles.length).toBe(2);
        expect(profiles[0]).toMatchObject(lpar1Profile);
        expect(profiles[1]).toMatchObject(lpar2Profile);
    });

    describe("directLoad", () => {
        const lpar1Profile: Partial<zowe.imperative.IProfileLoaded> = {
            name: "lpar1",
            type: "zosmf",
            profile: {
                host: "example.com",
                port: 443,
            },
        };

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

    it("getLoadedProfConfig should return profile object for given name", async () => {
        const lpar1Profile: Partial<zowe.imperative.IProfileLoaded> = {
            name: "lpar1",
            type: "zosmf",
            profile: {
                host: "example.com",
                port: 443,
            },
        };
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

    // describe("getCliProfileManager", () => {
    //     let profCache: ProfilesCache;

    //     beforeAll(() => {
    //         profCache = new ProfilesCache(fakeLogger as any);
    //     });

    //     it("should create new v1 profile manager", () => {
    //         expect((profCache as any).profileManagerByType.size).toBe(0);
    //         const profMgr = profCache.getCliProfileManager("zosmf");
    //         expect(profMgr).toBeInstanceOf(zowe.imperative.CliProfileManager);
    //         expect((profCache as any).profileManagerByType.size).toBe(1);
    //     });

    //     it("should reuse cached v1 profile manager", () => {
    //         expect((profCache as any).profileManagerByType.size).toBe(1);
    //         const profMgr = profCache.getCliProfileManager("zosmf");
    //         expect(profMgr).toBeInstanceOf(zowe.imperative.CliProfileManager);
    //         expect((profCache as any).profileManagerByType.size).toBe(1);
    //     });

    //     it("should return undefined if profile manager fails to initialize", () => {
    //         const profMgr = profCache.getCliProfileManager("zftp");
    //         expect(profMgr).toBeUndefined();
    //     });
    // });
});
