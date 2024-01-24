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

import { imperative } from "@zowe/cli";
import {
    IApiRegisterClient,
    IApiExplorerExtender,
    ICommand,
    ICommon,
    IJes,
    IMvs,
    IUss,
    ZosmfCommandApi,
    ZosmfJesApi,
    ZosmfMvsApi,
    ZosmfUssApi,
    EventTypes,
} from "@zowe/zowe-explorer-api";
import { ZoweExplorerExtender } from "./ZoweExplorerExtender";
import { ZoweLogger } from "./utils/LoggerUtils";
import * as vscode from "vscode";

/**
 * The Zowe Explorer API Register singleton that gets exposed to other VS Code
 * extensions to contribute their implementations.
 */
export class ZoweExplorerApiRegister implements IApiRegisterClient {
    public static ZoweExplorerApiRegisterInst: ZoweExplorerApiRegister;

    /**
     * Access the singleton instance.
     * @returns {ZoweExplorerApiRegister} the ZoweExplorerApiRegister singleton instance
     */
    public static getInstance(): ZoweExplorerApiRegister {
        return ZoweExplorerApiRegister.register;
    }

    /**
     * Static lookup of an API for USS for a given profile.
     * @param {IProfileLoaded} a profile to be used with this instance of the API returned
     * @returns an instance of the API that uses the profile provided
     */
    public static getUssApi(profile: imperative.IProfileLoaded): IUss {
        return ZoweExplorerApiRegister.getInstance().getUssApi(profile);
    }

    /**
     * Static lookup of an API for MVS for a given profile.
     * @param {IProfileLoaded} a profile to be used with this instance of the API returned
     * @returns an instance of the API that uses the profile provided
     */
    public static getMvsApi(profile: imperative.IProfileLoaded): IMvs {
        return ZoweExplorerApiRegister.getInstance().getMvsApi(profile);
    }

    /**
     * Static lookup of an API for JES for a given profile.
     * @param {IProfileLoaded} a profile to be used with this instance of the API returned
     * @returns an instance of the API that uses the profile provided
     */
    public static getJesApi(profile: imperative.IProfileLoaded): IJes {
        return ZoweExplorerApiRegister.getInstance().getJesApi(profile);
    }

    /**
     * Static lookup of an API for Command for a given profile.
     * @param {IProfileLoaded} a profile to be used with this instance of the API returned
     * @returns an instance of the API that uses the profile provided
     */
    public static getCommandApi(profile: imperative.IProfileLoaded): ICommand {
        return ZoweExplorerApiRegister.getInstance().getCommandApi(profile);
    }

    /**
     * Static lookup of an API Common interface for a given profile for any of the registries supported.
     * @param profile {IProfileLoaded} a profile to be used with this instance of the API returned
     * @returns an instance of the Commin API that uses the profile provided; could be an instance any of its subclasses
     */
    public static getCommonApi(profile: imperative.IProfileLoaded): ICommon {
        return ZoweExplorerApiRegister.getInstance().getCommonApi(profile);
    }

    /**
     * Lookup for generic extender API implementation.
     * @returns an instance of the API
     */
    public static getExplorerExtenderApi(): IApiExplorerExtender {
        return ZoweExplorerApiRegister.getInstance().getExplorerExtenderApi();
    }

    /**
     * This object represents a collection of the APIs that get exposed to other VS Code
     * extensions that want to contribute alternative implementations such as alternative ways
     * of retrieving files and data from z/OS.
     */
    private static register: ZoweExplorerApiRegister = new ZoweExplorerApiRegister();

    // These are the different API registries currently available to extenders
    private ussApiImplementations = new Map<string, IUss>();
    private mvsApiImplementations = new Map<string, IMvs>();
    private jesApiImplementations = new Map<string, IJes>();
    private commandApiImplementations = new Map<string, ICommand>();

    // Event emitter extenders can subscribe to
    public onProfilesUpdateEmitter = new vscode.EventEmitter<EventTypes>();

    /**
     * Private constructor that creates the singleton instance of ZoweExplorerApiRegister.
     * It automatically registers the zosmf implementation as it is the default for Zowe Explorer.
     */
    private constructor() {
        this.registerUssApi(new ZosmfUssApi());
        this.registerMvsApi(new ZosmfMvsApi());
        this.registerJesApi(new ZosmfJesApi());
        this.registerCommandApi(new ZosmfCommandApi());
    }

    // TODO: the redundant functions that follow could be done with generics, but as we are using
    // interfaces here that do not have type meta data it would require that they have type info
    // added. On the other these functions make the client code easier to read and understand.

    /**
     * Other VS Code extension need to call this to register their USS API implementation.
     * @param {IUss} ussApi
     */
    public registerUssApi(ussApi: IUss): void {
        if (ussApi && ussApi.getProfileTypeName()) {
            this.ussApiImplementations.set(ussApi.getProfileTypeName(), ussApi);
        } else {
            throw new Error(vscode.l10n.t("Internal error: A Zowe Explorer extension client tried to register an invalid USS API."));
        }
    }

    /**
     * Other VS Code extension need to call this to register their MVS API implementation.
     * @param {IMvs} mvsApi
     */
    public registerMvsApi(mvsApi: IMvs): void {
        if (mvsApi && mvsApi.getProfileTypeName()) {
            this.mvsApiImplementations.set(mvsApi.getProfileTypeName(), mvsApi);
        } else {
            throw new Error(vscode.l10n.t("Internal error: A Zowe Explorer extension client tried to register an invalid MVS API."));
        }
    }

    /**
     * Other VS Code extension need to call this to register their MVS API implementation.
     * @param {IMvs} api
     */
    public registerJesApi(jesApi: IJes): void {
        if (jesApi && jesApi.getProfileTypeName()) {
            this.jesApiImplementations.set(jesApi.getProfileTypeName(), jesApi);
        } else {
            throw new Error(vscode.l10n.t("Internal error: A Zowe Explorer extension client tried to register an invalid JES API."));
        }
    }

    /**
     * Other VS Code extension need to call this to register their Command API implementation.
     * @param {ICommand} api
     */
    public registerCommandApi(commandApi: ICommand): void {
        if (commandApi && commandApi.getProfileTypeName()) {
            this.commandApiImplementations.set(commandApi.getProfileTypeName(), commandApi);
        } else {
            throw new Error(vscode.l10n.t("Internal error: A Zowe Explorer extension client tried to register an invalid Command API."));
        }
    }

    /**
     * Get an array of all the registered APIs identified by the CLI profile type names,
     * such as ["zosmf", "zftp"].
     * @returns {string[]}
     */
    public registeredApiTypes(): string[] {
        return [
            ...new Set([
                ...this.registeredUssApiTypes(),
                ...this.registeredMvsApiTypes(),
                ...this.registeredJesApiTypes(),
                ...this.registeredCommandApiTypes(),
            ]),
        ];
    }

    /**
     * Get an array of all the registered USS APIs identified by the CLI profile types,
     * such as ["zosmf", "ftp"].
     * @returns {string[]}
     */
    public registeredUssApiTypes(): string[] {
        return [...this.ussApiImplementations.keys()];
    }

    /**
     * Get an array of all the registered MVS APIs identified by the CLI profile types,
     * such as ["zosmf", "zftp"].
     * @returns {string[]}
     */
    public registeredMvsApiTypes(): string[] {
        return [...this.mvsApiImplementations.keys()];
    }

    /**
     * Get an array of all the registered JES APIs identified by the CLI profile types,
     * such as ["zosmf", "zftp"].
     * @returns {string[]}
     */
    public registeredJesApiTypes(): string[] {
        return [...this.jesApiImplementations.keys()];
    }

    /**
     * Get an array of all the registered Command APIs identified by the CLI profile types,
     * such as ["zosmf", "ftp"].
     * @returns {string[]}
     */
    public registeredCommandApiTypes(): string[] {
        return [...this.commandApiImplementations.keys()];
    }

    /**
     * Lookup of an API implementation for USS for a given profile.
     * @param {IProfileLoaded} profile
     * @returns an instance of the API for the profile provided
     */
    public getUssApi(profile: imperative.IProfileLoaded): IUss {
        if (profile && profile.type && this.registeredUssApiTypes().includes(profile.type)) {
            // create a clone of the API object that remembers the profile with which it was created
            const api = Object.create(this.ussApiImplementations.get(profile.type)) as IUss;
            api.profile = profile;
            return api;
        } else {
            throw new Error(
                vscode.l10n.t({
                    message: "Internal error: Tried to call a non-existing USS API in API register: {0}",
                    args: [profile.type],
                    comment: ["Profile type"],
                })
            );
        }
    }

    /**
     * Lookup of an API implementation for MVS for a given profile.
     * @param {IProfileLoaded} profile
     * @returns an instance of the API for the profile provided
     */
    public getMvsApi(profile: imperative.IProfileLoaded): IMvs {
        if (profile && profile.type && this.registeredMvsApiTypes().includes(profile.type)) {
            // create a clone of the API object that remembers the profile with which it was created
            const api = Object.create(this.mvsApiImplementations.get(profile.type)) as IMvs;
            api.profile = profile;
            return api;
        } else {
            throw new Error(
                vscode.l10n.t({
                    message: "Internal error: Tried to call a non-existing MVS API in API register: {0}",
                    args: [profile.type],
                    comment: ["Profile type"],
                })
            );
        }
    }

    /**
     * Lookup of an API implementation for JES for a given profile.
     * @param {IProfileLoaded} profile
     * @returns an instance of the API for the profile provided
     */
    public getJesApi(profile: imperative.IProfileLoaded): IJes {
        if (profile && profile.type && this.registeredJesApiTypes().includes(profile.type)) {
            // create a clone of the API object that remembers the profile with which it was created
            const api = Object.create(this.jesApiImplementations.get(profile.type)) as IJes;
            api.profile = profile;
            return api;
        } else {
            throw new Error(
                vscode.l10n.t({
                    message: "Internal error: Tried to call a non-existing JES API in API register: {0}",
                    args: [profile.type],
                    comment: ["Profile type"],
                })
            );
        }
    }

    /**
     * Lookup of an API implementation for Command for a given profile.
     * @param {IProfileLoaded} profile
     * @returns an instance of the API for the profile provided
     */
    public getCommandApi(profile: imperative.IProfileLoaded): ICommand {
        if (profile && profile.type && this.registeredCommandApiTypes().includes(profile.type)) {
            // create a clone of the API object that remembers the profile with which it was created
            const api = Object.create(this.commandApiImplementations.get(profile.type)) as ICommand;
            api.profile = profile;
            return api;
        } else {
            throw new Error(
                vscode.l10n.t({
                    message: "Internal error: Tried to call a non-existing Command API in API register: {0}",
                    args: [profile.type],
                    comment: ["Profile type"],
                })
            );
        }
    }

    public getCommonApi(profile: imperative.IProfileLoaded): ICommon {
        let result: ICommon;
        try {
            result = this.getUssApi(profile);
        } catch (ussError) {
            ZoweLogger.debug(ussError);
            try {
                result = this.getMvsApi(profile);
            } catch (mvsError) {
                ZoweLogger.debug(mvsError);
                try {
                    result = this.getJesApi(profile);
                } catch (JesError) {
                    ZoweLogger.debug(JesError);
                    try {
                        result = this.getCommandApi(profile);
                    } catch (cmdError) {
                        ZoweLogger.error(cmdError);
                        throw new Error(
                            vscode.l10n.t({
                                message: "Internal error: Tried to call a non-existing Common API in API register: {0}",
                                args: [profile.type],
                                comment: ["Profile type"],
                            })
                        );
                    }
                }
            }
        }
        return result;
    }

    /**
     * Lookup of the API implementation extender implementation.
     * @returns the instance of the API for the profile provided
     */
    public getExplorerExtenderApi(): IApiExplorerExtender {
        return ZoweExplorerExtender.getInstance();
    }

    /**
     * Event for extenders to subscribe to that will fire upon profile change.
     * @returns event that can be attached that will be called upon profile change
     */
    public get onProfilesUpdate(): vscode.Event<EventTypes> {
        return this.onProfilesUpdateEmitter.event;
    }
}
