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

import { loadNamedProfile, loadAllProfiles, loadDefaultProfile } from "../../src/ProfileLoader";

const showInformationMessage = jest.fn();
Object.defineProperty(vscode.window, "showInformationMessage", { value: showInformationMessage });

describe("ProfileLoader", () => {
    // Mocking log.debug
    const log = new Logger(undefined);
    Object.defineProperty(log, "debug", {
        value: jest.fn()
    });
    const mockDebug = jest.spyOn(log, "debug");

    // Happy path profiles
    const profileOne = { name: "profile1", profile: {}, type: "zosmf" };
    const profileTwo = { name: "profile2", profile: {}, type: "zosmf" };

    beforeEach(() => {
        (child_process.spawnSync as any) = jest.fn((program: string, args: string[], options: any) => {

            const createFakeChildProcess = (status: number, stdout: string, stderr: string) => {
                return {
                    status,
                    stdout: {
                        toString: jest.fn(() => {
                            return stdout;
                        })
                    },
                    stderr: {
                        toString: jest.fn(() => {
                            return stderr;
                        })
                    },
                };
            };

            if (args[0].indexOf("getAllProfiles") >= 0) {
                return createFakeChildProcess(0, JSON.stringify([profileOne, profileTwo]), "");
            } else {
                // load default profile
                return createFakeChildProcess(0, JSON.stringify(profileOne), "");
            }
        });
    });
    afterEach(() => {
        jest.resetAllMocks();
    });

    it("should return a named profile", () => {

        const loadedProfile = loadNamedProfile("profile1");
        expect(loadedProfile).toEqual(profileOne);
    });

    it("should return all profiles ", () => {
        const loadedProfiles = loadAllProfiles();
        expect(loadedProfiles).toEqual([profileOne, profileTwo]);
    });

    it("should return a default profile", () => {

        const loadedProfile = loadDefaultProfile(log);
        expect(loadedProfile).toEqual(profileOne);
    });

    it("should display an information message and log a debug message if no default profile is found", () => {
        showInformationMessage.mockReset();
        mockDebug.mockReset();
        // Create bad profile
        (child_process.spawnSync as any) = jest.fn((program: string, args: string[], options: any) => {
            return {
                status: 0,
                stdout: "",
                stderr: "Error text"
            };
        });
        // Expect loadDefaultProfile to return undefined
        const loadedProfile = loadDefaultProfile(log);
        expect(loadedProfile).toBeUndefined();
        // Test that the information and debug messages were called
        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(mockDebug.mock.calls.length).toBe(1);
    });
});
