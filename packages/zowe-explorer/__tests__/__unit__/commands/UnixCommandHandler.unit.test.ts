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

import * as vscode from "vscode";
import * as profileLoader from "../../../src/configuration/Profiles";
import { SshSession } from "@zowe/zos-uss-for-zowe-sdk";
import { createInstanceOfProfile, createValidIProfile } from "../../__mocks__/mockCreators/shared";
import { Gui, imperative, Validation } from "@zowe/zowe-explorer-api";
import { FilterDescriptor, FilterItem } from "../../../src/management/FilterManagement";
import { ZoweLocalStorage } from "../../../src/tools/ZoweLocalStorage";
import { ZoweExplorerApiRegister } from "../../../src/extending/ZoweExplorerApiRegister";
import { ProfileManagement } from "../../../src/management/ProfileManagement";
import { ZoweLogger } from "../../../src/tools/ZoweLogger";
import { ZoweDatasetNode } from "../../../src/trees/dataset/ZoweDatasetNode";
import { UnixCommandHandler } from "../../../src/commands/UnixCommandHandler";
import { Constants } from "../../../src/configuration/Constants";
import { Definitions } from "../../../src/configuration/Definitions";
import { SettingsConfig } from "../../../src/configuration/SettingsConfig";

jest.mock("Session");

describe("UnixCommand Actions Unit Testing", () => {
    const showErrorMessage = jest.fn();
    const showInputBox = jest.fn();
    const showInformationMessage = jest.fn();
    const showQuickPick = jest.fn();
    const createQuickPick = jest.fn();
    const createTerminal = jest.fn();
    const getConfiguration = jest.fn();
    const createOutputChannel = jest.fn();

    const appendLine = jest.fn();
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
    const qpItem = new FilterDescriptor("Create a new filter");
    const qpItem2 = new FilterItem({ text: "/d iplinfo0" });

    const mockLoadNamedProfile = jest.fn();
    Object.defineProperty(profileLoader.Profiles, "createInstance", {
        value: jest.fn(() => {
            return {
                allProfiles: [{ name: "firstProfile" }, { name: "secondProfile" }],
                defaultProfile: { name: "firstProfile" },
            };
        }),
    });

    Object.defineProperty(ZoweLocalStorage, "globalState", {
        value: {
            get: () => ({ persistence: true, favorites: [], history: [], sessions: ["zosmf"], searchHistory: [], fileHistory: [] }),
            update: jest.fn(),
            keys: () => [],
        },
        configurable: true,
    });

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

    const testNode = new ZoweDatasetNode({
        label: "BRTVS99.DDIR",
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        session,
        profile: profileOne,
    });

    let fetchSshProfiles = [
        {
            name: "ssh",
            type: "ssh",
            profile: {
                host: "host.com",
                port: 123,
                user: "testUser",
            },
            message: "",
            failNotFound: false,
        } as imperative.IProfileLoaded,
    ];

    const profileFromConfig = {
        isDefaultProfile: false,
        profLoc: { osLoc: ["/user/configpath"] },
    };

    Object.defineProperty(vscode.window, "showErrorMessage", { value: showErrorMessage });
    Object.defineProperty(vscode.window, "showInputBox", { value: showInputBox });
    Object.defineProperty(vscode.window, "showInformationMessage", { value: showInformationMessage });
    Object.defineProperty(vscode.window, "showQuickPick", { value: showQuickPick });
    Object.defineProperty(vscode.window, "createQuickPick", { value: createQuickPick });
    Object.defineProperty(vscode.window, "createTerminal", { value: createTerminal });
    Object.defineProperty(vscode.window, "createOutputChannel", { value: createOutputChannel });
    Object.defineProperty(vscode, "ProgressLocation", { value: ProgressLocation });
    Object.defineProperty(vscode.window, "withProgress", { value: withProgress });
    Object.defineProperty(ProfileManagement, "getRegisteredProfileNameList", {
        value: jest.fn().mockReturnValue(["firstProfile", "secondProfile"]),
        configurable: true,
    });

    mockLoadNamedProfile.mockReturnValue({ profile: { name: "aProfile", type: "zosmf" } });
    getConfiguration.mockReturnValue({
        get: () => undefined,
        update: jest.fn(() => {
            return {};
        }),
    });

    const profInstance = createInstanceOfProfile(createValidIProfile());
    const origProfilesCache = Object.getOwnPropertyDescriptor(Constants, "PROFILES_CACHE");

    Object.defineProperty(Constants, "PROFILES_CACHE", {
        value: profInstance,
        configurable: true,
    });

    SshSession.createSshSessCfgFromArgs = jest.fn(() => {
        return { privateKey: undefined, keyPassphrase: undefined, handshakeTimeout: undefined };
    });

    Object.defineProperty(ZoweLogger, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "trace", { value: jest.fn(), configurable: true });

    Object.defineProperty(profileLoader.Profiles, "getInstance", {
        value: jest.fn(() => {
            return {
                allProfiles: [{ name: "firstProfile", profile: { user: "testUser", password: "testPass" } }, { name: "secondProfile" }],
                defaultProfile: { name: "firstProfile" },
                zosmfProfile: mockLoadNamedProfile,
                checkCurrentProfile: jest.fn(() => {
                    return profilesForValidation;
                }),
                profileValidationHelper: jest.fn().mockReturnValue("active"),
                validateProfiles: jest.fn(),
                getBaseProfile: jest.fn(),
                validProfile: Validation.ValidationType.VALID,
                fetchAllProfilesByType: jest.fn(() => {
                    return fetchSshProfiles;
                }),
                promptCredentials: jest.fn(() => {
                    return ["entered"];
                }),
                getProfileFromConfig: jest.fn(() => {
                    return profileFromConfig;
                }),
                openConfigFile: jest.fn(),
            };
        }),
    });

    beforeEach(() => {
        jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(false);
    });

    afterEach(() => {
        (UnixCommandHandler as any).instance = undefined;
        jest.clearAllMocks();
    });

    afterAll(() => {
        if (origProfilesCache) {
            Object.defineProperty(Constants, "PROFILES_CACHE", origProfilesCache);
        }
    });

    const apiRegisterInstance = ZoweExplorerApiRegister.getInstance();
    const profilesForValidation = { status: "active", name: "fake" };
    const getUnixActions = () => {
        return UnixCommandHandler.getInstance();
    };

    it("test the issueUnixCommand function", async () => {
        const mockUssApi = await apiRegisterInstance.getUssApi(profileOne);
        const getUssApiMock = jest.fn();
        getUssApiMock.mockReturnValue(mockUssApi);
        apiRegisterInstance.getUssApi = getUssApiMock.bind(apiRegisterInstance);
        jest.spyOn(mockUssApi, "getSession").mockReturnValue(session);

        showQuickPick.mockReturnValueOnce("firstProfile");

        const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
        const getCommandApiMock = jest.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

        showInputBox.mockReturnValueOnce("/u/directorypath");
        showInputBox.mockReturnValueOnce("/d iplinfo1");

        Object.defineProperty(profInstance, "getDefaultProfile", {
            value: jest.fn().mockReturnValueOnce({ profile: { user: "testuser", password: "testpassword" } } as any),
            configurable: true,
        });

        jest.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(qpItem));
        jest.spyOn(mockCommandApi, "issueUnixCommand").mockReturnValue("iplinfo1" as any);

        await getUnixActions().issueUnixCommand();

        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstProfile", "secondProfile"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the profile to use to submit the Unix command",
        });

        expect(showInputBox.mock.calls.length).toBe(2);
        expect(appendLine.mock.calls.length).toBe(2);
        expect(appendLine.mock.calls[0][0]).toBe("> testUser@firstProfile:/u/directorypath $ /d iplinfo1");
        expect(appendLine.mock.calls[1][0]["commandResponse"]).toBe("iplinfo1");
        expect(showInformationMessage.mock.calls.length).toBe(0);
    });

    it("tests the selectServiceProfile function with quickpick", async () => {
        showQuickPick.mockReturnValueOnce("test1" as any);
        await expect(
            getUnixActions().selectServiceProfile([
                {
                    name: "test1",
                },
                {
                    name: "test2",
                },
            ] as any)
        ).resolves.toEqual({
            name: "test1",
        });
    });

    it("tests the issueUnixCommand function user selects a history item", async () => {
        const mockUssApi = await apiRegisterInstance.getUssApi(profileOne);
        const getUssApiMock = jest.fn();
        getUssApiMock.mockReturnValue(mockUssApi);
        apiRegisterInstance.getUssApi = getUssApiMock.bind(apiRegisterInstance);
        jest.spyOn(mockUssApi, "getSession").mockReturnValue(session);

        showQuickPick.mockReturnValueOnce("firstProfile");

        const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
        const getCommandApiMock = jest.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

        Object.defineProperty(profInstance, "getDefaultProfile", {
            value: jest.fn().mockReturnValueOnce({ profile: { user: "testuser", password: "testpassword" } } as any),
            configurable: true,
        });

        showInputBox.mockReturnValueOnce("/u/directorypath");

        jest.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(qpItem2));
        jest.spyOn(mockCommandApi, "issueUnixCommand").mockReturnValue("iplinfo0" as any);

        const actions = getUnixActions();
        (actions.history as any).mSearchHistory = [qpItem2.label];

        await actions.issueUnixCommand();

        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstProfile", "secondProfile"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the profile to use to submit the Unix command",
        });
        expect(showInputBox.mock.calls.length).toBe(1);
        expect(appendLine.mock.calls.length).toBe(2);
        expect(appendLine.mock.calls[0][0]).toBe("> testUser@firstProfile:/u/directorypath $ /d iplinfo0");
        expect(appendLine.mock.calls[1][0]["commandResponse"]).toBe("iplinfo0");
        expect(showInformationMessage.mock.calls.length).toBe(0);
    });

    it("tests the issueUnixCommand function user escapes the quick pick box", async () => {
        showQuickPick.mockReturnValueOnce("firstProfile");
        showInputBox.mockReturnValueOnce("/u/directorypath");

        const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
        const getCommandApiMock = jest.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

        Object.defineProperty(profInstance, "getDefaultProfile", {
            value: jest.fn().mockReturnValueOnce({ profile: { user: "testuser", password: "testpassword" } } as any),
            configurable: true,
        });

        jest.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(undefined));

        const actions = getUnixActions();
        (actions.history as any).mSearchHistory = [qpItem2.label];

        await actions.issueUnixCommand();

        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstProfile", "secondProfile"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the profile to use to submit the Unix command",
        });
        expect(showInputBox.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls.length).toBe(0);
    });

    it("tests the issueUnixCommand function user escapes the commandbox", async () => {
        showQuickPick.mockReturnValueOnce("firstProfile");
        showInputBox.mockReturnValueOnce("/directorypath");
        showInputBox.mockReturnValueOnce(undefined);

        const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
        const getCommandApiMock = jest.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

        Object.defineProperty(profInstance, "getDefaultProfile", {
            value: jest.fn().mockReturnValueOnce({ profile: { user: "testuser", password: "testpassword" } } as any),
            configurable: true,
        });

        jest.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(qpItem));

        await getUnixActions().issueUnixCommand();

        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstProfile", "secondProfile"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the profile to use to submit the Unix command",
        });
        expect(showInputBox.mock.calls.length).toBe(2);
        expect(showInformationMessage.mock.calls.length).toBe(0);
    });

    it("tests the issueUnixCommand function - issueUnixCommand throws an error", async () => {
        showQuickPick.mockReturnValueOnce("firstProfile");
        showInputBox.mockReturnValueOnce("/u/directorypath");
        showInputBox.mockReturnValueOnce("/d iplinfo3");
        withProgress.mockRejectedValueOnce(Error("fake testError"));

        const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
        const getCommandApiMock = jest.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

        Object.defineProperty(profInstance, "getDefaultProfile", {
            value: jest.fn().mockReturnValueOnce({ profile: { user: "testuser", password: "testpassword" } } as any),
            configurable: true,
        });

        jest.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(qpItem));
        jest.spyOn(mockCommandApi, "issueUnixCommand").mockReturnValue("iplinfo3" as any);

        await getUnixActions().issueUnixCommand();

        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstProfile", "secondProfile"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the profile to use to submit the Unix command",
        });
        expect(showInputBox.mock.calls.length).toBe(2);
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toEqual("fake testError");
    });

    it("If nothing is entered in the inputbox of path", async () => {
        Object.defineProperty(profInstance, "getDefaultProfile", {
            value: jest.fn().mockReturnValueOnce({ profile: { user: "testuser", password: "testpassword" } } as any),
            configurable: true,
        });
        showQuickPick.mockReturnValueOnce("firstProfile");

        showInputBox.mockReturnValueOnce("");
        showInputBox.mockReturnValue("/d iplinfo0");

        await getUnixActions().issueUnixCommand();

        expect(showInformationMessage.mock.calls[0][0]).toEqual("Redirecting to Home Directory");
    });

    it("User escapes the inputBox of path being entered", async () => {
        Object.defineProperty(profInstance, "getDefaultProfile", {
            value: jest.fn().mockReturnValueOnce({ profile: { user: "testuser", password: "testpassword" } } as any),
            configurable: true,
        });
        showQuickPick.mockReturnValueOnce("firstProfile");

        showInputBox.mockReturnValueOnce(undefined);

        await getUnixActions().issueUnixCommand();
        expect(showInformationMessage.mock.calls.length).toBe(0);
    });

    it("tests the issueUnixCommand function user starts typing a value in quick pick", async () => {
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

        showQuickPick.mockReturnValueOnce("firstProfile");
        showInputBox.mockReturnValueOnce("/u/directorypath");
        showInputBox.mockReturnValueOnce(undefined);

        Object.defineProperty(profInstance, "getDefaultProfile", {
            value: jest.fn().mockReturnValueOnce({ profile: { user: "testuser", password: "testpassword" } } as any),
            configurable: true,
        });

        const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
        const getCommandApiMock = jest.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

        jest.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(qpItem));

        const actions = getUnixActions();
        (actions.history as any).mSearchHistory = [qpItem2.label];

        await actions.issueUnixCommand();

        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstProfile", "secondProfile"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the profile to use to submit the Unix command",
        });
        expect(showInputBox.mock.calls.length).toBe(1);
    });

    it("tests the issueUnixCommand function user does not select a profile", async () => {
        Object.defineProperty(ProfileManagement, "getRegisteredProfileNameList", {
            value: jest.fn().mockReturnValue(["firstProfile"]),
            configurable: true,
        });
        Object.defineProperty(profInstance, "getDefaultProfile", {
            value: jest.fn().mockReturnValueOnce({ profile: { user: "testuser", password: "testpassword" } } as any),
            configurable: true,
        });
        showQuickPick.mockReturnValueOnce(undefined);

        await getUnixActions().issueUnixCommand();

        expect(showInformationMessage.mock.calls.length).toBe(0);
    });

    it("tests the issueUnixCommand function no profiles error", async () => {
        Object.defineProperty(ProfileManagement, "getRegisteredProfileNameList", {
            value: jest.fn().mockReturnValue([]),
            configurable: true,
        });
        Object.defineProperty(profInstance, "getDefaultProfile", {
            value: jest.fn().mockReturnValueOnce({ profile: { user: "testuser", password: "testpassword" } } as any),
            configurable: true,
        });
        await getUnixActions().issueUnixCommand();
        expect(showInformationMessage.mock.calls[0][0]).toEqual("No profiles available");
    });

    it("ssh profile not found", async () => {
        fetchSshProfiles = [];
        await (getUnixActions() as any).getSshProfile();
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toEqual("No SSH profile found. Please create an SSH profile.");
    });

    it("the ssh profile doesnot have user and pw", async () => {
        fetchSshProfiles = [
            {
                name: "ssh",
                type: "ssh",
                profile: {
                    host: "host.com",
                    port: 123,
                    user: "",
                    password: "",
                    privateKey: "",
                },
                message: "",
                failNotFound: false,
            } as imperative.IProfileLoaded,
        ];
        Object.defineProperty(profInstance, "getDefaultProfile", {
            value: jest.fn().mockReturnValueOnce({ profile: { user: "testuser", password: "testpassword" } } as any),
            configurable: true,
        });
        ((await getUnixActions()) as any).getSshProfile();
    });

    it("the shh profile does not have port or host or both", async () => {
        fetchSshProfiles = [
            {
                name: "ssh",
                type: "ssh",
                profile: {
                    host: "host.com",
                    user: "testUser",
                },
                message: "",
                failNotFound: false,
            } as imperative.IProfileLoaded,
        ];
        await (getUnixActions() as any).getSshProfile();
        expect(showErrorMessage.mock.calls[0][0]).toEqual("SSH profile missing connection details. Please update.");
    });

    it("tests the selectServiceProfile function-1", async () => {
        await expect(
            getUnixActions().selectServiceProfile([
                {
                    name: "test1",
                },
            ] as any)
        ).resolves.toEqual({
            name: "test1",
        });
    });

    it("tests the selectServiceProfile function when user escapes", async () => {
        showQuickPick.mockReturnValueOnce(undefined);
        await expect(
            getUnixActions().selectServiceProfile([
                {
                    name: "test1",
                },
                {
                    name: "test2",
                },
            ] as any)
        ).resolves.toBe(undefined);
        Object.defineProperty(profInstance, "getDefaultProfile", {
            value: jest.fn().mockReturnValueOnce({ profile: { user: "testuser", password: "testpassword" } } as any),
            configurable: true,
        });
        expect(showInformationMessage.mock.calls.length).toBe(0);
    });

    it("getCommand API is not implemented", async () => {
        Object.defineProperty(ZoweExplorerApiRegister, "getInstance", {
            value: jest.fn(() => {
                return {
                    getCommandApi: jest.fn(() => undefined),
                };
            }),
        });
        await getUnixActions().issueUnixCommand(testNode, null as any);
        expect(showErrorMessage.mock.calls[0][0]).toEqual("Issuing commands is not supported for this profile type, zosmf.");
    });

    it("issueUnixCommand API is not yet implemented", async () => {
        Object.defineProperty(ZoweExplorerApiRegister, "getInstance", {
            value: jest.fn(() => {
                return {
                    getCommandApi: jest.fn(() => ({
                        return: {
                            issueUnixCommand: jest.fn(),
                        },
                    })),
                };
            }),
        });
        await getUnixActions().issueUnixCommand(testNode, null as any);
        expect(showErrorMessage.mock.calls[0][0]).toEqual("Issuing UNIX commands is not supported for this profile type, zosmf.");
    });

    it("tests the issueUnixCommand function user does not select a profile - userSelectProfile", async () => {
        Object.defineProperty(ProfileManagement, "getRegisteredProfileNameList", {
            value: jest.fn().mockReturnValue(["firstProfile"]),
            configurable: true,
        });
        Object.defineProperty(profInstance, "getDefaultProfile", {
            value: jest.fn().mockReturnValueOnce({ profile: { user: "testuser", password: "testpassword" } } as any),
            configurable: true,
        });
        showQuickPick.mockReturnValueOnce(undefined);

        await getUnixActions().selectNodeProfile(Definitions.Trees.USS);

        expect(showInformationMessage.mock.calls.length).toBe(0);
    });
});
