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

import { ZoweLogger } from "./extension";

export class ZoweFtpExtensionError extends Error {
    public constructor(message: string) {
        super(ZoweLogger.getExtensionName() + ": " + message);
    }

    // The error message appears two times in error dialog, for example:
    // Zowe Explorer FTP Extension: No spool files were available.
    // Error: Zowe Explorer FTP Extension: No spool files were available.
    //
    // Solve it using toString to return ""
    //
    // result:
    // Zowe Explorer FTP Extension: No spool files were available.

    // In ProfilesUtiils.ts, the message of checking profile will be override by toString(),
    // so remain them in this toString() function.
    public toString(): string {
        if (this.message.indexOf("Invalid Credentials")) {
            return this.message.toString();
        } else {
            return "";
        }
    }
}
