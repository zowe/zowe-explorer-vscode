import { useEffect, useCallback, useRef } from "react";
import * as l10n from "@vscode/l10n";
import { cloneDeep } from "es-toolkit";
import { isSecureOrigin } from "../utils";
import { schemaValidation } from "../../../utils/ConfigSchemaHelpers";
import "./App.css";

// Components
import {
  Footer,
  Tabs,
  Panels,
  ProfileList,
  AddProfileModal,
  SaveModal,
  NewLayerModal,
  ProfileWizardModal,
  AddConfigModal,
  RenameProfileModal,
} from "./components";

// Utils
import {
  flattenKeys,
  flattenProfiles,
  extractProfileKeyFromPath,
  sortConfigEntries,
  stringifyValueByType,
  pathFromArray,
  getProfileType,
  getRenamedProfileKey,
  getRenamedProfileKeyWithNested,
  getOriginalProfileKey,
  getOriginalProfileKeyWithNested,
  getPropertyTypeForAddProfile,
  getPropertyTypeForConfigEditor,
  fetchTypeOptions,
  getSortOrderDisplayName,
  getNestedProperty,
  PropertySortOrder,
  ProfileSortOrder,
} from "./utils";

// Rename utilities
import {
  updateChangesForRenames,
  getProfileNameForMergedProperties,
  consolidateRenames,
  getCurrentEffectiveName,
  detectClosedLoops,
  checkIfRenameCancelsOut,
  hasPendingRename,
} from "./utils/renameUtils";

import {
  formatPendingChangesHelper,
  getAvailableProfilesByType,
  getProfileTypeFromPath,
  handleDeleteProfile,
  isProfileDefault,
  isProfileOrParentDeleted,
} from "./utils/profileUtils";

// Hooks
import { useProfileWizard } from "./hooks";
import { ProfileDetails } from "./components/ProfileDetails";
import { handleSetAsDefault } from "./utils/defaultsUtils";
import { updateShowMergedProperties } from "./utils/storageUtils";

// Zustand store
import {
  useConfigurations,
  useSelectedTab,
  useFlattenedConfig,
  useFlattenedDefaults,
  usePendingChanges,
  usePendingDefaults,
  useDeletions,
  useDefaultsDeletions,
  useRenames,
  useRenameCounts,
  useAutostoreChanges,
  useHiddenItems,
  useSchemaValidations,
  useSelectedProfileKey,
  useSelectedProfilesByConfig,
  useMergedProperties,
  useShowMergedProperties,
  usePendingMergedPropertiesRequest,
  useViewMode,
  usePropertySortOrder,
  useProfileSortOrder,
  useSortOrderVersion,
  useIsSaving,
  usePendingSaveSelection,
  useIsNavigating,
  useProfileSearchTerm,
  useProfileFilterType,
  useHasWorkspace,
  useSecureValuesAllowed,
  useHasPromptedForZeroConfigs,
  useExpandedNodesByConfig,
  useNewProfileKeyPath,
  useNewProfileKey,
  useNewProfileValue,
  useNewProfileModalOpen,
  useFocusValueInput,
  useSaveModalOpen,
  useNewLayerModalOpen,
  useNewLayerName,
  useNewLayerPath,
  useIsSecure,
  useShowDropdown,
  useAddConfigModalOpen,
  useProfileMenuOpen,
  useRenameProfileModalOpen,
  useConfigEditorActions,
  type Configuration,
  type PendingChange,
  type PendingDefault,
} from "./store";

const vscodeApi = acquireVsCodeApi();

// LocalStorage keys for config editor settings
export const LOCAL_STORAGE_KEYS = {
  SHOW_MERGED_PROPERTIES: "zowe.configEditor.showMergedProperties",
  VIEW_MODE: "zowe.configEditor.viewMode",
  PROPERTY_SORT_ORDER: "zowe.configEditor.propertySortOrder",
  PROFILE_SORT_ORDER: "zowe.configEditor.profileSortOrder",
} as const;

// Property sort order options - now imported from utils
// Profile sort order options - now imported from utils

const SORT_ORDER_OPTIONS: PropertySortOrder[] = ["alphabetical", "merged-first", "non-merged-first"];
const MAX_RENAMES_PER_PROFILE = 1;

// Create refs for current state values (needed for some legacy functionality)
const useConfigEditorRefs = () => {
  const configurations = useConfigurations();
  const pendingChanges = usePendingChanges();
  const deletions = useDeletions();
  const pendingDefaults = usePendingDefaults();
  const defaultsDeletions = useDefaultsDeletions();
  const autostoreChanges = useAutostoreChanges();
  const renames = useRenames();
  const selectedProfileKey = useSelectedProfileKey();

  const configurationsRef = useRef<Configuration[]>([]);
  const pendingChangesRef = useRef<{ [configPath: string]: { [key: string]: PendingChange } }>({});
  const deletionsRef = useRef<{ [configPath: string]: string[] }>({});
  const pendingDefaultsRef = useRef<{ [configPath: string]: { [key: string]: PendingDefault } }>({});
  const defaultsDeletionsRef = useRef<{ [configPath: string]: string[] }>({});
  const autostoreChangesRef = useRef<{ [configPath: string]: boolean }>({});
  const renamesRef = useRef<{ [configPath: string]: { [originalKey: string]: string } }>({});
  const selectedProfileKeyRef = useRef<string | null>(null);

  // Update refs whenever state changes
  configurationsRef.current = configurations;
  pendingChangesRef.current = pendingChanges;
  deletionsRef.current = deletions;
  pendingDefaultsRef.current = pendingDefaults;
  defaultsDeletionsRef.current = defaultsDeletions;
  autostoreChangesRef.current = autostoreChanges;
  renamesRef.current = renames;
  selectedProfileKeyRef.current = selectedProfileKey;

  return {
    configurationsRef,
    pendingChangesRef,
    deletionsRef,
    pendingDefaultsRef,
    defaultsDeletionsRef,
    autostoreChangesRef,
    renamesRef,
    selectedProfileKeyRef,
  };
};

export function App() {
  console.log("test");
  
  // Get all state values from Zustand store
  const configurations = useConfigurations();
  const selectedTab = useSelectedTab();
  const flattenedConfig = useFlattenedConfig();
  const flattenedDefaults = useFlattenedDefaults();
  const pendingChanges = usePendingChanges();
  const pendingDefaults = usePendingDefaults();
  const deletions = useDeletions();
  const defaultsDeletions = useDefaultsDeletions();
  const renames = useRenames();
  const renameCounts = useRenameCounts();
  const autostoreChanges = useAutostoreChanges();
  const hiddenItems = useHiddenItems();
  const schemaValidations = useSchemaValidations();
  const selectedProfileKey = useSelectedProfileKey();
  const selectedProfilesByConfig = useSelectedProfilesByConfig();
  const mergedProperties = useMergedProperties();
  const showMergedProperties = useShowMergedProperties();
  const pendingMergedPropertiesRequest = usePendingMergedPropertiesRequest();
  const viewMode = useViewMode();
  const propertySortOrder = usePropertySortOrder();
  const profileSortOrder = useProfileSortOrder();
  const sortOrderVersion = useSortOrderVersion();
  const isSaving = useIsSaving();
  const pendingSaveSelection = usePendingSaveSelection();
  const isNavigating = useIsNavigating();
  const profileSearchTerm = useProfileSearchTerm();
  const profileFilterType = useProfileFilterType();
  const hasWorkspace = useHasWorkspace();
  const secureValuesAllowed = useSecureValuesAllowed();
  const hasPromptedForZeroConfigs = useHasPromptedForZeroConfigs();
  const expandedNodesByConfig = useExpandedNodesByConfig();
  const newProfileKeyPath = useNewProfileKeyPath();
  const newProfileKey = useNewProfileKey();
  const newProfileValue = useNewProfileValue();
  const newProfileModalOpen = useNewProfileModalOpen();
  const focusValueInput = useFocusValueInput();
  const saveModalOpen = useSaveModalOpen();
  const newLayerModalOpen = useNewLayerModalOpen();
  const newLayerName = useNewLayerName();
  const newLayerPath = useNewLayerPath();
  const isSecure = useIsSecure();
  const showDropdown = useShowDropdown();
  const addConfigModalOpen = useAddConfigModalOpen();
  const profileMenuOpen = useProfileMenuOpen();
  const renameProfileModalOpen = useRenameProfileModalOpen();

  // Get all actions from Zustand store
  const actions = useConfigEditorActions();

  // Get refs for legacy functionality
  const refs = useConfigEditorRefs();

  // Destructure actions for easier access
  const {
    setConfigurations,
    setSelectedTab,
    setFlattenedConfig,
    setFlattenedDefaults,
    setPendingChanges,
    setPendingDefaults,
    setDeletions,
    setDefaultsDeletions,
    setRenames,
    setRenameCounts,
    setAutostoreChanges,
    setHiddenItems,
    setSchemaValidations,
    setSelectedProfileKey,
    setSelectedProfilesByConfig,
    setMergedProperties,
    setShowMergedProperties,
    setPendingMergedPropertiesRequest,
    setViewMode,
    setPropertySortOrder,
    setProfileSortOrder,
    setSortOrderVersion,
    setIsSaving,
    setPendingSaveSelection,
    setIsNavigating,
    setProfileSearchTerm,
    setProfileFilterType,
    setHasWorkspace,
    setSecureValuesAllowed,
    setHasPromptedForZeroConfigs,
    setExpandedNodesByConfig,
    setNewProfileKeyPath,
    setNewProfileKey,
    setNewProfileValue,
    setNewProfileModalOpen,
    setFocusValueInput,
    setSaveModalOpen,
    setNewLayerModalOpen,
    setNewLayerName,
    setNewLayerPath,
    setIsSecure,
    setShowDropdown,
    setAddConfigModalOpen,
    setProfileMenuOpen,
    setRenameProfileModalOpen,
  } = actions;

  // destructure refs (already synced in useConfigEditorRefs)
  const {
    configurationsRef,
    pendingChangesRef,
    deletionsRef,
    pendingDefaultsRef,
    defaultsDeletionsRef,
    autostoreChangesRef,
    renamesRef,
    selectedProfileKeyRef,
  } = refs;

  // Handle mergedProperties changes (equivalent to the original useEffect)
  useEffect(() => {
    // This effect runs whenever mergedProperties changes
  }, [mergedProperties]);

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
      updateShowMergedProperties(value, vscodeApi);
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
    return formatPendingChangesHelper();
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

        // Also add all child profiles of this deleted profile
        // For example, if "parent" is deleted, also exclude "parent.child", "parent.child.grandchild", etc.
        // But only if they haven't been renamed away from being children
        profileNames.forEach((existingProfile) => {
          if (existingProfile.startsWith(profileName + ".")) {
            // Check if this child profile has been renamed and is no longer a child of the deleted profile
            const configPath = configurations[selectedTab].configPath;
            const renamedProfile = getRenamedProfileKeyWithNested(existingProfile, configPath, renames);

            // Only add to deleted profiles if the renamed version is still a child of the deleted profile
            // This means the renamed profile should still start with the deleted profile name
            if (renamedProfile.startsWith(profileName + ".")) {
              deletedProfiles.add(existingProfile);
            }
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

    return Array.from(allProfiles).sort((a, b) => {
      // Always put "root" first
      if (a === "root") return -1;
      if (b === "root") return 1;
      // Sort other profiles alphabetically
      return a.localeCompare(b);
    });
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
    console.log("test");
    window.addEventListener("message", (event) => {
      if (!isSecureOrigin(event.origin)) {
        return;
      }
      console.log(event.data);
      if (event.data.command === "CONFIGURATIONS") {
        const { contents, secureValuesAllowed } = event.data;
        setConfigurations(contents);
        console.log(configurations);
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
      } else if (event.data.command === "DISABLE_OVERLAY") {
        setSaveModalOpen(false);
      } else if (event.data.command === "MERGED_PROPERTIES") {
        // Store the full merged properties data including jsonLoc and osLoc information
        const mergedPropsData: { [key: string]: any } = {};
        if (Array.isArray(event.data.mergedArgs)) {
          event.data.mergedArgs.forEach((item: any) => {
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
      } else if (event.data.command === "WIZARD_MERGED_PROPERTIES") {
        // Store the merged properties for the profile wizard - convert array to object format
        const mergedPropsData: { [key: string]: any } = {};
        if (Array.isArray(event.data.mergedArgs)) {
          event.data.mergedArgs.forEach((item: any) => {
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
      } else if (event.data.command === "FILE_SELECTED") {
        // Handle file selection response from VS Code
        if (event.data.filePath) {
          if (event.data.isNewProperty) {
            // Check if this is for the wizard or the add profile modal
            if (event.data.source === "wizard") {
              setWizardNewPropertyValue(event.data.filePath);
            } else {
              // Update the add profile modal value
              setNewProfileValue(event.data.filePath);
            }
          } else {
            // Update existing property value
            const propertyIndex = event.data.propertyIndex;
            if (propertyIndex !== undefined && propertyIndex >= 0) {
              const updatedProperties = [...wizardProperties];
              updatedProperties[propertyIndex] = {
                ...updatedProperties[propertyIndex],
                value: event.data.filePath,
              };
              setWizardProperties(updatedProperties);
            }
          }
        }
      } else if (event.data.command === "ENV_INFORMATION") {
        setHasWorkspace(event.data.hasWorkspace);
      } else if (event.data.command === "INITIAL_SELECTION") {
        // Handle initial profile selection when opening the config editor
        const { profileName, configPath } = event.data;

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
      } else if (event.data.command === "LOCAL_STORAGE_VALUE") {
        // Handle localStorage value retrieval
        const { key, value } = event.data;
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
      } else if (event.data.command === "LOCAL_STORAGE_SET_SUCCESS") {
        // Handle successful localStorage value setting (optional - for debugging)
      } else if (event.data.command === "LOCAL_STORAGE_ERROR") {
        // Handle localStorage errors (optional - for debugging)
      } else if (event.data.command === "RELOAD") {
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
      } else if (event.data.command === "REFRESH") {
        // Handle refresh command from VS Code
        handleRefresh();
      } else if (event.data.command === "SAVE") {
        // Handle save command from VS Code
        handleSave();
        setSaveModalOpen(true);
      }
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

  // Trigger wizard merged properties request when root profile, type, or pending changes change
  useEffect(() => {
    if (wizardModalOpen && selectedTab !== null && (wizardRootProfile || wizardSelectedType)) {
      // Debounce the request to prevent excessive calls
      const timeoutId = setTimeout(() => {
        requestWizardMergedProperties();
      }, 1000); // 1 second delay

      return () => clearTimeout(timeoutId);
    }
  }, [wizardRootProfile, wizardSelectedType, wizardModalOpen, selectedTab, requestWizardMergedProperties]);

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

  const handleNavigateToSource = (jsonLoc: string, osLoc?: string[]) => {
    const parts = jsonLoc.split(".");

    if (parts.length >= 3 && parts[0] === "profiles") {
      // Find the source profile by looking for the profile name in the path
      // Handle both simple cases (profiles.ssh.port) and nested cases (profiles.ssh.profiles.parent.port)
      let sourceProfile = "";
      let sourceProfilePath = "";

      // Look for the profile name in the path
      for (let i = 1; i < parts.length - 1; i++) {
        if (parts[i + 1] === "profiles") {
          // This is a nested profile structure
          // For nested profiles, we need to construct the full profile path
          // e.g., "profiles.zosmf.profiles.a.profiles.b.properties.port" should navigate to "zosmf.a.b"
          const parentProfile = parts[i];
          let nestedProfilePath = [parentProfile];
          // Start after the first "profiles"
          let pathIndex = i + 2;

          // Continue building the nested profile path until we hit a non-profile part
          while (pathIndex < parts.length - 1 && parts[pathIndex + 1] === "profiles") {
            nestedProfilePath.push(parts[pathIndex]); // Add the profile name
            pathIndex += 2; // Skip the "profiles" part
          }

          // Add the final profile name if we haven't reached the end
          if (pathIndex < parts.length) {
            nestedProfilePath.push(parts[pathIndex]);
          }

          sourceProfile = nestedProfilePath.join("."); // e.g., "zosmf.a.b"
          sourceProfilePath = parts.slice(1, pathIndex + 1).join("."); // e.g., "zosmf.profiles.a.profiles.b"
          break;
        } else if (i === 1) {
          // Simple case: profiles.ssh.port
          sourceProfile = parts[i];
          sourceProfilePath = parts[i];
        }
      }

      if (sourceProfile) {
        // Find the configuration that contains this profile
        let sourceConfigIndex = -1;

        // If osLoc is provided and indicates a different config, use it to find the correct config
        if (osLoc && osLoc.length > 0) {
          const osLocString = osLoc.join("");
          sourceConfigIndex = configurations.findIndex((config) => {
            return config.configPath === osLocString;
          });
        }

        // If we couldn't find the config using osLoc, or if osLoc wasn't provided,
        // search through all configurations
        if (sourceConfigIndex === -1) {
          for (let configIndex = 0; configIndex < configurations.length; configIndex++) {
            const config = configurations[configIndex];
            const configProfiles = config.properties?.profiles;

            if (!configProfiles) {
              continue;
            }

            // Check if this config contains the source profile
            let profileExists = false;

            if (sourceProfilePath.includes(".")) {
              // Nested profile case - we need to check if the nested profile exists
              const pathParts = sourceProfilePath.split(".");

              let current = configProfiles;
              for (const part of pathParts) {
                if (current && current[part]) {
                  current = current[part];
                } else {
                  current = null;
                  break;
                }
              }
              profileExists = current !== null;
            } else {
              // Simple profile case
              profileExists = configProfiles.hasOwnProperty(sourceProfile);
            }

            if (profileExists) {
              sourceConfigIndex = configIndex;
              break;
            }
          }
        }

        if (sourceConfigIndex !== -1) {
          setIsNavigating(true);
          setSelectedTab(sourceConfigIndex);

          // Use a timeout to set the profile after the tab change has been processed
          setTimeout(() => {
            setSelectedProfileKey(sourceProfile);

            // Clear navigation flag after setting the profile
            setTimeout(() => {
              setIsNavigating(false);
            }, 100);
          }, 0);
        }
      }
    }
  };

  // Helper function to get a profile's type - now imported from utils

  // Helper function to check if current profile is untyped
  const isCurrentProfileUntyped = (): boolean => {
    if (!selectedProfileKey) return false;
    const profileType = getProfileType(selectedProfileKey, selectedTab, configurations, pendingChanges, renames);
    return !profileType || profileType.trim() === "";
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

  const handleRenameProfile = (originalKey: string, newKey: string, isDragDrop: boolean = false): boolean => {
    if (selectedTab === null) return false;
    const configPath = configurations[selectedTab!]!.configPath;

    // Check if we need to use the current effective name instead of the original key
    const currentEffectiveName = getCurrentEffectiveName(originalKey, configPath, renames);
    if (currentEffectiveName !== originalKey) {
      // Use the current effective name as the original key
      originalKey = currentEffectiveName;
    }

    // Check rename limit - only for actual renames, not drag and drop operations
    if (!isDragDrop) {
      const currentRenameCount = renameCounts[configPath]?.[originalKey] || 0;
      if (currentRenameCount >= MAX_RENAMES_PER_PROFILE) {
        vscodeApi.postMessage({
          command: "SHOW_ERROR_MESSAGE",
          message: `Cannot rename '${originalKey}': Profile has already been renamed once. Please save your changes and refresh to reset the limit.`,
        });
        return false;
      }
    }

    // Check for circular renames before proceeding (same validation as rename modal)
    const currentRenames = renames[configPath] || {};

    // Special case: if renaming back to the original key, cancel the rename operation
    if (newKey === originalKey) {
      // Remove the rename entry to restore the profile to its original state
      setRenames((prev) => {
        const updatedRenames = { ...prev[configPath] };
        delete updatedRenames[originalKey];
        return {
          ...prev,
          [configPath]: updatedRenames,
        };
      });
      return true; // Return true to indicate success (rename was canceled)
    }

    // Check for circular renames, but allow cancellations
    if (currentRenames[newKey] === originalKey) {
      // Check if this is actually a cancellation (moving back to original location)
      const isCancellation = Object.entries(currentRenames).some(([origKey, targetKey]) => targetKey === originalKey && origKey === newKey);

      if (isCancellation) {
        // This is a cancellation, not a circular rename - allow it to proceed
      } else {
        // Show error message for circular rename
        vscodeApi.postMessage({
          command: "SHOW_ERROR_MESSAGE",
          message: `Cannot rename '${originalKey}' to '${newKey}': This would create a circular rename (${newKey} -> ${originalKey})`,
        });
        return false; // Return false to indicate failure
      }
    }

    // Update the renames state with consolidation
    setRenames((prev) => {
      const currentRenames = prev[configPath] || {};

      // Check for opposite renames and remove both if they cancel out
      let updatedRenames = { ...currentRenames };

      // Check if this rename would cancel out an existing rename chain
      const wouldCancelOut = checkIfRenameCancelsOut(currentRenames, originalKey, newKey);

      if (wouldCancelOut) {
        // This rename cancels out the existing chain, remove all related renames
        // Find all renames that are part of the same chain and remove them
        const renamesToRemove = new Set<string>();

        // Add the current original key
        renamesToRemove.add(originalKey);

        // Find all keys in the rename chain that should be removed
        let currentKey = originalKey;
        while (currentRenames[currentKey]) {
          const targetKey = currentRenames[currentKey];
          renamesToRemove.add(currentKey);
          currentKey = targetKey;
        }

        // Remove all renames in the chain
        for (const keyToRemove of renamesToRemove) {
          delete updatedRenames[keyToRemove];
        }
      } else {
        // Apply the new rename
        updatedRenames[originalKey] = newKey;
      }

      // Apply consolidation to handle any other conflicts
      updatedRenames = consolidateRenames(updatedRenames, originalKey, newKey);

      // Detect and remove closed loops
      const closedLoops = detectClosedLoops(updatedRenames);
      if (closedLoops.length > 0) {
        // Remove all keys that are part of closed loops
        const keysToRemove = new Set<string>();
        closedLoops.forEach((loop) => {
          loop.forEach((key) => keysToRemove.add(key));
        });

        // Remove all keys in closed loops
        keysToRemove.forEach((key) => {
          delete updatedRenames[key];
        });
      }

      return {
        ...prev,
        [configPath]: updatedRenames,
      };
    });

    // Update the selected profile key based on the consolidated renames
    const currentRenamesForSelection = renames[configPath] || {};
    let updatedRenamesForSelection = { ...currentRenamesForSelection };

    // Check for opposite renames and remove both if they cancel out
    const wouldCancelOutForSelection = checkIfRenameCancelsOut(currentRenamesForSelection, originalKey, newKey);

    if (wouldCancelOutForSelection) {
      // This rename cancels out the existing chain, remove all related renames
      const renamesToRemove = new Set<string>();

      // Add the current original key
      renamesToRemove.add(originalKey);

      // Find all keys in the rename chain that should be removed
      let currentKey = originalKey;
      while (currentRenamesForSelection[currentKey]) {
        const targetKey = currentRenamesForSelection[currentKey];
        renamesToRemove.add(currentKey);
        currentKey = targetKey;
      }

      // Remove all renames in the chain
      for (const keyToRemove of renamesToRemove) {
        delete updatedRenamesForSelection[keyToRemove];
      }
    } else {
      // Apply the new rename
      updatedRenamesForSelection[originalKey] = newKey;
    }

    // Apply consolidation to handle any other conflicts
    let updatedRenames = consolidateRenames(updatedRenamesForSelection, originalKey, newKey);

    // Detect and remove closed loops
    const closedLoops = detectClosedLoops(updatedRenames);
    if (closedLoops.length > 0) {
      // Remove all keys that are part of closed loops
      const keysToRemove = new Set<string>();
      closedLoops.forEach((loop) => {
        loop.forEach((key) => keysToRemove.add(key));
      });

      // Remove all keys in closed loops
      keysToRemove.forEach((key) => {
        delete updatedRenames[key];
      });
    }

    // Find what the selectedProfileKey should be after consolidation
    let newSelectedProfileKey = selectedProfileKey;
    if (selectedProfileKey) {
      // Get the old renames for checking chained renames
      const oldRenames = renames[configPath] || {};
      const oldRenamedValue = oldRenames[originalKey];

      // Special case: if we're canceling a rename (newKey === originalKey)
      if (newKey === originalKey) {
        // If the selected profile was the renamed version, restore it to the original
        if (selectedProfileKey === oldRenamedValue) {
          newSelectedProfileKey = originalKey;
        }
        // If the selected profile was a child of the renamed version, restore it to the original
        else if (oldRenamedValue && selectedProfileKey.startsWith(oldRenamedValue + ".")) {
          const childPath = selectedProfileKey.substring(oldRenamedValue.length + 1);
          newSelectedProfileKey = originalKey + "." + childPath;
        }
      }
      // Check if the selected profile is directly renamed
      else if (selectedProfileKey === originalKey) {
        newSelectedProfileKey = newKey;
      }
      // Check if the selected profile is a child of the renamed profile
      else if (selectedProfileKey.startsWith(originalKey + ".")) {
        const childPath = selectedProfileKey.substring(originalKey.length + 1);
        newSelectedProfileKey = newKey + "." + childPath;
      }
      // Check if the selected profile is a child of the old renamed value
      else if (oldRenamedValue && selectedProfileKey.startsWith(oldRenamedValue + ".")) {
        const childPath = selectedProfileKey.substring(oldRenamedValue.length + 1);
        newSelectedProfileKey = newKey + "." + childPath;
      }
      // Check if the selected profile was part of a chained rename
      else {
        // First check if the selectedProfileKey matches the old renamed value that's being updated
        if (selectedProfileKey === oldRenamedValue) {
          // The selected profile is the old renamed value, update it to the new value
          newSelectedProfileKey = newKey;
        }
        // Also check if the selected profile matches any key in the consolidated renames
        else {
          for (const [origKey, renamedValue] of Object.entries(updatedRenames)) {
            if (selectedProfileKey === origKey || selectedProfileKey === renamedValue) {
              // The selected profile is involved in the rename chain
              if (selectedProfileKey === origKey) {
                newSelectedProfileKey = renamedValue;
              }
              break;
            }
          }
        }
      }
    }

    if (newSelectedProfileKey !== selectedProfileKey) {
      setSelectedProfileKey(newSelectedProfileKey);

      // Refresh merged properties for the renamed profile to maintain sorting order
      if (newSelectedProfileKey) {
        const profileNameForMergedProperties = getProfileNameForMergedProperties(newSelectedProfileKey, configPath, renames);
        const changes = formatPendingChanges();

        // Create a unique request key to prevent duplicate requests
        const requestKey = `${configPath}:${newSelectedProfileKey}`;

        // Only request if we don't already have a pending request
        if (pendingMergedPropertiesRequest !== requestKey) {
          setPendingMergedPropertiesRequest(requestKey);

          // Increment sort order version to trigger re-render with updated merged properties
          setSortOrderVersion((prev) => prev + 1);

          vscodeApi.postMessage({
            command: "GET_MERGED_PROPERTIES",
            profilePath: profileNameForMergedProperties,
            configPath: configPath,
            changes: changes,
            renames: changes.renames,
            currentProfileKey: newSelectedProfileKey,
            originalProfileKey: profileNameForMergedProperties,
          });
        }
      }
    }

    // Update the selected profiles by config to reflect the rename
    setSelectedProfilesByConfig((prev) => {
      const currentSelectedProfile = prev[configPath];
      let newCurrentSelectedProfile = currentSelectedProfile;

      if (currentSelectedProfile) {
        // Special case: if we're canceling a rename (newKey === originalKey)
        if (newKey === originalKey) {
          const oldRenames = renames[configPath] || {};
          const oldRenamedValue = oldRenames[originalKey];
          // If the selected profile was the renamed version, restore it to the original
          if (currentSelectedProfile === oldRenamedValue) {
            newCurrentSelectedProfile = originalKey;
          }
          // If the selected profile was a child of the renamed version, restore it to the original
          else if (oldRenamedValue && currentSelectedProfile.startsWith(oldRenamedValue + ".")) {
            const childPath = currentSelectedProfile.substring(oldRenamedValue.length + 1);
            newCurrentSelectedProfile = originalKey + "." + childPath;
          }
        }
        // Check direct rename
        else if (currentSelectedProfile === originalKey) {
          newCurrentSelectedProfile = newKey;
        }
        // Check child rename
        else if (currentSelectedProfile.startsWith(originalKey + ".")) {
          const childPath = currentSelectedProfile.substring(originalKey.length + 1);
          newCurrentSelectedProfile = newKey + "." + childPath;
        }
        // Check chained renames
        else {
          for (const [origKey, renamedValue] of Object.entries(updatedRenames)) {
            if (currentSelectedProfile === origKey || currentSelectedProfile === renamedValue) {
              if (currentSelectedProfile === origKey) {
                newCurrentSelectedProfile = renamedValue;
              }
              break;
            }
          }
        }
      }

      if (newCurrentSelectedProfile !== currentSelectedProfile) {
        return {
          ...prev,
          [configPath]: newCurrentSelectedProfile,
        };
      }
      return prev;
    });

    // Update expanded nodes to reflect the rename
    setExpandedNodesByConfig((prev) => {
      const currentExpandedNodes = prev[configPath] || new Set();
      const newExpandedNodes = new Set<string>();

      // Map old expanded node keys to new keys based on the rename
      for (const expandedKey of currentExpandedNodes) {
        let newExpandedKey = expandedKey;

        // Special case: if we're canceling a rename (newKey === originalKey)
        if (newKey === originalKey) {
          const oldRenames = renames[configPath] || {};
          const oldRenamedValue = oldRenames[originalKey];
          // If the expanded key was the renamed version, restore it to the original
          if (expandedKey === oldRenamedValue) {
            newExpandedKey = originalKey;
          }
          // If the expanded key was a child of the renamed version, restore it to the original
          else if (oldRenamedValue && expandedKey.startsWith(oldRenamedValue + ".")) {
            const childPath = expandedKey.substring(oldRenamedValue.length + 1);
            newExpandedKey = originalKey + "." + childPath;
          }
        }
        // Check direct rename
        else if (expandedKey === originalKey) {
          newExpandedKey = newKey;
        }
        // Check child rename
        else if (expandedKey.startsWith(originalKey + ".")) {
          const childPath = expandedKey.substring(originalKey.length + 1);
          newExpandedKey = newKey + "." + childPath;
        }
        // Check chained renames
        else {
          for (const [origKey, renamedValue] of Object.entries(updatedRenames)) {
            if (expandedKey === origKey || expandedKey === renamedValue) {
              if (expandedKey === origKey) {
                newExpandedKey = renamedValue;
              }
              break;
            }
          }
        }

        newExpandedNodes.add(newExpandedKey);
      }

      return {
        ...prev,
        [configPath]: newExpandedNodes,
      };
    });

    // Auto-expand parent profiles when a profile is moved to a nested path
    if (newKey !== originalKey && newKey.includes(".")) {
      // Extract the parent path from the new key
      const parentPath = newKey.substring(0, newKey.lastIndexOf("."));

      // Add the parent path to expanded nodes if it's not already expanded
      setExpandedNodesByConfig((prev) => {
        const currentExpandedNodes = prev[configPath] || new Set();
        if (!currentExpandedNodes.has(parentPath)) {
          const newExpandedNodes = new Set(currentExpandedNodes);
          newExpandedNodes.add(parentPath);
          return {
            ...prev,
            [configPath]: newExpandedNodes,
          };
        }
        return prev;
      });
    }

    // Update any pending defaults that reference the old profile name or consolidated renames
    setPendingDefaults((prev) => {
      const configDefaults = prev[configPath] || {};
      const updatedDefaults = { ...configDefaults };
      let hasChanges = false;

      // Check each default entry against all consolidated renames
      Object.entries(updatedDefaults).forEach(([profileType, defaultEntry]) => {
        // Check direct rename
        if (defaultEntry.value === originalKey) {
          updatedDefaults[profileType] = {
            ...defaultEntry,
            value: newKey,
          };
          hasChanges = true;
        }
        // Check child renames
        else if (defaultEntry.value.startsWith(originalKey + ".")) {
          const childPath = defaultEntry.value.substring(originalKey.length + 1);
          updatedDefaults[profileType] = {
            ...defaultEntry,
            value: newKey + "." + childPath,
          };
          hasChanges = true;
        }
        // Check consolidated renames
        else {
          for (const [origKey, renamedValue] of Object.entries(updatedRenames)) {
            if (defaultEntry.value === origKey) {
              updatedDefaults[profileType] = {
                ...defaultEntry,
                value: renamedValue,
              };
              hasChanges = true;
              break;
            }
          }
        }
      });

      // Check if the renamed profile was a default profile and create a pending default change
      const config = configurations[selectedTab!].properties;
      const defaults = config.defaults || {};

      // Check if the original profile was a default for any profile type
      for (const [profileType, defaultProfileName] of Object.entries(defaults)) {
        if (defaultProfileName === originalKey) {
          // The renamed profile was a default, create a pending default change
          updatedDefaults[profileType] = {
            value: newKey,
            path: [profileType],
          };
          hasChanges = true;
        }
      }

      if (hasChanges) {
        return {
          ...prev,
          [configPath]: updatedDefaults,
        };
      }

      return prev;
    });

    // If the new key is nested, create parent profiles as pending profiles
    if (newKey.includes(".")) {
      const parentParts = newKey.split(".");
      const parentKeys: string[] = [];

      // Create all parent profile keys
      for (let i = 1; i < parentParts.length; i++) {
        parentKeys.push(parentParts.slice(0, i).join("."));
      }

      // Check which parent profiles need to be created
      const config = configurations[selectedTab!];
      const existingProfiles = flattenProfiles(config.properties.profiles);
      const existingProfileKeys = Object.keys(existingProfiles);

      // Get all current profile keys including renamed ones
      const allCurrentProfileKeys = existingProfileKeys.map((key) => getRenamedProfileKeyWithNested(key, configPath, renames));

      // Also include pending profiles
      const pendingProfiles = extractPendingProfiles(configPath);
      const pendingProfileKeys = Object.keys(pendingProfiles);
      allCurrentProfileKeys.push(...pendingProfileKeys);

      // Add pending changes for parent profiles that don't exist
      setPendingChanges((prev) => {
        const newState = { ...prev };
        if (!newState[configPath]) {
          newState[configPath] = {};
        }

        parentKeys.forEach((parentKey) => {
          // Check if this parent key is already a target of another rename operation
          const isRenameTarget = Object.values(renames[configPath] || {}).includes(parentKey);
          if (isRenameTarget) {
            // This parent profile is already being created by another rename, skip it
            return;
          }

          // Check if the parent profile exists in original profiles or as a renamed profile
          const existsAsOriginal = existingProfileKeys.includes(parentKey);
          const existsAsRenamed = allCurrentProfileKeys.includes(parentKey);

          if (!existsAsOriginal && !existsAsRenamed) {
            // Create a pending change for the parent profile (without type)
            const parentPath = parentKey.split(".");
            const fullPath = ["profiles"];
            for (let i = 0; i < parentPath.length; i++) {
              fullPath.push(parentPath[i]);
              if (i < parentPath.length - 1) {
                fullPath.push("profiles");
              }
            }

            const fullPathKey = fullPath.join(".");
            newState[configPath][fullPathKey] = {
              value: {}, // Empty object to create the profile structure
              path: [],
              profile: parentKey,
              secure: false,
            };
          }
        });

        return newState;
      });
    }

    // Update rename count for this profile - only for actual renames, not drag and drop operations
    if (!isDragDrop) {
      setRenameCounts((prev) => {
        const configCounts = prev[configPath] || {};
        const currentCount = configCounts[originalKey] || 0;
        return {
          ...prev,
          [configPath]: {
            ...configCounts,
            [originalKey]: currentCount + 1,
          },
        };
      });
    }
    // Close the modal
    setRenameProfileModalOpen(false);

    return true; // Return true to indicate success
  };

  const handleProfileSelection = (profileKey: string) => {
    if (profileKey === "") {
      // Deselect profile
      setSelectedProfileKey(null);
      // Don't clear merged properties - they will be updated when a new profile is selected
      return;
    }

    setSelectedProfileKey(profileKey);

    // Store the selected profile for this configuration
    const configPath = configurations[selectedTab!]?.configPath;
    if (configPath) {
      setSelectedProfilesByConfig((prev) => ({
        ...prev,
        [configPath]: profileKey,
      }));

      // Get the correct profile name for merged properties (handles renames)
      const profileNameForMergedProperties = getProfileNameForMergedProperties(profileKey, configPath, renames);

      // Create a unique request key to prevent duplicate requests
      const requestKey = `${configPath}:${profileKey}`;

      // Check if we already have a pending request for this profile
      if (pendingMergedPropertiesRequest === requestKey) {
        return;
      }

      const changes = formatPendingChanges();

      // Mark this request as pending
      setPendingMergedPropertiesRequest(requestKey);

      vscodeApi.postMessage({
        command: "GET_MERGED_PROPERTIES",
        profilePath: profileNameForMergedProperties, // Send original profile key for backend lookup
        configPath: configPath,
        changes: changes,
        renames: changes.renames,
        currentProfileKey: profileKey,
        originalProfileKey: profileNameForMergedProperties,
      });
    }
  };

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

  // Helper function to merge pending changes for a specific profile and path
  const mergePendingChangesForProfile = (baseObj: any, path: string[], configPath: string): any => {
    const fullPath = path.join(".");
    const currentProfileKey = extractProfileKeyFromPath(path);
    const pendingChangesAtLevel: { [key: string]: any } = {};

    // Check if this profile was renamed and get the original profile name (handle nested profiles)
    const originalProfileKey = getOriginalProfileKeyWithNested(currentProfileKey, configPath, renames);

    // Helper function to check if a profile key matches considering renames
    const isProfileKeyMatch = (entryProfileKey: string): boolean => {
      // Direct match with current or original profile key
      if (entryProfileKey === currentProfileKey || entryProfileKey === originalProfileKey) {
        return true;
      }

      // For nested profiles, check if this entry's profile key would match after applying renames
      if (entryProfileKey.includes(".") || currentProfileKey.includes(".")) {
        // Get the renamed version of the entry's profile key
        const renamedEntryProfileKey = getRenamedProfileKeyWithNested(entryProfileKey, configPath, renames);
        if (renamedEntryProfileKey === currentProfileKey) {
          return true;
        }

        // Also check if the current profile key, when reversed through renames, matches the entry
        const originalOfCurrentKey = getOriginalProfileKeyWithNested(currentProfileKey, configPath, renames);
        if (entryProfileKey === originalOfCurrentKey) {
          return true;
        }

        // For deeply nested profiles, check if the entry profile key is an ancestor or descendant
        // after applying renames at each level
        const entryParts = entryProfileKey.split(".");
        const currentParts = currentProfileKey.split(".");

        // Check if entry profile is a parent of current profile after renames
        if (entryParts.length < currentParts.length) {
          const currentParentKey = currentParts.slice(0, entryParts.length).join(".");
          const renamedEntryKey = getRenamedProfileKeyWithNested(entryProfileKey, configPath, renames);
          if (renamedEntryKey === currentParentKey) {
            return true;
          }
        }

        // Check if current profile is a parent of entry profile after renames
        if (currentParts.length < entryParts.length) {
          const entryParentKey = entryParts.slice(0, currentParts.length).join(".");
          const renamedEntryParentKey = getRenamedProfileKeyWithNested(entryParentKey, configPath, renames);
          if (renamedEntryParentKey === currentProfileKey) {
            return true;
          }
        }
      }

      return false;
    };

    Object.entries(pendingChanges[configPath] ?? {}).forEach(([key, entry]) => {
      // Check if the entry belongs to the current profile considering renames
      if (isProfileKeyMatch(entry.profile) && (key === fullPath || key.startsWith(fullPath + "."))) {
        const keyParts = key.split(".");
        const relativePath = keyParts.slice(path.length);

        if (relativePath.length === 1 && !entry.secure) {
          pendingChangesAtLevel[relativePath[0]] = entry.value;
        } else if (relativePath.length > 1 && relativePath[0] !== "profiles" && !entry.secure) {
          let current = baseObj;
          for (let i = 0; i < relativePath.length - 1; i++) {
            if (!current[relativePath[i]]) {
              current[relativePath[i]] = {};
            }
            current = current[relativePath[i]];
          }
          current[relativePath[relativePath.length - 1]] = entry.value;
        } else if (entry.secure && path[path.length - 1] !== "properties") {
          // Handle secure properties - they should be added to the secure array
          // Only add to parent profile's secure array, not properties object's secure array
          // Ensure secure array exists
          if (!baseObj.secure) {
            baseObj.secure = [];
          }

          // For secure properties, the key format is typically "profiles.profileName.secure.propertyName"
          // We need to extract the property name from the key
          const keyParts = key.split(".");
          const propertyName = keyParts[keyParts.length - 1];

          // Add the secure property name to the secure array if not already present
          if (!baseObj.secure.includes(propertyName)) {
            baseObj.secure.push(propertyName);
          }
        }
      }
    });

    const result = { ...baseObj, ...pendingChangesAtLevel };

    return result;
  };

  // Helper function to merge merged properties into the configuration
  const mergeMergedProperties = (combinedConfig: any, path: string[], mergedProps: any, configPath: string): any => {
    if (!mergedProps || path.length === 0 || path[path.length - 1] === "type" || path[path.length - 1] === "secure") {
      return combinedConfig;
    }

    // Only process at profile level, not properties level
    if (path[path.length - 1] === "properties") {
      return combinedConfig;
    }

    // Ensure properties object exists
    if (!combinedConfig.hasOwnProperty("properties")) {
      combinedConfig.properties = {};
    }

    const currentProfileName = extractProfileKeyFromPath(path);
    const profileType = getProfileType(currentProfileName, selectedTab, configurations, pendingChanges, renames);
    const propertySchema = schemaValidations[configPath]?.propertySchema[profileType || ""] || {};
    const allowedProperties = Object.keys(propertySchema);
    const fullPath = path.join(".");

    // Debug logging for pending changes
    const currentProfileKey = extractProfileKeyFromPath(path);

    // Find the original profile key by looking for what was renamed to the current key
    const configRenames = renames[configPath] || {};
    let originalProfileKey = currentProfileKey;

    // Look for the original key that was renamed to the current key
    for (const [originalKey, newKey] of Object.entries(configRenames)) {
      if (newKey === currentProfileKey) {
        originalProfileKey = originalKey;
        break;
      }
    }

    // Always log rename detection for debugging

    // Check if current profile should be renamed
    // We should only skip if this profile is the ORIGINAL profile that was renamed
    // (not an intermediate profile in a rename chain)
    const shouldBeRenamed = configRenames[currentProfileKey];

    // A profile should be skipped if:
    // 1. It has a rename mapping (shouldBeRenamed is truthy)
    // 2. It's not the final result of any rename chain (not in the values of configRenames)
    // 3. It's not an intermediate step in a rename chain
    const isOriginalProfile = shouldBeRenamed && !Object.values(configRenames).includes(currentProfileKey);

    // Additional check: if this profile is the final result of a rename chain, don't skip it
    const isFinalResult = Object.values(configRenames).includes(currentProfileKey);

    if (shouldBeRenamed && isOriginalProfile && !isFinalResult) {
      // Skip processing merged properties for the old profile path
      return combinedConfig;
    } else if (shouldBeRenamed && !isOriginalProfile) {
    } else if (isFinalResult) {
    }

    if (currentProfileKey !== originalProfileKey) {
    }

    Object.entries(mergedProps).forEach(([key, propData]: [string, any]) => {
      const pendingKey = `${fullPath}.properties.${key}`;

      // Check for pending changes using both current path and original path (considering renames)
      const currentProfileKey = extractProfileKeyFromPath(path);
      const originalProfileKey = getOriginalProfileKeyWithNested(currentProfileKey, configPath, renames);

      // Construct the original path for pending changes lookup
      // For nested profiles, we need to include "profiles" segments between profile levels
      let originalPath: string;
      if (originalProfileKey.includes(".")) {
        // This is a nested profile - construct the full path with "profiles" segments
        const profileParts = originalProfileKey.split(".");
        const pathParts = ["profiles"];
        for (let i = 0; i < profileParts.length; i++) {
          pathParts.push(profileParts[i]);
          if (i < profileParts.length - 1) {
            pathParts.push("profiles");
          }
        }
        originalPath = pathParts.join(".");
      } else {
        // Top-level profile
        originalPath = `profiles.${originalProfileKey}`;
      }

      const originalPendingKey = `${originalPath}.properties.${key}`;

      // Debug logging for path construction
      if (key === "host" || key === "port" || key === "user" || key === "password") {
      }

      const isInPendingChanges =
        pendingChanges[configPath]?.[pendingKey] !== undefined || pendingChanges[configPath]?.[originalPendingKey] !== undefined;

      // Check for deletions using the same enhanced path logic as pending changes
      let isInDeletions = (deletions[configPath] ?? []).includes(pendingKey) || (deletions[configPath] ?? []).includes(originalPendingKey);

      // Also check for nested path structure (for cases like zftp.zosmf -> zosmf)
      if (!isInDeletions && originalProfileKey.includes(".")) {
        // Construct nested path with .profiles segments
        const profileParts = originalProfileKey.split(".");
        const pathParts = ["profiles"];
        for (let i = 0; i < profileParts.length; i++) {
          pathParts.push(profileParts[i]);
          if (i < profileParts.length - 1) {
            pathParts.push("profiles");
          }
        }
        pathParts.push("properties", key);
        const nestedPendingKey = pathParts.join(".");
        isInDeletions = (deletions[configPath] ?? []).includes(nestedPendingKey);
      }

      // Debug logging for precedence issue
      if (key === "host" || key === "port" || key === "user" || key === "password") {
        // Common properties to debug
      }

      // If the property is in deletions, we should add the merged property to replace it
      // For secure properties that were deleted, we still want to show the merged property in properties
      const shouldAddMerged =
        allowedProperties.includes(key) && !isInPendingChanges && (isInDeletions || !combinedConfig.properties.hasOwnProperty(key));

      // Debug logging for precedence issue
      if (key === "host" || key === "port" || key === "user" || key === "password") {
        // Common properties to debug
      }

      if (shouldAddMerged) {
        // Only add primitive values to avoid recursion
        if (typeof propData.value !== "object" || propData.value === null) {
          combinedConfig.properties[key] = propData.value;
          if (key === "host" || key === "port" || key === "user" || key === "password") {
          }
        }
      }
    });

    return combinedConfig;
  };

  // Helper function to ensure required profile properties exist
  const ensureProfileProperties = (combinedConfig: any, path: string[]): any => {
    if (path.length > 0 && path[path.length - 1] !== "type" && path[path.length - 1] !== "properties" && path[path.length - 1] !== "secure") {
      if (!combinedConfig.hasOwnProperty("properties")) {
        combinedConfig.properties = {};
      }
      if (!combinedConfig.hasOwnProperty("secure")) {
        combinedConfig.secure = [];
      }
      if (!combinedConfig.hasOwnProperty("type")) {
        combinedConfig.type = "";
      }
    }
    return combinedConfig;
  };

  // Helper function to filter secure properties from the properties object
  const filterSecureProperties = (value: any, combinedConfig: any, configPath?: string): any => {
    if (combinedConfig.secure && Array.isArray(combinedConfig.secure)) {
      const secureProperties = combinedConfig.secure;
      const filteredProperties = { ...value };

      Object.keys(filteredProperties).forEach((propKey) => {
        if (secureProperties.includes(propKey)) {
          // Don't filter out properties that are in the deletions list (they should be shown as merged properties)
          const isInDeletions = configPath && (deletions[configPath] ?? []).some((deletion) => deletion.includes(`properties.${propKey}`));

          // Don't filter out secure properties if there's a pending insecure property with the same key
          // This prevents the secure property from being rendered when it will be replaced
          const hasPendingInsecureProperty =
            configPath &&
            pendingChanges[configPath] &&
            Object.entries(pendingChanges[configPath]).some(([key, entry]) => {
              const keyParts = key.split(".");
              const propertyName = keyParts[keyParts.length - 1];
              return propertyName === propKey && !entry.secure && key.includes("properties");
            });

          if (!isInDeletions && !hasPendingInsecureProperty) {
            delete filteredProperties[propKey];
          }
        }
      });

      return Object.keys(filteredProperties).length === 0 ? null : filteredProperties;
    }
    return value;
  };

  // Helper function to merge pending secure properties into secure arrays
  const mergePendingSecureProperties = (value: any[], path: string[], configPath: string): any[] => {
    const pendingSecureProps: string[] = Object.entries(pendingChanges[configPath] ?? {})
      .filter(([, entry]) => {
        if (!entry.secure) return false;

        const expectedSecurePath = pathFromArray(path.concat(["secure"]));
        const actualPath = path.join(".");

        let currentProfileName: string;
        if (path.length >= 2 && path[0] === "profiles") {
          const profileSegments = [];
          for (let i = 1; i < path.length; i++) {
            if (path[i] !== "profiles" && path[i] !== "secure") {
              profileSegments.push(path[i]);
            }
          }
          currentProfileName = profileSegments.join(".");
        } else {
          currentProfileName = path[1] || "";
        }

        return (
          actualPath === expectedSecurePath &&
          (entry.profile === currentProfileName || entry.profile.split(".").slice(0, -2).join(".") === currentProfileName)
        );
      })
      .map(([, entry]) => String(entry.path[entry.path.length - 1]));

    const baseArray: any[] = Array.isArray(value) ? value : [];

    // Filter out secure properties from the base array if there's a pending insecure property with the same key
    const filteredBaseArray = baseArray.filter((prop) => {
      const hasPendingInsecureProperty = Object.entries(pendingChanges[configPath] ?? {}).some(([key, entry]) => {
        const keyParts = key.split(".");
        const propertyName = keyParts[keyParts.length - 1];
        return propertyName === prop && !entry.secure && key.includes("properties");
      });
      return !hasPendingInsecureProperty;
    });

    // Only add pending secure props that aren't already in the filtered base array
    const newSecureProps = pendingSecureProps.filter((prop) => !filteredBaseArray.includes(prop));
    const result = newSecureProps.length > 0 ? [...filteredBaseArray, ...newSecureProps] : filteredBaseArray;
    // Sort alphabetically
    return result.sort();
  };

  // Helper function to check if a property is actually inherited from another profile
  const isPropertyActuallyInherited = (profilePath: string, currentProfileKey: string | null, configPath: string, propertyName?: string): boolean => {
    if (!profilePath || !currentProfileKey) {
      return false;
    }

    // First check if the paths are exactly the same
    if (profilePath === currentProfileKey) {
      return false;
    }

    // Check if there are pending changes for this specific property in the current profile
    // If there are pending changes, the property is not inherited (it's been overridden locally)
    if (propertyName) {
      const currentProfilePath = `profiles.${currentProfileKey}`;
      const propertyPendingKey = `${currentProfilePath}.properties.${propertyName}`;

      // Also check for pending changes under the original profile path (before rename)
      // Find the original profile key by looking for what was renamed to the current key
      const configRenames = renames[configPath] || {};
      let originalProfileKey = currentProfileKey;

      // Look for the original key that was renamed to the current key
      for (const [originalKey, newKey] of Object.entries(configRenames)) {
        if (newKey === currentProfileKey) {
          originalProfileKey = originalKey;
          break;
        }
      }

      const originalProfilePath = `profiles.${originalProfileKey}`;
      const originalPropertyPendingKey = `${originalProfilePath}.properties.${propertyName}`;

      // Also check for nested path structure (for cases like zftp.zosmf -> zosmf)
      let nestedPropertyPendingKey = "";
      if (originalProfileKey.includes(".")) {
        // Construct nested path with .profiles segments
        const profileParts = originalProfileKey.split(".");
        const pathParts = ["profiles"];
        for (let i = 0; i < profileParts.length; i++) {
          pathParts.push(profileParts[i]);
          if (i < profileParts.length - 1) {
            pathParts.push("profiles");
          }
        }
        pathParts.push("properties", propertyName);
        nestedPropertyPendingKey = pathParts.join(".");
      }

      const hasPendingChanges =
        pendingChanges[configPath]?.[propertyPendingKey] !== undefined ||
        pendingChanges[configPath]?.[originalPropertyPendingKey] !== undefined ||
        (nestedPropertyPendingKey && pendingChanges[configPath]?.[nestedPropertyPendingKey] !== undefined);

      // Debug logging for pending changes check
      if (propertyName === "host" || propertyName === "port" || propertyName === "user" || propertyName === "password") {
      }

      if (hasPendingChanges) {
        return false;
      }
    }

    // Get all profile renames in the config
    const renamesForConfig = renames[configPath] || {};

    // Function to get the original profile name (reverse renames)
    const getOriginalName = (profileName: string): string => {
      let originalName = profileName;

      // Apply reverse renames iteratively to get back to the original name
      let changed = true;
      while (changed) {
        changed = false;

        // Sort renames by length of newKey (longest first) to handle nested renames correctly
        const sortedRenames = Object.entries(renamesForConfig).sort(([, a], [, b]) => b.length - a.length);

        for (const [originalKey, newKey] of sortedRenames) {
          // Check for exact match
          if (originalName === newKey) {
            originalName = originalKey;
            changed = true;
            break;
          }

          // Check for partial matches (parent renames affecting children)
          if (originalName.startsWith(newKey + ".")) {
            originalName = originalName.replace(newKey + ".", originalKey + ".");
            changed = true;
            break;
          }
        }
      }

      return originalName;
    };

    // Get the original names for both paths
    const originalSourcePath = getOriginalName(profilePath);
    const originalCurrentPath = getOriginalName(currentProfileKey);

    // If the original paths match, this property is not inherited
    if (originalSourcePath === originalCurrentPath) {
      return false;
    }

    // Check if there's an actual inheritance relationship by looking at the profile configuration
    // This handles cases where profiles inherit from base profiles that have been renamed
    const config = configurations[selectedTab!]?.properties;
    if (config) {
      // Check if the current profile inherits from the source profile through the inheritance chain
      const checkInheritanceChain = (currentProfile: string, sourceProfile: string): boolean => {
        // Get the profile type for the current profile
        const currentProfileType = getProfileType(currentProfile, selectedTab, configurations, pendingChanges, renames);
        if (!currentProfileType) return false;

        // Check if the source profile is the default for this profile type
        const defaults = config.defaults || {};
        const defaultForType = defaults[currentProfileType];

        // Apply renames to the default to see if it matches the source profile
        if (defaultForType) {
          const renamedDefault = getRenamedProfileKeyWithNested(defaultForType, configPath, renames);
          if (renamedDefault === sourceProfile) {
            return true;
          }
        }

        // Also check if the source profile is a base profile that the current profile should inherit from
        // This handles cases where the source profile is a base profile (like global_base1)
        const sourceProfileType = getProfileType(sourceProfile, selectedTab, configurations, pendingChanges, renames);
        if (sourceProfileType && sourceProfileType === currentProfileType) {
          // If both profiles have the same type and the source is a base profile, it's inherited
          // Check if the source profile is a base profile by checking if it's the default for its type
          const sourceDefaultForType = defaults[sourceProfileType];
          if (sourceDefaultForType) {
            const renamedSourceDefault = getRenamedProfileKeyWithNested(sourceDefaultForType, configPath, renames);
            if (renamedSourceDefault === sourceProfile) {
              return true;
            }
          }
        }

        return false;
      };

      // Check if the current profile inherits from the source profile
      if (checkInheritanceChain(currentProfileKey, profilePath)) {
        return true;
      }
    }

    return true;
  };

  // Helper function to determine if a property is from merged properties
  const isPropertyFromMergedProps = (displayKey: string | undefined, path: string[], mergedProps: any, configPath: string): boolean => {
    // Only consider properties as merged if showMergedProperties is true and profile is not untyped
    const originalProfileKey = extractProfileKeyFromPath(path);
    const currentProfileKey = getRenamedProfileKeyWithNested(originalProfileKey, configPath, renames);
    const currentProfileType = getProfileType(currentProfileKey, selectedTab, configurations, pendingChanges, renames);
    const isProfileUntyped = !currentProfileType || currentProfileType.trim() === "";

    // Debug logging for merged property detection
    if (displayKey === "host" || displayKey === "port" || displayKey === "user" || displayKey === "password") {
    }

    if (!showMergedProperties || isProfileUntyped || !displayKey) {
      return false;
    }

    const mergedPropData = mergedProps?.[displayKey];
    const jsonLoc = mergedPropData?.jsonLoc;
    const osLoc = mergedPropData?.osLoc;

    // Extract profile path from jsonLoc
    const jsonLocParts = jsonLoc ? jsonLoc.split(".") : [];
    const profilePathParts = jsonLocParts.slice(1, -2);
    const profilePath = profilePathParts.filter((part: string, index: number) => part !== "profiles" || index % 2 === 0).join(".");

    // Check if this property is actually inherited
    const isInherited = isPropertyActuallyInherited(profilePath, currentProfileKey, configPath, displayKey);

    // Debug logging for inheritance check
    if (displayKey === "host" || displayKey === "port" || displayKey === "user" || displayKey === "password") {
    }

    // Special case: if isPropertyActuallyInherited returns false but this is a profile with the same name
    // in a different config file, we should still consider it as inherited
    const isSameProfileNameInDifferentConfig = (() => {
      if (isInherited) return false; // Already handled by isPropertyActuallyInherited

      // Check if the profile names match (indicating same profile name in different configs)
      if (profilePath === currentProfileKey) {
        // Check if the source comes from a different config file
        const selectedConfigPath = configurations[selectedTab!]?.configPath;
        const osLocString = osLoc.join("");
        return selectedConfigPath !== osLocString;
      }

      return false;
    })();

    if (!isInherited && !isSameProfileNameInDifferentConfig) {
      return false;
    }

    const selectedConfigPath = configurations[selectedTab!]?.configPath;
    const osLocString = osLoc.join("");
    const pathsEqual = selectedConfigPath === osLocString;
    const currentProfilePathForComparison = path.slice(0, -1).join(".");

    // Check if this profile has been renamed
    const currentlyViewedProfileKey = selectedProfileKey;
    const hasBeenRenamed =
      currentlyViewedProfileKey && Object.values(renames[configPath] || {}).some((newName) => newName === currentlyViewedProfileKey);

    if (hasBeenRenamed) {
      // Extract profile name from jsonLoc
      const jsonLocParts = jsonLoc ? jsonLoc.split(".") : [];
      let jsonLocProfileName = "";

      if (jsonLocParts.length >= 2 && jsonLocParts[0] === "profiles") {
        let profileParts = [];
        let i = 1;

        while (i < jsonLocParts.length) {
          if (jsonLocParts[i] !== "profiles" && jsonLocParts[i] !== "properties") {
            profileParts.push(jsonLocParts[i]);
            i++;
          } else if (jsonLocParts[i] === "profiles") {
            i++;
          } else if (jsonLocParts[i] === "properties") {
            break;
          } else {
            i++;
          }
        }
        jsonLocProfileName = profileParts.join(".");
      }

      // For renamed profiles, we need to check if the jsonLoc refers to the CURRENT profile structure
      // The jsonLoc will contain the OLD profile name (e.g., 'profiles.z18.properties.port')
      // We need to check if this matches the currently viewed profile structure by mapping old names to new names

      // Get the full profile path for the current profile and jsonLoc profile
      const currentProfileParts = currentlyViewedProfileKey ? currentlyViewedProfileKey.split(".") : [];
      const jsonLocProfileParts = jsonLocProfileName ? jsonLocProfileName.split(".") : [];

      // Check if the jsonLoc profile name matches the current profile (considering renames)
      const jsonLocRefersToCurrentProfile = (() => {
        // Direct match
        if (jsonLocProfileName === currentlyViewedProfileKey) return true;

        // Check if this is a child profile and its path matches after considering renames
        const currentProfilePath = currentProfileParts.join(".");
        const jsonLocPath = jsonLocProfileParts.join(".");

        // If the jsonLoc path matches the current path exactly (after any renames)
        if (jsonLocPath === currentProfilePath) return true;

        // If we're looking at a child profile, check if its full path matches after parent rename
        if (currentProfileParts.length > 1) {
          const parentProfilePath = currentProfileParts.slice(0, -1).join(".");
          const originalParentKey = Object.keys(renames[configPath] || {}).find((oldName) => renames[configPath][oldName] === parentProfilePath);

          if (originalParentKey) {
            // Reconstruct the original path using the parent's old name
            const childName = currentProfileParts[currentProfileParts.length - 1];
            const originalPath = `${originalParentKey}.${childName}`;
            return jsonLocPath === originalPath;
          }
        }

        return false;
      })();

      // Check if the jsonLoc profile name is the OLD name that maps to the current profile
      const jsonLocIsOldNameOfCurrentProfile =
        jsonLocProfileName &&
        Object.keys(renames[configPath] || {}).some(
          (oldName) => oldName === jsonLocProfileName && renames[configPath][oldName] === currentlyViewedProfileKey
        );

      // Check if the jsonLoc refers to a child profile of a renamed parent
      const isFromChildOfRenamedParent =
        currentlyViewedProfileKey &&
        jsonLocProfileName &&
        Object.entries(renames[configPath] || {}).some(([oldName, newName]) => {
          // Check if current profile is a child of the new parent name
          const isCurrentProfileChildOfNewParent = currentlyViewedProfileKey.startsWith(newName + ".");
          // Check if jsonLoc refers to the old parent name
          const jsonLocRefersToOldParent = jsonLocProfileName === oldName;
          return isCurrentProfileChildOfNewParent && jsonLocRefersToOldParent;
        });

      const result = !pathsEqual || (!jsonLocRefersToCurrentProfile && !jsonLocIsOldNameOfCurrentProfile && !isFromChildOfRenamedParent);

      // Debug logging for final result (renamed profile path)
      if (displayKey === "host" || displayKey === "port" || displayKey === "user" || displayKey === "password") {
      }

      return result;
    } else {
      // For non-renamed profiles, use the original logic
      const jsonLocIndicatesDifferentProfile = jsonLoc && !jsonLoc.includes(currentProfilePathForComparison + ".properties");

      // Check if this property comes from a profile with the same name in a different config file
      // This handles the case where profiles with the same name exist in different configs (e.g., "zosmf" in both user and project configs)
      const isFromSameProfileNameInDifferentConfig = (() => {
        if (!jsonLoc || !osLoc || !selectedConfigPath) return false;

        // Extract the profile name from jsonLoc
        const jsonLocParts = jsonLoc.split(".");
        const profilePathParts = jsonLocParts.slice(1, -2);
        const sourceProfilePath = profilePathParts.filter((part: string, index: number) => part !== "profiles" || index % 2 === 0).join(".");

        // Get the current profile name being viewed
        const currentProfileName = extractProfileKeyFromPath(path);

        // Check if the source profile name matches the current profile name but comes from a different config
        const osLocString = osLoc.join("");
        const isDifferentConfig = selectedConfigPath !== osLocString;
        const isSameProfileName = sourceProfilePath === currentProfileName;

        return isDifferentConfig && isSameProfileName;
      })();

      const result = !pathsEqual || jsonLocIndicatesDifferentProfile || isFromSameProfileNameInDifferentConfig;

      return result;
    }
  };

  // Helper function to check if a merged property is secure
  const isMergedPropertySecure = (displayKey: string, jsonLoc: string, _osLoc?: string[], secure?: boolean): boolean => {
    if (!jsonLoc) return false;

    // If we have the secure status from the merged properties data, use it
    if (secure !== undefined) {
      return secure;
    }

    const jsonLocParts = jsonLoc.split(".");
    if (jsonLocParts.length < 4 || jsonLocParts[0] !== "profiles") {
      return false;
    }

    let profilePath = "";
    for (let i = 1; i < jsonLocParts.length - 2; i++) {
      if (jsonLocParts[i + 1] === "profiles") {
        const parentProfile = jsonLocParts[i];
        let nestedProfilePath = [parentProfile];
        let pathIndex = i + 2;

        while (pathIndex < jsonLocParts.length - 2 && jsonLocParts[pathIndex + 1] === "profiles") {
          nestedProfilePath.push(jsonLocParts[pathIndex]);
          pathIndex += 2;
        }

        if (pathIndex < jsonLocParts.length - 2) {
          nestedProfilePath.push(jsonLocParts[pathIndex]);
        }

        profilePath = nestedProfilePath.join(".");
        break;
      } else if (i === 1) {
        profilePath = jsonLocParts[i];
        break;
      }
    }

    if (profilePath) {
      // Use flattenProfiles to get the correct profile for nested profiles
      const flatProfiles = flattenProfiles(configurations[selectedTab!]?.properties?.profiles || {});
      const sourceProfile = flatProfiles[profilePath];
      return sourceProfile?.secure?.includes(displayKey) || false;
    }

    return false;
  };

  // Helper function to check if a property can be made secure based on the schema
  const canPropertyBeSecure = (displayKey: string, path: string[]): boolean => {
    if (!displayKey || !path || path.length === 0) {
      return false;
    }

    // Get the profile type from the path
    const profileType = getProfileTypeFromPath(path, selectedTab, configurations, pendingChanges);

    // Allow secure properties for typeless profiles (when profileType is null/undefined)
    if (!profileType) {
      return true;
    }

    // Get the schema validation for the current configuration
    const configPath = configurations[selectedTab!]?.configPath;
    if (!configPath) {
      return false;
    }

    const schemaValidation = schemaValidations[configPath];
    if (!schemaValidation || !schemaValidation.propertySchema) {
      return false;
    }

    // Get the properties for this profile type from the schema
    const profileSchema = schemaValidation.propertySchema[profileType];
    if (!profileSchema) {
      return false;
    }

    // Check if this property is marked as secure in the schema (case insensitive)
    const displayKeyLower = displayKey.toLowerCase();
    const propertySchema = Object.entries(profileSchema).find(([key]) => key.toLowerCase() === displayKeyLower)?.[1];
    return propertySchema?.secure === true;
  };

  // Helper function to check if a property can be made secure based on the schema (for wizard)
  const canPropertyBeSecureForWizard = (displayKey: string, profileType: string): boolean => {
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

    const schemaValidation = schemaValidations[configPath];
    if (!schemaValidation || !schemaValidation.propertySchema) {
      return false;
    }

    // Get the properties for this profile type from the schema
    const profileSchema = schemaValidation.propertySchema[profileType];
    if (!profileSchema) {
      return false;
    }

    // Check if this property is marked as secure in the schema (case insensitive)
    const displayKeyLower = displayKey.toLowerCase();
    const propertySchema = Object.entries(profileSchema).find(([key]) => key.toLowerCase() === displayKeyLower)?.[1];
    return propertySchema?.secure === true;
  };

  // Helper function to determine if a property is currently secure
  const isPropertySecure = (fullKey: string, displayKey: string, path: string[], mergedProps?: any): boolean => {
    const configPath = configurations[selectedTab!]?.configPath;
    if (!configPath) {
      return false;
    }

    // Check if this property is from merged properties
    const isFromMergedProps = isPropertyFromMergedProps(displayKey, path, mergedProps, configPath);

    if (isFromMergedProps) {
      const mergedPropData = displayKey ? mergedProps?.[displayKey] : undefined;
      const jsonLoc = mergedPropData?.jsonLoc;
      const osLoc = mergedPropData?.osLoc;
      const secure = mergedPropData?.secure;
      return isMergedPropertySecure(displayKey, jsonLoc, osLoc, secure);
    }

    // Check if this property is in pending changes with secure flag
    const pendingChange = pendingChanges[configPath]?.[fullKey];
    if (pendingChange) {
      return pendingChange.secure || false;
    }

    // Check if this property is in the original configuration's secure array
    const profileKey = extractProfileKeyFromPath(path);
    if (profileKey) {
      // Use flattenProfiles to get the correct profile for nested profiles
      const flatProfiles = flattenProfiles(configurations[selectedTab!]?.properties?.profiles || {});
      const profile = flatProfiles[profileKey];
      return profile?.secure?.includes(displayKey) || false;
    }

    return false;
  };

  // Helper function to toggle the secure state of a property
  const handleToggleSecure = (fullKey: string, displayKey: string, path: string[]) => {
    // Don't allow toggling secure state if secure values are not allowed
    if (!secureValuesAllowed) {
      return;
    }

    const configPath = configurations[selectedTab!]?.configPath;
    if (!configPath) {
      return;
    }

    const profileKey = extractProfileKeyFromPath(path);
    const currentSecure = isPropertySecure(fullKey, displayKey, path);
    const newSecure = !currentSecure;

    // Get the current value
    const flatProfiles = flattenProfiles(configurations[selectedTab!]?.properties?.profiles || {});
    const currentValue = pendingChanges[configPath]?.[fullKey]?.value ?? flatProfiles[profileKey]?.properties?.[displayKey] ?? "";

    // Update the pending changes with the new secure state
    setPendingChanges((prev) => ({
      ...prev,
      [configPath]: {
        ...prev[configPath],
        [fullKey]: {
          value: currentValue,
          path,
          profile: profileKey,
          secure: newSecure,
        },
      },
    }));
  };

  // Helper function to check if a profile has any pending secure state changes
  const hasPendingSecureChanges = (profileKey: string): boolean => {
    const configPath = configurations[selectedTab!]?.configPath;
    if (!configPath) {
      return false;
    }
    const pendingChangesForConfig = pendingChanges[configPath] || {};

    // Check if any property in this profile has a pending secure state change
    return Object.entries(pendingChangesForConfig).some(([key, entry]) => {
      if (entry.profile !== profileKey) return false;

      // Check if this is a property (not type or other profile-level properties)
      const keyParts = key.split(".");
      if (!keyParts.includes("properties")) return false;

      // Check if the secure state has changed from the original
      const flatProfiles = flattenProfiles(configurations[selectedTab!]?.properties?.profiles || {});
      const originalSecure = flatProfiles[profileKey]?.secure?.includes(keyParts[keyParts.length - 1]) || false;
      return entry.secure !== originalSecure;
    });
  };

  // Helper function to extract pending profiles from pending changes
  const extractPendingProfiles = (configPath: string): { [key: string]: any } => {
    const pendingProfiles: { [key: string]: any } = {};

    Object.entries(pendingChanges[configPath] ?? {}).forEach(([key, entry]) => {
      if (!entry.profile) return;

      const keyParts = key.split(".");
      if (keyParts[0] !== "profiles") return;

      // Remove "profiles" prefix and get the profile path
      const profilePathParts = keyParts.slice(1);

      // Find where the profile name ends (before "type" or "properties")
      let profileNameEndIndex = profilePathParts.length;
      for (let i = 0; i < profilePathParts.length; i++) {
        if (profilePathParts[i] === "type" || profilePathParts[i] === "properties") {
          profileNameEndIndex = i;
          break;
        }
      }

      // Extract just the profile name parts
      const profileNameParts = profilePathParts.slice(0, profileNameEndIndex);

      if (profileNameParts.length > 0) {
        // Only create a pending profile entry if this is a profile-level property
        const propertyName = keyParts[keyParts.length - 1];
        const isProfileLevelProperty = propertyName === "type" || (keyParts.includes("properties") && !entry.secure);

        if (isProfileLevelProperty) {
          // Use the entry.profile as the profile key, as it represents the actual profile this change belongs to
          // This is important for moved profiles where the key structure might be different
          const actualProfileKey = entry.profile;

          // Initialize the profile structure if it doesn't exist
          if (!pendingProfiles[actualProfileKey]) {
            pendingProfiles[actualProfileKey] = {};
          }

          // Add the property to the profile
          if (propertyName === "type") {
            pendingProfiles[actualProfileKey].type = entry.value;
          } else if (keyParts.includes("properties")) {
            // Only add non-secure properties to the properties object
            if (!entry.secure) {
              if (!pendingProfiles[actualProfileKey].properties) {
                pendingProfiles[actualProfileKey].properties = {};
              }
              pendingProfiles[actualProfileKey].properties[propertyName] = entry.value;
            }

            // If this is a secure property, add it to the profile
            if (entry.secure) {
              if (!pendingProfiles[actualProfileKey].secure) {
                pendingProfiles[actualProfileKey].secure = [];
              }
              if (!pendingProfiles[actualProfileKey].secure.includes(propertyName)) {
                pendingProfiles[actualProfileKey].secure.push(propertyName);
              }
            }
          }
        }
      }
    });

    return pendingProfiles;
  };



  // Helper function to sort profiles at each level
  const sortProfilesAtLevel = useCallback(
    (profileKeys: string[]): string[] => {
      const currentProfileSortOrder = profileSortOrder || "natural";
      if (currentProfileSortOrder === "natural") {
        return profileKeys; // No sorting, maintain original order
      }

      // Create a map of profiles with their depth and parent information
      const profileInfo = profileKeys.map((profileKey) => {
        const parts = profileKey.split(".");
        const depth = parts.length - 1;
        const parentKey = parts.length > 1 ? parts.slice(0, -1).join(".") : "";
        return { profileKey, depth, parentKey, parts };
      });

      // Sort profiles while maintaining parent-child relationships
      const sortedProfiles: string[] = [];
      const processedProfiles = new Set<string>();

      // Helper function to add a profile and its descendants
      const addProfileAndDescendants = (profileKey: string) => {
        if (processedProfiles.has(profileKey)) return;

        // Find all profiles that have this profile as a parent
        const children = profileInfo.filter((info) => info.parentKey === profileKey);

        // Sort children based on the current sort order
        // For renamed profiles, we need to be more careful about sorting
        if (currentProfileSortOrder === "alphabetical") {
          children.sort((a, b) => {
            // Extract just the profile name (last part) for comparison
            const aName = a.parts[a.parts.length - 1];
            const bName = b.parts[b.parts.length - 1];
            return aName.localeCompare(bName);
          });
        } else if (currentProfileSortOrder === "reverse-alphabetical") {
          children.sort((a, b) => {
            // Extract just the profile name (last part) for comparison
            const aName = a.parts[a.parts.length - 1];
            const bName = b.parts[b.parts.length - 1];
            return bName.localeCompare(aName);
          });
        }

        // Add the current profile
        sortedProfiles.push(profileKey);
        processedProfiles.add(profileKey);

        // Recursively add all children
        children.forEach((child) => {
          addProfileAndDescendants(child.profileKey);
        });
      };

      // Get all top-level profiles (depth 0)
      const topLevelProfiles = profileInfo.filter((info) => info.depth === 0);

      // Sort top-level profiles
      if (currentProfileSortOrder === "alphabetical") {
        topLevelProfiles.sort((a, b) => {
          // Extract just the profile name (last part) for comparison
          const aName = a.parts[a.parts.length - 1];
          const bName = b.parts[b.parts.length - 1];
          return aName.localeCompare(bName);
        });
      } else if (currentProfileSortOrder === "reverse-alphabetical") {
        topLevelProfiles.sort((a, b) => {
          // Extract just the profile name (last part) for comparison
          const aName = a.parts[a.parts.length - 1];
          const bName = b.parts[b.parts.length - 1];
          return bName.localeCompare(aName);
        });
      }

      // Process each top-level profile and its descendants
      topLevelProfiles.forEach((info) => {
        addProfileAndDescendants(info.profileKey);
      });

      return sortedProfiles;
    },
    [profileSortOrder]
  );

  const renderProfiles = useCallback(
    (profilesObj: any) => {
      if (!profilesObj || typeof profilesObj !== "object") return null;

      const configPath = configurations[selectedTab!]!.configPath;

      // Extract pending profiles using helper function
      const pendingProfiles = extractPendingProfiles(configPath);

      // Filter out deleted profiles and their children
      const deletedProfiles = deletions[configPath] || [];

      // Get profile keys in original order from the configuration
      const getOrderedProfileKeys = (profiles: any, parentKey = ""): string[] => {
        const keys: string[] = [];
        for (const key of Object.keys(profiles)) {
          const profile = profiles[key];
          const qualifiedKey = parentKey ? `${parentKey}.${key}` : key;

          // Check if this profile should be excluded due to deletion
          let shouldExclude = false;

          // First check if the profile itself is deleted
          if (isProfileOrParentDeleted(qualifiedKey, deletedProfiles)) {
            // But check if this profile has been renamed away from being a child of a deleted parent
            const renamedKey = getRenamedProfileKeyWithNested(qualifiedKey, configPath, renames);

            // If the renamed version is different and doesn't have deleted parents, don't exclude it
            if (renamedKey !== qualifiedKey && !isProfileOrParentDeleted(renamedKey, deletedProfiles)) {
              shouldExclude = false;
            } else {
              shouldExclude = true;
            }
          }

          // Add this profile key if it's not excluded
          if (!shouldExclude) {
            keys.push(qualifiedKey);
          }

          // Recursively add nested profiles
          if (profile.profiles) {
            keys.push(...getOrderedProfileKeys(profile.profiles, qualifiedKey));
          }
        }
        return keys;
      };

      // Get ordered profile keys from original configuration
      const orderedProfileKeys = getOrderedProfileKeys(profilesObj);

      // Apply renames to the profile keys, including nested profiles
      const renamedProfileKeys = orderedProfileKeys.map((profileKey) => {
        return getRenamedProfileKeyWithNested(profileKey, configPath, renames);
      });

      // Filter out any renamed profile keys that are intermediate steps in a move operation
      // For example, if zosmf -> zosmf5 -> zftp.zosmf5, we don't want zosmf5 to appear in the root
      const configRenames = renames[configPath] || {};
      const finalRenamedProfileKeys = renamedProfileKeys.filter((renamedKey) => {
        // Check if this renamed key is an intermediate step (exists as an original key in renames)
        // If it exists as an original key, it means it's been moved further, so don't include it
        return !Object.keys(configRenames).includes(renamedKey);
      });

      // Add any renamed profiles that are not in the original configuration
      // This handles the case where a profile was renamed (e.g., zosmf -> zosmf5)
      const renamedOnlyProfiles = Object.keys(configRenames).filter((originalKey) => {
        // Only include if the original key is not in the ordered profile keys
        // This means it was renamed from a profile that doesn't exist in the original config
        if (orderedProfileKeys.includes(originalKey)) {
          return false;
        }

        // Filter out intermediate renames that are part of a chain
        // An intermediate rename is one where the originalKey is also a target of another rename
        // AND the newKey is also an originalKey (meaning it will be renamed again)
        const newKey = configRenames[originalKey];
        const isIntermediate = Object.values(configRenames).includes(originalKey) && Object.keys(configRenames).includes(newKey);
        if (isIntermediate) {
          return false;
        }

        return true;
      });

      // Apply renames to these renamed-only profiles
      const renamedOnlyProfileKeys = renamedOnlyProfiles.map((profileKey) => {
        return getRenamedProfileKeyWithNested(profileKey, configPath, renames);
      });

      // Combine all renamed profile keys
      const allRenamedProfileKeys = [...finalRenamedProfileKeys, ...renamedOnlyProfileKeys];

      // Add all pending profiles - we'll filter out conflicts later
      const pendingProfileKeys = Object.keys(pendingProfiles).filter((key) => {
        // Check if this pending profile is deleted
        if (isProfileOrParentDeleted(key, deletedProfiles)) {
          return false;
        }

        // Include all pending profiles - we'll handle conflicts in the filtering step
        return true;
      });

      // Apply renames to pending profile keys as well, including nested profiles
      const renamedPendingProfileKeys = pendingProfileKeys.map((profileKey) => {
        let renamedKey = profileKey;
        const configRenames = renames[configPath] || {};

        // Apply renames iteratively to handle chained renames
        let changed = true;
        while (changed) {
          changed = false;
          for (const [originalKey, newKey] of Object.entries(configRenames)) {
            if (renamedKey === originalKey) {
              renamedKey = newKey;
              changed = true;
              break;
            }
            if (renamedKey.startsWith(originalKey + ".")) {
              const newRenamedKey = renamedKey.replace(originalKey + ".", newKey + ".");
              renamedKey = newRenamedKey;
              changed = true;
              break;
            }
          }
        }
        return renamedKey;
      });

      // Filter out original profile keys that have pending profiles (renamed versions)
      const pendingProfileKeysSet = new Set(renamedPendingProfileKeys);

      const filteredOriginalKeys = allRenamedProfileKeys.filter((profileKey) => {
        // Check if this profile is deleted
        if (isProfileOrParentDeleted(profileKey, deletedProfiles)) {
          return false;
        }

        // If this profile key has a pending version, filter it out
        const hasExactPendingMatch = pendingProfileKeysSet.has(profileKey);

        // Also check if this profile key is the result of a rename that has a pending version
        // For example, if we have renames {b: 'a.b', a.b: 'a.b1'} and pending profile 'b'
        // then 'a.b' should be filtered out because 'b' becomes 'a.b1' in pending
        const isResultOfRenameWithPending = Object.keys(renames[configPath] || {}).some((originalKey) => {
          const renamedKey = getRenamedProfileKeyWithNested(originalKey, configPath, renames);
          const hasPendingOriginal = Object.keys(pendingProfiles).includes(originalKey);
          return profileKey === renamedKey && hasPendingOriginal;
        });

        const shouldKeep = !hasExactPendingMatch && !isResultOfRenameWithPending;
        return shouldKeep;
      });

      const filteredProfileKeys = [...filteredOriginalKeys, ...renamedPendingProfileKeys];

      // Apply profile sorting based on the current sort order
      // For natural sort order, maintain the original order of renamed profiles
      const sortedProfileKeys = profileSortOrder === "natural" ? filteredProfileKeys : sortProfilesAtLevel(filteredProfileKeys);

      return (
        <ProfileList
          sortedProfileKeys={sortedProfileKeys}
          selectedProfileKey={selectedProfileKey}
          pendingProfiles={pendingProfiles}
          profileMenuOpen={profileMenuOpen}
          configPath={configurations[selectedTab!]?.configPath || ""}
          vscodeApi={vscodeApi}
          onProfileSelect={handleProfileSelection}
          onProfileMenuToggle={setProfileMenuOpen}
          onDeleteProfile={handleDeleteProfile}
          onSetAsDefault={handleSetAsDefault}
          isProfileDefault={isProfileDefault}
          getProfileType={(profileKey: string) => getProfileType(profileKey, selectedTab, configurations, pendingChanges, renames)}
          viewMode={viewMode}
          hasPendingSecureChanges={hasPendingSecureChanges}
          hasPendingRename={(profileKey: string) => hasPendingRename(profileKey, configurations[selectedTab!]?.configPath || "", renames)}
          searchTerm={profileSearchTerm}
          filterType={profileFilterType}
          onSearchChange={setProfileSearchTerm}
          onFilterChange={setProfileFilterType}
          profileSortOrder={profileSortOrder || "natural"}
          onProfileSortOrderChange={setProfileSortOrderWithStorage}
          expandedNodes={getExpandedNodesForConfig(configurations[selectedTab!]?.configPath || "")}
          setExpandedNodes={useCallback(
            (newExpandedNodes) => {
              const configPath = configurations[selectedTab!]?.configPath || "";
              if (typeof newExpandedNodes === "function") {
                setExpandedNodesForConfig(configPath, newExpandedNodes(getExpandedNodesForConfig(configPath)));
              } else {
                setExpandedNodesForConfig(configPath, newExpandedNodes);
              }
            },
            [selectedTab, configurations, setExpandedNodesForConfig, getExpandedNodesForConfig]
          )}
          onProfileRename={handleRenameProfile}
          configurations={configurations}
          selectedTab={selectedTab}
          renames={renames}
          renameCounts={renameCounts}
        />
      );
    },
    [
      selectedTab,
      configurations,
      deletions,
      pendingChanges,
      renames,
      selectedProfileKey,
      profileMenuOpen,
      vscodeApi,
      handleProfileSelection,
      setProfileMenuOpen,
      handleDeleteProfile,
      handleSetAsDefault,
      isProfileDefault,
      getProfileType,
      viewMode,
      hasPendingSecureChanges,
      profileSearchTerm,
      profileFilterType,
      setProfileSearchTerm,
      setProfileFilterType,
      extractPendingProfiles,
      isProfileOrParentDeleted,
      getRenamedProfileKey,
      getRenamedProfileKeyWithNested,
      profileSortOrder || "natural",
      sortProfilesAtLevel,
      renameCounts,
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
          const pendingProfiles = extractPendingProfiles(configPath);
          const allProfiles = { ...flatProfiles, ...pendingProfiles };
          const deletedProfiles = deletions[configPath] || [];
          const filteredProfileKeys = Object.keys(allProfiles).filter((profileKey) => !isProfileOrParentDeleted(profileKey, deletedProfiles));

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

  const renderProfileDetails = useCallback(() => {
    return <ProfileDetails vscodeApi={vscodeApi} />;
  }, [
    selectedProfileKey,
    configurations,
    selectedTab,
    vscodeApi,
    isProfileDefault,
    getProfileType,
    handleSetAsDefault,
    setPendingDefaults,
    showMergedProperties,
    setShowMergedPropertiesWithStorage,
    setRenameProfileModalOpen,
    handleDeleteProfile,
    pendingChanges,
    deletions,
    renames,
    extractPendingProfiles,
    getOriginalProfileKey,
    getProfileNameForMergedProperties,
    propertySortOrder,
    sortOrderVersion,
    mergedProperties,
  ]);

  const renderConfig = useCallback(
    (obj: any, path: string[] = [], mergedProps?: any) => {
      const baseObj = cloneDeep(obj);
      const configPath = configurations[selectedTab!]?.configPath;
      if (!configPath) {
        return null;
      }

      // Merge pending changes
      let combinedConfig = mergePendingChangesForProfile(baseObj, path, configPath);

      // Track original properties for merged property detection
      const originalProperties = baseObj.properties || {};

      // Only merge merged properties if showMergedProperties is true and profile is not untyped
      if (showMergedProperties && mergedProps && !isCurrentProfileUntyped()) {
        combinedConfig = mergeMergedProperties(combinedConfig, path, mergedProps, configPath);
      }

      // Ensure required profile properties exist
      combinedConfig = ensureProfileProperties(combinedConfig, path);

      // Sort properties according to the specified order
      let sortedEntries: [string, any][];

      // Special handling for properties section - use custom sorting
      if (path.length > 0 && path[path.length - 1] === "properties") {
        // Lock the sort order at this level to prevent any external interference
        const lockedSortOrder = propertySortOrder;

        // Create a local sorting function that doesn't depend on external state
        const localSortProperties = (entries: [string, any][]): [string, any][] => {
          if (lockedSortOrder === "alphabetical") {
            return [...entries].sort(([a], [b]) => a.localeCompare(b));
          } else if (lockedSortOrder === "merged-first") {
            return [...entries].sort(([a], [b]) => {
              // Check if properties are merged using the current mergedProps
              const aIsMerged = a && isPropertyFromMergedProps(a, path, mergedProps, configPath);
              const bIsMerged = b && isPropertyFromMergedProps(b, path, mergedProps, configPath);

              // Merged properties come first
              if (aIsMerged && !bIsMerged) return -1;
              if (!aIsMerged && bIsMerged) return 1;

              // Within each group, sort alphabetically
              return a.localeCompare(b);
            });
          } else if (lockedSortOrder === "non-merged-first") {
            return [...entries].sort(([a], [b]) => {
              // Check if properties are merged using the current mergedProps
              const aIsMerged = a && isPropertyFromMergedProps(a, path, mergedProps, configPath);
              const bIsMerged = b && isPropertyFromMergedProps(b, path, mergedProps, configPath);

              // Non-merged properties come first
              if (!aIsMerged && bIsMerged) return -1;
              if (aIsMerged && !bIsMerged) return 1;

              // Within each group, sort alphabetically
              return a.localeCompare(b);
            });
          } else {
            // Fallback to alphabetical
            return [...entries].sort(([a], [b]) => a.localeCompare(b));
          }
        };

        // Filter out deleted properties from combinedConfig before adding to entriesForSorting
        const filteredCombinedConfig = { ...combinedConfig };
        const configPath = configurations[selectedTab!]?.configPath;
        const deletionsList = deletions[configPath] ?? [];

        // Remove deleted properties from the combined config
        Object.keys(filteredCombinedConfig).forEach((key) => {
          const propertyFullKey = [...path, key].join(".");
          if (deletionsList.includes(propertyFullKey)) {
            delete filteredCombinedConfig[key];
          }
        });

        // Add secure properties to the entries for sorting, but mark them as secure
        const entriesForSorting = Object.entries(filteredCombinedConfig);

        // Add secure properties from the parent object if they're not already in the properties
        const parentConfigPath = path.slice(0, -1);
        const parentConfig = getNestedProperty(configurations[selectedTab!]?.properties, parentConfigPath);
        if (parentConfig?.secure && Array.isArray(parentConfig.secure)) {
          parentConfig.secure.forEach((securePropertyName: string) => {
            // Only add if not already in the properties
            if (!combinedConfig.hasOwnProperty(securePropertyName)) {
              entriesForSorting.push([securePropertyName, { _isSecureProperty: true }]);
            }
          });
        }

        // Fallback: If we couldn't find secure properties through getNestedProperty, try to find them directly
        if (!parentConfig?.secure || parentConfig.secure.length === 0) {
          const currentProfileKey = extractProfileKeyFromPath(path);
          const flatProfiles = flattenProfiles(configurations[selectedTab!]?.properties?.profiles || {});
          const currentProfile = flatProfiles[currentProfileKey];
          if (currentProfile?.secure && Array.isArray(currentProfile.secure)) {
            currentProfile.secure.forEach((securePropertyName: string) => {
              if (
                !combinedConfig.hasOwnProperty(securePropertyName) &&
                !entriesForSorting.some(([existingKey]) => existingKey === securePropertyName)
              ) {
                entriesForSorting.push([securePropertyName, { _isSecureProperty: true }]);
              }
            });
          }
        }

        // Also add pending secure properties that might not be in the parent's secure array yet
        const currentProfileKey = extractProfileKeyFromPath(path);
        if (configPath && currentProfileKey) {
          Object.entries(pendingChanges[configPath] ?? {}).forEach(([key, entry]) => {
            if (entry.profile === currentProfileKey && entry.secure) {
              const keyParts = key.split(".");
              const propertyName = keyParts[keyParts.length - 1];
              // Only add if not already in the properties and not already added as a secure property
              if (!combinedConfig.hasOwnProperty(propertyName) && !entriesForSorting.some(([existingKey]) => existingKey === propertyName)) {
                entriesForSorting.push([propertyName, { _isSecureProperty: true }]);
              }
            }
          });
        }

        // Add merged properties that aren't already in the entriesForSorting
        // Mark them with a special flag so they're properly identified as merged in sorting
        if (mergedProps && showMergedProperties && selectedProfileKey) {
          // Get the current profile type and schema validation for filtering
          const currentProfileKey = extractProfileKeyFromPath(path);
          const profileType = getProfileType(currentProfileKey, selectedTab, configurations, pendingChanges, renames);
          const propertySchema = profileType ? schemaValidations[configPath]?.propertySchema[profileType] || {} : {};
          const allowedProperties = Object.keys(propertySchema);

          Object.entries(mergedProps).forEach(([propertyName, propData]: [string, any]) => {
            // Only add if:
            // 1. Not already in the entries
            // 2. Not in the original properties
            // 3. Property is allowed by the schema (only if profile has a type)
            // 4. Property is not in deletions
            const isAllowedBySchema = !profileType || allowedProperties.includes(propertyName);

            // Check if the local property is in deletions (we want to show merged properties even when local is deleted)

            if (
              !entriesForSorting.some(([existingKey]) => existingKey === propertyName) &&
              !originalProperties?.hasOwnProperty(propertyName) &&
              isAllowedBySchema
              // Note: We intentionally don't check isLocalPropertyInDeletions here because
              // we want to show merged properties even when the local property is deleted
            ) {
              // Add merged property with a special flag to identify it as merged
              entriesForSorting.push([
                propertyName,
                {
                  _isMergedProperty: true,
                  _mergedValue: propData.value,
                  _mergedData: propData,
                },
              ]);
            }
          });
        }

        sortedEntries = localSortProperties(entriesForSorting);
      } else {
        // Use default sorting for non-properties sections
        sortedEntries = sortConfigEntries(Object.entries(combinedConfig));
      }

      return sortedEntries.map(([key, value]) => {
        const currentPath = [...path, key];
        const fullKey = currentPath.join(".");
        const displayKey = key.split(".").pop();

        // Check if this property is in deletions, considering profile renames
        const isInDeletions = (() => {
          const deletionsList = deletions[configPath] ?? [];

          // Direct check with current fullKey
          if (deletionsList.includes(fullKey)) {
            return true;
          }

          // Check if this property was deleted using the original profile name
          const currentProfileKey = extractProfileKeyFromPath(path);
          const originalProfileKey = getOriginalProfileKeyWithNested(currentProfileKey, configPath, renames);

          if (originalProfileKey !== currentProfileKey) {
            // Construct the fullKey using the original profile name
            const originalPath = [...path];
            // Replace the profile key in the path with the original profile key
            const profileKeyIndex = originalPath.findIndex((_, index) => {
              // Find where the profile key starts in the path
              const pathUpToIndex = originalPath.slice(0, index + 1).join(".");
              return pathUpToIndex.includes(currentProfileKey);
            });

            if (profileKeyIndex !== -1) {
              // Reconstruct the path with the original profile key
              const pathBeforeProfile = originalPath.slice(0, profileKeyIndex);
              const pathAfterProfile = originalPath.slice(profileKeyIndex + 1);
              const originalProfileParts = originalProfileKey.split(".");

              // Insert the original profile parts into the path
              const reconstructedPath = [...pathBeforeProfile, ...originalProfileParts, ...pathAfterProfile];
              const originalFullKey = reconstructedPath.join(".");

              if (deletionsList.includes(originalFullKey)) {
                return true;
              }
            }
          }

          return false;
        })();

        // Check if this is a merged property that should be shown even if the original was deleted
        const isMergedProperty = isPropertyFromMergedProps(displayKey, path, mergedProps, configPath);

        if (isInDeletions && !isMergedProperty) {
          return null;
        }

        // Filter secure properties from properties object
        if (key === "properties") {
          const filteredValue = filterSecureProperties(value, combinedConfig, configPath);
          // Always render the properties section, even if empty, so users can add properties
          if (filteredValue === null) {
            // Return an empty properties object instead of null so the header still renders
            value = {};
          } else {
            value = filteredValue;
          }
        }

        // Check if this is a secure property that was added for sorting
        const isSecurePropertyForSorting = typeof value === "object" && value !== null && value._isSecureProperty === true;

        // Check if this is a merged property that was added for sorting
        const isMergedPropertyForSorting = typeof value === "object" && value !== null && value._isMergedProperty === true;

        const isParent =
          typeof value === "object" && value !== null && !Array.isArray(value) && !isSecurePropertyForSorting && !isMergedPropertyForSorting;
        const isArray = Array.isArray(value);
        const pendingValue =
          (pendingChanges[configPath] ?? {})[fullKey]?.value ??
          (isSecurePropertyForSorting ? "" : isMergedPropertyForSorting ? value._mergedValue : value);

        // Merge pending secure properties for secure arrays
        let renderValue: any[] = Array.isArray(value) ? value : [];
        if (isArray && key === "secure") {
          renderValue = mergePendingSecureProperties(value, path, configPath);
        }

        if (isParent) {
          return (
            <div key={fullKey} className="config-item parent">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3
                  className={`header-level-${path.length > 3 ? 3 : path.length}`}
                  style={{
                    cursor: displayKey?.toLocaleLowerCase() === "properties" ? "pointer" : "default",
                    userSelect: "none",
                    textDecoration: displayKey?.toLocaleLowerCase() === "properties" ? "underline" : "none",
                  }}
                  onClick={() => {
                    if (displayKey?.toLocaleLowerCase() === "properties") {
                      const currentSortOrder = propertySortOrder || "alphabetical";
                      const currentIndex = SORT_ORDER_OPTIONS.indexOf(currentSortOrder);
                      const nextIndex = (currentIndex + 1) % SORT_ORDER_OPTIONS.length;
                      const newSortOrder = SORT_ORDER_OPTIONS[nextIndex];
                      setPropertySortOrderWithStorage(newSortOrder);
                    }
                  }}
                  title={
                    displayKey?.toLocaleLowerCase() === "properties"
                      ? `Click to change sort order. Current: ${getSortOrderDisplayName(propertySortOrder)}`
                      : undefined
                  }
                >
                  {displayKey?.toLocaleLowerCase() === "properties" ? "Profile Properties" : displayKey}
                </h3>
                <button
                  className="header-button"
                  title={`Create new property for \"${extractProfileKeyFromPath(currentPath)}\"`}
                  onClick={() => openAddProfileModalAtPath(currentPath)}
                  style={{
                    padding: "2px",
                    width: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "transparent",
                    color: "var(--vscode-button-secondaryForeground)",
                    borderRadius: "3px",
                    cursor: "pointer",
                    fontSize: "12px",
                    lineHeight: "1",
                    border: "none",
                  }}
                >
                  <span className="codicon codicon-add"></span>
                </button>
              </div>
              <div style={{ paddingLeft: displayKey?.toLocaleLowerCase() === "properties" ? "16px" : "0px" }}>
                {renderConfig(value, currentPath, mergedProps)}
              </div>
            </div>
          );
        } else if (isArray) {
          const tabsHiddenItems = hiddenItems[configurations[selectedTab!]!.configPath];
          if (displayKey?.toLocaleLowerCase() === "secure") {
            // Hide the secure array section since secure properties are now handled in the properties section
            return null;
          }
          return (
            <div key={fullKey} className="config-item">
              <h3 className={`header-level-${path.length > 3 ? 3 : path.length}`}>
                <span className="config-label" style={{ fontWeight: "bold" }}>
                  {displayKey}
                </span>
              </h3>
              <div style={{ paddingLeft: "0px" }}>
                {Array.from(new Set(renderValue)).map((item: any, index: number) => {
                  if (
                    tabsHiddenItems &&
                    tabsHiddenItems[item] &&
                    tabsHiddenItems[item].path.includes(currentPath.join(".").replace("secure", "properties") + "." + item)
                  )
                    return;
                  return (
                    <div key={index} className="config-item">
                      <div className="config-item-container">
                        <span className="config-label">{item}</span>
                        <input
                          className="config-input"
                          type="password"
                          placeholder="••••••••"
                          value={String(pendingChanges[configurations[selectedTab!]!.configPath]?.[fullKey + "." + item]?.value || "")}
                          onChange={(e) => handleChange(fullKey + "." + item, (e.target as HTMLInputElement).value)}
                          style={{ fontFamily: "monospace" }}
                        />
                        <button
                          className="action-button"
                          onClick={() => handleDeleteProperty(fullKey.replace("secure", "properties") + "." + item, true)}
                        >
                          <span className="codicon codicon-trash"></span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        } else {
          // Handle merged properties that were added for sorting
          if (isMergedPropertyForSorting) {
            // Double-check that this property should actually be displayed as merged
            const shouldShowAsMerged = displayKey ? isPropertyFromMergedProps(displayKey, path, mergedProps, configPath) : false;

            if (!shouldShowAsMerged) {
              // This property was added for sorting but shouldn't be displayed as merged
              // Skip rendering it
              return null;
            }

            const mergedPropData = value._mergedData;
            const jsonLoc = mergedPropData?.jsonLoc;
            const osLoc = mergedPropData?.osLoc;
            const secure = mergedPropData?.secure;
            const isSecureProperty = jsonLoc && displayKey ? isMergedPropertySecure(displayKey, jsonLoc, osLoc, secure) : false;

            // Render merged property with proper styling and behavior
            return (
              <div
                key={fullKey}
                className="config-item"
                onClick={jsonLoc ? () => handleNavigateToSource(jsonLoc, osLoc) : undefined}
                title={
                  jsonLoc
                    ? (() => {
                        // Extract logical profile path from jsonLoc
                        const jsonLocParts = jsonLoc.split(".");
                        const profilePathParts = jsonLocParts.slice(1, -2);
                        const profilePath =
                          profilePathParts.filter((part: string, index: number) => part !== "profiles" || index % 2 === 0).join(".") ||
                          "unknown profile";

                        // Extract full normalized config path from osLoc
                        const fullConfigPath = osLoc?.[0] || "unknown config";

                        const title = `Inherited from: ${profilePath} (${fullConfigPath})`;
                        return title;
                      })()
                    : undefined
                }
                style={{ cursor: jsonLoc ? "pointer" : "default" }}
              >
                <div className="config-item-container">
                  <span
                    className="config-label"
                    style={{
                      color: "var(--vscode-descriptionForeground)",
                      cursor: "pointer",
                    }}
                  >
                    {displayKey}
                  </span>
                  <input
                    className="config-input"
                    type={isSecureProperty ? "password" : "text"}
                    placeholder={isSecureProperty ? "••••••••" : ""}
                    value={isSecureProperty ? "••••••••" : String(mergedPropData?.value ?? "")}
                    disabled={true}
                    style={{
                      backgroundColor: "var(--vscode-input-disabledBackground)",
                      color: "var(--vscode-disabledForeground)",
                      cursor: "pointer",
                      pointerEvents: "none",
                    }}
                  />
                  <button
                    className="action-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUnlinkMergedProperty(displayKey, fullKey);
                    }}
                    title="Overwrite merged property"
                  >
                    <span className="codicon codicon-add"></span>
                  </button>
                </div>
              </div>
            );
          }

          // Check if this property is from merged properties
          const isFromMergedProps = isPropertyFromMergedProps(displayKey, path, mergedProps, configPath);
          const mergedPropData = displayKey ? mergedProps?.[displayKey] : undefined;
          const jsonLoc = mergedPropData?.jsonLoc;
          const osLoc = mergedPropData?.osLoc;
          const secure = mergedPropData?.secure;
          const isSecureProperty = isFromMergedProps && jsonLoc && displayKey ? isMergedPropertySecure(displayKey, jsonLoc, osLoc, secure) : false;
          // If this is a merged property that was deleted, treat it as deleted (not merged)
          const isDeletedMergedProperty = isFromMergedProps && isInDeletions;

          // Check if this is a local secure property (in the current profile's secure array)
          const isLocalSecureProperty = displayKey && path && configPath ? isPropertySecure(fullKey, displayKey, path, mergedProps) : false;

          // Check if this is a secure property that was added for sorting
          const isSecureForSorting = isSecurePropertyForSorting;

          // Debug logging for secure properties
          if (isSecurePropertyForSorting) {
          }

          const readOnlyContainer = (
            <div className="config-item-container" style={displayKey === "type" ? { gap: "0px" } : {}}>
              <span
                className="config-label"
                style={
                  isFromMergedProps && !isDeletedMergedProperty
                    ? {
                        color: "var(--vscode-descriptionForeground)",
                        cursor: "pointer",
                      }
                    : {}
                }
              >
                {displayKey}
              </span>
              {displayKey === "type" ? (
                <div style={{ position: "relative", width: "100%" }}>
                  <select
                    className="config-input"
                    value={String(pendingValue)}
                    onChange={(e) => handleChange(fullKey, (e.target as HTMLSelectElement).value)}
                    style={{
                      width: "100%",
                      height: "28px",
                      fontSize: "0.9em",
                      padding: "2px",
                      marginBottom: "0",
                      textTransform: "lowercase",
                      border:
                        showMergedProperties && isCurrentProfileUntyped()
                          ? "2px solid var(--vscode-warningForeground)"
                          : "1px solid var(--vscode-input-border)",
                      outline: showMergedProperties && isCurrentProfileUntyped() ? "2px solid var(--vscode-warningForeground)" : "none",
                      boxShadow: showMergedProperties && isCurrentProfileUntyped() ? "0 0 0 2px var(--vscode-warningForeground)" : "none",
                    }}
                  >
                    <option value="">{l10n.t("Select a type")}</option>
                    {getWizardTypeOptions().map((type: string) => (
                      <option key={type} value={type}>
                        {type.toLowerCase()}
                      </option>
                    ))}
                  </select>
                </div>
              ) : typeof pendingValue === "string" || typeof pendingValue === "boolean" || typeof pendingValue === "number" ? (
                (() => {
                  const propertyType = displayKey
                    ? getPropertyTypeForConfigEditor(
                        displayKey,
                        path,
                        selectedTab,
                        configurations,
                        schemaValidations,
                        getProfileType,
                        pendingChanges,
                        renames
                      )
                    : undefined;

                  if (isSecureProperty || isLocalSecureProperty || isSecureForSorting) {
                    return (
                      <input
                        className="config-input"
                        type="password"
                        placeholder="••••••••"
                        value={isFromMergedProps && !isDeletedMergedProperty ? "••••••••" : stringifyValueByType(pendingValue)}
                        onChange={(e) => handleChange(fullKey, (e.target as HTMLInputElement).value)}
                        disabled={isFromMergedProps && !isDeletedMergedProperty}
                        style={
                          isFromMergedProps && !isDeletedMergedProperty
                            ? {
                                backgroundColor: "var(--vscode-input-disabledBackground)",
                                color: "var(--vscode-disabledForeground)",
                                cursor: "pointer",
                                fontFamily: "monospace",
                                pointerEvents: "none",
                              }
                            : { fontFamily: "monospace" }
                        }
                      />
                    );
                  } else if (propertyType === "boolean") {
                    return (
                      <select
                        className="config-input"
                        value={stringifyValueByType(pendingValue)}
                        onChange={(e) => handleChange(fullKey, (e.target as HTMLSelectElement).value)}
                        disabled={isFromMergedProps && !isDeletedMergedProperty}
                        style={
                          isFromMergedProps && !isDeletedMergedProperty
                            ? {
                                backgroundColor: "var(--vscode-input-disabledBackground)",
                                color: "var(--vscode-disabledForeground)",
                                cursor: "pointer",
                                pointerEvents: "none",
                              }
                            : {}
                        }
                      >
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    );
                  } else if (propertyType === "number") {
                    return (
                      <input
                        className="config-input"
                        type="number"
                        value={(() => {
                          if (isFromMergedProps && !isDeletedMergedProperty) {
                            const mergedValue = stringifyValueByType(mergedPropData?.value);
                            return mergedValue;
                          } else {
                            const pendingValueStr = stringifyValueByType(pendingValue);
                            return pendingValueStr;
                          }
                        })()}
                        onChange={(e) => handleChange(fullKey, (e.target as HTMLInputElement).value)}
                        disabled={isFromMergedProps && !isDeletedMergedProperty}
                        style={
                          isFromMergedProps && !isDeletedMergedProperty
                            ? {
                                backgroundColor: "var(--vscode-input-disabledBackground)",
                                color: "var(--vscode-disabledForeground)",
                                cursor: "pointer",
                                pointerEvents: "none",
                              }
                            : {}
                        }
                      />
                    );
                  } else {
                    return (
                      <input
                        className="config-input"
                        type="text"
                        placeholder=""
                        value={(() => {
                          if (isFromMergedProps && !isDeletedMergedProperty) {
                            const mergedValue = String(mergedPropData?.value ?? "");
                            return mergedValue;
                          } else {
                            return stringifyValueByType(pendingValue);
                          }
                        })()}
                        onChange={(e) => handleChange(fullKey, (e.target as HTMLInputElement).value)}
                        disabled={isFromMergedProps && !isDeletedMergedProperty}
                        style={
                          isFromMergedProps && !isDeletedMergedProperty
                            ? {
                                backgroundColor: "var(--vscode-input-disabledBackground)",
                                color: "var(--vscode-disabledForeground)",
                                cursor: "pointer",
                                pointerEvents: "none",
                              }
                            : {}
                        }
                      />
                    );
                  }
                })()
              ) : (
                <span>{"{...}"}</span>
              )}
              {displayKey !== "type" &&
                displayKey &&
                (() => {
                  const isSecure = isPropertySecure(fullKey, displayKey, path, mergedProps);
                  const canBeSecure = canPropertyBeSecure(displayKey, path);
                  const showSecureButton = canBeSecure && !isSecure && (!isFromMergedProps || isSecurePropertyForSorting);
                  const showDeleteButton = !isFromMergedProps;
                  const showUnlinkButton = isFromMergedProps && !isDeletedMergedProperty;

                  // Only show the flex container if there are buttons to display
                  if (showSecureButton || showDeleteButton || showUnlinkButton) {
                    return (
                      <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                        {showSecureButton &&
                          (secureValuesAllowed ? (
                            <button
                              className="action-button"
                              onClick={() => handleToggleSecure(fullKey, displayKey, path)}
                              title="Make property secure"
                            >
                              <span className="codicon codicon-unlock"></span>
                            </button>
                          ) : (
                            <button
                              className="action-button"
                              onClick={() => {
                                vscodeApi.postMessage({
                                  command: "OPEN_VSCODE_SETTINGS",
                                  searchText: "Zowe.vscode-extension-for-zowe Secure Credentials Enabled",
                                });
                              }}
                              title="A credential manager is not available. Click to open VS Code settings to enable secure credentials."
                            >
                              <span className="codicon codicon-lock" style={{ opacity: 0.5 }}></span>
                            </button>
                          ))}
                        {showDeleteButton && (
                          <button className="action-button" onClick={() => handleDeleteProperty(fullKey)}>
                            <span className="codicon codicon-trash"></span>
                          </button>
                        )}
                        {showUnlinkButton && (
                          <button
                            className="action-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnlinkMergedProperty(displayKey, fullKey);
                            }}
                            title="Overwrite merged property"
                          >
                            <span className="codicon codicon-add"></span>
                          </button>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}
            </div>
          );

          return (
            <div
              key={fullKey}
              className="config-item"
              onClick={isFromMergedProps && !isDeletedMergedProperty && jsonLoc ? () => handleNavigateToSource(jsonLoc, osLoc) : undefined}
              title={
                isFromMergedProps && !isDeletedMergedProperty && jsonLoc
                  ? (() => {
                      // Extract logical profile path from jsonLoc
                      const jsonLocParts = jsonLoc.split(".");
                      const profilePathParts = jsonLocParts.slice(1, -2);
                      let profilePath =
                        profilePathParts.filter((part: string, index: number) => part !== "profiles" || index % 2 === 0).join(".") ||
                        "unknown profile";

                      // Check if this is the current profile or its renamed version
                      const currentProfileKey = selectedProfileKey || "";
                      const configPath = configurations[selectedTab!]?.configPath;

                      // Get both old and new names for the current profile
                      const isCurrentProfileRenamed = Object.entries(renames[configPath] || {}).find(
                        ([oldName, newName]) => newName === currentProfileKey || oldName === currentProfileKey
                      );

                      if (isCurrentProfileRenamed) {
                        const [oldName, newName] = isCurrentProfileRenamed;
                        // If the profilePath matches either the old or new name, this is not actually inherited
                        if (profilePath === oldName || profilePath === newName) {
                          return undefined;
                        }
                      } else if (profilePath === currentProfileKey) {
                        // If not renamed but matches current profile, not inherited
                        return undefined;
                      }

                      // Extract full normalized config path from osLoc
                      const fullConfigPath = osLoc?.[0] || "unknown config";

                      // Check if the source profile has been renamed and use its new name
                      const sourceProfileRenamed = Object.entries(renames[configPath] || {}).find(([oldName]) => oldName === profilePath);
                      if (sourceProfileRenamed) {
                        profilePath = sourceProfileRenamed[1]; // Use the new name
                      }

                      const title = `Inherited from: ${profilePath} (${fullConfigPath})`;
                      return title;
                    })()
                  : undefined
              }
              style={isFromMergedProps && !isDeletedMergedProperty && jsonLoc ? { cursor: "pointer" } : {}}
            >
              {readOnlyContainer}
            </div>
          );
        }
      });
    },
    [
      configurations,
      selectedTab,
      pendingChanges,
      deletions,
      showMergedProperties,
      propertySortOrder,
      sortOrderVersion,
      mergePendingChangesForProfile,
      mergeMergedProperties,
      ensureProfileProperties,
      sortConfigEntries,
      filterSecureProperties,
      isCurrentProfileUntyped,
      getNestedProperty,
      extractProfileKeyFromPath,
      flattenProfiles,
      isPropertyFromMergedProps,
      isPropertySecure,
      renames,
      handleChange,
      handleDeleteProperty,
      handleUnlinkMergedProperty,
      handleNavigateToSource,
      handleToggleSecure,
      canPropertyBeSecure,
      secureValuesAllowed,
      vscodeApi,
      stringifyValueByType,
      l10n,
      SORT_ORDER_OPTIONS,
      getSortOrderDisplayName,
      setPropertySortOrderWithStorage,
    ]
  );

  const renderDefaults = useCallback(
    (defaults: { [key: string]: any }) => {
      if (!defaults || typeof defaults !== "object") return null;

      // Get all available property types from the schema
      const availableTypes = getWizardTypeOptions();

      // Create a complete defaults object with all available types
      const completeDefaults = { ...defaults };
      availableTypes.forEach((type: string) => {
        if (!(type in completeDefaults)) {
          completeDefaults[type] = "";
        }
      });

      const combinedDefaults = {
        ...completeDefaults,
        ...Object.fromEntries(
          Object.entries(pendingDefaults[configurations[selectedTab!]!.configPath] ?? {})
            .filter(([key]) => !(key in completeDefaults))
            .map(([key, entry]) => [key, entry.value])
        ),
      };

      return (
        <div>
          {/* Render defaults */}
          {Object.entries(combinedDefaults)
            .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
            .map(([key, value]) => {
              const currentPath = [key];
              const fullKey = currentPath.join(".");
              if (defaultsDeletions[configurations[selectedTab!]!.configPath]?.includes(fullKey)) return null;
              const isParent = typeof value === "object" && value !== null && !Array.isArray(value);
              const isArray = Array.isArray(value);
              // Calculate pending value considering both explicit pending defaults and simulated defaults from renames
              const getEffectiveDefaultValue = (profileType: string): string => {
                const configPath = configurations[selectedTab!]!.configPath;

                // Check explicit pending defaults first
                const pendingDefault = pendingDefaults[configPath]?.[profileType];
                if (pendingDefault) {
                  return pendingDefault.value;
                }

                // Check existing defaults
                const config = configurations[selectedTab!].properties;
                const defaults = config.defaults || {};
                let defaultValue = defaults[profileType];

                // Apply renames to the default value (simulate backend logic)
                if (defaultValue) {
                  const configRenames = renames[configPath] || {};
                  for (const [originalKey, newKey] of Object.entries(configRenames)) {
                    if (defaultValue === originalKey) {
                      defaultValue = newKey;
                      break;
                    }
                  }
                }

                return defaultValue || "";
              };

              const pendingValue = (pendingDefaults[configurations[selectedTab!]!.configPath] ?? {})[fullKey]?.value ?? getEffectiveDefaultValue(key);

              if (isParent) {
                return (
                  <div key={fullKey} className="config-item parent">
                    <h3 className={`header-level-${currentPath.length}`}>{key}</h3>
                    {renderDefaults(value)}
                  </div>
                );
              } else if (isArray) {
                return (
                  <div key={fullKey} className="config-item">
                    <h3 className={`header-level-${currentPath.length}`}>
                      <span className="config-label" style={{ fontWeight: "bold" }}>
                        {key}
                      </span>
                    </h3>
                    <div>
                      {value
                        .sort((a: any, b: any) => String(a).localeCompare(String(b)))
                        .map((item: any, index: number) => (
                          <div className="list-item" key={index}>
                            {item}
                          </div>
                        ))}
                    </div>
                  </div>
                );
              } else {
                const availableProfiles = getAvailableProfilesByType(key, selectedTab, configurations, pendingChanges);
                const selectedProfileExists = availableProfiles.includes(String(pendingValue));
                const displayValue = selectedProfileExists ? String(pendingValue) : "";

                return (
                  <div key={fullKey} className="config-item">
                    <div className="config-item-container defaults-container">
                      <span className="config-label">{key}</span>
                      <select
                        className={`config-input ${!displayValue ? "placeholder-style" : ""}`}
                        value={displayValue}
                        onChange={(e) => handleDefaultsChange(fullKey, (e.target as HTMLSelectElement).value)}
                        style={{
                          width: "100%",
                          height: "28px",
                          fontSize: "0.9em",
                          padding: "2px 6px",
                          marginBottom: "0",
                          minWidth: "150px",
                        }}
                      >
                        <option value="">{l10n.t("Select a profile")}</option>
                        {availableProfiles.map((profile) => (
                          <option key={profile} value={profile}>
                            {profile === "root" ? "/" : profile}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              }
            })}
        </div>
      );
    },
    [getWizardTypeOptions, pendingDefaults, configurations, selectedTab, defaultsDeletions, handleDefaultsChange, l10n]
  );

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
        renderProfiles={renderProfiles}
        renderProfileDetails={renderProfileDetails}
        renderDefaults={renderDefaults}
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
        canPropertyBeSecure={canPropertyBeSecure}
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

      <ProfileWizardModal
        key={`wizard-${wizardModalOpen}`}
        isOpen={wizardModalOpen}
        wizardRootProfile={wizardRootProfile}
        wizardSelectedType={wizardSelectedType}
        wizardProfileName={wizardProfileName}
        wizardProperties={wizardProperties}
        wizardShowKeyDropdown={wizardShowKeyDropdown}
        wizardNewPropertyKey={wizardNewPropertyKey}
        wizardNewPropertyValue={wizardNewPropertyValue}
        wizardNewPropertySecure={wizardNewPropertySecure}
        wizardMergedProperties={wizardMergedProperties}
        availableProfiles={getAvailableProfiles()}
        typeOptions={getWizardTypeOptions()}
        propertyOptions={getWizardPropertyOptions()}
        isProfileNameTaken={isProfileNameTaken()}
        secureValuesAllowed={secureValuesAllowed}
        onRootProfileChange={setWizardRootProfile}
        onSelectedTypeChange={setWizardSelectedType}
        onProfileNameChange={setWizardProfileName}
        onNewPropertyKeyChange={setWizardNewPropertyKey}
        onNewPropertyValueChange={setWizardNewPropertyValue}
        onNewPropertySecureToggle={() => {
          if (secureValuesAllowed) {
            setWizardNewPropertySecure(!wizardNewPropertySecure);
          }
        }}
        onShowKeyDropdownChange={setWizardShowKeyDropdown}
        onAddProperty={handleWizardAddProperty}
        onRemoveProperty={handleWizardRemoveProperty}
        onPropertyValueChange={handleWizardPropertyValueChange}
        onPropertySecureToggle={handleWizardPropertySecureToggle}
        onCreateProfile={handleWizardCreateProfile}
        onCancel={handleWizardCancel}
        onPopulateDefaults={handleWizardPopulateDefaults}
        getPropertyType={getPropertyType}
        canPropertyBeSecure={canPropertyBeSecure}
        canPropertyBeSecureForWizard={canPropertyBeSecureForWizard}
        stringifyValueByType={stringifyValueByType}
        vscodeApi={vscodeApi}
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

          const pendingProfiles = extractPendingProfiles(config.configPath);
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
