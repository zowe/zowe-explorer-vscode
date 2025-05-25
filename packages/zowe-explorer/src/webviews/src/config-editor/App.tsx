import { useEffect, useState } from "react";
import path from "path";
import * as l10n from "@vscode/l10n";
import { cloneDeep } from "es-toolkit";
import { isSecureOrigin } from "../utils";

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

  useEffect(() => {
    window.addEventListener("message", (event) => {
      if (!isSecureOrigin(event.origin)) {
        return;
      }
      if (event.data.command === "CONFIGURATIONS") {
        const { contents } = event.data;
        setConfigurations(contents);

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

  useEffect(() => {
    if (selectedTab !== null && configurations[selectedTab]) {
      const config = configurations[selectedTab].properties;
      setFlattenedConfig(flattenKeys(config.profiles));
      setFlattenedDefaults(flattenKeys(config.defaults));
      setOriginalDefaults(flattenKeys(config.defaults));
    }
  }, [selectedTab, configurations]);

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
    const fullKey = path.join(".");
    const profileKey = path[0];

    setPendingChanges((prev) => ({
      ...prev,
      [configPath]: {
        ...prev[configPath],
        [fullKey]: { value: newProfileValue, path, profile: profileKey, secure: isSecure },
      },
    }));

    setNewProfileKey("");
    setNewProfileValue("");
    setNewProfileKeyPath(null);
    setNewProfileModalOpen(false);
    setIsSecure(false);
  };

  const openAddProfileModalAtPath = (path: string[]) => {
    setNewProfileKeyPath(path);
    setNewProfileKey("");
    setNewProfileValue("");
    setNewProfileModalOpen(true);
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

  const handleDeleteProperty = (fullKey: string) => {
    console.log(fullKey);
    setPendingChanges((prev) => {
      const configPath = configurations[selectedTab!]!.configPath;
      const newPendingChanges = { ...prev };
      delete newPendingChanges[configPath]?.[fullKey];

      return newPendingChanges;
    });
    setDeletions((prev) => {
      const configPath = configurations[selectedTab!]!.configPath;
      console.log(fullKey);
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

  const profileModal = newProfileModalOpen && (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>{l10n.t("Add New Profile Property")}</h3>
        <input placeholder={l10n.t("New Key")} value={newProfileKey} onChange={(e) => setNewProfileKey((e.target as HTMLTextAreaElement).value)} />
        <input placeholder={l10n.t("Value")} value={newProfileValue} onChange={(e) => setNewProfileValue((e.target as HTMLTextAreaElement).value)} />
        <div className="modal-actions">
          <div style={{ display: "flex", alignItems: "center" }}>
            {newProfileKeyPath && newProfileKeyPath.join(".").endsWith("properties") && (
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
            )}
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

  const handleTabChange = (index: number) => {
    setSelectedTab(index);
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
          <div key={fullKey} className="config-item parent" style={{ marginLeft: `${path.length * 10}px` }}>
            <h3 className={`header-level-${path.length > 3 ? 3 : path.length}`}>
              {"> "}
              {displayKey}
              <button className="add-default-button" title={`Add key inside "${fullKey}"`} onClick={() => openAddProfileModalAtPath(currentPath)}>
                <span className="codicon codicon-add"></span>
              </button>
              <button
                className="add-default-button"
                title={`Add child object inside "${fullKey}"`}
                onClick={() => openAddLayerModalAtPath(currentPath)}
              >
                <span className="codicon codicon-bracket-dot"></span>
              </button>
            </h3>
            {renderConfig(value, currentPath)}
          </div>
        );
      } else if (isArray) {
        return (
          <div key={fullKey} className="config-item" style={{ marginLeft: `${path.length * 10}px` }}>
            <span className="config-label" style={{ fontWeight: "bold" }}>
              {"> "}
              {displayKey}
            </span>
            <div>
              {value.map((item: any, index: number) => (
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
                    onClick={() => handleDeleteProperty(fullKey.replace("secure", "properties") + "." + item)}
                  >
                    <span className="codicon codicon-trash"></span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      } else {
        return (
          <div key={fullKey} className="config-item" style={{ marginLeft: `${path.length * 10}px` }}>
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
          <div key={fullKey} className="config-item parent" style={{ marginLeft: `${currentPath.length * 10}px` }}>
            <h3 className={`header-level-${currentPath.length}`}>{key}</h3>
            {renderDefaults(value)}
          </div>
        );
      } else if (isArray) {
        return (
          <div key={fullKey} className="config-item" style={{ marginLeft: `${currentPath.length * 10}px` }}>
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
          <div key={fullKey} className="config-item" style={{ marginLeft: `${currentPath.length * 10}px` }}>
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
            <h2>
              {l10n.t("Profiles")}
              <button className="add-default-button" title={`Add key inside profiles`} onClick={() => openAddProfileModalAtPath([])}>
                <span className="codicon codicon-add"></span>
              </button>
              <button className="add-default-button" title={`Add child object inside "profiles""`} onClick={() => openAddLayerModalAtPath([])}>
                <span className="codicon codicon-bracket-dot"></span>
              </button>
            </h2>
            {selectedTab === index && renderConfig(config.properties.profiles)}
          </div>
          <div className="config-section">
            <div className="defaults-header">
              <h2>
                {l10n.t("Defaults")}
                <button className="add-default-button" title={l10n.t("Add new default")} onClick={() => setNewKeyModalOpen(true)}>
                  <span className="codicon codicon-add"></span>
                </button>
              </h2>
            </div>

            {selectedTab === index && renderDefaults(config.properties.defaults)}
          </div>
        </div>
      ))}
    </div>
  );

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

  const modal = newKeyModalOpen && (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>{l10n.t("Add New Default")}</h3>
        <input
          placeholder={l10n.t("Type (e.g. ssh,tso,zosmf)")}
          value={newKey}
          onChange={(e) => setNewKey((e.target as HTMLTextAreaElement).value)}
        />
        <input
          placeholder={l10n.t("Profile (e.g. ssh1,my_lpar)")}
          value={newValue}
          onChange={(e) => setNewValue((e.target as HTMLTextAreaElement).value)}
        />
        <div className="modal-actions">
          <button onClick={handleAddNewDefault}>{l10n.t("Add")}</button>
          <button onClick={() => setNewKeyModalOpen(false)}>{l10n.t("Cancel")}</button>
        </div>
      </div>
    </div>
  );

  const handleSaveEdit = () => {
    setEditModalOpen(false);
    setPendingChanges((prev) => {
      const configPath = configurations[selectedTab!]!.configPath;
      const updatedKey = editingKey.replace("secure", "properties");
      const profileKey = updatedKey.split(".")[0];
      const value = editingValue;

      return {
        ...prev,
        [configPath]: {
          ...prev[configPath],
          [updatedKey]: {
            value,
            profile: profileKey,
            path: updatedKey.split("."),
            configPath,
            secure: true,
          },
        },
      };
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

  const openAddLayerModalAtPath = (path: string[]) => {
    setNewLayerPath(path);
    setNewLayerName("");
    setNewLayerModalOpen(true);
  };

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
        <h1>{l10n.t("Configuration Editor")}</h1>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            className="header-button"
            title="Clear Pending Changes"
            onClick={() => {
              vscodeApi.postMessage({ command: "GET_PROFILES" });
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

const styles = `
  body {
  font-size: 14px;
  padding: 10px;
  background-color: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  margin: 0;
  font-family: var(--vscode-font-family, monospace);
}

.vscode-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tabs {
  display: flex;
  border-bottom: 1px solid var(--vscode-editorWidget-border);
  background-color: var(--vscode-editorWidget-background);
  border-radius: 4px 4px 0 0;
  overflow-x: auto;
}

.tab {
  flex: 1;
  padding: 8px 12px;
  text-align: center;
  cursor: pointer;
  border: 1px solid transparent;
  border-bottom: none;
  border-right: 1px solid var(--vscode-editorWidget-border);
  background-color: var(--vscode-editorWidget-background);
  color: var(--vscode-editor-foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background-color 0.2s ease;
}

.tab:last-child {
  border-right: none;
}

.tab:hover {
  background-color: var(--vscode-editorWidget-hoverBackground);
}

.tab.active {
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  font-weight: bold;
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
}

.panels {
  border: 1px solid var(--vscode-editorWidget-border);
  border-top: none;
  background-color: var(--vscode-editorWidget-background);
  padding: 12px;
  border-radius: 0 0 4px 4px;
}

.panel {
  display: none;
}

.panel.active {
  display: block;
}

.config-section {
  margin-bottom: 24px;
}

.config-section h2 {
  margin-top: 0;
  font-size: 16px;
  border-bottom: 1px solid var(--vscode-editorWidget-border);
  padding-bottom: 4px;
}

.config-item {
  margin: 6px 0;
}

.config-item.parent {
  margin-top: 10px;
}

.config-label {
  font-weight: 500;
  display: inline-block;
  margin-right: 8px;
  color: var(--vscode-editor-foreground);
}

.config-input {
  padding: 4px 6px;
  font-family: monospace;
  font-size: 13px;
  color: var(--vscode-input-foreground);
  background-color: var(--vscode-input-background);
  border: 1px solid var(--vscode-input-border);
  border-radius: 4px;
}

.config-item-container {
  display: grid;
  grid-template-columns: 150px 1fr auto;
  gap: 8px;
  align-items: center;
  max-width: 500px;
}

.secure-item-container {
  display: grid;
  grid-template-columns: 100px 35px 35px;
  align-items: center;
  max-width: 200px;
}

.action-button {
  font-size: 14px;
  background-color: var(--vscode-button-background);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.action-button:hover {
  background-color: var(--vscode-button-secondaryHoverBackground);
}

.add-default-button {
  font-size: 16px;
  color: var(--vscode-button-background);
  padding: 1px 4px;
  cursor: pointer;
  background-color: var(--vscode-button-background);
  border: none;
  border-radius: 4px;
  line-height: 1;
  margin-left: 8px;
  transition: background-color 0.2s ease;
}

.add-default-button:hover {
  background-color: var(--vscode-button-secondaryHoverBackground);
}

.header-button {
  padding: 8px 16px;
  font-size: 14px;
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  border-radius: 4px;
  font-weight: bold;
  align-self: flex-start;
  cursor: pointer;
  transition: background-color 0.2s ease;
  margin-left: 8px
}

.header-button:hover {
  background-color: var(--vscode-button-secondaryHoverBackground);
}

h3 {
  margin: 6px 0;
  font-size: 14px;
  font-weight: bold;
}

ul {
  margin: 0;
  padding-left: 20px;
}

.list-item {
  line-height: 2;
  padding-left: 3em;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.4);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal {
  background-color: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 8px 16px rgba(0,0,0,0.25);
  min-width: 300px;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal input {
  padding: 8px;
  background-color: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border);
  border-radius: 4px;
}

.modal button {
  padding: 8px 12px;
  border: none;
  cursor: pointer;
  border-radius: 4px;
  font-weight: 500;
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.modal button:hover {
  background-color: var(--vscode-button-hoverBackground);
}

.defaults-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.defaults-header h2 {
  margin: 0;
}

.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0,0,0,0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 999;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.codicon {
    display: inline-block;
    width: 16px;
    height: 16px;
    background-repeat: no-repeat;
    background-size: contain;
    margin-top: 3px;
    color: var(--vscode-button-foreground);
}

.secure-checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
}

.secure-checkbox-label input[type="checkbox"] {
  accent-color: var(--vscode-button-background);
}
`;

document.head.insertAdjacentHTML("beforeend", `<style>${styles}</style>`);
