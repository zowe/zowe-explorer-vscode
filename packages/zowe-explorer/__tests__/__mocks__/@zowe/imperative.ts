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

/**
 * This interface defines the options that can be sent into the download data set function
 */

import * as os from "os";
import * as path from "path";
const log4js = require("log4js");

export class EventProcessor {
    public emitZoweEvent(eventName: string): void {}
}

export enum ProfLocType {
    OLD_PROFILE = 0, // an old-school profile
    TEAM_CONFIG = 1, // a team configuration
    ENV = 2, // an environment variable
    DEFAULT = 3,
}

/**
 * Constants used for REST client, etc.
 * @export
 * @class RestConstants
 */
export class RestConstants {
    /**
     * 200
     * @static
     * @memberof RestConstants
     */
    static readonly HTTP_STATUS_200 = 200;
    /**
     * 201
     * @static
     * @memberof RestConstants
     */
    static readonly HTTP_STATUS_201 = 201;
    /**
     * 202
     * @static
     * @memberof RestConstants
     */
    static readonly HTTP_STATUS_202 = 202;
    /**
     * 204
     * @static
     * @memberof RestConstants
     */
    static readonly HTTP_STATUS_204 = 204;
    /**
     * 300
     * @static
     * @memberof RestConstants
     */
    static readonly HTTP_STATUS_300 = 300;
    /**
     * 400
     * @static
     * @memberof RestConstants
     */
    static readonly HTTP_STATUS_400 = 400;
    /**
     * 401
     * @static
     * @memberof RestConstants
     */
    static readonly HTTP_STATUS_401 = 401;
    /**
     * 404
     * @static
     * @memberof RestConstants
     */
    static readonly HTTP_STATUS_404 = 404;
    /**
     * 500
     * @static
     * @memberof RestConstants
     */
    static readonly HTTP_STATUS_500 = 500;
    /**
     * Set cookie property
     * @static
     * @type {string}
     * @memberof RestConstants
     */
    static readonly PROP_COOKIE: string;
    /**
     * Query identifier
     * @static
     * @memberof RestConstants
     */
    static readonly QUERY_ID = "?";
    /**
     * Basic auth
     * @static
     * @type {string}
     * @memberof RestConstants
     */
    static readonly BASIC_PREFIX: string;
    /**
     * Bearer auth
     * @static
     * @type {string}
     * @memberof RestConstants
     */
    static readonly BEARER_PREFIX: string;
}

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

export interface IImperativeError {
    msg: string;
    errorCode?: number;
    additionalDetails?: string;
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

export interface IImperativeErrorParms {
    logger?: Logger;
    tag?: string;
}

export interface IProfInfoErrParms extends IImperativeErrorParms {
    itemsInError?: string[];
}

export interface ICredentialManagerNameMap {
    credMgrDisplayName: string;
    credMgrPluginName?: string;
    credMgrZEName?: string;
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

    public static initialize() {}
}

export class ProfileInfo {
    public static onlyV1ProfilesExist = false;
    constructor(appName: string, profInfoOpts?: IProfOpts) {}

    public readProfilesFromDisk(teamCfgOpts?: IConfigOpts) {
        return;
    }

    public addProfileTypeToSchema(
        profileType: string,
        typeInfo: {
            sourceApp: string;
            schema: any;
            version?: string;
        }
    ): any {
        return;
    }
}

export class ConfigUtils {
    public static getZoweDir(): string {
        const defaultHome = path.join(os.homedir(), ".zowe");
        if (ImperativeConfig.instance.loadedConfig?.defaultHome !== defaultHome) {
            ImperativeConfig.instance.loadedConfig = {
                name: "zowe",
                defaultHome,
                envVariablePrefix: "ZOWE",
            };
        }
        return ImperativeConfig.instance.cliHome;
    }
}
export class ImperativeError extends Error {
    private msg: string;
    constructor(public mDetails: IImperativeError) {
        super();
        this.msg = mDetails.msg;
    }
    public get message() {
        return this.msg;
    }
}

export class ProfInfoErr extends ImperativeError {
    public static readonly LOAD_CRED_MGR_FAILED: string = "LoadCredMgrFailed";
    constructor(impErrDetails: IImperativeError, profErrParms?: IProfInfoErrParms) {
        super(impErrDetails);
        this.name = "ProfInfoErr";
        if (profErrParms) {
            this.mItemsInError = [...(profErrParms.itemsInError ?? "")];
        }
    }
    private mItemsInError: string[] = [];
    public get itemsInError(): string[] {
        return this.mItemsInError;
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

export class ConfigSchema {
    public static buildSchema() {
        return {};
    }

    public static loadSchema() {
        return [];
    }
}

export class CredentialManagerOverride {
    public static getKnownCredMgrs(): ICredentialManagerNameMap[] {
        return [];
    }

    public static getCredMgrInfoByDisplayName(displayName: string): ICredentialManagerNameMap | null {
        return null;
    }

    public static recordCredMgrInConfig(displayName: string): void {
        return;
    }
}

export class ProfileCredentials {
    public static defaultCredMgrWithKeytar(requireKeytar: () => NodeModule): string {
        return "Test";
    }
}

export class ConfigBuilder {
    public static build() {
        return {
            $schema: "./zowe.schema.json",
            profiles: {
                zosmf: {
                    type: "zosmf",
                    properties: {
                        port: 443,
                    },
                    secure: [],
                },
                global_base: {
                    type: "base",
                    properties: {
                        host: "sample.com",
                        rejectUnauthorized: false,
                    },
                    secure: [],
                },
            },
            defaults: {
                zosmf: "zosmf",
                base: "global_base",
            },
            autoStore: true,
        };
    }
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

export const apiErrorHeader = {
    message: "API Error",
};

export class ConvertV1Profiles {
    public static convert() {
        return {
            msgs: "",
            profilesConverted: [],
            profilesFailed: [],
            v1ScsPluginName: undefined,
        };
    }
}

export class ZoweUserEvents {
    public static readonly ON_VAULT_CHANGED = "onVaultChanged";
}
export class ZoweSharedEvents {
    public static readonly ON_CREDENTIAL_MANAGER_CHANGED = "onCredentialManagerChanged";
}

export class EventOperator {
    public static getWatcher() {
        return {
            subscribeUser: () => ({ close: () => {} }),
            subscribeShared: () => ({ close: () => {} }),
        };
    }
}
