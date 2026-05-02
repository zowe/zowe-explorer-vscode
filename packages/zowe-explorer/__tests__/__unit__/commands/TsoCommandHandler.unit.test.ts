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
import { vi } from "vitest";

import * as vscode from "vscode";
import * as profileLoader from "../../../src/configuration/Profiles";
import { Gui, imperative, Validation } from "@zowe/zowe-explorer-api";
import { ZoweExplorerApiRegister } from "../../../src/extending/ZoweExplorerApiRegister";
import { FilterDescriptor, FilterItem } from "../../../src/management/FilterManagement";
import { ProfileManagement } from "../../../src/management/ProfileManagement";
import { ZoweLocalStorage } from "../../../src/tools/ZoweLocalStorage";
import { ZoweDatasetNode } from "../../../src/trees/dataset/ZoweDatasetNode";
import { TsoCommandHandler } from "../../../src/commands/TsoCommandHandler";
import { SettingsConfig } from "../../../src/configuration/SettingsConfig";

vi.mock("Session");

describe("TsoCommandHandler unit testing", () => {
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
    Object.defineProperty(ProfileManagement, "getRegisteredProfileNameList", {
        value: vi.fn().mockReturnValue(["firstName", "secondName"]),
        configurable: true,
    });

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
        (TsoCommandHandler as any).instance = undefined;
        vi.clearAllMocks();
    });

    const apiRegisterInstance = ZoweExplorerApiRegister.getInstance();
    const profilesForValidation = { status: "active", name: "fake" };

    const getTsoActions = () => {
        const tsoActions = TsoCommandHandler.getInstance();
        Object.defineProperty(tsoActions, "getTsoParams", {
            value: vi.fn(() => {
                return "acctNum";
            }),
            configurable: true,
        });
        return tsoActions;
    };

    it("tests the issueTsoCommand function", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: vi.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
                    getDefaultProfile: vi.fn(() => ({
                        name: "firstName",
                        profile: {
                            user: "firstName",
                            password: "12345",
                            account: "FAKE.ACCOUNT",
                            logonProcedure: "BADPROC",
                        },
                        type: "tso",
                    })),
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
        vi.spyOn(mockCommandApi, "issueTsoCommandWithParms").mockReturnValue({ commandResponse: "iplinfo1" } as any);

        await getTsoActions().issueTsoCommand();

        expect(showInputBox.mock.calls.length).toBe(1);
        expect(appendLine.mock.calls.length).toBe(2);
        expect(appendLine.mock.calls[0][0]).toBe("> d iplinfo1");
        expect(appendLine.mock.calls[1][0]).toBe("iplinfo1");
        expect(showInformationMessage.mock.calls.length).toBe(0);
    });

    it("tests the issueTsoCommand function user selects a history item", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: vi.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
                    getDefaultProfile: vi.fn(() => ({
                        name: "firstName",
                        profile: {
                            user: "firstName",
                            password: "12345",
                            account: "FAKE.ACCOUNT",
                            logonProcedure: "BADPROC",
                        },
                        type: "tso",
                    })),
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
        vi.spyOn(mockCommandApi, "issueTsoCommandWithParms").mockReturnValue({ commandResponse: "iplinfo0" } as any);

        const actions = getTsoActions();
        (actions.history as any).mSearchHistory = [qpItem2.label];

        await actions.issueTsoCommand();

        expect(showInputBox.mock.calls.length).toBe(0);
        expect(appendLine.mock.calls.length).toBe(2);
        expect(appendLine.mock.calls[0][0]).toBe("> d iplinfo0");
        expect(appendLine.mock.calls[1][0]).toBe("iplinfo0");
        expect(showInformationMessage.mock.calls.length).toBe(0);
    });

    it("tests the issueTsoCommand function - issueTsoCommand throws an error", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: vi.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
                    getDefaultProfile: vi.fn(() => ({
                        name: "firstName",
                        profile: {
                            user: "firstName",
                            password: "12345",
                            account: "FAKE.ACCOUNT",
                            logonProcedure: "BADPROC",
                        },
                        type: "tso",
                    })),
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
        vi.spyOn(mockCommandApi, "issueTsoCommandWithParms").mockReturnValue({ commandResponse: "iplinfo3" } as any);

        await getTsoActions().issueTsoCommand();

        expect(showInputBox.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toEqual("fake testError");
    });

    it("tests the issueTsoCommand function user escapes the quick pick box", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: vi.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
                    getDefaultProfile: vi.fn(() => ({
                        name: "firstName",
                        profile: {
                            user: "firstName",
                            password: "12345",
                            account: "FAKE.ACCOUNT",
                            logonProcedure: "BADPROC",
                        },
                        type: "tso",
                    })),
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

        const actions = getTsoActions();
        (actions.history as any).mSearchHistory = [qpItem2.label];

        await actions.issueTsoCommand();

        expect(showInputBox.mock.calls.length).toBe(0);
    });

    it("tests the issueTsoCommand function user escapes the command box", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: vi.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
                    getDefaultProfile: vi.fn(() => ({
                        name: "firstName",
                        profile: {
                            user: "firstName",
                            password: "12345",
                            account: "FAKE.ACCOUNT",
                            logonProcedure: "BADPROC",
                        },
                        type: "tso",
                    })),
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

        await getTsoActions().issueTsoCommand();

        expect(showInputBox.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls.length).toBe(1);
    });

    it("tests the issueTsoCommand function user starts typing a value in quick pick", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: vi.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
                    getDefaultProfile: vi.fn(() => ({
                        name: "firstName",
                        profile: {
                            user: "firstName",
                            password: "12345",
                            account: "FAKE.ACCOUNT",
                            logonProcedure: "BADPROC",
                        },
                        type: "tso",
                    })),
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

        const actions = getTsoActions();
        (actions.history as any).mSearchHistory = [qpItem2.label];

        await actions.issueTsoCommand();

        expect(showInputBox.mock.calls.length).toBe(0);
    });

    it("tests the issueTsoCommand prompt credentials", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: vi.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: undefined, password: undefined } }, { name: "secondName" }],
                    getDefaultProfile: vi.fn(() => ({
                        name: "firstName",
                        profile: {
                            user: "firstName",
                            password: "12345",
                            account: "FAKE.ACCOUNT",
                            logonProcedure: "BADPROC",
                        },
                        type: "tso",
                    })),
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
        vi.spyOn(mockCommandApi, "issueTsoCommandWithParms").mockReturnValue({ commandResponse: "iplinfo" } as any);

        await getTsoActions().issueTsoCommand();

        expect(showInputBox.mock.calls.length).toBe(1);
    });

    it("tests the issueTsoiCommand prompt credentials for password only", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: vi.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: undefined, password: undefined } }, { name: "secondName" }],
                    getDefaultProfile: vi.fn(() => ({
                        name: "firstName",
                        profile: {
                            user: "firstName",
                            password: "12345",
                            account: "FAKE.ACCOUNT",
                            logonProcedure: "BADPROC",
                        },
                        type: "tso",
                    })),
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
        vi.spyOn(mockCommandApi, "issueTsoCommandWithParms").mockReturnValue({ commandResponse: "iplinfo5" } as any);

        await getTsoActions().issueTsoCommand();

        expect(showInputBox.mock.calls.length).toBe(1);
    });

    it("tests the issueTsoCommand error in prompt credentials", async () => {
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

        await getTsoActions().issueTsoCommand();

        expect(showErrorMessage.mock.calls.length).toBe(1);
    });

    it("tests the issueTsoCommand function user does not select a profile", async () => {
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

        await getTsoActions().issueTsoCommand();

        expect(showInformationMessage.mock.calls.length).toBe(0);
    });

    it("tests the issueTsoCommand function from a session", async () => {
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

        vi.spyOn(getTsoActions(), "checkCurrentProfile").mockReturnValue(undefined as any);

        const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
        const getCommandApiMock = vi.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

        showInputBox.mockReturnValueOnce("/d iplinfo1");
        vi.spyOn(mockCommandApi, "issueTsoCommandWithParms").mockReturnValue({ commandResponse: "iplinfo1" } as any);

        await getTsoActions().issueTsoCommand(session, null as any, testNode);

        expect(showInputBox.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls.length).toBe(0);
    });

    it("tests the issueTsoCommand handles error thrown by API register", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: vi.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: "firstName", password: "12345" } }, { name: "secondName" }],
                    getDefaultProfile: vi.fn(() => ({
                        name: "firstName",
                        profile: {
                            user: "firstName",
                            password: "12345",
                            account: "FAKE.ACCOUNT",
                            logonProcedure: "BADPROC",
                        },
                        type: "tso",
                    })),
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

        await getTsoActions().issueTsoCommand();

        expect(showInputBox.mock.calls.length).toBe(0);
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toContain(testError.message);
    });

    it("tests the issueTsoCommand function no profiles error", async () => {
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
        await getTsoActions().issueTsoCommand();
        expect(showInformationMessage.mock.calls[0][0]).toEqual("No profiles available");
    });

    it("getTsoParams: uses default tso profile if setting is true", async () => {
        const defaultProfileAttrs = {
            account: "DEFACC",
            properties: {},
            type: "tso",
        };

        const mergedArgs = {
            knownArgs: [{ argName: "account", argValue: "DEFACC" }],
        };

        vi.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(true);

        vi.spyOn(imperative.ProfileInfo, "profAttrsToProfLoaded").mockReturnValue({
            profile: { account: undefined },
            name: "defaultTso",
            type: "tso",
            message: "",
            failNotFound: false,
        });

        const handler = TsoCommandHandler.getInstance();
        // const mockedProperty;
        const mockProfileInfo = {
            getDefaultProfile: vi.fn().mockReturnValue(defaultProfileAttrs),
            getAllProfiles: vi.fn(),
            mergeArgsForProfile: vi.fn().mockReturnValue(mergedArgs),
        };
        const mockProfileInstance = {
            getProfileInfo: vi.fn().mockResolvedValue(mockProfileInfo),
        };
        (handler as any).profileInstance = mockProfileInstance;

        const result = await (handler as any).getTsoParams();

        expect(result.account).toEqual("DEFACC");
    });

    it("getTsoParams: does not use default tso profile if not present", async () => {
        const getTsoActions = () => {
            const tsoActions = TsoCommandHandler.getInstance();
            return tsoActions;
        };
        const allProfiles = [
            {
                name: "firstName",
                profile: {
                    user: "firstName",
                    password: "12345",
                    account: "FAKE.ACCOUNT",
                    logonProcedure: "BADPROC",
                },
                type: "tso",
            },
        ];
        const mergedArgs = {
            knownArgs: [
                { argName: "account", argValue: "ACCVAL" },
                { argName: "characterSet", argValue: "CSVAL" },
                { argName: "codePage", argValue: "CPVAL" },
                { argName: "columns", argValue: "80" },
                { argName: "logonProcedure", argValue: "LOGPROC" },
                { argName: "regionSize", argValue: "4096" },
                { argName: "rows", argValue: "24" },
            ],
        };
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: vi.fn(() => {
                return {
                    allProfiles: allProfiles,
                    defaultProfile: undefined,
                };
            }),
        });
        const handler = getTsoActions();

        const mockProfileInfo = {
            getDefaultProfile: vi.fn().mockReturnValue(undefined),
            getAllProfiles: vi.fn().mockReturnValue(allProfiles),
            mergeArgsForProfile: vi.fn().mockReturnValue(mergedArgs),
        };
        const mockProfileInstance = {
            getProfileInfo: vi.fn().mockResolvedValue(mockProfileInfo),
        };
        (handler as any).profileInstance = mockProfileInstance;

        const result = await (handler as any).getTsoParams();

        expect(result.account).toEqual("ACCVAL");
    });

    it("getTsoParams: maps merged args to tsoProfile.profile fields", async () => {
        const handler = TsoCommandHandler.getInstance();

        const tsoProfile = {
            name: "testTso",
            profile: {
                account: undefined,
                characterSet: undefined,
                codePage: undefined,
                columns: undefined,
                logonProcedure: undefined,
                regionSize: undefined,
                rows: undefined,
            },
            type: "tso",
            message: "",
            failNotFound: false,
        };
        const mergedArgs = {
            knownArgs: [
                { argName: "account", argValue: "ACCVAL" },
                { argName: "characterSet", argValue: "CSVAL" },
                { argName: "codePage", argValue: "CPVAL" },
                { argName: "columns", argValue: "80" },
                { argName: "logonProcedure", argValue: "LOGPROC" },
                { argName: "regionSize", argValue: "4096" },
                { argName: "rows", argValue: "24" },
            ],
        };

        const mockProfileInfo = {
            getDefaultProfile: vi.fn().mockReturnValue(undefined),
            getAllProfiles: vi.fn().mockReturnValue([tsoProfile]),
            mergeArgsForProfile: vi.fn().mockReturnValue(mergedArgs),
        };

        const mockProfileInstance = {
            getProfileInfo: vi.fn().mockResolvedValue(mockProfileInfo),
        };

        (handler as any).profileInstance = mockProfileInstance;

        vi.spyOn(handler, "selectServiceProfile").mockResolvedValue(tsoProfile);

        const result = await (handler as any).getTsoParams();

        expect(result).toEqual({
            account: "ACCVAL",
            characterSet: "CSVAL",
            codePage: "CPVAL",
            columns: "80",
            logonProcedure: "LOGPROC",
            regionSize: "4096",
            rows: "24",
        });
    });
});
