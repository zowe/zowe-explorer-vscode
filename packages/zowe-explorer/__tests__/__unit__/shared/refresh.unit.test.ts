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
import { ValidProfileEnum } from "@zowe/zowe-explorer-api";
import { Profiles } from "../../../src/Profiles";
import {
    createGetConfigMock,
    createInstanceOfProfile,
    createIProfile,
    createISessionWithoutCredentials,
    createTreeView,
} from "../../../__mocks__/mockCreators/shared";
import { createFavoriteUSSNode, createUSSNode, createUSSTree } from "../../../__mocks__/mockCreators/uss";
import { createIJobObject, createJobsTree } from "../../../__mocks__/mockCreators/jobs";
import * as refreshActions from "../../../src/shared/refresh";
import { createDatasetSessionNode, createDatasetTree } from "../../../__mocks__/mockCreators/datasets";
import * as globals from "../../../src/globals";
import * as sessUtils from "../../../src/utils/SessionUtils";
import { SettingsConfig } from "../../../src/utils/SettingsConfig";
import { ZoweLogger } from "../../../src/utils/LoggerUtils";

function createGlobalMocks() {
    const globalMocks = {
        session: createISessionWithoutCredentials(),
        createTreeView: jest.fn(),
        mockLog: jest.fn(),
        mockDebug: jest.fn(),
        mockError: jest.fn(),
        mockCreateTreeView: jest.fn(),
        mockGetConfiguration: jest.fn(),
        mockLoadNamedProfile: jest.fn(),
        testProfile: createIProfile(),
    };

    globalMocks.mockLoadNamedProfile.mockReturnValue(globalMocks.testProfile);
    const profilesForValidation = { status: "active", name: "fake" };
    Object.defineProperty(vscode.window, "createTreeView", { value: globalMocks.createTreeView, configurable: true });
    Object.defineProperty(ZoweLogger, "trace", { value: jest.fn(), configurable: true });
    Object.defineProperty(Profiles, "getInstance", {
        value: jest.fn(() => {
            return {
                allProfiles: [{ name: "firstName" }, { name: "secondName" }],
                defaultProfile: { name: "firstName" },
                type: "zosmf",
                validProfile: ValidProfileEnum.VALID,
                checkCurrentProfile: jest.fn(() => {
                    return profilesForValidation;
                }),
                profilesForValidation: [],
                validateProfiles: jest.fn(),
                refresh: jest.fn(),
                enableValidationContext: jest.fn(),
                getBaseProfile: jest.fn(() => {
                    return globalMocks.testProfile;
                }),
                loadNamedProfile: globalMocks.mockLoadNamedProfile,
                getDefaultProfile: jest.fn(),
                fetchAllProfiles: jest.fn(() => {
                    return [{ name: "sestest" }, { name: "profile1" }, { name: "profile2" }];
                }),
            };
        }),
    });
    Object.defineProperty(vscode.workspace, "getConfiguration", {
        value: globalMocks.mockGetConfiguration,
        configurable: true,
    });

    Object.defineProperty(SettingsConfig, "getDirectValue", {
        value: createGetConfigMock({
            "zowe.automaticProfileValidation": true,
        }),
    });
    Object.defineProperty(sessUtils, "removeSession", {
        value: jest.fn().mockImplementationOnce(() => Promise.resolve()),
        configurable: true,
    });
    Object.defineProperty(ZoweLogger, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(ZoweLogger, "debug", { value: jest.fn(), configurable: true });

    return globalMocks;
}

describe("Refresh Unit Tests - Function refreshAll", () => {
    async function createBlockMocks(globalMocks) {
        const newMocks = {
            testUSSTree: null,
            jobsTree: null,
            testDatasetTree: null,
            iJob: createIJobObject(),
            treeView: createTreeView(),
            profileInstance: null,
            ussNode: createUSSNode(globalMocks.testSession, createIProfile()),
            datasetSessionNode: createDatasetSessionNode(createISessionWithoutCredentials(), createIProfile()),
        };
        newMocks.profileInstance = createInstanceOfProfile(globalMocks.testProfile);
        newMocks.testUSSTree = createUSSTree(
            [createFavoriteUSSNode(globalMocks.testSession, globalMocks.testProfile)],
            [newMocks.ussNode],
            createTreeView()
        );
        newMocks.testUSSTree.mSessionNodes.push(newMocks.ussNode);
        newMocks.jobsTree = createJobsTree(globalMocks.session, newMocks.iJob, newMocks.profileInstance, newMocks.treeView);
        newMocks.jobsTree.mSessionNodes.push(newMocks.datasetSessionNode);
        newMocks.testDatasetTree = createDatasetTree(newMocks.datasetSessionNode, newMocks.treeView);
        newMocks.testDatasetTree.mSessionNodes.push(newMocks.datasetSessionNode);

        Object.defineProperty(SettingsConfig, "getDirectValue", {
            value: createGetConfigMock({
                "zowe.automaticProfileValidation": true,
            }),
        });
        Object.defineProperty(sessUtils, "removeSession", {
            value: jest.fn().mockImplementationOnce(() => Promise.resolve()),
            configurable: true,
        });

        return newMocks;
    }

    afterAll(() => jest.restoreAllMocks());

    it("Tests that refreshAll() executed successfully with ussTreeProvider passed", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const response = new Promise(() => {
            return {};
        });
        const spy = jest.spyOn(refreshActions, "refreshAll");
        await refreshActions.refreshAll(blockMocks.testUSSTree);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(refreshActions.refreshAll(blockMocks.testUSSTree)).toEqual(response);
        spy.mockClear();
    });

    it("Testing that refreshAll() is executed successfully with jobsTreeProvider passed", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const response = new Promise(() => {
            return {};
        });
        const submitJclSpy = jest.spyOn(refreshActions, "refreshAll");
        await refreshActions.refreshAll(blockMocks.jobsTree);
        expect(submitJclSpy).toHaveBeenCalledTimes(1);
        expect(refreshActions.refreshAll(blockMocks.jobsTree)).toEqual(response);
        submitJclSpy.mockClear();
    });
    it("Testing that refreshAll() is executed successfully with datasetTreeProvider passed", async () => {
        const globalMocks = createGlobalMocks();
        const blockMocks = await createBlockMocks(globalMocks);
        const response = new Promise(() => {
            return {};
        });
        const spy = jest.spyOn(refreshActions, "refreshAll");
        await refreshActions.refreshAll(blockMocks.testUSSTree);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(refreshActions.refreshAll(blockMocks.testDatasetTree)).toEqual(response);
        spy.mockClear();
    });
});
