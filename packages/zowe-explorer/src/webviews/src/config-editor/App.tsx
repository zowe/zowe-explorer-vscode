import { useEffect, useState } from "react";
import { isObject } from "lodash";

const vscodeApi = acquireVsCodeApi();

export function App() {
  const [localizationState] = useState(null);
  const [eventContents, setEventContents] = useState("");
  const [configurations, setConfigurations] = useState<{ configPath: string; properties: any }[]>([]);
  const [selectedTab, setSelectedTab] = useState<number | null>(null);
  const [flattenedConfig, setFlattenedConfig] = useState<{ [key: string]: { value: string; path: string[] } }>({});
  const [flattenedDefaults, setFlattenedDefaults] = useState<{ [key: string]: { value: string; path: string[] } }>({});
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
          setFlattenedDefaults(flattenKeys(config.defaults));
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
    const { path } = flattenedDefaults[key];
    setPendingDefaults((prev) => {
      const newState = {
        ...prev,
        [key]: { value, path },
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
    if (!flattenedConfig[key] || selectedTab === null) return;

    setPendingChanges((prev) => {
      const newState = { ...prev };
      delete newState[key];
      return newState;
    });

    setDeletions((prev) => [...prev, key]);
  };

  const handleDeleteDefaultsProperty = (key: string) => {
    if (!flattenedDefaults[key] || selectedTab === null) return;

    setPendingDefaults((prev) => {
      const newState = { ...prev };
      delete newState[key];
      return newState;
    });

    setDefaultsDeletions((prev) => [...prev, key]);
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
      setFlattenedDefaults(flattenKeys(config.defaults));
    }

    setPendingChanges({});
    setDeletions([]);
    setPendingDefaults({});
    setDefaultsDeletions([]);
  };

  const renderConfig = (obj: any, path: string[] = []) => {
    return Object.entries(obj).map(([key, value]) => {
      const currentPath = [...path, key];
      const fullKey = currentPath.join(".");
      if (deletions.includes(fullKey)) return null;
      const isParent = typeof value === "object" && value !== null && !Array.isArray(value);
      const isArray = Array.isArray(value);
      const pendingValue = pendingChanges[fullKey]?.value ?? value;

      if (isParent) {
        return (
          <div key={fullKey} className="config-item parent" style={{ marginLeft: `${path.length * 10}px` }}>
            <h3 className={`header-level-${path.length > 3 ? 3 : path.length}`}>{key}</h3>
            {renderConfig(value, currentPath)}
          </div>
        );
      } else if (isArray) {
        return (
          <div key={fullKey} className="config-item" style={{ marginLeft: `${path.length * 10}px` }}>
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
          <div key={fullKey} className="config-item" style={{ marginLeft: `${path.length * 10}px` }}>
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
      const currentPath = [key];
      const fullKey = currentPath.join(".");
      if (defaultsDeletions.includes(fullKey)) return null;
      const isParent = typeof value === "object" && value !== null && !Array.isArray(value);
      const isArray = Array.isArray(value);
      const pendingValue = pendingDefaults[fullKey]?.value ?? value;

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
          <div key={fullKey} className="config-item" style={{ marginLeft: `${currentPath.length * 10}px` }}>
            <div className="config-item-container">
              <span className="config-label">{key}:</span>
              <input
                className="config-input"
                type="text"
                value={pendingValue}
                onChange={(e) => handleDefaultsChange(fullKey, (e.target as HTMLInputElement).value)}
              />
              <button className="action-button" onClick={() => handleDeleteDefaultsProperty(fullKey)}>
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

  const flattenKeys = (obj: { [key: string]: any }, parentKey: string = ""): { [key: string]: { value: string; path: string[] } } => {
    let result: { [key: string]: { value: string; path: string[] } } = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = parentKey ? `${parentKey}.${key}` : key;
      const newPath = parentKey ? [...parentKey.split("."), key] : [key];

      if (isObject(value)) {
        const nestedObject = flattenKeys(value, newKey);
        result = { ...result, ...nestedObject };
      } else {
        result[newKey] = { value: value, path: newPath };
      }
    }

    return result;
  };

  const saveButton = (
    <button className="save-button" onClick={handleSave}>
      Save Changes
    </button>
  );

  return (
    <div className="vscode-panel">
      {tabs}
      {panels}
      {saveButton}
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
  // ... existing code
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
  grid-template-columns: 140px 1fr auto;
  gap: 8px;
  align-items: center;
  max-width: 500px;
}

.action-button {
  padding: 4px 8px;
  font-size: 14px;
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-secondaryForeground);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.action-button:hover {
  background-color: var(--vscode-button-secondaryHoverBackground);
}

.save-button {
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
}

.save-button:hover {
  background-color: var(--vscode-button-hoverBackground);
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

li {
  line-height: 1.5;
}
`;

document.head.insertAdjacentHTML("beforeend", `<style>${styles}</style>`);
