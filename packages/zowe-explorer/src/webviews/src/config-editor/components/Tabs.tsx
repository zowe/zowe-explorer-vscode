interface TabsProps {
  configurations: { configPath: string; properties: any; secure: string[]; global?: boolean; user?: boolean }[];
  selectedTab: number | null;
  onTabChange: (index: number) => void;
  onOpenRawFile: (filePath: string) => void;
  onAddNewConfig: () => void;
  pendingChanges: { [configPath: string]: any };
}

export function Tabs({ configurations, selectedTab, onTabChange, onOpenRawFile, onAddNewConfig, pendingChanges }: TabsProps) {
  const getTabLabel = (configPath: string) => {
    // Extract just the filename from the full path
    const parts = configPath.split(/[/\\]/);
    return parts[parts.length - 1] || configPath;
  };

  const getConfigIcon = (config: { global?: boolean; user?: boolean }) => {
    if (config.global) {
      return "codicon-globe";
    } else if (config.user) {
      return "codicon-folder";
    } else {
      return "codicon-folder";
    }
  };

  return (
    <div className="tabs">
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {configurations.map((config, index) => {
          const hasPendingChanges = pendingChanges[config.configPath] && Object.keys(pendingChanges[config.configPath]).length > 0;
          return (
            <div key={index} className={`tab ${selectedTab === index ? "active" : ""}`} onClick={() => onTabChange(index)}>
              <span className="tab-label" title={config.configPath} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span className={`codicon ${getConfigIcon(config)}`} style={{ fontSize: "14px" }}></span>
                {getTabLabel(config.configPath)}
                {hasPendingChanges && (
                  <span
                    className="codicon codicon-circle-filled"
                    style={{
                      fontSize: "12px",
                      color: "var(--vscode-foreground)",
                      marginLeft: "4px",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                    }}
                    title="Unsaved changes"
                  />
                )}
              </span>
            </div>
          );
        })}
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
          onClick={onAddNewConfig}
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
          <span className="codicon codicon-add" title="Add new configuration file"></span>
        </button>
      </div>
    </div>
  );
}
