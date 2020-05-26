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

import { createISessionWithoutCredentials, createTreeView, createIProfile, createInstanceOfProfile, createQuickPickItem, createQuickPickContent, createInputBox } from "../../__mocks__/mockCreators/shared";
import { createDatasetSessionNode, createDatasetTree } from "../../__mocks__/mockCreators/datasets";
import { createProfileManager, createTestSchemas } from "../../__mocks__/mockCreators/profiles";
import { createUSSTree, createUSSSessionNode } from "../../__mocks__/mockCreators/uss";
import { Profiles } from "../../src/Profiles";
import * as globals from "../../src/globals";
import * as vscode from "vscode";
import * as utils from "../../src/utils";
import { Logger } from "@zowe/imperative";
import { ZoweExplorerApiRegister } from "../../src/api/ZoweExplorerApiRegister";
import { ZosmfSession } from "@zowe/cli";

jest.mock("vscode");
jest.mock("child_process");
jest.mock("fs");
jest.mock("fs-extra");

async function createGlobalMocks() {
    const newMocks = {
        mockShowInputBox: jest.fn(),
        mockGetConfiguration: jest.fn(),
        mockCreateQuickPick: jest.fn(),
        mockShowQuickPick: jest.fn(),
        mockShowInformationMessage: jest.fn(),
        mockGetInstance: jest.fn(),
        mockShowErrorMessage: jest.fn(),
        mockCreateInputBox: jest.fn(),
        mockLog: jest.fn(),
        mockDebug: jest.fn(),
        mockError: jest.fn(),
        mockConfigurationTarget: jest.fn(),
        mockCreateBasicZosmfSession: jest.fn(),
        mockCliProfileManager: createProfileManager()
    }

    Object.defineProperty(vscode.window, "showInformationMessage", { value: newMocks.mockShowInformationMessage, configurable: true });
    Object.defineProperty(vscode.window, "showInputBox", { value: newMocks.mockShowInputBox, configurable: true });
    Object.defineProperty(vscode.window, "showErrorMessage", { value: newMocks.mockShowErrorMessage, configurable: true });
    Object.defineProperty(vscode.window, "showQuickPick", { value: newMocks.mockShowQuickPick, configurable: true });
    Object.defineProperty(vscode.window, "createQuickPick", { value: newMocks.mockCreateQuickPick, configurable: true });
    Object.defineProperty(Profiles, "getInstance", { value: newMocks.mockGetInstance, configurable: true });
    Object.defineProperty(globals, "LOG", { value: newMocks.mockLog, configurable: true });
    Object.defineProperty(vscode.window, "createInputBox", { value: newMocks.mockCreateInputBox, configurable: true });
    Object.defineProperty(globals.LOG, "debug", { value: newMocks.mockDebug, configurable: true });
    Object.defineProperty(ZosmfSession, "createBasicZosmfSession", { value: newMocks.mockCreateBasicZosmfSession });
    Object.defineProperty(globals.LOG, "error", { value: newMocks.mockError, configurable: true });
    Object.defineProperty(globals, "ISTHEIA", { get: () => false, configurable: true });
    Object.defineProperty(vscode.workspace, "getConfiguration", { value: newMocks.mockGetConfiguration, configurable: true });
    Object.defineProperty(vscode, "ConfigurationTarget", { value: newMocks.mockConfigurationTarget, configurable: true });
    Object.defineProperty(Profiles, "getInstance", { value: newMocks.mockGetInstance, configurable: true });

    return newMocks;
}

describe("Profiles Unit Tests - Function createZoweSession", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            log: Logger.getAppLogger(),
            session: createISessionWithoutCredentials(),
            treeView: createTreeView(),
            mockLoadNamedProfile: jest.fn(),
            imperativeProfile: createIProfile(),
            datasetSessionNode: null,
            quickPickItem: createQuickPickItem(),
            profiles: null,
            testDatasetTree: null,
            profileInstance: null,
        }
        newMocks.profiles = await Profiles.createInstance(newMocks.log);
        newMocks.profileInstance = createInstanceOfProfile(newMocks.profiles);
        newMocks.datasetSessionNode = createDatasetSessionNode(newMocks.session, newMocks.imperativeProfile);
        newMocks.testDatasetTree = createDatasetTree(newMocks.datasetSessionNode, newMocks.treeView);
        newMocks.mockLoadNamedProfile.mockReturnValue(newMocks.imperativeProfile);
        newMocks.profileInstance.loadNamedProfile = newMocks.mockLoadNamedProfile;
        globalMocks.mockGetInstance.mockReturnValue(newMocks.profileInstance);

        return newMocks;
    }

    it("Tests that createZoweSession fails if profile name invalid", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const entered = undefined;
        globalMocks.mockShowInputBox.mockResolvedValueOnce(entered);

        // Assert edge condition user cancels the input path box
        globalMocks.mockCreateQuickPick.mockReturnValue(createQuickPickContent(entered, blockMocks.quickPickItem));
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(blockMocks.quickPickItem);

        await Profiles.getInstance().loadNamedProfile("profile1");
        await blockMocks.profiles.createZoweSession(blockMocks.testDatasetTree);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toEqual("Profile Name was not supplied. Operation Cancelled");
    });

    it("Tests that createZoweSession successfully creates a new session with profile name supplied by user", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const entered = undefined;
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");

        // Assert edge condition user cancels the input path box
        globalMocks.mockCreateQuickPick.mockReturnValue(createQuickPickContent(entered, blockMocks.quickPickItem));
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(blockMocks.quickPickItem);

        await blockMocks.profiles.createZoweSession(blockMocks.testDatasetTree);
        expect(blockMocks.testDatasetTree.addSession).toBeCalled();
        expect(blockMocks.testDatasetTree.addSession.mock.calls[0][0]).toEqual({ newprofile: "fake" });
    });

    it("Tests that createZoweSession successfully creates a new session with profile name selected from list by user", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const entered = "";

        // Assert edge condition user cancels the input path box
        const quickPickContent = createQuickPickContent(entered, blockMocks.quickPickItem);
        quickPickContent.label = "firstName";
        globalMocks.mockCreateQuickPick.mockReturnValue(quickPickContent);
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(quickPickContent);

        await blockMocks.profiles.createZoweSession(blockMocks.testDatasetTree);
        expect(blockMocks.testDatasetTree.addSession).toBeCalled();
        expect(blockMocks.testDatasetTree.addSession.mock.calls[0][0]).toBe("firstName");
    });

    it("Tests that createZoweSession successfully creates a new session with profile name selected from list by user by typing", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const entered = "fake";

        globalMocks.mockCreateQuickPick.mockReturnValue(createQuickPickContent(entered, blockMocks.quickPickItem));
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(blockMocks.quickPickItem);

        await blockMocks.profiles.createZoweSession(blockMocks.testDatasetTree);
        expect(blockMocks.testDatasetTree.addSession).not.toBeCalled();
    });

    it("Tests that createZoweSession fails if profile not selected", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const entered = "";

        // Assert edge condition user cancels the input path box
        const quickPickContent = createQuickPickContent(entered, blockMocks.quickPickItem);
        quickPickContent.label = undefined;
        globalMocks.mockCreateQuickPick.mockReturnValue(quickPickContent);
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(quickPickContent);

        await blockMocks.profiles.createZoweSession(blockMocks.testDatasetTree);
        expect(blockMocks.testDatasetTree.addSession).not.toBeCalled();
    });

    it("Tests that createZoweSession fails if createNewConnection fails", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const entered = "fake";
        blockMocks.profileInstance.createNewConnection = jest.fn().mockRejectedValue(new Error("create connection error"));
        globalMocks.mockShowInputBox.mockResolvedValueOnce(entered);

        globalMocks.mockCreateQuickPick.mockReturnValue(createQuickPickContent(entered, blockMocks.quickPickItem));
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(blockMocks.quickPickItem);
        const errorHandlingSpy = jest.spyOn(utils, "errorHandling");

        await blockMocks.profiles.createZoweSession(blockMocks.testDatasetTree);
        expect(errorHandlingSpy).toBeCalled();
        expect(errorHandlingSpy.mock.calls[0][0]).toEqual(new Error("create connection error"));
    });

    it("Testing that createZoweSession with theia", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const entered = "";
        const createZoweSessionSpy = jest.spyOn(blockMocks.profiles, "createZoweSession");
        Object.defineProperty(globals, "ISTHEIA", { get: () => true, configurable: true });
        globalMocks.mockCreateQuickPick.mockReturnValue(createQuickPickContent(entered, blockMocks.quickPickItem));
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(blockMocks.quickPickItem);

        await blockMocks.profiles.createZoweSession(blockMocks.testDatasetTree);
        expect(createZoweSessionSpy).toHaveBeenCalled();
    });

    it("Testing that createZoweSession with theia fails if no choice", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const entered = null;
        const createZoweSessionSpy = jest.spyOn(blockMocks.profiles, "createZoweSession");
        Object.defineProperty(globals, "ISTHEIA", { get: () => true, configurable: true });
        globalMocks.mockCreateQuickPick.mockReturnValue(createQuickPickContent(entered, blockMocks.quickPickItem));
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(blockMocks.quickPickItem);

        await blockMocks.profiles.createZoweSession(blockMocks.testDatasetTree);
        expect(createZoweSessionSpy).toHaveBeenCalled();
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
    });
});

describe("Profiles Unit Tests - Function createNewConnection", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            log: Logger.getAppLogger(),
            session: createISessionWithoutCredentials(),
            treeView: createTreeView(),
            mockLoadNamedProfile: jest.fn(),
            imperativeProfile: createIProfile(),
            datasetSessionNode: null,
            inputBox: createInputBox("input"),
            quickPickItem: createQuickPickItem(),
            profiles: null,
            testSchemas: createTestSchemas(),
            testDatasetTree: null,
            profileInstance: null
        }
        newMocks.imperativeProfile.name = "profile1";
        newMocks.imperativeProfile.profile.user = "fake";
        newMocks.imperativeProfile.profile.password = "1234";
        newMocks.profiles = await Profiles.createInstance(newMocks.log);
        newMocks.profileInstance = createInstanceOfProfile(newMocks.profiles);
        newMocks.mockLoadNamedProfile.mockReturnValue(newMocks.imperativeProfile);
        newMocks.profileInstance.loadNamedProfile = newMocks.mockLoadNamedProfile;
        globalMocks.mockGetInstance.mockReturnValue(newMocks.profileInstance);
        globalMocks.mockCreateInputBox.mockReturnValue(newMocks.inputBox);
        newMocks.datasetSessionNode = createDatasetSessionNode(newMocks.session, newMocks.imperativeProfile);
        newMocks.testDatasetTree = createDatasetTree(newMocks.datasetSessionNode, newMocks.treeView);

        return newMocks;
    }

    it("Tests that createNewConnection fails if profileName is missing", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        await blockMocks.profiles.createNewConnection("");
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile name was not supplied. Operation Cancelled");
    });

    it("Tests that createNewConnection fails if profileType is missing", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve(undefined); });

        await blockMocks.profiles.createNewConnection(blockMocks.imperativeProfile.name);
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("No profile type was chosen. Operation Cancelled");
    });

    it("Tests that createNewConnection fails if zOSMF URL is missing", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("zosmf"); });
        blockMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[0]); });
        blockMocks.profiles.getUrl = () => new Promise((resolve) => { resolve(undefined); });

        await blockMocks.profiles.createNewConnection(blockMocks.imperativeProfile.name);
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("No valid value for z/OS URL. Operation Cancelled");
    });

    it("Tests that createNewConnection fails if username is missing", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("zosmf"); });
        blockMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[0]); });
        blockMocks.profiles.getUrl = () => Promise.resolve("https://fake:143");
        globalMocks.mockShowInputBox.mockResolvedValueOnce(undefined);

        await blockMocks.profiles.createNewConnection(blockMocks.imperativeProfile.name);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
    });

    it("Tests that createNewConnection fails if password is missing", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("zosmf"); });
        blockMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[0]); });
        blockMocks.profiles.getUrl = () => Promise.resolve("https://fake:143");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce(undefined);

        await blockMocks.profiles.createNewConnection(blockMocks.imperativeProfile.name);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
    });

    it("Tests that createNewConnection fails if rejectUnauthorized is missing", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("zosmf"); });
        blockMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[0]); });
        blockMocks.profiles.getUrl = () => Promise.resolve("https://fake:143");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce(undefined);

        await blockMocks.profiles.createNewConnection(blockMocks.imperativeProfile.name);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
    });

    it("Tests that createNewConnection fails if profileName is a duplicate", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("zosmf"); });
        blockMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[0]); });
        blockMocks.profiles.getUrl = () => Promise.resolve("https://fake:143");
        globalMocks.mockShowInputBox.mockResolvedValue("fake");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("False - Accept connections with self-signed certificates");

        await blockMocks.profiles.createNewConnection(blockMocks.imperativeProfile.name);
        expect(globalMocks.mockShowErrorMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowErrorMessage.mock.calls[0][0]).toBe("Profile name already exists. Please create a profile using a different name");
    });

    it("Tests that createNewConnection creates a new profile", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("zosmf"); });
        blockMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[0]); });
        blockMocks.profiles.getUrl = () => Promise.resolve("https://fake:143");
        globalMocks.mockShowInputBox.mockResolvedValue("fake");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("False - Accept connections with self-signed certificates");

        await blockMocks.profiles.createNewConnection("fake");
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile fake was created.");
    });

    it("Tests that createNewConnection creates a new profile with optional credentials", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("zosmf"); });
        blockMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[0]); });
        blockMocks.profiles.getUrl = () => Promise.resolve("https://fake:143");
        globalMocks.mockShowInputBox.mockResolvedValue("");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("False - Accept connections with self-signed certificates");

        await blockMocks.profiles.createNewConnection("fake");
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile fake was created.");
    });

    it("Tests that createNewConnection creates a new profile twice in a row", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("zosmf"); });
        blockMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[0]); });
        blockMocks.profiles.getUrl = () => Promise.resolve("https://fake:143");
        globalMocks.mockShowInputBox.mockResolvedValue("fake1");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("False - Accept connections with self-signed certificates");

        await blockMocks.profiles.createNewConnection("fake1");
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile fake1 was created.");

        globalMocks.mockShowInputBox.mockReset();
        globalMocks.mockShowInformationMessage.mockReset();
        globalMocks.mockShowInputBox.mockResolvedValue("fake2");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("True - Reject connections with self-signed certificates");

        await blockMocks.profiles.createNewConnection("fake2");
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile fake2 was created.");
    });

    it("Tests that createNewConnection creates an alternate profile", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("alternate"); });
        blockMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[1]); });
        blockMocks.profiles.getUrl = () => new Promise((resolve) => { resolve("https://fake:234"); });
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("False");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("13");

        await blockMocks.profiles.createNewConnection("alternate");
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile alternate was created.");
    });

    it("Tests that createNewConnection creates an alternate profile with default aNumber value", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("alternate"); });
        blockMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[1]); });
        blockMocks.profiles.getUrl = () => new Promise((resolve) => { resolve("https://fake:234"); });
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("False");
        globalMocks.mockShowInputBox.mockResolvedValueOnce(undefined);

        await blockMocks.profiles.createNewConnection("alternate");
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile alternate was created.");
    });

    it("Tests that createNewConnection creates an alternate profile with default port value", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("alternate"); });
        blockMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[1]); });
        blockMocks.profiles.getUrl = () => new Promise((resolve) => { resolve("https://fake"); });
        globalMocks.mockShowInputBox.mockResolvedValueOnce("0");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("True");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("126");

        await blockMocks.profiles.createNewConnection("alternate");
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile alternate was created.");
    });

    it("Tests that createNewConnection fails to create an alternate profile if port is invalid", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("alternate"); });
        blockMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[1]); });
        blockMocks.profiles.getUrl = () => new Promise((resolve) => { resolve("https://fake"); });
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");

        await blockMocks.profiles.createNewConnection("fake");
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Invalid Port number provided or operation was cancelled");
    });

    it("Tests that createNewConnection fails to create an alternate profile if aBoolean is invalid", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("alternate"); });
        blockMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[1]); });
        blockMocks.profiles.getUrl = () => new Promise((resolve) => { resolve("https://fake:143"); });
        globalMocks.mockShowInputBox.mockResolvedValue("fake");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce(undefined);

        await blockMocks.profiles.createNewConnection("fake");
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
    });

    it("Tests that createNewConnection creates an alternate profile with an optional port", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("alternate"); });
        blockMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[2]); });
        blockMocks.profiles.getUrl = () => new Promise((resolve) => { resolve("https://fake"); });
        globalMocks.mockShowInputBox.mockResolvedValueOnce(Number("143"));

        await blockMocks.profiles.createNewConnection("fake");
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile fake was created.");
    });
});

describe("Profiles Unit Tests - Function promptCredentials", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            log: Logger.getAppLogger(),
            mockLoadNamedProfile: jest.fn(),
            imperativeProfile: createIProfile(),
            profiles: null,
            profileInstance: null
        }
        newMocks.imperativeProfile.name = "profile1";
        newMocks.imperativeProfile.profile.user = "fake";
        newMocks.imperativeProfile.profile.password = "1234";
        newMocks.profiles = await Profiles.createInstance(newMocks.log);
        newMocks.profileInstance = createInstanceOfProfile(newMocks.profiles);
        newMocks.profileInstance.loadNamedProfile = newMocks.mockLoadNamedProfile;

        return newMocks;
    }

    it("Tests that promptCredentials is executed successfully", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.imperativeProfile.profile = { user: undefined, password: undefined };
        blockMocks.mockLoadNamedProfile.mockReturnValue(blockMocks.imperativeProfile);
        globalMocks.mockCreateBasicZosmfSession.mockReturnValue(
            { ISession: { user: "fake", password: "fake", base64EncodedAuth: "fake" } });
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");

        const res = await blockMocks.profiles.promptCredentials(blockMocks.imperativeProfile.name);
        expect(res).toEqual(["fake", "fake", "fake"]);
    });

    it("Tests that promptCredentials is executed successfully when profile already contains username/password", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.imperativeProfile.profile = { user: "oldfake", password: "oldfake" };
        blockMocks.mockLoadNamedProfile.mockReturnValue(blockMocks.imperativeProfile);
        globalMocks.mockCreateBasicZosmfSession.mockReturnValue(
            { ISession: { user: "fake", password: "fake", base64EncodedAuth: "fake" } });
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");

        const res = await blockMocks.profiles.promptCredentials(blockMocks.imperativeProfile.name, true);
        expect(res).toEqual(["fake", "fake", "fake"]);
    });

    it("Tests that promptCredentials fails if username is invalid", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.imperativeProfile.profile = { user: undefined, password: undefined };
        blockMocks.mockLoadNamedProfile.mockReturnValue(blockMocks.imperativeProfile);
        globalMocks.mockShowInputBox.mockResolvedValueOnce(undefined);

        const res = await blockMocks.profiles.promptCredentials(blockMocks.imperativeProfile.name);
        expect(res).toBeUndefined();
    });

    it("Tests that promptCredentials fails if password is invalid", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.imperativeProfile.profile = { user: undefined, password: undefined };
        blockMocks.mockLoadNamedProfile.mockReturnValue(blockMocks.imperativeProfile);
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce(undefined);

        const res = await blockMocks.profiles.promptCredentials(blockMocks.imperativeProfile.name);
        expect(res).toBeUndefined();
    });
});

describe("Profiles Unit Tests - Function validateAndParseUrl", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            log: Logger.getAppLogger(),
            profiles: null,
            profileInstance: null
        }
        newMocks.profiles = await Profiles.createInstance(newMocks.log);
        newMocks.profileInstance = createInstanceOfProfile(newMocks.profiles);

        return newMocks;
    }

    it("Tests that validateAndParseUrl returns invalid for invalid URL", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const input = "fake/url";
        const res = await blockMocks.profiles.validateAndParseUrl(input);
        expect(res.valid).toBe(false);
    });

    it("Tests that validateAndParseUrl successfully validates a URL with a port", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const input = "https://fake:143";

        const res = await blockMocks.profiles.validateAndParseUrl(input);
        expect(res.valid).toBe(true);
        expect(res.host).toBe("fake");
        // tslint:disable-next-line: no-magic-numbers
        expect(res.port).toBe(143);

    });

    it("Tests that validateAndParseUrl returns invalid for invalid port", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const res = await blockMocks.profiles.validateAndParseUrl("http://10.142.0.23:9999999999/some/path");
        expect(res.valid).toBe(false);
    });

    it("Tests that validateAndParseUrl returns invalid for invalid URL syntax", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const res = await blockMocks.profiles.validateAndParseUrl("https://fake::80");
        expect(res.valid).toBe(false);
    });
});

describe("Profiles Unit Tests - Function getProfileType", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            log: Logger.getAppLogger(),
            profiles: null,
            profileInstance: null
        }
        newMocks.profiles = await Profiles.createInstance(newMocks.log);
        newMocks.profileInstance = createInstanceOfProfile(newMocks.profiles);

        return newMocks;
    }

    it("Tests that getProfileType returns correct profile type when receiving only one type", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        ZoweExplorerApiRegister.getInstance().registeredApiTypes = () => (["zosmf"]);

        const response = await blockMocks.profiles.getProfileType();
        expect(response).toEqual("zosmf");
    });

    it("Tests that getProfileType returns correct profile type when receiving multiple types", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        ZoweExplorerApiRegister.getInstance().registeredApiTypes = () => (["zosmf", "alternate"]);
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("alternate");

        const res = await blockMocks.profiles.getProfileType();
        expect(res).toEqual("alternate");
    });
});

describe("Profiles Unit Tests - Function getSchema", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            log: Logger.getAppLogger(),
            profiles: null,
            testSchemas: createTestSchemas(),
            profileInstance: null
        }
        newMocks.profiles = await Profiles.createInstance(newMocks.log);
        newMocks.profileInstance = createInstanceOfProfile(newMocks.profiles);

        return newMocks;
    }

    it("Tests that getSchema returns correct schema for zosmf profile", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        blockMocks.profiles.getCliProfileManager = () => Promise.resolve(globalMocks.mockCliProfileManager);

        const response = await blockMocks.profiles.getSchema("zosmf");
        expect(response).toEqual(blockMocks.testSchemas[3]);
    });
});

describe("Profiles Unit Tests - Function editSession", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            log: Logger.getAppLogger(),
            session: createISessionWithoutCredentials(),
            mockLoadNamedProfile: jest.fn(),
            imperativeProfile: createIProfile(),
            datasetSessionNode: null,
            inputBox: createInputBox("input"),
            profiles: null,
            testSchemas: createTestSchemas(),
            profileInstance: null
        }
        newMocks.imperativeProfile.name = "profile1";
        newMocks.imperativeProfile.profile.user = "fake";
        newMocks.imperativeProfile.profile.password = "1234";
        newMocks.profiles = await Profiles.createInstance(newMocks.log);
        newMocks.profileInstance = createInstanceOfProfile(newMocks.profiles);
        newMocks.mockLoadNamedProfile.mockReturnValue(newMocks.imperativeProfile);
        globalMocks.mockCreateInputBox.mockReturnValue(newMocks.inputBox);
        newMocks.datasetSessionNode = createDatasetSessionNode(newMocks.session, newMocks.imperativeProfile);

        return newMocks;
    }

    it("Tests that editSession successfully edits a session of type zosmf", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("zosmf"); });
        blockMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[0]); });
        blockMocks.profiles.getUrl = () => Promise.resolve("https://fake:143");
        globalMocks.mockCreateInputBox.mockReturnValue(blockMocks.inputBox);
        globalMocks.mockShowInputBox.mockResolvedValue("fake");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("False - Accept connections with self-signed certificates");
        globalMocks.mockCreateBasicZosmfSession.mockReturnValue(
            { ISession: { user: "fake", password: "fake", base64EncodedAuth: "fake" } });

        await blockMocks.profiles.editSession(blockMocks.imperativeProfile, blockMocks.imperativeProfile.name);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile was successfully updated");
    });

    it("Tests that editSession successfully edits a session of type alternate", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("alternate"); });
        blockMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[1]); });
        blockMocks.profiles.getUrl = () => Promise.resolve("https://fake:143");
        globalMocks.mockCreateInputBox.mockReturnValue(blockMocks.inputBox);
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("False");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("123");
        globalMocks.mockCreateBasicZosmfSession.mockReturnValue(
            { ISession: { user: "fake", password: "fake", base64EncodedAuth: "fake" } });

        await blockMocks.profiles.editSession(blockMocks.imperativeProfile, blockMocks.imperativeProfile.name);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile was successfully updated");
    });

    it("Tests that editSession successfully edits a session of type alternate with entered port number", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("alternate"); });
        blockMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[1]); });
        blockMocks.profiles.getUrl = () => Promise.resolve("https://fake");
        globalMocks.mockCreateInputBox.mockReturnValue(blockMocks.inputBox);
        globalMocks.mockShowInputBox.mockResolvedValueOnce("123");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("False");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("123");
        globalMocks.mockCreateBasicZosmfSession.mockReturnValue(
            { ISession: { user: "fake", password: "fake", base64EncodedAuth: "fake" } });

        await blockMocks.profiles.editSession(blockMocks.imperativeProfile, blockMocks.imperativeProfile.name);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile was successfully updated");
    });

    it("Tests that editSession successfully edits a session of type alternate with default aNumber", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("alternate"); });
        blockMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[1]); });
        blockMocks.profiles.getUrl = () => Promise.resolve("https://fake:143");
        globalMocks.mockCreateInputBox.mockReturnValue(blockMocks.inputBox);
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("False");
        globalMocks.mockShowInputBox.mockResolvedValueOnce(undefined);
        globalMocks.mockCreateBasicZosmfSession.mockReturnValue(
            { ISession: { user: "fake", password: "fake", base64EncodedAuth: "fake" } });

        await blockMocks.profiles.editSession(blockMocks.imperativeProfile, blockMocks.imperativeProfile.name);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile was successfully updated");
    });

    it("Tests that editSession successfully edits a session of type alternate with empty aNumber", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("alternate"); });
        blockMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[2]); });
        blockMocks.profiles.getUrl = () => Promise.resolve("https://fake:143");
        globalMocks.mockCreateInputBox.mockReturnValue(blockMocks.inputBox);
        globalMocks.mockShowInputBox.mockResolvedValueOnce(undefined);
        globalMocks.mockCreateBasicZosmfSession.mockReturnValue(
            { ISession: { user: "fake", password: "fake", base64EncodedAuth: "fake" } });

        await blockMocks.profiles.editSession(blockMocks.imperativeProfile, blockMocks.imperativeProfile.name);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile was successfully updated");
    });

    it("Tests that editSession successfully edits a session of type alternate with empty aOther value", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("alternate"); });
        blockMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[2]); });
        blockMocks.profiles.getUrl = () => Promise.resolve("https://fake:143");
        globalMocks.mockCreateInputBox.mockReturnValue(blockMocks.inputBox);
        globalMocks.mockShowInputBox.mockResolvedValueOnce("123");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("");
        globalMocks.mockCreateBasicZosmfSession.mockReturnValue(
            { ISession: { user: "fake", password: "fake", base64EncodedAuth: "fake" } });

        await blockMocks.profiles.editSession(blockMocks.imperativeProfile, blockMocks.imperativeProfile.name);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile was successfully updated");
    });

    it("Tests that editSession fails with error", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("zosmf"); });
        blockMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[0]); });
        blockMocks.profiles.getUrl = () => Promise.resolve("https://fake:143");
        globalMocks.mockCreateInputBox.mockReturnValue(blockMocks.inputBox);
        globalMocks.mockShowInputBox.mockResolvedValue("fake");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("False - Accept connections with self-signed certificates");

        await blockMocks.profiles.editSession(blockMocks.imperativeProfile, blockMocks.imperativeProfile.name);
        expect(globalMocks.mockShowErrorMessage.mock.calls.length).toEqual(1);
    });

    it("Tests that editSession fails with invalid url supplied", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("zosmf"); });
        blockMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[0]); });
        blockMocks.profiles.getUrl = () => Promise.resolve(undefined);
        globalMocks.mockCreateInputBox.mockReturnValue(blockMocks.inputBox);

        await blockMocks.profiles.editSession(blockMocks.imperativeProfile, blockMocks.imperativeProfile.name);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("No valid value for z/OS URL. Operation Cancelled");
    });

    it("Tests that editSession fails with invalid username supplied", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("zosmf"); });
        blockMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[0]); });
        blockMocks.profiles.getUrl = () => Promise.resolve("https://fake:143");
        globalMocks.mockCreateInputBox.mockReturnValue(blockMocks.inputBox);
        globalMocks.mockShowInputBox.mockResolvedValueOnce(undefined);

        await blockMocks.profiles.editSession(blockMocks.imperativeProfile, blockMocks.imperativeProfile.name);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
    });

    it("Tests that editSession fails with invalid password supplied", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("zosmf"); });
        blockMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[0]); });
        blockMocks.profiles.getUrl = () => Promise.resolve("https://fake:143");
        globalMocks.mockCreateInputBox.mockReturnValue(blockMocks.inputBox);
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce(undefined);

        await blockMocks.profiles.editSession(blockMocks.imperativeProfile, blockMocks.imperativeProfile.name);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
    });

    it("Tests that editSession fails with invalid rejectUnauthorized value supplied", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("zosmf"); });
        blockMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[0]); });
        blockMocks.profiles.getUrl = () => Promise.resolve("https://fake:143");
        globalMocks.mockCreateInputBox.mockReturnValue(blockMocks.inputBox);
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce(undefined);

        await blockMocks.profiles.editSession(blockMocks.imperativeProfile, blockMocks.imperativeProfile.name);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
    });

    it("Tests that editSession fails with invalid aBoolean value supplied on alternate profile type", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("alternate"); });
        blockMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[1]); });
        blockMocks.profiles.getUrl = () => Promise.resolve("https://fake.com:143");
        globalMocks.mockCreateInputBox.mockReturnValue(blockMocks.inputBox);
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce(undefined);

        await blockMocks.profiles.editSession(blockMocks.imperativeProfile, blockMocks.imperativeProfile.name);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
    });

    it("Tests that editSession fails with invalid port value supplied", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("alternate"); });
        blockMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[1]); });
        blockMocks.profiles.getUrl = () => Promise.resolve("https://fake");
        globalMocks.mockCreateInputBox.mockReturnValue(blockMocks.inputBox);
        globalMocks.mockShowInputBox.mockResolvedValueOnce(undefined);

        await blockMocks.profiles.editSession(blockMocks.imperativeProfile, blockMocks.imperativeProfile.name);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Invalid Port number provided or operation was cancelled");
    });
});
