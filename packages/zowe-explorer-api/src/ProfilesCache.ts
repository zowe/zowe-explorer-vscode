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

import { IProfileLoaded, Logger, CliProfileManager, IProfile, ICommandArguments } from "@zowe/imperative";
import * as path from "path";
import { URL } from "url";
import * as vscode from "vscode";

import { getZoweDir } from "./Utils";
import { IZoweNodeType } from "./IZoweTreeNode";
import { ZoweExplorerApi } from "./ZoweExplorerApi";

import * as nls from "vscode-nls";

// TODO: find a home for constants
export const CONTEXT_PREFIX = "_";
const VALIDATE_SUFFIX = CONTEXT_PREFIX + "validate=";

// Set up localization
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize: nls.LocalizeFunc = nls.loadMessageBundle();

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

let InputBoxOptions: vscode.InputBoxOptions;

export enum ValidProfileEnum {
    UNVERIFIED = 1,
    VALID = 0,
    INVALID = -1,
}

export class ProfilesCache {
    public profilesForValidation: IProfileValidation[] = [];
    public profilesValidationSetting: IValidationSetting[] = [];
    public allProfiles: IProfileLoaded[] = [];
    protected allTypes: string[];
    protected profilesByType = new Map<string, IProfileLoaded[]>();
    protected defaultProfileByType = new Map<string, IProfileLoaded>();
    protected profileManagerByType = new Map<string, CliProfileManager>();
    public constructor(protected log: Logger) {}

    public loadNamedProfile(name: string, type?: string): IProfileLoaded {
        for (const profile of this.allProfiles) {
            if (profile.name === name && (type ? profile.type === type : true)) {
                return profile;
            }
        }
        throw new Error(
            localize("loadNamedProfile.error.profileName", "Could not find profile named: ") +
                name +
                localize("loadNamedProfile.error.period", ".")
        );
    }

    public getDefaultProfile(type: string = "zosmf"): IProfileLoaded {
        return this.defaultProfileByType.get(type);
    }

    public getProfiles(type: string = "zosmf"): IProfileLoaded[] {
        return this.profilesByType.get(type);
    }

    public async refresh(apiRegister: ZoweExplorerApi.IApiRegisterClient): Promise<void> {
        this.allProfiles = [];
        this.allTypes = [];
        // TODO: Add Base ProfileType in registeredApiTypes
        // This process retrieves the base profile if there's any and stores it in an array
        // If base is added in registeredApiType maybe this process can be removed
        try {
            const profileManagerA = await this.getCliProfileManager("base");
            if (profileManagerA) {
                try {
                    const baseProfile = await profileManagerA.load({ loadDefault: true });
                    this.allProfiles.push(baseProfile);
                } catch (err) {
                    if (!err.message.includes(`No default profile set for type "base"`)) {
                        vscode.window.showInformationMessage(err.message);
                    }
                }
            }
        } catch (error) {
            this.log.debug(error);
        }
        for (const type of apiRegister.registeredApiTypes()) {
            const profileManager = await this.getCliProfileManager(type);
            const profilesForType = (await profileManager.loadAll()).filter((profile) => {
                return profile.type === type;
            });
            if (profilesForType && profilesForType.length > 0) {
                this.allProfiles.push(...profilesForType);
                this.profilesByType.set(type, profilesForType);
                let defaultProfile: IProfileLoaded;
                try {
                    defaultProfile = await profileManager.load({ loadDefault: true });
                } catch (error) {
                    vscode.window.showInformationMessage(error.message);
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

        validationResult.port = Number(url.port);
        validationResult.host = url.hostname;
        validationResult.valid = true;
        return validationResult;
    }

    public async getUrl(urlInputBox): Promise<string | undefined> {
        return new Promise<string | undefined>((resolve, reject) => {
            urlInputBox.onDidHide(() => {
                reject(undefined);
                resolve(urlInputBox.value);
            });
            urlInputBox.onDidAccept(() => {
                let host: string;
                if (urlInputBox.value.includes(":")) {
                    if (urlInputBox.value.includes("/")) {
                        host = urlInputBox.value;
                    } else {
                        host = `https://${urlInputBox.value}`;
                    }
                } else {
                    host = `https://${urlInputBox.value}`;
                }

                if (this.validateAndParseUrl(host).valid) {
                    resolve(host);
                } else {
                    urlInputBox.validationMessage = localize(
                        "createNewConnection.invalidzosURL",
                        "Please enter a valid host URL in the format 'company.com'."
                    );
                }
            });
        });
    }

    public async getSchema(profileType: string): Promise<{}> {
        const profileManager = await this.getCliProfileManager(profileType);
        const configOptions = Array.from(profileManager.configurations);
        let schema: {};
        for (const val of configOptions) {
            if (val.type === profileType) {
                schema = val.schema.properties;
            }
        }
        return schema;
    }

    public getAllTypes() {
        return this.allTypes;
    }

    public async getNamesForType(type: string) {
        const profileManager = await this.getCliProfileManager(type);
        const profilesForType = (await profileManager.loadAll()).filter((profile) => {
            return profile.type === type;
        });
        return profilesForType.map((profile) => {
            return profile.name;
        });
    }

    public async directLoad(type: string, name: string): Promise<IProfileLoaded> {
        let directProfile: IProfileLoaded;
        const profileManager = await this.getCliProfileManager(type);
        if (profileManager) {
            directProfile = await profileManager.load({ name });
        }
        return directProfile;
    }

    public async getCliProfileManager(type: string): Promise<CliProfileManager> {
        let profileManager = this.profileManagerByType.get(type);
        if (!profileManager) {
            try {
                profileManager = await new CliProfileManager({
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

    public async getBaseProfile() {
        let baseProfile: IProfileLoaded;

        // This functionality will retrieve the saved base profile in the allProfiles array
        for (const baseP of this.allProfiles) {
            if (baseP.type === "base") {
                baseProfile = baseP;
            }
        }
        return baseProfile;
    }

    protected async deleteProfileOnDisk(ProfileInfo) {
        let zosmfProfile: IProfile;
        try {
            zosmfProfile = await (await this.getCliProfileManager(ProfileInfo.type)).delete({
                profile: ProfileInfo,
                name: ProfileInfo.name,
                type: ProfileInfo.type,
            });
        } catch (error) {
            vscode.window.showErrorMessage(error.message);
        }
        return zosmfProfile.profile;
    }

    protected async saveProfile(ProfileInfo, ProfileName, ProfileType) {
        let newProfile: IProfile;
        try {
            newProfile = await (await this.getCliProfileManager(ProfileType)).save({
                profile: ProfileInfo,
                name: ProfileName,
                type: ProfileType,
            });
        } catch (error) {
            vscode.window.showErrorMessage(error.message);
        }
        return newProfile.profile;
    }
}
