interface PanelsProps {
  configurations: { configPath: string; properties: any; secure: string[] }[];
  selectedTab: number | null;
  renderProfiles: (profilesObj: any) => React.ReactNode;
  renderDefaults: (defaultsObj: any) => React.ReactNode;
}

export function Panels({ configurations, selectedTab, renderProfiles, renderDefaults }: PanelsProps) {
  return (
    <div className="panels">
      {configurations.map((config, index) => (
        <div key={index} className={`panel ${selectedTab === index ? "active" : ""}`}>
          <div className="config-section">
            <h2>Profiles</h2>
            {selectedTab === index && renderProfiles(config.properties.profiles)}
          </div>
          <div className="config-section">
            <h2>Defaults</h2>
            {selectedTab === index && renderDefaults(config.properties.defaults)}
          </div>
        </div>
      ))}
    </div>
  );
}
