import React from "react";
import VscodeToolbarButton from "@vscode-elements/react-elements/dist/components/VscodeToolbarButton.js";
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
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
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
  onUndo,
  onRedo,
  canUndo,
  canRedo,
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
    natural: l10n.t("File Order"),
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
              <div className="section-card profiles-card">
                <div className="profile-heading-container" data-tutorial-id="profiles-heading">
                  <button className="profiles-toggle-button" onClick={toggleProfilesCollapse}>
                    <span className={`codicon ${profilesCollapsed ? "codicon-chevron-right" : "codicon-chevron-down"}`}></span>
                    <h2>{l10n.t("Profiles")}</h2>
                  </button>
                  {!profilesCollapsed && (
                    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                      <SortDropdown
                        options={PROFILE_SORT_OPTIONS as unknown as ProfileSortOrder[]}
                        selectedOption={(profileSortOrder as ProfileSortOrder) ?? "natural"}
                        onOptionChange={(opt) => setProfileSortOrderWithStorage(opt)}
                        getDisplayName={(opt) => profileSortDisplayNames[opt]}
                        icon="codicon-list-filter"
                      />
                      <VscodeToolbarButton
                        title={viewMode === "tree" ? l10n.t("Switch to flat view") : l10n.t("Switch to tree view")}
                        onClick={onViewModeToggle}
                        data-testid="view-mode-toggle"
                        data-current-view={viewMode}
                      >
                        <span className={`codicon ${viewMode === "tree" ? "codicon-list-flat" : "codicon-list-tree"}`}></span>
                      </VscodeToolbarButton>
                      <VscodeToolbarButton title={l10n.t("Profile Wizard")} onClick={onProfileWizard} data-testid="profile-wizard-button">
                        <span className="codicon codicon-add"></span>
                      </VscodeToolbarButton>
                    </div>
                  )}
                </div>
                {selectedTab === index && !profilesCollapsed && (
                  <div className="profile-list-container" data-tutorial-id="profiles-list">
                    {renderProfiles(config.properties.profiles)}
                  </div>
                )}
              </div>

              {/* Collapsible Defaults Section */}
              {selectedTab === index && (
                <div className="config-section defaults-section section-card" data-tutorial-id="defaults-section">
                  <div className="defaults-heading-container">
                    <button className="defaults-toggle-button" onClick={toggleDefaultsCollapse}>
                      <span className={`codicon ${defaultsCollapsed ? "codicon-chevron-right" : "codicon-chevron-down"}`}></span>
                      <h2>{l10n.t("Defaults")}</h2>
                    </button>
                  </div>
                  {!defaultsCollapsed && <div className="defaults-content">{renderDefaults(config.properties.defaults)}</div>}
                </div>
              )}
            </div>
            <div className="resize-divider" id={`resize-divider-${index}`}></div>
            <div className="config-section profile-details-section section-card" data-tutorial-id="profile-details-panel">
              {selectedTab === index && (
                <div className="profile-details-content">
                  {renderProfileDetails()}
                  <Footer
                    onClearChanges={onClearChanges}
                    onSaveAll={onSaveAll}
                    hasPendingChanges={hasPendingChanges}
                    onUndo={onUndo}
                    onRedo={onRedo}
                    canUndo={canUndo}
                    canRedo={canRedo}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
