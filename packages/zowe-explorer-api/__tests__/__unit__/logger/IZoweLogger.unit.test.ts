import { imperative } from "@zowe/cli";
import { IZoweLogger, MessageSeverityEnum } from "../../../src/logger/IZoweLogger";
import * as loggerConfig from "../../../src/log4jsconfig.json";

jest.mock("fs");

describe("IZoweLogger", () => {
    const extensionName = "test";
    const loggingPath = __dirname;

    const expectLogWithSeverity = (logger: IZoweLogger, methodName: keyof imperative.Logger, severity: MessageSeverityEnum): void => {
        const loggerSpy = jest.spyOn(logger.getImperativeLogger() as any, methodName);
        const logMessage = methodName.split("").reverse().join("");
        logger.logImperativeMessage(logMessage, severity);
        expect(loggerSpy).toBeCalledWith(`[${extensionName}] ${logMessage}`);
    }

    it("should use extension name and logging path", () => {
        const initLoggerSpy = jest.spyOn(imperative.Logger, "initLogger");
        const testLogger = new IZoweLogger(extensionName, loggingPath);
        expect(testLogger.getExtensionName()).toBe(extensionName);
        expect(initLoggerSpy).toBeCalledWith(loggerConfig);
        expect(Object.values(loggerConfig.log4jsConfig.appenders).every((appender) => appender.filename.startsWith(loggingPath))).toBe(true);
    });

    it("should log Imperative message with TRACE severity", () => {
        const testLogger = new IZoweLogger(extensionName, loggingPath);
        expectLogWithSeverity(testLogger, "trace", MessageSeverityEnum.TRACE);
    });

    it("should log Imperative message with DEBUG severity", () => {
        const testLogger = new IZoweLogger(extensionName, loggingPath);
        expectLogWithSeverity(testLogger, "debug", MessageSeverityEnum.DEBUG);
    });

    it("should log Imperative message with INFO severity", () => {
        const testLogger = new IZoweLogger(extensionName, loggingPath);
        expectLogWithSeverity(testLogger, "info", MessageSeverityEnum.INFO);
    });

    it("should log Imperative message with WARN severity", () => {
        const testLogger = new IZoweLogger(extensionName, loggingPath);
        expectLogWithSeverity(testLogger, "warn", MessageSeverityEnum.WARN);
    });

    it("should log Imperative message with ERROR severity", () => {
        const testLogger = new IZoweLogger(extensionName, loggingPath);
        expectLogWithSeverity(testLogger, "error", MessageSeverityEnum.ERROR);
    });

    it("should log Imperative message with FATAL severity", () => {
        const testLogger = new IZoweLogger(extensionName, loggingPath);
        expectLogWithSeverity(testLogger, "fatal", MessageSeverityEnum.FATAL);
    });

    it("should log Imperative message with default severity", () => {
        const testLogger = new IZoweLogger(extensionName, loggingPath);
        const loggerSpy = jest.spyOn(testLogger.getImperativeLogger(), "debug");
        const logMessage = "i haz error";
        testLogger.logImperativeMessage(logMessage);
        expect(loggerSpy).toBeCalledWith(`[${extensionName}] ${logMessage}`);
    });

    it("should fail to log Imperative message with invalid severity", () => {
        const testLogger = new IZoweLogger(extensionName, loggingPath);
        let caughtError;
        try {
            testLogger.logImperativeMessage("i haz error", -1);
        } catch (error) {
            caughtError = error;
        }
        expect(caughtError).toBeDefined();
        expect(caughtError.message).toContain("Cannot read properties of undefined");
    });
});
