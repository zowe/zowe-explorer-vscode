import React from "react";
import { Footer } from "./Footer";
import * as l10n from "@vscode/l10n";
import { useConfigContext } from "../context/ConfigContext";
import { SortDropdown } from "./SortDropdown";

interface PanelsProps {
  renderProfiles: (profilesObj: any) => React.ReactNode;
  renderDefaults: (defaultsObj: any) => React.ReactNode;
  renderProfileDetails: () => React.ReactNode;
  onProfileWizard: () => void;
  onViewModeToggle: () => void;
  onClearChanges: () => void;
  onSaveAll: () => void;
  hasPendingChanges: boolean;
}

export function Panels({
  renderProfiles,
  renderDefaults,
  renderProfileDetails,
  onProfileWizard,
  onViewModeToggle,
  onClearChanges,
  onSaveAll,
  hasPendingChanges,
}: PanelsProps) {
  const {
    configurations,
    selectedTab,
    configEditorSettings,
    setDefaultsCollapsedWithStorage,
    setProfilesCollapsedWithStorage,
    setProfileSortOrderWithStorage,
  } = useConfigContext();

  const { viewMode, defaultsCollapsed, profilesCollapsed, profileSortOrder } = configEditorSettings;

  const PROFILE_SORT_OPTIONS = ["natural", "alphabetical", "reverse-alphabetical", "type", "defaults"] as const;
  type ProfileSortOrder = (typeof PROFILE_SORT_OPTIONS)[number];

  const profileSortDisplayNames: Record<ProfileSortOrder, string> = {
    natural: l10n.t("Natural"),
    alphabetical: l10n.t("Alphabetical"),
    "reverse-alphabetical": l10n.t("Reverse Alphabetical"),
    type: l10n.t("By Type"),
    defaults: l10n.t("By Defaults"),
  };

  const toggleDefaultsCollapse = () => {
    setDefaultsCollapsedWithStorage(!defaultsCollapsed);
  };

  const toggleProfilesCollapse = () => {
    setProfilesCollapsedWithStorage(!profilesCollapsed);
  };

  return (
    <div className="panels">
      {configurations.map((config, index) => (
        <div key={index} className={`panel ${selectedTab === index ? "active" : ""}`}>
          <div className="panel-content">
            <div className="config-section profiles-section">
              <div className="profile-heading-container" data-tutorial-id="profiles-heading">
                <button
                  className="profiles-toggle-button"
                  onClick={toggleProfilesCollapse}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    gap: "8px",
                    flex: "1 1 auto",
                    minWidth: 0,
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
                  <h2 style={{ margin: 0, fontSize: "16px" }}>{l10n.t("Profiles")}</h2>
                </button>
                {!profilesCollapsed && (
                  <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                    <SortDropdown
                      options={PROFILE_SORT_OPTIONS as unknown as ProfileSortOrder[]}
                      selectedOption={(profileSortOrder as ProfileSortOrder) ?? "natural"}
                      onOptionChange={(opt) => setProfileSortOrderWithStorage(opt)}
                      getDisplayName={(opt) => profileSortDisplayNames[opt]}
                      icon="codicon-sort-precedence"
                    />
                    <button
                      className="ce-icon-button"
                      title={viewMode === "tree" ? l10n.t("Switch to flat view") : l10n.t("Switch to tree view")}
                      onClick={onViewModeToggle}
                      data-testid="view-mode-toggle"
                      data-current-view={viewMode}
                    >
                      <span className={`codicon ${viewMode === "tree" ? "codicon-list-flat" : "codicon-list-tree"}`}></span>
                    </button>
                    <button className="ce-icon-button" title={l10n.t("Profile Wizard")} onClick={onProfileWizard}>
                      <span className="codicon codicon-add"></span>
                    </button>
                  </div>
                )}
              </div>
              {selectedTab === index && !profilesCollapsed && (
                <div className="profile-list-container" data-tutorial-id="profiles-list">
                  {renderProfiles(config.properties.profiles)}
                </div>
              )}

              {/* Collapsible Defaults Section */}
              {selectedTab === index && (
                <div className="config-section defaults-section" data-tutorial-id="defaults-section">
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
                      <h2 style={{ margin: 0, fontSize: "16px" }}>{l10n.t("Defaults")}</h2>
                    </button>
                  </div>
                  {!defaultsCollapsed && <div className="defaults-content">{renderDefaults(config.properties.defaults)}</div>}
                </div>
              )}
            </div>
            <div className="resize-divider" id={`resize-divider-${index}`}></div>
            <div className="config-section profile-details-section" data-tutorial-id="profile-details-panel">
              {selectedTab === index && (
                <div className="profile-details-content">
                  {renderProfileDetails()}
                  <Footer onClearChanges={onClearChanges} onSaveAll={onSaveAll} hasPendingChanges={hasPendingChanges} />
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
