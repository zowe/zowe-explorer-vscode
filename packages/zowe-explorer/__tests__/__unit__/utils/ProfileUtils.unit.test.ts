/*
 * This program and the accompanying materials are made available under the terms of the *
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at *
 * https://www.eclipse.org/legal/epl-v20.html                                      *
 *                                                                                 *
 * SPDX-License-Identifier: EPL-2.0                                                *
 *                                                                                 *
 * Copyright Contributors to the Zowe Project.                                     *
 *                                                                                 *
 */

import * as fs from "fs";
import * as path from "path";
import { errorHandling, writeOverridesFile } from "../../../src/utils/ProfilesUtils";
import { Gui } from "@zowe/zowe-explorer-api";
import * as globals from "../../../src/globals";

jest.mock("fs");

afterEach(() => {
    jest.clearAllMocks();
});

describe("ProfileUtils.writeOverridesFile Unit Tests", () => {
    function createBlockMocks() {
        const newMocks = {
            mockReadFileSync: jest.fn(),
            mockWriteFileSync: jest.fn(),
            mockFileRead: { overrides: { CredentialManager: "@zowe/cli" } },
            zoweDir: path.normalize("__tests__/.zowe/settings/imperative.json"),
            encoding: "utf8",
        };
        Object.defineProperty(fs, "writeFileSync", { value: newMocks.mockWriteFileSync, configurable: true });
        Object.defineProperty(fs, "existsSync", {
            value: () => {
                return true;
            },
            configurable: true,
        });
        Object.defineProperty(Gui, "errorMessage", { value: jest.fn(), configurable: true });
        Object.defineProperty(globals, "LOG", { value: jest.fn(), configurable: true });
        Object.defineProperty(globals.LOG, "error", { value: jest.fn(), configurable: true });

        return newMocks;
    }
    it("should have file exist", async () => {
        const blockMocks = createBlockMocks();
        const fileJson = { overrides: { CredentialManager: "@zowe/cli", testValue: true } };
        const content = JSON.stringify(fileJson, null, 2);
        jest.spyOn(fs, "readFileSync").mockReturnValueOnce(
            JSON.stringify({ overrides: { CredentialManager: false, testValue: true } }, null, 2)
        );
        const spy = jest.spyOn(fs, "writeFileSync");
        writeOverridesFile();
        expect(spy).toBeCalledWith(blockMocks.zoweDir, content, blockMocks.encoding);
        spy.mockClear();
    });
    it("should have no change to global variable PROFILE_SECURITY and returns", async () => {
        const fileJson = { overrides: { CredentialManager: "@zowe/cli", testValue: true } };
        jest.spyOn(fs, "readFileSync").mockReturnValueOnce(JSON.stringify(fileJson, null, 2));
        const spy = jest.spyOn(fs, "writeFileSync");
        writeOverridesFile();
        expect(spy).toBeCalledTimes(0);
        spy.mockClear();
    });
    it("should have not exist and create default file", async () => {
        const blockMocks = createBlockMocks();
        Object.defineProperty(fs, "existsSync", {
            value: () => {
                return false;
            },
            configurable: true,
        });
        const content = JSON.stringify(blockMocks.mockFileRead, null, 2);
        const spyRead = jest.spyOn(fs, "readFileSync");
        const spy = jest.spyOn(fs, "writeFileSync");
        writeOverridesFile();
        expect(spy).toBeCalledWith(blockMocks.zoweDir, content, blockMocks.encoding);
        expect(spyRead).toBeCalledTimes(0);
        spy.mockClear();
        spyRead.mockClear();
    });
    it("should log error details", async () => {
        createBlockMocks();
        const errorDetails = new Error("i haz error");
        const label = "test";
        const moreInfo = "Task failed successfully";
        await errorHandling(errorDetails, label, moreInfo);
        expect(Gui.errorMessage).toBeCalledWith(`${moreInfo} ` + errorDetails);
        expect(globals.LOG.error).toBeCalledWith(
            `Error: ${errorDetails.message}\n` + JSON.stringify({ errorDetails, label, moreInfo })
        );
    });
});
