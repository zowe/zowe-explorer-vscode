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
    static initLogger(loggingConfig: IConfigLogging): any {
    }
    static getAppLogger(): Logger {
        return log4js.getLogger("app");
    }
}
