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
import * as logger from "../../../src/utils/LoggerUtils";
import * as vscode from "vscode";
import * as zowe from "@zowe/cli";
import * as globals from "../../../src/globals";
import { Gui } from "@zowe/zowe-explorer-api";
import * as shared from "../../../__mocks__/mockCreators/shared";
import { SettingsConfig } from "../../../src/utils/SettingsConfig";

function createGlobalMocks() {
    const newMocks = {
        mockMessage: "fake message",
        outputChannel: shared.createOutputChannel(),
        mockGetConfiguration: jest.fn(),
        mockLogger: jest.fn(),
        testContext: {} as unknown as vscode.ExtensionContext,
    };
    newMocks.testContext = {
        subscriptions: [],
        extensionPath: "./test",
        extension: {
            packageJSON: {
                packageInfo: "Zowe Explorer",
                displayName: "Zowe Explorer",
                version: "2.x.x",
            },
        },
    } as unknown as vscode.ExtensionContext;
    Object.defineProperty(Gui, "createOutputChannel", {
        value: jest.fn().mockReturnValue(newMocks.outputChannel),
        configurable: true,
    });
    Object.defineProperty(Gui, "infoMessage", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals, "LOG", { value: newMocks.mockLogger, configurable: true });
    Object.defineProperty(globals.LOG, "trace", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals.LOG, "debug", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals.LOG, "info", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals.LOG, "warn", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals.LOG, "error", { value: jest.fn(), configurable: true });
    Object.defineProperty(globals.LOG, "fatal", { value: jest.fn(), configurable: true });
    Object.defineProperty(vscode.workspace, "getConfiguration", {
        value: newMocks.mockGetConfiguration,
        configurable: true,
    });
    Object.defineProperty(logger, "getDate", { value: "2023/1/1", configurable: true });
    Object.defineProperty(logger, "getTime", { value: "08:00:00", configurable: true });
    Object.defineProperty(zowe, "padLeft", { value: jest.fn(), configurable: true });
    Object.defineProperty(SettingsConfig, "setDirectValue", { value: jest.fn(), configurable: true });

    return newMocks;
}

describe("Logger Utils Unit Tests - function initializeZoweLogger", () => {
    const env = process.env;
    const getSettingMock = jest.fn((section: string) => {
        switch (section) {
            case "cliLoggerSetting.presented":
                return false;
            case "files.logsFolder.path":
                return "";
            case "logger":
                return "INFO";
            default:
                throw new Error("Unknown Configuration Setting");
        }
    });

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...env };
    });

    afterEach(() => {
        process.env = env;
    });
    it("should initialize loggers successfully with no cli logger setting", async () => {
        const globalMocks = createGlobalMocks();
        jest.spyOn(globals, "initLogger").mockReturnValueOnce();
        globalMocks.mockGetConfiguration.mockReturnValue({
            get: getSettingMock,
        });
        const infoSpy = jest.spyOn(logger.ZoweLogger, "info");

        expect(await logger.ZoweLogger.initializeZoweLogger(globalMocks.testContext)).toBeUndefined();
        expect(infoSpy).toHaveBeenCalled();
        infoSpy.mockClear();
    });
    it("should initialize loggers successfully with not changing to cli logger setting", async () => {
        const globalMocks = createGlobalMocks();
        jest.spyOn(globals, "initLogger").mockReturnValueOnce();
        globalMocks.mockGetConfiguration.mockReturnValue({
            get: getSettingMock,
        });
        const infoSpy = jest.spyOn(logger.ZoweLogger, "info");
        process.env.ZOWE_APP_LOG_LEVEL = "DEBUG";
        const messageSpy = jest.spyOn(Gui, "infoMessage").mockResolvedValueOnce(undefined);
        const updateSpy = jest.spyOn(SettingsConfig, "setDirectValue");

        expect(await logger.ZoweLogger.initializeZoweLogger(globalMocks.testContext)).toBeUndefined();
        expect(infoSpy).toHaveBeenCalled();
        expect(messageSpy).toHaveBeenCalled();
        expect(updateSpy).toHaveBeenCalledWith("zowe.cliLoggerSetting.presented", true, 1);
        expect(updateSpy).not.toHaveBeenCalledWith("zowe.logger", "DEBUG", 1);
        infoSpy.mockClear();
        messageSpy.mockClear();
        updateSpy.mockClear();
    });
    it("should initialize loggers successfully with changing to cli logger setting", async () => {
        const globalMocks = createGlobalMocks();
        jest.spyOn(globals, "initLogger").mockReturnValueOnce();
        globalMocks.mockGetConfiguration.mockReturnValue({
            get: getSettingMock,
        });
        const infoSpy = jest.spyOn(logger.ZoweLogger, "info");
        process.env.ZOWE_APP_LOG_LEVEL = "DEBUG";
        const messageSpy = jest.spyOn(Gui, "infoMessage").mockResolvedValueOnce("Update");
        const updateSpy = jest.spyOn(SettingsConfig, "setDirectValue");

        expect(await logger.ZoweLogger.initializeZoweLogger(globalMocks.testContext)).toBeUndefined();
        expect(infoSpy).toHaveBeenCalled();
        expect(messageSpy).toHaveBeenCalled();
        expect(updateSpy).toHaveBeenCalledTimes(2);
        infoSpy.mockClear();
        messageSpy.mockClear();
        updateSpy.mockClear();
    });
    it("should reinitialize loggers successfully with new path", async () => {
        const globalMocks = createGlobalMocks();
        const oldLogsPath = path.join("..", "logs1");
        const newLogsPath = path.join("..", "logs2");
        globalMocks.mockGetConfiguration.mockReturnValue({
            get: getSettingMock,
        });
        const initLoggerSpy = jest.spyOn(zowe.imperative.Logger, "initLogger").mockImplementation();
        jest.spyOn(logger.ZoweLogger as any, "initVscLogger").mockImplementation();

        await logger.ZoweLogger.initializeZoweLogger({
            ...globalMocks.testContext,
            extensionPath: oldLogsPath,
        });
        await logger.ZoweLogger.initializeZoweLogger({
            ...globalMocks.testContext,
            extensionPath: newLogsPath,
        });

        expect(initLoggerSpy).toHaveBeenCalledTimes(2);
        const loggerConfig: Record<string, any> = initLoggerSpy.mock.calls[0][0];
        expect(loggerConfig.log4jsConfig.appenders.default.filename.indexOf(oldLogsPath)).toBe(0);
        const loggerConfig2: Record<string, any> = initLoggerSpy.mock.calls[1][0];
        expect(loggerConfig2.log4jsConfig.appenders.default.filename.indexOf(oldLogsPath)).toBe(-1);
        expect(loggerConfig2.log4jsConfig.appenders.default.filename.indexOf(newLogsPath)).toBe(0);
    });
    it("should throw an error if global logger was not able to initialize", async () => {
        const globalMocks = createGlobalMocks();
        jest.spyOn(globals, "initLogger").mockImplementationOnce(() => {
            throw new Error("failed to initialize logger");
        });
        globalMocks.mockLogger.mockImplementationOnce(() => {
            throw new Error("should not call invalid logger");
        });
        const errorMessageSpy = jest.spyOn(Gui, "errorMessage").mockImplementation();

        expect(await logger.ZoweLogger.initializeZoweLogger(globalMocks.testContext)).toBeUndefined();
        expect(errorMessageSpy).toBeCalledTimes(1);
        expect(globals.LOG).not.toHaveBeenCalled();
        errorMessageSpy.mockClear();
    });
    it("should throw an error if output channel was not able to initialize", async () => {
        const globalMocks = createGlobalMocks();
        jest.spyOn(globals, "initLogger").mockReturnValueOnce();
        jest.spyOn(Gui, "createOutputChannel").mockImplementationOnce(() => {
            throw new Error("failed to initialize output channel");
        });
        const errorMessageSpy = jest.spyOn(Gui, "errorMessage").mockImplementation();

        expect(await logger.ZoweLogger.initializeZoweLogger(globalMocks.testContext)).toBeUndefined();
        expect(errorMessageSpy).toBeCalledTimes(1);
        errorMessageSpy.mockClear();
    });
});

describe("It should pass the correct message severity", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it("ZoweLogger.trace passes TRACE as severity", async () => {
        const globalMocks = createGlobalMocks();
        globalMocks.mockGetConfiguration.mockReturnValueOnce({
            get: jest.fn(() => "TRACE"),
        });
        await logger.ZoweLogger.trace(globalMocks.mockMessage);
        expect(globals.LOG.trace).toHaveBeenCalled();
    });
    it("ZoweLogger.debug passes DEBUG as severity", async () => {
        const globalMocks = createGlobalMocks();
        globalMocks.mockGetConfiguration.mockReturnValueOnce({
            get: jest.fn(() => "DEBUG"),
        });
        await logger.ZoweLogger.debug(globalMocks.mockMessage);
        expect(globals.LOG.debug).toHaveBeenCalled();
    });
    it("ZoweLogger.info passes INFO as severity", async () => {
        const globalMocks = createGlobalMocks();
        globalMocks.mockGetConfiguration.mockReturnValueOnce({
            get: jest.fn(() => "INFO"),
        });
        await logger.ZoweLogger.info(globalMocks.mockMessage);
        expect(globals.LOG.info).toHaveBeenCalled();
    });
    it("ZoweLogger.warn passes WARN as severity", async () => {
        const globalMocks = createGlobalMocks();
        globalMocks.mockGetConfiguration.mockReturnValueOnce({
            get: jest.fn(() => "WARN"),
        });
        await logger.ZoweLogger.warn(globalMocks.mockMessage);
        expect(globals.LOG.warn).toHaveBeenCalled();
    });
    it("ZoweLogger.error passes ERROR as severity", async () => {
        const globalMocks = createGlobalMocks();
        globalMocks.mockGetConfiguration.mockReturnValueOnce({
            get: jest.fn(() => "ERROR"),
        });
        await logger.ZoweLogger.error(globalMocks.mockMessage);
        expect(globals.LOG.error).toHaveBeenCalled();
    });
    it("ZoweLogger.fatal passes FATAL as severity", async () => {
        const globalMocks = createGlobalMocks();
        globalMocks.mockGetConfiguration.mockReturnValueOnce({
            get: jest.fn(() => "FATAL"),
        });
        await logger.ZoweLogger.fatal(globalMocks.mockMessage);
        expect(globals.LOG.fatal).toHaveBeenCalled();
    });
});

describe("ZoweLogger.dispose()", () => {
    it("Output channel disposed", async () => {
        const spy = jest.spyOn(logger.ZoweLogger.zeOutputChannel, "dispose");
        expect(await logger.ZoweLogger.disposeZoweLogger()).toBeUndefined();
        expect(spy).toBeCalled();
    });
});
