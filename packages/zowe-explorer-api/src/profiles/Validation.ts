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

/**
 * Interfaces for anything related to validation for Zowe profiles
 */
export namespace Validation {
    export interface IValidationUrl {
        valid: boolean;
        protocol: string;
        host: string;
        port: number;
    }

    export interface IValidationProfile {
        status: string;
        name: string;
    }

    export interface IValidationSetting {
        name: string;
        setting: boolean;
    }

    export enum ValidationType {
        UNVERIFIED = 1,
        VALID = 0,
        INVALID = -1,
    }

    export enum EventType {
        CREATE,
        UPDATE,
        DELETE,
    }
}
