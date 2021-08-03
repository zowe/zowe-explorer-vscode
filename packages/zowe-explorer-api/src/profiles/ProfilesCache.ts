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

import * as imperative from "@zowe/imperative";
import { ZoweExplorerApi } from "./ZoweExplorerApi";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { URL } from "url";

// TODO: find a home for constants
export const CONTEXT_PREFIX = "_";
export const DEFAULT_PORT = 443;

export interface IUrlValidator {
    valid: boolean;
    protocol: string;
    host: string;
    port: number;
}

export interface IProfileValidation {
    status: string;
    name: string;
}

export interface IValidationSetting {
    name: string;
    setting: boolean;
}

export enum ValidProfileEnum {
    UNVERIFIED = 1,
    VALID = 0,
    INVALID = -1,
}

export class ProfilesCache {
    public profilesForValidation: IProfileValidation[] = [];
    public profilesValidationSetting: IValidationSetting[] = [];
    public allProfiles: imperative.IProfileLoaded[] = [];
    protected allTypes: string[];
    protected profilesByType = new Map<string, imperative.IProfileLoaded[]>();
    protected defaultProfileByType = new Map<string, imperative.IProfileLoaded>();
    protected profileManagerByType = new Map<string, imperative.CliProfileManager>();
    public constructor(protected log: imperative.Logger) {}

    public static createConfigInstance(mProfileInfo: imperative.ProfileInfo): imperative.ProfileInfo {
        return (ProfilesCache.info = mProfileInfo);
    }

    public static getConfigInstance(): imperative.ProfileInfo {
        return ProfilesCache.info;
    }

    private static info: imperative.ProfileInfo;

    public loadNamedProfile(name: string, type?: string): imperative.IProfileLoaded {
        for (const profile of this.allProfiles) {
            if (profile.name === name && (type ? profile.type === type : true)) {
                return profile;
            }
        }
        throw new Error("Could not find profile named: " + name + ".");
    }

    public getDefaultProfile(type = "zosmf"): imperative.IProfileLoaded {
        return this.defaultProfileByType.get(type);
    }

    public getDefaultConfigProfile(mProfileInfo: imperative.ProfileInfo, profileType: string): imperative.IProfAttrs {
        return mProfileInfo.getDefaultProfile(profileType);
    }

    public getProfiles(type = "zosmf"): imperative.IProfileLoaded[] {
        return this.profilesByType.get(type);
    }

    public async refresh(apiRegister?: ZoweExplorerApi.IApiRegisterClient): Promise<void> {
        const mProfileInfo = ProfilesCache.getConfigInstance();
        if (mProfileInfo.usingTeamConfig) {
            await this.refreshConfig(apiRegister);
        } else {
            this.allProfiles = [];
            this.allTypes = [];
            // TODO: Add Base ProfileType in registeredApiTypes
            // This process retrieves the base profile if there's any and stores it in an array
            // If base is added in registeredApiType maybe this process can be removed
            try {
                const profileManagerA = this.getCliProfileManager("base");
                if (profileManagerA) {
                    try {
                        const baseProfile = await profileManagerA.load({ loadDefault: true });
                        this.allProfiles.push(baseProfile);
                    } catch (error) {
                        if (!error?.message?.includes(`No default profile set for type "base"`)) {
                            this.log.error(error);
                        }
                    }
                }
            } catch (error) {
                this.log.error(error);
            }
            for (const type of apiRegister.registeredApiTypes()) {
                const profileManager = this.getCliProfileManager(type);
                const profilesForType = (await profileManager.loadAll()).filter((profile) => {
                    return profile.type === type;
                });
                if (profilesForType && profilesForType.length > 0) {
                    this.allProfiles.push(...profilesForType);
                    this.profilesByType.set(type, profilesForType);
                    let defaultProfile: imperative.IProfileLoaded;
                    try {
                        defaultProfile = await profileManager.load({ loadDefault: true });
                    } catch (error) {
                        this.log.error(error);
                    }
                    this.defaultProfileByType.set(type, defaultProfile);
                }
                // This is in the loop because I need an instantiated profile manager config
                if (profileManager.configurations && this.allTypes.length === 0) {
                    for (const element of profileManager.configurations) {
                        this.allTypes.push(element.type);
                    }
                }
            }
        }
        while (this.profilesForValidation.length > 0) {
            this.profilesForValidation.pop();
        }
    }

    public validateAndParseUrl(newUrl: string): IUrlValidator {
        let url: URL;

        const validationResult: IUrlValidator = {
            valid: false,
            protocol: null,
            host: null,
            port: null,
        };

        try {
            url = new URL(newUrl);
        } catch (error) {
            return validationResult;
        }

        if (newUrl.includes(":443")) {
            validationResult.port = 443;
        } else {
            validationResult.port = Number(url.port);
        }

        validationResult.host = url.hostname;
        validationResult.valid = true;
        return validationResult;
    }

    public getSchema(profileType: string): Record<string, unknown> {
        const profileManager = this.getCliProfileManager(profileType);
        const configOptions = Array.from(profileManager.configurations);
        let schema = {};
        for (const val of configOptions) {
            if (val.type === profileType) {
                schema = val.schema.properties;
            }
        }
        return schema;
    }

    public getAllTypes(): string[] {
        return this.allTypes;
    }

    public async getNamesForType(type: string): Promise<string[]> {
        const profileManager = this.getCliProfileManager(type);
        const profilesForType = (await profileManager.loadAll()).filter((profile) => {
            return profile.type === type;
        });
        return profilesForType.map((profile) => {
            return profile.name;
        });
    }

    public async directLoad(type: string, name: string): Promise<imperative.IProfileLoaded> {
        let directProfile: imperative.IProfileLoaded;
        const profileManager = this.getCliProfileManager(type);
        if (profileManager) {
            directProfile = await profileManager.load({ name });
        }
        return directProfile;
    }

    public getCliProfileManager(type: string): imperative.CliProfileManager {
        let profileManager = this.profileManagerByType.get(type);
        if (!profileManager) {
            try {
                profileManager = new imperative.CliProfileManager({
                    profileRootDirectory: path.join(this.getZoweDir(), "profiles"),
                    type,
                });
            } catch (error) {
                this.log.debug(error);
            }
            if (profileManager) {
                this.profileManagerByType.set(type, profileManager);
            } else {
                return undefined;
            }
        }
        return profileManager;
    }

    public getBaseProfile(): imperative.IProfileLoaded {
        let baseProfile: imperative.IProfileLoaded;

        // This functionality will retrieve the saved base profile in the allProfiles array
        for (const baseP of this.allProfiles) {
            if (baseP.type === "base") {
                baseProfile = baseP;
            }
        }
        return baseProfile;
    }

    public isSecureCredentialPluginActive(): boolean {
        let imperativeIsSecure = false;
        try {
            const fileName = path.join(this.getZoweDir(), "settings", "imperative.json");
            let settings: Record<string, unknown>;
            if (fs.existsSync(fileName)) {
                settings = JSON.parse(fs.readFileSync(fileName, "utf-8")) as Record<string, unknown>;
            }
            if (settings) {
                const baseValue = settings.overrides as Record<string, unknown>;
                const value1 = baseValue.CredentialManager;
                const value2 = baseValue["credential-manager"];
                imperativeIsSecure =
                    (typeof value1 === "string" && value1.length > 0) ||
                    (typeof value2 === "string" && value2.length > 0);
            }
        } catch (error) {
            this.log.error(error);
        }
        return imperativeIsSecure;
    }

    protected async deleteProfileOnDisk(ProfileInfo: imperative.IProfileLoaded): Promise<void> {
        await this.getCliProfileManager(ProfileInfo.type).delete({
            profile: ProfileInfo,
            name: ProfileInfo.name,
            type: ProfileInfo.type,
        });
    }

    protected async saveProfile(
        profileInfo: Record<string, unknown>,
        profileName: string,
        profileType: string
    ): Promise<imperative.IProfile> {
        const newProfile = await this.getCliProfileManager(profileType).save({
            profile: profileInfo,
            name: profileName,
            type: profileType,
            overwrite: true,
        });
        return newProfile.profile;
    }

    protected async refreshConfig(apiRegister: ZoweExplorerApi.IApiRegisterClient): Promise<void> {
        this.allProfiles = [];
        let tmpAllProfiles = [];
        this.allTypes = [];
        const mProfileInfo = ProfilesCache.getConfigInstance();
        for (const type of apiRegister.registeredApiTypes()) {
            // Step 1: Get all profiles for each registered type
            const profilesForType = mProfileInfo.getAllProfiles(type);
            if (profilesForType && profilesForType.length > 0) {
                for (const prof of profilesForType) {
                    // Step 2: Merge args for each profile
                    const profAttr = await this.getMergedAttrs(mProfileInfo, prof);
                    // Work-around. TODO: Discuss with imperative team
                    const profileFix: imperative.IProfileLoaded = {
                        message: "",
                        name: prof.profName,
                        type: prof.profType,
                        profile: profAttr,
                        failNotFound: false,
                    };
                    // Step 3: Update allProfiles list
                    this.allProfiles.push(profileFix);
                    tmpAllProfiles.push(profileFix);
                }
                this.profilesByType.set(type, tmpAllProfiles);
                tmpAllProfiles = [];
                const defaultProfAttr = this.getDefaultConfigProfile(mProfileInfo, type);
                const defaultProfile: imperative.IProfileLoaded = {
                    message: "",
                    name: defaultProfAttr.profName,
                    type: defaultProfAttr.profType,
                    profile: defaultProfAttr,
                    failNotFound: false,
                };
                this.defaultProfileByType.set(type, defaultProfile);
            }
            this.allTypes.push(type);
        }
    }

    protected async getMergedAttrs(
        mProfileInfo: imperative.ProfileInfo,
        profAttrs: imperative.IProfAttrs
    ): Promise<imperative.IProfile> {
        const profile: imperative.IProfile = {};
        if (profAttrs != null) {
            const mergedArgs = mProfileInfo.mergeArgsForProfile(profAttrs);

            for (const arg of mergedArgs.knownArgs) {
                profile[arg.argName] = arg.secure ? await mProfileInfo.loadSecureArg(arg) : arg.argValue;
            }
        }
        return profile;
    }

    /**
     * Function to retrieve the home directory. In the situation Imperative has
     * not initialized it we mock a default value.
     */
    private getZoweDir(): string {
        imperative.ImperativeConfig.instance.loadedConfig = {
            defaultHome: path.join(os.homedir(), ".zowe"),
            envVariablePrefix: "ZOWE",
        };
        return imperative.ImperativeConfig.instance.cliHome;
    }
}
