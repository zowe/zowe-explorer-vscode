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

import { ProfilesCache } from "../profiles/ProfilesCache";
import * as imperative from "@zowe/imperative";

/**
 * Node utilities
 *
 * @export
 * @class ZoweNodeUtils
 */
export class ZoweNodeUtils {
    public static getLatestProfile(node: any): imperative.IProfileLoaded {
        const profCache = new ProfilesCache(imperative.Logger.getAppLogger());
        return profCache.loadNamedProfile(node.getProfileName());
    }
}
