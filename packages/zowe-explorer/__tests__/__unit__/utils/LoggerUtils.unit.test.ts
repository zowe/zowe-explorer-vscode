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
import * as vscode from "vscode";
import * as core from "@zowe/core-for-zowe-sdk";
import * as shared from "../../__mocks__/mockCreators/shared";
import { Gui, imperative, MessageSeverity } from "@zowe/zowe-explorer-api";
import { SettingsConfig } from "../../../src/configuration/SettingsConfig";
import { SharedInit } from "../../../src/trees/shared/SharedInit";
import { LoggerUtils } from "../../../src/utils/LoggerUtils";
import { ZoweLocalStorage } from "../../../src/tools/ZoweLocalStorage";
import { ZoweLogger } from "../../../src/tools/ZoweLogger";

function createGlobalMocks() {
    const newMocks = {
        mockMessage: "fake message",
        outputChannel: shared.createOutputChannel(),
        mockGetConfiguration: jest.fn(),
        mockLogger: jest.fn(),
        testContext: {} as unknown as vscode.ExtensionContext,
        mockSetDirectValue: jest.fn(),
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
    jest.spyOn(ZoweLogger as any, "getDate").mockReturnValue("2023/1/1");
    jest.spyOn(ZoweLogger as any, "getTime").mockReturnValue("08:00:00");
    Object.defineProperty(core, "padLeft", { value: jest.fn(), configurable: true });
    Object.defineProperty(SettingsConfig, "setDirectValue", { value: newMocks.mockSetDirectValue, configurable: true });

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
        const infoMock = jest.spyOn(ZoweLogger, "info").mockImplementationOnce((_msg) => {});
        globalMocks.mockGetConfiguration.mockReturnValue({
            get: getSettingMock,
        });

        expect(await SharedInit.initZoweLogger(globalMocks.testContext)).toBeUndefined();
        expect(infoMock).toHaveBeenCalled();
    });
    it("should initialize loggers successfully with not changing to cli logger setting", async () => {
        const globalMocks = createGlobalMocks();
        globalMocks.mockGetConfiguration.mockReturnValue({
            get: getSettingMock,
        });
        process.env.ZOWE_APP_LOG_LEVEL = "DEBUG";

        expect(await SharedInit.initZoweLogger(globalMocks.testContext)).toBeUndefined();
    });
    it("should initialize loggers successfully with changing to cli logger setting", async () => {
        const globalMocks = createGlobalMocks();
        globalMocks.mockGetConfiguration.mockReturnValue({
            get: getSettingMock,
        });
        const infoSpy = jest.spyOn(ZoweLogger, "info");
        process.env.ZOWE_APP_LOG_LEVEL = "DEBUG";

        expect(await SharedInit.initZoweLogger(globalMocks.testContext)).toBeUndefined();
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
        jest.spyOn(LoggerUtils as any, "initVscLogger").mockImplementation();

        await ZoweLogger.initializeZoweLogger({
            ...globalMocks.testContext,
            extensionPath: oldLogsPath,
        });
        await ZoweLogger.initializeZoweLogger({
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
        expect(await ZoweLogger.initializeZoweLogger(globalMocks.testContext)).toBeUndefined();
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

        expect(await ZoweLogger.initializeZoweLogger(globalMocks.testContext)).toBeUndefined();
        expect(errorMessageSpy).toHaveBeenCalledTimes(1);
        errorMessageSpy.mockClear();
    });
});

describe("It should pass the correct message severity", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const writeLogMessageMock = jest.spyOn(ZoweLogger as any, "writeLogMessage");

    afterAll(() => {
        writeLogMessageMock.mockRestore();
    });

    it("ZoweLogger.trace passes TRACE as severity", () => {
        const globalMocks = createGlobalMocks();
        globalMocks.mockGetConfiguration.mockReturnValueOnce({
            get: jest.fn(() => "TRACE"),
        });
        ZoweLogger.trace(globalMocks.mockMessage);
        expect(writeLogMessageMock).toHaveBeenCalledWith(globalMocks.mockMessage, MessageSeverity.TRACE);
    });
    it("ZoweLogger.debug passes DEBUG as severity", () => {
        const globalMocks = createGlobalMocks();
        globalMocks.mockGetConfiguration.mockReturnValueOnce({
            get: jest.fn(() => "DEBUG"),
        });
        ZoweLogger.debug(globalMocks.mockMessage);
        expect(writeLogMessageMock).toHaveBeenCalledWith(globalMocks.mockMessage, MessageSeverity.DEBUG);
    });
    it("ZoweLogger.info passes INFO as severity", () => {
        const globalMocks = createGlobalMocks();
        globalMocks.mockGetConfiguration.mockReturnValueOnce({
            get: jest.fn(() => "INFO"),
        });
        ZoweLogger.info(globalMocks.mockMessage);
        expect(writeLogMessageMock).toHaveBeenCalledWith(globalMocks.mockMessage, MessageSeverity.INFO);
    });
    it("ZoweLogger.warn passes WARN as severity", () => {
        const globalMocks = createGlobalMocks();
        globalMocks.mockGetConfiguration.mockReturnValueOnce({
            get: jest.fn(() => "WARN"),
        });
        ZoweLogger.warn(globalMocks.mockMessage);
        expect(writeLogMessageMock).toHaveBeenCalledWith(globalMocks.mockMessage, MessageSeverity.WARN);
    });
    it("ZoweLogger.error passes ERROR as severity", () => {
        const globalMocks = createGlobalMocks();
        globalMocks.mockGetConfiguration.mockReturnValueOnce({
            get: jest.fn(() => "ERROR"),
        });
        ZoweLogger.error(globalMocks.mockMessage);
        expect(writeLogMessageMock).toHaveBeenCalledWith(globalMocks.mockMessage, MessageSeverity.ERROR);
    });
    it("ZoweLogger.fatal passes FATAL as severity", () => {
        const globalMocks = createGlobalMocks();
        globalMocks.mockGetConfiguration.mockReturnValueOnce({
            get: jest.fn(() => "FATAL"),
        });
        ZoweLogger.fatal(globalMocks.mockMessage);
        expect(writeLogMessageMock).toHaveBeenCalledWith(globalMocks.mockMessage, MessageSeverity.FATAL);
    });
});

describe("ZoweLogger.dispose()", () => {
    it("Output channel disposed", () => {
        const spy = jest.spyOn(ZoweLogger.zeOutputChannel, "dispose");
        expect(ZoweLogger.disposeZoweLogger()).toBeUndefined();
        expect(spy).toHaveBeenCalled();
    });
});

describe("LoggerUtils.updateVscLoggerSetting", () => {
    it("should set the CLI logger setting", async () => {
        const globalMocks = createGlobalMocks();
        const testCLISetting = {};
        const setCliLoggerSettingSpy = jest.spyOn(SettingsConfig, "setCliLoggerSetting");
        const guiInfoSpy = jest.spyOn(Gui, "infoMessage");
        guiInfoSpy.mockResolvedValue("Update");
        globalMocks.mockGetConfiguration.mockReturnValue({
            get: jest.fn(),
        } as any);
        await (LoggerUtils as any).updateVscLoggerSetting(testCLISetting);
        expect(globalMocks.mockSetDirectValue).toHaveBeenCalledWith("zowe.logger", testCLISetting);
        expect(setCliLoggerSettingSpy).toHaveBeenCalledWith(true);
    });
});
