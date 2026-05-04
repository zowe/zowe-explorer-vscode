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
import { Gui, imperative, Validation } from "@zowe/zowe-explorer-api";
import { ZoweDatasetNode } from "../../../src/trees/dataset/ZoweDatasetNode";
import { ZoweExplorerApiRegister } from "../../../src/extending/ZoweExplorerApiRegister";
import { ZoweLocalStorage } from "../../../src/tools/ZoweLocalStorage";
import { ProfileManagement } from "../../../src/management/ProfileManagement";
import { FilterDescriptor, FilterItem } from "../../../src/management/FilterManagement";
import { ZoweLogger } from "../../../src/tools/ZoweLogger";
import { MvsCommandHandler } from "../../../src/commands/MvsCommandHandler";
import { SettingsConfig } from "../../../src/configuration/SettingsConfig";

vi.mock("Session");

describe("mvsCommandActions unit testing", () => {
    const showErrorMessage = vi.fn();
    const showInputBox = vi.fn();
    const showInformationMessage = vi.fn();
    const showQuickPick = vi.fn();
    const createQuickPick = vi.fn();
    const createTerminal = vi.fn();
    const getConfiguration = vi.fn();
    const createOutputChannel = vi.fn();

    const appendLine = vi.fn();
    const outputChannel: vscode.OutputChannel = {
        append: vi.fn(),
        name: "fakeChannel",
        appendLine,
        clear: vi.fn(),
        show: vi.fn(),
        hide: vi.fn(),
        dispose: vi.fn(),
        replace: vi.fn(),
    };
    createOutputChannel.mockReturnValue(outputChannel);
    const qpItem: vscode.QuickPickItem = new FilterDescriptor("\uFF0B " + "Create a new filter");
    const qpItem2 = new FilterItem({ text: "/d iplinfo0" });

    const mockLoadNamedProfile = vi.fn();
    Object.defineProperty(profileLoader.Profiles, "createInstance", {
        value: vi.fn(() => {
            return {
                allProfiles: [{ name: "firstName" }, { name: "secondName" }],
                defaultProfile: { name: "firstName" },
            };
        }),
    });
    Object.defineProperty(ZoweLocalStorage, "globalState", {
        value: {
            get: () => ({ persistence: true, favorites: [], history: [], sessions: ["zosmf"], searchHistory: [], fileHistory: [] }),
            update: vi.fn(),
            keys: () => [],
        },
        configurable: true,
    });
    Object.defineProperty(ZoweLogger, "trace", { value: vi.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "error", { value: vi.fn(), configurable: true });
    Object.defineProperty(ProfileManagement, "getRegisteredProfileNameList", {
        value: vi.fn().mockReturnValue(["firstName", "secondName"]),
        configurable: true,
    });

    createQuickPick.mockReturnValue({
        placeholder: 'Choose "Create new..." to define a new profile or select an existing profile to add to the Data Set Explorer',
        activeItems: [qpItem2],
        ignoreFocusOut: true,
        items: [qpItem, qpItem2],
        value: undefined,
        show: vi.fn(() => {
            return {};
        }),
        hide: vi.fn(() => {
            return {};
        }),
        onDidAccept: vi.fn(() => {
            return {};
        }),
    });

    const ProgressLocation = vi.fn().mockImplementation(() => {
        return {
            Notification: 15,
        };
    });

    const withProgress = vi.fn().mockImplementation((progLocation, callback) => {
        return callback();
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

    Object.defineProperty(vscode.window, "showErrorMessage", { value: showErrorMessage });
    Object.defineProperty(vscode.window, "showInputBox", { value: showInputBox });
    Object.defineProperty(vscode.window, "showInformationMessage", { value: showInformationMessage });
    Object.defineProperty(vscode.window, "showQuickPick", { value: showQuickPick });
    Object.defineProperty(vscode.window, "createQuickPick", { value: createQuickPick });
    Object.defineProperty(vscode.window, "createTerminal", { value: createTerminal });
    Object.defineProperty(vscode.window, "createOutputChannel", { value: createOutputChannel });
    Object.defineProperty(vscode, "ProgressLocation", { value: ProgressLocation });
    Object.defineProperty(vscode.window, "withProgress", { value: withProgress });

    mockLoadNamedProfile.mockReturnValue({ profile: { name: "aProfile", type: "zosmf" } });
    getConfiguration.mockReturnValue({
        get: () => undefined,
        update: vi.fn(() => {
            return {};
        }),
    });

    beforeEach(() => {
        vi.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(false);
    });

    afterEach(() => {
        (MvsCommandHandler as any).instance = undefined;
        vi.clearAllMocks();
    });

    const apiRegisterInstance = ZoweExplorerApiRegister.getInstance();
    const profilesForValidation = { status: "active", name: "fake" };
    const getMvsActions = () => {
        return MvsCommandHandler.getInstance();
    };

    it("tests the issueMvsCommand function", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: vi.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
                    defaultProfile: { name: "firstName" },
                    zosmfProfile: mockLoadNamedProfile,
                    checkCurrentProfile: vi.fn(() => {
                        return profilesForValidation;
                    }),
                    validateProfiles: vi.fn(),
                    getBaseProfile: vi.fn(),
                    validProfile: Validation.ValidationType.VALID,
                };
            }),
        });
        const mockMvsApi = await apiRegisterInstance.getMvsApi(profileOne);
        const getMvsApiMock = vi.fn();
        getMvsApiMock.mockReturnValue(mockMvsApi);
        apiRegisterInstance.getMvsApi = getMvsApiMock.bind(apiRegisterInstance);
        vi.spyOn(mockMvsApi, "getSession").mockReturnValue(session);

        showQuickPick.mockReturnValueOnce("firstName");

        const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
        const getCommandApiMock = vi.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

        showInputBox.mockReturnValueOnce("/d iplinfo1");
        vi.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(qpItem));
        vi.spyOn(mockCommandApi, "issueMvsCommand").mockReturnValue({ commandResponse: "iplinfo1" } as any);

        await getMvsActions().issueMvsCommand();

        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the profile to use to submit the MVS command",
        });
        expect(showInputBox.mock.calls.length).toBe(1);
        expect(appendLine.mock.calls.length).toBe(2);
        expect(appendLine.mock.calls[0][0]).toBe("> d iplinfo1");
        expect(appendLine.mock.calls[1][0]).toBe("iplinfo1");
        expect(showInformationMessage.mock.calls.length).toBe(0);
    });

    it("tests the issueMvsCommand function user selects a history item", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: vi.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
                    defaultProfile: { name: "firstName" },
                    zosmfProfile: mockLoadNamedProfile,
                    checkCurrentProfile: vi.fn(() => {
                        return profilesForValidation;
                    }),
                    validateProfiles: vi.fn(),
                    getBaseProfile: vi.fn(),
                    validProfile: Validation.ValidationType.VALID,
                };
            }),
        });

        showQuickPick.mockReturnValueOnce("firstName");

        const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
        const getCommandApiMock = vi.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

        vi.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(qpItem2));
        vi.spyOn(mockCommandApi, "issueMvsCommand").mockReturnValue({ commandResponse: "iplinfo0" } as any);

        const actions = getMvsActions();
        (actions.history as any).mSearchHistory = [qpItem2.label];

        await actions.issueMvsCommand();

        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the profile to use to submit the MVS command",
        });
        expect(showInputBox.mock.calls.length).toBe(0);
        expect(appendLine.mock.calls.length).toBe(2);
        expect(appendLine.mock.calls[0][0]).toBe("> d iplinfo0");
        expect(appendLine.mock.calls[1][0]).toBe("iplinfo0");
        expect(showInformationMessage.mock.calls.length).toBe(0);
    });

    it("tests the issueMvsCommand function - issueSimple throws an error", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: vi.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
                    defaultProfile: { name: "firstName" },
                    zosmfProfile: mockLoadNamedProfile,
                    checkCurrentProfile: vi.fn(() => {
                        return profilesForValidation;
                    }),
                    validateProfiles: vi.fn(),
                    getBaseProfile: vi.fn(),
                    validProfile: Validation.ValidationType.VALID,
                };
            }),
        });

        showQuickPick.mockReturnValueOnce("firstName");
        showInputBox.mockReturnValueOnce("/d iplinfo3");
        withProgress.mockRejectedValueOnce(Error("fake testError"));

        const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
        const getCommandApiMock = vi.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);
        vi.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(qpItem));
        vi.spyOn(mockCommandApi, "issueMvsCommand").mockReturnValue({ commandResponse: "iplinfo3" } as any);

        await getMvsActions().issueMvsCommand();

        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the profile to use to submit the MVS command",
        });
        expect(showInputBox.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toEqual("fake testError");
    });

    it("tests the issueMvsCommand function user escapes the quick pick box", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: vi.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
                    defaultProfile: { name: "firstName" },
                    zosmfProfile: mockLoadNamedProfile,
                    checkCurrentProfile: vi.fn(() => {
                        return profilesForValidation;
                    }),
                    validateProfiles: vi.fn(),
                    getBaseProfile: vi.fn(),
                    validProfile: Validation.ValidationType.VALID,
                };
            }),
        });

        showQuickPick.mockReturnValueOnce("firstName");

        const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
        const getCommandApiMock = vi.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

        vi.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(undefined));

        const actions = getMvsActions();
        (actions.history as any).mSearchHistory = [qpItem2.label];

        await actions.issueMvsCommand();

        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showInputBox.mock.calls.length).toBe(0);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the profile to use to submit the MVS command",
        });
        expect(showInformationMessage.mock.calls.length).toBe(1);
    });

    it("tests the issueMvsCommand function user escapes the MVS command box", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: vi.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
                    defaultProfile: { name: "firstName" },
                    zosmfProfile: mockLoadNamedProfile,
                    checkCurrentProfile: vi.fn(() => {
                        return profilesForValidation;
                    }),
                    validateProfiles: vi.fn(),
                    getBaseProfile: vi.fn(),
                    validProfile: Validation.ValidationType.VALID,
                };
            }),
        });
        showQuickPick.mockReturnValueOnce("firstName");
        showInputBox.mockReturnValueOnce(undefined);

        const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
        const getCommandApiMock = vi.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

        vi.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(qpItem));

        await getMvsActions().issueMvsCommand();

        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the profile to use to submit the MVS command",
        });
        expect(showInputBox.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls.length).toBe(1);
    });

    it("tests the issueMvsCommand function user starts typing a value in quick pick", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: vi.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
                    defaultProfile: { name: "firstName" },
                    zosmfProfile: mockLoadNamedProfile,
                    checkCurrentProfile: vi.fn(() => {
                        return profilesForValidation;
                    }),
                    validateProfiles: vi.fn(),
                    getBaseProfile: vi.fn(),
                    validProfile: Validation.ValidationType.VALID,
                };
            }),
        });
        createQuickPick.mockReturnValueOnce({
            placeholder: 'Choose "Create new..." to define a new profile or select an existing profile to add to the Data Set Explorer',
            activeItems: [qpItem2],
            ignoreFocusOut: true,
            items: [qpItem, qpItem2],
            value: "/d m=cpu",
            show: vi.fn(() => {
                return {};
            }),
            hide: vi.fn(() => {
                return {};
            }),
            onDidAccept: vi.fn(() => {
                return {};
            }),
        });

        showQuickPick.mockReturnValueOnce("firstName");
        showInputBox.mockReturnValueOnce(undefined);

        const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
        const getCommandApiMock = vi.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

        vi.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(qpItem));

        const actions = getMvsActions();
        (actions.history as any).mSearchHistory = [qpItem2.label];

        await actions.issueMvsCommand();

        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the profile to use to submit the MVS command",
        });
        expect(showInputBox.mock.calls.length).toBe(0);
    });

    it("tests the issueMvsCommand prompt credentials", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: vi.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: undefined, password: undefined } }, { name: "secondName" }],
                    defaultProfile: { name: "firstName" },
                    validProfile: Validation.ValidationType.VALID,
                    promptCredentials: vi.fn(() => {
                        return ["fake", "fake", "fake"];
                    }),
                    checkCurrentProfile: vi.fn(() => {
                        return profilesForValidation;
                    }),
                    validateProfiles: vi.fn(),
                    getBaseProfile: vi.fn(),
                };
            }),
        });

        showQuickPick.mockReturnValueOnce("firstName");
        showInputBox.mockReturnValueOnce("fake");
        showInputBox.mockReturnValueOnce("fake");
        showInputBox.mockReturnValueOnce("/d iplinfo");

        const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
        const getCommandApiMock = vi.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

        vi.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(qpItem));
        vi.spyOn(mockCommandApi, "issueMvsCommand").mockReturnValueOnce({ commandResponse: "fake response" } as any);

        await getMvsActions().issueMvsCommand();

        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the profile to use to submit the MVS command",
        });
        expect(showInputBox.mock.calls.length).toBe(1);
    });

    it("tests the issueMvsCommand prompt credentials for password only", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: vi.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: undefined, password: undefined } }, { name: "secondName" }],
                    defaultProfile: { name: "firstName" },
                    validProfile: Validation.ValidationType.VALID,
                    promptCredentials: vi.fn(() => {
                        return ["fake", "fake", "fake"];
                    }),
                    checkCurrentProfile: vi.fn(() => {
                        return profilesForValidation;
                    }),
                    validateProfiles: vi.fn(),
                    getBaseProfile: vi.fn(),
                };
            }),
        });

        showQuickPick.mockReturnValueOnce("firstName");
        showInputBox.mockReturnValueOnce("fake");
        showInputBox.mockReturnValueOnce("/d iplinfo5");

        const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
        const getCommandApiMock = vi.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);
        vi.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(qpItem));
        vi.spyOn(mockCommandApi, "issueMvsCommand").mockReturnValueOnce({ commandResponse: "fake response" } as any);

        await getMvsActions().issueMvsCommand();

        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the profile to use to submit the MVS command",
        });
        expect(showInputBox.mock.calls.length).toBe(1);
    });

    it("tests the issueMvsCommand error in prompt credentials", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: vi.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: undefined, password: undefined } }, { name: "secondName" }],
                    defaultProfile: { name: "firstName" },
                    validateProfiles: vi.fn(),
                    getBaseProfile: vi.fn(),
                    checkCurrentProfile: vi.fn(() => {
                        return Validation.ValidationType.INVALID;
                    }),
                    validProfile: Validation.ValidationType.INVALID,
                };
            }),
        });

        showQuickPick.mockReturnValueOnce("firstName");
        showInputBox.mockReturnValueOnce("fake");

        await getMvsActions().issueMvsCommand();

        expect(showErrorMessage.mock.calls.length).toBe(1);
    });

    it("tests the issueMvsCommand function user does not select a profile", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: vi.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
                    defaultProfile: { name: "firstName" },
                    validProfile: Validation.ValidationType.VALID,
                    getBaseProfile: vi.fn(),
                    checkCurrentProfile: vi.fn(),
                    zosmfProfile: mockLoadNamedProfile,
                };
            }),
        });

        showQuickPick.mockReturnValueOnce(undefined);

        await getMvsActions().issueMvsCommand();

        expect(showInformationMessage.mock.calls.length).toBe(0);
    });

    it("tests the issueMvsCommand function from a session", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: vi.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
                    defaultProfile: { name: "firstName" },
                    validProfile: Validation.ValidationType.VALID,
                    getBaseProfile: vi.fn(),
                    checkCurrentProfile: vi.fn(),
                    zosmfProfile: mockLoadNamedProfile,
                };
            }),
        });

        vi.spyOn(getMvsActions(), "checkCurrentProfile").mockReturnValue(undefined as any);

        const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
        const getCommandApiMock = vi.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

        showInputBox.mockReturnValueOnce("/d iplinfo1");
        vi.spyOn(mockCommandApi, "issueMvsCommand").mockReturnValueOnce({ commandResponse: "fake response" } as any);

        await getMvsActions().issueMvsCommand(session, null as any, testNode);

        expect(showInputBox.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls.length).toBe(0);
    });

    it("tests the issueMvsCommand handles error thrown by API register", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: vi.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
                    defaultProfile: { name: "firstName" },
                    zosmfProfile: mockLoadNamedProfile,
                    checkCurrentProfile: vi.fn(() => {
                        return profilesForValidation;
                    }),
                    validateProfiles: vi.fn(),
                    getBaseProfile: vi.fn(),
                    validProfile: Validation.ValidationType.VALID,
                };
            }),
        });
        const mockMvsApi = apiRegisterInstance.getMvsApi(profileOne);
        const getMvsApiMock = vi.fn();
        getMvsApiMock.mockReturnValue(mockMvsApi);
        apiRegisterInstance.getMvsApi = getMvsApiMock.bind(apiRegisterInstance);
        vi.spyOn(mockMvsApi, "getSession").mockReturnValue(session);

        showQuickPick.mockReturnValueOnce("firstName");
        const testError = new Error("getCommandApi failed");
        apiRegisterInstance.getCommandApi = vi.fn().mockImplementation(() => {
            throw testError;
        });

        await getMvsActions().issueMvsCommand();

        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the profile to use to submit the MVS command",
        });
        expect(showInputBox.mock.calls.length).toBe(0);
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toContain(testError.message);
    });

    it("tests the issueMvsCommand function no profiles error", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: vi.fn(() => {
                return {
                    allProfiles: [],
                    defaultProfile: undefined,
                    checkCurrentProfile: vi.fn(() => {
                        return profilesForValidation;
                    }),
                    validateProfiles: vi.fn(),
                    getBaseProfile: vi.fn(),
                    validProfile: Validation.ValidationType.VALID,
                };
            }),
        });
        Object.defineProperty(ProfileManagement, "getRegisteredProfileNameList", {
            value: vi.fn().mockReturnValue([]),
            configurable: true,
        });
        await getMvsActions().issueMvsCommand();
        expect(showInformationMessage.mock.calls[0][0]).toEqual("No profiles available");
    });
});
