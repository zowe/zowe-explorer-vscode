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

import { IRegisterClient } from "./IRegisterClient";
import { IApiExplorerExtender } from "./IApiExplorerExtender";

export type IApiRegisterClient = IRegisterClient & {
    /**
     * Lookup of an API for the generic extender API.
     * @returns the registered API instance
     */
    getExplorerExtenderApi(): IApiExplorerExtender;
};

export * from "./IApiExplorerExtender";
export * from "./IRegisterClient";
export * from "./interfaces";
