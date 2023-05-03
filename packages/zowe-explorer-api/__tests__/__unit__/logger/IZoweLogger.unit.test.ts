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

import { imperative } from "@zowe/cli";
import { IZoweLogger, MessageSeverity } from "../../../src/logger/IZoweLogger";
import * as loggerConfig from "../../../src/log4jsconfig.json";

jest.mock("fs");

describe("IZoweLogger", () => {
    const extensionName = "test";
    const loggingPath = __dirname;

    const expectLogWithSeverity = (logger: IZoweLogger, methodName: keyof imperative.Logger, severity: MessageSeverity): void => {
        const loggerSpy = jest.spyOn(logger.getImperativeLogger() as any, methodName);
        const logMessage = methodName.split("").reverse().join("");
        logger.logImperativeMessage(logMessage, severity);
        expect(loggerSpy).toBeCalledWith(`[${extensionName}] ${logMessage}`);
    };

    it("should use extension name and logging path", () => {
        const initLoggerSpy = jest.spyOn(imperative.Logger, "initLogger");
        const testLogger = new IZoweLogger(extensionName, loggingPath);
        expect(testLogger.getExtensionName()).toBe(extensionName);
        expect(initLoggerSpy).toBeCalledWith(loggerConfig);
        expect(Object.values(loggerConfig.log4jsConfig.appenders).every((appender) => appender.filename.startsWith(loggingPath))).toBe(true);
    });

    it("should log Imperative message with TRACE severity", () => {
        const testLogger = new IZoweLogger(extensionName, loggingPath);
        expectLogWithSeverity(testLogger, "trace", MessageSeverity.TRACE);
    });

    it("should log Imperative message with DEBUG severity", () => {
        const testLogger = new IZoweLogger(extensionName, loggingPath);
        expectLogWithSeverity(testLogger, "debug", MessageSeverity.DEBUG);
    });

    it("should log Imperative message with INFO severity", () => {
        const testLogger = new IZoweLogger(extensionName, loggingPath);
        expectLogWithSeverity(testLogger, "info", MessageSeverity.INFO);
    });

    it("should log Imperative message with WARN severity", () => {
        const testLogger = new IZoweLogger(extensionName, loggingPath);
        expectLogWithSeverity(testLogger, "warn", MessageSeverity.WARN);
    });

    it("should log Imperative message with ERROR severity", () => {
        const testLogger = new IZoweLogger(extensionName, loggingPath);
        expectLogWithSeverity(testLogger, "error", MessageSeverity.ERROR);
    });

    it("should log Imperative message with FATAL severity", () => {
        const testLogger = new IZoweLogger(extensionName, loggingPath);
        expectLogWithSeverity(testLogger, "fatal", MessageSeverity.FATAL);
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
        try {
            testLogger.logImperativeMessage("i haz error", -1);
            fail("Imperative message w/ invalid severity should throw an exception.");
        } catch (error) {
            expect(error).toBeDefined();
            if (error instanceof Error) {
                expect(error.message).toMatch(/^Cannot read propert(y|ies)/);
            }
        }
    });
});
