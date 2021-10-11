/*
 * This program and the accompanying materials are made available under the terms of the *
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at *
 * https://www.eclipse.org/legal/epl-v20.html                                      *
 *                                                                                 *
 * SPDX-License-Identifier: EPL-2.0                                                *
 *                                                                                 *
 * Copyright Contributors to the Zowe Project.                                     *
 *                                                                                 *
 */

import * as semver from "semver";
import * as vscode from "vscode";
import { ZoweExplorerApi } from "../profiles";
import { IZoweLogger, MessageSeverityEnum } from "../logger/IZoweLogger";

/**
 * Collection of utility functions for writing Zowe Explorer VS Code extensions.
 */
export class ZoweVsCodeExtension {
    /**
     * @param {string} [requiredVersion] Optional semver string specifying the minimal required version
     *           of Zowe Explorer that needs to be installed for the API to be usable to the client.
     * @returns an initialized instance `ZoweExplorerApi.IApiRegisterClient` that extenders can use
     *          to access the Zowe Explorer APIs or `undefined`. Also `undefined` if requiredVersion
     *          is larger than the version of Zowe Explorer found.
     */
    public static getZoweExplorerApi(requiredVersion?: string): ZoweExplorerApi.IApiRegisterClient {
        const zoweExplorerApi = vscode.extensions.getExtension("Zowe.vscode-extension-for-zowe");
        if (zoweExplorerApi?.exports) {
            const zoweExplorerVersion =
                ((zoweExplorerApi.packageJSON as Record<string, unknown>).version as string) || "15.0.0";
            if (requiredVersion && semver.valid(requiredVersion) && !semver.gte(zoweExplorerVersion, requiredVersion)) {
                return undefined;
            }
            return zoweExplorerApi.exports as ZoweExplorerApi.IApiRegisterClient;
        }
        return undefined;
    }

    /**
     * Reveal an error in VSCode, and log the error to the Imperative log
     *
     */
    public static showVsCodeMessage(message: string, severity: MessageSeverityEnum, logger: IZoweLogger): void {
        logger.logImperativeMessage(message, severity);

        if (severity < 3) {
            const errorMessage = `${logger.getExtensionName()} info: ${message}`;
            void vscode.window.showInformationMessage(errorMessage);
        } else {
            const errorMessage = `${logger.getExtensionName()} error: ${message}`;
            void vscode.window.showErrorMessage(errorMessage);
        }
    }
}
