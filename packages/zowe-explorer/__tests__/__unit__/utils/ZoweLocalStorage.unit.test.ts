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
import { LocalStorageKey, ZoweLocalStorage } from "../../../src/utils/ZoweLocalStorage";

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
        ZoweLocalStorage.setValue("fruit" as LocalStorageKey, "banana");
        expect(ZoweLocalStorage.getValue("fruit" as LocalStorageKey)).toEqual("banana");
    });
});
