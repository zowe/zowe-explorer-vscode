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

import * as imperative from "@zowe/imperative";
import { InputBoxOptions, OpenDialogOptions } from "vscode";

export namespace PromptCredentialsOptions {
    export interface CommonOptions {
        rePrompt?: boolean;
        userInputBoxOptions?: InputBoxOptions;
        passwordInputBoxOptions?: InputBoxOptions;
    }

    export interface ComplexOptions extends CommonOptions {
        profile?: imperative.IProfileLoaded;
        sessionName?: string;
        sessionType?: string;
        secure?: boolean;
    }

    export interface UserPassOptions extends CommonOptions {
        session: imperative.ISession;
    }

    export interface CertificateOptions extends UserPassOptions {
        openDialogOptions?: OpenDialogOptions;
        profile?: imperative.IProfileLoaded;
    }
}
