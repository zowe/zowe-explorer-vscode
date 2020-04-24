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
import * as vscode from "vscode";
import { ValidProfileEnum } from "../../src/Profiles";
import { ZoweTreeProvider } from "../../src/abstract/ZoweTreeProvider";

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

export function generateInvalidIProfile(): imperative.IProfileLoaded {
    return {
        name: "sestest",
        profile: {
            type : "zosmf",
            host: null,
            port: 1443,
            user: null,
            password: null,
            rejectUnauthorized: false,
            name: "testName"
        },
        type: "zosmf",
        message: "",
        failNotFound: false
    };
}

export function generateTreeView() {
    return {
        reveal: jest.fn(),
        onDidExpandElement: jest.fn(),
        onDidCollapseElement: jest.fn(),
        selection: [],
        onDidChangeSelection: jest.fn(),
        visible: true,
        onDidChangeVisibility: jest.fn(),
        dispose: jest.fn()
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

export function generateFileResponse(theResponse) {
    return {
        success: true,
        commandResponse: "",
        apiResponse: theResponse
    };
}
