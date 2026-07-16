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

import { getProfileTypeBadgeStyle } from "../utils/profileColors";

interface ProfileTypeBadgeProps {
  profileType: string;
  isLightTheme: boolean;
  /** Whether this type is the currently active filter (changes the tooltip). */
  filterActive: boolean;
  onToggleFilter: () => void;
}

/**
 * The clickable, theme-aware profile-type pill shown next to a profile. Clicking it toggles the
 * type filter. Shared by both the tree and flat profile lists.
 */
export function ProfileTypeBadge({ profileType, isLightTheme, filterActive, onToggleFilter }: ProfileTypeBadgeProps) {
  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        onToggleFilter();
      }}
      style={getProfileTypeBadgeStyle(profileType, isLightTheme)}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = "0.8";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = "1";
      }}
      title={filterActive ? `Click to clear ${profileType} filter` : `Click to filter by ${profileType} type`}
    >
      {profileType}
    </span>
  );
}
