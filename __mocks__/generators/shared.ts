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

import * as imperative from "@zowe/imperative";
import * as zowe from "@zowe/cli";
import { ValidProfileEnum } from "../../src/Profiles";

export function generateSession() {
    return new imperative.Session({
        user: "fake",
        password: "fake",
        hostname: "fake",
        protocol: "https",
        type: "basic",
    });
}

export function generateSessionNoCredentials() {
    return new imperative.Session({
        user: "",
        password: "",
        hostname: "fake",
        port: 443,
        protocol: "https",
        type: "basic",
    });
}

export function generateProfile(): imperative.IProfileLoaded {
    return {
        name: "sestest",
        profile: {
            user: undefined,
            password: undefined
        },
        type: "zosmf",
        message: "",
        failNotFound: false
    };
}

export function generateFileResponse(): zowe.IZosFilesResponse {
    return {
        success: true,
        commandResponse: null,
        apiResponse: {
            etag: "123"
        }
    };
};

export function generateTreeView() {
    return {
        reveal: jest.fn(),
        onDidExpandElement: jest.fn(),
        onDidCollapseElement: jest.fn(),
        selection: [],
        onDidChangeSelection: jest.fn(),
        visible: true,
        onDidChangeVisibility: jest.fn()
    };
}

export function generateInstanceOfProfile(profile: imperative.IProfileLoaded) {
    return {
        allProfiles: [{name: "firstName"}, {name: "secondName"}],
        defaultProfile: {name: "firstName"},
        getDefaultProfile: jest.fn(),
        promptCredentials: jest.fn(),
        loadNamedProfile: jest.fn(),
        usesSecurity: true,
        validProfile: ValidProfileEnum.VALID,
        checkCurrentProfile: jest.fn(),
        getProfiles: jest.fn(() => {
            return [{name: profile.name, profile}, {name: profile.name, profile}];
        }),
        refresh: jest.fn()
    };
}