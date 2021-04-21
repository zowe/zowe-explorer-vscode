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

import { IProfAttrs, IProfile, ProfileInfo } from "@zowe/imperative";

export class ProfilesConfig {
    public static getMergedAttrs(mProfileInfo: ProfileInfo, profAttrs: IProfAttrs): IProfile {
        const profile: IProfile = {};
        if (profAttrs != null) {
            const mergedArgs = mProfileInfo.mergeArgsForProfile(profAttrs);

            for (const arg of mergedArgs.knownArgs) {
                profile[arg.argName] = arg.secure ? mProfileInfo.loadSecureArg(arg) : arg.argValue;
            }
        }
        return profile;
    }
}
