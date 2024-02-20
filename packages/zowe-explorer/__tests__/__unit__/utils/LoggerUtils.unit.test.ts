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
import * as core from "@zowe/core-for-zowe-sdk";
import { Gui, imperative, MessageSeverity } from "@zowe/zowe-explorer-api";
import * as shared from "../../../__mocks__/mockCreators/shared";
import { SettingsConfig } from "../../../src/utils/SettingsConfig";
import { ZoweLocalStorage } from "../../../src/utils/ZoweLocalStorage";

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
    jest.spyOn(vscode.workspace, "getConfiguration").mockImplementationOnce(newMocks.mockGetConfiguration);
    Object.defineProperty(ZoweLocalStorage, "storage", {
        value: {
            get: () => ({ persistence: true, favorites: [], history: [], sessions: ["zosmf"], searchHistory: [], fileHistory: [] }),
            update: jest.fn(),
            keys: () => [],
        },
        configurable: true,
    });
    Object.defineProperty(logger, "getDate", { value: "2023/1/1", configurable: true });
    Object.defineProperty(logger, "getTime", { value: "08:00:00", configurable: true });
    Object.defineProperty(core, "padLeft", { value: jest.fn(), configurable: true });
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
        jest.spyOn(imperative.Logger, "initLogger").mockImplementation(globalMocks.mockLogger);
        const infoMock = jest.spyOn(logger.ZoweLogger, "info").mockImplementationOnce((_msg) => {});
        globalMocks.mockGetConfiguration.mockReturnValue({
            get: getSettingMock,
        });

        expect(await logger.ZoweLogger.initializeZoweLogger(globalMocks.testContext)).toBeUndefined();
        expect(infoMock).toHaveBeenCalled();
    });
    it("should initialize loggers successfully with not changing to cli logger setting", async () => {
        const globalMocks = createGlobalMocks();
        globalMocks.mockGetConfiguration.mockReturnValue({
            get: getSettingMock,
        });
        process.env.ZOWE_APP_LOG_LEVEL = "DEBUG";

        expect(await logger.ZoweLogger.initializeZoweLogger(globalMocks.testContext)).toBeUndefined();
    });
    it("should initialize loggers successfully with changing to cli logger setting", async () => {
        const globalMocks = createGlobalMocks();
        globalMocks.mockGetConfiguration.mockReturnValue({
            get: getSettingMock,
        });
        const infoSpy = jest.spyOn(logger.ZoweLogger, "info");
        process.env.ZOWE_APP_LOG_LEVEL = "DEBUG";

        expect(await logger.ZoweLogger.initializeZoweLogger(globalMocks.testContext)).toBeUndefined();
        expect(infoSpy).toHaveBeenCalled();
        infoSpy.mockClear();
    });
    it("should reinitialize loggers successfully with new path", async () => {
        const globalMocks = createGlobalMocks();
        const oldLogsPath = path.join("..", "logs1");
        const newLogsPath = path.join("..", "logs2");
        globalMocks.mockGetConfiguration.mockReturnValue({
            get: getSettingMock,
        });
        const initLoggerSpy = jest.spyOn(imperative.Logger, "initLogger").mockImplementation();
        initLoggerSpy.mockClear();
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
        jest.spyOn(imperative.Logger, "initLogger").mockImplementationOnce(() => {
            throw new Error("failed to initialize logger");
        });
        globalMocks.mockLogger.mockImplementationOnce(() => {
            throw new Error("should not call invalid logger");
        });
        const errorMessageSpy = jest.spyOn(Gui, "errorMessage").mockImplementation();
        expect(await logger.ZoweLogger.initializeZoweLogger(globalMocks.testContext)).toBeUndefined();
        expect(errorMessageSpy).toHaveBeenCalledTimes(1);
        errorMessageSpy.mockClear();
    });
    it("should throw an error if output channel was not able to initialize", async () => {
        const globalMocks = createGlobalMocks();
        jest.spyOn(imperative.Logger, "initLogger").mockImplementationOnce(() => {
            return imperative.Logger.getAppLogger();
        });
        jest.spyOn(Gui, "createOutputChannel").mockImplementationOnce(() => {
            throw new Error("failed to initialize output channel");
        });
        const errorMessageSpy = jest.spyOn(Gui, "errorMessage").mockImplementation();

        expect(await logger.ZoweLogger.initializeZoweLogger(globalMocks.testContext)).toBeUndefined();
        expect(errorMessageSpy).toHaveBeenCalledTimes(1);
        errorMessageSpy.mockClear();
    });
});

describe("It should pass the correct message severity", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const writeLogMessageMock = jest.spyOn(logger.ZoweLogger as any, "writeLogMessage");

    afterAll(() => {
        writeLogMessageMock.mockRestore();
    });

    it("ZoweLogger.trace passes TRACE as severity", async () => {
        const globalMocks = createGlobalMocks();
        globalMocks.mockGetConfiguration.mockReturnValueOnce({
            get: jest.fn(() => "TRACE"),
        });
        await logger.ZoweLogger.trace(globalMocks.mockMessage);
        expect(writeLogMessageMock).toHaveBeenCalledWith(globalMocks.mockMessage, MessageSeverity.TRACE);
    });
    it("ZoweLogger.debug passes DEBUG as severity", async () => {
        const globalMocks = createGlobalMocks();
        globalMocks.mockGetConfiguration.mockReturnValueOnce({
            get: jest.fn(() => "DEBUG"),
        });
        await logger.ZoweLogger.debug(globalMocks.mockMessage);
        expect(writeLogMessageMock).toHaveBeenCalledWith(globalMocks.mockMessage, MessageSeverity.DEBUG);
    });
    it("ZoweLogger.info passes INFO as severity", async () => {
        const globalMocks = createGlobalMocks();
        globalMocks.mockGetConfiguration.mockReturnValueOnce({
            get: jest.fn(() => "INFO"),
        });
        await logger.ZoweLogger.info(globalMocks.mockMessage);
        expect(writeLogMessageMock).toHaveBeenCalledWith(globalMocks.mockMessage, MessageSeverity.INFO);
    });
    it("ZoweLogger.warn passes WARN as severity", async () => {
        const globalMocks = createGlobalMocks();
        globalMocks.mockGetConfiguration.mockReturnValueOnce({
            get: jest.fn(() => "WARN"),
        });
        await logger.ZoweLogger.warn(globalMocks.mockMessage);
        expect(writeLogMessageMock).toHaveBeenCalledWith(globalMocks.mockMessage, MessageSeverity.WARN);
    });
    it("ZoweLogger.error passes ERROR as severity", async () => {
        const globalMocks = createGlobalMocks();
        globalMocks.mockGetConfiguration.mockReturnValueOnce({
            get: jest.fn(() => "ERROR"),
        });
        await logger.ZoweLogger.error(globalMocks.mockMessage);
        expect(writeLogMessageMock).toHaveBeenCalledWith(globalMocks.mockMessage, MessageSeverity.ERROR);
    });
    it("ZoweLogger.fatal passes FATAL as severity", async () => {
        const globalMocks = createGlobalMocks();
        globalMocks.mockGetConfiguration.mockReturnValueOnce({
            get: jest.fn(() => "FATAL"),
        });
        await logger.ZoweLogger.fatal(globalMocks.mockMessage);
        expect(writeLogMessageMock).toHaveBeenCalledWith(globalMocks.mockMessage, MessageSeverity.FATAL);
    });
});

describe("ZoweLogger.dispose()", () => {
    it("Output channel disposed", async () => {
        const spy = jest.spyOn(logger.ZoweLogger.zeOutputChannel, "dispose");
        expect(await logger.ZoweLogger.disposeZoweLogger()).toBeUndefined();
        expect(spy).toHaveBeenCalled();
    });
});

describe("ZoweLogger.updateVscLoggerSetting", () => {
    it("should set the CLI logger setting", async () => {
        const testCLISetting = {};
        const setCliLoggerSettingSpy = jest.spyOn(SettingsConfig, "setCliLoggerSetting");
        const guiInfoSpy = jest.spyOn(Gui, "infoMessage");
        guiInfoSpy.mockResolvedValue("Test");
        jest.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
            get: jest.fn(),
        } as any);
        await (logger.ZoweLogger as any).updateVscLoggerSetting(testCLISetting);
        expect(setCliLoggerSettingSpy).toHaveBeenCalledWith(true);
    });
});
