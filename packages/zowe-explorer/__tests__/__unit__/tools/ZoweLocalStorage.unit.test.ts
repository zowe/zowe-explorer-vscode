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
import { LocalStorageAccess, ZoweLocalStorage } from "../../../src/tools/ZoweLocalStorage";
import { PersistenceSchemaEnum } from "@zowe/zowe-explorer-api";
import { Definitions } from "../../../src/configuration/Definitions";

describe("ZoweLocalStorage Unit Tests", () => {
    it("should initialize successfully", () => {
        const mockGlobalState = { get: jest.fn(), update: jest.fn(), keys: () => [] } as vscode.Memento;
        ZoweLocalStorage.initializeZoweLocalStorage(mockGlobalState);
        expect((ZoweLocalStorage as any).storage).toEqual(mockGlobalState);
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
});

describe("LocalStorageAccess", () => {
    // Read: 1, Write: 2, Read | Write: 3
    function omitKeysWithPermission(permBits: number): Definitions.LocalStorageKey[] {
        return Object.values(Definitions.LocalStorageKey).filter(
            (k: Definitions.LocalStorageKey) => !(((LocalStorageAccess as any).accessControl[k] & permBits) > 0)
        );
    }
    function keysWithPerm(permBits: number): Definitions.LocalStorageKey[] {
        return Object.values(Definitions.LocalStorageKey).filter((k) => (LocalStorageAccess as any).accessControl[k] === permBits);
    }

    describe("getValue", () => {
        it("calls ZoweLocalStorage.getValue for all readable keys", () => {
            const getValueMock = jest.spyOn(ZoweLocalStorage, "getValue").mockReturnValue(123);
            for (const key of keysWithPerm(1)) {
                expect(LocalStorageAccess.instance.getValue(key)).toBe(123);
                expect(getValueMock).toHaveBeenCalledWith(key);
            }
        });

        it("throws error for all keys that are not readable", () => {
            for (const key of omitKeysWithPermission(1)) {
                expect(() => LocalStorageAccess.instance.getValue(key)).toThrow(
                    `Insufficient read permissions for ${key as string} in local storage.`
                );
            }
        });
    });

    describe("setValue", () => {
        it("calls ZoweLocalStorage.setValue for all writable keys", () => {
            const setValueMock = jest.spyOn(ZoweLocalStorage, "setValue").mockImplementation();
            for (const key of keysWithPerm(2)) {
                LocalStorageAccess.instance.setValue(key, 123);
                expect(setValueMock).toHaveBeenCalledWith(key, 123);
            }
        });

        it("throws error for all keys that are not writable", () => {
            for (const key of omitKeysWithPermission(2)) {
                expect(() => LocalStorageAccess.instance.setValue(key, undefined)).toThrow(
                    `Insufficient write permissions for ${key as string} in local storage.`
                );
            }
        });
    });
});
