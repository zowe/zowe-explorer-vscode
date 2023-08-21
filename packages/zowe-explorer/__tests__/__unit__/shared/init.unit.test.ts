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
import * as globals from "../../../src/globals";
import * as refreshActions from "../../../src/shared/refresh";
import * as sharedActions from "../../../src/shared/actions";
import * as sharedExtension from "../../../src/shared/init";
import { Profiles } from "../../../src/Profiles";
import * as profUtils from "../../../src/utils/ProfilesUtils";
import * as tempFolder from "../../../src/utils/TempFolder";
import * as zowe from "@zowe/cli";
import { IJestIt, ITestContext, processSubscriptions, spyOnSubscriptions } from "../../__common__/testUtils";
import { TsoCommandHandler } from "../../../src/command/TsoCommandHandler";
import { MvsCommandHandler } from "../../../src/command/MvsCommandHandler";
import { saveFile } from "../../../src/dataset/actions";
import { saveUSSFile } from "../../../src/uss/actions";
import { ZoweLogger } from "../../../src/utils/LoggerUtils";
import { ZoweSaveQueue } from "../../../src/abstract/ZoweSaveQueue";
import { ZoweExplorerApiRegister } from "../../../src/ZoweExplorerApiRegister";

describe("Test src/shared/extension", () => {
    describe("registerCommonCommands", () => {
        const executeCommand = { fun: jest.fn() };
        const testGlobals = {
            LOG: { debug: jest.fn(), error: jest.fn() },
            DS_DIR: "DS_DIR",
            USS_DIR: "USS_DIR",
        };
        const test: ITestContext = {
            context: { subscriptions: [] },
            value: {
                test: "shared",
                providers: { ds: "ds", uss: "uss", job: "job" },
                affectsConfiguration: jest.fn(),
                document: jest.fn(),
                text: "\n",
            },
            _: { _: "_" },
        };
        const commands: IJestIt[] = [
            {
                name: "zowe.manualPoll",
                mock: [],
            },
            {
                name: "zowe.updateSecureCredentials",
                mock: [
                    { spy: jest.spyOn(globals, "setGlobalSecurityValue"), arg: [test.value] },
                    { spy: jest.spyOn(profUtils.ProfilesUtils, "writeOverridesFile"), arg: [] },
                ],
            },
            {
                name: "zowe.promptCredentials",
                mock: [{ spy: jest.spyOn(profUtils.ProfilesUtils, "promptCredentials"), arg: [test.value] }],
            },
            {
                name: "onDidChangeConfiguration:1",
                mock: [
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [globals.SETTINGS_LOGS_FOLDER_PATH], ret: true },
                    { spy: jest.spyOn(globals, "initLogger"), arg: [test.value] },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [globals.SETTINGS_TEMP_FOLDER_PATH], ret: false },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [globals.SETTINGS_AUTOMATIC_PROFILE_VALIDATION], ret: false },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [globals.SETTINGS_TEMP_FOLDER_HIDE], ret: false },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [globals.SETTINGS_SECURE_CREDENTIALS_ENABLED], ret: false },
                ],
            },
            {
                name: "onDidChangeConfiguration:2",
                mock: [
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [globals.SETTINGS_LOGS_FOLDER_PATH], ret: false },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [globals.SETTINGS_TEMP_FOLDER_PATH], ret: true },
                    { spy: jest.spyOn(tempFolder, "moveTempFolder"), arg: [undefined, test.value] },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [globals.SETTINGS_AUTOMATIC_PROFILE_VALIDATION], ret: false },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [globals.SETTINGS_TEMP_FOLDER_HIDE], ret: false },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [globals.SETTINGS_SECURE_CREDENTIALS_ENABLED], ret: false },
                ],
            },
            {
                name: "onDidChangeConfiguration:3",
                mock: [
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [globals.SETTINGS_LOGS_FOLDER_PATH], ret: false },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [globals.SETTINGS_TEMP_FOLDER_PATH], ret: false },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [globals.SETTINGS_AUTOMATIC_PROFILE_VALIDATION], ret: true },
                    { spy: jest.spyOn(Profiles, "getInstance"), arg: [], ret: { refresh: jest.fn() } },
                    { spy: jest.spyOn(refreshActions, "refreshAll"), arg: ["ds"] },
                    { spy: jest.spyOn(refreshActions, "refreshAll"), arg: ["uss"] },
                    { spy: jest.spyOn(refreshActions, "refreshAll"), arg: ["job"] },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [globals.SETTINGS_TEMP_FOLDER_HIDE], ret: false },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [globals.SETTINGS_SECURE_CREDENTIALS_ENABLED], ret: false },
                ],
            },
            {
                name: "onDidChangeConfiguration:4",
                mock: [
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [globals.SETTINGS_LOGS_FOLDER_PATH], ret: false },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [globals.SETTINGS_TEMP_FOLDER_PATH], ret: false },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [globals.SETTINGS_AUTOMATIC_PROFILE_VALIDATION], ret: false },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [globals.SETTINGS_TEMP_FOLDER_HIDE], ret: true },
                    { spy: jest.spyOn(tempFolder, "hideTempFolder"), arg: [test.value] },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [globals.SETTINGS_SECURE_CREDENTIALS_ENABLED], ret: false },
                ],
            },
            {
                name: "onDidChangeConfiguration:5",
                mock: [
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [globals.SETTINGS_LOGS_FOLDER_PATH], ret: false },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [globals.SETTINGS_TEMP_FOLDER_PATH], ret: false },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [globals.SETTINGS_AUTOMATIC_PROFILE_VALIDATION], ret: false },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [globals.SETTINGS_TEMP_FOLDER_HIDE], ret: false },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [globals.SETTINGS_SECURE_CREDENTIALS_ENABLED], ret: true },
                    { spy: jest.spyOn(executeCommand, "fun"), arg: ["zowe.updateSecureCredentials"] },
                ],
            },
            {
                name: "zowe.openRecentMember",
                mock: [{ spy: jest.spyOn(sharedActions, "openRecentMemberPrompt"), arg: ["ds", "uss"] }],
            },
            {
                name: "zowe.searchInAllLoadedItems",
                mock: [{ spy: jest.spyOn(sharedActions, "searchInAllLoadedItems"), arg: ["ds", "uss"] }],
            },
            {
                name: "onDidSaveTextDocument:1",
                parm: [{ isDirty: false, fileName: "_", uri: vscode.Uri.parse("") }],
                mock: [],
            },
            {
                name: "onDidSaveTextDocument:2",
                parm: [{ fileName: "DS_DIR", isDirty: true, uri: vscode.Uri.parse("") }],
                mock: [
                    {
                        spy: jest.spyOn(ZoweSaveQueue, "push"),
                        arg: [
                            {
                                fileProvider: "ds",
                                savedFile: { fileName: "DS_DIR", uri: vscode.Uri.parse(""), isDirty: true },
                                uploadRequest: saveFile,
                            },
                        ],
                    },
                ],
            },
            {
                name: "onDidSaveTextDocument:3",
                parm: [{ fileName: "USS_DIR", isDirty: true, uri: vscode.Uri.parse("") }],
                mock: [
                    {
                        spy: jest.spyOn(ZoweSaveQueue, "push"),
                        arg: [
                            {
                                fileProvider: "uss",
                                savedFile: { fileName: "USS_DIR", isDirty: true, uri: vscode.Uri.parse("") },
                                uploadRequest: saveUSSFile,
                            },
                        ],
                    },
                ],
            },
            {
                name: "onDidSaveTextDocument:4",
                parm: [{ isDirty: true, fileName: "NOT_DATASET" }],
                mock: [],
            },
            {
                name: "zowe.ds.deleteProfile",
                mock: [{ spy: jest.spyOn(Profiles, "getInstance"), arg: [], ret: { deleteProfile: jest.fn() } }],
            },
            {
                name: "zowe.cmd.deleteProfile",
                mock: [{ spy: jest.spyOn(Profiles, "getInstance"), arg: [], ret: { deleteProfile: jest.fn() } }],
            },
            {
                name: "zowe.uss.deleteProfile",
                mock: [{ spy: jest.spyOn(Profiles, "getInstance"), arg: [], ret: { deleteProfile: jest.fn() } }],
            },
            {
                name: "zowe.jobs.deleteProfile",
                mock: [{ spy: jest.spyOn(Profiles, "getInstance"), arg: [], ret: { deleteProfile: jest.fn() } }],
            },
            {
                name: "zowe.issueTsoCmd:1",
                mock: [{ spy: jest.spyOn(TsoCommandHandler, "getInstance"), arg: [], ret: { issueTsoCommand: jest.fn() } }],
            },
            {
                name: "zowe.issueTsoCmd:2",
                parm: [],
                mock: [{ spy: jest.spyOn(TsoCommandHandler, "getInstance"), arg: [], ret: { issueTsoCommand: jest.fn() } }],
            },
            {
                name: "zowe.issueMvsCmd:1",
                mock: [{ spy: jest.spyOn(MvsCommandHandler, "getInstance"), arg: [], ret: { issueMvsCommand: jest.fn() } }],
            },
            {
                name: "zowe.issueMvsCmd:2",
                parm: [],
                mock: [{ spy: jest.spyOn(MvsCommandHandler, "getInstance"), arg: [], ret: { issueMvsCommand: jest.fn() } }],
            },
        ];

        beforeAll(async () => {
            const registerCommand = (cmd: string, fun: () => void) => {
                return { [cmd]: fun };
            };
            const onDidChangeConfiguration = (fun: () => void) => {
                return { onDidChangeConfiguration: fun };
            };
            const onDidSaveTextDocument = (fun: () => void) => {
                return { onDidSaveTextDocument: fun };
            };
            Object.defineProperty(vscode.commands, "registerCommand", { value: registerCommand });
            Object.defineProperty(vscode.workspace, "onDidChangeConfiguration", { value: onDidChangeConfiguration });
            Object.defineProperty(vscode.workspace, "getConfiguration", { value: () => ({ get: jest.fn().mockReturnValue(test.value) }) });
            Object.defineProperty(zowe, "getZoweDir", { value: () => test.value });
            Object.defineProperty(vscode.commands, "executeCommand", { value: executeCommand.fun });
            Object.defineProperty(globals, "LOG", { value: testGlobals.LOG });
            Object.defineProperty(globals, "DS_DIR", { value: testGlobals.DS_DIR });
            Object.defineProperty(globals, "USS_DIR", { value: testGlobals.USS_DIR });
            Object.defineProperty(ZoweLogger, "error", { value: jest.fn(), configurable: true });
            Object.defineProperty(ZoweLogger, "debug", { value: jest.fn(), configurable: true });
            Object.defineProperty(ZoweLogger, "warn", { value: jest.fn(), configurable: true });
            Object.defineProperty(ZoweLogger, "info", { value: jest.fn(), configurable: true });
            Object.defineProperty(ZoweLogger, "trace", { value: jest.fn(), configurable: true });
            Object.defineProperty(vscode.workspace, "onDidSaveTextDocument", { value: onDidSaveTextDocument });

            spyOnSubscriptions(commands);
            await sharedExtension.registerCommonCommands(test.context, test.value.providers);
        });
        afterAll(() => {
            jest.restoreAllMocks();
        });

        processSubscriptions(commands, test);
    });
    describe("registerRefreshCommand", () => {
        const context: any = { subscriptions: [] };
        const activate = jest.fn();
        const deactivate = jest.fn();
        const dispose = jest.fn();
        let extRefreshCallback;
        const spyExecuteCommand = jest.fn();
        const spyLogError = jest.fn();

        beforeAll(() => {
            Object.defineProperty(vscode.commands, "registerCommand", {
                value: (_: string, fun: () => void) => {
                    extRefreshCallback = fun;
                    return { dispose };
                },
            });
            Object.defineProperty(vscode.commands, "executeCommand", { value: spyExecuteCommand });
            Object.defineProperty(globals, "LOG", { value: { error: spyLogError } });
            sharedExtension.registerRefreshCommand(context, activate, deactivate);
        });

        beforeEach(() => {
            jest.clearAllMocks();
        });

        afterAll(() => {
            jest.restoreAllMocks();
        });

        it("Test assuming we are NOT in a Theia environment", async () => {
            Object.defineProperty(globals, "ISTHEIA", { value: false });
            await extRefreshCallback();
            expect(spyExecuteCommand).not.toHaveBeenCalled();
            expect(deactivate).toHaveBeenCalled();
            expect(spyLogError).not.toHaveBeenCalled();
            expect(dispose).toHaveBeenCalled();
            expect(activate).toHaveBeenCalled();
        });

        it("Test assuming we are NOT in a Theia environment and unable to dispose of the subscription", async () => {
            Object.defineProperty(globals, "ISTHEIA", { value: false });
            const testError = new Error("test");
            dispose.mockRejectedValue(testError);
            await extRefreshCallback();
            expect(spyExecuteCommand).not.toHaveBeenCalled();
            expect(deactivate).toHaveBeenCalled();
            expect(ZoweLogger.error).toHaveBeenCalledWith(testError);
            expect(dispose).toHaveBeenCalled();
            expect(activate).toHaveBeenCalled();
        });
    });

    describe("watchConfigProfile", () => {
        let context: any;
        const spyReadFile = jest.fn().mockReturnValue("test");
        const spyExecuteCommand = jest.fn();
        const watcher: any = {
            onDidCreate: jest.fn().mockImplementation((fun) => fun()),
            onDidDelete: jest.fn().mockImplementation((fun) => fun()),
            onDidChange: jest.fn().mockImplementation((fun) => fun("uri")),
        };
        beforeEach(() => {
            context = { subscriptions: [] };
            jest.clearAllMocks();
            Object.defineProperty(globals, "ISTHEIA", { value: false, configurable: true });
            Object.defineProperty(vscode.workspace, "createFileSystemWatcher", { value: () => watcher, configurable: true });
            Object.defineProperty(vscode.workspace, "workspaceFolders", { value: [{ uri: { fsPath: "fsPath" } }], configurable: true });
            Object.defineProperty(vscode.commands, "executeCommand", { value: spyExecuteCommand, configurable: true });
            Object.defineProperty(vscode.workspace, "fs", { value: { readFile: spyReadFile }, configurable: true });
            Object.defineProperty(globals, "SAVED_PROFILE_CONTENTS", { value: "test", configurable: true });
        });

        afterAll(() => {
            jest.restoreAllMocks();
        });

        it("should be able to trigger all listeners", async () => {
            const spyRefreshAll = jest.spyOn(refreshActions, "refreshAll").mockImplementation(jest.fn());
            jest.spyOn(ZoweExplorerApiRegister.getInstance().onProfilesUpdateEmitter, "fire").mockImplementation();
            await sharedExtension.watchConfigProfile(context, { ds: "ds", uss: "uss", job: "job" } as any);
            expect(spyExecuteCommand).toHaveBeenCalledWith("zowe.extRefresh");
            expect(context.subscriptions).toContain(watcher);
            expect(spyReadFile).toHaveBeenCalledWith("uri");
            expect(spyRefreshAll).not.toHaveBeenCalled();

            spyReadFile.mockReturnValue("other");
            await sharedExtension.watchConfigProfile(context, { ds: "ds", uss: "uss", job: "job" } as any);
            expect(spyRefreshAll).toHaveBeenCalled();
        });

        it("should be able to refresh zowe explorer on theia after updating config file", async () => {
            Object.defineProperty(globals, "ISTHEIA", { value: true, configurable: true });
            jest.spyOn(ZoweExplorerApiRegister.getInstance().onProfilesUpdateEmitter, "fire").mockImplementation();
            const spyRefreshAll = jest.spyOn(refreshActions, "refreshAll").mockImplementation(jest.fn());
            await sharedExtension.watchConfigProfile(context, { ds: "ds", uss: "uss", job: "job" } as any);
            expect(context.subscriptions).toContain(watcher);
            expect(spyReadFile).toHaveBeenCalledWith("uri");
            expect(spyRefreshAll).toHaveBeenCalled();

            spyReadFile.mockReturnValue("other");
            await sharedExtension.watchConfigProfile(context, { ds: "ds", uss: "uss", job: "job" } as any);
            expect(spyRefreshAll).toHaveBeenCalled();
            expect(spyExecuteCommand).toHaveBeenCalledWith("zowe.extRefresh");
        });
    });

    describe("initSubscribers", () => {
        const spyCollapse = jest.fn().mockImplementation((fun) => fun({ element: "collapse" }));
        const spyExpand = jest.fn().mockImplementation((fun) => fun({ element: "expand" }));
        const spyFlipState = jest.fn();
        let context: any;
        const provider: any = { getTreeView: () => treeView, flipState: spyFlipState };
        const treeView = { onDidCollapseElement: spyCollapse, onDidExpandElement: spyExpand };

        beforeEach(() => {
            context = { subscriptions: [] };
            jest.clearAllMocks();
        });
        afterAll(() => {
            jest.restoreAllMocks();
        });

        it("should setup listeners if we are NOT in THEIA", () => {
            Object.defineProperty(globals, "ISTHEIA", { value: false });
            sharedExtension.initSubscribers(context, provider);
            expect(context.subscriptions).toContain(treeView);
            expect(spyCollapse).toHaveBeenCalled();
            expect(spyExpand).toHaveBeenCalled();
            expect(spyFlipState).toHaveBeenCalledWith("collapse", false);
            expect(spyFlipState).toHaveBeenCalledWith("expand", true);
        });
        it("should not setup listeners if we are in THEIA", () => {
            Object.defineProperty(globals, "ISTHEIA", { value: true });
            sharedExtension.initSubscribers(context, provider);
            expect(context.subscriptions).toContain(treeView);
            expect(spyCollapse).not.toHaveBeenCalled();
            expect(spyExpand).not.toHaveBeenCalled();
        });
    });
});
