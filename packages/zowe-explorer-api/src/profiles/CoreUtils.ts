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

import { getZoweDir } from "@zowe/cli";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

declare const __webpack_require__: typeof require;
declare const __non_webpack_require__: typeof require;

/**
 * function to check if imperative.json contains
 * information about security or not and then
 * Imports the neccesary security modules
 */
export function getSecurityModules(moduleName: string, isTheia: boolean): NodeRequire | undefined {
    let imperativeIsSecure = false;
    const r = typeof __webpack_require__ === "function" ? __non_webpack_require__ : require;
    try {
        const fileName = path.join(getZoweDir(), "settings", "imperative.json");
        let settings: any;
        if (fs.existsSync(fileName)) {
            settings = JSON.parse(fs.readFileSync(fileName, "utf8")) as Record<string, unknown>;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const baseValue = settings.overrides as Record<string, unknown>;
        const value1 = baseValue.CredentialManager;
        const value2 = baseValue["credential-manager"];
        imperativeIsSecure =
            (typeof value1 === "string" && value1.length > 0) || (typeof value2 === "string" && value2.length > 0);
    } catch (error) {
        return undefined;
    }
    if (imperativeIsSecure) {
        // Workaround for Theia issue (https://github.com/eclipse-theia/theia/issues/4935)
        const appRoot = isTheia ? process.cwd() : vscode.env.appRoot;
        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return r(`${appRoot}/node_modules/${moduleName}`);
        } catch (err) {
            /* Do nothing */
        }
        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return r(`${appRoot}/node_modules.asar/${moduleName}`);
        } catch (err) {
            /* Do nothing */
        }
    }
    return undefined;
}
