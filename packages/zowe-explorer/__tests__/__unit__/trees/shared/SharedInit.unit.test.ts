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
import { Mock, MockInstance, vi } from "vitest";
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
import { SettingsConfig } from "../../../../src/configuration/SettingsConfig";

vi.mock("../../../../src/utils/LoggerUtils");
vi.mock("../../../../src/tools/ZoweLogger");
vi.mock("../../../../src/utils/ReleaseNotes");

vi.mock("../../../../src/tools/ZoweLocalStorage", () => ({
    ZoweLocalStorage: {
        globalState: { get: vi.fn(), update: vi.fn() },
        workspaceState: { get: vi.fn(), update: vi.fn() },
        getValue: vi.fn(),
        setValue: vi.fn(),
    },
}));

describe("Test src/shared/extension", () => {
    describe("registerCommonCommands", () => {
        const executeCommand = { fun: vi.fn() };
        const test: ITestContext = {
            context: { subscriptions: [] },
            value: {
                test: "shared",
                providers: { ds: "ds", uss: "uss", job: "job" },
                affectsConfiguration: vi.fn(),
                document: vi.fn(),
                text: "\n",
            },
            _: { _: "_" },
        };
        const profileMocks = { deleteProfile: vi.fn(), disableValidation: vi.fn(), enableValidation: vi.fn(), refresh: vi.fn() };
        const cmdProviders = { mvs: { issueMvsCommand: vi.fn() }, tso: { issueTsoCommand: vi.fn() }, uss: { issueUnixCommand: vi.fn() } };
        const treeProvider = {
            addFavorite: vi.fn(),
            deleteSession: vi.fn(),
            editSession: vi.fn(),
            getTreeView: vi.fn().mockReturnValue({ reveal: vi.fn() }),
            openWithEncoding: vi.fn(),
            refreshElement: vi.fn(),
            removeFavorite: vi.fn(),
            removeFavProfile: vi.fn(),
            saveSearch: vi.fn(),
            ssoLogin: vi.fn(),
            ssoLogout: vi.fn(),
        };
        const onProfileUpdated = vi.fn().mockReturnValue(new vscode.Disposable(vi.fn()));
        const mockOnProfileUpdated = new MockedProperty(ZoweExplorerApiRegister.getInstance(), "onProfileUpdated", undefined, onProfileUpdated);

        const commands: IJestIt[] = [
            {
                name: "zowe.updateSecureCredentials",
                parm: ["@zowe/cli"],
                mock: [
                    { spy: vi.spyOn(profUtils.ProfilesUtils, "updateCredentialManagerSetting"), arg: ["@zowe/cli"] },
                    { spy: vi.spyOn(profUtils.ProfilesUtils, "writeOverridesFile"), arg: [] },
                ],
            },
            {
                name: "zowe.manualPoll",
                mock: [],
            },
            {
                name: "zowe.editHistory",
                mock: [{ spy: vi.spyOn(SharedHistoryView, "SharedHistoryView"), arg: [test.context, test.value.providers, cmdProviders] }],
            },
            {
                name: "zowe.displayReleaseNotes",
                mock: [{ spy: vi.spyOn(ReleaseNotes, "display"), arg: [test.context, true] }],
            },
            {
                name: "zowe.promptCredentials",
                mock: [{ spy: vi.spyOn(profUtils.ProfilesUtils, "promptCredentials"), arg: [test.value] }],
            },
            {
                name: "zowe.certificateWizard",
                mock: [
                    {
                        spy: vi.spyOn(certWizard, "CertificateWizard").mockReturnValueOnce({
                            userSubmission: {
                                promise: Promise.resolve({
                                    cert: "/a/b/cert.pem",
                                    certKey: "/a/b/cert.key.pem",
                                }),
                                resolve: vi.fn(),
                                reject: vi.fn(),
                            },
                            panel: { dispose: vi.fn() } as any,
                        } as any),
                        arg: [test.context, test.value],
                    },
                ],
            },
            {
                name: "onDidChangeConfiguration:1",
                mock: [
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_EXPERIMENTAL_NATIVE_SSH], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_LOGS_FOLDER_PATH], ret: true },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_AUTOMATIC_PROFILE_VALIDATION], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_SECURE_CREDENTIALS_ENABLED], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_ZOSMF_MAX_CONCURRENT_REQUESTS], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_ZOSMF_QUEUE_TIMEOUT], ret: false },
                ],
            },
            {
                name: "onDidChangeConfiguration:2",
                mock: [
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_EXPERIMENTAL_NATIVE_SSH], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_LOGS_FOLDER_PATH], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.LOGGER_SETTINGS], ret: true },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_AUTOMATIC_PROFILE_VALIDATION], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_SECURE_CREDENTIALS_ENABLED], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_ZOSMF_MAX_CONCURRENT_REQUESTS], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_ZOSMF_QUEUE_TIMEOUT], ret: false },
                ],
            },
            {
                name: "onDidChangeConfiguration:3",
                mock: [
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_EXPERIMENTAL_NATIVE_SSH], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_LOGS_FOLDER_PATH], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.LOGGER_SETTINGS], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_AUTOMATIC_PROFILE_VALIDATION], ret: true },
                    { spy: vi.spyOn(Profiles, "getInstance"), arg: [], ret: profileMocks },
                    { spy: vi.spyOn(SharedActions, "refreshAll"), arg: [] },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_SECURE_CREDENTIALS_ENABLED], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_ZOSMF_MAX_CONCURRENT_REQUESTS], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_ZOSMF_QUEUE_TIMEOUT], ret: false },
                ],
            },
            {
                name: "onDidChangeConfiguration:4",
                mock: [
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_EXPERIMENTAL_NATIVE_SSH], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_LOGS_FOLDER_PATH], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.LOGGER_SETTINGS], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_AUTOMATIC_PROFILE_VALIDATION], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_SECURE_CREDENTIALS_ENABLED], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_ZOSMF_MAX_CONCURRENT_REQUESTS], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_ZOSMF_QUEUE_TIMEOUT], ret: false },
                ],
            },
            {
                name: "onDidChangeConfiguration:5",
                mock: [
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_EXPERIMENTAL_NATIVE_SSH], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_LOGS_FOLDER_PATH], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.LOGGER_SETTINGS], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_AUTOMATIC_PROFILE_VALIDATION], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_SECURE_CREDENTIALS_ENABLED], ret: true },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_ZOSMF_MAX_CONCURRENT_REQUESTS], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_ZOSMF_QUEUE_TIMEOUT], ret: false },
                    { spy: vi.spyOn(executeCommand, "fun"), arg: ["zowe.updateSecureCredentials"] },
                ],
            },
            {
                name: "onDidChangeConfiguration:6",
                mock: [
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_EXPERIMENTAL_NATIVE_SSH], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_LOGS_FOLDER_PATH], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.LOGGER_SETTINGS], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_AUTOMATIC_PROFILE_VALIDATION], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_SECURE_CREDENTIALS_ENABLED], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_ZOSMF_MAX_CONCURRENT_REQUESTS], ret: true },
                    {
                        spy: vi.spyOn(SettingsConfig, "getDirectValue"),
                        arg: [Constants.SETTINGS_ZOSMF_MAX_CONCURRENT_REQUESTS, Constants.ZOSMF_DEFAULT_MAX_CONCURRENT_REQUESTS],
                        ret: 10,
                    },
                    { spy: vi.spyOn(core.ZosmfRestClient, "setThrottlingOptions"), arg: [{ maxConcurrentRequests: 10 }] },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_ZOSMF_QUEUE_TIMEOUT], ret: false },
                ],
            },
            {
                name: "onDidChangeConfiguration:7",
                mock: [
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_EXPERIMENTAL_NATIVE_SSH], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_LOGS_FOLDER_PATH], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.LOGGER_SETTINGS], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_AUTOMATIC_PROFILE_VALIDATION], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_SECURE_CREDENTIALS_ENABLED], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_ZOSMF_MAX_CONCURRENT_REQUESTS], ret: false },
                    { spy: vi.spyOn(test.value, "affectsConfiguration"), arg: [Constants.SETTINGS_ZOSMF_QUEUE_TIMEOUT], ret: true },
                    {
                        spy: vi.spyOn(SettingsConfig, "getDirectValue"),
                        arg: [Constants.SETTINGS_ZOSMF_QUEUE_TIMEOUT, Constants.ZOSMF_DEFAULT_REQUEST_QUEUE_TIMEOUT],
                        ret: 300000,
                    },
                    { spy: vi.spyOn(core.ZosmfRestClient, "setThrottlingOptions"), arg: [{ queueTimeout: 300000 }] },
                ],
            },
            {
                name: "zowe.openRecentMember",
                mock: [{ spy: vi.spyOn(SharedActions, "openRecentMemberPrompt"), arg: ["ds", "uss"] }],
            },
            {
                name: "zowe.searchInAllLoadedItems",
                mock: [{ spy: vi.spyOn(SharedActions, "searchInAllLoadedItems"), arg: ["ds", "uss"] }],
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
                    { spy: vi.spyOn(Profiles, "getInstance"), arg: [], ret: profileMocks },
                    { spy: vi.spyOn(profileMocks, "disableValidation"), arg: [test.value] },
                    { spy: vi.spyOn(SharedTreeProviders, "getProviderForNode"), arg: [test.value], ret: treeProvider },
                    { spy: vi.spyOn(treeProvider, "refreshElement"), arg: [test.value] },
                ],
            },
            {
                name: "zowe.enableValidation",
                mock: [
                    { spy: vi.spyOn(Profiles, "getInstance"), arg: [], ret: profileMocks },
                    { spy: vi.spyOn(profileMocks, "enableValidation"), arg: [test.value] },
                    { spy: vi.spyOn(SharedTreeProviders, "getProviderForNode"), arg: [test.value], ret: treeProvider },
                    { spy: vi.spyOn(treeProvider, "refreshElement"), arg: [test.value] },
                ],
            },
            {
                name: "zowe.ssoLogin",
                mock: [
                    { spy: vi.spyOn(SharedTreeProviders, "getProviderForNode"), arg: [test.value], ret: treeProvider },
                    { spy: vi.spyOn(treeProvider, "ssoLogin"), arg: [test.value] },
                ],
            },
            {
                name: "zowe.ssoLogout",
                mock: [
                    { spy: vi.spyOn(SharedTreeProviders, "getProviderForNode"), arg: [test.value], ret: treeProvider },
                    { spy: vi.spyOn(treeProvider, "ssoLogout"), arg: [test.value] },
                ],
            },
            {
                name: "zowe.deleteProfile",
                mock: [{ spy: vi.spyOn(Profiles, "getInstance"), arg: [], ret: profileMocks }],
            },
            {
                name: "zowe.editSession",
                mock: [
                    { spy: vi.spyOn(SharedTreeProviders, "getProviderForNode"), arg: [test.value], ret: treeProvider },
                    { spy: vi.spyOn(treeProvider, "editSession"), arg: [test.value] },
                ],
            },
            {
                name: "zowe.removeSession",
                mock: [
                    { spy: vi.spyOn(SharedContext, "isSession"), arg: [test.value], ret: true },
                    { spy: vi.spyOn(SharedTreeProviders, "getProviderForNode"), arg: [test.value], ret: treeProvider },
                    { spy: vi.spyOn(treeProvider, "deleteSession"), arg: [test.value, undefined] },
                    { spy: vi.spyOn(SharedTreeProviders, "getProviderForNode"), arg: [test.value], ret: treeProvider },
                ],
            },
            {
                name: "zowe.saveSearch",
                mock: [
                    { spy: vi.spyOn(SharedTreeProviders, "getProviderForNode"), arg: [test.value], ret: treeProvider },
                    { spy: vi.spyOn(treeProvider, "saveSearch"), arg: [test.value] },
                ],
            },
            {
                name: "zowe.addFavorite",
                mock: [
                    { spy: vi.spyOn(SharedTreeProviders, "getProviderForNode"), arg: [test.value], ret: treeProvider },
                    { spy: vi.spyOn(treeProvider, "addFavorite"), arg: [test.value] },
                ],
            },
            {
                name: "zowe.removeFavorite",
                mock: [
                    { spy: vi.spyOn(SharedTreeProviders, "getProviderForNode"), arg: [test.value], ret: treeProvider },
                    { spy: vi.spyOn(treeProvider, "removeFavorite"), arg: [test.value] },
                ],
            },
            {
                name: "zowe.removeFavProfile",
                parm: [{ label: test.value }],
                mock: [
                    { spy: vi.spyOn(SharedTreeProviders, "getProviderForNode"), arg: [{ label: test.value }], ret: treeProvider },
                    { spy: vi.spyOn(treeProvider, "removeFavProfile"), arg: [test.value, true] },
                ],
            },
            {
                name: "zowe.openWithEncoding",
                mock: [
                    { spy: vi.spyOn(SharedTreeProviders, "getProviderForNode"), arg: [test.value], ret: treeProvider },
                    { spy: vi.spyOn(treeProvider, "openWithEncoding"), arg: [test.value, undefined] },
                ],
            },
            {
                name: "zowe.issueTsoCmd:1",
                mock: [{ spy: vi.spyOn(cmdProviders.tso, "issueTsoCommand"), arg: [undefined, undefined, test.value] }],
            },
            {
                name: "zowe.issueTsoCmd:2",
                parm: [],
                mock: [{ spy: vi.spyOn(cmdProviders.tso, "issueTsoCommand"), arg: [] }],
            },
            {
                name: "zowe.issueMvsCmd:1",
                mock: [{ spy: vi.spyOn(cmdProviders.mvs, "issueMvsCommand"), arg: [undefined, undefined, test.value] }],
            },
            {
                name: "zowe.issueMvsCmd:2",
                parm: [],
                mock: [{ spy: vi.spyOn(cmdProviders.mvs, "issueMvsCommand"), arg: [] }],
            },
            {
                name: "zowe.selectForCompare",
                mock: [{ spy: vi.spyOn(LocalFileManagement, "selectFileForCompare"), arg: [test.value] }],
            },
            {
                name: "zowe.compareWithSelected",
                mock: [{ spy: vi.spyOn(LocalFileManagement, "compareChosenFileContent"), arg: [test.value] }],
            },
            {
                name: "zowe.compareWithSelectedReadOnly",
                mock: [{ spy: vi.spyOn(LocalFileManagement, "compareChosenFileContent"), arg: [test.value, true] }],
            },
            {
                name: "zowe.compareFileStarted",
                mock: [],
            },
            {
                name: "zowe.issueUnixCmd:1",
                mock: [{ spy: vi.spyOn(cmdProviders.uss, "issueUnixCommand"), arg: [test.value, undefined] }],
            },
            {
                name: "zowe.issueUnixCmd:2",
                parm: [],
                mock: [{ spy: vi.spyOn(cmdProviders.uss, "issueUnixCommand"), arg: [] }],
            },
        ];

        let zosmfRestClientSetThrottleOptionsSpy: MockInstance;
        beforeAll(() => {
            vi.spyOn(MvsCommandHandler, "getInstance").mockReturnValue(cmdProviders.mvs as any);
            vi.spyOn(TsoCommandHandler, "getInstance").mockReturnValue(cmdProviders.tso as any);
            vi.spyOn(UnixCommandHandler, "getInstance").mockReturnValue(cmdProviders.uss as any);
            vi.spyOn(SettingsConfig, "getDirectValue").mockImplementation((key: string, defaultValue?: unknown): unknown => {
                return defaultValue;
            });
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
            zosmfRestClientSetThrottleOptionsSpy = vi.spyOn(core.ZosmfRestClient, "setThrottlingOptions");
            SharedInit.registerCommonCommands(test.context, test.value.providers);
        });

        afterAll(() => {
            mockOnProfileUpdated[Symbol.dispose]();
            vi.restoreAllMocks();
        });

        it("should set up throttling for z/OSMF", () => {
            // This test needs to be first.
            const spyCalls = zosmfRestClientSetThrottleOptionsSpy.mock.calls;
            zosmfRestClientSetThrottleOptionsSpy.mockReset();
            expect(spyCalls[0][0]).toEqual({
                maxConcurrentRequests: Constants.ZOSMF_DEFAULT_MAX_CONCURRENT_REQUESTS,
                queueTimeout: Constants.ZOSMF_DEFAULT_REQUEST_QUEUE_TIMEOUT,
            });
        });

        processSubscriptions(commands, test);

        it("registers an onProfileUpdated event", () => {
            expect(mockOnProfileUpdated.mock).toHaveBeenCalledTimes(1);
            expect(onProfileUpdated).toHaveBeenCalledTimes(1);
        });

        it("should register setupRemoteWorkspaces", () => {
            vi.spyOn(vscode.commands, "registerCommand").mockImplementation(() => {
                return {} as vscode.Disposable;
            });
            SharedInit.registerCommonCommands(test.context, test.value.providers);
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith("zowe.setupRemoteWorkspaceFolders", expect.any(Function));
        });
    });

    describe("onDidChangeTabs - tab close focus restoration", () => {
        let context: any;
        let onDidChangeTabs: Mock;
        let capturedTabsHandler: (e: any) => Promise<void>;
        const mockReveal = vi.fn().mockResolvedValue(undefined);
        const mockGetTreeView = vi.fn().mockReturnValue({ reveal: mockReveal });
        const mockNode = { label: "TEST.DS", resourceUri: vscode.Uri.from({ scheme: ZoweScheme.DS, path: "/profile/TEST.DS" }) };
        const mockProvider = {
            getTreeView: mockGetTreeView,
            mSessionNodes: [mockNode],
        };

        const mockActiveTab = (uri: vscode.Uri | null) => {
            Object.defineProperty(vscode.window, "tabGroups", {
                value: {
                    onDidChangeTabs,
                    activeTabGroup: {
                        activeTab: uri ? { input: new vscode.TabInputText(uri) } : null,
                    },
                    all: uri ? [{ tabs: [{ input: new vscode.TabInputText(uri) }] }] : [{ tabs: [] }],
                },
                configurable: true,
                writable: true,
            });
        };

        beforeEach(() => {
            context = { subscriptions: [] };
            vi.useFakeTimers();

            Object.defineProperty(vscode, "workspace", {
                value: {
                    ...vscode.workspace,
                    onDidChangeConfiguration: vi.fn().mockReturnValue({ dispose: vi.fn() }),
                    onDidSaveTextDocument: vi.fn().mockReturnValue({ dispose: vi.fn() }),
                },
                configurable: true,
                writable: true,
            });

            Object.defineProperty(vscode, "commands", {
                value: {
                    ...vscode.commands,
                    registerCommand: vi.fn().mockReturnValue({ dispose: vi.fn() }),
                    executeCommand: vi.fn(),
                },
                configurable: true,
                writable: true,
            });

            vi.spyOn(MvsCommandHandler, "getInstance").mockReturnValue({ issueMvsCommand: vi.fn() } as any);
            vi.spyOn(TsoCommandHandler, "getInstance").mockReturnValue({ issueTsoCommand: vi.fn() } as any);
            vi.spyOn(UnixCommandHandler, "getInstance").mockReturnValue({ issueUnixCommand: vi.fn() } as any);

            onDidChangeTabs = vi.fn().mockImplementation((handler) => {
                capturedTabsHandler = handler;
                return { dispose: vi.fn() };
            });

            Object.defineProperty(vscode.window, "tabGroups", {
                value: { onDidChangeTabs, activeTabGroup: { activeTab: null }, all: [{ tabs: [] }] },
                configurable: true,
                writable: true,
            });

            vi.spyOn(vscode.window, "setStatusBarMessage").mockReturnValue({ dispose: vi.fn() } as any);
            vi.spyOn(vscode.l10n, "t").mockImplementation((msg: string, ...args: any[]) => args.reduce((m, a) => m.replace("{0}", a), msg));

            SharedInit.isRestoringFocus = false;
            mockReveal.mockClear();

            vi.spyOn(SharedTreeProviders, "ds", "get").mockReturnValue(mockProvider as any);
            vi.spyOn(SharedTreeProviders, "uss", "get").mockReturnValue(mockProvider as any);
            vi.spyOn(SharedTreeProviders, "job", "get").mockReturnValue(mockProvider as any);

            SharedInit.registerCommonCommands(context, { ds: mockProvider, uss: mockProvider, job: mockProvider } as any);
        });

        afterEach(() => {
            Object.defineProperty(vscode, "workspace", {
                value: { ...vscode.workspace },
                configurable: true,
                writable: true,
            });
            Object.defineProperty(vscode, "commands", {
                value: { ...vscode.commands },
                configurable: true,
                writable: true,
            });
            vi.useRealTimers();
            vi.restoreAllMocks();
        });

        it("should register the onDidChangeTabs event listener", () => {
            expect(onDidChangeTabs).toHaveBeenCalledTimes(1);
            expect(typeof capturedTabsHandler).toBe("function");
        });

        it("should restore focus when a Zowe DS tab is closed and active editor is a Zowe DS resource", async () => {
            const activeUri = vscode.Uri.from({ scheme: ZoweScheme.DS, path: "/profile/TEST.DS" });
            mockActiveTab(activeUri);

            const closedTab = {
                input: new vscode.TabInputText(vscode.Uri.from({ scheme: ZoweScheme.DS, path: "/profile/CLOSED.DS" })),
            };

            const handlerPromise = capturedTabsHandler({ closed: [closedTab], opened: [], changed: [] });
            await vi.runAllTimersAsync();
            await handlerPromise;

            expect(mockReveal).toHaveBeenCalledWith(mockNode, { select: true, focus: true });
        });

        it("should restore focus when a Zowe USS tab is closed and active editor is a Zowe USS resource", async () => {
            const ussNode = {
                label: "file.txt",
                resourceUri: vscode.Uri.from({ scheme: ZoweScheme.USS, path: "/profile/u/user/file.txt" }),
            };
            const ussProvider = { getTreeView: mockGetTreeView, mSessionNodes: [ussNode] };
            vi.spyOn(SharedTreeProviders, "uss", "get").mockReturnValue(ussProvider as any);

            const activeUri = vscode.Uri.from({ scheme: ZoweScheme.USS, path: "/profile/u/user/file.txt" });
            mockActiveTab(activeUri);

            const closedTab = {
                input: new vscode.TabInputText(vscode.Uri.from({ scheme: ZoweScheme.DS, path: "/profile/TEST.DS" })),
            };

            const handlerPromise = capturedTabsHandler({ closed: [closedTab], opened: [], changed: [] });
            await vi.runAllTimersAsync();
            await handlerPromise;

            expect(mockReveal).toHaveBeenCalledWith(ussNode, { select: true, focus: true });
        });

        it("should restore focus when a Zowe Jobs tab is closed and active editor is a Zowe Jobs resource", async () => {
            const jobNode = {
                label: "JOB123",
                resourceUri: vscode.Uri.from({ scheme: ZoweScheme.Jobs, path: "/profile/JOB123" }),
            };
            const jobProvider = { getTreeView: mockGetTreeView, mSessionNodes: [jobNode] };
            vi.spyOn(SharedTreeProviders, "job", "get").mockReturnValue(jobProvider as any);

            const activeUri = vscode.Uri.from({ scheme: ZoweScheme.Jobs, path: "/profile/JOB123" });
            mockActiveTab(activeUri);

            const closedTab = {
                input: new vscode.TabInputText(vscode.Uri.from({ scheme: ZoweScheme.DS, path: "/profile/TEST.DS" })),
            };

            const handlerPromise = capturedTabsHandler({ closed: [closedTab], opened: [], changed: [] });
            await vi.runAllTimersAsync();
            await handlerPromise;

            expect(mockReveal).toHaveBeenCalledWith(jobNode, { select: true, focus: true });
        });

        it("should not restore focus when active editor is not a Zowe resource", async () => {
            const activeUri = vscode.Uri.from({ scheme: "file", path: "/local/file.txt" });
            mockActiveTab(activeUri);

            const closedTab = {
                input: new vscode.TabInputText(vscode.Uri.from({ scheme: ZoweScheme.DS, path: "/profile/TEST.DS" })),
            };

            const handlerPromise = capturedTabsHandler({ closed: [closedTab], opened: [], changed: [] });
            await vi.runAllTimersAsync();
            await handlerPromise;

            expect(mockReveal).not.toHaveBeenCalled();
        });

        it("should not restore focus when no tabs are closed", async () => {
            await capturedTabsHandler({ closed: [], opened: [], changed: [] });
            expect(mockReveal).not.toHaveBeenCalled();
        });

        it("should not restore focus when isRestoringFocus is true", async () => {
            SharedInit.isRestoringFocus = true;

            const closedTab = {
                input: new vscode.TabInputText(vscode.Uri.from({ scheme: ZoweScheme.DS, path: "/profile/TEST.DS" })),
            };

            await capturedTabsHandler({ closed: [closedTab], opened: [], changed: [] });
            expect(mockReveal).not.toHaveBeenCalled();
        });

        it("should not restore focus when closed tab is not a Zowe resource", async () => {
            const closedTab = {
                input: new vscode.TabInputText(vscode.Uri.from({ scheme: "file", path: "/a/b/c.txt" })),
            };

            await capturedTabsHandler({ closed: [closedTab], opened: [], changed: [] });
            expect(mockReveal).not.toHaveBeenCalled();
        });

        it("should not restore focus when node is not found in tree", async () => {
            const activeUri = vscode.Uri.from({ scheme: ZoweScheme.DS, path: "/profile/NOT.FOUND" });
            mockActiveTab(activeUri);

            const notFoundProvider = { getTreeView: mockGetTreeView, mSessionNodes: [] };
            vi.spyOn(SharedTreeProviders, "ds", "get").mockReturnValue(notFoundProvider as any);

            const closedTab = {
                input: new vscode.TabInputText(vscode.Uri.from({ scheme: ZoweScheme.DS, path: "/profile/TEST.DS" })),
            };

            const handlerPromise = capturedTabsHandler({ closed: [closedTab], opened: [], changed: [] });
            await vi.runAllTimersAsync();
            await handlerPromise;

            expect(mockReveal).not.toHaveBeenCalled();
        });

        it("should not restore focus when the last tab is closed", async () => {
            (vscode.window.tabGroups.all as any) = [];
            (vscode.window.tabGroups.activeTabGroup as any) = {
                activeTab: null,
            };

            const closedTab = {
                input: new vscode.TabInputText(
                    vscode.Uri.from({
                        scheme: ZoweScheme.DS,
                        path: "/profile/TEST.DS",
                    })
                ),
            };

            const handlerPromise = capturedTabsHandler({
                closed: [closedTab],
                opened: [],
                changed: [],
            });

            await vi.runAllTimersAsync();
            await handlerPromise;
            expect(mockReveal).not.toHaveBeenCalled();
        });

        it("should handle errors during focus restoration", async () => {
            const activeUri = vscode.Uri.from({ scheme: ZoweScheme.DS, path: "/profile/TEST.DS" });
            mockActiveTab(activeUri);
            mockReveal.mockRejectedValueOnce(new Error("reveal failed"));

            const closedTab = {
                input: new vscode.TabInputText(vscode.Uri.from({ scheme: ZoweScheme.DS, path: "/profile/TEST.DS" })),
            };

            const handlerPromise = capturedTabsHandler({ closed: [closedTab], opened: [], changed: [] });
            await vi.runAllTimersAsync();
            await handlerPromise;

            expect(SharedInit.isRestoringFocus).toBe(false);
        });

        it("should reset isRestoringFocus flag after successful restoration", async () => {
            const activeUri = vscode.Uri.from({ scheme: ZoweScheme.DS, path: "/profile/TEST.DS" });
            mockActiveTab(activeUri);

            const closedTab = {
                input: new vscode.TabInputText(vscode.Uri.from({ scheme: ZoweScheme.DS, path: "/profile/TEST.DS" })),
            };

            const handlerPromise = capturedTabsHandler({ closed: [closedTab], opened: [], changed: [] });
            await vi.runAllTimersAsync();
            await handlerPromise;

            expect(SharedInit.isRestoringFocus).toBe(false);
        });

        it("should not restore focus for non-TabInputText input types", async () => {
            const closedTab = {
                input: { uri: vscode.Uri.from({ scheme: ZoweScheme.DS, path: "/profile/TEST.DS" }) },
            };

            await capturedTabsHandler({ closed: [closedTab], opened: [], changed: [] });
            expect(mockReveal).not.toHaveBeenCalled();
        });
    });

    describe("watchConfigProfile", () => {
        let context: any;
        let watcherPromise: any;
        const fakeUri = { fsPath: "fsPath" };
        const mockEmitter = vi.fn();
        const watcher: any = {
            onDidCreate: vi.fn(),
            onDidDelete: vi.fn(),
            onDidChange: vi.fn(),
        };
        beforeEach(() => {
            context = { subscriptions: [] };
            vi.clearAllMocks();
            Object.defineProperty(vscode.workspace, "workspaceFolders", { value: [{ uri: fakeUri }], configurable: true });
            vi.spyOn(vscode.workspace, "createFileSystemWatcher").mockReturnValue(watcher);
            vi.spyOn(ZoweExplorerApiRegister.getInstance().onProfilesUpdateEmitter, "fire").mockImplementation(mockEmitter);
            vi.spyOn(SharedUtils, "debounce").mockImplementation((cb: any) => cb);
        });

        afterAll(() => {
            vi.restoreAllMocks();
        });

        it("should be able to trigger onDidCreate listener", async () => {
            const spyRefreshAll = vi.spyOn(SharedActions, "refreshAll").mockImplementation((() => undefined) as any);
            watcher.onDidCreate.mockImplementationOnce((fun) => (watcherPromise = fun()));
            SharedInit.watchConfigProfile(context);
            await watcherPromise;
            expect(context.subscriptions).toContain(watcher);
            expect(spyRefreshAll).toHaveBeenCalledTimes(1);
            expect(mockEmitter).toHaveBeenCalledTimes(1);
        });

        it("should be able to trigger onDidDelete listener", async () => {
            const spyRefreshAll = vi.spyOn(SharedActions, "refreshAll").mockImplementation((() => undefined) as any);
            watcher.onDidDelete.mockImplementationOnce((fun) => (watcherPromise = fun()));
            SharedInit.watchConfigProfile(context);
            await watcherPromise;
            expect(context.subscriptions).toContain(watcher);
            expect(spyRefreshAll).toHaveBeenCalledTimes(1);
            expect(mockEmitter).toHaveBeenCalledTimes(1);
        });

        it("should be able to trigger onDidChange listener", async () => {
            const spyRefreshAll = vi.spyOn(SharedActions, "refreshAll").mockImplementation((() => undefined) as any);
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
            const spyWatcher = vi.spyOn(imperative.EventOperator, "getWatcher").mockReturnValue(dummyWatcher);
            const spyGuiError = vi.spyOn(Gui, "errorMessage");

            // Spy callback behavior
            const spyTranslatedLog = vi.spyOn(vscode.l10n, "t");
            const spyGetProfileInfo = vi.spyOn(profUtils.ProfilesUtils, "setupProfileInfo").mockImplementationOnce(vi.fn());
            const spyReadConfigFromDisk = vi.spyOn(profUtils.ProfilesUtils, "readConfigFromDisk").mockImplementationOnce(vi.fn());
            const spyRefreshAll = vi.spyOn(SharedActions, "refreshAll").mockImplementation(vi.fn());

            // Setup watchers
            SharedInit.watchConfigProfile(context);

            expect(spyWatcher).toHaveBeenCalled();
            expect(spyGuiError).not.toHaveBeenCalled();

            vi.clearAllMocks();
            // Trigger Vault changes
            await onVaultUpdatedCallback();
            expect(spyTranslatedLog.mock.calls[0][0]).toContain("vault");
            expect(spyReadConfigFromDisk).toHaveBeenCalled();
            expect(spyRefreshAll).toHaveBeenCalled();

            vi.clearAllMocks();
            // Trigger Vault changes
            await onCredentialManagerUpdatedCallback();
            expect(spyTranslatedLog.mock.calls[0][0]).toContain("credential management");
            expect(spyGetProfileInfo).toHaveBeenCalled();
            expect(spyRefreshAll).toHaveBeenCalled();
        });

        it("should handle errors when watching for vault or credMgr changes", async () => {
            const testError = "__TEST_ERROR__";
            const spyWatcher = vi.spyOn(imperative.EventOperator, "getWatcher").mockImplementation(() => {
                throw testError;
            });
            const spyGuiError = vi.spyOn(Gui, "errorMessage");

            SharedInit.watchConfigProfile(context);

            expect(spyWatcher).toHaveBeenCalled();
            expect(spyGuiError.mock.calls[0][0]).toContain("vault changes");
            expect(spyGuiError.mock.calls[0][0]).toContain(testError);
            expect(spyGuiError.mock.calls[1][0]).toContain("credential manager changes");
            expect(spyGuiError.mock.calls[1][0]).toContain(testError);
        });
    });

    describe("initSubscribers", () => {
        const spyCollapse = vi.fn().mockImplementation((fun) => fun({ element: "collapse" }));
        const spyExpand = vi.fn().mockImplementation((fun) => fun({ element: "expand" }));
        const spyOnCollapsibleStateChange = vi.fn();
        let context: any;
        const provider: any = { getTreeView: () => treeView, onCollapsibleStateChange: spyOnCollapsibleStateChange };
        const treeView = {
            onDidCollapseElement: spyCollapse,
            onDidExpandElement: spyExpand,
            onDidChangeSelection: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        };

        beforeEach(() => {
            context = { subscriptions: [] };
            vi.clearAllMocks();
        });
        afterAll(() => {
            vi.restoreAllMocks();
        });

        it("should setup listeners", () => {
            SharedInit.initSubscribers(context, provider);
            expect(context.subscriptions).toContain(treeView);
            expect(spyCollapse).toHaveBeenCalled();
            expect(spyExpand).toHaveBeenCalled();
            expect(spyOnCollapsibleStateChange).toHaveBeenCalled();
            expect(treeView.onDidChangeSelection).toHaveBeenCalled();
        });
    });

    describe("setupRemoteWorkspaceFolders", () => {
        const getFakeEventInfo = (added?: any): vscode.WorkspaceFoldersChangeEvent => ({
            added,
            removed: [],
        });
        describe("extender types", () => {
            let mockGetSession: Mock;
            let mockGetCommonApi: Mock;

            beforeEach(() => {
                mockGetSession = vi.fn().mockReturnValue({
                    ISession: {
                        type: "ssh",
                    },
                });

                mockGetCommonApi = vi.fn().mockReturnValue({
                    getSession: mockGetSession,
                });

                vi.spyOn(ZoweExplorerApiRegister, "getInstance").mockReturnValue({
                    getCommonApi: mockGetCommonApi,
                } as any);
                vi.clearAllMocks();
            });
            it("should setup a remote workspace for an extender type", async () => {
                const folderUri = {
                    $mid: 1,
                    fsPath: "/ssh_profile/u/users/user/member",
                    external: "zowe-uss:/ssh_profile/u/users/user/member",
                    path: "/ssh_profile/u/users/user/member",
                    scheme: "zowe-uss",
                    with: vi.fn().mockReturnValue({
                        $mid: 1,
                        fsPath: "/ssh_profile/u/users/user/member",
                        external: "zowe-uss:/ssh_profile/u/users/user/member",
                        path: "/ssh_profile/u/users/user/member",
                        scheme: "zowe-uss",
                        query: "fetch=true",
                    }),
                };
                vi.spyOn(FsAbstractUtils, "getInfoForUri").mockReturnValueOnce({
                    isRoot: false,
                    slashAfterProfilePos: 11,
                    profileName: "ssh_profile",
                    profile: { profile: {}, message: ".", type: "ssh", failNotFound: false },
                });

                const fakeWorkspaceFolders = vi.fn().mockReturnValue([folderUri]);
                new MockedProperty(vscode.workspace, "workspaceFolders", {
                    get: fakeWorkspaceFolders,
                    configurable: true,
                });

                // Replace real workspace with controlled data
                vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([
                    {
                        uri: folderUri as any,
                        name: "[ssh_profile] /u/users/user/member",
                        index: 0,
                    },
                ]);

                // Fake event fallback triggers workspaceFolders
                const fakeEventInfo = getFakeEventInfo();
                const addedArr = vi.fn(() => undefined);
                Object.defineProperty(fakeEventInfo, "added", {
                    get: addedArr,
                });

                // Mock getInfoForUri to return a profile name
                const getInfoSpy = vi.spyOn(FsAbstractUtils, "getInfoForUri").mockReturnValue({ profileName: "ssh_profile" } as any);

                // Match profile name
                await Profiles.createInstance(undefined as any);
                const getProfileSpy = vi
                    .spyOn(Profiles.getInstance(), "getProfiles")
                    .mockReturnValue([{ name: "ssh_profile", type: "ssh", message: ".", failNotFound: false }]);

                // Avoid real FS lookup
                const readDirMock = vi.spyOn(vscode.workspace.fs, "readDirectory").mockResolvedValue(undefined!);

                await SharedInit.setupRemoteWorkspaceFolders(fakeEventInfo, "ssh");

                expect(addedArr).toHaveBeenCalled();
                expect(getProfileSpy).toHaveBeenCalledWith("ssh");
                expect(getInfoSpy).toHaveBeenCalledWith(folderUri, expect.anything());
                expect(readDirMock).toHaveBeenCalled();
            });

            it("should filter all workspaces and not read directory if profileType is undefined", async () => {
                const folderUri = vscode.Uri.parse(`zowe-uss:/ssh_profile/u/users/user/member`);

                vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([
                    {
                        uri: folderUri as any,
                        name: "[ssh_profile] /u/users/user/member",
                        index: 0,
                    },
                ]);

                const fakeEventInfo = getFakeEventInfo();
                const addedArr = vi.fn(() => undefined);
                Object.defineProperty(fakeEventInfo, "added", {
                    get: addedArr,
                });

                const getInfoSpy = vi.spyOn(FsAbstractUtils, "getInfoForUri").mockReturnValue({ profileName: "ssh_profile" } as any);

                await Profiles.createInstance(undefined as any);

                const getProfileSpy = vi.spyOn(Profiles.getInstance(), "getProfiles").mockReturnValue([]);

                const readDirMock = vi.spyOn(vscode.workspace.fs, "readDirectory");

                await SharedInit.setupRemoteWorkspaceFolders(fakeEventInfo, undefined);

                expect(addedArr).toHaveBeenCalled();
                expect(getProfileSpy).toHaveBeenCalledWith(undefined);
                expect(getInfoSpy).toHaveBeenCalledWith(folderUri, expect.anything());
                expect(readDirMock).not.toHaveBeenCalled();
            });
        });
        describe("core types", () => {
            beforeEach(() => {
                const mockGetCommonApi = vi.fn();
                const mockGetSession = vi.fn().mockReturnValueOnce({
                    ISession: {
                        type: imperative.SessConstants.AUTH_TYPE_TOKEN,
                    },
                });
                vi.spyOn(ZoweExplorerApiRegister, "getInstance").mockReturnValueOnce({
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
                const mockGetProfiles = vi.fn().mockReturnValueOnce([mockProfile]);
                vi.spyOn(Profiles, "getInstance").mockReturnValueOnce({
                    getProfiles: mockGetProfiles,
                } as any);
                vi.spyOn(FsAbstractUtils, "getInfoForUri").mockReturnValueOnce({
                    isRoot: false,
                    slashAfterProfilePos: 11,
                    profileName: "lpar.zosmf",
                    profile: { profile: { tokenValue: "123-asdf-4567" }, message: ".", type: "zosmf", failNotFound: false },
                });
            });

            it("should iterate over vscode.workspaces.workspaceFolders when no event is given", async () => {
                const fakeWorkspaceFolders = vi.fn().mockReturnValue([]);
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
                const addedArr = vi.fn();
                Object.defineProperty(fakeEventInfo, "added", {
                    get: addedArr,
                });
                await SharedInit.setupRemoteWorkspaceFolders(fakeEventInfo);
                expect(addedArr).toHaveBeenCalled();
            });
            it("calls DatasetFSProvider for ZoweScheme.DS", async () => {
                const fakeEventInfo = getFakeEventInfo([{ uri: vscode.Uri.from({ scheme: ZoweScheme.DS, path: "/lpar.zosmf/TEST.PDS" }) }]);
                const readDirMock = vi.spyOn(vscode.workspace.fs, "readDirectory").mockImplementation((() => undefined) as any);
                await SharedInit.setupRemoteWorkspaceFolders(fakeEventInfo, "zosmf");
                expect(readDirMock).toHaveBeenCalled();
                readDirMock.mockRestore();
            });
            it("calls UssFSProvider for ZoweScheme.USS", async () => {
                const fakeEventInfo = getFakeEventInfo([{ uri: vscode.Uri.from({ scheme: ZoweScheme.USS, path: "/lpar.zosmf/u/user/folder" }) }]);
                const readDirMock = vi.spyOn(vscode.workspace.fs, "readDirectory").mockImplementation((() => undefined) as any);
                await SharedInit.setupRemoteWorkspaceFolders(fakeEventInfo, "zosmf");
                expect(readDirMock).toHaveBeenCalled();
                readDirMock.mockRestore();
            });
            it("does nothing for file URIs", async () => {
                const fakeEventInfo = getFakeEventInfo([{ uri: vscode.Uri.from({ scheme: "file", path: "/a/b/c" }) }]);
                const readDirMock = vi.spyOn(vscode.workspace.fs, "readDirectory");
                await SharedInit.setupRemoteWorkspaceFolders(fakeEventInfo);
                expect(readDirMock).not.toHaveBeenCalled();
            });
            it("logs an error if one occurs", async () => {
                const fakeEventInfo = getFakeEventInfo([{ uri: vscode.Uri.from({ scheme: ZoweScheme.DS, path: "/lpar.zosmf/TEST.PDS" }) }]);
                const sampleError = new Error("issue fetching data set");
                const readDirMock = vi.spyOn(vscode.workspace.fs, "readDirectory").mockRejectedValueOnce(sampleError);
                const errorMock = vi.spyOn(ZoweLogger, "error").mockImplementation((() => undefined) as any);
                await SharedInit.setupRemoteWorkspaceFolders(fakeEventInfo, "zosmf");
                expect(errorMock).toHaveBeenCalledWith(sampleError.message);
                expect(readDirMock).toHaveBeenCalled();
                readDirMock.mockRestore();
            });
        });
    });

    describe("isDocumentASpool", () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        afterAll(() => {
            vi.restoreAllMocks();
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
            const spyLookup = vi.spyOn(JobFSProvider.instance, "lookup").mockReturnValue(spoolEntry);

            // isSpoolEntry should return true if it's given a SpoolEntry instance
            const spyIsSpoolEntry = vi.spyOn(FsJobsUtils, "isSpoolEntry");

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
            const spyLookup = vi.spyOn(JobFSProvider.instance, "lookup").mockReturnValue({
                name: "regular-file.txt",
                type: vscode.FileType.File,
                ctime: 0,
                mtime: 0,
                size: 0,
            } as any);

            const spyIsSpoolEntry = vi.spyOn(FsJobsUtils, "isSpoolEntry");

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
            const spyLookup = vi.spyOn(JobFSProvider.instance, "lookup").mockReturnValue(undefined);

            // Mock the FsJobsUtils.isSpoolEntry to return false
            const spyIsSpoolEntry = vi.spyOn(FsJobsUtils, "isSpoolEntry");

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
