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

import * as vscode from "vscode";
import { imperative } from "@zowe/cli";
import { ProfilesCache } from "../profiles";
import { KeytarCredentialManager } from "./KeytarCredentialManager";
import * as globals from "../globals";

export class KeytarApi {
    public constructor(protected log: imperative.Logger) {}

    // v1 specific
    public async activateKeytar(initialized: boolean, isTheia: boolean): Promise<void> {
        const log = imperative.Logger.getAppLogger();
        const profiles = new ProfilesCache(log, vscode.workspace.workspaceFolders?.[0]?.uri.fsPath);
        const scsActive = profiles.isSecureCredentialPluginActive();
        if (scsActive) {
            const keytar: NodeRequire | undefined = KeytarCredentialManager.getSecurityModules("keytar", isTheia);
            if (!initialized && keytar) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                KeytarCredentialManager.keytar = keytar;
                await imperative.CredentialManagerFactory.initialize({
                    service: globals.SETTINGS_SCS_DEFAULT,
                    Manager: KeytarCredentialManager,
                    displayName: globals.ZOWE_EXPLORER,
                });
            }
        }
    }
}
