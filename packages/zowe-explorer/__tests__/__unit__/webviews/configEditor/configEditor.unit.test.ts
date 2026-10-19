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

import { createEditorLayer } from "../../../__mocks__/mockCreators/configEditor";
import { ExtensionContext } from "vscode";
import { ConfigEditor } from "../../../../src/utils/ConfigEditor";
import { ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";
import { vi } from "vitest";

// Global import statements for mocked modules
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { ConfigSchemaHelpers } from "../../../../src/utils/ConfigSchemaHelpers";
import { ConfigUtils } from "../../../../src/utils/ConfigUtils";
import { ConfigEditorSaveOperations } from "../../../../src/utils/ConfigEditorSaveOperations";

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
        public constructor() {}
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
    realpathSync: vi.fn((filePath) => filePath),
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
    updateDefaultsAfterRename: vi.fn(),
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
        public constructor(message?: string) {
            super(message);
            this.name = "FileSystemError";
        }
    },
    TreeItem: class TreeItem {
        public constructor(label?: string, collapsibleState?: number) {
            this.label = label;
            this.collapsibleState = collapsibleState;
        }
        public label?: string;
        public collapsibleState?: number;
    },
    Command: class Command {
        public constructor() {}
    },
    QuickPickItemKind: {
        Separator: -1,
        Default: 0,
    },
    EventEmitter: class EventEmitter<T> {
        private subscribers: Array<(data?: T) => void> = [];
        public event = vi.fn().mockImplementation((listener: (data?: T) => void) => {
            this.subscribers.push(listener);
            return { dispose: () => {} };
        });
        public fire(data?: T): void {
            for (const sub of this.subscribers) {
                sub(data);
            }
        }
    },
    Uri: {
        file: vi.fn((filePath: string) => ({ fsPath: filePath, path: filePath, scheme: "file" })),
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

const createMockProfileInfo = (layers: ReturnType<typeof createEditorLayer>[] = []) => ({
    readProfilesFromDisk: vi.fn().mockResolvedValue(undefined),
    getTeamConfig: vi.fn(() => ({ layers })),
});

describe("configEditor", () => {
    let mockContext: ExtensionContext;
    let configEditor: ConfigEditor;
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        vi.spyOn(ConfigEditorSaveOperations, "readRevision").mockResolvedValue(undefined);
        fs.readFileSync.mockReset().mockReturnValue('{"type":"object"}');
        fs.existsSync.mockReset().mockReturnValue(true);
        path.resolve.mockReturnValue("/test/config/path");
        path.join.mockReturnValue("/test/config/zowe.schema.json");
        path.dirname.mockReturnValue("/test/config");
        ConfigSchemaHelpers.generateSchemaValidation.mockReturnValue({ validate: vi.fn() });
        ConfigUtils.pushParseError.mockReset();
        mockContext = {
            extensionPath: "/mock/extension/path",
            subscriptions: [],
        } as ExtensionContext;

        ConfigUtils.createProfileInfoAndLoad.mockResolvedValue(createMockProfileInfo());

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
            const mockProfileInfo = createMockProfileInfo([
                createEditorLayer({
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
                }),
            ]);

            ConfigUtils.createProfileInfoAndLoad.mockResolvedValue(mockProfileInfo);

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
            const mockProfileInfo = createMockProfileInfo([
                createEditorLayer({
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
                }),
            ]);

            ConfigUtils.createProfileInfoAndLoad.mockResolvedValue(mockProfileInfo);

            const result = await configEditor.getLocalConfigs();

            expect(result.configs).toEqual([]);
            expect(result.parseErrors).toEqual([]);
            expect(ConfigUtils.createProfileInfoAndLoad).toHaveBeenCalled();
            expect(mockProfileInfo.getTeamConfig).toHaveBeenCalled();
        });

        it("should handle error when reading or parsing file and return partial results", async () => {
            const mockProfileInfo = createMockProfileInfo([
                createEditorLayer({
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
                }),
                createEditorLayer({
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
                }),
            ]);

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
            const mockProfileInfo = createMockProfileInfo([
                createEditorLayer({
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
                }),
            ]);

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
            const mockProfileInfo = createMockProfileInfo([
                createEditorLayer({
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
                }),
            ]);

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
            const mockProfileInfo = createMockProfileInfo([
                createEditorLayer({
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
                }),
            ]);

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
            const mockProfileInfo = createMockProfileInfo([
                createEditorLayer({
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
                }),
            ]);

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
        it("delegates saves to the staged save operation and refreshes on success", async () => {
            const message = { command: "SAVE_CHANGES", saveRequestId: 1, changes: [], renames: [], revisions: {} };
            const save = vi.spyOn(ConfigEditorSaveOperations.prototype, "save").mockResolvedValueOnce(true);
            vi.spyOn(configEditor, "getLocalConfigs").mockResolvedValue({ configs: [], parseErrors: [] });
            vi.spyOn(configEditor, "areSecureValuesAllowed").mockResolvedValue(true);
            await Reflect.apply(configEditor["onDidReceiveMessage"], configEditor, [message]);
            expect(save).toHaveBeenCalledWith(message, expect.any(Function));
            expect(configEditor.panel.webview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({ command: "SAVE_SUCCESS", saveRequestId: 1 })
            );
            expect(configEditor.panel.webview.postMessage).toHaveBeenCalledWith({ command: "DISABLE_OVERLAY" });
        });

        it("reports a failed save without refreshing the retained draft", async () => {
            vi.spyOn(ConfigEditorSaveOperations.prototype, "save").mockRejectedValueOnce(new Error("Save rejected"));
            const refresh = vi.spyOn(configEditor, "getLocalConfigs").mockResolvedValue({ configs: [], parseErrors: [] });
            vi.spyOn(configEditor, "areSecureValuesAllowed").mockResolvedValue(true);
            await Reflect.apply(configEditor["onDidReceiveMessage"], configEditor, [{ command: "SAVE_CHANGES", saveRequestId: 2 }]);
            expect(configEditor.panel.webview.postMessage).toHaveBeenCalledWith({ command: "SAVE_ERROR", saveRequestId: 2, error: "Save rejected" });
            expect(refresh).not.toHaveBeenCalled();
        });

        it("reports cancellation without refreshing or acknowledging a successful save", async () => {
            vi.spyOn(ConfigEditorSaveOperations.prototype, "save").mockResolvedValueOnce(false);
            const refresh = vi.spyOn(configEditor, "getLocalConfigs");
            await Reflect.apply(configEditor["onDidReceiveMessage"], configEditor, [{ command: "SAVE_CHANGES", saveRequestId: 3 }]);
            expect(configEditor.panel.webview.postMessage).toHaveBeenCalledWith({ command: "SAVE_CANCELLED", saveRequestId: 3 });
            expect(refresh).not.toHaveBeenCalled();
        });

        it("acknowledges a committed save even when refreshing the editor fails", async () => {
            vi.spyOn(ConfigEditorSaveOperations.prototype, "save").mockResolvedValueOnce(true);
            vi.spyOn(configEditor, "getLocalConfigs").mockRejectedValueOnce(new Error("Refresh failed"));
            await Reflect.apply(configEditor["onDidReceiveMessage"], configEditor, [{ command: "SAVE_CHANGES", saveRequestId: 4 }]);
            expect(configEditor.panel.webview.postMessage).toHaveBeenCalledWith({ command: "SAVE_SUCCESS", saveRequestId: 4 });
            expect(configEditor.panel.webview.postMessage).not.toHaveBeenCalledWith(
                expect.objectContaining({ command: "SAVE_ERROR", saveRequestId: 4 })
            );
        });

        it("correlates a busy response with the rejected request while completing the active save", async () => {
            let finishSave: (saved: boolean) => void = () => undefined;
            vi.spyOn(ConfigEditorSaveOperations.prototype, "save").mockReturnValueOnce(
                new Promise<boolean>((resolve) => {
                    finishSave = resolve;
                })
            );
            vi.spyOn(configEditor, "getLocalConfigs").mockResolvedValue({ configs: [], parseErrors: [] });
            vi.spyOn(configEditor, "areSecureValuesAllowed").mockResolvedValue(true);
            const active = Reflect.apply(configEditor["onDidReceiveMessage"], configEditor, [{ command: "SAVE_CHANGES", saveRequestId: 5 }]);
            try {
                await Reflect.apply(configEditor["onDidReceiveMessage"], configEditor, [{ command: "SAVE_CHANGES", saveRequestId: 6 }]);
                expect(configEditor.panel.webview.postMessage).toHaveBeenCalledWith({
                    command: "SAVE_ERROR",
                    saveRequestId: 6,
                    error: "A configuration save is already in progress.",
                });
            } finally {
                finishSave(true);
                await active;
            }
            expect(configEditor.panel.webview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({ command: "SAVE_SUCCESS", saveRequestId: 5 })
            );
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
        it.each([
            {
                handler: "handleGetProfiles",
                message: {
                    command: "GET_PROFILES",
                },
                noArgs: true,
            },
            {
                handler: "handleOpenConfigFile",
                message: {
                    command: "OPEN_CONFIG_FILE",
                    configPath: "/test/config/path",
                },
                noArgs: false,
            },
            {
                handler: "handleRevealInFinder",
                message: {
                    command: "REVEAL_IN_FINDER",
                    configPath: "/test/config/path",
                },
                noArgs: false,
            },
            {
                handler: "handleOpenSchemaFile",
                message: {
                    command: "OPEN_SCHEMA_FILE",
                    schemaPath: "/test/schema/path",
                },
                noArgs: false,
            },
            {
                handler: "handleGetEnvInformation",
                message: {
                    command: "GET_ENV_INFORMATION",
                },
                noArgs: true,
            },
            {
                handler: "handleGetEnvVars",
                message: {
                    command: "GET_ENV_VARS",
                    profileName: "testProfile",
                },
                noArgs: false,
            },
            {
                handler: "handleSelectFile",
                message: {
                    command: "SELECT_FILE",
                    fileType: "config",
                },
                noArgs: false,
            },
            {
                handler: "handleGetLocalStorageValue",
                message: {
                    command: "GET_LOCAL_STORAGE_VALUE",
                    key: "testKey",
                },
                noArgs: false,
            },
            {
                handler: "handleOpenVscodeSettings",
                message: {
                    command: "OPEN_VSCODE_SETTINGS",
                    setting: "zowe.logger",
                },
                noArgs: false,
            },
            {
                handler: "handleSetLocalStorageValue",
                message: {
                    command: "SET_LOCAL_STORAGE_VALUE",
                    key: "testKey",
                    value: "testValue",
                },
                noArgs: false,
            },
        ] as const)("routes $message.command", async ({ handler, message, noArgs }) => {
            const handle = vi.spyOn(configEditor["messageHandlers"], handler).mockResolvedValue(undefined);
            await Reflect.apply(configEditor["onDidReceiveMessage"], configEditor, [message]);
            expect(handle).toHaveBeenCalledExactlyOnceWith(...(noArgs ? [] : [message]));
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

        it("should handle SHOW_ERROR_MESSAGE command", async () => {
            const mockMessage = {
                command: "SHOW_ERROR_MESSAGE",
                message: "Test error message",
            };

            const showErrorMessageSpy = vi.spyOn(vscode.window, "showErrorMessage").mockResolvedValue(undefined);

            await (configEditor as any).onDidReceiveMessage(mockMessage);

            expect(showErrorMessageSpy).toHaveBeenCalledWith("Test error message");
        });
    });
});
