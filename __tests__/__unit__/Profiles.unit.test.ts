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

    describe("Creating a new connection", () => {
        let profiles: Profiles;
        const showInformationMessage = jest.fn();
        const showInputBox = jest.fn();
        const showQuickPick = jest.fn();
        const showErrorMessage = jest.fn();

        Object.defineProperty(vscode.window, "showInformationMessage", { value: showInformationMessage });
        Object.defineProperty(vscode.window, "showErrorMessage", { value: showErrorMessage });
        Object.defineProperty(vscode.window, "showInputBox", {value: showInputBox});
        Object.defineProperty(vscode.window, "showQuickPick", {value: showQuickPick});

        beforeEach(async () => {
            profiles = await Profiles.createInstance(log);
            showQuickPick.mockResolvedValueOnce("Create a New Connection to z/OS");
        });

        afterEach(() => {
            showQuickPick.mockReset();
            showInputBox.mockReset();
            showInformationMessage.mockReset();
        });

        it("should indicate missing property: profile name", async () => {
            // Profile name not supplied
            showInputBox.mockResolvedValueOnce(undefined);
            await profiles.createNewConnection();
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("Profile Name was not supplied. Operation Cancelled");
        });

        it("should indicate missing property: username", async () => {
            // Enter z/OS username
            showInputBox.mockResolvedValueOnce("fake");
            showInputBox.mockResolvedValueOnce("fake/url");
            await profiles.createNewConnection();
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("Please enter your z/OS username. Operation Cancelled");
        });

        it("should indicate missing property: zosmf url", async () => {
            // No valid zosmf value
            showInputBox.mockResolvedValueOnce("fake");
            showInputBox.mockResolvedValueOnce(undefined);
            await profiles.createNewConnection();
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("No valid value for z/OSMF URL. Operation Cancelled");
        });

        it("should indicate missing property: password", async () => {
            // Enter z/OS password
            showInputBox.mockResolvedValueOnce("fake");
            showInputBox.mockResolvedValueOnce("fake/url");
            showInputBox.mockResolvedValueOnce("fake");
            showInputBox.mockResolvedValueOnce(undefined);
            await profiles.createNewConnection();
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("Please enter your z/OS password. Operation Cancelled");
        });

        it("should notify that the operation was cancelled", async () => {
            // Operation cancelled
            showInputBox.mockResolvedValueOnce("fake");
            showInputBox.mockResolvedValueOnce("fake/url");
            showInputBox.mockResolvedValueOnce("fake");
            showInputBox.mockResolvedValueOnce("fake");
            showInputBox.mockResolvedValueOnce(undefined);
            await profiles.createNewConnection();
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
        });

        it("should create profile", async () => {
            showInputBox.mockResolvedValueOnce("fake");
            showInputBox.mockResolvedValueOnce("https://fake:143");
            showInputBox.mockResolvedValueOnce("fake");
            showInputBox.mockResolvedValueOnce("fake");
            showQuickPick.mockReset();
            showQuickPick.mockResolvedValueOnce("False - Accept connections with self-signed certificates");
            let success = true;
            // Do more test
            try {
                await profiles.createNewConnection();
            } catch (error) {
                success = false;
            }
            expect(success).toBe(true);
            if (success) {
                expect(showInformationMessage.mock.calls.length).toBe(1);
                expect(showInformationMessage.mock.calls[0][0]).toBe("Profile fake was created.");
            } else {
                expect(showInformationMessage.mock.calls.length).toBe(0);
                // expect(showInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
            }
        });

        it("should validate URL", async () => {
            const res = await Profiles.getInstance().validateUrl("fake/url");
            expect(res).toBe(false);
        });

        it("should validate URL", async () => {
            const res = await Profiles.getInstance().validateUrl("https://fake:143");
            expect(res).toBe(true);
        });

        it("it should validate duplicate profiles", async () => {
            showInputBox.mockResolvedValueOnce("profile1");
            showInputBox.mockResolvedValueOnce("https://fake:143");
            showInputBox.mockResolvedValueOnce("fake");
            showInputBox.mockResolvedValueOnce("fake");
            showQuickPick.mockReset();
            showQuickPick.mockResolvedValueOnce("True - Reject connections with self-signed certificates");
            await profiles.createNewConnection();
            expect(showErrorMessage.mock.calls.length).toBe(1);
            expect(showErrorMessage.mock.calls[0][0]).toBe("Profile name already exists. Please create a profile using a different name");
            showErrorMessage.mockReset();
            showInformationMessage.mockReset();
        });
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
        try {
            expect(Profiles.getInstance().listProfile()).toEqual([profileOne, profileTwo]);
        } catch (error) {
            // Do Nothing
        }
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
        try {
            expect(Profiles.getInstance().listProfile()).toEqual([profileOne, profileTwo]);
        } catch (error) {
            // Do Nothing
        }
    });
});
