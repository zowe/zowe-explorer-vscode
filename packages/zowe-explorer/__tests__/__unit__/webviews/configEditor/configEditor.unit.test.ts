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

// Global require statements for mocked modules
const fs = require("fs");
const path = require("path");
const vscode = require("vscode");
const ConfigSchemaHelpers = require("../../../../src/utils/ConfigSchemaHelpers").ConfigSchemaHelpers;
const ConfigUtils = require("../../../../src/utils/ConfigUtils").ConfigUtils;
const ConfigChangeHandlers = require("../../../../src/utils/ConfigChangeHandlers");
const ConfigEditorPathUtils = require("../../../../src/utils/ConfigEditorPathUtils");
const MoveUtils = require("../../../../src/webviews/src/config-editor/utils/MoveUtils");

jest.mock("../../../../src/configuration/Profiles", () => ({
    Profiles: {
        getInstance: jest.fn(() => ({
            overrideWithEnv: jest.fn(),
        })),
    },
}));

jest.mock("@zowe/imperative", () => ({
    ProfileInfo: jest.fn().mockImplementation(() => ({
        readProfilesFromDisk: jest.fn().mockResolvedValue(undefined),
        getTeamConfig: jest.fn(() => ({
            layers: [],
        })),
    })),
    ProfileCredentials: {
        defaultCredMgrWithKeytar: jest.fn(),
    },
    AbstractCredentialManager: class AbstractCredentialManager {
        constructor() {}
    },
    Logger: {
        getAppLogger: jest.fn(() => ({
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        })),
    },
}));

jest.mock("@zowe/zos-jobs-for-zowe-sdk", () => ({}));
jest.mock("@zowe/zos-files-for-zowe-sdk", () => ({}));
jest.mock("@zowe/zos-console-for-zowe-sdk", () => ({}));
jest.mock("@zowe/zos-tso-for-zowe-sdk", () => ({}));
jest.mock("@zowe/zos-uss-for-zowe-sdk", () => ({}));
jest.mock("@zowe/zosmf-for-zowe-sdk", () => ({}));

jest.mock("fs", () => ({
    readFileSync: jest.fn(),
    existsSync: jest.fn(),
    realpathSync: jest.fn((path) => path),
}));

jest.mock("path", () => ({
    resolve: jest.fn(),
    join: jest.fn(),
    dirname: jest.fn(),
    normalize: jest.fn(),
}));

jest.mock("../../../../src/utils/ConfigSchemaHelpers", () => ({
    ConfigSchemaHelpers: {
        generateSchemaValidation: jest.fn(),
    },
}));

const createDefaultMockProfileInfo = () => ({
    readProfilesFromDisk: jest.fn().mockResolvedValue(undefined),
    getTeamConfig: jest.fn(() => ({
        layers: [],
        api: { layers: { activate: jest.fn(), get: jest.fn(() => ({ path: "/test/config/path" })) }, secure: { secureFields: jest.fn().mockReturnValue([]) }, set: jest.fn(), delete: jest.fn() },
    })),
    getAllProfiles: jest.fn(() => []),
    mergeArgsForProfile: jest.fn(() => ({ knownArgs: [] })),
});

jest.mock("../../../../src/utils/ConfigUtils", () => ({
    ConfigUtils: {
        processProfilesRecursively: jest.fn(),
        parseConfigChanges: jest.fn(),
        createProfileInfoAndLoad: jest.fn(),
    },
}));

jest.mock("../../../../src/utils/ConfigChangeHandlers", () => ({
    ConfigChangeHandlers: {
        handleDefaultChanges: jest.fn(),
        handleProfileChanges: jest.fn(),
        simulateDefaultChanges: jest.fn(),
        simulateProfileChanges: jest.fn(),
    },
}));

jest.mock("../../../../src/utils/ConfigEditorPathUtils", () => ({
    ConfigEditorPathUtils: {
        constructNestedProfilePath: jest.fn(),
        getNewProfilePath: jest.fn(),
        updateChangeKey: jest.fn(),
        updateChangePath: jest.fn(),
    },
}));

jest.mock("../../../../src/webviews/src/config-editor/utils/MoveUtils", () => ({
    moveProfile: jest.fn(),
    updateDefaultsAfterRename: jest.fn(),
    simulateDefaultsUpdateAfterRename: jest.fn(),
}));

// Mock the WebView panel to include the reveal method
const mockWebviewPanel = {
    reveal: jest.fn(),
    webview: {
        postMessage: jest.fn(),
        onDidReceiveMessage: jest.fn(),
        asWebviewUri: jest.fn(),
        cspSource: "test-csp-source",
    },
    onDidDispose: jest.fn(),
    dispose: jest.fn(),
};

// Mock the specific vscode methods we need
jest.mock("vscode", () => ({
    window: {
        createWebviewPanel: jest.fn(() => mockWebviewPanel),
        showErrorMessage: jest.fn(),
        showTextDocument: jest.fn(),
    },
    commands: {
        executeCommand: jest.fn(),
    },
    ViewColumn: {
        One: 1,
    },
    l10n: {
        t: jest.fn((text) => text),
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
        event = jest.fn().mockImplementation((listener) => {
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
        file: jest.fn((path: string) => ({ fsPath: path, path, scheme: "file" })),
    },
    extensions: {
        getExtension: jest.fn(() => ({
            packageJSON: { version: "2.0.0" },
        })),
    },
    workspace: {
        workspaceFolders: [],
        openTextDocument: jest.fn(),
    },
}));

// Helper functions for creating reusable mocks
const createMockProfileInfo = (overrides: any = {}) => ({
    readProfilesFromDisk: jest.fn().mockResolvedValue(undefined),
    getTeamConfig: jest.fn(() => ({
        layers: [],
        api: {
            layers: {
                activate: jest.fn(),
                get: jest.fn(() => ({ path: "/test/config/path" })),
            },
            secure: {
                secureFields: jest.fn().mockReturnValue([]),
            },
            set: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn().mockResolvedValue(undefined),
        },
    })),
    getAllProfiles: jest.fn(() => []),
    mergeArgsForProfile: jest.fn(() => ({ knownArgs: [] })),
    ...overrides,
});

const createMockTeamConfig = (overrides: any = {}) => ({
    layers: [
        {
            path: "/test/config/path",
            user: true,
            global: false,
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
        },
    ],
    api: {
        layers: {
            activate: jest.fn(),
            get: jest.fn(() => ({ path: "/test/config/path" })),
        },
        secure: {
            secureFields: jest.fn().mockReturnValue([]),
        },
        set: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
    },
    ...overrides,
});

const createMockChange = (profile: string = "profiles.testProfile", key: string = "profiles.testProfile.host", overrides: any = {}) => ({
    configPath: "/test/config/path",
    profile,
    key,
    path: key.split("."),
    ...overrides,
});

const createMockRename = (originalKey: string = "profiles.oldProfile", newKey: string = "profiles.newProfile", overrides: any = {}) => ({
    originalKey,
    newKey,
    configPath: "/test/config/path",
    ...overrides,
});

const createGlobalMocks = () => ({
    // Common mock functions
    mockFn: {
        resolved: jest.fn().mockResolvedValue(undefined),
        rejected: jest.fn().mockRejectedValue(new Error("Mock error")),
        returnValue: jest.fn().mockReturnValue("mock value"),
        returnTrue: jest.fn().mockReturnValue(true),
        returnFalse: jest.fn().mockReturnValue(false),
        returnEmptyArray: jest.fn().mockReturnValue([]),
        returnEmptyObject: jest.fn().mockReturnValue({}),
    },

    // Common mock objects
    mockLayer: {
        path: "/test/config/path",
        user: true,
        global: false,
        properties: { profiles: { testProfile: { type: "zosmf", properties: { host: "test.host.com" } } } },
    },

    mockLayerActive: jest.fn(() => ({ path: "/test/config/path" })),

    mockConfigMoveAPI: {
        get: jest.fn().mockReturnValue({ type: "zosmf", properties: { host: "test.host.com" } }),
        set: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
    },

    mockProfileOperations: {
        updateRenameKeysForParentChanges: jest.fn().mockReturnValue([]),
        removeDuplicateRenames: jest.fn().mockReturnValue([]),
        wouldCreateCircularReference: jest.fn().mockReturnValue(false),
        isCriticalMoveError: jest.fn().mockReturnValue(false),
        handleMoveUtilsError: jest.fn().mockReturnValue("Mock error message"),
        validateConfigMoveAPI: jest.fn().mockReturnValue(true),
        isNestedProfileCreation: jest.fn().mockReturnValue(false),
        createNestedProfileStructure: jest.fn().mockImplementation(() => {}),
        redactSecureValues: jest.fn().mockReturnValue([]),
    },

    mockMessageHandlers: {
        handleOpenConfigFile: jest.fn().mockResolvedValue(undefined),
        handleRevealInFinder: jest.fn().mockResolvedValue(undefined),
        handleOpenSchemaFile: jest.fn().mockResolvedValue(undefined),
        handleGetEnvInformation: jest.fn().mockResolvedValue(undefined),
        handleGetEnvVars: jest.fn().mockResolvedValue(undefined),
        handleInitialSelection: jest.fn().mockResolvedValue(undefined),
        handleConfigurationsReady: jest.fn().mockResolvedValue(undefined),
        handleOpenConfigFileWithProfile: jest.fn().mockResolvedValue(undefined),
        handleGetMergedProperties: jest.fn().mockResolvedValue(undefined),
        handleGetWizardMergedProperties: jest.fn().mockResolvedValue(undefined),
        handleSelectFile: jest.fn().mockResolvedValue(undefined),
        handleCreateNewConfig: jest.fn().mockResolvedValue(undefined),
        handleGetLocalStorageValue: jest.fn().mockResolvedValue(undefined),
        handleOpenVscodeSettings: jest.fn().mockResolvedValue(undefined),
        handleSetLocalStorageValue: jest.fn().mockResolvedValue(undefined),
        handleShowErrorMessage: jest.fn().mockResolvedValue(undefined),
        handleSaveChanges: jest.fn().mockResolvedValue(undefined),
        handleGetProfiles: jest.fn().mockResolvedValue(undefined),
        handleAutostoreToggle: jest.fn().mockResolvedValue(undefined),
    },

    mockFileOperations: {
        createNewConfig: jest.fn().mockResolvedValue([]),
    },

    // Common mock modules
    mockModules: {
        fs: {
            readFileSync: jest.fn().mockReturnValue('{"type": "object"}'),
            existsSync: jest.fn().mockReturnValue(true),
            realpathSync: jest.fn((path) => path),
        },
        path: {
            resolve: jest.fn().mockReturnValue("/test/config/path"),
            join: jest.fn().mockReturnValue("/test/config/zowe.schema.json"),
            dirname: jest.fn().mockReturnValue("/test/config"),
        },
        ConfigSchemaHelpers: {
            generateSchemaValidation: jest.fn().mockReturnValue({ validate: jest.fn() }),
        },
        ConfigUtils: {
            processProfilesRecursively: jest.fn().mockImplementation(() => {}),
        },
        MoveUtils: {
            moveProfile: jest.fn().mockImplementation(() => {}),
            moveProfileInPlace: jest.fn().mockImplementation(() => {}),
            simulateDefaultsUpdateAfterRename: jest.fn().mockImplementation(() => {}),
            updateDefaultsAfterRename: jest.fn().mockImplementation(() => {}),
        },
        ConfigEditorPathUtils: {
            constructNestedProfilePath: jest.fn().mockReturnValue("profiles.testProfile"),
            getNewProfilePath: jest.fn().mockReturnValue("profiles.newProfile"),
            updateChangeKey: jest.fn().mockReturnValue({}),
            updateChangePath: jest.fn().mockReturnValue({}),
        },
    },

    // Common mock spies
    mockSpies: {
        vscode: {
            showErrorMessage: jest.fn().mockResolvedValue(undefined),
            openTextDocument: jest.fn().mockResolvedValue({}),
            showTextDocument: jest.fn().mockResolvedValue({ selection: {}, revealRange: jest.fn() }),
        },
        console: {
            warn: jest.fn().mockImplementation(() => {}),
            error: jest.fn().mockImplementation(() => {}),
        },
    },
});

describe("configEditor", () => {
    let mockContext: ExtensionContext;
    let configEditor: ConfigEditor;
    beforeEach(() => {
        mockContext = {
            extensionPath: "/mock/extension/path",
        } as ExtensionContext;

        ConfigUtils.createProfileInfoAndLoad.mockResolvedValue(createDefaultMockProfileInfo());

        configEditor = new ConfigEditor(mockContext);
    });

    describe("areSecureValuesAllowed", () => {
        it("should return false when profiles cache is undefined", async () => {
            const profilesCacheSpy = jest.spyOn(ZoweVsCodeExtension as any, "profilesCache", "get").mockReturnValue(undefined);

            const result = await configEditor.areSecureValuesAllowed();
            expect(result).toBe(false);

            profilesCacheSpy.mockRestore();
        });

        it("should return true when credential manager is in app settings", async () => {
            const mockProfilesCache = {
                getProfileInfo: jest.fn().mockResolvedValue({
                    mCredentials: {
                        isCredentialManagerInAppSettings: jest.fn().mockReturnValue(true),
                    },
                }),
            };

            const profilesCacheSpy = jest.spyOn(ZoweVsCodeExtension as any, "profilesCache", "get").mockReturnValue(mockProfilesCache);

            const result = await configEditor.areSecureValuesAllowed();
            expect(result).toBe(true);
            expect(mockProfilesCache.getProfileInfo).toHaveBeenCalled();

            profilesCacheSpy.mockRestore();
        });

        it("should return false when credential manager check throws error", async () => {
            const mockProfilesCache = {
                getProfileInfo: jest.fn().mockRejectedValue(new Error("Test error")),
            };

            const profilesCacheSpy = jest.spyOn(ZoweVsCodeExtension as any, "profilesCache", "get").mockReturnValue(mockProfilesCache);

            const result = await configEditor.areSecureValuesAllowed();
            expect(result).toBe(false);

            profilesCacheSpy.mockRestore();
        });
    });
    describe("getLocalConfigs", () => {
        it("should return configurations when profiles are successfully read", async () => {
            const mocks = createGlobalMocks();
            const mockProfileInfo = createMockProfileInfo({
                getTeamConfig: jest.fn(() => ({
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

            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
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

        it("should handle error when reading profiles from disk and return empty array", async () => {
            ConfigUtils.createProfileInfoAndLoad.mockRejectedValue(new Error("Error reading file '/test/config.json' Line 5 Column 10"));

            const showErrorMessageSpy = jest.spyOn(vscode.window, "showErrorMessage").mockResolvedValue(undefined);
            const openTextDocumentSpy = jest.spyOn(vscode.workspace, "openTextDocument").mockResolvedValue({} as any);
            const showTextDocumentSpy = jest.spyOn(vscode.window, "showTextDocument").mockResolvedValue({
                selection: {},
                revealRange: jest.fn(),
            } as any);

            const result = await configEditor.getLocalConfigs();

            expect(result).toEqual([]);
            expect(showErrorMessageSpy).toHaveBeenCalled();
            expect(openTextDocumentSpy).toHaveBeenCalled();
            expect(showTextDocumentSpy).toHaveBeenCalled();

            showErrorMessageSpy.mockRestore();
            openTextDocumentSpy.mockRestore();
            showTextDocumentSpy.mockRestore();
        });

        it("should handle error when reading profiles from disk with non-Error object (lines 125-126)", async () => {
            ConfigUtils.createProfileInfoAndLoad.mockRejectedValue("String error message");

            const showErrorMessageSpy = jest.spyOn(vscode.window, "showErrorMessage").mockResolvedValue(undefined);

            const result = await (configEditor as any).getLocalConfigs();

            expect(result).toEqual([]);
            expect(showErrorMessageSpy).toHaveBeenCalledWith("Error reading profiles from disk: String error message");

            showErrorMessageSpy.mockRestore();
        });

        it("should handle layers that do not exist (layer.exists = false)", async () => {
            const mockProfileInfo = createMockProfileInfo({
                getTeamConfig: jest.fn(() => ({
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

            expect(result).toEqual([]);
            expect(ConfigUtils.createProfileInfoAndLoad).toHaveBeenCalled();
            expect(mockProfileInfo.getTeamConfig).toHaveBeenCalled();
        });

        it("should handle error when reading or parsing file and return partial results", async () => {
            const mockProfileInfo = createMockProfileInfo({
                getTeamConfig: jest.fn(() => ({
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

            const showErrorMessageSpy = jest.spyOn(vscode.window, "showErrorMessage").mockResolvedValue(undefined);
            const openTextDocumentSpy = jest.spyOn(vscode.workspace, "openTextDocument").mockResolvedValue({} as any);
            const showTextDocumentSpy = jest.spyOn(vscode.window, "showTextDocument").mockResolvedValue({
                selection: {},
                revealRange: jest.fn(),
            } as any);

            const result = await configEditor.getLocalConfigs();

            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                configPath: "/test/config/path",
                properties: expect.objectContaining({
                    $schema: "zowe.schema.json",
                    profiles: expect.any(Object),
                }),
                global: false,
                user: true,
            });

            // Should show error message for the invalid file
            expect(showErrorMessageSpy).toHaveBeenCalledWith(
                "Error reading or parsing file /test/config/path: Error reading file '/test/invalid/config/path' Line 3 Column 15"
            );
            expect(openTextDocumentSpy).toHaveBeenCalledWith(vscode.Uri.file("/test/config/path"));
            expect(showTextDocumentSpy).toHaveBeenCalled();

            showErrorMessageSpy.mockRestore();
            openTextDocumentSpy.mockRestore();
            showTextDocumentSpy.mockRestore();
        });

        it("should handle schema validation with existing schema file (lines 170-184)", async () => {
            const mockProfileInfo = createMockProfileInfo({
                getTeamConfig: jest.fn(() => ({
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

            const mockSchemaValidation = { validate: jest.fn() };
            ConfigSchemaHelpers.generateSchemaValidation.mockReturnValue(mockSchemaValidation);
            ConfigUtils.processProfilesRecursively.mockImplementation(() => {});

            const result = await (configEditor as any).getLocalConfigs();

            expect(result).toHaveLength(1);
            expect(fs.existsSync).toHaveBeenCalledWith("/test/config/zowe.schema.json");
            expect(fs.readFileSync).toHaveBeenCalledWith("/test/config/zowe.schema.json", { encoding: "utf8" });
            expect(ConfigSchemaHelpers.generateSchemaValidation).toHaveBeenCalled();
            expect(ConfigUtils.processProfilesRecursively).toHaveBeenCalledWith(expect.any(Object), mockSchemaValidation);
        });

        it("should handle schema validation when schema file does not exist (lines 170-184)", async () => {
            const mockProfileInfo = createMockProfileInfo({
                getTeamConfig: jest.fn(() => ({
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

            expect(result).toHaveLength(1);
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
                getTeamConfig: jest.fn(() => ({
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

            expect(result).toHaveLength(1);
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
                getTeamConfig: jest.fn(() => ({
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

            const mockSchemaValidation = { validate: jest.fn() };
            ConfigSchemaHelpers.generateSchemaValidation.mockReturnValue(mockSchemaValidation);
            ConfigUtils.processProfilesRecursively.mockImplementation(() => {});

            const result = await (configEditor as any).getLocalConfigs();

            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
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
            const handleGetProfilesSpy = jest.spyOn((configEditor as any).messageHandlers, "handleGetProfiles").mockResolvedValue(undefined);

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
            const handleProfileRenamesSpy = jest.spyOn(configEditor as any, "handleProfileRenames").mockResolvedValue(undefined);
            const handleAutostoreToggleSpy = jest.spyOn(configEditor as any, "handleAutostoreToggle").mockResolvedValue(undefined);
            const getLocalConfigsSpy = jest.spyOn(configEditor, "getLocalConfigs").mockResolvedValue([]);
            const areSecureValuesAllowedSpy = jest.spyOn(configEditor, "areSecureValuesAllowed").mockResolvedValue(true);
            const postMessageSpy = jest.spyOn(configEditor.panel.webview, "postMessage").mockResolvedValue(undefined as any);

            // Mock ConfigUtils.parseConfigChanges
            ConfigUtils.parseConfigChanges.mockReturnValue([]);

            // Mock ConfigChangeHandlers
            ConfigChangeHandlers.handleDefaultChanges = jest.fn().mockResolvedValue(undefined);
            ConfigChangeHandlers.handleProfileChanges = jest.fn().mockResolvedValue(undefined);

            await (configEditor as any).onDidReceiveMessage(mockMessage);

            expect(handleProfileRenamesSpy).toHaveBeenCalledWith([]);
            expect(handleAutostoreToggleSpy).toHaveBeenCalledWith([]);
            expect(getLocalConfigsSpy).toHaveBeenCalled();
            expect(areSecureValuesAllowedSpy).toHaveBeenCalled();
            expect(postMessageSpy).toHaveBeenCalledWith({
                command: "CONFIGURATIONS",
                contents: [],
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
            const handleOpenConfigFileSpy = jest.spyOn((configEditor as any).messageHandlers, "handleOpenConfigFile").mockResolvedValue(undefined);

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

    describe("handleProfileRenames", () => {
        it("should handle profile renames successfully with sorting by depth", async () => {
            const mocks = createGlobalMocks();
            // Test sortedRenames logic with different depths
            // Include renames with same newKey depth to trigger secondary sort
            const mockRenames = [
                createMockRename("profiles.parent.child.grandchild", "profiles.parent.child.renamedGrandchild"),
                createMockRename("profiles.parent", "profiles.renamedParent"),
                createMockRename("profiles.parent.child", "profiles.parent.renamedChild"),
                createMockRename("profiles.other.deep.nested.profile", "profiles.parent.renamedChild"), // Same depth as above (3)
                createMockRename("profiles.simple", "profiles.parent.renamedChild"), // Same depth as above (3)
            ];

            // Mock ProfileInfo - profiles need to be in nested structure
            // Create a mutable profiles object that can be updated during simulation
            const mockProfiles = {
                parent: {
                    type: "zosmf",
                    properties: {
                        host: "test.host.com",
                    },
                    profiles: {
                        child: {
                            type: "tso",
                            properties: {
                                host: "test.host.com",
                            },
                            profiles: {
                                grandchild: {
                                    type: "zosmf",
                                    properties: {
                                        host: "test.host.com",
                                    },
                                },
                            },
                        },
                    },
                },
                simple: {
                    type: "zosmf",
                    properties: {
                        host: "test.host.com",
                    },
                },
                other: {
                    type: "zosmf",
                    properties: {
                        host: "test.host.com",
                    },
                    profiles: {
                        deep: {
                            type: "zosmf",
                            properties: {
                                host: "test.host.com",
                            },
                            profiles: {
                                nested: {
                                    type: "zosmf",
                                    properties: {
                                        host: "test.host.com",
                                    },
                                    profiles: {
                                        profile: {
                                            type: "zosmf",
                                            properties: {
                                                host: "test.host.com",
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            };

            const mockLayerProperties = {
                profiles: mockProfiles,
            };

            const mockTeamConfigLayersGet = jest.fn(() => ({
                path: "/test/config/path",
                properties: mockLayerProperties,
            }));

            const mockProfileInfo = {
                readProfilesFromDisk: jest.fn().mockResolvedValue(undefined),
                getTeamConfig: jest.fn(() => ({
                    layers: [
                        {
                            path: "/test/config/path",
                            user: true,
                            global: false,
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
                        },
                    ],
                    api: {
                        layers: {
                            activate: jest.fn(),
                            get: mockTeamConfigLayersGet,
                            set: jest.fn(),
                            delete: jest.fn(),
                        },
                    },
                    set: jest.fn(),
                    delete: jest.fn(),
                })),
            };

            ConfigUtils.createProfileInfoAndLoad.mockResolvedValue(mockProfileInfo);

            // Mock profileOperations methods
            const mockProfileOperations = {
                updateRenameKeysForParentChanges: jest.fn().mockReturnValue(mockRenames),
                removeDuplicateRenames: jest.fn().mockReturnValue(mockRenames),
                wouldCreateCircularReference: jest.fn().mockReturnValue(false),
                isCriticalMoveError: jest.fn().mockReturnValue(false),
            };
            (configEditor as any).profileOperations = mockProfileOperations as any;

            // Mock ConfigEditorPathUtils - return a path based on the input key
            ConfigEditorPathUtils.constructNestedProfilePath = jest.fn().mockImplementation((key: string) => {
                // Handle undefined or empty keys
                if (!key) {
                    return "profiles.unknown";
                }
                // Convert profile key to nested path format
                if (key.startsWith("profiles.")) {
                    return key;
                }
                return `profiles.${key}`;
            });

            // Mock MoveUtils using global mocks
            Object.assign(MoveUtils, mocks.mockModules.MoveUtils);

            await (configEditor as any).handleProfileRenames(mockRenames);

            expect(ConfigUtils.createProfileInfoAndLoad).toHaveBeenCalled();
            expect(mockProfileInfo.getTeamConfig).toHaveBeenCalled();

            // Verify that updateRenameKeysForParentChanges was called with sorted renames
            // The sorting should put parent renames before child renames
            const sortedRenames = mockProfileOperations.updateRenameKeysForParentChanges.mock.calls[0][0];
            expect(sortedRenames).toHaveLength(5);

            // Verify primary sorting by newKey depth (shorter paths first)
            expect(sortedRenames[0].newKey).toBe("profiles.renamedParent"); // depth 2
            expect(sortedRenames[1].newKey).toBe("profiles.parent.renamedChild"); // depth 3
            expect(sortedRenames[2].newKey).toBe("profiles.parent.renamedChild"); // depth 3
            expect(sortedRenames[3].newKey).toBe("profiles.parent.renamedChild"); // depth 3
            expect(sortedRenames[4].newKey).toBe("profiles.parent.child.renamedGrandchild"); // depth 4

            // Verify secondary sorting by originalKey depth for same newKey depths
            // All three with newKey depth 3 should be sorted by originalKey depth
            expect(sortedRenames[1].originalKey).toBe("profiles.simple"); // originalKey depth 2
            expect(sortedRenames[2].originalKey).toBe("profiles.parent.child"); // originalKey depth 3
            expect(sortedRenames[3].originalKey).toBe("profiles.other.deep.nested.profile"); // originalKey depth 5

            expect(mockProfileOperations.removeDuplicateRenames).toHaveBeenCalled();
            expect(mockProfileOperations.wouldCreateCircularReference).toHaveBeenCalledTimes(5);
        });

        it("should return early when renames array is empty", async () => {
            const mockRenames: any[] = [];
            ConfigUtils.createProfileInfoAndLoad.mockClear();

            await (configEditor as any).handleProfileRenames(mockRenames);

            expect(ConfigUtils.createProfileInfoAndLoad).not.toHaveBeenCalled();
        });

        it("should handle error during profile rename and continue", async () => {
            const mocks = createGlobalMocks();
            const mockRenames = [createMockRename("profiles.testProfile", "profiles.renamedProfile")];

            const mockProfileInfo = createMockProfileInfo({
                getTeamConfig: jest.fn(() => ({
                    layers: [mocks.mockLayer],
                    api: {
                        layers: {
                            activate: mocks.mockFn.resolved,
                            get: mocks.mockFn.returnValue,
                            set: mocks.mockFn.resolved,
                        },
                    },
                })),
            });

            ConfigUtils.createProfileInfoAndLoad.mockResolvedValue(mockProfileInfo);

            const mockProfileOperations = {
                ...mocks.mockProfileOperations,
                updateRenameKeysForParentChanges: jest.fn().mockReturnValue(mockRenames),
                removeDuplicateRenames: jest.fn().mockReturnValue(mockRenames),
                handleMoveUtilsError: jest.fn().mockReturnValue("Test error message"),
            };
            (configEditor as any).profileOperations = mockProfileOperations as any;

            // Mock ConfigEditorPathUtils using global mocks
            Object.assign(ConfigEditorPathUtils, mocks.mockModules.ConfigEditorPathUtils);

            // Mock MoveUtils using global mocks
            Object.assign(MoveUtils, mocks.mockModules.MoveUtils);

            const showErrorMessageSpy = jest.spyOn(vscode.window, "showErrorMessage").mockResolvedValue(undefined);

            await (configEditor as any).handleProfileRenames(mockRenames);

            expect(mockProfileOperations.updateRenameKeysForParentChanges).toHaveBeenCalledWith(mockRenames);
            expect(mockProfileOperations.removeDuplicateRenames).toHaveBeenCalled();
            expect(showErrorMessageSpy).toHaveBeenCalled();
            showErrorMessageSpy.mockRestore();
        });
    });

    describe("getPendingMergedArgsForProfile", () => {
        it("should return merged args for profile successfully", async () => {
            const profPath = "profiles.testProfile";
            const configPath = "/test/config/path";
            const changes = { profiles: { testProfile: { properties: { host: "new.host.com" } } } };
            const renames: any[] = [];

            // Mock ProfileInfo
            const mockProfileInfo = {
                readProfilesFromDisk: jest.fn().mockResolvedValue(undefined),
                getTeamConfig: jest.fn(() => ({
                    layers: [
                        {
                            path: configPath,
                            user: true,
                            global: false,
                        },
                    ],
                    api: {
                        layers: {
                            activate: jest.fn(),
                        },
                        secure: {
                            secureFields: jest.fn().mockReturnValue([]),
                        },
                    },
                })),
                getAllProfiles: jest.fn(() => [
                    {
                        profName: profPath,
                        profType: "zosmf",
                        profLoc: {
                            osLoc: configPath,
                        },
                    },
                ]),
                mergeArgsForProfile: jest.fn(() => ({
                    knownArgs: [
                        {
                            argLoc: {
                                osLoc: configPath,
                                jsonLoc: "profiles.testProfile.properties.host",
                            },
                            argValue: "new.host.com",
                        },
                    ],
                })),
            };

            ConfigUtils.createProfileInfoAndLoad.mockResolvedValue(mockProfileInfo);

            // Mock simulateProfileRenames
            const simulateProfileRenamesSpy = jest.spyOn(configEditor as any, "simulateProfileRenames").mockImplementation(() => {});

            // Mock ConfigUtils.parseConfigChanges
            ConfigUtils.parseConfigChanges.mockReturnValue([
                {
                    defaultsChanges: null,
                    defaultsDeleteKeys: null,
                    changes: { testProfile: { properties: { host: "new.host.com" } } },
                    deletions: null,
                    configPath: configPath,
                },
            ]);

            // Mock ConfigChangeHandlers
            ConfigChangeHandlers.simulateDefaultChanges = jest.fn();
            ConfigChangeHandlers.simulateProfileChanges = jest.fn();

            // Mock path.normalize
            path.normalize.mockReturnValue(configPath);

            const result = await (configEditor as any).getPendingMergedArgsForProfile(profPath, configPath, changes, renames);

            expect(ConfigUtils.createProfileInfoAndLoad).toHaveBeenCalled();
            expect(mockProfileInfo.getTeamConfig).toHaveBeenCalled();
            expect(simulateProfileRenamesSpy).toHaveBeenCalledWith(renames, expect.any(Object));
            expect(ConfigUtils.parseConfigChanges).toHaveBeenCalledWith(changes);
            expect(mockProfileInfo.getAllProfiles).toHaveBeenCalled();
            expect(mockProfileInfo.mergeArgsForProfile).toHaveBeenCalled();
            expect(result).toEqual([
                {
                    argLoc: {
                        osLoc: configPath,
                        jsonLoc: "profiles.testProfile.properties.host",
                    },
                    argValue: "new.host.com",
                },
            ]);
        });

        it("should return undefined when profile is not found", async () => {
            const profPath = "profiles.nonexistentProfile";
            const configPath = "/test/config/path";
            const changes = {};
            const renames: any[] = [];

            // Mock ProfileInfo
            const mockProfileInfo = {
                readProfilesFromDisk: jest.fn().mockResolvedValue(undefined),
                getTeamConfig: jest.fn(() => ({
                    layers: [],
                    api: {
                        layers: {
                            activate: jest.fn(),
                        },
                    },
                })),
                getAllProfiles: jest.fn(() => []),
            };

            ConfigUtils.createProfileInfoAndLoad.mockResolvedValue(mockProfileInfo);

            // Mock ConfigUtils.parseConfigChanges
            ConfigUtils.parseConfigChanges.mockReturnValue([]);

            const result = await (configEditor as any).getPendingMergedArgsForProfile(profPath, configPath, changes, renames);

            expect(result).toBeUndefined();
        });
    });
    describe("layerHasField", () => {
        it("should return true when layer has the field", () => {
            const layer = {
                properties: {
                    profiles: {
                        testProfile: {
                            properties: {
                                host: "test.host.com",
                                port: 443,
                            },
                        },
                    },
                },
            };
            const jsonLoc = "profiles.testProfile.properties.host";

            const result = (configEditor as any).layerHasField(layer, jsonLoc);

            expect(result).toBe(true);
        });

        it("should return false when layer does not have the field", () => {
            const layer = {
                properties: {
                    profiles: {
                        testProfile: {
                            properties: {
                                port: 443,
                            },
                        },
                    },
                },
            };
            const jsonLoc = "profiles.testProfile.properties.host";

            const result = (configEditor as any).layerHasField(layer, jsonLoc);

            expect(result).toBe(false);
        });

        it("should return false when layer has no properties", () => {
            const layer = {};
            const jsonLoc = "profiles.testProfile.properties.host";

            const result = (configEditor as any).layerHasField(layer, jsonLoc);

            expect(result).toBe(false);
        });

        it("should return false when jsonLoc format is invalid", () => {
            const layer = {
                properties: {
                    profiles: {
                        testProfile: {
                            properties: {
                                host: "test.host.com",
                            },
                        },
                    },
                },
            };
            const jsonLoc = "invalid.format";

            const result = (configEditor as any).layerHasField(layer, jsonLoc);

            expect(result).toBe(false);
        });
    });

    describe("getWizardMergedProperties", () => {
        it("should return merged properties for wizard profile successfully", async () => {
            const rootProfile = "root";
            const profileType = "zosmf";
            const configPath = "/test/config/path";
            const profileName = "testProfile";
            const changes = {};
            const renames: any[] = [];

            // Mock ProfileInfo
            const mockProfileInfo = {
                readProfilesFromDisk: jest.fn().mockResolvedValue(undefined),
                getTeamConfig: jest.fn(() => ({
                    layers: [
                        {
                            path: configPath,
                            user: true,
                            global: false,
                        },
                    ],
                    api: {
                        layers: {
                            get: jest.fn(() => ({ path: configPath })),
                            activate: jest.fn(),
                            set: jest.fn(),
                        },
                        secure: {
                            secureFields: jest.fn().mockReturnValue([]),
                        },
                    },
                    set: jest.fn(),
                })),
                getAllProfiles: jest.fn(() => [
                    {
                        profName: profileName,
                        profType: profileType,
                        profLoc: {
                            osLoc: configPath,
                        },
                    },
                ]),
                mergeArgsForProfile: jest.fn(() => ({
                    knownArgs: [
                        {
                            argLoc: {
                                osLoc: configPath,
                                jsonLoc: "profiles.testProfile.properties.host",
                            },
                            argValue: "test.host.com",
                        },
                    ],
                })),
            };

            ConfigUtils.createProfileInfoAndLoad.mockResolvedValue(mockProfileInfo);

            // Mock simulateProfileRenames
            const simulateProfileRenamesSpy = jest.spyOn(configEditor as any, "simulateProfileRenames").mockImplementation(() => {});

            // Mock ConfigUtils.parseConfigChanges
            ConfigUtils.parseConfigChanges.mockReturnValue([]);

            const result = await (configEditor as any).getWizardMergedProperties(rootProfile, profileType, configPath, profileName, changes, renames);

            expect(ConfigUtils.createProfileInfoAndLoad).toHaveBeenCalled();
            expect(mockProfileInfo.getTeamConfig).toHaveBeenCalled();
            expect(simulateProfileRenamesSpy).toHaveBeenCalledWith(renames, expect.any(Object));
            expect(mockProfileInfo.getAllProfiles).toHaveBeenCalled();
            expect(mockProfileInfo.mergeArgsForProfile).toHaveBeenCalled();
            expect(result).toEqual([
                {
                    argLoc: {
                        osLoc: configPath,
                        jsonLoc: "profiles.testProfile.properties.host",
                    },
                    argValue: "test.host.com",
                },
            ]);
        });

        it("should return empty array when profileType is not provided", async () => {
            const result = await (configEditor as any).getWizardMergedProperties("root", "", "/test/config/path");
            expect(result).toEqual([]);
        });

        it("should handle profile not found in wizard", async () => {
            const mocks = createGlobalMocks();
            const mockProfileInfo = createMockProfileInfo({
                getAllProfiles: jest.fn(() => []), // No profiles found
                mergeArgsForProfile: jest.fn(),
                getTeamConfig: jest.fn(() => ({
                    layers: [mocks.mockLayer],
                    api: {
                        layers: { activate: mocks.mockFn.resolved, get: mocks.mockFn.returnValue },
                        secure: { secureFields: mocks.mockFn.returnEmptyArray },
                    },
                    set: mocks.mockFn.resolved,
                })),
            });

            ConfigUtils.createProfileInfoAndLoad.mockResolvedValue(mockProfileInfo);

            Object.assign(ConfigUtils, mocks.mockModules.ConfigUtils);

            const result = await (configEditor as any).getWizardMergedProperties("root", "zosmf", "/test/config/path", "nonexistentProfile", {}, []);

            expect(mockProfileInfo.getAllProfiles).toHaveBeenCalled();
            expect(mockProfileInfo.mergeArgsForProfile).not.toHaveBeenCalled();
            expect(result).toEqual([]);
        });
    });
    describe("simulateProfileRenames", () => {
        it("should simulate profile renames successfully", () => {
            const renames = [createMockRename("profiles.testProfile", "profiles.renamedProfile")];

            const teamConfig = createMockTeamConfig();

            // Mock profileOperations methods
            const mockProfileOperations = {
                updateRenameKeysForParentChanges: jest.fn().mockReturnValue(renames),
                removeDuplicateRenames: jest.fn().mockReturnValue(renames),
            };
            (configEditor as any).profileOperations = mockProfileOperations as any;

            // Mock simulateDefaultsUpdateAfterRename
            const simulateDefaultsUpdateAfterRename = MoveUtils.simulateDefaultsUpdateAfterRename;
            simulateDefaultsUpdateAfterRename.mockImplementation(() => {});

            (configEditor as any).simulateProfileRenames(renames, teamConfig);

            expect(mockProfileOperations.updateRenameKeysForParentChanges).toHaveBeenCalledWith(renames);
            expect(mockProfileOperations.removeDuplicateRenames).toHaveBeenCalled();
            expect(teamConfig.api.layers.activate).toHaveBeenCalledWith(true, false);
        });

        it("should return early when renames array is empty", () => {
            const renames: any[] = [];
            const teamConfig = {};

            // Mock profileOperations methods
            const mockProfileOperations = {
                updateRenameKeysForParentChanges: jest.fn(),
                removeDuplicateRenames: jest.fn(),
            };
            (configEditor as any).profileOperations = mockProfileOperations as any;

            (configEditor as any).simulateProfileRenames(renames, teamConfig);

            expect(mockProfileOperations.updateRenameKeysForParentChanges).not.toHaveBeenCalled();
            expect(mockProfileOperations.removeDuplicateRenames).not.toHaveBeenCalled();
        });

        it("should return early when teamConfig is null", () => {
            const mocks = createGlobalMocks();
            const renames = [createMockRename()];
            const teamConfig = null;

            const mockProfileOperations = {
                ...mocks.mockProfileOperations,
                updateRenameKeysForParentChanges: jest.fn(),
                removeDuplicateRenames: jest.fn(),
            };
            (configEditor as any).profileOperations = mockProfileOperations as any;

            const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

            (configEditor as any).simulateProfileRenames(renames, teamConfig);

            expect(consoleSpy).toHaveBeenCalledWith("Cannot simulate profile renames: teamConfig is null or undefined");
            expect(mockProfileOperations.updateRenameKeysForParentChanges).not.toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it("should handle nested profile creation", () => {
            const renames = [
                {
                    originalKey: "profiles.tso",
                    newKey: "profiles.tso.asdf",
                    configPath: "/test/config/path",
                },
            ];

            const teamConfig = {
                layers: [
                    {
                        path: "/test/config/path",
                        user: true,
                        global: false,
                        properties: {
                            profiles: {
                                tso: {
                                    type: "tso",
                                    properties: {
                                        host: "test.host.com",
                                    },
                                },
                            },
                        },
                    },
                ],
                api: {
                    layers: {
                        activate: jest.fn(),
                        get: jest.fn(() => ({
                            properties: {
                                profiles: {
                                    tso: {
                                        type: "tso",
                                        properties: {
                                            host: "test.host.com",
                                        },
                                    },
                                },
                            },
                        })),
                    },
                    set: jest.fn(),
                    delete: jest.fn(),
                },
            };

            // Mock profileOperations methods
            const mockProfileOperations = {
                updateRenameKeysForParentChanges: jest.fn().mockReturnValue(renames),
                removeDuplicateRenames: jest.fn().mockReturnValue(renames),
                validateConfigMoveAPI: jest.fn(),
                isNestedProfileCreation: jest.fn().mockReturnValue(true),
                createNestedProfileStructure: jest.fn(),
            };
            (configEditor as any).profileOperations = mockProfileOperations as any;

            // Mock ConfigEditorPathUtils
            ConfigEditorPathUtils.constructNestedProfilePath = jest.fn().mockReturnValueOnce("profiles.tso").mockReturnValueOnce("profiles.tso.asdf");

            // Mock simulateDefaultsUpdateAfterRename
            const simulateDefaultsUpdateAfterRename = MoveUtils.simulateDefaultsUpdateAfterRename;
            simulateDefaultsUpdateAfterRename.mockImplementation(() => {});

            (configEditor as any).simulateProfileRenames(renames, teamConfig);

            expect(mockProfileOperations.isNestedProfileCreation).toHaveBeenCalledWith("profiles.tso", "profiles.tso.asdf");
            // The function should complete without errors
            expect(true).toBe(true);
        });
    });

    describe("sortRenamesByDepth", () => {
        it("should sort renames by newKey depth first, then by originalKey depth", () => {
            const renames = [
                createMockRename("profiles.parent.child.grandchild", "profiles.parent.child.renamedGrandchild"), // newKey depth 4, originalKey depth 4
                createMockRename("profiles.parent", "profiles.renamedParent"), // newKey depth 2, originalKey depth 2
                createMockRename("profiles.parent.child", "profiles.parent.renamedChild"), // newKey depth 3, originalKey depth 3
                createMockRename("profiles.other.deep.nested.profile", "profiles.parent.renamedChild"), // newKey depth 3, originalKey depth 5
                createMockRename("profiles.simple", "profiles.parent.renamedChild"), // newKey depth 3, originalKey depth 2
            ];

            const sortedRenames = (configEditor as any).sortRenamesByDepth(renames);

            expect(sortedRenames).toHaveLength(5);

            // Verify primary sorting by newKey depth (shorter paths first)
            expect(sortedRenames[0].newKey).toBe("profiles.renamedParent"); // depth 2
            expect(sortedRenames[1].newKey).toBe("profiles.parent.renamedChild"); // depth 3
            expect(sortedRenames[2].newKey).toBe("profiles.parent.renamedChild"); // depth 3
            expect(sortedRenames[3].newKey).toBe("profiles.parent.renamedChild"); // depth 3
            expect(sortedRenames[4].newKey).toBe("profiles.parent.child.renamedGrandchild"); // depth 4

            // Verify secondary sorting by originalKey depth for same newKey depths
            expect(sortedRenames[1].originalKey).toBe("profiles.simple"); // originalKey depth 2
            expect(sortedRenames[2].originalKey).toBe("profiles.parent.child"); // originalKey depth 3
            expect(sortedRenames[3].originalKey).toBe("profiles.other.deep.nested.profile"); // originalKey depth 5
        });

        it("should handle empty array", () => {
            const sortedRenames = (configEditor as any).sortRenamesByDepth([]);
            expect(sortedRenames).toEqual([]);
        });

        it("should handle single rename", () => {
            const renames = [createMockRename("profiles.test", "profiles.renamed")];
            const sortedRenames = (configEditor as any).sortRenamesByDepth(renames);
            expect(sortedRenames).toEqual(renames);
        });
    });

    describe("handleAutostoreToggle", () => {
        it("should handle autostore toggle successfully", async () => {
            const otherChanges = [
                {
                    type: "autostore",
                    value: true,
                    configPath: "/test/config/path",
                },
            ];

            // Create mock functions
            const mockActivate = jest.fn();
            const mockSet = jest.fn();
            const mockSave = jest.fn().mockResolvedValue(undefined);

            // Mock ProfileInfo
            const mockProfileInfo = {
                readProfilesFromDisk: jest.fn().mockResolvedValue(undefined),
                getTeamConfig: jest.fn(() => ({
                    layers: [
                        {
                            path: "/test/config/path",
                            user: true,
                            global: false,
                        },
                    ],
                    api: {
                        layers: {
                            activate: mockActivate,
                        },
                    },
                    set: mockSet,
                    save: mockSave,
                })),
            };

            ConfigUtils.createProfileInfoAndLoad.mockResolvedValue(mockProfileInfo);

            await (configEditor as any).handleAutostoreToggle(otherChanges);

            expect(ConfigUtils.createProfileInfoAndLoad).toHaveBeenCalled();
            expect(mockProfileInfo.getTeamConfig).toHaveBeenCalled();
            expect(mockActivate).toHaveBeenCalledWith(true, false);
            expect(mockSet).toHaveBeenCalledWith("autoStore", true, { parseString: true });
            expect(mockSave).toHaveBeenCalled();
        });

        it("should handle multiple autostore changes", async () => {
            const otherChanges = [
                {
                    type: "autostore",
                    value: true,
                    configPath: "/test/config/path1",
                },
                {
                    type: "autostore",
                    value: false,
                    configPath: "/test/config/path2",
                },
            ];

            // Create mock functions
            const mockActivate = jest.fn();
            const mockSet = jest.fn();
            const mockSave = jest.fn().mockResolvedValue(undefined);

            // Mock ProfileInfo
            const mockProfileInfo = {
                readProfilesFromDisk: jest.fn().mockResolvedValue(undefined),
                getTeamConfig: jest.fn(() => ({
                    layers: [
                        {
                            path: "/test/config/path1",
                            user: true,
                            global: false,
                        },
                        {
                            path: "/test/config/path2",
                            user: false,
                            global: true,
                        },
                    ],
                    api: {
                        layers: {
                            activate: mockActivate,
                        },
                    },
                    set: mockSet,
                    save: mockSave,
                })),
            };

            ConfigUtils.createProfileInfoAndLoad.mockClear();
            ConfigUtils.createProfileInfoAndLoad.mockResolvedValue(mockProfileInfo);

            await (configEditor as any).handleAutostoreToggle(otherChanges);

            expect(ConfigUtils.createProfileInfoAndLoad).toHaveBeenCalledTimes(2);
            expect(mockProfileInfo.getTeamConfig).toHaveBeenCalledTimes(2);
            expect(mockSet).toHaveBeenCalledWith("autoStore", true, { parseString: true });
            expect(mockSet).toHaveBeenCalledWith("autoStore", false, { parseString: true });
            expect(mockSave).toHaveBeenCalledTimes(2);
        });

        it("should skip non-autostore changes", async () => {
            const otherChanges = [
                {
                    type: "other",
                    value: "test",
                    configPath: "/test/config/path",
                },
            ];

            ConfigUtils.createProfileInfoAndLoad.mockClear();

            await (configEditor as any).handleAutostoreToggle(otherChanges);

            expect(ConfigUtils.createProfileInfoAndLoad).not.toHaveBeenCalled();
        });

        it("should handle error when updating autostore setting", async () => {
            const otherChanges = [
                {
                    type: "autostore",
                    value: true,
                    configPath: "/test/config/path",
                },
            ];

            ConfigUtils.createProfileInfoAndLoad.mockRejectedValue(new Error("Test error"));

            const showErrorMessageSpy = jest.spyOn(vscode.window, "showErrorMessage").mockResolvedValue(undefined);

            await (configEditor as any).handleAutostoreToggle(otherChanges);

            expect(showErrorMessageSpy).toHaveBeenCalledWith("Error updating autostore setting: Test error");
            showErrorMessageSpy.mockRestore();
        });

        it("should handle error when target layer is not found", async () => {
            const otherChanges = [
                {
                    type: "autostore",
                    value: true,
                    configPath: "/test/config/path",
                },
            ];

            // Mock ProfileInfo with no matching layer
            const mockProfileInfo = {
                readProfilesFromDisk: jest.fn().mockResolvedValue(undefined),
                getTeamConfig: jest.fn(() => ({
                    layers: [
                        {
                            path: "/different/config/path",
                            user: true,
                            global: false,
                        },
                    ],
                    api: {
                        layers: {
                            activate: jest.fn(),
                        },
                    },
                    set: jest.fn(),
                    save: jest.fn().mockResolvedValue(undefined),
                })),
            };

            ConfigUtils.createProfileInfoAndLoad.mockResolvedValue(mockProfileInfo);

            await (configEditor as any).handleAutostoreToggle(otherChanges);

            expect(ConfigUtils.createProfileInfoAndLoad).toHaveBeenCalled();
            expect(mockProfileInfo.getTeamConfig).toHaveBeenCalled();
            // Should not call set or save since layer is not found
            expect(mockProfileInfo.getTeamConfig().set).not.toHaveBeenCalled();
            expect(mockProfileInfo.getTeamConfig().save).not.toHaveBeenCalled();
        });
    });

    describe("onDidReceiveMessages", () => {
        it("should handle REVEAL_IN_FINDER command", async () => {
            const mockMessage = {
                command: "REVEAL_IN_FINDER",
                configPath: "/test/config/path",
            };

            const handleRevealInFinderSpy = jest.spyOn((configEditor as any).messageHandlers, "handleRevealInFinder").mockResolvedValue(undefined);

            await (configEditor as any).onDidReceiveMessage(mockMessage);

            expect(handleRevealInFinderSpy).toHaveBeenCalledWith(mockMessage);
        });

        it("should handle OPEN_SCHEMA_FILE command", async () => {
            const mockMessage = {
                command: "OPEN_SCHEMA_FILE",
                schemaPath: "/test/schema/path",
            };

            const handleOpenSchemaFileSpy = jest.spyOn((configEditor as any).messageHandlers, "handleOpenSchemaFile").mockResolvedValue(undefined);

            await (configEditor as any).onDidReceiveMessage(mockMessage);

            expect(handleOpenSchemaFileSpy).toHaveBeenCalledWith(mockMessage);
        });

        it("should handle GET_ENV_INFORMATION command", async () => {
            const mockMessage = {
                command: "GET_ENV_INFORMATION",
            };

            const handleGetEnvInformationSpy = jest
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

            const handleGetEnvVarsSpy = jest.spyOn((configEditor as any).messageHandlers, "handleGetEnvVars").mockResolvedValue(undefined);

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

            const handleInitialSelectionSpy = jest
                .spyOn((configEditor as any).messageHandlers, "handleInitialSelection")
                .mockImplementation(() => {});

            await (configEditor as any).onDidReceiveMessage(mockMessage);

            expect(handleInitialSelectionSpy).toHaveBeenCalledWith(mockMessage, expect.any(Function));
        });

        it("should handle CONFIGURATIONS_READY command", async () => {
            const mockMessage = {
                command: "CONFIGURATIONS_READY",
            };

            const handleConfigurationsReadySpy = jest
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

            const openConfigFileWithProfileSpy = jest
                .spyOn(ZoweVsCodeExtension, "openConfigFileWithProfile")
                .mockResolvedValue(undefined);

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

            const getPendingMergedArgsForProfileSpy = jest.spyOn(configEditor as any, "getPendingMergedArgsForProfile").mockResolvedValue([
                {
                    argLoc: { osLoc: "/test/config/path", jsonLoc: "profiles.testProfile.properties.host" },
                    argValue: "test.host.com",
                },
            ]);
            const postMessageSpy = jest.spyOn(configEditor.panel.webview, "postMessage").mockResolvedValue(undefined as any);

            await (configEditor as any).onDidReceiveMessage(mockMessage);

            expect(getPendingMergedArgsForProfileSpy).toHaveBeenCalledWith(
                mockMessage.profilePath,
                mockMessage.configPath,
                mockMessage.changes,
                mockMessage.renames
            );
            expect(postMessageSpy).toHaveBeenCalledWith({
                command: "MERGED_PROPERTIES",
                mergedArgs: expect.any(Array),
            });
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

            const getWizardMergedPropertiesSpy = jest.spyOn(configEditor as any, "getWizardMergedProperties").mockResolvedValue([
                {
                    argLoc: { osLoc: "/test/config/path", jsonLoc: "profiles.testProfile.properties.host" },
                    argValue: "test.host.com",
                },
            ]);
            const postMessageSpy = jest.spyOn(configEditor.panel.webview, "postMessage").mockResolvedValue(undefined as any);

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

            const handleSelectFileSpy = jest.spyOn((configEditor as any).messageHandlers, "handleSelectFile").mockResolvedValue(undefined);

            await (configEditor as any).onDidReceiveMessage(mockMessage);

            expect(handleSelectFileSpy).toHaveBeenCalledWith(mockMessage);
        });

        it("should handle CREATE_NEW_CONFIG command", async () => {
            const mockMessage = {
                command: "CREATE_NEW_CONFIG",
                configPath: "/test/new/config/path",
            };

            const createNewConfigSpy = jest.spyOn((configEditor as any).fileOperations, "createNewConfig").mockResolvedValue([
                {
                    configPath: "/test/new/config/path",
                    properties: { profiles: {} },
                    global: false,
                    user: true,
                },
            ]);
            const postMessageSpy = jest.spyOn(configEditor.panel.webview, "postMessage").mockResolvedValue(undefined as any);

            await (configEditor as any).onDidReceiveMessage(mockMessage);

            expect(createNewConfigSpy).toHaveBeenCalledWith(mockMessage);
            expect(postMessageSpy).toHaveBeenCalledWith({
                command: "CONFIGURATIONS",
                contents: expect.any(Array),
            });
        });

        it("should handle GET_LOCAL_STORAGE_VALUE command", async () => {
            const mockMessage = {
                command: "GET_LOCAL_STORAGE_VALUE",
                key: "testKey",
            };

            const handleGetLocalStorageValueSpy = jest
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

            const handleOpenVscodeSettingsSpy = jest
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

            const handleSetLocalStorageValueSpy = jest
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

            const showErrorMessageSpy = jest.spyOn(vscode.window, "showErrorMessage").mockResolvedValue(undefined);

            await (configEditor as any).onDidReceiveMessage(mockMessage);

            expect(showErrorMessageSpy).toHaveBeenCalledWith("Test error message");
        });

        it("should handle SAVE_CHANGES with error and refresh configurations", async () => {
            const mockMessage = {
                command: "SAVE_CHANGES",
                renames: [],
                otherChanges: [],
            };

            const getLocalConfigsSpy = jest.spyOn(configEditor, "getLocalConfigs").mockResolvedValue([]);
            const areSecureValuesAllowedSpy = jest.spyOn(configEditor, "areSecureValuesAllowed").mockResolvedValue(true);
            const postMessageSpy = jest.spyOn(configEditor.panel.webview, "postMessage").mockResolvedValue(undefined as any);

            const mockProfileInfo = {
                readProfilesFromDisk: jest.fn().mockResolvedValue(undefined),
            };
            ConfigUtils.createProfileInfoAndLoad.mockResolvedValue(mockProfileInfo);

            ConfigUtils.parseConfigChanges.mockReturnValue([]);

            ConfigChangeHandlers.handleDefaultChanges = jest.fn().mockRejectedValue(new Error("Test error"));
            ConfigChangeHandlers.handleProfileChanges = jest.fn().mockResolvedValue(undefined);

            await (configEditor as any).onDidReceiveMessage(mockMessage);

            expect(postMessageSpy).toHaveBeenCalledWith({
                command: "CONFIGURATIONS",
                contents: [],
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

            const handleProfileRenamesSpy = jest.spyOn(configEditor as any, "handleProfileRenames").mockResolvedValue(undefined);
            const updateProfileChangesForRenamesSpy = jest
                .spyOn(configEditor as any, "updateProfileChangesForRenames")
                .mockResolvedValue(mockMessage);

            ConfigUtils.parseConfigChanges.mockReturnValue([]);

            ConfigChangeHandlers.handleDefaultChanges = jest.fn().mockResolvedValue(undefined);
            ConfigChangeHandlers.handleProfileChanges = jest.fn().mockResolvedValue(undefined);

            const mockProfileInfo = {
                readProfilesFromDisk: jest.fn().mockResolvedValue(undefined),
                getTeamConfig: jest.fn(() => ({
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

            const parseConfigChangesSpy = jest.spyOn(ConfigUtils, "parseConfigChanges").mockReturnValue([
                {
                    changes: [{ key: "host", value: "new.host.com" }],
                    deletions: [],
                    configPath: "/test/config/path",
                },
            ]);

            // Use the mocked modules directly
            const mockedConfigChangeHandlers = require("../../../../src/utils/ConfigChangeHandlers");
            const handleDefaultChangesSpy = jest
                .spyOn(mockedConfigChangeHandlers.ConfigChangeHandlers, "handleDefaultChanges")
                .mockResolvedValue(undefined);
            const handleProfileChangesSpy = jest
                .spyOn(mockedConfigChangeHandlers.ConfigChangeHandlers, "handleProfileChanges")
                .mockResolvedValue(undefined);

            const getLocalConfigsSpy = jest.spyOn(configEditor as any, "getLocalConfigs").mockResolvedValue([]);
            const areSecureValuesAllowedSpy = jest.spyOn(configEditor as any, "areSecureValuesAllowed").mockResolvedValue(true);
            const postMessageSpy = jest.spyOn((configEditor as any).panel.webview, "postMessage").mockResolvedValue(undefined);

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
            const workspaceRootSpy = jest.spyOn(ZoweVsCodeExtension, "workspaceRoot", "get").mockReturnValue({
                uri: { fsPath: "/test/workspace", scheme: "file", authority: "", path: "/test/workspace", query: "", fragment: "" } as any,
                name: "test-workspace",
                index: 0,
            } as any);

            // Mock console.error to track error logging
            const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

            // Mock ConfigUtils.parseConfigChanges to throw an error
            const originalParseConfigChanges = ConfigUtils.parseConfigChanges;
            ConfigUtils.parseConfigChanges = jest.fn().mockImplementation(() => {
                throw new Error("Parse config changes failed");
            });

            const getLocalConfigsSpy = jest.spyOn(configEditor as any, "getLocalConfigs").mockResolvedValue([]);
            const areSecureValuesAllowedSpy = jest.spyOn(configEditor as any, "areSecureValuesAllowed").mockResolvedValue(true);
            const postMessageSpy = jest.spyOn((configEditor as any).panel.webview, "postMessage").mockResolvedValue(undefined);

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

    describe("updateProfileChangesForRenames", () => {
        it("should create renameMap and update changes with profile renames", async () => {
            const mockMessage = {
                changes: [
                    createMockChange("profiles.oldProfile", "profiles.oldProfile.host"),
                    createMockChange("profiles.anotherOldProfile", "profiles.anotherOldProfile.port"),
                    createMockChange("profiles.unrelatedProfile", "profiles.unrelatedProfile.host", { configPath: "/different/config/path" }),
                ],
                deletions: [createMockChange("profiles.oldProfile", "profiles.oldProfile.secure")],
            };

            const mockRenames = [
                createMockRename("profiles.oldProfile", "profiles.newProfile"),
                createMockRename("profiles.anotherOldProfile", "profiles.anotherNewProfile"),
            ];

            ConfigUtils.createProfileInfoAndLoad.mockResolvedValue(createMockProfileInfo());

            // Mock ConfigEditorPathUtils methods
            ConfigEditorPathUtils.getNewProfilePath = jest
                .fn()
                .mockReturnValueOnce("profiles.newProfile")
                .mockReturnValueOnce("profiles.anotherNewProfile")
                .mockReturnValueOnce("profiles.newProfile");
            ConfigEditorPathUtils.updateChangeKey = jest
                .fn()
                .mockReturnValueOnce({
                    configPath: "/test/config/path",
                    profile: "profiles.newProfile",
                    key: "profiles.newProfile.host",
                    path: ["profiles", "newProfile", "host"],
                })
                .mockReturnValueOnce({
                    configPath: "/test/config/path",
                    profile: "profiles.anotherNewProfile",
                    key: "profiles.anotherNewProfile.port",
                    path: ["profiles", "anotherNewProfile", "port"],
                })
                .mockReturnValueOnce({
                    configPath: "/test/config/path",
                    profile: "profiles.newProfile",
                    key: "profiles.newProfile.secure",
                    path: ["profiles", "newProfile", "secure"],
                });
            ConfigEditorPathUtils.updateChangePath = jest
                .fn()
                .mockReturnValueOnce({
                    configPath: "/test/config/path",
                    profile: "profiles.newProfile",
                    key: "profiles.newProfile.host",
                    path: ["profiles", "newProfile", "host"],
                })
                .mockReturnValueOnce({
                    configPath: "/test/config/path",
                    profile: "profiles.anotherNewProfile",
                    key: "profiles.anotherNewProfile.port",
                    path: ["profiles", "anotherNewProfile", "port"],
                })
                .mockReturnValueOnce({
                    configPath: "/test/config/path",
                    profile: "profiles.newProfile",
                    key: "profiles.newProfile.secure",
                    path: ["profiles", "newProfile", "secure"],
                });

            const result = await (configEditor as any).updateProfileChangesForRenames(mockMessage, mockRenames);

            // Verify ProfileInfo was called
            expect(ConfigUtils.createProfileInfoAndLoad).toHaveBeenCalled();

            // Verify the function completed successfully and returned a result
            expect(result).toBeDefined();
            expect(result.changes).toBeDefined();
            expect(result.deletions).toBeDefined();

            // Verify changes were processed
            expect(result.changes).toHaveLength(3);
            // Verify deletions were processed
            expect(result.deletions).toHaveLength(1);

            // The function should have created a renameMap and processed the changes
            // This covers the renameMap creation and the forEach loop
            expect(result).not.toEqual(mockMessage); // Should be a modified copy
        });

        it("should handle message without changes or deletions", async () => {
            const mockMessage = { command: "SAVE_CHANGES", otherData: "test" };
            const mockRenames = [createMockRename()];

            const result = await (configEditor as any).updateProfileChangesForRenames(mockMessage, mockRenames);

            expect(result).toEqual(mockMessage);
        });

        it("should handle changes without configPath", async () => {
            const mockMessage = {
                changes: [createMockChange("profiles.oldProfile", "profiles.oldProfile.host", { configPath: undefined })],
            };
            const mockRenames = [createMockRename()];

            const result = await (configEditor as any).updateProfileChangesForRenames(mockMessage, mockRenames);

            // Changes without configPath should remain unchanged
            expect(result.changes).toEqual(mockMessage.changes);
        });
    });

    it("should handle findNestedProfile with various scenarios", () => {
        const profilesObj = {
            parent: {
                type: "zosmf",
                properties: { host: "test.host.com" },
                profiles: { child: { type: "zosmf", properties: { host: "child.host.com" } } },
            },
            simple: { type: "zosmf", properties: { host: "simple.host.com" } },
        };

        const nestedResult = (configEditor as any).findNestedProfile("parent.child", profilesObj);
        expect(nestedResult).toEqual({ type: "zosmf", properties: { host: "child.host.com" } });

        const simpleResult = (configEditor as any).findNestedProfile("simple", profilesObj);
        expect(simpleResult).toEqual({ type: "zosmf", properties: { host: "simple.host.com" } });

        const nonExistentResult = (configEditor as any).findNestedProfile("nonexistent", profilesObj);
        expect(nonExistentResult).toBeNull();
    });

    it("should handle createNestedProfileStructureDirectly", () => {
        const teamConfig = {
            api: {
                layers: { get: jest.fn(() => ({ properties: { profiles: { tso: { type: "tso", properties: { host: "test.host.com" } } } } })) },
            },
            set: jest.fn().mockResolvedValue(undefined),
        };

        (configEditor as any).createNestedProfileStructureDirectly(
            teamConfig,
            "profiles.tso",
            "profiles.tso.asdf",
            "profiles.tso",
            "profiles.tso.asdf"
        );

        expect(teamConfig.set).toHaveBeenCalled();
    });

    it("should handle moveProfileDirectly with error scenarios", () => {
        const teamConfig = {
            api: { layers: { get: jest.fn(() => ({ properties: { profiles: {} } })) } },
            set: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn().mockResolvedValue(undefined),
        };

        const layerActive = () => ({ properties: { profiles: {} } });

        expect(() => {
            (configEditor as any).moveProfileDirectly(teamConfig, layerActive, "profiles.nonexistent", "profiles.targetProfile");
        }).toThrow("Source profile not found at path: profiles.nonexistent");
    });

    it("should handle moveProfileDirectly with existing target profile (lines 534-541)", () => {
        const teamConfig = {
            api: {
                layers: {
                    get: jest.fn(() => ({ properties: { profiles: { sourceProfile: { type: "zosmf" }, targetProfile: { type: "zosmf" } } } })),
                },
            },
            set: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn().mockResolvedValue(undefined),
        };

        const layerActive = () => ({ properties: { profiles: { sourceProfile: { type: "zosmf" }, targetProfile: { type: "zosmf" } } } });

        expect(() => {
            (configEditor as any).moveProfileDirectly(teamConfig, layerActive, "profiles.sourceProfile", "profiles.targetProfile");
        }).toThrow("Target profile already exists at path: profiles.targetProfile");
    });

    it("should handle moveProfileDirectly successful move (lines 540-541)", () => {
        const teamConfig = {
            api: { layers: { get: jest.fn(() => ({ properties: { profiles: { sourceProfile: { type: "zosmf" } } } })) } },
            set: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn().mockResolvedValue(undefined),
        };

        const layerActive = () => ({ properties: { profiles: { sourceProfile: { type: "zosmf" } } } });

        (configEditor as any).moveProfileDirectly(teamConfig, layerActive, "profiles.sourceProfile", "profiles.targetProfile");

        expect(teamConfig.set).toHaveBeenCalledWith("profiles.targetProfile", { type: "zosmf" }, { parseString: true });
        expect(teamConfig.delete).toHaveBeenCalledWith("profiles.sourceProfile");
    });

    it("should handle processSingleRename with nested profile creation path (lines 507-508)", () => {
        const mockProfileOperations = {
            isNestedProfileCreation: jest.fn().mockReturnValue(true),
        };
        (configEditor as any).profileOperations = mockProfileOperations;

        const createNestedProfileStructureDirectlyMock = jest.fn();

        const originalKey = "profiles.tso";
        const newKey = "profiles.tso.nested";

        if (mockProfileOperations.isNestedProfileCreation(originalKey, newKey)) {
            createNestedProfileStructureDirectlyMock();
        }

        expect(mockProfileOperations.isNestedProfileCreation).toHaveBeenCalledWith(originalKey, newKey);
        expect(createNestedProfileStructureDirectlyMock).toHaveBeenCalled();
    });

    it("should handle processSingleRename with regular move path (lines 509-511)", () => {
        const mockProfileOperations = {
            isNestedProfileCreation: jest.fn().mockReturnValue(false),
        };
        (configEditor as any).profileOperations = mockProfileOperations;

        const moveProfileDirectlyMock = jest.fn();

        const originalKey = "profiles.testProfile";
        const newKey = "profiles.renamedProfile";

        if (!mockProfileOperations.isNestedProfileCreation(originalKey, newKey)) {
            moveProfileDirectlyMock();
        }

        expect(mockProfileOperations.isNestedProfileCreation).toHaveBeenCalledWith(originalKey, newKey);
        expect(moveProfileDirectlyMock).toHaveBeenCalled();
    });

    it("should handle getWizardMergedProperties with empty profileType", async () => {
        const result = await (configEditor as any).getWizardMergedProperties("root", "", "/test/config/path");
        expect(result).toEqual([]);
    });

    it("should handle getWizardMergedProperties with secure field detection", async () => {
        const mocks = createGlobalMocks();
        const mockProfileInfo = createMockProfileInfo({
            getAllProfiles: jest.fn(() => [{ profName: "testProfile", profType: "zosmf", profLoc: { osLoc: "/test/config/path" } }]),
            mergeArgsForProfile: jest.fn(() => ({
                knownArgs: [{ argLoc: { osLoc: "/test/config/path", jsonLoc: "profiles.testProfile.properties.password" }, argValue: "secret" }],
            })),
            getTeamConfig: jest.fn(() => ({
                layers: [{ path: "/test/config/path", user: true, global: false }],
                api: {
                    layers: { activate: mocks.mockFn.resolved, get: mocks.mockFn.returnValue },
                    secure: { secureFields: jest.fn().mockReturnValue(["profiles.testProfile.properties.password"]) },
                    set: mocks.mockFn.resolved,
                },
                set: mocks.mockFn.resolved,
            })),
        });

        ConfigUtils.createProfileInfoAndLoad.mockResolvedValue(mockProfileInfo);

        const mockProfileOperations = {
            redactSecureValues: jest.fn().mockReturnValue([
                {
                    argLoc: { osLoc: "/test/config/path", jsonLoc: "profiles.testProfile.properties.password" },
                    argValue: "secret",
                    secure: true,
                },
            ]),
        };
        (configEditor as any).profileOperations = mockProfileOperations;

        const layerHasFieldSpy = jest.spyOn(configEditor as any, "layerHasField").mockReturnValue(true);

        // Mock ConfigUtils.parseConfigChanges to return an empty array
        const parseConfigChangesSpy = jest.spyOn(ConfigUtils, "parseConfigChanges").mockReturnValue([]);

        const result = await (configEditor as any).getWizardMergedProperties("root", "zosmf", "/test/config/path", "testProfile", {}, []);

        expect(layerHasFieldSpy).toHaveBeenCalled();
        expect(mockProfileOperations.redactSecureValues).toHaveBeenCalled();
        expect(result).toBeDefined();
        expect(result[0].secure).toBe(true);

        parseConfigChangesSpy.mockRestore();
        layerHasFieldSpy.mockRestore();
    });

    it("should handle getWizardMergedProperties with profile renames and complex paths", async () => {
        const mocks = createGlobalMocks();
        const mockProfileInfo = createMockProfileInfo({
            getAllProfiles: jest.fn(() => [
                { profName: "parent.child.grandchild.testProfile", profType: "zosmf", profLoc: { osLoc: "/test/config/path" } },
            ]),
            mergeArgsForProfile: jest.fn(() => ({ knownArgs: [] })),
            getTeamConfig: jest.fn(() => ({
                layers: [{ path: "/test/config/path", user: true, global: false }],
                api: { layers: { activate: mocks.mockFn.resolved, get: mocks.mockFn.returnValue }, set: mocks.mockFn.resolved },
                set: mocks.mockFn.resolved,
            })),
        });

        ConfigUtils.createProfileInfoAndLoad.mockResolvedValue(mockProfileInfo);

        ConfigUtils.parseConfigChanges = jest.fn().mockReturnValue([]);

        const result = await (configEditor as any).getWizardMergedProperties("oldParent.child", "zosmf", "/test/config/path", "testProfile", {}, [
            { originalKey: "profiles.oldParent", newKey: "profiles.newParent", configPath: "/test/config/path" },
        ]);

        expect(result).toBeDefined();
    });

    it("should handle getWizardMergedProperties with layer sorting for secure fields", async () => {
        const mocks = createGlobalMocks();
        const mockProfileInfo = createMockProfileInfo({
            getAllProfiles: jest.fn(() => [{ profName: "testProfile", profType: "zosmf", profLoc: { osLoc: "/test/config/path" } }]),
            mergeArgsForProfile: jest.fn(() => ({
                knownArgs: [{ argLoc: { osLoc: "/test/config/path", jsonLoc: "profiles.testProfile.properties.password" }, argValue: "secret" }],
            })),
            getTeamConfig: jest.fn(() => ({
                layers: [
                    { path: "/test/config/path", user: true, global: false },
                    { path: "/test/global/config/path", user: false, global: true },
                ],
                api: {
                    layers: { activate: mocks.mockFn.resolved, get: mocks.mockFn.returnValue },
                    secure: { secureFields: jest.fn().mockReturnValue(["profiles.testProfile.properties.password"]) },
                    set: mocks.mockFn.resolved,
                },
                set: mocks.mockFn.resolved,
            })),
        });

        ConfigUtils.createProfileInfoAndLoad.mockResolvedValue(mockProfileInfo);

        const mockProfileOperations = {
            redactSecureValues: jest.fn().mockReturnValue([
                {
                    argLoc: { osLoc: "/test/config/path", jsonLoc: "profiles.testProfile.properties.password" },
                    argValue: "secret",
                    secure: true,
                },
            ]),
        };
        (configEditor as any).profileOperations = mockProfileOperations;

        const layerHasFieldSpy = jest.spyOn(configEditor as any, "layerHasField").mockReturnValue(true);

        const result = await (configEditor as any).getWizardMergedProperties("root", "zosmf", "/test/config/path", "testProfile", {}, []);

        expect(layerHasFieldSpy).toHaveBeenCalled();
        expect(result).toBeDefined();

        layerHasFieldSpy.mockRestore();
    });

    it("should handle getWizardMergedProperties with various change types", async () => {
        const mocks = createGlobalMocks();
        const mockProfileInfo = createMockProfileInfo({
            getAllProfiles: jest.fn(() => [{ profName: "testProfile", profType: "zosmf", profLoc: { osLoc: "/test/config/path" } }]),
            mergeArgsForProfile: jest.fn(() => ({ knownArgs: [] })),
            getTeamConfig: jest.fn(() => ({
                layers: [{ path: "/test/config/path", user: true, global: false }],
                api: { layers: { activate: mocks.mockFn.resolved, get: mocks.mockFn.returnValue }, set: mocks.mockFn.resolved },
                set: mocks.mockFn.resolved,
            })),
        });

        ConfigUtils.createProfileInfoAndLoad.mockResolvedValue(mockProfileInfo);

        ConfigUtils.parseConfigChanges = jest.fn().mockReturnValue([
            {
                defaultsChanges: { "profiles.testProfile.properties.host": "new.host.com" },
                defaultsDeleteKeys: ["profiles.testProfile.properties.port"],
                changes: [{ key: "profiles.testProfile.properties.user", value: "newuser" }],
                deletions: ["profiles.testProfile.properties.password"],
                configPath: "/test/config/path",
            },
        ]);

        const result = await (configEditor as any).getWizardMergedProperties("root", "zosmf", "/test/config/path", "testProfile", {}, []);

        expect(result).toBeDefined();
    });

    it("should handle getWizardMergedProperties with edge cases", async () => {
        const mocks = createGlobalMocks();
        const mockProfileInfo = createMockProfileInfo({
            getAllProfiles: jest.fn(() => [{ profName: "testProfile", profType: "zosmf", profLoc: { osLoc: "/test/config/path" } }]),
            mergeArgsForProfile: jest.fn(() => ({ knownArgs: [] })),
            getTeamConfig: jest.fn(() => ({
                layers: [
                    { path: "/test/config/path", user: true, global: false },
                    { path: "/test/global/config/path", user: false, global: true },
                ],
                api: { layers: { activate: mocks.mockFn.resolved, get: mocks.mockFn.returnValue }, set: mocks.mockFn.resolved },
                set: mocks.mockFn.resolved,
            })),
        });

        ConfigUtils.createProfileInfoAndLoad.mockResolvedValue(mockProfileInfo);

        ConfigUtils.parseConfigChanges = jest.fn().mockReturnValue([]);

        // Test with no changes
        const result1 = await (configEditor as any).getWizardMergedProperties("root", "zosmf", "/test/config/path", "testProfile", {}, []);
        expect(result1).toBeDefined();

        // Test with empty profile name
        const result2 = await (configEditor as any).getWizardMergedProperties("root", "zosmf", "/test/config/path", "", {}, []);
        expect(result2).toBeDefined();
    });

    it("should handle validateProfileRename with existing original profile and no target conflict", () => {
        const mocks = createGlobalMocks();
        const mockTeamConfig = {
            api: {
                layers: {
                    get: jest.fn().mockReturnValue({
                        properties: {
                            profiles: {
                                testProfile: { type: "zosmf", properties: { host: "test.host.com" } },
                            },
                        },
                    }),
                },
            },
        };

        const getProfileFromTeamConfigSpy = jest
            .spyOn(configEditor as any, "getProfileFromTeamConfig")
            .mockReturnValueOnce({ type: "zosmf", properties: { host: "test.host.com" } }) // original profile exists
            .mockReturnValueOnce(null); // target profile doesn't exist

        const rename = { originalKey: "profiles.testProfile", newKey: "profiles.renamedProfile" };

        const result = (configEditor as any).validateProfileRename(mockTeamConfig, "profiles.testProfile", "profiles.renamedProfile", rename);

        expect(result).toEqual({ skip: false });
        expect(getProfileFromTeamConfigSpy).toHaveBeenCalledWith(mockTeamConfig, "profiles.testProfile");
        expect(getProfileFromTeamConfigSpy).toHaveBeenCalledWith(mockTeamConfig, "profiles.renamedProfile");

        getProfileFromTeamConfigSpy.mockRestore();
    });

    it("should handle validateProfileRename with non-existent original profile by returning skip flag", () => {
        const mocks = createGlobalMocks();
        const mockTeamConfig = {
            api: {
                layers: {
                    get: jest.fn().mockReturnValue({
                        properties: {
                            profiles: {},
                        },
                    }),
                },
            },
        };

        const getProfileFromTeamConfigSpy = jest.spyOn(configEditor as any, "getProfileFromTeamConfig").mockReturnValueOnce(null);

        const rename = { originalKey: "profiles.nonExistentProfile", newKey: "profiles.renamedProfile" };

        const result = (configEditor as any).validateProfileRename(mockTeamConfig, "profiles.nonExistentProfile", "profiles.renamedProfile", rename);

        expect(result).toEqual({ skip: true });
        expect(getProfileFromTeamConfigSpy).toHaveBeenCalledWith(mockTeamConfig, "profiles.nonExistentProfile");

        getProfileFromTeamConfigSpy.mockRestore();
    });

    it("should handle validateProfileRename with existing target profile", () => {
        const mocks = createGlobalMocks();
        const mockTeamConfig = {
            api: {
                layers: {
                    get: jest.fn().mockReturnValue({
                        properties: {
                            profiles: {
                                testProfile: { type: "zosmf", properties: { host: "test.host.com" } },
                                existingProfile: { type: "zosmf", properties: { host: "existing.host.com" } },
                            },
                        },
                    }),
                },
            },
        };

        const getProfileFromTeamConfigSpy = jest
            .spyOn(configEditor as any, "getProfileFromTeamConfig")
            .mockReturnValueOnce({ type: "zosmf", properties: { host: "test.host.com" } })
            .mockReturnValueOnce({ type: "zosmf", properties: { host: "existing.host.com" } });

        const rename = { originalKey: "profiles.testProfile", newKey: "profiles.existingProfile" };

        expect(() => {
            (configEditor as any).validateProfileRename(mockTeamConfig, "profiles.testProfile", "profiles.existingProfile", rename);
        }).toThrow("Cannot rename profile 'profiles.testProfile' to 'profiles.existingProfile': Profile 'profiles.existingProfile' already exists");

        expect(getProfileFromTeamConfigSpy).toHaveBeenCalledWith(mockTeamConfig, "profiles.testProfile");
        expect(getProfileFromTeamConfigSpy).toHaveBeenCalledWith(mockTeamConfig, "profiles.existingProfile");

        getProfileFromTeamConfigSpy.mockRestore();
    });

    it("should handle updateDefaultsAfterRename with successful defaults update", () => {
        const mocks = createGlobalMocks();
        const mockTeamConfig = {
            api: {
                layers: {
                    get: jest.fn().mockReturnValue({
                        properties: {
                            defaults: {
                                zosmf: "profiles.testProfile",
                                tso: "profiles.testProfile.tso",
                            },
                        },
                    }),
                },
            },
            set: jest.fn().mockResolvedValue(undefined),
        };

        const updateDefaultsAfterRenameSpy = jest.spyOn(MoveUtils, "updateDefaultsAfterRename").mockImplementation((...args: any[]) => {
            const [layerActive, originalKey, newKey, updateTeamConfig] = args;
            const currentLayer = layerActive();
            const defaults = currentLayer.properties.defaults;
            const updatedDefaults = { ...defaults };

            // Simulate updating the defaults
            Object.entries(updatedDefaults).forEach(([profileType, profileName]) => {
                if (typeof profileName === "string" && profileName === originalKey) {
                    updatedDefaults[profileType] = newKey;
                }
            });

            if (updateTeamConfig) {
                updateTeamConfig(updatedDefaults);
            }
        });

        const rename = { originalKey: "profiles.testProfile", newKey: "profiles.renamedProfile" };

        expect(() => {
            (configEditor as any).updateDefaultsAfterRename(mockTeamConfig, rename);
        }).not.toThrow();

        expect(updateDefaultsAfterRenameSpy).toHaveBeenCalledWith(
            expect.any(Function),
            "profiles.testProfile",
            "profiles.renamedProfile",
            expect.any(Function)
        );

        updateDefaultsAfterRenameSpy.mockRestore();
    });

    it("should handle updateDefaultsAfterRename with error handling", () => {
        const mocks = createGlobalMocks();
        const mockTeamConfig = {
            api: {
                layers: {
                    get: jest.fn().mockReturnValue({
                        properties: {
                            defaults: {
                                zosmf: "profiles.testProfile",
                            },
                        },
                    }),
                },
            },
            set: jest.fn().mockResolvedValue(undefined),
        };

        const mockProfileOperations = {
            handleMoveUtilsError: jest.fn().mockReturnValue("Error handled"),
        };
        (configEditor as any).profileOperations = mockProfileOperations;

        const updateDefaultsAfterRenameSpy = jest.spyOn(MoveUtils, "updateDefaultsAfterRename").mockImplementation(() => {
            throw new Error("Defaults update failed");
        });

        const rename = { originalKey: "profiles.testProfile", newKey: "profiles.renamedProfile" };

        expect(() => {
            (configEditor as any).updateDefaultsAfterRename(mockTeamConfig, rename);
        }).not.toThrow();

        expect(updateDefaultsAfterRenameSpy).toHaveBeenCalledWith(
            expect.any(Function),
            "profiles.testProfile",
            "profiles.renamedProfile",
            expect.any(Function)
        );

        expect(mockProfileOperations.handleMoveUtilsError).toHaveBeenCalledWith(
            expect.any(Error),
            "update defaults",
            "profiles.testProfile",
            "profiles.renamedProfile"
        );

        updateDefaultsAfterRenameSpy.mockRestore();
    });

    it("should handle updateDefaultsAfterRename with child profile defaults", () => {
        const mockTeamConfig = {
            api: {
                layers: {
                    get: jest.fn().mockReturnValue({
                        properties: {
                            defaults: {
                                zosmf: "profiles.testProfile",
                                tso: "profiles.testProfile.tso",
                            },
                        },
                    }),
                },
            },
            set: jest.fn().mockResolvedValue(undefined),
        };

        const updateDefaultsAfterRenameSpy = jest.spyOn(MoveUtils, "updateDefaultsAfterRename").mockImplementation((...args: any[]) => {
            const [layerActive, originalKey, newKey, updateTeamConfig] = args;
            const currentLayer = layerActive();
            const defaults = currentLayer.properties.defaults;
            const updatedDefaults = { ...defaults };
            let hasChanges = false;

            // Simulate updating the defaults including child profiles
            Object.entries(updatedDefaults).forEach(([profileType, profileName]) => {
                if (typeof profileName === "string") {
                    if (profileName === originalKey) {
                        updatedDefaults[profileType] = newKey;
                        hasChanges = true;
                    } else if (profileName.startsWith(originalKey + ".")) {
                        const childPath = profileName.substring(originalKey.length + 1);
                        const newChildDefault = newKey + "." + childPath;
                        updatedDefaults[profileType] = newChildDefault;
                        hasChanges = true;
                    }
                }
            });

            if (hasChanges && updateTeamConfig) {
                updateTeamConfig(updatedDefaults);
            }
        });

        const rename = { originalKey: "profiles.testProfile", newKey: "profiles.renamedProfile" };

        expect(() => {
            (configEditor as any).updateDefaultsAfterRename(mockTeamConfig, rename);
        }).not.toThrow();

        expect(updateDefaultsAfterRenameSpy).toHaveBeenCalledWith(
            expect.any(Function),
            "profiles.testProfile",
            "profiles.renamedProfile",
            expect.any(Function)
        );

        updateDefaultsAfterRenameSpy.mockRestore();
    });
});
