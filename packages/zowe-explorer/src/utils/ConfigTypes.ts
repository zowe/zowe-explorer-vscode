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

import type { ConfigParseError } from "../webviews/src/config-editor/types";

export type { ConfigParseError };

/** Single change row sent from the config editor webview and applied via imperative. */
export type ChangeEntry = {
    key: string;
    value: string;
    path: string[];
    profile?: string;
    configPath: string;
    secure: boolean;
};

/** Incoming layer modification blob (before parseConfigChanges groups by configPath). */
export type LayerModifications = {
    configPath?: string;
    changes: ChangeEntry[];
    deletions: ChangeEntry[];
    defaultsChanges: ChangeEntry[];
    defaultsDeleteKeys: ChangeEntry[];
};

/** Profile tree node as stored under `profiles` (imperative IConfigProfile–compatible, loosely typed). */
export type ProfileTreeNode = Record<string, unknown>;

export type NestedProfilesMap = Record<string, unknown>;

/** Result of flattening nested profiles (dot keys → leaf profile object without nested `profiles`). */
export type FlattenedProfilesMap = Record<string, unknown>;

/** Pending change entry keyed by imperative-style path (used by profile validation). */
export interface PendingChangeEntry {
    value?: unknown;
    path?: string[];
    profile?: string;
    secure?: boolean;
    [key: string]: unknown;
}

export type PendingChangesByConfig = { [configPath: string]: { [key: string]: PendingChangeEntry } };

export type RenameMapByConfig = { [configPath: string]: { [originalKey: string]: string } };

/** Change row that may be updated by rename-aware path/key helpers. */
export interface PathAwareChange {
    key?: string;
    path?: string[];
    profile?: string;
    configPath?: string;
    [key: string]: unknown;
}

/** One profile rename operation from the webview. */
export interface ProfileRenameEntry {
    originalKey: string;
    newKey: string;
    configPath: string;
}

/** Layer row produced by ConfigEditor.getLocalConfigs() for the webview. */
export interface ConfigLayerDescriptor {
    configPath: string;
    properties: unknown;
    schema?: unknown;
    schemaValidation?: unknown;
    schemaPath?: string;
    global: boolean;
    user: boolean;
}

export interface LocalConfigsResult {
    configs: ConfigLayerDescriptor[];
    parseErrors: ConfigParseError[];
}

/** JSON Schema fragment shape used when walking Zowe profile schemas (loose). */
export type JsonSchemaFragment = Record<string, unknown>;

/** Property metadata under a profile type in generated schema validation. */
export interface SchemaProfilePropertyMeta {
    type?: string;
    description?: string;
    default?: unknown;
    secure?: boolean;
}

export type ProfileTypePropertySchemaMap = Record<string, SchemaProfilePropertyMeta>;

/** Webview → extension: generic message with command discriminator. */
export interface WebviewCommandMessage {
    command: string;
    [key: string]: unknown;
}

export interface OpenFilePathMessage {
    command?: string;
    filePath: string;
    line?: number;
    column?: number;
}

export interface InitialSelectionPayload {
    profileName: string;
    configPath: string;
    profileType?: string;
}

export interface LocalStorageKeyMessage {
    key: string;
}

export interface LocalStorageSetMessage {
    key: string;
    value: unknown;
}

export interface OpenVscodeSettingsMessage {
    searchText?: string;
}

export interface EnvVarsQueryMessage {
    query?: string;
}

export interface SelectFileMessage {
    propertyIndex?: number;
    isNewProperty?: boolean;
    source?: string;
    fullKey?: string;
    configPath?: string;
}

export interface CreateNewConfigMessage {
    configType: string;
}

export interface ValidateProfileNameMessage {
    profileName: string;
    rootProfile: string;
    configPath: string;
    profiles: NestedProfilesMap;
    pendingChanges: PendingChangesByConfig;
    renames: RenameMapByConfig;
}

/** VS Code webview panel postMessage target. */
export type WebviewPostMessageTarget = {
    postMessage: (message: object) => Thenable<boolean>;
};

/** Layer edits from webview (save or merged-properties simulation) without command field. */
export interface LayerChangesPayload {
    configPath?: string;
    changes?: ChangeEntry[];
    deletions?: ChangeEntry[];
    defaultsChanges?: ChangeEntry[];
    defaultsDeleteKeys?: ChangeEntry[];
}

/** SAVE_CHANGES payload from webview (changes carry configPath; optional renames / autostore). */
export interface SaveChangesMessage extends WebviewCommandMessage, LayerChangesPayload {
    renames?: ProfileRenameEntry[];
    otherChanges?: AutostoreToggleChange[];
}

export interface AutostoreToggleChange {
    type: "autostore";
    configPath: string;
    value: unknown;
}

/** Imperative merge-args item (knownArgs) used when applying secure precedence / redaction. */
export type MergedKnownArg = Record<string, unknown> & {
    argLoc?: { jsonLoc?: string; osLoc?: string[] };
    secure?: boolean;
    argValue?: unknown;
    value?: unknown;
};
