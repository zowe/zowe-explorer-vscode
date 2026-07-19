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

import type { Dispatch, SetStateAction } from "react";
import { toggleProfileDefault } from "../utils/profileHelpers";

type SimplePendingDefaultsMap = { [configPath: string]: { [key: string]: { value: string; path: string[] } } };

interface DefaultStarButtonProps {
  profileKey: string;
  profileType: string | null;
  isDefault: boolean;
  /** "tree" uses class-driven styling; "flat" uses the inline-styled star. */
  variant: "tree" | "flat";
  configurations?: any[];
  selectedTab?: number | null;
  setPendingDefaults?: Dispatch<SetStateAction<SimplePendingDefaultsMap>>;
  onSetAsDefault?: (profileKey: string) => void;
}

/**
 * The star toggle that sets/clears a profile's default status. Shared by the tree and flat
 * profile lists; `variant` selects the list-specific styling.
 */
export function DefaultStarButton({
  profileKey,
  profileType,
  isDefault,
  variant,
  configurations,
  selectedTab,
  setPendingDefaults,
  onSetAsDefault,
}: DefaultStarButtonProps) {
  const runToggle = () =>
    toggleProfileDefault({ profileKey, profileType, isDefault, configurations, selectedTab, setPendingDefaults, onSetAsDefault });

  const title = isDefault ? "Click to remove default" : "Set as default";

  if (variant === "tree") {
    return (
      <button
        className="profile-star-button profile-tree-icon-button"
        onClick={(e) => {
          e.stopPropagation();
          runToggle();
        }}
        draggable={false}
        title={title}
      >
        <span
          className={`codicon codicon-${isDefault ? "star-full" : "star-empty"} profile-tree-default-star ${
            isDefault ? "profile-tree-default-star--active" : "profile-tree-default-star--inactive"
          }`}
        />
      </button>
    );
  }

  return (
    <button
      className="profile-star-button"
      onClick={(e) => {
        e.stopPropagation();
        runToggle();
      }}
      style={{
        background: "transparent",
        border: "none",
        padding: "2px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
      title={title}
    >
      <span
        className={`codicon codicon-${isDefault ? "star-full" : "star-empty"}`}
        style={{
          fontSize: "16px",
          color: isDefault ? "var(--vscode-textPreformat-foreground)" : "var(--vscode-disabledForeground)",
        }}
      />
    </button>
  );
}
