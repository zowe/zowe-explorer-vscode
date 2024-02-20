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

export namespace ZosmfSession {
    export function createSessCfgFromArgs(cmdArgs: imperative.ICommandArguments) {
        return {
            user: "fake",
            password: "fake",
            hostname: "fake",
            port: 2,
        };
    }
}

export namespace CheckStatus {
    export function getZosmfInfo(session: imperative.Session) {
        return {
            zos_version: "fake",
            zosmf_port: "fake",
            zosmf_version: "fake",
            zosmf_hostname: "fake",
            zosmf_saf_realm: "fake",
            zosmf_full_version: "fake",
            api_version: "fake",
            plugins: "fake",
        };
    }
}

export const ZosmfProfile = {
    type: "zosmf",
};
