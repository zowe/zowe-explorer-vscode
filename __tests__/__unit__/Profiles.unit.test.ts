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
import * as vscode from "vscode";
import * as child_process from "child_process";
import { Logger } from "@brightside/imperative";
import { Profiles } from "../../src/Profiles";

describe("Profile class unit tests", () => {
    const showInformationMessage = jest.fn();
    const showInputBox = jest.fn();    
    const showQuickPick = jest.fn();
    Object.defineProperty(vscode.window, "showInformationMessage", { value: showInformationMessage });
    Object.defineProperty(vscode.window, "showInputBox", {value: showInputBox});
    Object.defineProperty(vscode.window, "showQuickPick", {value: showQuickPick});

    // Mocking log.debug
    const log = Logger.getAppLogger();

    const profileOne = { name: "profile1", profile: {}, type: "zosmf" };
    const profileTwo = { name: "profile2", profile: {}, type: "zosmf" };

    const mockJSONParse = jest.spyOn(JSON, "parse");

    beforeEach(() => {
        mockJSONParse.mockReturnValue({
            overrides: {
                CredentialManager: false
            }
        });
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

    it("should create a new connection", async () => {
        const profiles = await Profiles.createInstance(log);

        // Profile name not supplied
        showQuickPick.mockReset();
        showQuickPick.mockResolvedValueOnce("Create a New Connection to z/OS");
        showInputBox.mockReset();
        showInputBox.mockResolvedValueOnce(undefined);
        await profiles.createNewConnection();
        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toBe("Profile Name was not supplied. Operation Cancelled");

        // Enter z/OS username
        showQuickPick.mockReset();
        showQuickPick.mockResolvedValueOnce("Create a New Connection to z/OS");
        showInputBox.mockReset();
        showInputBox.mockResolvedValueOnce("fake");
        showInputBox.mockResolvedValueOnce("fake/url");
        await profiles.createNewConnection();
        expect(showInformationMessage.mock.calls.length).toBe(2);
        expect(showInformationMessage.mock.calls[1][0]).toBe("Please enter your z/OS username. Operation Cancelled");

        // No valid zosmf value
        showQuickPick.mockReset();
        showQuickPick.mockResolvedValueOnce("Create a New Connection to z/OS");
        showInputBox.mockReset();
        showInputBox.mockResolvedValueOnce("fake");
        showInputBox.mockResolvedValueOnce(undefined);
        await profiles.createNewConnection();
        expect(showInformationMessage.mock.calls.length).toBe(3);
        expect(showInformationMessage.mock.calls[2][0]).toBe("No valid value for z/OSMF URL. Operation Cancelled");

        // Enter z/OS password
        showQuickPick.mockReset();
        showQuickPick.mockResolvedValueOnce("Create a New Connection to z/OS");
        showInputBox.mockReset();
        showInputBox.mockResolvedValueOnce("fake");
        showInputBox.mockResolvedValueOnce("fake/url");
        showInputBox.mockResolvedValueOnce("fake");        
        showInputBox.mockResolvedValueOnce(undefined);
        await profiles.createNewConnection();
        expect(showInformationMessage.mock.calls.length).toBe(4);
        expect(showInformationMessage.mock.calls[3][0]).toBe("Please enter your z/OS password. Operation Cancelled");

        // Operation cancelled
        showQuickPick.mockReset();
        showQuickPick.mockResolvedValueOnce("Create a New Connection to z/OS");
        showInputBox.mockReset();
        showInputBox.mockResolvedValueOnce("fake");
        showInputBox.mockResolvedValueOnce("fake/url");
        showInputBox.mockResolvedValueOnce("fake");     
        showInputBox.mockResolvedValueOnce("fake");      
        showInputBox.mockResolvedValueOnce(undefined);
        await profiles.createNewConnection();
        expect(showInformationMessage.mock.calls.length).toBe(5);
        expect(showInformationMessage.mock.calls[4][0]).toBe("Operation Cancelled");
    });

    it("should route through to spawn. Covers conditional test", async () => {
        (child_process.spawnSync as any) = jest.fn((program: string, args: string[], options: any) => {
            const createFakeChildProcess = (status: number, stdout: string, stderr: string) => {
                return {
                    status: 0,
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
        mockJSONParse.mockReturnValueOnce({
            overrides: {
                CredentialManager: "ANO"
            }
        });
        mockJSONParse.mockReturnValueOnce([profileOne, profileTwo]);
        mockJSONParse.mockReturnValueOnce(profileOne);
        await Profiles.createInstance(log);
        expect(Profiles.getInstance().allProfiles).toEqual([profileOne, profileTwo]);
        expect(Profiles.getInstance().defaultProfile).toEqual(profileOne);
    });
    it("should route through to spawn. Coverage of error handling", async () => {
        (child_process.spawnSync as any) = jest.fn((program: string, args: string[], options: any) => {
            const createFakeChildProcess = (status: number, stdout: string, stderr: string) => {
                return {
                    status: 0,
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
        mockJSONParse.mockReturnValueOnce({
            overrides: undefined
        });
        mockJSONParse.mockReturnValueOnce([profileOne, profileTwo]);
        mockJSONParse.mockReturnValueOnce(profileOne);
        await Profiles.createInstance(log);
        expect(Profiles.getInstance().allProfiles).toEqual([profileOne, profileTwo]);
        expect(Profiles.getInstance().defaultProfile).toEqual(profileOne);
    });
});
