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
import { MvsCommandHandler } from "../../../src/command/MvsCommandHandler";
import * as utils from "../../../src/utils/ProfilesUtils";
import { imperative } from "@zowe/cli";
import { ZoweDatasetNode } from "../../../src/dataset/ZoweDatasetNode";
import { ZoweExplorerApiRegister } from "../../../src/ZoweExplorerApiRegister";
import * as globals from "../../../src/globals";
import { ZoweLogger } from "../../../src/utils/LoggerUtils";

describe("mvsCommandActions unit testing", () => {
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
    const qpItem: vscode.QuickPickItem = new utils.FilterDescriptor("\uFF0B " + "Create a new filter");
    const qpItem2 = new utils.FilterItem({ text: "/d iplinfo0" });

    const mockLoadNamedProfile = jest.fn();
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
    Object.defineProperty(ZoweLogger, "trace", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "error", { value: jest.fn(), configurable: true });

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

    const testNode = new ZoweDatasetNode("BRTVS99.DDIR", vscode.TreeItemCollapsibleState.Collapsed, null, session, undefined, undefined, profileOne);

    Object.defineProperty(vscode.window, "showErrorMessage", { value: showErrorMessage });
    Object.defineProperty(vscode.window, "showInputBox", { value: showInputBox });
    Object.defineProperty(vscode.window, "showInformationMessage", { value: showInformationMessage });
    Object.defineProperty(vscode.window, "showQuickPick", { value: showQuickPick });
    Object.defineProperty(vscode.window, "createQuickPick", { value: createQuickPick });
    Object.defineProperty(vscode.workspace, "getConfiguration", { value: getConfiguration });
    Object.defineProperty(vscode.window, "createOutputChannel", { value: createOutputChannel });
    Object.defineProperty(vscode, "ProgressLocation", { value: ProgressLocation });
    Object.defineProperty(vscode.window, "withProgress", { value: withProgress });

    mockLoadNamedProfile.mockReturnValue({ profile: { name: "aProfile", type: "zosmf" } });
    getConfiguration.mockReturnValue({
        get: (setting: string) => undefined,
        update: jest.fn(() => {
            return {};
        }),
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    const apiRegisterInstance = ZoweExplorerApiRegister.getInstance();
    const mvsActions = MvsCommandHandler.getInstance();
    const profilesForValidation = { status: "active", name: "fake" };

    it("tests the issueMvsCommand function", async () => {
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
                };
            }),
        });
        const mockMvsApi = await apiRegisterInstance.getMvsApi(profileOne);
        const getMvsApiMock = jest.fn();
        getMvsApiMock.mockReturnValue(mockMvsApi);
        apiRegisterInstance.getMvsApi = getMvsApiMock.bind(apiRegisterInstance);
        jest.spyOn(mockMvsApi, "getSession").mockReturnValue(session);

        showQuickPick.mockReturnValueOnce("firstName");

        const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
        const getCommandApiMock = jest.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

        showInputBox.mockReturnValueOnce("/d iplinfo1");
        jest.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(qpItem));
        jest.spyOn(mockCommandApi, "issueMvsCommand").mockReturnValue("iplinfo1" as any);

        await mvsActions.issueMvsCommand();

        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the Profile to use to submit the command",
        });
        expect(showInputBox.mock.calls.length).toBe(1);
        expect(appendLine.mock.calls.length).toBe(2);
        expect(appendLine.mock.calls[0][0]).toBe("> d iplinfo1");
        expect(appendLine.mock.calls[1][0]).toBe("iplinfo1");
        expect(showInformationMessage.mock.calls.length).toBe(0);
    });

    it("tests the issueMvsCommand function user selects a history item", async () => {
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
                };
            }),
        });

        showQuickPick.mockReturnValueOnce("firstName");

        const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
        const getCommandApiMock = jest.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

        jest.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(qpItem2));
        jest.spyOn(mockCommandApi, "issueMvsCommand").mockReturnValue("iplinfo0" as any);

        await mvsActions.issueMvsCommand();

        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the Profile to use to submit the command",
        });
        expect(showInputBox.mock.calls.length).toBe(0);
        expect(appendLine.mock.calls.length).toBe(2);
        expect(appendLine.mock.calls[0][0]).toBe("> d iplinfo0");
        expect(appendLine.mock.calls[1][0]).toBe("iplinfo0");
        expect(showInformationMessage.mock.calls.length).toBe(0);
    });

    it("tests the issueMvsCommand function - issueSimple throws an error", async () => {
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
                };
            }),
        });

        showQuickPick.mockReturnValueOnce("firstName");
        showInputBox.mockReturnValueOnce("/d iplinfo3");
        withProgress.mockRejectedValueOnce(Error("fake testError"));

        const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
        const getCommandApiMock = jest.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);
        jest.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(qpItem));
        jest.spyOn(mockCommandApi, "issueMvsCommand").mockReturnValue("iplinfo3" as any);

        await mvsActions.issueMvsCommand();

        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the Profile to use to submit the command",
        });
        expect(showInputBox.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toEqual("Error: fake testError");
    });

    it("tests the issueMvsCommand function user escapes the quick pick box", async () => {
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
                };
            }),
        });

        showQuickPick.mockReturnValueOnce("firstName");

        const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
        const getCommandApiMock = jest.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

        jest.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(undefined));

        await mvsActions.issueMvsCommand();

        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showInputBox.mock.calls.length).toBe(0);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the Profile to use to submit the command",
        });
        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toEqual("No selection made. Operation cancelled.");
    });

    it("tests the issueMvsCommand function user escapes the command box", async () => {
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
                };
            }),
        });
        showQuickPick.mockReturnValueOnce("firstName");
        showInputBox.mockReturnValueOnce(undefined);

        const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
        const getCommandApiMock = jest.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

        jest.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(qpItem));

        await mvsActions.issueMvsCommand();

        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the Profile to use to submit the command",
        });
        expect(showInputBox.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toEqual("No command entered.");
    });

    it("tests the issueMvsCommand function user starts typing a value in quick pick", async () => {
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
        showInputBox.mockReturnValueOnce(undefined);

        const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
        const getCommandApiMock = jest.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

        jest.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(qpItem));

        await mvsActions.issueMvsCommand();

        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the Profile to use to submit the command",
        });
        expect(showInputBox.mock.calls.length).toBe(0);
    });

    it("tests the issueMvsCommand function no profiles error", async () => {
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
        await mvsActions.issueMvsCommand();
        expect(showInformationMessage.mock.calls[0][0]).toEqual("No profiles available");
    });

    it("tests the issueMvsCommand prompt credentials", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: undefined, password: undefined } }, { name: "secondName" }],
                    defaultProfile: { name: "firstName" },
                    validProfile: ValidProfileEnum.VALID,
                    promptCredentials: jest.fn(() => {
                        return ["fake", "fake", "fake"];
                    }),
                    checkCurrentProfile: jest.fn(() => {
                        return profilesForValidation;
                    }),
                    validateProfiles: jest.fn(),
                    getBaseProfile: jest.fn(),
                };
            }),
        });

        showQuickPick.mockReturnValueOnce("firstName");
        showInputBox.mockReturnValueOnce("fake");
        showInputBox.mockReturnValueOnce("fake");
        showInputBox.mockReturnValueOnce("/d iplinfo");

        const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
        const getCommandApiMock = jest.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

        jest.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(qpItem));
        jest.spyOn(mockCommandApi, "issueMvsCommand").mockReturnValueOnce({ commandResponse: "fake response" } as any);

        await mvsActions.issueMvsCommand();

        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the Profile to use to submit the command",
        });
        expect(showInputBox.mock.calls.length).toBe(1);
    });

    it("tests the issueMvsCommand prompt credentials for password only", async () => {
        Object.defineProperty(profileLoader.Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    allProfiles: [{ name: "firstName", profile: { user: undefined, password: undefined } }, { name: "secondName" }],
                    defaultProfile: { name: "firstName" },
                    validProfile: ValidProfileEnum.VALID,
                    promptCredentials: jest.fn(() => {
                        return ["fake", "fake", "fake"];
                    }),
                    checkCurrentProfile: jest.fn(() => {
                        return profilesForValidation;
                    }),
                    validateProfiles: jest.fn(),
                    getBaseProfile: jest.fn(),
                };
            }),
        });

        showQuickPick.mockReturnValueOnce("firstName");
        showInputBox.mockReturnValueOnce("fake");
        showInputBox.mockReturnValueOnce("/d iplinfo5");

        const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
        const getCommandApiMock = jest.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);
        jest.spyOn(Gui, "resolveQuickPick").mockImplementation(() => Promise.resolve(qpItem));
        jest.spyOn(mockCommandApi, "issueMvsCommand").mockReturnValueOnce({ commandResponse: "fake response" } as any);

        await mvsActions.issueMvsCommand();

        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the Profile to use to submit the command",
        });
        expect(showInputBox.mock.calls.length).toBe(1);
    });

    it("tests the issueMvsCommand error in prompt credentials", async () => {
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
                };
            }),
        });

        showQuickPick.mockReturnValueOnce("firstName");
        showInputBox.mockReturnValueOnce("fake");

        await mvsActions.issueMvsCommand();

        expect(showErrorMessage.mock.calls.length).toBe(1);
    });

    it("tests the issueMvsCommand function user does not select a profile", async () => {
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

        await mvsActions.issueMvsCommand();

        expect(showInformationMessage.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls[0][0]).toEqual("Operation Cancelled");
    });

    it("tests the issueMvsCommand function from a session", async () => {
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

        jest.spyOn(mvsActions, "checkCurrentProfile").mockReturnValue(undefined);

        const mockCommandApi = await apiRegisterInstance.getCommandApi(profileOne);
        const getCommandApiMock = jest.fn();
        getCommandApiMock.mockReturnValue(mockCommandApi);
        apiRegisterInstance.getCommandApi = getCommandApiMock.bind(apiRegisterInstance);

        showInputBox.mockReturnValueOnce("/d iplinfo1");
        jest.spyOn(mockCommandApi, "issueMvsCommand").mockReturnValueOnce({ commandResponse: "fake response" } as any);

        await mvsActions.issueMvsCommand(session, null, testNode);

        expect(showInputBox.mock.calls.length).toBe(1);
        expect(showInformationMessage.mock.calls.length).toBe(0);
    });

    it("tests the issueMvsCommand handles error thrown by API register", async () => {
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
                };
            }),
        });
        const mockMvsApi = apiRegisterInstance.getMvsApi(profileOne);
        const getMvsApiMock = jest.fn();
        getMvsApiMock.mockReturnValue(mockMvsApi);
        apiRegisterInstance.getMvsApi = getMvsApiMock.bind(apiRegisterInstance);
        jest.spyOn(mockMvsApi, "getSession").mockReturnValue(session);

        showQuickPick.mockReturnValueOnce("firstName");
        const testError = new Error("getCommandApi failed");
        apiRegisterInstance.getCommandApi = jest.fn().mockImplementation(() => {
            throw testError;
        });

        await mvsActions.issueMvsCommand();

        expect(showQuickPick.mock.calls.length).toBe(1);
        expect(showQuickPick.mock.calls[0][0]).toEqual(["firstName", "secondName"]);
        expect(showQuickPick.mock.calls[0][1]).toEqual({
            canPickMany: false,
            ignoreFocusOut: true,
            placeHolder: "Select the Profile to use to submit the command",
        });
        expect(showInputBox.mock.calls.length).toBe(0);
        expect(showErrorMessage.mock.calls.length).toBe(1);
        expect(showErrorMessage.mock.calls[0][0]).toContain(testError.message);
    });
});
