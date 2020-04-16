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
import * as path from "path";
import * as os from "os";
import * as vscode from "vscode";
import * as child_process from "child_process";
import * as globals from "../../src/globals";
import { Logger, ISession, CliProfileManager, IProfileLoaded, Session } from "@zowe/imperative";
import { Profiles, ValidProfileEnum } from "../../src/Profiles";
import { ZosmfSession, IJob } from "@zowe/cli";
import { ZoweUSSNode } from "../../src/uss/ZoweUSSNode";
import { ZoweDatasetNode } from "../../src/dataset/ZoweDatasetNode";
import { Job } from "../../src/job/ZoweJobNode";
import { IZoweDatasetTreeNode, IZoweUSSTreeNode, IZoweJobTreeNode, IZoweNodeType } from "../../src/api/IZoweTreeNode";
import { IZoweTree } from "../../src/api/IZoweTree";
import { DatasetTree } from "../../src/dataset/DatasetTree";
import { USSTree } from "../../src/uss/USSTree";
import { ZosJobsProvider } from "../../src/job/ZosJobsProvider";
import * as testConst from "../../resources/testProfileData";

describe("Profile class unit tests", () => {
    // Mocking log.debug
    const log = Logger.getAppLogger();

    const profileOne = { name: "profile1", profile: {}, type: "zosmf" };
    const profileTwo = { name: "profile2", profile: {}, type: "zosmf" };
    const mockLoadNamedProfile = jest.fn();
    const profileThree: IProfileLoaded = {
        name: "profile3",
        profile: {
            user: undefined,
            password: undefined
        },
        type: "zosmf",
        message: "",
        failNotFound: false
    };
    mockLoadNamedProfile.mockReturnValue(profileThree);

    const session = new Session({
        user: "fake",
        password: "fake",
        hostname: "fake",
        protocol: "https",
        type: "basic",
    });

    const iJob: IJob = {
        "jobid": "JOB1234",
        "jobname": "TESTJOB",
        "files-url": "fake/files",
        "job-correlator": "correlator",
        "phase-name": "PHASE",
        "reason-not-running": "",
        "step-data": [{
            "proc-step-name": "",
            "program-name": "",
            "step-name": "",
            "step-number": 1,
            "active": "",
            "smfid": ""

        }],
        "class": "A",
        "owner": "USER",
        "phase": 0,
        "retcode": "",
        "status": "ACTIVE",
        "subsystem": "SYS",
        "type": "JOB",
        "url": "fake/url"
    };

    const inputBox: vscode.InputBox = {
        value: "input",
        title: null,
        enabled: true,
        busy: false,
        show: jest.fn(),
        hide: jest.fn(),
        step: null,
        dispose: jest.fn(),
        ignoreFocusOut: false,
        totalSteps: null,
        placeholder: undefined,
        password: false,
        onDidChangeValue: jest.fn(),
        onDidAccept: jest.fn(),
        onDidHide: jest.fn(),
        buttons: [],
        onDidTriggerButton: jest.fn(),
        prompt: undefined,
        validationMessage: undefined
    };

    const homedir = path.join(os.homedir(), ".zowe");
    const mockJSONParse = jest.spyOn(JSON, "parse");
    const showInformationMessage = jest.fn();
    const showInputBox = jest.fn();
    const createInputBox = jest.fn();
    const showQuickPick = jest.fn();
    const showErrorMessage = jest.fn();
    const getConfiguration = jest.fn();
    const createTreeView = jest.fn();
    const createBasicZosmfSession = jest.fn();

    Object.defineProperty(vscode.window, "showInformationMessage", { value: showInformationMessage });
    Object.defineProperty(vscode.window, "showErrorMessage", { value: showErrorMessage });
    Object.defineProperty(vscode.window, "showInputBox", { value: showInputBox });
    Object.defineProperty(vscode.window, "createInputBox", { value: createInputBox });
    Object.defineProperty(vscode.window, "showQuickPick", { value: showQuickPick });
    Object.defineProperty(vscode.window, "createTreeView", {value: createTreeView});
    Object.defineProperty(vscode.workspace, "getConfiguration", { value: getConfiguration });
    Object.defineProperty(ZosmfSession, "createBasicZosmfSession", { value: createBasicZosmfSession });

    const sessTree: IZoweTree<IZoweDatasetTreeNode> = new DatasetTree();
    const ussTree: IZoweTree<IZoweUSSTreeNode> = new USSTree();
    const jobsTree: IZoweTree<IZoweJobTreeNode> = new ZosJobsProvider();

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
                        checkCurrentProfile: jest.fn(()=> {
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
                        updateProfile: jest.fn(()=>{
                            return {};
                        }),
                    };
                })
            });
        });

        afterEach(() => {
            showInputBox.mockReset();
            showQuickPick.mockReset();
            createInputBox.mockReset();
            showInformationMessage.mockReset();
            showErrorMessage.mockReset();
        });

        it("should indicate missing property: zosmf url", async () => {
            // No valid zosmf value
            createInputBox.mockReturnValue(inputBox);
            profiles.getUrl = () => new Promise((resolve) => { resolve(undefined); });
            await profiles.createNewConnection(profileOne.name);
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("No valid value for z/OSMF URL. Operation Cancelled");
        });

        it("should indicate missing property: username", async () => {
            // Enter z/OS password
            createInputBox.mockReturnValue(inputBox);
            profiles.getUrl = () => new Promise((resolve) => { resolve("https://fake:143"); });
            showInputBox.mockResolvedValueOnce(undefined);
            await profiles.createNewConnection(profileOne.name);
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
        });

        it("should indicate missing property: password", async () => {
            // Enter z/OS password
            createInputBox.mockReturnValue(inputBox);
            profiles.getUrl = () => new Promise((resolve) => { resolve("https://fake:143"); });
            showInputBox.mockResolvedValueOnce("fake");
            showInputBox.mockResolvedValueOnce(undefined);
            await profiles.createNewConnection(profileOne.name);
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
        });

        it("should indicate missing property: rejectUnauthorized", async () => {
            // Operation cancelled
            createInputBox.mockReturnValue(inputBox);
            profiles.getUrl = () => new Promise((resolve) => { resolve("https://fake:143"); });
            showInputBox.mockResolvedValueOnce("fake");
            showInputBox.mockResolvedValueOnce("fake");
            showInputBox.mockResolvedValueOnce(undefined);
            await profiles.createNewConnection(profileOne.name);
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
        });

        it("should validate that profile name already exists", async () => {
            createInputBox.mockReturnValue(inputBox);
            profiles.getUrl = () => new Promise((resolve) => { resolve("https://fake:143"); });
            showInputBox.mockResolvedValueOnce("fake");
            showInputBox.mockResolvedValueOnce("fake");
            showQuickPick.mockReset();
            showQuickPick.mockResolvedValueOnce("False - Accept connections with self-signed certificates");
            await profiles.createNewConnection(profileOne.name);
            expect(showErrorMessage.mock.calls.length).toBe(1);
            expect(showErrorMessage.mock.calls[0][0]).toBe("Profile name already exists. Please create a profile using a different name");
        });

        it("should create new profile", async () => {
            createInputBox.mockReturnValue(inputBox);
            profiles.getUrl = () => new Promise((resolve) => { resolve("https://fake:143"); });
            showInputBox.mockResolvedValueOnce("fake");
            showInputBox.mockResolvedValueOnce("fake");
            showQuickPick.mockReset();
            showQuickPick.mockResolvedValueOnce("False - Accept connections with self-signed certificates");
            await profiles.createNewConnection("fake");
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("Profile fake was created.");
        });

        it("should create profile with optional credentials", async () => {
            createInputBox.mockReturnValue(inputBox);
            profiles.getUrl = () => new Promise((resolve) => { resolve("https://fake:143"); });
            showInputBox.mockResolvedValueOnce("");
            showInputBox.mockResolvedValueOnce("");
            showQuickPick.mockReset();
            showQuickPick.mockResolvedValueOnce("False - Accept connections with self-signed certificates");
            await profiles.createNewConnection("fake");
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("Profile fake was created.");
        });

        it("should create profile https+443", async () => {
            createInputBox.mockReturnValue(inputBox);
            profiles.getUrl = () => new Promise((resolve) => { resolve("https://fake:143"); });
            showInputBox.mockResolvedValueOnce("fake");
            showInputBox.mockResolvedValueOnce("fake");
            showQuickPick.mockReset();
            showQuickPick.mockResolvedValueOnce("False - Accept connections with self-signed certificates");
            await profiles.createNewConnection("fake");
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("Profile fake was created.");
        });

        it("should create 2 consecutive profiles", async () => {
            createInputBox.mockReturnValue(inputBox);
            profiles.getUrl = () => new Promise((resolve) => { resolve("https://fake:143"); });
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
            profiles.getUrl = () => new Promise((resolve) => { resolve("https://fake:143"); });
            showInputBox.mockResolvedValueOnce("fake2");
            showInputBox.mockResolvedValueOnce("fake2");

            showQuickPick.mockReset();

            showQuickPick.mockResolvedValueOnce("True - Reject connections with self-signed certificates");
            await profiles.createNewConnection("fake2");
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("Profile fake2 was created.");
        });

        it("should prompt credentials", async () => {
            const promptProfile = {name: "profile1", profile: {user: undefined, password: undefined}};
            profiles.loadNamedProfile = jest.fn(() => {
                return promptProfile as any;
            });
            Object.defineProperty(ZosmfSession, "createBasicZosmfSession", {
                value: jest.fn(() => {
                    return { ISession: {user: "fake", password: "fake", base64EncodedAuth: "fake"} };
                })
            });
            showInputBox.mockResolvedValueOnce("fake");
            showInputBox.mockResolvedValueOnce("fake");
            const res = await profiles.promptCredentials(promptProfile.name);
            expect(res).toEqual(["fake", "fake", "fake"]);
            (profiles.loadNamedProfile as any).mockReset();
          });

        it("should rePrompt credentials", async () => {
        const promptProfile = {name: "profile1", profile: {user: "oldfake", password: "oldfake"}};
        profiles.loadNamedProfile = jest.fn(() => {
            return promptProfile as any;
        });

        Object.defineProperty(ZosmfSession, "createBasicZosmfSession", {
            value: jest.fn(() => {
                return { ISession: {user: "fake", password: "fake", base64EncodedAuth: "fake"} };
            })
        });

        showInputBox.mockResolvedValueOnce("fake");
        showInputBox.mockResolvedValueOnce("fake");
        const res = await profiles.promptCredentials(promptProfile.name, true);
        expect(res).toEqual(["fake", "fake", "fake"]);
        (profiles.loadNamedProfile as any).mockReset();
        });

        it("should prompt credentials: username invalid", async () => {
            const promptProfile = {name: "profile1", profile: {user: undefined, password: undefined}};
            profiles.loadNamedProfile = jest.fn(() => {
                return promptProfile as any;
            });
            showInputBox.mockResolvedValueOnce(undefined);
            const res = await profiles.promptCredentials(promptProfile.name);
            expect(res).toBeUndefined();
            expect(showErrorMessage.mock.calls.length).toBe(1);
            expect(showErrorMessage.mock.calls[0][0]).toBe("Please enter your z/OS username. Operation Cancelled");
            (profiles.loadNamedProfile as any).mockReset();
        });

        it("should prompt credentials: password invalid", async () => {
            const promptProfile = {name: "profile1", profile: {user: undefined, password: undefined}};
            profiles.loadNamedProfile = jest.fn(() => {
                return promptProfile as any;
            });
            showInputBox.mockResolvedValueOnce("fake");
            showInputBox.mockResolvedValueOnce(undefined);
            const res = await profiles.promptCredentials(promptProfile.name);
            expect(res).toBeUndefined();
            expect(showErrorMessage.mock.calls.length).toBe(1);
            expect(showErrorMessage.mock.calls[0][0]).toBe("Please enter your z/OS password. Operation Cancelled");
            (profiles.loadNamedProfile as any).mockReset();
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

    describe("Deleting Profiles", () => {
        let profiles: Profiles;
        beforeEach(async () => {
            profiles = await Profiles.createInstance(log);
            Object.defineProperty(Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: [{name: "profile1"}, {name: "profile2"}, {name: "profile3"}],
                        defaultProfile: {name: "profile1"},
                        loadNamedProfile: mockLoadNamedProfile,
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
                        updateProfile: jest.fn(()=>{
                            return {};
                        }),
                        getDeleteProfile: jest.fn(()=>{
                            return {};
                        }),
                        deletePrompt: jest.fn(()=>{
                            return {};
                        }),
                        deleteProf: jest.fn(()=>{
                            return {};
                        })
                    };
                })
            });
        });

        afterEach(() => {
            showInputBox.mockReset();
            showQuickPick.mockReset();
            createInputBox.mockReset();
            showInformationMessage.mockReset();
            showErrorMessage.mockReset();
        });

        it("should delete profile from command palette", async () => {
            showQuickPick.mockResolvedValueOnce("profile1");
            showQuickPick.mockResolvedValueOnce("Yes");
            await profiles.deleteProfile(sessTree, ussTree, jobsTree);
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("Profile profile1 was deleted.");
        });

        it("should handle missing selection: profile name", async () => {
            showQuickPick.mockResolvedValueOnce(undefined);
            await profiles.deleteProfile(sessTree, ussTree, jobsTree);
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
        });

        it("should handle case where user selects No", async () => {
            showQuickPick.mockResolvedValueOnce("profile1");
            showQuickPick.mockResolvedValueOnce("No");
            await profiles.deleteProfile(sessTree, ussTree, jobsTree);
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
        });

        it("should handle case where there are no profiles to delete", async () => {
            Object.defineProperty(Profiles, "getInstance", {
                value: jest.fn(() => {
                    return {
                        allProfiles: []
                    };
                })
            });
            profiles.refresh();
            await profiles.deleteProfile(sessTree, ussTree, jobsTree);
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("No profiles available");
        });

        it("should delete profile from context menu", async () => {
            const dsNode = new ZoweDatasetNode(
                "profile3", vscode.TreeItemCollapsibleState.Expanded, null, session, undefined, undefined, profileThree);
            dsNode.contextValue = globals.DS_SESSION_CONTEXT;
            showQuickPick.mockResolvedValueOnce("Yes");
            await profiles.deleteProfile(sessTree, ussTree, jobsTree, dsNode);
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("Profile profile3 was deleted.");
        });

        it("should delete session from Data Set tree", async () => {
            const startLength = sessTree.mSessionNodes.length;
            const favoriteLength = sessTree.mFavorites.length;
            const dsNode = new ZoweDatasetNode(
                "profile3", vscode.TreeItemCollapsibleState.Expanded, null, session, undefined, undefined, profileThree);
            dsNode.contextValue = globals.DS_SESSION_CONTEXT;
            sessTree.mSessionNodes.push(dsNode);
            sessTree.addFavorite(dsNode);
            showQuickPick.mockResolvedValueOnce("Yes");
            await profiles.deleteProfile(sessTree, ussTree, jobsTree, dsNode);
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("Profile profile3 was deleted.");
            expect(sessTree.mSessionNodes.length).toEqual(startLength);
            expect(sessTree.mFavorites.length).toEqual(favoriteLength);
        });

        it("should delete session from USS tree", async () => {
            const startLength = ussTree.mSessionNodes.length;
            const favoriteLength = ussTree.mFavorites.length;
            const ussNode = new ZoweUSSNode(
                "[profile3]: profile3", vscode.TreeItemCollapsibleState.Expanded,
                null, session, null, false, profileThree.name, null, profileThree);
            ussNode.contextValue = globals.USS_SESSION_CONTEXT;
            ussNode.profile = profileThree;
            ussTree.addSession("profile3");
            ussTree.mSessionNodes.push(ussNode);
            ussTree.mFavorites.push(ussNode);
            showQuickPick.mockResolvedValueOnce("Yes");
            await profiles.deleteProfile(sessTree, ussTree, jobsTree, ussNode);
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("Profile profile3 was deleted.");
            expect(ussTree.mSessionNodes.length).toEqual(startLength);
            expect(ussTree.mFavorites.length).toEqual(favoriteLength);
        });

        it("should delete session from Jobs tree", async () => {
            const startLength = jobsTree.mSessionNodes.length;
            const favoriteLength = jobsTree.mFavorites.length;
            const jobNode = new Job(
                "profile3", vscode.TreeItemCollapsibleState.Expanded, null, session, iJob, profileThree);
            jobNode.contextValue = globals.JOBS_SESSION_CONTEXT;
            jobsTree.mSessionNodes.push(jobNode);
            jobsTree.addFavorite(jobNode);
            showQuickPick.mockResolvedValueOnce("Yes");
            await profiles.deleteProfile(sessTree, ussTree, jobsTree, jobNode);
            expect(showInformationMessage.mock.calls.length).toBe(1);
            expect(showInformationMessage.mock.calls[0][0]).toBe("Profile profile3 was deleted.");
            expect(jobsTree.mSessionNodes.length).toEqual(startLength);
            expect(jobsTree.mFavorites.length).toEqual(favoriteLength);
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
    });

    it("Tests checkCurrentProfile() with valid profile", async () => {
        const theProfiles = await Profiles.createInstance(log);
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    promptCredentials: jest.fn(() => {
                        return ["testUser", "testPass", "fake"];
                    })
                };
            })
        });
        const testProfile = {
            type : "zosmf",
            host: null,
            port: 1443,
            user: null,
            password: null,
            rejectUnauthorized: false,
            name: "testName"
        };
        const testIProfile: IProfileLoaded = {
            name: "testProf",
            profile: testProfile,
            type: "zosmf",
            message: "",
            failNotFound: false
        };
        theProfiles.validProfile = -1;
        await theProfiles.checkCurrentProfile(testIProfile);
        expect(theProfiles.validProfile).toBe(ValidProfileEnum.VALID);
    });

    it("Tests checkCurrentProfile() with invalid profile", async () => {
        const theProfiles = await Profiles.createInstance(log);
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    promptCredentials: jest.fn(() => {
                        return undefined;
                    })
                };
            })
        });
        const testProfile = {
            type : "zosmf",
            host: null,
            port: 1443,
            user: null,
            password: null,
            rejectUnauthorized: false,
            name: "testName"
        };
        const testIProfile: IProfileLoaded = {
            name: "testProf",
            profile: testProfile,
            type: "zosmf",
            message: "",
            failNotFound: false
        };
        await theProfiles.checkCurrentProfile(testIProfile);
        expect(theProfiles.validProfile).toBe(ValidProfileEnum.INVALID);
    });
});
