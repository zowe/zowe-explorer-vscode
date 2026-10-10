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

export interface IChangePasswordResponse {
    success: boolean;

    /** Describes the outcome of the request, shown to the user when `success` is `false` */
    message?: string;

    /** Identifies the category of errors, if supported by the profile type (0 = success) */
    returnCode?: number;

    /** Identifies the specific error, if supported by the profile type (0 = success) */
    reasonCode?: number;
}
