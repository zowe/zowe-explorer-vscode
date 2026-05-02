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
import { vi } from "vitest";

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
import { Definitions } from "../../../src/configuration/Definitions";

const MOCK_PROFILES = [];

export function createPersistentConfig(): Partial<Definitions.ZowePersistentFilter> & Partial<vscode.Memento> {
    return {
        persistence: true,
        get: (): Partial<Definitions.ZowePersistentFilter> => {
            return {
                sessions: ["sestest", "profile1", "profile2"],
                favorites: ["[sestest]: TEST.PDS", "[profile1]: /u/myuser.txt{textFile}", "[profile2]: /u/myuser"],
            };
        },
        update: vi.fn(() => {
            return {};
        }) as any,
    };
}

export function createUnsecureTeamConfigMock(): imperative.IConfig {
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

export function createTeamConfigMock(): imperative.IConfig {
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

export function createISession(): imperative.Session {
    return new imperative.Session({
        user: "fake",
        password: "fake",
        hostname: "fake",
        port: 1443,
        protocol: "https",
        type: "basic",
    });
}

export function createISessionWithoutCredentials(): imperative.Session {
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
        reveal: vi.fn(),
        onDidExpandElement: vi.fn(),
        onDidCollapseElement: vi.fn(),
        selection: currSelection,
        onDidChangeSelection: vi.fn(),
        visible: true,
        onDidChangeVisibility: vi.fn(),
        dispose: vi.fn(),
        addSingleSession: vi.fn(),
        setStatusForSession: vi.fn(),
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
        positionAt: vi.fn(),
        getText: vi.fn().mockReturnValue(""),
        getWordRangeAtPosition: null,
        validateRange: null,
        validatePosition: null,
    };
}

export function createInstanceOfProfile(profile: imperative.IProfileLoaded) {
    return {
        addToConfigArray: Profiles.prototype.addToConfigArray,
        allProfiles: [profile],
        defaultProfile: { name: "sestest" },
        getDefaultProfile: vi.fn(),
        promptCredentials: vi.fn(),
        loadNamedProfile: vi.fn(function (this: any, profileName: string) {
            const match: imperative.IProfileLoaded | undefined = this.allProfiles?.find(
                (prof: imperative.IProfileLoaded) => prof.name === profileName
            );
            return match ?? profile;
        }),
        usesSecurity: true,
        validProfile: Validation.ValidationType.VALID,
        checkCurrentProfile: vi.fn(() => {
            return { status: "active", name: "sestest" };
        }),
        profilesForValidation: [{ status: "active", name: "sestest" }],
        profileTypeConfigurations: MOCK_PROFILES,
        getConfigArray: () => MOCK_PROFILES,
        validateProfiles: vi.fn(),
        getBaseProfile: vi.fn(),
        enableValidationContext: vi.fn(),
        enableValidation: vi.fn(),
        disableValidationContext: vi.fn(),
        disableValidation: vi.fn(),
        getProfileSetting: vi.fn(),
        resetValidationSettings: vi.fn(),
        getValidSession: vi.fn(),
        editSession: vi.fn(),
        createZoweSession: vi.fn(),
        createNewConnection: vi.fn(() => {
            return { newprofile: "fake" };
        }),
        getProfiles: vi.fn(() => {
            return [
                { name: profile.name, profile },
                { name: profile.name, profile },
            ];
        }),
        refresh: vi.fn(),
        directLoad: vi.fn(),
        getAllTypes: vi.fn(),
        getProfileInfo: vi.fn(() => {
            return createInstanceOfProfileInfo();
        }),
        getDefaultConfigProfile: vi.fn(),
        getProfileFromConfig: vi.fn(),
        getProfileLoaded: vi.fn(),
        openConfigFile: vi.fn(),
        fetchAllProfiles: vi.fn(() => {
            return [{ name: "sestest" }, { name: "profile1" }, { name: "profile2" }];
        }),
        fetchAllProfilesByType: vi.fn(() => {
            return [{ name: "sestest" }];
        }),
        convertV1ProfToConfig: vi.fn(),
        getLoadedProfConfig: vi.fn(),
        shouldRemoveTokenFromProfile: vi.fn(),
        getPropsForProfile: vi.fn(),
        showProfileInactiveMsg: vi.fn(),
        getConfigLayers: vi.fn(),
        resolveTypePromise: vi.fn(() => Promise.resolve()),
    } as any;
}

export function createInstanceOfProfilesCache() {
    return {
        getProfileInfo: vi.fn().mockResolvedValue(createInstanceOfProfileInfo()),
        loadNamedProfile: vi.fn(),
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
        hasTokenExpiredForProfile: vi.fn(),
        updateProperty: vi.fn(),
        updateKnownProperty: vi.fn(),
        createSession: vi.fn(),
        getTeamConfig: () => ({
            api: {
                secure: {
                    securePropsForProfile: vi.fn().mockReturnValue([]),
                },
            },
            exists: true,
        }),
        mergeArgsForProfile: vi.fn().mockReturnValue({
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
        mergeArgsForProfileType: vi.fn(),
        profAttrsToProfLoaded: vi.fn(),
        readProfilesFromDisk: vi.fn(),
        loadSecureArg: vi.fn(),
        initSessCfg: vi.fn(),
        getOsLocInfo: vi.fn(),
        getZoweDir: vi.fn(),
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
        show: vi.fn(),
        hide: vi.fn(),
        onDidAccept: vi.fn(),
        onDidHide: vi.fn(),
        onDidChangeValue: vi.fn(),
        dispose: vi.fn(),
    };
}

export function createInputBox(value: string): any {
    const inputBox: vscode.InputBox = {
        value,
        title: null,
        enabled: true,
        busy: false,
        show: vi.fn(),
        hide: vi.fn(),
        step: null,
        dispose: vi.fn(),
        ignoreFocusOut: false,
        totalSteps: null,
        placeholder: undefined,
        password: false,
        onDidChangeValue: vi.fn(),
        onDidAccept: vi.fn(),
        onDidHide: vi.fn(),
        buttons: [],
        onDidTriggerButton: vi.fn(),
        prompt: undefined,
        validationMessage: undefined,
        valueSelection: undefined,
    };
    return inputBox;
}

export function createWorkspaceConfiguration(): vscode.WorkspaceConfiguration {
    return {
        get: vi.fn(),
        update: vi.fn(),
        has: vi.fn(),
        inspect: vi.fn(),
    };
}

export function createQuickPickInstance(): vscode.QuickPick<vscode.QuickPickItem> {
    return {
        value: null,
        placeholder: createQuickPickItem(),
        items: undefined,
        show: vi.fn(),
        hide: vi.fn(),
        onDidAccept: vi.fn(),
        ignoreFocusOut: false,
        onDidHide: vi.fn(),
    } as any;
}

export function createConfigInstance() {
    return {
        load: vi.fn(),
    } as any;
}

export function createConfigLoad() {
    return {
        configName: "zowe.config.json",
        api: {
            layers: {
                merge: vi.fn(),
                activate: vi.fn(),
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
        setSchema: vi.fn(),
        save: vi.fn(),
    } as any;
}

const originalGetDirectValue = SettingsConfig.getDirectValue;
export function createGetConfigMock(settings: { [key: string]: any }) {
    return vi.fn((key: string) => settings[key] ?? originalGetDirectValue(key));
}

export function createOutputChannel() {
    return {
        append: vi.fn(),
        name: "Zowe Explorer",
        appendLine: vi.fn(),
        clear: vi.fn(),
        show: vi.fn(),
        hide: vi.fn(),
        dispose: vi.fn(),
        replace: vi.fn(),
    } as vscode.OutputChannel;
}

export function createMockNode(name: string, context: string): IZoweTreeNode {
    return {
        dirty: false,
        getLabel: vi.fn(() => name),
        getChildren: vi.fn(),
        getParent: vi.fn(),
        getProfile: vi.fn(() => ({
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
        getProfileName: vi.fn(),
        getSession: vi.fn(),
        getSessionNode: vi.fn(),
        setProfileToChoice: vi.fn(),
        setSessionToChoice: vi.fn(),
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
            mFavorites: [],
            deleteSession: vi.fn(),
            removeSession: vi.fn(),
            refresh: vi.fn(),
            addSingleSession: vi.fn(),
            setStatusForSession: vi.fn(),
            refreshElement: vi.fn(),
        } as any,
        uss: {
            mSessionNodes: [
                createMockNode("zosmf", Constants.USS_SESSION_CONTEXT + Constants.VALIDATE_SUFFIX),
                createMockNode("zosmf2", Constants.USS_SESSION_CONTEXT + Constants.NO_VALIDATE_SUFFIX),
            ],
            mFavorites: [],
            deleteSession: vi.fn(),
            removeSession: vi.fn(),
            refresh: vi.fn(),
            addSingleSession: vi.fn(),
            setStatusForSession: vi.fn(),
            refreshElement: vi.fn(),
            addEncodingHistory: vi.fn(),
            getEncodingHistory: vi.fn(),
        } as any,
        job: {
            mSessionNodes: [
                createMockNode("zosmf", Constants.JOBS_SESSION_CONTEXT + Constants.VALIDATE_SUFFIX),
                createMockNode("zosmf2", Constants.JOBS_SESSION_CONTEXT + Constants.NO_VALIDATE_SUFFIX),
            ],
            mFavorites: [],
            removeSession: vi.fn(),
            deleteSession: vi.fn(),
            refresh: vi.fn(),
            addSingleSession: vi.fn(),
            setStatusForSession: vi.fn(),
        } as any,
    };
}
