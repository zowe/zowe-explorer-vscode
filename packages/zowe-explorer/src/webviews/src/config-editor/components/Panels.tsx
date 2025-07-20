interface PanelsProps {
  configurations: { configPath: string; properties: any; secure: string[] }[];
  selectedTab: number | null;
  renderProfiles: (profilesObj: any) => React.ReactNode;
  renderDefaults: (defaultsObj: any) => React.ReactNode;
  onAddDefault: () => void;
}

export function Panels({ configurations, selectedTab, renderProfiles, renderDefaults, onAddDefault }: PanelsProps) {
  return (
    <div className="panels">
      {configurations.map((config, index) => (
        <div key={index} className={`panel ${selectedTab === index ? "active" : ""}`}>
          <div style={{ display: "flex", gap: "2rem", alignItems: "flex-start" }}>
            <div className="config-section" style={{ flex: "1" }}>
              <h2>Profiles</h2>
              {selectedTab === index && renderProfiles(config.properties.profiles)}
            </div>
            <div className="config-section" style={{ flex: "1" }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <h2>
                  Defaults
                  <button className="add-default-button" title="Add new default" onClick={onAddDefault} style={{ marginLeft: 8 }}>
                    <span className="codicon codicon-add"></span>
                  </button>
                </h2>
              </div>
              {selectedTab === index && renderDefaults(config.properties.defaults)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
