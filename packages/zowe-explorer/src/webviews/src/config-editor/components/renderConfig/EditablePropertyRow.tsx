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

import { PropertyValueInput } from "./PropertyValueInput";
import { PropertyActionButtons } from "./PropertyActionButtons";
import { formatInheritedFromWithRenames } from "./inheritedFrom";
import { InfoIcon } from "../InfoIcon";
import { getProfileType, extractProfileKeyFromPath } from "../../utils";
import type { RenderConfigCtx } from "./context";

interface EditablePropertyRowProps {
  ctx: RenderConfigCtx;
  fullKey: string;
  displayKey: string | undefined;
  path: string[];
  configPath: string;
  pendingValue: any;
  isFromMergedProps: boolean;
  isSecurePropertyForSorting: boolean;
  mergedProps: any;
  mergedPropData: any;
}

/**
 * A regular editable property: a label, its value control (`PropertyValueInput`) and trailing
 * action buttons (`PropertyActionButtons`), wrapped in a click-to-navigate row when the value is
 * inherited from another profile.
 */
export function EditablePropertyRow({
  ctx,
  fullKey,
  displayKey,
  path,
  configPath,
  pendingValue,
  isFromMergedProps,
  isSecurePropertyForSorting,
  mergedProps,
  mergedPropData,
}: EditablePropertyRowProps) {
  const {
    propertyDescriptions,
    isMergedPropertySecure,
    isPropertySecure,
    configurations,
    selectedTab,
    pendingChanges,
    renames,
    selectedProfileKey,
    handleNavigateToSource,
    schemaValidations,
  } = ctx;

  const schemaDescription = displayKey ? propertyDescriptions[displayKey] || null : null;
  const profileTypeForDefault = extractProfileKeyFromPath(path)
    ? getProfileType({ profileKey: extractProfileKeyFromPath(path), selectedTab, configurations, pendingChanges, renames })
    : null;
  const schemaDefault =
    displayKey && profileTypeForDefault
      ? (schemaValidations[configPath]?.propertySchema[profileTypeForDefault]?.[displayKey]?.default ?? null)
      : null;

  const isDeletedMergedProperty = false;

  // isFromMergedProps and mergedPropData are already calculated by the caller
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
        style={
          isFromMergedProps && !isDeletedMergedProperty
            ? {
                color: "var(--vscode-descriptionForeground)",
                cursor: "pointer",
              }
            : {}
        }
      >
        <span className="config-label-text" title={displayKey ?? ""}>
          {displayKey}
        </span>
        {schemaDescription && displayKey && (
          <InfoIcon fieldKey={displayKey} description={schemaDescription} defaultValue={schemaDefault ?? undefined} />
        )}
      </span>
      <PropertyValueInput
        ctx={ctx}
        displayKey={displayKey}
        path={path}
        fullKey={fullKey}
        pendingValue={pendingValue}
        isFromMergedProps={isFromMergedProps}
        mergedProps={mergedProps}
        mergedPropData={mergedPropData}
        isSecureProperty={isSecureProperty}
        isLocalSecureProperty={isLocalSecureProperty}
        isSecureForSorting={isSecureForSorting}
        inheritedInputClass={inheritedInputClass}
      />
      <PropertyActionButtons
        ctx={ctx}
        displayKey={displayKey}
        path={path}
        fullKey={fullKey}
        pendingValue={pendingValue}
        isFromMergedProps={isFromMergedProps}
        mergedProps={mergedProps}
      />
    </div>
  );

  return (
    <div
      key={fullKey}
      className="config-item property-entry"
      data-testid="profile-property-entry"
      data-property-key={displayKey ?? ""}
      onClick={isFromMergedProps && !isDeletedMergedProperty && jsonLoc ? () => handleNavigateToSource(jsonLoc, osLoc) : undefined}
      title={
        isFromMergedProps && !isDeletedMergedProperty && jsonLoc
          ? formatInheritedFromWithRenames(jsonLoc, osLoc, selectedProfileKey, configPath, renames)
          : undefined
      }
      style={isFromMergedProps && !isDeletedMergedProperty && jsonLoc ? { cursor: "pointer" } : {}}
    >
      {readOnlyContainer}
    </div>
  );
}
