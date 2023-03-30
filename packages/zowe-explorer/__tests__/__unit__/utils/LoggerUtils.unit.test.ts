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

import * as path from "path";
import * as LoggerUtils from "../../../src/utils/LoggerUtils";
import * as vscode from "vscode";
import * as globals from "../../../src/globals";
import { imperative } from "@zowe/cli";
import { Gui } from "@zowe/zowe-explorer-api";

describe("Logger Utils Unit Tests - function initializeZoweLogger", () => {
    it("should reinitialize logger with new path", async () => {
        const oldLogsPath = path.join("..", "logs1");
        const newLogsPath = path.join("..", "logs2");
        const initLoggerSpy = jest.spyOn(imperative.Logger, "initLogger").mockImplementation();

        Object.defineProperty(globals, "LOG", {
            value: {
                debug: jest.fn(),
            },
            configurable: true,
        });

        await LoggerUtils.initializeZoweLogger({
            subscriptions: [],
            extensionPath: oldLogsPath,
        } as unknown as vscode.ExtensionContext);
        await LoggerUtils.initializeZoweLogger({
            subscriptions: [],
            extensionPath: newLogsPath,
        } as unknown as vscode.ExtensionContext);

        expect(initLoggerSpy).toHaveBeenCalledTimes(2);
        const loggerConfig: Record<string, any> = initLoggerSpy.mock.calls[0][0];
        expect(loggerConfig.log4jsConfig.appenders.default.filename.indexOf(oldLogsPath)).toBe(0);
        const loggerConfig2: Record<string, any> = initLoggerSpy.mock.calls[1][0];
        expect(loggerConfig2.log4jsConfig.appenders.default.filename.indexOf(oldLogsPath)).toBe(-1);
        expect(loggerConfig2.log4jsConfig.appenders.default.filename.indexOf(newLogsPath)).toBe(0);
    });

    it("should throw an error if logger was not able to initialize", async () => {
        jest.spyOn(globals, "initLogger").mockImplementation(() => {
            throw new Error("failed to initialize logger");
        });

        Object.defineProperty(globals, "LOG", {
            value: jest.fn(), // Mock logger to fail if called
            configurable: true,
        });

        const errorMessageSpy = jest.spyOn(Gui, "errorMessage").mockImplementation();

        await expect(
            LoggerUtils.initializeZoweLogger({
                subscriptions: [],
                extensionPath: "./test",
            } as unknown as vscode.ExtensionContext)
        ).resolves.toEqual(undefined);
        expect(errorMessageSpy).toBeCalledTimes(1);
        expect(globals.LOG).not.toHaveBeenCalled();
    });
});
