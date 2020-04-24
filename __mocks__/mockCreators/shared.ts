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

export function createISession() {
    return new imperative.Session({
        user: "fake",
        password: "fake",
        hostname: "fake",
        port: 443,
        protocol: "https",
        type: "basic",
    });
}

export function createISessionWithoutCredentials() {
    return new imperative.Session({
        user: "",
        password: "",
        hostname: "fake",
        protocol: "https",
        type: "basic",
    });
}

export function createIProfile(): imperative.IProfileLoaded {
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

export function createTreeView():vscode.TreeView<ZoweTreeProvider> {
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

export function createTextDocument(fileName: string): vscode.TextDocument {
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

export function createInstanceOfProfile(profile: imperative.IProfileLoaded) {
    return {
        allProfiles: [{ name: "firstName" }, { name: "secondName" }],
        defaultProfile: { name: "firstName" },
        getDefaultProfile: jest.fn(),
        promptCredentials: jest.fn(),
        loadNamedProfile: jest.fn(),
        usesSecurity: true,
        validProfile: ValidProfileEnum.VALID,
        checkCurrentProfile: jest.fn(),
        createNewConnection: jest.fn(() => {
            return { newprofile: "fake" };
        }),
        getProfiles: jest.fn(() => {
            return [{ name: profile.name, profile }, { name: profile.name, profile }];
        }),
        refresh: jest.fn()
    };
}

export function createFileResponse(theResponse) {
    return {
        success: true,
        commandResponse: "",
        apiResponse: theResponse
    };
}
