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

// tslint:disable-next-line: no-implicit-dependencies
import { IProfileLoaded, Logger, CliProfileManager } from "@brightside/imperative";
import * as nls from "vscode-nls";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import * as ProfileLoader from "./ProfileLoader";
const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

export class Profiles {
    public static async createInstance(log: Logger) {
        Profiles.loader = new Profiles(log);
        await Profiles.loader.refresh();
        return Profiles.loader;
    }
    public static getInstance() {
        return Profiles.loader;
    }
    private static loader: Profiles;
    public allProfiles: IProfileLoaded[] = [];
    public defaultProfile: IProfileLoaded;

    private spawnValue: number = -1;
    private constructor(public log: Logger) {}

    public loadNamedProfile(name: string): IProfileLoaded {
        for (const profile of this.allProfiles) {
            if (profile.name === name && profile.type === "zosmf") {
                return profile;
            }
        }
        throw new Error(localize("loadNamedProfile.error.profileName", "Could not find profile named: ")
            + name + localize("loadNamedProfile.error.period", "."));
    }
    public getDefaultProfile(): IProfileLoaded {
        return this.defaultProfile;
    }
    public async refresh() {
        if (this.isSpawnReqd() === 0) {
            this.allProfiles = ProfileLoader.loadAllProfiles();
            this.defaultProfile = ProfileLoader.loadDefaultProfile(this.log);
        } else {
            const profileManager = new CliProfileManager({
                profileRootDirectory: path.join(os.homedir(), ".zowe", "profiles"),
                type: "zosmf"
            });
            this.allProfiles = (await profileManager.loadAll()).filter((profile) => {
                return profile.type === "zosmf";
            });
            this.defaultProfile = (await profileManager.load({ loadDefault: true }));
        }
    }

    private isSpawnReqd() {
        if (this.spawnValue === -1) {
            const homedir = os.homedir();
            this.spawnValue = 0;
            try {
                const fileName = path.join(homedir, ".zowe", "settings", "imperative.json");
                const settings = JSON.parse(fs.readFileSync(fileName).toString());
                const value = settings.overrides.CredentialManager;
                this.spawnValue = value !== false ? 0 : 1;
            } catch (error) {
                // default to spawn
                this.spawnValue = 0;
            }
        }
        return this.spawnValue;
    }
}
