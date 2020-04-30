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

import * as zowe from "@zowe/cli";
import * as imperative from "@zowe/imperative";
import { ZoweDatasetNode } from "../../src/dataset/ZoweDatasetNode";
import { ZoweUSSNode } from "../../src/uss/ZoweUSSNode";
import * as vscode from "vscode";
import { ValidProfileEnum } from "../../src/Profiles";
import * as utils from "../../src/utils";

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

export function generateTextDocument(sessionNode: ZoweDatasetNode | ZoweUSSNode, name: string): vscode.TextDocument {
    return {
        fileName: `/${sessionNode.label}/${name}`,
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

export function generateQuickPickItem(): vscode.QuickPickItem {
    return new utils.FilterDescriptor("\uFF0B " + "Create a new filter");
}

export function generateQuickPickContent(entered: any, item: vscode.QuickPickItem): any {
    return {
        placeholder: "Choose \"Create new...\" to define a new profile or select an existing profile to Add to the Data Set Explorer",
        activeItems: [item],
        ignoreFocusOut: true,
        items: [item],
        value: entered,
        show: jest.fn(),
        hide: jest.fn(),
        onDidAccept: jest.fn(),
        onDidChangeValue: jest.fn(),
        dispose: jest.fn()
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
