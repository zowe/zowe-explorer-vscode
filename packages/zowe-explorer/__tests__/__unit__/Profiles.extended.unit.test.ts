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

import {
    createISessionWithoutCredentials,
    createTreeView,
    createIProfile,
    createInstanceOfProfile,
    createQuickPickItem,
    createQuickPickContent,
    createInputBox,
    createSessCfgFromArgs,
    createPersistentConfig,
    createInvalidIProfile,
    createValidIProfile,
    createISession,
    createAltTypeIProfile,
    createInstanceOfProfileInfo,
    createInstanceOfProfilesCache,
} from "../../__mocks__/mockCreators/shared";
import { createDatasetSessionNode, createDatasetTree } from "../../__mocks__/mockCreators/datasets";
import { createProfileManager, createTestSchemas, newTestSchemas } from "../../__mocks__/mockCreators/profiles";
import * as vscode from "vscode";
import * as utils from "../../src/utils/ProfilesUtils";
import * as child_process from "child_process";
import { Logger, SessConstants } from "@zowe/imperative";
import * as globals from "../../src/globals";
import { ValidProfileEnum, IZoweNodeType, ProfilesCache } from "@zowe/zowe-explorer-api";
import { ZosmfSession } from "@zowe/cli";
import { ZoweExplorerApiRegister } from "../../src/ZoweExplorerApiRegister";
import { Profiles } from "../../src/Profiles";
import { ZoweUSSNode } from "../../src/uss/ZoweUSSNode";
import { ZoweDatasetNode } from "../../src/dataset/ZoweDatasetNode";
import { Job } from "../../src/job/ZoweJobNode";
import { createUSSSessionNode, createUSSTree } from "../../__mocks__/mockCreators/uss";
import { createJobsTree, createIJobObject, createJobSessionNode } from "../../__mocks__/mockCreators/jobs";
import { glob } from "glob";

jest.mock("vscode");
jest.mock("child_process");
jest.mock("fs");
jest.mock("fs-extra");

async function createGlobalMocks() {
    const newMocks = {
        log: Logger.getAppLogger(),
        mockShowInputBox: jest.fn(),
        mockGetConfiguration: jest.fn(),
        mockCreateQuickPick: jest.fn(),
        mockShowQuickPick: jest.fn(),
        mockShowInformationMessage: jest.fn(),
        mockShowErrorMessage: jest.fn(),
        mockCreateInputBox: jest.fn(),
        mockLog: jest.fn(),
        mockDebug: jest.fn(),
        mockError: jest.fn(),
        mockConfigurationTarget: jest.fn(),
        mockCreateSessCfgFromArgs: jest.fn(),
        testProfile: createValidIProfile(),
        testSession: createISession(),
        mockCliProfileManager: createProfileManager(),
        ProgressLocation: jest.fn().mockImplementation(() => {
            return {
                Notification: 15,
            };
        }),
        withProgress: null,
        mockCallback: null,
        mockUrlInfo: {
            valid: true,
            protocol: "https",
            host: "fake.com",
            port: 143,
        },
        mockProfileInstance: null,
        mockProfilesCache: null,
    };

    newMocks.mockProfilesCache = new ProfilesCache(Logger.getAppLogger());
    newMocks.withProgress = jest.fn().mockImplementation((progLocation, callback) => {
        return newMocks.mockCallback;
    });

    Object.defineProperty(vscode.window, "showInformationMessage", {
        value: newMocks.mockShowInformationMessage,
        configurable: true,
    });
    Object.defineProperty(vscode.window, "showInputBox", { value: newMocks.mockShowInputBox, configurable: true });
    Object.defineProperty(vscode.window, "showErrorMessage", {
        value: newMocks.mockShowErrorMessage,
        configurable: true,
    });
    Object.defineProperty(vscode.window, "showQuickPick", { value: newMocks.mockShowQuickPick, configurable: true });
    Object.defineProperty(vscode.window, "createQuickPick", {
        value: newMocks.mockCreateQuickPick,
        configurable: true,
    });
    Object.defineProperty(globals, "LOG", { value: newMocks.mockLog, configurable: true });
    Object.defineProperty(vscode.window, "createInputBox", { value: newMocks.mockCreateInputBox, configurable: true });
    Object.defineProperty(globals.LOG, "debug", { value: newMocks.mockDebug, configurable: true });
    Object.defineProperty(ZosmfSession, "createSessCfgFromArgs", {
        value: newMocks.mockCreateSessCfgFromArgs,
        configurable: true,
    });
    Object.defineProperty(globals.LOG, "error", { value: newMocks.mockError, configurable: true });
    Object.defineProperty(globals, "ISTHEIA", { get: () => false, configurable: true });
    Object.defineProperty(vscode.window, "createTreeView", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.workspace, "getConfiguration", {
        value: newMocks.mockGetConfiguration,
        configurable: true,
    });
    Object.defineProperty(vscode, "ConfigurationTarget", {
        value: newMocks.mockConfigurationTarget,
        configurable: true,
    });
    Object.defineProperty(vscode, "ProgressLocation", { value: newMocks.ProgressLocation, configurable: true });
    Object.defineProperty(vscode.window, "withProgress", { value: newMocks.withProgress, configurable: true });

    newMocks.mockProfileInstance = new Profiles(newMocks.log);
    Object.defineProperty(Profiles, "CreateInstance", {
        value: () => newMocks.mockProfileInstance,
        configurable: true,
    });
    Object.defineProperty(Profiles, "getInstance", {
        value: () => newMocks.mockProfileInstance,
        configurable: true,
    });
    Object.defineProperty(newMocks.mockProfileInstance, "allProfiles", {
        value: [{ name: "sestest" }, { name: "profile1" }, { name: "profile2" }],
        configurable: true,
    });

    Object.defineProperty(globals, "PROFILESCACHE", { value: createInstanceOfProfilesCache(), configurable: true });
    Object.defineProperty(globals.PROFILESCACHE, "getProfileInfo", {
        value: jest.fn().mockReturnValue(createInstanceOfProfileInfo()),
        configurable: true,
    });
    Object.defineProperty(newMocks.mockProfilesCache, "getProfileInfo", {
        value: jest.fn(() => {
            return createInstanceOfProfileInfo();
        }),
        configurable: true,
    });

    return newMocks;
}

afterEach(() => {
    jest.clearAllMocks();
});

describe("Profiles Unit Tests - Function createNewConnection for v1 Profiles", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            testSchemas: newTestSchemas(),
            inputBox: createInputBox("input"),
        };
        globalMocks.mockCreateInputBox.mockReturnValue(newMocks.inputBox);

        return newMocks;
    }

    it("Tests that createNewConnection fails if profileName is missing", async () => {
        const globalMocks = await createGlobalMocks();

        await Profiles.getInstance().createNewConnection("");
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe(
            "Profile name was not supplied. Operation Cancelled"
        );
    });

    it("Tests that createNewConnection fails if profileType is missing", async () => {
        const globalMocks = await createGlobalMocks();
        const spy = jest.spyOn(globalMocks.mockProfileInstance, "getProfileType").mockImplementation(undefined);

        await Profiles.getInstance().createNewConnection(globalMocks.testProfile.name, undefined);
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe(
            "No profile type was chosen. Operation Cancelled"
        );
        spy.mockClear();
    });

    it("Tests that createNewConnection fails if zOSMF URL is missing", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const spy = jest.spyOn(globalMocks.mockProfileInstance, "getSchema").mockReturnValue(blockMocks.testSchemas);
        globalMocks.mockCreateInputBox.mockResolvedValue(undefined);

        await Profiles.getInstance().createNewConnection(globalMocks.testProfile.name, "zosmf");
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe(
            "No valid value for z/OS URL. Operation Cancelled"
        );
        spy.mockClear();
    });

    it("Tests that createNewConnection fails if user escapes create at username", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        let spy = jest.spyOn(globalMocks.mockProfileInstance, "getSchema").mockReturnValue(blockMocks.testSchemas);
        spy = jest.spyOn(globalMocks.mockProfileInstance, "urlInfo").mockReturnValue(globalMocks.mockUrlInfo);
        globalMocks.mockCreateInputBox.mockResolvedValueOnce(undefined);

        await Profiles.getInstance().createNewConnection(globalMocks.testProfile.name, "zosmf");
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
        spy.mockClear();
    });

    it("Tests that createNewConnection fails if user escapes create at password", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        let spy = jest.spyOn(globalMocks.mockProfileInstance, "getSchema").mockReturnValue(blockMocks.testSchemas);
        spy = jest.spyOn(globalMocks.mockProfileInstance, "urlInfo").mockReturnValue(globalMocks.mockUrlInfo);
        spy = jest.spyOn(globalMocks.mockProfileInstance, "userInfo").mockReturnValue(globalMocks.testProfile.name);
        globalMocks.mockCreateInputBox.mockResolvedValueOnce(undefined);

        await Profiles.getInstance().createNewConnection(globalMocks.testProfile.name, "zosmf");
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
        spy.mockClear();
    });

    it("Tests that createNewConnection fails if user escapes create at rejectUnauthorized", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        let spy = jest.spyOn(globalMocks.mockProfileInstance, "getSchema").mockReturnValue(blockMocks.testSchemas);
        spy = jest.spyOn(globalMocks.mockProfileInstance, "urlInfo").mockReturnValue(globalMocks.mockUrlInfo);
        spy = jest
            .spyOn(globalMocks.mockProfileInstance, "userInfo")
            .mockReturnValue(globalMocks.testProfile.profile.user);
        spy = jest
            .spyOn(globalMocks.mockProfileInstance, "passwordInfo")
            .mockReturnValue(globalMocks.testProfile.profile.password);
        globalMocks.mockCreateInputBox.mockResolvedValueOnce(undefined);

        await Profiles.getInstance().createNewConnection(globalMocks.testProfile.name, "zosmf");
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
        spy.mockClear();
    });

    it("Tests that createNewConnection fails if profileName is a duplicate", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        let spy = jest.spyOn(globalMocks.mockProfileInstance, "getSchema").mockReturnValue(blockMocks.testSchemas);
        spy = jest.spyOn(globalMocks.mockProfileInstance, "urlInfo").mockReturnValue(globalMocks.mockUrlInfo);
        spy = jest
            .spyOn(globalMocks.mockProfileInstance, "userInfo")
            .mockReturnValue(globalMocks.testProfile.profile.user);
        spy = jest
            .spyOn(globalMocks.mockProfileInstance, "passwordInfo")
            .mockReturnValue(globalMocks.testProfile.profile.password);
        spy = jest.spyOn(globalMocks.mockProfileInstance, "ruInfo").mockReturnValue(false);

        await Profiles.getInstance().createNewConnection(globalMocks.testProfile.name, "zosmf");
        expect(globalMocks.mockShowErrorMessage.mock.calls[0][0]).toBe(
            "Profile name already exists. Please create a profile using a different name"
        );
        spy.mockClear();
    });

    it("Tests that createNewConnection creates a new profile", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        let spy = jest.spyOn(globalMocks.mockProfileInstance, "getSchema").mockReturnValue(blockMocks.testSchemas);
        spy = jest.spyOn(globalMocks.mockProfileInstance, "urlInfo").mockReturnValue(globalMocks.mockUrlInfo);
        spy = jest
            .spyOn(globalMocks.mockProfileInstance, "userInfo")
            .mockReturnValue(globalMocks.testProfile.profile.user);
        spy = jest
            .spyOn(globalMocks.mockProfileInstance, "passwordInfo")
            .mockReturnValue(globalMocks.testProfile.profile.password);
        spy = jest.spyOn(globalMocks.mockProfileInstance, "ruInfo").mockReturnValue(false);

        await Profiles.getInstance().createNewConnection("fake", "zosmf");
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile fake was created.");
        spy.mockClear();
    });
});
