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

import { WebviewApi } from "vscode-webview";

export default class PersistentVSCodeAPI {
    private static vscodeAPI = acquireVsCodeApi();

    public static getVSCodeAPI(): WebviewApi<unknown> {
        return this.vscodeAPI;
    }
}
