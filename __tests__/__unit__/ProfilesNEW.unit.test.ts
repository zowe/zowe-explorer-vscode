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

import { createISessionWithoutCredentials, createTreeView, createIProfile, createInstanceOfProfile, createQuickPickItem, createQuickPickContent } from "../../__mocks__/mockCreators/shared";
import { createDatasetSessionNode, createDatasetTree } from "../../__mocks__/mockCreators/datasets";
import { Profiles } from "../../src/Profiles";
import * as globals from "../../src/globals";
import * as vscode from "vscode";
import * as utils from "../../src/utils";
import { Logger } from "@zowe/imperative";

async function createGlobalMocks() {
    const newMocks = {
        mockShowInputBox: jest.fn(),
        mockGetConfiguration: jest.fn(),
        mockCreateQuickPick: jest.fn(),
        mockShowQuickPick: jest.fn(),
        mockShowInformationMessage: jest.fn(),
        mockGetInstance: jest.fn(),
        mockShowErrorMessage: jest.fn(),
        mockLog: jest.fn(),
        mockDebug: jest.fn(),
        mockError: jest.fn(),
        mockConfigurationTarget: jest.fn(),
    }

    Object.defineProperty(vscode.window, "showInformationMessage", { value: newMocks.mockShowInformationMessage, configurable: true });
    Object.defineProperty(vscode.window, "showInputBox", { value: newMocks.mockShowInputBox, configurable: true });
    Object.defineProperty(vscode.window, "showErrorMessage", { value: newMocks.mockShowErrorMessage, configurable: true });
    Object.defineProperty(vscode.window, "showQuickPick", { value: newMocks.mockShowQuickPick, configurable: true });
    Object.defineProperty(vscode.window, "createQuickPick", { value: newMocks.mockCreateQuickPick, configurable: true });
    Object.defineProperty(Profiles, "getInstance", { value: newMocks.mockGetInstance, configurable: true });
    Object.defineProperty(globals, "LOG", { value: newMocks.mockLog, configurable: true });
    Object.defineProperty(globals.LOG, "debug", { value: newMocks.mockDebug, configurable: true });
    Object.defineProperty(globals.LOG, "error", { value: newMocks.mockError, configurable: true });
    Object.defineProperty(vscode.workspace, "getConfiguration", { value: newMocks.mockGetConfiguration, configurable: true });
    Object.defineProperty(vscode, "ConfigurationTarget", { value: newMocks.mockConfigurationTarget, configurable: true });
    Object.defineProperty(Profiles, "getInstance", { value: newMocks.mockGetInstance, configurable: true });

    return newMocks;
}

describe("Shared Actions Unit Tests - Function createZoweSession", () => {
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

    it("Checking that addSession will cancel if there is no profile name", async () => {
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

    it("Checking that addSession works correctly with supplied profile name", async () => {
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

    it("Checking that addSession works correctly with existing profile", async () => {
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

    it("Checking that addSession works correctly with supplied resolveQuickPickHelper", async () => {
        const globalMocks = await createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const entered = "fake";

        globalMocks.mockCreateQuickPick.mockReturnValue(createQuickPickContent(entered, blockMocks.quickPickItem));
        jest.spyOn(utils, "resolveQuickPickHelper").mockResolvedValueOnce(blockMocks.quickPickItem);

        await blockMocks.profiles.createZoweSession(blockMocks.testDatasetTree);
        expect(blockMocks.testDatasetTree.addSession).not.toBeCalled();
    });

    it("Checking that addSession works correctly with undefined profile", async () => {
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

    it("Checking that addSession works correctly if createNewConnection is invalid", async () => {
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
});
