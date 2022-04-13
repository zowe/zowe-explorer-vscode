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
import { createProfileManager, createTestSchemas } from "../../__mocks__/mockCreators/profiles";
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
        mockProfileInstance: null,
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
        mockProfilesCache: null,
    };

    newMocks.mockProfilesCache = new ProfilesCache(Logger.getAppLogger());
    newMocks.mockProfileInstance = createInstanceOfProfile(newMocks.testProfile);
    newMocks.mockGetInstance.mockReturnValue(newMocks.mockProfileInstance);
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
    Object.defineProperty(Profiles, "getInstance", {
        value: () => newMocks.mockProfileInstance,
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
    Object.defineProperty(globals, "PROFILESCACHE", { value: createInstanceOfProfilesCache(), configurable: true });
    Object.defineProperty(globals.PROFILESCACHE, "getProfileInfo", {
        value: jest.fn().mockReturnValue(createInstanceOfProfileInfo()),
        configurable: true,
    });
    Object.defineProperty(ProfilesCache, "getProfileInfo", {
        value: jest.fn(() => Promise.resolve(createInstanceOfProfileInfo())),
        configurable: true,
    });

    return newMocks;
}

describe("test that I am getting Profiles.getInstance from mock", () => {
    it("should return createInstanceOfProfile", async () => {
        const globalMocks = await createGlobalMocks();
        // tslint:disable-next-line:no-console
        console.log(globalMocks.mockProfileInstance.getProfileInfo().getAllProfiles());
        // tslint:disable-next-line:no-console
        console.log(globalMocks.mockProfileInstance.allProfiles);
        expect(Profiles.getInstance().allProfiles).toEqual([
            { name: "sestest" },
            { name: "profile1" },
            { name: "profile2" },
        ]);
    });
});

describe("Profiles Unit Tests - Function ssoLogin", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            log: Logger.getAppLogger(),
            testDatasetTree: null,
            testUSSTree: null,
            testJobTree: null,
            treeView: createTreeView(),
            datasetSessionNode: null,
            optionalCredNode: null,
            datasetSessionNodeToken: null,
            ussSessionNode: null,
            iJob: createIJobObject(),
            profiles: null,
            imperativeProfile: createValidIProfile(),
            session: null,
            mockNode: null,
            mockEnableValidationContext: jest.fn(),
            mockLoadNamedProfile: jest.fn(),
            testBaseProfile: createValidIProfile(),
            testCombinedSession: createISession(),
            testCombinedProfile: createValidIProfile(),
            testOptionalProfile: createValidIProfile(),
            datasetSessionNodeAltToken: null,
            testAltTypeProfile: createAltTypeIProfile(),
            testAltSession: createISession(),
        };
        newMocks.testBaseProfile.profile.tokenType = "testTokenType";
        newMocks.testBaseProfile.profile.tokenValue = "testTokenValue";
        newMocks.testCombinedSession.ISession.tokenType = "testTokenType";
        newMocks.testCombinedSession.ISession.tokenValue = "testTokenValue";
        newMocks.testCombinedProfile.profile.tokenType = "testTokenType";
        newMocks.testCombinedProfile.profile.tokenValue = "testTokenValue";
        newMocks.testCombinedProfile.profile.user = undefined;
        newMocks.testCombinedProfile.profile.password = undefined;
        newMocks.testCombinedProfile.profile.protocol = "https";
        newMocks.testCombinedProfile.profile.host = "test";
        newMocks.testCombinedProfile.profile.type = "basic";
        newMocks.testOptionalProfile.profile.host = "host";
        newMocks.testOptionalProfile.profile.port = "1443";
        newMocks.testOptionalProfile.profile.user = undefined;
        newMocks.testOptionalProfile.profile.password = undefined;
        newMocks.testOptionalProfile.type = "zosmf";
        newMocks.testAltSession.ISession.tokenType = "altTokenType";
        newMocks.testAltSession.ISession.tokenValue = "altTokenValue";
        newMocks.testAltTypeProfile.profile.user = undefined;
        newMocks.testAltTypeProfile.profile.password = undefined;
        newMocks.testAltTypeProfile.profile.tokenType = "altTokenType";
        newMocks.testAltTypeProfile.profile.tokenValue = "altTokenValue";
        globalMocks.mockCreateSessCfgFromArgs.mockResolvedValue(newMocks.testCombinedSession);
        newMocks.datasetSessionNodeToken = createDatasetSessionNode(
            newMocks.testCombinedSession,
            newMocks.testCombinedProfile
        );
        newMocks.datasetSessionNodeAltToken = createDatasetSessionNode(
            newMocks.testAltSession,
            newMocks.testAltTypeProfile
        );
        newMocks.datasetSessionNode = createDatasetSessionNode(newMocks.session, newMocks.imperativeProfile);
        newMocks.optionalCredNode = createDatasetSessionNode(newMocks.session, newMocks.testOptionalProfile);
        newMocks.mockNode = newMocks.datasetSessionNode;
        newMocks.testDatasetTree = createDatasetTree(newMocks.datasetSessionNode, newMocks.treeView);
        newMocks.testJobTree = createJobsTree(
            newMocks.session,
            newMocks.iJob,
            newMocks.imperativeProfile,
            newMocks.treeView
        );

        Object.defineProperty(globalMocks.mockCliProfileManager, "load", {
            value: jest.fn(() => {
                return new Promise((resolve) => {
                    resolve(newMocks.imperativeProfile);
                });
            }),
            configurable: true,
        });
        Object.defineProperty(globalMocks.mockCliProfileManager, "update", { value: jest.fn(), configurable: true });

        return newMocks;
    }

    it("Tests that sso login is skipped if service profile contains user/password", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);

        const ussSessionNode = createUSSSessionNode(blockMocks.session, blockMocks.imperativeProfile);
        const ussTree = createUSSTree([], [ussSessionNode], blockMocks.treeView);
        const resultNode: IZoweNodeType = blockMocks.datasetSessionNode;

        await Profiles.getInstance().ssoLogin(resultNode);

        expect(globalMocks.mockShowInformationMessage.mock.calls.length).toBe(1);
        expect(globalMocks.mockShowInformationMessage.mock.calls[0][0]).toBe(
            "This profile does not support token authentication."
        );
    });
});
