interface TabsProps {
  configurations: { configPath: string; properties: any; secure: string[] }[];
  selectedTab: number | null;
  onTabChange: (index: number) => void;
  onOpenRawFile: (filePath: string) => void;
}

export function Tabs({ configurations, selectedTab, onTabChange, onOpenRawFile }: TabsProps) {
  const getTabLabel = (configPath: string) => {
    // Extract just the filename from the full path
    const parts = configPath.split(/[/\\]/);
    return parts[parts.length - 1] || configPath;
  };

  return (
    <div className="tabs">
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {configurations.map((config, index) => (
          <div key={index} className={`tab ${selectedTab === index ? "active" : ""}`} onClick={() => onTabChange(index)}>
            <span className="tab-label" title={config.configPath}>
              {getTabLabel(config.configPath)}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingRight: "8px" }}>
        {selectedTab !== null && configurations[selectedTab]?.configPath && (
          <button
            className="header-button"
            title="Open Raw File"
            onClick={() => onOpenRawFile(configurations[selectedTab]!.configPath)}
            style={{
              padding: "2px",
              height: "20px",
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
            <span className="codicon codicon-go-to-file"></span>
          </button>
        )}
        <button
          className="header-button"
          title="Add new configuration"
          style={{
            padding: "2px",
            height: "20px",
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
          <span className="codicon codicon-add" title="Add new configuration file (WIP)"></span>
        </button>
      </div>
    </div>
  );
}
