/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 */

export type Configuration = {
    configPath: string;
    properties: any;
    secure: string[];
    global?: boolean;
    user?: boolean;
    schemaPath?: string;
};

/** A team config layer file that failed to load (JSON parse, schema read, etc.). */
export type ConfigParseError = {
    configPath: string;
    message: string;
    line?: number;
    column?: number;
};

export type PendingChange = {
    value: string | number | boolean | Record<string, any>;
    path: string[];
    profile: string;
    secure?: boolean;
};

export type PendingChanges = {
    [configPath: string]: {
        [key: string]: PendingChange;
    };
};

export type PendingDefault = {
    value: string;
    path: string[];
};

export interface FlattenedConfig {
    [key: string]: { value: string; path: string[] };
}

import type { schemaValidation as SchemaValidationType } from "../../../utils/ConfigSchemaHelpers";
export type { SchemaValidationType as schemaValidation };

export type PropertySortOrder = "alphabetical" | "merged-first" | "non-merged-first";
export type ProfileSortOrder = "natural" | "alphabetical" | "reverse-alphabetical" | "type" | "defaults";

export type MergedPropertiesVisibility = "show" | "hide" | "unfiltered";

export interface ConfigEditorSettings {
    showMergedProperties: MergedPropertiesVisibility;
    viewMode: "flat" | "tree";
    propertySortOrder: "alphabetical" | "merged-first" | "non-merged-first";
    profileSortOrder: "natural" | "alphabetical" | "reverse-alphabetical" | "type" | "defaults";
    profilesWidthPercent: number;
    defaultsCollapsed: boolean;
    profilesCollapsed: boolean;
}

export interface ConfigMoveAPI {
    get: (path: string) => any;
    set: (path: string, value: any) => void;
    delete: (path: string) => void;
}

export interface IConfigLayer {
    properties: {
        profiles: { [key: string]: any };
        defaults?: { [key: string]: string };
    };
}

export type RenamesMap = { [configPath: string]: { [originalKey: string]: string } };
export type DeletionsMap = { [configPath: string]: string[] };
export type PendingChangesMap = { [configPath: string]: { [key: string]: PendingChange } };
export type PendingDefaultsMap = { [configPath: string]: { [key: string]: PendingDefault } };
export type SchemaValidationsMap = { [configPath: string]: SchemaValidationType | undefined };

export interface ProfileSchemaEntry {
    type?: string;
    description?: string;
    default?: unknown;
    secure?: boolean;
}

export type ProfileSchemaMap = Record<string, Record<string, ProfileSchemaEntry>>;

export interface ConfigStateContext {
    selectedTab: number | null;
    configurations: Configuration[];
    pendingChanges: PendingChangesMap;
    renames: RenamesMap;
}

export interface SchemaContext extends ConfigStateContext {
    schemaValidations: SchemaValidationsMap;
}

export interface FullConfigContext extends SchemaContext {
    deletions: DeletionsMap;
}

export interface RenameChange {
    configPath: string;
    originalKey: string;
    newKey: string;
}

export interface FormattedChange {
    key: string;
    value?: string | number | boolean | Record<string, any>;
    path?: string[];
    profile?: string;
    configPath: string;
    secure?: boolean;
}

export interface ProfileData {
    type?: string;
    properties?: Record<string, unknown>;
    profiles?: Record<string, ProfileData>;
    secure?: string[];
}

export type ProfileMap = Record<string, ProfileData>;

export interface MergedPropertyData {
    value: unknown;
    jsonLoc?: string;
    osLoc?: string[];
    secure?: boolean;
}

export type MergedPropertiesMap = Record<string, MergedPropertyData>;
