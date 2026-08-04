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
import { stringifyValueByType, getPropertyTypeForConfigEditor } from "../../utils";
import { EnvVarAutocomplete } from "../EnvVarAutocomplete";
import type { RenderConfigCtx } from "./context";
import { MERGED_DISABLED_INPUT_STYLE } from "./styles";

interface PropertyValueInputProps {
  ctx: RenderConfigCtx;
  displayKey: string | undefined;
  path: string[];
  fullKey: string;
  pendingValue: any;
  isFromMergedProps: boolean;
  mergedProps: any;
  mergedPropData: any;
  isSecureProperty: boolean;
  isLocalSecureProperty: boolean;
  isSecureForSorting: boolean;
  inheritedInputClass: string;
}

/**
 * Renders the editable value control for a single property: a type-select, a secure password
 * field, a boolean/number input, a free-text field with env-var autocomplete, or a read-only
 * placeholder for `null`/complex values — matching the property's schema type and state.
 */
export function PropertyValueInput({
  ctx,
  displayKey,
  path,
  fullKey,
  pendingValue,
  isFromMergedProps,
  mergedProps,
  mergedPropData,
  isSecureProperty,
  isLocalSecureProperty,
  isSecureForSorting,
  inheritedInputClass,
}: PropertyValueInputProps) {
  const {
    handleChange,
    getWizardTypeOptions,
    showMergedProperties,
    isCurrentProfileUntyped,
    configurations,
    selectedTab,
    schemaValidations,
    pendingChanges,
    renames,
    secureValuesAllowed,
    vscodeApi,
    isUntypedProfile,
  } = ctx;

  const isDeletedMergedProperty = false;

  if (displayKey === "type" && path[path.length - 1] !== "properties") {
    return (
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
    );
  }

  if (typeof pendingValue === "string" || typeof pendingValue === "boolean" || typeof pendingValue === "number") {
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
      const isMergedDisabled = isFromMergedProps && !isDeletedMergedProperty;
      const isCredentialDisabled = !isMergedDisabled && !secureValuesAllowed && (isSecureProperty || isLocalSecureProperty);
      const credentialDisabledTitle = l10n.t("A credential manager is not available. Click to open VS Code settings to enable secure credentials.");
      return (
        <input
          className={`config-input${inheritedInputClass}`}
          type="password"
          placeholder={storedInKeyring || secureDisplayValue || isUntypedProfile ? "••••••••" : ""}
          value={secureDisplayValue}
          readOnly={isCredentialDisabled}
          onChange={isCredentialDisabled ? undefined : (e) => handleChange(fullKey, (e.target as HTMLInputElement).value)}
          onClick={
            isCredentialDisabled
              ? () =>
                  vscodeApi.postMessage({
                    command: "OPEN_VSCODE_SETTINGS",
                    searchText: "Zowe.vscode-extension-for-zowe Secure Credentials Enabled",
                  })
              : undefined
          }
          disabled={isMergedDisabled}
          title={isCredentialDisabled ? credentialDisabledTitle : undefined}
          style={
            isMergedDisabled || isCredentialDisabled
              ? {
                  backgroundColor: "var(--vscode-input-disabledBackground)",
                  color: "var(--vscode-descriptionForeground)",
                  cursor: isCredentialDisabled ? "pointer" : "default",
                  fontFamily: "monospace",
                  pointerEvents: isMergedDisabled ? "none" : undefined,
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
          style={isFromMergedProps && !isDeletedMergedProperty ? MERGED_DISABLED_INPUT_STYLE : {}}
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
          style={isFromMergedProps && !isDeletedMergedProperty ? MERGED_DISABLED_INPUT_STYLE : {}}
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
          style={isFromMergedProps && !isDeletedMergedProperty ? MERGED_DISABLED_INPUT_STYLE : {}}
          vscodeApi={vscodeApi}
          dataPropertyKey={displayKey}
        />
      );
    }
  }

  if (pendingValue === null || pendingValue === undefined) {
    return (
      <span
        style={{
          fontFamily: "monospace",
          fontStyle: "italic",
          color: "var(--vscode-disabledForeground)",
          opacity: 0.7,
        }}
      >
        null
      </span>
    );
  }

  return <span>{"{...}"}</span>;
}
