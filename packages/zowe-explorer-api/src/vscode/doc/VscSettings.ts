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
import * as imperative from "@zowe/imperative";

export class VscSettings {
    /**
     * Retrieves a generic setting either in user or workspace.
     * @param {string} key - The config property that needs retrieving
     * @param {T} defaultValue - Default value if config property is undefined
     */
    public static getDirectValue<T>(key: string, defaultValue?: T): T {
        const [first, ...rest] = key.split(".");
        return vscode.workspace.getConfiguration(first).get(rest.join("."), defaultValue);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    public static getVsCodeProxySettings(): imperative.ProxyVariables {
        const proxySupport = this.getDirectValue("http.proxySupport");
        if (proxySupport !== "on") {
            return;
        }
        const http_proxy: string = this.getDirectValue("http.proxy");
        const no_proxy: string[] = this.getDirectValue("http.noProxy");
        const proxy_strict_ssl: boolean = this.getDirectValue("http.proxyStrictSSL");
        const proxy_authorization: string = this.getDirectValue("http.proxyAuthorization");

        return {
            http_proxy,
            https_proxy: http_proxy,
            no_proxy,
            proxy_authorization,
            proxy_strict_ssl,
        };
    }
}
