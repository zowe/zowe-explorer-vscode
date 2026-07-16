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
import { isFileProperty } from "../../utils/propertyUtils";
import type { RenderConfigCtx } from "./context";

interface PropertyActionButtonsProps {
  ctx: RenderConfigCtx;
  displayKey: string | undefined;
  path: string[];
  fullKey: string;
  pendingValue: any;
  isFromMergedProps: boolean;
  mergedProps: any;
}

/**
 * The trailing action buttons for an editable property: make-secure, file-picker, edit
 * auth-order, delete (with inline confirm) and overwrite-merged. Renders nothing when the
 * property is a non-`properties` `type` field or when no actions apply.
 */
export function PropertyActionButtons({ ctx, displayKey, path, fullKey, pendingValue, isFromMergedProps, mergedProps }: PropertyActionButtonsProps) {
  const {
    isPropertySecure,
    canPropertyBeSecure,
    pendingPropertyDeletion,
    secureValuesAllowed,
    vscodeApi,
    configurations,
    selectedTab,
    pendingChanges,
    renames,
    openAddProfileModalAtPath,
    handleToggleSecure,
    confirmDeleteProperty,
    setPendingPropertyDeletion,
    handleDeleteProperty,
    handleUnlinkMergedProperty,
  } = ctx;

  const isDeletedMergedProperty = false;

  if (!((displayKey !== "type" || path[path.length - 1] === "properties") && displayKey)) {
    return null;
  }

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
}
