
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

import { Logger } from "@zowe/imperative";
import { Profiles } from "../../../src/Profiles";
import { DefaultProfileManager } from "../../../src/profiles/DefaultProfileManager";
import { createValidIProfile, createISessionWithoutCredentials, createInstanceOfProfile } from "../../../__mocks__/mockCreators/shared";

async function createGlobalMocks() {
    const newMocks = {
        mockGetInstance: jest.fn(),
        mockCollectProfileDetails: jest.fn(),
        defaultProfileManagerInstance: null,
        defaultProfile: null,
        profiles: null
    };

    // Mocking Default Profile Manager
    newMocks.defaultProfileManagerInstance = await DefaultProfileManager.createInstance(Logger.getAppLogger());
    newMocks.profiles = await Profiles.createInstance(Logger.getAppLogger());
    newMocks.defaultProfile = DefaultProfileManager.getInstance().getDefaultProfile("zosmf");
    Object.defineProperty(DefaultProfileManager,
                          "getInstance",
                          { value: jest.fn(() => newMocks.defaultProfileManagerInstance), configurable: true });

    Object.defineProperty(Profiles, "getInstance", { value: newMocks.mockGetInstance, configurable: true });
    Object.defineProperty(newMocks.mockGetInstance, "collectProfileDetails", { value: newMocks.mockCollectProfileDetails, configurable: true });

    return newMocks;
}

describe("Profiles Unit Tests - Function getDefaultProfile", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            log: Logger.getAppLogger(),
            profiles: null,
            validProfile: createValidIProfile(),
            session: createISessionWithoutCredentials(),
            profileInstance: null
        };

        newMocks.profiles = await Profiles.createInstance(newMocks.log);
        newMocks.profileInstance = createInstanceOfProfile(newMocks.profiles, newMocks.session);
        globalMocks.mockGetInstance.mockReturnValue(newMocks.profiles);
        Object.defineProperty(globalMocks.defaultProfileManagerInstance,
                              "getDefaultProfile",
                              { value: jest.fn(() => globalMocks.defaultProfile), configurable: true });

        return newMocks;
    }

    it("Tests that getDefaultProfile returns the default profile", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const loadedProfiles = globalMocks.defaultProfileManagerInstance.getDefaultProfile();
        expect(loadedProfiles).toEqual(blockMocks.validProfile);
    });
});

describe("Profiles Unit Tests - Function setDefaultProfile", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            log: Logger.getAppLogger(),
            profiles: null,
            validProfile: createValidIProfile(),
            session: createISessionWithoutCredentials(),
            profileInstance: null
        };

        newMocks.profiles = await Profiles.createInstance(newMocks.log);
        newMocks.profileInstance = createInstanceOfProfile(newMocks.profiles, newMocks.session);
        globalMocks.mockGetInstance.mockReturnValue(newMocks.profiles);

        return newMocks;
    }

    it("Tests that setDefaultProfile sets the default profile", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const newDefault = createValidIProfile();
        newDefault.name = "newDefault";
        globalMocks.defaultProfileManagerInstance.setDefaultProfile("zosmf", newDefault);

        const loadedProfiles = globalMocks.defaultProfileManagerInstance.getDefaultProfile();
        expect(loadedProfiles).toEqual(newDefault);
    });
});
