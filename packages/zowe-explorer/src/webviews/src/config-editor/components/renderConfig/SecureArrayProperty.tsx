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
import type { RenderConfigCtx } from "./context";

interface SecureArrayPropertyProps {
  ctx: RenderConfigCtx;
  fullKey: string;
  displayKey: string | undefined;
  path: string[];
  currentPath: string[];
  renderValue: any[];
}

/**
 * A non-simple array within a profile (rendered as a titled list of password inputs). The
 * literal `secure` array is hidden because secure properties are surfaced in `properties`.
 */
export function SecureArrayProperty({ ctx, fullKey, displayKey, path, currentPath, renderValue }: SecureArrayPropertyProps) {
  const {
    hiddenItems,
    configurations,
    selectedTab,
    pendingChanges,
    handleChange,
    pendingPropertyDeletion,
    confirmDeleteProperty,
    setPendingPropertyDeletion,
    handleDeleteProperty,
  } = ctx;

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
}
