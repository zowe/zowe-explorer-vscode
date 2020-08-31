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

import { IProfileLoaded, Logger } from "@zowe/imperative";

export class DefaultProfileManager {
    public static async createInstance(log: Logger): Promise<DefaultProfileManager> {
        DefaultProfileManager.loader = new DefaultProfileManager(log);
        return DefaultProfileManager.loader;
    }

    public static getInstance(): DefaultProfileManager { return DefaultProfileManager.loader; }

    private static loader: DefaultProfileManager;

    public defaultProfileByType = new Map<string, IProfileLoaded>();
    private constructor(private log: Logger) {}

    public getDefaultProfile(type: string): IProfileLoaded { return this.defaultProfileByType.get(type); }

    public setDefaultProfile(type: string, profile: IProfileLoaded) { this.defaultProfileByType.set(type, profile); }
}
