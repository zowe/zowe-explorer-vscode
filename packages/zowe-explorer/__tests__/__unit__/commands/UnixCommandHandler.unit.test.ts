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
import { SshSession, Shell } from "@zowe/zos-uss-for-zowe-sdk";
import { createInstanceOfProfile, createIProfile, createValidIProfile } from "../../__mocks__/mockCreators/shared";
import { Gui, imperative, Validation, ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";
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
jest.mock("@zowe/zos-uss-for-zowe-sdk", () => {
    const actual = jest.requireActual("@zowe/zos-uss-for-zowe-sdk");
    return {
        ...actual,
        Shell: {
            isConnectionValid: jest.fn(),
        },
    };
});

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

    let mockCommandApi;
    beforeEach(async () => {
        jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(false);
        mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
        const getCommandApiMock = jest.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        mockCommandApi.sshProfileRequired = jest.fn().mockReturnValueOnce(true);
        apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);
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

    it("issueUnixCommand should validate the nodeProfile if a separate ssh profile is not required", async () => {
        const actions = getUnixActions();
        mockCommandApi.sshProfileRequired = jest.fn().mockReturnValueOnce(false);
        jest.spyOn(actions.profileInstance, "checkCurrentProfile").mockResolvedValue({ status: "invalid", name: "fake" } as any);
        actions.profileInstance.validProfile = Validation.ValidationType.INVALID;

        await actions.issueUnixCommand({ getProfile: () => profileOne } as any);

        expect(actions.profileInstance.checkCurrentProfile).toHaveBeenCalled();
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toEqual("Profile is invalid");
    });

    it("issueUnixCommand should return early if profilestatus is not active", async () => {
        const actions = getUnixActions();
        jest.spyOn(actions.profileInstance, "profileValidationHelper").mockResolvedValue("inactive");

        await actions.issueUnixCommand({ getProfile: () => profileOne } as any);

        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toEqual(
            "Error preparing SSH connection for issuing UNIX commands, please check SSH profile for correctness."
        );
    });

    it("test the issueUnixCommand function", async () => {
        const mockUssApi = await apiRegisterInstance.getUssApi(profileOne);
        const getUssApiMock = jest.fn();
        getUssApiMock.mockReturnValue(mockUssApi);
        apiRegisterInstance.getUssApi = getUssApiMock.bind(apiRegisterInstance);
        jest.spyOn(mockUssApi, "getSession").mockReturnValue(session);

        showQuickPick.mockReturnValueOnce("firstProfile");

        showInputBox.mockReturnValueOnce("/u/directorypath");
        showInputBox.mockReturnValueOnce("/d iplinfo1");

        Object.defineProperty(profInstance, "getDefaultProfile", {
            value: jest.fn().mockReturnValueOnce({ profile: { user: "testuser", password: "testpassword" } } as any),
            configurable: true,
        });

        jest.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(qpItem));
        jest.spyOn(mockCommandApi, "issueUnixCommand").mockReturnValue("iplinfo1" as any);
        jest.spyOn(getUnixActions().profileInstance, "profileValidationHelper").mockResolvedValue("active");

        const actions = getUnixActions();
        const sampleSshSession = { ISshSession: { hostname: "host.com" } };
        const sampleSshProfile = { profile: { host: "host.com" } };
        actions.sshSession = sampleSshSession as any;
        actions.sshProfile = sampleSshProfile as any;

        jest.spyOn(ZoweVsCodeExtension, "updateCredentials").mockReturnValue(Promise.resolve(sampleSshProfile as any));

        await actions.issueUnixCommand();

        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstProfile", "secondProfile"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the profile to use to submit the Unix command",
        });

        expect(showInputBox.mock.calls.length).toBe(2);
        expect(appendLine.mock.calls.length).toBe(2);
        expect(appendLine.mock.calls[0][0]).toBe("> testUser@ssh:/u/directorypath $ /d iplinfo1");
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
        expect(appendLine.mock.calls[0][0]).toBe("> testUser@ssh:/u/directorypath $ /d iplinfo0");
        expect(appendLine.mock.calls[1][0]["commandResponse"]).toBe("iplinfo0");
        expect(showInformationMessage.mock.calls.length).toBe(0);
    });

    it("tests the issueUnixCommand function user escapes the quick pick box", async () => {
        showQuickPick.mockReturnValueOnce("firstProfile");
        showInputBox.mockReturnValueOnce("/u/directorypath");

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
        expect(showInformationMessage.mock.calls.length).toBe(1);
    });

    it("tests the issueUnixCommand function user escapes the input box", async () => {
        showQuickPick.mockReturnValueOnce("firstProfile");
        showInputBox.mockReturnValueOnce("/directorypath");
        showInputBox.mockReturnValueOnce(undefined);

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
        expect(showInformationMessage.mock.calls.length).toBe(1);
    });

    it("tests the issueUnixCommand function - issueUnixCommand throws an error", async () => {
        showQuickPick.mockReturnValueOnce("firstProfile");
        showInputBox.mockReturnValueOnce("/u/directorypath");
        showInputBox.mockReturnValueOnce("/d iplinfo3");
        withProgress.mockRejectedValueOnce(Error("fake testError"));

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

    it("If nothing is entered in the input box of path", async () => {
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

    it("the ssh profile does not have user and password", async () => {
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

    it("the ssh profile does not have port or host or both", async () => {
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

    it("tests the selectServiceProfile function", async () => {
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

    it("uses the SSH profile name if one was selected", () => {
        UnixCommandHandler.getInstance().sshProfile = {
            name: "dev.ssh",
            type: "ssh",
            failNotFound: false,
            message: "",
            profile: { user: "testuser" },
        };
        expect(UnixCommandHandler.getInstance().formatCommandLine("ls -l")).toEqual("> testuser@dev.ssh:~ $ ls -l");
    });

    it("uses the node's profile name if an SSH profile was not selected", () => {
        UnixCommandHandler.getInstance().sshProfile = undefined as any;
        (UnixCommandHandler.getInstance() as any).nodeProfile = createIProfile();
        expect(UnixCommandHandler.getInstance().formatCommandLine("ls -l")).toEqual("> testuser@sestest:~ $ ls -l");
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

    describe("validateSshConnection (private method)", () => {
        it("should return 'inactive' when Shell.isConnectionValid returns false", async () => {
            const actions = getUnixActions();
            const sampleSshSession = { ISshSession: { hostname: "host.com", privateKey: "someKey" } };
            const sampleSshProfile = { profile: { host: "host.com" }, type: "ssh" };

            actions.sshSession = sampleSshSession as any;
            actions.sshProfile = sampleSshProfile as any;

            (Shell.isConnectionValid as jest.Mock).mockResolvedValue(false);

            const result = await (actions as any).validateSshConnection(sampleSshProfile, "ssh");

            expect(result).toBe("inactive");
            expect(Shell.isConnectionValid).toHaveBeenCalledWith(sampleSshSession);
        });

        it("should return 'active' when Shell.isConnectionValid returns true", async () => {
            const actions = getUnixActions();
            const sampleSshSession = { ISshSession: { hostname: "host.com", privateKey: "someKey" } };
            const sampleSshProfile = { profile: { host: "host.com" }, type: "ssh" };

            actions.sshSession = sampleSshSession as any;
            actions.sshProfile = sampleSshProfile as any;

            (Shell.isConnectionValid as jest.Mock).mockResolvedValue(true);

            const result = await (actions as any).validateSshConnection(sampleSshProfile, "ssh");

            expect(result).toBe("active");
            expect(Shell.isConnectionValid).toHaveBeenCalledWith(sampleSshSession);
        });

        it("should return 'unverified' when profile type is not ssh", async () => {
            const actions = getUnixActions();
            const sampleSshSession = { ISshSession: { hostname: "host.com" } };
            const sampleProfile = { profile: { host: "host.com" }, type: "zosmf" };

            actions.sshSession = sampleSshSession as any;
            actions.sshProfile = sampleProfile as any;

            const result = await (actions as any).validateSshConnection(sampleProfile, "zosmf");

            expect(result).toBe("unverified");
        });

        it("should return 'unverified' when profile host does not match session hostname", async () => {
            const actions = getUnixActions();
            const sampleSshSession = { ISshSession: { hostname: "host.com" } };
            const sampleSshProfile = { profile: { host: "different-host.com" }, type: "ssh" };

            actions.sshSession = sampleSshSession as any;
            actions.sshProfile = sampleSshProfile as any;

            const result = await (actions as any).validateSshConnection(sampleSshProfile, "ssh");

            expect(result).toBe("unverified");
        });

        it("should update credentials and return 'active' when privateKey is null and credentials are updated successfully", async () => {
            const actions = getUnixActions();
            const sampleSshSession = { ISshSession: { hostname: "host.com", privateKey: null } };
            const sampleSshProfile = { profile: { host: "host.com", user: "oldUser" }, type: "ssh" };
            const updatedProfile = { profile: { host: "host.com", user: "newUser", password: "newPassword" } };

            actions.sshSession = sampleSshSession as any;
            actions.sshProfile = sampleSshProfile as any;

            jest.spyOn(ZoweVsCodeExtension, "updateCredentials").mockResolvedValue(updatedProfile as any);
            (Shell.isConnectionValid as jest.Mock).mockResolvedValue(true);

            const result = await (actions as any).validateSshConnection(sampleSshProfile, "ssh");

            expect(result).toBe("active");
            expect(ZoweVsCodeExtension.updateCredentials).toHaveBeenCalled();
            expect(sampleSshSession.ISshSession.password).toBe("newPassword");
            expect(sampleSshSession.ISshSession.user).toBe("newUser");
        });

        it("should return 'unverified' when privateKey is null and updateCredentials returns undefined", async () => {
            const actions = getUnixActions();
            const sampleSshSession = { ISshSession: { hostname: "host.com", privateKey: null } };
            const sampleSshProfile = { profile: { host: "host.com" }, type: "ssh" };

            actions.sshSession = sampleSshSession as any;
            actions.sshProfile = sampleSshProfile as any;

            jest.spyOn(ZoweVsCodeExtension, "updateCredentials").mockResolvedValue(undefined);

            const result = await (actions as any).validateSshConnection(sampleSshProfile, "ssh");

            expect(result).toBe("unverified");
            expect(ZoweVsCodeExtension.updateCredentials).toHaveBeenCalled();
        });
        it("should return 'active' when user is not set in session and is set in profile", async () => {
            // This workaround can be removed once the following CLI issue is resolved:
            // https://github.com/zowe/zowe-cli/issues/2646
            const actions = getUnixActions();
            const sampleSshSession: any = {
                ISshSession: { hostname: "host.com", privateKey: "someKey", tokenType: "someTokenType", tokenValue: "someTokenValue" },
            };
            const sampleSshProfile = { profile: { host: "host.com", user: "newUser" }, type: "ssh" };

            actions.sshSession = sampleSshSession as any;
            actions.sshProfile = sampleSshProfile as any;

            (Shell.isConnectionValid as jest.Mock).mockResolvedValue(true);

            const result = await (actions as any).validateSshConnection(sampleSshProfile, "ssh");

            expect(result).toBe("active");
            expect(sampleSshSession.ISshSession.user).toBe("newUser");
            expect(Shell.isConnectionValid).toHaveBeenCalledWith(sampleSshSession);
        });
    });
});
