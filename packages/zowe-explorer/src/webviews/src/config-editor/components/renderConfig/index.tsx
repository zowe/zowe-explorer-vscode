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

import * as l10n from "@vscode/l10n";
import { SortDropdown } from "../SortDropdown";
import { extractProfileKeyFromPath, getSortOrderDisplayName, PropertySortOrder } from "../../utils";
import { isPropertyPendingDeletion as isPropertyPendingDeletionFn } from "../../utils/propertyUtils";
import type { Configuration, PendingChange, MergedPropertiesVisibility } from "../../types";
import { useConfigContext } from "../../context/ConfigContext";
import type { RenderConfigCtx } from "./context";
import { buildSortedEntries } from "./buildSortedEntries";
import { ComplexValueProperty } from "./ComplexValueProperty";
import { SecureArrayProperty } from "./SecureArrayProperty";
import { MergedPropertyRow } from "./MergedPropertyRow";
import { EditablePropertyRow } from "./EditablePropertyRow";

const SORT_ORDER_OPTIONS: PropertySortOrder[] = ["alphabetical", "merged-first", "non-merged-first"];
const MERGED_PROPERTIES_OPTIONS: MergedPropertiesVisibility[] = ["hide", "show", "unfiltered"];

function getMergedPropertiesDisplayName(option: MergedPropertiesVisibility) {
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
}

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

/**
 * One node of the recursive config tree: prepares its sorted entries and renders each,
 * recursing into `properties`/child-profile groups.
 */
function ConfigEntries({ ctx, obj, path = [], mergedProps }: { ctx: RenderConfigCtx; obj: any; path?: string[]; mergedProps?: any }) {
  const configPath = ctx.configurations[ctx.selectedTab!]?.configPath;
  if (!configPath) {
    return null;
  }

  const { combinedConfig, sortedEntries } = buildSortedEntries(ctx, obj, path, mergedProps, configPath);

  return (
    <>
      {sortedEntries.map(([key, value]) => (
        <ConfigEntry
          key={[...path, key].join(".")}
          ctx={ctx}
          entryKey={key}
          value={value}
          path={path}
          mergedProps={mergedProps}
          combinedConfig={combinedConfig}
          configPath={configPath}
        />
      ))}
    </>
  );
}

/**
 * Dispatches a single entry to the appropriate row component based on its shape (complex value,
 * child-profile group, secure array, merged-only property, or editable property).
 */
function ConfigEntry({
  ctx,
  entryKey: key,
  value,
  path,
  mergedProps,
  combinedConfig,
  configPath,
}: {
  ctx: RenderConfigCtx;
  entryKey: string;
  value: any;
  path: string[];
  mergedProps: any;
  combinedConfig: any;
  configPath: string;
}) {
  const {
    deletions,
    renames,
    pendingChanges,
    isPropertyFromMergedProps,
    filterSecureProperties,
    mergePendingSecureProperties,
    openAddProfileModalAtPath,
    showMergedProperties,
    setShowMergedPropertiesWithStorage,
    propertySortOrder,
    setPropertySortOrderWithStorage,
  } = ctx;

  const currentPath = [...path, key];
  const fullKey = currentPath.join(".");
  const displayKey = key.split(".").pop();

  const isInDeletions = isPropertyPendingDeletionFn({ propertyKey: key, path, configPath, deletions, renames });

  const isInheritedReplacementForDeletion = typeof value === "object" && value !== null && value._isMergedProperty === true;
  if (isInDeletions && !isInheritedReplacementForDeletion) {
    return null;
  }

  const isFromMergedProps = isPropertyFromMergedProps(displayKey, path, mergedProps, configPath);

  // Filter secure properties from properties object
  let entryValue = value;
  if (key === "properties") {
    const filteredValue = filterSecureProperties(entryValue, combinedConfig, configPath, pendingChanges, deletions, mergedProps);
    // Always render the properties section, even if empty, so users can add properties
    if (filteredValue === null) {
      // Return an empty properties object instead of null so the header still renders
      entryValue = {};
    } else {
      entryValue = filteredValue;
    }
  }

  // Check if this is a secure property that was added for sorting
  const isSecurePropertyForSorting = typeof entryValue === "object" && entryValue !== null && entryValue._isSecureProperty === true;

  // Check if this is a merged property that was added for sorting
  const isMergedPropertyForSorting = typeof entryValue === "object" && entryValue !== null && entryValue._isMergedProperty === true;

  // Check if this is a sub-object or array within properties that should be rendered as a simple property
  // For merged properties, check the actual value, not the wrapper object
  const actualValueForTypeCheck =
    typeof entryValue === "object" && entryValue !== null && entryValue._mergedValue !== undefined ? entryValue._mergedValue : entryValue;
  const isSubObjectOrArray =
    (typeof actualValueForTypeCheck === "object" && actualValueForTypeCheck !== null) || Array.isArray(actualValueForTypeCheck);

  const isWithinProperties = path.length > 0 && path[path.length - 1] === "properties";
  // Additional check: make sure we're not dealing with array items or other nested structures
  const isDirectProperty = !Array.isArray(entryValue) || (Array.isArray(entryValue) && path.length > 0 && path[path.length - 1] === "properties");
  // Exclude secure properties from simple property rendering
  const isSecureProperty = typeof entryValue === "object" && entryValue !== null && entryValue._isSecureProperty === true;
  const shouldRenderAsSimpleProperty = isSubObjectOrArray && isWithinProperties && isDirectProperty && !isSecureProperty;

  const isParent =
    typeof entryValue === "object" &&
    entryValue !== null &&
    !Array.isArray(entryValue) &&
    !isSecurePropertyForSorting &&
    !isMergedPropertyForSorting &&
    !shouldRenderAsSimpleProperty;
  const isArray = Array.isArray(entryValue);
  const mergedPropData = displayKey ? mergedProps?.[displayKey] : undefined;

  const pendingValue =
    (pendingChanges[configPath] ?? {})[fullKey]?.value ??
    (isSecurePropertyForSorting
      ? ""
      : isMergedPropertyForSorting
        ? entryValue._mergedValue
        : isFromMergedProps && mergedPropData
          ? mergedPropData.value
          : entryValue);

  // Merge pending secure properties for secure arrays
  let renderValue: any[] = Array.isArray(entryValue) ? entryValue : [];
  if (isArray && key === "secure") {
    renderValue = mergePendingSecureProperties(entryValue, path, configPath, pendingChanges, renames);
  }

  // Handle sub-objects and arrays within properties early to prevent recursive rendering
  if (shouldRenderAsSimpleProperty) {
    return (
      <ComplexValueProperty
        ctx={ctx}
        fullKey={fullKey}
        displayKey={displayKey}
        isFromMergedProps={isFromMergedProps}
        mergedPropData={mergedPropData}
        pendingValue={pendingValue}
        value={entryValue}
      />
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
          <ConfigEntries ctx={ctx} obj={entryValue} path={currentPath} mergedProps={mergedProps} />
        </div>
      </div>
    );
  }

  if (isArray) {
    return (
      <SecureArrayProperty ctx={ctx} fullKey={fullKey} displayKey={displayKey} path={path} currentPath={currentPath} renderValue={renderValue} />
    );
  }

  // Handle merged properties that were added for sorting
  if (isMergedPropertyForSorting) {
    return (
      <MergedPropertyRow
        ctx={ctx}
        fullKey={fullKey}
        displayKey={displayKey}
        path={path}
        mergedProps={mergedProps}
        configPath={configPath}
        value={entryValue}
      />
    );
  }

  return (
    <EditablePropertyRow
      ctx={ctx}
      fullKey={fullKey}
      displayKey={displayKey}
      path={path}
      configPath={configPath}
      pendingValue={pendingValue}
      isFromMergedProps={isFromMergedProps}
      isSecurePropertyForSorting={isSecurePropertyForSorting}
      mergedProps={mergedProps}
      mergedPropData={mergedPropData}
    />
  );
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
    selectedProfileKey,
    vscodeApi,
    configEditorSettings,
    setPropertySortOrderWithStorage,
    setShowMergedPropertiesWithStorage,
  } = useConfigContext();

  const { showMergedProperties, propertySortOrder } = configEditorSettings;

  const ctx: RenderConfigCtx = {
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
    propertyDescriptions,
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
    configurations,
    selectedTab,
    pendingChanges,
    deletions,
    renames,
    schemaValidations,
    hiddenItems,
    secureValuesAllowed,
    selectedProfileKey,
    vscodeApi,
    showMergedProperties,
    propertySortOrder,
    setPropertySortOrderWithStorage,
    setShowMergedPropertiesWithStorage,
    isUntypedProfile: isCurrentProfileUntyped(),
  };

  return <ConfigEntries ctx={ctx} obj={obj} path={path} mergedProps={mergedProps} />;
};
