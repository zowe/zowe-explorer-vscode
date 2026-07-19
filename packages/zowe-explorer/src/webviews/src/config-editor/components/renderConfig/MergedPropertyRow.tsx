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
import { stringifyValueByType } from "../../utils";
import { formatInheritedFrom } from "./inheritedFrom";
import type { RenderConfigCtx } from "./context";

interface MergedPropertyRowProps {
  ctx: RenderConfigCtx;
  fullKey: string;
  displayKey: string | undefined;
  path: string[];
  mergedProps: any;
  configPath: string;
  value: any;
}

/**
 * A property that exists only as a merged/inherited value (synthesized into the entry list for
 * sorting). Rendered disabled with an "overwrite" action; returns `null` if, on second look, the
 * property should not actually be shown as merged.
 */
export function MergedPropertyRow({ ctx, fullKey, displayKey, path, mergedProps, configPath, value }: MergedPropertyRowProps) {
  const { isPropertyFromMergedProps, handleNavigateToSource, isMergedPropertySecure, handleUnlinkMergedProperty } = ctx;

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
      title={jsonLoc ? formatInheritedFrom(jsonLoc, osLoc) : undefined}
      style={{ cursor: jsonLoc ? "pointer" : "default" }}
    >
      <div className="config-item-container " data-testid="profile-property-container">
        <span
          className="config-label"
          style={{
            color: "var(--vscode-descriptionForeground)",
            cursor: "pointer",
          }}
        >
          <span className="config-label-text" title={displayKey ?? ""}>{displayKey}</span>
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
