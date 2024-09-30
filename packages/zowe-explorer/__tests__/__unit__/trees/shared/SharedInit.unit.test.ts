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
import * as core from "@zowe/core-for-zowe-sdk";
import * as profUtils from "../../../../src/utils/ProfilesUtils";
import * as SharedHistoryView from "../../../../src/trees/shared/SharedHistoryView";
import { IJestIt, ITestContext, processSubscriptions } from "../../../__common__/testUtils";
import { Constants } from "../../../../src/configuration/Constants";
import { Profiles } from "../../../../src/configuration/Profiles";
import { SharedActions } from "../../../../src/trees/shared/SharedActions";
import { LocalFileManagement } from "../../../../src/management/LocalFileManagement";
import { ZoweExplorerApiRegister } from "../../../../src/extending/ZoweExplorerApiRegister";
import { SharedInit } from "../../../../src/trees/shared/SharedInit";
import { TsoCommandHandler } from "../../../../src/commands/TsoCommandHandler";
import { MvsCommandHandler } from "../../../../src/commands/MvsCommandHandler";
import { UnixCommandHandler } from "../../../../src/commands/UnixCommandHandler";
import { SharedTreeProviders } from "../../../../src/trees/shared/SharedTreeProviders";
import { SharedContext } from "../../../../src/trees/shared/SharedContext";
import * as certWizard from "../../../../src/utils/CertificateWizard";
import { Gui, imperative, ZoweScheme } from "@zowe/zowe-explorer-api";
import { MockedProperty } from "../../../__mocks__/mockUtils";
import { DatasetFSProvider } from "../../../../src/trees/dataset/DatasetFSProvider";
import { UssFSProvider } from "../../../../src/trees/uss/UssFSProvider";
import { ZoweLogger } from "../../../../src/tools/ZoweLogger";

jest.mock("../../../../src/utils/LoggerUtils");
jest.mock("../../../../src/tools/ZoweLogger");

describe("Test src/shared/extension", () => {
    describe("registerCommonCommands", () => {
        const executeCommand = { fun: jest.fn() };
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
        const profileMocks = { deleteProfile: jest.fn(), disableValidation: jest.fn(), enableValidation: jest.fn(), refresh: jest.fn() };
        const treeProvider = {
            addFavorite: jest.fn(),
            deleteSession: jest.fn(),
            editSession: jest.fn(),
            getTreeView: jest.fn().mockReturnValue({ reveal: jest.fn() }),
            openWithEncoding: jest.fn(),
            refreshElement: jest.fn(),
            removeFavorite: jest.fn(),
            removeFavProfile: jest.fn(),
            saveSearch: jest.fn(),
            ssoLogin: jest.fn(),
            ssoLogout: jest.fn(),
        };
        const commands: IJestIt[] = [
            {
                name: "zowe.updateSecureCredentials",
                parm: ["@zowe/cli"],
                mock: [
                    { spy: jest.spyOn(profUtils.ProfilesUtils, "updateCredentialManagerSetting"), arg: ["@zowe/cli"] },
                    { spy: jest.spyOn(profUtils.ProfilesUtils, "writeOverridesFile"), arg: [] },
                ],
            },
            {
                name: "zowe.manualPoll",
                mock: [],
            },
            {
                name: "zowe.editHistory",
                mock: [{ spy: jest.spyOn(SharedHistoryView, "SharedHistoryView"), arg: [test.context, test.value.providers] }],
            },
            {
                name: "zowe.promptCredentials",
                mock: [{ spy: jest.spyOn(profUtils.ProfilesUtils, "promptCredentials"), arg: [test.value] }],
            },
            {
                name: "zowe.certificateWizard",
                mock: [
                    {
                        spy: jest.spyOn(certWizard, "CertificateWizard").mockReturnValueOnce({
                            userSubmission: {
                                promise: Promise.resolve({
                                    cert: "/a/b/cert.pem",
                                    certKey: "/a/b/cert.key.pem",
                                }),
                                resolve: jest.fn(),
                                reject: jest.fn(),
                            },
                            panel: { dispose: jest.fn() } as any,
                        } as any),
                        arg: [test.context, test.value],
                    },
                ],
            },
            {
                name: "onDidChangeConfiguration:1",
                mock: [
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_LOGS_FOLDER_PATH], ret: true },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_AUTOMATIC_PROFILE_VALIDATION], ret: false },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_SECURE_CREDENTIALS_ENABLED], ret: false },
                ],
            },
            {
                name: "onDidChangeConfiguration:2",
                mock: [
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_LOGS_FOLDER_PATH], ret: false },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_AUTOMATIC_PROFILE_VALIDATION], ret: false },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_SECURE_CREDENTIALS_ENABLED], ret: false },
                ],
            },
            {
                name: "onDidChangeConfiguration:3",
                mock: [
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_LOGS_FOLDER_PATH], ret: false },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_AUTOMATIC_PROFILE_VALIDATION], ret: true },
                    { spy: jest.spyOn(Profiles, "getInstance"), arg: [], ret: profileMocks },
                    { spy: jest.spyOn(SharedActions, "refreshAll"), arg: [] },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_SECURE_CREDENTIALS_ENABLED], ret: false },
                ],
            },
            {
                name: "onDidChangeConfiguration:4",
                mock: [
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_LOGS_FOLDER_PATH], ret: false },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_AUTOMATIC_PROFILE_VALIDATION], ret: false },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_SECURE_CREDENTIALS_ENABLED], ret: false },
                ],
            },
            {
                name: "onDidChangeConfiguration:5",
                mock: [
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_LOGS_FOLDER_PATH], ret: false },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_AUTOMATIC_PROFILE_VALIDATION], ret: false },
                    { spy: jest.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_SECURE_CREDENTIALS_ENABLED], ret: true },
                    { spy: jest.spyOn(executeCommand, "fun"), arg: ["zowe.updateSecureCredentials"] },
                ],
            },
            {
                name: "zowe.openRecentMember",
                mock: [{ spy: jest.spyOn(SharedActions, "openRecentMemberPrompt"), arg: ["ds", "uss"] }],
            },
            {
                name: "zowe.searchInAllLoadedItems",
                mock: [{ spy: jest.spyOn(SharedActions, "searchInAllLoadedItems"), arg: ["ds", "uss"] }],
            },
            {
                name: "onDidSaveTextDocument:1",
                parm: [{ isDirty: false, fileName: "_", uri: vscode.Uri.parse("") }],
                mock: [],
            },
            {
                name: "onDidSaveTextDocument:2",
                parm: [{ isDirty: true, fileName: "NOT_DATASET" }],
                mock: [],
            },
            {
                name: "zowe.disableValidation",
                mock: [
                    { spy: jest.spyOn(Profiles, "getInstance"), arg: [], ret: profileMocks },
                    { spy: jest.spyOn(profileMocks, "disableValidation"), arg: [test.value] },
                    { spy: jest.spyOn(SharedTreeProviders, "getProviderForNode"), arg: [test.value], ret: treeProvider },
                    { spy: jest.spyOn(treeProvider, "refreshElement"), arg: [test.value] },
                ],
            },
            {
                name: "zowe.enableValidation",
                mock: [
                    { spy: jest.spyOn(Profiles, "getInstance"), arg: [], ret: profileMocks },
                    { spy: jest.spyOn(profileMocks, "enableValidation"), arg: [test.value] },
                    { spy: jest.spyOn(SharedTreeProviders, "getProviderForNode"), arg: [test.value], ret: treeProvider },
                    { spy: jest.spyOn(treeProvider, "refreshElement"), arg: [test.value] },
                ],
            },
            {
                name: "zowe.ssoLogin",
                mock: [
                    { spy: jest.spyOn(SharedTreeProviders, "getProviderForNode"), arg: [test.value], ret: treeProvider },
                    { spy: jest.spyOn(treeProvider, "ssoLogin"), arg: [test.value] },
                ],
            },
            {
                name: "zowe.ssoLogout",
                mock: [
                    { spy: jest.spyOn(SharedTreeProviders, "getProviderForNode"), arg: [test.value], ret: treeProvider },
                    { spy: jest.spyOn(treeProvider, "ssoLogout"), arg: [test.value] },
                ],
            },
            {
                name: "zowe.deleteProfile",
                mock: [{ spy: jest.spyOn(Profiles, "getInstance"), arg: [], ret: profileMocks }],
            },
            {
                name: "zowe.editSession",
                mock: [
                    { spy: jest.spyOn(SharedTreeProviders, "getProviderForNode"), arg: [test.value], ret: treeProvider },
                    { spy: jest.spyOn(treeProvider, "editSession"), arg: [test.value] },
                ],
            },
            {
                name: "zowe.removeSession",
                mock: [
                    { spy: jest.spyOn(SharedContext, "isSession"), arg: [test.value], ret: true },
                    { spy: jest.spyOn(SharedTreeProviders, "getProviderForNode"), arg: [test.value], ret: treeProvider },
                    { spy: jest.spyOn(treeProvider, "deleteSession"), arg: [test.value, undefined] },
                ],
            },
            {
                name: "zowe.saveSearch",
                mock: [
                    { spy: jest.spyOn(SharedTreeProviders, "getProviderForNode"), arg: [test.value], ret: treeProvider },
                    { spy: jest.spyOn(treeProvider, "saveSearch"), arg: [test.value] },
                ],
            },
            {
                name: "zowe.addFavorite",
                mock: [
                    { spy: jest.spyOn(SharedTreeProviders, "getProviderForNode"), arg: [test.value], ret: treeProvider },
                    { spy: jest.spyOn(treeProvider, "addFavorite"), arg: [test.value] },
                ],
            },
            {
                name: "zowe.removeFavorite",
                mock: [
                    { spy: jest.spyOn(SharedTreeProviders, "getProviderForNode"), arg: [test.value], ret: treeProvider },
                    { spy: jest.spyOn(treeProvider, "removeFavorite"), arg: [test.value] },
                ],
            },
            {
                name: "zowe.removeFavProfile",
                parm: [{ label: test.value }],
                mock: [
                    { spy: jest.spyOn(SharedTreeProviders, "getProviderForNode"), arg: [test.value], ret: treeProvider },
                    { spy: jest.spyOn(treeProvider, "removeFavProfile"), arg: [test.value, true] },
                ],
            },
            {
                name: "zowe.openWithEncoding",
                mock: [
                    { spy: jest.spyOn(SharedTreeProviders, "getProviderForNode"), arg: [test.value], ret: treeProvider },
                    { spy: jest.spyOn(treeProvider, "openWithEncoding"), arg: [test.value, undefined] },
                ],
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
            {
                name: "zowe.selectForCompare",
                mock: [{ spy: jest.spyOn(LocalFileManagement, "selectFileForCompare"), arg: [test.value] }],
            },
            {
                name: "zowe.compareWithSelected",
                mock: [{ spy: jest.spyOn(LocalFileManagement, "compareChosenFileContent"), arg: [test.value] }],
            },
            {
                name: "zowe.compareWithSelectedReadOnly",
                mock: [{ spy: jest.spyOn(LocalFileManagement, "compareChosenFileContent"), arg: [test.value, true] }],
            },
            {
                name: "zowe.compareFileStarted",
                mock: [],
            },
            {
                name: "zowe.issueUnixCmd:1",
                mock: [{ spy: jest.spyOn(UnixCommandHandler, "getInstance"), arg: [], ret: { issueUnixCommand: jest.fn() } }],
            },
            {
                name: "zowe.issueUnixCmd:2",
                parm: [],
                mock: [{ spy: jest.spyOn(UnixCommandHandler, "getInstance"), arg: [], ret: { issueUnixCommand: jest.fn() } }],
            },
        ];

        beforeAll(() => {
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
            Object.defineProperty(core, "getZoweDir", { value: () => test.value });
            Object.defineProperty(vscode.commands, "executeCommand", { value: executeCommand.fun });
            Object.defineProperty(vscode.workspace, "onDidSaveTextDocument", { value: onDidSaveTextDocument });
            SharedInit.registerCommonCommands(test.context, test.value.providers);
        });
        afterAll(() => {
            jest.restoreAllMocks();
        });

        processSubscriptions(commands, test);
    });

    describe("watchConfigProfile", () => {
        let context: any;
        let watcherPromise: any;
        const spyReadFile = jest.fn().mockReturnValue("test");
        const mockEmitter = jest.fn();
        const watcher: any = {
            onDidCreate: jest.fn(),
            onDidDelete: jest.fn(),
            onDidChange: jest.fn(),
        };
        beforeEach(() => {
            context = { subscriptions: [] };
            jest.clearAllMocks();
            Object.defineProperty(vscode.workspace, "workspaceFolders", { value: [{ uri: { fsPath: "fsPath" } }], configurable: true });
            Object.defineProperty(vscode.workspace, "fs", { value: { readFile: spyReadFile }, configurable: true });
            Object.defineProperty(Constants, "SAVED_PROFILE_CONTENTS", { value: "test", configurable: true });
            jest.spyOn(vscode.workspace, "createFileSystemWatcher").mockReturnValue(watcher);
            jest.spyOn(ZoweExplorerApiRegister.getInstance().onProfilesUpdateEmitter, "fire").mockImplementation(mockEmitter);
        });

        afterAll(() => {
            jest.restoreAllMocks();
        });

        it("should be able to trigger onDidCreate listener", async () => {
            const spyRefreshAll = jest.spyOn(SharedActions, "refreshAll").mockImplementation();
            watcher.onDidCreate.mockImplementationOnce((fun) => (watcherPromise = fun()));
            SharedInit.watchConfigProfile(context);
            await watcherPromise;
            expect(context.subscriptions).toContain(watcher);
            expect(spyRefreshAll).toHaveBeenCalledTimes(1);
            expect(mockEmitter).toHaveBeenCalledTimes(1);
        });

        it("should be able to trigger onDidDelete listener", async () => {
            const spyRefreshAll = jest.spyOn(SharedActions, "refreshAll").mockImplementation();
            watcher.onDidDelete.mockImplementationOnce((fun) => (watcherPromise = fun()));
            SharedInit.watchConfigProfile(context);
            await watcherPromise;
            expect(context.subscriptions).toContain(watcher);
            expect(spyRefreshAll).toHaveBeenCalledTimes(1);
            expect(mockEmitter).toHaveBeenCalledTimes(1);
        });

        it("should be able to trigger onDidChange listener", async () => {
            const spyRefreshAll = jest.spyOn(SharedActions, "refreshAll").mockImplementation();
            watcher.onDidChange.mockImplementationOnce((fun) => (watcherPromise = fun("uri")));
            SharedInit.watchConfigProfile(context);
            await watcherPromise;
            expect(context.subscriptions).toContain(watcher);
            expect(spyReadFile).toHaveBeenCalledWith("uri");
            expect(spyRefreshAll).not.toHaveBeenCalled();
            expect(mockEmitter).not.toHaveBeenCalled();
        });

        it("should be able to trigger onDidChange listener with changes", async () => {
            const spyRefreshAll = jest.spyOn(SharedActions, "refreshAll").mockImplementation();
            spyReadFile.mockReturnValueOnce("other");
            watcher.onDidChange.mockImplementationOnce((fun) => (watcherPromise = fun("uri")));
            SharedInit.watchConfigProfile(context);
            await watcherPromise;
            expect(context.subscriptions).toContain(watcher);
            expect(spyReadFile).toHaveBeenCalledWith("uri");
            expect(spyRefreshAll).toHaveBeenCalledTimes(1);
            expect(mockEmitter).toHaveBeenCalledTimes(1);
        });

        it("should trigger callbacks when credentials or credManager are updated by another application", async () => {
            let onVaultUpdatedCallback, onCredentialManagerUpdatedCallback;
            const dummyWatcher: any = {
                subscribeUser: (_event, cb) => {
                    onVaultUpdatedCallback = cb;
                    return { close: () => {} } as any;
                },
                subscribeShared: (_event, cb) => {
                    onCredentialManagerUpdatedCallback = cb;
                    return { close: () => {} } as any;
                },
            };
            const spyWatcher = jest.spyOn(imperative.EventOperator, "getWatcher").mockReturnValue(dummyWatcher);
            const spyGuiError = jest.spyOn(Gui, "errorMessage");

            // Spy callback behavior
            const spyTranslatedLog = jest.spyOn(vscode.l10n, "t");
            const spyGetProfileInfo = jest.spyOn(profUtils.ProfilesUtils, "getProfileInfo").mockImplementationOnce(jest.fn());
            const spyReadConfigFromDisk = jest.spyOn(profUtils.ProfilesUtils, "readConfigFromDisk").mockImplementationOnce(jest.fn());
            const spyRefreshAll = jest.spyOn(SharedActions, "refreshAll").mockImplementation(jest.fn());

            // Setup watchers
            SharedInit.watchConfigProfile(context);

            expect(spyWatcher).toHaveBeenCalled();
            expect(spyGuiError).not.toHaveBeenCalled();

            jest.clearAllMocks();
            // Trigger Vault changes
            await onVaultUpdatedCallback();
            expect(spyTranslatedLog.mock.calls[0][0]).toContain("vault");
            expect(spyReadConfigFromDisk).toHaveBeenCalled();
            expect(spyRefreshAll).toHaveBeenCalled();

            jest.clearAllMocks();
            // Trigger Vault changes
            await onCredentialManagerUpdatedCallback();
            expect(spyTranslatedLog.mock.calls[0][0]).toContain("credential management");
            expect(spyGetProfileInfo).toHaveBeenCalled();
            expect(spyRefreshAll).toHaveBeenCalled();
        });

        it("should handle errors when watching for vault or credMgr changes", async () => {
            const testError = "__TEST_ERROR__";
            const spyWatcher = jest.spyOn(imperative.EventOperator, "getWatcher").mockImplementation(() => {
                throw testError;
            });
            const spyGuiError = jest.spyOn(Gui, "errorMessage");

            SharedInit.watchConfigProfile(context);

            expect(spyWatcher).toHaveBeenCalled();
            expect(spyGuiError.mock.calls[0][0]).toContain("vault changes");
            expect(spyGuiError.mock.calls[0][0]).toContain(testError);
            expect(spyGuiError.mock.calls[1][0]).toContain("credential manager changes");
            expect(spyGuiError.mock.calls[1][0]).toContain(testError);
        });

        it("should replace the function signature for EventProcessor.emitZoweEvent to set Constant.IGNORE_VAULT_CHANGE", async () => {
            const emitZoweEventOverride = jest.fn();
            const emitZoweEventMock = new MockedProperty(imperative.EventProcessor.prototype, "emitZoweEvent", {
                set: emitZoweEventOverride,
                configurable: true,
            });
            SharedInit.watchConfigProfile(context);
            expect(emitZoweEventOverride).toHaveBeenCalled();
            emitZoweEventMock[Symbol.dispose]();
        });

        it("should replace the function signature for EventProcessor.emitZoweEvent to set Constant.IGNORE_VAULT_CHANGE", async () => {
            const emitZoweEventOverride = jest.fn();
            const emitZoweEventMock = new MockedProperty(imperative.EventProcessor.prototype, "emitZoweEvent", {
                set: emitZoweEventOverride,
                configurable: true,
            });
            SharedInit.watchConfigProfile(context);
            expect(emitZoweEventOverride).toHaveBeenCalled();
            emitZoweEventMock[Symbol.dispose]();
        });

        it("should subscribe to the ON_VAULT_CHANGED event using EventProcessor.subscribeUser", async () => {
            const subscribeUser = jest.fn();
            const getWatcherMock = jest.spyOn(imperative.EventOperator, "getWatcher").mockReturnValue({
                subscribeUser,
            } as any);

            SharedInit.watchConfigProfile(context);
            expect(getWatcherMock).toHaveBeenCalled();
            expect(subscribeUser).toHaveBeenCalledWith(imperative.ZoweUserEvents.ON_VAULT_CHANGED, SharedInit.onVaultChanged);
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

        it("should setup listeners", () => {
            SharedInit.initSubscribers(context, provider);
            expect(context.subscriptions).toContain(treeView);
            expect(spyCollapse).toHaveBeenCalled();
            expect(spyExpand).toHaveBeenCalled();
            expect(spyFlipState).toHaveBeenCalledWith("collapse", false);
            expect(spyFlipState).toHaveBeenCalledWith("expand", true);
        });
    });

    describe("setupRemoteWorkspaceFolders", () => {
        const getFakeEventInfo = (added?: any): vscode.WorkspaceFoldersChangeEvent => ({
            added,
            removed: [],
        });
        it("should iterate over vscode.workspaces.workspaceFolders when no event is given", async () => {
            const fakeWorkspaceFolders = jest.fn().mockReturnValue([]);
            const workspaceFoldersPropertyMock = new MockedProperty(vscode.workspace, "workspaceFolders", {
                get: fakeWorkspaceFolders,
                configurable: true,
            });
            await SharedInit.setupRemoteWorkspaceFolders();
            expect(fakeWorkspaceFolders).toHaveBeenCalled();
            workspaceFoldersPropertyMock[Symbol.dispose]();
        });
        it("should iterate over the added folders when an event is given", async () => {
            const fakeEventInfo = getFakeEventInfo();
            const addedArr = jest.fn();
            Object.defineProperty(fakeEventInfo, "added", {
                get: addedArr,
            });
            await SharedInit.setupRemoteWorkspaceFolders(fakeEventInfo);
            expect(addedArr).toHaveBeenCalled();
        });
        it("calls DatasetFSProvider for ZoweScheme.DS", async () => {
            const fakeEventInfo = getFakeEventInfo([{ uri: vscode.Uri.from({ scheme: ZoweScheme.DS, path: "/lpar.zosmf/TEST.PDS" }) }]);
            const remoteLookupMock = jest.spyOn(DatasetFSProvider.instance, "remoteLookupForResource").mockImplementation();
            await SharedInit.setupRemoteWorkspaceFolders(fakeEventInfo);
            expect(remoteLookupMock).toHaveBeenCalled();
            remoteLookupMock.mockRestore();
        });
        it("calls DatasetFSProvider for ZoweScheme.USS", async () => {
            const fakeEventInfo = getFakeEventInfo([{ uri: vscode.Uri.from({ scheme: ZoweScheme.USS, path: "/lpar.zosmf/u/user/folder" }) }]);
            const remoteLookupMock = jest.spyOn(UssFSProvider.instance, "remoteLookupForResource").mockImplementation();
            await SharedInit.setupRemoteWorkspaceFolders(fakeEventInfo);
            expect(remoteLookupMock).toHaveBeenCalled();
            remoteLookupMock.mockRestore();
        });
        it("does nothing for file URIs", async () => {
            const fakeEventInfo = getFakeEventInfo([{ uri: vscode.Uri.from({ scheme: "file", path: "/a/b/c" }) }]);
            const remoteLookupDsSpy = jest.spyOn(DatasetFSProvider.instance, "remoteLookupForResource");
            const remoteLookupUssSpy = jest.spyOn(UssFSProvider.instance, "remoteLookupForResource");
            await SharedInit.setupRemoteWorkspaceFolders(fakeEventInfo);
            expect(remoteLookupDsSpy).not.toHaveBeenCalled();
            expect(remoteLookupUssSpy).not.toHaveBeenCalled();
        });
    });

    describe("emitZoweEventHook", () => {
        it("sets Constants.IGNORE_VAULT_CHANGE to true if emitZoweEvent is called and calls the original function", () => {
            const originalEmitZoweEvent = new MockedProperty(SharedInit, "originalEmitZoweEvent", undefined, jest.fn());
            SharedInit.emitZoweEventHook({} as any, imperative.ZoweUserEvents.ON_VAULT_CHANGED);
            expect(Constants.IGNORE_VAULT_CHANGE).toBe(true);
            expect(originalEmitZoweEvent.mock).toHaveBeenCalled();
            originalEmitZoweEvent[Symbol.dispose]();
        });
    });
    describe("onVaultChanged", () => {
        it("resets Constants.IGNORE_VAULT_CHANGE if it is true and returns early", async () => {
            const infoSpy = jest.spyOn(ZoweLogger, "info");
            Constants.IGNORE_VAULT_CHANGE = true;
            await SharedInit.onVaultChanged();
            expect(Constants.IGNORE_VAULT_CHANGE).toBe(false);
            expect(infoSpy).not.toHaveBeenCalled();
        });

        it("calls SharedActions.refreshAll and ProfilesUtils.readConfigFromDisk on vault change", async () => {
            const loggerInfo = jest.spyOn(ZoweLogger, "info").mockImplementation();
            const readCfgFromDisk = jest.spyOn(profUtils.ProfilesUtils, "readConfigFromDisk").mockImplementation();
            const refreshAll = jest.spyOn(SharedActions, "refreshAll").mockImplementation();
            await SharedInit.onVaultChanged();
            expect(loggerInfo).toHaveBeenCalledWith("Changes in the credential vault detected, refreshing Zowe Explorer.");
            expect(readCfgFromDisk).toHaveBeenCalled();
            expect(refreshAll).toHaveBeenCalled();
        });
    });
});
