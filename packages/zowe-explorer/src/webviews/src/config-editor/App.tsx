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
  const [configurations, setConfigurations] = useState<{ configPath: string; properties: any; secure: string[]; global?: boolean; user?: boolean }[]>(
    []
  );
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
  const [selectedProfilesByConfig, setSelectedProfilesByConfig] = useState<{ [configPath: string]: string | null }>({});
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
  const [wizardMergedProperties, setWizardMergedProperties] = useState<{ [key: string]: any }>({});
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
        // Don't clear selectedProfileKey here - let handleTabChange handle it
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

  // Trigger wizard merged properties request when root profile or type changes
  useEffect(() => {
    if (wizardModalOpen && selectedTab !== null && (wizardRootProfile || wizardSelectedType)) {
      requestWizardMergedProperties();
    }
  }, [wizardRootProfile, wizardSelectedType, wizardModalOpen, selectedTab]);

  const handleChange = (key: string, value: string) => {
    const configPath = configurations[selectedTab!]!.configPath;
    const path = flattenedConfig[key]?.path ?? key.split(".");
    const profileKey = extractProfileKeyFromPath(path);

    // Check if this is a secure property
    const isSecureProperty = key.includes("secure.") || key.split(".").includes("secure");

    // When a user changes a property, it should become a local property (not merged)
    // This ensures that overwritten merged properties become editable
    setPendingChanges((prev) => ({
      ...prev,
      [configPath]: {
        ...prev[configPath],
        [key]: { value, path, profile: profileKey, secure: isSecureProperty },
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

    // Add to deletions - we'll add all profile-related keys to deletions
    setDeletions((prev) => {
      const newDeletions = { ...prev };
      if (!newDeletions[configPath]) {
        newDeletions[configPath] = [];
      }

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
      // Also clear it from the stored profiles for this config
      const configPath = configurations[selectedTab!]?.configPath;
      if (configPath) {
        setSelectedProfilesByConfig((prev) => ({
          ...prev,
          [configPath]: null,
        }));
      }
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

    const result = {
      changes,
      deletions: deleteKeys,
      defaultsChanges,
      defaultsDeleteKeys: defaultsDeleteKeys,
    };

    return result;
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
          if (!isInDeletions) {
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
    // Only add pending secure props that aren't already in the base array
    const newSecureProps = pendingSecureProps.filter((prop) => !baseArray.includes(prop));
    const result = newSecureProps.length > 0 ? [...baseArray, ...newSecureProps] : baseArray;
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

    const flatProfiles = flattenProfiles(profilesObj);
    const configPath = configurations[selectedTab!]!.configPath;

    // Extract pending profiles using helper function
    const pendingProfiles = extractPendingProfiles(configPath);

    // Combine existing and pending profiles for the profile list
    const allProfiles = { ...flatProfiles, ...pendingProfiles };

    // Filter out deleted profiles and their children
    const deletedProfiles = deletions[configPath] || [];
    const filteredProfileKeys = Object.keys(allProfiles).filter((profileKey) => !isProfileOrParentDeleted(profileKey, deletedProfiles));

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
            const configPath = configurations[selectedTab!]!.configPath;

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

            return renderConfig(originalProfile, path, showMergedProperties ? mergedProperties : null);
          })()}
      </div>
    );
  };

  const renderConfig = (obj: any, path: string[] = [], mergedProps?: any) => {
    const baseObj = cloneDeep(obj);
    const configPath = configurations[selectedTab!]!.configPath;

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
    const sortedEntries = sortConfigEntries(Object.entries(combinedConfig));

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

      const isParent = typeof value === "object" && value !== null && !Array.isArray(value);
      const isArray = Array.isArray(value);
      const pendingValue = (pendingChanges[configPath] ?? {})[fullKey]?.value ?? value;

      // Merge pending secure properties for secure arrays
      let renderValue: any[] = Array.isArray(value) ? value : [];
      if (isArray && key === "secure") {
        renderValue = mergePendingSecureProperties(value, path, configPath);
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
        // Check if this property is from merged properties
        const isFromMergedProps = isPropertyFromMergedProps(displayKey, path, mergedProps, originalProperties, configPath);
        const mergedPropData = displayKey ? mergedProps?.[displayKey] : undefined;
        const jsonLoc = mergedPropData?.jsonLoc;
        const osLoc = mergedPropData?.osLoc;
        const secure = mergedPropData?.secure;
        const isSecureProperty = isFromMergedProps && jsonLoc && displayKey ? isMergedPropertySecure(displayKey, jsonLoc, osLoc, secure) : false;

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
                    border: showMergedProperties && isCurrentProfileUntyped() ? "2px solid var(--vscode-warningForeground)" : "none",
                    outline: showMergedProperties && isCurrentProfileUntyped() ? "2px solid var(--vscode-warningForeground)" : "none",
                    boxShadow: showMergedProperties && isCurrentProfileUntyped() ? "0 0 0 2px var(--vscode-warningForeground)" : "none",
                  }}
                >
                  <option value="">{l10n.t("Select a type")}</option>
                  {getWizardTypeOptions().map((type) => (
                    <option key={type} value={type}>
                      {type.toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
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
                        pointerEvents: "none",
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
          <div
            key={fullKey}
            className="config-item"
            onClick={isFromMergedProps && jsonLoc ? () => handleNavigateToSource(jsonLoc, osLoc) : undefined}
            title={isFromMergedProps && jsonLoc ? `Property Source: ${jsonLoc}` : undefined}
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
                    {value
                      .sort((a: any, b: any) => String(a).localeCompare(String(b)))
                      .map((item: any, index: number) => (
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
              const availableProfiles = getAvailableProfilesByType(key);
              const selectedProfileExists = availableProfiles.includes(String(pendingValue));
              const displayValue = selectedProfileExists ? String(pendingValue) : "";

              return (
                <div key={fullKey} className="config-item">
                  <div className="config-item-container">
                    <span className="config-label">{key}</span>
                    <select
                      className="config-input"
                      value={displayValue}
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
                      {availableProfiles.map((profile) => (
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
    Object.entries(pendingChanges[configurations[selectedTab].configPath] || {}).forEach(([_, entry]) => {
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

    return [...profilesOfType, ...Array.from(pendingProfiles)].sort((a, b) => a.localeCompare(b));
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
    return Object.keys(allOptions)
      .filter((option) => !usedKeys.has(option))
      .sort((a, b) => a.localeCompare(b));
  };

  const getPropertyType = (propertyKey: string): string | undefined => {
    if (selectedTab === null) return undefined;
    if (!wizardSelectedType) return undefined;
    const propertySchema = schemaValidations[configurations[selectedTab].configPath]?.propertySchema[wizardSelectedType] || {};
    return propertySchema[propertyKey]?.type;
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
    const pendingProfilesUnderRoot = Object.entries(pendingChanges[configurations[selectedTab].configPath] || {}).some(([_, entry]) => {
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
    const pendingProfilesUnderRoot = Object.entries(pendingChanges[configPath] || {}).some(([_, entry]) => {
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
    setWizardMergedProperties({});
  };

  const requestWizardMergedProperties = () => {
    if (selectedTab !== null) {
      const configPath = configurations[selectedTab].configPath;
      vscodeApi.postMessage({
        command: "GET_WIZARD_MERGED_PROPERTIES",
        rootProfile: wizardRootProfile,
        profileType: wizardSelectedType,
        configPath: configPath,
      });
    }
  };

  // Enhanced datalist hook
  useEnhancedDatalist(newKeyModalOpen ? "type-input" : null, "type-options");

  // Get options for input key for profile dropdown
  const fetchTypeOptions = (path: string[]) => {
    const { configPath } = configurations[selectedTab!]!;

    // Extract the profile key from the path
    const profileKey = extractProfileKeyFromPath(path);

    // Get the profile type, which will include pending changes
    const resolvedType = getProfileType(profileKey);

    const propertySchema = schemaValidations[configPath]?.propertySchema[resolvedType || ""] || {};
    const allPropertyKeys = Object.keys(propertySchema);

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
    return allPropertyKeys.filter((key) => !existingProperties.has(key));
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
        getPropertyType={getPropertyTypeForAddProfile}
        vscodeApi={vscodeApi}
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
        wizardMergedProperties={wizardMergedProperties}
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
        vscodeApi={vscodeApi}
      />

      <PreviewArgsModal isOpen={previewArgsModalOpen} argsData={previewArgsData} onClose={() => setPreviewArgsModalOpen(false)} />
    </div>
  );
}
