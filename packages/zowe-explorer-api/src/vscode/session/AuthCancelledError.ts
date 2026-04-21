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

import * as vscode from "vscode";

/**
 * Error thrown when the user cancels an authentication prompt.
 * This allows extenders to distinguish between authentication failures and user cancellation.
 * Extends FileSystemError to be compliant with VS Code's filesystem API expectations.
 */
export class AuthCancelledError extends vscode.FileSystemError {
    public readonly profileName: string;

    public constructor(profileName: string, message?: string) {
        super(message ?? `Authentication cancelled for profile: ${profileName}`);
        this.name = "AuthCancelledError";
        this.profileName = profileName;
    }
}
