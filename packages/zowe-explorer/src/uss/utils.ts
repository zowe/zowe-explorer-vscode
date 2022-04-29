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

// tslint:disable-next-line: no-duplicate-imports
import { ZoweUSSNode } from "../uss/ZoweUSSNode";

/**
 * Injects extra data to tooltip based on node status and other conditions
 * @param node
 * @param tooltip
 * @returns {string}
 */
export function injectAdditionalDataToTooltip(node: ZoweUSSNode, tooltip: string) {
    if (node.downloaded && node.downloadedTime) {
        // TODO: Add time formatter to localization so we will use not just US variant
        return `${tooltip} (Downloaded: ${new Date(node.downloadedTime)
            .toISOString()
            .replace(/(\d{4})-(\d{2})-(\d{2})T((\d{2}):(\d{2}):([^Z]+))Z/, "$5:$6 $2/$3/$1")})`;
    }

    return tooltip;
}
