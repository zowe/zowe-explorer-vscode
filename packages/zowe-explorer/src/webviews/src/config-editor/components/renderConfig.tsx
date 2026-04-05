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
import {
  flattenProfiles,
  extractProfileKeyFromPath,
  sortConfigEntries,
  stringifyValueByType,
  getProfileType,
  getOriginalProfileKeyWithNested,
  getRenamedProfileKeyWithNested,
  getPropertyTypeForConfigEditor,
  getSortOrderDisplayName,
  getNestedProperty,
  PropertySortOrder,
} from "../utils";
import { isFileProperty, isPropertyPendingDeletion as isPropertyPendingDeletionFn } from "../utils/propertyUtils";
import type { Configuration, PendingChange, MergedPropertiesVisibility } from "../types";
import { useConfigContext } from "../context/ConfigContext";
import { configComplexValueLines } from "./ConfigComplexValueLines";

const SORT_ORDER_OPTIONS: PropertySortOrder[] = ["alphabetical", "merged-first", "non-merged-first"];

interface RenderConfigProps {
  obj: any;
  path?: string[];
  mergedProps?: any;
  propertyDescriptions: { [key: string]: string };

  handleChange: (key: string, value: string) => void;
  handleDeleteProperty: (fullKey: string, secure?: boolean) => void;
  confirmDeleteProperty: (fullKey: string, secure?: boolean) => void;
  pendingPropertyDeletion: string | null;
  setPendingPropertyDeletion: (key: string | null) => void;
  handleUnlinkMergedProperty: (propertyKey: string | undefined, fullKey: string) => void;
  handleNavigateToSource: (jsonLoc: string, osLoc?: string[]) => void;
  handleToggleSecure: (fullKey: string, displayKey: string, path: string[], value: any) => void;
  openAddProfileModalAtPath: (path: string[], key?: string, value?: string) => void;
  getWizardTypeOptions: () => string[];

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
}

export const RenderConfig = ({
  obj,
  path = [],
  mergedProps,
  propertyDescriptions,
  handleChange,
  handleDeleteProperty,
  confirmDeleteProperty,
  pendingPropertyDeletion,
  setPendingPropertyDeletion,
  handleUnlinkMergedProperty,
  handleNavigateToSource,
  handleToggleSecure,
  openAddProfileModalAtPath,
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
}: RenderConfigProps) => {
  const {
    configurations,
    selectedTab,
    pendingChanges,
    deletions,
    renames,
    schemaValidations,
    hiddenItems,
    secureValuesAllowed,
    sortOrderVersion,
    selectedProfileKey,
    vscodeApi,
    configEditorSettings,
    setPropertySortOrderWithStorage,
    setShowMergedPropertiesWithStorage,
  } = useConfigContext();

  const { showMergedProperties, propertySortOrder } = configEditorSettings;

  const MERGED_PROPERTIES_OPTIONS: MergedPropertiesVisibility[] = ["hide", "show", "unfiltered"];
  const isUntypedProfile = isCurrentProfileUntyped();

  const getMergedPropertiesDisplayName = (option: MergedPropertiesVisibility) => {
    switch (option) {
      case "hide":
        return l10n.t("Hide merged");
      case "show":
        return l10n.t("Show merged");
      case "unfiltered":
        return l10n.t("Show merged unfiltered");
      default:
        return option;
    }
  };

  const renderConfig = useCallback(
    (obj: any, path: string[] = [], mergedProps?: any) => {
      const baseObj = cloneDeep(obj);
      const configPath = configurations[selectedTab!]?.configPath;
      if (!configPath) {
        return null;
      }

      let combinedConfig = mergePendingChangesForProfile(baseObj, path, configPath);

      const originalProperties = baseObj.properties || {};

      if (showMergedProperties !== "hide" && mergedProps && !isCurrentProfileUntyped()) {
        combinedConfig = mergeMergedProperties(combinedConfig, path, mergedProps, configPath);
      }

      combinedConfig = ensureProfileProperties(combinedConfig, path);

      let sortedEntries: [string, any][];

      const isPropertyDeletedConsideringRenames = (propertyKey: string) =>
        isPropertyPendingDeletionFn({ propertyKey, path, configPath, deletions, renames });

      if (path.length > 0 && path[path.length - 1] === "properties") {
        const lockedSortOrder = propertySortOrder;

        const localSortProperties = (entries: [string, any][]): [string, any][] => {
          if (lockedSortOrder === "alphabetical") {
            return [...entries].sort(([a], [b]) => a.localeCompare(b));
          } else if (lockedSortOrder === "merged-first") {
            return [...entries].sort(([a], [b]) => {
              const aIsMerged = a && isPropertyFromMergedProps(a, path, mergedProps, configPath);
              const bIsMerged = b && isPropertyFromMergedProps(b, path, mergedProps, configPath);

              if (aIsMerged && !bIsMerged) return -1;
              if (!aIsMerged && bIsMerged) return 1;

              return a.localeCompare(b);
            });
          } else if (lockedSortOrder === "non-merged-first") {
            return [...entries].sort(([a], [b]) => {
              const aIsMerged = a && isPropertyFromMergedProps(a, path, mergedProps, configPath);
              const bIsMerged = b && isPropertyFromMergedProps(b, path, mergedProps, configPath);

              if (!aIsMerged && bIsMerged) return -1;
              if (aIsMerged && !bIsMerged) return 1;

              return a.localeCompare(b);
            });
          } else {
            return [...entries].sort(([a], [b]) => a.localeCompare(b));
          }
        };

        const filteredCombinedConfig = { ...combinedConfig };
        const configPath = configurations[selectedTab!]?.configPath;

        Object.keys(filteredCombinedConfig).forEach((key) => {
          const isDeleted = isPropertyDeletedConsideringRenames(key);

          if (isDeleted) {
            delete filteredCombinedConfig[key];
          }
        });

        const entriesForSorting = Object.entries(filteredCombinedConfig);

        const currentProfileKeyForDisk = extractProfileKeyFromPath(path);
        const originalProfileKeyForDisk = getOriginalProfileKeyWithNested(currentProfileKeyForDisk, configPath, renames);

        const originalPartsForDisk = originalProfileKeyForDisk.split(".");
        const parentConfigPath = ["profiles"];
        for (let i = 0; i < originalPartsForDisk.length; i++) {
          if (i > 0) parentConfigPath.push("profiles");
          parentConfigPath.push(originalPartsForDisk[i]);
        }
        const parentConfig = getNestedProperty(configurations[selectedTab!]?.properties, parentConfigPath) as Record<string, unknown> | undefined;
        const parentSecure = parentConfig?.secure;
        if (parentSecure && Array.isArray(parentSecure)) {
          parentSecure.forEach((securePropertyName: string) => {
            if (!combinedConfig.hasOwnProperty(securePropertyName)) {
              entriesForSorting.push([securePropertyName, { _isSecureProperty: true }]);
            }
          });
        }

        if (!parentSecure || (Array.isArray(parentSecure) && parentSecure.length === 0)) {
          const flatProfiles = flattenProfiles(configurations[selectedTab!]?.properties?.profiles || {});
          const currentProfile = flatProfiles[originalProfileKeyForDisk];
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

        const currentProfileKeyForSecure = extractProfileKeyFromPath(path);
        const originalProfileKeyForSecure = getOriginalProfileKeyWithNested(currentProfileKeyForSecure, configPath, renames);
        const renamedProfileKeyForSecure = getRenamedProfileKeyWithNested(originalProfileKeyForSecure, configPath, renames);

        if (configPath && currentProfileKeyForSecure) {
          Object.entries(pendingChanges[configPath] ?? {}).forEach(([key, entry]) => {
            const entryProfile = entry.profile;
            const matches =
              entryProfile === currentProfileKeyForSecure ||
              entryProfile === originalProfileKeyForSecure ||
              entryProfile === renamedProfileKeyForSecure;

            if (matches && entry.secure) {
              const keyParts = key.split(".");
              const propertyName = keyParts[keyParts.length - 1];
              if (!combinedConfig.hasOwnProperty(propertyName) && !entriesForSorting.some(([existingKey]) => existingKey === propertyName)) {
                entriesForSorting.push([propertyName, { _isSecureProperty: true }]);
              }
            }
          });
        }

        if (mergedProps && showMergedProperties !== "hide" && selectedProfileKey) {
          const currentProfileKey = extractProfileKeyFromPath(path);
          const profileType = getProfileType({ profileKey: currentProfileKey, selectedTab, configurations, pendingChanges, renames });
          const propertySchema = profileType ? schemaValidations[configPath]?.propertySchema[profileType] || {} : {};
          const allowedProperties = Object.keys(propertySchema);

          Object.entries(mergedProps).forEach(([propertyName, propData]: [string, any]) => {
            const isAllowedBySchema = !profileType || allowedProperties.includes(propertyName);
            const isInDeletions = isPropertyDeletedConsideringRenames(propertyName);
            const alreadyInEntries = entriesForSorting.some(([existingKey]) => existingKey === propertyName);
            const wasInOriginal = originalProperties?.hasOwnProperty(propertyName);

            const shouldAdd = !alreadyInEntries && isAllowedBySchema && (!wasInOriginal || isInDeletions);

            if (shouldAdd) {
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
        sortedEntries = sortConfigEntries(Object.entries(combinedConfig));
      }

      return sortedEntries.map(([key, value]) => {
        const currentPath = [...path, key];
        const fullKey = currentPath.join(".");
        const displayKey = key.split(".").pop();

        const isInDeletions = (() => {
          return isPropertyDeletedConsideringRenames(key);
        })();

        const isInheritedReplacementForDeletion = typeof value === "object" && value !== null && value._isMergedProperty === true;
        if (isInDeletions && !isInheritedReplacementForDeletion) {
          return null;
        }

        const isFromMergedProps = isPropertyFromMergedProps(displayKey, path, mergedProps, configPath);
        const isDeletedMergedProperty = false;

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
        const mergedPropData = displayKey ? mergedProps?.[displayKey] : undefined;

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
            const actualValue = typeof value === "object" && value !== null && value._mergedValue !== undefined ? value._mergedValue : value;
            const disabledStyle = isMerged
              ? {
                  backgroundColor: "var(--vscode-input-disabledBackground)",
                  color: "var(--vscode-disabledForeground)",
                  opacity: 0.7,
                }
              : {};
            return configComplexValueLines(actualValue, disabledStyle);
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
                    border: isFromMergedProps
                      ? "1px solid var(--vscode-input-background)"
                      : "1px solid var(--vscode-input-border)",
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
                  <>
                    <h3 className={`header-level-${path.length > 3 ? 3 : path.length}`} style={{ margin: 0, fontSize: "16px" }}>
                      Profile Properties
                    </h3>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <SortDropdown<MergedPropertiesVisibility>
                        options={MERGED_PROPERTIES_OPTIONS}
                        selectedOption={showMergedProperties}
                        onOptionChange={setShowMergedPropertiesWithStorage}
                        getDisplayName={getMergedPropertiesDisplayName}
                        icon="codicon-eye"
                      />
                      <SortDropdown<PropertySortOrder>
                        options={SORT_ORDER_OPTIONS}
                        selectedOption={propertySortOrder || "alphabetical"}
                        onOptionChange={setPropertySortOrderWithStorage}
                        getDisplayName={getSortOrderDisplayName}
                      />
                      <button
                        className="ce-icon-button"
                        title={l10n.t('Create new property for "{0}"', extractProfileKeyFromPath(currentPath))}
                        onClick={() => openAddProfileModalAtPath(currentPath)}
                        id="add-profile-property-button"
                      >
                        <span className="codicon codicon-add"></span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className={`header-level-${path.length > 3 ? 3 : path.length}`}>{displayKey}</h3>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <SortDropdown<PropertySortOrder>
                        options={SORT_ORDER_OPTIONS}
                        selectedOption={propertySortOrder || "alphabetical"}
                        onOptionChange={setPropertySortOrderWithStorage}
                        getDisplayName={getSortOrderDisplayName}
                      />
                      <button
                        className="ce-icon-button"
                        title={l10n.t('Create new property for "{0}"', extractProfileKeyFromPath(currentPath))}
                        onClick={() => openAddProfileModalAtPath(currentPath)}
                        id="add-profile-property-button"
                      >
                        <span className="codicon codicon-add"></span>
                      </button>
                    </div>
                  </>
                )}
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
              const actualValue = typeof value === "object" && value !== null && value._mergedValue !== undefined ? value._mergedValue : value;
              const disabledStyle = isMerged
                ? {
                    backgroundColor: "var(--vscode-input-disabledBackground)",
                    color: "var(--vscode-disabledForeground)",
                    opacity: 0.7,
                  }
                : {};
              return configComplexValueLines(actualValue, disabledStyle);
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
                      border:
                        isFromMergedProps && !isDeletedMergedProperty
                          ? "1px solid var(--vscode-input-background)"
                          : "1px solid var(--vscode-input-border)",
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
                        {(() => {
                          const secureFullKey = fullKey.replace("secure", "properties") + "." + item;
                          return pendingPropertyDeletion === secureFullKey ? (
                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                              <button
                                className="action-button"
                                onClick={() => confirmDeleteProperty(secureFullKey, true)}
                                title={l10n.t("Confirm delete")}
                                style={{ color: "var(--vscode-errorForeground)" }}
                              >
                                <span className="codicon codicon-check"></span>
                              </button>
                              <button className="action-button" onClick={() => setPendingPropertyDeletion(null)} title={l10n.t("Cancel")}>
                                <span className="codicon codicon-close"></span>
                              </button>
                            </div>
                          ) : (
                            <button className="action-button" onClick={() => handleDeleteProperty(secureFullKey, true)}>
                              <span className="codicon codicon-trash"></span>
                            </button>
                          );
                        })()}
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
                    className="config-input config-input-inherited"
                    type={isSecureProperty ? "password" : "text"}
                    placeholder={isSecureProperty ? "••••••••" : ""}
                    value={isSecureProperty ? "••••••••" : stringifyValueByType(mergedPropData?.value ?? "")}
                    disabled={true}
                    style={{
                      backgroundColor: "var(--vscode-input-disabledBackground)",
                      color: "var(--vscode-descriptionForeground)",
                      cursor: "pointer",
                      pointerEvents: "none",
                      fontFamily: isSecureProperty ? "monospace" : undefined,
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

          const inheritedInputClass = isFromMergedProps && !isDeletedMergedProperty ? " config-input-inherited" : "";

          const readOnlyContainer = (
            <div
              className="config-item-container "
              data-testid="profile-property-container"
              style={displayKey === "type" && path[path.length - 1] !== "properties" ? { gap: "0px" } : {}}
            >
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
              {displayKey === "type" && path[path.length - 1] !== "properties" ? (
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
                      ...(showMergedProperties && isCurrentProfileUntyped()
                        ? {
                              border: "2px solid var(--vscode-warningForeground)",
                              outline: "2px solid var(--vscode-warningForeground)",
                              boxShadow: "0 0 0 2px var(--vscode-warningForeground)",
                          }
                        : {}),
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
                    ? getPropertyTypeForConfigEditor({
                        propertyKey: displayKey,
                        profilePath: path,
                        selectedTab,
                        configurations,
                        schemaValidations,
                        pendingChanges,
                        renames,
                      })
                    : undefined;

                  if (isSecureProperty || isLocalSecureProperty || isSecureForSorting) {
                    const storedInKeyring = !isFromMergedProps && displayKey && mergedProps?.[displayKey] !== undefined;
                    const secureDisplayValue = isFromMergedProps && !isDeletedMergedProperty ? "••••••••" : stringifyValueByType(pendingValue);
                    return (
                      <input
                        className={`config-input${inheritedInputClass}`}
                        type="password"
                        placeholder={storedInKeyring || secureDisplayValue || isUntypedProfile ? "••••••••" : ""}
                        value={secureDisplayValue}
                        onChange={(e) => handleChange(fullKey, (e.target as HTMLInputElement).value)}
                        disabled={isFromMergedProps && !isDeletedMergedProperty}
                        style={
                          isFromMergedProps && !isDeletedMergedProperty
                            ? {
                                backgroundColor: "var(--vscode-input-disabledBackground)",
                                color: "var(--vscode-descriptionForeground)",
                                cursor: "pointer",
                                fontFamily: "monospace",
                                pointerEvents: "none",
                              }
                            : {
                                fontFamily: "monospace",
                                backgroundColor: "var(--vscode-input-background)",
                                color: "var(--vscode-input-foreground)",
                              }
                        }
                      />
                    );
                  } else if (propertyType === "boolean") {
                    return (
                      <select
                        className={`config-input${inheritedInputClass}`}
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
                        className={`config-input${inheritedInputClass}`}
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
                        className={`config-input${inheritedInputClass}`}
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
              {(displayKey !== "type" || path[path.length - 1] === "properties") &&
                displayKey &&
                (() => {
                  const isSecure = isPropertySecure(fullKey, displayKey, path, mergedProps, selectedTab, configurations, pendingChanges, renames);
                  const canBeSecure = canPropertyBeSecure(displayKey, path);

                  const showSecureButton = canBeSecure && !isSecure && !isFromMergedProps && pendingPropertyDeletion !== fullKey;

                  const showDeleteButton = !isFromMergedProps;
                  const showUnlinkButton = isFromMergedProps && !isDeletedMergedProperty;
                  const showFilePickerButton = !isFromMergedProps && isFileProperty(displayKey) && pendingPropertyDeletion !== fullKey;
                  const showAuthOrderButton = !isFromMergedProps && displayKey === "authOrder" && pendingPropertyDeletion !== fullKey;

                  // Only show the flex container if there are buttons to display
                  if (showSecureButton || showDeleteButton || showUnlinkButton || showFilePickerButton || showAuthOrderButton) {
                    return (
                      <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                        {showFilePickerButton && (
                          <button
                            className="action-button"
                            onClick={() => {
                              vscodeApi.postMessage({
                                command: "SELECT_FILE",
                                configPath: configurations[selectedTab!].configPath,
                                fullKey: fullKey,
                                source: "editor",
                              });
                            }}
                            title={l10n.t("Select file")}
                          >
                            <span className="codicon codicon-folder-opened" style={{ position: "relative", top: "2px" }}></span>
                          </button>
                        )}
                        {showAuthOrderButton && (
                          <button
                            className="action-button"
                            onClick={() => {
                              openAddProfileModalAtPath(path, displayKey, stringifyValueByType(pendingValue));
                            }}
                            title={l10n.t("Edit authentication order")}
                          >
                            <span className="codicon codicon-list-selection"></span>
                          </button>
                        )}
                        {showSecureButton &&
                          (secureValuesAllowed ? (
                            <button
                              className="action-button"
                              onClick={() => {
                                handleToggleSecure(fullKey, displayKey, path, pendingValue);
                              }}
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
                              <span className="codicon codicon-lock" style={{ opacity: 0.5, position: "relative", top: "-1px" }}></span>
                            </button>
                          ))}
                        {showDeleteButton &&
                          (pendingPropertyDeletion === fullKey ? (
                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                              <button
                                className="action-button"
                                onClick={() => confirmDeleteProperty(fullKey)}
                                title={l10n.t("Confirm delete")}
                                style={{ color: "var(--vscode-errorForeground)" }}
                              >
                                <span className="codicon codicon-check"></span>
                              </button>
                              <button className="action-button" onClick={() => setPendingPropertyDeletion(null)} title={l10n.t("Cancel")}>
                                <span className="codicon codicon-close"></span>
                              </button>
                            </div>
                          ) : (
                            <button className="action-button" onClick={() => handleDeleteProperty(fullKey)}>
                              <span className="codicon codicon-trash"></span>
                            </button>
                          ))}
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
      isUntypedProfile,
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
      getSortOrderDisplayName,
      setPropertySortOrderWithStorage,
      propertyDescriptions,
    ]
  );

  const result = renderConfig(obj, path, mergedProps);
  return result ? <>{result}</> : null;
};
