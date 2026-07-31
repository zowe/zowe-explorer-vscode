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
import { LocalStorageAccess, StorageKeys, ZoweLocalStorage } from "../../../src/tools/ZoweLocalStorage";
import { PersistenceSchemaEnum } from "@zowe/zowe-explorer-api";
import { Definitions } from "../../../src/configuration/Definitions";

describe("ZoweLocalStorage Unit Tests", () => {
    it("should initialize successfully", () => {
        const mockGlobalState = { get: vi.fn(), update: vi.fn(), keys: () => [] } as vscode.Memento;
        ZoweLocalStorage.initializeZoweLocalStorage(mockGlobalState);
        expect((ZoweLocalStorage as any).globalState).toEqual(mockGlobalState);
    });

    it("should get and set values successfully", () => {
        const localStorage = {};
        const mockGlobalState = {
            get: vi.fn().mockImplementation((key, defaultValue) => localStorage[key] ?? defaultValue),
            update: vi.fn().mockImplementation((key, value) => (localStorage[key] = value)),
            keys: () => [],
        };
        ZoweLocalStorage.initializeZoweLocalStorage(mockGlobalState);
        ZoweLocalStorage.setValue("fruit" as PersistenceSchemaEnum, "banana");
        expect(ZoweLocalStorage.getValue("fruit" as PersistenceSchemaEnum)).toEqual("banana");
    });

    it("should get workspace values with no default and fallback to global if not found", () => {
        const globalStorage = {};
        const workspaceStorage = {};
        const mockGlobalState = {
            get: vi.fn().mockImplementation((key, defaultValue) => globalStorage[key] ?? defaultValue),
            update: vi.fn().mockImplementation((key, value) => (globalStorage[key] = value)),
            keys: () => [],
        };
        const mockWorkspaceState = {
            get: vi.fn().mockImplementation((key, defaultValue) => workspaceStorage[key] ?? defaultValue),
            update: vi.fn().mockImplementation((key, value) => (workspaceStorage[key] = value)),
            keys: () => [],
        };
        ZoweLocalStorage.initializeZoweLocalStorage(mockGlobalState, mockWorkspaceState);
        // add value into local storage
        ZoweLocalStorage.setValue("fruit" as PersistenceSchemaEnum, "banana");

        // assert that it can still be retrieved from global storage
        expect(ZoweLocalStorage.getValue("fruit" as PersistenceSchemaEnum)).toEqual("banana");

        // workspace state access should have default value of undefined
        // covers `ZoweLocalStorage.workspaceState?.get<T>(key, undefined) ?? ZoweLocalStorage.globalState.get<T>(key, defaultValue);`
        expect(mockWorkspaceState.get).toHaveBeenCalledWith("fruit" as PersistenceSchemaEnum, undefined);
        // expect global state to be accessed since key in workspace state was undefined
        expect(mockGlobalState.get).toHaveBeenCalledWith("fruit" as PersistenceSchemaEnum, undefined);
    });

    it("should set workspace values successfully when setInWorkspace is true", () => {
        const globalState = { get: vi.fn(), update: vi.fn(), keys: () => [] } as vscode.Memento;
        const workspaceState = { get: vi.fn(), update: vi.fn(), keys: () => [] } as vscode.Memento;
        ZoweLocalStorage.initializeZoweLocalStorage(globalState, workspaceState);
        ZoweLocalStorage.setValue("fruit" as PersistenceSchemaEnum, "banana", true);
        expect(workspaceState.update).toHaveBeenCalled();
        expect(globalState.update).not.toHaveBeenCalled();
    });
});

describe("LocalStorageAccess", () => {
    // Read: 1, Write: 2, Read | Write: 3
    function omitKeysWithPermission(permBits: number): StorageKeys[] {
        return Object.values({ ...Definitions.LocalStorageKey, ...PersistenceSchemaEnum }).filter(
            (k) => !(((LocalStorageAccess as any).accessControl[k] & permBits) > 0)
        );
    }
    function keysWithPerm(permBits: number): StorageKeys[] {
        return Object.values({ ...Definitions.LocalStorageKey, ...PersistenceSchemaEnum }).filter(
            (k) => (LocalStorageAccess as any).accessControl[k] === permBits
        );
    }

    describe("getReadableKeys", () => {
        it("returns a list of readable keys to the user", () => {
            expect(LocalStorageAccess.getReadableKeys()).toStrictEqual([...keysWithPerm(1), ...keysWithPerm(3)]);
        });
    });

    describe("getWritableKeys", () => {
        it("returns a list of writable keys to the user", () => {
            expect(LocalStorageAccess.getWritableKeys()).toStrictEqual([...keysWithPerm(2), ...keysWithPerm(3)]);
        });
    });

    describe("getValue", () => {
        it("calls ZoweLocalStorage.getValue for all readable keys", () => {
            const getValueMock = vi.spyOn(ZoweLocalStorage, "getValue").mockReturnValue(123);
            for (const key of keysWithPerm(1)) {
                expect(LocalStorageAccess.getValue(key)).toBe(123);
                expect(getValueMock).toHaveBeenCalledWith(key);
            }
        });

        it("throws error for all keys that are not readable", () => {
            for (const key of omitKeysWithPermission(1)) {
                expect(() => LocalStorageAccess.getValue(key)).toThrow(`Insufficient read permissions for ${key as string} in local storage.`);
            }
        });
    });

    describe("setValue", () => {
        it("calls ZoweLocalStorage.setValue for all writable keys", async () => {
            const setValueMock = vi.spyOn(ZoweLocalStorage, "setValue").mockImplementation((() => undefined) as any);
            const expectWritableSpy = vi.spyOn(LocalStorageAccess as any, "expectWritable");
            for (const key of keysWithPerm(2)) {
                await LocalStorageAccess.setValue(key, 123);
                expect(setValueMock).toHaveBeenCalledWith(key, 123);
                expect(expectWritableSpy).not.toThrow();
            }
        });

        it("throws error for all keys that are not writable", () => {
            for (const key of omitKeysWithPermission(2)) {
                expect(() => LocalStorageAccess.setValue(key, undefined)).toThrow(
                    `Insufficient write permissions for ${key as string} in local storage.`
                );
            }
        });
    });

    describe("CONFIG_EDITOR_TUTORIAL_SEEN key", () => {
        beforeEach(() => {
            const mockGlobalState = {
                get: vi.fn().mockReturnValue(undefined),
                update: vi.fn().mockResolvedValue(undefined),
                keys: () => [],
            } as vscode.Memento;
            ZoweLocalStorage.initializeZoweLocalStorage(mockGlobalState);
        });

        it("CONFIG_EDITOR_TUTORIAL_SEEN is defined in LocalStorageKey enum", () => {
            expect(Definitions.LocalStorageKey.CONFIG_EDITOR_TUTORIAL_SEEN).toBe("zowe.configEditor.tutorialSeen");
        });

        it("CONFIG_EDITOR_TUTORIAL_SEEN is included in readable keys", () => {
            expect(LocalStorageAccess.getReadableKeys()).toContain(Definitions.LocalStorageKey.CONFIG_EDITOR_TUTORIAL_SEEN);
        });

        it("CONFIG_EDITOR_TUTORIAL_SEEN is included in writable keys", () => {
            expect(LocalStorageAccess.getWritableKeys()).toContain(Definitions.LocalStorageKey.CONFIG_EDITOR_TUTORIAL_SEEN);
        });

        it("LocalStorageAccess.getValue succeeds for CONFIG_EDITOR_TUTORIAL_SEEN", () => {
            const getValueSpy = vi.spyOn(ZoweLocalStorage, "getValue").mockReturnValue({ "/path/zowe.config.json": true } as any);
            const result = LocalStorageAccess.getValue(Definitions.LocalStorageKey.CONFIG_EDITOR_TUTORIAL_SEEN);
            expect(getValueSpy).toHaveBeenCalledWith(Definitions.LocalStorageKey.CONFIG_EDITOR_TUTORIAL_SEEN);
            expect(result).toEqual({ "/path/zowe.config.json": true });
        });

        it("LocalStorageAccess.setValue succeeds for CONFIG_EDITOR_TUTORIAL_SEEN", async () => {
            const setValueSpy = vi.spyOn(ZoweLocalStorage, "setValue").mockResolvedValue(undefined);
            await LocalStorageAccess.setValue(Definitions.LocalStorageKey.CONFIG_EDITOR_TUTORIAL_SEEN, { "/path/zowe.config.json": true });
            expect(setValueSpy).toHaveBeenCalledWith(Definitions.LocalStorageKey.CONFIG_EDITOR_TUTORIAL_SEEN, {
                "/path/zowe.config.json": true,
            });
        });
    });

    describe("CONFIG_EDITOR_SETTINGS key", () => {
        beforeEach(() => {
            const mockGlobalState = {
                get: vi.fn().mockReturnValue(undefined),
                update: vi.fn().mockResolvedValue(undefined),
                keys: () => [],
            } as vscode.Memento;
            ZoweLocalStorage.initializeZoweLocalStorage(mockGlobalState);
        });

        it("CONFIG_EDITOR_SETTINGS is defined in LocalStorageKey enum", () => {
            expect(Definitions.LocalStorageKey.CONFIG_EDITOR_SETTINGS).toBe("zowe.configEditor.settings");
        });

        it("CONFIG_EDITOR_SETTINGS is included in readable keys", () => {
            expect(LocalStorageAccess.getReadableKeys()).toContain(Definitions.LocalStorageKey.CONFIG_EDITOR_SETTINGS);
        });

        it("CONFIG_EDITOR_SETTINGS is included in writable keys", () => {
            expect(LocalStorageAccess.getWritableKeys()).toContain(Definitions.LocalStorageKey.CONFIG_EDITOR_SETTINGS);
        });

        it("LocalStorageAccess.getValue succeeds for CONFIG_EDITOR_SETTINGS", () => {
            const mockSettings = { viewMode: "tree", profilesWidthPercent: 30 };
            const getValueSpy = vi.spyOn(ZoweLocalStorage, "getValue").mockReturnValue(mockSettings as any);
            const result = LocalStorageAccess.getValue(Definitions.LocalStorageKey.CONFIG_EDITOR_SETTINGS);
            expect(getValueSpy).toHaveBeenCalledWith(Definitions.LocalStorageKey.CONFIG_EDITOR_SETTINGS);
            expect(result).toEqual(mockSettings);
        });

        it("LocalStorageAccess.setValue succeeds for CONFIG_EDITOR_SETTINGS", async () => {
            const mockSettings = { viewMode: "flat", profilesWidthPercent: 40 };
            const setValueSpy = vi.spyOn(ZoweLocalStorage, "setValue").mockResolvedValue(undefined);
            await LocalStorageAccess.setValue(Definitions.LocalStorageKey.CONFIG_EDITOR_SETTINGS, mockSettings);
            expect(setValueSpy).toHaveBeenCalledWith(Definitions.LocalStorageKey.CONFIG_EDITOR_SETTINGS, mockSettings);
        });
    });
});

describe("ZoweLocalStorage.isPersistenceKeyInWorkspace", () => {
    it("returns false when workspaceState is undefined", () => {
        ZoweLocalStorage.initializeZoweLocalStorage({
            get: vi.fn(),
            update: vi.fn(),
            keys: () => [],
        } as vscode.Memento);
        // workspaceState is not set → always false
        expect(ZoweLocalStorage.isPersistenceKeyInWorkspace(PersistenceSchemaEnum.Dataset)).toBe(false);
    });

    it("returns true when the key exists in workspaceState.keys()", () => {
        const mockGlobalState = { get: vi.fn(), update: vi.fn(), keys: () => [] } as vscode.Memento;
        const mockWorkspaceState = {
            get: vi.fn(),
            update: vi.fn(),
            keys: () => [PersistenceSchemaEnum.Dataset],
        } as vscode.Memento;
        ZoweLocalStorage.initializeZoweLocalStorage(mockGlobalState, mockWorkspaceState);
        expect(ZoweLocalStorage.isPersistenceKeyInWorkspace(PersistenceSchemaEnum.Dataset)).toBe(true);
    });

    it("returns false when the key is NOT in workspaceState.keys()", () => {
        const mockGlobalState = { get: vi.fn(), update: vi.fn(), keys: () => [] } as vscode.Memento;
        const mockWorkspaceState = {
            get: vi.fn(),
            update: vi.fn(),
            keys: () => [PersistenceSchemaEnum.USS],
        } as vscode.Memento;
        ZoweLocalStorage.initializeZoweLocalStorage(mockGlobalState, mockWorkspaceState);
        expect(ZoweLocalStorage.isPersistenceKeyInWorkspace(PersistenceSchemaEnum.Dataset)).toBe(false);
    });
});
