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
import * as l10n from "@vscode/l10n";
import { cloneDeep } from "es-toolkit";
import { SortDropdown } from "./SortDropdown";
import { EnvVarAutocomplete } from "./EnvVarAutocomplete";

// Utils
import {
  flattenProfiles,
  extractProfileKeyFromPath,
  sortConfigEntries,
  stringifyValueByType,
  getProfileType,
  getOriginalProfileKeyWithNested,
  getPropertyTypeForConfigEditor,
  getSortOrderDisplayName,
  getNestedProperty,
  PropertySortOrder,
  schemaValidation,
} from "../utils";

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

// Props interface for the renderConfig component
interface RenderConfigProps {
  obj: any;
  path?: string[];
  mergedProps?: any;
  configurations: Configuration[];
  selectedTab: number | null;
  pendingChanges: { [configPath: string]: { [key: string]: PendingChange } };
  deletions: { [configPath: string]: string[] };
  showMergedProperties: boolean;
  propertySortOrder: PropertySortOrder;
  sortOrderVersion: number;
  selectedProfileKey: string | null;
  schemaValidations: { [configPath: string]: schemaValidation | undefined };
  renames: { [configPath: string]: { [oldName: string]: string } };
  hiddenItems: { [configPath: string]: { [key: string]: { path: string } } };
  secureValuesAllowed: boolean;
  SORT_ORDER_OPTIONS: PropertySortOrder[];
  propertyDescriptions: { [key: string]: string };

  // Handler functions
  handleChange: (key: string, value: string) => void;
  handleDeleteProperty: (fullKey: string, secure?: boolean) => void;
  handleUnlinkMergedProperty: (propertyKey: string | undefined, fullKey: string) => void;
  handleNavigateToSource: (jsonLoc: string, osLoc?: string[]) => void;
  handleToggleSecure: (fullKey: string, displayKey: string, path: string[]) => void;
  openAddProfileModalAtPath: (path: string[]) => void;
  setPropertySortOrderWithStorage: (order: PropertySortOrder) => void;
  getWizardTypeOptions: () => string[];

  // Utility functions
  mergePendingChangesForProfile: (baseObj: any, path: string[], configPath: string) => any;
  mergeMergedProperties: (combinedConfig: any, path: string[], mergedProps: any, configPath: string) => any;
  ensureProfileProperties: (combinedConfig: any, path: string[]) => any;
  filterSecureProperties: (value: any, combinedConfig: any, configPath?: string, pendingChanges?: any, deletions?: any, mergedProps?: any) => any;
  mergePendingSecureProperties: (
    value: any[],
    path: string[],
    configPath: string,
    pendingChanges: { [configPath: string]: { [key: string]: PendingChange } },
    renames?: { [configPath: string]: { [originalKey: string]: string } }
  ) => any[];
  isCurrentProfileUntyped: () => boolean;
  isPropertyFromMergedProps: (displayKey: string | undefined, path: string[], mergedProps: any, configPath: string) => boolean;
  isPropertySecure: (
    fullKey: string,
    displayKey: string,
    path: string[],
    mergedProps?: any,
    selectedTab?: number | null,
    configurations?: Configuration[],
    pendingChanges?: { [configPath: string]: { [key: string]: PendingChange } },
    renames?: { [configPath: string]: { [originalKey: string]: string } }
  ) => boolean;
  canPropertyBeSecure: (displayKey: string, path: string[]) => boolean;
  isMergedPropertySecure: (displayKey: string, jsonLoc: string, _osLoc?: string[], secure?: boolean) => boolean;

  // VS Code API
  vscodeApi: any;
}

export const RenderConfig = ({
  obj,
  path = [],
  mergedProps,
  configurations,
  selectedTab,
  pendingChanges,
  deletions,
  showMergedProperties,
  propertySortOrder,
  sortOrderVersion,
  selectedProfileKey,
  schemaValidations,
  renames,
  hiddenItems,
  secureValuesAllowed,
  SORT_ORDER_OPTIONS,
  propertyDescriptions,
  handleChange,
  handleDeleteProperty,
  handleUnlinkMergedProperty,
  handleNavigateToSource,
  handleToggleSecure,
  openAddProfileModalAtPath,
  setPropertySortOrderWithStorage,
  getWizardTypeOptions,
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
  vscodeApi,
}: RenderConfigProps) => {
  const renderConfig = useCallback(
    (obj: any, path: string[] = [], mergedProps?: any) => {
      const baseObj = cloneDeep(obj);
      const configPath = configurations[selectedTab!]?.configPath;
      if (!configPath) {
        return null;
      }

      // Merge pending changes
      let combinedConfig = mergePendingChangesForProfile(baseObj, path, configPath);

      // Track original properties for merged property detection
      const originalProperties = baseObj.properties || {};

      // Only merge merged properties if showMergedProperties is true and profile is not untyped
      if (showMergedProperties && mergedProps && !isCurrentProfileUntyped()) {
        combinedConfig = mergeMergedProperties(combinedConfig, path, mergedProps, configPath);
      }

      // Ensure required profile properties exist
      combinedConfig = ensureProfileProperties(combinedConfig, path);

      // Sort properties according to the specified order
      let sortedEntries: [string, any][];

      // Special handling for properties section - use custom sorting
      if (path.length > 0 && path[path.length - 1] === "properties") {
        // Lock the sort order at this level to prevent any external interference
        const lockedSortOrder = propertySortOrder;

        // Create a local sorting function that doesn't depend on external state
        const localSortProperties = (entries: [string, any][]): [string, any][] => {
          if (lockedSortOrder === "alphabetical") {
            return [...entries].sort(([a], [b]) => a.localeCompare(b));
          } else if (lockedSortOrder === "merged-first") {
            return [...entries].sort(([a], [b]) => {
              // Check if properties are merged using the current mergedProps
              const aIsMerged = a && isPropertyFromMergedProps(a, path, mergedProps, configPath);
              const bIsMerged = b && isPropertyFromMergedProps(b, path, mergedProps, configPath);

              // Merged properties come first
              if (aIsMerged && !bIsMerged) return -1;
              if (!aIsMerged && bIsMerged) return 1;

              // Within each group, sort alphabetically
              return a.localeCompare(b);
            });
          } else if (lockedSortOrder === "non-merged-first") {
            return [...entries].sort(([a], [b]) => {
              // Check if properties are merged using the current mergedProps
              const aIsMerged = a && isPropertyFromMergedProps(a, path, mergedProps, configPath);
              const bIsMerged = b && isPropertyFromMergedProps(b, path, mergedProps, configPath);

              // Non-merged properties come first
              if (!aIsMerged && bIsMerged) return -1;
              if (aIsMerged && !bIsMerged) return 1;

              // Within each group, sort alphabetically
              return a.localeCompare(b);
            });
          } else {
            // Fallback to alphabetical
            return [...entries].sort(([a], [b]) => a.localeCompare(b));
          }
        };

        // Filter out deleted properties from combinedConfig before adding to entriesForSorting
        const filteredCombinedConfig = { ...combinedConfig };
        const configPath = configurations[selectedTab!]?.configPath;
        const deletionsList = deletions[configPath] ?? [];

        // Remove deleted properties from the combined config
        Object.keys(filteredCombinedConfig).forEach((key) => {
          const propertyFullKey = [...path, key].join(".");
          if (deletionsList.includes(propertyFullKey)) {
            delete filteredCombinedConfig[key];
          }
        });

        // Add secure properties to the entries for sorting, but mark them as secure
        const entriesForSorting = Object.entries(filteredCombinedConfig);

        // Add secure properties from the parent object if they're not already in the properties
        const parentConfigPath = path.slice(0, -1);
        const parentConfig = getNestedProperty(configurations[selectedTab!]?.properties, parentConfigPath);
        if (parentConfig?.secure && Array.isArray(parentConfig.secure)) {
          parentConfig.secure.forEach((securePropertyName: string) => {
            // Only add if not already in the properties
            if (!combinedConfig.hasOwnProperty(securePropertyName)) {
              entriesForSorting.push([securePropertyName, { _isSecureProperty: true }]);
            }
          });
        }

        // Fallback: If we couldn't find secure properties through getNestedProperty, try to find them directly
        if (!parentConfig?.secure || parentConfig.secure.length === 0) {
          const currentProfileKey = extractProfileKeyFromPath(path);
          const flatProfiles = flattenProfiles(configurations[selectedTab!]?.properties?.profiles || {});
          const currentProfile = flatProfiles[currentProfileKey];
          if (currentProfile?.secure && Array.isArray(currentProfile.secure)) {
            currentProfile.secure.forEach((securePropertyName: string) => {
              if (
                !combinedConfig.hasOwnProperty(securePropertyName) &&
                !entriesForSorting.some(([existingKey]) => existingKey === securePropertyName)
              ) {
                entriesForSorting.push([securePropertyName, { _isSecureProperty: true }]);
              }
            });
          }
        }

        // Also add pending secure properties that might not be in the parent's secure array yet
        const currentProfileKey = extractProfileKeyFromPath(path);
        if (configPath && currentProfileKey) {
          Object.entries(pendingChanges[configPath] ?? {}).forEach(([key, entry]) => {
            if (entry.profile === currentProfileKey && entry.secure) {
              const keyParts = key.split(".");
              const propertyName = keyParts[keyParts.length - 1];
              // Only add if not already in the properties and not already added as a secure property
              if (!combinedConfig.hasOwnProperty(propertyName) && !entriesForSorting.some(([existingKey]) => existingKey === propertyName)) {
                entriesForSorting.push([propertyName, { _isSecureProperty: true }]);
              }
            }
          });
        }

        // Add merged properties that aren't already in the entriesForSorting
        // Mark them with a special flag so they're properly identified as merged in sorting
        if (mergedProps && showMergedProperties && selectedProfileKey) {
          // Get the current profile type and schema validation for filtering
          const currentProfileKey = extractProfileKeyFromPath(path);
          const profileType = getProfileType(currentProfileKey, selectedTab, configurations, pendingChanges, renames);
          const propertySchema = profileType ? schemaValidations[configPath]?.propertySchema[profileType] || {} : {};
          const allowedProperties = Object.keys(propertySchema);

          Object.entries(mergedProps).forEach(([propertyName, propData]: [string, any]) => {
            // Only add if:
            // 1. Not already in the entries
            // 2. Not in the original properties
            // 3. Property is allowed by the schema (only if profile has a type)
            // 4. Property is not in deletions
            const isAllowedBySchema = !profileType || allowedProperties.includes(propertyName);

            // Check if the local property is in deletions (we want to show merged properties even when local is deleted)

            if (
              !entriesForSorting.some(([existingKey]) => existingKey === propertyName) &&
              !originalProperties?.hasOwnProperty(propertyName) &&
              isAllowedBySchema
              // Note: We intentionally don't check isLocalPropertyInDeletions here because
              // we want to show merged properties even when the local property is deleted
            ) {
              // Add merged property with a special flag to identify it as merged
              entriesForSorting.push([
                propertyName,
                {
                  _isMergedProperty: true,
                  _mergedValue: propData.value,
                  _mergedData: propData,
                },
              ]);
            }
          });
        }

        sortedEntries = localSortProperties(entriesForSorting);
      } else {
        // Use default sorting for non-properties sections
        sortedEntries = sortConfigEntries(Object.entries(combinedConfig));
      }

      return sortedEntries.map(([key, value]) => {
        const currentPath = [...path, key];
        const fullKey = currentPath.join(".");
        const displayKey = key.split(".").pop();

        // Check if this property is in deletions, considering profile renames
        const isInDeletions = (() => {
          const deletionsList = deletions[configPath] ?? [];

          // Direct check with current fullKey
          if (deletionsList.includes(fullKey)) {
            return true;
          }

          // Check if this property was deleted using the original profile name
          const currentProfileKey = extractProfileKeyFromPath(path);
          const originalProfileKey = getOriginalProfileKeyWithNested(currentProfileKey, configPath, renames);

          if (originalProfileKey !== currentProfileKey) {
            // Construct the fullKey using the original profile name
            const originalPath = [...path];
            // Replace the profile key in the path with the original profile key
            const profileKeyIndex = originalPath.findIndex((_, index) => {
              // Find where the profile key starts in the path
              const pathUpToIndex = originalPath.slice(0, index + 1).join(".");
              return pathUpToIndex.includes(currentProfileKey);
            });

            if (profileKeyIndex !== -1) {
              // Reconstruct the path with the original profile key
              const pathBeforeProfile = originalPath.slice(0, profileKeyIndex);
              const pathAfterProfile = originalPath.slice(profileKeyIndex + 1);
              const originalProfileParts = originalProfileKey.split(".");

              // Insert the original profile parts into the path
              const reconstructedPath = [...pathBeforeProfile, ...originalProfileParts, ...pathAfterProfile];
              const originalFullKey = reconstructedPath.join(".");

              if (deletionsList.includes(originalFullKey)) {
                return true;
              }
            }
          }

          return false;
        })();

        // Check if this is a merged property that should be shown even if the original was deleted
        const isMergedProperty = isPropertyFromMergedProps(displayKey, path, mergedProps, configPath);

        if (isInDeletions && !isMergedProperty) {
          return null;
        }

        // Filter secure properties from properties object
        if (key === "properties") {
          const filteredValue = filterSecureProperties(value, combinedConfig, configPath, pendingChanges, deletions, mergedProps);
          // Always render the properties section, even if empty, so users can add properties
          if (filteredValue === null) {
            // Return an empty properties object instead of null so the header still renders
            value = {};
          } else {
            value = filteredValue;
          }
        }

        // Check if this is a secure property that was added for sorting
        const isSecurePropertyForSorting = typeof value === "object" && value !== null && value._isSecureProperty === true;

        // Check if this is a merged property that was added for sorting
        const isMergedPropertyForSorting = typeof value === "object" && value !== null && value._isMergedProperty === true;

        // Check if this is a sub-object or array within properties that should be rendered as a simple property
        // For merged properties, check the actual value, not the wrapper object
        const actualValueForTypeCheck = typeof value === "object" && value !== null && value._mergedValue !== undefined ? value._mergedValue : value;
        const isSubObjectOrArray =
          (typeof actualValueForTypeCheck === "object" && actualValueForTypeCheck !== null) || Array.isArray(actualValueForTypeCheck);

        const isWithinProperties = path.length > 0 && path[path.length - 1] === "properties";
        // Additional check: make sure we're not dealing with array items or other nested structures
        const isDirectProperty = !Array.isArray(value) || (Array.isArray(value) && path.length > 0 && path[path.length - 1] === "properties");
        // Exclude secure properties from simple property rendering
        const isSecureProperty = typeof value === "object" && value !== null && value._isSecureProperty === true;
        const shouldRenderAsSimpleProperty = isSubObjectOrArray && isWithinProperties && isDirectProperty && !isSecureProperty;

        const isParent =
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value) &&
          !isSecurePropertyForSorting &&
          !isMergedPropertyForSorting &&
          !shouldRenderAsSimpleProperty;
        const isArray = Array.isArray(value);
        // Check if this property is from merged properties and should use the merged value
        const isFromMergedProps = isPropertyFromMergedProps(displayKey, path, mergedProps, configPath);
        const mergedPropData = displayKey ? mergedProps?.[displayKey] : undefined;
        const isDeletedMergedProperty = isFromMergedProps && isInDeletions;

        const pendingValue =
          (pendingChanges[configPath] ?? {})[fullKey]?.value ??
          (isSecurePropertyForSorting
            ? ""
            : isMergedPropertyForSorting
            ? value._mergedValue
            : isFromMergedProps && mergedPropData
            ? mergedPropData.value
            : value);

        // Merge pending secure properties for secure arrays
        let renderValue: any[] = Array.isArray(value) ? value : [];
        if (isArray && key === "secure") {
          renderValue = mergePendingSecureProperties(value, path, configPath, pendingChanges, renames);
        }

        // Handle sub-objects and arrays within properties early to prevent recursive rendering
        if (shouldRenderAsSimpleProperty) {
          const renderComplexValue = (value: any, isMerged: boolean = false) => {
            // Extract the actual value if this is a merged property object
            const actualValue = typeof value === "object" && value !== null && value._mergedValue !== undefined ? value._mergedValue : value;

            const disabledStyle = isMerged
              ? {
                  backgroundColor: "var(--vscode-input-disabledBackground)",
                  color: "var(--vscode-disabledForeground)",
                  opacity: 0.7,
                }
              : {};

            if (Array.isArray(actualValue)) {
              return actualValue.map((item, index) => (
                <div key={index} style={{ marginLeft: "16px", marginBottom: "4px", fontSize: "0.9em", ...disabledStyle }}>
                  <span style={{ color: "var(--vscode-descriptionForeground)" }}>{index}:</span>
                  <span style={{ marginLeft: "8px", fontFamily: "monospace" }}>{String(item)}</span>
                </div>
              ));
            } else if (typeof actualValue === "object" && actualValue !== null) {
              return Object.entries(actualValue).map(([key, val]) => (
                <div key={key} style={{ marginLeft: "16px", marginBottom: "4px", fontSize: "0.9em", ...disabledStyle }}>
                  <span style={{ color: "var(--vscode-descriptionForeground)" }}>{key}:</span>
                  <span style={{ marginLeft: "8px", fontFamily: "monospace" }}>{String(val)}</span>
                </div>
              ));
            } else {
              // For primitive values, display them directly
              return (
                <div style={{ marginLeft: "16px", marginBottom: "4px", fontSize: "0.9em", ...disabledStyle }}>
                  <span style={{ marginLeft: "8px", fontFamily: "monospace" }}>{String(actualValue)}</span>
                </div>
              );
            }
          };

          return (
            <div key={fullKey} className="config-item">
              <div className="config-item-container" style={{ gridTemplateColumns: "150px 1fr" }}>
                <span className="config-label" title={displayKey ? propertyDescriptions[displayKey] || "" : ""} style={{ fontWeight: "bold" }}>
                  {displayKey}
                </span>
                <div
                  onClick={() => {
                    if (isFromMergedProps && mergedPropData?.jsonLoc) {
                      // Navigate to source for merged properties
                      handleNavigateToSource(mergedPropData.jsonLoc, mergedPropData.osLoc);
                    } else {
                      // Navigate to profile for local properties
                      const configPath = configurations[selectedTab!]?.configPath;
                      if (configPath) {
                        vscodeApi.postMessage({
                          command: "OPEN_CONFIG_FILE_WITH_PROFILE",
                          filePath: configPath,
                          profileKey: selectedProfileKey,
                          propertyKey: displayKey,
                        });
                      }
                    }
                  }}
                  title={
                    isFromMergedProps && !isDeletedMergedProperty && mergedPropData?.jsonLoc
                      ? (() => {
                          // Extract logical profile path from jsonLoc
                          const jsonLocParts = mergedPropData.jsonLoc.split(".");
                          const profilePathParts = jsonLocParts.slice(1, -2);
                          const profilePath =
                            profilePathParts.filter((part: string, index: number) => part !== "profiles" || index % 2 === 0).join(".") ||
                            "unknown profile";

                          // Extract full normalized config path from osLoc
                          const fullConfigPath = mergedPropData.osLoc?.[0] || "unknown config";

                          return `Inherited from: ${profilePath} (${fullConfigPath})`;
                        })()
                      : l10n.t("Click to navigate to profile")
                  }
                  style={{
                    backgroundColor: isFromMergedProps ? "var(--vscode-input-disabledBackground)" : "var(--vscode-input-background)",
                    border: "1px solid var(--vscode-input-border)",
                    borderRadius: "3px",
                    padding: "8px",
                    fontSize: "0.9em",
                    color: isFromMergedProps ? "var(--vscode-disabledForeground)" : "var(--vscode-input-foreground)",
                    cursor: "pointer",
                    opacity: isFromMergedProps ? 0.7 : 1,
                  }}
                >
                  {renderComplexValue(isFromMergedProps ? value : pendingValue, isFromMergedProps)}
                </div>
              </div>
            </div>
          );
        }

        if (isParent) {
          return (
            <div key={fullKey} className="config-item parent">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                {displayKey?.toLocaleLowerCase() === "properties" ? (
                  <div className="sort-dropdown-container">
                    <h3 className={`header-level-${path.length > 3 ? 3 : path.length}`} style={{ margin: 0, fontSize: "16px" }}>
                      Profile Properties
                    </h3>
                  </div>
                ) : (
                  <h3 className={`header-level-${path.length > 3 ? 3 : path.length}`}>{displayKey}</h3>
                )}
                <SortDropdown<PropertySortOrder>
                  options={SORT_ORDER_OPTIONS}
                  selectedOption={propertySortOrder || "alphabetical"}
                  onOptionChange={setPropertySortOrderWithStorage}
                  getDisplayName={getSortOrderDisplayName}
                  className="sort-dropdown-right"
                />
                <button
                  className="header-button"
                  title={l10n.t('Create new property for "{0}"', extractProfileKeyFromPath(currentPath))}
                  onClick={() => openAddProfileModalAtPath(currentPath)}
                  id="add-profile-property-button"
                  style={{
                    padding: "2px",
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
              <div style={{ paddingLeft: displayKey?.toLocaleLowerCase() === "properties" ? "16px" : "0px" }}>
                {renderConfig(value, currentPath, mergedProps)}
              </div>
            </div>
          );
        } else if (isArray) {
          // Check if this is an array within properties that should be rendered as a simple property
          if (shouldRenderAsSimpleProperty) {
            const renderComplexValue = (value: any, isMerged: boolean = false) => {
              // Extract the actual value if this is a merged property object
              const actualValue = typeof value === "object" && value !== null && value._mergedValue !== undefined ? value._mergedValue : value;

              const disabledStyle = isMerged
                ? {
                    backgroundColor: "var(--vscode-input-disabledBackground)",
                    color: "var(--vscode-disabledForeground)",
                    opacity: 0.7,
                  }
                : {};

              if (Array.isArray(actualValue)) {
                return actualValue.map((item, index) => (
                  <div key={index} style={{ marginLeft: "16px", marginBottom: "4px", fontSize: "0.9em", ...disabledStyle }}>
                    <span style={{ color: "var(--vscode-descriptionForeground)" }}>{index}:</span>
                    <span style={{ marginLeft: "8px", fontFamily: "monospace" }}>{String(item)}</span>
                  </div>
                ));
              } else if (typeof actualValue === "object" && actualValue !== null) {
                return Object.entries(actualValue).map(([key, val]) => (
                  <div key={key} style={{ marginLeft: "16px", marginBottom: "4px", fontSize: "0.9em", ...disabledStyle }}>
                    <span style={{ color: "var(--vscode-descriptionForeground)" }}>{key}:</span>
                    <span style={{ marginLeft: "8px", fontFamily: "monospace" }}>{String(val)}</span>
                  </div>
                ));
              } else {
                // For primitive values, display them directly
                return (
                  <div style={{ marginLeft: "16px", marginBottom: "4px", fontSize: "0.9em", ...disabledStyle }}>
                    <span style={{ marginLeft: "8px", fontFamily: "monospace" }}>{String(actualValue)}</span>
                  </div>
                );
              }
            };

            return (
              <div key={fullKey} className="config-item">
                <div className="config-item-container" style={{ flexDirection: "column", alignItems: "flex-start" }}>
                  <div style={{ marginBottom: "8px" }}>
                    <span className="config-label" title={displayKey ? propertyDescriptions[displayKey] || "" : ""} style={{ fontWeight: "bold" }}>
                      {displayKey}
                    </span>
                  </div>
                  <div
                    onClick={() => {
                      if (isFromMergedProps && mergedPropData?.jsonLoc) {
                        // Navigate to source for merged properties
                        handleNavigateToSource(mergedPropData.jsonLoc, mergedPropData.osLoc);
                      } else {
                        // Navigate to profile for local properties
                        const configPath = configurations[selectedTab!]?.configPath;
                        if (configPath) {
                          vscodeApi.postMessage({
                            command: "OPEN_CONFIG_FILE_WITH_PROFILE",
                            filePath: configPath,
                            profileKey: selectedProfileKey,
                            propertyKey: displayKey,
                          });
                        }
                      }
                    }}
                    title={
                      isFromMergedProps && mergedPropData?.jsonLoc
                        ? (() => {
                            // Extract logical profile path from jsonLoc
                            const jsonLocParts = mergedPropData.jsonLoc.split(".");
                            const profilePathParts = jsonLocParts.slice(1, -2);
                            const profilePath =
                              profilePathParts.filter((part: string, index: number) => part !== "profiles" || index % 2 === 0).join(".") ||
                              "unknown profile";

                            // Extract full normalized config path from osLoc
                            const fullConfigPath = mergedPropData.osLoc?.[0] || "unknown config";

                            return `Inherited from: ${profilePath} (${fullConfigPath})`;
                          })()
                        : l10n.t("Click to navigate to profile")
                    }
                    style={{
                      width: "100%",
                      backgroundColor:
                        isFromMergedProps && !isDeletedMergedProperty ? "var(--vscode-input-disabledBackground)" : "var(--vscode-input-background)",
                      border: "1px solid var(--vscode-input-border)",
                      borderRadius: "3px",
                      padding: "8px",
                      fontSize: "0.9em",
                      color: isFromMergedProps ? "var(--vscode-disabledForeground)" : "var(--vscode-input-foreground)",
                      cursor: "pointer",
                      opacity: isFromMergedProps ? 0.7 : 1,
                    }}
                  >
                    {renderComplexValue(isFromMergedProps ? value : pendingValue, isFromMergedProps)}
                  </div>
                </div>
              </div>
            );
          }

          const tabsHiddenItems = hiddenItems[configurations[selectedTab!]!.configPath];
          if (displayKey?.toLocaleLowerCase() === "secure") {
            // Hide the secure array section since secure properties are now handled in the properties section
            return null;
          }
          return (
            <div key={fullKey} className="config-item">
              <h3 className={`header-level-${path.length > 3 ? 3 : path.length}`}>
                <span className="config-label" style={{ fontWeight: "bold" }}>
                  {displayKey}
                </span>
              </h3>
              <div style={{ paddingLeft: "0px" }}>
                {Array.from(new Set(renderValue)).map((item: any, index: number) => {
                  if (
                    tabsHiddenItems &&
                    tabsHiddenItems[item] &&
                    tabsHiddenItems[item].path.includes(currentPath.join(".").replace("secure", "properties") + "." + item)
                  )
                    return;
                  return (
                    <div key={index} className="config-item">
                      <div className="config-item-container">
                        <span className="config-label">{item}</span>
                        <input
                          className="config-input"
                          type="password"
                          placeholder="••••••••"
                          value={String(pendingChanges[configurations[selectedTab!]!.configPath]?.[fullKey + "." + item]?.value || "")}
                          onChange={(e) => handleChange(fullKey + "." + item, (e.target as HTMLInputElement).value)}
                          style={{ fontFamily: "monospace" }}
                        />
                        <button
                          className="action-button"
                          onClick={() => handleDeleteProperty(fullKey.replace("secure", "properties") + "." + item, true)}
                        >
                          <span className="codicon codicon-trash"></span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        } else {
          // Handle merged properties that were added for sorting
          if (isMergedPropertyForSorting) {
            // Double-check that this property should actually be displayed as merged
            const shouldShowAsMerged = displayKey ? isPropertyFromMergedProps(displayKey, path, mergedProps, configPath) : false;

            if (!shouldShowAsMerged) {
              // This property was added for sorting but shouldn't be displayed as merged
              // Skip rendering it
              return null;
            }

            const mergedPropData = value._mergedData;
            const jsonLoc = mergedPropData?.jsonLoc;
            const osLoc = mergedPropData?.osLoc;
            const secure = mergedPropData?.secure;
            const isSecureProperty = jsonLoc && displayKey ? isMergedPropertySecure(displayKey, jsonLoc, osLoc, secure) : false;

            // Render merged property with proper styling and behavior
            return (
              <div
                key={fullKey}
                className="config-item"
                data-testid="profile-property-entry"
                onClick={jsonLoc ? () => handleNavigateToSource(jsonLoc, osLoc) : undefined}
                title={
                  jsonLoc
                    ? (() => {
                        // Extract logical profile path from jsonLoc
                        const jsonLocParts = jsonLoc.split(".");
                        const profilePathParts = jsonLocParts.slice(1, -2);
                        const profilePath =
                          profilePathParts.filter((part: string, index: number) => part !== "profiles" || index % 2 === 0).join(".") ||
                          "unknown profile";

                        // Extract full normalized config path from osLoc
                        const fullConfigPath = osLoc?.[0] || "unknown config";

                        const title = `Inherited from: ${profilePath} (${fullConfigPath})`;
                        return title;
                      })()
                    : undefined
                }
                style={{ cursor: jsonLoc ? "pointer" : "default" }}
              >
                <div className="config-item-container " data-testid="profile-property-container">
                  <span
                    className="config-label"
                    title={displayKey ? propertyDescriptions[displayKey] || "" : ""}
                    style={{
                      color: "var(--vscode-descriptionForeground)",
                      cursor: "pointer",
                    }}
                  >
                    {displayKey}
                  </span>
                  <input
                    className="config-input"
                    type={isSecureProperty ? "password" : "text"}
                    placeholder={isSecureProperty ? "••••••••" : ""}
                    value={isSecureProperty ? "••••••••" : stringifyValueByType(mergedPropData?.value ?? "")}
                    disabled={true}
                    style={{
                      backgroundColor: "var(--vscode-input-disabledBackground)",
                      color: "var(--vscode-disabledForeground)",
                      cursor: "pointer",
                      pointerEvents: "none",
                    }}
                  />
                  <button
                    className="action-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUnlinkMergedProperty(displayKey, fullKey);
                    }}
                    title={l10n.t("Overwrite merged property")}
                  >
                    <span className="codicon codicon-add"></span>
                  </button>
                </div>
              </div>
            );
          }

          // isFromMergedProps and mergedPropData are already calculated above
          const jsonLoc = mergedPropData?.jsonLoc;
          const osLoc = mergedPropData?.osLoc;
          const secure = mergedPropData?.secure;
          const isSecureProperty = isFromMergedProps && jsonLoc && displayKey ? isMergedPropertySecure(displayKey, jsonLoc, osLoc, secure) : false;

          // Check if this is a local secure property (in the current profile's secure array)
          const isLocalSecureProperty =
            displayKey && path && configPath
              ? isPropertySecure(fullKey, displayKey, path, mergedProps, selectedTab, configurations, pendingChanges, renames)
              : false;

          // Check if this is a secure property that was added for sorting
          const isSecureForSorting = isSecurePropertyForSorting;

          const readOnlyContainer = (
            <div className="config-item-container " data-testid="profile-property-container" style={displayKey === "type" ? { gap: "0px" } : {}}>
              <span
                className="config-label"
                title={displayKey ? propertyDescriptions[displayKey] || "" : ""}
                style={
                  isFromMergedProps && !isDeletedMergedProperty
                    ? {
                        color: "var(--vscode-descriptionForeground)",
                        cursor: "pointer",
                      }
                    : {}
                }
              >
                {displayKey}
              </span>
              {displayKey === "type" ? (
                <div style={{ position: "relative", width: "100%" }}>
                  <select
                    className="config-input"
                    value={String(pendingValue)}
                    onChange={(e) => handleChange(fullKey, (e.target as HTMLSelectElement).value)}
                    style={{
                      width: "100%",
                      height: "28px",
                      fontSize: "0.9em",
                      padding: "2px",
                      marginBottom: "0",
                      textTransform: "lowercase",
                      border:
                        showMergedProperties && isCurrentProfileUntyped()
                          ? "2px solid var(--vscode-warningForeground)"
                          : "1px solid var(--vscode-input-border)",
                      outline: showMergedProperties && isCurrentProfileUntyped() ? "2px solid var(--vscode-warningForeground)" : "none",
                      boxShadow: showMergedProperties && isCurrentProfileUntyped() ? "0 0 0 2px var(--vscode-warningForeground)" : "none",
                    }}
                  >
                    <option value="">{l10n.t("Select a type")}</option>
                    {getWizardTypeOptions().map((type: string) => (
                      <option key={type} value={type}>
                        {type.toLowerCase()}
                      </option>
                    ))}
                  </select>
                </div>
              ) : typeof pendingValue === "string" || typeof pendingValue === "boolean" || typeof pendingValue === "number" ? (
                (() => {
                  const propertyType = displayKey
                    ? getPropertyTypeForConfigEditor(
                        displayKey,
                        path,
                        selectedTab,
                        configurations,
                        schemaValidations,
                        getProfileType,
                        pendingChanges,
                        renames
                      )
                    : undefined;

                  if (isSecureProperty || isLocalSecureProperty || isSecureForSorting) {
                    return (
                      <input
                        className="config-input"
                        type="password"
                        placeholder="••••••••"
                        value={isFromMergedProps && !isDeletedMergedProperty ? "••••••••" : stringifyValueByType(pendingValue)}
                        onChange={(e) => handleChange(fullKey, (e.target as HTMLInputElement).value)}
                        disabled={isFromMergedProps && !isDeletedMergedProperty}
                        style={
                          isFromMergedProps && !isDeletedMergedProperty
                            ? {
                                backgroundColor: "var(--vscode-input-disabledBackground)",
                                color: "var(--vscode-disabledForeground)",
                                cursor: "pointer",
                                fontFamily: "monospace",
                                pointerEvents: "none",
                              }
                            : { fontFamily: "monospace" }
                        }
                      />
                    );
                  } else if (propertyType === "boolean") {
                    return (
                      <select
                        className="config-input"
                        value={stringifyValueByType(pendingValue)}
                        onChange={(e) => handleChange(fullKey, (e.target as HTMLSelectElement).value)}
                        disabled={isFromMergedProps && !isDeletedMergedProperty}
                        style={
                          isFromMergedProps && !isDeletedMergedProperty
                            ? {
                                backgroundColor: "var(--vscode-input-disabledBackground)",
                                color: "var(--vscode-disabledForeground)",
                                cursor: "pointer",
                                pointerEvents: "none",
                              }
                            : {}
                        }
                        data-property-key={displayKey}
                      >
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    );
                  } else if (propertyType === "number") {
                    return (
                      <input
                        className="config-input"
                        type="number"
                        value={(() => {
                          if (isFromMergedProps && !isDeletedMergedProperty) {
                            const mergedValue = stringifyValueByType(mergedPropData?.value);
                            return mergedValue;
                          } else {
                            const pendingValueStr = stringifyValueByType(pendingValue);
                            return pendingValueStr;
                          }
                        })()}
                        onChange={(e) => handleChange(fullKey, (e.target as HTMLInputElement).value)}
                        disabled={isFromMergedProps && !isDeletedMergedProperty}
                        style={
                          isFromMergedProps && !isDeletedMergedProperty
                            ? {
                                backgroundColor: "var(--vscode-input-disabledBackground)",
                                color: "var(--vscode-disabledForeground)",
                                cursor: "pointer",
                                pointerEvents: "none",
                              }
                            : {}
                        }
                        data-property-key={displayKey}
                      />
                    );
                  } else {
                    const currentValue = (() => {
                      if (isFromMergedProps && !isDeletedMergedProperty) {
                        return stringifyValueByType(mergedPropData?.value ?? "");
                      } else {
                        const pendingValueStr = stringifyValueByType(pendingValue);
                        return pendingValueStr;
                      }
                    })();

                    return (
                      <EnvVarAutocomplete
                        value={currentValue}
                        onChange={(value) => handleChange(fullKey, value)}
                        className="config-input"
                        placeholder=""
                        disabled={isFromMergedProps && !isDeletedMergedProperty}
                        style={
                          isFromMergedProps && !isDeletedMergedProperty
                            ? {
                                backgroundColor: "var(--vscode-input-disabledBackground)",
                                color: "var(--vscode-disabledForeground)",
                                cursor: "pointer",
                                pointerEvents: "none",
                              }
                            : {}
                        }
                        vscodeApi={vscodeApi}
                        dataPropertyKey={displayKey}
                      />
                    );
                  }
                })()
              ) : (
                <span>{"{...}"}</span>
              )}
              {displayKey !== "type" &&
                displayKey &&
                (() => {
                  const isSecure = isPropertySecure(fullKey, displayKey, path, mergedProps, selectedTab, configurations, pendingChanges, renames);
                  const canBeSecure = canPropertyBeSecure(displayKey, path);

                  const showSecureButton = canBeSecure && !isSecure && !isFromMergedProps;

                  const showDeleteButton = !isFromMergedProps;
                  const showUnlinkButton = isFromMergedProps && !isDeletedMergedProperty;

                  // Only show the flex container if there are buttons to display
                  if (showSecureButton || showDeleteButton || showUnlinkButton) {
                    return (
                      <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                        {showSecureButton &&
                          (secureValuesAllowed ? (
                            <button
                              className="action-button"
                              onClick={() => handleToggleSecure(fullKey, displayKey, path)}
                              title={l10n.t("Make property secure")}
                            >
                              <span className="codicon codicon-unlock"></span>
                            </button>
                          ) : (
                            <button
                              className="action-button"
                              onClick={() => {
                                vscodeApi.postMessage({
                                  command: "OPEN_VSCODE_SETTINGS",
                                  searchText: "Zowe.vscode-extension-for-zowe Secure Credentials Enabled",
                                });
                              }}
                              title={l10n.t("A credential manager is not available. Click to open VS Code settings to enable secure credentials.")}
                            >
                              <span className="codicon codicon-lock" style={{ opacity: 0.5 }}></span>
                            </button>
                          ))}
                        {showDeleteButton && (
                          <button className="action-button" onClick={() => handleDeleteProperty(fullKey)}>
                            <span className="codicon codicon-trash"></span>
                          </button>
                        )}
                        {showUnlinkButton && (
                          <button
                            className="action-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnlinkMergedProperty(displayKey, fullKey);
                            }}
                            title={l10n.t("Overwrite merged property")}
                          >
                            <span className="codicon codicon-add"></span>
                          </button>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}
            </div>
          );

          return (
            <div
              key={fullKey}
              className="config-item property-entry"
              data-testid="profile-property-entry"
              onClick={isFromMergedProps && !isDeletedMergedProperty && jsonLoc ? () => handleNavigateToSource(jsonLoc, osLoc) : undefined}
              title={
                isFromMergedProps && !isDeletedMergedProperty && jsonLoc
                  ? (() => {
                      // Extract logical profile path from jsonLoc
                      const jsonLocParts = jsonLoc.split(".");
                      const profilePathParts = jsonLocParts.slice(1, -2);
                      let profilePath =
                        profilePathParts.filter((part: string, index: number) => part !== "profiles" || index % 2 === 0).join(".") ||
                        "unknown profile";

                      // Check if this is the current profile or its renamed version
                      const currentProfileKey = selectedProfileKey || "";
                      const configPath = configurations[selectedTab!]?.configPath;

                      // Get both old and new names for the current profile
                      const isCurrentProfileRenamed = Object.entries(renames[configPath] || {}).find(
                        ([oldName, newName]) => newName === currentProfileKey || oldName === currentProfileKey
                      );

                      if (isCurrentProfileRenamed) {
                        const [oldName, newName] = isCurrentProfileRenamed;
                        // If the profilePath matches either the old or new name, this is not actually inherited
                        if (profilePath === oldName || profilePath === newName) {
                          return undefined;
                        }
                      } else if (profilePath === currentProfileKey) {
                        // If not renamed but matches current profile, not inherited
                        return undefined;
                      }

                      // Extract full normalized config path from osLoc
                      const fullConfigPath = osLoc?.[0] || "unknown config";

                      // Check if the source profile has been renamed and use its new name
                      const sourceProfileRenamed = Object.entries(renames[configPath] || {}).find(([oldName]) => oldName === profilePath);
                      if (sourceProfileRenamed) {
                        profilePath = sourceProfileRenamed[1]; // Use the new name
                      }

                      const title = l10n.t("Inherited from: {0} ({1})", profilePath, fullConfigPath);
                      return title;
                    })()
                  : undefined
              }
              style={isFromMergedProps && !isDeletedMergedProperty && jsonLoc ? { cursor: "pointer" } : {}}
            >
              {readOnlyContainer}
            </div>
          );
        }
      });
    },
    [
      configurations,
      selectedTab,
      pendingChanges,
      deletions,
      showMergedProperties,
      propertySortOrder,
      sortOrderVersion,
      mergePendingChangesForProfile,
      mergeMergedProperties,
      ensureProfileProperties,
      sortConfigEntries,
      filterSecureProperties,
      isCurrentProfileUntyped,
      getNestedProperty,
      extractProfileKeyFromPath,
      flattenProfiles,
      isPropertyFromMergedProps,
      isPropertySecure,
      renames,
      handleChange,
      handleDeleteProperty,
      handleUnlinkMergedProperty,
      handleNavigateToSource,
      handleToggleSecure,
      canPropertyBeSecure,
      secureValuesAllowed,
      vscodeApi,
      stringifyValueByType,
      l10n,
      SORT_ORDER_OPTIONS,
      getSortOrderDisplayName,
      setPropertySortOrderWithStorage,
      propertyDescriptions,
    ]
  );

  const result = renderConfig(obj, path, mergedProps);
  return result ? <>{result}</> : null;
};
