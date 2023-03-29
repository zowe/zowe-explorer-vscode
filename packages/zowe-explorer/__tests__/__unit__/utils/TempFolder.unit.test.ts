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
import { ZoweLogger } from "../../../src/utils/LoggerUtils";

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
    afterEach(() => {
        jest.resetAllMocks();
        jest.clearAllMocks();
    });

    function createBlockMocks() {
        const newMocks = {
            winPath: "testpath12\\temp",
            winPath2: "testpath123\\temp",
            unixPath: "testpath12/temp",
            unixPath2: "testpath123/temp",
        };
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
        Object.defineProperty(ZoweLogger, "error", { value: jest.fn(), configurable: true });
        Object.defineProperty(ZoweLogger, "trace", { value: jest.fn(), configurable: true });
        Object.defineProperty(ZoweLogger, "info", { value: jest.fn(), configurable: true });
        jest.spyOn(ProfileUtils, "errorHandling").mockImplementationOnce(jest.fn());
        return newMocks;
    }

    it("moveTempFolder should run moveSync", async () => {
        const blockMocks = createBlockMocks();
        jest.spyOn(fs, "mkdirSync").mockImplementation();
        jest.spyOn(fs, "existsSync").mockReturnValue(true);
        const moveSyncSpy = jest.spyOn(fsExtra, "moveSync");
        await expect(TempFolder.moveTempFolder("testpath12", "testpath123")).resolves.toEqual(undefined);
        expect(moveSyncSpy).toBeCalledTimes(1);
        const expectedPath1 = process.platform === "win32" ? blockMocks.winPath : blockMocks.unixPath.split(path.sep).join(path.posix.sep);
        const expectedPath2 = process.platform === "win32" ? blockMocks.winPath2 : blockMocks.unixPath2.split(path.sep).join(path.posix.sep);
        expect(moveSyncSpy).toBeCalledWith(expectedPath1, expectedPath2, { overwrite: true });
    });

    it("moveTempFolder should catch the error upon running moveSync", async () => {
        createBlockMocks();
        jest.spyOn(fs, "mkdirSync").mockImplementation();
        jest.spyOn(fs, "existsSync").mockReturnValue(true);
        jest.spyOn(fsExtra, "moveSync").mockImplementation(() => {
            throw ERROR_EXAMPLE;
        });
        const errorMessageSpy = jest.spyOn(Gui, "errorMessage").mockImplementation();
        const globalsLogErrorSpy = jest.fn();
        Object.defineProperty(ZoweLogger, "error", { value: globalsLogErrorSpy, configurable: true });
        await expect(TempFolder.moveTempFolder("testpath32", "testpath123")).resolves.toEqual(undefined);
        expect(errorMessageSpy).toBeCalledTimes(1);
        expect(globalsLogErrorSpy).toBeCalledTimes(1);
    });

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

    it("cleanDir should run readDirSync once", async () => {
        jest.spyOn(fs, "existsSync").mockReturnValue(true);
        const readdirSyncSpy = jest.spyOn(fs, "readdirSync").mockReturnValue(["./test1", "./test2"] as any);
        jest.spyOn(fs, "lstatSync").mockReturnValue({
            isFile: () => true,
        } as any);

        TempFolder.cleanDir("./sampleDir");
        expect(readdirSyncSpy).toBeCalledTimes(1);
    });

    it("hideTempFolder should hide local directory from workspace", async () => {
        jest.spyOn(SettingsConfig, "getDirectValue").mockReturnValue(true);
        const setDirectValueSpy = jest.spyOn(SettingsConfig, "setDirectValue").mockImplementation();
        await expect(TempFolder.hideTempFolder("test")).resolves.not.toThrow();
        expect(setDirectValueSpy).toBeCalledTimes(1);
    });
});
