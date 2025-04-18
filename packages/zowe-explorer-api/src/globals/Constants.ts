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

/**
 * Global variables accessed across the API
 */
export namespace Constants {
    export const ZOWE_EXPLORER = "Zowe Explorer";
    export const SCS_ZOWE_PLUGIN = "Zowe-Plugin";
    export const SCS_ZOWE_CLI_V2 = "Zowe";
    export const SCS_BRIGHTSIDE = "@brightside/core";
    export const SCS_ZOWE_CLI = "@zowe/cli";
    export const SCS_BROADCOM_PLUGIN = "Broadcom-Plugin";
    export const SETTINGS_SCS_DEFAULT = SCS_ZOWE_CLI_V2;
    export const CONTEXT_PREFIX = "_";
    export const DEFAULT_PORT = 443;
    export const DOUBLE_CLICK_SPEED_MS = 500;
    export const DEFAULT_ITEMS_PER_PAGE = 100;
    export const PERM_VALUES = {
        r: 4,
        w: 2,
        x: 1,
    };
}
