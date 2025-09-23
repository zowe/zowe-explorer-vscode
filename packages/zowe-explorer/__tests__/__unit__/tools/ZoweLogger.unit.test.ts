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
import * as loggerConfig from "../../log4jsconfig.json";
import * as path from "path";
import { Gui, imperative, MessageSeverity, ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";
import { ZoweLogger } from "../../../src/tools/ZoweLogger";
jest.unmock("@zowe/imperative");

describe("ZoweLogger", () => {
    let logger: imperative.Logger;

    beforeEach(() => {
        logger = imperative.Logger.getImperativeLogger();
        jest.spyOn(imperative.Logger, "getImperativeLogger").mockReturnValue(logger);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("initializeZoweLogger", () => {
        let initializeImperativeLoggerSpy: jest.SpyInstance;
        let guiErrorMessageSpy: jest.SpyInstance;

        beforeEach(() => {
            initializeImperativeLoggerSpy = jest.spyOn(ZoweLogger as any, "initializeImperativeLogger").mockReturnValue(undefined);
            guiErrorMessageSpy = jest.spyOn(Gui, "errorMessage").mockResolvedValue("");
        });

        it("should initialize the Imperative logger with extension path", async () => {
            await ZoweLogger.initializeZoweLogger({ extensionPath: "fakePath" } as any);
            expect(initializeImperativeLoggerSpy).toHaveBeenCalledTimes(1);
            expect(initializeImperativeLoggerSpy).toHaveBeenCalledWith("fakePath");
            expect(guiErrorMessageSpy).toHaveBeenCalledTimes(0);
        });

        it("should initialize the Imperative logger with custom logging path", async () => {
            jest.spyOn(ZoweVsCodeExtension, "customLoggingPath", "get").mockReturnValue("someOtherPath");
            await ZoweLogger.initializeZoweLogger({ extensionPath: "fakePath" } as any);
            expect(initializeImperativeLoggerSpy).toHaveBeenCalledTimes(1);
            expect(initializeImperativeLoggerSpy).toHaveBeenCalledWith("someOtherPath");
            expect(guiErrorMessageSpy).toHaveBeenCalledTimes(0);
        });

        it("should fail to initialize and send an error to the output channel", async () => {
            initializeImperativeLoggerSpy.mockImplementation(() => {
                throw new imperative.ImperativeError({ msg: "Fake Error" });
            });
            await ZoweLogger.initializeZoweLogger({ extensionPath: "fakePath" } as any);
            expect(initializeImperativeLoggerSpy).toHaveBeenCalledTimes(1);
            expect(initializeImperativeLoggerSpy).toHaveBeenCalledWith("fakePath");
            expect(guiErrorMessageSpy).toHaveBeenCalledTimes(1);
            expect(guiErrorMessageSpy).toHaveBeenCalledWith("Error encountered while activating and initializing logger: Fake Error");
        });
    });

    describe("initializeImperativeLogger", () => {
        let getLogSettingSpy: jest.SpyInstance;
        let getAppLoggerSpy: jest.SpyInstance;
        let initLoggerSpy: jest.SpyInstance;

        const loggerConfigCopy = JSON.parse(JSON.stringify(loggerConfig));
        loggerConfigCopy.log4jsConfig.appenders.app.filename = path.join("fakePath", "logs", "zowe.log");
        loggerConfigCopy.log4jsConfig.appenders.default.filename = loggerConfigCopy.log4jsConfig.appenders.imperative.filename = path.join(
            "fakePath",
            "logs",
            "imperative.log"
        );
        loggerConfigCopy.log4jsConfig.categories.app.level =
            loggerConfigCopy.log4jsConfig.categories.default.level =
            loggerConfigCopy.log4jsConfig.categories.imperative.level =
                "INFO";

        beforeEach(() => {
            initLoggerSpy = jest.spyOn(imperative.Logger, "initLogger").mockReturnValue(logger);
            getAppLoggerSpy = jest.spyOn(imperative.Logger, "getAppLogger").mockReturnValue(logger);
            getLogSettingSpy = jest.spyOn(ZoweLogger, "getLogSetting").mockReturnValue("INFO");
        });

        it("should initialize an Imperative logger", () => {
            (ZoweLogger as any).initializeImperativeLogger("fakePath");
            expect(getLogSettingSpy).toHaveBeenCalledTimes(1);
            expect(initLoggerSpy).toHaveBeenCalledTimes(1);
            expect(initLoggerSpy).toHaveBeenCalledWith(loggerConfigCopy);
            expect(getAppLoggerSpy).toHaveBeenCalledTimes(1);
        });

        it("should return the logger in imperativeLogger", async () => {
            (ZoweLogger as any).initializeImperativeLogger("fakePath");
            expect(getLogSettingSpy).toHaveBeenCalledTimes(1);
            expect(initLoggerSpy).toHaveBeenCalledTimes(1);
            expect(initLoggerSpy).toHaveBeenCalledWith(loggerConfigCopy);
            expect(getAppLoggerSpy).toHaveBeenCalledTimes(1);
            expect(ZoweLogger.imperativeLogger).toBe(logger);
        });
    });

    describe("log at levels", () => {
        let writeLogMessageSpy: jest.SpyInstance;

        beforeEach(() => {
            writeLogMessageSpy = jest.spyOn(ZoweLogger as any, "writeLogMessage").mockReturnValue(undefined);
        });

        it("should log trace", () => {
            ZoweLogger.trace("test");
            expect(writeLogMessageSpy).toHaveBeenCalledTimes(1);
            expect(writeLogMessageSpy).toHaveBeenCalledWith("test", MessageSeverity.TRACE);
        });

        it("should log debug", () => {
            ZoweLogger.debug("test");
            expect(writeLogMessageSpy).toHaveBeenCalledTimes(1);
            expect(writeLogMessageSpy).toHaveBeenCalledWith("test", MessageSeverity.DEBUG);
        });

        it("should log info", () => {
            ZoweLogger.info("test");
            expect(writeLogMessageSpy).toHaveBeenCalledTimes(1);
            expect(writeLogMessageSpy).toHaveBeenCalledWith("test", MessageSeverity.INFO);
        });

        it("should log warn", () => {
            ZoweLogger.warn("test");
            expect(writeLogMessageSpy).toHaveBeenCalledTimes(1);
            expect(writeLogMessageSpy).toHaveBeenCalledWith("test", MessageSeverity.WARN);
        });

        it("should log error", () => {
            ZoweLogger.error("test");
            expect(writeLogMessageSpy).toHaveBeenCalledTimes(1);
            expect(writeLogMessageSpy).toHaveBeenCalledWith("test", MessageSeverity.ERROR);
        });

        it("should log fatal", () => {
            ZoweLogger.fatal("test");
            expect(writeLogMessageSpy).toHaveBeenCalledTimes(1);
            expect(writeLogMessageSpy).toHaveBeenCalledWith("test", MessageSeverity.FATAL);
        });
    });

    describe("disposeZoweLogger", () => {
        const storedOutputChannel = ZoweLogger.zeOutputChannel;

        afterAll(() => {
            ZoweLogger.zeOutputChannel = storedOutputChannel;
        });

        it("should dispose of the Zowe logger", () => {
            const fakeDispose = jest.fn();
            ZoweLogger.zeOutputChannel = { dispose: fakeDispose } as any;
            ZoweLogger.disposeZoweLogger();
            expect(fakeDispose).toHaveBeenCalled();
        });
    });

    describe("getLogSetting", () => {
        let getConfigurationSpy: jest.SpyInstance;
        let getSpy: jest.SpyInstance;

        beforeEach(() => {
            getSpy = jest.fn();
            getConfigurationSpy = jest.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({ get: getSpy } as any);
        });

        it("should return the configured log level", () => {
            getSpy.mockReturnValue("ERROR");
            expect(ZoweLogger.getLogSetting()).toEqual("ERROR");
            expect(getConfigurationSpy).toHaveBeenCalledTimes(1);
            expect(getSpy).toHaveBeenCalledTimes(1);
        });

        it("should return the default log level", () => {
            getSpy.mockReturnValue(undefined);
            expect(ZoweLogger.getLogSetting()).toEqual("INFO");
            expect(getConfigurationSpy).toHaveBeenCalledTimes(1);
            expect(getSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe("writeLogMessage", () => {
        let imperativeTraceLoggerSpy: jest.SpyInstance;
        let imperativeDebugLoggerSpy: jest.SpyInstance;
        let imperativeInfoLoggerSpy: jest.SpyInstance;
        let imperativeWarnLoggerSpy: jest.SpyInstance;
        let imperativeErrorLoggerSpy: jest.SpyInstance;
        let imperativeFatalLoggerSpy: jest.SpyInstance;
        let imperativeSimpleLoggerSpy: jest.SpyInstance;
        let imperativeLoggerSpy: jest.SpyInstance;
        let getLogSettingSpy: jest.SpyInstance;
        let appendLineSpy: jest.SpyInstance;
        let censorRawDataSpy: jest.SpyInstance;
        let createMessageSpy: jest.SpyInstance;
        const storedOutputChannel = ZoweLogger.zeOutputChannel;

        function loggerImplementation(message: string, ..._args: any[]): string {
            return message;
        }

        beforeEach(() => {
            imperativeLoggerSpy = jest.spyOn(ZoweLogger, "imperativeLogger", "get").mockReturnValue(logger);
            imperativeTraceLoggerSpy = jest.spyOn(logger, "trace").mockImplementation(loggerImplementation);
            imperativeDebugLoggerSpy = jest.spyOn(logger, "debug").mockImplementation(loggerImplementation);
            imperativeInfoLoggerSpy = jest.spyOn(logger, "info").mockImplementation(loggerImplementation);
            imperativeWarnLoggerSpy = jest.spyOn(logger, "warn").mockImplementation(loggerImplementation);
            imperativeErrorLoggerSpy = jest.spyOn(logger, "error").mockImplementation(loggerImplementation);
            imperativeFatalLoggerSpy = jest.spyOn(logger, "fatal").mockImplementation(loggerImplementation);
            imperativeSimpleLoggerSpy = jest.spyOn(logger, "simple").mockImplementation(loggerImplementation);
            getLogSettingSpy = jest.spyOn(ZoweLogger, "getLogSetting").mockReturnValue("TRACE");
            censorRawDataSpy = jest.spyOn(imperative.Censor, "censorRawData").mockImplementation((message: string) => {
                return message;
            });
            createMessageSpy = jest.spyOn(ZoweLogger as any, "createMessage").mockImplementation((message: string, level: string) => {
                return `[1970/01/01 12:00:00] [${level}] ${message}`;
            });

            appendLineSpy = jest.fn();
            ZoweLogger.zeOutputChannel = { appendLine: appendLineSpy } as any;
        });

        afterAll(() => {
            ZoweLogger.zeOutputChannel = storedOutputChannel;
        });

        it("should not log if the imperative logger isn't present", () => {
            imperativeLoggerSpy.mockReturnValue(null);
            (ZoweLogger as any).writeLogMessage("Test Message", MessageSeverity.INFO);
            expect(getLogSettingSpy).toHaveBeenCalledTimes(0);
            expect(imperativeTraceLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeDebugLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeInfoLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeWarnLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeErrorLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeFatalLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeSimpleLoggerSpy).toHaveBeenCalledTimes(0);
            expect(censorRawDataSpy).toHaveBeenCalledTimes(0);
            expect(createMessageSpy).toHaveBeenCalledTimes(0);
        });

        it("should log trace", () => {
            (ZoweLogger as any).writeLogMessage("Test Message", MessageSeverity.TRACE);
            expect(getLogSettingSpy).toHaveBeenCalledTimes(1);
            expect(imperativeTraceLoggerSpy).toHaveBeenCalledTimes(1);
            expect(imperativeDebugLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeInfoLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeWarnLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeErrorLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeFatalLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeSimpleLoggerSpy).toHaveBeenCalledTimes(0);
            expect(censorRawDataSpy).toHaveBeenCalledTimes(1);
            expect(createMessageSpy).toHaveBeenCalledTimes(1);
            expect(imperativeTraceLoggerSpy).toHaveBeenCalledWith("Test Message");
        });

        it("should log debug", () => {
            (ZoweLogger as any).writeLogMessage("Test Message", MessageSeverity.DEBUG);
            expect(getLogSettingSpy).toHaveBeenCalledTimes(1);
            expect(imperativeTraceLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeDebugLoggerSpy).toHaveBeenCalledTimes(1);
            expect(imperativeInfoLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeWarnLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeErrorLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeFatalLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeSimpleLoggerSpy).toHaveBeenCalledTimes(0);
            expect(censorRawDataSpy).toHaveBeenCalledTimes(1);
            expect(createMessageSpy).toHaveBeenCalledTimes(1);
            expect(imperativeDebugLoggerSpy).toHaveBeenCalledWith("Test Message");
        });

        it("should log info", () => {
            (ZoweLogger as any).writeLogMessage("Test Message", MessageSeverity.INFO);
            expect(getLogSettingSpy).toHaveBeenCalledTimes(1);
            expect(imperativeTraceLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeDebugLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeInfoLoggerSpy).toHaveBeenCalledTimes(1);
            expect(imperativeWarnLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeErrorLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeFatalLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeSimpleLoggerSpy).toHaveBeenCalledTimes(0);
            expect(censorRawDataSpy).toHaveBeenCalledTimes(1);
            expect(createMessageSpy).toHaveBeenCalledTimes(1);
            expect(imperativeInfoLoggerSpy).toHaveBeenCalledWith("Test Message");
        });

        it("should log warn", () => {
            (ZoweLogger as any).writeLogMessage("Test Message", MessageSeverity.WARN);
            expect(getLogSettingSpy).toHaveBeenCalledTimes(1);
            expect(imperativeTraceLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeDebugLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeInfoLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeWarnLoggerSpy).toHaveBeenCalledTimes(1);
            expect(imperativeErrorLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeFatalLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeSimpleLoggerSpy).toHaveBeenCalledTimes(0);
            expect(censorRawDataSpy).toHaveBeenCalledTimes(1);
            expect(createMessageSpy).toHaveBeenCalledTimes(1);
            expect(imperativeWarnLoggerSpy).toHaveBeenCalledWith("Test Message");
        });

        it("should log error", () => {
            (ZoweLogger as any).writeLogMessage("Test Message", MessageSeverity.ERROR);
            expect(getLogSettingSpy).toHaveBeenCalledTimes(1);
            expect(imperativeTraceLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeDebugLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeInfoLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeWarnLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeErrorLoggerSpy).toHaveBeenCalledTimes(1);
            expect(imperativeFatalLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeSimpleLoggerSpy).toHaveBeenCalledTimes(0);
            expect(censorRawDataSpy).toHaveBeenCalledTimes(1);
            expect(createMessageSpy).toHaveBeenCalledTimes(1);
            expect(imperativeErrorLoggerSpy).toHaveBeenCalledWith("Test Message");
        });

        it("should log fatal", () => {
            (ZoweLogger as any).writeLogMessage("Test Message", MessageSeverity.FATAL);
            expect(getLogSettingSpy).toHaveBeenCalledTimes(1);
            expect(imperativeTraceLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeDebugLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeInfoLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeWarnLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeErrorLoggerSpy).toHaveBeenCalledTimes(0);
            expect(imperativeFatalLoggerSpy).toHaveBeenCalledTimes(1);
            expect(imperativeSimpleLoggerSpy).toHaveBeenCalledTimes(0);
            expect(censorRawDataSpy).toHaveBeenCalledTimes(1);
            expect(createMessageSpy).toHaveBeenCalledTimes(1);
            expect(imperativeFatalLoggerSpy).toHaveBeenCalledWith("Test Message");
        });
    });

    describe("createMessage", () => {
        let getDateSpy: jest.SpyInstance;
        let getTimeSpy: jest.SpyInstance;

        beforeEach(() => {
            getDateSpy = jest.spyOn(ZoweLogger as any, "getDate").mockReturnValue("1970/01/01");
            getTimeSpy = jest.spyOn(ZoweLogger as any, "getTime").mockReturnValue("12:00:00");
        });

        it("should construct the message", () => {
            expect((ZoweLogger as any).createMessage("test message", "INFO")).toEqual("[1970/01/01 12:00:00] [INFO] test message");
            expect(getDateSpy).toHaveBeenCalledTimes(1);
            expect(getTimeSpy).toHaveBeenCalledTimes(1);
        });
    });
});
