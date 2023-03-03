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

import { Gui } from "@zowe/zowe-explorer-api";
import * as vscode from "vscode";
import * as nls from "vscode-nls";
import * as globals from "../globals";

// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

export class ZoweLogger {
    private static zoweExplOutput: vscode.OutputChannel;

    public static async initializeZoweLogger(context: vscode.ExtensionContext): Promise<void> {
        try {
            globals.initLogger(context);
            this.initOutputLogger();
            globals.LOG.debug(localize("initialize.log.debug", "Initialized logger from VSCode extension"));
            const packageInfo = context.extension.packageJSON;
            this.zoweExplOutput.appendLine(`${packageInfo.displayName} ${packageInfo.version}`);
            this.zoweExplOutput.appendLine(localize("initialize.log.debug", "Initialized logger from VSCode extension"));
        } catch (err) {
            globals.LOG.error(err);
            const errorMessage = localize("initialize.log.error", "Error encountered while activating and initializing logger! ");
            await Gui.errorMessage(`${errorMessage}: ${err?.message}`);
        }
    }

    public static async logInfo(message: string): Promise<void> {
        globals.LOG.info(message);
        this.zoweExplOutput.appendLine(message);
    }

    public static async logError(error: any): Promise<void> {
        globals.LOG.error(error);
        this.zoweExplOutput.appendLine(error);
    }

    public static async logDebug(message: string): Promise<void> {
        globals.LOG.debug(message);
        this.zoweExplOutput.appendLine(message);
    }

    public static disposeOutputLogger(): void {
        this.zoweExplOutput.dispose();
    }

    private static initOutputLogger(): void {
        this.zoweExplOutput = Gui.createOutputChannel(localize("zoweExplorer.outputchannel.title", "Zowe Explorer"));
        this.zoweExplOutput.show();
        this.zoweExplOutput.appendLine(`${new Date()}`);
    }

    private static getDate(): string {
        const dateObj = new Date(Date.now());
        const day = ("0" + dateObj.getDate()).slice(-2);
        const month = ("0" + (dateObj.getMonth() + 1)).slice(-2);
        return `${dateObj.getFullYear()}-${month}-${day}`;
    }

    private static getTime(): string {
        const dateObj = new Date(Date.now());
        return `${dateObj.getHours()}:${dateObj.getMinutes()}:${dateObj.getSeconds()}`;
    }
}
