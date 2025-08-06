import { useEffect, useState } from "react";
import * as l10n from "@vscode/l10n";
import { cloneDeep } from "es-toolkit";
import { isSecureOrigin } from "../utils";
import { schemaValidation } from "../../../utils/ConfigEditor";
import "./App.css";

// Components
import {
  Footer,
  Tabs,
  Panels,
  ProfileList,
  AddDefaultModal,
  AddProfileModal,
  SaveModal,
  EditModal,
  NewLayerModal,
  ProfileWizardModal,
  PreviewArgsModal,
  SaveConfirmationModal,
} from "./components";

// Hooks
import { useEnhancedDatalist } from "./hooks";

// Utils
import {
  flattenKeys,
  flattenProfiles,
  extractProfileKeyFromPath,
  sortConfigEntries,
  parseValueByType,
  stringifyValueByType,
  pathFromArray,
} from "./utils";
const vscodeApi = acquireVsCodeApi();

export function App() {
  const [localizationState] = useState(null);
  const [configurations, setConfigurations] = useState<{ configPath: string; properties: any; secure: string[] }[]>([]);
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
  const [newKeyModalOpen, setNewKeyModalOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [selectedProfileType, setSelectedProfileType] = useState<string | null>(null);
  const [newProfileKeyPath, setNewProfileKeyPath] = useState<string[] | null>(null);
  const [newProfileKey, setNewProfileKey] = useState("");
  const [newProfileValue, setNewProfileValue] = useState("");
  const [newProfileModalOpen, setNewProfileModalOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [originalDefaults, setOriginalDefaults] = useState<{ [key: string]: any }>({});
  const [newLayerModalOpen, setNewLayerModalOpen] = useState(false);
  const [newLayerName, setNewLayerName] = useState("");
  const [newLayerPath, setNewLayerPath] = useState<string[] | null>(null);
  const [isSecure, setIsSecure] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingKey, setEditingKey] = useState("");
  const [editingValue, setEditingValue] = useState("");
  const [hiddenItems, setHiddenItems] = useState<{
    [configPath: string]: {
      [key: string]: { path: string };
    };
  }>({});
  const [showDropdown, setShowDropdown] = useState(false);
  const [schemaValidations, setSchemaValidations] = useState<{ [configPath: string]: schemaValidation | undefined }>({});
  const [selectedProfileKey, setSelectedProfileKey] = useState<string | null>(null);
  // Profile Wizard state
  const [wizardModalOpen, setWizardModalOpen] = useState(false);
  const [wizardRootProfile, setWizardRootProfile] = useState("root");
  const [wizardSelectedType, setWizardSelectedType] = useState("");
  const [wizardProfileName, setWizardProfileName] = useState("");
  const [wizardProperties, setWizardProperties] = useState<{ key: string; value: string | boolean | number | Object; secure?: boolean }[]>([]);
  const [wizardShowKeyDropdown, setWizardShowKeyDropdown] = useState(false);
  const [wizardNewPropertyKey, setWizardNewPropertyKey] = useState("");
  const [wizardNewPropertyValue, setWizardNewPropertyValue] = useState("");
  const [wizardNewPropertySecure, setWizardNewPropertySecure] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState<string | null>(null);
  // Preview Args Modal state
  const [previewArgsModalOpen, setPreviewArgsModalOpen] = useState(false);
  const [previewArgsData, setPreviewArgsData] = useState<any[]>([]);

  // Merged Properties state
  const [mergedProperties, setMergedProperties] = useState<any>(null);
  const [showMergedProperties, setShowMergedProperties] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [pendingSaveSelection, setPendingSaveSelection] = useState<{ tab: number | null; profile: string | null } | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  // Invoked on webview load
  useEffect(() => {
    window.addEventListener("message", (event) => {
      if (!isSecureOrigin(event.origin)) {
        return;
      }
      if (event.data.command === "CONFIGURATIONS") {
        const { contents } = event.data;
        setConfigurations(contents);
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

        if (contents.length > 0) {
          const indexToUse = (prev: number | null) => (prev !== null && prev < contents.length ? prev : 0);
          const config = contents[indexToUse(selectedTab ?? 0)].properties;
          setFlattenedConfig(flattenKeys(config.profiles));
          setFlattenedDefaults(flattenKeys(config.defaults));
          setOriginalDefaults(flattenKeys(config.defaults));
        }
      } else if (event.data.command === "DISABLE_OVERLAY") {
        setSaveModalOpen(false);
      } else if (event.data.command === "PREVIEW_ARGS") {
        setPreviewArgsData(event.data.mergedArgs || []);
        setPreviewArgsModalOpen(true);
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
              };
            }
          });
        }
        setMergedProperties(mergedPropsData);
      }
    });

    vscodeApi.postMessage({ command: "GET_PROFILES" });
    vscodeApi.postMessage({ command: "GET_ENV_INFORMATION" });
  }, [localizationState]);

  // Invoked when swapping tabs
  useEffect(() => {
    if (selectedTab !== null && configurations[selectedTab]) {
      const config = configurations[selectedTab].properties;
      setFlattenedConfig(flattenKeys(config.profiles));
      setFlattenedDefaults(flattenKeys(config.defaults));
      setOriginalDefaults(flattenKeys(config.defaults));
      // Clear merged properties when tab changes (but not when saving or navigating)
      if (!isSaving && !isNavigating) {
        setMergedProperties(null);
        setSelectedProfileKey(null);
      }
    }
  }, [selectedTab, configurations, isSaving]);

  // Refresh merged properties when pending changes change
  useEffect(() => {
    if (selectedProfileKey) {
      const configPath = configurations[selectedTab!]?.configPath;
      if (configPath) {
        // Use a timeout to debounce rapid changes and prevent race conditions
        const timeoutId = setTimeout(() => {
          vscodeApi.postMessage({
            command: "GET_MERGED_PROPERTIES",
            profilePath: selectedProfileKey,
            configPath: configPath,
            changes: formatPendingChanges(),
          });
        }, 100); // 100ms debounce

        return () => clearTimeout(timeoutId);
      }
    }
  }, [pendingChanges, pendingDefaults, deletions, defaultsDeletions, selectedProfileKey, selectedTab, configurations]);

  useEffect(() => {
    const isModalOpen =
      newKeyModalOpen || newProfileModalOpen || saveModalOpen || newLayerModalOpen || editModalOpen || wizardModalOpen || previewArgsModalOpen;
    document.body.classList.toggle("modal-open", isModalOpen);
  }, [newKeyModalOpen, newProfileModalOpen, saveModalOpen, newLayerModalOpen, editModalOpen, wizardModalOpen, previewArgsModalOpen]);

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

  // Debug useEffect to track selectedProfileKey changes
  useEffect(() => {
    console.log(`selectedProfileKey changed to: ${selectedProfileKey}`);
  }, [selectedProfileKey]);

  const handleChange = (key: string, value: string) => {
    const configPath = configurations[selectedTab!]!.configPath;
    const path = flattenedConfig[key]?.path ?? key.split(".");
    const profileKey = extractProfileKeyFromPath(path);

    // When a user changes a property, it should become a local property (not merged)
    // This ensures that overwritten merged properties become editable
    setPendingChanges((prev) => ({
      ...prev,
      [configPath]: {
        ...prev[configPath],
        [key]: { value, path, profile: profileKey },
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

  const handleAddNewDefault = () => {
    if (newKey.trim() && newValue.trim()) {
      const configPath = configurations[selectedTab!]!.configPath;
      const path = newKey.split(".");
      const fullKey = path.join(".");

      setPendingDefaults((prev) => ({
        ...prev,
        [configPath]: {
          ...prev[configPath],
          [fullKey]: { value: newValue, path },
        },
      }));

      setDefaultsDeletions((prev) => ({
        ...prev,
        [configPath]: prev[configPath]?.filter((k) => k !== fullKey) ?? [],
      }));
    }

    setNewKey("");
    setNewValue("");
    setNewKeyModalOpen(false);
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
      return {
        ...prev,
        [configPath]: [...(prev[configPath] ?? []), fullKey],
      };
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
    console.log(`handleNavigateToSource called with jsonLoc: ${jsonLoc}, osLoc: ${osLoc}`);
    console.log(`Current selectedProfileKey before navigation: ${selectedProfileKey}`);

    // Parse the jsonLoc to extract the source configuration and profile
    // jsonLoc format: "profiles.ssh.port" or "profiles.ssh.profiles.parent.port"
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
          const parentProfile = parts[i]; // e.g., "zosmf"
          let nestedProfilePath = [parentProfile];
          let pathIndex = i + 2; // Start after the first "profiles"

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
        console.log(`Extracted sourceProfile: ${sourceProfile}`);
        console.log(`Extracted sourceProfilePath: ${sourceProfilePath}`);

        // Find the configuration that contains this profile
        let sourceConfigIndex = -1;

        // If osLoc is provided and indicates a different config, use it to find the correct config
        if (osLoc && osLoc.length > 0) {
          const osLocString = osLoc.join("");
          sourceConfigIndex = configurations.findIndex((config) => {
            return config.configPath === osLocString;
          });
          console.log(`Using osLoc to find config: ${osLocString}, found index: ${sourceConfigIndex}`);
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

        console.log(`Found sourceConfigIndex: ${sourceConfigIndex}`);
        if (sourceConfigIndex !== -1) {
          console.log(`Navigating to config index: ${sourceConfigIndex}, profile: ${sourceProfile}`);

          // Set navigation flag to prevent useEffect from clearing selectedProfileKey
          setIsNavigating(true);

          // Navigate to the source configuration and profile within the config editor
          setSelectedTab(sourceConfigIndex);

          // Use a timeout to set the profile after the tab change has been processed
          // This prevents the useEffect from clearing the selectedProfileKey immediately
          setTimeout(() => {
            setSelectedProfileKey(sourceProfile);

            // Clear navigation flag after setting the profile
            setTimeout(() => {
              setIsNavigating(false);
            }, 100);
          }, 0);

          console.log(`SelectedProfileKey after navigation: ${sourceProfile}`);

          // List all profiles in the selected configuration
          const selectedConfig = configurations[sourceConfigIndex];
          if (selectedConfig && selectedConfig.properties && selectedConfig.properties.profiles) {
            const flatProfiles = flattenProfiles(selectedConfig.properties.profiles);
            const profileNames = Object.keys(flatProfiles);
            console.log(`Available profiles in selected config (${selectedConfig.configPath}):`, profileNames);
            console.log(`Target profile '${sourceProfile}' exists in list:`, profileNames.includes(sourceProfile));
          } else {
            console.log(`No profiles found in selected config at index ${sourceConfigIndex}`);
          }
        } else {
          console.log(`No matching configuration found for profile: ${sourceProfile}`);
        }
      } else {
        console.log(`No sourceProfile extracted from jsonLoc: ${jsonLoc}`);
      }
    }
  };

  const handleDeleteDefaultsProperty = (key: string) => {
    if (selectedTab === null) return;
    const configPath = configurations[selectedTab!]!.configPath;

    setPendingDefaults((prev) => {
      const newState = { ...prev };
      if (newState[configPath]) {
        delete newState[configPath][key];
      }
      return newState;
    });

    if (Object.prototype.hasOwnProperty.call(originalDefaults, key)) {
      setDefaultsDeletions((prev) => ({
        ...prev,
        [configPath]: [...(prev[configPath] ?? []), key],
      }));
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
      // Could show an error message here
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

    // Add to deletions - we'll add all profile-related keys to deletions
    setDeletions((prev) => {
      const newDeletions = { ...prev };
      if (!newDeletions[configPath]) {
        newDeletions[configPath] = [];
      }

      // Construct the full profile path
      let fullProfilePath: string;
      if (profileKey.includes(".")) {
        // Nested profile - construct the full path
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

    // If this profile is currently selected, or if the selected profile is a child of this profile, clear the selection
    if (selectedProfileKey === profileKey || (selectedProfileKey && selectedProfileKey.startsWith(profileKey + "."))) {
      setSelectedProfileKey(null);
    }
  };

  const handleSave = () => {
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
  };

  const hasUnsavedChanges = (): boolean => {
    const hasPendingChanges = Object.keys(pendingChanges).length > 0;
    const hasDeletions = Object.keys(deletions).length > 0;
    const hasPendingDefaults = Object.keys(pendingDefaults).length > 0;
    const hasDefaultsDeletions = Object.keys(defaultsDeletions).length > 0;

    return hasPendingChanges || hasDeletions || hasPendingDefaults || hasDefaultsDeletions;
  };

  const handleProfileSelection = (profileKey: string) => {
    if (profileKey === "") {
      // Deselect profile
      setSelectedProfileKey(null);
      setMergedProperties(null);
      return;
    }

    setSelectedProfileKey(profileKey);

    // Get merged properties for the selected profile
    const configPath = configurations[selectedTab!]?.configPath;
    if (configPath) {
      vscodeApi.postMessage({
        command: "GET_MERGED_PROPERTIES",
        profilePath: profileKey,
        configPath: configPath,
        changes: formatPendingChanges(),
      });
    }
  };

  const handleProfileDeselection = () => {
    setSelectedProfileKey(null);
    setMergedProperties(null);
  };

  const formatPendingChanges = () => {
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

    return {
      changes,
      deletions: deleteKeys,
      defaultsChanges,
      defaultsDeleteKeys: defaultsDeleteKeys,
    };
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

  const handleTabChange = (index: number) => {
    setSelectedTab(index);
  };

  const renderProfiles = (profilesObj: any) => {
    if (!profilesObj || typeof profilesObj !== "object") return null;

    const flatProfiles = flattenProfiles(profilesObj);

    // Get pending profiles from pendingChanges
    const configPath = configurations[selectedTab!]!.configPath;
    const pendingProfiles: { [key: string]: any } = {};

    Object.entries(pendingChanges[configPath] ?? {}).forEach(([key, entry]) => {
      if (entry.profile) {
        // Extract the profile path from the key
        const keyParts = key.split(".");
        if (keyParts[0] === "profiles") {
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
            // (i.e., the property is "type" or we're adding to "properties")
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
        }
      }
    });

    // Combine existing and pending profiles for the profile list
    const allProfiles = { ...flatProfiles, ...pendingProfiles };

    // Filter out deleted profiles and their children
    const deletedProfiles = deletions[configurations[selectedTab!]!.configPath] || [];
    const filteredProfileKeys = Object.keys(allProfiles).filter((profileKey) => {
      // Check if this profile or any of its parent profiles are deleted
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
          return false;
        }
      }

      return true;
    });

    // Sort profile keys alphabetically
    const sortedProfileKeys = filteredProfileKeys.sort((a, b) => a.localeCompare(b));

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
        getProfileType={getProfileType}
      />
    );
  };

  const renderProfileDetails = () => {
    return (
      <div>
        <div className="profile-heading-container">
          <h2>{selectedProfileKey || "Profile Details"}</h2>
          {selectedProfileKey && (
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="action-button"
                onClick={() => {
                  // Rename functionality (WIP)
                }}
                title="Rename profile"
                style={{
                  padding: "4px",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "transparent",
                }}
              >
                <span className="codicon codicon-edit"></span>
              </button>
              <button
                className="action-button"
                onClick={() => handleSetAsDefault(selectedProfileKey)}
                title={isProfileDefault(selectedProfileKey) ? "Currently default" : "Set as default"}
                style={{
                  padding: "4px",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "transparent",
                }}
              >
                <span className={`codicon codicon-${isProfileDefault(selectedProfileKey) ? "star-full" : "star-empty"}`}></span>
              </button>
              <button
                className="action-button"
                onClick={() => setShowMergedProperties(!showMergedProperties)}
                title={showMergedProperties ? "Hide merged properties" : "Show merged properties"}
                style={{
                  padding: "4px",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "transparent",
                }}
              >
                <span className={`codicon codicon-${showMergedProperties ? "eye-closed" : "eye"}`}></span>
              </button>
              <button
                className="action-button"
                onClick={() => handleDeleteProfile(selectedProfileKey)}
                title="Delete profile"
                style={{
                  padding: "4px",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "transparent",
                }}
              >
                <span className="codicon codicon-trash"></span>
              </button>
            </div>
          )}
        </div>
        {selectedProfileKey &&
          (() => {
            const flatProfiles = flattenProfiles(configurations[selectedTab!]!.properties.profiles);
            const pendingProfiles: { [key: string]: any } = {};

            // Get pending profiles from pendingChanges
            const configPath = configurations[selectedTab!]!.configPath;

            Object.entries(pendingChanges[configPath] ?? {}).forEach(([key, entry]) => {
              if (entry.profile) {
                // Extract the profile path from the key
                const keyParts = key.split(".");
                if (keyParts[0] === "profiles") {
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
                    // (i.e., the property is "type" or we're adding to "properties")
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
                }
              }
            });

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

            return renderConfig(originalProfile, path, showMergedProperties ? mergedProperties : null);
          })()}
      </div>
    );
  };

  const renderConfig = (obj: any, path: string[] = [], mergedProps?: any) => {
    const fullPath = path.join(".");
    const baseObj = cloneDeep(obj);
    const configPath = configurations[selectedTab!]!.configPath;

    // Prepare a copy of baseObj for this level
    let combinedConfig = { ...baseObj };

    // Create a map of pending changes that should be applied at this level
    const pendingChangesAtLevel: { [key: string]: any } = {};

    // Determine the current profile being rendered from the path
    const currentProfileKey = extractProfileKeyFromPath(path);
    Object.entries(pendingChanges[configPath] ?? {}).forEach(([key, entry]) => {
      // Only apply pending changes that belong to the current profile being rendered
      if (entry.profile === currentProfileKey && (key === fullPath || key.startsWith(fullPath + "."))) {
        const keyParts = key.split(".");
        const relativePath = keyParts.slice(path.length);

        // Handle root-level profile properties (like "type") and direct properties
        if (relativePath.length === 1) {
          if (!entry.secure) {
            pendingChangesAtLevel[relativePath[0]] = entry.value;
          }
        } else if (relativePath.length > 1 && relativePath[0] !== "profiles") {
          // For nested properties, only add non-secure properties
          if (!entry.secure) {
            let current = combinedConfig;
            for (let i = 0; i < relativePath.length - 1; i++) {
              if (!current[relativePath[i]]) {
                current[relativePath[i]] = {};
              }
              current = current[relativePath[i]];
            }
            current[relativePath[relativePath.length - 1]] = entry.value;
          }
        }
        // If relativePath[0] === "profiles", skip for this level
      }
    });

    // Combine base object with pending changes at this level
    combinedConfig = {
      ...combinedConfig,
      ...pendingChangesAtLevel,
    };

    // Track which properties were originally in the base object
    const originalProperties = baseObj.properties || {};

    // Add merged properties to the properties section when we're at the profile level
    if (
      mergedProps &&
      path.length > 0 &&
      path[path.length - 1] !== "type" &&
      path[path.length - 1] !== "properties" &&
      path[path.length - 1] !== "secure"
    ) {
      // We're at the profile level, add merged properties to the properties object
      if (!combinedConfig.hasOwnProperty("properties")) {
        combinedConfig.properties = {};
      }

      // Get the current profile type to filter merged properties (same logic as fetchTypeOptions)
      const currentProfileName = extractProfileKeyFromPath(path);
      const profileType = getProfileType(currentProfileName);

      // Get the schema for this profile type (same logic as fetchTypeOptions)
      const configPath = configurations[selectedTab!]!.configPath;
      const propertySchema = schemaValidations[configPath]?.propertySchema[profileType || ""] || {};
      const allowedProperties = Object.keys(propertySchema);

      Object.entries(mergedProps).forEach(([key, propData]: [string, any]) => {
        // Only add merged properties that are in the schema for this profile type
        // This matches what would appear in the "new key" dropdown
        // Check if this property is already in pending changes for this specific profile
        const pendingKey = `${fullPath}.properties.${key}`;
        const isInPendingChanges = pendingChanges[configPath]?.[pendingKey] !== undefined;

        if (!combinedConfig.properties.hasOwnProperty(key) && allowedProperties.includes(key) && !isInPendingChanges) {
          combinedConfig.properties[key] = propData.value;
        }
      });
    }

    // Ensure properties key exists with empty object value if not present
    // Only add properties key at the profile level (when path ends with profile name)

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

    // Sort properties according to the specified order
    const sortedEntries = sortConfigEntries(Object.entries(combinedConfig));

    return sortedEntries.map(([key, value]) => {
      const currentPath = [...path, key];
      const fullKey = currentPath.join(".");
      const displayKey = key.split(".").pop();
      if ((deletions[configPath] ?? []).includes(fullKey)) return null;

      // Skip rendering properties that are in the secure array to avoid duplication
      if (key === "properties" && combinedConfig.secure && Array.isArray(combinedConfig.secure)) {
        const secureProperties = combinedConfig.secure;
        const filteredProperties = { ...value };

        // Remove properties that are in the secure array
        Object.keys(filteredProperties).forEach((propKey) => {
          if (secureProperties.includes(propKey)) {
            delete filteredProperties[propKey];
          }
        });

        // If all properties were secure, don't render the properties section
        if (Object.keys(filteredProperties).length === 0) {
          return null;
        }

        // Update the value to only include non-secure properties
        value = filteredProperties;
      }

      const isParent = typeof value === "object" && value !== null && !Array.isArray(value);
      const isArray = Array.isArray(value);
      const pendingValue = (pendingChanges[configPath] ?? {})[fullKey]?.value ?? value;
      // --- Fix: Merge pending secure properties when rendering a 'secure' array ---
      let renderValue: any[] = Array.isArray(value) ? value : [];
      if (isArray && key === "secure") {
        // Find all pending secure properties for this exact secure array path and profile
        const pendingSecureProps: string[] = Object.entries(pendingChanges[configPath] ?? {})
          .filter(([, entry]) => {
            if (!entry.secure) return false;

            // Check if this secure property belongs to the current profile context
            // The path should match the current secure array path
            const expectedSecurePath = pathFromArray(path.concat(["secure"]));
            const actualPath = currentPath.join(".");

            // Extract the profile name from the current path
            // The path structure is ["profiles", "profile_name", "profiles", "nested_profile", ...]
            let currentProfileName: string;
            if (path.length >= 2 && path[0] === "profiles") {
              // Find all profile name segments by filtering out "profiles" and "secure"
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
        if (pendingSecureProps.length > 0) {
          renderValue = Array.from(new Set([...baseArray, ...pendingSecureProps]));
        } else {
          renderValue = baseArray;
        }
      }
      if (isParent) {
        return (
          <div key={fullKey} className="config-item parent">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 className={`header-level-${path.length > 3 ? 3 : path.length}`}>
                {displayKey?.toLocaleLowerCase() === "properties" ? "Profile Properties" : displayKey}
              </h3>
              <button
                className="header-button"
                title={`Add key inside \"${fullKey}\"`}
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
          return (
            <div key={fullKey} className="config-item">
              <div style={{ paddingLeft: "16px" }}>
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
        // Check if this property is from merged properties (not currently being rendered)
        const configPath = configurations[selectedTab!]!.configPath;
        const currentProfileKey = extractProfileKeyFromPath(path);
        const propertyExistsInPendingChanges = displayKey ? isPropertyInPendingChanges(displayKey, currentProfileKey, configPath) : false;

        // Get the current profile path to compare with jsonLoc
        const currentProfilePath = path.slice(0, -1).join("."); // Remove "properties" from the end
        const mergedPropData =
          mergedProps && typeof mergedProps === "object" && mergedProps[displayKey as keyof typeof mergedProps]
            ? mergedProps[displayKey as keyof typeof mergedProps]
            : undefined;
        const jsonLoc = mergedPropData?.jsonLoc;
        const osLoc = mergedPropData?.osLoc;

        // A property should be read-only if:
        // 1. It exists in mergedProps
        // 2. It doesn't exist in original properties
        // 3. It doesn't exist in pending changes (use current state, not stale closure)
        // 4. The osLoc indicates it comes from a different config file OR jsonLoc indicates it comes from a different profile
        const selectedConfigPath = configurations[selectedTab!]?.configPath;
        const osLocString = osLoc ? osLoc.join("") : "";
        const pathsEqual = selectedConfigPath === osLocString;
        const currentProfilePathForComparison = path.slice(0, -1).join("."); // Remove "properties" from the end
        const jsonLocIndicatesDifferentProfile = jsonLoc && !jsonLoc.includes(currentProfilePathForComparison + ".properties");

        const isFromMergedProps =
          mergedProps &&
          typeof mergedProps === "object" &&
          path.length > 0 &&
          path[path.length - 1] === "properties" &&
          mergedProps.hasOwnProperty(displayKey) &&
          !(originalProperties && originalProperties.hasOwnProperty(displayKey)) &&
          !propertyExistsInPendingChanges && // This now uses current state
          osLoc &&
          (!pathsEqual || jsonLocIndicatesDifferentProfile); // Read-only if config OR profile doesn't match

        // Check if this merged property is secure by checking if it's in the secure array of the source profile
        const isSecureProperty =
          isFromMergedProps && jsonLoc
            ? (() => {
                // Extract the source profile path from jsonLoc
                // jsonLoc format: "profiles.zosmf.profiles.a.properties.port"
                const jsonLocParts = jsonLoc.split(".");
                if (jsonLocParts.length >= 4 && jsonLocParts[0] === "profiles") {
                  // Find the profile path by looking for the profile structure
                  let profilePath = "";
                  for (let i = 1; i < jsonLocParts.length - 2; i++) {
                    if (jsonLocParts[i + 1] === "profiles") {
                      // This is a nested profile structure
                      const parentProfile = jsonLocParts[i];
                      let nestedProfilePath = [parentProfile];
                      let pathIndex = i + 2;

                      // Continue building the nested profile path until we hit a non-profile part
                      while (pathIndex < jsonLocParts.length - 2 && jsonLocParts[pathIndex + 1] === "profiles") {
                        nestedProfilePath.push(jsonLocParts[pathIndex]);
                        pathIndex += 2;
                      }

                      // Add the final profile name if we haven't reached the end
                      if (pathIndex < jsonLocParts.length - 2) {
                        nestedProfilePath.push(jsonLocParts[pathIndex]);
                      }

                      profilePath = nestedProfilePath.join(".");
                      break;
                    } else if (i === 1) {
                      // Simple profile case
                      profilePath = jsonLocParts[i];
                      break;
                    }
                  }

                  // Check if the property is in the secure array of the source profile
                  if (profilePath) {
                    const sourceProfile = configurations[selectedTab!]?.properties?.profiles?.[profilePath];
                    if (sourceProfile?.secure && Array.isArray(sourceProfile.secure)) {
                      return sourceProfile.secure.includes(displayKey);
                    }
                  }
                }
                return false;
              })()
            : false;

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
                }}
              >
                <option value="">{l10n.t("Select a type")}</option>
                {getWizardTypeOptions().map((type) => (
                  <option key={type} value={type}>
                    {type.toLowerCase()}
                  </option>
                ))}
              </select>
            ) : typeof pendingValue === "string" || typeof pendingValue === "boolean" || typeof pendingValue === "number" ? (
              <input
                className="config-input"
                type={isSecureProperty ? "password" : "text"}
                placeholder={isSecureProperty ? "••••••••" : ""}
                value={
                  isSecureProperty && isFromMergedProps
                    ? "••••••••"
                    : isFromMergedProps
                    ? String(mergedPropData?.value || pendingValue)
                    : String(pendingValue)
                }
                onChange={(e) => handleChange(fullKey, (e.target as HTMLTextAreaElement).value)}
                disabled={isFromMergedProps}
                style={
                  isFromMergedProps
                    ? {
                        backgroundColor: "var(--vscode-input-disabledBackground)",
                        color: "var(--vscode-disabledForeground)",
                        cursor: "pointer",
                        fontFamily: isSecureProperty ? "monospace" : "inherit",
                      }
                    : {}
                }
              />
            ) : (
              <span>{"{...}"}</span>
            )}
            {displayKey !== "type" && !isFromMergedProps && (
              <button className="action-button" onClick={() => handleDeleteProperty(fullKey)}>
                <span className="codicon codicon-trash"></span>
              </button>
            )}
            {displayKey !== "type" && isFromMergedProps && (
              <button
                className="action-button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleUnlinkMergedProperty(displayKey, fullKey);
                }}
                title="Unlink merged property"
              >
                <span className="codicon codicon-remove"></span>
              </button>
            )}
          </div>
        );

        return (
          <div key={fullKey} className="config-item">
            {isFromMergedProps && jsonLoc ? (
              <div
                onClick={() => handleNavigateToSource(jsonLoc, osLoc)}
                title={`Click to navigate to source: ${jsonLoc}`}
                style={{ cursor: "pointer" }}
              >
                {readOnlyContainer}
              </div>
            ) : (
              readOnlyContainer
            )}
          </div>
        );
      }
    });
  };

  const renderDefaults = (defaults: { [key: string]: any }) => {
    if (!defaults || typeof defaults !== "object") return null;

    const combinedDefaults = {
      ...defaults,
      ...Object.fromEntries(
        Object.entries(pendingDefaults[configurations[selectedTab!]!.configPath] ?? {})
          .filter(([key]) => !(key in defaults))
          .map(([key, entry]) => [key, entry.value])
      ),
    };

    return (
      <div>
        {/* Render defaults */}
        {Object.entries(combinedDefaults).map(([key, value]) => {
          const currentPath = [key];
          const fullKey = currentPath.join(".");
          if (defaultsDeletions[configurations[selectedTab!]!.configPath]?.includes(fullKey)) return null;
          const isParent = typeof value === "object" && value !== null && !Array.isArray(value);
          const isArray = Array.isArray(value);
          const pendingValue = (pendingDefaults[configurations[selectedTab!]!.configPath] ?? {})[fullKey]?.value ?? value;

          if (isParent) {
            return (
              <div key={fullKey} className="config-item parent">
                <h3 className={`header-level-${currentPath.length}`}>
                  {key}
                  <button
                    className="add-default-button"
                    title={`Add key inside "${fullKey}"`}
                    onClick={() => {
                      setNewKeyModalOpen(true);
                      setNewKey(key + ".");
                    }}
                    style={{ marginLeft: 8 }}
                  >
                    <span className="codicon codicon-add"></span>
                  </button>
                </h3>
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
                  <button
                    className="add-default-button"
                    title={`Add item to "${fullKey}"`}
                    onClick={() => {
                      setNewKeyModalOpen(true);
                      setNewKey(key);
                    }}
                    style={{ marginLeft: 8 }}
                  >
                    <span className="codicon codicon-add"></span>
                  </button>
                </h3>
                <div>
                  {value.map((item: any, index: number) => (
                    <div className="list-item" key={index}>
                      {item}
                      <button className="action-button" style={{ marginLeft: "8px" }} onClick={() => handleDeleteDefaultsProperty(fullKey)}>
                        <span className="codicon codicon-trash"></span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          } else {
            return (
              <div key={fullKey} className="config-item">
                <div className="config-item-container">
                  <span className="config-label">{key}</span>
                  <select
                    className="config-input"
                    value={String(pendingValue)}
                    onChange={(e) => handleDefaultsChange(fullKey, (e.target as HTMLSelectElement).value)}
                    style={{
                      width: "100%",
                      height: "28px",
                      fontSize: "0.9em",
                      padding: "2px 6px",
                      marginBottom: "0",
                    }}
                  >
                    <option value="">{l10n.t("Select a profile")}</option>
                    {getAvailableProfilesByType(key).map((profile) => (
                      <option key={profile} value={profile}>
                        {profile === "root" ? "/" : profile}
                      </option>
                    ))}
                  </select>
                  <button className="action-button" onClick={() => handleDeleteDefaultsProperty(fullKey)}>
                    <span className="codicon codicon-trash"></span>
                  </button>
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

  const handleSaveEdit = () => {
    setEditModalOpen(false);
    setPendingChanges((prev) => {
      const configPath = configurations[selectedTab!]!.configPath;
      const updatedKey = editingKey.replace("secure", "properties");
      // For nested profiles, we need to extract the actual profile name from the path
      const pathParts = updatedKey.split(".");
      let profileKey;
      if (pathParts[0] === "profiles" && pathParts.length > 2) {
        // Check if this is a nested profile
        const profilesIndices = [];
        for (let i = 0; i < pathParts.length; i++) {
          if (pathParts[i] === "profiles") {
            profilesIndices.push(i);
          }
        }
        if (profilesIndices.length > 1) {
          // This is a nested profile - construct the full profile key
          const profileParts = [];
          for (let i = 1; i < pathParts.length; i++) {
            if (pathParts[i] !== "profiles") {
              profileParts.push(pathParts[i]);
            }
          }
          profileKey = profileParts.join(".");
        } else {
          // Top-level profile
          profileKey = pathParts[1];
        }
      } else {
        profileKey = pathParts[0];
      }

      const value = editingValue;
      // Create a new object with the updated value
      const newPendingChanges = {
        ...prev,
        [configPath]: {
          ...prev[configPath],
          [updatedKey]: {
            value,
            profile: profileKey,
            path: updatedKey.split(".").slice(-1),
            configPath,
            secure: true,
          },
        },
      };

      // Ensure that only one entry for the secure credential exists
      // by deleting any existing secure entry that matches the updatedKey
      for (const key in newPendingChanges[configPath]) {
        if (key.includes("secure") && newPendingChanges[configPath][key].path.join(".") === updatedKey) {
          delete newPendingChanges[configPath][key];
        }
      }

      return newPendingChanges;
    });
    setDeletions((prev) => {
      const configPath = configurations[selectedTab!]!.configPath;
      return {
        ...prev,
        [configPath]: (prev[configPath] ?? []).filter((key) => key !== editingKey),
      };
    });
    setEditingKey("");
    setNewProfileValue("");
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

  const typeOptions = selectedTab !== null ? schemaValidations[configurations[selectedTab].configPath]?.validDefaults || [] : [];

  // Profile Wizard helper functions
  const getAvailableProfiles = () => {
    if (selectedTab === null) return ["root"];

    const config = configurations[selectedTab].properties;
    const flatProfiles = flattenProfiles(config.profiles);
    const profileNames = Object.keys(flatProfiles);

    // Include pending profiles from pendingChanges
    const pendingProfiles = new Set<string>();
    Object.entries(pendingChanges[configurations[selectedTab].configPath] || {}).forEach(([key, entry]) => {
      if (entry.profile) {
        pendingProfiles.add(entry.profile);
      }
    });

    return ["root", ...profileNames, ...Array.from(pendingProfiles)];
  };

  const getAvailableProfilesByType = (profileType: string) => {
    if (selectedTab === null) return [];

    const config = configurations[selectedTab].properties;
    const flatProfiles = flattenProfiles(config.profiles);
    const profileNames = Object.keys(flatProfiles);

    // Filter profiles by type
    const profilesOfType = profileNames.filter((profileKey) => {
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

  const getWizardTypeOptions = () => {
    if (selectedTab === null) return [];
    return schemaValidations[configurations[selectedTab].configPath]?.validDefaults || [];
  };

  const getWizardPropertyOptions = () => {
    if (selectedTab === null) return [];
    if (!wizardSelectedType) return [];
    const allOptions = schemaValidations[configurations[selectedTab].configPath]?.propertySchema[wizardSelectedType] || {};
    // Filter out properties that are already added
    const usedKeys = new Set(wizardProperties.map((prop) => prop.key));
    return Object.keys(allOptions).filter((option) => !usedKeys.has(option));
  };

  const getPropertyType = (propertyKey: string): string | undefined => {
    if (selectedTab === null) return undefined;
    if (!wizardSelectedType) return undefined;
    const propertySchema = schemaValidations[configurations[selectedTab].configPath]?.propertySchema[wizardSelectedType] || {};
    return propertySchema[propertyKey]?.type;
  };

  const isProfileNameTaken = () => {
    if (!wizardProfileName.trim() || selectedTab === null) return false;

    const config = configurations[selectedTab].properties;
    const flatProfiles = flattenProfiles(config.profiles);

    // Check existing profiles
    const existingProfilesUnderRoot = Object.keys(flatProfiles).some((profileKey) => {
      if (wizardRootProfile === "root") {
        return profileKey === wizardProfileName.trim();
      } else {
        return (
          profileKey === `${wizardRootProfile}.${wizardProfileName.trim()}` ||
          profileKey.startsWith(`${wizardRootProfile}.${wizardProfileName.trim()}.`)
        );
      }
    });

    // Check pending changes
    const pendingProfilesUnderRoot = Object.entries(pendingChanges[configurations[selectedTab].configPath] || {}).some(([key, entry]) => {
      if (entry.profile) {
        if (wizardRootProfile === "root") {
          return entry.profile === wizardProfileName.trim();
        } else {
          return (
            entry.profile === `${wizardRootProfile}.${wizardProfileName.trim()}` ||
            entry.profile.startsWith(`${wizardRootProfile}.${wizardProfileName.trim()}.`)
          );
        }
      }
      return false;
    });

    return existingProfilesUnderRoot || pendingProfilesUnderRoot;
  };

  const handleWizardAddProperty = () => {
    if (!wizardNewPropertyKey.trim() || !wizardNewPropertyValue.trim()) return;

    // Check if the key already exists
    const keyExists = wizardProperties.some((prop) => prop.key === wizardNewPropertyKey.trim());
    if (keyExists) {
      return; // Don't add duplicate keys
    }

    const propertyType = getPropertyType(wizardNewPropertyKey.trim());
    const parsedValue = parseValueByType(wizardNewPropertyValue, propertyType);

    setWizardProperties((prev) => [
      ...prev,
      {
        key: wizardNewPropertyKey,
        value: parsedValue,
        secure: wizardNewPropertySecure,
      },
    ]);
    setWizardNewPropertyKey("");
    setWizardNewPropertyValue("");
    setWizardNewPropertySecure(false);
    setWizardShowKeyDropdown(false);
  };

  const handleWizardRemoveProperty = (index: number) => {
    setWizardProperties((prev) => prev.filter((_, i) => i !== index));
  };

  const handleWizardPropertyValueChange = (index: number, newValue: string) => {
    setWizardProperties((prev) => {
      const updated = [...prev];
      const propertyType = getPropertyType(updated[index].key);
      updated[index] = {
        ...updated[index],
        value: parseValueByType(newValue, propertyType),
      };
      return updated;
    });
  };

  const handleWizardPropertySecureToggle = (index: number) => {
    setWizardProperties((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        secure: !updated[index].secure,
      };
      return updated;
    });
  };

  const handleWizardCreateProfile = () => {
    if (!wizardProfileName.trim()) return;

    const configPath = configurations[selectedTab!]!.configPath;

    // Check if profile already exists under the selected root
    const config = configurations[selectedTab!].properties;
    const flatProfiles = flattenProfiles(config.profiles);

    // Get all existing profile names under the selected root
    const existingProfilesUnderRoot = Object.keys(flatProfiles).filter((profileKey) => {
      if (wizardRootProfile === "root") {
        // For root, check if the profile name exists as a top-level profile
        return profileKey === wizardProfileName.trim();
      } else {
        // For nested profiles, check if the profile exists under the selected root
        return (
          profileKey === `${wizardRootProfile}.${wizardProfileName.trim()}` ||
          profileKey.startsWith(`${wizardRootProfile}.${wizardProfileName.trim()}.`)
        );
      }
    });

    // Also check pending changes for profiles being created
    const pendingProfilesUnderRoot = Object.entries(pendingChanges[configPath] || {}).some(([key, entry]) => {
      if (entry.profile) {
        if (wizardRootProfile === "root") {
          return entry.profile === wizardProfileName.trim();
        } else {
          return (
            entry.profile === `${wizardRootProfile}.${wizardProfileName.trim()}` ||
            entry.profile.startsWith(`${wizardRootProfile}.${wizardProfileName.trim()}.`)
          );
        }
      }
      return false;
    });

    if (existingProfilesUnderRoot.length > 0 || pendingProfilesUnderRoot) {
      // Profile already exists, don't create it
      return;
    }

    // Create the profile path
    let profilePath: string[];
    let newProfileKey: string;
    if (wizardRootProfile === "root") {
      profilePath = ["profiles", wizardProfileName];
      newProfileKey = wizardProfileName;
    } else {
      // For nested profiles, we need to build the path to the selected profile
      // and then add "profiles" and the new profile name
      const profileParts = wizardRootProfile.split(".");
      profilePath = ["profiles"];

      // Build the path to the selected profile
      for (let i = 0; i < profileParts.length; i++) {
        profilePath.push(profileParts[i]);
        // Add "profiles" between each level
        if (i < profileParts.length - 1) {
          profilePath.push("profiles");
        }
      }

      // Add "profiles" after the selected profile, then the new profile name
      profilePath.push("profiles", wizardProfileName);
      newProfileKey = `${wizardRootProfile}.${wizardProfileName}`;
    }

    // Add type property only if selected
    if (wizardSelectedType) {
      const typePath = [...profilePath, "type"];
      const typeKey = typePath.join(".");

      setPendingChanges((prev) => ({
        ...prev,
        [configPath]: {
          ...prev[configPath],
          [typeKey]: {
            value: wizardSelectedType,
            path: typePath.slice(-1),
            profile: newProfileKey,
          },
        },
      }));
    }

    // Add properties

    // If no properties/type are set, set an empty properties object on the profile
    if (wizardProperties.length === 0 && !wizardSelectedType) {
      wizardProperties.push({ key: "", value: {} });
    }
    wizardProperties.forEach((prop) => {
      // Always use properties path, but set secure flag if needed
      const propertyPath = [...profilePath, "properties"];

      // Logic for setting empty properties
      if (prop.key !== "") propertyPath.push(prop.key);

      const propertyKey = propertyPath.join(".");

      setPendingChanges((prev) => ({
        ...prev,
        [configPath]: {
          ...prev[configPath],
          [propertyKey]: {
            value: prop.value,
            path: propertyPath.slice(-1),
            profile: newProfileKey,
            secure: prop.secure,
          },
        },
      }));
    });

    // Automatically select the newly created profile
    setSelectedProfileKey(newProfileKey);

    // Reset wizard state
    setWizardModalOpen(false);
    setWizardRootProfile("root");
    setWizardSelectedType("");
    setWizardProfileName("");
    setWizardProperties([]);
    setWizardNewPropertyKey("");
    setWizardNewPropertyValue("");
    setWizardNewPropertySecure(false);
    setWizardShowKeyDropdown(false);
  };

  const handleWizardCancel = () => {
    setWizardModalOpen(false);
    setWizardRootProfile("root");
    setWizardSelectedType("");
    setWizardProfileName("");
    setWizardProperties([]);
    setWizardNewPropertyKey("");
    setWizardNewPropertyValue("");
    setWizardNewPropertySecure(false);
    setWizardShowKeyDropdown(false);
  };

  // Enhanced datalist hook
  useEnhancedDatalist(newKeyModalOpen ? "type-input" : null, "type-options");

  // Get options for input key for profile dropdown
  const fetchTypeOptions = (path: string[]) => {
    const { configPath, properties: baseConfig } = configurations[selectedTab!]!;
    const currentConfig = { ...baseConfig };

    // Extract the profile key from the path
    const profileKey = extractProfileKeyFromPath(path);

    // Get the profile type, which will include pending changes
    const resolvedType = getProfileType(profileKey);

    const propertySchema = schemaValidations[configPath]?.propertySchema[resolvedType || ""] || {};
    return Object.keys(propertySchema);
  };

  return (
    <div>
      <Tabs configurations={configurations} selectedTab={selectedTab} onTabChange={handleTabChange} onOpenRawFile={handleOpenRawJson} />
      <Panels
        configurations={configurations}
        selectedTab={selectedTab}
        renderProfiles={renderProfiles}
        renderProfileDetails={renderProfileDetails}
        renderDefaults={renderDefaults}
        onAddDefault={() => setNewKeyModalOpen(true)}
        onProfileWizard={() => setWizardModalOpen(true)}
      />
      <Footer
        onClearChanges={() => {
          // Store current selection before clearing
          const currentSelectedTab = selectedTab;
          const currentSelectedProfileKey = selectedProfileKey;

          vscodeApi.postMessage({ command: "GET_PROFILES" });
          setHiddenItems({});
          setPendingChanges({});
          setDeletions({});
          setPendingDefaults({});
          setDefaultsDeletions({});

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
                  changes: formatPendingChanges(), // This will be empty since we just cleared changes
                });
              }
            }
          }, 100);
        }}
        onSaveAll={() => {
          handleSave();
          setSaveModalOpen(true);
        }}
      />
      {/* Modals */}
      <AddDefaultModal
        isOpen={newKeyModalOpen}
        newKey={newKey}
        newValue={newValue}
        showDropdown={showDropdown}
        typeOptions={typeOptions}
        availableProfiles={selectedProfileType ? getAvailableProfilesByType(selectedProfileType) : []}
        profileType={selectedProfileType}
        onNewKeyChange={(value) => {
          setNewKey(value);
          setSelectedProfileType(value);
        }}
        onNewValueChange={setNewValue}
        onShowDropdownChange={setShowDropdown}
        onAdd={handleAddNewDefault}
        onCancel={() => {
          setNewKeyModalOpen(false);
          setNewKey("");
          setNewValue("");
          setSelectedProfileType(null);
        }}
      />

      <AddProfileModal
        isOpen={newProfileModalOpen}
        newProfileKey={newProfileKey}
        newProfileValue={newProfileValue}
        showDropdown={showDropdown}
        typeOptions={newProfileKeyPath ? fetchTypeOptions(newProfileKeyPath) : []}
        isSecure={isSecure}
        onNewProfileKeyChange={setNewProfileKey}
        onNewProfileValueChange={setNewProfileValue}
        onShowDropdownChange={setShowDropdown}
        onSecureToggle={() => setIsSecure(!isSecure)}
        onAdd={handleAddNewProfileKey}
        onCancel={() => {
          setNewProfileModalOpen(false);
          setIsSecure(false);
        }}
      />

      <SaveModal isOpen={saveModalOpen} />

      <EditModal
        isOpen={editModalOpen}
        editingKey={editingKey}
        editingValue={editingValue}
        onEditingValueChange={setEditingValue}
        onSave={handleSaveEdit}
        onCancel={() => setEditModalOpen(false)}
      />

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
        availableProfiles={getAvailableProfiles()}
        typeOptions={getWizardTypeOptions()}
        propertyOptions={getWizardPropertyOptions()}
        isProfileNameTaken={isProfileNameTaken()}
        onRootProfileChange={setWizardRootProfile}
        onSelectedTypeChange={setWizardSelectedType}
        onProfileNameChange={setWizardProfileName}
        onNewPropertyKeyChange={setWizardNewPropertyKey}
        onNewPropertyValueChange={setWizardNewPropertyValue}
        onNewPropertySecureToggle={() => setWizardNewPropertySecure(!wizardNewPropertySecure)}
        onShowKeyDropdownChange={setWizardShowKeyDropdown}
        onAddProperty={handleWizardAddProperty}
        onRemoveProperty={handleWizardRemoveProperty}
        onPropertyValueChange={handleWizardPropertyValueChange}
        onPropertySecureToggle={handleWizardPropertySecureToggle}
        onCreateProfile={handleWizardCreateProfile}
        onCancel={handleWizardCancel}
        getPropertyType={getPropertyType}
        stringifyValueByType={stringifyValueByType}
      />

      <PreviewArgsModal isOpen={previewArgsModalOpen} argsData={previewArgsData} onClose={() => setPreviewArgsModalOpen(false)} />
    </div>
  );
}
