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
import { ZoweVsCodeExtension } from "../ZoweVsCodeExtension";

/**
 * Retrieves the session associated with the specified profile.
 * This helper function handles the VS Code integration and API lookup.
 *
 * @param {imperative.IProfileLoaded} profile The profile to be inspected.
 *
 * @returns {imperative.Session}
 *      The session associated with the specified profile
 *
 * @throws {Error} If the profile type is not supported by the common APIs in the Zowe Explorer API register
 */
export function getSessionFromProfile(profile: imperative.IProfileLoaded): imperative.Session {
    return ZoweVsCodeExtension.getZoweExplorerApi().getCommonApi(profile).getSession(profile);
}
