/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 * SPDX-License-Identifier: EPL-2.0
 * Copyright Contributors to the Zowe Project.
 */

import type { ConfigEditorSettings } from "../types";
import type { EditorData } from "./types";

export const CONFIG_EDITOR_SETTINGS_KEY = "zowe.configEditor.settings";

export function createDefaultEditorSettings(): ConfigEditorSettings {
    return {
        showMergedProperties: "show",
        viewMode: "tree",
        propertySortOrder: "alphabetical",
        profileSortOrder: "natural",
        profilesWidthPercent: 35,
        defaultsCollapsed: true,
        profilesCollapsed: false,
    };
}

/** Create fresh collections for each editor instance. */
export function createEditorData(): EditorData {
    return {
        // Search
        profileSearchTerm: "",
        profileFilterType: null,

        // Preferences
        configEditorSettings: createDefaultEditorSettings(),
        sortOrderVersion: 0,

        // Selection
        selectedTab: null,
        selectedProfileKey: null,
        selectedProfilesByConfig: {},
        expandedNodesByConfig: {},

        // Configurations
        configurations: [],
        schemaValidations: {},
        configParseErrors: [],
        hasWorkspace: false,
        secureValuesAllowed: true,

        // Drafts
        pendingChanges: {},
        pendingDefaults: {},
        deletions: {},
        defaultsDeletions: {},
        renames: {},
        dragDroppedProfiles: {},
        autostoreChanges: {},
        hiddenItems: {},

        // History
        undoStack: [],
        redoStack: [],

        // Clipboard
        profileClipboard: null,

        // Lifecycle
        isSaving: false,
        pendingSaveSelection: null,
        saveModalOpen: false,

        // Merged properties
        mergedProperties: null,
        pendingMergedPropertiesRequest: null,
        mergedPropertiesRequestSeq: 0,

        // Wizard
        wizardModalOpen: false,
        wizardRootProfile: "root",
        wizardSelectedType: "",
        wizardProfileName: "",
        wizardProperties: [],
        wizardShowKeyDropdown: false,
        wizardNewPropertyKey: "",
        wizardNewPropertyValue: "",
        wizardNewPropertySecure: false,
        wizardMergedProperties: {},
        wizardPopulatedDefaults: new Set(),
        wizardProfileNameValidation: { isValid: true },
        validationRequestSeq: 0,
        wizardMergedPropertiesRequestSeq: 0,

        // Dialogs
        newProfileKeyPath: null,
        newProfileKey: "",
        newProfileValue: "",
        newProfileModalOpen: false,
        focusValueInput: false,
        newLayerModalOpen: false,
        newLayerName: "",
        newLayerPath: null,
        isSecure: false,
        showDropdown: false,
        addConfigModalOpen: false,
        hasPromptedForZeroConfigs: false,
        pendingPropertyDeletion: null,
        pendingProfileDeletion: null,
        renameProfileModalOpen: false,
        profileMenuOpen: null,

        // Tutorial
        showTutorial: false,
        tutorialSeen: false,
        highlightPropertyKey: null,
        highlightProfileCard: false,
    };
}
