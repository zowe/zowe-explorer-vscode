import { useEffect, useState, useCallback, useRef } from "react";
import { isSecureOrigin } from "../utils";
import { schemaValidation } from "../../../utils/ConfigSchemaHelpers";
import "./App.css";

// Components
import {
  Footer,
  Tabs,
  Panels,
  AddProfileModal,
  SaveModal,
  NewLayerModal,
  AddConfigModal,
  RenameProfileModal,
  RenderProfiles,
  RenderProfileDetails,
  RenderDefaults,
  WizardManager,
} from "./components";

// Utils
import {
  flattenKeys,
  flattenProfiles,
  extractProfileKeyFromPath,
  stringifyValueByType,
  getProfileType,
  getRenamedProfileKey,
  getRenamedProfileKeyWithNested,
  getOriginalProfileKey,
  getPropertyTypeForAddProfile,
  fetchTypeOptions,
  PropertySortOrder,
  ProfileSortOrder,
  isPropertyActuallyInherited,
  mergePendingChangesForProfile,
  mergeMergedProperties,
  ensureProfileProperties,
  filterSecureProperties,
  mergePendingSecureProperties,
  isPropertyFromMergedProps,
  isMergedPropertySecure,
  canPropertyBeSecure,
  isPropertySecure,
  handleToggleSecure,
  hasPendingSecureChanges,
  extractPendingProfiles,
  isProfileOrParentDeleted,
  getAvailableProfilesByType,
  isProfileDefault,
  isCurrentProfileUntyped,
  sortProfilesAtLevel,
} from "./utils";

// Rename utilities
import { updateChangesForRenames, getProfileNameForMergedProperties, hasPendingRename } from "./utils/renameUtils";

// Hooks
import { useProfileWizard } from "./hooks";

// Message handlers
import { handleMessage } from "./handlers/messageHandlers";

// Profile handlers
import {
  handleRenameProfile as handleRenameProfileHandler,
  handleDeleteProfile as handleDeleteProfileHandler,
  handleProfileSelection as handleProfileSelectionHandler,
  handleNavigateToSource as handleNavigateToSourceHandler,
} from "./handlers/profileHandlers";

const vscodeApi = acquireVsCodeApi();

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

// Property sort order options - now imported from utils
// Profile sort order options - now imported from utils

const SORT_ORDER_OPTIONS: PropertySortOrder[] = ["alphabetical", "merged-first", "non-merged-first"];
const MAX_RENAMES_PER_PROFILE = 1;

// Helper functions now imported from utils

export function App() {
  // State management
  const [configurations, setConfigurations] = useState<Configuration[]>([]);
  const [selectedTab, setSelectedTab] = useState<number | null>(null);
  const [flattenedConfig, setFlattenedConfig] = useState<{ [key: string]: { value: string; path: string[] } }>({});
  const [flattenedDefaults, setFlattenedDefaults] = useState<{ [key: string]: { value: string; path: string[] } }>({});
  const [pendingChanges, setPendingChanges] = useState<{ [configPath: string]: { [key: string]: PendingChange } }>({});
  const [pendingDefaults, setPendingDefaults] = useState<{ [configPath: string]: { [key: string]: PendingDefault } }>({});
  const [deletions, setDeletions] = useState<{ [configPath: string]: string[] }>({});
  const [defaultsDeletions, setDefaultsDeletions] = useState<{ [configPath: string]: string[] }>({});
  const [renames, setRenames] = useState<{ [configPath: string]: { [originalKey: string]: string } }>({});
  const [renameCounts, setRenameCounts] = useState<{ [configPath: string]: { [profileKey: string]: number } }>({});
  const [autostoreChanges, setAutostoreChanges] = useState<{ [configPath: string]: boolean }>({});
  const [hiddenItems, setHiddenItems] = useState<{ [configPath: string]: { [key: string]: { path: string } } }>({});
  const [schemaValidations, setSchemaValidations] = useState<{ [configPath: string]: schemaValidation | undefined }>({});
  const [selectedProfileKey, setSelectedProfileKey] = useState<string | null>(null);
  const [selectedProfilesByConfig, setSelectedProfilesByConfig] = useState<{ [configPath: string]: string | null }>({});
  const [mergedProperties, setMergedProperties] = useState<any>(null);
  const [showMergedProperties, setShowMergedProperties] = useState<boolean>(true);

  // Track merged properties requests to prevent duplicates
  const [pendingMergedPropertiesRequest, setPendingMergedPropertiesRequest] = useState<string | null>(null);

  // Debug logging for merged properties state changes
  useEffect(() => {}, [mergedProperties]);
  const [viewMode, setViewMode] = useState<"flat" | "tree">("tree");
  const [propertySortOrder, setPropertySortOrder] = useState<PropertySortOrder>("alphabetical");
  const [profileSortOrder, setProfileSortOrder] = useState<ProfileSortOrder | null>(null);
  const [sortOrderVersion, setSortOrderVersion] = useState<number>(0);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [pendingSaveSelection, setPendingSaveSelection] = useState<{ tab: number | null; profile: string | null } | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [profileSearchTerm, setProfileSearchTerm] = useState("");
  const [profileFilterType, setProfileFilterType] = useState<string | null>(null);
  const [hasWorkspace, setHasWorkspace] = useState<boolean>(false);
  const [secureValuesAllowed, setSecureValuesAllowed] = useState<boolean>(true);
  const [hasPromptedForZeroConfigs, setHasPromptedForZeroConfigs] = useState(false);

  // Tree view expanded nodes state - track expanded nodes per config
  const [expandedNodesByConfig, setExpandedNodesByConfig] = useState<{ [configPath: string]: Set<string> }>({});

  // Modal states
  const [newProfileKeyPath, setNewProfileKeyPath] = useState<string[] | null>(null);
  const [newProfileKey, setNewProfileKey] = useState("");
  const [newProfileValue, setNewProfileValue] = useState("");
  const [newProfileModalOpen, setNewProfileModalOpen] = useState(false);
  const [focusValueInput, setFocusValueInput] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [newLayerModalOpen, setNewLayerModalOpen] = useState(false);
  const [newLayerName, setNewLayerName] = useState("");
  const [newLayerPath, setNewLayerPath] = useState<string[] | null>(null);
  const [isSecure, setIsSecure] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [addConfigModalOpen, setAddConfigModalOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState<string | null>(null);
  const [renameProfileModalOpen, setRenameProfileModalOpen] = useState(false);

  // Refs for current state values
  const configurationsRef = useRef<Configuration[]>([]);
  const pendingChangesRef = useRef<{ [configPath: string]: { [key: string]: PendingChange } }>({});
  const deletionsRef = useRef<{ [configPath: string]: string[] }>({});
  const pendingDefaultsRef = useRef<{ [configPath: string]: { [key: string]: PendingDefault } }>({});
  const defaultsDeletionsRef = useRef<{ [configPath: string]: string[] }>({});
  const autostoreChangesRef = useRef<{ [configPath: string]: boolean }>({});
  const renamesRef = useRef<{ [configPath: string]: { [originalKey: string]: string } }>({});
  const selectedProfileKeyRef = useRef<string | null>(null);

  // Update refs when state changes
  useEffect(() => {
    pendingChangesRef.current = pendingChanges;
  }, [pendingChanges]);

  useEffect(() => {
    deletionsRef.current = deletions;
  }, [deletions]);

  useEffect(() => {
    pendingDefaultsRef.current = pendingDefaults;
  }, [pendingDefaults]);

  useEffect(() => {
    defaultsDeletionsRef.current = defaultsDeletions;
  }, [defaultsDeletions]);

  useEffect(() => {
    autostoreChangesRef.current = autostoreChanges;
  }, [autostoreChanges]);

  useEffect(() => {
    renamesRef.current = renames;
  }, [renames]);

  useEffect(() => {
    selectedProfileKeyRef.current = selectedProfileKey;
  }, [selectedProfileKey]);

  // LocalStorage functions
  const getLocalStorageValue = useCallback((key: string, defaultValue: any) => {
    vscodeApi.postMessage({
      command: "GET_LOCAL_STORAGE_VALUE",
      key,
    });
    return defaultValue;
  }, []);

  const setLocalStorageValue = useCallback((key: string, value: any) => {
    vscodeApi.postMessage({
      command: "SET_LOCAL_STORAGE_VALUE",
      key,
      value,
    });
  }, []);

  // Wrapper functions that save to localStorage when values change
  const setShowMergedPropertiesWithStorage = useCallback(
    (value: boolean) => {
      setShowMergedProperties(value);
      setLocalStorageValue(LOCAL_STORAGE_KEYS.SHOW_MERGED_PROPERTIES, value);
      setSortOrderVersion((prev) => prev + 1);
    },
    [setLocalStorageValue]
  );

  const setViewModeWithStorage = useCallback(
    (value: "flat" | "tree") => {
      setViewMode(value);
      setLocalStorageValue(LOCAL_STORAGE_KEYS.VIEW_MODE, value);
    },
    [setLocalStorageValue]
  );

  const setPropertySortOrderWithStorage = useCallback(
    (value: PropertySortOrder) => {
      setPropertySortOrder(value);
      setLocalStorageValue(LOCAL_STORAGE_KEYS.PROPERTY_SORT_ORDER, value);
      setSortOrderVersion((prev) => prev + 1);
    },
    [setLocalStorageValue]
  );

  const setProfileSortOrderWithStorage = useCallback(
    (value: ProfileSortOrder) => {
      setProfileSortOrder(value);
      setLocalStorageValue(LOCAL_STORAGE_KEYS.PROFILE_SORT_ORDER, value);
    },
    [setLocalStorageValue]
  );

  // Memoize functions to prevent unnecessary re-renders
  const formatPendingChanges = useCallback(() => {
    const changes = Object.entries(pendingChanges).flatMap(([configPath, changesForPath]) =>
      Object.keys(changesForPath).map((key) => {
        const { value, path, profile, secure } = changesForPath[key];
        return { key, value, path, profile, configPath, secure };
      })
    );

    const deleteKeys = Object.entries(deletions).flatMap(([configPath, keys]) => keys.map((key) => ({ key, configPath, secure: false })));

    const defaultsChanges = Object.entries(pendingDefaults).flatMap(([configPath, changesForPath]) =>
      Object.keys(changesForPath).map((key) => {
        const { value, path } = changesForPath[key];
        return { key, value, path, configPath, secure: false };
      })
    );

    const defaultsDeleteKeys = Object.entries(defaultsDeletions).flatMap(([configPath, keys]) =>
      keys.map((key) => ({ key, configPath, secure: false }))
    );

    // Prepare renames data
    const renamesData = Object.entries(renames).flatMap(([configPath, configRenames]) =>
      Object.entries(configRenames).map(([originalKey, newKey]) => ({
        originalKey,
        newKey,
        configPath,
      }))
    );

    // Update changes to use new profile names
    const updatedChanges = updateChangesForRenames(changes, renamesData);
    // Don't update deletion keys - they should remain as constructed
    // const updatedDeleteKeys = updateChangesForRenames(deleteKeys, renamesData);

    const result = {
      changes: updatedChanges,
      deletions: deleteKeys,
      defaultsChanges,
      defaultsDeleteKeys: defaultsDeleteKeys,
      renames: renamesData,
    };

    return result;
  }, [pendingChanges, deletions, pendingDefaults, defaultsDeletions, renames, updateChangesForRenames]);

  const getAvailableProfiles = useCallback(() => {
    if (selectedTab === null) return ["root"];

    const config = configurations[selectedTab].properties;
    const flatProfiles = flattenProfiles(config.profiles);
    const profileNames = Object.keys(flatProfiles);

    // Include pending profiles from pendingChanges
    const pendingProfiles = new Set<string>();
    Object.entries(pendingChanges[configurations[selectedTab].configPath] || {}).forEach(([_, entry]) => {
      if (entry.profile) {
        pendingProfiles.add(entry.profile);
      }
    });

    // Get deleted profiles to exclude them (including children of deleted parents)
    const deletedProfiles = new Set<string>();
    const configPath = configurations[selectedTab].configPath;
    const deletedKeys = deletions[configPath] || [];
    deletedKeys.forEach((key) => {
      // Extract profile name from deletion key
      const keyParts = key.split(".");
      if (keyParts[0] === "profiles" && keyParts.length >= 2) {
        // Handle all profile types (simple, nested, deeply nested)
        // The deletion key structure is: profiles.profile1.profiles.profile2.profiles.profile3...
        // We need to extract: profile1.profile2.profile3...
        const profileParts: string[] = [];
        for (let i = 1; i < keyParts.length; i++) {
          if (keyParts[i] !== "profiles") {
            profileParts.push(keyParts[i]);
          }
        }
        const profileName = profileParts.join(".");
        deletedProfiles.add(profileName);

        // Also add the renamed version of the deleted profile if it exists
        const renamedDeletedProfile = getRenamedProfileKeyWithNested(profileName, configPath, renames);
        if (renamedDeletedProfile !== profileName) {
          deletedProfiles.add(renamedDeletedProfile);
        }

        // Also add all child profiles of this deleted profile
        // For example, if "parent" is deleted, also exclude "parent.child", "parent.child.grandchild", etc.
        // We need to check both original and renamed profile names
        profileNames.forEach((existingProfile) => {
          if (existingProfile.startsWith(profileName + ".")) {
            // This is a child of the deleted profile, so it should also be deleted
            deletedProfiles.add(existingProfile);

            // Also add the renamed version to deleted profiles
            const renamedProfile = getRenamedProfileKeyWithNested(existingProfile, configPath, renames);
            deletedProfiles.add(renamedProfile);
          }
        });
      }
    });

    // Apply renames to profile names, including nested profiles
    const renamedProfileNames = profileNames.map((profileName) => {
      const configPath = configurations[selectedTab].configPath;
      return getRenamedProfileKeyWithNested(profileName, configPath, renames);
    });

    // Combine all profiles, exclude deleted ones, and ensure uniqueness
    const allProfiles = new Set(["root", ...renamedProfileNames, ...Array.from(pendingProfiles)]);

    // Remove deleted profiles
    deletedProfiles.forEach((profile) => allProfiles.delete(profile));

    const result = Array.from(allProfiles).sort((a, b) => {
      // Always put "root" first
      if (a === "root") return -1;
      if (b === "root") return 1;
      // Sort other profiles alphabetically
      return a.localeCompare(b);
    });

    return result;
  }, [selectedTab, configurations, pendingChanges, deletions, renames]);

  // Profile Wizard hook
  const {
    wizardModalOpen,
    wizardRootProfile,
    wizardSelectedType,
    wizardProfileName,
    wizardProperties,
    wizardShowKeyDropdown,
    wizardNewPropertyKey,
    wizardNewPropertyValue,
    wizardNewPropertySecure,
    wizardMergedProperties,
    setWizardModalOpen,
    setWizardRootProfile,
    setWizardSelectedType,
    setWizardProfileName,
    setWizardProperties,
    setWizardShowKeyDropdown,
    setWizardNewPropertyKey,
    setWizardNewPropertyValue,
    setWizardNewPropertySecure,
    setWizardMergedProperties,
    getWizardTypeOptions,
    getWizardPropertyOptions,
    getPropertyType,
    isProfileNameTaken,
    handleWizardAddProperty,
    handleWizardRemoveProperty,
    handleWizardPropertyValueChange,
    handleWizardPropertySecureToggle,
    handleWizardCreateProfile,
    handleWizardCancel,
    requestWizardMergedProperties,
    handleWizardPopulateDefaults,
  } = useProfileWizard({
    selectedTab,
    configurations,
    schemaValidations,
    pendingChanges,
    setPendingChanges,
    setSelectedProfileKey,
    vscodeApi,
    formatPendingChanges,
    getAvailableProfiles,
    secureValuesAllowed,
    renames,
  });

  // Memoize handleSave to prevent unnecessary re-renders
  const handleSave = useCallback(() => {
    // Set saving flag to prevent selection clearing
    setIsSaving(true);

    // Store current selection to restore after save
    setPendingSaveSelection({
      tab: selectedTab,
      profile: selectedProfileKey,
    });

    // Use refs to get the most current state values
    const changes = Object.entries(pendingChangesRef.current).flatMap(([configPath, changesForPath]) =>
      Object.keys(changesForPath).map((key) => {
        const { value, path, profile, secure } = changesForPath[key];
        return { key, value, path, profile, configPath, secure };
      })
    );

    const deleteKeys = Object.entries(deletionsRef.current).flatMap(([configPath, keys]) => keys.map((key) => ({ key, configPath, secure: false })));

    const defaultsChanges = Object.entries(pendingDefaultsRef.current).flatMap(([configPath, changesForPath]) =>
      Object.keys(changesForPath).map((key) => {
        const { value, path } = changesForPath[key];
        return { key, value, path, configPath, secure: false };
      })
    );

    const defaultsDeleteKeys = Object.entries(defaultsDeletionsRef.current).flatMap(([configPath, keys]) =>
      keys.map((key) => ({ key, configPath, secure: false }))
    );

    // Prepare autostore changes
    const otherChanges = Object.entries(autostoreChangesRef.current).map(([configPath, value]) => ({
      type: "autostore",
      value,
      configPath,
    }));

    // Prepare renames data for save
    // Send all renames - let the server handle non-existent profiles
    const renamesData = Object.entries(renamesRef.current).flatMap(([configPath, configRenames]) =>
      Object.entries(configRenames).map(([originalKey, newKey]) => ({
        originalKey,
        newKey,
        configPath,
      }))
    );

    // Update changes to use new profile names before sending to backend
    const updatedChanges = updateChangesForRenames(changes, renamesData);
    // Don't update deletion keys - they should remain as constructed
    // const updatedDeleteKeys = updateChangesForRenames(deleteKeys, renamesData);

    vscodeApi.postMessage({
      command: "SAVE_CHANGES",
      changes: updatedChanges,
      deletions: deleteKeys,
      defaultsChanges,
      defaultsDeleteKeys: defaultsDeleteKeys,
      otherChanges,
      renames: renamesData,
    });

    setHiddenItems({});
    setPendingChanges({});
    setDeletions({});
    setPendingDefaults({});
    setDefaultsDeletions({});
    setAutostoreChanges({});
    setRenames({});
    setRenameCounts({});

    // Refresh configurations after save
    vscodeApi.postMessage({ command: "GET_PROFILES" });
  }, [selectedTab, selectedProfileKey]);

  // Initialize localStorage values on component mount
  useEffect(() => {
    // Retrieve stored settings from localStorage
    getLocalStorageValue(LOCAL_STORAGE_KEYS.SHOW_MERGED_PROPERTIES, true);
    getLocalStorageValue(LOCAL_STORAGE_KEYS.VIEW_MODE, "tree");
    getLocalStorageValue(LOCAL_STORAGE_KEYS.PROPERTY_SORT_ORDER, "alphabetical");
    getLocalStorageValue(LOCAL_STORAGE_KEYS.PROFILE_SORT_ORDER, "natural");
  }, [getLocalStorageValue]);

  // Invoked on webview load
  useEffect(() => {
    // Clear any existing state on reload
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
    setHasPromptedForZeroConfigs(false);

    window.addEventListener("message", (event) => {
      if (!isSecureOrigin(event.origin)) {
        return;
      }

      // Create message handler props object
      const messageHandlerProps = {
        // State setters
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
        setHasPromptedForZeroConfigs,
        setSaveModalOpen,
        setPendingMergedPropertiesRequest,
        setNewProfileValue,
        setHasWorkspace,
        setSelectedProfilesByConfig,
        setShowMergedProperties,
        setSortOrderVersion,
        setViewMode,
        setPropertySortOrder,
        setProfileSortOrder,
        setRenameCounts,
        setSecureValuesAllowed,
        setSchemaValidations,
        setAddConfigModalOpen,
        setIsSaving,
        setPendingSaveSelection,

        // Refs
        configurationsRef,

        // State values
        pendingSaveSelection,
        selectedTab,
        selectedProfilesByConfig,
        hasPromptedForZeroConfigs,

        // Functions
        handleRefresh,
        handleSave,
        vscodeApi,
      };

      handleMessage(event, messageHandlerProps);
    });

    vscodeApi.postMessage({ command: "GET_PROFILES" });
    vscodeApi.postMessage({ command: "GET_ENV_INFORMATION" });

    // Add window focus listener to refresh data on reload
    const handleWindowFocus = () => {
      // Only refresh configurations if no profile is currently selected
      // This prevents overwriting merged properties when tabbing back in
      if (!selectedProfileKeyRef.current) {
        vscodeApi.postMessage({ command: "GET_PROFILES" });
        vscodeApi.postMessage({ command: "GET_ENV_INFORMATION" });
        vscodeApi.postMessage({ command: "GET_KEYBINDS" });
      }
    };

    // Add visibility change listener to refresh data when tab becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Only refresh configurations if no profile is currently selected
        // This prevents overwriting merged properties when tabbing back in
        if (!selectedProfileKeyRef.current) {
          vscodeApi.postMessage({ command: "GET_PROFILES" });
          vscodeApi.postMessage({ command: "GET_ENV_INFORMATION" });
        }
      }
    };

    // Add beforeunload listener to handle page reload
    const handleBeforeUnload = () => {};

    // Add load listener to handle page load completion
    const handleLoad = () => {
      // Ensure data is loaded after page load
      setTimeout(() => {
        vscodeApi.postMessage({ command: "GET_PROFILES" });
        vscodeApi.postMessage({ command: "GET_ENV_INFORMATION" });
      }, 100);
    };

    // Add DOMContentLoaded listener for immediate initialization
    const handleDOMContentLoaded = () => {
      // Send initial data requests
      vscodeApi.postMessage({ command: "GET_PROFILES" });
      vscodeApi.postMessage({ command: "GET_ENV_INFORMATION" });
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("load", handleLoad);
    document.addEventListener("DOMContentLoaded", handleDOMContentLoaded);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("load", handleLoad);
      document.removeEventListener("DOMContentLoaded", handleDOMContentLoaded);
    };
  }, []);

  // Invoked when swapping tabs
  useEffect(() => {
    if (selectedTab !== null && configurations[selectedTab]) {
      const config = configurations[selectedTab].properties;
      setFlattenedConfig(flattenKeys(config.profiles));
      setFlattenedDefaults(flattenKeys(config.defaults));
      // Clear merged properties when tab changes (but not when saving or navigating)
      if (!isSaving && !isNavigating) {
        setMergedProperties(null);
        // Don't clear selectedProfileKey here - let handleTabChange handle it
      }
    }
  }, [selectedTab, configurations, isSaving, isNavigating]);

  // Refresh merged properties when pending changes change
  useEffect(() => {
    if (selectedProfileKey) {
      const configPath = configurations[selectedTab!]?.configPath;
      if (configPath) {
        // Get the correct profile name for merged properties (handles renames)
        const profileNameForMergedProperties = getProfileNameForMergedProperties(selectedProfileKey, configPath, renames);

        // Use a timeout to debounce rapid changes and prevent race conditions
        const timeoutId = setTimeout(() => {
          const changes = formatPendingChanges();
          vscodeApi.postMessage({
            command: "GET_MERGED_PROPERTIES",
            profilePath: profileNameForMergedProperties,
            configPath: configPath,
            changes: changes,
            renames: changes.renames,
          });
        }, 100); // 100ms debounce

        return () => clearTimeout(timeoutId);
      }
    }
  }, [selectedProfileKey, selectedTab, formatPendingChanges, renames, sortOrderVersion]);

  useEffect(() => {
    const isModalOpen = newProfileModalOpen || saveModalOpen || newLayerModalOpen || wizardModalOpen || renameProfileModalOpen;
    document.body.classList.toggle("modal-open", isModalOpen);
  }, [newProfileModalOpen, saveModalOpen, newLayerModalOpen, wizardModalOpen, renameProfileModalOpen]);

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (profileMenuOpen) {
        setProfileMenuOpen(null);
      }
    };

    if (profileMenuOpen) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [profileMenuOpen]);

  // Handle refresh functionality
  const handleRefresh = useCallback(() => {
    // Store current selection before clearing
    const currentSelectedTab = selectedTab;
    const currentSelectedProfileKey = selectedProfileKey;

    // Clear all state first
    setHiddenItems({});
    setPendingChanges({});
    setDeletions({});
    setPendingDefaults({});
    setDefaultsDeletions({});
    setAutostoreChanges({});
    setRenames({});
    setRenameCounts({});

    // Request fresh configurations from the backend
    vscodeApi.postMessage({ command: "GET_PROFILES" });

    // Restore selection after a brief delay to allow configurations to update
    setTimeout(() => {
      if (currentSelectedTab !== null) {
        setSelectedTab(currentSelectedTab);
      }
      if (currentSelectedProfileKey !== null) {
        setSelectedProfileKey(currentSelectedProfileKey);

        // Refresh merged properties for the selected profile after clearing changes
        const configPath = currentSelectedTab !== null ? configurations[currentSelectedTab]?.configPath : undefined;
        if (configPath) {
          // Get the correct profile name for merged properties (handles renames)
          const profileNameForMergedProperties = getProfileNameForMergedProperties(currentSelectedProfileKey, configPath, renames);

          const changes = formatPendingChanges();
          vscodeApi.postMessage({
            command: "GET_MERGED_PROPERTIES",
            profilePath: profileNameForMergedProperties,
            configPath: configPath,
            changes: changes,
            renames: changes.renames,
          });
        }
      }
    }, 100);
  }, [selectedTab, selectedProfileKey, configurations, formatPendingChanges]);

  const handleChange = (key: string, value: string) => {
    const configPath = configurations[selectedTab!]!.configPath;
    const path = flattenedConfig[key]?.path ?? key.split(".");

    // Use the selected profile key and apply all pending renames to get the fully renamed profile key
    let profileKey = selectedProfileKey || extractProfileKeyFromPath(path);

    // If we have a selected profile key, apply all pending renames to get the fully renamed state
    if (selectedProfileKey && renames[configPath]) {
      profileKey = getRenamedProfileKeyWithNested(selectedProfileKey, configPath, renames);
    }

    // Check if this property is currently secure
    const displayKey = path[path.length - 1];
    const currentSecure = isPropertySecure(key, displayKey, path);

    // When a user changes a property, maintain its current secure state
    // This ensures that secure properties stay secure when modified
    setPendingChanges((prev) => ({
      ...prev,
      [configPath]: {
        ...prev[configPath],
        [key]: { value, path, profile: profileKey, secure: currentSecure },
      },
    }));

    if (deletions[configPath]?.includes(key)) {
      setDeletions((prev) => ({
        ...prev,
        [configPath]: prev[configPath]?.filter((k) => k !== key) ?? [],
      }));
    }
  };

  const handleDefaultsChange = (key: string, value: string) => {
    const configPath = configurations[selectedTab!]!.configPath;
    const path = flattenedDefaults[key]?.path ?? key.split(".");
    setPendingDefaults((prev) => ({
      ...prev,
      [configPath]: {
        ...prev[configPath],
        [key]: { value, path },
      },
    }));

    if (defaultsDeletions[configPath]?.includes(key)) {
      setDefaultsDeletions((prev) => ({
        ...prev,
        [configPath]: prev[configPath]?.filter((k) => k !== key) ?? [],
      }));
    }
  };

  const handleAutostoreToggle = (configPath: string) => {
    const currentValue = configurations.find((config) => config.configPath === configPath)?.properties?.autoStore;
    const pendingValue = autostoreChanges[configPath];
    const effectiveValue = pendingValue !== undefined ? pendingValue : currentValue;
    // If unset, default to true, otherwise toggle
    const newValue = effectiveValue === undefined || effectiveValue === null ? true : !effectiveValue;

    setAutostoreChanges((prev) => ({
      ...prev,
      [configPath]: newValue,
    }));
  };

  const handleAddNewProfileKey = () => {
    if (!newProfileKey.trim() || !newProfileKeyPath) return;

    const configPath = configurations[selectedTab!]!.configPath;
    const path = [...newProfileKeyPath, newProfileKey.trim()];
    const fullKey = isSecure ? path.join(".").replace("secure", "properties") : path.join(".");
    const profileKey = extractProfileKeyFromPath(path);

    setPendingChanges((prev) => ({
      ...prev,
      [configPath]: {
        ...prev[configPath],
        [fullKey]: { value: newProfileValue, path: path.slice(-1), profile: profileKey, secure: isSecure },
      },
    }));

    // Remove any deletions on the same path
    setDeletions((prev) => {
      const newDeletions = { ...prev };
      const fullPath = path.join(".");
      if (newDeletions[configPath]) {
        newDeletions[configPath] = newDeletions[configPath].filter((key) => key !== fullPath);
      }
      return newDeletions;
    });

    // If a secure property is added to profile, remove it from the hidden items
    if (isSecure) {
      setHiddenItems((prev) => {
        const newHiddenItems = { ...prev };
        const fullPath = path.join(".").replace("secure", "properties");

        const configHiddenItems = newHiddenItems[configPath];

        if (configHiddenItems) {
          // Create a new object with filtered entries
          const filteredItems = Object.fromEntries(Object.entries(configHiddenItems).filter(([, value]) => value.path !== fullPath));

          newHiddenItems[configPath] = filteredItems;
        }

        return newHiddenItems;
      });
    }

    setNewProfileKey("");
    setNewProfileValue("");
    setNewProfileKeyPath(null);
    setNewProfileModalOpen(false);
    setIsSecure(false);
    setFocusValueInput(false);
  };

  const handleDeleteProperty = (fullKey: string, secure?: boolean) => {
    const configPath = configurations[selectedTab!]!.configPath;

    let index = fullKey.split(".").pop();
    if (secure) {
      setHiddenItems((prev) => ({
        ...prev,
        [configPath]: {
          ...prev[configPath],
          [index!]: { path: fullKey },
        },
      }));
    }
    setPendingChanges((prev) => {
      const newPendingChanges = { ...prev };
      delete newPendingChanges[configPath]?.[fullKey];

      return newPendingChanges;
    });
    setDeletions((prev) => {
      const newDeletions = {
        ...prev,
        [configPath]: [...(prev[configPath] ?? []), fullKey],
      };

      return newDeletions;
    });
  };

  const handleUnlinkMergedProperty = (propertyKey: string | undefined, fullKey: string) => {
    if (!propertyKey) return;
    // Open the add profile property modal with the key prepopulated
    setNewProfileKey(propertyKey);
    setNewProfileValue("");
    setNewProfileKeyPath(fullKey.split(".").slice(0, -1)); // Remove the property name from the path
    setNewProfileModalOpen(true);
    // Set a flag to indicate this modal was opened via "Overwrite merged property"
    setFocusValueInput(true);
  };

  const handleSetAsDefault = (profileKey: string) => {
    const profileType = getProfileType(profileKey, selectedTab, configurations, pendingChanges, renames);
    if (!profileType) {
      return;
    }

    const configPath = configurations[selectedTab!]!.configPath;

    // Set the default for this profile type
    setPendingDefaults((prev) => ({
      ...prev,
      [configPath]: {
        ...prev[configPath],
        [profileType]: { value: profileKey, path: [profileType] },
      },
    }));

    // Remove any deletion for this default
    setDefaultsDeletions((prev) => ({
      ...prev,
      [configPath]: prev[configPath]?.filter((k) => k !== profileType) ?? [],
    }));
  };

  // Helper function to get expanded nodes for a config
  const getExpandedNodesForConfig = useCallback(
    (configPath: string): Set<string> => {
      return expandedNodesByConfig[configPath] || new Set();
    },
    [expandedNodesByConfig]
  );

  // Helper function to set expanded nodes for a config
  const setExpandedNodesForConfig = useCallback((configPath: string, expandedNodes: Set<string>) => {
    setExpandedNodesByConfig((prev) => ({
      ...prev,
      [configPath]: expandedNodes,
    }));
  }, []);

  const handleOpenRawJson = (configPath: string) => {
    vscodeApi.postMessage({ command: "OPEN_CONFIG_FILE", filePath: configPath });
  };

  const handleRevealInFinder = (configPath: string) => {
    vscodeApi.postMessage({ command: "REVEAL_IN_FINDER", filePath: configPath });
  };

  const handleOpenSchemaFile = (schemaPath: string) => {
    vscodeApi.postMessage({ command: "OPEN_SCHEMA_FILE", filePath: schemaPath });
  };

  const handleTabChange = (index: number) => {
    setSelectedTab(index);

    // Restore the previously selected profile for this configuration
    const configPath = configurations[index]?.configPath;
    if (configPath) {
      const previouslySelectedProfile = selectedProfilesByConfig[configPath];
      if (previouslySelectedProfile) {
        setSelectedProfileKey(previouslySelectedProfile);

        // Get the correct profile name for merged properties (handles renames)
        const profileNameForMergedProperties = getProfileNameForMergedProperties(previouslySelectedProfile, configPath, renames);

        // Get merged properties for the restored profile
        const changes = formatPendingChanges();
        vscodeApi.postMessage({
          command: "GET_MERGED_PROPERTIES",
          profilePath: profileNameForMergedProperties,
          configPath: configPath,
          changes: changes,
          renames: changes.renames,
        });
      } else {
        // No previously selected profile for this config, clear selection
        setSelectedProfileKey(null);
        setMergedProperties(null);
      }
    }
  };

  // Wrapper function for mergePendingChangesForProfile that provides the necessary parameters
  const mergePendingChangesForProfileWrapper = useCallback(
    (baseObj: any, path: string[], configPath: string): any => {
      return mergePendingChangesForProfile(baseObj, path, configPath, pendingChanges, renames);
    },
    [pendingChanges, renames]
  );

  // Wrapper function for mergeMergedProperties that provides the necessary parameters
  const mergeMergedPropertiesWrapper = useCallback(
    (combinedConfig: any, path: string[], mergedProps: any, configPath: string): any => {
      return mergeMergedProperties(
        combinedConfig,
        path,
        mergedProps,
        configPath,
        selectedTab,
        configurations,
        pendingChanges,
        renames,
        schemaValidations,
        deletions
      );
    },
    [selectedTab, configurations, pendingChanges, renames, schemaValidations, deletions]
  );

  // Wrapper function for filterSecureProperties that provides the necessary parameters
  const filterSecurePropertiesWrapper = useCallback(
    (value: any, combinedConfig: any, configPath?: string): any => {
      return filterSecureProperties(value, combinedConfig, configPath, pendingChanges, deletions);
    },
    [pendingChanges, deletions]
  );

  // Wrapper function for mergePendingSecureProperties that provides the necessary parameters
  const mergePendingSecurePropertiesWrapper = useCallback(
    (value: any[], path: string[], configPath: string): any[] => {
      return mergePendingSecureProperties(value, path, configPath, pendingChanges);
    },
    [pendingChanges]
  );

  // Wrapper function for isPropertyFromMergedProps that provides the necessary parameters
  const isPropertyFromMergedPropsWrapper = useCallback(
    (displayKey: string | undefined, path: string[], mergedProps: any, configPath: string): boolean => {
      return isPropertyFromMergedProps(
        displayKey,
        path,
        mergedProps,
        configPath,
        showMergedProperties,
        selectedTab,
        configurations,
        pendingChanges,
        renames,
        selectedProfileKey,
        isPropertyActuallyInherited
      );
    },
    [showMergedProperties, selectedTab, configurations, pendingChanges, renames, selectedProfileKey, isPropertyActuallyInherited]
  );

  // Wrapper function for canPropertyBeSecure that provides the necessary parameters
  const canPropertyBeSecureWrapper = useCallback((displayKey: string, path: string[]): boolean => {
    return canPropertyBeSecure(
      displayKey, 
      path, 
      selectedTab, 
      configurations, 
      schemaValidations, 
      getProfileType, 
      pendingChanges, 
      renames,
      selectedProfileKey
    );
  }, [selectedTab, configurations, schemaValidations, pendingChanges, renames, selectedProfileKey]);

  // Wrapper function for handleToggleSecure that provides the necessary parameters
  const handleToggleSecureWrapper = useCallback((fullKey: string, displayKey: string, path: string[]): void => {
    return handleToggleSecure(fullKey, displayKey, path);
  }, []);

  // Wrapper function for hasPendingSecureChanges that provides the necessary parameters
  const hasPendingSecureChangesWrapper = useCallback(
    (configPath: string): boolean => {
      return hasPendingSecureChanges(configPath, pendingChanges);
    },
    [pendingChanges]
  );

  // Wrapper function for extractPendingProfiles that provides the necessary parameters
  const extractPendingProfilesWrapper = useCallback(
    (configPath: string): { [key: string]: any } => {
      // Convert the string[] result to the expected object format
      const profileNames = extractPendingProfiles(pendingChanges, configPath);
      const result: { [key: string]: any } = {};
      profileNames.forEach((profileName) => {
        result[profileName] = {}; // Empty object as placeholder
      });
      return result;
    },
    [pendingChanges]
  );

  // Wrapper function for isProfileOrParentDeleted that provides the necessary parameters
  const isProfileOrParentDeletedWrapper = useCallback(
    (profileKey: string, configPath: string): boolean => {
      return isProfileOrParentDeleted(profileKey, deletions, configPath);
    },
    [deletions]
  );

  // Wrapper function for isProfileOrParentDeleted that matches component expectations
  const isProfileOrParentDeletedForComponent = useCallback((profileKey: string, deletedProfiles: string[]): boolean => {
    // This is a simplified version that works with the component's expected signature
    return deletedProfiles.some((deletedProfile) => profileKey === deletedProfile || profileKey.startsWith(deletedProfile + "."));
  }, []);

  // Wrapper function for getAvailableProfilesByType that provides the necessary parameters
  const getAvailableProfilesByTypeWrapper = useCallback(
    (profileType: string): string[] => {
      return getAvailableProfilesByType(profileType, selectedTab, configurations, pendingChanges, renames);
    },
    [selectedTab, configurations, pendingChanges, renames]
  );

  // Wrapper function for isProfileDefault that provides the necessary parameters
  const isProfileDefaultWrapper = useCallback(
    (profileKey: string): boolean => {
      return isProfileDefault(profileKey, selectedTab, configurations, pendingChanges, pendingDefaults, renames);
    },
    [selectedTab, configurations, pendingChanges, pendingDefaults, renames]
  );

  // Wrapper function for isCurrentProfileUntyped that provides the necessary parameters
  const isCurrentProfileUntypedWrapper = useCallback((): boolean => {
    return isCurrentProfileUntyped(selectedProfileKey, selectedTab, configurations, pendingChanges, renames);
  }, [selectedProfileKey, selectedTab, configurations, pendingChanges, renames]);

  // Wrapper function for sortProfilesAtLevel that provides the necessary parameters
  const sortProfilesAtLevelWrapper = useCallback(
    (profileKeys: string[]): string[] => {
      return sortProfilesAtLevel(profileKeys, profileSortOrder);
    },
    [profileSortOrder]
  );

  // Memoized function to get available profiles for optimal performance
  const getAvailableProfilesForConfig = useCallback(
    (configPath: string): string[] => {
      const profilesObj = configurations[selectedTab!]?.properties?.profiles;
      if (!profilesObj) {
        return [];
      }

      const pendingProfiles = extractPendingProfilesWrapper(configPath);

      // Get all available profiles (existing + pending) that are not deleted
      const getAvailableProfiles = (profiles: any, parentKey = ""): string[] => {
        const available: string[] = [];
        for (const key of Object.keys(profiles)) {
          const profile = profiles[key];
          const qualifiedKey = parentKey ? `${parentKey}.${key}` : key;

          // Only include profiles that are not deleted
          if (!isProfileOrParentDeletedWrapper(qualifiedKey, configPath)) {
            available.push(qualifiedKey);
          }

          // Recursively add nested profiles
          if (profile.profiles) {
            available.push(...getAvailableProfiles(profile.profiles, qualifiedKey));
          }
        }
        return available;
      };

      const existingProfiles = getAvailableProfiles(profilesObj);
      const pendingProfileKeys = Object.keys(pendingProfiles).filter(
        (key) => !existingProfiles.includes(key) && !isProfileOrParentDeletedWrapper(key, configPath)
      );

      return [...existingProfiles, ...pendingProfileKeys];
    },
    [configurations, selectedTab, deletions, extractPendingProfiles, isProfileOrParentDeleted]
  );

  // Optimized function to find the best replacement profile after deletion
  const findOptimalReplacementProfile = useCallback(
    (deletedProfileKey: string, configPath: string): string | null => {
      const allAvailableProfiles = getAvailableProfilesForConfig(configPath);

      if (allAvailableProfiles.length === 0) {
        return null;
      }

      // Strategy 1: If deleting a nested profile, prefer its parent
      if (deletedProfileKey.includes(".")) {
        const parentKey = deletedProfileKey.split(".").slice(0, -1).join(".");
        if (allAvailableProfiles.includes(parentKey)) {
          return parentKey;
        }
      }

      // Strategy 2: Find siblings (profiles at the same level)
      const deletedParts = deletedProfileKey.split(".");
      if (deletedParts.length > 1) {
        const parentKey = deletedParts.slice(0, -1).join(".");
        const siblings = allAvailableProfiles.filter((profile) => profile.startsWith(parentKey + ".") && profile !== deletedProfileKey);
        if (siblings.length > 0) {
          // Return the first sibling (maintains order)
          return siblings[0];
        }
      }

      // Strategy 3: Find the next profile in the list (maintains user's workflow)
      const currentIndex = allAvailableProfiles.indexOf(deletedProfileKey);
      if (currentIndex !== -1) {
        // Try next profile first (user was likely working down the list)
        for (let i = currentIndex + 1; i < allAvailableProfiles.length; i++) {
          const candidate = allAvailableProfiles[i];
          if (candidate !== deletedProfileKey) {
            return candidate;
          }
        }

        // If no next profile, try previous profile
        for (let i = currentIndex - 1; i >= 0; i--) {
          const candidate = allAvailableProfiles[i];
          if (candidate !== deletedProfileKey) {
            return candidate;
          }
        }
      }

      // Strategy 4: Fallback to first available profile
      return allAvailableProfiles[0] || null;
    },
    [getAvailableProfilesForConfig]
  );

  // Wrapper function for handleRenameProfile that provides the necessary props
  const handleRenameProfile = useCallback(
    (originalKey: string, newKey: string, isDragDrop: boolean = false): boolean => {
      return handleRenameProfileHandler(originalKey, newKey, isDragDrop, {
        // State setters
        setRenames,
        setSelectedProfileKey,
        setPendingMergedPropertiesRequest,
        setSortOrderVersion,
        setSelectedProfilesByConfig,
        setExpandedNodesByConfig,
        setPendingDefaults,
        setPendingChanges,
        setRenameCounts,
        setRenameProfileModalOpen,
        setDeletions,
        setSelectedTab,
        setIsNavigating,

        // State values
        selectedTab,
        configurations,
        renames,
        renameCounts,
        selectedProfileKey,
        pendingMergedPropertiesRequest,

        // Constants
        MAX_RENAMES_PER_PROFILE,

        // Functions
        formatPendingChanges,
        extractPendingProfiles: extractPendingProfilesWrapper,
        findOptimalReplacementProfile,
        vscodeApi,
      });
    },
    [
      selectedTab,
      configurations,
      renames,
      renameCounts,
      selectedProfileKey,
      pendingMergedPropertiesRequest,
      MAX_RENAMES_PER_PROFILE,
      formatPendingChanges,
      extractPendingProfiles,
      findOptimalReplacementProfile,
      setRenames,
      setSelectedProfileKey,
      setPendingMergedPropertiesRequest,
      setSortOrderVersion,
      setSelectedProfilesByConfig,
      setExpandedNodesByConfig,
      setPendingDefaults,
      setPendingChanges,
      setRenameCounts,
      setRenameProfileModalOpen,
      setDeletions,
      setSelectedTab,
      setIsNavigating,
    ]
  );

  // Wrapper function for handleDeleteProfile that provides the necessary props
  const handleDeleteProfile = useCallback(
    (profileKey: string): void => {
      return handleDeleteProfileHandler(profileKey, {
        // State setters
        setRenames,
        setSelectedProfileKey,
        setPendingMergedPropertiesRequest,
        setSortOrderVersion,
        setSelectedProfilesByConfig,
        setExpandedNodesByConfig,
        setPendingDefaults,
        setPendingChanges,
        setRenameCounts,
        setRenameProfileModalOpen,
        setDeletions,
        setSelectedTab,
        setIsNavigating,

        // State values
        selectedTab,
        configurations,
        renames,
        renameCounts,
        selectedProfileKey,
        pendingMergedPropertiesRequest,

        // Constants
        MAX_RENAMES_PER_PROFILE,

        // Functions
        formatPendingChanges,
        extractPendingProfiles: extractPendingProfilesWrapper,
        findOptimalReplacementProfile,
        vscodeApi,
      });
    },
    [
      selectedTab,
      configurations,
      renames,
      renameCounts,
      selectedProfileKey,
      pendingMergedPropertiesRequest,
      MAX_RENAMES_PER_PROFILE,
      formatPendingChanges,
      extractPendingProfiles,
      findOptimalReplacementProfile,
      setRenames,
      setSelectedProfileKey,
      setPendingMergedPropertiesRequest,
      setSortOrderVersion,
      setSelectedProfilesByConfig,
      setExpandedNodesByConfig,
      setPendingDefaults,
      setPendingChanges,
      setRenameCounts,
      setRenameProfileModalOpen,
      setDeletions,
      setSelectedTab,
      setIsNavigating,
    ]
  );

  // Wrapper function for handleProfileSelection that provides the necessary props
  const handleProfileSelection = useCallback(
    (profileKey: string): void => {
      return handleProfileSelectionHandler(profileKey, {
        // State setters
        setRenames,
        setSelectedProfileKey,
        setPendingMergedPropertiesRequest,
        setSortOrderVersion,
        setSelectedProfilesByConfig,
        setExpandedNodesByConfig,
        setPendingDefaults,
        setPendingChanges,
        setRenameCounts,
        setRenameProfileModalOpen,
        setDeletions,
        setSelectedTab,
        setIsNavigating,

        // State values
        selectedTab,
        configurations,
        renames,
        renameCounts,
        selectedProfileKey,
        pendingMergedPropertiesRequest,

        // Constants
        MAX_RENAMES_PER_PROFILE,

        // Functions
        formatPendingChanges,
        extractPendingProfiles: extractPendingProfilesWrapper,
        findOptimalReplacementProfile,
        vscodeApi,
      });
    },
    [
      selectedTab,
      configurations,
      renames,
      renameCounts,
      selectedProfileKey,
      pendingMergedPropertiesRequest,
      MAX_RENAMES_PER_PROFILE,
      formatPendingChanges,
      extractPendingProfiles,
      findOptimalReplacementProfile,
      setRenames,
      setSelectedProfileKey,
      setPendingMergedPropertiesRequest,
      setSortOrderVersion,
      setSelectedProfilesByConfig,
      setExpandedNodesByConfig,
      setPendingDefaults,
      setPendingChanges,
      setRenameCounts,
      setRenameProfileModalOpen,
      setDeletions,
      setSelectedTab,
      setIsNavigating,
    ]
  );

  // Wrapper function for handleNavigateToSource that provides the necessary props
  const handleNavigateToSource = useCallback(
    (jsonLoc: string, osLoc?: string[]): void => {
      const navigateHandler = handleNavigateToSourceHandler({
        // State setters
        setRenames,
        setSelectedProfileKey,
        setPendingMergedPropertiesRequest,
        setSortOrderVersion,
        setSelectedProfilesByConfig,
        setExpandedNodesByConfig,
        setPendingDefaults,
        setPendingChanges,
        setRenameCounts,
        setRenameProfileModalOpen,
        setDeletions,
        setSelectedTab,
        setIsNavigating,

        // State values
        selectedTab,
        configurations,
        renames,
        renameCounts,
        selectedProfileKey,
        pendingMergedPropertiesRequest,

        // Constants
        MAX_RENAMES_PER_PROFILE,

        // Functions
        formatPendingChanges,
        extractPendingProfiles: extractPendingProfilesWrapper,
        findOptimalReplacementProfile,
        vscodeApi,
      });
      navigateHandler(jsonLoc, osLoc);
    },
    [
      selectedTab,
      configurations,
      renames,
      renameCounts,
      selectedProfileKey,
      pendingMergedPropertiesRequest,
      MAX_RENAMES_PER_PROFILE,
      formatPendingChanges,
      extractPendingProfiles,
      findOptimalReplacementProfile,
      setRenames,
      setSelectedProfileKey,
      setPendingMergedPropertiesRequest,
      setSortOrderVersion,
      setSelectedProfilesByConfig,
      setExpandedNodesByConfig,
      setPendingDefaults,
      setPendingChanges,
      setRenameCounts,
      setRenameProfileModalOpen,
      setDeletions,
      setSelectedTab,
      setIsNavigating,
      vscodeApi,
    ]
  );

  // Validate filter type when switching tabs - reset to null if current filter type doesn't exist
  useEffect(() => {
    if (selectedTab !== null && profileFilterType) {
      const configPath = configurations[selectedTab]?.configPath;
      if (configPath) {
        const profilesObj = configurations[selectedTab]?.properties?.profiles;
        if (profilesObj) {
          const flatProfiles = flattenProfiles(profilesObj);
          const pendingProfiles = extractPendingProfilesWrapper(configPath);
          const allProfiles = { ...flatProfiles, ...pendingProfiles };
          const filteredProfileKeys = Object.keys(allProfiles).filter((profileKey) => !isProfileOrParentDeletedWrapper(profileKey, configPath));

          // Get available types for current tab
          const availableTypes = Array.from(
            new Set(
              filteredProfileKeys
                .map((key) => getProfileType(key, selectedTab, configurations, pendingChanges, renames))
                .filter((type): type is string => type !== null)
            )
          );

          // If current filter type is not available, reset to null
          if (!availableTypes.includes(profileFilterType)) {
            setProfileFilterType(null);
          }
        }
      }
    }
  }, [selectedTab, configurations, profileFilterType, deletions, pendingChanges]);

  const openAddProfileModalAtPath = (path: string[]) => {
    setNewProfileKeyPath(path);
    setNewProfileKey("");
    setNewProfileValue("");
    setNewProfileModalOpen(true);
  };

  const handleAddNewLayer = () => {
    if (!newLayerName.trim() || !newLayerPath) return;

    const path = [...newLayerPath, newLayerName.trim()];
    const fullKey = path.join(".");
    const profileKey = path[0];

    setPendingChanges((prev) => ({
      ...prev,
      [configurations[selectedTab!]!.configPath]: {
        ...prev[configurations[selectedTab!]!.configPath],
        [fullKey]: { value: {}, path, profile: profileKey },
      },
    }));

    setNewLayerName("");
    setNewLayerPath(null);
    setNewLayerModalOpen(false);
  };

  const handleAddNewConfig = () => {
    setAddConfigModalOpen(true);
  };
  const handleAddConfig = (configType: string) => {
    // Send message to create new config file
    vscodeApi.postMessage({
      command: "CREATE_NEW_CONFIG",
      configType: configType,
    });
    setAddConfigModalOpen(false);
    // Reset the flag since we're creating a new config
    setHasPromptedForZeroConfigs(false);
  };

  const handleCancelAddConfig = () => {
    setAddConfigModalOpen(false);
    // Reset the flag so the modal can be opened again if needed
    setHasPromptedForZeroConfigs(false);
  };

  return (
    <div className="app-container">
      <Tabs
        configurations={configurations}
        selectedTab={selectedTab}
        onTabChange={handleTabChange}
        onOpenRawFile={handleOpenRawJson}
        onRevealInFinder={handleRevealInFinder}
        onOpenSchemaFile={handleOpenSchemaFile}
        onAddNewConfig={handleAddNewConfig}
        onToggleAutostore={handleAutostoreToggle}
        pendingChanges={pendingChanges}
        autostoreChanges={autostoreChanges}
        renames={renames}
      />
      <Panels
        configurations={configurations}
        selectedTab={selectedTab}
        renderProfiles={(profilesObj) => (
          <RenderProfiles
            profilesObj={profilesObj}
            configurations={configurations}
            selectedTab={selectedTab}
            deletions={deletions}
            pendingChanges={pendingChanges}
            renames={renames}
            selectedProfileKey={selectedProfileKey}
            profileMenuOpen={profileMenuOpen}
            vscodeApi={vscodeApi}
            viewMode={viewMode}
            profileSearchTerm={profileSearchTerm}
            profileFilterType={profileFilterType}
            profileSortOrder={profileSortOrder || "natural"}
            renameCounts={renameCounts}
            handleProfileSelection={handleProfileSelection}
            setProfileMenuOpen={setProfileMenuOpen}
            handleDeleteProfile={handleDeleteProfile}
            handleSetAsDefault={handleSetAsDefault}
            handleRenameProfile={handleRenameProfile}
            setProfileSearchTerm={setProfileSearchTerm}
            setProfileFilterType={setProfileFilterType}
            setProfileSortOrderWithStorage={setProfileSortOrderWithStorage}
            setExpandedNodesForConfig={setExpandedNodesForConfig}
            extractPendingProfiles={extractPendingProfilesWrapper}
            isProfileOrParentDeleted={isProfileOrParentDeletedForComponent}
            getRenamedProfileKey={getRenamedProfileKey}
            getProfileType={getProfileType}
            hasPendingSecureChanges={hasPendingSecureChangesWrapper}
            hasPendingRename={hasPendingRename}
            isProfileDefault={isProfileDefaultWrapper}
            sortProfilesAtLevel={sortProfilesAtLevelWrapper}
            getExpandedNodesForConfig={getExpandedNodesForConfig}
          />
        )}
        renderProfileDetails={() => (
          <RenderProfileDetails
            selectedProfileKey={selectedProfileKey}
            configurations={configurations}
            selectedTab={selectedTab}
            vscodeApi={vscodeApi}
            showMergedProperties={showMergedProperties}
            propertySortOrder={propertySortOrder}
            sortOrderVersion={sortOrderVersion}
            pendingChanges={pendingChanges}
            deletions={deletions}
            renames={renames}
            schemaValidations={schemaValidations}
            hiddenItems={hiddenItems}
            secureValuesAllowed={secureValuesAllowed}
            SORT_ORDER_OPTIONS={SORT_ORDER_OPTIONS}
            renameCounts={renameCounts}
            mergedProperties={mergedProperties}
            pendingDefaults={pendingDefaults}
            isProfileDefault={isProfileDefaultWrapper}
            getProfileType={getProfileType}
            handleSetAsDefault={handleSetAsDefault}
            setPendingDefaults={setPendingDefaults}
            setShowMergedPropertiesWithStorage={setShowMergedPropertiesWithStorage}
            setRenameProfileModalOpen={setRenameProfileModalOpen}
            handleDeleteProfile={handleDeleteProfile}
            handleChange={handleChange}
            handleDeleteProperty={handleDeleteProperty}
            handleUnlinkMergedProperty={handleUnlinkMergedProperty}
            handleNavigateToSource={handleNavigateToSource}
            handleToggleSecure={handleToggleSecureWrapper}
            openAddProfileModalAtPath={openAddProfileModalAtPath}
            setPropertySortOrderWithStorage={setPropertySortOrderWithStorage}
            getWizardTypeOptions={getWizardTypeOptions}
            extractPendingProfiles={extractPendingProfilesWrapper}
            getOriginalProfileKey={getOriginalProfileKey}
            getProfileNameForMergedProperties={getProfileNameForMergedProperties}
            mergePendingChangesForProfile={mergePendingChangesForProfileWrapper}
            mergeMergedProperties={mergeMergedPropertiesWrapper}
            ensureProfileProperties={ensureProfileProperties}
            filterSecureProperties={filterSecurePropertiesWrapper}
            mergePendingSecureProperties={mergePendingSecurePropertiesWrapper}
            isCurrentProfileUntyped={isCurrentProfileUntypedWrapper}
            isPropertyFromMergedProps={isPropertyFromMergedPropsWrapper}
            isPropertySecure={isPropertySecure}
            canPropertyBeSecure={canPropertyBeSecureWrapper}
            isMergedPropertySecure={isMergedPropertySecure}
            MAX_RENAMES_PER_PROFILE={MAX_RENAMES_PER_PROFILE}
          />
        )}
        renderDefaults={(defaults) => (
          <RenderDefaults
            defaults={defaults}
            configurations={configurations}
            selectedTab={selectedTab}
            pendingDefaults={pendingDefaults}
            defaultsDeletions={defaultsDeletions}
            renames={renames}
            handleDefaultsChange={handleDefaultsChange}
            getWizardTypeOptions={getWizardTypeOptions}
            getAvailableProfilesByType={getAvailableProfilesByTypeWrapper}
          />
        )}
        onProfileWizard={() => setWizardModalOpen(true)}
        viewMode={viewMode}
        onViewModeToggle={() => setViewModeWithStorage(viewMode === "tree" ? "flat" : "tree")}
        profileSortOrder={profileSortOrder || "natural"}
        onProfileSortOrderChange={setProfileSortOrderWithStorage}
      />
      <Footer
        onClearChanges={handleRefresh}
        onSaveAll={() => {
          handleSave();
          setSaveModalOpen(true);
        }}
      />
      {/* Modals */}

      <AddProfileModal
        key={`add-profile-${newProfileModalOpen}`}
        isOpen={newProfileModalOpen}
        newProfileKey={newProfileKey}
        newProfileValue={newProfileValue}
        showDropdown={showDropdown}
        typeOptions={
          newProfileKeyPath
            ? fetchTypeOptions(newProfileKeyPath, selectedTab, configurations, schemaValidations, getProfileType, pendingChanges, renames)
            : []
        }
        isSecure={isSecure}
        secureValuesAllowed={secureValuesAllowed}
        getPropertyType={(propertyKey: string) =>
          getPropertyTypeForAddProfile(
            propertyKey,
            selectedTab,
            configurations,
            selectedProfileKey,
            schemaValidations,
            getProfileType,
            pendingChanges,
            renames
          )
        }
        canPropertyBeSecure={canPropertyBeSecureWrapper}
        newProfileKeyPath={newProfileKeyPath || []}
        vscodeApi={vscodeApi}
        onNewProfileKeyChange={setNewProfileKey}
        onNewProfileValueChange={setNewProfileValue}
        onShowDropdownChange={setShowDropdown}
        onSecureToggle={() => {
          if (secureValuesAllowed) {
            setIsSecure(!isSecure);
          }
        }}
        onAdd={handleAddNewProfileKey}
        onCancel={() => {
          setNewProfileModalOpen(false);
          setIsSecure(false);
          setFocusValueInput(false);
        }}
        focusValueInput={focusValueInput}
      />

      <SaveModal isOpen={saveModalOpen} />

      <NewLayerModal
        key={`new-layer-${newLayerModalOpen}`}
        isOpen={newLayerModalOpen}
        newLayerName={newLayerName}
        onNewLayerNameChange={setNewLayerName}
        onAdd={handleAddNewLayer}
        onCancel={() => setNewLayerModalOpen(false)}
      />

      <WizardManager
        wizardModalOpen={wizardModalOpen}
        wizardRootProfile={wizardRootProfile}
        wizardSelectedType={wizardSelectedType}
        wizardProfileName={wizardProfileName}
        wizardProperties={wizardProperties}
        wizardShowKeyDropdown={wizardShowKeyDropdown}
        wizardNewPropertyKey={wizardNewPropertyKey}
        wizardNewPropertyValue={wizardNewPropertyValue}
        wizardNewPropertySecure={wizardNewPropertySecure}
        wizardMergedProperties={wizardMergedProperties}
        setWizardModalOpen={setWizardModalOpen}
        setWizardRootProfile={setWizardRootProfile}
        setWizardSelectedType={setWizardSelectedType}
        setWizardProfileName={setWizardProfileName}
        setWizardProperties={setWizardProperties}
        setWizardShowKeyDropdown={setWizardShowKeyDropdown}
        setWizardNewPropertyKey={setWizardNewPropertyKey}
        setWizardNewPropertyValue={setWizardNewPropertyValue}
        setWizardNewPropertySecure={setWizardNewPropertySecure}
        setWizardMergedProperties={setWizardMergedProperties}
        getWizardTypeOptions={getWizardTypeOptions}
        getWizardPropertyOptions={getWizardPropertyOptions}
        getPropertyType={getPropertyType}
        isProfileNameTaken={isProfileNameTaken}
        handleWizardAddProperty={handleWizardAddProperty}
        handleWizardRemoveProperty={handleWizardRemoveProperty}
        handleWizardPropertyValueChange={handleWizardPropertyValueChange}
        handleWizardPropertySecureToggle={handleWizardPropertySecureToggle}
        handleWizardCreateProfile={handleWizardCreateProfile}
        handleWizardCancel={handleWizardCancel}
        requestWizardMergedProperties={requestWizardMergedProperties}
        handleWizardPopulateDefaults={handleWizardPopulateDefaults}
        selectedTab={selectedTab}
        configurations={configurations}
        schemaValidations={schemaValidations}
        secureValuesAllowed={secureValuesAllowed}
        vscodeApi={vscodeApi}
        getAvailableProfiles={getAvailableProfiles}
        canPropertyBeSecure={canPropertyBeSecureWrapper}
        canPropertyBeSecureForWizard={(displayKey: string, profileType: string): boolean => {
          if (!displayKey) {
            return false;
          }

          // Allow secure properties for typeless profiles (when profileType is empty)
          if (!profileType) {
            return true;
          }

          // Get the schema validation for the current configuration
          const configPath = configurations[selectedTab!]?.configPath;
          if (!configPath) {
            return false;
          }

          // Create a mock path for the function call
          const mockPath = ["profiles", "mockProfile", "properties"];
          return canPropertyBeSecureWrapper(displayKey, mockPath);
        }}
        stringifyValueByType={stringifyValueByType}
        onWizardMergedProperties={(data) => {
          // Store the merged properties for the profile wizard - convert array to object format
          const mergedPropsData: { [key: string]: any } = {};
          if (Array.isArray(data.mergedArgs)) {
            data.mergedArgs.forEach((item: any) => {
              if (item.argName && item.argValue !== undefined) {
                mergedPropsData[item.argName] = {
                  value: item.argValue,
                  dataType: item.dataType,
                  secure: item.secure,
                  argLoc: item.argLoc,
                };
              }
            });
          }
          setWizardMergedProperties(mergedPropsData);
        }}
        onFileSelected={(data) => {
          // Handle file selection response from VS Code
          if (data.filePath) {
            if (data.isNewProperty) {
              // Check if this is for the wizard or the add profile modal
              if (data.source === "wizard") {
                setWizardNewPropertyValue(data.filePath);
              }
            } else {
              // Update existing property value
              const propertyIndex = data.propertyIndex;
              if (propertyIndex !== undefined && propertyIndex >= 0) {
                const updatedProperties = [...wizardProperties];
                updatedProperties[propertyIndex] = {
                  ...updatedProperties[propertyIndex],
                  value: data.filePath,
                };
                setWizardProperties(updatedProperties);
              }
            }
          }
        }}
      />

      <AddConfigModal
        key={`add-config-${addConfigModalOpen}`}
        isOpen={addConfigModalOpen}
        configurations={configurations}
        hasWorkspace={hasWorkspace}
        onAdd={handleAddConfig}
        onCancel={handleCancelAddConfig}
      />

      <RenameProfileModal
        key={`rename-profile-${renameProfileModalOpen}`}
        isOpen={renameProfileModalOpen}
        currentProfileName={selectedProfileKey ? selectedProfileKey.split(".").pop() || selectedProfileKey : ""}
        currentProfileKey={selectedProfileKey || ""}
        existingProfiles={(() => {
          if (selectedTab === null || !selectedProfileKey) return [];
          const config = configurations[selectedTab];
          if (!config?.properties?.profiles) return [];

          // Get all existing profile keys
          const getAllProfileKeys = (profiles: any, parentKey = ""): string[] => {
            const keys: string[] = [];
            for (const key of Object.keys(profiles)) {
              const profile = profiles[key];
              const qualifiedKey = parentKey ? `${parentKey}.${key}` : key;
              keys.push(qualifiedKey);

              // Recursively add nested profiles
              if (profile.profiles) {
                keys.push(...getAllProfileKeys(profile.profiles, qualifiedKey));
              }
            }
            return keys;
          };

          return getAllProfileKeys(config.properties.profiles);
        })()}
        pendingProfiles={(() => {
          if (selectedTab === null) return [];
          const config = configurations[selectedTab];
          if (!config) return [];

          const pendingProfiles = extractPendingProfilesWrapper(config.configPath);
          return Object.keys(pendingProfiles);
        })()}
        pendingRenames={(() => {
          if (selectedTab === null) return {};
          const config = configurations[selectedTab];
          if (!config) return {};

          return renames[config.configPath] || {};
        })()}
        onRename={(newName) => {
          // Find the original key from the configuration that corresponds to the selected profile
          const configPath = configurations[selectedTab!]?.configPath;
          if (configPath) {
            // Get all original profile keys from the configuration
            const config = configurations[selectedTab!];
            const getAllOriginalKeys = (profiles: any, parentKey = ""): string[] => {
              const keys: string[] = [];
              for (const key of Object.keys(profiles)) {
                const qualifiedKey = parentKey ? `${parentKey}.${key}` : key;
                keys.push(qualifiedKey);
                if (profiles[key].profiles) {
                  keys.push(...getAllOriginalKeys(profiles[key].profiles, qualifiedKey));
                }
              }
              return keys;
            };

            const originalKeys = getAllOriginalKeys(config.properties?.profiles || {});

            // Find which original key would produce the current selectedProfileKey
            let trueOriginalKey = selectedProfileKey!;
            for (const origKey of originalKeys) {
              const renamedKey = getRenamedProfileKeyWithNested(origKey, configPath, renames);
              if (renamedKey === selectedProfileKey) {
                trueOriginalKey = origKey;
                break;
              }
            }

            handleRenameProfile(trueOriginalKey, newName);
          }
        }}
        onCancel={() => setRenameProfileModalOpen(false)}
      />
    </div>
  );
}
