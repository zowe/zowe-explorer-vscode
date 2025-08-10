interface PanelsProps {
  configurations: { configPath: string; properties: any; secure: string[] }[];
  selectedTab: number | null;
  renderProfiles: (profilesObj: any) => React.ReactNode;
  renderDefaults: (defaultsObj: any) => React.ReactNode;
  renderProfileDetails: () => React.ReactNode;
  onAddDefault: () => void;
  onProfileWizard: () => void;
  viewMode: "flat" | "tree";
  onViewModeToggle: () => void;
}

export function Panels({
  configurations,
  selectedTab,
  renderProfiles,
  renderDefaults,
  renderProfileDetails,
  onAddDefault,
  onProfileWizard,
  viewMode,
  onViewModeToggle,
}: PanelsProps) {
  return (
    <div className="panels">
      {configurations.map((config, index) => (
        <div key={index} className={`panel ${selectedTab === index ? "active" : ""}`}>
          <div style={{ display: "flex", gap: "2rem", alignItems: "flex-start" }}>
            <div className="config-section">
              <div className="profile-heading-container">
                <h2>Profiles</h2>
                <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                  <button
                    className="header-button"
                    title={viewMode === "tree" ? "Switch to flat view" : "Switch to tree view"}
                    onClick={onViewModeToggle}
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
                    <span className={`codicon ${viewMode === "tree" ? "codicon-list-flat" : "codicon-list-tree"}`}></span>
                  </button>
                  <button
                    className="header-button"
                    title="Profile Wizard"
                    onClick={onProfileWizard}
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
                    <span className="codicon codicon-add"></span>
                  </button>
                </div>
              </div>
              {selectedTab === index && renderProfiles(config.properties.profiles)}
            </div>
            <div className="config-section" style={{ flex: "0 0 auto", minWidth: "400px" }}>
              {selectedTab === index && renderProfileDetails()}
            </div>
            <div className="config-section" style={{ flex: "1" }}>
              <div className="defaults-heading-container">
                <h2>Defaults</h2>
                <button
                  className="header-button"
                  title="Add new default"
                  onClick={onAddDefault}
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
                  <span className="codicon codicon-add"></span>
                </button>
              </div>
              {selectedTab === index && renderDefaults(config.properties.defaults)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
