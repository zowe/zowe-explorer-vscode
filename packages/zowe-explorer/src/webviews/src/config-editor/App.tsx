import { useEffect, useState, useCallback, useRef } from "react";
import * as l10n from "@vscode/l10n";
import { cloneDeep } from "es-toolkit";
import { isSecureOrigin } from "../utils";
import { schemaValidation } from "../../../utils/ConfigEditor";
import "./App.css";

// Components
import { Footer, Tabs, Panels, ProfileList, AddProfileModal, SaveModal, NewLayerModal, ProfileWizardModal, AddConfigModal } from "./components";

// Utils
import { flattenKeys, flattenProfiles, extractProfileKeyFromPath, sortConfigEntries, stringifyValueByType, pathFromArray } from "./utils";

// Hooks
import { useProfileWizard } from "./hooks";
const vscodeApi = acquireVsCodeApi();

// LocalStorage keys for config editor settings
const LOCAL_STORAGE_KEYS = {
  SHOW_MERGED_PROPERTIES: "zowe.configEditor.showMergedProperties",
  VIEW_MODE: "zowe.configEditor.viewMode",
  PROPERTY_SORT_ORDER: "zowe.configEditor.propertySortOrder",
} as const;

// Property sort order options
export type PropertySortOrder = "alphabetical" | "merged-first" | "non-merged-first";

const SORT_ORDER_OPTIONS: PropertySortOrder[] = ["alphabetical", "merged-first", "non-merged-first"];

// Helper function to get user-friendly display name for sort order
const getSortOrderDisplayName = (sortOrder: PropertySortOrder): string => {
  switch (sortOrder) {
    case "alphabetical":
      return "alphabetical";
    case "merged-first":
      return "merged first";
    case "non-merged-first":
      return "merged last";
    default:
      return sortOrder;
  }
};

// Helper function to get nested property from an object using a path array
const getNestedProperty = (obj: any, path: string[]): any => {
  let current = obj;
  for (const segment of path) {
    if (current && typeof current === "object" && current.hasOwnProperty(segment)) {
      current = current[segment];
    } else {
      return undefined;
    }
  }
  return current;
};

export function App() {
  const [localizationState] = useState(null);

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
  const [configurations, setConfigurations] = useState<
    { configPath: string; properties: any; secure: string[]; global?: boolean; user?: boolean; schemaPath?: string }[]
  >([]);
  const configurationsRef = useRef<
    { configPath: string; properties: any; secure: string[]; global?: boolean; user?: boolean; schemaPath?: string }[]
  >([]);
  const [selectedTab, setSelectedTab] = useState<number | null>(null);
  const [flattenedConfig, setFlattenedConfig] = useState<{ [key: string]: { value: string; path: string[] } }>({});
  const [flattenedDefaults, setFlattenedDefaults] = useState<{ [key: string]: { value: string; path: string[] } }>({});
  const [pendingChanges, setPendingChanges] = useState<{
    [configPath: string]: {
      [key: string]: {
        value: string | number | boolean | Record<string, any>;
        path: string[];
        profile: string;
        secure?: boolean;
      };
    };
  }>({});
  const [pendingDefaults, setPendingDefaults] = useState<{
    [configPath: string]: {
      [key: string]: {
        value: string;
        path: string[];
      };
    };
  }>({});
  const [deletions, setDeletions] = useState<{
    [configPath: string]: string[];
  }>({});
  const [defaultsDeletions, setDefaultsDeletions] = useState<{
    [configPath: string]: string[];
  }>({});
  const [newProfileKeyPath, setNewProfileKeyPath] = useState<string[] | null>(null);
  const [newProfileKey, setNewProfileKey] = useState("");
  const [newProfileValue, setNewProfileValue] = useState("");
  const [newProfileModalOpen, setNewProfileModalOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [newLayerModalOpen, setNewLayerModalOpen] = useState(false);
  const [newLayerName, setNewLayerName] = useState("");
  const [newLayerPath, setNewLayerPath] = useState<string[] | null>(null);
  const [isSecure, setIsSecure] = useState(false);
  const [secureValuesAllowed, setSecureValuesAllowed] = useState<boolean>(true);

  const [hiddenItems, setHiddenItems] = useState<{
    [configPath: string]: {
      [key: string]: { path: string };
    };
  }>({});
  const [showDropdown, setShowDropdown] = useState(false);
  const [schemaValidations, setSchemaValidations] = useState<{ [configPath: string]: schemaValidation | undefined }>({});
  const [selectedProfileKey, setSelectedProfileKey] = useState<string | null>(null);
  const [selectedProfilesByConfig, setSelectedProfilesByConfig] = useState<{ [configPath: string]: string | null }>({});
  const [addConfigModalOpen, setAddConfigModalOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState<string | null>(null);

  const [hasPromptedForZeroConfigs, setHasPromptedForZeroConfigs] = useState(false);

  // Use ref to access current selectedProfileKey in event listeners
  const selectedProfileKeyRef = useRef<string | null>(null);
  selectedProfileKeyRef.current = selectedProfileKey;

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

    const result = {
      changes,
      deletions: deleteKeys,
      defaultsChanges,
      defaultsDeleteKeys: defaultsDeleteKeys,
    };

    return result;
  }, [pendingChanges, deletions, pendingDefaults, defaultsDeletions]);

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
        profileNames.forEach((existingProfile) => {
          if (existingProfile.startsWith(profileName + ".")) {
            deletedProfiles.add(existingProfile);
          }
        });
      }
    });

    // Combine all profiles, exclude deleted ones, and ensure uniqueness
    const allProfiles = new Set(["root", ...profileNames, ...Array.from(pendingProfiles)]);

    // Remove deleted profiles
    deletedProfiles.forEach((profile) => allProfiles.delete(profile));

    return Array.from(allProfiles).sort((a, b) => {
      // Always put "root" first
      if (a === "root") return -1;
      if (b === "root") return 1;
      // Sort other profiles alphabetically
      return a.localeCompare(b);
    });
  }, [selectedTab, configurations, pendingChanges, deletions]);

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

    vscodeApi.postMessage({
      command: "SAVE_CHANGES",
      changes,
      deletions: deleteKeys,
      defaultsChanges,
      defaultsDeleteKeys: defaultsDeleteKeys,
    });

    setHiddenItems({});
    setPendingChanges({});
    setDeletions({});
    setPendingDefaults({});
    setDefaultsDeletions({});

    // Refresh configurations after save
    vscodeApi.postMessage({ command: "GET_PROFILES" });
  }, [selectedTab, selectedProfileKey, pendingChanges, deletions, pendingDefaults, defaultsDeletions]);

  // Preview Args Modal state

  // Merged Properties state
  const [mergedProperties, setMergedProperties] = useState<any>(null);
  const [showMergedProperties, setShowMergedProperties] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<"flat" | "tree">("tree");
  const [propertySortOrder, setPropertySortOrder] = useState<PropertySortOrder>("alphabetical");
  const [sortOrderVersion, setSortOrderVersion] = useState<number>(0);

  // Function to sort properties based on the current sort order
  const sortProperties = useCallback(
    (entries: [string, any][], mergedProps?: any, originalProperties?: any, path?: string[]): [string, any][] => {
      if (propertySortOrder === "alphabetical") {
        return entries.sort(([a], [b]) => a.localeCompare(b));
      }

      // For merged-first and non-merged-first, we need the configuration data
      if (selectedTab === null || !configurations[selectedTab]) {
        if (!(mergedProps && Object.keys(mergedProps).length > 0)) {
          return entries;
        }
      }

      // For merged-first and non-merged-first, we need to categorize properties
      const categorizedEntries = entries.map(([key, value]) => {
        const displayKey = key.split(".").pop();
        const fullKey = path ? [...path, key].join(".") : key;

        // Check if this is a secure property that was added for sorting
        const isSecurePropertyForSorting = typeof value === "object" && value !== null && value._isSecureProperty === true;

        // Use the existing isPropertyFromMergedProps function to determine if this is a merged property
        // Get configPath from mergedProps if available, otherwise from selectedTab
        let configPath: string | undefined = undefined;
        if (selectedTab !== null && configurations[selectedTab]) {
          configPath = configurations[selectedTab].configPath;
        }
        if (!configPath && mergedProps && displayKey && mergedProps[displayKey]?.osLoc) {
          // Extract configPath from the osLoc of the merged property
          configPath = mergedProps[displayKey].osLoc.join("");
        }

        let isActuallyMerged = false;

        if (isSecurePropertyForSorting) {
          // Secure properties added for sorting are always original (non-merged)
          isActuallyMerged = false;
        } else if (displayKey && path && configPath) {
          isActuallyMerged = isPropertyFromMergedProps(displayKey, path, mergedProps, originalProperties, configPath);
        }

        // Use the existing isPropertySecure function to determine if this property is secure
        let isSecure = false;
        if (isSecurePropertyForSorting) {
          // Properties with _isSecureProperty flag are always secure
          isSecure = true;
        } else if (displayKey && path && configPath) {
          isSecure = isPropertySecure(fullKey, displayKey, path, mergedProps, originalProperties);
        }

        let category = 0; // 0 = original non-secure, 1 = original secure, 2 = merged non-secure, 3 = merged secure

        if (isActuallyMerged) {
          category = isSecure ? 3 : 2;
        } else {
          category = isSecure ? 1 : 0;
        }

        return { key, value, category, displayKey, isActuallyMerged, isSecure };
      });

      if (propertySortOrder === "merged-first") {
        return categorizedEntries
          .sort((a, b) => {
            // First sort by category (merged first: 2, 3, 0, 1)
            if (a.category !== b.category) {
              // Categories: 0 = original non-secure, 1 = original secure, 2 = merged non-secure, 3 = merged secure
              // For merged-first, we want: 2, 3, 0, 1 (merged first, then original)
              const categoryOrder = [2, 3, 0, 1];
              const aOrder = categoryOrder.indexOf(a.category);
              const bOrder = categoryOrder.indexOf(b.category);
              return aOrder - bOrder;
            }
            // Then alphabetically within each category
            return a.key.localeCompare(b.key);
          })
          .map(({ key, value }) => [key, value] as [string, any]);
      } else {
        // non-merged-first
        return categorizedEntries
          .sort((a, b) => {
            // First sort by category (non-merged first: 0, 1, 2, 3)
            if (a.category !== b.category) {
              // Categories: 0 = original non-secure, 1 = original secure, 2 = merged non-secure, 3 = merged secure
              // For non-merged-first, we want: 0, 1, 2, 3 (original first, then merged)
              return a.category - b.category;
            }
            // Then alphabetically within each category
            return a.key.localeCompare(b.key);
          })
          .map(({ key, value }) => [key, value] as [string, any]);
      }
    },
    [propertySortOrder, sortOrderVersion]
  );

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [pendingSaveSelection, setPendingSaveSelection] = useState<{ tab: number | null; profile: string | null } | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  // Profile search and filter state - persisted across tab changes
  const [profileSearchTerm, setProfileSearchTerm] = useState("");
  const [profileFilterType, setProfileFilterType] = useState<string | null>(null);
  // Workspace state
  const [hasWorkspace, setHasWorkspace] = useState<boolean>(false);

  // Initialize localStorage values on component mount
  useEffect(() => {
    // Retrieve stored settings from localStorage
    getLocalStorageValue(LOCAL_STORAGE_KEYS.SHOW_MERGED_PROPERTIES, true);
    getLocalStorageValue(LOCAL_STORAGE_KEYS.VIEW_MODE, "tree");
    getLocalStorageValue(LOCAL_STORAGE_KEYS.PROPERTY_SORT_ORDER, "merged-last");
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
  }, [localizationState]);

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
        // Use a timeout to debounce rapid changes and prevent race conditions
        const timeoutId = setTimeout(() => {
          const changes = formatPendingChanges();
          vscodeApi.postMessage({
            command: "GET_MERGED_PROPERTIES",
            profilePath: selectedProfileKey,
            configPath: configPath,
            changes: changes,
          });
        }, 100); // 100ms debounce

        return () => clearTimeout(timeoutId);
      }
    }
  }, [selectedProfileKey, selectedTab, formatPendingChanges]);

  useEffect(() => {
    const isModalOpen = newProfileModalOpen || saveModalOpen || newLayerModalOpen || wizardModalOpen;
    document.body.classList.toggle("modal-open", isModalOpen);
  }, [newProfileModalOpen, saveModalOpen, newLayerModalOpen, wizardModalOpen]);

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
          vscodeApi.postMessage({
            command: "GET_MERGED_PROPERTIES",
            profilePath: currentSelectedProfileKey,
            configPath: configPath,
            changes: formatPendingChanges(),
          });
        }
      }
    }, 100);
  }, [selectedTab, selectedProfileKey, configurations, formatPendingChanges]);

  const handleChange = (key: string, value: string) => {
    const configPath = configurations[selectedTab!]!.configPath;
    const path = flattenedConfig[key]?.path ?? key.split(".");
    const profileKey = extractProfileKeyFromPath(path);

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

  // Helper function to get a profile's type
  const getProfileType = (profileKey: string): string | null => {
    if (selectedTab === null) return null;
    const configPath = configurations[selectedTab!]!.configPath;

    // Check pending changes first
    const pendingType = Object.entries(pendingChanges[configPath] ?? {}).find(([key, entry]) => {
      if (entry.profile !== profileKey) return false;
      const keyParts = key.split(".");
      return keyParts[keyParts.length - 1] === "type";
    });

    if (pendingType) {
      return pendingType[1].value as string;
    }

    // Check existing profiles
    const config = configurations[selectedTab!].properties;
    const flatProfiles = flattenProfiles(config.profiles);
    const profile = flatProfiles[profileKey];

    if (profile && profile.type) {
      return profile.type;
    }

    return null;
  };

  // Helper function to check if current profile is untyped
  const isCurrentProfileUntyped = (): boolean => {
    if (!selectedProfileKey) return false;
    const profileType = getProfileType(selectedProfileKey);
    return !profileType || profileType.trim() === "";
  };

  // Helper function to check if a profile is set as default
  const isProfileDefault = (profileKey: string): boolean => {
    if (selectedTab === null) return false;
    const configPath = configurations[selectedTab!]!.configPath;
    const profileType = getProfileType(profileKey);

    if (!profileType) return false;

    // Check pending defaults first
    const pendingDefault = pendingDefaults[configPath]?.[profileType];
    if (pendingDefault) {
      return pendingDefault.value === profileKey;
    }

    // Check existing defaults
    const config = configurations[selectedTab!].properties;
    const defaults = config.defaults || {};

    return defaults[profileType] === profileKey;
  };

  const handleSetAsDefault = (profileKey: string) => {
    const profileType = getProfileType(profileKey);
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

  const handleDeleteProfile = (profileKey: string) => {
    if (selectedTab === null) return;
    const configPath = configurations[selectedTab!]!.configPath;

    // Construct the full profile path
    let fullProfilePath: string;
    if (profileKey.includes(".")) {
      // Nested profile, construct the full path
      const profileParts = profileKey.split(".");
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
      fullProfilePath = `profiles.${profileKey}`;
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

    // Clear any pending changes for this profile
    setPendingChanges((prev) => {
      const newState = { ...prev };
      if (newState[configPath]) {
        // Remove all pending changes that belong to this profile
        Object.keys(newState[configPath]).forEach((key) => {
          const entry = newState[configPath][key];
          if (entry.profile === profileKey) {
            delete newState[configPath][key];
          }
        });
      }
      return newState;
    });

    // If this profile is currently selected, or if the selected profile is a child of this profile, select the nearest profile
    if (selectedProfileKey === profileKey || (selectedProfileKey && selectedProfileKey.startsWith(profileKey + "."))) {
      // Get the current list of available profiles to find the nearest one
      const profilesObj = configurations[selectedTab!]?.properties?.profiles;
      if (profilesObj) {
        const pendingProfiles = extractPendingProfiles(configPath);
        const deletedProfiles = deletions[configPath] || [];

        // Get profile keys in original order from the configuration
        const getOrderedProfileKeys = (profiles: any, parentKey = ""): string[] => {
          const keys: string[] = [];
          for (const key of Object.keys(profiles)) {
            const profile = profiles[key];
            const qualifiedKey = parentKey ? `${parentKey}.${key}` : key;

            // Add this profile key if it's not deleted
            if (!isProfileOrParentDeleted(qualifiedKey, deletedProfiles)) {
              keys.push(qualifiedKey);
            }

            // Recursively add nested profiles
            if (profile.profiles) {
              keys.push(...getOrderedProfileKeys(profile.profiles, qualifiedKey));
            }
          }
          return keys;
        };

        const orderedProfileKeys = getOrderedProfileKeys(profilesObj);
        const pendingProfileKeys = Object.keys(pendingProfiles).filter(
          (key) => !orderedProfileKeys.includes(key) && !isProfileOrParentDeleted(key, deletedProfiles)
        );
        const availableProfileKeys = [...orderedProfileKeys, ...pendingProfileKeys];

        // Find the nearest profile that's not being deleted
        let nearestProfileKey: string | null = null;

        // First, check if the deleted profile has a parent that should be selected
        if (profileKey.includes(".")) {
          // This is a nested profile, find its parent
          const profileParts = profileKey.split(".");
          const parentKey = profileParts.slice(0, -1).join(".");

          // Check if the parent exists and is not being deleted
          if (availableProfileKeys.includes(parentKey) && !isProfileOrParentDeleted(parentKey, deletedProfiles)) {
            nearestProfileKey = parentKey;
          }
        }

        // If no parent found or this is a top-level profile, find the nearest sibling/adjacent profile
        if (!nearestProfileKey) {
          // For top-level profiles, we want to find the nearest top-level profile
          // For nested profiles, we want to find the nearest profile at the same level or the next top-level
          const isTopLevel = !profileKey.includes(".");

          if (isTopLevel) {
            // For top-level profiles, find the nearest top-level profile
            // Get all top-level profiles from the original configuration (including deleted ones)
            const allTopLevelProfiles = Object.keys(profilesObj).filter((key) => !key.includes("."));
            const currentTopLevelIndex = allTopLevelProfiles.indexOf(profileKey);

            if (currentTopLevelIndex !== -1) {
              // Try to find the next top-level profile first
              for (let i = currentTopLevelIndex + 1; i < allTopLevelProfiles.length; i++) {
                const candidateProfile = allTopLevelProfiles[i];
                if (!isProfileOrParentDeleted(candidateProfile, deletedProfiles)) {
                  nearestProfileKey = candidateProfile;
                  break;
                }
              }

              // If no next top-level profile found, try to find the previous top-level profile
              if (!nearestProfileKey) {
                for (let i = currentTopLevelIndex - 1; i >= 0; i--) {
                  const candidateProfile = allTopLevelProfiles[i];
                  if (!isProfileOrParentDeleted(candidateProfile, deletedProfiles)) {
                    nearestProfileKey = candidateProfile;
                    break;
                  }
                }
              }
            }
          } else {
            // For nested profiles, find the nearest profile at the same level or the next top-level
            // Get all profiles from the original configuration (including deleted ones)
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

            const allProfileKeys = getAllProfileKeys(profilesObj);
            const currentIndex = allProfileKeys.indexOf(profileKey);

            if (currentIndex !== -1) {
              // Try to find the next profile first
              for (let i = currentIndex + 1; i < allProfileKeys.length; i++) {
                const candidateProfile = allProfileKeys[i];
                if (!isProfileOrParentDeleted(candidateProfile, deletedProfiles)) {
                  nearestProfileKey = candidateProfile;
                  break;
                }
              }

              // If no next profile found, try to find the previous profile
              if (!nearestProfileKey) {
                for (let i = currentIndex - 1; i >= 0; i--) {
                  const candidateProfile = allProfileKeys[i];
                  if (!isProfileOrParentDeleted(candidateProfile, deletedProfiles)) {
                    nearestProfileKey = candidateProfile;
                    break;
                  }
                }
              }
            }
          }
        }

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
          vscodeApi.postMessage({
            command: "GET_MERGED_PROPERTIES",
            profilePath: nearestProfileKey,
            configPath: configPath,
            changes: formatPendingChanges(),
          });
        } else {
          setMergedProperties(null);
        }
      } else {
        // Fallback to clearing selection if no profiles object available
        setSelectedProfileKey(null);
        if (configPath) {
          setSelectedProfilesByConfig((prev) => ({
            ...prev,
            [configPath]: null,
          }));
        }
        setMergedProperties(null);
      }
    }
  };

  const handleProfileSelection = (profileKey: string) => {
    if (profileKey === "") {
      // Deselect profile
      setSelectedProfileKey(null);
      setMergedProperties(null);
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

      vscodeApi.postMessage({
        command: "GET_MERGED_PROPERTIES",
        profilePath: profileKey,
        configPath: configPath,
        changes: formatPendingChanges(),
      });
    }
  };

  // Helper function to check if a property is in pending changes for a specific profile
  const isPropertyInPendingChanges = (propertyKey: string, profileKey: string, configPath: string): boolean => {
    return Object.entries(pendingChanges[configPath] ?? {}).some(([key, entry]) => {
      return entry.profile === profileKey && key.endsWith(`.properties.${propertyKey}`);
    });
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

        // Get merged properties for the restored profile
        vscodeApi.postMessage({
          command: "GET_MERGED_PROPERTIES",
          profilePath: previouslySelectedProfile,
          configPath: configPath,
          changes: formatPendingChanges(),
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

    Object.entries(pendingChanges[configPath] ?? {}).forEach(([key, entry]) => {
      if (entry.profile === currentProfileKey && (key === fullPath || key.startsWith(fullPath + "."))) {
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

    return { ...baseObj, ...pendingChangesAtLevel };
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
    const profileType = getProfileType(currentProfileName);
    const propertySchema = schemaValidations[configPath]?.propertySchema[profileType || ""] || {};
    const allowedProperties = Object.keys(propertySchema);
    const fullPath = path.join(".");

    Object.entries(mergedProps).forEach(([key, propData]: [string, any]) => {
      const pendingKey = `${fullPath}.properties.${key}`;
      const isInPendingChanges = pendingChanges[configPath]?.[pendingKey] !== undefined;
      const isInDeletions = (deletions[configPath] ?? []).includes(pendingKey);

      // If the property is in deletions, we should add the merged property to replace it
      // For secure properties that were deleted, we still want to show the merged property in properties
      if (allowedProperties.includes(key) && !isInPendingChanges && (isInDeletions || !combinedConfig.properties.hasOwnProperty(key))) {
        // Only add primitive values to avoid recursion
        if (typeof propData.value !== "object" || propData.value === null) {
          combinedConfig.properties[key] = propData.value;
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

  // Helper function to determine if a property is from merged properties
  const isPropertyFromMergedProps = (
    displayKey: string | undefined,
    path: string[],
    mergedProps: any,
    originalProperties: any,
    configPath: string
  ): boolean => {
    // Only consider properties as merged if showMergedProperties is true and profile is not untyped
    if (!showMergedProperties || isCurrentProfileUntyped()) {
      return false;
    }

    if (!displayKey) {
      return false;
    }

    const currentProfileKey = extractProfileKeyFromPath(path);
    const propertyExistsInPendingChanges = displayKey ? isPropertyInPendingChanges(displayKey, currentProfileKey, configPath) : false;

    const mergedPropData = mergedProps?.[displayKey];
    const jsonLoc = mergedPropData?.jsonLoc;
    const osLoc = mergedPropData?.osLoc;

    if (
      !mergedProps ||
      typeof mergedProps !== "object" ||
      path.length === 0 ||
      path[path.length - 1] !== "properties" ||
      !mergedProps.hasOwnProperty(displayKey) ||
      (originalProperties && originalProperties.hasOwnProperty(displayKey)) ||
      propertyExistsInPendingChanges ||
      !osLoc
    ) {
      return false;
    }

    const selectedConfigPath = configurations[selectedTab!]?.configPath;
    const osLocString = osLoc.join("");
    const pathsEqual = selectedConfigPath === osLocString;
    const currentProfilePathForComparison = path.slice(0, -1).join(".");
    const jsonLocIndicatesDifferentProfile = jsonLoc && !jsonLoc.includes(currentProfilePathForComparison + ".properties");

    return !pathsEqual || jsonLocIndicatesDifferentProfile;
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
      const sourceProfile = configurations[selectedTab!]?.properties?.profiles?.[profilePath];
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
      const typeKey = `profiles.${profileKey}.type`;
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
  const isPropertySecure = (fullKey: string, displayKey: string, path: string[], mergedProps?: any, originalProperties?: any): boolean => {
    const configPath = configurations[selectedTab!]?.configPath;
    if (!configPath) {
      return false;
    }

    // Check if this property is from merged properties
    const isFromMergedProps = isPropertyFromMergedProps(displayKey, path, mergedProps, originalProperties, configPath);

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
      const profile = configurations[selectedTab!]?.properties?.profiles?.[profileKey];
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
    const currentValue =
      pendingChanges[configPath]?.[fullKey]?.value ??
      configurations[selectedTab!]?.properties?.profiles?.[profileKey]?.properties?.[displayKey] ??
      "";

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
      const originalSecure =
        configurations[selectedTab!]?.properties?.profiles?.[profileKey]?.secure?.includes(keyParts[keyParts.length - 1]) || false;
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
        // Filter out "profiles" segments to get the actual profile name
        const filteredProfileParts = profileNameParts.filter((part) => part !== "profiles");
        const profileKey = filteredProfileParts.join(".");

        // Only create a pending profile entry if this is a profile-level property
        const propertyName = keyParts[keyParts.length - 1];
        const isProfileLevelProperty = propertyName === "type" || (keyParts.includes("properties") && !entry.secure);

        if (isProfileLevelProperty) {
          // Initialize the profile structure if it doesn't exist
          if (!pendingProfiles[profileKey]) {
            pendingProfiles[profileKey] = {};
          }

          // Add the property to the profile
          if (propertyName === "type") {
            pendingProfiles[profileKey].type = entry.value;
          } else if (keyParts.includes("properties")) {
            // Only add non-secure properties to the properties object
            if (!entry.secure) {
              if (!pendingProfiles[profileKey].properties) {
                pendingProfiles[profileKey].properties = {};
              }
              pendingProfiles[profileKey].properties[propertyName] = entry.value;
            }

            // If this is a secure property, add it to the secure array
            if (entry.secure) {
              if (!pendingProfiles[profileKey].secure) {
                pendingProfiles[profileKey].secure = [];
              }
              if (!pendingProfiles[profileKey].secure.includes(propertyName)) {
                pendingProfiles[profileKey].secure.push(propertyName);
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
    const profileParts = profileKey.split(".");

    // Check each level of the profile hierarchy
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

  const renderProfiles = (profilesObj: any) => {
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

        // Add this profile key if it's not deleted
        if (!isProfileOrParentDeleted(qualifiedKey, deletedProfiles)) {
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

    // Add pending profiles that aren't already in the ordered list
    const pendingProfileKeys = Object.keys(pendingProfiles).filter(
      (key) => !orderedProfileKeys.includes(key) && !isProfileOrParentDeleted(key, deletedProfiles)
    );

    const filteredProfileKeys = [...orderedProfileKeys, ...pendingProfileKeys];

    return (
      <ProfileList
        sortedProfileKeys={filteredProfileKeys}
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
        getProfileType={getProfileType}
        viewMode={viewMode}
        hasPendingSecureChanges={hasPendingSecureChanges}
        searchTerm={profileSearchTerm}
        filterType={profileFilterType}
        onSearchChange={setProfileSearchTerm}
        onFilterChange={setProfileFilterType}
      />
    );
  };

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
            new Set(filteredProfileKeys.map((key) => getProfileType(key)).filter((type): type is string => type !== null))
          );

          // If current filter type is not available, reset to null
          if (!availableTypes.includes(profileFilterType)) {
            setProfileFilterType(null);
          }
        }
      }
    }
  }, [selectedTab, configurations, profileFilterType, deletions, pendingChanges]);

  const renderProfileDetails = () => {
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
                    const profileType = getProfileType(selectedProfileKey);
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

            // Construct the profile path
            const profilePathParts = selectedProfileKey.split(".");
            let path;
            if (profilePathParts.length === 1) {
              // Top-level profile
              path = ["profiles", selectedProfileKey];
            } else {
              // Nested profile - need to construct path like ["profiles", "project_base", "profiles", "tso"]
              path = ["profiles"];
              for (let i = 0; i < profilePathParts.length; i++) {
                path.push(profilePathParts[i]);
                if (i < profilePathParts.length - 1) {
                  path.push("profiles");
                }
              }
            }

            // Pass the original profile object (without pending changes) to renderConfig
            // so that renderConfig can properly combine existing and pending changes
            // For newly created profiles, use the pending profile data as the base
            const originalProfile = flatProfiles[selectedProfileKey] || pendingProfiles[selectedProfileKey] || {};

            return (
              <div key={`${selectedProfileKey}-${propertySortOrder}-${sortOrderVersion}`}>
                {renderConfig(originalProfile, path, showMergedProperties ? mergedProperties : null)}
              </div>
            );
          })()}
      </div>
    );
  };

  const renderConfig = (obj: any, path: string[] = [], mergedProps?: any) => {
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

      sortedEntries = sortProperties(entriesForSorting, mergedProps, originalProperties, path);
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

      const isParent = typeof value === "object" && value !== null && !Array.isArray(value) && !isSecurePropertyForSorting;
      const isArray = Array.isArray(value);
      const pendingValue = (pendingChanges[configPath] ?? {})[fullKey]?.value ?? (isSecurePropertyForSorting ? "" : value);

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
        // Check if this property is from merged properties
        const isFromMergedProps = isPropertyFromMergedProps(displayKey, path, mergedProps, originalProperties, configPath);
        const mergedPropData = displayKey ? mergedProps?.[displayKey] : undefined;
        const jsonLoc = mergedPropData?.jsonLoc;
        const osLoc = mergedPropData?.osLoc;
        const secure = mergedPropData?.secure;
        const isSecureProperty = isFromMergedProps && jsonLoc && displayKey ? isMergedPropertySecure(displayKey, jsonLoc, osLoc, secure) : false;

        // Check if this is a local secure property (in the current profile's secure array)
        const isLocalSecureProperty =
          displayKey && path && configPath ? isPropertySecure(fullKey, displayKey, path, mergedProps, originalProperties) : false;

        // Check if this is a secure property that was added for sorting
        const isSecureForSorting = isSecurePropertyForSorting;

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
                const propertyType = displayKey ? getPropertyTypeForConfigEditor(displayKey, path) : undefined;

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
                const isSecure = isPropertySecure(fullKey, displayKey, path, mergedProps, originalProperties);
                const canBeSecure = canPropertyBeSecure(displayKey, path);
                return (
                  <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                    {canBeSecure &&
                      !isSecure &&
                      (secureValuesAllowed ? (
                        <button className="action-button" onClick={() => handleToggleSecure(fullKey, displayKey, path)} title="Make property secure">
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
                    // Extract logical profile path from jsonLoc (e.g., "profiles.lpar1.profiles.zosmf.profiles.w.properties.host" -> "lpar1.zosmf.w")
                    const jsonLocParts = jsonLoc.split(".");
                    const profilePathParts = jsonLocParts.slice(1, -2); // Remove "profiles" prefix and "properties" + property name suffix
                    const profilePath =
                      profilePathParts.filter((part: string, index: number) => part !== "profiles" || index % 2 === 0).join(".") || "unknown profile";

                    // Extract full normalized config path from osLoc
                    const fullConfigPath = osLoc?.[0] || "unknown config";

                    return `Inherited from: ${profilePath} (${fullConfigPath})`;
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
  };

  const renderDefaults = (defaults: { [key: string]: any }) => {
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
            const pendingValue = (pendingDefaults[configurations[selectedTab!]!.configPath] ?? {})[fullKey]?.value ?? value;

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
  };

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
      const profileTypeValue = getProfileType(profileKey);
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

    return [...profilesOfType, ...Array.from(pendingProfiles)];
  };

  const getPropertyTypeForAddProfile = (propertyKey: string): string | undefined => {
    if (selectedTab === null) return undefined;

    // Try to get the profile type from the current selected profile
    const currentProfileType = selectedProfileKey ? getProfileType(selectedProfileKey) : null;
    if (currentProfileType) {
      const propertySchema = schemaValidations[configurations[selectedTab].configPath]?.propertySchema[currentProfileType] || {};
      return propertySchema[propertyKey]?.type;
    }

    // Fallback: check all profile types for this property
    const configPath = configurations[selectedTab].configPath;
    const schemaValidation = schemaValidations[configPath];
    if (schemaValidation?.propertySchema) {
      for (const profileType in schemaValidation.propertySchema) {
        const propertySchema = schemaValidation.propertySchema[profileType];
        if (propertySchema[propertyKey]?.type) {
          return propertySchema[propertyKey].type;
        }
      }
    }

    return undefined;
  };

  // Get property type for the main config editor (similar to getPropertyTypeForAddProfile)
  const getPropertyTypeForConfigEditor = (propertyKey: string, profilePath: string[]): string | undefined => {
    if (selectedTab === null) return undefined;

    // Extract the profile key from the path
    const profileKey = extractProfileKeyFromPath(profilePath);

    // Get the profile type, which will include pending changes
    const resolvedType = getProfileType(profileKey);

    if (resolvedType) {
      const propertySchema = schemaValidations[configurations[selectedTab].configPath]?.propertySchema[resolvedType] || {};
      return propertySchema[propertyKey]?.type;
    }

    // Fallback: check all profile types for this property
    const configPath = configurations[selectedTab].configPath;
    const schemaValidation = schemaValidations[configPath];
    if (schemaValidation?.propertySchema) {
      for (const profileType in schemaValidation.propertySchema) {
        const propertySchema = schemaValidation.propertySchema[profileType];
        if (propertySchema[propertyKey]?.type) {
          return propertySchema[propertyKey].type;
        }
      }
    }

    return undefined;
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

  // Get options for input key for profile dropdown
  const fetchTypeOptions = (path: string[]) => {
    const { configPath } = configurations[selectedTab!]!;

    // Extract the profile key from the path
    const profileKey = extractProfileKeyFromPath(path);

    // Get the profile type, which will include pending changes
    const resolvedType = getProfileType(profileKey);

    // Get all available property schemas from all profile types
    const allPropertyKeys = new Set<string>();
    const propertySchema = schemaValidations[configPath]?.propertySchema || {};

    if (resolvedType && propertySchema[resolvedType]) {
      // If profile has a type, get properties from that type
      Object.keys(propertySchema[resolvedType]).forEach((key) => allPropertyKeys.add(key));
    } else {
      // If no type is selected, get properties from all available types
      Object.values(propertySchema).forEach((typeSchema: any) => {
        if (typeSchema && typeof typeSchema === "object") {
          Object.keys(typeSchema).forEach((key) => allPropertyKeys.add(key));
        }
      });
    }

    // Get existing properties for this profile (both from current profile and pending changes)
    const existingProperties = new Set<string>();

    // Get properties from the current profile
    const config = configurations[selectedTab!].properties;
    const flatProfiles = flattenProfiles(config.profiles);
    const currentProfile = flatProfiles[profileKey];
    if (currentProfile && currentProfile.properties) {
      Object.keys(currentProfile.properties).forEach((key) => existingProperties.add(key));
    }

    // Get secure properties from the current profile
    if (currentProfile && currentProfile.secure && Array.isArray(currentProfile.secure)) {
      currentProfile.secure.forEach((key: string) => existingProperties.add(key));
    }

    // Get properties from pending changes for this profile
    Object.entries(pendingChanges[configPath] ?? {}).forEach(([key, entry]) => {
      if (entry.profile === profileKey) {
        const keyParts = key.split(".");
        if (keyParts.includes("properties")) {
          const propertyName = keyParts[keyParts.length - 1];
          existingProperties.add(propertyName);
        }
        // Also check for secure properties in pending changes
        if (entry.secure) {
          const propertyName = keyParts[keyParts.length - 1];
          existingProperties.add(propertyName);
        }
      }
    });

    // Get deleted properties for this profile and remove them from existing properties
    const deletedProperties = new Set<string>();
    (deletions[configPath] ?? []).forEach((deletedKey) => {
      const keyParts = deletedKey.split(".");
      if (keyParts.includes("profiles")) {
        // Extract the profile from the deleted key
        const profileIndex = keyParts.indexOf("profiles");
        const deletedProfileKey = keyParts[profileIndex + 1];

        // Check if this deletion is for the current profile
        if (deletedProfileKey === profileKey) {
          const propertyName = keyParts[keyParts.length - 1];
          deletedProperties.add(propertyName);
        }
      }
    });

    // Remove deleted properties from existing properties (so they become available again)
    deletedProperties.forEach((deletedProperty) => {
      existingProperties.delete(deletedProperty);
    });

    // Filter out existing properties from the available options
    return Array.from(allPropertyKeys).filter((key) => !existingProperties.has(key));
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
        pendingChanges={pendingChanges}
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
        isOpen={newProfileModalOpen}
        newProfileKey={newProfileKey}
        newProfileValue={newProfileValue}
        showDropdown={showDropdown}
        typeOptions={newProfileKeyPath ? fetchTypeOptions(newProfileKeyPath) : []}
        isSecure={isSecure}
        secureValuesAllowed={secureValuesAllowed}
        getPropertyType={getPropertyTypeForAddProfile}
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
        }}
      />

      <SaveModal isOpen={saveModalOpen} />

      <NewLayerModal
        isOpen={newLayerModalOpen}
        newLayerName={newLayerName}
        onNewLayerNameChange={setNewLayerName}
        onAdd={handleAddNewLayer}
        onCancel={() => setNewLayerModalOpen(false)}
      />

      <ProfileWizardModal
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
        isOpen={addConfigModalOpen}
        configurations={configurations}
        hasWorkspace={hasWorkspace}
        onAdd={handleAddConfig}
        onCancel={handleCancelAddConfig}
      />
    </div>
  );
}
