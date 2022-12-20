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

const ERROR_EXAMPLE = new Error("random fs error");
import * as fs from "fs";
jest.mock("fs");
jest.mock("fs", () => ({
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    readdirSync: jest.fn(),
}));
import * as globals from "../../../src/globals";
import * as ProfileUtils from "../../../src/utils/ProfilesUtils";
import * as vscode from "vscode";
import * as TempFolder from "../../../src/utils/TempFolder";
import { PersistentFilters } from "../../../src/PersistentFilters";
import { Gui } from "@zowe/zowe-explorer-api";

describe("TempFolder Unit Tests", () => {
    function createBlockMocks() {
        Object.defineProperty(vscode.workspace, "getConfiguration", {
            value: jest.fn(),
            configurable: true,
        });
        Object.defineProperty(PersistentFilters, "getDirectValue", {
            value: jest.fn(),
            configurable: true,
        });
        Object.defineProperty(Gui, "showMessage", { value: jest.fn() });
        Object.defineProperty(globals, "LOG", { value: jest.fn(), configurable: true });
        Object.defineProperty(globals.LOG, "error", { value: jest.fn(), configurable: true });
        jest.spyOn(ProfileUtils, "errorHandling").mockImplementationOnce(jest.fn());
    }
    it("moveTempFolder should throw errors when a filesystem exception occurs", async () => {
        jest.spyOn(fs, "mkdirSync").mockImplementationOnce((val) => {
            throw ERROR_EXAMPLE;
        });
        createBlockMocks();
        try {
            await TempFolder.moveTempFolder("testpath1", "testpath2");
        } catch (err) {
            expect(ProfileUtils.errorHandling).toHaveBeenCalledWith(
                err,
                null,
                "Error encountered when creating temporary folder! " + err.message
            );
            expect(globals.LOG.error).toHaveBeenCalledWith("Error encountered when creating temporary folder! {}");
        }
    });

    it("cleanDir should throw an error when a filesystem exception occurs", async () => {
        createBlockMocks();
        jest.spyOn(fs, "readdirSync").mockImplementation((val) => {
            throw new Error("example cleanDir error");
        });
        jest.spyOn(PersistentFilters, "getDirectValue").mockImplementationOnce((val) => true);

        try {
            await TempFolder.cleanTempDir();
        } catch (err) {
            expect(globals.LOG.error).toHaveBeenCalledWith(err);
            expect(Gui.showMessage).toHaveBeenCalledWith("Unable to delete temporary folder. example cleanDir error");
        }
    });
});
