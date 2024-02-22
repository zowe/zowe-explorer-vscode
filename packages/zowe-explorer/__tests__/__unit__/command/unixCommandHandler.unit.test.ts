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
import { Gui, Validation } from "@zowe/zowe-explorer-api";
import * as profileLoader from "../../../src/Profiles";
import { UnixCommandHandler } from "../../../src/command/UnixCommandHandler";
import * as utils from "../../../src/utils/ProfilesUtils";
import { imperative } from "@zowe/cli";
import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";
import { ZoweExplorerApiRegister } from "../../../src/ZoweExplorerApiRegister";
import { ZoweLogger } from "../../../src/utils/ZoweLogger";
import { SshSession } from "@zowe/zos-uss-for-zowe-sdk";
import { ZoweLocalStorage } from "../../../src/utils/ZoweLocalStorage";
import { ProfileManagement } from "../../../src/utils/ProfileManagement";

describe("UnixCommand Actions Unit Testing", () => {
    const showErrorMessage = jest.fn();
    const showInputBox = jest.fn();
    const showInformationMessage = jest.fn();
    const showQuickPick = jest.fn();
    const createQuickPick = jest.fn();
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
    const qpItem = new utils.FilterDescriptor("Create a new filter");
    const qpItem2 = new utils.FilterItem({ text: "/d iplinfo0" });

    const mockLoadNamedProfile = jest.fn();
    Object.defineProperty(profileLoader.Profiles, "createInstance", {
        value: jest.fn(() => {
            return {
                allProfiles: [{ name: "firstName" }, { name: "secondName" }],
                defaultProfile: { name: "firstName" },
            };
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
                user: "testuser",
            },
            message: "",
            failNotFound: false,
        } as imperative.IProfileLoaded,
    ];

    let profilefromConfig = {
        isDefaultProfile: false,
        profLoc: { osLoc: ["/user/configpath"] },
    };

    Object.defineProperty(vscode.window, "showErrorMessage", { value: showErrorMessage });
    Object.defineProperty(vscode.window, "showInputBox", { value: showInputBox });
    Object.defineProperty(vscode.window, "showInformationMessage", { value: showInformationMessage });
    Object.defineProperty(vscode.window, "showQuickPick", { value: showQuickPick });
    Object.defineProperty(vscode.window, "createQuickPick", { value: createQuickPick });
    Object.defineProperty(vscode.window, "createOutputChannel", { value: createOutputChannel });
    Object.defineProperty(vscode, "ProgressLocation", { value: ProgressLocation });
    Object.defineProperty(vscode.window, "withProgress", { value: withProgress });
    Object.defineProperty(ProfileManagement, "getRegisteredProfileNameList", {
        value: jest.fn().mockReturnValue(["firstName", "secondName"]),
        configurable: true,
    });

    mockLoadNamedProfile.mockReturnValue({ profile: { name: "aProfile", type: "zosmf" } });
    getConfiguration.mockReturnValue({
        get: (setting: string) => undefined,
        update: jest.fn(() => {
            return {};
        }),
    });

    const mockdefaultProfile = jest.fn();
    mockdefaultProfile.mockReturnValue({ profile: { name: "bprofile", type: "ssh" } });

    SshSession.createSshSessCfgFromArgs = jest.fn(() => {
        return { privateKey: undefined, keyPassphrase: undefined, handshakeTimeout: undefined };
    });

    Object.defineProperty(ZoweLogger, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "trace", { value: jest.fn(), configurable: true });
    Object.defineProperty(imperative.ConnectionPropsForSessCfg, "addPropsOrPrompt", {
        value: jest.fn(() => {
            return { privateKey: undefined, keyPassphrase: undefined, handshakeTimeout: undefined, type: "basic", port: 22 };
        }),
    });

    Object.defineProperty(profileLoader.Profiles, "getInstance", {
        value: jest.fn(() => {
            return {
                allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "pass" } }, { name: "secondName" }],
                defaultProfile: { name: "firstName" },
                zosmfProfile: mockLoadNamedProfile,
                checkCurrentProfile: jest.fn(() => {
                    return profilesForValidation;
                }),
                validateProfiles: jest.fn(),
                getBaseProfile: jest.fn(),
                getDefaultProfile: mockdefaultProfile,
                validProfile: Validation.ValidationType.VALID,
                fetchAllProfilesByType: jest.fn(() => {
                    return fetchSshProfiles;
                }),
                promptCredentials: jest.fn(() => {
                    return ["entered"];
                }),
                getProfileFromConfig: jest.fn(() => {
                    return profilefromConfig;
                }),
                openConfigFile: jest.fn(),
            };
        }),
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    const apiRegisterInstance = ZoweExplorerApiRegister.getInstance();
    const unixActions = UnixCommandHandler.getInstance();
    const profilesForValidation = { status: "active", name: "fake" };

    it("test the issueUnixCommand function", async () => {
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
        expect(appendLine.mock.calls[0][0]).toBe("> testuser@ssh:/u/directorypath$ d iplinfo1");
        expect(appendLine.mock.calls[1][0]["commandResponse"]).toBe("iplinfo1");
        expect(showInformationMessage.mock.calls.length).toBe(0);
    });

    it("tests the issueUnixCommand function user selects a history item", async () => {
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
        expect(appendLine.mock.calls[0][0]).toBe("> testuser@ssh:/u/directorypath$ d iplinfo0");
        expect(appendLine.mock.calls[1][0]["commandResponse"]).toBe("iplinfo0");
        expect(showInformationMessage.mock.calls.length).toBe(0);
    });

    it("tests the issueUnixCommand function - issueUnixCommand throws an error", async () => {
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
        expect(showInformationMessage.mock.calls[0][0]).toEqual("Operation Cancelled");
    });

    it("If nothing is entered in the inputbox of path", async () => {
        showQuickPick.mockReturnValueOnce("firstName");

        showInputBox.mockReturnValueOnce("");
        showInputBox.mockReturnValue("/d iplinfo0");

        await unixActions.issueUnixCommand();

        expect(showInformationMessage.mock.calls[0][0]).toEqual("Redirecting to Home Directory");
    });

    it("User escapes the inputBox of path being entered", async () => {
        showQuickPick.mockReturnValueOnce("firstName");

        showInputBox.mockReturnValueOnce(undefined);

        await unixActions.issueUnixCommand();

        expect(showInformationMessage.mock.calls[0][0]).toEqual("Operation Cancelled");
    });

    it("tests the issueUnixCommand function user escapes the commandbox", async () => {
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
        showQuickPick.mockReturnValueOnce("firstName");

        await unixActions.issueUnixCommand();

        expect(showInformationMessage.mock.calls.length).toBe(1);
    });

    it("tests the issueUnixCommand function user does not select a profile", async () => {
        showQuickPick.mockReturnValueOnce(undefined);

        await unixActions.issueUnixCommand();

        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toEqual("Operation Cancelled");
    });

    it("tests the issueUnixCommand function no profiles error", async () => {
        Object.defineProperty(ProfileManagement, "getRegisteredProfileNameList", {
            value: jest.fn().mockReturnValue([]),
            configurable: true,
        });
        await unixActions.issueUnixCommand();
        expect(showInformationMessage.mock.calls[0][0]).toEqual("No profiles available");
    });

    it("tests the issueUnixCommand function from a session", async () => {
        jest.spyOn(unixActions, "checkCurrentProfile").mockReturnValue(undefined as any);
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
        fetchSshProfiles = [];
        await (unixActions as any).getSshProfile();
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
        await (unixActions as any).getSshProfile();
    });

    it("the shh profile doesnot have port or host or both", async () => {
        fetchSshProfiles = [
            {
                name: "ssh",
                type: "ssh",
                profile: {
                    host: "host.com",
                    user: "testuser",
                },
                message: "",
                failNotFound: false,
            } as imperative.IProfileLoaded,
        ];
        await (unixActions as any).getSshProfile();
        expect(showErrorMessage.mock.calls[0][0]).toEqual("SSH profile missing connection details. Please update.");
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

    it("Not able to issue the command", async () => {
        Object.defineProperty(ZoweExplorerApiRegister, "getInstance", {
            value: jest.fn(() => {
                return {
                    getCommandApi: jest.fn(() => undefined),
                };
            }),
        });
        await unixActions.issueUnixCommand(session, null as any, testNode);
        expect(showErrorMessage.mock.calls[0][0]).toEqual("Issuing Commands is not supported for this profile.");
    });

    it("Not yet implemented for specific profile", async () => {
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
        await unixActions.issueUnixCommand(session, null as any, testNode);
        expect(showErrorMessage.mock.calls[0][0]).toEqual("Not implemented yet for profile of type: zosmf");
    });
});
