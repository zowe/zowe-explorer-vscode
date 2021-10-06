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

import * as imperative from "@zowe/imperative";
import * as vscode from "vscode";
import { ProfilesCache } from "../profiles";
import { KeytarCredentialManager } from "./KeytarCredentialManager";
import * as globals from "../../../zowe-explorer/src/globals";

export class KeytarApi {
    public constructor(protected log: imperative.Logger) {}

    public async activateKeytar(initialized: boolean, isTheia: boolean): Promise<void> {
        const log = imperative.Logger.getAppLogger();
        const profiles = new ProfilesCache(log);
        const scsActive = profiles.isSecureCredentialPluginActive();
        if (scsActive) {
            const keytar: NodeRequire | undefined = KeytarCredentialManager.getSecurityModules("keytar", isTheia);
            if (!initialized && keytar) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                KeytarCredentialManager.keytar = keytar;
                const service: string = vscode.workspace
                    .getConfiguration()
                    .get(globals.SETTINGS_SECURITY_CREDENTIAL_PLUGIN);
                await imperative.CredentialManagerFactory.initialize({
                    service: service || "Zowe-Plugin",
                    Manager: KeytarCredentialManager,
                    displayName: "Zowe Explorer",
                });
            }
        }
    }
}
