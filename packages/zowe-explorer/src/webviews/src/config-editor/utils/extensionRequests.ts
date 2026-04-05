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

import type { ConfigEditorWebviewApi } from "../handlers/messageHandlers";

/** Requests profile list and env info from the extension host (single logical refresh). */
export function postProfilesAndEnv(vscodeApi: ConfigEditorWebviewApi): void {
    vscodeApi.postMessage({ command: "GET_PROFILES" });
    vscodeApi.postMessage({ command: "GET_ENV_INFORMATION" });
}
