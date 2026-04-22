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

import { ErrorCorrelator, ZoweExplorerApiType } from "@zowe/zowe-explorer-api";
import { SshErrors } from "zowex-sdk";

/**
 * Registers all SSH-specific error correlations with the Zowe Explorer ErrorCorrelator
 */
export function registerSshErrorCorrelations(): void {
    const errorCorrelator = ErrorCorrelator.getInstance();
    if (!errorCorrelator) {
        return;
    }

    for (const errorCode in SshErrors) {
        const errorDef = SshErrors[errorCode];
        errorCorrelator.addCorrelation(ZoweExplorerApiType.All, "ssh", {
            errorCode,
            matches: errorDef.matches,
            summary: errorDef.summary,
            tips: errorDef.tips,
            resources: errorDef.resources,
        });
    }
}
