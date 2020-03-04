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

class Cache {
    private static instance;
    private uss = {
        ignoreDownloadSizeCheck: false
    };

    constructor() {
        if (!Cache.instance) {
            Cache.instance = this;
        }

        return Cache.instance;
    }

    public get ignoreUSSDownloadCheck(): boolean {
        return this.uss.ignoreDownloadSizeCheck;
    }

    public set ignoreUSSDownloadCheck(value: boolean) {
        this.uss.ignoreDownloadSizeCheck = value;
    }
}

export default new Cache();
