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

interface DefaultBadgeProps {
  profileType: string;
}

/**
 * A capsule-style, non-interactive indicator shown next to the profile type when the profile is
 * the default for its type. Shared by both the tree and flat profile lists.
 */
export function DefaultBadge({ profileType }: DefaultBadgeProps) {
  return (
    <span className="profile-default-badge" data-testid="profile-default-badge" title={l10n.t("Default profile for type '{0}'", profileType)}>
      {l10n.t("Default")}
    </span>
  );
}
