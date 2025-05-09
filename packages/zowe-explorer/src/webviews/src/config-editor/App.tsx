import { useEffect, useState } from "preact/hooks";

const vscodeApi = acquireVsCodeApi();

export function App() {
  const [localizationState] = useState(null);
  const [eventContents, setEventContents] = useState("");
  const [configurations, setConfigurations] = useState<{ configPath: string; properties: any }[]>([]);
  const [selectedTab, setSelectedTab] = useState<number | null>(null);

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
      }
    });

    vscodeApi.postMessage({ command: "GETPROFILES" });
  }, [localizationState]);

  const handleTabChange = (index: number) => {
    setSelectedTab(index);
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
          <pre>{JSON.stringify(config.properties, null, 2)}</pre>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      {tabs}
      {panels}
    </div>
  );
}

// Add CSS for the tabs and panels using VS Code theme variables
const styles = `
  .tabs {
    display: flex;
    justify-content: space-between; /* Distribute space between tabs */
    border-bottom: 1px solid var(--vscode-editorWidget-border);
    background-color: var(--vscode-editorWidget-background);
  }
  .tab {
    flex: 1; /* Ensure each tab takes equal space */
    padding: 10px 20px;
    cursor: pointer;
    border: 1px solid transparent;
    border-bottom: none;
    background-color: var(--vscode-editorWidget-background);
    transition: background-color 0.3s, color 0.3s;
    text-align: center; /* Center the text within each tab */
  }
  .tab.active {
    background-color: var(--vscode-editor-background);
    border: 1px solid var(--vscode-editorWidget-border);
    border-bottom: 1px solid var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
  }
  .panels {
    padding: 10px;
    border: 1px solid var(--vscode-editorWidget-border);
    border-top: none;
  }
  .panel {
    display: none;
  }
  .panel.active {
    display: block;
  }
`;

// Inject the CSS into the document head
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);
