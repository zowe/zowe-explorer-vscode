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
import * as fsExtra from "fs-extra";
import * as path from "path";
import * as globals from "../../../src/globals";
import * as ProfileUtils from "../../../src/utils/ProfilesUtils";
import * as vscode from "vscode";
import * as TempFolder from "../../../src/utils/TempFolder";
import { SettingsConfig } from "../../../src/utils/SettingsConfig";
import { Gui } from "@zowe/zowe-explorer-api";

jest.mock("fs");
jest.mock("fs", () => ({
    existsSync: jest.fn(() => true),
    mkdirSync: jest.fn(),
    readdirSync: jest.fn(),
    lstatSync: jest.fn(),
    unlinkSync: jest.fn(),
    rmdirSync: jest.fn(),
}));
jest.mock("fs-extra");
jest.mock("fs-extra", () => ({
    moveSync: jest.fn(),
}));

describe("TempFolder Unit Tests", () => {
    function createBlockMocks() {
        Object.defineProperty(vscode.workspace, "getConfiguration", {
            value: jest.fn(),
            configurable: true,
        });
        Object.defineProperty(SettingsConfig, "getDirectValue", {
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
            expect(ProfileUtils.errorHandling).toHaveBeenCalledWith(err, null, "Error encountered when creating temporary folder! " + err.message);
            expect(globals.LOG.error).toHaveBeenCalledWith("Error encountered when creating temporary folder! {}");
        }
    });

    it("moveTempFolder should return if source and destination path are the same", async () => {
        jest.spyOn(fs, "mkdirSync").mockImplementation();
        jest.spyOn(path, "join").mockImplementation(() => "testpath123");
        await expect(TempFolder.moveTempFolder("", "testpath123")).resolves.toEqual(undefined);
    });

    it("moveTempFolder should run moveSync", async () => {
        const moveSyncSpy = jest.spyOn(fsExtra, "moveSync");
        await expect(TempFolder.moveTempFolder("testpath", "testpath123")).resolves.toEqual(undefined);
        expect(moveSyncSpy).toBeCalledTimes(1);
        expect(moveSyncSpy).toBeCalledWith("testpath1/temp", "testpath2/temp", { overwrite: true });
    });

    it("cleanDir should throw an error when a filesystem exception occurs", async () => {
        createBlockMocks();
        jest.spyOn(fs, "mkdirSync").mockImplementation((val) => {
            throw new Error("example cleanDir error");
        });
        jest.spyOn(SettingsConfig, "getDirectValue").mockImplementationOnce((val) => true);

        try {
            await TempFolder.cleanTempDir();
        } catch (err) {
            expect(globals.LOG.error).toHaveBeenCalledWith(err);
            expect(Gui.showMessage).toHaveBeenCalledWith("Unable to delete temporary folder. example cleanDir error");
        }
    });

    it("cleanDir should run readDirSync twice", async () => {
        const readdirSyncSpy = jest.spyOn(fs, "readdirSync").mockReturnValue(["./test1"] as any);
        jest.spyOn(fs, "lstatSync").mockReturnValue({
            isFile: () => true,
        } as any);

        await expect(TempFolder.cleanDir("./sampleDir")).resolves.toEqual(undefined);
        expect(readdirSyncSpy).toBeCalledTimes(2);
    });
});
