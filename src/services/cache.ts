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

import { ZoweUSSNode } from "../ZoweUSSNode";

class Cache {
    private static instance;
    private uss = {
        ignoreDownloadSizeCheck: [] as string[]
    };

    constructor() {
        if (!Cache.instance) {
            Cache.instance = this;
        }

        return Cache.instance;
    }

    public setIgnoreUSSDownloadCheck(node: ZoweUSSNode, status: boolean) {
        if (status) {
            if (this.uss.ignoreDownloadSizeCheck.indexOf(node.fullPath) === -1) {
                this.uss.ignoreDownloadSizeCheck.push(node.fullPath);
            }
        } else {
            this.uss.ignoreDownloadSizeCheck = this.uss.ignoreDownloadSizeCheck.filter((entry) => entry !== node.fullPath);
        }
    }

    public getIgnoreUSSDownloadCheck(node: ZoweUSSNode): boolean {
        return this.uss.ignoreDownloadSizeCheck.indexOf(node.fullPath) > -1;
    }
}

export default new Cache();
