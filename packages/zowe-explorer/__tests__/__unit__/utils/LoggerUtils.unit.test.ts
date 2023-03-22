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

import * as logger from "../../../src/utils/LoggerUtils";
import * as vscode from "vscode";
import * as globals from "../../../src/globals";
import { Gui } from "@zowe/zowe-explorer-api";
import * as shared from "../../../__mocks__/mockCreators/shared";

function createGlobalMocks() {
    const newMocks = {
        mockMessage: "fake message",
        outputChannel: shared.createOutputChannel(),
        mockCreateOutputChannel: jest.fn(),
        mockGetConfiguration: jest.fn(),
        testContext: {} as unknown as vscode.ExtensionContext,
    };
    newMocks.testContext = {
        subscriptions: [],
        extensionPath: "./test",
        extension: {
            packageJSON: {
                packageInfo: "Zowe Explorer",
                version: "2.x.x",
            },
        },
    } as unknown as vscode.ExtensionContext;
    newMocks.mockCreateOutputChannel.mockReturnValue(newMocks.outputChannel);
    Object.defineProperty(vscode.window, "createOutputChannel", { value: newMocks.mockCreateOutputChannel, configurable: true });
    Object.defineProperty(Gui, "createOutputChannel", { value: newMocks.mockCreateOutputChannel, configurable: true });
    Object.defineProperty(logger.ZoweLogger, "zoweExplOutput", {
        value: newMocks.outputChannel,
        configurable: true,
    });
    Object.defineProperty(globals, "LOG", { value: jest.fn(), configurable: true });
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

    return newMocks;
}

describe("Logger Utils Unit Tests - function initializeZoweLogger", () => {
    it("should throw an error if logger was not able to initialize", async () => {
        const globalMocks = createGlobalMocks();
        jest.spyOn(globals, "initLogger").mockImplementation(() => {
            throw new Error("failed to initialize logger");
        });

        const errorMessageSpy = jest.spyOn(Gui, "errorMessage").mockImplementation();

        expect(await logger.ZoweLogger.initializeZoweLogger(globalMocks.testContext)).toBeUndefined();
        expect(errorMessageSpy).toBeCalledTimes(1);
    });
});

describe("It should pass the correct message severity", () => {
    it("ZoweLogger.trace passes TRACE as severity", async () => {
        const globalMocks = createGlobalMocks();
        globalMocks.mockGetConfiguration.mockReturnValue({
            get: (setting: string) => "TRACE",
            update: jest.fn(),
        });
        await logger.ZoweLogger.trace(globalMocks.mockMessage);
        expect(globals.LOG.trace).toHaveBeenCalled();
        globalMocks.mockGetConfiguration.mockClear();
    });
    it("ZoweLogger.debug passes DEBUG as severity", async () => {
        const globalMocks = createGlobalMocks();
        globalMocks.mockGetConfiguration.mockReturnValue({
            get: (setting: string) => "DEBUG",
            update: jest.fn(),
        });
        await logger.ZoweLogger.debug(globalMocks.mockMessage);
        expect(globals.LOG.debug).toHaveBeenCalled();
        globalMocks.mockGetConfiguration.mockClear();
    });
    it("ZoweLogger.info passes INFO as severity", async () => {
        const globalMocks = createGlobalMocks();
        globalMocks.mockGetConfiguration.mockReturnValue({
            get: (setting: string) => "INFO",
            update: jest.fn(),
        });
        await logger.ZoweLogger.info(globalMocks.mockMessage);
        expect(globals.LOG.info).toHaveBeenCalled();
        globalMocks.mockGetConfiguration.mockClear();
    });
    it("ZoweLogger.warn passes WARN as severity", async () => {
        const globalMocks = createGlobalMocks();
        globalMocks.mockGetConfiguration.mockReturnValue({
            get: (setting: string) => "WARN",
            update: jest.fn(),
        });
        await logger.ZoweLogger.warn(globalMocks.mockMessage);
        expect(globals.LOG.warn).toHaveBeenCalled();
        globalMocks.mockGetConfiguration.mockClear();
    });
    it("ZoweLogger.error passes ERROR as severity", async () => {
        const globalMocks = createGlobalMocks();
        globalMocks.mockGetConfiguration.mockReturnValue({
            get: (setting: string) => "ERROR",
            update: jest.fn(),
        });
        await logger.ZoweLogger.error(globalMocks.mockMessage);
        expect(globals.LOG.error).toHaveBeenCalled();
        globalMocks.mockGetConfiguration.mockClear();
    });
    it("ZoweLogger.fatal passes FATAL as severity", async () => {
        const globalMocks = createGlobalMocks();
        globalMocks.mockGetConfiguration.mockReturnValue({
            get: (setting: string) => "FATAL",
            update: jest.fn(),
        });
        await logger.ZoweLogger.fatal(globalMocks.mockMessage);
        expect(globals.LOG.fatal).toHaveBeenCalled();
        globalMocks.mockGetConfiguration.mockClear();
    });
});
