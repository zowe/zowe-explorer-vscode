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
import { useUtilityHelpers } from "../hooks/useUtilityHelpers";

interface DefaultBadgeProps {
  profileKey: string;
  profileType: string;
  /** Whether the profile is the default for its type in the config shown in the current tab. */
  isDefault: boolean;
}

/**
 * A capsule-style, non-interactive indicator shown next to the profile type. Shared by both the
 * tree and flat profile lists. Renders a single badge:
 * - "Default": default for its type in the current config.
 * - "Project default": a global profile that a project config's `defaults` points at.
 * - "Shared default": both of the above.
 */
export function DefaultBadge({ profileKey, profileType, isDefault }: DefaultBadgeProps) {
  const { getProjectDefaultSource } = useUtilityHelpers();
  const sourceConfigPath = getProjectDefaultSource(profileKey);
  if (!isDefault && !sourceConfigPath) return null;

  const sourceName = sourceConfigPath?.split(/[\\/]/).pop() ?? sourceConfigPath;
  let label = l10n.t("Default");
  let title = l10n.t("Default profile for type '{0}'", profileType);
  if (sourceConfigPath && isDefault) {
    label = l10n.t("Shared default");
    title = l10n.t("Default profile for type '{0}' at both global and project level (also set in {1})", profileType, sourceName!);
  } else if (sourceConfigPath) {
    label = l10n.t("Project default");
    title = l10n.t("Default profile for type '{0}' in {1}", profileType, sourceName!);
  }

  return (
    <span className="profile-default-badge" data-testid="profile-default-badge" title={title}>
      {label}
    </span>
  );
}
