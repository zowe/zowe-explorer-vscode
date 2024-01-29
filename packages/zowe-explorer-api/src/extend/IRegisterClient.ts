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
import { ICommand, ICommon, IJes, IMvs, IUss } from "./interfaces";
import * as vscode from "vscode";
import { EventTypes } from "../profiles";

/**
 * This interface can be used by other VS Code Extensions to register themselves
 * with additional API implementations. The other extension would implement one or
 * more interfaces above, for example MyZoweExplorerAppUssApi, and register it with
 * the object returned by this extensions activate() method as shown below.
 *
 * @example
 * // see if Zowe Explorer is installed and retrieve the API Registry\
 * const explorerApi = extensions.getExtension('zowe.vscode-extension-for-zowe');\
 * if (explorerApi && explorerApi.exports) {\
 *   // Cast the returned object to the IApiRegisterClient interface\
 *   const importedApi: IApiRegisterClient = explorerApi.exports;\
 *   // create an instance of my API and register it with Zowe Explorer\
 *   importedApi.registerUssApi(new MyZoweExplorerAppUssApi());\
 *   window.showInformationMessage(\
 *     'Zowe Explorer was augmented for MyApp support. Please, refresh your explorer views.');\
 *   } else {\
 *   window.showInformationMessage(\
 *     'Zowe VS Extension was not found: either not installe or older version.');\
 * }
 *
 * @export
 */
export interface IRegisterClient {
    /**
     * Register a new implementation of the USS Api.
     * See example in Interface docs.
     *
     * @param {IUss} ussApi
     */
    registerUssApi(ussApi: IUss): void;

    /**
     * Lookup of an API for USS for a given profile.
     * @param {zowe.imperative.IProfileLoaded} profile
     * @returns the registered API instance for the given profile
     */
    getUssApi(profile: imperative.IProfileLoaded): IUss;

    /**
     * Register a new implementation of the MVS Api.
     * See example in Interface docs.
     *
     * @param {IMvs} mvsApi
     */
    registerMvsApi(mvsApi: IMvs): void;

    /**
     * Lookup of an API for MVS for a given profile.
     * @param {string} profile
     * @returns the registered API instance
     */
    getMvsApi(profile: imperative.IProfileLoaded): IMvs;

    /**
     * Register a new implementation of the JES Api.
     * See example in Interface docs.
     *
     * @param {IJes} jesApi
     */
    registerJesApi(jesApi: IJes): void;

    /**
     * Lookup of an API for JES for a given profile.
     * @param {string} profile
     * @returns the registered API instance
     */
    getJesApi(profile: imperative.IProfileLoaded): IJes;

    /**
     * Register a new implementation of the Command Api.
     * See example in Interface docs.
     *
     * @param {ICommand} commandApi
     */
    registerCommandApi(CommandApi: ICommand): void;

    /**
     * Lookup of an API for Issuing a Command for a given profile.
     * @param {string} profile
     * @returns the registered API instance
     */
    getCommandApi(profile: imperative.IProfileLoaded): ICommand;

    /**
     * Get an array of all the registered APIs identified by the CLI profile type names,
     * such as ["zosmf", "zftp"].
     * @returns {string[]}
     */
    registeredApiTypes(): string[];

    /**
     * Define events that fire whenever an existing team config profile is updated.
     */
    onProfilesUpdate?: vscode.Event<EventTypes>;

    /**
     * Lookup of any registered API (Uss, Mvs, Jes, or Command).
     * @param {string} profile
     * @returns the registered API instance
     */
    getCommonApi?(profile: imperative.IProfileLoaded): ICommon;
}
