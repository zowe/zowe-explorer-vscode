import { useEffect, useState } from "react";
import * as l10n from "@vscode/l10n";
import { cloneDeep } from "es-toolkit";
import { isSecureOrigin } from "../utils";
import { schemaValidation } from "../../../utils/ConfigEditor";
import "./App.css";

// Components
import {
  Header,
  Tabs,
  Panels,
  ProfileList,
  AddDefaultModal,
  AddProfileModal,
  SaveModal,
  EditModal,
  NewLayerModal,
  ProfileWizardModal,
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

        setSelectedTab((prevSelectedTab) => {
          if (prevSelectedTab !== null && prevSelectedTab < contents.length) {
            return prevSelectedTab;
          }
          return contents.length > 0 ? 0 : null;
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
    }
  }, [selectedTab, configurations]);

  useEffect(() => {
    const isModalOpen = newKeyModalOpen || newProfileModalOpen || saveModalOpen || newLayerModalOpen || editModalOpen || wizardModalOpen;
    document.body.classList.toggle("modal-open", isModalOpen);
  }, [newKeyModalOpen, newProfileModalOpen, saveModalOpen, newLayerModalOpen, editModalOpen, wizardModalOpen]);

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

  const handleChange = (key: string, value: string) => {
    const configPath = configurations[selectedTab!]!.configPath;
    const path = flattenedConfig[key]?.path ?? key.split(".");
    const profileKey = extractProfileKeyFromPath(path);

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

    // If this profile is currently selected, clear the selection
    if (selectedProfileKey === profileKey) {
      setSelectedProfileKey(null);
    }
  };

  const handleSave = () => {
    const changes = Object.entries(pendingChanges).flatMap(([configPath, changesForPath]) =>
      Object.keys(changesForPath).map((key) => {
        const { value, path, profile, secure } = changesForPath[key];
        return { key, value, path, profile, configPath, secure };
      })
    );

    const deleteKeys = Object.entries(deletions).flatMap(([configPath, keys]) => keys.map((key) => ({ key, configPath })));

    const defaultsChanges = Object.entries(pendingDefaults).flatMap(([configPath, changesForPath]) =>
      Object.keys(changesForPath).map((key) => {
        const { value, path } = changesForPath[key];
        return { key, value, path, configPath };
      })
    );

    const defaultsDeleteKeys = Object.entries(defaultsDeletions).flatMap(([configPath, keys]) => keys.map((key) => ({ key, configPath })));

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
      <div style={{ display: "flex", gap: "2rem" }}>
        <ProfileList
          sortedProfileKeys={sortedProfileKeys}
          selectedProfileKey={selectedProfileKey}
          pendingProfiles={pendingProfiles}
          profileMenuOpen={profileMenuOpen}
          onProfileSelect={setSelectedProfileKey}
          onProfileMenuToggle={setProfileMenuOpen}
          onDeleteProfile={handleDeleteProfile}
          onSetAsDefault={handleSetAsDefault}
          isProfileDefault={isProfileDefault}
        />

        {/* Profile Details */}
        <div style={{ flexGrow: 1 }}>
          {selectedProfileKey && (
            <div>
              {/* Add button for root-level properties */}
              <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontWeight: "bold", marginRight: 8 }}>{selectedProfileKey}</span>
                <button
                  className="add-default-button"
                  title={`Add key at root of ${selectedProfileKey}`}
                  onClick={() => {
                    // Build the path to the root of the selected profile
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
                    openAddProfileModalAtPath(path);
                  }}
                  style={{ marginLeft: 4 }}
                >
                  <span className="codicon codicon-add"></span>
                </button>
              </div>
              {(() => {
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
                return renderConfig(originalProfile, path);
              })()}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderConfig = (obj: any, path: string[] = []) => {
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

    // Ensure properties key exists with empty object value if not present
    // Only add properties key at the profile level (when path ends with profile name)

    if (path.length > 0 && path[path.length - 1] !== "type" && path[path.length - 1] !== "properties" && path[path.length - 1] !== "secure") {
      if (!combinedConfig.hasOwnProperty("properties")) {
        combinedConfig.properties = {};
      }
      if (!combinedConfig.hasOwnProperty("secure")) {
        combinedConfig.secure = [];
      }
    }

    // Sort properties according to the specified order
    const sortedEntries = sortConfigEntries(Object.entries(combinedConfig));

    return sortedEntries.map(([key, value]) => {
      const currentPath = [...path, key];
      const fullKey = currentPath.join(".");
      const displayKey = key.split(".").pop();
      if ((deletions[configPath] ?? []).includes(fullKey)) return null;
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
            <h3 className={`header-level-${path.length > 3 ? 3 : path.length}`}>
              {displayKey?.toLocaleLowerCase() === "properties" ? "Profile Properties" : displayKey}
              <button className="add-default-button" title={`Add key inside \"${fullKey}\"`} onClick={() => openAddProfileModalAtPath(currentPath)}>
                <span className="codicon codicon-add"></span>
              </button>
            </h3>
            {renderConfig(value, currentPath)}
          </div>
        );
      } else if (isArray) {
        const tabsHiddenItems = hiddenItems[configurations[selectedTab!]!.configPath];
        return (
          <div key={fullKey} className="config-item">
            <h3 className={`header-level-${path.length > 3 ? 3 : path.length}`}>
              <span className="config-label" style={{ fontWeight: "bold" }}>
                {displayKey?.toLocaleLowerCase() === "secure" ? "Secure Properties" : displayKey}
              </span>
              <button
                className="add-default-button"
                title={`Add key inside \"${fullKey}\"`}
                onClick={() => {
                  setIsSecure(true);
                  openAddProfileModalAtPath(currentPath);
                }}
              >
                <span className="codicon codicon-add"></span>
              </button>
            </h3>
            <div>
              {Array.from(new Set(renderValue)).map((item: any, index: number) => {
                if (
                  tabsHiddenItems &&
                  tabsHiddenItems[item] &&
                  tabsHiddenItems[item].path.includes(currentPath.join(".").replace("secure", "properties") + "." + item)
                )
                  return;
                return (
                  <div className="list-item secure-item-container" key={index}>
                    {item}
                    <button
                      className="action-button"
                      style={{ marginLeft: "8px" }}
                      onClick={() => {
                        setEditModalOpen(true);
                        setEditingKey(fullKey + "." + item);
                      }}
                    >
                      <span className="codicon codicon-edit"></span>
                    </button>
                    <button
                      className="action-button"
                      style={{ marginLeft: "8px" }}
                      onClick={() => handleDeleteProperty(fullKey.replace("secure", "properties") + "." + item, true)}
                    >
                      <span className="codicon codicon-trash"></span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      } else {
        return (
          <div key={fullKey} className="config-item">
            <div className="config-item-container">
              <span className="config-label">{displayKey}</span>
              {typeof pendingValue === "string" || typeof pendingValue === "boolean" || typeof pendingValue === "number" ? (
                <input
                  className="config-input"
                  type="text"
                  value={String(pendingValue)}
                  onChange={(e) => handleChange(fullKey, (e.target as HTMLTextAreaElement).value)}
                />
              ) : (
                <span>{"{...}"}</span>
              )}
              <button className="action-button" onClick={() => handleDeleteProperty(fullKey)}>
                <span className="codicon codicon-trash"></span>
              </button>
            </div>
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
        {/* Add button for defaults */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontWeight: "bold", marginRight: 8 }}>Defaults</span>
          <button className="add-default-button" title="Add new default" onClick={() => setNewKeyModalOpen(true)} style={{ marginLeft: 4 }}>
            <span className="codicon codicon-add"></span>
          </button>
        </div>

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
                  <input
                    className="config-input"
                    type="text"
                    value={String(pendingValue)}
                    onChange={(e) => handleDefaultsChange(fullKey, (e.target as HTMLInputElement).value)}
                  />
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

    // Construct the type path: profiles.[...pathWithoutLastSegment].type
    const typePath = [...path.slice(0, -1), "type"];

    // Remove "profiles" prefix to match pendingChanges key format
    const modifiedTypePath = typePath.slice(1).join(".");

    // Check for pending type overwrite
    const pendingTypeOverwrite = pendingChanges[configPath]?.[modifiedTypePath]?.value as string;

    // Traverse currentConfig only if no pending overwrite
    let resolvedType = pendingTypeOverwrite;
    if (!resolvedType) {
      let valueAtPath: any = currentConfig;
      for (const segment of typePath) {
        valueAtPath = valueAtPath?.[segment];
        if (valueAtPath === undefined) break;
      }
      resolvedType = valueAtPath;
    }

    const propertySchema = schemaValidations[configPath]?.propertySchema[resolvedType] || {};
    return Object.keys(propertySchema);
  };

  return (
    <div>
      <Header
        selectedTab={selectedTab}
        configPath={selectedTab !== null ? configurations[selectedTab]?.configPath : undefined}
        onProfileWizard={() => setWizardModalOpen(true)}
        onClearChanges={() => {
          vscodeApi.postMessage({ command: "GET_PROFILES" });
          setHiddenItems({});
          setPendingChanges({});
          setDeletions({});
          setPendingDefaults({});
          setDefaultsDeletions({});
        }}
        onOpenRawFile={handleOpenRawJson}
        onSaveAll={() => {
          handleSave();
          setSaveModalOpen(true);
        }}
      />
      <Tabs configurations={configurations} selectedTab={selectedTab} onTabChange={handleTabChange} />
      <Panels configurations={configurations} selectedTab={selectedTab} renderProfiles={renderProfiles} renderDefaults={renderDefaults} />
      {/* Modals */}
      <AddDefaultModal
        isOpen={newKeyModalOpen}
        newKey={newKey}
        newValue={newValue}
        showDropdown={showDropdown}
        typeOptions={typeOptions}
        onNewKeyChange={setNewKey}
        onNewValueChange={setNewValue}
        onShowDropdownChange={setShowDropdown}
        onAdd={handleAddNewDefault}
        onCancel={() => {
          setNewKeyModalOpen(false);
          setNewKey("");
          setNewValue("");
        }}
      />

      <AddProfileModal
        isOpen={newProfileModalOpen}
        newProfileKey={newProfileKey}
        newProfileValue={newProfileValue}
        showDropdown={showDropdown}
        typeOptions={newProfileKeyPath ? fetchTypeOptions(newProfileKeyPath) : []}
        onNewProfileKeyChange={setNewProfileKey}
        onNewProfileValueChange={setNewProfileValue}
        onShowDropdownChange={setShowDropdown}
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
    </div>
  );
}
