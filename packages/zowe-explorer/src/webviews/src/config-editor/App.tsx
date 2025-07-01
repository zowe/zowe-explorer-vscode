import { useEffect, useState } from "react";
import * as l10n from "@vscode/l10n";
import { cloneDeep } from "es-toolkit";
import { isSecureOrigin } from "../utils";
import { schemaValidation } from "../../../utils/ConfigEditor";
import "./App.css";
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
    const isModalOpen = newKeyModalOpen || newProfileModalOpen || saveModalOpen || newLayerModalOpen || editModalOpen;
    document.body.classList.toggle("modal-open", isModalOpen);
  }, [newKeyModalOpen, newProfileModalOpen, saveModalOpen, newLayerModalOpen, editModalOpen]);

  const handleChange = (key: string, value: string) => {
    const configPath = configurations[selectedTab!]!.configPath;
    const path = flattenedConfig[key]?.path ?? key.split(".");
    const profileKey = path[0];
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
    const profileKey = path[0];

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

    return (
      <div style={{ display: "flex", gap: "2rem" }}>
        <div style={{ width: "250px", paddingRight: "1rem" }}>
          {Object.keys(flatProfiles).map((profileKey) => (
            <div
              key={profileKey}
              className={`profile-list-item ${selectedProfileKey === profileKey ? "selected" : ""}`}
              style={{
                cursor: "pointer",
                margin: "8px 0",
                padding: "8px",
                border: selectedProfileKey === profileKey ? "2px solid var(--vscode-button-background)" : "1px solid #ccc",
                backgroundColor: selectedProfileKey === profileKey ? "var(--vscode-button-hoverBackground)" : "transparent",
              }}
              onClick={() => setSelectedProfileKey(profileKey)}
            >
              <strong>{profileKey}</strong>
            </div>
          ))}
        </div>

        {/* Profile Details */}
        <div style={{ flexGrow: 1 }}>
          {selectedProfileKey && <div>{renderConfig(flatProfiles[selectedProfileKey], ["profiles", selectedProfileKey])}</div>}
        </div>
      </div>
    );
  };

  const renderConfig = (obj: any, path: string[] = []) => {
    const fullPath = path.join(".");
    const baseObj = cloneDeep(obj);

    const configPath = configurations[selectedTab!]!.configPath;
    const combinedConfig = {
      ...baseObj,
      ...Object.fromEntries(
        Object.entries(pendingChanges[configPath] ?? {})
          .filter(([key, entry]) => {
            const keyParts = key.split(".");
            // Secure property handling
            if (entry.secure) {
              let securePath = cloneDeep(pendingChanges[configPath][key].path);
              let property = securePath.pop();
              securePath.pop();
              securePath.push("secure");
              let newSecureCreds = securePath.reduce((acc, key) => acc?.[key], baseObj);
              if (newSecureCreds) {
                if (!Array.isArray(newSecureCreds)) {
                  newSecureCreds = [];
                }
                newSecureCreds.push(property);
              } else {
                const securePathObj = securePath.reduce((acc, key, idx) => {
                  if (!acc[key]) {
                    acc[key] = idx === securePath.length - 1 ? [] : {};
                  }
                  return acc[key];
                }, baseObj);
                securePathObj.push(property);
              }
            }
            return key.startsWith(fullPath) && keyParts.length === path.length + 1 && !entry.secure;
          })
          .map(([key, entry]) => [key.split(".").pop()!, entry.value])
      ),
    };

    return Object.entries(combinedConfig).map(([key, value]) => {
      const currentPath = [...path, key];
      const fullKey = currentPath.join(".");
      const displayKey = key.split(".").pop();

      if ((deletions[configPath] ?? []).includes(fullKey)) return null;

      const isParent = typeof value === "object" && value !== null && !Array.isArray(value);
      const isArray = Array.isArray(value);
      const pendingValue = (pendingChanges[configPath] ?? {})[fullKey]?.value ?? value;

      if (isParent) {
        return (
          <div key={fullKey} className="config-item parent">
            <h3 className={`header-level-${path.length > 3 ? 3 : path.length}`}>
              {displayKey?.toLocaleLowerCase() === "properties" ? "Profile Properties" : displayKey}
              <button className="add-default-button" title={`Add key inside "${fullKey}"`} onClick={() => openAddProfileModalAtPath(currentPath)}>
                <span className="codicon codicon-add"></span>
              </button>
              {/* <button
                className="add-default-button"
                title={`Add child object inside "${fullKey}"`}
                onClick={() => openAddLayerModalAtPath(currentPath)}
              >
                <span className="codicon codicon-bracket-dot"></span>
              </button> */}
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
                title={`Add key inside "${fullKey}"`}
                onClick={() => {
                  setIsSecure(true);
                  openAddProfileModalAtPath(currentPath);
                }}
              >
                <span className="codicon codicon-add"></span>
              </button>
            </h3>
            <div>
              {Array.from(new Set(value)).map((item: any, index: number) => {
                // Logic to handle hidden items in secure properties
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
      result[key] = profile;

      // If this profile contains a nested `profiles` object, flatten those too
      if (profile.profiles) {
        flattenProfiles(profile.profiles, qualifiedKey, result);
        // Optional: remove the nested profiles from the original to avoid double rendering
        delete result[key].profiles;
      }
    }

    return result;
  };

  const handleSaveEdit = () => {
    setEditModalOpen(false);
    setPendingChanges((prev) => {
      const configPath = configurations[selectedTab!]!.configPath;
      const updatedKey = editingKey.replace("secure", "properties");
      const profileKey = updatedKey.split(".")[0];
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

  // const openAddLayerModalAtPath = (path: string[]) => {
  //   setNewLayerPath(path);
  //   setNewLayerName("");
  //   setNewLayerModalOpen(true);
  // };

  const typeOptions = selectedTab !== null ? schemaValidations[configurations[selectedTab].configPath]?.validDefaults || [] : [];

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
          <button onClick={handleAddNewDefault}>{l10n.t("Add")}</button>
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
