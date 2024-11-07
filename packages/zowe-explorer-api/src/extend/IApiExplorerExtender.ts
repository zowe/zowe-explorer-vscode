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

import * as imperative from "@zowe/imperative";
import { ProfilesCache } from "../profiles/ProfilesCache";
import { ErrorCorrelator } from "../utils/ErrorCorrelator";
import { ILocalStorageAccess } from "./ILocalStorageAccess";

/**
 * This interface can be used by other VS Code Extensions to access an alternative
 * profile types that can be employed in conjunction with the primary profile to provide
 * alternative support.
 *
 */
export interface IApiExplorerExtender {
    /**
     * Allows extenders access to the profiles loaded into Zowe Explorer.
     * This includes profiles of other extenders. Called reloadProfiles()
     * in case other extensions might have registered themselves before accessing.
     * See the ProfilesCache class for the available accessors. When making changes
     * to the profile in this cache remember that it shared with Zowe Explorer and
     * all other Zowe Explorer extensions
     * @version 1.18 or newer of Zowe Explorer
     * @returns {ProfilesCache}
     */
    getProfilesCache(): ProfilesCache;

    /**
     * After an extenders registered all its API extensions it
     * might want to request that profiles should get reloaded
     * to make them automatically appears in the Explorer drop-
     * down dialogs.
     */
    reloadProfiles(profileType?: string): void | Promise<void>;

    /**
     * After an extenders registered all its API extensions it
     * might want to check for an existing profile folder with meta-file
     * or to create them automatically if it is non-existant.
     */
    initForZowe(type: string, profileTypeConfigurations: imperative.ICommandProfileTypeConfiguration[]): void | Promise<void>;

    /**
     * Allows extenders to contribute error correlations, providing user-friendly
     * summaries of API or network errors. Also gives extenders the opportunity to
     * provide tips or additional resources for errors.
     */
    getErrorCorrelator?(): ErrorCorrelator;

    /**
     * Allows extenders to access Zowe Explorer's local storage values. Retrieve a list of
     * readable and writable keys by calling the `getReadableKeys, getWritableKeys` functions
     * on the returned instance.
     */
    getLocalStorage?(): ILocalStorageAccess;
}
