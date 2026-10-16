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

import type {
    ConfigurationWithSchema,
    schemaValidation,
    ConfigParseError,
    ConfigEditorSettings,
    MergedPropertiesMap,
    MergedArgItem,
    MergedPropertiesMessagePayload,
} from "../types";
import { CONFIG_EDITOR_SETTINGS_KEY, createDefaultEditorSettings } from "../store/initialization";
import type { EditorStore } from "../store/editorStore";

/** Minimal VS Code webview API used by message handlers (postMessage to extension host). */
export interface ConfigEditorWebviewApi {
    postMessage: (message: object) => void;
}

interface ConfigurationsMessagePayload {
    contents: ConfigurationWithSchema[];
    parseErrors?: ConfigParseError[];
    secureValuesAllowed?: boolean;
    tutorialSeen?: boolean;
}

// Handle CONFIGURATIONS message
export const handleConfigurationsMessage = (data: ConfigurationsMessagePayload, store: EditorStore) => {
    const props = store.getState();
    const {
        setConfigurations,
        setSecureValuesAllowed,
        setSchemaValidations,
        pendingSaveSelection,
        setSelectedTab,
        setSelectedProfileKey,
        setPendingSaveSelection,
        setIsSaving,
        setSortOrderVersion,
        setSelectedProfilesByConfig,
        vscodeApi,
        hasPromptedForZeroConfigs,
        setHasPromptedForZeroConfigs,
        setAddConfigModalOpen,
        setConfigParseErrors,
    } = props;

    const { contents, secureValuesAllowed, parseErrors, tutorialSeen } = data;
    if (tutorialSeen !== undefined) {
        props.setTutorialSeen(tutorialSeen);
        if (!tutorialSeen) {
            props.setShowTutorial(true);
        }
    }
    const parseErrorList: ConfigParseError[] = parseErrors ?? [];
    setConfigParseErrors(parseErrorList);
    const previousConfigurations = props.configurations;
    setConfigurations(
        contents.map((config) =>
            props.hasPendingChanges()
                ? {
                      ...config,
                      revision: previousConfigurations.find((previous) => previous.configPath === config.configPath)?.revision ?? config.revision,
                  }
                : config
        )
    );
    const newSecureValuesAllowed = secureValuesAllowed !== undefined ? secureValuesAllowed : true;
    setSecureValuesAllowed(newSecureValuesAllowed);

    const newSchemaValidations: { [configPath: string]: schemaValidation | undefined } = {};
    contents.forEach((config) => {
        newSchemaValidations[config.configPath] = config.schemaValidation;
    });
    setSchemaValidations(newSchemaValidations);

    const newValidDefaults: { [configPath: string]: string[] } = {};
    contents.forEach((config) => {
        newValidDefaults[config.configPath] = config.schemaValidation?.validDefaults || [];
    });

    // Any CONFIGURATIONS message means a prior save/refresh round-trip has completed.
    setIsSaving(false);

    const resolveSelectedTab = (previousTab: number | null): number | null => {
        if (!pendingSaveSelection && contents.length > previousConfigurations.length) {
            const previousPaths = new Set(previousConfigurations.map((config) => config.configPath));
            const addedIndex = contents.findIndex((config) => !previousPaths.has(config.configPath));
            if (addedIndex !== -1) return addedIndex;
        }
        // Layer priority can change the array order. Preserve the selected file, rather than its old index.
        const previousPath = previousTab !== null ? previousConfigurations[previousTab]?.configPath : undefined;
        const retainedIndex = contents.findIndex((config) => config.configPath === previousPath);
        return retainedIndex !== -1 ? retainedIndex : contents.length > 0 ? 0 : null;
    };

    // Check if we have pending save selection to restore
    if (pendingSaveSelection) {
        setSelectedTab(resolveSelectedTab(pendingSaveSelection.tab));
        setSelectedProfileKey(pendingSaveSelection.profile);
        setPendingSaveSelection(null);
        // Increment sort order version to trigger re-render with updated merged properties after save
        setSortOrderVersion((prev) => prev + 1);
    } else {
        setSelectedTab(resolveSelectedTab);
    }

    // Initialize selected profiles for each configuration if not already set.
    // Use the functional updater form so we read the latest state (not the stale
    // closure value) — this prevents overwriting a selection that was just applied
    // by INITIAL_SELECTION before this CONFIGURATIONS message was processed.
    setSelectedProfilesByConfig((prev) => {
        const next = { ...prev };
        let changed = false;
        contents.forEach((config) => {
            if (!(config.configPath in next)) {
                next[config.configPath] = null;
                changed = true;
            }
        });
        return changed ? next : prev;
    });

    // Send ready message to ConfigEditor after configurations are processed
    vscodeApi.postMessage({ command: "CONFIGURATIONS_READY" });

    // If there are no configurations and we haven't prompted yet, automatically open the add config modal
    if (contents.length === 0 && !hasPromptedForZeroConfigs && parseErrorList.length === 0) {
        setAddConfigModalOpen(true);
        setHasPromptedForZeroConfigs(true);
    } else if (contents.length > 0) {
        // Reset the flag when configurations are loaded
        setHasPromptedForZeroConfigs(false);
    }
};

// Handle DISABLE_OVERLAY message
export const handleDisableOverlayMessage = (store: EditorStore) => {
    const props = store.getState();
    const { setSaveModalOpen } = props;
    setSaveModalOpen(false);
};

interface SaveErrorMessagePayload {
    error?: string;
}

// Handle SAVE_ERROR message
export const handleSaveErrorMessage = (data: SaveErrorMessagePayload, store: EditorStore) => {
    const props = store.getState();
    const { setRenames, setIsSaving, setSaveModalOpen } = props;
    console.log("[SAVE_ERROR] Rolling back renames due to save error", JSON.stringify({ error: data.error }, null, 2));
    setRenames({});
    setIsSaving(false);
    setSaveModalOpen(false);
};

/**
 * Convert string values back to their proper types based on dataType
 */
function convertValueToProperType(value: unknown, dataType?: string): unknown {
    if (dataType === "boolean") {
        if (typeof value === "string") {
            return value.toLowerCase() === "true";
        }
        return Boolean(value);
    } else if (dataType === "number") {
        if (typeof value === "string") {
            const num = Number(value);
            return isNaN(num) ? value : num;
        }
        return value;
    }
    // For other types (string, object, etc.), return as-is
    return value;
}

// Handle MERGED_PROPERTIES message
export const handleMergedPropertiesMessage = (data: MergedPropertiesMessagePayload, store: EditorStore) => {
    const props = store.getState();
    const { setMergedProperties, setPendingMergedPropertiesRequest, mergedPropertiesRequestSeq } = props;

    const responseSeq = data.mergedPropertiesRequestSeq;
    if (responseSeq !== undefined && responseSeq !== mergedPropertiesRequestSeq) {
        return;
    }

    if (data.error) {
        console.error("Failed to get merged properties:", data.error);
        setMergedProperties(null);
        setPendingMergedPropertiesRequest(null);
        return;
    }

    // Store the full merged properties data including jsonLoc and osLoc information
    const mergedPropsData: MergedPropertiesMap = {};
    if (Array.isArray(data.mergedArgs)) {
        data.mergedArgs.forEach((item: MergedArgItem) => {
            if (item.argName && item.argValue !== undefined) {
                // Convert the value to its proper type based on dataType
                const correctValue = convertValueToProperType(item.argValue, item.dataType);

                mergedPropsData[item.argName] = {
                    value: correctValue,
                    jsonLoc: item.argLoc?.jsonLoc,
                    osLoc: item.argLoc?.osLoc,
                    secure: item.secure,
                };
            }
        });
    }

    setMergedProperties(mergedPropsData);

    // Clear the pending request since we received the response
    setPendingMergedPropertiesRequest(null);
};

interface FileSelectedMessagePayload {
    filePath?: string;
    isNewProperty?: boolean;
    source?: string;
    fullKey?: string;
}

// Handle FILE_SELECTED message
export const handleFileSelectedMessage = (data: FileSelectedMessagePayload, store: EditorStore) => {
    const props = store.getState();
    const { setNewProfileValue, handleChange } = props;

    // Handle file selection response from VS Code
    if (data.filePath) {
        if (data.isNewProperty) {
            // Update the add profile modal value
            setNewProfileValue(data.filePath);
        } else if (data.source === "editor" && data.fullKey) {
            // Update the property value in the main editor using handleChange
            handleChange(data.fullKey, data.filePath);
        }
    }
};

interface EnvInformationMessagePayload {
    hasWorkspace?: boolean;
}

// Handle ENV_INFORMATION message
export const handleEnvInformationMessage = (data: EnvInformationMessagePayload, store: EditorStore) => {
    const props = store.getState();
    const { setHasWorkspace } = props;
    setHasWorkspace(data.hasWorkspace ?? false);
};

interface InitialSelectionMessagePayload {
    profileName: string;
    configPath: string;
    propertyKey?: string;
}

// Handle INITIAL_SELECTION message
export const handleInitialSelectionMessage = (data: InitialSelectionMessagePayload, store: EditorStore) => {
    const props = store.getState();
    const {
        setSelectedTab,
        setSelectedProfileKey,
        setSelectedProfilesByConfig,
        setHighlightPropertyKey,
        setHighlightProfileCard,
        setConfigEditorSettings,
    } = props;

    // Handle initial profile selection when opening the config editor
    const { profileName, configPath, propertyKey } = data;

    // Use the configurations from the ref to avoid state timing issues
    const currentConfigs = props.configurations;

    // Find the config tab that contains this profile.
    // Normalize paths for comparison to handle different path separator styles.
    const normalizedTargetPath = configPath.replace(/\\/g, "/").toLowerCase();
    const configIndex = currentConfigs.findIndex((config) => {
        const normalizedConfigPath = config.configPath.replace(/\\/g, "/").toLowerCase();
        return normalizedConfigPath === normalizedTargetPath;
    });

    if (configIndex !== -1) {
        setSelectedTab(configIndex);

        if (profileName) {
            // Ensure the profiles panel is expanded so the selected profile and its
            // property highlight are visible to the user.
            setConfigEditorSettings((prev) => ({
                ...prev,
                profilesCollapsed: false,
            }));

            // Update the ref immediately so focus/visibility event handlers see the
            // new selection before React's useEffect has had a chance to sync it.
            // This prevents spurious GET_PROFILES calls that would clobber the selection.

            // Set the selected profile key state
            setSelectedProfileKey(profileName);

            // Track the selection per config using the resolved config path from the configs list
            const resolvedConfigPath = currentConfigs[configIndex].configPath;
            setSelectedProfilesByConfig((prev) => ({
                ...prev,
                [resolvedConfigPath]: profileName,
            }));

            // Signal RenderProfileDetails to blink the entire profile card only when no
            // specific property key was requested. When a propertyKey is present the
            // individual property row blink (setHighlightPropertyKey below) is sufficient.
            if (!propertyKey) {
                setHighlightProfileCard(true);
            }
        }
    }

    // Trigger property highlight/blink if a specific property key was requested
    if (propertyKey) {
        setHighlightPropertyKey(propertyKey);
    }
};

interface LocalStorageValueMessagePayload {
    key?: string;
    value?: unknown;
}

// Handle LOCAL_STORAGE_VALUE message
export const handleLocalStorageValueMessage = (data: LocalStorageValueMessagePayload, store: EditorStore) => {
    const props = store.getState();
    const { setConfigEditorSettings, setSortOrderVersion } = props;

    // Handle localStorage value retrieval
    const { key, value } = data;
    if (key === CONFIG_EDITOR_SETTINGS_KEY) {
        const defaultSettings = createDefaultEditorSettings();
        const settings: ConfigEditorSettings = value !== undefined ? (value as ConfigEditorSettings) : defaultSettings;
        setConfigEditorSettings(settings);

        // Trigger sort order version update if needed
        if (settings.showMergedProperties !== undefined || settings.propertySortOrder !== undefined) {
            setSortOrderVersion((prev) => prev + 1);
        }
    }
};

interface LocalStorageErrorMessagePayload {
    key?: string;
    error?: string;
}

// Handle LOCAL_STORAGE_ERROR message
export const handleLocalStorageErrorMessage = (data: LocalStorageErrorMessagePayload, store: EditorStore) => {
    const props = store.getState();
    const { setConfigEditorSettings, setSortOrderVersion } = props;
    console.error(`Local storage operation failed for key "${data.key}":`, data.error);

    // If reading/writing the editor settings failed, fall back to defaults so the UI isn't left uninitialized.
    if (data.key === CONFIG_EDITOR_SETTINGS_KEY) {
        const defaultSettings = createDefaultEditorSettings();
        setConfigEditorSettings(defaultSettings);
        setSortOrderVersion((prev) => prev + 1);
    }
};

// Handle LOCAL_STORAGE_SET_SUCCESS message (acknowledgement only; nothing for the UI to react to today)
export const handleLocalStorageSetSuccessMessage = (_data: { key?: string }, _store: EditorStore) => {
    // no-op — explicitly handled so this ack isn't silently dropped as an unrecognized command
};

// Handle RELOAD message
export const handleReloadMessage = (store: EditorStore) => {
    const props = store.getState();
    const {
        setConfigurations,
        setSelectedTab,
        setSelectedProfileKey,
        setMergedProperties,
        setPendingChanges,
        setDeletions,
        setPendingDefaults,
        setDefaultsDeletions,
        setProfileSearchTerm,
        setProfileFilterType,
        setConfigParseErrors,
        clearHistory,
        vscodeApi,
    } = props;

    // Handle explicit reload request from VS Code
    // Clear state and request fresh data
    clearHistory();
    setConfigParseErrors([]);
    setConfigurations([]);
    setSelectedTab(null);
    setSelectedProfileKey(null);
    setMergedProperties(null);
    setPendingChanges({});
    setDeletions({});
    setPendingDefaults({});
    setDefaultsDeletions({});
    setProfileSearchTerm("");
    setProfileFilterType(null);

    // Request fresh data
    vscodeApi.postMessage({ command: "GET_PROFILES" });
    vscodeApi.postMessage({ command: "GET_ENV_INFORMATION" });
};

// Handle REFRESH message
export const handleRefreshMessage = (store: EditorStore) => {
    const props = store.getState();
    const { handleRefresh } = props;
    // Handle refresh command from VS Code
    handleRefresh();
};

// Handle SAVE message
export const handleSaveMessage = (store: EditorStore) => {
    const props = store.getState();
    const { handleSave, setSaveModalOpen } = props;
    // Handle save command from VS Code
    handleSave();
    setSaveModalOpen(true);
};

interface ProfileNameValidationResultPayload {
    isValid: boolean;
    message?: string;
    requestSeq?: number;
}

const handleProfileNameValidationResultMessage = (data: ProfileNameValidationResultPayload, store: EditorStore) => {
    const props = store.getState();
    const { setWizardProfileNameValidation, validationRequestSeq } = props;

    if (data.requestSeq !== undefined && data.requestSeq !== validationRequestSeq) {
        return;
    }

    setWizardProfileNameValidation({
        isValid: data.isValid,
        message: data.message,
    });
};

/** Apply host updates atomically, recording file-picker edits in the user's undo history. */
export const handleMessage = (event: MessageEvent, store: EditorStore) => {
    const recordHistory = event.data.command === "FILE_SELECTED" && event.data.source === "editor" && !event.data.isNewProperty;
    store.getState().transaction(() => dispatchMessage(event, store), recordHistory);
};

const dispatchMessage = (event: MessageEvent, store: EditorStore) => {
    if (!event.data.command) return;
    switch (event.data.command) {
        case "CONFIGURATIONS":
            handleConfigurationsMessage(event.data, store);
            break;
        case "DISABLE_OVERLAY":
            handleDisableOverlayMessage(store);
            break;
        case "SAVE_ERROR":
            handleSaveErrorMessage(event.data, store);
            break;
        case "MERGED_PROPERTIES":
            handleMergedPropertiesMessage(event.data, store);
            break;
        case "FILE_SELECTED":
            handleFileSelectedMessage(event.data, store);
            break;
        case "ENV_INFORMATION":
            handleEnvInformationMessage(event.data, store);
            break;
        case "INITIAL_SELECTION":
            handleInitialSelectionMessage(event.data, store);
            break;
        case "LOCAL_STORAGE_VALUE":
            handleLocalStorageValueMessage(event.data, store);
            break;
        case "LOCAL_STORAGE_ERROR":
            handleLocalStorageErrorMessage(event.data, store);
            break;
        case "LOCAL_STORAGE_SET_SUCCESS":
            handleLocalStorageSetSuccessMessage(event.data, store);
            break;
        case "RELOAD":
            handleReloadMessage(store);
            break;
        case "REFRESH":
            handleRefreshMessage(store);
            break;
        case "SAVE":
            handleSaveMessage(store);
            break;
        case "PROFILE_NAME_VALIDATION_RESULT":
            handleProfileNameValidationResultMessage(event.data, store);
            break;
        default:
            // Handle unknown commands if needed
            break;
    }
};
