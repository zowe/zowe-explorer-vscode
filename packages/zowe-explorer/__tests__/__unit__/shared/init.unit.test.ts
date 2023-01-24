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
import * as globals from "../../../src/globals";
import * as contextuals from "../../../src/shared/context";
import * as refreshActions from "../../../src/shared/refresh";
import * as sharedActions from "../../../src/shared/actions";
import * as sharedExtension from "../../../src/shared/init";
import * as workspaceUtils from "../../../src/utils/workspace";
import { Profiles } from "../../../src/Profiles";
import * as profileUtils from "../../../src/utils/ProfilesUtils";
import * as tempFolder from "../../../src/utils/TempFolder";
import * as zowe from "@zowe/cli";
import { IJestIt, ITestContext, processSubscriptions, spyOnSubscriptions } from "../../__common__/testUtils";
import { TsoCommandHandler } from "../../../src/command/TsoCommandHandler";
import { MvsCommandHandler } from "../../../src/command/MvsCommandHandler";
import { saveFile } from "../../../src/dataset/actions";
import { saveUSSFile } from "../../../src/uss/actions";

describe("Test src/shared/extension", () => {
    describe("registerCommonCommands", () => {
        const executeCommand = { fun: jest.fn() };
        const testGlobals = {
            LOG: { debug: jest.fn() },
            DS_DIR: "DS_DIR",
            USS_DIR: "USS_DIR",
        };
        const test: ITestContext = {
            context: { subscriptions: [] },
            value: { test: "shared", providers: { ds: "ds", uss: "uss", job: "job" }, affectsConfiguration: jest.fn(), document: jest.fn() },
            _: { _: "_" },
        };
        const commands: IJestIt[] = [
            {
                name: "zowe.updateSecureCredentials",
                mock: [
                    { spy: jest.spyOn(globals, "setGlobalSecurityValue"), arg: [] },
                    { spy: jest.spyOn(profileUtils, "writeOverridesFile"), arg: [] },
                ],
            },
            {
                name: "zowe.promptCredentials",
                mock: [{ spy: jest.spyOn(profileUtils, "promptCredentials"), arg: [test.value] }],
            },
            {
                name: "onDidChangeConfiguration:1",
                mock: [
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [globals.SETTINGS_TEMP_FOLDER_PATH], ret: true },
                    { spy: jest.spyOn(tempFolder, "moveTempFolder"), arg: [undefined, test.value] },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [globals.SETTINGS_AUTOMATIC_PROFILE_VALIDATION], ret: false },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [globals.SETTINGS_TEMP_FOLDER_HIDE], ret: false },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [globals.SETTINGS_SECURE_CREDENTIALS_ENABLED], ret: false },
                ],
            },
            {
                name: "onDidChangeConfiguration:2",
                mock: [
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
                name: "onDidChangeConfiguration:3",
                mock: [
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [globals.SETTINGS_TEMP_FOLDER_PATH], ret: false },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [globals.SETTINGS_AUTOMATIC_PROFILE_VALIDATION], ret: false },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [globals.SETTINGS_TEMP_FOLDER_HIDE], ret: true },
                    { spy: jest.spyOn(tempFolder, "hideTempFolder"), arg: [test.value] },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [globals.SETTINGS_SECURE_CREDENTIALS_ENABLED], ret: false },
                ],
            },
            {
                name: "onDidChangeConfiguration:4",
                mock: [
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
                name: "onWillSaveTextDocument:1",
                parm: [{ document: { isDirty: false, fileName: "_" } }],
                mock: [],
            },
            {
                name: "onWillSaveTextDocument:2",
                parm: [{ document: { isDirty: true, fileName: "DS_DIR" } }],
                mock: [{ spy: jest.spyOn(workspaceUtils, "handleSaving"), arg: [saveFile, { isDirty: true, fileName: "DS_DIR" }, "ds"] }],
            },
            {
                name: "onWillSaveTextDocument:3",
                parm: [{ document: { isDirty: true, fileName: "USS_DIR" } }],
                mock: [{ spy: jest.spyOn(workspaceUtils, "handleSaving"), arg: [saveUSSFile, { isDirty: true, fileName: "USS_DIR" }, "uss"] }],
            },
            {
                name: "onWillSaveTextDocument:4",
                parm: [{ document: { isDirty: true, fileName: "NOT_DATASET" } }],
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
            const onWillSaveTextDocument = (fun: () => void) => {
                return { onWillSaveTextDocument: fun };
            };
            Object.defineProperty(vscode.commands, "registerCommand", { value: registerCommand });
            Object.defineProperty(vscode.workspace, "onDidChangeConfiguration", { value: onDidChangeConfiguration });
            Object.defineProperty(vscode.workspace, "getConfiguration", { value: () => ({ get: jest.fn().mockReturnValue(test.value) }) });
            Object.defineProperty(zowe, "getZoweDir", { value: () => test.value });
            Object.defineProperty(vscode.commands, "executeCommand", { value: executeCommand.fun });
            Object.defineProperty(globals, "LOG", { value: testGlobals.LOG });
            Object.defineProperty(globals, "DS_DIR", { value: testGlobals.DS_DIR });
            Object.defineProperty(globals, "USS_DIR", { value: testGlobals.USS_DIR });
            Object.defineProperty(vscode.workspace, "onWillSaveTextDocument", { value: onWillSaveTextDocument });

            spyOnSubscriptions(commands);
            await sharedExtension.registerCommonCommands(test.context, test.value.providers);
        });
        afterAll(() => {
            jest.restoreAllMocks();
        });

        processSubscriptions(commands, test);
    });
});
