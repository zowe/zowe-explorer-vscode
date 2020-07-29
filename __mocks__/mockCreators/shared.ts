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
import { ZoweTreeProvider } from "../../src/abstract/ZoweTreeProvider";
import { ZoweDatasetNode } from "../../src/dataset/ZoweDatasetNode";
import { ZoweUSSNode } from "../../src/uss/ZoweUSSNode";
import * as vscode from "vscode";
import { ValidProfileEnum } from "../../src/Profiles";
import * as utils from "../../src/utils";
import * as zowe from "@zowe/cli";

export function createPersistentConfig() {
    return {
        persistence: true,
        get: () => {
            return {
                sessions: ["sestest", "profile1", "profile2"],
                favorites: ["[sestest]: TEST.PDS", "[profile1]: /u/myuser.txt{textFile}", "[profile2]: /u/myuser"]
            };
        },
        update: jest.fn(()=>{
            return {};
        })
    };
}

export function createISession() {
    return new imperative.Session({
        user: "fake",
        password: "fake",
        hostname: "fake",
        port: 1443,
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
        base64EncodedAuth: "fakeEncoding"
    });
}

export function createBasicZosmfSession(profile: imperative.IProfileLoaded) {
    return zowe.ZosmfSession.createBasicZosmfSession(profile.profile);
}

export function removeNodeFromArray(badNode, array) {
    array.splice(array.findIndex(
        (nodeInArray) => badNode.getProfileName() === nodeInArray.getProfileName()
    ), 1);
}

export function createIProfile(): imperative.IProfileLoaded {
    return {
        name: "sestest",
        profile: {
            host: "fake",
            port: 999,
            user: undefined,
            password: undefined,
            rejectUnauthorize: false
        },
        type: "zosmf",
        message: "",
        failNotFound: false
    };
}

export function createInvalidIProfile(): imperative.IProfileLoaded {
    return {
        name: "sestest",
        profile: {
            type: "zosmf",
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

export function createValidIProfile(): imperative.IProfileLoaded {
    return {
        name: "sestest",
        profile: {
            type : "zosmf",
            host: "test",
            port: 1443,
            user: "test",
            password: "test",
            rejectUnauthorized: false,
            name: "testName"
        },
        type: "zosmf",
        message: "",
        failNotFound: false
    };
}

export function createAltTypeIProfile(): imperative.IProfileLoaded {
    return {
        name: "altTypeProfile",
        profile: {
            type: "alternativeType",
            host: "test",
            port: 999,
            user: "test",
            password: "test",
            rejectUnauthorized: false,
        },
        type: "alternativeType",
        message: "",
        failNotFound: false
    };
}

export function createTreeView(): vscode.TreeView<ZoweTreeProvider> {
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

export function createTextDocument(name: string, sessionNode?: ZoweDatasetNode | ZoweUSSNode): vscode.TextDocument {
    return {
        fileName: sessionNode ? `/${sessionNode.label}/${name}` : name,
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
        allProfiles: [{ name: "sestest" }, { name: "profile1" }, { name: "profile2" }],
        defaultProfile: { name: "sestest" },
        getDefaultProfile: jest.fn(),
        promptCredentials: jest.fn(),
        loadNamedProfile: jest.fn(),
        usesSecurity: true,
        validProfile: ValidProfileEnum.VALID,
        checkCurrentProfile: jest.fn(() => {
            return {status: "active", name: "sestest"};
        }),
        profilesForValidation: [{status: "active", name: "sestest"}],
        validateProfiles: jest.fn(),
        editSession: jest.fn(),
        createNewConnection: jest.fn(() => {
            return { newprofile: "fake" };
        }),
        getProfiles: jest.fn(() => {
            return [{ name: profile.name, profile }, { name: profile.name, profile }];
        }),
        refresh: jest.fn(),
    } as any;
}

export function createFileResponse(theResponse) {
    return {
        success: true,
        commandResponse: "",
        apiResponse: theResponse
    } as any;
}

export function createQuickPickItem(): vscode.QuickPickItem {
    return new utils.FilterDescriptor("\uFF0B " + "Create a new filter");
}

export function createQuickPickContent(entered: any, itemArray: vscode.QuickPickItem[], placeholderString: string): any {
    return {
        placeholder: placeholderString,
        activeItems: itemArray,
        ignoreFocusOut: true,
        items: itemArray,
        value: entered,
        show: jest.fn(),
        hide: jest.fn(),
        onDidAccept: jest.fn(),
        onDidChangeValue: jest.fn(),
        dispose: jest.fn()
    };
}

export function createInputBox(value: string): any {
    const inputBox: vscode.InputBox = {
        value,
        title: null,
        enabled: true,
        busy: false,
        show: jest.fn(),
        hide: jest.fn(),
        step: null,
        dispose: jest.fn(),
        ignoreFocusOut: false,
        totalSteps: null,
        placeholder: undefined,
        password: false,
        onDidChangeValue: jest.fn(),
        onDidAccept: jest.fn(),
        onDidHide: jest.fn(),
        buttons: [],
        onDidTriggerButton: jest.fn(),
        prompt: undefined,
        validationMessage: undefined
    };
    return inputBox;
}

export function createWorkspaceConfiguration(): vscode.WorkspaceConfiguration {
    return {
        get: jest.fn(),
        update: jest.fn(),
        has: jest.fn(),
        inspect: jest.fn()
    };
}
