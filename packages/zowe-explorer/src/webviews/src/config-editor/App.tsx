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

  const handleDeleteProperty = (key: string) => {
    const { path } = flattenedConfig[key] || {};
    if (!path || selectedTab === null) return;

    setConfigurations((prev) => {
      const updated = [...prev];
      const configCopy = JSON.parse(JSON.stringify(updated[selectedTab])); // deep copy
      configCopy.properties.profiles = deleteNestedKey(configCopy.properties.profiles, path);
      updated[selectedTab] = configCopy;
      return updated;
    });

    setPendingChanges((prev) => {
      const newState = { ...prev };
      delete newState[key];
      return newState;
    });

    setDeletions((prev) => [...prev, key]);

    // Optionally rebuild flattenedConfig for the updated config
    setFlattenedConfig((prev) => {
      const config = configurations[selectedTab!].properties.profiles;
      return flattenKeys(config);
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

    // Include the path to the configuration file
    const configPath = selectedTab !== null ? configurations[selectedTab].configPath : "";

    vscodeApi.postMessage({
      command: "SAVE_CHANGES",
      changes,
      deletions: deleteKeys,
      defaultsChanges,
      defaultsDeleteKeys: defaultsDeleteKeys,
      configPath,
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
    // Reset pending changes and deletions when switching tabs
    setPendingChanges({});
    setDeletions([]);
    setPendingDefaults({});
    setDefaultsDeletions([]);
  };

  const renderConfig = (obj: any, path: string[] = []) => {
    return Object.entries(obj).map(([key, value]) => {
      const currentPath = [...path, key];
      const fullKey = currentPath.join(".");
      const isParent = typeof value === "object" && value !== null && !Array.isArray(value);
      const isArray = Array.isArray(value);
      const pendingValue = pendingChanges[fullKey]?.value ?? value;

      if (isParent) {
        return (
          <div key={fullKey} className="config-item parent" style={{ marginLeft: `${path.length * 20}px` }}>
            <h3 className={`header-level-${path.length}`}>{key}</h3>
            {renderConfig(value, currentPath)}
          </div>
        );
      } else if (isArray) {
        return (
          <div key={fullKey} className="config-item" style={{ marginLeft: `${path.length * 20}px` }}>
            <span className="config-label">{key}:</span>
            <ul>
              {value.map((item: any, index: number) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        );
      } else {
        return (
          <div key={fullKey} className="config-item" style={{ marginLeft: `${path.length * 20}px` }}>
            <div className="config-item-container">
              <span className="config-label">{key}:</span>
              <input
                className="config-input"
                type="text"
                value={pendingValue}
                onChange={(e) => handleChange(fullKey, (e.target as HTMLInputElement).value)}
              />
              <button className="action-button" onClick={() => handleDeleteProperty(fullKey)}>
                Delete
              </button>
            </div>
          </div>
        );
      }
    });
  };

  const renderDefaults = (defaults: { [key: string]: any }) => {
    return Object.entries(defaults).map(([key, value]) => {
      const pendingValue = pendingDefaults[key]?.value ?? value;
      const isArray = Array.isArray(value);
      const isObject = typeof value === "object" && value !== null && !isArray;

      if (isArray) {
        return (
          <div key={key} className="config-item">
            <span className="config-label">{key}:</span>
            <ul>
              {value.map((item: any, index: number) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        );
      } else if (isObject) {
        return (
          <div key={key} className="config-item parent">
            <h3 className="header-level-0">{key}</h3>
            {renderDefaults(value)}
          </div>
        );
      } else {
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
            <h2>Profiles</h2>
            {selectedTab === index && renderConfig(config.properties.profiles)}
          </div>
          <div className="config-section">
            <h2>Defaults</h2>
            {selectedTab === index && renderDefaults(config.properties.defaults)}
          </div>
        </div>
      ))}
    </div>
  );
  function deleteNestedKey(obj: any, path: string[]): any {
    if (path.length === 1) {
      const newObj = { ...obj };
      delete newObj[path[0]];
      return newObj;
    }

    const [head, ...rest] = path;
    if (!(head in obj)) return obj;

    return {
      ...obj,
      [head]: deleteNestedKey(obj[head], rest),
    };
  }

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
  font-size: 14px;
  padding: 10px;
  background-color: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  margin: 0;
  font-family: var(--vscode-font-family, monospace);
}

.tabs {
  display: flex;
  width: 100%;
  border-bottom: 1px solid var(--vscode-editorWidget-border);
  background-color: var(--vscode-editorWidget-background);
}

.tab {
  flex: 1; /* Equal width for all tabs */
  padding: 8px 12px;
  text-align: center;
  cursor: pointer;
  border: 1px solid transparent;
  border-bottom-color: var(--vscode-editorWidget-background);
  border-right: 1px solid var(--vscode-editorWidget-border); /* Visual separator */
  transition: background-color 0.2s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Remove right border from the last tab */
.tab:last-child {
  border-right: none;
}

.tab:hover {
  background-color: var(--vscode-editorWidget-hoverBackground);
}

.tab.active {
  border-bottom-color: var(--vscode-tab-activeBackground);
  background-color: var(--vscode-editorWidget-background);
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
}

.panels {
  border: 1px solid var(--vscode-editorWidget-border);
  border-top: none;
  border-radius: 0 0 4px 4px;
  background-color: var(--vscode-editorWidget-background);
  padding: 10px;
  margin-top: -1px;
  font-family: monospace;
}

.panel {
  display: none;
  padding: 10px;
}

.panel.active {
  display: block;
}

.config-section {
  margin-bottom: 20px;
}

.config-section h2 {
  margin-top: 0;
  font-size: 16px;
  font-weight: bold;
  font-family: monospace;
  border-bottom: 1px solid var(--vscode-editorWidget-border);
  padding-bottom: 4px;
}

.config-item {
  display: block;
  margin-bottom: 6px;
  font-family: monospace;
  padding-left: 10px;
}

.config-item.parent {
  margin-top: 10px;
  padding-left: 0;
}

.header-level-0,
.header-level-1,
.header-level-2,
.header-level-3 {
  font-weight: bold;
  font-size: 14px;
  margin: 6px 0 2px;
}

.header-level-0 {
  padding-left: 0px;
}
.header-level-1 {
  padding-left: 20px;
}
.header-level-2 {
  padding-left: 40px;
}
.header-level-3 {
  padding-left: 60px;
}

.config-item-container {
  display: flex;
  align-items: center;
  padding: 2px 0;
}

.config-label {
  margin-right: 10px;
  min-width: 100px;
  text-align: right;
  font-weight: normal;
  font-family: monospace;
  color: var(--vscode-editor-foreground);
}

.config-input {
  background-color: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border);
  padding: 4px 8px;
  font-size: 13px;
  font-family: monospace;
  flex-grow: 1;
  min-width: 100px;
}

.config-input:focus {
  outline: 1px solid var(--vscode-focusBorder);
}

ul {
  margin: 4px 0 4px 20px;
  padding: 0;
  list-style-type: square;
  font-family: monospace;
}

li {
  padding-left: 5px;
  margin-bottom: 2px;
}

.action-button {
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 13px;
  font-family: monospace;
  margin-left: 8px;
  border-radius: 3px;
}

.action-button:hover {
  background-color: var(--vscode-button-hoverBackground);
}

.action-button:focus {
  outline: 1px solid var(--vscode-focusBorder);
}

.save-button {
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 14px;
  font-family: monospace;
  border-radius: 4px;
  margin-top: 10px;
}

.save-button:hover {
  background-color: var(--vscode-button-hoverBackground);
}

`;

document.head.insertAdjacentHTML("beforeend", `<style>${styles}</style>`);
