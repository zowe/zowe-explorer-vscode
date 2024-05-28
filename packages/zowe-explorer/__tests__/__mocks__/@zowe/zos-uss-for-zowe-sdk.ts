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
import type { ISshSession } from "@zowe/zos-uss-for-zowe-sdk";

export class SshSession {
    public static createSshSessCfgFromArgs(args: imperative.ICommandArguments): ISshSession {
        return {};
    }
}
