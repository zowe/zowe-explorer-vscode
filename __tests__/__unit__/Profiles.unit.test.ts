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

jest.mock("vscode");
jest.mock("child_process");
jest.mock("@brightside/imperative");
import * as vscode from "vscode";
import * as child_process from "child_process";
import { Logger } from "@brightside/imperative";

import * as ProfileLoader from "../../src/ProfileLoader";
import { Profiles } from "../../src/Profiles";
import { tsImportEqualsDeclaration } from "@babel/types";

describe.only("Profile class unit tests", () => {
    const showInformationMessage = jest.fn();
    Object.defineProperty(vscode.window, "showInformationMessage", { value: showInformationMessage });

    // Mocking log.debug
    const log = Logger.getAppLogger();

    const profileOne = { name: "profile1", profile: {}, type: "zosmf" };
    const profileTwo = { name: "profile2", profile: {}, type: "zosmf" };
    const profileThree = { name: "profileX", profile: {}, type: "abcde" };

    const loadAllProfiles = jest.fn().mockReturnValue([
        { name: "profile1", profile: {}, type: "zosmf" },
        { name: "profile2", profile: {}, type: "zosmf" }]
    );
    const loadDefaultProfile = jest.fn().mockReturnValue(
        { name: "profile1", profile: {}, type: "zosmf" },
    );
    Object.defineProperty(ProfileLoader, "loadAllProfiles", { value: loadAllProfiles });
    Object.defineProperty(ProfileLoader, "loadDefaultProfile", { value: loadDefaultProfile });

    beforeEach(() => {
        loadAllProfiles.mockReturnValue([
            { name: "profile1", profile: {}, type: "zosmf" },
            { name: "profile2", profile: {}, type: "zosmf" }]
        );
        loadDefaultProfile.mockReturnValue(
            { name: "profile1", profile: {}, type: "zosmf" },
        );
    });
    afterEach(() => {
       jest.resetAllMocks();
    });

    it("should create an instance", async () => {
        const profiles = await Profiles.createInstance(log);
        expect(Profiles.getInstance()).toBe(profiles);
    });

    it("should return all profiles ", async () => {
        const profiles = await Profiles.createInstance(log);
        const loadedProfiles = profiles.allProfiles;
        expect(loadedProfiles).toEqual([profileOne, profileTwo]);
    });

    it("should return a message if no profiles available ", async () => {
        loadAllProfiles.mockReturnValueOnce([]);
        const profiles = await Profiles.createInstance(log);
        const loadedProfiles = profiles.allProfiles;
        expect(loadedProfiles).toEqual([]);
    });

    it("should return a default profile", async () => {
        const profiles = await Profiles.createInstance(log);
        const loadedProfiles = profiles.getDefaultProfile();
        expect(loadedProfiles).toEqual(profileOne);
    });

    it("should load a named profile ", async () => {
        const profiles = await Profiles.createInstance(log);
        const loadedProfile = profiles.loadNamedProfile("profile2");
        expect(loadedProfile).toEqual(profileTwo);
    });

    it("should fail to load a non existing profile ", async () => {
        let success = false;
        const profiles = await Profiles.createInstance(log);
        try {
            profiles.loadNamedProfile("profile3");
        } catch (error) {
            expect(error.message).toEqual("Could not find profile named: profile3.");
            success = true;
        }
        expect(success).toBe(true);
    });
});
