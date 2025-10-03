import React from "react";
import { SortDropdown } from "./SortDropdown";
import { Footer } from "./Footer";

const PROFILE_SORT_ORDER_OPTIONS: ("natural" | "alphabetical" | "reverse-alphabetical" | "type" | "defaults")[] = [
  "natural",
  "alphabetical",
  "reverse-alphabetical",
  "type",
  "defaults",
];

const getProfileSortOrderDisplayName = (sortOrder: "natural" | "alphabetical" | "reverse-alphabetical" | "type" | "defaults"): string => {
  switch (sortOrder) {
    case "natural":
      return "Natural";
    case "alphabetical":
      return "Alphabetical";
    case "reverse-alphabetical":
      return "Reverse Alphabetical";
    case "type":
      return "By Type";
    case "defaults":
      return "By Defaults";
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
  profileSortOrder: "natural" | "alphabetical" | "reverse-alphabetical" | "type" | "defaults";
  onProfileSortOrderChange: (sortOrder: "natural" | "alphabetical" | "reverse-alphabetical" | "type" | "defaults") => void;
  defaultsCollapsed: boolean;
  onDefaultsCollapsedChange: (collapsed: boolean) => void;
  profilesCollapsed: boolean;
  onProfilesCollapsedChange: (collapsed: boolean) => void;
  onClearChanges: () => void;
  onSaveAll: () => void;
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
  defaultsCollapsed,
  onDefaultsCollapsedChange,
  profilesCollapsed,
  onProfilesCollapsedChange,
  onClearChanges,
  onSaveAll,
}: PanelsProps) {
  const toggleDefaultsCollapse = () => {
    onDefaultsCollapsedChange(!defaultsCollapsed);
  };

  const toggleProfilesCollapse = () => {
    onProfilesCollapsedChange(!profilesCollapsed);
  };

  return (
    <div className="panels">
      {configurations.map((config, index) => (
        <div key={index} className={`panel ${selectedTab === index ? "active" : ""}`}>
          <div className="panel-content">
            <div className="config-section profiles-section">
              <div className="profile-heading-container">
                <button
                  className="profiles-toggle-button"
                  onClick={toggleProfilesCollapse}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    gap: "8px",
                    width: "100%",
                    padding: "6px 0",
                    background: "none",
                    border: "none",
                    color: "var(--vscode-editor-foreground)",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "bold",
                    textAlign: "left",
                  }}
                >
                  <span className={`codicon ${profilesCollapsed ? "codicon-chevron-right" : "codicon-chevron-down"}`}></span>
                  <h2 style={{ margin: 0, fontSize: "16px" }}>Profiles</h2>
                </button>
                {!profilesCollapsed && (
                  <>
                    <div className="sort-dropdown-container">
                      <SortDropdown<"natural" | "alphabetical" | "reverse-alphabetical" | "type" | "defaults">
                        options={PROFILE_SORT_ORDER_OPTIONS}
                        selectedOption={profileSortOrder}
                        onOptionChange={onProfileSortOrderChange}
                        getDisplayName={getProfileSortOrderDisplayName}
                      />
                    </div>
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
                          color: "var(--vscode-editor-foreground)",
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
                          color: "var(--vscode-editor-foreground)",
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
                  </>
                )}
              </div>
              {selectedTab === index && !profilesCollapsed && (
                <div className="profile-list-container">{renderProfiles(config.properties.profiles)}</div>
              )}

              {/* Collapsible Defaults Section */}
              {selectedTab === index && (
                <div className="config-section defaults-section">
                  <div className="defaults-heading-container">
                    <button
                      className="defaults-toggle-button"
                      onClick={toggleDefaultsCollapse}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        width: "100%",
                        padding: "8px 0",
                        background: "none",
                        border: "none",
                        color: "var(--vscode-editor-foreground)",
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: "bold",
                      }}
                    >
                      <span className={`codicon ${defaultsCollapsed ? "codicon-chevron-right" : "codicon-chevron-down"}`}></span>
                      <h2 style={{ margin: 0, fontSize: "16px" }}>Defaults</h2>
                    </button>
                  </div>
                  {!defaultsCollapsed && <div className="defaults-content">{renderDefaults(config.properties.defaults)}</div>}
                </div>
              )}
            </div>
            <div className="resize-divider" id={`resize-divider-${index}`}></div>
            <div className="config-section profile-details-section">
              {selectedTab === index && <div className="profile-details-content">{renderProfileDetails()}</div>}
              {selectedTab === index && <Footer onClearChanges={onClearChanges} onSaveAll={onSaveAll} />}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
