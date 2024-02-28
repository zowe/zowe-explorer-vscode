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
jest.mock("vscode");

import * as imperative from "@zowe/imperative";
import { createISession, createAltTypeIProfile, createTreeView, createIProfile, createInstanceOfProfile } from "../../__mocks__/mockCreators/shared";
import { createDatasetSessionNode, createDatasetTree } from "../../__mocks__/mockCreators/datasets";
import { createUSSSessionNode, createUSSTree } from "../../__mocks__/mockCreators/uss";
import { createJobsTree, createIJobObject } from "../../__mocks__/mockCreators/jobs";
import { ZoweExplorerExtender } from "../../src/ZoweExplorerExtender";
import { Profiles } from "../../src/Profiles";
import * as path from "path";
import * as fs from "fs";
import { FileManagement, Gui, ProfilesCache } from "@zowe/zowe-explorer-api";
import { ProfilesUtils } from "../../src/utils/ProfilesUtils";
import { ZoweLogger } from "../../src/utils/LoggerUtils";
import { ZoweLocalStorage } from "../../src/utils/ZoweLocalStorage";
import { SettingsConfig } from "../../src/utils/SettingsConfig";
import { UssFSProvider } from "../../src/uss/UssFSProvider";
jest.mock("fs");

describe("ZoweExplorerExtender unit tests", () => {
    async function createBlockMocks() {
        const newMocks = {
            log: imperative.Logger.getAppLogger(),
            session: createISession(),
            imperativeProfile: createIProfile(),
            altTypeProfile: createAltTypeIProfile(),
            treeView: createTreeView(),
            instTest: ZoweExplorerExtender.getInstance(),
            profiles: {},
            mockGetConfiguration: jest.fn(),
            mockErrorMessage: jest.fn(),
            mockExistsSync: jest.fn(),
            mockTextDocument: jest.fn(),
            FileSystemProvider: {
                createDirectory: jest.fn(),
            },
        };

        jest.spyOn(UssFSProvider.instance, "createDirectory").mockImplementation(newMocks.FileSystemProvider.createDirectory);

        Object.defineProperty(fs, "existsSync", { value: newMocks.mockExistsSync, configurable: true });
        newMocks.profiles = createInstanceOfProfile(newMocks.imperativeProfile);
        jest.spyOn(Profiles, "getInstance").mockReturnValue(newMocks.profiles as any);
        Object.defineProperty(vscode.window, "createTreeView", {
            value: jest.fn().mockReturnValue({ onDidCollapseElement: jest.fn() }),
            configurable: true,
        });
        Object.defineProperty(vscode.window, "showErrorMessage", {
            value: newMocks.mockErrorMessage,
            configurable: true,
        });
        Object.defineProperty(vscode.window, "showTextDocument", {
            value: newMocks.mockTextDocument,
            configurable: true,
        });
        Object.defineProperty(ZoweLocalStorage, "storage", {
            value: {
                get: () => ({ persistence: true, favorites: [], history: [], sessions: ["zosmf"], searchHistory: [], fileHistory: [] }),
                update: jest.fn(),
                keys: () => [],
            },
            configurable: true,
        });
        Object.defineProperty(Profiles.getInstance(), "addToConfigArray", {
            value: jest.fn(),
            configurable: true,
        });
        Object.defineProperty(ZoweLogger, "error", {
            value: jest.fn(),
            configurable: true,
        });
        Object.defineProperty(ZoweLogger, "trace", {
            value: jest.fn(),
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

        Object.defineProperty(Gui, "showTextDocument", { value: jest.fn(), configurable: true });
        const uriFileMock = jest.spyOn(vscode.Uri, "file").mockImplementation();

        const zoweDir = FileManagement.getZoweDir();
        const userInputs = [
            {
                choice: undefined,
                configError: "Error parsing JSON",
                fileChecks: ["zowe.config.user.json"],
                mockExistsSync: blockMocks.mockExistsSync.mockImplementationOnce,
            },
            {
                choice: "Show Config",
                configError: "Error parsing JSON",
                fileChecks: ["zowe.config.user.json"],
                shouldFail: true,
                mockExistsSync: blockMocks.mockExistsSync.mockImplementationOnce,
            },
            {
                choice: "Show Config",
                configError: `Error parsing JSON in the file '${path.join(zoweDir, "zowe.config.user.json")}'`,
                shouldFail: false,
                fileChecks: ["zowe.config.user.json"],
                mockExistsSync: blockMocks.mockExistsSync.mockImplementationOnce,
            },
            {
                choice: "Show Config",
                configError: "Error parsing JSON",
                fileChecks: ["zowe.config.user.json", "zowe.config.json"],
                shouldFail: false,
                mockExistsSync: blockMocks.mockExistsSync.mockImplementationOnce,
            },
            {
                choice: "Show Config",
                configError: `Error reading profile file ("${path.join(zoweDir, "profiles", "exampleType", "exampleType_meta.yaml")}")`,
                fileChecks: ["zowe.config.user.json", "zowe.config.json"],
                v1: true,
                mockExistsSync: blockMocks.mockExistsSync.mockImplementation,
            },
        ];
        for (const userInput of userInputs) {
            blockMocks.mockErrorMessage.mockImplementationOnce((_msg, ..._items) => Promise.resolve(userInput.choice));
            if (userInput.fileChecks.length > 1) {
                userInput.mockExistsSync((_path) => false);
            }
            await ZoweExplorerExtender.showZoweConfigError(userInput.configError);
            expect(blockMocks.mockErrorMessage).toHaveBeenCalledWith(
                'Error encountered when loading your Zowe config. Click "Show Config" for more details.',
                undefined,
                "Show Config"
            );
            if (userInput.choice == null) {
                expect(Gui.showTextDocument).not.toHaveBeenCalled();
            } else {
                if (userInput.v1) {
                    expect(uriFileMock).toHaveBeenCalledWith(path.join(zoweDir, "profiles", "exampleType", "exampleType_meta.yaml"));
                } else {
                    for (const fileName of userInput.fileChecks) {
                        expect(blockMocks.mockExistsSync).toHaveBeenCalledWith(path.join(zoweDir, fileName));
                    }
                }
                if (userInput.shouldFail) {
                    expect(Gui.showTextDocument).not.toHaveBeenCalled();
                } else {
                    expect(Gui.showTextDocument).toHaveBeenCalled();
                }
            }
        }
    });

    it("should initialize zowe", async () => {
        const blockMocks = await createBlockMocks();
        Object.defineProperty(vscode.workspace, "workspaceFolders", {
            value: [
                {
                    uri: {
                        fsPath: "test",
                    },
                },
            ],
            configurable: true,
        });
        Object.defineProperty(imperative.CliProfileManager, "initialize", {
            value: jest.fn(),
            configurable: true,
        });

        const readProfilesFromDiskSpy = jest.fn();
        const refreshProfilesQueueAddSpy = jest.spyOn((ZoweExplorerExtender as any).refreshProfilesQueue, "add");
        jest.spyOn(ProfilesUtils, "getProfileInfo").mockReturnValueOnce({
            readProfilesFromDisk: readProfilesFromDiskSpy,
        } as any);
        await expect(blockMocks.instTest.initForZowe("USS", ["" as any])).resolves.not.toThrow();
        expect(readProfilesFromDiskSpy).toHaveBeenCalledTimes(1);
        expect(refreshProfilesQueueAddSpy).toHaveBeenCalledTimes(1);
    });

    describe("Add to Schema functionality", () => {
        // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
        const updateSchema = async (
            addProfileTypeToSchemaMock: (
                profileType: string,
                typeInfo: { sourceApp: string; schema: any; version?: string | undefined }
            ) => any = jest.fn()
        ) => {
            const blockMocks = await createBlockMocks();
            // bypass "if (hasSecureCredentialManagerEnabled)" check for sake of testing
            jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValueOnce(false);
            jest.spyOn(ZoweLogger, "trace").mockImplementation();
            jest.spyOn(ZoweLogger, "info").mockImplementation();
            const profInfo = new imperative.ProfileInfo("zowe", {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                credMgrOverride: imperative.ProfileCredentials.defaultCredMgrWithKeytar(ProfilesCache.requireKeyring),
            });
            const addProfTypeToSchema = jest
                .spyOn(imperative.ProfileInfo.prototype, "addProfileTypeToSchema")
                .mockImplementation(addProfileTypeToSchemaMock as unknown as any);
            await (blockMocks.instTest as any).updateSchema(profInfo, [
                {
                    type: "test-type",
                    schema: {} as any,
                } as any,
            ]);
            expect(addProfTypeToSchema).toHaveBeenCalled();
        };

        it("should update the schema when an extender calls initForZowe", async () => {
            await updateSchema();
        });

        it("should throw an error if the schema is read-only", async () => {
            const errorMessageSpy = jest.spyOn(Gui, "errorMessage");
            await updateSchema((_filepath, _contents) => {
                const err = new Error("test error");
                Object.defineProperty(err, "code", {
                    value: "EACCES",
                });
                throw err;
            });
            expect(errorMessageSpy).toHaveBeenCalledWith("Failed to update Zowe schema: insufficient permissions or read-only file. test error");
        });
    });
});
