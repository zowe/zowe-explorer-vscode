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

import { ExtensionContext } from "vscode";
import { ConfigEditor } from "../../../../src/utils/ConfigEditor";
import { ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";
import { ProfileInfo } from "@zowe/imperative";
import { vi } from "vitest";

// Global import statements for mocked modules
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { ConfigSchemaHelpers } from "../../../../src/utils/ConfigSchemaHelpers";
import { ConfigUtils } from "../../../../src/utils/ConfigUtils";
import { ConfigChangeHandlers } from "../../../../src/utils/ConfigChangeHandlers";

vi.mock("../../../../src/configuration/Profiles", () => ({
    Profiles: {
        getInstance: vi.fn(() => ({
            overrideWithEnv: vi.fn(),
        })),
    },
}));

vi.mock("@zowe/imperative", () => ({
    ProfileInfo: vi.fn().mockImplementation(() => ({
        readProfilesFromDisk: vi.fn().mockResolvedValue(undefined),
        getTeamConfig: vi.fn(() => ({
            layers: [],
        })),
    })),
    ProfileCredentials: {
        defaultCredMgrWithKeytar: vi.fn(),
    },
    AbstractCredentialManager: class AbstractCredentialManager {
        constructor() {}
    },
    Logger: {
        getAppLogger: vi.fn(() => ({
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        })),
    },
}));

vi.mock("@zowe/zos-jobs-for-zowe-sdk", () => ({}));
vi.mock("@zowe/zos-files-for-zowe-sdk", () => ({}));
vi.mock("@zowe/zos-console-for-zowe-sdk", () => ({}));
vi.mock("@zowe/zos-tso-for-zowe-sdk", () => ({}));
vi.mock("@zowe/zos-uss-for-zowe-sdk", () => ({}));
vi.mock("@zowe/zosmf-for-zowe-sdk", () => ({}));

vi.mock("fs", () => ({
    readFileSync: vi.fn(),
    existsSync: vi.fn(),
    realpathSync: vi.fn((path) => path),
}));

vi.mock("path", () => ({
    resolve: vi.fn(),
    join: vi.fn(),
    dirname: vi.fn(),
    normalize: vi.fn(),
}));

vi.mock("../../../../src/utils/ConfigSchemaHelpers", () => ({
    ConfigSchemaHelpers: {
        generateSchemaValidation: vi.fn(),
    },
}));

const createDefaultMockProfileInfo = () => ({
    readProfilesFromDisk: vi.fn().mockResolvedValue(undefined),
    getTeamConfig: vi.fn(() => ({
        layers: [],
        api: {
            layers: { activate: vi.fn(), get: vi.fn(() => ({ path: "/test/config/path" })) },
            secure: { secureFields: vi.fn().mockReturnValue([]) },
            set: vi.fn(),
            delete: vi.fn(),
        },
    })),
    getAllProfiles: vi.fn(() => []),
    mergeArgsForProfile: vi.fn(() => ({ knownArgs: [] })),
});

vi.mock("../../../../src/utils/ConfigUtils", () => ({
    ConfigUtils: {
        processProfilesRecursively: vi.fn(),
        parseConfigChanges: vi.fn(),
        createProfileInfoAndLoad: vi.fn(),
        pushParseError: vi.fn(),
        appendJsonParseErrorsForKnownConfigFiles: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock("../../../../src/utils/ConfigChangeHandlers", () => ({
    ConfigChangeHandlers: {
        handleDefaultChanges: vi.fn(),
        handleProfileChanges: vi.fn(),
        handleAutostoreToggle: vi.fn().mockResolvedValue(undefined),
        simulateDefaultChanges: vi.fn(),
        simulateProfileChanges: vi.fn(),
    },
}));

vi.mock("../../../../src/utils/ConfigEditorPathUtils", () => ({
    ConfigEditorPathUtils: {
        constructNestedProfilePath: vi.fn(),
        getNewProfilePath: vi.fn(),
        updateChangeKey: vi.fn(),
        updateChangePath: vi.fn(),
    },
}));

vi.mock("../../../../src/webviews/src/config-editor/utils/moveUtils", () => ({
    moveProfile: vi.fn(),
    updateDefaultsAfterRename: vi.fn(),
    simulateDefaultsUpdateAfterRename: vi.fn(),
}));

vi.mock("../../../../src/tools/ZoweLocalStorage", () => ({
    LocalStorageAccess: {
        getValue: vi.fn().mockReturnValue(undefined),
        setValue: vi.fn().mockResolvedValue(undefined),
    },
    ZoweLocalStorage: {
        globalState: { get: vi.fn().mockReturnValue(undefined), update: vi.fn().mockResolvedValue(undefined) },
        workspaceState: undefined,
        getValue: vi.fn().mockReturnValue(undefined),
        setValue: vi.fn().mockResolvedValue(undefined),
    },
}));

// Mock the WebView panel to include the reveal method
const mockWebviewPanel = {
    reveal: vi.fn(),
    webview: {
        postMessage: vi.fn(),
        onDidReceiveMessage: vi.fn(),
        asWebviewUri: vi.fn(),
        cspSource: "test-csp-source",
    },
    onDidDispose: vi.fn(),
    dispose: vi.fn(),
};

// Mock the specific vscode methods we need
vi.mock("vscode", () => ({
    window: {
        createWebviewPanel: vi.fn(() => mockWebviewPanel),
        showErrorMessage: vi.fn(),
        showTextDocument: vi.fn(),
    },
    commands: {
        executeCommand: vi.fn(),
    },
    ViewColumn: {
        One: 1,
    },
    l10n: {
        t: vi.fn((text) => text),
    },
    FileSystemError: class FileSystemError extends Error {
        constructor(message?: string) {
            super(message);
            this.name = "FileSystemError";
        }
    },
    TreeItem: class TreeItem {
        constructor(label?: string, collapsibleState?: any) {
            this.label = label;
            this.collapsibleState = collapsibleState;
        }
        label?: string;
        collapsibleState?: any;
    },
    Command: class Command {
        constructor() {}
    },
    QuickPickItemKind: {
        Separator: -1,
        Default: 0,
    },
    EventEmitter: class EventEmitter<T> {
        private subscribers: Function[] = [];
        event = vi.fn().mockImplementation((listener) => {
            this.subscribers.push(listener);
            return { dispose: () => {} };
        });
        fire(data?: T): void {
            for (const sub of this.subscribers) {
                try {
                    sub(data);
                } catch (err) {}
            }
        }
    },
    Uri: {
        file: vi.fn((path: string) => ({ fsPath: path, path, scheme: "file" })),
    },
    extensions: {
        getExtension: vi.fn(() => ({
            packageJSON: { version: "2.0.0" },
        })),
    },
    workspace: {
        workspaceFolders: [],
        openTextDocument: vi.fn(),
        onDidSaveTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
    },
}));

// Helper functions for creating reusable mocks
const createMockProfileInfo = (overrides: any = {}) => ({
    readProfilesFromDisk: vi.fn().mockResolvedValue(undefined),
    getTeamConfig: vi.fn(() => ({
        layers: [],
        api: {
            layers: {
                activate: vi.fn(),
                get: vi.fn(() => ({ path: "/test/config/path" })),
            },
            secure: {
                secureFields: vi.fn().mockReturnValue([]),
            },
            set: vi.fn().mockResolvedValue(undefined),
            delete: vi.fn().mockResolvedValue(undefined),
        },
    })),
    getAllProfiles: vi.fn(() => []),
    mergeArgsForProfile: vi.fn(() => ({ knownArgs: [] })),
    ...overrides,
});

const createGlobalMocks = () => ({
    // Common mock functions
    mockFn: {
        resolved: vi.fn().mockResolvedValue(undefined),
        rejected: vi.fn().mockRejectedValue(new Error("Mock error")),
        returnValue: vi.fn().mockReturnValue("mock value"),
        returnTrue: vi.fn().mockReturnValue(true),
        returnFalse: vi.fn().mockReturnValue(false),
        returnEmptyArray: vi.fn().mockReturnValue([]),
        returnEmptyObject: vi.fn().mockReturnValue({}),
    },

    // Common mock objects
    mockLayer: {
        path: "/test/config/path",
        user: true,
        global: false,
        properties: { profiles: { testProfile: { type: "zosmf", properties: { host: "test.host.com" } } } },
    },

    mockLayerActive: vi.fn(() => ({ path: "/test/config/path" })),

    mockConfigMoveAPI: {
        get: vi.fn().mockReturnValue({ type: "zosmf", properties: { host: "test.host.com" } }),
        set: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
    },

    mockProfileOperations: {
        updateRenameKeysForParentChanges: vi.fn().mockReturnValue([]),
        removeDuplicateRenames: vi.fn().mockReturnValue([]),
        wouldCreateCircularReference: vi.fn().mockReturnValue(false),
        isCriticalMoveError: vi.fn().mockReturnValue(false),
        handleMoveUtilsError: vi.fn().mockReturnValue("Mock error message"),
        validateConfigMoveAPI: vi.fn().mockReturnValue(true),
        isNestedProfileCreation: vi.fn().mockReturnValue(false),
        createNestedProfileStructure: vi.fn().mockImplementation(() => {}),
        redactSecureValues: vi.fn().mockReturnValue([]),
    },

    mockMessageHandlers: {
        handleOpenConfigFile: vi.fn().mockResolvedValue(undefined),
        handleRevealInFinder: vi.fn().mockResolvedValue(undefined),
        handleOpenSchemaFile: vi.fn().mockResolvedValue(undefined),
        handleGetEnvInformation: vi.fn().mockResolvedValue(undefined),
        handleGetEnvVars: vi.fn().mockResolvedValue(undefined),
        handleInitialSelection: vi.fn().mockResolvedValue(undefined),
        handleConfigurationsReady: vi.fn().mockResolvedValue(undefined),
        handleOpenConfigFileWithProfile: vi.fn().mockResolvedValue(undefined),
        handleGetMergedProperties: vi.fn().mockResolvedValue(undefined),
        handleGetWizardMergedProperties: vi.fn().mockResolvedValue(undefined),
        handleSelectFile: vi.fn().mockResolvedValue(undefined),
        handleCreateNewConfig: vi.fn().mockResolvedValue(undefined),
        handleGetLocalStorageValue: vi.fn().mockResolvedValue(undefined),
        handleOpenVscodeSettings: vi.fn().mockResolvedValue(undefined),
        handleSetLocalStorageValue: vi.fn().mockResolvedValue(undefined),
        handleShowErrorMessage: vi.fn().mockResolvedValue(undefined),
        handleSaveChanges: vi.fn().mockResolvedValue(undefined),
        handleGetProfiles: vi.fn().mockResolvedValue(undefined),
        handleAutostoreToggle: vi.fn().mockResolvedValue(undefined),
    },

    mockFileOperations: {
        createNewConfig: vi.fn().mockResolvedValue({ configs: [], parseErrors: [] }),
    },

    // Common mock modules
    mockModules: {
        fs: {
            readFileSync: vi.fn().mockReturnValue('{"type": "object"}'),
            existsSync: vi.fn().mockReturnValue(true),
            realpathSync: vi.fn((path) => path),
        },
        path: {
            resolve: vi.fn().mockReturnValue("/test/config/path"),
            join: vi.fn().mockReturnValue("/test/config/zowe.schema.json"),
            dirname: vi.fn().mockReturnValue("/test/config"),
        },
        ConfigSchemaHelpers: {
            generateSchemaValidation: vi.fn().mockReturnValue({ validate: vi.fn() }),
        },
        ConfigUtils: {
            processProfilesRecursively: vi.fn().mockImplementation(() => {}),
        },
        MoveUtils: {
            moveProfile: vi.fn().mockImplementation(() => {}),
            moveProfileInPlace: vi.fn().mockImplementation(() => {}),
            simulateDefaultsUpdateAfterRename: vi.fn().mockImplementation(() => {}),
            updateDefaultsAfterRename: vi.fn().mockImplementation(() => {}),
        },
        ConfigEditorPathUtils: {
            constructNestedProfilePath: vi.fn().mockReturnValue("profiles.testProfile"),
            getNewProfilePath: vi.fn().mockReturnValue("profiles.newProfile"),
            updateChangeKey: vi.fn().mockReturnValue({}),
            updateChangePath: vi.fn().mockReturnValue({}),
        },
    },

    // Common mock spies
    mockSpies: {
        vscode: {
            showErrorMessage: vi.fn().mockResolvedValue(undefined),
            openTextDocument: vi.fn().mockResolvedValue({}),
            showTextDocument: vi.fn().mockResolvedValue({ selection: {}, revealRange: vi.fn() }),
        },
        console: {
            warn: vi.fn().mockImplementation(() => {}),
            error: vi.fn().mockImplementation(() => {}),
        },
    },
});

describe("configEditor", () => {
    let mockContext: ExtensionContext;
    let configEditor: ConfigEditor;
    beforeEach(() => {
        mockContext = {
            extensionPath: "/mock/extension/path",
            subscriptions: [],
        } as ExtensionContext;

        ConfigUtils.createProfileInfoAndLoad.mockResolvedValue(createDefaultMockProfileInfo());

        configEditor = new ConfigEditor(mockContext);
    });

    describe("areSecureValuesAllowed", () => {
        it("should return false when profiles cache is undefined", async () => {
            const profilesCacheSpy = vi.spyOn(ZoweVsCodeExtension as any, "profilesCache", "get").mockReturnValue(undefined);

            const result = await configEditor.areSecureValuesAllowed();
            expect(result).toBe(false);

            profilesCacheSpy.mockRestore();
        });

        it("should return true when profile info reports secured credentials", async () => {
            const mockProfilesCache = {
                getProfileInfo: vi.fn().mockResolvedValue({
                    isSecured: vi.fn().mockReturnValue(true),
                }),
            };

            const profilesCacheSpy = vi.spyOn(ZoweVsCodeExtension as any, "profilesCache", "get").mockReturnValue(mockProfilesCache);

            const result = await configEditor.areSecureValuesAllowed();
            expect(result).toBe(true);
            expect(mockProfilesCache.getProfileInfo).toHaveBeenCalled();

            profilesCacheSpy.mockRestore();
        });

        it("should return false when credential manager check throws error", async () => {
            const mockProfilesCache = {
                getProfileInfo: vi.fn().mockRejectedValue(new Error("Test error")),
            };

            const profilesCacheSpy = vi.spyOn(ZoweVsCodeExtension as any, "profilesCache", "get").mockReturnValue(mockProfilesCache);

            const result = await configEditor.areSecureValuesAllowed();
            expect(result).toBe(false);

            profilesCacheSpy.mockRestore();
        });
    });
    describe("getLocalConfigs", () => {
        it("should return configurations when profiles are successfully read", async () => {
            const mocks = createGlobalMocks();
            const mockProfileInfo = createMockProfileInfo({
                getTeamConfig: vi.fn(() => ({
                    layers: [
                        {
                            exists: true,
                            path: "/test/config/path",
                            properties: {
                                $schema: "zowe.schema.json",
                                profiles: {
                                    testProfile: {
                                        type: "zosmf",
                                        properties: { host: "test.host.com", port: 443 },
                                    },
                                },
                            },
                            global: false,
                            user: true,
                        },
                    ],
                })),
            });

            ConfigUtils.createProfileInfoAndLoad.mockResolvedValue(mockProfileInfo);

            Object.assign(fs, mocks.mockModules.fs);
            Object.assign(path, mocks.mockModules.path);
            Object.assign(ConfigSchemaHelpers, mocks.mockModules.ConfigSchemaHelpers);
            Object.assign(ConfigUtils, mocks.mockModules.ConfigUtils);

            const result = await configEditor.getLocalConfigs();

            expect(result.configs).toHaveLength(1);
            expect(result.parseErrors).toEqual([]);
            expect(result.configs[0]).toMatchObject({
                configPath: "/test/config/path",
                properties: expect.objectContaining({
                    $schema: "zowe.schema.json",
                    profiles: expect.any(Object),
                }),
                schema: expect.any(Object),
                schemaValidation: expect.any(Object),
                schemaPath: "/test/config/zowe.schema.json",
                global: false,
                user: true,
            });

            expect(ConfigUtils.createProfileInfoAndLoad).toHaveBeenCalled();
            expect(mockProfileInfo.getTeamConfig).toHaveBeenCalled();
        });

        it("should route a parseable file-load error to ConfigUtils.pushParseError and return an empty config list", async () => {
            ConfigUtils.createProfileInfoAndLoad.mockRejectedValue(new Error("Error reading file '/test/config.json' Line 5 Column 10"));
            (ConfigUtils.pushParseError as any).mockImplementation((errors: any[], configPath: string, message: string) =>
                errors.push({ configPath, message })
            );

            const showErrorMessageSpy = vi.spyOn(vscode.window, "showErrorMessage").mockResolvedValue(undefined);

            const result = await configEditor.getLocalConfigs();

            expect(result.configs).toEqual([]);
            expect(ConfigUtils.pushParseError).toHaveBeenCalledWith(
                expect.any(Array),
                expect.any(String),
                expect.stringContaining("Error reading file")
            );
            expect(ConfigUtils.appendJsonParseErrorsForKnownConfigFiles).toHaveBeenCalledWith(result.parseErrors);
            expect(result.parseErrors).toHaveLength(1);
            expect(showErrorMessageSpy).not.toHaveBeenCalled();

            showErrorMessageSpy.mockRestore();
        });

        it("should handle error when reading profiles from disk with non-Error object (lines 125-126)", async () => {
            ConfigUtils.createProfileInfoAndLoad.mockRejectedValue("String error message");

            const showErrorMessageSpy = vi.spyOn(vscode.window, "showErrorMessage").mockResolvedValue(undefined);

            const result = await (configEditor as any).getLocalConfigs();

            expect(result.configs).toEqual([]);
            expect(result.parseErrors).toEqual([]);
            expect(showErrorMessageSpy).toHaveBeenCalledWith("Error reading profiles from disk: String error message");

            showErrorMessageSpy.mockRestore();
        });

        it("should handle layers that do not exist (layer.exists = false)", async () => {
            const mockProfileInfo = createMockProfileInfo({
                getTeamConfig: vi.fn(() => ({
                    layers: [
                        {
                            exists: false,
                            path: "/test/nonexistent/config/path",
                            properties: {
                                profiles: {
                                    testProfile: {
                                        type: "zosmf",
                                        properties: {
                                            host: "test.host.com",
                                        },
                                    },
                                },
                            },
                            global: false,
                            user: true,
                        },
                    ],
                })),
            });

            ConfigUtils.createProfileInfoAndLoad.mockResolvedValue(mockProfileInfo);

            const result = await configEditor.getLocalConfigs();

            expect(result.configs).toEqual([]);
            expect(result.parseErrors).toEqual([]);
            expect(ConfigUtils.createProfileInfoAndLoad).toHaveBeenCalled();
            expect(mockProfileInfo.getTeamConfig).toHaveBeenCalled();
        });

        it("should handle error when reading or parsing file and return partial results", async () => {
            const mockProfileInfo = createMockProfileInfo({
                getTeamConfig: vi.fn(() => ({
                    layers: [
                        {
                            exists: true,
                            path: "/test/valid/config/path",
                            properties: {
                                $schema: "zowe.schema.json",
                                profiles: {
                                    validProfile: {
                                        type: "zosmf",
                                        properties: {
                                            host: "valid.host.com",
                                        },
                                    },
                                },
                            },
                            global: false,
                            user: true,
                        },
                        {
                            exists: true,
                            path: "/test/invalid/config/path",
                            properties: {
                                $schema: "zowe.schema.json",
                                profiles: {
                                    invalidProfile: {
                                        type: "zosmf",
                                        properties: {
                                            host: "invalid.host.com",
                                        },
                                    },
                                },
                            },
                            global: false,
                            user: true,
                        },
                    ],
                })),
            });

            ConfigUtils.createProfileInfoAndLoad.mockResolvedValue(mockProfileInfo);

            fs.readFileSync
                .mockReturnValueOnce(JSON.stringify({ type: "object", properties: { profiles: { type: "object" } } }))
                .mockImplementationOnce(() => {
                    throw new Error("Error reading file '/test/invalid/config/path' Line 3 Column 15");
                });

            fs.existsSync.mockReturnValue(true);
            path.resolve.mockReturnValue("/test/config/path");
            path.join.mockReturnValue("/test/config/zowe.schema.json");
            path.dirname.mockReturnValue("/test/config");

            ConfigSchemaHelpers.generateSchemaValidation.mockReturnValue({});
            ConfigUtils.processProfilesRecursively.mockImplementation(() => {});
            (ConfigUtils.pushParseError as any).mockImplementation((errors: any[], configPath: string, message: string) =>
                errors.push({ configPath, message })
            );

            const showErrorMessageSpy = vi.spyOn(vscode.window, "showErrorMessage").mockResolvedValue(undefined);

            const result = await configEditor.getLocalConfigs();

            expect(result.configs).toHaveLength(1);
            expect(ConfigUtils.pushParseError).toHaveBeenCalledWith(
                expect.any(Array),
                "/test/config/path",
                expect.stringContaining("Error reading file")
            );
            expect(result.parseErrors).toHaveLength(1);
            expect(result.configs[0]).toMatchObject({
                configPath: "/test/config/path",
                properties: expect.objectContaining({
                    $schema: "zowe.schema.json",
                    profiles: expect.any(Object),
                }),
                global: false,
                user: true,
            });

            expect(showErrorMessageSpy).not.toHaveBeenCalled();

            showErrorMessageSpy.mockRestore();
        });

        it("should handle schema validation with existing schema file (lines 170-184)", async () => {
            const mockProfileInfo = createMockProfileInfo({
                getTeamConfig: vi.fn(() => ({
                    layers: [
                        {
                            exists: true,
                            path: "/test/config/path",
                            properties: {
                                $schema: "zowe.schema.json",
                                profiles: {
                                    testProfile: {
                                        type: "zosmf",
                                        properties: {
                                            host: "test.host.com",
                                        },
                                    },
                                },
                            },
                            global: false,
                            user: true,
                        },
                    ],
                })),
            });

            ConfigUtils.createProfileInfoAndLoad.mockResolvedValue(mockProfileInfo);

            // Mock schema file exists and is readable
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(
                JSON.stringify({
                    type: "object",
                    properties: {
                        profiles: {
                            type: "object",
                            properties: {
                                host: { type: "string" },
                                port: { type: "number" },
                            },
                        },
                    },
                })
            );

            path.resolve.mockReturnValue("/test/config/path");
            path.join.mockReturnValue("/test/config/zowe.schema.json");
            path.dirname.mockReturnValue("/test/config");

            const mockSchemaValidation = { validate: vi.fn() };
            ConfigSchemaHelpers.generateSchemaValidation.mockReturnValue(mockSchemaValidation);
            ConfigUtils.processProfilesRecursively.mockImplementation(() => {});

            const result = await (configEditor as any).getLocalConfigs();

            expect(result.configs).toHaveLength(1);
            expect(result.parseErrors).toEqual([]);
            expect(fs.existsSync).toHaveBeenCalledWith("/test/config/zowe.schema.json");
            expect(fs.readFileSync).toHaveBeenCalledWith("/test/config/zowe.schema.json", { encoding: "utf8" });
            expect(ConfigSchemaHelpers.generateSchemaValidation).toHaveBeenCalled();
            expect(ConfigUtils.processProfilesRecursively).toHaveBeenCalledWith(expect.any(Object), mockSchemaValidation);
        });

        it("should handle schema validation when schema file does not exist (lines 170-184)", async () => {
            const mockProfileInfo = createMockProfileInfo({
                getTeamConfig: vi.fn(() => ({
                    layers: [
                        {
                            exists: true,
                            path: "/test/config/path",
                            properties: {
                                profiles: {
                                    testProfile: {
                                        type: "zosmf",
                                        properties: {
                                            host: "test.host.com",
                                        },
                                    },
                                },
                            },
                            global: false,
                            user: true,
                        },
                    ],
                })),
            });

            ConfigUtils.createProfileInfoAndLoad.mockResolvedValue(mockProfileInfo);

            // Mock schema file does not exist
            fs.existsSync.mockReturnValue(false);
            path.resolve.mockReturnValue("/test/config/path");
            path.join.mockReturnValue("/test/config/zowe.schema.json");
            path.dirname.mockReturnValue("/test/config");

            ConfigUtils.processProfilesRecursively.mockImplementation(() => {});

            const result = await (configEditor as any).getLocalConfigs();

            expect(result.configs).toHaveLength(1);
            expect(result.parseErrors).toEqual([]);
            expect(fs.existsSync).toHaveBeenCalledWith("/test/config/zowe.schema.json");
            // fs.readFileSync may be called for other purposes, so we just check it wasn't called for schema
            // ConfigSchemaHelpers.generateSchemaValidation may be called for other purposes
            expect(ConfigUtils.processProfilesRecursively).toHaveBeenCalledWith(
                expect.any(Object),
                undefined // No schema validation
            );
        });

        it("should handle schema validation when schema file is invalid (lines 170-184)", async () => {
            const mockProfileInfo = createMockProfileInfo({
                getTeamConfig: vi.fn(() => ({
                    layers: [
                        {
                            exists: true,
                            path: "/test/config/path",
                            properties: {
                                profiles: {
                                    testProfile: {
                                        type: "zosmf",
                                        properties: {
                                            host: "test.host.com",
                                        },
                                    },
                                },
                            },
                            global: false,
                            user: true,
                        },
                    ],
                })),
            });

            ConfigUtils.createProfileInfoAndLoad.mockResolvedValue(mockProfileInfo);

            // Mock schema file exists but is invalid JSON
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue("invalid json content");
            path.resolve.mockReturnValue("/test/config/path");
            path.join.mockReturnValue("/test/config/zowe.schema.json");
            path.dirname.mockReturnValue("/test/config");

            ConfigUtils.processProfilesRecursively.mockImplementation(() => {});

            const result = await (configEditor as any).getLocalConfigs();

            expect(result.configs).toHaveLength(1);
            expect(result.parseErrors).toEqual([]);
            expect(fs.existsSync).toHaveBeenCalledWith("/test/config/zowe.schema.json");
            expect(fs.readFileSync).toHaveBeenCalledWith("/test/config/zowe.schema.json", { encoding: "utf8" });
            // ConfigSchemaHelpers.generateSchemaValidation may be called for other purposes, so we just check the result
            expect(ConfigUtils.processProfilesRecursively).toHaveBeenCalledWith(
                expect.any(Object),
                undefined // No schema validation due to error
            );
        });

        it("should handle getLocalConfigs with schema validation and layer processing (lines 175, 207-208)", async () => {
            const mockProfileInfo = createMockProfileInfo({
                getTeamConfig: vi.fn(() => ({
                    layers: [
                        {
                            exists: true,
                            path: "/test/config/path",
                            properties: {
                                $schema: "zowe.schema.json",
                                profiles: {
                                    testProfile: {
                                        type: "zosmf",
                                        properties: {
                                            host: "test.host.com",
                                        },
                                    },
                                },
                            },
                            global: true,
                            user: false,
                        },
                    ],
                })),
            });

            ConfigUtils.createProfileInfoAndLoad.mockResolvedValue(mockProfileInfo);

            // Mock schema file exists and is valid
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(
                JSON.stringify({
                    type: "object",
                    properties: {
                        profiles: {
                            type: "object",
                            properties: {
                                host: { type: "string" },
                            },
                        },
                    },
                })
            );
            path.resolve.mockReturnValue("/test/config/path");
            path.join.mockReturnValue("/test/config/zowe.schema.json");
            path.dirname.mockReturnValue("/test/config");

            const mockSchemaValidation = { validate: vi.fn() };
            ConfigSchemaHelpers.generateSchemaValidation.mockReturnValue(mockSchemaValidation);
            ConfigUtils.processProfilesRecursively.mockImplementation(() => {});

            const result = await (configEditor as any).getLocalConfigs();

            expect(result.configs).toHaveLength(1);
            expect(result.parseErrors).toEqual([]);
            expect(result.configs[0]).toMatchObject({
                configPath: "/test/config/path",
                properties: expect.objectContaining({
                    $schema: "zowe.schema.json",
                    profiles: expect.any(Object),
                }),
                schema: expect.any(Object), // Schema validation was successful
                global: true,
                user: false,
            });

            expect(ConfigSchemaHelpers.generateSchemaValidation).toHaveBeenCalled(); // Line 175
            expect(ConfigUtils.processProfilesRecursively).toHaveBeenCalledWith(expect.any(Object), mockSchemaValidation);
        });
    });

    describe("onDidReceiveMessage", () => {
        it("should handle GET_PROFILES command successfully", async () => {
            const mockMessage = {
                command: "GET_PROFILES",
            };

            // Mock the messageHandlers.handleGetProfiles method
            const handleGetProfilesSpy = vi.spyOn((configEditor as any).messageHandlers, "handleGetProfiles").mockResolvedValue(undefined);

            await (configEditor as any).onDidReceiveMessage(mockMessage);

            expect(handleGetProfilesSpy).toHaveBeenCalledWith();
        });

        it("should handle SAVE_CHANGES command successfully", async () => {
            const mockMessage = {
                command: "SAVE_CHANGES",
                renames: [],
                otherChanges: [],
            };

            // Mock the required methods
            const handleProfileRenamesSpy = vi.spyOn((configEditor as any).profileOperations, "handleProfileRenames").mockResolvedValue(undefined);
            const handleAutostoreToggleSpy = vi.spyOn(ConfigChangeHandlers, "handleAutostoreToggle").mockResolvedValue(undefined);
            const getLocalConfigsSpy = vi.spyOn(configEditor, "getLocalConfigs").mockResolvedValue({ configs: [], parseErrors: [] });
            const areSecureValuesAllowedSpy = vi.spyOn(configEditor, "areSecureValuesAllowed").mockResolvedValue(true);
            const postMessageSpy = vi.spyOn(configEditor.panel.webview, "postMessage").mockResolvedValue(undefined as any);

            // Mock ConfigUtils.parseConfigChanges
            ConfigUtils.parseConfigChanges.mockReturnValue([]);

            // Mock ConfigChangeHandlers
            ConfigChangeHandlers.handleDefaultChanges = vi.fn().mockResolvedValue(undefined);
            ConfigChangeHandlers.handleProfileChanges = vi.fn().mockResolvedValue(undefined);

            await (configEditor as any).onDidReceiveMessage(mockMessage);

            expect(handleProfileRenamesSpy).toHaveBeenCalledWith([]);
            expect(handleAutostoreToggleSpy).toHaveBeenCalledWith([]);
            expect(getLocalConfigsSpy).toHaveBeenCalled();
            expect(areSecureValuesAllowedSpy).toHaveBeenCalled();
            expect(postMessageSpy).toHaveBeenCalledWith({
                command: "CONFIGURATIONS",
                contents: [],
                parseErrors: [],
                secureValuesAllowed: true,
            });
            expect(postMessageSpy).toHaveBeenCalledWith({
                command: "DISABLE_OVERLAY",
            });
        });

        it("should handle OPEN_CONFIG_FILE command successfully", async () => {
            const mockMessage = {
                command: "OPEN_CONFIG_FILE",
                configPath: "/test/config/path",
            };

            // Mock the messageHandlers.handleOpenConfigFile method
            const handleOpenConfigFileSpy = vi.spyOn((configEditor as any).messageHandlers, "handleOpenConfigFile").mockResolvedValue(undefined);

            await (configEditor as any).onDidReceiveMessage(mockMessage);

            expect(handleOpenConfigFileSpy).toHaveBeenCalledWith(mockMessage);
        });

        it("should handle unknown command gracefully", async () => {
            const mockMessage = {
                command: "UNKNOWN_COMMAND",
                data: "test",
            };

            // Should not throw an error
            await expect((configEditor as any).onDidReceiveMessage(mockMessage)).resolves.not.toThrow();
        });
    });

    describe("onDidReceiveMessages", () => {
        it("should handle REVEAL_IN_FINDER command", async () => {
            const mockMessage = {
                command: "REVEAL_IN_FINDER",
                configPath: "/test/config/path",
            };

            const handleRevealInFinderSpy = vi.spyOn((configEditor as any).messageHandlers, "handleRevealInFinder").mockResolvedValue(undefined);

            await (configEditor as any).onDidReceiveMessage(mockMessage);

            expect(handleRevealInFinderSpy).toHaveBeenCalledWith(mockMessage);
        });

        it("should handle OPEN_SCHEMA_FILE command", async () => {
            const mockMessage = {
                command: "OPEN_SCHEMA_FILE",
                schemaPath: "/test/schema/path",
            };

            const handleOpenSchemaFileSpy = vi.spyOn((configEditor as any).messageHandlers, "handleOpenSchemaFile").mockResolvedValue(undefined);

            await (configEditor as any).onDidReceiveMessage(mockMessage);

            expect(handleOpenSchemaFileSpy).toHaveBeenCalledWith(mockMessage);
        });

        it("should handle GET_ENV_INFORMATION command", async () => {
            const mockMessage = {
                command: "GET_ENV_INFORMATION",
            };

            const handleGetEnvInformationSpy = vi
                .spyOn((configEditor as any).messageHandlers, "handleGetEnvInformation")
                .mockResolvedValue(undefined);

            await (configEditor as any).onDidReceiveMessage(mockMessage);

            expect(handleGetEnvInformationSpy).toHaveBeenCalledWith();
        });

        it("should handle GET_ENV_VARS command", async () => {
            const mockMessage = {
                command: "GET_ENV_VARS",
                profileName: "testProfile",
            };

            const handleGetEnvVarsSpy = vi.spyOn((configEditor as any).messageHandlers, "handleGetEnvVars").mockResolvedValue(undefined);

            await (configEditor as any).onDidReceiveMessage(mockMessage);

            expect(handleGetEnvVarsSpy).toHaveBeenCalledWith(mockMessage);
        });

        it("should handle INITIAL_SELECTION command", async () => {
            const mockMessage = {
                command: "INITIAL_SELECTION",
                profileName: "testProfile",
                configPath: "/test/config/path",
                profileType: "zosmf",
            };

            const handleInitialSelectionSpy = vi.spyOn((configEditor as any).messageHandlers, "handleInitialSelection").mockImplementation(() => {});

            await (configEditor as any).onDidReceiveMessage(mockMessage);

            expect(handleInitialSelectionSpy).toHaveBeenCalledWith(mockMessage, expect.any(Function));
        });

        it("should handle CONFIGURATIONS_READY command", async () => {
            const mockMessage = {
                command: "CONFIGURATIONS_READY",
            };

            const handleConfigurationsReadySpy = vi
                .spyOn((configEditor as any).messageHandlers, "handleConfigurationsReady")
                .mockResolvedValue(undefined);

            await (configEditor as any).onDidReceiveMessage(mockMessage);

            expect(handleConfigurationsReadySpy).toHaveBeenCalledWith(undefined, expect.any(Function));
        });

        it("should handle OPEN_CONFIG_FILE_WITH_PROFILE command", async () => {
            const mockMessage = {
                command: "OPEN_CONFIG_FILE_WITH_PROFILE",
                filePath: "/test/config/path",
                profileKey: "testProfile",
            };

            const openConfigFileWithProfileSpy = vi.spyOn(ZoweVsCodeExtension, "openConfigFileWithProfile").mockResolvedValue(undefined);

            await (configEditor as any).onDidReceiveMessage(mockMessage);

            expect(openConfigFileWithProfileSpy).toHaveBeenCalledWith(mockMessage.filePath, mockMessage.profileKey);
        });

        it("should handle GET_MERGED_PROPERTIES command", async () => {
            const mockMessage = {
                command: "GET_MERGED_PROPERTIES",
                profilePath: "profiles.testProfile",
                configPath: "/test/config/path",
                changes: {},
                renames: [],
            };

            const getPendingMergedArgsForProfileSpy = vi
                .spyOn((configEditor as any).mergedProperties, "getPendingMergedArgsForProfile")
                .mockResolvedValue([
                    {
                        argLoc: { osLoc: "/test/config/path", jsonLoc: "profiles.testProfile.properties.host" },
                        argValue: "test.host.com",
                    },
                ]);
            const postMessageSpy = vi.spyOn(configEditor.panel.webview, "postMessage").mockResolvedValue(undefined as any);

            await (configEditor as any).onDidReceiveMessage(mockMessage);

            expect(getPendingMergedArgsForProfileSpy).toHaveBeenCalledWith(
                mockMessage.profilePath,
                mockMessage.configPath,
                mockMessage.changes,
                mockMessage.renames
            );
            expect(postMessageSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    command: "MERGED_PROPERTIES",
                    mergedArgs: expect.any(Array),
                    mergedPropertiesRequestSeq: undefined,
                })
            );
        });

        it("should handle GET_WIZARD_MERGED_PROPERTIES command", async () => {
            const mockMessage = {
                command: "GET_WIZARD_MERGED_PROPERTIES",
                rootProfile: "root",
                profileType: "zosmf",
                configPath: "/test/config/path",
                profileName: "testProfile",
                changes: {},
                renames: [],
            };

            const getWizardMergedPropertiesSpy = vi.spyOn((configEditor as any).mergedProperties, "getWizardMergedProperties").mockResolvedValue([
                {
                    argLoc: { osLoc: "/test/config/path", jsonLoc: "profiles.testProfile.properties.host" },
                    argValue: "test.host.com",
                },
            ]);
            const postMessageSpy = vi.spyOn(configEditor.panel.webview, "postMessage").mockResolvedValue(undefined as any);

            await (configEditor as any).onDidReceiveMessage(mockMessage);

            expect(getWizardMergedPropertiesSpy).toHaveBeenCalledWith(
                mockMessage.rootProfile,
                mockMessage.profileType,
                mockMessage.configPath,
                mockMessage.profileName,
                mockMessage.changes,
                mockMessage.renames
            );
            expect(postMessageSpy).toHaveBeenCalledWith({
                command: "WIZARD_MERGED_PROPERTIES",
                mergedArgs: expect.any(Array),
            });
        });

        it("should handle SELECT_FILE command", async () => {
            const mockMessage = {
                command: "SELECT_FILE",
                fileType: "config",
            };

            const handleSelectFileSpy = vi.spyOn((configEditor as any).messageHandlers, "handleSelectFile").mockResolvedValue(undefined);

            await (configEditor as any).onDidReceiveMessage(mockMessage);

            expect(handleSelectFileSpy).toHaveBeenCalledWith(mockMessage);
        });

        it("should handle CREATE_NEW_CONFIG command", async () => {
            const mockMessage = {
                command: "CREATE_NEW_CONFIG",
                configPath: "/test/new/config/path",
            };

            const createNewConfigSpy = vi.spyOn((configEditor as any).fileOperations, "createNewConfig").mockResolvedValue({
                configs: [
                    {
                        configPath: "/test/new/config/path",
                        properties: { profiles: {} },
                        global: false,
                        user: true,
                    },
                ],
                parseErrors: [],
            });
            const areSecureValuesAllowedSpy = vi.spyOn(configEditor, "areSecureValuesAllowed").mockResolvedValue(true);
            // getTutorialSeen reads from ZoweLocalStorage.globalState which is undefined in unit tests
            vi.spyOn((configEditor as any).messageHandlers, "getTutorialSeen").mockReturnValue(false);
            const postMessageSpy = vi.spyOn(configEditor.panel.webview, "postMessage").mockResolvedValue(undefined as any);

            await (configEditor as any).onDidReceiveMessage(mockMessage);

            expect(createNewConfigSpy).toHaveBeenCalledWith(mockMessage);
            expect(areSecureValuesAllowedSpy).toHaveBeenCalled();
            expect(postMessageSpy).toHaveBeenCalledWith({
                command: "CONFIGURATIONS",
                contents: expect.any(Array),
                parseErrors: [],
                secureValuesAllowed: true,
                tutorialSeen: false,
            });
        });

        it("should handle GET_LOCAL_STORAGE_VALUE command", async () => {
            const mockMessage = {
                command: "GET_LOCAL_STORAGE_VALUE",
                key: "testKey",
            };

            const handleGetLocalStorageValueSpy = vi
                .spyOn((configEditor as any).messageHandlers, "handleGetLocalStorageValue")
                .mockResolvedValue(undefined);

            await (configEditor as any).onDidReceiveMessage(mockMessage);

            expect(handleGetLocalStorageValueSpy).toHaveBeenCalledWith(mockMessage);
        });

        it("should handle OPEN_VSCODE_SETTINGS command", async () => {
            const mockMessage = {
                command: "OPEN_VSCODE_SETTINGS",
                setting: "zowe.logger",
            };

            const handleOpenVscodeSettingsSpy = vi
                .spyOn((configEditor as any).messageHandlers, "handleOpenVscodeSettings")
                .mockResolvedValue(undefined);

            await (configEditor as any).onDidReceiveMessage(mockMessage);

            expect(handleOpenVscodeSettingsSpy).toHaveBeenCalledWith(mockMessage);
        });

        it("should handle SET_LOCAL_STORAGE_VALUE command", async () => {
            const mockMessage = {
                command: "SET_LOCAL_STORAGE_VALUE",
                key: "testKey",
                value: "testValue",
            };

            const handleSetLocalStorageValueSpy = vi
                .spyOn((configEditor as any).messageHandlers, "handleSetLocalStorageValue")
                .mockResolvedValue(undefined);

            await (configEditor as any).onDidReceiveMessage(mockMessage);

            expect(handleSetLocalStorageValueSpy).toHaveBeenCalledWith(mockMessage);
        });

        it("should handle SHOW_ERROR_MESSAGE command", async () => {
            const mockMessage = {
                command: "SHOW_ERROR_MESSAGE",
                message: "Test error message",
            };

            const showErrorMessageSpy = vi.spyOn(vscode.window, "showErrorMessage").mockResolvedValue(undefined);

            await (configEditor as any).onDidReceiveMessage(mockMessage);

            expect(showErrorMessageSpy).toHaveBeenCalledWith("Test error message");
        });

        it("should handle SAVE_CHANGES with error and refresh configurations", async () => {
            const mockMessage = {
                command: "SAVE_CHANGES",
                renames: [],
                otherChanges: [],
            };

            const getLocalConfigsSpy = vi.spyOn(configEditor, "getLocalConfigs").mockResolvedValue({ configs: [], parseErrors: [] });
            const areSecureValuesAllowedSpy = vi.spyOn(configEditor, "areSecureValuesAllowed").mockResolvedValue(true);
            const postMessageSpy = vi.spyOn(configEditor.panel.webview, "postMessage").mockResolvedValue(undefined as any);

            const mockProfileInfo = {
                readProfilesFromDisk: vi.fn().mockResolvedValue(undefined),
            };
            ConfigUtils.createProfileInfoAndLoad.mockResolvedValue(mockProfileInfo);

            ConfigUtils.parseConfigChanges.mockReturnValue([]);

            ConfigChangeHandlers.handleDefaultChanges = vi.fn().mockRejectedValue(new Error("Test error"));
            ConfigChangeHandlers.handleProfileChanges = vi.fn().mockResolvedValue(undefined);

            await (configEditor as any).onDidReceiveMessage(mockMessage);

            expect(postMessageSpy).toHaveBeenCalledWith({
                command: "CONFIGURATIONS",
                contents: [],
                parseErrors: [],
                secureValuesAllowed: true,
            });
            expect(postMessageSpy).toHaveBeenCalledWith({
                command: "DISABLE_OVERLAY",
            });
        });

        it("should handle SAVE_CHANGES with renames and update profile changes", async () => {
            const mockMessage = {
                command: "SAVE_CHANGES",
                renames: [
                    {
                        originalKey: "profiles.testProfile",
                        newKey: "profiles.renamedProfile",
                        configPath: "/test/config/path",
                    },
                ],
                changes: [
                    {
                        profile: "profiles.testProfile",
                        configPath: "/test/config/path",
                    },
                ],
            };

            const handleProfileRenamesSpy = vi.spyOn((configEditor as any).profileOperations, "handleProfileRenames").mockResolvedValue(undefined);
            const updateProfileChangesForRenamesSpy = vi
                .spyOn((configEditor as any).profileOperations, "updateProfileChangesForRenames")
                .mockResolvedValue(mockMessage);

            ConfigUtils.parseConfigChanges.mockReturnValue([]);

            ConfigChangeHandlers.handleDefaultChanges = vi.fn().mockResolvedValue(undefined);
            ConfigChangeHandlers.handleProfileChanges = vi.fn().mockResolvedValue(undefined);

            const mockProfileInfo = {
                readProfilesFromDisk: vi.fn().mockResolvedValue(undefined),
                getTeamConfig: vi.fn(() => ({
                    layers: [],
                })),
            };
            ConfigUtils.createProfileInfoAndLoad.mockResolvedValue(mockProfileInfo);

            await (configEditor as any).onDidReceiveMessage(mockMessage);

            expect(handleProfileRenamesSpy).toHaveBeenCalledWith(mockMessage.renames);
            expect(updateProfileChangesForRenamesSpy).toHaveBeenCalledWith(mockMessage, mockMessage.renames);
        });

        it("should handle unknown command gracefully", async () => {
            const mockMessage = {
                command: "UNKNOWN_COMMAND",
                data: "test",
            };

            await expect((configEditor as any).onDidReceiveMessage(mockMessage)).resolves.not.toThrow();
        });

        it("should handle SAVE_CHANGES with ConfigUtils.parseConfigChanges and ConfigChangeHandlers", async () => {
            const mockMessage = {
                command: "SAVE_CHANGES",
                renames: [],
                changes: [{ type: "profile", profile: "profiles.testProfile", configPath: "/test/config/path" }],
                otherChanges: [],
            };

            const mocks = createGlobalMocks();
            const mockProfileInfo = createMockProfileInfo({
                readProfilesFromDisk: mocks.mockFn.resolved,
            });

            ConfigUtils.createProfileInfoAndLoad.mockResolvedValue(mockProfileInfo);

            const parseConfigChangesSpy = vi.spyOn(ConfigUtils, "parseConfigChanges").mockReturnValue([
                {
                    changes: [{ key: "host", value: "new.host.com" }],
                    deletions: [],
                    configPath: "/test/config/path",
                },
            ]);

            // Use the mocked modules directly
            const mockedConfigChangeHandlers = { ConfigChangeHandlers };
            const handleDefaultChangesSpy = vi
                .spyOn(mockedConfigChangeHandlers.ConfigChangeHandlers, "handleDefaultChanges")
                .mockResolvedValue(undefined);
            const handleProfileChangesSpy = vi
                .spyOn(mockedConfigChangeHandlers.ConfigChangeHandlers, "handleProfileChanges")
                .mockResolvedValue(undefined);

            const getLocalConfigsSpy = vi.spyOn(configEditor as any, "getLocalConfigs").mockResolvedValue({ configs: [], parseErrors: [] });
            const areSecureValuesAllowedSpy = vi.spyOn(configEditor as any, "areSecureValuesAllowed").mockResolvedValue(true);
            const postMessageSpy = vi.spyOn((configEditor as any).panel.webview, "postMessage").mockResolvedValue(undefined);

            await (configEditor as any).onDidReceiveMessage(mockMessage);

            expect(parseConfigChangesSpy).toHaveBeenCalled();
            expect(handleProfileChangesSpy).toHaveBeenCalled();

            parseConfigChangesSpy.mockRestore();
            handleDefaultChangesSpy.mockRestore();
            handleProfileChangesSpy.mockRestore();
            getLocalConfigsSpy.mockRestore();
            areSecureValuesAllowedSpy.mockRestore();
            postMessageSpy.mockRestore();
        });

        it("should handle SAVE_CHANGES catch block with error handling and configuration refresh", async () => {
            const mockMessage = {
                command: "SAVE_CHANGES",
                renames: [],
                changes: [{ type: "profile", profile: "profiles.testProfile", configPath: "/test/config/path" }],
                otherChanges: [],
            };

            const mocks = createGlobalMocks();

            // Mock ZoweVsCodeExtension.workspaceRoot
            const workspaceRootSpy = vi.spyOn(ZoweVsCodeExtension, "workspaceRoot", "get").mockReturnValue({
                uri: { fsPath: "/test/workspace", scheme: "file", authority: "", path: "/test/workspace", query: "", fragment: "" } as any,
                name: "test-workspace",
                index: 0,
            } as any);

            // Mock console.error to track error logging
            const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

            // Mock ConfigUtils.parseConfigChanges to throw an error
            const originalParseConfigChanges = ConfigUtils.parseConfigChanges;
            ConfigUtils.parseConfigChanges = vi.fn().mockImplementation(() => {
                throw new Error("Parse config changes failed");
            });

            const getLocalConfigsSpy = vi.spyOn(configEditor as any, "getLocalConfigs").mockResolvedValue({ configs: [], parseErrors: [] });
            const areSecureValuesAllowedSpy = vi.spyOn(configEditor as any, "areSecureValuesAllowed").mockResolvedValue(true);
            const postMessageSpy = vi.spyOn((configEditor as any).panel.webview, "postMessage").mockResolvedValue(undefined);

            await (configEditor as any).onDidReceiveMessage(mockMessage);

            // Verify error was logged
            expect(consoleErrorSpy).toHaveBeenCalledWith("Save operation failed:", "Parse config changes failed");

            // Verify configuration refresh happened (via refreshConfigurationsAndNotifyWebview -> getLocalConfigs)
            expect(getLocalConfigsSpy).toHaveBeenCalled();
            expect(areSecureValuesAllowedSpy).toHaveBeenCalled();

            // Verify messages were sent to clear saving state
            expect(postMessageSpy).toHaveBeenCalledWith({
                command: "CONFIGURATIONS",
                contents: [],
                parseErrors: [],
                secureValuesAllowed: true,
            });
            expect(postMessageSpy).toHaveBeenCalledWith({
                command: "DISABLE_OVERLAY",
            });

            // Restore all mocks
            ConfigUtils.parseConfigChanges = originalParseConfigChanges;
            consoleErrorSpy.mockRestore();
            workspaceRootSpy.mockRestore();
            getLocalConfigsSpy.mockRestore();
            areSecureValuesAllowedSpy.mockRestore();
            postMessageSpy.mockRestore();
        });
    });
});
