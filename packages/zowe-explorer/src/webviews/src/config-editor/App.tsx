import { useEffect, useState } from "react";
import { isObject } from "lodash";

const vscodeApi = acquireVsCodeApi();

export function App() {
  const [localizationState] = useState(null);
  const [eventContents, setEventContents] = useState("");
  const [configurations, setConfigurations] = useState<{ configPath: string; properties: any }[]>([]);
  const [selectedTab, setSelectedTab] = useState<number | null>(null);
  const [flattenedConfig, setFlattenedConfig] = useState<{ [key: string]: { value: string; path: string[] } }>({});
  const [defaults, setDefaults] = useState<{ [key: string]: { value: string; path: string[] } }>({});
  const [pendingChanges, setPendingChanges] = useState<{ [key: string]: { value: string; path: string[]; profile: string } }>({});
  const [pendingDefaults, setPendingDefaults] = useState<{ [key: string]: { value: string; path: string[] } }>({});
  const [deletions, setDeletions] = useState<string[]>([]);
  const [defaultsDeletions, setDefaultsDeletions] = useState<string[]>([]);

  useEffect(() => {
    window.addEventListener("message", (event) => {
      if (event.data.command === "TEST") {
        const { contents } = event.data;
        setEventContents(contents); // Update state with event contents
      }
      if (event.data.command === "CONFIGURATIONS") {
        const { contents } = event.data;
        setConfigurations(contents);
        setSelectedTab(contents.length > 0 ? 0 : null);

        if (contents.length > 0) {
          const config = contents[0].properties;
          setFlattenedConfig(flattenKeys(config.profiles));
          setDefaults(flattenKeys(config.defaults));
        }
      }
    });

    vscodeApi.postMessage({ command: "GETPROFILES" });
  }, [localizationState]);

  const handleChange = (key: string, value: string) => {
    const { path } = flattenedConfig[key];
    const profileKey = path[0];
    setPendingChanges((prev) => {
      const newState = {
        ...prev,
        [key]: { value, path, profile: profileKey },
      };
      return newState;
    });

    if (deletions.includes(key)) {
      setDeletions((prev) => {
        const newDeletions = prev.filter((k) => k !== key);
        return newDeletions;
      });
    }
  };

  const handleDefaultsChange = (key: string, value: string) => {
    setPendingDefaults((prev) => {
      const newState = {
        ...prev,
        [key]: { value, path: [key] },
      };
      return newState;
    });

    if (defaultsDeletions.includes(key)) {
      setDefaultsDeletions((prev) => {
        const newDeletions = prev.filter((k) => k !== key);
        return newDeletions;
      });
    }
  };

  const handleAddProperty = (parentKey: string) => {
    const newKey = `${parentKey}.newProperty`;
    const { path } = flattenedConfig[parentKey];
    const profileKey = path[0];
    setPendingChanges((prev) => ({
      ...prev,
      [newKey]: { value: "", path: [...path, "newProperty"], profile: profileKey },
    }));
  };

  const handleDeleteProperty = (key: string) => {
    setPendingChanges((prev) => {
      const newState = { ...prev };
      delete newState[key];
      return newState;
    });

    setDeletions((prev) => [...prev, key]);

    setFlattenedConfig((prev) => {
      const newState = { ...prev };
      delete newState[key];
      return newState;
    });
  };

  const handleDeleteDefaultsProperty = (key: string) => {
    setPendingDefaults((prev) => {
      const newState = { ...prev };
      delete newState[key];
      return newState;
    });

    setDefaultsDeletions((prev) => [...prev, key]);

    setDefaults((prev) => {
      const newState = { ...prev };
      delete newState[key];
      return newState;
    });
  };

  const handleSave = () => {
    const changes = Object.keys(pendingChanges).map((key) => {
      const { value, path, profile } = pendingChanges[key];
      return { key, value, path, profile };
    });

    const deleteKeys = deletions;

    const defaultsChanges = Object.keys(pendingDefaults).map((key) => {
      const { value, path } = pendingDefaults[key];
      return { key, value, path };
    });

    const defaultsDeleteKeys = defaultsDeletions;

    vscodeApi.postMessage({
      command: "SAVE_CHANGES",
      changes,
      deletions: deleteKeys,
      defaultsChanges,
      defaultsDeletions: defaultsDeleteKeys,
    });

    setPendingChanges({});
    setDeletions([]);
    setPendingDefaults({});
    setDefaultsDeletions([]);
  };

  const handleTabChange = (index: number) => {
    setSelectedTab(index);
    if (index !== null) {
      const config = configurations[index].properties;
      setFlattenedConfig(flattenKeys(config.profiles));
      setDefaults(flattenKeys(config.defaults));
    }
  };

  const renderConfig = (config: { [key: string]: any }, level: number = 0) => {
    return Object.keys(config).map((key) => {
      const { value, path } = config[key];
      const isParent = isObject(value);
      const pendingValue = pendingChanges[key]?.value !== undefined ? pendingChanges[key].value : value;
      const displayName = path[path.length - 1]; // Display only the last segment of the path

      return (
        <div key={key} className={`config-item ${isParent ? "parent" : ""}`} style={{ marginLeft: `${level * 20}px` }}>
          <div className="config-item-container">
            <span className="config-label">{displayName}:</span>
            {isParent ? (
              <button className="action-button" onClick={() => handleAddProperty(key)}>
                Add Property
              </button>
            ) : (
              <>
                <input
                  className="config-input"
                  type="text"
                  value={pendingValue}
                  onChange={(e) => handleChange(key, (e.target as HTMLInputElement).value)}
                />
                <button className="action-button" onClick={() => handleDeleteProperty(key)}>
                  Delete
                </button>
              </>
            )}
          </div>
          {isParent && renderConfig(flattenKeys(value, key), level + 1)} {/* Recursively render nested properties */}
        </div>
      );
    });
  };

  const renderDefaults = (defaults: { [key: string]: any }) => {
    return Object.keys(defaults).map((key) => {
      const { value } = defaults[key];
      const pendingValue = pendingDefaults[key]?.value !== undefined ? pendingDefaults[key].value : value;

      return (
        <div key={key} className="config-item">
          <div className="config-item-container">
            <span className="config-label">{key}:</span>
            <input
              className="config-input"
              type="text"
              value={pendingValue}
              onChange={(e) => handleDefaultsChange(key, (e.target as HTMLInputElement).value)}
            />
            <button className="action-button" onClick={() => handleDeleteDefaultsProperty(key)}>
              Delete
            </button>
          </div>
        </div>
      );
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
            <h3>Profiles</h3>
            {selectedTab === index && renderConfig(flattenedConfig)}
          </div>
          <div className="config-section">
            <h3>Defaults</h3>
            {selectedTab === index && renderDefaults(defaults)}
          </div>
        </div>
      ))}
    </div>
  );

  const flattenKeys = (obj: { [key: string]: any }, parentKey: string = "") => {
    let result: { [key: string]: { value: string; path: string[] } } = {};

    Object.keys(obj).forEach((key) => {
      const newKey = parentKey ? `${parentKey}.${key}` : key;
      const value = obj[key];

      if (isObject(value)) {
        result = { ...result, ...flattenKeys(value, newKey) };
      } else {
        result[newKey] = { value: value, path: newKey.split(".") };
      }
    });

    return result;
  };

  return (
    <div>
      {tabs}
      {panels}
      <button className="save-button" onClick={handleSave}>
        Save
      </button>
    </div>
  );
}

const styles = `
  body {
    font-size: 14px; /* Increase font size */
    padding: 10px;
    background-color: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
  }
  .tabs {
    display: flex;
    justify-content: space-between;
    border-bottom: 1px solid var(--vscode-editorWidget-border);
    background-color: var(--vscode-editorWidget-background);
    padding: 5px;
  }
  .tab {
    flex: 1;
    padding: 10px 20px;
    cursor: pointer;
    border: 1px solid transparent;
    border-bottom: none;
    background-color: var(--vscode-editorWidget-background);
    transition: background-color 0.2s;
  }
  .tab:hover {
    background-color: var(--vscode-editorWidget-hoverBackground);
  }
  .tab.active {
    border-top: 2px solid var(--vscode-tab-activeForeground);
    background-color: var(--vscode-tab-activeBackground);
  }
  .panels {
    padding: 10px;
  }
  .panel {
    display: none;
    padding: 10px;
  }
  .panel.active {
    display: block;
  }
  .config-item {
    margin-bottom: 10px;
  }
  .config-item-container {
    display: flex;
    align-items: center;
  }
  .config-label {
    flex: 0 0 150px; /* Set a fixed width for the label */
    text-align: right;
    margin-right: 10px;
  }
  .config-input {
    background-color: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    padding: 10px;
    font-size: 14px;
    width: 200px; /* Reduced width of the input box */
    flex: 0 1 auto;
  }
  .action-button {
    background-color: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 10px 15px; /* Match padding with input box */
    cursor: pointer;
    font-size: 14px;
    margin-left: 10px;
  }
  .action-button:hover {
    background-color: var(--vscode-button-hoverBackground);
  }
  .save-button {
    background-color: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 10px 20px;
    cursor: pointer;
    font-size: 14px;
    margin-top: 20px;
    display: block;
    margin-left: auto;
    margin-right: auto;
  }
  .save-button:hover {
    background-color: var(--vscode-button-hoverBackground);
  }
  .profile-header {
    font-weight: bold;
  }
  .header-level-0 {
    font-size: 18px;
  }
  .header-level-1 {
    font-size: 16px;
  }
  .header-level-2 {
    font-size: 14px;
  }
  .header-level-3 {
    font-size: 12px;
  }
  .parent {
    margin-top: 10px;
    margin-bottom: 10px;
  }
`;

document.head.insertAdjacentHTML("beforeend", `<style>${styles}</style>`);
