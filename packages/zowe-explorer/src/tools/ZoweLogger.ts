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

/* eslint-disable @typescript-eslint/restrict-plus-operands */

import * as vscode from "vscode";
import * as loggerConfig from "../../log4jsconfig.json";
import * as path from "path";
import { Gui, imperative, MessageSeverity, ZoweVsCodeExtension } from "@zowe/zowe-explorer-api";

export class ZoweLogger {
    public static zeOutputChannel: vscode.OutputChannel;
    public static log: imperative.Logger;
    private static defaultLogLevel = "INFO";
    private static zeLogLevel: string;

    private static impLogger: imperative.Logger;

    public static async initializeZoweLogger(context: vscode.ExtensionContext): Promise<string> {
        try {
            const logsPath: string = ZoweVsCodeExtension.customLoggingPath ?? context.extensionPath;
            this.initializeImperativeLogger(logsPath);
            return logsPath;
        } catch (err) {
            // Don't log error if logger failed to initialize
            if (err instanceof Error) {
                const errorMessage = vscode.l10n.t("Error encountered while activating and initializing logger");
                await Gui.errorMessage(`${errorMessage}: ${err.message}`);
            }
        }
    }

    /**
     * Initializes Imperative Logger
     * @param logsPath File path for logs folder defined in preferences
     */
    private static initializeImperativeLogger(logsPath: string): void {
        const zeLogLevel = ZoweLogger.getLogSetting();
        const loggerConfigCopy = JSON.parse(JSON.stringify(loggerConfig));
        for (const appenderName of Object.keys(loggerConfigCopy.log4jsConfig.appenders)) {
            loggerConfigCopy.log4jsConfig.appenders[appenderName].filename = path.join(
                logsPath,
                loggerConfigCopy.log4jsConfig.appenders[appenderName].filename
            );
            loggerConfigCopy.log4jsConfig.categories[appenderName].level = zeLogLevel;
        }
        imperative.Logger.initLogger(loggerConfigCopy);
        this.impLogger = imperative.Logger.getAppLogger();
    }

    public static trace(message: string): void {
        this.writeLogMessage(message, MessageSeverity.TRACE);
    }

    public static debug(message: string): void {
        this.writeLogMessage(message, MessageSeverity.DEBUG);
    }

    public static info(message: string): void {
        this.writeLogMessage(message, MessageSeverity.INFO);
    }

    public static warn(message: string): void {
        this.writeLogMessage(message, MessageSeverity.WARN);
    }

    public static error(message: string): void {
        this.writeLogMessage(message, MessageSeverity.ERROR);
    }

    public static fatal(message: string): void {
        this.writeLogMessage(message, MessageSeverity.FATAL);
    }

    public static disposeZoweLogger(): void {
        this.zeOutputChannel.dispose();
    }

    public static getLogSetting(): string {
        this.zeLogLevel = vscode.workspace.getConfiguration("zowe").get("logger");
        return this.zeLogLevel ?? this.defaultLogLevel;
    }

    public static get imperativeLogger(): imperative.Logger {
        return this.impLogger;
    }

    private static writeLogMessage(message: string, severity: MessageSeverity): void {
        // Do not use Imperative logger if it hasn't been initialized.
        if (ZoweLogger.imperativeLogger == null) {
            return;
        }

        if (+MessageSeverity[this.getLogSetting()] <= +severity) {
            const severityName = MessageSeverity[severity];
            this.imperativeLogger[severityName?.toLowerCase()](message);
            this.zeOutputChannel?.appendLine(this.createMessage(message, severityName));
        }
    }

    private static createMessage(msg: string, level: string): string {
        return `[${this.getDate()} ${this.getTime()}] [${level}] ${msg}`;
    }

    private static getDate(): string {
        const dateObj = new Date(Date.now());
        const day = ("0" + dateObj?.getDate()).slice(-2);
        const month = ("0" + (dateObj?.getMonth() + 1)).slice(-2);
        return `${dateObj.getFullYear()}/${month}/${day}`;
    }

    private static getTime(): string {
        const dateObj = new Date(Date.now());
        const hours = dateObj?.getHours().toString().padStart(2, "0");
        const minutes = dateObj?.getMinutes().toString().padStart(2, "0");
        const seconds = dateObj?.getSeconds().toString().padStart(2, "0");
        return `${hours}:${minutes}:${seconds}`;
    }
}
