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
import { InputBoxOptions } from "vscode";

export interface IPromptCredentialsCommonOptions {
    rePrompt?: boolean;
    userInputBoxOptions?: InputBoxOptions;
    passwordInputBoxOptions?: InputBoxOptions;
}

export interface IPromptCredentialsOptions extends IPromptCredentialsCommonOptions {
    sessionName: string;
    sessionType?: string;
    secure?: boolean;
}

export interface IPromptUserPassOptions extends IPromptCredentialsCommonOptions {
    session: imperative.ISession;
}
