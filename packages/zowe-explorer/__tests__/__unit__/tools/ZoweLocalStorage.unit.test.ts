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
        const mockGlobalState = { get: jest.fn(), update: jest.fn(), keys: () => [] } as vscode.Memento;
        ZoweLocalStorage.initializeZoweLocalStorage(mockGlobalState);
        expect((ZoweLocalStorage as any).globalState).toEqual(mockGlobalState);
    });

    it("should get and set values successfully", () => {
        const localStorage = {};
        const mockGlobalState = {
            get: jest.fn().mockImplementation((key, defaultValue) => localStorage[key] ?? defaultValue),
            update: jest.fn().mockImplementation((key, value) => (localStorage[key] = value)),
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
            get: jest.fn().mockImplementation((key, defaultValue) => globalStorage[key] ?? defaultValue),
            update: jest.fn().mockImplementation((key, value) => (globalStorage[key] = value)),
            keys: () => [],
        };
        const mockWorkspaceState = {
            get: jest.fn().mockImplementation((key, defaultValue) => workspaceStorage[key] ?? defaultValue),
            update: jest.fn().mockImplementation((key, value) => (workspaceStorage[key] = value)),
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
        const globalState = { get: jest.fn(), update: jest.fn(), keys: () => [] } as vscode.Memento;
        const workspaceState = { get: jest.fn(), update: jest.fn(), keys: () => [] } as vscode.Memento;
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
            const getValueMock = jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValue(123);
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
            const setValueMock = jest.spyOn(ZoweLocalStorage, "setValue").mockImplementation();
            const expectWritableSpy = jest.spyOn(LocalStorageAccess as any, "expectWritable");
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
});
