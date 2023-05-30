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
import { ZoweLocalStorage } from "../../../src/utils/ZoweLocalStorage";

describe("ZoweLocalStorage Unit Tests", () => {
    it("should initialize successfully", () => {
        const mockGlobalState = { get: jest.fn(), update: jest.fn(), keys: () => [] } as vscode.Memento;
        ZoweLocalStorage.initializeZoweLocalStorage(mockGlobalState);
        expect((ZoweLocalStorage as any).storage).toEqual(mockGlobalState);
    });
});
