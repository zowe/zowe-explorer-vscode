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

import { useEffect, useRef, useState } from "react";
import * as l10n from "@vscode/l10n";
import { VscodeToolbarButton } from "@vscode-elements/react-elements";
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
import { useElementWidth } from "../../hooks/useElementWidth";

interface PropertiesOverflowMenuProps {
  currentPath: string[];
  openAddProfileModalAtPath: (path: string[]) => void;
  showMergedProperties?: MergedPropertiesVisibility;
  onShowMergedPropertiesChange?: (val: MergedPropertiesVisibility) => void;
  propertySortOrder: PropertySortOrder;
  onPropertySortOrderChange: (val: PropertySortOrder) => void;
  hasMergedProperties: boolean;
}

export function PropertiesOverflowMenu({
  currentPath,
  openAddProfileModalAtPath,
  showMergedProperties,
  onShowMergedPropertiesChange,
  propertySortOrder,
  onPropertySortOrderChange,
  hasMergedProperties,
}: PropertiesOverflowMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="sort-dropdown" ref={dropdownRef}>
      <VscodeToolbarButton
        className="sort-dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title={l10n.t("More Actions")}
      >
        <span className="codicon codicon-more"></span>
      </VscodeToolbarButton>
      {isOpen && (
        <div className="sort-dropdown-list align-left" role="menu" style={{ minWidth: "190px" }}>
          <div
            className="sort-dropdown-item"
            role="menuitem"
            onClick={() => {
              openAddProfileModalAtPath(currentPath);
              setIsOpen(false);
            }}
          >
            <span className="codicon codicon-add sort-dropdown-item-icon"></span>
            <div className="sort-dropdown-item-content">
              <div className="sort-dropdown-item-label">{l10n.t("Create Property")}</div>
            </div>
          </div>
          {hasMergedProperties && onShowMergedPropertiesChange && (
            <>
              <div className="header-overflow-divider" style={{ height: "1px", backgroundColor: "var(--vscode-dropdown-border)", margin: "4px 0" }}></div>
              <div style={{ padding: "4px 10px", fontSize: "11px", fontWeight: "bold", color: "var(--vscode-descriptionForeground)", opacity: 0.8 }}>
                {l10n.t("Merged Properties")}
              </div>
              {(["show", "hide", "unfiltered"] as const).map((opt) => {
                const displayNames = {
                  show: l10n.t("Show merged"),
                  hide: l10n.t("Hide merged"),
                  unfiltered: l10n.t("Show merged unfiltered"),
                };
                return (
                  <div
                    key={opt}
                    className={`sort-dropdown-item ${opt === showMergedProperties ? "selected" : ""}`}
                    role="menuitemradio"
                    aria-checked={opt === showMergedProperties}
                    onClick={() => {
                      onShowMergedPropertiesChange(opt);
                      setIsOpen(false);
                    }}
                  >
                    <span className={`codicon ${opt === showMergedProperties ? "codicon-check" : "codicon-blank"} sort-dropdown-item-icon`}></span>
                    <div className="sort-dropdown-item-content">
                      <div className="sort-dropdown-item-label">{displayNames[opt]}</div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
          <div className="header-overflow-divider" style={{ height: "1px", backgroundColor: "var(--vscode-dropdown-border)", margin: "4px 0" }}></div>
          <div style={{ padding: "4px 10px", fontSize: "11px", fontWeight: "bold", color: "var(--vscode-descriptionForeground)", opacity: 0.8 }}>
            {l10n.t("Sort Order")}
          </div>
          {(["alphabetical", "merged-first", "non-merged-first"] as const).map((opt) => {
            return (
              <div
                key={opt}
                className={`sort-dropdown-item ${opt === propertySortOrder ? "selected" : ""}`}
                role="menuitemradio"
                aria-checked={opt === propertySortOrder}
                onClick={() => {
                  onPropertySortOrderChange(opt);
                  setIsOpen(false);
                }}
              >
                <span className={`codicon ${opt === propertySortOrder ? "codicon-check" : "codicon-blank"} sort-dropdown-item-icon`}></span>
                <div className="sort-dropdown-item-content">
                  <div className="sort-dropdown-item-label">{getSortOrderDisplayName(opt)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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

function getMergedPropertiesDescription(option: MergedPropertiesVisibility): string | undefined {
  switch (option) {
    case "hide":
      return l10n.t("Only show properties defined directly on this profile.");
    case "show":
      return l10n.t("Show inherited properties, limited to those the profile type's schema allows.");
    case "unfiltered":
      return l10n.t("Show every inherited property, including ones that are not on the schema for this profile type.");
    default:
      return undefined;
  }
}

function getMergedPropertiesIcon(option: MergedPropertiesVisibility): string {
  switch (option) {
    case "hide":
      return "codicon-eye-closed";
    case "show":
      return "codicon-eye";
    case "unfiltered":
      return "codicon-preview";
    default:
      return "codicon-eye";
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
  highlightPropertyKey?: string | null;
  onHighlightPropertyKeyConsumed?: () => void;
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
  const [headerRef, headerWidth] = useElementWidth();
  const isNarrow = headerWidth > 0 && headerWidth < 280;

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
    const isPropertiesHeader = displayKey?.toLocaleLowerCase() === "properties";
    return (
      <div key={fullKey} className="config-item parent">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }} ref={headerRef}>
          {isPropertiesHeader ? (
            <>
              <h3 className={`header-level-${path.length > 3 ? 3 : path.length}`} style={{ margin: 0, fontSize: "16px" }}>
                Profile Properties
              </h3>
              {isNarrow ? (
                <PropertiesOverflowMenu
                  currentPath={currentPath}
                  openAddProfileModalAtPath={openAddProfileModalAtPath}
                  showMergedProperties={showMergedProperties}
                  onShowMergedPropertiesChange={setShowMergedPropertiesWithStorage}
                  propertySortOrder={propertySortOrder || "alphabetical"}
                  onPropertySortOrderChange={setPropertySortOrderWithStorage}
                  hasMergedProperties={true}
                />
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <SortDropdown<MergedPropertiesVisibility>
                    options={MERGED_PROPERTIES_OPTIONS}
                    selectedOption={showMergedProperties}
                    onOptionChange={setShowMergedPropertiesWithStorage}
                    getDisplayName={getMergedPropertiesDisplayName}
                    getDescription={getMergedPropertiesDescription}
                    getIcon={getMergedPropertiesIcon}
                  />
                  <SortDropdown<PropertySortOrder>
                    options={SORT_ORDER_OPTIONS}
                    selectedOption={propertySortOrder || "alphabetical"}
                    onOptionChange={setPropertySortOrderWithStorage}
                    getDisplayName={getSortOrderDisplayName}
                  />
                  <VscodeToolbarButton
                    title={l10n.t('Create new property for "{0}"', extractProfileKeyFromPath(currentPath))}
                    onClick={() => openAddProfileModalAtPath(currentPath)}
                    id="add-profile-property-button"
                  >
                    <span className="codicon codicon-add"></span>
                  </VscodeToolbarButton>
                </div>
              )}
            </>
          ) : (
            <>
              <h3 className={`header-level-${path.length > 3 ? 3 : path.length}`}>{displayKey}</h3>
              {isNarrow ? (
                <PropertiesOverflowMenu
                  currentPath={currentPath}
                  openAddProfileModalAtPath={openAddProfileModalAtPath}
                  propertySortOrder={propertySortOrder || "alphabetical"}
                  onPropertySortOrderChange={setPropertySortOrderWithStorage}
                  hasMergedProperties={false}
                />
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <SortDropdown<PropertySortOrder>
                    options={SORT_ORDER_OPTIONS}
                    selectedOption={propertySortOrder || "alphabetical"}
                    onOptionChange={setPropertySortOrderWithStorage}
                    getDisplayName={getSortOrderDisplayName}
                  />
                  <VscodeToolbarButton
                    title={l10n.t('Create new property for "{0}"', extractProfileKeyFromPath(currentPath))}
                    onClick={() => openAddProfileModalAtPath(currentPath)}
                    id="add-profile-property-button"
                  >
                    <span className="codicon codicon-add"></span>
                  </VscodeToolbarButton>
                </div>
              )}
            </>
          )}
        </div>
        <div style={{ paddingLeft: isPropertiesHeader ? "16px" : "0px" }}>
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
  highlightPropertyKey,
  onHighlightPropertyKeyConsumed,
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

  // Blink the highlighted property row once when highlightPropertyKey is set.
  // Uses a retry loop because RenderConfig may mount before the DOM rows finish painting
  // (profile selection and highlight are set in the same React batch).
  const highlightConsumedRef = useRef<string | null>(null);
  useEffect(() => {
    // Reset consumed tracker when highlight is cleared so re-invocations work.
    if (!highlightPropertyKey) {
      highlightConsumedRef.current = null;
      return;
    }
    if (highlightPropertyKey === highlightConsumedRef.current) return;
    highlightConsumedRef.current = highlightPropertyKey;

    let attempts = 0;
    const maxAttempts = 20; // try for up to 2 seconds (20 × 100ms)
    let timerId: ReturnType<typeof setTimeout>;

    const tryBlink = () => {
      const el = document.querySelector<HTMLElement>(`[data-property-key="${CSS.escape(highlightPropertyKey)}"]`);
      if (!el) {
        attempts++;
        if (attempts < maxAttempts) {
          timerId = setTimeout(tryBlink, 100);
        } else {
          // Give up — clear the key so another invocation can retry.
          onHighlightPropertyKeyConsumed?.();
        }
        return;
      }

      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const row = el.closest<HTMLElement>(".config-item.property-entry") ?? el.closest<HTMLElement>(".config-item") ?? el;
      row.classList.add("property-highlight-blink");
      row.addEventListener(
        "animationend",
        () => {
          row.classList.remove("property-highlight-blink");
        },
        { once: true }
      );
      // Clear the key as soon as the blink starts, not on animationend: a save (even on another
      // profile) force-remounts this tree via sortOrderVersion, and if the key were still set when
      // that remount happens, the retry loop would replay the stale highlight.
      onHighlightPropertyKeyConsumed?.();
    };

    // Initial delay — profile panel needs one render cycle after profile selection.
    timerId = setTimeout(tryBlink, 100);

    return () => clearTimeout(timerId);
  }, [highlightPropertyKey]);

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
