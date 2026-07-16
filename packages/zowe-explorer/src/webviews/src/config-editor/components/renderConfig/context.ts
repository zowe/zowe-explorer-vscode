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

import type { Configuration, PendingChange, MergedPropertiesVisibility, PropertySortOrder, schemaValidation } from "../../types";
import type { ConfigEditorWebviewApi } from "../../handlers/messageHandlers";

/**
 * The set of handlers, context values and derived flags shared by every node of the
 * config tree. Assembled once by `RenderConfig` and threaded through the recursive
 * `ConfigEntries` renderer and its leaf components, so individual components don't each
 * re-declare 25+ props.
 */
export interface RenderConfigCtx {
    // Handlers supplied by the parent (RenderProfileDetails).
    handleChange: (key: string, value: string) => void;
    handleDeleteProperty: (fullKey: string, secure?: boolean) => void;
    confirmDeleteProperty: (fullKey: string, secure?: boolean) => void;
    pendingPropertyDeletion: string | null;
    setPendingPropertyDeletion: (key: string | null) => void;
    handleUnlinkMergedProperty: (propertyKey: string | undefined, fullKey: string) => void;
    handleNavigateToSource: (jsonLoc: string, osLoc?: string[]) => void;
    handleToggleSecure: (fullKey: string, displayKey: string, path: string[], value: any) => void;
    openAddProfileModalAtPath: (path: string[], key?: string, value?: string) => void;
    getWizardTypeOptions: () => string[];
    propertyDescriptions: { [key: string]: string };

    // Merge / secure helpers (partially-applied pure utils supplied by the parent).
    mergePendingChangesForProfile: (baseObj: any, path: string[], configPath: string) => any;
    mergeMergedProperties: (combinedConfig: any, path: string[], mergedProps: any, configPath: string) => any;
    ensureProfileProperties: (combinedConfig: any, path: string[]) => any;
    filterSecureProperties: (value: any, combinedConfig: any, configPath?: string, pendingChanges?: any, deletions?: any, mergedProps?: any) => any;
    mergePendingSecureProperties: (
        value: any[],
        path: string[],
        configPath: string,
        pendingChanges: { [configPath: string]: { [key: string]: PendingChange } },
        renames?: { [configPath: string]: { [originalKey: string]: string } }
    ) => any[];
    isCurrentProfileUntyped: () => boolean;
    isPropertyFromMergedProps: (displayKey: string | undefined, path: string[], mergedProps: any, configPath: string) => boolean;
    isPropertySecure: (
        fullKey: string,
        displayKey: string,
        path: string[],
        mergedProps?: any,
        selectedTab?: number | null,
        configurations?: Configuration[],
        pendingChanges?: { [configPath: string]: { [key: string]: PendingChange } },
        renames?: { [configPath: string]: { [originalKey: string]: string } }
    ) => boolean;
    canPropertyBeSecure: (displayKey: string, path: string[]) => boolean;
    isMergedPropertySecure: (displayKey: string, jsonLoc: string, _osLoc?: string[], secure?: boolean) => boolean;

    // Values read from ConfigContext.
    configurations: Configuration[];
    selectedTab: number | null;
    pendingChanges: { [configPath: string]: { [key: string]: PendingChange } };
    deletions: { [configPath: string]: string[] };
    renames: { [configPath: string]: { [originalKey: string]: string } };
    schemaValidations: { [configPath: string]: schemaValidation | undefined };
    hiddenItems: { [configPath: string]: { [key: string]: { path: string } } };
    secureValuesAllowed: boolean;
    selectedProfileKey: string | null;
    vscodeApi: ConfigEditorWebviewApi;
    showMergedProperties: MergedPropertiesVisibility;
    propertySortOrder: PropertySortOrder;
    setPropertySortOrderWithStorage: (value: PropertySortOrder) => void;
    setShowMergedPropertiesWithStorage: (value: MergedPropertiesVisibility) => void;

    // Derived once per render.
    isUntypedProfile: boolean;
}
