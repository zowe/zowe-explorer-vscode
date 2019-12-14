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

import * as imperative from "@brightside/imperative";

import { ZoweVscApi } from "./IZoweVscRestApis";
import { ZoweVscZosmfUssRestApi } from "./ZoweVscZosmfRestApi";
import { ZoweVscFtpUssRestApi } from "./ZoweVscFtpRestApi";

/**
 * The API register that gets exposed to other VS Code extensions to contribute their implementations.
 * @export
 * @class ZoweVscApiRegister
 */
export class ZoweVscApiRegister implements ZoweVscApi.IApiRegister {

    /**
     * Access the singleton instance.
     *
     * @static
     * @returns
     * @memberof ZoweVscApiRegister
     */
    public static getInstance(): ZoweVscApiRegister {
        return ZoweVscApiRegister.register;
    }

    /**
     * Static lookup of an API for USS for a given profile.
     * @private
     * @param {string} profileType
     * @returns
     * @memberof ZoweVscApiRegister
     */
    public static getUssApi(profile: imperative.IProfileLoaded): ZoweVscApi.IUss {
        return ZoweVscApiRegister.getInstance().getUssApi(profile);
    }

    /**
     * This object represents the API that gets exposed to other VS Code extensions
     * that want to contribute alternative implementations such as alternative ways
     * of retrieving files and data from z/OS.
     */
    private static register: ZoweVscApiRegister = new ZoweVscApiRegister();

    // These are the different API registries available to extenders
    private zoweVscUssApiImplementations = new Map<string, ZoweVscApi.IUss>();
    private zoweVscMvsApiImplementations = new Map<string, ZoweVscApi.IMvs>(); // TODO

    /**
     * Creates an instance of ZoweVscApiRegister.
     * @param {ZoweVscApi.IUss} [ussApi] Optional. If none provided then it will be initialized with a zOSMF Api.
     */
    private constructor() {
        this.registerUssApi(new ZoweVscZosmfUssRestApi());
        this.registerUssApi(new ZoweVscFtpUssRestApi());
    }

    /**
     * Other VS Code extension need to call this to register their USS APIs.
     * @param {ZoweVscApi.IUss} ussApi
     */
    public registerUssApi(ussApi: ZoweVscApi.IUss): void {
        if (ussApi && ussApi.getProfileTypeName()) {
            this.zoweVscUssApiImplementations.set(ussApi.getProfileTypeName(), ussApi);
        } else {
            throw new Error("A Zowe Extension client tried to register an invalid API.");
        }
    }

    /**
     * Get an array of all the registered APIs identified by the CLI profile types,
     * such as ["zosmf", "ftp"].
     * @returns {string[]}
     */
    public registeredApiTypes(): string[] {
        return [...new Set([...this.registeredUssApiTypes(), ...this.registeredMvsApiTypes()])];
    }

    /**
     * Get an array of all the registered USS APIs identified by the CLI profile types,
     * such as ["zosmf", "ftp"].
     * @returns {string[]}
     */
    public registeredUssApiTypes(): string[] {
        return [...this.zoweVscUssApiImplementations.keys()];
    }

    /**
     * Get an array of all the registered MVS APIs identified by the CLI profile types,
     * such as ["zosmf", "zftp"].
     * @returns {string[]}
     */
    public registeredMvsApiTypes(): string[] {
        return [...this.zoweVscMvsApiImplementations.keys()];
    }

    /**
     * Lookup of an API for USS for a given profile.
     * @private
     * @param {imperative.IProfileLoaded} profile
     * @returns
     * @memberof ZoweVscApiRegister
     */
    public getUssApi(profile: imperative.IProfileLoaded): ZoweVscApi.IUss {
        if (profile && profile.type && this.registeredUssApiTypes().includes(profile.type)) {
            // create a clone of the API object that remembers the profile with which it was created
            const api = Object.create(this.zoweVscUssApiImplementations.get(profile.type));
            api.profile = profile;
            return api;
        }
        else {
            throw new Error("Internal error: Tried to call a non-existing API: " + profile.type);
        }
    }
}
