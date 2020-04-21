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
import { ZoweDatasetNode } from "../../src/dataset/ZoweDatasetNode";
import { ZoweUSSNode } from "../../src/uss/ZoweUSSNode";
import * as path from "path";
import * as globals from "../../src/globals";
import * as vscode from "vscode";
import { ValidProfileEnum } from "../../src/Profiles";

export function generateISession() {
    return new imperative.Session({
        user: "fake",
        password: "fake",
        hostname: "fake",
        protocol: "https",
        type: "basic",
    });
}

export function generateISessionWithoutCredentials() {
    return new imperative.Session({
        user: "",
        password: "",
        hostname: "fake",
        protocol: "https",
        type: "basic",
    });
}

export function generateIProfile(): imperative.IProfileLoaded {
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

export function generateTextDocument(fileName: string): vscode.TextDocument {
    return {
        fileName: fileName,
        uri: null,
        isUntitled: null,
        languageId: null,
        version: null,
        isDirty: null,
        isClosed: null,
        save: null,
        eol: null,
        lineCount: null,
        lineAt: null,
        offsetAt: null,
        positionAt: null,
        getText: jest.fn(),
        getWordRangeAtPosition: null,
        validateRange: null,
        validatePosition: null
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