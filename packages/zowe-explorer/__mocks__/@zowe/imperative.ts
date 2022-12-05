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

/**
 * This interface defines the options that can be sent into the download data set function
 */

const log4js = require("log4js");

export interface ICliOptions {
    profileRootDirectory: string;
    type: string;
}
export interface IConfigLogging {
    log4jsConfig?: any;
}

export interface ILoadOptions {
    name?: string;
    loadDefault?: boolean;
}
export interface ISessionOptions {
    user: string;
    password: string;
    hostname: string;
    port: number;
    protocol: string;
    type: string;
}

export interface ICommandArguments {
    user?: string;
    password?: string;
    hostname: string;
    port: number;
    tokenType?: string;
    tokenValue?: string;
}

interface NodeModule {
    exports: any;
    require: NodeRequire;
    id: string;
    filename: string;
    loaded: boolean;
    parent: NodeModule | null;
    children: NodeModule[];
    paths: string[];
}
export interface IProfOpts {
    overrideWithEnv?: boolean;
    requireKeytar?: () => NodeModule;
}

export interface IConfigOpts {
    homeDir?: string;
    projectDir?: string;
    vault?: string;
}

export class BrightProfile {
    constructor(public profile: Profile) {}
}

export class Session {
    constructor(public ISession: ISessionOptions) {}
}

export class Profile {
    constructor(public name: string, public type: string) {}
}

export class CliProfileManager {
    constructor(options: ICliOptions) {}

    public load(opts: ILoadOptions) {
        return { name: "profile1", profile: {}, type: "zosmf" };
    }
    public loadAll() {
        return [
            { name: "sestest", profile: {}, type: "zosmf" },
            { name: "profile1", profile: {}, type: "zosmf" },
            { name: "profile2", profile: {}, type: "zosmf" },
        ];
    }
    public getAllProfileNames() {
        return ["name1", "name2"];
    }
    public save() {
        return { name: "profile1", profile: {}, type: "zosmf" };
    }
    public update() {
        return { name: "profile1", profile: {}, type: "zosmf" };
    }
    public delete() {
        return { name: "profile1", profile: {}, type: "zosmf" };
    }
    public get configurations() {
        return [
            {
                type: "zosmf",
                schema: {
                    type: "object",
                    title: "test profile",
                    description: "test profile",
                    properties: {
                        sum: {
                            type: "number",
                        },
                    },
                    required: ["sum"],
                },
            },
            {
                type: "banana",
                schema: {
                    type: "object",
                    title: "test banana",
                    description: "test banana",
                    properties: {
                        sum: {
                            type: "number",
                        },
                    },
                    required: ["sum"],
                },
            },
        ];
    }
}

export class ProfileInfo {
    constructor(appName: string, profInfoOpts?: IProfOpts) {}

    public readProfilesFromDisk(teamCfgOpts?: IConfigOpts) {
        return;
    }
}

export class ImperativeConfig {
    public static instance = {
        cliHome: "./__tests__/.zowe",
        loadedConfig: {
            name: "zowe",
            defaultHome: "./__tests__/.zowe",
            envVariablePrefix: "ZOWE",
        },
    };
    public loadedConfig = {
        defaultHome: "./__tests__/.zowe",
        envVariablePrefix: "ZOWE",
    };
    public cliHome: "./__tests__/.zowe";
}

export class CredentialManagerFactory {}

export class DefaultCredentialManager {
    public test: "test";
}

export class AbstractCredentialManager {}

export class Logger {
    public static initLogger(loggingConfig: IConfigLogging): any {}
    public static getAppLogger(): Logger {
        return log4js.getLogger("app");
    }
}

export class ConnectionPropsForSessCfg {
    public static resolveSessCfgProps(): void {}
}

export class TextUtils {
    public static prettyJson(object: any, options?: any, color?: boolean, append?: string): string {
        return JSON.stringify(object);
    }
}

export namespace SessConstants {
    export declare const AUTH_TYPE_TOKEN = "token";
}
