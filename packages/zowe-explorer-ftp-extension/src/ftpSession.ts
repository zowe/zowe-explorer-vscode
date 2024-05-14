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

import { zosNodeAccessor } from "@zowe/zos-ftp-for-zowe-cli";
import { imperative } from "@zowe/zowe-explorer-api";

export class FtpSession extends imperative.Session {
    public ussListConnection: zosNodeAccessor.ZosAccessor;
    public mvsListConnection: zosNodeAccessor.ZosAccessor;
    public jesListConnection: zosNodeAccessor.ZosAccessor;
    public constructor(newSession: imperative.ISession) {
        super(newSession);
    }

    public releaseConnections(): void {
        if (this.ussListConnection) {
            void this.ussListConnection.close();
            this.ussListConnection = undefined;
        }
        if (this.mvsListConnection) {
            void this.mvsListConnection.close();
            this.mvsListConnection = undefined;
        }

        if (this.jesListConnection) {
            void this.jesListConnection.close();
            this.jesListConnection = undefined;
        }
    }
}
