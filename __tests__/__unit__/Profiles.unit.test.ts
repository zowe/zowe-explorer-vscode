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

import { createISessionWithoutCredentials, createTreeView, createIProfile, createInstanceOfProfile,
         createQuickPickItem, createQuickPickContent, createInputBox, createBasicZosmfSession, createISession,
         createPersistentConfig, createInvalidIProfile, createValidIProfile } from "../../__mocks__/mockCreators/shared";
import { createDatasetSessionNode, createDatasetTree } from "../../__mocks__/mockCreators/datasets";
import { createProfileManager, createTestSchemas } from "../../__mocks__/mockCreators/profiles";
import * as vscode from "vscode";
import * as utils from "../../src/utils";
import * as child_process from "child_process";
import { Logger } from "@zowe/imperative";
import * as globals from "../../src/globals";
import { Profiles, ValidProfileEnum } from "../../src/Profiles";
import { ZosmfSession, CheckStatus } from "@zowe/cli";
import { ZoweUSSNode } from "../../src/uss/ZoweUSSNode";
import { ZoweExplorerApiRegister } from "../../src/api/ZoweExplorerApiRegister";
import { ZoweDatasetNode } from "../../src/dataset/ZoweDatasetNode";
import { Job } from "../../src/job/ZoweJobNode";
import { createUSSSessionNode, createUSSTree } from "../../__mocks__/mockCreators/uss";
import { createJobsTree, createIJobObject, createJobSessionNode } from "../../__mocks__/mockCreators/jobs";
import { DefaultProfileManager } from "../../src/profiles/DefaultProfileManager";
import { IZoweNodeType } from "../../src/api/IZoweTreeNode";
import { resetValidationSettings } from "../../src/shared/actions";

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
        mockCollectProfileDetails: jest.fn(),
        mockShowErrorMessage: jest.fn(),
        mockCreateInputBox: jest.fn(),
        mockLog: jest.fn(),
        mockDebug: jest.fn(),
        defaultProfileManagerInstance: null,
        defaultProfile: null,
        testSession: createISession(),
        mockError: jest.fn(),
        commonApi: null,
        mockGetCommonApi: jest.fn(),
        mockGetValidSession: jest.fn(),
        mockConfigurationTarget: jest.fn(),
        mockCreateBasicZosmfSession: jest.fn(),
        mockCreateBasicZosmfSessionFromArguments: jest.fn(),
        mockCliProfileManager: createProfileManager(),
        profiles: null
    };

    // Mocking Default Profile Manager
    newMocks.defaultProfileManagerInstance = await DefaultProfileManager.createInstance(Logger.getAppLogger());
    newMocks.profiles = await Profiles.createInstance(Logger.getAppLogger());
    newMocks.mockGetInstance.mockReturnValue(newMocks.profiles);
    newMocks.defaultProfile = DefaultProfileManager.getInstance().getDefaultProfile("zosmf");
    Object.defineProperty(DefaultProfileManager, "getInstance",
                          { value: jest.fn(() => newMocks.defaultProfileManagerInstance), configurable: true });
    Object.defineProperty(newMocks.defaultProfileManagerInstance, "getDefaultProfile",
                          { value: jest.fn(() => newMocks.defaultProfile), configurable: true });

    // Common API mocks
    newMocks.commonApi = ZoweExplorerApiRegister.getCommonApi(newMocks.defaultProfile);
    newMocks.mockGetCommonApi.mockReturnValue(newMocks.commonApi);
    newMocks.mockGetValidSession.mockReturnValue(newMocks.testSession);
    ZoweExplorerApiRegister.getCommonApi = newMocks.mockGetCommonApi.bind(ZoweExplorerApiRegister);

    Object.defineProperty(newMocks.commonApi, "getValidSession", { value: newMocks.mockGetValidSession, configurable: true });
    Object.defineProperty(vscode.window, "showInformationMessage", { value: newMocks.mockShowInformationMessage, configurable: true });
    Object.defineProperty(vscode.window, "showInputBox", { value: newMocks.mockShowInputBox, configurable: true });
    Object.defineProperty(vscode.window, "showErrorMessage", { value: newMocks.mockShowErrorMessage, configurable: true });
    Object.defineProperty(vscode.window, "showQuickPick", { value: newMocks.mockShowQuickPick, configurable: true });
    Object.defineProperty(vscode.window, "createQuickPick", { value: newMocks.mockCreateQuickPick, configurable: true });
    Object.defineProperty(Profiles, "getInstance", { value: newMocks.mockGetInstance, configurable: true });
    Object.defineProperty(newMocks.mockGetInstance, "collectProfileDetails", { value: newMocks.mockCollectProfileDetails, configurable: true });
    Object.defineProperty(globals, "LOG", { value: newMocks.mockLog, configurable: true });
    Object.defineProperty(vscode.window, "createInputBox", { value: newMocks.mockCreateInputBox, configurable: true });
    Object.defineProperty(globals.LOG, "debug", { value: newMocks.mockDebug, configurable: true });
    Object.defineProperty(ZosmfSession, "createBasicZosmfSessionFromArguments",
                                        { value: newMocks.mockCreateBasicZosmfSessionFromArguments, configurable: true });
    Object.defineProperty(ZosmfSession, "createBasicZosmfSession",
                                        { value: newMocks.mockCreateBasicZosmfSessionFromArguments, configurable: true });
    Object.defineProperty(globals.LOG, "error", { value: newMocks.mockError, configurable: true });
    Object.defineProperty(globals, "ISTHEIA", { get: () => false, configurable: true });
    Object.defineProperty(vscode.window, "createTreeView", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.workspace, "getConfiguration", { value: newMocks.mockGetConfiguration, configurable: true });
    Object.defineProperty(vscode, "ConfigurationTarget", { value: newMocks.mockConfigurationTarget, configurable: true });

    return newMocks;
}

describe("Profiles Unit Tests - Function createZoweSession", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            session: createISessionWithoutCredentials(),
            treeView: createTreeView(),
            mockLoadNamedProfile: jest.fn(),
            imperativeProfile: createIProfile(),
            datasetSessionNode: null,
            quickPickItem: createQuickPickItem(),
            qpPlaceholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
            testDatasetTree: null,
            profileInstance: null,
        };

        newMocks.profileInstance = createInstanceOfProfile(globalMocks.profiles, newMocks.session);
        newMocks.datasetSessionNode = createDatasetSessionNode(newMocks.session, newMocks.imperativeProfile);
        newMocks.testDatasetTree = createDatasetTree(newMocks.datasetSessionNode, newMocks.treeView);
        newMocks.mockLoadNamedProfile.mockReturnValue(newMocks.imperativeProfile);
        newMocks.profileInstance.loadNamedProfile = newMocks.mockLoadNamedProfile;
        globalMocks.mockGetInstance.mockReturnValue(newMocks.profileInstance);

        return newMocks;
    }

    it("Tests that createZoweSession fails if profile name is invalid", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const entered = undefined;
        globalMocks.mockShowInputBox.mockResolvedValueOnce(entered);

        // Assert edge condition user cancels the input path box
        globalMocks.mockCreateQuickPick.mockReturnValue(createQuickPickContent(entered, [blockMocks.quickPickItem], blockMocks.qpPlaceholder));
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(blockMocks.quickPickItem);

        await Profiles.getInstance().loadNamedProfile("profile1");
        await globalMocks.profiles.createZoweSession(blockMocks.testDatasetTree);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toEqual("Profile Name was not supplied. Operation Cancelled");
    });

    it("Tests that createZoweSession successfully creates a new session with profile name supplied by user", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const entered = undefined;
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");

        // Assert edge condition user cancels the input path box
        globalMocks.mockCreateQuickPick.mockReturnValue(createQuickPickContent(entered, [blockMocks.quickPickItem], blockMocks.qpPlaceholder));
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(blockMocks.quickPickItem);

        await globalMocks.profiles.createZoweSession(blockMocks.testDatasetTree);
        expect(blockMocks.testDatasetTree.addSession).toBeCalled();
        expect(blockMocks.testDatasetTree.addSession.mock.calls[0][0]).toEqual({ newprofile: "fake" });
    });

    it("Tests that createZoweSession successfully creates a new session with profile name selected from list by user", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const entered = "";

        // Assert edge condition user cancels the input path box
        const quickPickContent = createQuickPickContent(entered, [blockMocks.quickPickItem], blockMocks.qpPlaceholder);
        quickPickContent.label = "firstName";
        globalMocks.mockCreateQuickPick.mockReturnValue(quickPickContent);
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(quickPickContent);

        await globalMocks.profiles.createZoweSession(blockMocks.testDatasetTree);
        expect(blockMocks.testDatasetTree.addSession).toBeCalled();
        expect(blockMocks.testDatasetTree.addSession.mock.calls[0][0]).toBe("firstName");

    });

    it("Tests that createZoweSession successfully creates a new session with profile name selected from list by user by typing", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const entered = "fake";

        globalMocks.mockCreateQuickPick.mockReturnValue(createQuickPickContent(entered, [blockMocks.quickPickItem], blockMocks.qpPlaceholder));
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(blockMocks.quickPickItem);

        await globalMocks.profiles.createZoweSession(blockMocks.testDatasetTree);
        expect(blockMocks.testDatasetTree.addSession).not.toBeCalled();
    });

    it("Tests that createZoweSession fails if profile not selected", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const entered = "";

        // Assert edge condition user cancels the input path box
        const quickPickContent = createQuickPickContent(entered, [blockMocks.quickPickItem], blockMocks.qpPlaceholder);
        quickPickContent.label = undefined;
        globalMocks.mockCreateQuickPick.mockReturnValue(quickPickContent);
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(quickPickContent);

        await globalMocks.profiles.createZoweSession(blockMocks.testDatasetTree);
        expect(blockMocks.testDatasetTree.addSession).not.toBeCalled();
    });

    it("Tests that createZoweSession fails if createNewConnection fails", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const entered = "fake";
        blockMocks.profileInstance.createNewConnection = jest.fn().mockRejectedValue(new Error("create connection error"));
        globalMocks.mockShowInputBox.mockResolvedValueOnce(entered);

        globalMocks.mockCreateQuickPick.mockReturnValue(createQuickPickContent(entered, [blockMocks.quickPickItem], blockMocks.qpPlaceholder));
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(blockMocks.quickPickItem);
        const errorHandlingSpy = jest.spyOn(utils, "errorHandling");

        await globalMocks.profiles.createZoweSession(blockMocks.testDatasetTree);
        expect(errorHandlingSpy).toBeCalled();
        expect(errorHandlingSpy.mock.calls[0][0]).toEqual(new Error("create connection error"));
    });

    it("Testing that createZoweSession with theia", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const entered = "";
        const createZoweSessionSpy = jest.spyOn(globalMocks.profiles, "createZoweSession");
        Object.defineProperty(globals, "ISTHEIA", { get: () => true, configurable: true });
        globalMocks.mockCreateQuickPick.mockReturnValue(createQuickPickContent(entered, [blockMocks.quickPickItem], blockMocks.qpPlaceholder));
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(blockMocks.quickPickItem);

        await globalMocks.profiles.createZoweSession(blockMocks.testDatasetTree);
        expect(createZoweSessionSpy).toHaveBeenCalled();
    });

    it("Testing that createZoweSession with theia fails if no choice", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const entered = null;
        const createZoweSessionSpy = jest.spyOn(globalMocks.profiles, "createZoweSession");
        Object.defineProperty(globals, "ISTHEIA", { get: () => true, configurable: true });
        globalMocks.mockCreateQuickPick.mockReturnValue(createQuickPickContent(entered, [blockMocks.quickPickItem], blockMocks.qpPlaceholder));
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(blockMocks.quickPickItem);

        await globalMocks.profiles.createZoweSession(blockMocks.testDatasetTree);
        expect(createZoweSessionSpy).toHaveBeenCalled();
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
    });
});

describe("Profiles Unit Tests - Function createNewConnection", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            session: createISessionWithoutCredentials(),
            treeView: createTreeView(),
            mockLoadNamedProfile: jest.fn(),
            imperativeProfile: createIProfile(),
            datasetSessionNode: null,
            inputBox: createInputBox("input"),
            quickPickItem: createQuickPickItem(),
            testSchemas: createTestSchemas(),
            testDatasetTree: null,
            profileInstance: null
        };

        newMocks.imperativeProfile.name = "profile1";
        newMocks.imperativeProfile.profile.user = "fake";
        newMocks.imperativeProfile.profile.password = "1234";
        newMocks.profileInstance = createInstanceOfProfile(globalMocks.profiles, newMocks.session);
        newMocks.mockLoadNamedProfile.mockReturnValue(newMocks.imperativeProfile);
        newMocks.profileInstance.loadNamedProfile = newMocks.mockLoadNamedProfile;
        newMocks.profileInstance.getSchema.mockReturnValue(newMocks.testSchemas[0]);
        globalMocks.mockGetInstance.mockReturnValue(newMocks.profileInstance);
        globalMocks.mockCreateInputBox.mockReturnValue(newMocks.inputBox);
        newMocks.datasetSessionNode = createDatasetSessionNode(newMocks.session, newMocks.imperativeProfile);
        newMocks.testDatasetTree = createDatasetTree(newMocks.datasetSessionNode, newMocks.treeView);

        return newMocks;
    }

    it("Tests that createNewConnection fails if profileName is missing", async () => {
        const globalMocks = await createGlobalMocks();

        await globalMocks.profiles.createNewConnection("", "zosmf");
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile name was not supplied. Operation Cancelled");
    });

    it("Tests that createNewConnection fails if zOSMF URL is missing", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.mockGetInstance.mockReturnValue(await Profiles.createInstance(Logger.getAppLogger()));
        globalMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[0]); });
        globalMocks.mockShowInputBox.mockResolvedValueOnce(undefined);

        const newSession = await globalMocks.profiles.createNewConnection(blockMocks.imperativeProfile.name, "zosmf");

        expect(newSession).toBe(undefined);
    });

    it("Tests that createNewConnection fails if rejectUnauthorized is missing", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.mockGetInstance.mockReturnValue(await Profiles.createInstance(Logger.getAppLogger()));
        globalMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[0]); });
        globalMocks.mockShowInputBox.mockResolvedValueOnce("https://fake:143");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("143");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce(undefined);

        const newSession = await globalMocks.profiles.createNewConnection(blockMocks.imperativeProfile.name, "zosmf");

        expect(newSession).toBe(undefined);
    });

    it("Tests that createNewConnection fails if profileName is a duplicate", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[0]); });
        globalMocks.mockShowInputBox.mockResolvedValueOnce("https://fake:143");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("143");
        globalMocks.mockShowInputBox.mockResolvedValue("fake");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("False - Accept connections with self-signed certificates");

        await globalMocks.profiles.createNewConnection(blockMocks.imperativeProfile.name, "zosmf");
        expect(globalMocks.mockShowErrorMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowErrorMessage.mock.calls[0][0]).toBe("Profile name already exists. Please create a profile using a different name");
    });

    it("Tests that createNewConnection creates a new profile", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[0]); });
        globalMocks.mockShowInputBox.mockResolvedValueOnce("https://fake:143");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("143");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("False - Accept connections with self-signed certificates");

        await globalMocks.profiles.createNewConnection("fake", "zosmf");
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile fake was created.");
    });

    it("Tests that createNewConnection creates a new profile with optional credentials", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.mockGetInstance.mockReturnValue(await Profiles.createInstance(Logger.getAppLogger()));
        globalMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[1]); });
        globalMocks.mockShowInputBox.mockResolvedValueOnce("https://fake:143");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("True");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("False - Accept connections with self-signed certificates");
        globalMocks.mockShowInputBox.mockResolvedValue("fake");

        await globalMocks.profiles.createNewConnection("fake", "zosmf");
        // tslint:disable-next-line: no-magic-numbers
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(3);
        expect(globalMocks.mockShowInformationMessage.mock.calls[2][0]).toBe("Profile fake was created.");
    });

    it("Tests that createNewConnection creates a new profile twice in a row", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[0]); });
        globalMocks.mockShowInputBox.mockResolvedValueOnce("https://fake:143");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("143");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake1");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake1");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("False - Accept connections with self-signed certificates");

        await globalMocks.profiles.createNewConnection("fake1", "zosmf");
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile fake1 was created.");

        globalMocks.mockShowInputBox.mockReset();
        globalMocks.mockShowInformationMessage.mockReset();
        globalMocks.mockShowInputBox.mockResolvedValueOnce("https://fake:143");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("143");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake2");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake2");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("True - Reject connections with self-signed certificates");

        await globalMocks.profiles.createNewConnection("fake2", "zosmf");
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile fake2 was created.");
    });

    it("Tests that createNewConnection creates an alternate profile", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.profileInstance.getProfileType = jest.fn(() => new Promise((resolve) => { resolve("alternate"); }));
        globalMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[1]); });
        globalMocks.mockShowInputBox.mockResolvedValueOnce("https://fake:234");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("234");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("False");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("13");

        await globalMocks.profiles.createNewConnection("alternate", "zosmf");
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile alternate was created.");
    });

    it("Tests that createNewConnection creates an alternate profile with default aNumber value", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.profileInstance.getProfileType = jest.fn(() => new Promise((resolve) => { resolve("alternate"); }));
        globalMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[1]); });
        globalMocks.mockShowInputBox.mockResolvedValueOnce("https://fake:234");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("234");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("False");
        globalMocks.mockShowInputBox.mockResolvedValueOnce(undefined);

        await globalMocks.profiles.createNewConnection("alternate", "zosmf");
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile alternate was created.");
    });

    it("Tests that createNewConnection creates an alternate profile with default port value", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.profileInstance.getProfileType = jest.fn(() => new Promise((resolve) => { resolve("alternate"); }));
        globalMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[1]); });
        globalMocks.mockShowInputBox.mockResolvedValueOnce("https://fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("0");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("True");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("126");

        await globalMocks.profiles.createNewConnection("alternate", "zosmf");
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile alternate was created.");
    });

    it("Tests that createNewConnection fails to create an alternate profile if port is invalid", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.mockGetInstance.mockReturnValue(await Profiles.createInstance(Logger.getAppLogger()));
        blockMocks.profileInstance.getProfileType = jest.fn(() => new Promise((resolve) => { resolve("alternate"); }));
        globalMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[1]); });
        globalMocks.mockShowInputBox.mockResolvedValueOnce("https://fake.com");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        const errorHandlingSpy = jest.spyOn(utils, "errorHandling");

        await globalMocks.profiles.createNewConnection("fake", "zosmf");

        expect(errorHandlingSpy).toBeCalledWith(new Error("create connection error"), "fake", "create connection error");
    });

    it("Tests that createNewConnection fails to create an alternate profile if aBoolean is invalid", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.mockGetInstance.mockReturnValue(await Profiles.createInstance(Logger.getAppLogger()));
        blockMocks.profileInstance.getProfileType = jest.fn(() => new Promise((resolve) => { resolve("alternate"); }));
        globalMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[1]); });
        globalMocks.mockShowInputBox.mockResolvedValueOnce("https://fake:143");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("143");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce(undefined);

        const newSession = await globalMocks.profiles.createNewConnection("fake", "zosmf");

        expect(newSession).toBe(undefined);
    });

    it("Tests that createNewConnection creates an alternate profile with an optional port", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.profileInstance.getProfileType = jest.fn(() => new Promise((resolve) => { resolve("alternate"); }));
        globalMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[2]); });
        globalMocks.mockShowInputBox.mockResolvedValueOnce("https://fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce(null);
        globalMocks.mockShowInputBox.mockResolvedValue("fake");

        await globalMocks.profiles.createNewConnection("fake", "zosmf");
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile fake was created.");
    });
});

describe("Profiles Unit Tests - Function getProfileType", () => {
    function createBlockMocks(globalMocks) {
        const newMocks = {
            mockRegisteredApiTypes: jest.fn(() => ["zosmf"]),
            originalRegisteredApiTypes: null
        };

        newMocks.originalRegisteredApiTypes = ZoweExplorerApiRegister.getInstance().registeredApiTypes;
        ZoweExplorerApiRegister.getInstance().registeredApiTypes = newMocks.mockRegisteredApiTypes;

        return newMocks;
    }

    it("Tests that getProfileType returns correct profile type when receiving only one type", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const response = await globalMocks.profiles.getProfileType();
        expect(response).toEqual("zosmf");

        ZoweExplorerApiRegister.getInstance().registeredApiTypes = blockMocks.originalRegisteredApiTypes;
    });

    it("Tests that getProfileType returns correct profile type when receiving multiple types", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.mockRegisteredApiTypes.mockReturnValue(["zosmf", "alternate"]);
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("alternate");

        const res = await globalMocks.profiles.getProfileType();
        expect(res).toEqual("alternate");

        ZoweExplorerApiRegister.getInstance().registeredApiTypes = blockMocks.originalRegisteredApiTypes;
    });
});

describe("Profiles Unit Tests - Function getSchema", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = { testSchemas: createTestSchemas() };

        return newMocks;
    }

    it("Tests that getSchema returns correct schema for zosmf profile", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        Object.defineProperty(globalMocks.profiles, "getCliProfileManager",
            { value: jest.fn(() => Promise.resolve(globalMocks.mockCliProfileManager)) });

        const response = await globalMocks.profiles.getSchema("zosmf");
        // tslint:disable-next-line: no-magic-numbers
        expect(response).toEqual(blockMocks.testSchemas[3]);
    });
});

describe("Profiles Unit Tests - Property allProfiles", () => {
    it("Tests that allProfiles contains all profiles", async () => {
        const globalMocks = await createGlobalMocks();

        const loadedProfiles = globalMocks.profiles.allProfiles;
        expect(loadedProfiles).toEqual([ globalMocks.defaultProfile,
                                         { name: "sestest", profile: {}, type: "zosmf" },
                                         { name: "profile1", profile: {}, type: "zosmf" },
                                         { name: "profile2", profile: {}, type: "zosmf" }]);
        });
});

describe("Profiles Unit Tests - Function updateProfile", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            imperativeProfile: createIProfile(),
            changedImperativeProfile: createIProfile(),
            profileInfo: null,
            session: createISessionWithoutCredentials(),
            log: Logger.getAppLogger(),
            profiles: null,
            profileInstance: null
        };

        newMocks.profiles = await Profiles.createInstance(newMocks.log);
        newMocks.profileInstance = createInstanceOfProfile(newMocks.profiles, newMocks.session);
        newMocks.changedImperativeProfile.profile.user = "test2";
        newMocks.changedImperativeProfile.profile.password = "test2";
        newMocks.profileInfo = newMocks.changedImperativeProfile;
        Object.defineProperty(globalMocks.mockCliProfileManager, "load", {
            value: jest.fn(() => {
                return new Promise((resolve) => { resolve(newMocks.imperativeProfile); });
            }),
            configurable: true
        });
        Object.defineProperty(globalMocks.mockCliProfileManager, "update", { value: jest.fn(), configurable: true });
        newMocks.profiles.getCliProfileManager = () => Promise.resolve(globalMocks.mockCliProfileManager);

        return newMocks;
    }

    it("Tests that updateProfile successfully updates a profile of undefined type", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        blockMocks.profileInfo.type = undefined;

        await blockMocks.profiles.updateProfile(blockMocks.profileInfo);
        expect(blockMocks.imperativeProfile.profile).toEqual(blockMocks.changedImperativeProfile.profile);
    });

    it("Tests that updateProfile successfully updates a profile of defined type (zosmf)", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        await blockMocks.profiles.updateProfile(blockMocks.profileInfo);
        expect(blockMocks.imperativeProfile.profile).toEqual(blockMocks.changedImperativeProfile.profile);
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
            testSchemas: createTestSchemas(),
            profileInstance: null
        };

        newMocks.imperativeProfile.name = "profile1";
        newMocks.imperativeProfile.profile.user = "fake";
        newMocks.imperativeProfile.profile.password = "1234";
        newMocks.profileInstance = createInstanceOfProfile(globalMocks.profiles, newMocks.session);
        newMocks.mockLoadNamedProfile.mockReturnValue(newMocks.imperativeProfile);
        globalMocks.mockCreateInputBox.mockReturnValue(newMocks.inputBox);
        globalMocks.mockGetInstance.mockReturnValue(newMocks.profileInstance);
        newMocks.datasetSessionNode = createDatasetSessionNode(newMocks.session, newMocks.imperativeProfile);

        return newMocks;
    }

    it("Tests that editSession successfully edits a session of type zosmf", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("zosmf"); });
        globalMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[0]); });
        globalMocks.mockShowInputBox.mockResolvedValueOnce("https://fake:143");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("143");
        globalMocks.mockShowInputBox.mockResolvedValue("fake");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("False - Accept connections with self-signed certificates");
        globalMocks.mockCreateBasicZosmfSessionFromArguments.mockReturnValue(
            { ISession: { user: "fake", password: "fake", base64EncodedAuth: "fake" } });

        await globalMocks.profiles.editSession(blockMocks.imperativeProfile, blockMocks.imperativeProfile.name);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile was successfully updated");
    });

    it("Tests that editSession successfully edits a session of type alternate", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("alternate"); });
        globalMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[1]); });
        globalMocks.mockShowInputBox.mockResolvedValueOnce("https://fake:143");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("143");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("False");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("123");
        globalMocks.mockCreateBasicZosmfSessionFromArguments.mockReturnValue(
            { ISession: { user: "fake", password: "fake", base64EncodedAuth: "fake" } });

        await globalMocks.profiles.editSession(blockMocks.imperativeProfile, blockMocks.imperativeProfile.name);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile was successfully updated");
    });

    it("Tests that editSession successfully edits a session of type alternate with entered port number", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("alternate"); });
        globalMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[1]); });
        globalMocks.mockShowInputBox.mockResolvedValueOnce("https://fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("143");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("False");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("123");
        globalMocks.mockCreateBasicZosmfSessionFromArguments.mockReturnValue(
            { ISession: { user: "fake", password: "fake", base64EncodedAuth: "fake" } });

        await globalMocks.profiles.editSession(blockMocks.imperativeProfile, blockMocks.imperativeProfile.name);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile was successfully updated");
    });

    it("Tests that editSession successfully edits a session of type alternate with default aNumber", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("alternate"); });
        globalMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[1]); });
        globalMocks.mockShowInputBox.mockResolvedValueOnce("https://fake:143");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("143");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("False");
        globalMocks.mockShowInputBox.mockResolvedValueOnce(undefined);
        globalMocks.mockCreateBasicZosmfSessionFromArguments.mockReturnValue(
            { ISession: { user: "fake", password: "fake", base64EncodedAuth: "fake" } });

        await globalMocks.profiles.editSession(blockMocks.imperativeProfile, blockMocks.imperativeProfile.name);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile was successfully updated");
    });

    it("Tests that editSession successfully edits a session of type alternate with empty aNumber", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("alternate"); });
        globalMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[2]); });
        globalMocks.mockShowInputBox.mockResolvedValueOnce("https://fake:143");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("143");
        globalMocks.mockShowInputBox.mockResolvedValueOnce(null);
        globalMocks.mockCreateBasicZosmfSessionFromArguments.mockReturnValue(
            { ISession: { user: "fake", password: "fake", base64EncodedAuth: "fake" } });

        await globalMocks.profiles.editSession(blockMocks.imperativeProfile, blockMocks.imperativeProfile.name);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile was successfully updated");
    });

    it("Tests that editSession successfully edits a session of type alternate with empty aOther value", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("alternate"); });
        globalMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[2]); });
        globalMocks.mockShowInputBox.mockResolvedValueOnce("https://fake:143");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("123");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("");
        globalMocks.mockCreateBasicZosmfSessionFromArguments.mockReturnValue(
            { ISession: { user: "fake", password: "fake", base64EncodedAuth: "fake" } });

        await globalMocks.profiles.editSession(blockMocks.imperativeProfile, blockMocks.imperativeProfile.name);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile was successfully updated");
    });

    it("Tests that editSession fails with invalid url supplied", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.mockGetInstance.mockReturnValue(await Profiles.createInstance(Logger.getAppLogger()));
        globalMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("zosmf"); });
        globalMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[0]); });
        globalMocks.mockShowQuickPick.mockResolvedValueOnce(undefined);

        const newSession = await globalMocks.profiles.editSession(blockMocks.imperativeProfile, blockMocks.imperativeProfile.name);

        expect(newSession).toBe(null);
    });

    it("Tests that editSession fails with invalid rejectUnauthorized value supplied", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.mockGetInstance.mockReturnValue(await Profiles.createInstance(Logger.getAppLogger()));
        globalMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("zosmf"); });
        globalMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[0]); });
        globalMocks.mockShowInputBox.mockResolvedValueOnce("https://fake:143");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("143");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce(undefined);

        const newSession = await globalMocks.profiles.editSession(blockMocks.imperativeProfile, blockMocks.imperativeProfile.name);

        expect(newSession).toBe(null);
    });

    it("Tests that editSession fails with invalid aBoolean value supplied on alternate profile type", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.mockGetInstance.mockReturnValue(await Profiles.createInstance(Logger.getAppLogger()));
        globalMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("alternate"); });
        globalMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[1]); });
        globalMocks.mockShowInputBox.mockResolvedValueOnce("https://fake:143");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("143");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("fake");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce(undefined);

        const newSession = await globalMocks.profiles.editSession(blockMocks.imperativeProfile, blockMocks.imperativeProfile.name);

        expect(newSession).toBe(null);
    });

    it("Tests that editSession fails with invalid port value supplied", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.mockGetInstance.mockReturnValue(await Profiles.createInstance(Logger.getAppLogger()));
        globalMocks.profiles.getProfileType = () => new Promise((resolve) => { resolve("alternate"); });
        globalMocks.profiles.getSchema = () => new Promise((resolve) => { resolve(blockMocks.testSchemas[1]); });
        globalMocks.mockShowInputBox.mockResolvedValueOnce("https://fake");
        globalMocks.mockShowInputBox.mockResolvedValueOnce("bad");

        let error;
        try {
            await globalMocks.profiles.editSession(blockMocks.imperativeProfile, blockMocks.imperativeProfile.name);
        } catch (err) {
            error = err;
        }

        expect(error.message).toBe("Invalid Port number provided or operation was cancelled");
    });
});

describe("Profiles Unit Tests - Function deleteProfile", () => {

    async function createBlockMocks(globalMocks) {
        const newMocks = {
            log: Logger.getAppLogger(),
            profiles: null,
            testDatasetTree: null,
            testUSSTree: null,
            testJobTree: null,
            mockLoadNamedProfile: jest.fn(),
            treeView: createTreeView(),
            datasetSessionNode: null,
            USSSessionNode: null,
            iJob: createIJobObject(),
            imperativeProfile: createIProfile(),
            session: null,
            testSchemas: createTestSchemas(),
            profileInstance: null
        };

        globalMocks.mockCreateBasicZosmfSession.mockReturnValue(
            { ISession: { user: "fake", password: "fake", base64EncodedAuth: "fake" } });
        globalMocks.mockCreateBasicZosmfSessionFromArguments.mockReturnValue(
            { ISession: { user: "fake", password: "fake", base64EncodedAuth: "fake" } });
        newMocks.profiles = await Profiles.createInstance(newMocks.log);
        newMocks.session = createBasicZosmfSession(newMocks.imperativeProfile);
        newMocks.profileInstance = createInstanceOfProfile(newMocks.profiles, newMocks.session);
        newMocks.mockLoadNamedProfile.mockReturnValue(newMocks.imperativeProfile);
        globalMocks.mockGetInstance.mockReturnValue(newMocks.profileInstance);
        newMocks.datasetSessionNode = createDatasetSessionNode(newMocks.session, newMocks.imperativeProfile);
        newMocks.USSSessionNode = createUSSSessionNode(newMocks.session, newMocks.imperativeProfile);
        newMocks.testDatasetTree = createDatasetTree(newMocks.datasetSessionNode, newMocks.treeView);
        newMocks.testUSSTree = createUSSTree([], [newMocks.USSSessionNode], newMocks.treeView);
        newMocks.testJobTree = createJobsTree(newMocks.session, newMocks.iJob, newMocks.profileInstance, newMocks.treeView);
        newMocks.testDatasetTree.addFileHistory("[profile1]: TEST.NODE");
        newMocks.testUSSTree.addFileHistory("[profile1]: /u/myuser");
        globalMocks.mockGetConfiguration.mockReturnValue(createPersistentConfig());

        return newMocks;
    }

    it("Tests that deleteProfile successfully deletes a profile from the command palette", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.mockShowQuickPick.mockResolvedValueOnce("profile1");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("Delete");

        await blockMocks.profiles.deleteProfile(blockMocks.testDatasetTree, blockMocks.testUSSTree, blockMocks.testJobTree);
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile profile1 was deleted.");
    });

    it("Tests that deleteProfile successfully handles missing profile name selection", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.mockShowQuickPick.mockResolvedValueOnce(undefined);

        await blockMocks.profiles.deleteProfile(blockMocks.testDatasetTree, blockMocks.testUSSTree, blockMocks.testJobTree);
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
    });

    it("Tests that deleteProfile successfully handles case where user selects No", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.mockShowQuickPick.mockResolvedValueOnce("profile1");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("No");

        await blockMocks.profiles.deleteProfile(blockMocks.testDatasetTree, blockMocks.testUSSTree, blockMocks.testJobTree);
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Operation Cancelled");
    });

    it("Tests that deleteProfile successfully executes when there are no profiles to delete", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.profiles.allProfiles = [];

        await blockMocks.profiles.deleteProfile(blockMocks.testDatasetTree, blockMocks.testUSSTree, blockMocks.testJobTree);
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("No profiles available");
    });

    it("Tests that deleteProfile successfully deletes profile from context menu", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const dsNode = new ZoweDatasetNode(
            "testNode", vscode.TreeItemCollapsibleState.Expanded, null, blockMocks.session, undefined, undefined, blockMocks.imperativeProfile);
        dsNode.contextValue = globals.DS_SESSION_CONTEXT;
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("Delete");

        await blockMocks.profiles.deleteProfile(blockMocks.testDatasetTree, blockMocks.testUSSTree, blockMocks.testJobTree, dsNode);
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile sestest was deleted.");
    });

    it("Tests that deleteProfile successfully deletes a profile from a dataset tree", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const dsNode = new ZoweDatasetNode(
            "testNode", vscode.TreeItemCollapsibleState.Expanded, null, blockMocks.session, undefined, undefined, blockMocks.imperativeProfile);
        const dsNodeAsFavorite = new ZoweDatasetNode(`[${blockMocks.datasetSessionNode.label.trim()}]: testNode`,
            vscode.TreeItemCollapsibleState.None, blockMocks.testDatasetTree.mFavoriteSession, blockMocks.session,
            dsNode.contextValue, null, dsNode.getProfile());
        dsNode.contextValue = globals.DS_SESSION_CONTEXT;
        blockMocks.testDatasetTree.mSessionNodes.push(dsNode);
        blockMocks.testDatasetTree.addFavorite(dsNodeAsFavorite);
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("Delete");
        const startLength = blockMocks.testDatasetTree.mSessionNodes.length;
        const favoriteLength = blockMocks.testDatasetTree.mFavorites.length;

        await blockMocks.profiles.deleteProfile(blockMocks.testDatasetTree, blockMocks.testUSSTree, blockMocks.testJobTree, dsNode);
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile sestest was deleted.");
        expect(blockMocks.testDatasetTree.mSessionNodes.length).toEqual(startLength - 1);
        expect(blockMocks.testDatasetTree.mFavorites.length).toEqual(favoriteLength);
    });

    it("Tests that deleteProfile successfully deletes a profile from a USS tree", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const startLength = blockMocks.testUSSTree.mSessionNodes.length;
        const favoriteLength = blockMocks.testUSSTree.mFavorites.length;
        // Set up session node in USS
        const ussNode = new ZoweUSSNode(
            "testNode", vscode.TreeItemCollapsibleState.Expanded,
            null, blockMocks.session, null, false, blockMocks.imperativeProfile.name, null, blockMocks.imperativeProfile);
        ussNode.contextValue = globals.USS_SESSION_CONTEXT;
        ussNode.profile = blockMocks.imperativeProfile;
        blockMocks.testUSSTree.mSessionNodes.push(ussNode);
        // Set up favorites
        const favProfileNode = new ZoweUSSNode("sestest", vscode.TreeItemCollapsibleState.Collapsed,
            null, null, null);
        favProfileNode.contextValue = globals.FAV_PROFILE_CONTEXT;
        const ussNodeAsFavorite = new ZoweUSSNode("testNode", vscode.TreeItemCollapsibleState.None,
            favProfileNode, blockMocks.session, null, false, blockMocks.imperativeProfile.name, null, blockMocks.imperativeProfile);
        favProfileNode.children.push(ussNodeAsFavorite);
        blockMocks.testUSSTree.mFavorites.push(favProfileNode);
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("Delete");

        await blockMocks.profiles.deleteProfile(blockMocks.testDatasetTree, blockMocks.testUSSTree, blockMocks.testJobTree, ussNode);
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile sestest was deleted.");
        expect(blockMocks.testUSSTree.mSessionNodes.length).toEqual(startLength);
        expect(blockMocks.testUSSTree.mFavorites.length).toEqual(favoriteLength);
    });

    it("Tests that deleteProfile successfully deletes a profile from a jobs tree", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const startLength = blockMocks.testJobTree.mSessionNodes.length;
        const favoriteLength = blockMocks.testJobTree.mFavorites.length;
        // Set up job node
        const jobNode = new Job("sestest", vscode.TreeItemCollapsibleState.Expanded, null,
            blockMocks.session, blockMocks.iJob, blockMocks.imperativeProfile);
        jobNode.contextValue = globals.JOBS_SESSION_CONTEXT;
        blockMocks.testJobTree.mSessionNodes.push(jobNode);
        // Set up jobNode in Favorites
        const favedJobNode = jobNode;
        favedJobNode.contextValue = jobNode.contextValue + globals.FAV_SUFFIX;
        const jobProfileNodeInFavs = new Job(`sestest`, vscode.TreeItemCollapsibleState.Expanded, blockMocks.testJobTree.mFavoriteSession,
            blockMocks.session, null, blockMocks.imperativeProfile);
        jobProfileNodeInFavs.contextValue = globals.FAV_PROFILE_CONTEXT;
        jobProfileNodeInFavs.children.push(favedJobNode);
        blockMocks.testJobTree.mFavorites.push(jobProfileNodeInFavs);
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("Delete");

        await blockMocks.profiles.deleteProfile(blockMocks.testDatasetTree, blockMocks.testUSSTree, blockMocks.testJobTree, jobNode);

        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile sestest was deleted.");
        expect(blockMocks.testJobTree.mSessionNodes.length).toEqual(startLength);
        expect(blockMocks.testJobTree.mFavorites.length).toEqual(favoriteLength);
    });

    it("Tests that deleteProfile successfully deletes all related file history items for a dataset tree", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.testDatasetTree.mFileHistory = ["[SESTEST]: TEST.DATA"];
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("sestest");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("Delete");

        await blockMocks.profiles.deleteProfile(blockMocks.testDatasetTree, blockMocks.testUSSTree, blockMocks.testJobTree);
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile sestest was deleted.");
        expect(blockMocks.testDatasetTree.getFileHistory()[0]).toBeUndefined();
    });

    it("Tests that deleteProfile successfully deletes all related file history items for a USS tree", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.testUSSTree.addFileHistory("[SESTEST]: /node1/node2/node3.txt");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("sestest");
        globalMocks.mockShowQuickPick.mockResolvedValueOnce("Delete");

        await blockMocks.profiles.deleteProfile(blockMocks.testDatasetTree, blockMocks.testUSSTree, blockMocks.testJobTree);
        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe("Profile sestest was deleted.");
        expect(blockMocks.testUSSTree.getFileHistory()[1]).toBeUndefined();
    });
});

describe("Profiles Unit Tests - Function createInstance", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            log: Logger.getAppLogger(),
            profiles: null,
            session: createISessionWithoutCredentials(),
            mockJSONParse: jest.spyOn(JSON, "parse"),
            profileInstance: null,
            mockIProfile: createValidIProfile(),
            testProfiles: null
        };

        newMocks.testProfiles = [{ name: "base", profile: newMocks.mockIProfile.profile, type: "base" },
                                 { name: "sestest", profile: newMocks.mockIProfile.profile, type: "zosmf" },
                                 { name: "profile1", profile: newMocks.mockIProfile.profile, type: "zosmf" },
                                 { name: "profile2", profile: newMocks.mockIProfile.profile, type: "zosmf" }];
        (child_process.spawnSync as any) = jest.fn((program: string, args: string[], options: any) => {
            const createFakeChildProcess = (status: number, stdout: string, stderr: string) => {
                return {
                    status: 0,
                    stdout,
                    stderr
                };
            };
            if (args[0].indexOf("getAllProfiles") >= 0) {
                return createFakeChildProcess(0, JSON.stringify(newMocks.testProfiles), "");
            } else {
                // load default profile
                return createFakeChildProcess(0, JSON.stringify(newMocks.testProfiles[0]), "");
            }
        });
        newMocks.profileInstance = createInstanceOfProfile(newMocks.mockIProfile, newMocks.session);
        globalMocks.mockGetInstance.mockReturnValue(newMocks.profileInstance);

        return newMocks;
    }

    it("Tests that createInstance executes successfully", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const profiles = await Profiles.createInstance(blockMocks.log);
        expect(profiles).toStrictEqual(globalMocks.profiles);
    });

    it("Tests that createInstance successfully routes through to spawn", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.mockJSONParse.mockReturnValueOnce({
            overrides: { CredentialManager: "ANO" }

        });
        blockMocks.mockJSONParse.mockReturnValueOnce(blockMocks.testProfiles);
        blockMocks.mockJSONParse.mockReturnValueOnce(blockMocks.testProfiles[1]);

        await Profiles.createInstance(blockMocks.log);
        expect(Profiles.getInstance().allProfiles).toEqual(blockMocks.testProfiles);
    });

    it("Tests that createInstance properly handles errors when failing to route through to spawn", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        blockMocks.mockJSONParse.mockReturnValueOnce({
            overrides: undefined
        });
        blockMocks.mockJSONParse.mockReturnValueOnce(blockMocks.testProfiles);
        blockMocks.mockJSONParse.mockReturnValueOnce(blockMocks.testProfiles[1]);

        await Profiles.createInstance(blockMocks.log);
        expect(Profiles.getInstance().allProfiles).toEqual(blockMocks.testProfiles);
    });
});

describe("Profiles Unit Tests - Function getProfiles", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            log: Logger.getAppLogger(),
            profiles: null,
            session: createISessionWithoutCredentials(),
            profileInstance: null
        };

        newMocks.profiles = await Profiles.createInstance(newMocks.log);
        newMocks.profileInstance = createInstanceOfProfile(newMocks.profiles, newMocks.session);
        globalMocks.mockGetInstance.mockReturnValue(newMocks.profiles);

        return newMocks;
    }

    it("Tests that getProfiles returns all profiles of the specified type", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const profiles = await Profiles.createInstance(blockMocks.log);
        const loadedProfiles = profiles.getProfiles("zosmf");
        expect(loadedProfiles).toEqual([{ name: "sestest", profile: {}, type: "zosmf" },
        { name: "profile1", profile: {}, type: "zosmf" },
        { name: "profile2", profile: {}, type: "zosmf" }]);
    });
});

describe("Profiles Unit Tests - Function directLoad", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            log: Logger.getAppLogger(),
            profiles: null,
            session: createISessionWithoutCredentials(),
            profileInstance: null
        };

        newMocks.profiles = await Profiles.createInstance(newMocks.log);
        newMocks.profileInstance = createInstanceOfProfile(newMocks.profiles, newMocks.session);
        globalMocks.mockGetInstance.mockReturnValue(newMocks.profiles);

        return newMocks;
    }

    it("Tests that directLoad returns the specified profile", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const theProfiles = await Profiles.createInstance(blockMocks.log);
        const profile = await theProfiles.directLoad("zosmf", "sestest");
        expect(profile.name).toEqual("sestest");
    });
});

describe("Profiles Unit Tests - Function getNamesForType", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            log: Logger.getAppLogger(),
            profiles: null,
            session: createISessionWithoutCredentials(),
            profileInstance: null
        };

        newMocks.profiles = await Profiles.createInstance(newMocks.log);
        newMocks.profileInstance = createInstanceOfProfile(newMocks.profiles, newMocks.session);
        globalMocks.mockGetInstance.mockReturnValue(newMocks.profiles);

        return newMocks;
    }

    it("Tests that getNamesForType returns all profile names for profiles of the specified type", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const theProfiles = await Profiles.createInstance(blockMocks.log);
        expect((await theProfiles.getNamesForType("zosmf"))[1]).toEqual("profile1");
    });
});

describe("Profiles Unit Tests - Function getAllTypes", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            log: Logger.getAppLogger(),
            profiles: null,
            session: createISessionWithoutCredentials(),
            profileInstance: null
        };

        newMocks.profiles = await Profiles.createInstance(newMocks.log);
        newMocks.profileInstance = createInstanceOfProfile(newMocks.profiles, newMocks.session);
        globalMocks.mockGetInstance.mockReturnValue(newMocks.profiles);

        return newMocks;
    }

    it("Tests that getAllTypes returns the names of all profile types", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const theProfiles = await Profiles.createInstance(blockMocks.log);

        const types = theProfiles.getAllTypes();
        expect(types).toEqual(["zosmf", "banana"]);
    });
});

describe("Profiles Unit Tests - Function loadNamedProfile", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            log: Logger.getAppLogger(),
            profiles: null,
            session: createISessionWithoutCredentials(),
            profileInstance: null
        };

        newMocks.profiles = await Profiles.createInstance(newMocks.log);
        newMocks.profileInstance = createInstanceOfProfile(newMocks.profiles, newMocks.session);
        globalMocks.mockGetInstance.mockReturnValue(newMocks.profiles);

        return newMocks;
    }

    it("Tests that loadNamedProfile returns the profile with the specified name", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const profiles = await Profiles.createInstance(blockMocks.log);
        const loadedProfile = profiles.loadNamedProfile("profile2");
        expect(loadedProfile).toEqual({ name: "profile2", profile: {}, type: "zosmf" });
    });

    it("Tests that loadNamedProfile fails to load a non-existent profile", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        let success = false;
        const profiles = await Profiles.createInstance(blockMocks.log);
        try {
            profiles.loadNamedProfile("profile3");
        } catch (error) {
            expect(error.message).toEqual("Could not find profile named: profile3.");
            success = true;
        }
        expect(success).toBe(true);
    });
});

describe("Profiles Unit Tests - Function checkCurrentProfile", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            log: Logger.getAppLogger(),
            profiles: null,
            session: createISessionWithoutCredentials(),
            invalidProfile: createInvalidIProfile(),
            validProfile: createValidIProfile(),
            profileInstance: null
        };

        newMocks.profiles = await Profiles.createInstance(newMocks.log);
        newMocks.profileInstance = createInstanceOfProfile(newMocks.profiles, newMocks.session);
        globalMocks.mockGetInstance.mockReturnValue(newMocks.profiles);

        return newMocks;
    }

    it("Tests that checkCurrentProfile is successful for a profile with valid stored credentials", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        Object.defineProperty(globalMocks.profiles, "validateProfiles", {
            value: jest.fn(() => {
                return {
                    status: "active",
                    name: blockMocks.invalidProfile.name,
                    session: blockMocks.session
                };
            })
        });

        await globalMocks.profiles.checkCurrentProfile(blockMocks.validProfile);
        expect(globalMocks.profiles.validProfile).toBe(ValidProfileEnum.VALID);
    });

    it("Tests that checkCurrentProfile is successful with invalid profile & valid session", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        Object.defineProperty(globalMocks.profiles, "validateProfiles", {
            value: jest.fn(() => {
                return {
                    status: "active",
                    name: blockMocks.invalidProfile.name,
                    session: blockMocks.session
                };
            })
        });

        await globalMocks.profiles.checkCurrentProfile(blockMocks.invalidProfile);
        expect(globalMocks.profiles.validProfile).toBe(ValidProfileEnum.VALID);
    });

    it("Tests that checkCurrentProfile fails with invalid profile & no valid session", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        globalMocks.mockGetValidSession.mockReturnValue(null);
        blockMocks.profiles.promptCredentials = jest.fn(() => {
            return undefined;
        });

        await globalMocks.profiles.checkCurrentProfile(blockMocks.invalidProfile);
        expect(globalMocks.profiles.validProfile).toBe(ValidProfileEnum.INVALID);
    });

    it("Tests that checkCurrentProfile will handle unverified profiles", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const theProfiles = await Profiles.createInstance(blockMocks.log);
        Object.defineProperty(theProfiles, "getProfileSetting", {
            value: jest.fn(() => {
                return {
                    status: "unverified",
                    name: blockMocks.invalidProfile.name
                };
            })
        });
        const response = await theProfiles.checkCurrentProfile(blockMocks.invalidProfile, "dataset");
        expect(response).toEqual({name: blockMocks.invalidProfile.name, status: "unverified"});
    });

    it("Tests that checkCurrentProfile will handle inactive profiles", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const theProfiles = await Profiles.createInstance(blockMocks.log);
        Object.defineProperty(theProfiles, "validateProfiles", {
            value: jest.fn(() => {
                return {
                    status: "inactive",
                    name: blockMocks.invalidProfile.name
                };
            })
        });
        blockMocks.profiles.promptCredentials = jest.fn(() => {
            return undefined;
        });
        await theProfiles.checkCurrentProfile(blockMocks.invalidProfile, "dataset");
        expect(theProfiles.validProfile).toBe(ValidProfileEnum.INVALID);
    });

    it("Tests that checkCurrentProfile marks profiles inactive which throw an error during validation", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const theProfiles = await Profiles.createInstance(blockMocks.log);
        Object.defineProperty(theProfiles, "getProfileSetting", {
            value: jest.fn(() => {
                throw new Error("test error!");
            })
        });

        const validationResult = await theProfiles.checkCurrentProfile(blockMocks.validProfile, "dataset");

        expect(validationResult).toStrictEqual({ status: "inactive", name: blockMocks.validProfile.name, session: null });
    });
});


describe("Profiles Unit Tests - Function getProfileSetting", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            log: Logger.getAppLogger(),
            profiles: null,
            imperativeProfile: createInvalidIProfile(),
            validProfile: createValidIProfile(),
            profileInstance: null,
            session: null,
            mockNode: null,
            mockDisableValidationContext: jest.fn(),
            mockLoadNamedProfile: jest.fn(),
            mockValidateProfile: jest.fn()
        };
        newMocks.profiles = await Profiles.createInstance(newMocks.log);
        newMocks.profileInstance = createInstanceOfProfile(newMocks.profiles, newMocks.session);
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    loadNamedProfile: newMocks.mockLoadNamedProfile.mockReturnValue(newMocks.imperativeProfile),
                    validateProfiles: newMocks.mockValidateProfile.mockReturnValue({ status: "active", name: "sestest" })
                };
            }),
        });
        globalMocks.mockGetInstance.mockReturnValue(newMocks.profiles);

        return newMocks;
    }

    it("Tests that getProfileSetting returns profile status for disabled profile already set in profilesForValidation", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const resultSetting = { status: "unverified", name: "sestest" };
        const theProfiles = await Profiles.createInstance(blockMocks.log);
        theProfiles.profilesValidationSetting = [{name: blockMocks.imperativeProfile.name, setting: false, type: "dataset" }];
        theProfiles.profilesForValidation = [{ status: "unverified", name: "sestest"}];

        const response = await theProfiles.getProfileSetting(blockMocks.imperativeProfile, "dataset");
        expect(response).toEqual(resultSetting);
    });

    it("Tests that getProfileSetting returns profile status for disabled profile not already set in profilesForValidation", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const resultSetting = { status: "unverified", name: "sestest" };
        const theProfiles = await Profiles.createInstance(blockMocks.log);
        theProfiles.profilesValidationSetting = [{name: blockMocks.imperativeProfile.name, setting: false, type: "dataset" }];
        theProfiles.profilesForValidation = [{ status: "inactive", name: "sestest"}];

        const response = await theProfiles.getProfileSetting(blockMocks.imperativeProfile, "dataset");
        expect(response).toEqual(resultSetting);
    });

    it("Tests that getProfileSetting returns profile status for disabled profile non existant in profilesForValidation", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const resultSetting = { status: "unverified", name: "sestest" };
        const theProfiles = await Profiles.createInstance(blockMocks.log);
        theProfiles.profilesValidationSetting = [{name: blockMocks.imperativeProfile.name, setting: false, type: "dataset" }];
        theProfiles.profilesForValidation = [];

        const response = await theProfiles.getProfileSetting(blockMocks.imperativeProfile, "dataset");
        expect(response).toEqual(resultSetting);
    });

    it("Tests that getProfileSetting returns profile status for enabled profile", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const resultSetting = { status: "inactive", name: "sestest" };
        const theProfiles = await Profiles.createInstance(blockMocks.log);
        theProfiles.profilesValidationSetting = [{name: blockMocks.imperativeProfile.name, setting: true, type: "dataset" }];

        const response = await theProfiles.getProfileSetting(blockMocks.imperativeProfile, "dataset");
        expect(response).toEqual(resultSetting);
    });
});

describe("Profiles Unit Tests - Function disableValidation", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            log: Logger.getAppLogger(),
            testDatasetTree: null,
            testUSSTree: null,
            testJobTree: null,
            treeView: createTreeView(),
            datasetSessionNode: null,
            ussSessionNode: null,
            iJob: createIJobObject(),
            profiles: null,
            imperativeProfile: createValidIProfile(),
            profileInstance: null,
            session: null,
            mockNode: null,
            mockDisableValidationContext: jest.fn(),
            mockLoadNamedProfile: jest.fn()
        };
        newMocks.session = createISession();
        newMocks.datasetSessionNode = createDatasetSessionNode(newMocks.session, newMocks.imperativeProfile);
        newMocks.mockNode = newMocks.datasetSessionNode;
        newMocks.profiles = await Profiles.createInstance(newMocks.log);
        newMocks.profileInstance = createInstanceOfProfile(newMocks.profiles, newMocks.session);
        newMocks.testDatasetTree = createDatasetTree(newMocks.datasetSessionNode, newMocks.treeView);
        newMocks.testJobTree = createJobsTree(newMocks.session, newMocks.iJob, newMocks.imperativeProfile, newMocks.treeView);
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    loadNamedProfile: newMocks.mockLoadNamedProfile.mockReturnValue(newMocks.imperativeProfile),
                    disableValidationContext: newMocks.mockDisableValidationContext.mockReturnValue(newMocks.datasetSessionNode)
                };
            }),
        });
        globalMocks.mockGetInstance.mockReturnValue(newMocks.profiles);

        return newMocks;
    }

    it("Tests that disableValidation returns correct node context", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const ussSessionNode = createUSSSessionNode(blockMocks.session, blockMocks.imperativeProfile);
        const ussTree = createUSSTree([], [ussSessionNode], blockMocks.treeView);
        const theProfiles = await Profiles.createInstance(blockMocks.log);

        // tslint:disable-next-line:max-line-length
        const response = await theProfiles.disableValidation(blockMocks.datasetSessionNode, ussTree);
        expect(response.contextValue).toContain(`${globals.VALIDATE_SUFFIX}false`);
        expect(response.contextValue).not.toContain(`${globals.VALIDATE_SUFFIX}true`);
    });

    it("Tests that disableValidation returns correct node context if already enabled", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const ussSessionNode = createUSSSessionNode(blockMocks.session, blockMocks.imperativeProfile);
        const ussTree = createUSSTree([], [ussSessionNode], blockMocks.treeView);
        const resultNode: IZoweNodeType = blockMocks.datasetSessionNode;
        resultNode.contextValue = `${globals.DS_SESSION_CONTEXT}${globals.VALIDATE_SUFFIX}true`;
        const theProfiles = await Profiles.createInstance(blockMocks.log);

        // tslint:disable-next-line:max-line-length
        const response = await theProfiles.disableValidation(resultNode, ussTree);
        expect(response.contextValue).toContain(`${globals.VALIDATE_SUFFIX}false`);
        expect(response.contextValue).not.toContain(`${globals.VALIDATE_SUFFIX}true`);
    });
});

describe("Shared Actions Unit Tests - Function resetValidationSettings", () => {
    function createBlockMocks() {
        const newMocks = {
            session: createISessionWithoutCredentials(),
            treeView: createTreeView(),
            dsNode: null,
            imperativeProfile: createValidIProfile(),
            profileInstance: null,
            datasetSessionNode: null,
            mockEnableValidationContext: jest.fn(),
            mockDisableValidationContext: jest.fn(),
            mockCheckProfileValidationSetting: jest.fn(),
            testDatasetTree: null
        };

        newMocks.profileInstance = createInstanceOfProfile(newMocks.imperativeProfile, newMocks.session);
        newMocks.dsNode = new ZoweDatasetNode("node", vscode.TreeItemCollapsibleState.Collapsed, newMocks.datasetSessionNode, null);
        newMocks.datasetSessionNode = createDatasetSessionNode(newMocks.session, newMocks.imperativeProfile);
        newMocks.testDatasetTree = createDatasetTree(newMocks.datasetSessionNode, newMocks.treeView);

        return newMocks;
    }

    it("Tests that resetValidationSettings resets contextValue to false upon global change", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks();
        const testNode: IZoweNodeType = blockMocks.datasetSessionNode;
        testNode.contextValue = `${globals.DS_SESSION_CONTEXT}${globals.VALIDATE_SUFFIX}true`;
        const mockNode: IZoweNodeType = blockMocks.datasetSessionNode;
        mockNode.contextValue = `${globals.DS_SESSION_CONTEXT}${globals.VALIDATE_SUFFIX}false`;

        const response = await resetValidationSettings(testNode, false);

        expect(response.contextValue).toContain(`${globals.VALIDATE_SUFFIX}false`);
    });

    it("Tests that resetValidationSettings resets contextValue to true upon global change", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = createBlockMocks();
        const testNode: IZoweNodeType = blockMocks.datasetSessionNode;
        testNode.contextValue = `${globals.DS_SESSION_CONTEXT}${globals.VALIDATE_SUFFIX}false`;
        const mockNode: IZoweNodeType = blockMocks.datasetSessionNode;
        mockNode.contextValue = `${globals.DS_SESSION_CONTEXT}${globals.VALIDATE_SUFFIX}true`;

        const response = await resetValidationSettings(testNode, true);

        expect(response.contextValue).toContain(`${globals.VALIDATE_SUFFIX}true`);
    });
});

describe("Profiles Unit Tests - Function enableValidation", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            log: Logger.getAppLogger(),
            testDatasetTree: null,
            testUSSTree: null,
            testJobTree: null,
            treeView: createTreeView(),
            datasetSessionNode: null,
            ussSessionNode: null,
            iJob: createIJobObject(),
            profiles: null,
            imperativeProfile: createValidIProfile(),
            profileInstance: null,
            session: createISession(),
            mockNode: null,
            mockEnableValidationContext: jest.fn(),
            mockLoadNamedProfile: jest.fn()
        };
        newMocks.datasetSessionNode = createDatasetSessionNode(newMocks.session, newMocks.imperativeProfile);
        newMocks.mockNode = newMocks.datasetSessionNode;
        newMocks.profiles = await Profiles.createInstance(newMocks.log);
        newMocks.profileInstance = createInstanceOfProfile(newMocks.profiles, newMocks.session);
        newMocks.testDatasetTree = createDatasetTree(newMocks.datasetSessionNode, newMocks.treeView);
        newMocks.testJobTree = createJobsTree(newMocks.session, newMocks.iJob, newMocks.imperativeProfile, newMocks.treeView);
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    loadNamedProfile: newMocks.mockLoadNamedProfile.mockReturnValue(newMocks.imperativeProfile),
                    enableValidationContext: newMocks.mockEnableValidationContext.mockReturnValue(newMocks.datasetSessionNode)
                };
            }),
        });
        globalMocks.mockGetInstance.mockReturnValue(newMocks.profiles);

        return newMocks;
    }

    it("Tests that enableValidation returns correct node context", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const ussSessionNode = createUSSSessionNode(blockMocks.session, blockMocks.imperativeProfile);
        const ussTree = createUSSTree([], [ussSessionNode], blockMocks.treeView);
        const resultNode: IZoweNodeType = blockMocks.datasetSessionNode;
        resultNode.contextValue = `${globals.DS_SESSION_CONTEXT}${globals.VALIDATE_SUFFIX}false`;
        const theProfiles = await Profiles.createInstance(blockMocks.log);

        // tslint:disable-next-line:max-line-length
        const response = await theProfiles.enableValidation(resultNode, ussTree);
        expect(response.contextValue).toContain(`${globals.VALIDATE_SUFFIX}true`);
        expect(response.contextValue).not.toContain(`${globals.VALIDATE_SUFFIX}false`);
    });
});


describe("Profiles Unit Tests - Function disableValidationContext", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            log: Logger.getAppLogger(),
            profiles: null,
            imperativeProfile: createIProfile(),
            profileInstance: null,
            session: createISession(),
            datasetSessionNode: null,
            mockNode: null,
            mockDisableValidationContext: jest.fn(),
        };
        newMocks.mockNode = newMocks.datasetSessionNode;
        newMocks.datasetSessionNode = createDatasetSessionNode(newMocks.session, newMocks.imperativeProfile);
        newMocks.profiles = await Profiles.createInstance(newMocks.log);
        newMocks.profileInstance = createInstanceOfProfile(newMocks.profiles, newMocks.session);
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    disableValidationContext: newMocks.mockDisableValidationContext.mockReturnValue(newMocks.mockNode)
                };
            }),
        });
        globalMocks.mockGetInstance.mockReturnValue(newMocks.profiles);

        return newMocks;
    }

    it("Tests that disableValidationContext returns correct node context if it is enabled", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const theProfiles = await Profiles.createInstance(blockMocks.log);
        const resultNode: IZoweNodeType = blockMocks.datasetSessionNode;
        resultNode.contextValue = `${globals.DS_SESSION_CONTEXT}${globals.VALIDATE_SUFFIX}true`;
        const result = await theProfiles.disableValidationContext(resultNode);
        expect(result.contextValue).toContain(`${globals.VALIDATE_SUFFIX}false`);
    });

    it("Tests that disableValidationContext returns correct node context if validation context isn't set", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const theProfiles = await Profiles.createInstance(blockMocks.log);
        const resultNode: IZoweNodeType = blockMocks.datasetSessionNode;
        resultNode.contextValue = `${globals.DS_SESSION_CONTEXT}`;
        const result = await theProfiles.disableValidationContext(resultNode);
        expect(result.contextValue).toContain(`${globals.VALIDATE_SUFFIX}false`);
    });

    it("Tests that disableValidationContext returns correct node context if it is already disabled", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const theProfiles = await Profiles.createInstance(blockMocks.log);
        const resultNode: IZoweNodeType = blockMocks.datasetSessionNode;
        resultNode.contextValue = `${globals.DS_SESSION_CONTEXT}${globals.VALIDATE_SUFFIX}false`;
        const result = await theProfiles.disableValidationContext(resultNode);
        expect(result.contextValue).toContain(`${globals.VALIDATE_SUFFIX}false`);
    });
});

describe("Profiles Unit Tests - Function enableValidationContext", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            log: Logger.getAppLogger(),
            profiles: null,
            imperativeProfile: createIProfile(),
            profileInstance: null,
            session: createISession(),
            datasetSessionNode: null,
            mockNode: null,
            mockEnableValidationContext: jest.fn(),
        };
        newMocks.mockNode = newMocks.datasetSessionNode;
        newMocks.datasetSessionNode = createDatasetSessionNode(newMocks.session, newMocks.imperativeProfile);
        newMocks.profiles = await Profiles.createInstance(newMocks.log);
        newMocks.profileInstance = createInstanceOfProfile(newMocks.profiles, newMocks.session);
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    enableValidationContext: newMocks.mockEnableValidationContext.mockReturnValue(newMocks.mockNode)
                };
            }),
        });
        globalMocks.mockGetInstance.mockReturnValue(newMocks.profiles);

        return newMocks;
    }

    it("Tests that enableValidationContext returns correct node context if it is disabled", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const theProfiles = await Profiles.createInstance(blockMocks.log);
        const resultNode: IZoweNodeType = blockMocks.datasetSessionNode;
        resultNode.contextValue = `${globals.DS_SESSION_CONTEXT}${globals.VALIDATE_SUFFIX}false`;
        const result = await theProfiles.enableValidationContext(resultNode);
        expect(result.contextValue).toContain(`${globals.VALIDATE_SUFFIX}true`);
    });

    it("Tests that enableValidationContext returns correct node context if it is already enabled", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const theProfiles = await Profiles.createInstance(blockMocks.log);
        const resultNode: IZoweNodeType = blockMocks.datasetSessionNode;
        resultNode.contextValue = `${globals.DS_SESSION_CONTEXT}${globals.VALIDATE_SUFFIX}true`;
        const result = await theProfiles.enableValidationContext(resultNode);
        expect(result.contextValue).toContain(`${globals.VALIDATE_SUFFIX}true`);
    });

    it("Tests that enableValidationContext returns correct node context if validation context isn't set", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const theProfiles = await Profiles.createInstance(blockMocks.log);
        const resultNode: IZoweNodeType = blockMocks.datasetSessionNode;
        resultNode.contextValue = `${globals.DS_SESSION_CONTEXT}`;
        const result = await theProfiles.enableValidationContext(resultNode);
        expect(result.contextValue).toContain(`${globals.VALIDATE_SUFFIX}true`);
    });
});

describe("Profiles Unit Tests - Function validationArraySetup", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            log: Logger.getAppLogger(),
            profiles: null,
            imperativeProfile: createIProfile(),
            validProfile: createValidIProfile(),
            profileInstance: null,
            session: createISession(),
            datasetSessionNode: null,
            mockNode: null,
            mockEnableValidationContext: jest.fn(),
        };
        newMocks.datasetSessionNode = createDatasetSessionNode(newMocks.session, newMocks.imperativeProfile);
        newMocks.mockNode = newMocks.datasetSessionNode;
        newMocks.profiles = await Profiles.createInstance(newMocks.log);
        newMocks.profileInstance = createInstanceOfProfile(newMocks.profiles, newMocks.session);
        Object.defineProperty(Profiles, "getInstance", {
            value: jest.fn(() => {
                return {
                    enableValidationContext: newMocks.mockEnableValidationContext.mockReturnValue(newMocks.mockNode)
                };
            }),
        });
        globalMocks.mockGetInstance.mockReturnValue(newMocks.profiles);

        return newMocks;
    }

    it("Tests that validationArraySetup returns profileSetting if same setting is passed", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const returnedSetting = {
            name: blockMocks.imperativeProfile.name,
            setting: false,
            type: "dataset"
        };

        const theProfiles = await Profiles.createInstance(blockMocks.log);
        theProfiles.profilesValidationSetting = [{name: blockMocks.imperativeProfile.name, setting: false, type: "uss" }];

        const response = await theProfiles.validationArraySetup(blockMocks.imperativeProfile, false, blockMocks.mockNode);
        expect(response).toEqual(returnedSetting);
    });

    it("Tests that validationArraySetup returns profileSetting and updates profilesValidationSetting if different setting is passed", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const returnedSetting = {
            name: blockMocks.imperativeProfile.name,
            setting: false,
            type: "dataset"
        };

        const theProfiles = await Profiles.createInstance(blockMocks.log);
        theProfiles.profilesValidationSetting = [{name: blockMocks.imperativeProfile.name, setting: true, type: "dataset" }];

        const response = await theProfiles.validationArraySetup(blockMocks.imperativeProfile, false, blockMocks.mockNode);
        expect(response).toEqual(returnedSetting);
        expect(theProfiles.profilesValidationSetting).toEqual([{name: blockMocks.imperativeProfile.name, setting: false, type: "dataset"}]);
    });

    it("Tests that validationArraySetup returns profileSetting and updates profilesValidationSetting when array empty", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const returnedSetting = {
            name: blockMocks.imperativeProfile.name,
            setting: false,
            type: "dataset"
        };

        const theProfiles = await Profiles.createInstance(blockMocks.log);
        theProfiles.profilesValidationSetting = [];

        const response = await theProfiles.validationArraySetup(blockMocks.imperativeProfile, false, blockMocks.mockNode);
        expect(response).toEqual(returnedSetting);
        expect(theProfiles.profilesValidationSetting).toEqual([{name: blockMocks.imperativeProfile.name, setting: false, type: "dataset"}]);
    });

    it("Tests that validationArraySetup returns profileSetting and updates profilesValidationSetting when profile name not found", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        blockMocks.validProfile.name = "test2";
        const returnedSetting = {
            name: blockMocks.validProfile.name,
            setting: false,
            type: "dataset"
        };

        const theProfiles = await Profiles.createInstance(blockMocks.log);
        theProfiles.profilesValidationSetting = [{name: blockMocks.imperativeProfile.name, setting: true, type: "uss" }];

        const response = await theProfiles.validationArraySetup(blockMocks.validProfile, false, blockMocks.mockNode);
        expect(response).toEqual(returnedSetting);
        expect(theProfiles.profilesValidationSetting).toEqual([{name: blockMocks.imperativeProfile.name, setting: true, type: "uss"},
            {name: blockMocks.validProfile.name, setting: false, type: "dataset"}]);
    });
});

describe("Profiles Unit Tests - Function validateProfiles", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            log: Logger.getAppLogger(),
            profiles: null,
            session: createISession(),
            invalidProfile: createInvalidIProfile(),
            validProfile: createValidIProfile(),
            profileInstance: null,
        };
        newMocks.profiles = await Profiles.createInstance(newMocks.log);
        newMocks.profileInstance = createInstanceOfProfile(newMocks.profiles, newMocks.session);
        globalMocks.mockGetInstance.mockReturnValue(newMocks.profiles);

        return newMocks;
    }

    it("Tests that validateProfiles handles inactive profiles", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const theProfiles = await Profiles.createInstance(blockMocks.log);
        Object.defineProperty(CheckStatus, "getZosmfInfo", {
            value: jest.fn(() => {
                return undefined;
            })
        });

        await theProfiles.checkCurrentProfile(blockMocks.validProfile, "dataset");
        expect(theProfiles.validProfile).toBe(ValidProfileEnum.INVALID);
    });
});

describe("Profiles Unit Tests - Function refresh", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            log: Logger.getAppLogger(),
            profiles: null,
            invalidProfile: createInvalidIProfile(),
            validProfile: createValidIProfile(),
            profileInstance: null,
        };

        newMocks.profiles = await Profiles.createInstance(newMocks.log);
        newMocks.profileInstance = createInstanceOfProfile(newMocks.profiles, createBasicZosmfSession(newMocks.validProfile));
        globalMocks.mockGetInstance.mockReturnValue(newMocks.profiles);

        return newMocks;
    }

    it("Tests that Profile refresh empties profilesForValidation[]", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const theProfiles = await Profiles.createInstance(blockMocks.log);
        theProfiles.profilesForValidation.push({ status: "active", name: blockMocks.validProfile.name });
        await theProfiles.refresh();
        expect(theProfiles.profilesForValidation.length).toBe(0);
    });
});

describe("Profiles Unit Tests - Function refreshTree", () => {
    async function createBlockMocks() {
        const newMocks = {
            datasetSessionNode: null,
            ussSessionNode: null,
            jobSessionNode: null,
            mockIProfile: createValidIProfile(),
            mockProfileInstance: null,
            mockDefaultProfileManagerInstance: null,
            session: null,
        };

        // Mock the Default Profile Manager
        newMocks.mockDefaultProfileManagerInstance = await DefaultProfileManager.createInstance(Logger.getAppLogger());
        Object.defineProperty(DefaultProfileManager, "getInstance",
                              { value: jest.fn(() => newMocks.mockDefaultProfileManagerInstance), configurable: true });
        Object.defineProperty(newMocks.mockDefaultProfileManagerInstance, "getDefaultProfile",
                              { value: jest.fn(() => newMocks.mockIProfile), configurable: true });

        // Use a real Profiles instance because we are running tests on a Profiles instance function
        newMocks.session = createISession();
        const mockProfileInstance = await Profiles.createInstance(Logger.getAppLogger());
        Object.defineProperty(mockProfileInstance, "getProfiles", { value: jest.fn().mockReturnValue([newMocks.mockIProfile]),
                                                                    configurable: true});

        // Create the test nodes
        newMocks.datasetSessionNode = createDatasetSessionNode(newMocks.session, newMocks.mockIProfile);
        newMocks.ussSessionNode = createUSSSessionNode(newMocks.session, newMocks.mockIProfile);
        newMocks.jobSessionNode = createJobSessionNode(newMocks.session, newMocks.mockIProfile);

        return newMocks;
    }

    it("Tests that disableValidation returns correct node context", async () => {
        // const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks();

        // Necessary change for testing setSession
        blockMocks.mockIProfile.profile.user = "newName";

        await Profiles.getInstance().refreshTree(blockMocks.datasetSessionNode);

        // Check that setProfile ran
        expect(blockMocks.datasetSessionNode.profile.profile).toEqual(blockMocks.mockIProfile.profile);

        // Check that setSession ran
        expect(blockMocks.datasetSessionNode.session.ISession.user).toEqual(blockMocks.mockIProfile.profile.user);

        // Check that node collapsible state is set (last line)
        expect(blockMocks.datasetSessionNode.collapsibleState).toEqual(vscode.TreeItemCollapsibleState.Collapsed);
    });
});
