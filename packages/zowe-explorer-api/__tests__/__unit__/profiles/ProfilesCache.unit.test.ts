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

jest.mock("@zowe/cli", () => {
    const originalModule = jest.requireActual("@zowe/cli");
    return {
        ...originalModule,
        getZoweDir: jest.fn().mockReturnValue("~/.zowe"),
    };
});

describe("ProfilesCache", () => {
    const fakeZoweDir = zowe.getZoweDir();
    const readProfilesFromDiskSpy = jest.spyOn(zowe.imperative.ProfileInfo.prototype, "readProfilesFromDisk");

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("getProfileInfo should initialize ProfileInfo API", async () => {
        const profInfo = await new ProfilesCache(undefined as any, __dirname).getProfileInfo();
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
        const profInfo = new ProfilesCache(undefined as any);
        profInfo.allProfiles = [{ name: "lpar1", type: "zosmf" } as any, { name: "lpar2", type: "zftp" } as any];
        expect(profInfo.loadNamedProfile("lpar1").type).toBe("zosmf");
        expect(profInfo.loadNamedProfile("lpar2", "zftp").type).toBe("zftp");
    });

    it("loadNamedProfile should fail to find non-existent profile", () => {
        const profInfo = new ProfilesCache(undefined as any);
        profInfo.allProfiles = [{ name: "lpar1", type: "zosmf" } as any];
        let caughtError;
        try {
            profInfo.loadNamedProfile("lpar2");
        } catch (error) {
            caughtError = error;
        }
        expect(caughtError.message).toContain("Could not find profile");
    });

    it("loadNamedProfile should fail to find invalid profile", () => {
        const profInfo = new ProfilesCache(undefined as any);
        profInfo.allProfiles = [{ name: "lpar1", type: "zosmf" } as any];
        let caughtError;
        try {
            profInfo.loadNamedProfile("lpar1", "zftp");
        } catch (error) {
            caughtError = error;
        }
        expect(caughtError.message).toContain("Could not find profile");
    });

    it("updateProfilesArrays should process profile properties and defaults", () => {
        const profInfo = new ProfilesCache(undefined as any);
        profInfo.allProfiles = [{ name: "lpar1", type: "zosmf" } as any];
        (profInfo as any).defaultProfileByType = new Map([["zosmf", { ...profInfo.allProfiles[0] }]]);
        profInfo.updateProfilesArrays({
            name: "lpar1",
            type: "zosmf",
            profile: { host: "example.com" },
        } as any);
        expect(profInfo.allProfiles[0].profile).toBeDefined();
        expect((profInfo as any).defaultProfileByType.get("zosmf").profile).toBeDefined();
    });

    it("getDefaultProfile should find default profile given type", () => {
        const profInfo = new ProfilesCache(undefined as any);
        (profInfo as any).defaultProfileByType = new Map([["zosmf", { name: "lpar1", type: "zosmf" }]]);
        expect(profInfo.getDefaultProfile("zosmf").name).toBe("lpar1");
    });

    it("getDefaultConfigProfile should find default profile given type", () => {
        const profInfo = new ProfilesCache(undefined as any);
        const getDefaultProfileMock = jest.fn().mockReturnValue({ profName: "lpar1", profType: "zosmf" });
        expect(
            profInfo.getDefaultConfigProfile(
                {
                    getDefaultProfile: getDefaultProfileMock,
                } as any,
                "zosmf"
            ).profName
        ).toBe("lpar1");
    });

    it("getProfiles should find profiles given type", () => {
        const profInfo = new ProfilesCache(undefined as any);
        (profInfo as any).profilesByType = new Map([
            [
                "zosmf",
                [
                    { name: "lpar1", type: "zosmf" },
                    { name: "lpar2", type: "zosmf" },
                ],
            ],
        ]);
        expect(profInfo.getProfiles("zosmf").length).toBe(2);
    });

    it("registerCustomProfilesType should register new profile type", () => {
        const profInfo = new ProfilesCache(undefined as any);
        expect((profInfo as any).allExternalTypes.length).toBe(0);
        profInfo.registerCustomProfilesType("zosmf");
        expect((profInfo as any).allExternalTypes.length).toBe(1);
    });

    // it("TODO refresh", () => {
    //     expect(2 + 2).toBe(4);
    // });

    // it("validateAndParseUrl should ")
});
