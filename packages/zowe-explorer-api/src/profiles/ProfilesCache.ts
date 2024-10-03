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
import type { IRegisterClient } from "../extend/IRegisterClient";
import { FileManagement } from "../utils";
import { Validation } from "./Validation";
import { ZosmfProfile } from "@zowe/zosmf-for-zowe-sdk";
import { ZosTsoProfile } from "@zowe/zos-tso-for-zowe-sdk";
import { ZosUssProfile } from "@zowe/zos-uss-for-zowe-sdk";
import { Types } from "../Types";

export class ProfilesCache {
    public profilesForValidation: Validation.IValidationProfile[] = [];
    public profilesValidationSetting: Validation.IValidationSetting[] = [];
    public allProfiles: imperative.IProfileLoaded[] = [];
    public profileTypeConfigurations: imperative.ICommandProfileTypeConfiguration[] = [];
    protected allTypes: string[] = [];
    protected allExternalTypes = new Set<string>();
    protected profilesByType = new Map<string, imperative.IProfileLoaded[]>();
    protected defaultProfileByType = new Map<string, imperative.IProfileLoaded>();

    public constructor(protected log: imperative.Logger, protected cwd?: string) {
        this.cwd = cwd != null ? FileManagement.getFullPath(cwd) : undefined;
    }

    public static requireKeyring(this: void): NodeModule {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-var-requires
        return require("@zowe/secrets-for-zowe-sdk").keyring;
    }

    public addToConfigArray(extendermetadata: imperative.ICommandProfileTypeConfiguration[]): void {
        extendermetadata?.forEach((item) => {
            const index = this.profileTypeConfigurations.findIndex((ele) => ele.type == item.type);
            if (index !== -1) {
                this.profileTypeConfigurations[index] = item;
            } else {
                this.profileTypeConfigurations.push(item);
            }
        });
    }

    public getConfigArray(): imperative.ICommandProfileTypeConfiguration[] {
        return this.profileTypeConfigurations;
    }

    public async getProfileInfo(_envTheia = false): Promise<imperative.ProfileInfo> {
        const mProfileInfo = new imperative.ProfileInfo("zowe", {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            credMgrOverride: imperative.ProfileCredentials.defaultCredMgrWithKeytar(ProfilesCache.requireKeyring),
        });
        await mProfileInfo.readProfilesFromDisk({ homeDir: FileManagement.getZoweDir(), projectDir: this.cwd ?? undefined });
        return mProfileInfo;
    }

    /**
     * Loads the named profile from allProfiles
     *
     * @param {string} name Name of Profile
     * @param {string} type Type of Profile, optional
     *
     * @returns {IProfileLoaded}
     */
    public loadNamedProfile(name: string, type?: string): imperative.IProfileLoaded {
        for (const profile of this.allProfiles) {
            if (profile.name === name && (!type || profile.type === type)) {
                return profile;
            }
        }
        throw new Error(`Zowe Explorer Profiles Cache error: Could not find profile named: ${name}.`);
    }

    /**
     * Updates profile in allProfiles array and if default updates defaultProfileByType
     * @deprecated Use `updateCachedProfile` instead
     * @param {string} profileLoaded
     * @returns {void}
     */
    public updateProfilesArrays(profileLoaded: imperative.IProfileLoaded): void {
        // update allProfiles array
        const promptedTypeIndex = this.allProfiles.findIndex(
            (profile) => profile?.type === profileLoaded?.type && profile?.name === profileLoaded?.name
        );
        this.allProfiles[promptedTypeIndex] = profileLoaded;
        // checks if default, if true update defaultProfileByType
        const defaultProf = this.defaultProfileByType.get(profileLoaded?.type);
        if (defaultProf?.name === profileLoaded?.name) {
            this.defaultProfileByType.set(profileLoaded?.type, profileLoaded);
        }
    }

    public async updateCachedProfile(
        profileLoaded: imperative.IProfileLoaded,
        profileNode?: Types.IZoweNodeType,
        zeRegister?: Types.IApiRegisterClient
    ): Promise<void> {
        if ((await this.getProfileInfo()).getTeamConfig().properties.autoStore) {
            await this.refresh(zeRegister);
        } else {
            // Note: When autoStore is disabled, nested profiles within this service profile may not have their credentials updated.
            const profIndex = this.allProfiles.findIndex((profile) => profile.type === profileLoaded.type && profile.name === profileLoaded.name);
            this.allProfiles[profIndex].profile = profileLoaded.profile;
            const defaultProf = this.defaultProfileByType.get(profileLoaded.type);
            if (defaultProf != null && defaultProf.name === profileLoaded.name) {
                this.defaultProfileByType.set(profileLoaded.type, profileLoaded);
            }
        }
        profileNode?.setProfileToChoice(profileLoaded);
    }

    /**
     * This returns default profile by type from defaultProfileByType
     *
     * @param {string} type Name of Profile, defaults to "zosmf" if nothing passed.
     *
     * @returns {IProfileLoaded}
     */
    public getDefaultProfile(type = "zosmf"): imperative.IProfileLoaded {
        return this.defaultProfileByType.get(type);
    }

    /**
     * Gets default Profile attributes from imperative
     *
     * @param {ProfileInfo} mProfileInfo
     * @param {string} profileType Type of Profile
     *
     * @returns {IProfAttrs}
     */
    public getDefaultConfigProfile(mProfileInfo: imperative.ProfileInfo, profileType: string): imperative.IProfAttrs {
        return mProfileInfo.getDefaultProfile(profileType);
    }

    /**
     * Gets array of profiles by type
     *
     * @param {string} type Type of Profile, defaults to "zosmf" if nothing passed.
     *
     * @returns {IProfileLoaded[]}
     */
    public getProfiles(type = "zosmf"): imperative.IProfileLoaded[] {
        return this.profilesByType.get(type) ?? [];
    }

    /**
     * Used for extenders to register with Zowe Explorer that do not need their
     * profile type in the existing MVS, USS, and JES
     *
     * @param {string} profileTypeName Type of Profile
     *
     * @returns {void}
     */
    public registerCustomProfilesType(profileTypeName: string): void {
        this.allExternalTypes.add(profileTypeName);
    }

    public async refresh(apiRegister?: IRegisterClient): Promise<void> {
        const allProfiles: imperative.IProfileLoaded[] = [];
        const mProfileInfo = await this.getProfileInfo();
        const allTypes = this.getAllProfileTypes(apiRegister?.registeredApiTypes() ?? []);
        allTypes.push("ssh");
        allTypes.push("base");
        for (const type of allTypes) {
            const tmpAllProfiles: imperative.IProfileLoaded[] = [];
            // Step 1: Get all profiles for each registered type
            const profilesForType = mProfileInfo.getAllProfiles(type).filter((temp) => temp.profLoc.osLoc?.length > 0);
            if (profilesForType && profilesForType.length > 0) {
                for (const prof of profilesForType) {
                    // Step 2: Merge args for each profile
                    const profAttr = this.getMergedAttrs(mProfileInfo, prof);
                    // Work-around. TODO: Discuss with imperative team
                    const profileFix = this.getProfileLoaded(prof.profName, prof.profType, profAttr);
                    // set default for type
                    if (prof.isDefaultProfile) {
                        this.defaultProfileByType.set(type, profileFix);
                    }

                    // Step 3: Update allProfiles list
                    tmpAllProfiles.push(profileFix);
                }
                allProfiles.push(...tmpAllProfiles);
                this.profilesByType.set(type, tmpAllProfiles);
            }
        }
        this.allProfiles = allProfiles;
        this.allTypes = allTypes;
        for (const oldType of [...this.profilesByType.keys()].filter((type) => !allProfiles.some((prof) => prof.type === type))) {
            this.profilesByType.delete(oldType);
            this.defaultProfileByType.delete(oldType);
        }
        // check for proper merging of apiml tokens
        this.checkMergingConfigAllProfiles();
        this.profilesForValidation = [];
    }

    public validateAndParseUrl(newUrl: string): Validation.IValidationUrl {
        let url: URL;

        const validationResult: Validation.IValidationUrl = {
            valid: false,
            protocol: null,
            host: null,
            port: null,
        };

        try {
            url = new URL(newUrl);
        } catch (error) {
            this.log.debug(error as string);
            return validationResult;
        }

        if (newUrl.includes(":443")) {
            validationResult.port = imperative.AbstractSession.DEFAULT_HTTPS_PORT;
        } else {
            validationResult.port = Number(url.port);
        }

        validationResult.protocol = url.protocol.slice(0, -1);
        validationResult.host = url.hostname;
        validationResult.valid = true;
        return validationResult;
    }

    /**
     * get array of profile types
     * @returns string[]
     */
    public getAllTypes(): string[] {
        return this.allTypes;
    }

    /**
     * get array of Profile names by type
     * @param type  profile type
     * @returns string[]
     */
    public async getNamesForType(type: string): Promise<string[]> {
        const mProfileInfo = await this.getProfileInfo();
        const profilesForType = mProfileInfo.getAllProfiles(type);
        return profilesForType.map((profAttrs) => profAttrs.profName);
    }

    /**
     * get array of IProfileLoaded by type
     * @param type profile type
     * @returns IProfileLoaded[]
     */
    public async fetchAllProfilesByType(type: string): Promise<imperative.IProfileLoaded[]> {
        const profByType: imperative.IProfileLoaded[] = [];
        const mProfileInfo = await this.getProfileInfo();
        const profilesForType = mProfileInfo.getAllProfiles(type);
        if (profilesForType && profilesForType.length > 0) {
            for (const prof of profilesForType) {
                const profAttr = this.getMergedAttrs(mProfileInfo, prof);
                let profile = this.getProfileLoaded(prof.profName, prof.profType, profAttr);
                profile = this.checkMergingConfigSingleProfile(profile);
                profByType.push(profile);
            }
        }
        return profByType;
    }

    /**
     * get array of IProfileLoaded for all profiles
     * @returns IProfileLoaded[]
     */
    public async fetchAllProfiles(): Promise<imperative.IProfileLoaded[]> {
        const profiles: imperative.IProfileLoaded[] = [];
        for (const type of this.allTypes) {
            const profsByType = await this.fetchAllProfilesByType(type);
            profiles.push(...profsByType);
        }
        this.allProfiles = profiles;
        return profiles;
    }

    /**
     * Direct load and return of particular IProfileLoaded
     * @param type profile type
     * @param name profile name
     * @returns IProfileLoaded
     */
    public async directLoad(type: string, name: string): Promise<imperative.IProfileLoaded | undefined> {
        const profsOfType = await this.fetchAllProfilesByType(type);
        if (profsOfType && profsOfType.length > 0) {
            for (const profile of profsOfType) {
                if (profile.name === name) {
                    return profile;
                }
            }
        }
    }

    public async getProfileFromConfig(profileName: string, profileType?: string): Promise<imperative.IProfAttrs | undefined> {
        const mProfileInfo = await this.getProfileInfo();
        const configAllProfiles = mProfileInfo.getAllProfiles().filter((prof) => prof.profLoc.osLoc.length !== 0);
        return configAllProfiles.find((prof) => prof.profName === profileName && (!profileType || prof.profType === profileType));
    }

    public async getLoadedProfConfig(profileName: string, profileType?: string): Promise<imperative.IProfileLoaded | undefined> {
        const mProfileInfo = await this.getProfileInfo();
        const currentProfile = await this.getProfileFromConfig(profileName, profileType);
        if (currentProfile == null) {
            return undefined;
        }
        const profile = this.getMergedAttrs(mProfileInfo, currentProfile);
        return this.getProfileLoaded(currentProfile.profName, currentProfile.profType, profile);
    }

    // This will retrieve the saved base profile in the allProfiles array
    public getBaseProfile(): imperative.IProfileLoaded | undefined {
        let baseProfile: imperative.IProfileLoaded;
        for (const baseP of this.allProfiles) {
            if (baseP.type === "base") {
                baseProfile = baseP;
            }
        }
        return baseProfile;
    }

    /**
     * Retrieves the base profile from Imperative to use for log in/out. If a
     * nested profile name is specified (e.g. "lpar.zosmf"), then its parent
     * profile is returned unless token is already stored in the base profile.
     * @param profileName Name of profile that was selected in the tree
     * @returns IProfileLoaded object or undefined if no profile was found
     */
    public async fetchBaseProfile(profileName?: string): Promise<imperative.IProfileLoaded | undefined> {
        const mProfileInfo = await this.getProfileInfo();
        const baseProfileAttrs = mProfileInfo.getDefaultProfile("base");
        const config = mProfileInfo.getTeamConfig();
        if (
            profileName?.includes(".") &&
            (baseProfileAttrs == null || !config.api.secure.securePropsForProfile(baseProfileAttrs.profName).includes("tokenValue"))
        ) {
            // Retrieve parent typeless profile as base profile if:
            // (1) The active profile name is nested (contains a period) AND
            // (2) No default base profile was found OR
            //     Default base profile does not have tokenValue in secure array
            const parentProfile = this.getParentProfileForToken(profileName, config);
            return this.getProfileLoaded(parentProfile, "base", config.api.profiles.get(parentProfile));
        } else if (baseProfileAttrs == null) {
            return undefined;
        }
        const profAttr = this.getMergedAttrs(mProfileInfo, baseProfileAttrs);
        return this.getProfileLoaded(baseProfileAttrs.profName, baseProfileAttrs.profType, profAttr);
    }

    /**
     * This returns true or false depending on if credentials are stored securely.
     *
     * @returns {boolean}
     */
    public async isCredentialsSecured(): Promise<boolean> {
        try {
            return (await this.getProfileInfo()).isSecured();
        } catch (error) {
            this.log.error(error as string);
        }
        return true;
    }

    public getProfileLoaded(profileName: string, profileType: string, profile: imperative.IProfile): imperative.IProfileLoaded {
        return {
            message: "",
            name: profileName,
            type: profileType,
            profile,
            failNotFound: false,
        };
    }

    public static async convertV1ProfToConfig(
        profileInfo: imperative.ProfileInfo,
        deleteV1Profs: boolean = false
    ): Promise<imperative.IConvertV1ProfResult> {
        const convertResult = await imperative.ConvertV1Profiles.convert({ deleteV1Profs, profileInfo });
        return convertResult;
    }

    protected getCoreProfileTypes(): imperative.IProfileTypeConfiguration[] {
        return [ZosmfProfile, ZosTsoProfile, ZosUssProfile];
    }

    // used by refresh to check correct merging of allProfiles
    protected checkMergingConfigAllProfiles(): void {
        for (const profs of this.profilesByType.values()) {
            profs.forEach((profile) => {
                this.checkMergingConfigSingleProfile(profile);
            });
        }
    }

    // check correct merging of a single profile
    protected checkMergingConfigSingleProfile(profile: imperative.IProfileLoaded): imperative.IProfileLoaded {
        const baseProfile = this.defaultProfileByType.get("base");
        if (this.shouldRemoveTokenFromProfile(profile, baseProfile)) {
            profile.profile.tokenType = profile.profile.tokenValue = undefined;
        }
        return profile;
    }

    protected getMergedAttrs(mProfileInfo: imperative.ProfileInfo, profAttrs: imperative.IProfAttrs): imperative.IProfile {
        const profile: imperative.IProfile = {};
        if (profAttrs != null) {
            const mergedArgs = mProfileInfo.mergeArgsForProfile(profAttrs, { getSecureVals: true });
            for (const arg of mergedArgs.knownArgs) {
                profile[arg.argName] = arg.argValue;
            }
        }
        return profile;
    }

    // create an array that includes registered types from apiRegister.registeredApiTypes()
    // and allExternalTypes
    private getAllProfileTypes(registeredTypes: string[]): string[] {
        const externalTypeArray: string[] = Array.from(this.allExternalTypes);
        const allTypes = registeredTypes.concat(externalTypeArray.filter((exType) => registeredTypes.every((type) => type !== exType)));
        return allTypes;
    }

    private getParentProfileForToken(profileName: string, config: imperative.Config): string {
        const secureProps = config.api.secure.secureFields();
        let parentProfile = profileName.slice(0, profileName.lastIndexOf("."));
        let tempProfile = profileName;
        while (tempProfile.includes(".")) {
            tempProfile = tempProfile.slice(0, tempProfile.lastIndexOf("."));
            if (secureProps.includes(`${config.api.profiles.getProfilePathFromName(tempProfile)}.properties.tokenValue`)) {
                parentProfile = tempProfile;
                break;
            }
        }
        return parentProfile;
    }

    private shouldRemoveTokenFromProfile(profile: imperative.IProfileLoaded, baseProfile: imperative.IProfileLoaded): boolean {
        return ((baseProfile?.profile?.host || baseProfile?.profile?.port) &&
            profile?.profile?.host &&
            profile?.profile?.port &&
            (baseProfile?.profile.host !== profile?.profile.host ||
                baseProfile?.profile.port !== profile?.profile.port ||
                (profile?.profile.user && profile?.profile.password)) &&
            profile?.profile.tokenType?.startsWith(imperative.SessConstants.TOKEN_TYPE_APIML)) as boolean;
    }

    public async updateBaseProfileFileLogin(
        profile: imperative.IProfileLoaded,
        updProfile: imperative.IProfile,
        forceUpdate?: boolean
    ): Promise<void> {
        const upd = { profileName: profile.name, profileType: profile.type };
        const mProfileInfo = await this.getProfileInfo();
        const setSecure = mProfileInfo.isSecured();
        await mProfileInfo.updateProperty({ ...upd, property: "tokenType", value: updProfile.tokenType, forceUpdate });
        await mProfileInfo.updateProperty({ ...upd, property: "tokenValue", value: updProfile.tokenValue, setSecure, forceUpdate });
    }

    public async updateBaseProfileFileLogout(profile: imperative.IProfileLoaded): Promise<void> {
        const mProfileInfo = await this.getProfileInfo();
        const setSecure = mProfileInfo.isSecured();
        const prof = mProfileInfo.getAllProfiles(profile.type).find((p) => p.profName === profile.name);
        const mergedArgs = mProfileInfo.mergeArgsForProfile(prof);
        await mProfileInfo.updateKnownProperty({ mergedArgs, property: "tokenValue", value: undefined, setSecure });
        await mProfileInfo.updateKnownProperty({ mergedArgs, property: "tokenType", value: undefined });
    }
}
