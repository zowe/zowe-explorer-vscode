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

/**
 * Interface containing the properties used for centralized auth operations (e.g. login/logout)
 */
export interface BaseProfileAuthOptions {
    /**
     * The service profile used to perform the auth operation
     * If the specified value is a string, we use it as the profile name. Note: Nested profiles are allowed here, e.g. lpar.service.
     * If the specified value is a loaded profile, it should contain all properties already merged by the ProfileInfo APIs
     */
    serviceProfile: string | imperative.IProfileLoaded;

    /**
     * The type of token to use as a fallback whenever a token type cannot be identified from the service, parent, or base profiles
     * For example: "apimlAuthenticationToken"
     */
    defaultTokenType?: string;

    /**
     * Indicates whether the auth operation should give precedence to the base profile in cases where there are conflicts.
     * You may use this only if you need to override the default behavior.
     * For details on the default behavior, see the flowchart in: https://github.com/zowe/zowe-explorer-vscode/issues/2264#issuecomment-2236914511
     */
    preferBaseToken?: boolean;

    /**
     * The node used for this auth operation which will need to be explicitly updated/refresh after a successful auth operation.
     */
    profileNode?: Types.IZoweNodeType;

    /**
     * The instance of the ProfilesCache used to perform a cache refresh after a successful auth operation.
     */
    zeProfiles?: ProfilesCache;

    /**
     * The instance of the API Register from which we will get the auth method provided by extenders (if available).
     */
    zeRegister?: Types.IApiRegisterClient;
}
