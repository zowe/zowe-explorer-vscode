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
import { configComplexValueLines } from "../ConfigComplexValueLines";
import { formatInheritedFrom } from "./inheritedFrom";
import type { RenderConfigCtx } from "./context";

interface ComplexValuePropertyProps {
  ctx: RenderConfigCtx;
  fullKey: string;
  displayKey: string | undefined;
  isFromMergedProps: boolean;
  mergedPropData: any;
  pendingValue: any;
  value: any;
}

/**
 * A sub-object or array nested inside `properties` that is rendered as a single read-only
 * complex value (click-to-navigate) rather than recursed into.
 */
export function ComplexValueProperty({
  ctx,
  fullKey,
  displayKey,
  isFromMergedProps,
  mergedPropData,
  pendingValue,
  value,
}: ComplexValuePropertyProps) {
  const { handleNavigateToSource, configurations, selectedTab, vscodeApi, selectedProfileKey } = ctx;

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
        <span className="config-label" style={{ fontWeight: "bold" }}>
          <span className="config-label-text" title={displayKey ?? ""}>{displayKey}</span>
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
            isFromMergedProps && mergedPropData?.jsonLoc
              ? formatInheritedFrom(mergedPropData.jsonLoc, mergedPropData.osLoc)
              : l10n.t("Click to navigate to profile")
          }
          style={{
            backgroundColor: isFromMergedProps ? "var(--vscode-input-disabledBackground)" : "var(--vscode-input-background)",
            border: isFromMergedProps ? "1px solid var(--vscode-input-background)" : "1px solid var(--vscode-input-border)",
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
