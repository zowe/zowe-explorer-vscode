import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

// Types
export type Configuration = {
    configPath: string;
    properties: any;
    secure: string[];
    global?: boolean;
    user?: boolean;
    schemaPath?: string;
};

export type PendingChange = {
    value: string | number | boolean | Record<string, any>;
    path: string[];
    profile: string;
    secure?: boolean;
};

export type PendingDefault = {
    value: string;
    path: string[];
};

export type PropertySortOrder = "alphabetical" | "merged-first" | "non-merged-first";
export type ProfileSortOrder = "natural" | "alphabetical" | "reverse-alphabetical";

// Store interface
interface ConfigStore {
    // Main state
    configurations: Configuration[];
    selectedTab: number | null;
    flattenedConfig: { [key: string]: { value: string; path: string[] } };
    flattenedDefaults: { [key: string]: { value: string; path: string[] } };
    pendingChanges: { [configPath: string]: { [key: string]: PendingChange } };
    pendingDefaults: { [configPath: string]: { [key: string]: PendingDefault } };
    deletions: { [configPath: string]: string[] };
    defaultsDeletions: { [configPath: string]: string[] };
    renames: { [configPath: string]: { [originalKey: string]: string } };
    renameCounts: { [configPath: string]: { [profileKey: string]: number } };
    autostoreChanges: { [configPath: string]: boolean };
    hiddenItems: { [configPath: string]: { [key: string]: { path: string } } };
    schemaValidations: { [configPath: string]: any };
    selectedProfileKey: string | null;
    selectedProfilesByConfig: { [configPath: string]: string | null };
    mergedProperties: any;
    showMergedProperties: boolean;
    pendingMergedPropertiesRequest: string | null;
    viewMode: "flat" | "tree";
    propertySortOrder: PropertySortOrder;
    profileSortOrder: ProfileSortOrder | null;
    sortOrderVersion: number;
    isSaving: boolean;
    pendingSaveSelection: { tab: number | null; profile: string | null } | null;
    isNavigating: boolean;
    profileSearchTerm: string;
    profileFilterType: string | null;
    hasWorkspace: boolean;
    secureValuesAllowed: boolean;
    hasPromptedForZeroConfigs: boolean;
    expandedNodesByConfig: { [configPath: string]: Set<string> };

    // Modal states
    newProfileKeyPath: string[] | null;
    newProfileKey: string;
    newProfileValue: string;
    newProfileModalOpen: boolean;
    focusValueInput: boolean;
    saveModalOpen: boolean;
    newLayerModalOpen: boolean;
    newLayerName: string;
    newLayerPath: string[] | null;
    isSecure: boolean;
    showDropdown: boolean;
    addConfigModalOpen: boolean;
    profileMenuOpen: string | null;
    renameProfileModalOpen: boolean;

    // Wizard states
    wizardModalOpen: boolean;
    wizardRootProfile: string;
    wizardSelectedType: string;
    wizardProfileName: string;
    wizardProperties: any[];
    wizardShowKeyDropdown: boolean;
    wizardNewPropertyKey: string;
    wizardNewPropertyValue: string;
    wizardNewPropertySecure: boolean;
    wizardMergedProperties: any;

    // Actions
    setConfigurations: (configs: Configuration[]) => void;
    setSelectedTab: (tab: number | null) => void;
    setFlattenedConfig: (config: { [key: string]: { value: string; path: string[] } }) => void;
    setFlattenedDefaults: (defaults: { [key: string]: { value: string; path: string[] } }) => void;
    setPendingChanges: (changes: { [configPath: string]: { [key: string]: PendingChange } }) => void;
    updatePendingChanges: (configPath: string, key: string, change: PendingChange) => void;
    deletePendingChange: (configPath: string, key: string) => void;
    setPendingDefaults: (defaults: { [configPath: string]: { [key: string]: PendingDefault } }) => void;
    updatePendingDefaults: (configPath: string, key: string, defaultValue: PendingDefault) => void;
    setDeletions: (deletions: { [configPath: string]: string[] }) => void;
    addDeletion: (configPath: string, key: string) => void;
    removeDeletion: (configPath: string, key: string) => void;
    setDefaultsDeletions: (deletions: { [configPath: string]: string[] }) => void;
    setRenames: (renames: { [configPath: string]: { [originalKey: string]: string } }) => void;
    updateRenames: (configPath: string, originalKey: string, newKey: string) => void;
    deleteRename: (configPath: string, originalKey: string) => void;
    setRenameCounts: (counts: { [configPath: string]: { [profileKey: string]: number } }) => void;
    incrementRenameCount: (configPath: string, profileKey: string) => void;
    setAutostoreChanges: (changes: { [configPath: string]: boolean }) => void;
    updateAutostoreChange: (configPath: string, value: boolean) => void;
    setHiddenItems: (items: { [configPath: string]: { [key: string]: { path: string } } }) => void;
    updateHiddenItems: (configPath: string, key: string, item: { path: string }) => void;
    deleteHiddenItem: (configPath: string, key: string) => void;
    setSchemaValidations: (validations: { [configPath: string]: any }) => void;
    setSelectedProfileKey: (key: string | null) => void;
    setSelectedProfilesByConfig: (profiles: { [configPath: string]: string | null }) => void;
    updateSelectedProfileByConfig: (configPath: string, profileKey: string | null) => void;
    setMergedProperties: (properties: any) => void;
    setShowMergedProperties: (show: boolean) => void;
    setPendingMergedPropertiesRequest: (request: string | null) => void;
    setViewMode: (mode: "flat" | "tree") => void;
    setPropertySortOrder: (order: PropertySortOrder) => void;
    setProfileSortOrder: (order: ProfileSortOrder | null) => void;
    setSortOrderVersion: (version: number) => void;
    incrementSortOrderVersion: () => void;
    setIsSaving: (saving: boolean) => void;
    setPendingSaveSelection: (selection: { tab: number | null; profile: string | null } | null) => void;
    setIsNavigating: (navigating: boolean) => void;
    setProfileSearchTerm: (term: string) => void;
    setProfileFilterType: (type: string | null) => void;
    setHasWorkspace: (hasWorkspace: boolean) => void;
    setSecureValuesAllowed: (allowed: boolean) => void;
    setHasPromptedForZeroConfigs: (prompted: boolean) => void;
    setExpandedNodesByConfig: (nodes: { [configPath: string]: Set<string> }) => void;
    updateExpandedNodesForConfig: (configPath: string, nodes: Set<string>) => void;

    // Modal actions
    setNewProfileKeyPath: (path: string[] | null) => void;
    setNewProfileKey: (key: string) => void;
    setNewProfileValue: (value: string) => void;
    setNewProfileModalOpen: (open: boolean) => void;
    setFocusValueInput: (focus: boolean) => void;
    setSaveModalOpen: (open: boolean) => void;
    setNewLayerModalOpen: (open: boolean) => void;
    setNewLayerName: (name: string) => void;
    setNewLayerPath: (path: string[] | null) => void;
    setIsSecure: (secure: boolean) => void;
    setShowDropdown: (show: boolean) => void;
    setAddConfigModalOpen: (open: boolean) => void;
    setProfileMenuOpen: (menu: string | null) => void;
    setRenameProfileModalOpen: (open: boolean) => void;

    // Wizard actions
    setWizardModalOpen: (open: boolean) => void;
    setWizardRootProfile: (profile: string) => void;
    setWizardSelectedType: (type: string) => void;
    setWizardProfileName: (name: string) => void;
    setWizardProperties: (properties: any[]) => void;
    setWizardShowKeyDropdown: (show: boolean) => void;
    setWizardNewPropertyKey: (key: string) => void;
    setWizardNewPropertyValue: (value: string) => void;
    setWizardNewPropertySecure: (secure: boolean) => void;
    setWizardMergedProperties: (properties: any) => void;

    // Utility actions
    clearAllState: () => void;
    resetModalStates: () => void;
    clearPendingChanges: () => void;
}

// Initial state
const initialState = {
    // Main state
    configurations: [],
    selectedTab: null,
    flattenedConfig: {},
    flattenedDefaults: {},
    pendingChanges: {},
    pendingDefaults: {},
    deletions: {},
    defaultsDeletions: {},
    renames: {},
    renameCounts: {},
    autostoreChanges: {},
    hiddenItems: {},
    schemaValidations: {},
    selectedProfileKey: null,
    selectedProfilesByConfig: {},
    mergedProperties: null,
    showMergedProperties: true,
    pendingMergedPropertiesRequest: null,
    viewMode: "tree" as const,
    propertySortOrder: "alphabetical" as PropertySortOrder,
    profileSortOrder: null,
    sortOrderVersion: 0,
    isSaving: false,
    pendingSaveSelection: null,
    isNavigating: false,
    profileSearchTerm: "",
    profileFilterType: null,
    hasWorkspace: false,
    secureValuesAllowed: true,
    hasPromptedForZeroConfigs: false,
    expandedNodesByConfig: {},

    // Modal states
    newProfileKeyPath: null,
    newProfileKey: "",
    newProfileValue: "",
    newProfileModalOpen: false,
    focusValueInput: false,
    saveModalOpen: false,
    newLayerModalOpen: false,
    newLayerName: "",
    newLayerPath: null,
    isSecure: false,
    showDropdown: false,
    addConfigModalOpen: false,
    profileMenuOpen: null,
    renameProfileModalOpen: false,

    // Wizard states
    wizardModalOpen: false,
    wizardRootProfile: "",
    wizardSelectedType: "",
    wizardProfileName: "",
    wizardProperties: [],
    wizardShowKeyDropdown: false,
    wizardNewPropertyKey: "",
    wizardNewPropertyValue: "",
    wizardNewPropertySecure: false,
    wizardMergedProperties: null,
};

export const useConfigStore = create<ConfigStore>()(
    subscribeWithSelector(
        immer((set) => ({
            ...initialState,

            // Main actions
            setConfigurations: (configs) =>
                set((state) => {
                    console.log("DEBUG: setConfigurations called with:", configs.length, "configs");
                    state.configurations = configs;
                }),

            setSelectedTab: (tab) =>
                set((state) => {
                    console.log("DEBUG: setSelectedTab called with:", tab);
                    state.selectedTab = tab;
                }),

            setFlattenedConfig: (config) =>
                set((state) => {
                    state.flattenedConfig = config;
                }),

            setFlattenedDefaults: (defaults) =>
                set((state) => {
                    state.flattenedDefaults = defaults;
                }),

            setPendingChanges: (changes) =>
                set((state) => {
                    state.pendingChanges = changes;
                }),

            updatePendingChanges: (configPath, key, change) =>
                set((state) => {
                    console.log("DEBUG: updatePendingChanges called with:", { configPath, key, change });
                    if (!state.pendingChanges[configPath]) {
                        state.pendingChanges[configPath] = {};
                    }
                    state.pendingChanges[configPath][key] = change;
                    console.log("DEBUG: pendingChanges after update:", JSON.stringify(state.pendingChanges, null, 2));
                }),

            deletePendingChange: (configPath, key) =>
                set((state) => {
                    if (state.pendingChanges[configPath]) {
                        delete state.pendingChanges[configPath][key];
                    }
                }),

            setPendingDefaults: (defaults) =>
                set((state) => {
                    state.pendingDefaults = defaults;
                }),

            updatePendingDefaults: (configPath, key, defaultValue) =>
                set((state) => {
                    if (!state.pendingDefaults[configPath]) {
                        state.pendingDefaults[configPath] = {};
                    }
                    state.pendingDefaults[configPath][key] = defaultValue;
                }),

            setDeletions: (deletions) =>
                set((state) => {
                    state.deletions = deletions;
                }),

            addDeletion: (configPath, key) =>
                set((state) => {
                    if (!state.deletions[configPath]) {
                        state.deletions[configPath] = [];
                    }
                    if (!state.deletions[configPath].includes(key)) {
                        state.deletions[configPath].push(key);
                    }
                }),

            removeDeletion: (configPath, key) =>
                set((state) => {
                    if (state.deletions[configPath]) {
                        state.deletions[configPath] = state.deletions[configPath].filter((k: string) => k !== key);
                    }
                }),

            setDefaultsDeletions: (deletions) =>
                set((state) => {
                    state.defaultsDeletions = deletions;
                }),

            setRenames: (renames) =>
                set((state) => {
                    state.renames = renames;
                }),

            updateRenames: (configPath, originalKey, newKey) =>
                set((state) => {
                    if (!state.renames[configPath]) {
                        state.renames[configPath] = {};
                    }
                    state.renames[configPath][originalKey] = newKey;
                }),

            deleteRename: (configPath, originalKey) =>
                set((state) => {
                    if (state.renames[configPath]) {
                        delete state.renames[configPath][originalKey];
                    }
                }),

            setRenameCounts: (counts) =>
                set((state) => {
                    state.renameCounts = counts;
                }),

            incrementRenameCount: (configPath, profileKey) =>
                set((state) => {
                    if (!state.renameCounts[configPath]) {
                        state.renameCounts[configPath] = {};
                    }
                    if (!state.renameCounts[configPath][profileKey]) {
                        state.renameCounts[configPath][profileKey] = 0;
                    }
                    state.renameCounts[configPath][profileKey]++;
                }),

            setAutostoreChanges: (changes) =>
                set((state) => {
                    state.autostoreChanges = changes;
                }),

            updateAutostoreChange: (configPath, value) =>
                set((state) => {
                    state.autostoreChanges[configPath] = value;
                }),

            setHiddenItems: (items) =>
                set((state) => {
                    state.hiddenItems = items;
                }),

            updateHiddenItems: (configPath, key, item) =>
                set((state) => {
                    if (!state.hiddenItems[configPath]) {
                        state.hiddenItems[configPath] = {};
                    }
                    state.hiddenItems[configPath][key] = item;
                }),

            deleteHiddenItem: (configPath, key) =>
                set((state) => {
                    if (state.hiddenItems[configPath]) {
                        delete state.hiddenItems[configPath][key];
                    }
                }),

            setSchemaValidations: (validations) =>
                set((state) => {
                    state.schemaValidations = validations;
                }),

            setSelectedProfileKey: (key) =>
                set((state) => {
                    state.selectedProfileKey = key;
                }),

            setSelectedProfilesByConfig: (profiles) =>
                set((state) => {
                    state.selectedProfilesByConfig = profiles;
                }),

            updateSelectedProfileByConfig: (configPath, profileKey) =>
                set((state) => {
                    state.selectedProfilesByConfig[configPath] = profileKey;
                }),

            setMergedProperties: (properties) =>
                set((state) => {
                    state.mergedProperties = properties;
                }),

            setShowMergedProperties: (show) =>
                set((state) => {
                    state.showMergedProperties = show;
                }),

            setPendingMergedPropertiesRequest: (request) =>
                set((state) => {
                    state.pendingMergedPropertiesRequest = request;
                }),

            setViewMode: (mode) =>
                set((state) => {
                    state.viewMode = mode;
                }),

            setPropertySortOrder: (order) =>
                set((state) => {
                    state.propertySortOrder = order;
                }),

            setProfileSortOrder: (order) =>
                set((state) => {
                    state.profileSortOrder = order;
                }),

            setSortOrderVersion: (version) =>
                set((state) => {
                    state.sortOrderVersion = version;
                }),

            incrementSortOrderVersion: () =>
                set((state) => {
                    state.sortOrderVersion++;
                }),

            setIsSaving: (saving) =>
                set((state) => {
                    console.log("DEBUG: setIsSaving called with:", saving, "Stack trace:", new Error().stack);
                    state.isSaving = saving;
                }),

            setPendingSaveSelection: (selection) =>
                set((state) => {
                    state.pendingSaveSelection = selection;
                }),

            setIsNavigating: (navigating) =>
                set((state) => {
                    state.isNavigating = navigating;
                }),

            setProfileSearchTerm: (term) =>
                set((state) => {
                    state.profileSearchTerm = term;
                }),

            setProfileFilterType: (type) =>
                set((state) => {
                    state.profileFilterType = type;
                }),

            setHasWorkspace: (hasWorkspace) =>
                set((state) => {
                    state.hasWorkspace = hasWorkspace;
                }),

            setSecureValuesAllowed: (allowed) =>
                set((state) => {
                    state.secureValuesAllowed = allowed;
                }),

            setHasPromptedForZeroConfigs: (prompted) =>
                set((state) => {
                    state.hasPromptedForZeroConfigs = prompted;
                }),

            setExpandedNodesByConfig: (nodes) =>
                set((state) => {
                    state.expandedNodesByConfig = nodes;
                }),

            updateExpandedNodesForConfig: (configPath, nodes) =>
                set((state) => {
                    state.expandedNodesByConfig[configPath] = nodes;
                }),

            // Modal actions
            setNewProfileKeyPath: (path) =>
                set((state) => {
                    state.newProfileKeyPath = path;
                }),

            setNewProfileKey: (key) =>
                set((state) => {
                    state.newProfileKey = key;
                }),

            setNewProfileValue: (value) =>
                set((state) => {
                    state.newProfileValue = value;
                }),

            setNewProfileModalOpen: (open) =>
                set((state) => {
                    state.newProfileModalOpen = open;
                }),

            setFocusValueInput: (focus) =>
                set((state) => {
                    state.focusValueInput = focus;
                }),

            setSaveModalOpen: (open) =>
                set((state) => {
                    state.saveModalOpen = open;
                }),

            setNewLayerModalOpen: (open) =>
                set((state) => {
                    state.newLayerModalOpen = open;
                }),

            setNewLayerName: (name) =>
                set((state) => {
                    state.newLayerName = name;
                }),

            setNewLayerPath: (path) =>
                set((state) => {
                    state.newLayerPath = path;
                }),

            setIsSecure: (secure) =>
                set((state) => {
                    state.isSecure = secure;
                }),

            setShowDropdown: (show) =>
                set((state) => {
                    state.showDropdown = show;
                }),

            setAddConfigModalOpen: (open) =>
                set((state) => {
                    state.addConfigModalOpen = open;
                }),

            setProfileMenuOpen: (menu) =>
                set((state) => {
                    state.profileMenuOpen = menu;
                }),

            setRenameProfileModalOpen: (open) =>
                set((state) => {
                    state.renameProfileModalOpen = open;
                }),

            // Wizard actions
            setWizardModalOpen: (open) =>
                set((state) => {
                    state.wizardModalOpen = open;
                }),

            setWizardRootProfile: (profile) =>
                set((state) => {
                    state.wizardRootProfile = profile;
                }),

            setWizardSelectedType: (type) =>
                set((state) => {
                    state.wizardSelectedType = type;
                }),

            setWizardProfileName: (name) =>
                set((state) => {
                    state.wizardProfileName = name;
                }),

            setWizardProperties: (properties) =>
                set((state) => {
                    state.wizardProperties = properties;
                }),

            setWizardShowKeyDropdown: (show) =>
                set((state) => {
                    state.wizardShowKeyDropdown = show;
                }),

            setWizardNewPropertyKey: (key) =>
                set((state) => {
                    state.wizardNewPropertyKey = key;
                }),

            setWizardNewPropertyValue: (value) =>
                set((state) => {
                    state.wizardNewPropertyValue = value;
                }),

            setWizardNewPropertySecure: (secure) =>
                set((state) => {
                    state.wizardNewPropertySecure = secure;
                }),

            setWizardMergedProperties: (properties) =>
                set((state) => {
                    state.wizardMergedProperties = properties;
                }),

            // Utility actions
            clearAllState: () =>
                set((state) => {
                    console.log("DEBUG: clearAllState called! Stack trace:", new Error().stack);
                    console.log("DEBUG: Preserving save state - isSaving:", state.isSaving, "pendingSaveSelection:", state.pendingSaveSelection);

                    // Preserve save-related state during clear to prevent clearing during save operations
                    const preservedSaveState = {
                        isSaving: state.isSaving,
                        pendingSaveSelection: state.pendingSaveSelection,
                    };

                    // Reset all state to initial values
                    Object.assign(state, initialState);

                    // Restore preserved save state
                    state.isSaving = preservedSaveState.isSaving;
                    state.pendingSaveSelection = preservedSaveState.pendingSaveSelection;

                    console.log("DEBUG: After clearAllState - isSaving:", state.isSaving, "pendingSaveSelection:", state.pendingSaveSelection);
                }),

            resetModalStates: () =>
                set((state) => {
                    state.newProfileKeyPath = null;
                    state.newProfileKey = "";
                    state.newProfileValue = "";
                    state.newProfileModalOpen = false;
                    state.focusValueInput = false;
                    state.saveModalOpen = false;
                    state.newLayerModalOpen = false;
                    state.newLayerName = "";
                    state.newLayerPath = null;
                    state.isSecure = false;
                    state.showDropdown = false;
                    state.addConfigModalOpen = false;
                    state.profileMenuOpen = null;
                    state.renameProfileModalOpen = false;
                    state.wizardModalOpen = false;
                    state.wizardRootProfile = "";
                    state.wizardSelectedType = "";
                    state.wizardProfileName = "";
                    state.wizardProperties = [];
                    state.wizardShowKeyDropdown = false;
                    state.wizardNewPropertyKey = "";
                    state.wizardNewPropertyValue = "";
                    state.wizardNewPropertySecure = false;
                    state.wizardMergedProperties = null;
                }),

            clearPendingChanges: () =>
                set((state) => {
                    console.log("DEBUG: clearPendingChanges called! Stack trace:", new Error().stack);
                    console.log("DEBUG: pendingChanges before clear:", JSON.stringify(state.pendingChanges, null, 2));
                    state.pendingChanges = {};
                    state.pendingDefaults = {};
                    state.deletions = {};
                    state.defaultsDeletions = {};
                    state.autostoreChanges = {};
                    state.renames = {};
                    state.renameCounts = {};
                    state.hiddenItems = {};
                    console.log("DEBUG: pendingChanges after clear:", JSON.stringify(state.pendingChanges, null, 2));
                }),
        }))
    )
);
