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

jest.mock("Session");

import * as vscode from "vscode";
import { Gui, ValidProfileEnum } from "@zowe/zowe-explorer-api";
import * as profileLoader from "../../../src/Profiles";
import { UnixCommandHandler } from "../../../src/command/UnixCommandHandler";
import * as utils from "../../../src/utils/ProfilesUtils";
import { imperative } from "@zowe/cli";
import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";
import { ZoweExplorerApiRegister } from "../../../src/ZoweExplorerApiRegister";
import * as globals from "../../../src/globals";
import { ZoweLogger } from "../../../src/utils/LoggerUtils";
import { SshSession } from "@zowe/zos-uss-for-zowe-sdk";
import { ZoweLocalStorage } from "../../../src/utils/ZoweLocalStorage";
import { ProfileManagement } from "../../../src/utils/ProfileManagement";

describe("UnixCommand Actions Unit Testing", () => {
    const showQuickPick = jest.fn();
    const showInputBox = jest.fn();
    const showInformationMessage = jest.fn();
    const appendLine = jest.fn();
    const createQuickPick = jest.fn();
    const showErrorMessage = jest.fn();
    const createOutputChannel = jest.fn();
    const mockLoadNamedProfile = jest.fn();
    const mockdefaultProfile = jest.fn();
    const getConfiguration = jest.fn();
    const getProfileInfomock = jest.fn();

    const session = new imperative.Session({
        user: "fake",
        password: "fake",
        hostname: "fake",
        port: 443,
        protocol: "https",
        type: "basic",
    });

    const profileOne: imperative.IProfileLoaded = {
        name: "aProfile",
        profile: {},
        type: "zosmf",
        message: "",
        failNotFound: false,
    };

    const testNode = new ZoweDatasetNode("BRTVS99.DDIR", vscode.TreeItemCollapsibleState.Collapsed, null, session, undefined, undefined, profileOne);

    const outputChannel: vscode.OutputChannel = {
        append: jest.fn(),
        name: "fakeChannel",
        appendLine,
        clear: jest.fn(),
        show: jest.fn(),
        hide: jest.fn(),
        dispose: jest.fn(),
        replace: jest.fn(),
    };

    createOutputChannel.mockReturnValue(outputChannel);
    const qpItem: vscode.QuickPickItem = new utils.FilterDescriptor("Create a new filter");
    const qpItem2 = new utils.FilterItem({ text: "/d iplinfo0" });

    const ProgressLocation = jest.fn().mockImplementation(() => {
        return {
            Notification: 15,
        };
    });

    const withProgress = jest.fn().mockImplementation((progLocation, callback) => {
        return {
            success: true,
            commandResponse: callback(),
        };
    });

    Object.defineProperty(globals, "LOG", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals.LOG, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(profileLoader.Profiles, "createInstance", {
        value: jest.fn(() => {
            return {
                allProfiles: [{ name: "firstName" }, { name: "secondName" }],
                defaultProfile: { name: "firstName" },
            };
        }),
    });
    Object.defineProperty(ProfileManagement, "getRegisteredProfileNameList", {
        value: jest.fn().mockReturnValue(["firstName", "secondName"]),
        configurable: true,
    });
    Object.defineProperty(ZoweLogger, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "trace", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode, "ProgressLocation", { value: ProgressLocation });
    Object.defineProperty(vscode.window, "withProgress", { value: withProgress });

    createQuickPick.mockReturnValue({
        placeholder: 'Choose "Create new..." to define a new profile or select an existing profile to add to the Data Set Explorer',
        activeItems: [qpItem2],
        ignoreFocusOut: true,
        items: [qpItem, qpItem2],
        value: undefined,
        show: jest.fn(() => {
            return {};
        }),
        hide: jest.fn(() => {
            return {};
        }),
        onDidAccept: jest.fn(() => {
            return {};
        }),
    });

    Object.defineProperty(vscode.window, "showErrorMessage", { value: showErrorMessage });
    Object.defineProperty(vscode.window, "showQuickPick", { value: showQuickPick });
    Object.defineProperty(vscode.window, "showInputBox", { value: showInputBox });
    Object.defineProperty(vscode.window, "showInformationMessage", { value: showInformationMessage });
    Object.defineProperty(vscode.window, "createQuickPick", { value: createQuickPick });
    Object.defineProperty(vscode.window, "createOutputChannel", { value: createOutputChannel });
    Object.defineProperty(vscode.workspace, "getConfiguration", { value: getConfiguration });
    Object.defineProperty(imperative.ProfileInfo, "profAttrsToProfLoaded", { value: () => ({ profile: {} }) });
    Object.defineProperty(imperative.ConnectionPropsForSessCfg, "addPropsOrPrompt", {
        value: jest.fn(() => {
            return { privateKey: undefined, keyPassphrase: undefined, handshakeTimeout: undefined, type: "basic", port: 22 };
        }),
    });

    mockLoadNamedProfile.mockReturnValue({ profile: { name: "aProfile", type: "zosmf" } });
    mockdefaultProfile.mockReturnValue({ profile: { name: "bprofile", type: "ssh" } });

    getConfiguration.mockReturnValue({
        get: (setting: string) => undefined,
        update: jest.fn(() => {
            return {};
        }),
    });

    Object.defineProperty(ZoweLocalStorage, "storage", {
        value: {
            get: () => ({ persistence: true, favorites: [], history: [], sessions: ["zosmf"], searchHistory: [], fileHistory: [] }),
            update: jest.fn(),
            keys: () => [],
        },
        configurable: true,
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    const apiRegisterInstance = ZoweExplorerApiRegister.getInstance();
    const unixActions = UnixCommandHandler.getInstance();
    const profilesForValidation = { status: "active", name: "fake" };

    SshSession.createSshSessCfgFromArgs = jest.fn(() => {
        return { privateKey: undefined, keyPassphrase: undefined, handshakeTimeout: undefined };
    });

    getProfileInfomock.mockReturnValue({
        usingTeamConfig: true,
        getAllProfiles: jest.fn().mockReturnValue(["dummy"]),
        mergeArgsForProfile: jest.fn().mockReturnValue({
            knownArgs: [
                { argName: "port", argValue: "TEST", secure: false },
                { argName: "host", argValue: "TEST", secure: false },
                { argName: "user", secure: true },
                { argName: "password", secure: true },
            ],
        }),
        loadSecureArg: jest.fn().mockReturnValue("fake"),
    } as any);

    it("test the issueUnixCommand function", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
                    defaultProfile: { name: "firstName" },
                    zosmfProfile: mockLoadNamedProfile,
                    checkCurrentProfile: jest.fn(() => {
                        return profilesForValidation;
                    }),
                    validateProfiles: jest.fn(),
                    getBaseProfile: jest.fn(),
                    getDefaultProfile: mockdefaultProfile,
                    validProfile: ValidProfileEnum.VALID,
                    getProfileInfo: getProfileInfomock,
                };
            }),
        });

        const mockUssApi = await apiRegisterInstance.getUssApi(profileOne);
        const getUssApiMock = jest.fn();
        getUssApiMock.mockReturnValue(mockUssApi);
        apiRegisterInstance.getUssApi = getUssApiMock.bind(apiRegisterInstance);
        jest.spyOn(mockUssApi, "getSession").mockReturnValue(session);

        showQuickPick.mockReturnValueOnce("firstName");

        const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
        const getCommandApiMock = jest.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

        showInputBox.mockReturnValueOnce("/u/directorypath");
        showInputBox.mockReturnValueOnce("/d iplinfo1");

        jest.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(qpItem));
        jest.spyOn(mockCommandApi, "issueUnixCommand").mockReturnValue("iplinfo1" as any);

        await unixActions.issueUnixCommand();

        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the Profile to use to submit the Unix command",
        });
        expect(showInputBox.mock.calls.length).toBe(2);
        expect(appendLine.mock.calls.length).toBe(2);
        expect(appendLine.mock.calls[0][0]).toBe("> /u/directorypath d iplinfo1");
        expect(appendLine.mock.calls[1][0]["commandResponse"]).toBe("iplinfo1");
        expect(showInformationMessage.mock.calls.length).toBe(0);
    });

    it("tests the issueUnixCommand function user selects a history item", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
                    defaultProfile: { name: "firstName" },
                    zosmfProfile: mockLoadNamedProfile,
                    checkCurrentProfile: jest.fn(() => {
                        return profilesForValidation;
                    }),
                    validateProfiles: jest.fn(),
                    getBaseProfile: jest.fn(),
                    getDefaultProfile: mockdefaultProfile,
                    validProfile: ValidProfileEnum.VALID,
                    getProfileInfo: getProfileInfomock,
                };
            }),
        });

        const mockUssApi = await apiRegisterInstance.getUssApi(profileOne);
        const getUssApiMock = jest.fn();
        getUssApiMock.mockReturnValue(mockUssApi);
        apiRegisterInstance.getUssApi = getUssApiMock.bind(apiRegisterInstance);
        jest.spyOn(mockUssApi, "getSession").mockReturnValue(session);

        showQuickPick.mockReturnValueOnce("firstName");

        const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
        const getCommandApiMock = jest.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

        showInputBox.mockReturnValueOnce("/u/directorypath");

        jest.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(qpItem2));
        jest.spyOn(mockCommandApi, "issueUnixCommand").mockReturnValue("iplinfo0" as any);

        await unixActions.issueUnixCommand();

        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the Profile to use to submit the Unix command",
        });
        expect(showInputBox.mock.calls.length).toBe(1);
        expect(appendLine.mock.calls.length).toBe(2);
        expect(appendLine.mock.calls[0][0]).toBe("> /u/directorypath d iplinfo0");
        expect(appendLine.mock.calls[1][0]["commandResponse"]).toBe("iplinfo0");
        expect(showInformationMessage.mock.calls.length).toBe(0);
    });

    it("tests the issueUnixCommand function - issueUnixCommand throws an error", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
                    defaultProfile: { name: "firstName" },
                    zosmfProfile: mockLoadNamedProfile,
                    checkCurrentProfile: jest.fn(() => {
                        return profilesForValidation;
                    }),
                    validateProfiles: jest.fn(),
                    getBaseProfile: jest.fn(),
                    getDefaultProfile: mockdefaultProfile,
                    validProfile: ValidProfileEnum.VALID,
                    getProfileInfo: getProfileInfomock,
                };
            }),
        });

        showQuickPick.mockReturnValueOnce("firstName");
        showInputBox.mockReturnValueOnce("/u/directorypath");
        showInputBox.mockReturnValueOnce("/d iplinfo3");
        withProgress.mockRejectedValueOnce(Error("fake testError"));

        const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
        const getCommandApiMock = jest.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

        jest.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(qpItem));
        jest.spyOn(mockCommandApi, "issueUnixCommand").mockReturnValue("iplinfo3" as any);

        await unixActions.issueUnixCommand();

        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the Profile to use to submit the Unix command",
        });
        expect(showInputBox.mock.calls.length).toBe(2);
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toEqual("Error: fake testError");
    });

    it("tests the issueUnixCommand function user escapes the quick pick box", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
                    defaultProfile: { name: "firstName" },
                    zosmfProfile: mockLoadNamedProfile,
                    checkCurrentProfile: jest.fn(() => {
                        return profilesForValidation;
                    }),
                    validateProfiles: jest.fn(),
                    getBaseProfile: jest.fn(),
                    getDefaultProfile: mockdefaultProfile,
                    validProfile: ValidProfileEnum.VALID,
                    getProfileInfo: getProfileInfomock,
                };
            }),
        });

        showQuickPick.mockReturnValueOnce("firstName");
        showInputBox.mockReturnValueOnce("/u/directorypath");

        const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
        const getCommandApiMock = jest.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

        jest.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(undefined));

        await unixActions.issueUnixCommand();

        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the Profile to use to submit the Unix command",
        });
        expect(showInputBox.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toEqual("No selection made. Operation cancelled.");
    });

    it("If nothing is entered in the inputbox of path", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
                    defaultProfile: { name: "firstName" },
                    zosmfProfile: mockLoadNamedProfile,
                    checkCurrentProfile: jest.fn(() => {
                        return profilesForValidation;
                    }),
                    validateProfiles: jest.fn(),
                    getBaseProfile: jest.fn(),
                    getDefaultProfile: mockdefaultProfile,
                    validProfile: ValidProfileEnum.VALID,
                    getProfileInfo: getProfileInfomock,
                };
            }),
        });
        showQuickPick.mockReturnValueOnce("firstName");
        showInputBox.mockReturnValueOnce("");
        showInputBox.mockReturnValue("/d iplinfo0");

        await unixActions.issueUnixCommand();

        expect(showInformationMessage.mock.calls[0][0]).toEqual("Redirecting to Home Directory");
    });

    it("User escapes the inputBox of path being entered", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
                    defaultProfile: { name: "firstName" },
                    zosmfProfile: mockLoadNamedProfile,
                    checkCurrentProfile: jest.fn(() => {
                        return profilesForValidation;
                    }),
                    validateProfiles: jest.fn(),
                    getBaseProfile: jest.fn(),
                    getDefaultProfile: mockdefaultProfile,
                    validProfile: ValidProfileEnum.VALID,
                    getProfileInfo: getProfileInfomock,
                };
            }),
        });
        showQuickPick.mockReturnValueOnce("firstName");
        showInputBox.mockReturnValueOnce(undefined);

        await unixActions.issueUnixCommand();

        expect(showInformationMessage.mock.calls[0][0]).toEqual("Operation cancelled.");
    });

    it("tests the issueUnixCommand function user escapes the commandbox", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
                    defaultProfile: { name: "firstName" },
                    zosmfProfile: mockLoadNamedProfile,
                    checkCurrentProfile: jest.fn(() => {
                        return profilesForValidation;
                    }),
                    validateProfiles: jest.fn(),
                    getBaseProfile: jest.fn(),
                    getDefaultProfile: mockdefaultProfile,
                    validProfile: ValidProfileEnum.VALID,
                    getProfileInfo: getProfileInfomock,
                };
            }),
        });

        showQuickPick.mockReturnValueOnce("firstName");
        showInputBox.mockReturnValueOnce("/directorypath");
        showInputBox.mockReturnValueOnce(undefined);

        const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
        const getCommandApiMock = jest.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

        jest.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(qpItem));

        await unixActions.issueUnixCommand();

        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the Profile to use to submit the Unix command",
        });
        expect(showInputBox.mock.calls.length).toBe(2);
        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toEqual("No command entered.");
    });

    it("tests the issueUnixCommand function user starts typing a value in quick pick", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
                    defaultProfile: { name: "firstName" },
                    zosmfProfile: mockLoadNamedProfile,
                    checkCurrentProfile: jest.fn(() => {
                        return profilesForValidation;
                    }),
                    validateProfiles: jest.fn(),
                    getBaseProfile: jest.fn(),
                    validProfile: ValidProfileEnum.VALID,
                    getDefaultProfile: mockdefaultProfile,
                    getProfileInfo: getProfileInfomock,
                };
            }),
        });
        createQuickPick.mockReturnValueOnce({
            placeholder: 'Choose "Create new..." to define a new profile or select an existing profile to add to the Data Set Explorer',
            activeItems: [qpItem2],
            ignoreFocusOut: true,
            items: [qpItem, qpItem2],
            value: "/d m=cpu",
            show: jest.fn(() => {
                return {};
            }),
            hide: jest.fn(() => {
                return {};
            }),
            onDidAccept: jest.fn(() => {
                return {};
            }),
        });

        showQuickPick.mockReturnValueOnce("firstName");
        showInputBox.mockReturnValueOnce("/u/directorypath");
        showInputBox.mockReturnValueOnce(undefined);

        const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
        const getCommandApiMock = jest.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

        jest.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(qpItem));

        await unixActions.issueUnixCommand();

        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the Profile to use to submit the Unix command",
        });
        expect(showInputBox.mock.calls.length).toBe(1);
    });

    it("tests the issueUnixCommand error in prompt credentials", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: undefined, password: undefined } }, { name: "secondName" }],
                    defaultProfile: { name: "firstName" },
                    validateProfiles: jest.fn(),
                    getBaseProfile: jest.fn(),
                    checkCurrentProfile: jest.fn(() => {
                        return ValidProfileEnum.INVALID;
                    }),
                    validProfile: ValidProfileEnum.INVALID,
                    getDefaultProfile: mockdefaultProfile,
                    getProfileInfo: getProfileInfomock,
                };
            }),
        });

        showQuickPick.mockReturnValueOnce("firstName");
        showInputBox.mockReturnValueOnce("fake");

        await unixActions.issueUnixCommand();

        expect(showErrorMessage.mock.calls.length).toBe(1);
    });

    it("tests the issueUnixCommand function user does not select a profile", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
                    defaultProfile: { name: "firstName" },
                    validProfile: ValidProfileEnum.VALID,
                    getBaseProfile: jest.fn(),
                    checkCurrentProfile: jest.fn(),
                    zosmfProfile: mockLoadNamedProfile,
                };
            }),
        });

        showQuickPick.mockReturnValueOnce(undefined);

        await unixActions.issueUnixCommand();

        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toEqual("Operation Cancelled");
    });

    it("tests the issueUnixCommand function no profiles error", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [],
                    defaultProfile: undefined,
                    checkCurrentProfile: jest.fn(() => {
                        return profilesForValidation;
                    }),
                    validateProfiles: jest.fn(),
                    getBaseProfile: jest.fn(),
                    validProfile: ValidProfileEnum.VALID,
                };
            }),
        });
        Object.defineProperty(ProfileManagement, "getRegisteredProfileNameList", {
            value: jest.fn().mockReturnValue([]),
            configurable: true,
        });
        await unixActions.issueUnixCommand();
        expect(showInformationMessage.mock.calls[0][0]).toEqual("No profiles available");
    });

    it("tests the issueUnixCommand function from a session", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
                    defaultProfile: { name: "firstName" },
                    validProfile: ValidProfileEnum.VALID,
                    getBaseProfile: jest.fn(),
                    checkCurrentProfile: jest.fn(),
                    zosmfProfile: mockLoadNamedProfile,
                    getDefaultProfile: mockdefaultProfile,
                    getProfileInfo: getProfileInfomock,
                };
            }),
        });

        jest.spyOn(unixActions, "checkCurrentProfile").mockReturnValue(undefined);

        const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
        const getCommandApiMock = jest.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

        showInputBox.mockReturnValueOnce("/d iplinfo1");
        jest.spyOn(mockCommandApi, "issueUnixCommand").mockReturnValueOnce("iplinfo1" as any);

        await unixActions.issueUnixCommand(session, null as any, testNode);

        expect(showInformationMessage.mock.calls.length).toBe(0);
    });

    it("ssh profile not found", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    getProfileInfo: jest.fn().mockReturnValue({
                        usingTeamConfig: true,
                        getAllProfiles: jest.fn().mockReturnValue(undefined),
                    } as any),
                };
            }),
        });
        await unixActions.setsshSession();
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toEqual("No SSH profile found. Please create an SSH profile before issuing Unix commands.");
    });

    it("tests the selectSshProfile function", async () => {
        showQuickPick.mockReturnValueOnce("test1" as any);
        await expect(
            (unixActions as any).selectSshProfile([
                {
                    name: "test1",
                },
                {
                    name: "test2",
                },
            ])
        ).resolves.toEqual({
            name: "test1",
        });
    });

    it("tests the selectSshProfile function when user escapes", async () => {
        showQuickPick.mockReturnValueOnce(undefined);
        await expect(
            (unixActions as any).selectSshProfile([
                {
                    name: "test1",
                },
                {
                    name: "test2",
                },
            ])
        ).resolves.toBe(undefined);
        expect(showInformationMessage.mock.calls[0][0]).toEqual("Operation Cancelled");
    });
    it("ssh profile doesn't contain credentials", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    getProfileInfo: getProfileInfomock.mockReturnValue({
                        usingTeamConfig: true,
                        getAllProfiles: jest.fn().mockReturnValue(["dummy"]),
                        mergeArgsForProfile: jest.fn().mockReturnValue({
                            knownArgs: [
                                { argName: "port", argValue: "TEST", secure: false },
                                { argName: "host", argValue: "TEST", secure: false },
                                { argName: "user", secure: true },
                                { argName: "password", secure: true },
                            ],
                        }),
                        loadSecureArg: jest.fn().mockReturnValue(undefined),
                    } as any),
                };
            }),
        });
        await (unixActions as any).getSshProfile();
        expect(showErrorMessage.mock.calls[0][0]).toEqual("Credentials are missing for SSH profile");
    });
});
