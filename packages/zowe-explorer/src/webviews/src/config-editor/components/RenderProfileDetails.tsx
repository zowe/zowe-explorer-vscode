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

// Components
import { RenderConfig } from "./renderConfig";

// Utils
import { flattenProfiles, getOriginalProfileKeyWithNested, PropertySortOrder, schemaValidation } from "../utils";

// Types
type Configuration = {
  configPath: string;
  properties: any;
  secure: string[];
  global?: boolean;
  user?: boolean;
  schemaPath?: string;
};

type PendingChange = {
  value: string | number | boolean | Record<string, any>;
  path: string[];
  profile: string;
  secure?: boolean;
};

type PendingDefault = {
  value: string;
  path: string[];
};

// Props interface for the RenderProfileDetails component
interface RenderProfileDetailsProps {
  selectedProfileKey: string | null;
  configurations: Configuration[];
  selectedTab: number | null;
  vscodeApi: any;
  showMergedProperties: boolean;
  propertySortOrder: PropertySortOrder;
  sortOrderVersion: number;
  pendingChanges: { [configPath: string]: { [key: string]: PendingChange } };
  deletions: { [configPath: string]: string[] };
  renames: { [configPath: string]: { [oldName: string]: string } };
  schemaValidations: { [configPath: string]: schemaValidation | undefined };
  hiddenItems: { [configPath: string]: { [key: string]: { path: string } } };
  secureValuesAllowed: boolean;
  SORT_ORDER_OPTIONS: PropertySortOrder[];
  mergedProperties: any;
  pendingDefaults: { [configPath: string]: { [key: string]: PendingDefault } };

  // Handler functions
  isProfileDefault: (profileKey: string) => boolean;
  getProfileType: (
    profileKey: string,
    selectedTab: number | null,
    configurations: Configuration[],
    pendingChanges: { [configPath: string]: { [key: string]: PendingChange } },
    renames: { [configPath: string]: { [oldName: string]: string } }
  ) => string | null;
  handleSetAsDefault: (profileKey: string) => void;
  setPendingDefaults: React.Dispatch<React.SetStateAction<{ [configPath: string]: { [key: string]: PendingDefault } }>>;
  setShowMergedPropertiesWithStorage: (value: boolean) => void;
  setRenameProfileModalOpen: (open: boolean) => void;
  handleDeleteProfile: (profileKey: string) => void;
  handleChange: (key: string, value: string) => void;
  handleDeleteProperty: (fullKey: string, secure?: boolean) => void;
  handleUnlinkMergedProperty: (propertyKey: string | undefined, fullKey: string) => void;
  handleNavigateToSource: (jsonLoc: string, osLoc?: string[]) => void;
  handleToggleSecure: (fullKey: string, displayKey: string, path: string[]) => void;
  openAddProfileModalAtPath: (path: string[]) => void;
  setPropertySortOrderWithStorage: (order: PropertySortOrder) => void;
  getWizardTypeOptions: () => string[];

  // Utility functions
  extractPendingProfiles: (configPath: string) => { [key: string]: any };
  getOriginalProfileKey: (profileKey: string, configPath: string, renames: { [configPath: string]: { [oldName: string]: string } }) => string;
  getProfileNameForMergedProperties: (
    profileKey: string,
    configPath: string,
    renames: { [configPath: string]: { [oldName: string]: string } }
  ) => string;
  mergePendingChangesForProfile: (baseObj: any, path: string[], configPath: string) => any;
  mergeMergedProperties: (combinedConfig: any, path: string[], mergedProps: any, configPath: string) => any;
  ensureProfileProperties: (combinedConfig: any, path: string[]) => any;
  filterSecureProperties: (value: any, combinedConfig: any, configPath?: string) => any;
  mergePendingSecureProperties: (value: any[], path: string[], configPath: string) => any[];
  isCurrentProfileUntyped: () => boolean;
  isPropertyFromMergedProps: (displayKey: string | undefined, path: string[], mergedProps: any, configPath: string) => boolean;
  isPropertySecure: (fullKey: string, displayKey: string, path: string[], mergedProps?: any) => boolean;
  canPropertyBeSecure: (displayKey: string, path: string[]) => boolean;
  isMergedPropertySecure: (displayKey: string, jsonLoc: string, _osLoc?: string[], secure?: boolean) => boolean;
  isProfileAffectedByDragDrop: (profileKey: string) => boolean;

}

export const RenderProfileDetails = ({
  selectedProfileKey,
  configurations,
  selectedTab,
  vscodeApi,
  showMergedProperties,
  propertySortOrder,
  sortOrderVersion,
  pendingChanges,
  deletions,
  renames,
  schemaValidations,
  hiddenItems,
  secureValuesAllowed,
  SORT_ORDER_OPTIONS,
  mergedProperties,
  isProfileDefault,
  getProfileType,
  handleSetAsDefault,
  setPendingDefaults,
  setShowMergedPropertiesWithStorage,
  setRenameProfileModalOpen,
  handleDeleteProfile,
  handleChange,
  handleDeleteProperty,
  handleUnlinkMergedProperty,
  handleNavigateToSource,
  handleToggleSecure,
  openAddProfileModalAtPath,
  setPropertySortOrderWithStorage,
  getWizardTypeOptions,
  extractPendingProfiles,
  getOriginalProfileKey,
  getProfileNameForMergedProperties,
  mergePendingChangesForProfile,
  mergeMergedProperties,
  ensureProfileProperties,
  filterSecureProperties,
  mergePendingSecureProperties,
  isCurrentProfileUntyped,
  isPropertyFromMergedProps,
  isPropertySecure,
  canPropertyBeSecure,
  isMergedPropertySecure,
  isProfileAffectedByDragDrop,
}: RenderProfileDetailsProps) => {
  const renderProfileDetails = useCallback(() => {
    return (
      <div>
        <div className="profile-heading-container">
          <h2 title={selectedProfileKey || "Profile Details"}>{selectedProfileKey || "Profile Details"}</h2>
          {selectedProfileKey && (
            <div className="profile-actions">
              <button
                className="profile-action-button"
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
                title="Open config file with profile highlighted"
              >
                <span className="codicon codicon-go-to-file"></span>
              </button>
              <button
                className="profile-action-button"
                onClick={() => {
                  if (isProfileDefault(selectedProfileKey)) {
                    // If already default, deselect it by setting to empty
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
                    // Set as default
                    handleSetAsDefault(selectedProfileKey);
                  }
                }}
                title={isProfileDefault(selectedProfileKey) ? "Click to remove default" : "Set as default"}
              >
                <span className={`codicon codicon-${isProfileDefault(selectedProfileKey) ? "star-full" : "star-empty"}`}></span>
              </button>
              <button
                className="profile-action-button"
                onClick={() => setShowMergedPropertiesWithStorage(!showMergedProperties)}
                title={showMergedProperties ? "Hide merged properties" : "Show merged properties"}
              >
                <span className={`codicon codicon-${showMergedProperties ? "eye-closed" : "eye"}`}></span>
              </button>
              <button
                className="profile-action-button"
                onClick={() => setRenameProfileModalOpen(true)}
                title={
                  selectedProfileKey && isProfileAffectedByDragDrop(selectedProfileKey)
                    ? "Cannot rename: This profile or a related profile has been moved via drag-and-drop. Save and refresh to enable renaming."
                    : "Rename profile"
                }
                disabled={selectedProfileKey ? isProfileAffectedByDragDrop(selectedProfileKey) : false}
                style={{
                  opacity: selectedProfileKey && isProfileAffectedByDragDrop(selectedProfileKey) ? 0.5 : 1,
                  cursor: selectedProfileKey && isProfileAffectedByDragDrop(selectedProfileKey) ? "not-allowed" : "pointer"
                }}
              >
                <span className="codicon codicon-edit"></span>
              </button>
              <button className="profile-action-button" onClick={() => handleDeleteProfile(selectedProfileKey)} title="Delete profile">
                <span className="codicon codicon-trash"></span>
              </button>
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
            const configPath = currentConfig.configPath;

            // Use the helper function to extract pending profiles
            const pendingProfiles = extractPendingProfiles(configPath);

            // For profile data lookup, we need to find where the data is actually stored in the original configuration
            // The data is always stored at the original location before any renames
            // We need to reverse all renames to get to the original location
            let effectiveProfileKey = selectedProfileKey;

            // Apply reverse renames step by step
            if (renames[configPath] && Object.keys(renames[configPath]).length > 0) {
              const configRenames = renames[configPath];

              // Sort renames by length of newKey (longest first) to handle nested renames correctly
              const sortedRenames = Object.entries(configRenames).sort(([, a], [, b]) => b.length - a.length);

              let changed = true;

              // Keep applying reverse renames until no more changes
              while (changed) {
                changed = false;

                // Process renames from longest to shortest to handle nested cases
                for (const [originalKey, newKey] of sortedRenames) {
                  // Check for exact match
                  if (effectiveProfileKey === newKey) {
                    effectiveProfileKey = originalKey;
                    changed = true;
                    break;
                  }

                  // Check for partial matches (parent renames affecting children)
                  if (effectiveProfileKey.startsWith(newKey + ".")) {
                    effectiveProfileKey = effectiveProfileKey.replace(newKey + ".", originalKey + ".");
                    changed = true;
                    break;
                  }
                }
              }
            }

            let effectivePath: string[];

            // Construct the profile path using the effective profile key
            const effectiveProfilePathParts = effectiveProfileKey.split(".");
            if (effectiveProfilePathParts.length === 1) {
              // Top-level profile
              effectivePath = ["profiles", effectiveProfileKey];
            } else {
              // Nested profile - need to construct path like ["profiles", "project_base", "profiles", "tso"]
              effectivePath = ["profiles"];
              for (let i = 0; i < effectiveProfilePathParts.length; i++) {
                effectivePath.push(effectiveProfilePathParts[i]);
                if (i < effectiveProfilePathParts.length - 1) {
                  effectivePath.push("profiles");
                }
              }
            }

            // Pass the effective profile object (without pending changes) to renderConfig
            // so that renderConfig can properly combine existing and pending changes
            // For newly created profiles, use the pending profile data as the base
            const effectiveProfile = flatProfiles[effectiveProfileKey] || pendingProfiles[effectiveProfileKey] || {};

            // Check if this profile has pending renames - if so, don't show merged properties
            // We need to check if the selected profile key is a renamed version of another profile
            // OR if any of its parent profiles have been renamed
            Object.values(renames[configPath] || {}).some((newKey) => {
              // Check if this profile is directly renamed
              if (newKey === selectedProfileKey) return true;

              // Check if any parent profile has been renamed
              const profileParts = selectedProfileKey.split(".");
              for (let i = 1; i <= profileParts.length; i++) {
                const parentKey = profileParts.slice(0, i).join(".");
                if (Object.values(renames[configPath] || {}).some((renamedKey) => renamedKey === parentKey)) {
                  return true;
                }
              }
              return false;
            });
            // We can still show merged properties even with parent renames, as long as we request them
            // using the correct profile name (which getProfileNameForMergedProperties handles)
            const shouldShowMergedProperties = showMergedProperties;

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
                  handleChange={handleChange}
                  handleDeleteProperty={handleDeleteProperty}
                  handleUnlinkMergedProperty={handleUnlinkMergedProperty}
                  handleNavigateToSource={handleNavigateToSource}
                  handleToggleSecure={handleToggleSecure}
                  openAddProfileModalAtPath={openAddProfileModalAtPath}
                  setPropertySortOrderWithStorage={setPropertySortOrderWithStorage}
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
    extractPendingProfiles,
    getOriginalProfileKey,
    getProfileNameForMergedProperties,
    propertySortOrder,
    sortOrderVersion,
    mergedProperties,
  ]);

  return renderProfileDetails();
};
