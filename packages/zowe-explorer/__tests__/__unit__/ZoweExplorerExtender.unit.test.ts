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

import * as vscode from "vscode";
jest.mock("vscode");

import { imperative } from "@zowe/cli";
import { createISession, createAltTypeIProfile, createTreeView, createIProfile, createInstanceOfProfile } from "../../__mocks__/mockCreators/shared";
import { createDatasetSessionNode, createDatasetTree } from "../../__mocks__/mockCreators/datasets";
import { createUSSSessionNode, createUSSTree } from "../../__mocks__/mockCreators/uss";
import { createJobsTree, createIJobObject } from "../../__mocks__/mockCreators/jobs";
import { ZoweExplorerExtender } from "../../src/ZoweExplorerExtender";
import { Profiles } from "../../src/Profiles";
import * as path from "path";
import * as fs from "fs";
import { getZoweDir } from "@zowe/zowe-explorer-api";
jest.mock("fs");

const mocked = <T extends (...args: any[]) => any>(fn: T): jest.Mock<ReturnType<T>> => fn as any;

describe("ZoweExplorerExtender unit tests", () => {
    async function createBlockMocks() {
        const newMocks = {
            log: imperative.Logger.getAppLogger(),
            session: createISession(),
            imperativeProfile: createIProfile(),
            altTypeProfile: createAltTypeIProfile(),
            treeView: createTreeView(),
            instTest: ZoweExplorerExtender.getInstance(),
            profiles: null,
            mockGetConfiguration: jest.fn(),
            mockErrorMessage: jest.fn(),
            mockStatSync: jest.fn(),
            mockTextDocument: jest.fn(),
        };

        Object.defineProperty(fs, "statSync", { value: newMocks.mockStatSync, configurable: true });
        newMocks.profiles = createInstanceOfProfile(newMocks.imperativeProfile);
        Object.defineProperty(Profiles, "getInstance", {
            value: jest
                .fn(() => {
                    return {
                        refresh: jest.fn(),
                    };
                })
                .mockReturnValue(newMocks.profiles),
        });
        Object.defineProperty(vscode.window, "createTreeView", { value: jest.fn(), configurable: true });
        Object.defineProperty(vscode.window, "showErrorMessage", {
            value: newMocks.mockErrorMessage,
            configurable: true,
        });
        Object.defineProperty(vscode.window, "showTextDocument", {
            value: newMocks.mockTextDocument,
            configurable: true,
        });
        Object.defineProperty(vscode.workspace, "getConfiguration", {
            value: newMocks.mockGetConfiguration,
            configurable: true,
        });

        return newMocks;
    }

    it("calls DatasetTree addSession when extender profiles are reloaded", async () => {
        const blockMocks = await createBlockMocks();
        const datasetSessionNode = createDatasetSessionNode(blockMocks.session, blockMocks.altTypeProfile);
        const datasetTree = createDatasetTree(datasetSessionNode, blockMocks.altTypeProfile);
        ZoweExplorerExtender.createInstance(datasetTree, undefined, undefined);
        jest.spyOn(blockMocks.instTest.datasetProvider, "addSession");
        await blockMocks.instTest.reloadProfiles();
        expect(blockMocks.instTest.datasetProvider.addSession).toHaveBeenCalled();
    });
    it("calls USSTree addSession when extender profiles are reloaded", async () => {
        const blockMocks = await createBlockMocks();
        const ussSessionNode = createUSSSessionNode(blockMocks.session, blockMocks.imperativeProfile);
        const ussTree = createUSSTree([], [ussSessionNode], blockMocks.treeView);
        ZoweExplorerExtender.createInstance(undefined, ussTree, undefined);
        jest.spyOn(blockMocks.instTest.ussFileProvider, "addSession");
        await blockMocks.instTest.reloadProfiles();
        expect(blockMocks.instTest.ussFileProvider.addSession).toHaveBeenCalled();
    });
    it("calls ZosJobsProvider addSession when extender profiles are reloaded", async () => {
        const blockMocks = await createBlockMocks();
        const testJob = createIJobObject();
        const jobsTree = createJobsTree(blockMocks.session, testJob, blockMocks.altTypeProfile, blockMocks.treeView);
        ZoweExplorerExtender.createInstance(undefined, undefined, jobsTree);
        jest.spyOn(blockMocks.instTest.jobsProvider, "addSession");
        await blockMocks.instTest.reloadProfiles();
        expect(blockMocks.instTest.jobsProvider.addSession).toHaveBeenCalled();
    });
    it("does not use any tree providers when the created instance does not provide them", async () => {
        const blockMocks = await createBlockMocks();
        ZoweExplorerExtender.createInstance();
        await blockMocks.instTest.reloadProfiles();
        expect(blockMocks.instTest.datasetProvider).toBe(undefined);
        expect(blockMocks.instTest.ussFileProvider).toBe(undefined);
        expect(blockMocks.instTest.jobsProvider).toBe(undefined);
    });

    it("properly handles Zowe config error dialog based on user input", async () => {
        const blockMocks = await createBlockMocks();
        ZoweExplorerExtender.createInstance();

        Object.defineProperty(vscode.Uri, "file", { value: jest.fn(), configurable: true });

        const zoweDir = getZoweDir();
        const userInputs = [
            {
                choice: undefined,
                configError: "Error parsing JSON",
                fileChecks: ["zowe.config.user.json"],
                mockStatSync: blockMocks.mockStatSync.mockImplementationOnce,
            },
            {
                choice: "Show Config",
                configError: "Error parsing JSON",
                fileChecks: ["zowe.config.user.json"],
                mockStatSync: blockMocks.mockStatSync.mockImplementationOnce,
            },
            {
                choice: "Show Config",
                configError: `Error parsing JSON in the file '${path.join(zoweDir, "zowe.config.user.json")}'`,
                fileChecks: ["zowe.config.user.json"],
                mockStatSync: blockMocks.mockStatSync.mockImplementationOnce,
            },
            {
                choice: "Show Config",
                configError: "Error parsing JSON",
                fileChecks: ["zowe.config.user.json", "zowe.config.json"],
                mockStatSync: blockMocks.mockStatSync.mockImplementationOnce,
            },
            {
                choice: "Show Config",
                configError: `Error reading profile file ("${path.join(zoweDir, "profiles/exampleType/exampleType_meta.yaml")}")`,
                fileChecks: ["zowe.config.user.json", "zowe.config.json"],
                v1: true,
                mockStatSync: blockMocks.mockStatSync.mockImplementation,
            },
        ];
        for (const userInput of userInputs) {
            blockMocks.mockErrorMessage.mockImplementationOnce((msg, ...items) => Promise.resolve(userInput.choice));
            if (userInput.fileChecks.length > 1) {
                userInput.mockStatSync((...args) => {
                    throw new Error("Failed to find config json");
                });
            }
            await ZoweExplorerExtender.showZoweConfigError(userInput.configError);
            expect(blockMocks.mockErrorMessage).toHaveBeenCalledWith(
                'Error encountered when loading your Zowe config. Click "Show Config" for more details.',
                "Show Config"
            );
            if (userInput.choice == null) {
                expect(vscode.window.showTextDocument).not.toHaveBeenCalled();
            } else {
                if (userInput.v1) {
                    expect(vscode.Uri.file).toHaveBeenCalledWith(path.join(zoweDir, "profiles/exampleType/exampleType_meta.yaml"));
                } else {
                    for (const fileName of userInput.fileChecks) {
                        expect(blockMocks.mockStatSync).toHaveBeenCalledWith(path.join(zoweDir, fileName));
                    }
                }
                expect(vscode.window.showTextDocument).toHaveBeenCalled();
            }
        }
    });
});
