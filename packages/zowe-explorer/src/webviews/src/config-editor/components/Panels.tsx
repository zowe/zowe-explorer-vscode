import React from "react";

// Profile sort order options
const PROFILE_SORT_ORDER_OPTIONS: ("natural" | "alphabetical" | "reverse-alphabetical")[] = ["natural", "alphabetical", "reverse-alphabetical"];

// Helper function to get user-friendly display name for profile sort order
const getProfileSortOrderDisplayName = (sortOrder: "natural" | "alphabetical" | "reverse-alphabetical"): string => {
  switch (sortOrder) {
    case "natural":
      return "Natural";
    case "alphabetical":
      return "Alphabetical";
    case "reverse-alphabetical":
      return "Reverse Alphabetical";
    default:
      return sortOrder;
  }
};

interface PanelsProps {
  configurations: { configPath: string; properties: any; secure: string[]; global?: boolean; user?: boolean; schemaPath?: string }[];
  selectedTab: number | null;
  renderProfiles: (profilesObj: any) => React.ReactNode;
  renderDefaults: (defaultsObj: any) => React.ReactNode;
  renderProfileDetails: () => React.ReactNode;
  onProfileWizard: () => void;
  viewMode: "flat" | "tree";
  onViewModeToggle: () => void;
  // Profile sort order props
  profileSortOrder: "natural" | "alphabetical" | "reverse-alphabetical";
  onProfileSortOrderChange: (sortOrder: "natural" | "alphabetical" | "reverse-alphabetical") => void;
}

export function Panels({
  configurations,
  selectedTab,
  renderProfiles,
  renderDefaults,
  renderProfileDetails,
  onProfileWizard,
  viewMode,
  onViewModeToggle,
  profileSortOrder,
  onProfileSortOrderChange,
}: PanelsProps) {
  return (
    <div className="panels">
      {configurations.map((config, index) => (
        <div key={index} className={`panel ${selectedTab === index ? "active" : ""}`}>
          <div className="panel-content">
            <div className="config-section profiles-section">
              <div className="profile-heading-container">
                <h2
                  style={{
                    cursor: "pointer",
                    userSelect: "none",
                    textDecoration: "underline",
                  }}
                  onClick={() => {
                    const currentIndex = PROFILE_SORT_ORDER_OPTIONS.indexOf(profileSortOrder);
                    const nextIndex = (currentIndex + 1) % PROFILE_SORT_ORDER_OPTIONS.length;
                    const newSortOrder = PROFILE_SORT_ORDER_OPTIONS[nextIndex];
                    onProfileSortOrderChange(newSortOrder);
                  }}
                  title={`Click to change sort order. Current: ${getProfileSortOrderDisplayName(profileSortOrder)}`}
                >
                  Profiles
                </h2>
                <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                  <button
                    className="header-button"
                    title={viewMode === "tree" ? "Switch to flat view" : "Switch to tree view"}
                    onClick={onViewModeToggle}
                    data-testid="view-mode-toggle"
                    data-current-view={viewMode}
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
            <div className="config-section profile-details-section">{selectedTab === index && renderProfileDetails()}</div>
            <div className="config-section defaults-section">
              <div className="defaults-heading-container">
                <h2>Defaults</h2>
              </div>
              {selectedTab === index && renderDefaults(config.properties.defaults)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
