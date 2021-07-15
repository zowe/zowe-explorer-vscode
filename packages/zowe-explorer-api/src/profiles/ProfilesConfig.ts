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

import { IProfileLoaded, Logger, IProfAttrs, IProfile, ProfileInfo } from "@zowe/imperative";

export interface IProfileValidationConfig {
    status: string;
    name: string;
}

export interface IValidationSettingConfig {
    name: string;
    setting: boolean;
}
export class ProfilesConfig {
    public profilesForValidation: IProfileValidationConfig[] = [];
    public profilesValidationSetting: IValidationSettingConfig[] = [];
    public allProfiles: IProfileLoaded[] = [];
    protected allTypes: string[];
    protected profilesByType = new Map<string, IProfileLoaded[]>();
    protected defaultProfileByType = new Map<string, IProfileLoaded>();
    public constructor(protected log: Logger) {}

    public static createInstance(mProfileInfo: ProfileInfo): ProfileInfo {
        return (ProfilesConfig.info = mProfileInfo);
    }

    public static getInstance(): ProfileInfo {
        return ProfilesConfig.info;
    }

    private static info: ProfileInfo;

    public static getMergedAttrs(mProfileInfo: ProfileInfo, profAttrs: IProfAttrs): IProfile {
        const profile: IProfile = {};
        if (profAttrs != null) {
            const mergedArgs = mProfileInfo.mergeArgsForProfile(profAttrs, { getSecureVals: true });

            for (const arg of mergedArgs.knownArgs) {
                profile[arg.argName] = arg.argValue;
            }
        }
        return profile;
    }

    public static getDefaultProfile(mProfileInfo: ProfileInfo, profileType: string): IProfAttrs {
        return mProfileInfo.getDefaultProfile(profileType);
    }
}
