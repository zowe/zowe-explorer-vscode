interface PanelsProps {
  configurations: { configPath: string; properties: any; secure: string[] }[];
  selectedTab: number | null;
  renderProfiles: (profilesObj: any) => React.ReactNode;
}

export function Panels({ configurations, selectedTab, renderProfiles }: PanelsProps) {
  return (
    <div className="panels">
      {configurations.map((config, index) => (
        <div key={index} className={`panel ${selectedTab === index ? "active" : ""}`}>
          <div className="config-section">
            <h2>Profiles</h2>
            {selectedTab === index && renderProfiles(config.properties.profiles)}
          </div>
        </div>
      ))}
    </div>
  );
}
