interface TabsProps {
  configurations: { configPath: string; properties: any; secure: string[] }[];
  selectedTab: number | null;
  onTabChange: (index: number) => void;
}

export function Tabs({ configurations, selectedTab, onTabChange }: TabsProps) {
  return (
    <div className="tabs">
      {configurations.map((config, index) => (
        <div key={index} className={`tab ${selectedTab === index ? "active" : ""}`} onClick={() => onTabChange(index)}>
          {config.configPath}
        </div>
      ))}
    </div>
  );
}
