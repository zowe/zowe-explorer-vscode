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

import * as zowe from "@brightside/core";
import * as imperative from "@brightside/imperative";

import { IZoweVscUssApi, IZoweVscMvsApi } from "./IZoweVscRestApis";
import { ZoweVscZosmfUssRestApi } from "./ZoweVscZosmfRestApi";

/**
 * The API register that gets exposed to other VS Code extensions to contribute their implementations.
 * @export
 * @class ZoweVscApiRegister
 */
export class ZoweVscApiRegister {

    /**
     * Access the singleton instance.
     *
     * @static
     * @returns
     * @memberof ZoweVscApiRegister
     */
    public static getInstance() {
        return ZoweVscApiRegister.register;
    }
    /**
     * This object represents the API that gets exposed to other VS Code extensions
     * that want to contribute alternative implementations such as alternative ways
     * of retrieving files and data from z/OS.
     */
    private static register: ZoweVscApiRegister = new ZoweVscApiRegister();

    // These are the different API registries available to extenders
    private zoweVscUssApiImplementations = new Map<string, IZoweVscUssApi>();
    private zoweVscMvsApiImplementations = new Map<string, IZoweVscMvsApi>(); // TODO

    /**
     * Creates an instance of ZoweVscApiRegister.
     * @param {IZoweVscUssApi} [ussApi] Optional. If none provided then it will be initialized with a zOSMF Api.
     */
    private constructor() {
        this.registerUssApi(new ZoweVscZosmfUssRestApi());
    }

    /**
     * Other VS Code extension need to call this to register their USS APIs.
     * @param {IZoweVscUssApi} ussApi
     */
    public registerUssApi(ussApi: IZoweVscUssApi): void {
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

    // ** Start Common API Methods
    public createSession(profile: imperative.IProfileLoaded): imperative.Session {
        return this.getUssApi(profile).createSession(profile.profile);
    }

    // ** Start of USS Methods

    public async fileList(
        profile: imperative.IProfileLoaded,
        session: imperative.Session,
        path: string): Promise<zowe.IZosFilesResponse>{
        return this.getUssApi(profile).fileList(session, path);
    }

    public async create(
        profile: imperative.IProfileLoaded,
        session: imperative.Session,
        ussPath: string,
        type: string,
        mode?: string): Promise<string> {
        return this.getUssApi(profile).create(session, ussPath, type, mode);
    }

    // ** Private utility methods

    /**
     * Shortcut to look up an API for USS.
     * @private
     * @param {string} profileType
     * @returns
     * @memberof ZoweVscApiRegister
     */
    private getUssApi(profile: imperative.IProfileLoaded): IZoweVscUssApi {
        if (profile && profile.type && this.registeredUssApiTypes().includes(profile.type)) {
            return this.zoweVscUssApiImplementations.get(profile.type);
        }
        else {
            throw new Error("Internal error: Tried to call a non-existing API: " + profile.type);
        }
    }
}
