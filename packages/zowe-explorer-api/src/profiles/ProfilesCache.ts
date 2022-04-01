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

import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { URL } from "url";

import * as imperative from "@zowe/imperative";
import * as zowe from "@zowe/cli";
import { ZoweExplorerApi } from "./ZoweExplorerApi";

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

export function getZoweDir(): string {
    return zowe.getZoweDir();
}

export class ProfilesCache {
    public profilesForValidation: IProfileValidation[] = [];
    public profilesValidationSetting: IValidationSetting[] = [];
    public allProfiles: imperative.IProfileLoaded[] = [];
    protected allTypes: string[];
    protected allExternalTypes = new Set<string>();
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
        throw new Error(`Zowe Explorer Profiles Cache error: Could not find profile named: ${name}.`);
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

    public registerCustomProfilesType(profileTypeName: string): void {
        const exists = fs.existsSync(path.posix.join(`${os.homedir()}/.zowe/profiles/${profileTypeName}`));
        if (!exists) {
            throw new Error(
                `Zowe Explorer Profiles Cache error: Tried to register a custom profile type named: ${profileTypeName} that does not yet exist. Extenders must call "zoweExplorerApi.getExplorerExtenderApi().initForZowe()" first.`
            );
        }
        this.allExternalTypes.add(profileTypeName);
    }

    public async refresh(apiRegister?: ZoweExplorerApi.IApiRegisterClient): Promise<void> {
        if (ProfilesCache.getConfigInstance().usingTeamConfig) {
            await this.refreshConfig(apiRegister);
        } else {
            await this.refreshOldStyleProfs(apiRegister);
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

    public getProfileFromConfig(profileName: string): imperative.IProfAttrs {
        const configAllProfiles = ProfilesCache.getConfigInstance()
            .getAllProfiles()
            .filter((temp) => temp.profLoc.osLoc.length !== 0);
        const currentProfile = configAllProfiles.filter((temprofile) => temprofile.profName === profileName)[0];
        return currentProfile;
    }

    public getLoadedProfConfig(profileName: string): imperative.IProfileLoaded {
        const configAllProfiles = ProfilesCache.getConfigInstance()
            .getAllProfiles()
            .filter((temp) => temp.profLoc.osLoc.length !== 0);
        const currentProfile = configAllProfiles.filter((temprofile) => temprofile.profName === profileName.trim())[0];
        const mergedArgs = ProfilesCache.getConfigInstance().mergeArgsForProfile(currentProfile);
        const profile: imperative.IProfile = {};
        for (const arg of mergedArgs.knownArgs) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            profile[arg.argName] = arg.secure ? ProfilesCache.getConfigInstance().loadSecureArg(arg) : arg.argValue;
        }
        return this.getProfileLoaded(currentProfile.profName, currentProfile.profType, profile);
    }

    public getCliProfileManager(type: string): imperative.CliProfileManager {
        let profileManager = this.profileManagerByType.get(type);
        if (!profileManager) {
            try {
                profileManager = new imperative.CliProfileManager({
                    profileRootDirectory: path.join(getZoweDir(), "profiles"),
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
            const fileName = path.join(getZoweDir(), "settings", "imperative.json");
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

    public getProfileLoaded(
        profileName: string,
        profileType: string,
        profile: imperative.IProfile
    ): imperative.IProfileLoaded {
        return {
            message: "",
            name: profileName,
            type: profileType,
            profile: profile,
            failNotFound: false,
        };
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

    protected async refreshOldStyleProfs(apiRegister: ZoweExplorerApi.IApiRegisterClient): Promise<void> {
        let mergedProfilesOfType: imperative.IProfileLoaded[] = [];
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
        const allTypes = this.getAllProfileTypes(apiRegister.registeredApiTypes());
        for (const type of allTypes) {
            const profileManager = this.getCliProfileManager(type);
            const profilesForType = (await profileManager.loadAll()).filter((profile) => {
                return profile.type === type;
            });
            if (profilesForType && profilesForType.length > 0) {
                if (type !== "base") {
                    let mergedProfile: imperative.IProfileLoaded;
                    for (const profile of profilesForType) {
                        mergedProfile = await this.mergeOldStyleProfile(profile);
                        mergedProfilesOfType.push(mergedProfile);
                    }
                }
                this.allProfiles.push(...mergedProfilesOfType);
                this.profilesByType.set(type, mergedProfilesOfType);
                let defaultProfile: imperative.IProfileLoaded;
                mergedProfilesOfType = [];
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

    // combine v1 profiles
    // eslint-disable-next-line complexity
    protected async mergeOldStyleProfile(
        serviceProfile: imperative.IProfileLoaded
    ): Promise<imperative.IProfileLoaded> {
        // TODO: This needs to be improved
        // The idea is to handle all type of ZE Profiles

        // This check will handle service profiles that have username and password
        if (serviceProfile.profile.user && serviceProfile.profile.password) {
            return serviceProfile;
        }

        let baseProfile: imperative.IProfileLoaded | undefined;
        const cliProfileManager = this.getCliProfileManager("base");
        try {
            baseProfile = await cliProfileManager.load({ loadDefault: true });
        } catch (error) {
            baseProfile = undefined;
        }

        // This check is for optional credentials
        if (
            baseProfile &&
            serviceProfile.profile.host &&
            serviceProfile.profile.port &&
            ((baseProfile.profile.host !== serviceProfile.profile.host &&
                baseProfile.profile.port !== serviceProfile.profile.port) ||
                (baseProfile.profile.host === serviceProfile.profile.host &&
                    baseProfile.profile.port !== serviceProfile.profile.port))
        ) {
            return serviceProfile;
        }
        // This process combines the information from baseprofile to serviceprofile and create a new profile
        const profSchema = this.getSchema(serviceProfile.type);
        const mergedProfile = serviceProfile;
        if (baseProfile?.profile && mergedProfile?.profile) {
            for (const prop of Object.keys(profSchema)) {
                mergedProfile.profile[prop] = (serviceProfile.profile[prop] ?? baseProfile.profile[prop]) as unknown;
            }
            mergedProfile.profile.tokenType = (serviceProfile.profile.tokenType ??
                baseProfile.profile.tokenType) as string;
            mergedProfile.profile.tokenValue = (serviceProfile.profile.tokenValue ??
                baseProfile.profile.tokenValue) as string;
        }
        return mergedProfile;
    }

    protected async refreshConfig(apiRegister: ZoweExplorerApi.IApiRegisterClient): Promise<void> {
        this.allProfiles = [];
        let tmpAllProfiles: imperative.IProfileLoaded[] = [];
        this.allTypes = [];
        const mProfileInfo = ProfilesCache.getConfigInstance();
        const allTypes = this.getAllProfileTypes(apiRegister.registeredApiTypes());
        allTypes.push("base");
        for (const type of allTypes) {
            // Step 1: Get all profiles for each registered type
            const profilesForType = mProfileInfo.getAllProfiles(type).filter((temp) => temp.profLoc.osLoc.length !== 0);
            if (profilesForType && profilesForType.length > 0) {
                for (const prof of profilesForType) {
                    // Step 2: Merge args for each profile
                    const profAttr = await this.getMergedAttrs(mProfileInfo, prof);
                    // Work-around. TODO: Discuss with imperative team
                    const profileFix = this.getProfileLoaded(prof.profName, prof.profType, profAttr);
                    // set default for type
                    if (prof.isDefaultProfile) {
                        this.defaultProfileByType.set(type, profileFix);
                    }

                    // Step 3: Update allProfiles list
                    tmpAllProfiles.push(profileFix);
                }
                this.allProfiles.push(...tmpAllProfiles);
                this.profilesByType.set(type, tmpAllProfiles);
                tmpAllProfiles = [];
            }
            this.allTypes.push(type);
        }
        // // check for proper merging of apiml tokens
        // this.checkMergingConfig();
    }

    protected checkMergingConfig(): void {
        const baseProfile = this.defaultProfileByType.get("base");
        const allProfiles: imperative.IProfileLoaded[] = [];
        this.allTypes.forEach((type) => {
            try {
                const allProfilesByType: imperative.IProfileLoaded[] = [];
                const profByType = this.profilesByType.get(type);
                profByType.forEach((profile) => {
                    if (
                        (baseProfile?.profile.host !== profile?.profile.host ||
                            baseProfile?.profile.port !== profile?.profile.port) &&
                        profile?.profile.tokenType == "apimlAuthenticationToken"
                    ) {
                        profile.profile.tokenType = undefined;
                        profile.profile.tokenValue = undefined;
                        // update default profile of type if changed
                        if (profile.name === this.defaultProfileByType.get(type).name) {
                            this.defaultProfileByType.set(type, profile);
                        }
                    }
                    allProfiles.push(profile);
                    allProfilesByType.push(profile);
                });
                this.profilesByType.set(type, allProfilesByType);
            } catch (error) {
                // do nothing, skip if profile type is not included in config file
            }
        });
        this.allProfiles = [];
        this.allProfiles.push(...allProfiles);
    }

    protected async getMergedAttrs(
        mProfileInfo: imperative.ProfileInfo,
        profAttrs: imperative.IProfAttrs
    ): Promise<imperative.IProfile> {
        const profile: imperative.IProfile = {};
        if (profAttrs != null) {
            const mergedArgs = mProfileInfo.mergeArgsForProfile(profAttrs);
            for (const arg of mergedArgs.knownArgs) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                profile[arg.argName] = arg.secure ? await mProfileInfo.loadSecureArg(arg) : arg.argValue;
            }
        }
        return profile;
    }

    // create an array that includes registered types from apiRegister.registeredApiTypes()
    // and allExternalTypes
    private getAllProfileTypes(registeredTypes: string[]): string[] {
        const externalTypeArray: string[] = Array.from(this.allExternalTypes);
        const allTypes = registeredTypes.concat(
            externalTypeArray.filter((exType) => registeredTypes.every((type) => type !== exType))
        );
        return allTypes;
    }
}
