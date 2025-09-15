import { useEffect, useState, useCallback, useRef } from "react";
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

// Hooks
import { useProfileWizard } from "./hooks";

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

  // Helper function to extract profile name from a key
  const extractProfileFromKey = useCallback((key: string): string => {
    const parts = key.split(".");
    const profileParts: string[] = [];

    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === "profiles" && i + 1 < parts.length) {
        // Found a profile name
        profileParts.push(parts[i + 1]);
        i++; // Skip the profile name in the next iteration
      }
    }

    return profileParts.join(".");
  }, []);

  // Helper function to update changes for renames
  const updateChangesForRenames = useCallback((changes: any[], renames: any[]) => {
    if (!renames || renames.length === 0) {
      return changes;
    }

    // Create a map for faster lookup and to handle complex nested renames
    const renameMap = new Map<string, string>();
    renames.forEach((rename) => {
      if (rename.configPath) {
        const key = `${rename.configPath}:${rename.originalKey}`;
        renameMap.set(key, rename.newKey);
      }
    });

    return changes.map((change) => {
      const updatedChange = { ...change };

      // Update profile references in the change
      for (const rename of renames) {
        if (rename.configPath === change.configPath) {
          // Skip if the change is already using the new profile name
          if (updatedChange.profile === rename.newKey) {
            continue;
          }

          // Update profile name in the change path
          if (updatedChange.profile === rename.originalKey) {
            updatedChange.profile = rename.newKey;
          }

          // Update nested profile references (e.g., parent.child -> newparent.newchild)
          if (updatedChange.profile && updatedChange.profile.startsWith(rename.originalKey + ".")) {
            updatedChange.profile = updatedChange.profile.replace(rename.originalKey + ".", rename.newKey + ".");
          }

          // Update the key field to use new profile name - handle complex nested paths
          if (updatedChange.key) {
            // For complex renames like test1.lpar1 -> test2.lpar2, we need to handle the full path replacement
            // The key format is: profiles.test1.profiles.lpar1.properties.property
            // When test1.lpar1 -> test2.lpar2, this should become: profiles.test2.profiles.lpar2.properties.property

            const originalKeyParts = rename.originalKey.split(".");
            const newKeyParts = rename.newKey.split(".");

            if (originalKeyParts.length > 1 && newKeyParts.length > 1) {
              // Handle complex nested profile renames
              let updatedKey = updatedChange.key;

              // Build the pattern to match in the key
              // For test1.lpar1, we need to match "profiles.test1.profiles.lpar1"
              const originalPattern = "profiles." + originalKeyParts.join(".profiles.");
              const newPattern = "profiles." + newKeyParts.join(".profiles.");

              if (updatedKey.includes(originalPattern)) {
                updatedKey = updatedKey.replace(originalPattern, newPattern);
                updatedChange.key = updatedKey;
              }
            } else {
              // Handle simple renames
              // For simple renames, we need to replace the original key with the new key
              // but we need to be careful about the context
              let updatedKey = updatedChange.key;

              // For simple renames like 'b' -> 'a.b', we need to replace 'b' with 'a.b'
              // but only when 'b' appears as a profile name (preceded by 'profiles')
              const keyParts = updatedKey.split(".");
              let updated = false;

              for (let i = 0; i < keyParts.length; i++) {
                if (keyParts[i] === rename.originalKey && i > 0 && keyParts[i - 1] === "profiles") {
                  // Check if this key already represents the correct profile structure
                  // For example, if we're renaming 'b' to 'a.b' and the key is 'profiles.a.profiles.b',
                  // this already represents the correct structure for profile 'a.b'
                  const currentProfileFromKey = extractProfileFromKey(updatedKey);
                  if (currentProfileFromKey === rename.newKey) {
                    // The key already represents the correct profile, don't update it
                    continue;
                  }

                  // This is a profile name that needs to be replaced
                  keyParts[i] = rename.newKey;
                  updated = true;
                }
              }

              if (updated) {
                updatedChange.key = keyParts.join(".");
              }
            }
          }

          // Update the path array to use new profile name
          if (updatedChange.path && Array.isArray(updatedChange.path)) {
            const originalKeyParts = rename.originalKey.split(".");
            const newKeyParts = rename.newKey.split(".");

            if (originalKeyParts.length > 1 && newKeyParts.length > 1) {
              // Handle complex nested profile path updates
              let pathUpdated = false;
              const updatedPath = [...updatedChange.path];

              // Find the position where the original profile path starts in the path array
              for (let i = 0; i <= updatedPath.length - originalKeyParts.length; i++) {
                let matches = true;
                for (let j = 0; j < originalKeyParts.length; j++) {
                  if (updatedPath[i + j] !== originalKeyParts[j]) {
                    matches = false;
                    break;
                  }
                }

                if (matches) {
                  // Replace the matched segment with the new key parts
                  updatedPath.splice(i, originalKeyParts.length, ...newKeyParts);
                  pathUpdated = true;
                  break;
                }
              }

              if (pathUpdated) {
                updatedChange.path = updatedPath;
              }
            } else {
              // Handle simple path updates
              updatedChange.path = updatedChange.path.map((pathPart: string) => {
                if (pathPart === rename.originalKey) {
                  return rename.newKey;
                }
                return pathPart;
              });
            }
          }
        }
      }

      return updatedChange;
    });
  }, []);

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
      if (event.data.command === "CONFIGURATIONS") {
        const { contents, secureValuesAllowed } = event.data;
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
              mergedPropsData[item.argName] = {
                value: item.argValue,
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
        const profileNameForMergedProperties = getProfileNameForMergedProperties(selectedProfileKey, configPath);

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
          const profileNameForMergedProperties = getProfileNameForMergedProperties(currentSelectedProfileKey, configPath);

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

  // Helper function to get the correct profile name for merged properties (handles renames)
  const getProfileNameForMergedProperties = (profileKey: string, configPath: string): string => {
    // For merged properties, we need to find where the data is actually stored in the original configuration
    // The data is always stored at the original location before any renames
    // We need to reverse all renames to get to the original location
    let effectiveProfileKey = profileKey;

    // Apply reverse renames step by step
    if (renames[configPath] && Object.keys(renames[configPath]).length > 0) {
      const configRenames = renames[configPath];

      // Convert to array and sort by newKey length (longest first) to handle nested renames correctly
      const sortedRenames = Object.entries(configRenames).sort(([, a], [, b]) => b.length - a.length);

      let changed = true;

      // Keep applying reverse renames until no more changes
      while (changed) {
        changed = false;

        // Process renames from longest to shortest to handle nested cases
        for (const [originalKey, newKey] of sortedRenames) {
          // Check for exact match
          if (effectiveProfileKey === newKey) {
            effectiveProfileKey = originalKey;
            changed = true;
            break;
          }

          // Check for partial matches (parent renames affecting children)
          if (effectiveProfileKey.startsWith(newKey + ".")) {
            effectiveProfileKey = effectiveProfileKey.replace(newKey + ".", originalKey + ".");
            changed = true;
            break;
          }
        }
      }
    }

    return effectiveProfileKey;
  };

  // Helper function to check if a profile is set as default
  const isProfileDefault = (profileKey: string): boolean => {
    if (selectedTab === null) return false;
    const configPath = configurations[selectedTab!]!.configPath;
    const profileType = getProfileType(profileKey, selectedTab, configurations, pendingChanges, renames);

    if (!profileType) return false;

    // Check if this profile was renamed and get the original profile name
    const originalProfileKey = getOriginalProfileKeyWithNested(profileKey, configPath, renames);

    // Check pending defaults first
    const pendingDefault = pendingDefaults[configPath]?.[profileType];
    if (pendingDefault) {
      return pendingDefault.value === profileKey || pendingDefault.value === originalProfileKey;
    }

    // Check existing defaults
    const config = configurations[selectedTab!].properties;
    const defaults = config.defaults || {};

    // Check if the current profile is the default
    if (defaults[profileType] === profileKey || defaults[profileType] === originalProfileKey) {
      return true;
    }

    // Check if this profile should be the default due to renames (simulate backend logic)
    // This handles the case where a default profile was renamed and should remain the default
    const configRenames = renames[configPath] || {};
    for (const [originalKey, newKey] of Object.entries(configRenames)) {
      // If the original profile was the default and this is the renamed version
      if (defaults[profileType] === originalKey && newKey === profileKey) {
        return true;
      }
    }

    return false;
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

  // Helper function to consolidate renames and handle chained renames
  const consolidateRenames = (
    existingRenames: { [originalKey: string]: string },
    originalKey: string,
    newKey: string
  ): { [originalKey: string]: string } => {
    const tempRenames = { ...existingRenames };

    // Handle cancellation
    if (newKey === originalKey) {
      delete tempRenames[originalKey];
      return tempRenames;
    }

    // Add/update the rename
    tempRenames[originalKey] = newKey;

    // Consolidate conflicting renames
    return consolidateConflictingRenames(tempRenames);
  };

  const consolidateConflictingRenames = (renames: { [originalKey: string]: string }): { [originalKey: string]: string } => {
    const consolidated = { ...renames };
    console.log("[CONSOLIDATION] Starting with renames:", consolidated);
    let changed = true;
    let iterations = 0;
    const maxIterations = 10; // Prevent infinite loops

    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;
      const keys = Object.keys(consolidated);
      console.log(`[CONSOLIDATION] Iteration ${iterations}, keys:`, keys);

      if (iterations >= maxIterations) {
        console.warn("[CONSOLIDATION] Maximum iterations reached, breaking to prevent infinite loop");
        break;
      }

      // First pass: detect and remove opposing renames (A->B, B->A)
      for (const originalKey of keys) {
        const newKey = consolidated[originalKey];
        if (consolidated[newKey] === originalKey) {
          console.log(`[CONSOLIDATION] Found opposing renames: ${originalKey} <-> ${newKey}, removing both`);

          // Before removing, check if any child renames need to be updated
          // Find all renames that have the newKey as a parent
          for (const [childOriginalKey, childNewKey] of Object.entries(consolidated)) {
            if (childNewKey.startsWith(newKey + ".")) {
              // This child was depending on the newKey, update it to use originalKey instead
              const childSuffix = childNewKey.substring(newKey.length + 1);
              const updatedChildKey = originalKey + "." + childSuffix;
              console.log(`[CONSOLIDATION] Updating child after opposing rename removal: ${childOriginalKey} (${childNewKey}) -> ${updatedChildKey}`);
              consolidated[childOriginalKey] = updatedChildKey;
            }
          }

          delete consolidated[originalKey];
          delete consolidated[newKey];
          changed = true;
        }
      }

      if (changed) continue; // Restart the loop after removing opposing renames

      // Second pass: handle parent-child dependencies
      // Only update child renames when the parent rename is NOT being renamed again
      for (const originalKey of keys) {
        const newKey = consolidated[originalKey];

        // Check if this parent itself is being renamed (i.e., if newKey is a target of another rename)
        const isParentBeingRenamed = Object.values(consolidated).includes(newKey);
        if (isParentBeingRenamed) {
          console.log(`[CONSOLIDATION] Skipping child updates for ${originalKey} -> ${newKey} because parent is being renamed again`);
          continue;
        }

        // Check if any other renames have this originalKey as a parent in their target
        for (const [otherOriginalKey, otherNewKey] of Object.entries(consolidated)) {
          if (otherOriginalKey !== originalKey) {
            // Check if otherNewKey starts with originalKey + "."
            if (otherNewKey.startsWith(originalKey + ".")) {
              // This is a child of the renamed parent, update its path
              const childSuffix = otherNewKey.substring(originalKey.length + 1);
              const updatedChildKey = newKey + "." + childSuffix;
              console.log(`[CONSOLIDATION] Updating child: ${otherOriginalKey} (${otherNewKey}) -> ${updatedChildKey}`);

              // Check if this creates a conflict with an existing rename
              const conflictingKey = Object.keys(consolidated).find((k) => consolidated[k] === updatedChildKey);
              if (conflictingKey && conflictingKey !== otherOriginalKey) {
                // There's a conflict, we need to resolve it
                // For now, we'll keep the existing rename and skip this update
                console.log(`[CONSOLIDATION] Conflict detected, skipping update for ${otherOriginalKey}`);
                continue;
              }

              consolidated[otherOriginalKey] = updatedChildKey;
              changed = true;
            }
          }
        }
      }

      // Third pass: handle parent renames that affect children
      // This handles cases where a parent is renamed and we need to update children to use the final target
      for (const [originalKey, newKey] of Object.entries(consolidated)) {
        // Check if this parent is being renamed (i.e., if newKey is a target of another rename)
        const parentRename = Object.entries(consolidated).find(([k, v]) => v === newKey && k !== originalKey);
        if (parentRename) {
          const [, parentNewKey] = parentRename;
          console.log(`[CONSOLIDATION] Parent ${originalKey} -> ${newKey} is being renamed to ${parentNewKey}`);

          // Update children of this parent to use the final target
          for (const [otherOriginalKey, otherNewKey] of Object.entries(consolidated)) {
            if (otherOriginalKey !== originalKey && otherNewKey.startsWith(newKey + ".")) {
              const childSuffix = otherNewKey.substring(newKey.length + 1);
              const finalChildKey = parentNewKey + "." + childSuffix;
              console.log(`[CONSOLIDATION] Updating child to final target: ${otherOriginalKey} (${otherNewKey}) -> ${finalChildKey}`);

              // Check for conflicts
              const conflictingKey = Object.keys(consolidated).find((k) => consolidated[k] === finalChildKey);
              if (!conflictingKey || conflictingKey === otherOriginalKey) {
                consolidated[otherOriginalKey] = finalChildKey;
                changed = true;
              }
            }
          }
        }
      }

      // Additional third pass: handle cases where a child's parent part is being renamed
      // This handles cases like zosmf -> zftp.zosmf where zftp is being renamed to tso.zftp
      for (const [originalKey, newKey] of Object.entries(consolidated)) {
        // Look for other renames that have this originalKey as a parent in their target
        for (const [otherOriginalKey, otherNewKey] of Object.entries(consolidated)) {
          if (otherOriginalKey !== originalKey && otherNewKey.startsWith(originalKey + ".")) {
            // This is a child of the renamed parent
            const childSuffix = otherNewKey.substring(originalKey.length + 1);
            const finalChildKey = newKey + "." + childSuffix;
            console.log(`[CONSOLIDATION] Updating child to use final parent target: ${otherOriginalKey} (${otherNewKey}) -> ${finalChildKey}`);

            // Check for conflicts
            const conflictingKey = Object.keys(consolidated).find((k) => consolidated[k] === finalChildKey);
            if (!conflictingKey || conflictingKey === otherOriginalKey) {
              consolidated[otherOriginalKey] = finalChildKey;
              changed = true;
            }
          }
        }
      }

      // Fourth pass: sort renames to ensure parent renames happen before child renames
      // This prevents conflicts where a child rename creates a structure that conflicts with a parent rename
      const sortedRenames = Object.entries(consolidated).sort(([, newKeyA], [, newKeyB]) => {
        // Sort by depth (shorter paths first) to ensure parents are processed before children
        const depthA = newKeyA.split(".").length;
        const depthB = newKeyB.split(".").length;
        return depthA - depthB;
      });

      // Rebuild consolidated object with sorted order
      const sortedConsolidated: { [originalKey: string]: string } = {};
      for (const [originalKey, newKey] of sortedRenames) {
        sortedConsolidated[originalKey] = newKey;
      }

      console.log(`[CONSOLIDATION] Sorted renames by depth:`, sortedConsolidated);
      Object.assign(consolidated, sortedConsolidated);

      // Fifth pass: handle direct conflicts only (not chaining)
      if (!changed) {
        for (let i = 0; i < keys.length; i++) {
          for (let j = i + 1; j < keys.length; j++) {
            const key1 = keys[i];
            const key2 = keys[j];
            const target1 = consolidated[key1];
            const target2 = consolidated[key2];

            // Only consolidate if two profiles rename to the same target
            if (target1 === target2) {
              // Keep the shorter original key, remove the longer one
              if (key1.length <= key2.length) {
                delete consolidated[key2];
                changed = true;
                break;
              } else {
                delete consolidated[key1];
                changed = true;
                break;
              }
            }
          }
          if (changed) break;
        }
      }
    }

    console.log(`[CONSOLIDATION] Final consolidated renames:`, consolidated);

    // Additional debugging: check for potential conflicts
    const targets = Object.values(consolidated);
    const duplicateTargets = targets.filter((target, index) => targets.indexOf(target) !== index);
    if (duplicateTargets.length > 0) {
      console.log(`[CONSOLIDATION] WARNING: Duplicate targets found:`, duplicateTargets);
    }

    return consolidated;
  };

  // Helper functions now imported from utils

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

  // Helper function to get the current effective name of a profile (considering pending renames)
  const getCurrentEffectiveName = (profileKey: string, configPath: string): string => {
    const currentRenames = renames[configPath] || {};
    let effectiveName = profileKey;

    // Apply renames iteratively to handle chained renames
    let changed = true;
    let iteration = 0;
    while (changed && iteration < 10) {
      // Safety limit to prevent infinite loops
      changed = false;
      iteration++;

      for (const [originalKey, newKey] of Object.entries(currentRenames)) {
        if (effectiveName === originalKey) {
          effectiveName = newKey;
          changed = true;
          break;
        }
        if (effectiveName.startsWith(originalKey + ".")) {
          const newEffectiveName = effectiveName.replace(originalKey + ".", newKey + ".");
          effectiveName = newEffectiveName;
          changed = true;
          break;
        }
      }
    }
    return effectiveName;
  };

  const handleRenameProfile = (originalKey: string, newKey: string): boolean => {
    if (selectedTab === null) return false;
    const configPath = configurations[selectedTab!]!.configPath;

    // Check if we need to use the current effective name instead of the original key
    const currentEffectiveName = getCurrentEffectiveName(originalKey, configPath);
    if (currentEffectiveName !== originalKey) {
      // Use the current effective name as the original key
      originalKey = currentEffectiveName;
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
      const updatedRenames = consolidateRenames(prev[configPath] || {}, originalKey, newKey);
      return {
        ...prev,
        [configPath]: updatedRenames,
      };
    });

    // Update the selected profile key based on the consolidated renames
    const updatedRenames = consolidateRenames(renames[configPath] || {}, originalKey, newKey);

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
        const profileNameForMergedProperties = getProfileNameForMergedProperties(newSelectedProfileKey, configPath);
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

    // Close the modal
    setRenameProfileModalOpen(false);

    return true; // Return true to indicate success
  };

  const handleDeleteProfile = (profileKey: string) => {
    if (selectedTab === null) return;
    const configPath = configurations[selectedTab!]!.configPath;

    // Get the current effective profile key considering pending renames
    const effectiveProfileKey = getCurrentEffectiveName(profileKey, configPath);

    // Construct the full profile path using the effective profile key
    let fullProfilePath: string;
    if (effectiveProfileKey.includes(".")) {
      // Nested profile, construct the full path
      const profileParts = effectiveProfileKey.split(".");
      const pathArray = ["profiles"];
      for (let i = 0; i < profileParts.length; i++) {
        pathArray.push(profileParts[i]);
        if (i < profileParts.length - 1) {
          pathArray.push("profiles");
        }
      }
      fullProfilePath = pathArray.join(".");
    } else {
      // Top-level profile
      fullProfilePath = `profiles.${effectiveProfileKey}`;
    }

    // Add to deletions - we'll add all profile-related keys to deletions
    setDeletions((prev) => {
      const newDeletions = { ...prev };
      if (!newDeletions[configPath]) {
        newDeletions[configPath] = [];
      }

      // Add the full profile path to deletions
      newDeletions[configPath].push(fullProfilePath);

      return newDeletions;
    });

    // Clear any pending changes for this profile (using both original and effective keys)
    setPendingChanges((prev) => {
      const newState = { ...prev };
      if (newState[configPath]) {
        // Remove all pending changes that belong to this profile
        Object.keys(newState[configPath]).forEach((key) => {
          const entry = newState[configPath][key];
          if (entry.profile === profileKey || entry.profile === effectiveProfileKey) {
            delete newState[configPath][key];
          }
        });
      }
      return newState;
    });

    // If this profile is currently selected, or if the selected profile is a child of this profile, select the nearest profile
    if (selectedProfileKey === profileKey || (selectedProfileKey && selectedProfileKey.startsWith(profileKey + "."))) {
      const nearestProfileKey = findOptimalReplacementProfile(profileKey, configPath);

      // Set the nearest profile as selected, or null if no profile available
      setSelectedProfileKey(nearestProfileKey);

      // Also update the stored profiles for this config
      if (configPath) {
        setSelectedProfilesByConfig((prev) => ({
          ...prev,
          [configPath]: nearestProfileKey,
        }));
      }

      // If we found a nearest profile, get its merged properties
      if (nearestProfileKey) {
        // Get the correct profile name for merged properties (handles renames)
        const profileNameForMergedProperties = getProfileNameForMergedProperties(nearestProfileKey, configPath);

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
      const profileNameForMergedProperties = getProfileNameForMergedProperties(profileKey, configPath);

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
        const profileNameForMergedProperties = getProfileNameForMergedProperties(previouslySelectedProfile, configPath);

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

    if (!isInherited) {
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
      const result = !pathsEqual || jsonLocIndicatesDifferentProfile;

      // Debug logging for final result
      if (displayKey === "host" || displayKey === "port" || displayKey === "user" || displayKey === "password") {
      }

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

  // Helper function to get profile type from path
  const getProfileTypeFromPath = (path: string[]): string | undefined => {
    if (!path || path.length === 0) {
      return undefined;
    }

    // Get the profile type from the path
    const profileTypePath = path.slice(0, -1); // Remove "properties" from the path
    const profileKey = extractProfileKeyFromPath(path);
    const configPath = configurations[selectedTab!]?.configPath;

    // First check if there's a pending type change
    if (profileKey && configPath) {
      // For nested profiles, we need to construct the correct key that matches how it's stored in pending changes
      let typeKey: string;
      if (profileKey.includes(".")) {
        // This is a nested profile - construct the full path with "profiles" segments
        const profileParts = profileKey.split(".");
        const pathParts = ["profiles"];
        for (let i = 0; i < profileParts.length; i++) {
          pathParts.push(profileParts[i]);
          if (i < profileParts.length - 1) {
            pathParts.push("profiles");
          }
        }
        pathParts.push("type");
        typeKey = pathParts.join(".");
      } else {
        // Top-level profile
        typeKey = `profiles.${profileKey}.type`;
      }

      const pendingType = pendingChanges[configPath]?.[typeKey]?.value;
      if (pendingType !== undefined && typeof pendingType === "string") {
        // Return the pending type (including empty string for typeless profiles)
        return pendingType;
      }
    }

    // Fall back to the current type from the configuration
    return getNestedProperty(configurations[selectedTab!]?.properties, profileTypePath)?.type;
  };

  // Helper function to check if a property can be made secure based on the schema
  const canPropertyBeSecure = (displayKey: string, path: string[]): boolean => {
    if (!displayKey || !path || path.length === 0) {
      return false;
    }

    // Get the profile type from the path
    const profileType = getProfileTypeFromPath(path);

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

  // Helper function to check if a profile has been renamed
  const hasPendingRename = (profileKey: string): boolean => {
    const configPath = configurations[selectedTab!]?.configPath;
    if (!configPath) {
      return false;
    }
    const renamesForConfig = renames[configPath] || {};

    // Check if this profile is a renamed profile (exists as a value in the renames object)
    const result = Object.values(renamesForConfig).includes(profileKey);

    return result;
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

  // Helper function to check if a profile or its parent is deleted
  const isProfileOrParentDeleted = (profileKey: string, deletedProfiles: string[]): boolean => {
    if (selectedTab === null) return false;

    // Get the current effective profile key considering pending renames
    const effectiveProfileKey = getCurrentEffectiveName(profileKey, configurations[selectedTab!]!.configPath);

    // Use the effective profile key to check the current hierarchy
    const profileParts = effectiveProfileKey.split(".");

    // Check each level of the current profile hierarchy
    for (let i = 0; i < profileParts.length; i++) {
      const currentLevelProfileKey = profileParts.slice(0, i + 1).join(".");
      let fullProfilePath: string;

      if (i === 0) {
        // Top-level profile
        fullProfilePath = `profiles.${currentLevelProfileKey}`;
      } else {
        // Nested profile - construct the full path for this specific level
        const pathArray = ["profiles"];
        for (let j = 0; j <= i; j++) {
          pathArray.push(profileParts[j]);
          if (j < i) {
            pathArray.push("profiles");
          }
        }
        fullProfilePath = pathArray.join(".");
      }

      // If any parent profile is deleted, hide this profile
      if (deletedProfiles.includes(fullProfilePath)) {
        return true;
      }
    }
    return false;
  };

  // Memoized function to get available profiles for optimal performance
  const getAvailableProfilesForConfig = useCallback(
    (configPath: string): string[] => {
      const profilesObj = configurations[selectedTab!]?.properties?.profiles;
      if (!profilesObj) {
        return [];
      }

      const pendingProfiles = extractPendingProfiles(configPath);
      const deletedProfiles = deletions[configPath] || [];

      // Get all available profiles (existing + pending) that are not deleted
      const getAvailableProfiles = (profiles: any, parentKey = ""): string[] => {
        const available: string[] = [];
        for (const key of Object.keys(profiles)) {
          const profile = profiles[key];
          const qualifiedKey = parentKey ? `${parentKey}.${key}` : key;

          // Only include profiles that are not deleted
          if (!isProfileOrParentDeleted(qualifiedKey, deletedProfiles)) {
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
        (key) => !existingProfiles.includes(key) && !isProfileOrParentDeleted(key, deletedProfiles)
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
        return !orderedProfileKeys.includes(originalKey);
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
          hasPendingRename={hasPendingRename}
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
    return (
      <div>
        <div className="profile-heading-container">
          <h2 title={selectedProfileKey || "Profile Details"}>{selectedProfileKey || "Profile Details"}</h2>
          {selectedProfileKey && (
            <div className="profile-actions">
              <button
                className="profile-action-button"
                onClick={() => {
                  const configPath = configurations[selectedTab!]?.configPath;
                  if (configPath) {
                    vscodeApi.postMessage({
                      command: "OPEN_CONFIG_FILE_WITH_PROFILE",
                      filePath: configPath,
                      profileKey: selectedProfileKey,
                    });
                  }
                }}
                title="Open config file with profile highlighted"
              >
                <span className="codicon codicon-go-to-file"></span>
              </button>
              <button
                className="profile-action-button"
                onClick={() => {
                  if (isProfileDefault(selectedProfileKey)) {
                    // If already default, deselect it by setting to empty
                    const profileType = getProfileType(selectedProfileKey, selectedTab, configurations, pendingChanges, renames);
                    if (profileType) {
                      const configPath = configurations[selectedTab!]!.configPath;
                      setPendingDefaults((prev) => ({
                        ...prev,
                        [configPath]: {
                          ...prev[configPath],
                          [profileType]: { value: "", path: [profileType] },
                        },
                      }));
                    }
                  } else {
                    // Set as default
                    handleSetAsDefault(selectedProfileKey);
                  }
                }}
                title={isProfileDefault(selectedProfileKey) ? "Click to remove default" : "Set as default"}
              >
                <span className={`codicon codicon-${isProfileDefault(selectedProfileKey) ? "star-full" : "star-empty"}`}></span>
              </button>
              <button
                className="profile-action-button"
                onClick={() => setShowMergedPropertiesWithStorage(!showMergedProperties)}
                title={showMergedProperties ? "Hide merged properties" : "Show merged properties"}
              >
                <span className={`codicon codicon-${showMergedProperties ? "eye-closed" : "eye"}`}></span>
              </button>
              <button className="profile-action-button" onClick={() => setRenameProfileModalOpen(true)} title="Rename profile">
                <span className="codicon codicon-edit"></span>
              </button>
              <button className="profile-action-button" onClick={() => handleDeleteProfile(selectedProfileKey)} title="Delete profile">
                <span className="codicon codicon-trash"></span>
              </button>
            </div>
          )}
        </div>
        {selectedProfileKey &&
          (() => {
            const currentConfig = configurations[selectedTab!];
            if (!currentConfig) {
              return null;
            }
            const flatProfiles = flattenProfiles(currentConfig.properties?.profiles || {});
            const configPath = currentConfig.configPath;

            // Use the helper function to extract pending profiles
            const pendingProfiles = extractPendingProfiles(configPath);

            // For profile data lookup, we need to find where the data is actually stored in the original configuration
            // The data is always stored at the original location before any renames
            // We need to reverse all renames to get to the original location
            let effectiveProfileKey = selectedProfileKey;

            // Apply reverse renames step by step
            if (renames[configPath] && Object.keys(renames[configPath]).length > 0) {
              const configRenames = renames[configPath];

              // Sort renames by length of newKey (longest first) to handle nested renames correctly
              const sortedRenames = Object.entries(configRenames).sort(([, a], [, b]) => b.length - a.length);

              let changed = true;

              // Keep applying reverse renames until no more changes
              while (changed) {
                changed = false;

                // Process renames from longest to shortest to handle nested cases
                for (const [originalKey, newKey] of sortedRenames) {
                  // Check for exact match
                  if (effectiveProfileKey === newKey) {
                    effectiveProfileKey = originalKey;
                    changed = true;
                    break;
                  }

                  // Check for partial matches (parent renames affecting children)
                  if (effectiveProfileKey.startsWith(newKey + ".")) {
                    effectiveProfileKey = effectiveProfileKey.replace(newKey + ".", originalKey + ".");
                    changed = true;
                    break;
                  }
                }
              }
            }

            let effectivePath: string[];

            // Construct the profile path using the effective profile key
            const effectiveProfilePathParts = effectiveProfileKey.split(".");
            if (effectiveProfilePathParts.length === 1) {
              // Top-level profile
              effectivePath = ["profiles", effectiveProfileKey];
            } else {
              // Nested profile - need to construct path like ["profiles", "project_base", "profiles", "tso"]
              effectivePath = ["profiles"];
              for (let i = 0; i < effectiveProfilePathParts.length; i++) {
                effectivePath.push(effectiveProfilePathParts[i]);
                if (i < effectiveProfilePathParts.length - 1) {
                  effectivePath.push("profiles");
                }
              }
            }

            // Pass the effective profile object (without pending changes) to renderConfig
            // so that renderConfig can properly combine existing and pending changes
            // For newly created profiles, use the pending profile data as the base
            const effectiveProfile = flatProfiles[effectiveProfileKey] || pendingProfiles[effectiveProfileKey] || {};

            // Check if this profile has pending renames - if so, don't show merged properties
            // We need to check if the selected profile key is a renamed version of another profile
            // OR if any of its parent profiles have been renamed
            Object.values(renames[configPath] || {}).some((newKey) => {
              // Check if this profile is directly renamed
              if (newKey === selectedProfileKey) return true;

              // Check if any parent profile has been renamed
              const profileParts = selectedProfileKey.split(".");
              for (let i = 1; i <= profileParts.length; i++) {
                const parentKey = profileParts.slice(0, i).join(".");
                if (Object.values(renames[configPath] || {}).some((renamedKey) => renamedKey === parentKey)) {
                  return true;
                }
              }
              return false;
            });
            // We can still show merged properties even with parent renames, as long as we request them
            // using the correct profile name (which getProfileNameForMergedProperties handles)
            const shouldShowMergedProperties = showMergedProperties;

            return (
              <div key={`${selectedProfileKey}-${propertySortOrder}-${sortOrderVersion}`}>
                {renderConfig(effectiveProfile, effectivePath, shouldShowMergedProperties ? mergedProperties : null)}
              </div>
            );
          })()}
      </div>
    );
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

        // Add secure properties to the entries for sorting, but mark them as secure
        const entriesForSorting = Object.entries(combinedConfig);

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
        const configPath = configurations[selectedTab!]?.configPath;
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
            const isAllowedBySchema = !profileType || allowedProperties.includes(propertyName);

            if (
              !entriesForSorting.some(([existingKey]) => existingKey === propertyName) &&
              !originalProperties?.hasOwnProperty(propertyName) &&
              isAllowedBySchema
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

        // Check if this is a merged property that should be shown even if the original was deleted
        const isMergedProperty = showMergedProperties && mergedProps && displayKey && mergedProps[displayKey];
        const isInDeletions = (deletions[configPath] ?? []).includes(fullKey);

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
                  isFromMergedProps
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
                        value={isFromMergedProps ? "••••••••" : stringifyValueByType(pendingValue)}
                        onChange={(e) => handleChange(fullKey, (e.target as HTMLInputElement).value)}
                        disabled={isFromMergedProps}
                        style={
                          isFromMergedProps
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
                        disabled={isFromMergedProps}
                        style={
                          isFromMergedProps
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
                        value={stringifyValueByType(pendingValue)}
                        onChange={(e) => handleChange(fullKey, (e.target as HTMLInputElement).value)}
                        disabled={isFromMergedProps}
                        style={
                          isFromMergedProps
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
                        value={isFromMergedProps ? String(mergedPropData?.value ?? "") : stringifyValueByType(pendingValue)}
                        onChange={(e) => handleChange(fullKey, (e.target as HTMLInputElement).value)}
                        disabled={isFromMergedProps}
                        style={
                          isFromMergedProps
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
                (!isFromMergedProps || isSecurePropertyForSorting) &&
                (() => {
                  const isSecure = isPropertySecure(fullKey, displayKey, path, mergedProps);
                  const canBeSecure = canPropertyBeSecure(displayKey, path);
                  return (
                    <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                      {canBeSecure &&
                        !isSecure &&
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
                      <button className="action-button" onClick={() => handleDeleteProperty(fullKey)}>
                        <span className="codicon codicon-trash"></span>
                      </button>
                    </div>
                  );
                })()}
              {displayKey !== "type" && isFromMergedProps && (
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

          return (
            <div
              key={fullKey}
              className="config-item"
              onClick={isFromMergedProps && jsonLoc ? () => handleNavigateToSource(jsonLoc, osLoc) : undefined}
              title={
                isFromMergedProps && jsonLoc
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
              style={isFromMergedProps && jsonLoc ? { cursor: "pointer" } : {}}
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
                const availableProfiles = getAvailableProfilesByType(key);
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

  const getAvailableProfilesByType = (profileType: string) => {
    if (selectedTab === null) return [];

    const config = configurations[selectedTab].properties;
    const flatProfiles = flattenProfiles(config.profiles);
    const profileNames = Object.keys(flatProfiles);

    // Get all profiles that have pending type changes
    const profilesWithPendingTypeChanges = new Set<string>();
    Object.entries(pendingChanges[configurations[selectedTab].configPath] || {}).forEach(([key, entry]) => {
      if (entry.profile) {
        const keyParts = key.split(".");
        const isTypeKey = keyParts[keyParts.length - 1] === "type";
        if (isTypeKey) {
          // Extract the profile name from the key path
          const profilePathParts = keyParts.slice(0, -1); // Remove "type" from the end
          if (profilePathParts[0] === "profiles") {
            const profileNameParts = profilePathParts.slice(1);
            const profileName = profileNameParts.join(".");
            profilesWithPendingTypeChanges.add(profileName);
          }
        }
      }
    });

    // Filter profiles by type, excluding those with pending type changes
    const profilesOfType = profileNames.filter((profileKey) => {
      // Skip profiles that have pending type changes
      if (profilesWithPendingTypeChanges.has(profileKey)) {
        return false;
      }
      const profileTypeValue = getProfileType(profileKey, selectedTab, configurations, pendingChanges, renames);
      return profileTypeValue === profileType;
    });

    // Include pending profiles from pendingChanges that match the type
    const pendingProfiles = new Set<string>();
    Object.entries(pendingChanges[configurations[selectedTab].configPath] || {}).forEach(([key, entry]) => {
      if (entry.profile) {
        // Check if the pending profile has the correct type
        const keyParts = key.split(".");
        const isTypeKey = keyParts[keyParts.length - 1] === "type";
        if (isTypeKey && entry.value === profileType) {
          // Extract the profile name from the key path
          // Remove "profiles" prefix and get just the profile name
          const profilePathParts = keyParts.slice(0, -1); // Remove "type" from the end
          if (profilePathParts[0] === "profiles") {
            // Remove "profiles" prefix and get the actual profile name
            const profileNameParts = profilePathParts.slice(1);
            const profileName = profileNameParts.join(".");
            pendingProfiles.add(profileName);
          }
        }
      }
    });

    // Apply renames to all profile names, including nested profiles
    const configPath = configurations[selectedTab].configPath;
    const renamedProfilesOfType = profilesOfType.map((profileKey) => getRenamedProfileKeyWithNested(profileKey, configPath, renames));
    const renamedPendingProfiles = Array.from(pendingProfiles).map((profileKey) => getRenamedProfileKeyWithNested(profileKey, configPath, renames));

    return [...renamedProfilesOfType, ...renamedPendingProfiles];
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
