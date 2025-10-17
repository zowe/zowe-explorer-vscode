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
import { FsAbstractUtils, FsJobsUtils, Gui, imperative, SpoolEntry, ZoweScheme } from "@zowe/zowe-explorer-api";
import { MockedProperty } from "../../../__mocks__/mockUtils";
import { ZoweLogger } from "../../../../src/tools/ZoweLogger";
import { SharedUtils } from "../../../../src/trees/shared/SharedUtils";
import { ReleaseNotes } from "../../../../src/utils/ReleaseNotes";
import { JobFSProvider } from "../../../../src/trees/job/JobFSProvider";

jest.mock("../../../../src/utils/LoggerUtils");
jest.mock("../../../../src/tools/ZoweLogger");
jest.mock("../../../../src/utils/ReleaseNotes");

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
        const cmdProviders = { mvs: { issueMvsCommand: jest.fn() }, tso: { issueTsoCommand: jest.fn() }, uss: { issueUnixCommand: jest.fn() } };
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
        const onProfileUpdated = jest.fn().mockReturnValue(new vscode.Disposable(jest.fn()));
        const mockOnProfileUpdated = new MockedProperty(ZoweExplorerApiRegister.getInstance(), "onProfileUpdated", undefined, onProfileUpdated);

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
                mock: [{ spy: jest.spyOn(SharedHistoryView, "SharedHistoryView"), arg: [test.context, test.value.providers, cmdProviders] }],
            },
            {
                name: "zowe.displayReleaseNotes",
                mock: [{ spy: jest.spyOn(ReleaseNotes, "display"), arg: [test.context, true] }],
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
                mock: [{ spy: jest.spyOn(TsoCommandHandler, "getInstance"), arg: [], ret: cmdProviders.tso }],
            },
            {
                name: "zowe.issueTsoCmd:2",
                parm: [],
                mock: [{ spy: jest.spyOn(TsoCommandHandler, "getInstance"), arg: [], ret: cmdProviders.tso }],
            },
            {
                name: "zowe.issueMvsCmd:1",
                mock: [{ spy: jest.spyOn(MvsCommandHandler, "getInstance"), arg: [], ret: cmdProviders.mvs }],
            },
            {
                name: "zowe.issueMvsCmd:2",
                parm: [],
                mock: [{ spy: jest.spyOn(MvsCommandHandler, "getInstance"), arg: [], ret: cmdProviders.mvs }],
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
                mock: [{ spy: jest.spyOn(UnixCommandHandler, "getInstance"), arg: [], ret: cmdProviders.uss }],
            },
            {
                name: "zowe.issueUnixCmd:2",
                parm: [],
                mock: [{ spy: jest.spyOn(UnixCommandHandler, "getInstance"), arg: [], ret: cmdProviders.uss }],
            },
        ];

        beforeAll(() => {
            test.context.extension = {
                packageJSON: {
                    version: "2.3.4",
                },
            };
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
            mockOnProfileUpdated[Symbol.dispose]();
            jest.restoreAllMocks();
        });

        processSubscriptions(commands, test);
        it("registers an onProfileUpdated event", () => {
            expect(mockOnProfileUpdated.mock).toHaveBeenCalledTimes(1);
            expect(onProfileUpdated).toHaveBeenCalledTimes(1);
        });

        it("should register setupRemoteWorkspaces", () => {
            jest.spyOn(vscode.commands, "registerCommand").mockImplementation(() => {
                return {} as vscode.Disposable;
            });
            SharedInit.registerCommonCommands(test.context, test.value.providers);
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith("zowe.setupRemoteWorkspaceFolders", expect.any(Function));
        });
    });

    describe("watchConfigProfile", () => {
        let context: any;
        let watcherPromise: any;
        const fakeUri = { fsPath: "fsPath" };
        const mockEmitter = jest.fn();
        const watcher: any = {
            onDidCreate: jest.fn(),
            onDidDelete: jest.fn(),
            onDidChange: jest.fn(),
        };
        beforeEach(() => {
            context = { subscriptions: [] };
            jest.clearAllMocks();
            Object.defineProperty(vscode.workspace, "workspaceFolders", { value: [{ uri: fakeUri }], configurable: true });
            jest.spyOn(vscode.workspace, "createFileSystemWatcher").mockReturnValue(watcher);
            jest.spyOn(ZoweExplorerApiRegister.getInstance().onProfilesUpdateEmitter, "fire").mockImplementation(mockEmitter);
            jest.spyOn(SharedUtils, "debounce").mockImplementation((cb: any) => cb);
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
            watcher.onDidChange.mockImplementationOnce((fun) => (watcherPromise = fun(fakeUri)));
            SharedInit.watchConfigProfile(context);
            await watcherPromise;
            expect(context.subscriptions).toContain(watcher);
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
            const spyGetProfileInfo = jest.spyOn(profUtils.ProfilesUtils, "setupProfileInfo").mockImplementationOnce(jest.fn());
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
    });

    describe("initSubscribers", () => {
        const spyCollapse = jest.fn().mockImplementation((fun) => fun({ element: "collapse" }));
        const spyExpand = jest.fn().mockImplementation((fun) => fun({ element: "expand" }));
        const spyOnCollapsibleStateChange = jest.fn();
        let context: any;
        const provider: any = { getTreeView: () => treeView, onCollapsibleStateChange: spyOnCollapsibleStateChange };
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
            expect(spyOnCollapsibleStateChange).toHaveBeenCalled();
        });
    });

    describe("setupRemoteWorkspaceFolders", () => {
        const getFakeEventInfo = (added?: any): vscode.WorkspaceFoldersChangeEvent => ({
            added,
            removed: [],
        });
        describe("extender types", () => {
            let mockGetSession: jest.Mock;
            let mockGetCommonApi: jest.Mock;

            beforeEach(() => {
                mockGetSession = jest.fn().mockReturnValue({
                    ISession: {
                        type: "ssh",
                    },
                });

                mockGetCommonApi = jest.fn().mockReturnValue({
                    getSession: mockGetSession,
                });

                jest.spyOn(ZoweExplorerApiRegister, "getInstance").mockReturnValue({
                    getCommonApi: mockGetCommonApi,
                } as any);
            });
            it("should setup a remote workspace for an extender type", async () => {
                const folderUri = {
                    $mid: 1,
                    fsPath: "/ssh_profile/u/users/user/member",
                    external: "zowe-uss:/ssh_profile/u/users/user/member",
                    path: "/ssh_profile/u/users/user/member",
                    scheme: "zowe-uss",
                    with: jest.fn().mockReturnValue({
                        $mid: 1,
                        fsPath: "/ssh_profile/u/users/user/member",
                        external: "zowe-uss:/ssh_profile/u/users/user/member",
                        path: "/ssh_profile/u/users/user/member",
                        scheme: "zowe-uss",
                        query: "fetch=true",
                    }),
                };
                jest.spyOn(FsAbstractUtils, "getInfoForUri").mockReturnValueOnce({
                    isRoot: false,
                    slashAfterProfilePos: 11,
                    profileName: "ssh_profile",
                    profile: { profile: {}, message: ".", type: "ssh", failNotFound: false },
                });

                const fakeWorkspaceFolders = jest.fn().mockReturnValue([folderUri]);
                new MockedProperty(vscode.workspace, "workspaceFolders", {
                    get: fakeWorkspaceFolders,
                    configurable: true,
                });

                // Replace real workspace with controlled data
                jest.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([
                    {
                        uri: folderUri as any,
                        name: "[ssh_profile] /u/users/user/member",
                        index: 0,
                    },
                ]);

                // Fake event fallback triggers workspaceFolders
                const fakeEventInfo = getFakeEventInfo();
                const addedArr = jest.fn(() => undefined);
                Object.defineProperty(fakeEventInfo, "added", {
                    get: addedArr,
                });

                // Mock getInfoForUri to return a profile name
                const getInfoSpy = jest.spyOn(FsAbstractUtils, "getInfoForUri").mockReturnValue({ profileName: "ssh_profile" } as any);

                // Match profile name
                await Profiles.createInstance(undefined as any);
                const getProfileSpy = jest
                    .spyOn(Profiles.getInstance(), "getProfiles")
                    .mockReturnValue([{ name: "ssh_profile", type: "ssh", message: ".", failNotFound: false }]);

                // Avoid real FS lookup
                const readDirMock = jest.spyOn(vscode.workspace.fs, "readDirectory").mockResolvedValue(undefined!);

                await SharedInit.setupRemoteWorkspaceFolders(fakeEventInfo, "ssh");

                expect(addedArr).toHaveBeenCalled();
                expect(getProfileSpy).toHaveBeenCalled();
                expect(getInfoSpy).toHaveBeenCalledWith(folderUri, expect.anything());
                expect(readDirMock).toHaveBeenCalled();
            });
        });
        describe("core types", () => {
            beforeEach(() => {
                const mockGetCommonApi = jest.fn();
                const mockGetSession = jest.fn().mockReturnValueOnce({
                    ISession: {
                        type: imperative.SessConstants.AUTH_TYPE_TOKEN,
                    },
                });
                jest.spyOn(ZoweExplorerApiRegister, "getInstance").mockReturnValueOnce({
                    getCommonApi: mockGetCommonApi.mockReturnValueOnce({
                        getSession: mockGetSession,
                    }),
                } as any);
                const mockProfile = {
                    name: "lpar.zosmf",
                    profile: {
                        tokenValue: "mock-token",
                    },
                };
                const mockGetProfiles = jest.fn().mockReturnValueOnce([mockProfile]);
                jest.spyOn(Profiles, "getInstance").mockReturnValueOnce({
                    getProfiles: mockGetProfiles,
                } as any);
                jest.spyOn(FsAbstractUtils, "getInfoForUri").mockReturnValueOnce({
                    isRoot: false,
                    slashAfterProfilePos: 11,
                    profileName: "lpar.zosmf",
                    profile: { profile: { tokenValue: "123-asdf-4567" }, message: ".", type: "zosmf", failNotFound: false },
                });
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
                const readDirMock = jest.spyOn(vscode.workspace.fs, "readDirectory").mockImplementation();
                await SharedInit.setupRemoteWorkspaceFolders(fakeEventInfo, "zosmf");
                expect(readDirMock).toHaveBeenCalled();
                readDirMock.mockRestore();
            });
            it("calls UssFSProvider for ZoweScheme.USS", async () => {
                const fakeEventInfo = getFakeEventInfo([{ uri: vscode.Uri.from({ scheme: ZoweScheme.USS, path: "/lpar.zosmf/u/user/folder" }) }]);
                const readDirMock = jest.spyOn(vscode.workspace.fs, "readDirectory").mockImplementation();
                await SharedInit.setupRemoteWorkspaceFolders(fakeEventInfo, "zosmf");
                expect(readDirMock).toHaveBeenCalled();
                readDirMock.mockRestore();
            });
            it("does nothing for file URIs", async () => {
                const fakeEventInfo = getFakeEventInfo([{ uri: vscode.Uri.from({ scheme: "file", path: "/a/b/c" }) }]);
                const readDirMock = jest.spyOn(vscode.workspace.fs, "readDirectory");
                await SharedInit.setupRemoteWorkspaceFolders(fakeEventInfo);
                expect(readDirMock).not.toHaveBeenCalled();
            });
            it("logs an error if one occurs", async () => {
                const fakeEventInfo = getFakeEventInfo([{ uri: vscode.Uri.from({ scheme: ZoweScheme.DS, path: "/lpar.zosmf/TEST.PDS" }) }]);
                const sampleError = new Error("issue fetching data set");
                const readDirMock = jest.spyOn(vscode.workspace.fs, "readDirectory").mockRejectedValueOnce(sampleError);
                const errorMock = jest.spyOn(ZoweLogger, "error").mockImplementation();
                await SharedInit.setupRemoteWorkspaceFolders(fakeEventInfo, "zosmf");
                expect(errorMock).toHaveBeenCalledWith(sampleError.message);
                expect(readDirMock).toHaveBeenCalled();
                readDirMock.mockRestore();
            });
        });
    });

    describe("isDocumentASpool", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        afterAll(() => {
            jest.restoreAllMocks();
        });

        it("should return true when document is a spool file", () => {
            const spoolEntry = new SpoolEntry("JESMSGLG.2");
            spoolEntry.type = vscode.FileType.File;
            spoolEntry.ctime = 0;
            spoolEntry.mtime = 0;
            spoolEntry.size = 0;
            spoolEntry.spool = {
                id: 2,
                ddname: "JESMSGLG",
                jobid: "JOB13965",
                jobname: "IYK2ZOD2",
                stepname: "JES2",
                recfm: "FB",
                "byte-count": 1024,
                "record-count": 100,
                "job-correlator": "correlator123",
                class: "A",
                "records-url": "http://example.com/records",
                lrecl: 80,
                subsystem: "",
                procstep: "",
            };

            // Mock the JobFSProvider.instance.lookup to return the SpoolEntry
            const spyLookup = jest.spyOn(JobFSProvider.instance, "lookup").mockReturnValue(spoolEntry);

            // isSpoolEntry should return true if it's given a SpoolEntry instance
            const spyIsSpoolEntry = jest.spyOn(FsJobsUtils, "isSpoolEntry");

            // Create a test URI
            const testUri = vscode.Uri.parse("zowe-jobs:/host.zosmf/JOB13965/IYK2ZOD2.JOB13965.JES2.JESMSGLG.2");

            // Call the method
            const result = SharedInit.isDocumentASpool(testUri);

            // Verify the result
            expect(result).toBe(true);
            expect(spyLookup).toHaveBeenCalledWith(testUri, false);
            expect(spyIsSpoolEntry).toHaveBeenCalledWith(expect.objectContaining({ name: "JESMSGLG.2" }));
        });

        it("should return false when document is not a spool file", () => {
            // Mock the JobFSProvider.instance.lookup to return a non-spool entry
            const spyLookup = jest.spyOn(JobFSProvider.instance, "lookup").mockReturnValue({
                name: "regular-file.txt",
                type: vscode.FileType.File,
                ctime: 0,
                mtime: 0,
                size: 0,
            } as any);

            const spyIsSpoolEntry = jest.spyOn(FsJobsUtils, "isSpoolEntry");

            // Create a test URI
            const testUri = vscode.Uri.parse("file:/path/to/regular-file.txt");

            // Call the method
            const result = SharedInit.isDocumentASpool(testUri);

            // Verify the result
            expect(result).toBe(false);
            expect(spyLookup).toHaveBeenCalledWith(testUri, false);
            expect(spyIsSpoolEntry).toHaveBeenCalledWith(expect.objectContaining({ name: "regular-file.txt" }));
        });

        it("should return false when lookup returns undefined", () => {
            // Mock the JobFSProvider.instance.lookup to return undefined
            const spyLookup = jest.spyOn(JobFSProvider.instance, "lookup").mockReturnValue(undefined);

            // Mock the FsJobsUtils.isSpoolEntry to return false
            const spyIsSpoolEntry = jest.spyOn(FsJobsUtils, "isSpoolEntry");

            // Create a test URI
            const testUri = vscode.Uri.parse("file:/path/to/nonexistent-file.txt");

            // Call the method
            const result = SharedInit.isDocumentASpool(testUri);

            // Verify the result
            expect(result).toBe(false);
            expect(spyLookup).toHaveBeenCalledWith(testUri, false);
            expect(spyIsSpoolEntry).toHaveBeenCalledWith(undefined);
        });
    });
});
