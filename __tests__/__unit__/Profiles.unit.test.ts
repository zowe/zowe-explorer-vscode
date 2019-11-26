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
import { Logger, ISession, Session } from "@brightside/imperative";
import * as child_process from "child_process";
import * as vscode from "vscode";
import * as loader from "../../src/ProfileLoader";
import { Profiles } from "../../src/Profiles";
import { ZosmfSession } from "@brightside/core";

describe("Profile class unit tests", () => {
    // Mocking log.debug
    const log = Logger.getAppLogger();

    const profileOne = { name: "profile1", profile: {}, type: "zosmf" };
    const profileTwo = { name: "profile2", profile: {}, type: "zosmf" };

    const mockJSONParse = jest.spyOn(JSON, "parse");
    const showInformationMessage = jest.fn();
    const showInputBox = jest.fn();
    const showQuickPick = jest.fn();
    const showErrorMessage = jest.fn();

    Object.defineProperty(vscode.window, "showInformationMessage", { value: showInformationMessage });
    Object.defineProperty(vscode.window, "showErrorMessage", { value: showErrorMessage });
    Object.defineProperty(vscode.window, "showInputBox", { value: showInputBox });
    Object.defineProperty(vscode.window, "showQuickPick", { value: showQuickPick });

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
        beforeEach(async () => {
            profiles = await Profiles.createInstance(log);
            Object.defineProperty(Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [{name: "profile1"}, {name: "profile2"}],
                        defaultProfile: {name: "profile1"},
                        loadNamedProfile: [{name: "profile1"}, {profile: {user: "fake", password: "1234"}}],
                        promptCredentials: jest.fn(()=> {
                            return {};
                        }),
                        createNewConnection: jest.fn(()=>{
                            return {};
                        }),
                        listProfile: jest.fn(()=>{
                            return {};
                        }),
                        saveProfile: jest.fn(()=>{
                            return {profile: {}};
                        }),
                        validateAndParseUrl: jest.fn(()=>{
                            return {};
                        }),
                    };
                })
            });
        });

        afterEach(() => {
            showQuickPick.mockReset();
            showInputBox.mockReset();
            showInformationMessage.mockReset();
            showErrorMessage.mockReset();
        });

        it("should indicate missing property: zosmf url", async () => {
            // No valid zosmf value
            showInputBox.mockResolvedValueOnce(undefined);
            await profiles.createNewConnection(profileOne.name);
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("No valid value for z/OSMF URL. Operation Cancelled");
        });

        it("should indicate missing property: username", async () => {
            // Enter z/OS password
            showInputBox.mockResolvedValueOnce("https://fake:143");
            showInputBox.mockResolvedValueOnce(undefined);
            await profiles.createNewConnection(profileOne.name);
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
        });

        it("should indicate missing property: password", async () => {
            // Enter z/OS password
            showInputBox.mockResolvedValueOnce("https://fake:143");
            showInputBox.mockResolvedValueOnce("fake");
            showInputBox.mockResolvedValueOnce(undefined);
            await profiles.createNewConnection(profileOne.name);
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
        });

        it("should indicate missing property: rejectUnauthorized", async () => {
            // Operation cancelled
            showInputBox.mockResolvedValueOnce("https://fake:143");
            showInputBox.mockResolvedValueOnce("fake");
            showInputBox.mockResolvedValueOnce("fake");
            showInputBox.mockResolvedValueOnce(undefined);
            await profiles.createNewConnection(profileOne.name);
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
        });

        it("should validate that profile name already exists", async () => {
            showInputBox.mockResolvedValueOnce("https://fake:143");
            showInputBox.mockResolvedValueOnce("fake");
            showInputBox.mockResolvedValueOnce("fake");
            showQuickPick.mockReset();
            showQuickPick.mockResolvedValueOnce("False - Accept connections with self-signed certificates");
            await profiles.createNewConnection(profileOne.name);
            expect(showErrorMessage.mock.calls.length).toBe(1);
            expect(showErrorMessage.mock.calls[0][0]).toBe("Profile name already exists. Please create a profile using a different name");
        });

        it("should create new profile", async () => {
            showInputBox.mockResolvedValueOnce("https://fake:143");
            showInputBox.mockResolvedValueOnce("fake");
            showInputBox.mockResolvedValueOnce("fake");
            showQuickPick.mockReset();
            showQuickPick.mockResolvedValueOnce("False - Accept connections with self-signed certificates");
            await profiles.createNewConnection("fake");
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("Profile fake was created.");
        });

        it("should create profile with optional credentials", async () => {
            showInputBox.mockResolvedValueOnce("https://fake:143");
            showInputBox.mockResolvedValueOnce("");
            showInputBox.mockResolvedValueOnce("");
            showQuickPick.mockReset();
            showQuickPick.mockResolvedValueOnce("False - Accept connections with self-signed certificates");
            await profiles.createNewConnection("fake");
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("Profile fake was created.");
        });

        it("should create profile https+443", async () => {

            showInputBox.mockResolvedValueOnce("https://fake:443");
            showInputBox.mockResolvedValueOnce("fake");
            showInputBox.mockResolvedValueOnce("fake");
            showQuickPick.mockReset();
            showQuickPick.mockResolvedValueOnce("False - Accept connections with self-signed certificates");
            await profiles.createNewConnection("fake");
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("Profile fake was created.");
        });

        it("should create 2 consecutive profiles", async () => {
            showInputBox.mockResolvedValueOnce("https://fake1:143");
            showInputBox.mockResolvedValueOnce("fake1");
            showInputBox.mockResolvedValueOnce("fake1");
            showQuickPick.mockReset();
            showQuickPick.mockResolvedValueOnce("False - Accept connections with self-signed certificates");
            await profiles.createNewConnection("fake1");
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("Profile fake1 was created.");

            showInputBox.mockReset();
            showInformationMessage.mockReset();
            showInputBox.mockResolvedValueOnce("fake2");
            showInputBox.mockResolvedValueOnce("https://fake2:143");
            showInputBox.mockResolvedValueOnce("fake2");
            showInputBox.mockResolvedValueOnce("fake2");
            showQuickPick.mockReset();
            showQuickPick.mockResolvedValueOnce("True - Reject connections with self-signed certificates");
            await profiles.createNewConnection("fake2");
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("Profile fake2 was created.");
        });

        it("should prompt credentials", async () => {
            const promptProfile = {name: "profile1", profile: {Session: {ISession: {user: "fake", password: "1234"}}}};
            const session  = (await ZosmfSession.createBasicZosmfSession(promptProfile.profile) as ISession);
            Object.defineProperty(Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [{name: "firstName", profile: {user:undefined, password: undefined}}, {name: "secondName"}],
                        defaultProfile: {name: "firstName"},
                        loadNamedProfile: promptProfile,
                        promptCredentials: jest.fn(()=> {
                            return [{values: "fake"}, {values: "fake"}, {values: "fake"}];
                    }),
                    };
                })
            });
            Object.defineProperty(ZosmfSession, "createBasicZosmfSession", {
                value: jest.fn(() => {
                    return {
                        ISession: {user: "fake", password: "fake", base64EncodedAuth: "fake"}
                    };
                })
            });
            showInputBox.mockResolvedValueOnce("fake");
            showInputBox.mockResolvedValueOnce("fake");
            const res = await profiles.promptCredentials(promptProfile.name);
            expect(res[0]).toBe("fake");
            expect(res[1]).toBe("fake");
            expect(res[2]).toBe("fake");
        });

        it("should prompt credentials: username invalid", async () => {
            const promptProfile = {name: "profile1", profile: {user: "fake", password: "1234"}};
            const session  = (await ZosmfSession.createBasicZosmfSession(promptProfile.profile) as ISession);
            Object.defineProperty(Profiles.getInstance, "promptCredentials", {
                value: jest.fn(() => {
                    return {
                        updSession: session
                    };
                })
            });
            showInputBox.mockResolvedValueOnce(undefined);
            showInputBox.mockResolvedValueOnce("fake");
            const res = await profiles.promptCredentials(promptProfile.name);
            expect(showErrorMessage.mock.calls.length).toBe(1);
            expect(showErrorMessage.mock.calls[0][0]).toBe("Please enter your z/OS username. Operation Cancelled");
        });

        it("should prompt credentials: username invalid", async () => {
            const promptProfile = {name: "profile1", profile: {user: "fake", password: "1234"}};
            const session  = (await ZosmfSession.createBasicZosmfSession(promptProfile.profile) as ISession);
            Object.defineProperty(Profiles.getInstance, "promptCredentials", {
                value: jest.fn(() => {
                    return {
                        updSession: session
                    };
                })
            });
            showInputBox.mockResolvedValueOnce("fake");
            showInputBox.mockResolvedValueOnce(undefined);
            const res = await profiles.promptCredentials(promptProfile.name);
            expect(showErrorMessage.mock.calls.length).toBe(1);
            expect(showErrorMessage.mock.calls[0][0]).toBe("Please enter your z/OS password. Operation Cancelled");
        });

        it("should validate URL", async () => {
            const input = "fake/url";
            const res = await profiles.validateAndParseUrl(input);
            expect(res.valid).toBe(false);
        });

        it("should validate URL and port 143", async () => {
            const input = "https://fake:143";
            const res = await profiles.validateAndParseUrl(input);
            expect(res.valid).toBe(true);
            expect(res.host).toBe("fake");
            // tslint:disable-next-line: no-magic-numbers
            expect(res.port).toBe(143);

        });

        it("should validate https:<no_port> url", async () => {
            const res = await profiles.validateAndParseUrl("https://10.142.0.23/some/path");
            expect(res.valid).toBe(true);
            expect(res.host).toBe("10.142.0.23");
            // tslint:disable-next-line
            expect(res.port).toBe(443);
        });

        it("should validate https:443 url", async () => {
            const res = await profiles.validateAndParseUrl("https://10.142.0.23:443");
            expect(res.valid).toBe(true);
            expect(res.host).toBe("10.142.0.23");
            // tslint:disable-next-line
            expect(res.port).toBe(443);
        });

        it("should reject http:<no_port> url", async () => {
            const res = await profiles.validateAndParseUrl("http://10.142.0.23/some/path");
            expect(res.valid).toBe(false);
        });

        it("should reject out of range port url", async () => {
            const res = await profiles.validateAndParseUrl("http://10.142.0.23:9999999999/some/path");
            expect(res.valid).toBe(false);
        });

        it("should reject http:80 url", async () => {
            const res = await profiles.validateAndParseUrl("http://fake:80");
            expect(res.valid).toBe(false);
        });

        it("should reject ftp protocol url", async () => {
            const res = await profiles.validateAndParseUrl("ftp://fake:80");
            expect(res.valid).toBe(false);
        });

        it("should reject invalid url syntax", async () => {
            const res = await profiles.validateAndParseUrl("https://fake::80");
            expect(res.valid).toBe(false);
        });

    });

    it("should route through to spawn. Covers conditional test", async () => {
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "profile1", profile: {}, type: "zosmf"}, {name: "profile2", profile: {}, type: "zosmf"}],
                    defaultProfile: {name: "profile1", profile: {}, type: "zosmf"},
                    createNewConnection: jest.fn(()=>{
                        return {newprofile: "fake"};
                    }),
                    listProfile: jest.fn(()=>{
                        return {};
                    }),
                };
            })
        });
        (child_process.spawnSync as any) = jest.fn((program: string, args: string[], options: any) => {
            const createFakeChildProcess = (status: number, stdout: string, stderr: string) => {
                return {
                    status: 0,
                    stdout,
                    stderr
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

    it("should call listProfile", async () => {

        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "firstName"}, {name: "secondName"}],
                    defaultProfile: {name: "firstName"},
                    createNewConnection: jest.fn(()=>{
                        return {};
                    }),
                    listProfile: jest.fn(()=>{
                        return {};
                    }),
                };
            })
        });
        const res = (await Profiles.createInstance(log)).listProfile();
        expect(res).toEqual([profileOne, profileTwo]);
    });

    it("should call listProfile with invalid allProfiles", async () => {

        Object.defineProperty(Profiles.getInstance, "listProfile", {
            value: jest.fn(() => {
                return {
                    allProfiles: undefined,
                    defaultProfile: undefined,
                    map: jest.fn()
                };
            })
        });
        (await Profiles.createInstance(log)).listProfile();
        expect(showErrorMessage.mock.calls.length).toBe(1);
    });

    it("should route through to spawn. Coverage of error handling", async () => {
        // tslint:disable-next-line: prefer-const
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{name: "profile1", profile: {}, type: "zosmf"}, {name: "profile2", profile: {}, type: "zosmf"}],
                    defaultProfile: {name: "profile1", profile: {}, type: "zosmf"},
                    createNewConnection: jest.fn(()=>{
                        return {};
                    }),
                    listProfile: jest.fn(()=>{
                        return {};
                    }),
                };
            })
        });
        (child_process.spawnSync as any) = jest.fn((program: string, args: string[], options: any) => {
            const createFakeChildProcess = (status: number, stdout: string, stderr: string) => {
                return {
                    status: 0,
                    stdout,
                    stderr
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

    it("should handle loadDefaultProfile throwing an error", async () => {
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
                return createFakeChildProcess(1, "", "");
            }
        });
        mockJSONParse.mockReturnValueOnce({
            overrides: undefined
        });
        mockJSONParse.mockReturnValueOnce([profileOne, profileTwo]);
        mockJSONParse.mockReturnValueOnce(profileOne);
        const checkLoader = jest.spyOn(loader, "loadDefaultProfile");
        // Mocking log.debug
        const logA = new Logger(undefined);
        Object.defineProperty(logA, "warn", {
            value: jest.fn()
        });
        const mockWarn = jest.spyOn(logA, "warn");
        await Profiles.createInstance(logA);
        expect(checkLoader).toHaveBeenCalledTimes(1);
        expect(mockWarn.mock.calls.length).toBe(1);
        expect(mockWarn.mock.calls[0][0]).toContain("Unable to locate a default profile. CLI may not be installed.");
    });

});
