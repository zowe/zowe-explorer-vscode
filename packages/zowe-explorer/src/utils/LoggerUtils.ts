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

/* eslint-disable no-magic-numbers */

import { Gui, MessageSeverity } from "@zowe/zowe-explorer-api";
import * as vscode from "vscode";
import * as nls from "vscode-nls";
import * as globals from "../globals";
import { SettingsConfig } from "./SettingsConfig";

// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

export class ZoweLogger {
    public static zoweExplOutput: vscode.OutputChannel;
    private static defaultLogLevel: "INFO";

    public static async initializeZoweLogger(context: vscode.ExtensionContext): Promise<void> {
        try {
            const logFileLocation = globals.initLogger(context);
            await this.initVscLogger(context, logFileLocation);
        } catch (err) {
            globals.LOG?.error(err);
            const errorMessage = localize("initialize.log.error", "Error encountered while activating and initializing logger! ");
            await Gui.errorMessage(`${errorMessage}: ${err?.message}`);
        }
    }

    public static async trace(message: string): Promise<void> {
        await this.writeLogMessage(message, MessageSeverity.TRACE);
    }

    public static async debug(message: string): Promise<void> {
        await this.writeLogMessage(message, MessageSeverity.DEBUG);
    }

    public static async info(message: string): Promise<void> {
        await this.writeLogMessage(message, MessageSeverity.INFO);
    }

    public static async warn(message: string): Promise<void> {
        await this.writeLogMessage(message, MessageSeverity.WARN);
    }

    public static async error(message: string): Promise<void> {
        await this.writeLogMessage(message, MessageSeverity.ERROR);
    }

    public static async fatal(message: string): Promise<void> {
        await this.writeLogMessage(message, MessageSeverity.FATAL);
    }

    public static disposeZoweLogger(): void {
        this.zoweExplOutput.dispose();
    }

    private static async initVscLogger(context: vscode.ExtensionContext, logFileLocation: string): Promise<void> {
        this.zoweExplOutput = Gui.createOutputChannel(localize("zoweExplorer.outputchannel.title", "Zowe Explorer"));
        const packageInfo = context.extension.packageJSON;
        await this.writeVscLoggerInfo(logFileLocation, packageInfo);
        const initMessage = localize("initialize.log.info", "Initialized logger for Zowe Explorer");
        this.info(initMessage);
        await this.compareCliLogSetting();
    }

    private static async writeVscLoggerInfo(logFileLocation: string, packageInfo: any) {
        this.zoweExplOutput.appendLine(`${packageInfo.displayName} ${packageInfo.version}`);
        this.zoweExplOutput.appendLine(localize("initialize.log.location", "This log file can be found at {0}", logFileLocation));
        this.zoweExplOutput.appendLine(localize("initialize.log.level", "Zowe Explorer log level: {0}", await this.getLogSetting()));
    }

    private static async getLogSetting(): Promise<string> {
        let logSetting: string = await vscode.workspace.getConfiguration().get("zowe.logger");
        return logSetting ? logSetting : this.defaultLogLevel;
    }

    private static async setLogSetting(setting: string): Promise<void> {
        await SettingsConfig.setDirectValue("zowe.logger", setting, vscode.ConfigurationTarget.Global);
    }

    private static async writeLogMessage(message: string, severity: MessageSeverity): Promise<void> {
        if (+MessageSeverity[await this.getLogSetting()] <= +severity) {
            const severityName = MessageSeverity[severity];
            globals.LOG[severityName?.toLowerCase()](message);
            this.zoweExplOutput.appendLine(this.setMessage(message, severityName));
        }
    }

    private static setMessage(msg: string, level: string): string {
        return `[${getDate()} ${getTime()}] [${level}] ${msg}`;
    }

    private static async compareCliLogSetting() {
        const cliLogSetting = this.getZoweLogEnVar();
        if (cliLogSetting && +MessageSeverity[await this.getLogSetting()] !== +MessageSeverity[cliLogSetting]) {
            const notified = await this.getCliLoggerSetting();
            if (!notified) {
                await this.updateLoggerSetting(cliLogSetting);
            }
        }
    }

    private static getZoweLogEnVar(): string {
        return process.env.ZOWE_APP_LOG_LEVEL;
    }

    private static async getCliLoggerSetting(): Promise<boolean> {
        const notified: boolean = await vscode.workspace.getConfiguration().get("zowe.cliLoggerSetting.presented");
        return notified ? notified : false;
    }

    private static async setCliLoggerSetting(setting: boolean): Promise<void> {
        await SettingsConfig.setDirectValue("zowe.cliLoggerSetting.presented", setting, vscode.ConfigurationTarget.Global);
    }

    private static async updateLoggerSetting(cliSetting: string): Promise<void> {
        const updateLoggerButton = localize("ZoweLogger.updateLoggerSetting.update", "Update");
        const message = localize(
            "ZoweLogger.updateLoggerSetting.message",
            // eslint-disable-next-line max-len
            "Zowe Explorer now has a VS Code logger with a default log level of INFO.\nIt looks like the Zowe CLI's ZOWE_APP_LOG_LEVEL={0}.\nWould you like Zowe Explorer to update to the the same log level?",
            cliSetting
        );
        await Gui.infoMessage(message, {
            items: [updateLoggerButton],
            vsCodeOpts: { modal: true },
        }).then(async (selection) => {
            if (selection === updateLoggerButton) {
                await this.setLogSetting(cliSetting);
            }
            await this.setCliLoggerSetting(true);
        });
    }
}

export function getDate(): string {
    const dateObj = new Date(Date.now());
    const day = ("0" + dateObj.getDate()).slice(-2);
    const month = ("0" + (dateObj.getMonth() + 1)).slice(-2);
    return `${dateObj.getFullYear()}/${month}/${day}`;
}

export function getTime(): string {
    const dateObj = new Date(Date.now());
    return `${dateObj.getHours()}:${dateObj.getMinutes()}:${dateObj.getSeconds()}`;
}
