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

import * as imperative from "@zowe/imperative";
import { Types } from "../../Types";
import { ProfilesCache } from "../../profiles";

// TODO Add jsdoc to interface properties
export interface BaseProfileAuthOptions {
    serviceProfile: string | imperative.IProfileLoaded;
    defaultTokenType?: string;
    preferBaseToken?: boolean;
    profileNode?: Types.IZoweNodeType;
    zeProfiles?: ProfilesCache;
    zeRegister?: Types.IApiRegisterClient;
}
