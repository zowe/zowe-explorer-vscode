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
 * This interface defines the options that can be sent into the dwanload data set function
 */

const log4js = require("log4js");

export interface ICliOptions {
    profileRootDirectory: string;
    type: string;
}
export interface IConfigLogging {
    "log4jsConfig"?: any;
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


export class BrightProfile {
    constructor(public profile: Profile) { }
}

// tslint:disable-next-line:max-classes-per-file
export class Session {
    constructor(public ISession: ISessionOptions) { }
}

// tslint:disable-next-line:class-name
// tslint:disable-next-line:max-classes-per-file
export class Profile {
    constructor(public name: string) { }
}

// tslint:disable-next-line:max-classes-per-file
export class CliProfileManager {
    // tslint:disable-next-line:no-empty
    constructor(options: ICliOptions) { }

    public load(opts: ILoadOptions) {
        return new BrightProfile(new Profile("TestName"));
    }

    public getAllProfileNames(){
        return ["name1", "name2"];
    }
}

// tslint:disable-next-line:max-classes-per-file
export class CredentialManagerFactory {
}

// tslint:disable-next-line:max-classes-per-file
export class DefaultCredentialManager {
     public test: "test";
}


// tslint:disable-next-line:max-classes-per-file
export class Logger {
    public static initLogger(loggingConfig: IConfigLogging): any {
    }
    public static getAppLogger(): Logger {
        return log4js.getLogger("app");
    }
}

// tslint:disable-next-line:max-classes-per-file
export class TextUtils {
    public static prettyJson(object: any, options?: any, color?: boolean, append?: string): string {
        return JSON.stringify(object);
        // return("dsname: STONECC.A1550669.A698019.TEST1" +
        // "blksz:  6160" +
        // "catnm:  ICFCAT.MV3B.CATALOGA" +
        // "cdate:  2019/02/20" +
        // "dev:    3390" +
        // "dsntp:  PDS" +
        // "dsorg:  PO" +
        // "edate:  ***None***" +
        // "extx:   1" +
        // "lrecl:  80" +
        // "migr:   NO" +
        // "mvol:   N" +
        // "ovf:    NO" +
        // "rdate:  2019/07/17" +
        // "recfm:  FB" +
        // "sizex:  15" +
        // "spacu:  CYLINDERS" +
        // "used:   6" +
        // "vol:    3BP002" +
        // "vols:   3BP002");
    }
}