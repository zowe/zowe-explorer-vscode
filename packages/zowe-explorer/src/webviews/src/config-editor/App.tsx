import { useEffect, useState } from "react";
import * as l10n from "@vscode/l10n";
import { cloneDeep } from "es-toolkit";
import { isSecureOrigin } from "../utils";
import { schemaValidation } from "../../../utils/ConfigEditor";
import "./App.css";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
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
        value: string | Record<string, any>;
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
  const [wizardProperties, setWizardProperties] = useState<{ key: string; value: string; secure?: boolean }[]>([]);
  const [wizardShowKeyDropdown, setWizardShowKeyDropdown] = useState(false);
  const [wizardNewPropertyKey, setWizardNewPropertyKey] = useState("");
  const [wizardNewPropertyValue, setWizardNewPropertyValue] = useState("");
  const [wizardNewPropertySecure, setWizardNewPropertySecure] = useState(false);
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

  const handleChange = (key: string, value: string) => {
    const configPath = configurations[selectedTab!]!.configPath;
    const path = flattenedConfig[key]?.path ?? key.split(".");
    // For nested profiles, we need to extract the actual profile name from the path
    // Path structure: ["profiles", "project_base", "profiles", "tso", "properties", "port"]
    // We want to get "project_base.tso" as the profile key
    let profileKey;
    if (path[0] === "profiles" && path.length > 2) {
      // Check if this is a nested profile
      const profilesIndices = [];
      for (let i = 0; i < path.length; i++) {
        if (path[i] === "profiles") {
          profilesIndices.push(i);
        }
      }
      if (profilesIndices.length > 1) {
        // This is a nested profile - construct the full profile key
        const profileParts = [];
        for (let i = 1; i < path.length; i++) {
          if (path[i] !== "profiles") {
            profileParts.push(path[i]);
          }
        }
        profileKey = profileParts.join(".");
      } else {
        // Top-level profile
        profileKey = path[1];
      }
    } else {
      profileKey = path[0];
    }

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

    // For nested profiles, we need to extract the actual profile name from the path
    // Path structure: ["profiles", "project_base", "profiles", "tso", "properties", "port"]
    // We want to get "project_base.tso" as the profile key
    let profileKey;
    if (path[0] === "profiles" && path.length > 2) {
      // Check if this is a nested profile
      const profilesIndices = [];
      for (let i = 0; i < path.length; i++) {
        if (path[i] === "profiles") {
          profilesIndices.push(i);
        }
      }
      if (profilesIndices.length > 1) {
        // This is a nested profile - construct the full profile key
        const profileParts = [];
        for (let i = 1; i < path.length; i++) {
          if (path[i] !== "profiles") {
            profileParts.push(path[i]);
          }
        }
        profileKey = profileParts.join(".");
      } else {
        // Top-level profile
        profileKey = path[1];
      }
    } else {
      profileKey = path[0];
    }

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

            // Initialize the profile structure if it doesn't exist
            if (!pendingProfiles[profileKey]) {
              pendingProfiles[profileKey] = {};
            }

            // Add the property to the profile
            const propertyName = keyParts[keyParts.length - 1];
            if (propertyName === "type") {
              pendingProfiles[profileKey].type = entry.value;
            } else if (keyParts.includes("properties")) {
              if (!pendingProfiles[profileKey].properties) {
                pendingProfiles[profileKey].properties = {};
              }
              pendingProfiles[profileKey].properties[propertyName] = entry.value;

              // If this is a secure property, also add it to the secure array
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
    });

    // Combine existing and pending profiles for the profile list
    const allProfiles = { ...flatProfiles, ...pendingProfiles };

    return (
      <div style={{ display: "flex", gap: "2rem" }}>
        <div style={{ width: "250px", paddingRight: "1rem" }}>
          {Object.keys(allProfiles).map((profileKey) => (
            <div
              key={profileKey}
              className={`profile-list-item ${selectedProfileKey === profileKey ? "selected" : ""}`}
              style={{
                cursor: "pointer",
                margin: "8px 0",
                padding: "8px",
                border: selectedProfileKey === profileKey ? "2px solid var(--vscode-button-background)" : "1px solid #ccc",
                backgroundColor: selectedProfileKey === profileKey ? "var(--vscode-button-hoverBackground)" : "transparent",
                opacity: pendingProfiles[profileKey] ? 0.7 : 1, // Dim pending profiles
              }}
              onClick={() => setSelectedProfileKey(profileKey)}
              title={profileKey}
            >
              <strong
                style={{
                  display: "block",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {profileKey}
              </strong>
              {pendingProfiles[profileKey]}
            </div>
          ))}
        </div>

        {/* Profile Details */}
        <div style={{ flexGrow: 1 }}>
          {selectedProfileKey && (
            <div>
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
                const originalProfile = flatProfiles[selectedProfileKey] || {};
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
    Object.entries(pendingChanges[configPath] ?? {}).forEach(([key, entry]) => {
      if (!entry.secure) {
        const keyParts = key.split(".");
        if (key.startsWith(fullPath)) {
          const relativePath = keyParts.slice(path.length);
          if (relativePath.length === 1) {
            pendingChangesAtLevel[relativePath[0]] = entry.value;
          } else if (relativePath.length > 1) {
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
      }
    });

    // Combine base object with pending changes at this level
    combinedConfig = {
      ...combinedConfig,
      ...pendingChangesAtLevel,
    };

    return Object.entries(combinedConfig).map(([key, value]) => {
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
        // Find all pending secure properties for this exact secure array path
        const pendingSecureProps: string[] = Object.entries(pendingChanges[configPath] ?? {})
          .filter(([, entry]) => entry.secure && currentPath.join(".") === pathFromArray(path.concat(["secure"])))
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
                  value={pendingValue}
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
    const combinedDefaults = {
      ...defaults,
      ...Object.fromEntries(
        Object.entries(pendingDefaults[configurations[selectedTab!]!.configPath] ?? {})
          .filter(([key]) => !(key in defaults))
          .map(([key, entry]) => [key, entry.value])
      ),
    };

    return Object.entries(combinedDefaults).map(([key, value]) => {
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
            <span className="config-label">
              {">"}
              {key}
            </span>
            <ul>
              {value.map((item: any, index: number) => (
                <li style={{ fontSize: "16px" }} key={index}>
                  {item}
                </li>
              ))}
            </ul>
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
                value={pendingValue}
                onChange={(e) => handleDefaultsChange(fullKey, (e.target as HTMLInputElement).value)}
              />
              <button className="action-button" onClick={() => handleDeleteDefaultsProperty(fullKey)}>
                <span className="codicon codicon-trash"></span>
              </button>
            </div>
          </div>
        );
      }
    });
  };

  const openAddProfileModalAtPath = (path: string[]) => {
    setNewProfileKeyPath(path);
    setNewProfileKey("");
    setNewProfileValue("");
    setNewProfileModalOpen(true);
  };

  const flattenKeys = (obj: { [key: string]: any }, parentKey: string = ""): { [key: string]: { value: string; path: string[] } } => {
    let result: { [key: string]: { value: string; path: string[] } } = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = parentKey ? `${parentKey}.${key}` : key;
      const newPath = parentKey ? [...parentKey.split("."), key] : [key];

      if (typeof value === "object") {
        const nestedObject = flattenKeys(value, newKey);
        result = { ...result, ...nestedObject };
      } else {
        result[newKey] = { value: value, path: newPath };
      }
    }

    return result;
  };

  const flattenProfiles = (profiles: any, parentKey = "", result: Record<string, any> = {}) => {
    if (!profiles || typeof profiles !== "object") return result;

    for (const key of Object.keys(profiles)) {
      const profile = profiles[key];
      const qualifiedKey = parentKey ? `${parentKey}.${key}` : key;

      // Create a copy of the profile without the nested profiles
      const profileCopy = { ...profile };
      delete profileCopy.profiles;

      result[qualifiedKey] = profileCopy;

      // If this profile contains a nested `profiles` object, flatten those too
      if (profile.profiles) {
        flattenProfiles(profile.profiles, qualifiedKey, result);
      }
    }

    return result;
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
    if (!wizardSelectedType || selectedTab === null) return [];
    return schemaValidations[configurations[selectedTab].configPath]?.propertySchema[wizardSelectedType] || [];
  };

  const handleWizardAddProperty = () => {
    if (!wizardNewPropertyKey.trim() || !wizardNewPropertyValue.trim()) return;

    setWizardProperties((prev) => [
      ...prev,
      {
        key: wizardNewPropertyKey,
        value: wizardNewPropertyValue,
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

  const handleWizardCreateProfile = () => {
    if (!wizardProfileName.trim() || !wizardSelectedType) return;

    const configPath = configurations[selectedTab!]!.configPath;

    // Create the profile path
    let profilePath: string[];
    if (wizardRootProfile === "root") {
      profilePath = ["profiles", wizardProfileName];
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
    }

    // Add type property
    const typePath = [...profilePath, "type"];
    const typeKey = typePath.join(".");

    setPendingChanges((prev) => ({
      ...prev,
      [configPath]: {
        ...prev[configPath],
        [typeKey]: {
          value: wizardSelectedType,
          path: typePath.slice(-1),
          profile: wizardRootProfile === "root" ? wizardProfileName : `${wizardRootProfile}.${wizardProfileName}`,
        },
      },
    }));

    // Add properties
    wizardProperties.forEach((prop) => {
      // Always use properties path, but set secure flag if needed
      const propertyPath = [...profilePath, "properties", prop.key];
      const propertyKey = propertyPath.join(".");

      setPendingChanges((prev) => ({
        ...prev,
        [configPath]: {
          ...prev[configPath],
          [propertyKey]: {
            value: prop.value,
            path: propertyPath.slice(-1),
            profile: wizardRootProfile === "root" ? wizardProfileName : `${wizardRootProfile}.${wizardProfileName}`,
            secure: prop.secure,
          },
        },
      }));
    });

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

  useEnhancedDatalist(newKeyModalOpen ? "type-input" : null, "type-options");

  const modal = newKeyModalOpen && (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>{l10n.t("Add New Default")}</h3>
        <div className="dropdown-container">
          <input
            id="type-input"
            value={newKey}
            onChange={(e) => {
              setNewKey((e.target as HTMLInputElement).value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 100)}
            className="modal-input"
            placeholder={l10n.t("Type")}
          />
          {showDropdown && (
            <ul className="dropdown-list">
              {typeOptions
                .filter((opt) => opt.toLowerCase().includes(newKey.toLowerCase()))
                .map((option, index) => (
                  <li
                    key={index}
                    className="dropdown-item"
                    onMouseDown={() => {
                      setNewKey(option);
                      setShowDropdown(false);
                    }}
                  >
                    {option}
                  </li>
                ))}
            </ul>
          )}
        </div>

        <input
          placeholder={l10n.t("Profile (e.g. ssh1,my_lpar)")}
          value={newValue}
          onChange={(e) => setNewValue((e.target as HTMLInputElement).value)}
          className="modal-input"
        />
        <div className="modal-actions">
          <VSCodeButton onClick={handleAddNewDefault}>{l10n.t("Add")}</VSCodeButton>
          <button
            onClick={() => {
              setNewKeyModalOpen(false);
              setNewKey("");
              setNewValue("");
            }}
          >
            {l10n.t("Cancel")}
          </button>
        </div>
      </div>
    </div>
  );

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

    return schemaValidations[configPath]?.propertySchema[resolvedType] || [];
  };

  const profileModal = newProfileModalOpen && (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>{l10n.t("Add New Profile Property")}</h3>
        <div className="dropdown-container" style={{ position: "relative" }}>
          <input
            id="profile-type-input"
            value={newProfileKey}
            onChange={(e) => {
              setNewProfileKey((e.target as HTMLInputElement).value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 100)}
            className="modal-input"
            placeholder={l10n.t("New Key")}
            style={{ paddingRight: "2rem" }}
          />
          {newProfileKey && (
            <button onClick={() => setNewProfileKey("")} className="profile-clear-button" title="Clear input">
              <span
                className="codicon codicon-chrome-close"
                style={{
                  fontSize: "14px",
                  lineHeight: 1,
                }}
              />
            </button>
          )}
          {showDropdown && (
            <ul className="dropdown-list">
              {fetchTypeOptions(newProfileKeyPath || [])
                .filter((opt) => opt.toLowerCase().includes(newProfileKey.toLowerCase()))
                .map((option, index) => (
                  <li
                    key={index}
                    className="dropdown-item"
                    onMouseDown={() => {
                      setNewProfileKey(option);
                      setShowDropdown(false);
                    }}
                  >
                    {option}
                  </li>
                ))}
            </ul>
          )}
        </div>

        <input
          placeholder={l10n.t("Value")}
          value={newProfileValue}
          onChange={(e) => setNewProfileValue((e.target as HTMLInputElement).value)}
          className="modal-input"
        />
        <div className="modal-actions">
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* {newProfileKeyPath && newProfileKeyPath.join(".").endsWith("properties") && (
              <label
                className="secure-checkbox-label"
                style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", marginRight: 8 }}
              >
                Secure
                <input
                  type="checkbox"
                  checked={isSecure}
                  onChange={(e) => setIsSecure((e.target as HTMLInputElement).checked)}
                  style={{ marginLeft: 4 }}
                />
              </label>
            )} */}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", flexGrow: 1 }}>
            <button style={{ marginRight: 8 }} onClick={handleAddNewProfileKey}>
              {l10n.t("Add")}
            </button>
            <button
              onClick={() => {
                setNewProfileModalOpen(false);
                setIsSecure(false);
              }}
            >
              {l10n.t("Cancel")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const saveModal = saveModalOpen && (
    <div className="modal-backdrop">
      <div className="modal">Saving....</div>
    </div>
  );

  const tabs = (
    <div className="tabs">
      {configurations.map((config, index) => (
        <div key={index} className={`tab ${selectedTab === index ? "active" : ""}`} onClick={() => handleTabChange(index)}>
          {config.configPath}
        </div>
      ))}
    </div>
  );

  const panels = (
    <div className="panels">
      {configurations.map((config, index) => (
        <div key={index} className={`panel ${selectedTab === index ? "active" : ""}`}>
          <div className="config-section">
            <h2>{l10n.t("Profiles")}</h2>
            {selectedTab === index && renderProfiles(config.properties.profiles)}
          </div>
        </div>
      ))}
    </div>
  );

  const newLayerModal = newLayerModalOpen && (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>{l10n.t("Add New Layer")}</h3>
        <input placeholder={l10n.t("New Layer Name")} value={newLayerName} onChange={(e) => setNewLayerName((e.target as HTMLInputElement).value)} />
        <div className="modal-actions">
          <button onClick={handleAddNewLayer}>{l10n.t("Add")}</button>
          <button onClick={() => setNewLayerModalOpen(false)}>{l10n.t("Cancel")}</button>
        </div>
      </div>
    </div>
  );

  const editModal = editModalOpen && (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>{l10n.t("Edit value for " + editingKey)}</h3>
        <input type="password" onChange={(e) => setEditingValue((e.target as HTMLTextAreaElement).value)} />
        <div className="modal-actions">
          <button onClick={handleSaveEdit}>{l10n.t("Save")}</button>
          <button onClick={() => setEditModalOpen(false)}>{l10n.t("Cancel")}</button>
        </div>
      </div>
    </div>
  );

  const wizardModal = wizardModalOpen && (
    <div className="modal-backdrop">
      <style>
        {`
          .wizard-select {
            position: relative;
            z-index: 1;
          }
          .wizard-select:focus {
            z-index: 10;
          }
          .wizard-select option {
            background-color: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            padding: 4px 8px;
          }
        `}
      </style>
      <div
        className="modal"
        style={{
          maxWidth: "600px",
          width: "600px",
          maxHeight: "85vh",
          overflow: "visible",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        <h3 style={{ margin: "0 0 1rem 0", paddingBottom: "0.5rem" }}>{l10n.t("Profile Wizard")}</h3>

        <div style={{ flex: 1, overflow: "auto", paddingRight: "0.5rem", position: "relative" }}>
          {/* Root Profile Selection */}
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>{l10n.t("Root Profile")}:</label>
            <select
              value={wizardRootProfile}
              onChange={(e) => setWizardRootProfile((e.target as HTMLSelectElement).value)}
              className="modal-input wizard-select"
              style={{
                width: "100%",
                height: "36px",
                position: "relative",
                zIndex: 1,
              }}
            >
              {getAvailableProfiles().map((profile) => (
                <option key={profile} value={profile}>
                  {profile === "root" ? "/" : profile}
                </option>
              ))}
            </select>
          </div>

          {/* Profile Name */}
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>{l10n.t("Profile Name")}:</label>
            <input
              type="text"
              value={wizardProfileName}
              onKeyDown={(e) => {
                // Allow: backspace, delete, tab, escape, enter, and navigation keys
                if ([8, 9, 27, 13, 46, 37, 38, 39, 40].includes(e.keyCode)) {
                  return;
                }
                // Allow: alphanumeric characters and underscore
                if (/^[a-zA-Z0-9_]$/.test(e.key)) {
                  return;
                }
                // Prevent all other keys
                e.preventDefault();
              }}
              onChange={(e) => setWizardProfileName((e.target as HTMLInputElement).value)}
              className="modal-input"
              placeholder={l10n.t("Enter profile name")}
              style={{ width: "100%", height: "36px" }}
            />
          </div>

          {/* Type Selection */}
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>{l10n.t("Profile Type")}:</label>
            <select
              value={wizardSelectedType}
              onChange={(e) => setWizardSelectedType((e.target as HTMLSelectElement).value)}
              className="modal-input wizard-select"
              style={{
                width: "100%",
                height: "36px",
                position: "relative",
                zIndex: 1,
              }}
            >
              <option value="">{l10n.t("Select a type")}</option>
              {getWizardTypeOptions().map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Properties Section - Always rendered but conditionally visible */}
          <div
            style={{
              marginBottom: "1rem",
              minHeight: wizardSelectedType ? "auto" : "120px",
              opacity: wizardSelectedType ? 1 : 0.3,
              pointerEvents: wizardSelectedType ? "auto" : "none",
            }}
          >
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>{l10n.t("Properties")}:</label>

            {/* Add New Property */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
              <div style={{ flex: 1, position: "relative" }}>
                <input
                  type="text"
                  value={wizardNewPropertyKey}
                  onChange={(e) => {
                    setWizardNewPropertyKey((e.target as HTMLInputElement).value);
                    setWizardShowKeyDropdown(true);
                  }}
                  onFocus={() => setWizardShowKeyDropdown(true)}
                  onBlur={() => setTimeout(() => setWizardShowKeyDropdown(false), 100)}
                  className="modal-input"
                  placeholder={l10n.t("Property key")}
                  style={{ height: "32px" }}
                />
                {wizardShowKeyDropdown && (
                  <ul
                    className="dropdown-list"
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      zIndex: 9999,
                      maxHeight: "200px",
                      overflow: "auto",
                      backgroundColor: "var(--vscode-dropdown-background)",
                      border: "1px solid var(--vscode-dropdown-border)",
                      borderRadius: "4px",
                      margin: 0,
                      padding: 0,
                      listStyle: "none",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                    }}
                  >
                    {getWizardPropertyOptions()
                      .filter((opt) => opt.toLowerCase().includes(wizardNewPropertyKey.toLowerCase()))
                      .map((option, index) => (
                        <li
                          key={index}
                          className="dropdown-item"
                          style={{
                            padding: "8px 12px",
                            cursor: "pointer",
                            borderBottom: "1px solid var(--vscode-dropdown-border)",
                          }}
                          onMouseDown={() => {
                            setWizardNewPropertyKey(option);
                            setWizardShowKeyDropdown(false);
                          }}
                        >
                          {option}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
              <input
                type="text"
                value={wizardNewPropertyValue}
                onChange={(e) => setWizardNewPropertyValue((e.target as HTMLInputElement).value)}
                className="modal-input"
                placeholder={l10n.t("Property value")}
                style={{ flex: 1, height: "32px" }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <label style={{ display: "flex", alignItems: "center", fontSize: "0.9em", whiteSpace: "nowrap" }}>
                  <input
                    type="checkbox"
                    checked={wizardNewPropertySecure}
                    onChange={(e) => setWizardNewPropertySecure((e.target as HTMLInputElement).checked)}
                    style={{ marginRight: "0.25rem" }}
                  />
                  Secure
                </label>
                <button
                  onClick={handleWizardAddProperty}
                  disabled={!wizardNewPropertyKey.trim() || !wizardNewPropertyValue.trim()}
                  style={{
                    padding: "0.5rem 1rem",
                    height: "32px",
                    minWidth: "60px",
                  }}
                >
                  {l10n.t("Add")}
                </button>
              </div>
            </div>

            {/* Properties List */}
            <div
              style={{
                border: "1px solid #ccc",
                borderRadius: "4px",
                padding: "0.5rem",
                minHeight: "60px",
                maxHeight: "200px",
                overflow: "auto",
              }}
            >
              {wizardProperties.length > 0 ? (
                wizardProperties.map((prop, index) => (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "0.5rem",
                      padding: "0.25rem 0",
                    }}
                  >
                    <span style={{ fontWeight: "bold", flex: 1 }}>{prop.key}:</span>
                    <span style={{ flex: 1 }}>{prop.secure ? "********" : prop.value}</span>
                    {/* {prop.secure && <span style={{ fontSize: "0.8em", color: "#666", marginLeft: "0.5rem" }}>(secure)</span>} */}
                    <button
                      onClick={() => handleWizardRemoveProperty(index)}
                      style={{
                        padding: "0.25rem 0.5rem",
                        marginLeft: "0.5rem",
                        minWidth: "32px",
                        height: "24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span style={{ marginBottom: "4px" }} className="codicon codicon-trash"></span>
                    </button>
                  </div>
                ))
              ) : (
                <div
                  style={{
                    color: "#666",
                    fontStyle: "italic",
                    textAlign: "center",
                    padding: "1rem",
                  }}
                >
                  {l10n.t("No properties added yet")}
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          className="modal-actions"
          style={{
            marginTop: "0.5rem",
            paddingTop: "0.5rem",
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.5rem",
          }}
        >
          <VSCodeButton
            onClick={handleWizardCreateProfile}
            disabled={!wizardProfileName.trim() || !wizardSelectedType}
            style={{
              padding: "0.5rem 1rem",
              minWidth: "120px",
            }}
          >
            {l10n.t("Create Profile")}
          </VSCodeButton>
          <VSCodeButton
            onClick={handleWizardCancel}
            style={{
              padding: "0.5rem 1rem",
              minWidth: "80px",
            }}
          >
            {l10n.t("Cancel")}
          </VSCodeButton>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "sticky",
          top: 0,
          background: "var(--vscode-editor-background)",
        }}
      >
        <h1>{l10n.t("Zowe Configuration Editor")}</h1>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button className="header-button" title="Profile Wizard" onClick={() => setWizardModalOpen(true)}>
            <span className="codicon codicon-wand"></span>
          </button>
          <button
            className="header-button"
            title="Clear Pending Changes"
            onClick={() => {
              vscodeApi.postMessage({ command: "GET_PROFILES" });
              setHiddenItems({});
              setPendingChanges({});
              setDeletions({});
              setPendingDefaults({});
              setDefaultsDeletions({});
            }}
          >
            <span className="codicon codicon-clear-all"></span>
          </button>
          {selectedTab !== null && (
            <button className="header-button" title="Open Raw File" onClick={() => handleOpenRawJson(configurations[selectedTab].configPath)}>
              <span className="codicon codicon-go-to-file"></span>
            </button>
          )}
          <button
            className="header-button"
            title="Save All Changes"
            onClick={() => {
              handleSave();
              setSaveModalOpen(true);
            }}
          >
            <span className="codicon codicon-save-all"></span>
          </button>
        </div>
      </div>
      {tabs}
      {panels}
      {modal}
      {profileModal}
      {newLayerModal}
      {saveModal}
      {editModal}
      {wizardModal}
    </div>
  );
}

// REF: https://codepen.io/iamsidd_j/pen/qBRWNQQ?editors=1010
export function useEnhancedDatalist(inputId: string | null, datalistId: string) {
  useEffect(() => {
    if (!inputId) return;

    const timeout = setTimeout(() => {
      const input = document.getElementById(inputId) as HTMLInputElement | null;
      const datalist = document.getElementById(datalistId) as HTMLDataListElement | null;
      if (!input || !datalist) return;

      const options = Array.from(datalist.options);
      let currentFocus = -1;

      const showOptions = () => {
        datalist.style.display = "block";
        input.style.borderRadius = "5px 5px 0 0";
      };

      const hideOptions = () => {
        datalist.style.display = "none";
        input.style.borderRadius = "5px";
      };

      const filterOptions = () => {
        const text = input.value.toUpperCase();
        currentFocus = -1;
        options.forEach((option) => {
          option.style.display = option.value.toUpperCase().includes(text) ? "block" : "none";
        });
      };

      const addActive = (x: HTMLOptionElement[]) => {
        removeActive(x);
        if (currentFocus >= x.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = x.length - 1;
        x[currentFocus].classList.add("active");
      };

      const removeActive = (x: HTMLOptionElement[]) => {
        x.forEach((opt) => opt.classList.remove("active"));
      };

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "ArrowDown") {
          currentFocus++;
          addActive(options as HTMLOptionElement[]);
        } else if (e.key === "ArrowUp") {
          currentFocus--;
          addActive(options as HTMLOptionElement[]);
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (currentFocus > -1) {
            (options[currentFocus] as HTMLOptionElement)?.click();
          }
        }
      };

      const onClick = (option: HTMLOptionElement) => {
        input.value = option.value;
        hideOptions();
      };

      input.addEventListener("focus", showOptions);
      input.addEventListener("input", filterOptions);
      input.addEventListener("keydown", onKeyDown);
      options.forEach((opt) => opt.addEventListener("click", () => onClick(opt)));

      return () => {
        input.removeEventListener("focus", showOptions);
        input.removeEventListener("input", filterOptions);
        input.removeEventListener("keydown", onKeyDown);
        options.forEach((opt) => opt.removeEventListener("click", () => onClick(opt)));
      };
    }, 0); // allow modal to render

    return () => clearTimeout(timeout);
  }, [inputId, datalistId]);
}

// Helper to join path arrays
function pathFromArray(arr: string[]) {
  return arr.join(".");
}
