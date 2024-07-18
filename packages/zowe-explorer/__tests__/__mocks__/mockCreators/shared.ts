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

import * as vscode from "vscode";
import * as zosmf from "@zowe/zosmf-for-zowe-sdk";
import { imperative, Validation, IZoweTreeNode } from "@zowe/zowe-explorer-api";
import { Constants } from "../../../src/configuration/Constants";
import { Profiles } from "../../../src/configuration/Profiles";
import { SettingsConfig } from "../../../src/configuration/SettingsConfig";
import { FilterDescriptor } from "../../../src/management/FilterManagement";
import { ZoweTreeProvider } from "../../../src/providers/ZoweTreeProvider";
import { ZoweDatasetNode } from "../../../src/trees/dataset/ZoweDatasetNode";
import { ZoweUSSNode } from "../../../src/trees/uss/ZoweUSSNode";

const MOCK_PROFILES = [];

export function createPersistentConfig() {
    return {
        persistence: true,
        get: () => {
            return {
                sessions: ["sestest", "profile1", "profile2"],
                favorites: ["[sestest]: TEST.PDS", "[profile1]: /u/myuser.txt{textFile}", "[profile2]: /u/myuser"],
            };
        },
        update: jest.fn(() => {
            return {};
        }),
    };
}

export function createUnsecureTeamConfigMock() {
    return {
        $schema: "./zowe.schema.json",
        profiles: {
            zosmf: {
                type: "zosmf",
                properties: {
                    port: 443,
                },
            },
            tso: {
                type: "tso",
                properties: {
                    account: "",
                    codePage: "1047",
                    logonProcedure: "IZUFPROC",
                },
            },
            ssh: {
                type: "ssh",
                properties: {
                    port: 22,
                },
            },
            base: {
                type: "base",
                properties: {
                    host: "sample.com",
                    rejectUnauthorized: true,
                },
            },
        },
        defaults: {
            zosmf: "zosmf",
            tso: "tso",
            ssh: "ssh",
            base: "base",
        },
        autoStore: false,
    };
}

export function createTeamConfigMock() {
    return {
        $schema: "./zowe.schema.json",
        profiles: {
            zosmf: {
                type: "zosmf",
                properties: {
                    port: 443,
                },
                secure: [],
            },
            tso: {
                type: "tso",
                properties: {
                    account: "",
                    codePage: "1047",
                    logonProcedure: "IZUFPROC",
                },
                secure: [],
            },
            ssh: {
                type: "ssh",
                properties: {
                    port: 22,
                },
                secure: [],
            },
            base: {
                type: "base",
                properties: {
                    host: "sample.com",
                    rejectUnauthorized: true,
                },
                secure: ["user", "password"],
            },
        },
        defaults: {
            zosmf: "zosmf",
            tso: "tso",
            ssh: "ssh",
            base: "base",
        },
        autoStore: true,
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
        base64EncodedAuth: "fakeEncoding",
    });
}

export function createSessCfgFromArgs(testProfile: imperative.IProfileLoaded) {
    const cmdArgs: imperative.ICommandArguments = {
        $0: "zowe",
        _: [""],
        host: testProfile.profile.host,
        port: testProfile.profile.port,
        basePath: testProfile.profile.basePath,
        rejectUnauthorized: testProfile.profile.rejectUnauthorized,
        user: testProfile.profile.user,
        password: testProfile.profile.password,
    };
    const sessCfg = zosmf.ZosmfSession.createSessCfgFromArgs(cmdArgs);
    const session = new imperative.Session(sessCfg);
    return session;
}

export function removeNodeFromArray(badNode, array) {
    array.splice(
        array.findIndex((nodeInArray) => badNode.getProfileName() === nodeInArray.getProfileName()),
        1
    );
}

export function createIProfile(): imperative.IProfileLoaded {
    return {
        name: "sestest",
        profile: {
            host: "fake",
            port: 999,
            user: "testuser",
            password: undefined,
            rejectUnauthorize: false,
        },
        type: "zosmf",
        message: "",
        failNotFound: false,
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
            name: "testName",
        },
        type: "zosmf",
        message: "",
        failNotFound: false,
    };
}

export function createValidIProfile(): imperative.IProfileLoaded {
    return {
        name: "sestest",
        profile: {
            type: "zosmf",
            host: "test",
            port: 1443,
            user: "test",
            password: "test",
            rejectUnauthorized: false,
            name: "testName",
        },
        type: "zosmf",
        message: "",
        failNotFound: false,
    };
}

export function createTokenAuthIProfile(): imperative.IProfileLoaded {
    return {
        name: "sestest",
        profile: {
            type: "zosmf",
            host: "test",
            port: 1443,
            rejectUnauthorized: false,
            tokenType: "apimlAuthenticationToken",
            tokenValue: "stringofletters",
            name: "testName",
        },
        type: "zosmf",
        message: "",
        failNotFound: false,
    };
}

export function createNoAuthIProfile(): imperative.IProfileLoaded {
    return {
        name: "sestest",
        profile: {
            type: "zosmf",
            host: null,
            port: 1443,
            rejectUnauthorized: false,
            name: "testName",
        },
        type: "zosmf",
        message: "",
        failNotFound: false,
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
        failNotFound: false,
    };
}

export function createTreeView(selection?): vscode.TreeView<ZoweTreeProvider<any>> {
    const currSelection = selection ? selection : [];
    return {
        reveal: jest.fn(),
        onDidExpandElement: jest.fn(),
        onDidCollapseElement: jest.fn(),
        selection: currSelection,
        onDidChangeSelection: jest.fn(),
        visible: true,
        onDidChangeVisibility: jest.fn(),
        dispose: jest.fn(),
        addSingleSession: jest.fn(),
    } as unknown as vscode.TreeView<ZoweTreeProvider<any>>;
}

export function createTextDocument(name: string, sessionNode?: ZoweDatasetNode | ZoweUSSNode): vscode.TextDocument {
    const fileName = sessionNode ? `/${sessionNode.label}/${name}` : name;
    return {
        fileName,
        uri: vscode.Uri.parse(fileName),
        isUntitled: null,
        languageId: null,
        version: null,
        isDirty: null,
        isClosed: null,
        save: null,
        eol: 1,
        lineCount: null,
        lineAt: null,
        offsetAt: null,
        positionAt: jest.fn(),
        getText: jest.fn().mockReturnValue(""),
        getWordRangeAtPosition: null,
        validateRange: null,
        validatePosition: null,
    };
}

export function createInstanceOfProfile(profile: imperative.IProfileLoaded) {
    return {
        addToConfigArray: Profiles.prototype.addToConfigArray,
        allProfiles: [{ name: "sestest" }, { name: "profile1" }, { name: "profile2" }],
        defaultProfile: { name: "sestest" },
        getDefaultProfile: jest.fn(),
        promptCredentials: jest.fn(),
        loadNamedProfile: jest.fn().mockReturnValue(profile),
        usesSecurity: true,
        validProfile: Validation.ValidationType.VALID,
        checkCurrentProfile: jest.fn(() => {
            return { status: "active", name: "sestest" };
        }),
        profilesForValidation: [{ status: "active", name: "sestest" }],
        profileTypeConfigurations: MOCK_PROFILES,
        getConfigArray: () => MOCK_PROFILES,
        validateProfiles: jest.fn(),
        getBaseProfile: jest.fn(),
        enableValidationContext: jest.fn(),
        enableValidation: jest.fn(),
        disableValidationContext: jest.fn(),
        disableValidation: jest.fn(),
        getProfileSetting: jest.fn(),
        resetValidationSettings: jest.fn(),
        getValidSession: jest.fn(),
        editSession: jest.fn(),
        createZoweSession: jest.fn(),
        createNewConnection: jest.fn(() => {
            return { newprofile: "fake" };
        }),
        getProfiles: jest.fn(() => {
            return [
                { name: profile.name, profile },
                { name: profile.name, profile },
            ];
        }),
        refresh: jest.fn(),
        directLoad: jest.fn(),
        getAllTypes: jest.fn(),
        getProfileInfo: jest.fn(() => {
            return createInstanceOfProfileInfo();
        }),
        getDefaultConfigProfile: jest.fn(),
        getProfileFromConfig: jest.fn(),
        getProfileLoaded: jest.fn(),
        openConfigFile: jest.fn(),
        fetchAllProfiles: jest.fn(() => {
            return [{ name: "sestest" }, { name: "profile1" }, { name: "profile2" }];
        }),
        fetchAllProfilesByType: jest.fn(() => {
            return [{ name: "sestest" }];
        }),
        convertV1ProfToConfig: jest.fn(),
        getLoadedProfConfig: jest.fn(),
        getSecurePropsForProfile: jest.fn(),
    } as any;
}

export function createInstanceOfProfilesCache() {
    return {
        getProfileInfo: jest.fn().mockResolvedValue(createInstanceOfProfileInfo()),
        loadNamedProfile: jest.fn(),
    };
}

export function createInstanceOfProfileInfo() {
    return {
        getAllProfiles: () => [
            {
                profName: "sestest",
                profType: "zosmf",
                isDefaultProfile: true,
                profLoc: { locType: 0, osLoc: ["location"], jsonLoc: "jsonLoc" },
            },
            {
                profName: "profile1",
                profType: "zosmf",
                isDefaultProfile: false,
                profLoc: { locType: 0, osLoc: ["location"], jsonLoc: "jsonLoc" },
            },
            {
                profName: "profile2",
                profType: "zosmf",
                isDefaultProfile: false,
                profLoc: { locType: 0, osLoc: ["location"], jsonLoc: "jsonLoc" },
            },
        ],
        getDefaultProfile: () => [
            {
                profName: "sestest",
                profType: "zosmf",
                isDefaultProfile: true,
                profLoc: { locType: 0, osLoc: ["location"], jsonLoc: "jsonLoc" },
            },
        ],
        updateProperty: jest.fn(),
        updateKnownProperty: jest.fn(),
        createSession: jest.fn(),
        getTeamConfig: () => ({ exists: true }),
        mergeArgsForProfile: jest.fn().mockReturnValue({
            knownArgs: [
                {
                    argName: "user",
                    dataType: "string",
                    argValue: "fake",
                    argLoc: { locType: 0, osLoc: ["location"], jsonLoc: "jsonLoc" },
                    secure: false,
                },
                {
                    argName: "password",
                    dataType: "string",
                    argValue: "fake",
                    argLoc: { locType: 0, osLoc: ["location"], jsonLoc: "jsonLoc" },
                    secure: false,
                },
            ],
            missingArgs: [],
        }),
        mergeArgsForProfileType: jest.fn(),
        profAttrsToProfLoaded: jest.fn(),
        readProfilesFromDisk: jest.fn(),
        loadSecureArg: jest.fn(),
        initSessCfg: jest.fn(),
        getOsLocInfo: jest.fn(),
        getZoweDir: jest.fn(),
    } as any;
}

export function createFileResponse(theResponse) {
    return {
        success: true,
        commandResponse: "",
        apiResponse: theResponse,
    } as any;
}

export function createQuickPickItem(): vscode.QuickPickItem {
    return new FilterDescriptor("\uFF0B " + "Create a new filter");
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
        onDidHide: jest.fn(),
        onDidChangeValue: jest.fn(),
        dispose: jest.fn(),
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
        validationMessage: undefined,
        valueSelection: undefined,
    };
    return inputBox;
}

export function createWorkspaceConfiguration(): vscode.WorkspaceConfiguration {
    return {
        get: jest.fn(),
        update: jest.fn(),
        has: jest.fn(),
        inspect: jest.fn(),
    };
}

export function createQuickPickInstance(): vscode.QuickPick<vscode.QuickPickItem> {
    return {
        value: null,
        placeholder: createQuickPickItem(),
        items: undefined,
        show: jest.fn(),
        hide: jest.fn(),
        onDidAccept: jest.fn(),
        ignoreFocusOut: false,
        onDidHide: jest.fn(),
    } as any;
}

export function createConfigInstance() {
    return {
        load: jest.fn(),
    } as any;
}

export function createConfigLoad() {
    return {
        configName: "zowe.config.json",
        api: {
            layers: {
                merge: jest.fn(),
                activate: jest.fn(),
            },
        },
        layers: [
            {
                path: "file://globalPath/.zowe/zowe.config.json",
                exists: true,
                properties: undefined,
                global: true,
                user: false,
            },
            {
                path: "file://projectPath/zowe.config.user.json",
                exists: true,
                properties: undefined,
                global: false,
                user: true,
            },
        ],
        setSchema: jest.fn(),
        save: jest.fn(),
    } as any;
}

const originalGetDirectValue = SettingsConfig.getDirectValue;
export function createGetConfigMock(settings: { [key: string]: any }) {
    return jest.fn((key: string) => settings[key] ?? originalGetDirectValue(key));
}

export function createOutputChannel() {
    return {
        append: jest.fn(),
        name: "Zowe Explorer",
        appendLine: jest.fn(),
        clear: jest.fn(),
        show: jest.fn(),
        hide: jest.fn(),
        dispose: jest.fn(),
        replace: jest.fn(),
    } as vscode.OutputChannel;
}

export function createMockNode(name: string, context: string): IZoweTreeNode {
    return {
        dirty: false,
        getLabel: jest.fn(() => name),
        getChildren: jest.fn(),
        getParent: jest.fn(),
        getProfile: jest.fn(() => ({
            name,
            profile: {
                host: "fake",
                port: 999,
                rejectUnauthorize: false,
            },
            type: "zosmf",
            message: "",
            failNotFound: false,
        })),
        getProfileName: jest.fn(),
        getSession: jest.fn(),
        getSessionNode: jest.fn(),
        setProfileToChoice: jest.fn(),
        setSessionToChoice: jest.fn(),
        label: name,
        contextValue: context,
    };
}

export function createTreeProviders() {
    return {
        ds: {
            mSessionNodes: [
                createMockNode("zosmf", Constants.DS_SESSION_CONTEXT + Constants.VALIDATE_SUFFIX),
                createMockNode("zosmf2", Constants.DS_SESSION_CONTEXT + Constants.NO_VALIDATE_SUFFIX),
            ],
            deleteSession: jest.fn(),
            removeSession: jest.fn(),
            refresh: jest.fn(),
            addSingleSession: jest.fn(),
            refreshElement: jest.fn(),
        } as any,
        uss: {
            mSessionNodes: [
                createMockNode("zosmf", Constants.USS_SESSION_CONTEXT + Constants.VALIDATE_SUFFIX),
                createMockNode("zosmf2", Constants.USS_SESSION_CONTEXT + Constants.NO_VALIDATE_SUFFIX),
            ],
            deleteSession: jest.fn(),
            removeSession: jest.fn(),
            refresh: jest.fn(),
            addSingleSession: jest.fn(),
            refreshElement: jest.fn(),
            addEncodingHistory: jest.fn(),
            getEncodingHistory: jest.fn(),
        } as any,
        job: {
            mSessionNodes: [
                createMockNode("zosmf", Constants.JOBS_SESSION_CONTEXT + Constants.VALIDATE_SUFFIX),
                createMockNode("zosmf2", Constants.JOBS_SESSION_CONTEXT + Constants.NO_VALIDATE_SUFFIX),
            ],
            removeSession: jest.fn(),
            deleteSession: jest.fn(),
            refresh: jest.fn(),
            addSingleSession: jest.fn(),
        } as any,
    };
}
