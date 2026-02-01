/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 */

import { useCallback } from "react";

import { RenderConfig } from "./renderConfig";
import { flattenProfiles, PropertySortOrder, ensureProfileProperties, isMergedPropertySecure, getOriginalProfileKey, getPropertyDescriptions } from "../utils";
import { getProfileNameForMergedProperties } from "../utils/renameUtils";
import * as l10n from "@vscode/l10n";
import { useConfigContext } from "../context/ConfigContext";
import { useUtilityHelpers } from "../hooks/useUtilityHelpers";

const SORT_ORDER_OPTIONS: PropertySortOrder[] = ["alphabetical", "merged-first", "non-merged-first"];

interface RenderProfileDetailsProps {
  handleSetAsDefault: (profileKey: string) => void;
  setRenameProfileModalOpen: (open: boolean) => void;
  handleDeleteProfile: (profileKey: string) => void;
  handleChange: (key: string, value: string) => void;
  handleDeleteProperty: (fullKey: string, secure?: boolean) => void;
  confirmDeleteProperty: (fullKey: string, secure?: boolean) => void;
  pendingPropertyDeletion: string | null;
  setPendingPropertyDeletion: (key: string | null) => void;
  confirmDeleteProfile: (profileKey: string) => void;
  pendingProfileDeletion: string | null;
  setPendingProfileDeletion: (key: string | null) => void;
  handleUnlinkMergedProperty: (propertyKey: string | undefined, fullKey: string) => void;
  handleNavigateToSource: (jsonLoc: string, osLoc?: string[]) => void;
  openAddProfileModalAtPath: (path: string[], key?: string, value?: string) => void;
}

export const RenderProfileDetails = ({
  handleSetAsDefault,
  setRenameProfileModalOpen,
  handleDeleteProfile,
  handleChange,
  handleDeleteProperty,
  confirmDeleteProperty,
  pendingPropertyDeletion,
  setPendingPropertyDeletion,
  confirmDeleteProfile,
  pendingProfileDeletion,
  setPendingProfileDeletion,
  handleUnlinkMergedProperty,
  handleNavigateToSource,
  openAddProfileModalAtPath,
}: RenderProfileDetailsProps) => {
  const {
    selectedProfileKey,
    configurations,
    selectedTab,
    vscodeApi,
    configEditorSettings,
    sortOrderVersion,
    pendingChanges,
    deletions,
    renames,
    schemaValidations,
    hiddenItems,
    secureValuesAllowed,
    mergedProperties,
    setPendingDefaults,
    setShowMergedPropertiesWithStorage,
  } = useConfigContext();

  const { showMergedProperties, propertySortOrder } = configEditorSettings;

  const {
    isProfileDefault,
    getProfileType,
    getWizardTypeOptions,
    extractPendingProfiles,
    mergePendingChangesForProfile,
    mergeMergedProperties,
    filterSecureProperties,
    mergePendingSecureProperties,
    isCurrentProfileUntyped,
    isPropertyFromMergedProps,
    isPropertySecure,
    canPropertyBeSecure,
    isProfileAffectedByDragDrop,
    handleToggleSecure,
  } = useUtilityHelpers();

  const renderProfileDetails = useCallback(() => {
    const profileDetailsHeader = l10n.t("Profile Details");
    return (
      <div>
        <div className="profile-heading-container">
          <h2
            title={selectedProfileKey || profileDetailsHeader}
            style={{
              margin: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "200px",
            }}
          >
            {selectedProfileKey || profileDetailsHeader}
          </h2>
          {selectedProfileKey && (
            <div className="profile-actions">
              <button
                className="profile-action-button"
                id="open-with-highlight"
                onClick={() => {
                  const configPath = configurations[selectedTab!]?.configPath;
                  if (configPath) {
                    vscodeApi.postMessage({
                      command: "OPEN_CONFIG_FILE_WITH_PROFILE",
                      filePath: configPath,
                      profileKey: selectedProfileKey,
                    });
                  }
                }}
                title={l10n.t("Open config file with profile highlighted")}
              >
                <span className="codicon codicon-go-to-file"></span>
              </button>
              <button
                className="profile-action-button"
                id="set-as-default"
                onClick={() => {
                  if (isProfileDefault(selectedProfileKey)) {
                    const profileType = getProfileType(selectedProfileKey, selectedTab, configurations, pendingChanges, renames);
                    if (profileType) {
                      const configPath = configurations[selectedTab!]!.configPath;
                      setPendingDefaults((prev) => ({
                        ...prev,
                        [configPath]: {
                          ...prev[configPath],
                          [profileType]: { value: "", path: [profileType] },
                        },
                      }));
                    }
                  } else {
                    handleSetAsDefault(selectedProfileKey);
                  }
                }}
                title={isProfileDefault(selectedProfileKey) ? l10n.t("Click to remove default") : l10n.t("Set as default")}
              >
                <span className={`codicon codicon-${isProfileDefault(selectedProfileKey) ? "star-full" : "star-empty"}`}></span>
              </button>

              <button
                className="profile-action-button"
                id="rename-profile"
                onClick={() => setRenameProfileModalOpen(true)}
                title={
                  selectedProfileKey && isProfileAffectedByDragDrop(selectedProfileKey)
                    ? l10n.t(
                        "Cannot rename: This profile or a related profile has been moved via drag-and-drop. Save and refresh to enable renaming."
                      )
                    : l10n.t("Rename profile")
                }
                disabled={selectedProfileKey ? isProfileAffectedByDragDrop(selectedProfileKey) : false}
                style={{
                  opacity: selectedProfileKey && isProfileAffectedByDragDrop(selectedProfileKey) ? 0.5 : 1,
                  cursor: selectedProfileKey && isProfileAffectedByDragDrop(selectedProfileKey) ? "not-allowed" : "pointer",
                }}
              >
                <span className="codicon codicon-edit"></span>
              </button>
              {pendingProfileDeletion === selectedProfileKey ? (
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button
                    className="profile-action-button"
                    onClick={() => confirmDeleteProfile(selectedProfileKey)}
                    title={l10n.t("Confirm delete")}
                    style={{ color: "var(--vscode-errorForeground)" }}
                  >
                    <span className="codicon codicon-check"></span>
                  </button>
                  <button className="profile-action-button" onClick={() => setPendingProfileDeletion(null)} title={l10n.t("Cancel")}>
                    <span className="codicon codicon-close"></span>
                  </button>
                </div>
              ) : (
                <button
                  className="profile-action-button"
                  id="delete-profile"
                  onClick={() => handleDeleteProfile(selectedProfileKey)}
                  title={l10n.t("Delete profile")}
                >
                  <span className="codicon codicon-trash"></span>
                </button>
              )}
            </div>
          )}
        </div>
        {selectedProfileKey &&
          (() => {
            const currentConfig = configurations[selectedTab!];
            if (!currentConfig) {
              return null;
            }
            const flatProfiles = flattenProfiles(currentConfig.properties?.profiles || {});
            const currentConfigPath = currentConfig.configPath;
            const pendingProfiles = extractPendingProfiles(currentConfigPath);

            let effectiveProfileKey = selectedProfileKey;
            if (renames[currentConfigPath] && Object.keys(renames[currentConfigPath]).length > 0) {
              const sortedRenames = Object.entries(renames[currentConfigPath]).sort(([, a], [, b]) => b.length - a.length);
              let changed = true;
              while (changed) {
                changed = false;
                for (const [originalKey, newKey] of sortedRenames) {
                  if (effectiveProfileKey === newKey) {
                    effectiveProfileKey = originalKey;
                    changed = true;
                    break;
                  }
                  if (effectiveProfileKey.startsWith(newKey + ".")) {
                    effectiveProfileKey = effectiveProfileKey.replace(newKey + ".", originalKey + ".");
                    changed = true;
                    break;
                  }
                }
              }
            }

            let effectivePath: string[];
            const hasPendingChanges = Array.isArray(pendingProfiles)
                ? pendingProfiles.includes(selectedProfileKey)
                : Object.prototype.hasOwnProperty.call(pendingProfiles, selectedProfileKey);
            const pathProfileKey =
                hasPendingChanges || selectedProfileKey !== effectiveProfileKey ? selectedProfileKey : effectiveProfileKey;

            const profilePathParts = pathProfileKey.split(".");
            if (profilePathParts.length === 1) {
              effectivePath = ["profiles", pathProfileKey];
            } else {
              effectivePath = ["profiles"];
              for (let i = 0; i < profilePathParts.length; i++) {
                effectivePath.push(profilePathParts[i]);
                if (i < profilePathParts.length - 1) {
                  effectivePath.push("profiles");
                }
              }
            }

            const effectiveProfile =
              flatProfiles[effectiveProfileKey] || pendingProfiles[effectiveProfileKey] || pendingProfiles[selectedProfileKey] || {};

            Object.values(renames[currentConfigPath] || {}).some((newKey) => {
              if (newKey === selectedProfileKey) return true;
              const profileParts = selectedProfileKey.split(".");
              for (let i = 1; i <= profileParts.length; i++) {
                const parentKey = profileParts.slice(0, i).join(".");
                if (Object.values(renames[currentConfigPath] || {}).some((renamedKey) => renamedKey === parentKey)) {
                  return true;
                }
              }
              return false;
            });
            const shouldShowMergedProperties = showMergedProperties !== "hide";
            const propertyDescriptions =
              selectedTab !== null && currentConfig
                ? getPropertyDescriptions(
                    effectivePath,
                    selectedTab,
                    configurations,
                    schemaValidations,
                    getProfileType,
                    pendingChanges,
                    renames
                  )
                : {};

            return (
              <div key={`${selectedProfileKey}-${propertySortOrder}-${sortOrderVersion}`}>
                <RenderConfig
                  obj={effectiveProfile}
                  path={effectivePath}
                  mergedProps={shouldShowMergedProperties ? mergedProperties : null}
                  configurations={configurations}
                  selectedTab={selectedTab}
                  pendingChanges={pendingChanges}
                  deletions={deletions}
                  showMergedProperties={showMergedProperties}
                  propertySortOrder={propertySortOrder}
                  sortOrderVersion={sortOrderVersion}
                  selectedProfileKey={selectedProfileKey}
                  schemaValidations={schemaValidations}
                  renames={renames}
                  hiddenItems={hiddenItems}
                  secureValuesAllowed={secureValuesAllowed}
                  SORT_ORDER_OPTIONS={SORT_ORDER_OPTIONS}
                  propertyDescriptions={propertyDescriptions}
                  handleChange={handleChange}
                  handleDeleteProperty={handleDeleteProperty}
                  confirmDeleteProperty={confirmDeleteProperty}
                  pendingPropertyDeletion={pendingPropertyDeletion}
                  setPendingPropertyDeletion={setPendingPropertyDeletion}
                  handleUnlinkMergedProperty={handleUnlinkMergedProperty}
                  handleNavigateToSource={handleNavigateToSource}
                  handleToggleSecure={handleToggleSecure}
                  openAddProfileModalAtPath={openAddProfileModalAtPath}
                  getWizardTypeOptions={getWizardTypeOptions}
                  mergePendingChangesForProfile={mergePendingChangesForProfile}
                  mergeMergedProperties={mergeMergedProperties}
                  ensureProfileProperties={ensureProfileProperties}
                  filterSecureProperties={filterSecureProperties}
                  mergePendingSecureProperties={mergePendingSecureProperties}
                  isCurrentProfileUntyped={isCurrentProfileUntyped}
                  isPropertyFromMergedProps={isPropertyFromMergedProps}
                  isPropertySecure={isPropertySecure}
                  canPropertyBeSecure={canPropertyBeSecure}
                  isMergedPropertySecure={isMergedPropertySecure}
                  vscodeApi={vscodeApi}
                />
              </div>
            );
          })()}
      </div>
    );
  }, [
    selectedProfileKey,
    configurations,
    selectedTab,
    vscodeApi,
    isProfileDefault,
    getProfileType,
    handleSetAsDefault,
    setPendingDefaults,
    showMergedProperties,
    setShowMergedPropertiesWithStorage,
    setRenameProfileModalOpen,
    handleDeleteProfile,
    pendingChanges,
    deletions,
    renames,
    schemaValidations,
    extractPendingProfiles,
    getOriginalProfileKey,
    getProfileNameForMergedProperties,
    propertySortOrder,
    sortOrderVersion,
    mergedProperties,
  ]);

  return renderProfileDetails();
};
