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

import { flattenKeys } from "../utils";
import { schemaValidation } from "../../../../utils/ConfigSchemaHelpers";

// Types
type Configuration = {
    configPath: string;
    properties: any;
    secure: string[];
    global?: boolean;
    user?: boolean;
    schemaPath?: string;
};

type PendingChange = {
    value: string | number | boolean | Record<string, any>;
    path: string[];
    profile: string;
    secure?: boolean;
};

type PendingDefault = {
    value: string;
    path: string[];
};

// LocalStorage keys for config editor settings
const LOCAL_STORAGE_KEYS = {
    SHOW_MERGED_PROPERTIES: "zowe.configEditor.showMergedProperties",
    VIEW_MODE: "zowe.configEditor.viewMode",
    PROPERTY_SORT_ORDER: "zowe.configEditor.propertySortOrder",
    PROFILE_SORT_ORDER: "zowe.configEditor.profileSortOrder",
} as const;

// Message handler props interface
interface MessageHandlerProps {
    // State setters
    setConfigurations: React.Dispatch<React.SetStateAction<Configuration[]>>;
    setSelectedTab: React.Dispatch<React.SetStateAction<number | null>>;
    setSelectedProfileKey: React.Dispatch<React.SetStateAction<string | null>>;
    setFlattenedConfig: React.Dispatch<React.SetStateAction<{ [key: string]: { value: string; path: string[] } }>>;
    setFlattenedDefaults: React.Dispatch<React.SetStateAction<{ [key: string]: { value: string; path: string[] } }>>;
    setMergedProperties: React.Dispatch<React.SetStateAction<any>>;
    setPendingChanges: React.Dispatch<React.SetStateAction<{ [configPath: string]: { [key: string]: PendingChange } }>>;
    setDeletions: React.Dispatch<React.SetStateAction<{ [configPath: string]: string[] }>>;
    setPendingDefaults: React.Dispatch<React.SetStateAction<{ [configPath: string]: { [key: string]: PendingDefault } }>>;
    setDefaultsDeletions: React.Dispatch<React.SetStateAction<{ [configPath: string]: string[] }>>;
    setProfileSearchTerm: React.Dispatch<React.SetStateAction<string>>;
    setProfileFilterType: React.Dispatch<React.SetStateAction<string | null>>;
    setHasPromptedForZeroConfigs: React.Dispatch<React.SetStateAction<boolean>>;
    setSaveModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setPendingMergedPropertiesRequest: React.Dispatch<React.SetStateAction<string | null>>;
    setNewProfileValue: React.Dispatch<React.SetStateAction<string>>;
    setHasWorkspace: React.Dispatch<React.SetStateAction<boolean>>;
    setSelectedProfilesByConfig: React.Dispatch<React.SetStateAction<{ [configPath: string]: string | null }>>;
    setShowMergedProperties: React.Dispatch<React.SetStateAction<boolean>>;
    setSortOrderVersion: React.Dispatch<React.SetStateAction<number>>;
    setViewMode: React.Dispatch<React.SetStateAction<"flat" | "tree">>;
    setPropertySortOrder: React.Dispatch<React.SetStateAction<"alphabetical" | "merged-first" | "non-merged-first">>;
    setProfileSortOrder: React.Dispatch<React.SetStateAction<"natural" | "alphabetical" | "reverse-alphabetical" | null>>;
    setRenameCounts: React.Dispatch<React.SetStateAction<{ [configPath: string]: { [profileKey: string]: number } }>>;
    setSecureValuesAllowed: React.Dispatch<React.SetStateAction<boolean>>;
    setSchemaValidations: React.Dispatch<React.SetStateAction<{ [configPath: string]: schemaValidation | undefined }>>;
    setAddConfigModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setIsSaving: React.Dispatch<React.SetStateAction<boolean>>;
    setPendingSaveSelection: React.Dispatch<React.SetStateAction<{ tab: number | null; profile: string | null } | null>>;

    // Refs
    configurationsRef: React.MutableRefObject<Configuration[]>;

    // State values
    pendingSaveSelection: { tab: number | null; profile: string | null } | null;
    selectedTab: number | null;
    selectedProfilesByConfig: { [configPath: string]: string | null };
    hasPromptedForZeroConfigs: boolean;

    // Functions
    handleRefresh: () => void;
    handleSave: () => void;
    vscodeApi: any;
}

// Handle CONFIGURATIONS message
export const handleConfigurationsMessage = (data: any, props: MessageHandlerProps) => {
    const {
        setConfigurations,
        setSecureValuesAllowed,
        configurationsRef,
        setSchemaValidations,
        pendingSaveSelection,
        setSelectedTab,
        setSelectedProfileKey,
        setPendingSaveSelection,
        setIsSaving,
        setRenameCounts,
        setSortOrderVersion,
        selectedProfilesByConfig,
        setSelectedProfilesByConfig,
        selectedTab,
        setFlattenedConfig,
        setFlattenedDefaults,
        vscodeApi,
        hasPromptedForZeroConfigs,
        setHasPromptedForZeroConfigs,
        setAddConfigModalOpen,
    } = props;

    const { contents, secureValuesAllowed } = data;
    setConfigurations(contents);
    const newSecureValuesAllowed = secureValuesAllowed !== undefined ? secureValuesAllowed : true;
    setSecureValuesAllowed(newSecureValuesAllowed);

    configurationsRef.current = contents;
    const newSchemaValidations: { [configPath: string]: schemaValidation | undefined } = {};
    contents.forEach((config: any) => {
        newSchemaValidations[config.configPath] = config.schemaValidation;
    });
    setSchemaValidations(newSchemaValidations);

    const newValidDefaults: { [configPath: string]: string[] } = {};
    contents.forEach((config: any) => {
        newValidDefaults[config.configPath] = config.schemaValidation?.validDefaults || [];
    });

    // Check if we have pending save selection to restore
    if (pendingSaveSelection) {
        setSelectedTab(pendingSaveSelection.tab);
        setSelectedProfileKey(pendingSaveSelection.profile);
        setPendingSaveSelection(null);
        setIsSaving(false);
        // Reset rename counts after successful save
        setRenameCounts({});
        // Increment sort order version to trigger re-render with updated merged properties after save
        setSortOrderVersion((prev) => prev + 1);
    } else {
        setSelectedTab((prevSelectedTab) => {
            if (prevSelectedTab !== null && prevSelectedTab < contents.length) {
                return prevSelectedTab;
            }
            return contents.length > 0 ? 0 : null;
        });
    }

    // Initialize selected profiles for each configuration if not already set
    contents.forEach((config: any) => {
        if (!selectedProfilesByConfig[config.configPath]) {
            setSelectedProfilesByConfig((prev) => ({
                ...prev,
                [config.configPath]: null,
            }));
        }
    });

    if (contents.length > 0) {
        const indexToUse = (prev: number | null) => (prev !== null && prev < contents.length ? prev : 0);
        const config = contents[indexToUse(selectedTab ?? 0)].properties;
        setFlattenedConfig(flattenKeys(config.profiles));
        setFlattenedDefaults(flattenKeys(config.defaults));
    }

    // Send ready message to ConfigEditor after configurations are processed
    vscodeApi.postMessage({ command: "CONFIGURATIONS_READY" });

    // If there are no configurations and we haven't prompted yet, automatically open the add config modal
    if (contents.length === 0 && !hasPromptedForZeroConfigs) {
        setAddConfigModalOpen(true);
        setHasPromptedForZeroConfigs(true);
    } else if (contents.length > 0) {
        // Reset the flag when configurations are loaded
        setHasPromptedForZeroConfigs(false);
    }
};

// Handle DISABLE_OVERLAY message
export const handleDisableOverlayMessage = (props: MessageHandlerProps) => {
    const { setSaveModalOpen } = props;
    setSaveModalOpen(false);
};

// Handle MERGED_PROPERTIES message
export const handleMergedPropertiesMessage = (data: any, props: MessageHandlerProps) => {
    const { setMergedProperties, setPendingMergedPropertiesRequest } = props;

    // Store the full merged properties data including jsonLoc and osLoc information
    const mergedPropsData: { [key: string]: any } = {};
    if (Array.isArray(data.mergedArgs)) {
        data.mergedArgs.forEach((item: any) => {
            if (item.argName && item.argValue !== undefined) {
                // Get the correct value from the source configuration
                let correctValue = item.argValue;

                // The argValue is already correct from the backend, so we can use it directly
                // The backend has already resolved the correct value from the source configuration
                correctValue = item.argValue;

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

// Handle FILE_SELECTED message
export const handleFileSelectedMessage = (data: any, props: MessageHandlerProps) => {
    const { setNewProfileValue } = props;

    // Handle file selection response from VS Code
    if (data.filePath) {
        if (data.isNewProperty) {
            // Update the add profile modal value
            setNewProfileValue(data.filePath);
        }
    }
};

// Handle ENV_INFORMATION message
export const handleEnvInformationMessage = (data: any, props: MessageHandlerProps) => {
    const { setHasWorkspace } = props;
    setHasWorkspace(data.hasWorkspace);
};

// Handle INITIAL_SELECTION message
export const handleInitialSelectionMessage = (data: any, props: MessageHandlerProps) => {
    const { setSelectedTab, setSelectedProfileKey, setSelectedProfilesByConfig, configurationsRef } = props;

    // Handle initial profile selection when opening the config editor
    const { profileName, configPath } = data;

    // Use the configurations from the ref to avoid state timing issues
    const currentConfigs = configurationsRef.current;

    // Find the config tab that contains this profile
    // Normalize paths for comparison to handle different path formats
    const normalizedTargetPath = configPath.replace(/\\/g, "/").toLowerCase();
    const configIndex = currentConfigs.findIndex((config: any) => {
        const normalizedConfigPath = config.configPath.replace(/\\/g, "/").toLowerCase();
        return normalizedConfigPath === normalizedTargetPath;
    });

    if (configIndex !== -1) {
        setSelectedTab(configIndex);

        // Set the selected profile key
        setSelectedProfileKey(profileName);

        // Update selected profiles by config
        setSelectedProfilesByConfig((prev) => ({
            ...prev,
            [configPath]: profileName,
        }));
    }
};

// Handle LOCAL_STORAGE_VALUE message
export const handleLocalStorageValueMessage = (data: any, props: MessageHandlerProps) => {
    const { setShowMergedProperties, setSortOrderVersion, setViewMode, setPropertySortOrder, setProfileSortOrder } = props;

    // Handle localStorage value retrieval
    const { key, value } = data;
    if (key === LOCAL_STORAGE_KEYS.SHOW_MERGED_PROPERTIES) {
        setShowMergedProperties(value !== undefined ? value : true);
        setSortOrderVersion((prev) => prev + 1);
    } else if (key === LOCAL_STORAGE_KEYS.VIEW_MODE) {
        setViewMode(value !== undefined ? value : "tree");
    } else if (key === LOCAL_STORAGE_KEYS.PROPERTY_SORT_ORDER) {
        setPropertySortOrder(value !== undefined ? value : "alphabetical");
        setSortOrderVersion((prev) => prev + 1);
    } else if (key === LOCAL_STORAGE_KEYS.PROFILE_SORT_ORDER) {
        setProfileSortOrder(value !== undefined ? value : "natural");
    }
};

// Handle LOCAL_STORAGE_SET_SUCCESS message
export const handleLocalStorageSetSuccessMessage = (_props: MessageHandlerProps) => {
    // Handle successful localStorage value setting (optional - for debugging)
    // Currently no action needed
};

// Handle LOCAL_STORAGE_ERROR message
export const handleLocalStorageErrorMessage = (_props: MessageHandlerProps) => {
    // Handle localStorage errors (optional - for debugging)
    // Currently no action needed
};

// Handle RELOAD message
export const handleReloadMessage = (props: MessageHandlerProps) => {
    const {
        setConfigurations,
        setSelectedTab,
        setSelectedProfileKey,
        setFlattenedConfig,
        setFlattenedDefaults,
        setMergedProperties,
        setPendingChanges,
        setDeletions,
        setPendingDefaults,
        setDefaultsDeletions,
        setProfileSearchTerm,
        setProfileFilterType,
        vscodeApi,
    } = props;

    // Handle explicit reload request from VS Code
    // Clear state and request fresh data
    setConfigurations([]);
    setSelectedTab(null);
    setSelectedProfileKey(null);
    setFlattenedConfig({});
    setFlattenedDefaults({});
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
export const handleRefreshMessage = (props: MessageHandlerProps) => {
    const { handleRefresh } = props;
    // Handle refresh command from VS Code
    handleRefresh();
};

// Handle SAVE message
export const handleSaveMessage = (props: MessageHandlerProps) => {
    const { handleSave, setSaveModalOpen } = props;
    // Handle save command from VS Code
    handleSave();
    setSaveModalOpen(true);
};

// Main message handler dispatcher
export const handleMessage = (event: MessageEvent, props: MessageHandlerProps) => {
    if (!event.data.command) return;

    switch (event.data.command) {
        case "CONFIGURATIONS":
            handleConfigurationsMessage(event.data, props);
            break;
        case "DISABLE_OVERLAY":
            handleDisableOverlayMessage(props);
            break;
        case "MERGED_PROPERTIES":
            handleMergedPropertiesMessage(event.data, props);
            break;
        case "FILE_SELECTED":
            handleFileSelectedMessage(event.data, props);
            break;
        case "ENV_INFORMATION":
            handleEnvInformationMessage(event.data, props);
            break;
        case "INITIAL_SELECTION":
            handleInitialSelectionMessage(event.data, props);
            break;
        case "LOCAL_STORAGE_VALUE":
            handleLocalStorageValueMessage(event.data, props);
            break;
        case "LOCAL_STORAGE_SET_SUCCESS":
            handleLocalStorageSetSuccessMessage(props);
            break;
        case "LOCAL_STORAGE_ERROR":
            handleLocalStorageErrorMessage(props);
            break;
        case "RELOAD":
            handleReloadMessage(props);
            break;
        case "REFRESH":
            handleRefreshMessage(props);
            break;
        case "SAVE":
            handleSaveMessage(props);
            break;
        default:
            // Handle unknown commands if needed
            break;
    }
};
