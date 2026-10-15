/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 * SPDX-License-Identifier: EPL-2.0
 * Copyright Contributors to the Zowe Project.
 */

import type {
    ConfigEditorSettings,
    Configuration,
    SchemaValidationsMap,
    ConfigParseError,
    PendingChangesMap,
    PendingDefaultsMap,
    DeletionsMap,
    RenamesMap,
    ProfileClipboard,
    MergedPropertiesMap,
    PendingChange,
} from "../types";
import type { HistoryEntry } from "../utils/undoHistory";
import type { ConfigEditorWebviewApi } from "../handlers/messageHandlers";

export interface SearchState {
    profileSearchTerm: string;
    profileFilterType: string | null;
}

export interface PreferencesState {
    configEditorSettings: ConfigEditorSettings;
    sortOrderVersion: number;
}

export interface SelectionState {
    selectedTab: number | null;
    selectedProfileKey: string | null;
    selectedProfilesByConfig: Record<string, string | null>;
    expandedNodesByConfig: Record<string, Set<string>>;
}

export interface ConfigurationsState {
    configurations: Configuration[];
    schemaValidations: SchemaValidationsMap;
    configParseErrors: ConfigParseError[];
    hasWorkspace: boolean;
    secureValuesAllowed: boolean;
}

export interface DraftsState {
    pendingChanges: PendingChangesMap;
    pendingDefaults: PendingDefaultsMap;
    deletions: DeletionsMap;
    defaultsDeletions: DeletionsMap;
    renames: RenamesMap;
    dragDroppedProfiles: Record<string, Set<string>>;
    autostoreChanges: Record<string, boolean>;
    hiddenItems: Record<string, Record<string, { path: string }>>;
}

export interface HistoryState {
    undoStack: HistoryEntry[];
    redoStack: HistoryEntry[];
}

export interface ClipboardState {
    profileClipboard: ProfileClipboard | null;
}

export interface LifecycleState {
    isSaving: boolean;
    pendingSaveSelection: { tab: number | null; profile: string | null } | null;
    saveModalOpen: boolean;
}

export interface MergedPropertiesState {
    mergedProperties: MergedPropertiesMap | null;
    pendingMergedPropertiesRequest: string | null;
    mergedPropertiesRequestSeq: number;
}

export interface WizardState {
    wizardModalOpen: boolean;
    wizardRootProfile: string;
    wizardSelectedType: string;
    wizardProfileName: string;
    wizardProperties: { key: string; value: PendingChange["value"]; secure?: boolean }[];
    wizardShowKeyDropdown: boolean;
    wizardNewPropertyKey: string;
    wizardNewPropertyValue: string;
    wizardNewPropertySecure: boolean;
    wizardMergedProperties: MergedPropertiesMap;
    wizardPopulatedDefaults: Set<string>;
    wizardProfileNameValidation: { isValid: boolean; message?: string };
    validationRequestSeq: number;
    wizardMergedPropertiesRequestSeq: number;
}

export interface DialogsState {
    newProfileKeyPath: string[] | null;
    newProfileKey: string;
    newProfileValue: string;
    newProfileModalOpen: boolean;
    focusValueInput: boolean;
    newLayerModalOpen: boolean;
    newLayerName: string;
    newLayerPath: string[] | null;
    isSecure: boolean;
    showDropdown: boolean;
    addConfigModalOpen: boolean;
    hasPromptedForZeroConfigs: boolean;
    pendingPropertyDeletion: string | null;
    pendingProfileDeletion: string | null;
    renameProfileModalOpen: boolean;
    profileMenuOpen: string | null;
}

export interface TutorialState {
    showTutorial: boolean;
    tutorialSeen: boolean;
    highlightPropertyKey: string | null;
    highlightProfileCard: boolean;
}

export type EditorData = SearchState &
    PreferencesState &
    SelectionState &
    ConfigurationsState &
    DraftsState &
    HistoryState &
    ClipboardState &
    LifecycleState &
    MergedPropertiesState &
    WizardState &
    DialogsState &
    TutorialState;
export type StateUpdate<T> = T | ((previous: T) => T);
export type FieldSetters<T> = { [K in keyof T & string as `set${Capitalize<K>}`]: (value: StateUpdate<T[K]>) => void };
export interface EditorCoreActions {
    vscodeApi: ConfigEditorWebviewApi;
    transaction: <T>(action: () => T, recordHistory?: boolean) => T;
    undo: () => void;
    redo: () => void;
    clearHistory: () => void;
    setLocalStorageValue: (key: string, value: unknown) => void;
    setShowMergedPropertiesWithStorage: (value: EditorData["configEditorSettings"]["showMergedProperties"]) => void;
    setViewModeWithStorage: (value: EditorData["configEditorSettings"]["viewMode"]) => void;
    setPropertySortOrderWithStorage: (value: EditorData["configEditorSettings"]["propertySortOrder"]) => void;
    setProfileSortOrderWithStorage: (value: EditorData["configEditorSettings"]["profileSortOrder"]) => void;
    setDefaultsCollapsedWithStorage: (value: boolean) => void;
    setProfilesCollapsedWithStorage: (value: boolean) => void;
    toggleViewMode: () => void;
}
export type EditorRuntime = EditorData & FieldSetters<EditorData> & EditorCoreActions;
